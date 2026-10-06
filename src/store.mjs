import { createHash, randomBytes } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export class ConfirmationStore {
  constructor(file, { tokenTtlMs, retentionMs }) {
    this.file = file;
    this.tokenTtlMs = tokenTtlMs;
    this.retentionMs = retentionMs;
    this.data = { version: 1, tokens: {} };
    this.queue = Promise.resolve();
  }

  async init() {
    await mkdir(dirname(this.file), { recursive: true });
    try {
      const parsed = JSON.parse(await readFile(this.file, 'utf8'));
      if (parsed?.version === 1 && parsed.tokens && typeof parsed.tokens === 'object') {
        this.data = parsed;
      }
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    await this.cleanup();
  }

  async createToken({ orderId, redirectUrl }) {
    const rawToken = randomBytes(32).toString('base64url');
    const tokenHash = hashToken(rawToken);
    const createdAt = new Date();
    const entry = {
      order_id: orderId,
      created_at: createdAt.toISOString(),
      expires_at: new Date(createdAt.getTime() + this.tokenTtlMs).toISOString(),
      redirect_url: redirectUrl,
      status: 'pending'
    };
    await this.mutate(() => {
      this.data.tokens[tokenHash] = entry;
    });
    return { rawToken, entry: structuredClone(entry) };
  }

  lookup(rawToken) {
    if (!isPlausibleToken(rawToken)) return undefined;
    const entry = this.data.tokens[hashToken(rawToken)];
    if (!entry || Date.parse(entry.expires_at) <= Date.now()) return undefined;
    return structuredClone(entry);
  }

  lookupSigned(signature) {
    const entry = this.data.tokens[signedKey(signature)];
    return entry ? structuredClone(entry) : undefined;
  }

  async confirm(rawToken, details) {
    if (!isPlausibleToken(rawToken)) return { status: 'invalid' };
    const tokenHash = hashToken(rawToken);
    return this.mutate(() => {
      const entry = this.data.tokens[tokenHash];
      if (!entry || Date.parse(entry.expires_at) <= Date.now()) return { status: 'invalid' };
      if (entry.status === 'confirmed') {
        return { status: 'already_confirmed', entry: structuredClone(entry) };
      }
      Object.assign(entry, {
        status: 'confirmed',
        confirmed_at: new Date().toISOString(),
        ip: details.ip,
        user_agent: details.userAgent,
        consent: true,
        notice_version: details.noticeVersion
      });
      return { status: 'confirmed', entry: structuredClone(entry) };
    });
  }

  async confirmSigned(signed, details, redirectUrl, ttlMs) {
    const key = signedKey(signed.signature);
    return this.mutate(() => {
      const existing = this.data.tokens[key];
      if (existing?.status === 'confirmed') {
        return { status: 'already_confirmed', entry: structuredClone(existing) };
      }
      const createdAt = new Date(signed.timestamp * 1000);
      const entry = {
        order_id: signed.orderId,
        order_name: signed.orderName,
        created_at: createdAt.toISOString(),
        expires_at: new Date(createdAt.getTime() + ttlMs).toISOString(),
        redirect_url: redirectUrl,
        status: 'confirmed',
        confirmed_at: new Date().toISOString(),
        ip: details.ip,
        user_agent: details.userAgent,
        consent: true,
        notice_version: details.noticeVersion,
        link_type: 'shopify_hmac'
      };
      this.data.tokens[key] = entry;
      return { status: 'confirmed', entry: structuredClone(entry) };
    });
  }

  list() {
    return Object.values(this.data.tokens)
      .map((entry) => structuredClone(entry))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  async cleanup() {
    const cutoff = Date.now() - this.retentionMs;
    await this.mutate(() => {
      for (const [key, entry] of Object.entries(this.data.tokens)) {
        const referenceTime = Date.parse(entry.confirmed_at || entry.expires_at || entry.created_at);
        if (referenceTime < cutoff) delete this.data.tokens[key];
      }
    });
  }

  mutate(action) {
    const operation = this.queue.then(async () => {
      const result = action();
      await this.persist();
      return result;
    });
    this.queue = operation.catch(() => {});
    return operation;
  }

  async persist() {
    const temporary = `${this.file}.tmp`;
    await writeFile(temporary, `${JSON.stringify(this.data, null, 2)}\n`, { mode: 0o600 });
    await rename(temporary, this.file);
  }
}

export function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

function signedKey(signature) {
  return `signed:${hashToken(signature)}`;
}

function isPlausibleToken(token) {
  return typeof token === 'string' && /^[A-Za-z0-9_-]{40,64}$/.test(token);
}

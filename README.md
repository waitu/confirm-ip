# API xác nhận đơn hàng và ghi nhận IP

Bản thử nghiệm không cần cài package. API tạo một token ngẫu nhiên, chỉ lưu SHA-256 của token và ghi IP khi trình duyệt tự gửi form `POST` sau khi khách bấm link email.

Production hỗ trợ link HMAC do Shopify Liquid tự tạo từ `id`, `created_at` và `name`. Backend kiểm tra chữ ký và thời hạn, trả một form auto-POST không có checkbox, ghi nhận xác nhận rồi chuyển về store. Việc tách GET và POST giúp giảm trường hợp link scanner chỉ đọc URL nhưng vô tình tạo xác nhận; thay đổi bất kỳ tham số nào đều làm link vô hiệu.

## Chạy thử trên máy

Yêu cầu: Node.js 20 trở lên và PowerShell.

Terminal 1:

```powershell
cd C:\Users\Admin\Documents\Codex\2026-10-05\g-i-mail-x-c-nh\outputs\shopify-order-ip-api
.\run-test.ps1
```

Terminal 2, tạo email test:

```powershell
cd C:\Users\Admin\Documents\Codex\2026-10-05\g-i-mail-x-c-nh\outputs\shopify-order-ip-api
node .\scripts\create-test-email.mjs --order-id TEST-1001 --to email-cua-ban@example.com
```

Script in ra link và tạo hai file trong `out/`:

- `TEST-1001.html`: mở trực tiếp trong trình duyệt để thử.
- `TEST-1001.eml`: email mẫu có thể mở bằng ứng dụng email; tùy ứng dụng, bạn có thể chuyển tiếp nó tới chính mình.

Sau khi bấm link, tick đồng ý và xác nhận, xem dữ liệu đã lưu:

```powershell
$key = ((Get-Content .env | Where-Object { $_ -like 'ADMIN_API_KEY=*' }) -split '=', 2)[1]
Invoke-RestMethod http://localhost:8787/api/confirmations -Headers @{ 'x-admin-key' = $key }
```

Chạy test tự động:

```powershell
node --test
```

Tạo một link HMAC giống link Shopify Liquid để thử thủ công:

```powershell
node .\scripts\create-shopify-test-link.mjs --order-id 1234567890 --order-name '#TEST-1001'
```

## API

### `POST /api/test-link`

Chỉ dành cho backend/admin, yêu cầu header `x-admin-key`.

```json
{
  "order_id": "#1001"
}
```

Kết quả gồm `confirmation_url` và `expires_at`.

### `GET /order-confirm?t=...`

Kiểm tra token và trả trang auto-POST. Endpoint GET không ghi IP và không thay đổi trạng thái đơn để tránh bot/link scanner chỉ quét URL tự xác nhận.

### `POST /order-confirm`

Ghi IP, user-agent, thời gian, phiên bản điều khoản, cơ sở xử lý `store_terms` và trạng thái `confirmed`, rồi redirect `303` về store.

### `GET /api/confirmations`

Chỉ dành cho backend/admin, trả về danh sách để kiểm thử.

## Khi deploy thật

1. Dùng HTTPS và đặt `BASE_URL` thành domain API công khai.
2. Đổi `STORE_REDIRECT_URL` sang store thật.
3. Chỉ đặt `TRUST_PROXY=true` khi API thật sự chạy sau reverse proxy/CDN tin cậy. Nếu cấu hình sai, client có thể giả header IP.
4. Không public `ADMIN_API_KEY`; endpoint tạo link phải được gọi từ backend/webhook Shopify, không gọi từ email hay trình duyệt khách.
5. Dữ liệu hiện lưu trong JSON, phù hợp demo một process. Production nên dùng PostgreSQL/MySQL, mã hóa dữ liệu nhạy cảm, phân quyền truy cập, backup và chính sách xóa dữ liệu.
6. IP trên localhost luôn là `127.0.0.1` hoặc `::1`. Muốn thấy IP Internet thật phải deploy API công khai.
7. GeoIP chưa được bật ở bản này. Có thể thêm sau bằng database MaxMind hoặc dịch vụ tương đương.

## Deploy bằng Docker trên VPS

Clone source và tạo cấu hình riêng trên VPS:

```bash
git clone git@github.com:waitu/confirm-ip.git /root/confirm-ip
cd /root/confirm-ip
cp .env.example .env
mkdir -p data
chown 1000:1000 data
chmod 700 data
```

Các giá trị production chính:

```dotenv
PORT=8787
BASE_URL=https://confirm.forgedride.co
ADMIN_API_KEY=mot-khoa-ngau-nhien-toi-thieu-32-byte
SHOPIFY_LINK_SECRET=mot-khoa-hmac-khac-toi-thieu-32-byte
STORE_REDIRECT_URL=https://forgedride.co/
TOKEN_TTL_HOURS=168
SIGNED_LINK_TTL_DAYS=30
RETENTION_DAYS=90
TRUST_PROXY=true
DATA_FILE=/app/data/store.json
```

Khởi động và kiểm tra nội bộ:

```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps
curl http://127.0.0.1:8787/health
```

Compose chỉ publish API tại `127.0.0.1:8787`. Không mở port 8787 trong UFW; Nginx sẽ nhận HTTPS trên port 443 và reverse proxy vào địa chỉ nội bộ này.

Cài virtual host Nginx sau khi container healthy:

```bash
install -m 644 deploy/nginx-confirm.forgedride.co.conf /etc/nginx/sites-available/confirm.forgedride.co
ln -s /etc/nginx/sites-available/confirm.forgedride.co /etc/nginx/sites-enabled/confirm.forgedride.co
nginx -t
systemctl reload nginx
```

Sau khi DNS `confirm.forgedride.co` đã trỏ về VPS và phân giải đúng, cấp TLS:

```bash
certbot --nginx -d confirm.forgedride.co
```

## Lưu ý quyền riêng tư và độ chính xác

IP là dữ liệu cá nhân ở nhiều khu vực pháp lý và GeoIP chỉ cho vị trí gần đúng. Nội dung test dùng một checkbox minh bạch; trước khi dùng production, hãy cập nhật privacy policy, mục đích xử lý, thời hạn lưu và cơ sở pháp lý phù hợp nơi bạn bán hàng. Không nên coi việc khách bấm một link không có thông báo là đồng ý marketing.

Một số VPN, mạng di động, Apple Private Relay hoặc proxy doanh nghiệp làm IP/GeoIP không phản ánh vị trí thật. Không dùng dữ liệu này như nguồn duy nhất để quyết định quảng cáo.

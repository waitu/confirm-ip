$ErrorActionPreference = 'Stop'
Push-Location $PSScriptRoot
try {
  if (-not (Test-Path -LiteralPath '.env')) {
    $bytes = New-Object byte[] 32
    $random = [Security.Cryptography.RandomNumberGenerator]::Create()
    try {
      $random.GetBytes($bytes)
    }
    finally {
      $random.Dispose()
    }
    $adminKey = [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
    @(
      'PORT=8787'
      'BASE_URL=http://localhost:8787'
      "ADMIN_API_KEY=$adminKey"
      'STORE_REDIRECT_URL=https://example.myshopify.com/'
      'TOKEN_TTL_HOURS=168'
      'RETENTION_DAYS=90'
      'TRUST_PROXY=false'
      'DATA_FILE=./data/store.json'
    ) | Set-Content -LiteralPath '.env' -Encoding utf8
    Write-Host 'Da tao file .env voi ADMIN_API_KEY ngau nhien.'
  }
  node src/server.mjs
}
finally {
  Pop-Location
}

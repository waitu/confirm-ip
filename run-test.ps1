$ErrorActionPreference = 'Stop'
Push-Location $PSScriptRoot
try {
  function New-RandomKey {
    $bytes = New-Object byte[] 32
    $random = [Security.Cryptography.RandomNumberGenerator]::Create()
    try {
      $random.GetBytes($bytes)
    }
    finally {
      $random.Dispose()
    }
    return [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
  }

  if (-not (Test-Path -LiteralPath '.env')) {
    $adminKey = New-RandomKey
    $linkSecret = New-RandomKey
    @(
      'PORT=8787'
      'BASE_URL=http://localhost:8787'
      "ADMIN_API_KEY=$adminKey"
      "SHOPIFY_LINK_SECRET=$linkSecret"
      'STORE_REDIRECT_URL=https://example.myshopify.com/'
      'TOKEN_TTL_HOURS=168'
      'SIGNED_LINK_TTL_DAYS=30'
      'RETENTION_DAYS=90'
      'TRUST_PROXY=false'
      'DATA_FILE=./data/store.json'
    ) | Set-Content -LiteralPath '.env' -Encoding utf8
    Write-Host 'Da tao file .env voi ADMIN_API_KEY ngau nhien.'
  }
  elseif (-not (Select-String -LiteralPath '.env' -Pattern '^SHOPIFY_LINK_SECRET=' -Quiet)) {
    Add-Content -LiteralPath '.env' -Value "SHOPIFY_LINK_SECRET=$(New-RandomKey)" -Encoding utf8
    Add-Content -LiteralPath '.env' -Value 'SIGNED_LINK_TTL_DAYS=30' -Encoding utf8
    Write-Host 'Da bo sung SHOPIFY_LINK_SECRET vao file .env.'
  }
  node src/server.mjs
}
finally {
  Pop-Location
}

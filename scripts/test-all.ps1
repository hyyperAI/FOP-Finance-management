$ErrorActionPreference = 'Stop'

function Invoke-Test {
  param([string]$Name, [string]$Path, [string[]]$Segments, [int]$WaitMs = 500)
  Write-Host ""
  Write-Host "=== $Name ===" -ForegroundColor Cyan
  if (-not (Test-Path $Path)) {
    Write-Host "MISSING FILE: $Path" -ForegroundColor Red
    return @{ name = $Name; status = 'missing' }
  }
  $content = Get-Content $Path -Raw
  foreach ($seg in $Segments) {
    if ($content -match $seg) {
      Write-Host "  found: $seg" -ForegroundColor Green
    } else {
      Write-Host "  MISSING: $seg" -ForegroundColor Red
    }
    Start-Sleep -Milliseconds $WaitMs
  }
  return @{ name = $Name; status = 'checked' }
}

$results = @()

# 1. Health endpoint
try {
  $r = Invoke-WebRequest 'http://localhost:3000/api/health' -UseBasicParsing -TimeoutSec 10
  Write-Host "HEALTH: $($r.StatusCode) $($r.Content)" -ForegroundColor Green
} catch {
  Write-Host "HEALTH FAIL: $($_.Exception.Message)" -ForegroundColor Red
}

# 2. Session (no auth = empty object)
try {
  $r = Invoke-WebRequest 'http://localhost:3000/api/auth/session' -UseBasicParsing -TimeoutSec 10
  Write-Host "SESSION: $($r.StatusCode) $($r.Content)" -ForegroundColor Green
} catch {
  Write-Host "SESSION FAIL: $($_.Exception.Message)" -ForegroundColor Red
}

# 3. CSRF
try {
  $r = Invoke-WebRequest 'http://localhost:3000/api/auth/csrf' -UseBasicParsing -TimeoutSec 10
  Write-Host "CSRF: $($r.StatusCode) $($r.Content)" -ForegroundColor Green
} catch {
  Write-Host "CSRF FAIL: $($_.Exception.Message)" -ForegroundColor Red
}
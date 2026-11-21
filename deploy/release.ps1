# Backend one-click release: package -> upload -> remote backup/restart/health-check/rollback
# Usage: powershell -ExecutionPolicy Bypass -File deploy\release.ps1
#        powershell -ExecutionPolicy Bypass -File deploy\release.ps1 -SkipTests
param(
    [switch]$SkipTests
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$pkg = "backend_$stamp.tar.gz"

if (-not $SkipTests) {
    Write-Host '[1/4] Running contract tests ...'
    Push-Location (Join-Path $root 'backend')
    try {
        python -m pytest tests\test_backend_contracts.py -q
        if ($LASTEXITCODE -ne 0) { throw 'Contract tests failed, release aborted.' }
    } finally {
        Pop-Location
    }
}

Write-Host "[2/4] Packaging $pkg ..."
tar -czf $pkg -C $root `
    --exclude='backend/.venv' `
    --exclude='backend/__pycache__' `
    --exclude='backend/**/__pycache__' `
    --exclude='backend/.pytest_cache' `
    --exclude='backend/**/*.pyc' `
    backend

Write-Host '[3/4] Uploading to nycj:/opt/deploy ...'
scp -o BatchMode=yes $pkg 'nycj:/opt/deploy/'
scp -o BatchMode=yes (Join-Path $PSScriptRoot 'remote_release.sh') 'nycj:/opt/deploy/remote_release.sh'

Write-Host '[4/4] Remote release (health check + auto rollback) ...'
ssh -o BatchMode=yes nycj "bash /opt/deploy/remote_release.sh $pkg"
$code = $LASTEXITCODE

Remove-Item $pkg -Force -ErrorAction SilentlyContinue
if ($code -ne 0) { throw "Release failed (exit $code), remote rollback attempted." }
Write-Host 'Release done.'

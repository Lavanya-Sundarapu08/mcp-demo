# Run script for PowerShell
Write-Host "=========================================================================" -ForegroundColor Cyan
Write-Host " Starting MCP-Powered AI Software Engineering Agent" -ForegroundColor Green
Write-Host " Dashboard: http://localhost:8000" -ForegroundColor Yellow
Write-Host "=========================================================================" -ForegroundColor Cyan

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

if (-not (Test-Path "$scriptDir\.venv")) {
    Write-Host "[!] Setting up virtual environment..." -ForegroundColor Yellow
    python -m venv .venv
    & "$scriptDir\.venv\Scripts\pip.exe" install -r requirements.txt
}

Write-Host "[*] Launching browser..." -ForegroundColor Green
Start-Process "http://localhost:8000"

Write-Host "[*] Starting FastAPI Server on port 8000..." -ForegroundColor Green
& "$scriptDir\.venv\Scripts\python.exe" -m uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port 8000

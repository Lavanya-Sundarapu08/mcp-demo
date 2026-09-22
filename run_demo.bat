@echo off
title MCP-Powered AI Software Engineering Agent
echo =========================================================================
echo  Starting MCP-Powered AI Software Engineering Agent
echo  Dashboard will be available at: http://localhost:8000
echo =========================================================================
echo.

if not exist .venv (
    echo [!] Virtual environment not found. Setting up...
    python -m venv .venv
    call .venv\Scripts\activate.bat
    pip install -r requirements.txt
) else (
    call .venv\Scripts\activate.bat
)

echo [*] Launching FastAPI Backend and Static Web Dashboard...
start http://localhost:8000
python -m uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port 8000
pause

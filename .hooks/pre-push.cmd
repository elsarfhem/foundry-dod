@echo off
:: Windows CMD wrapper for PowerShell pre-push hook
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0pre-push.ps1"
if %ERRORLEVEL% neq 0 (
  exit /b 1
)
exit /b 0


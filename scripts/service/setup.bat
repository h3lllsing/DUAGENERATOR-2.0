@echo off
:: Dua Video Studio - Quick Service Setup
:: Double-click to install or run from terminal
echo.
echo ========================================
echo   Dua Video Studio - Service Setup
echo ========================================
echo.

where nssm >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    if not exist "%~dp0..\tools\nssm\nssm.exe" (
        echo [!] NSSM not found. Downloading...
        echo     Visit https://nssm.cc/download
        echo     Extract nssm.exe to: tools\nssm\
        echo.
        echo     Creating tools\nssm\ directory...
        mkdir "%~dp0..\tools\nssm" 2>nul
        echo.
        echo [!] Please download nssm.exe manually and place it in:
        echo     %~dp0..\tools\nssm\nssm.exe
        echo.
        pause
        exit /b 1
    )
)

echo [1] Install as Windows Service (auto-start on boot)
echo [2] Start Dashboard (manual, no service)
echo [3] Stop Dashboard
echo [4] View Logs
echo [5] Uninstall Service
echo [6] Exit
echo.
set /p choice="Choose: "

if "%choice%"=="1" powershell -ExecutionPolicy Bypass -File "%~dp0service_manager.ps1" install
if "%choice%"=="2" powershell -ExecutionPolicy Bypass -File "%~dp0service_manager.ps1" start
if "%choice%"=="3" powershell -ExecutionPolicy Bypass -File "%~dp0service_manager.ps1" stop
if "%choice%"=="4" powershell -ExecutionPolicy Bypass -File "%~dp0service_manager.ps1" logs
if "%choice%"=="5" powershell -ExecutionPolicy Bypass -File "%~dp0service_manager.ps1" uninstall
if "%choice%"=="6" exit /b 0

echo.
pause

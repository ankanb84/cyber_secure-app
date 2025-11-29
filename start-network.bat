@echo off
echo ========================================
echo   Starting Secure Chat on Network
echo ========================================
echo.

REM Get IP address
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
    set IP=%%a
    goto :found
)
:found
set IP=%IP:~1%
echo Your IP Address: %IP%
echo.
echo Frontend URL: http://%IP%:3000
echo Backend URL: http://%IP%:5000
echo.
echo Share this link with your friend: http://%IP%:3000
echo.
echo ========================================
echo.

REM Start backend in new window
start "Backend Server" cmd /k "cd backend && npm start"

REM Wait a bit for backend to start
timeout /t 3 /nobreak >nul

REM Check if HTTPS certificates exist
cd ..
if exist localhost.pem (
    echo.
    echo 🔐 HTTPS certificates found - starting with HTTPS...
    cd frontend
    set HTTPS=true
    set HOST=0.0.0.0
    set WDS_SOCKET_HOST=0.0.0.0
    npm start
) else (
    echo.
    echo ⚠️  No HTTPS certificates found - using HTTP
    echo 💡 For Web Crypto API support, run: setup-https.bat
    echo.
    cd frontend
    set HOST=0.0.0.0
    set WDS_SOCKET_HOST=0.0.0.0
    npm start
)


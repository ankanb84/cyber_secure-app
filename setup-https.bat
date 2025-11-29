@echo off
echo ========================================
echo   Setting up HTTPS for Secure Chat
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

REM Check if mkcert exists
where mkcert >nul 2>&1
if %ERRORLEVEL% == 0 (
    echo ✅ mkcert found!
    echo.
    echo Installing local CA...
    mkcert -install
    echo.
    echo Creating certificates for localhost, 127.0.0.1, and %IP%...
    cd ..
    mkcert localhost 127.0.0.1 %IP%
    cd backend
    echo.
    echo ✅ Certificates created!
    echo.
    echo 📱 Use: https://%IP%:3000
    echo ✅ No security warnings (mkcert is trusted)
    goto :end
)

REM Check if openssl exists
where openssl >nul 2>&1
if %ERRORLEVEL% == 0 (
    echo ⚠️  mkcert not found. Using OpenSSL...
    echo.
    echo Creating self-signed certificate for %IP%...
    cd ..
    
    REM Create config file for OpenSSL
    echo [req] > openssl.conf
    echo distinguished_name=req_distinguished_name >> openssl.conf
    echo req_extensions=v3_req >> openssl.conf
    echo [req_distinguished_name] >> openssl.conf
    echo [v3_req] >> openssl.conf
    echo keyUsage=keyEncipherment,dataEncipherment >> openssl.conf
    echo extendedKeyUsage=serverAuth >> openssl.conf
    echo subjectAltName=@alt_names >> openssl.conf
    echo [alt_names] >> openssl.conf
    echo IP.1=%IP% >> openssl.conf
    echo IP.2=127.0.0.1 >> openssl.conf
    echo DNS.1=localhost >> openssl.conf
    
    openssl req -x509 -newkey rsa:2048 -keyout localhost-key.pem -out localhost.pem -days 365 -nodes -subj "/CN=%IP%" -config openssl.conf -extensions v3_req 2>nul
    del openssl.conf 2>nul
    
    cd backend
    if exist ..\localhost.pem (
        echo.
        echo ✅ Self-signed certificate created!
        echo.
        echo 📱 Use: https://%IP%:3000
        echo.
        echo ⚠️  IMPORTANT: You will see a security warning in your browser
        echo    Click "Advanced" → "Proceed to site" (or "Accept the Risk")
        echo    This is normal for self-signed certificates
    ) else (
        echo ❌ Failed to create certificate
        echo.
        echo Please check that OpenSSL is properly installed
    )
    goto :end
)

echo ❌ Neither mkcert nor openssl found!
echo.
echo Please install one of these:
echo.
echo Option 1: mkcert (recommended - no security warnings)
echo   Download from: https://github.com/FiloSottile/mkcert/releases
echo   Download: mkcert-v1.4.4-windows-amd64.exe
echo   Rename to: mkcert.exe
echo   Place in: C:\Windows\System32 (or add to PATH)
echo.
echo Option 2: OpenSSL
echo   Download from: https://slproweb.com/products/Win32OpenSSL.html
echo   Install and add to PATH
echo.
pause
:end


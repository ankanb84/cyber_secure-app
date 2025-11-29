# 🔐 Quick HTTPS Setup

## Why HTTPS?

Web Crypto API **requires HTTPS** when accessing via local network IP (like `192.168.150.108`).

- ✅ `https://192.168.150.108:3000` → Web Crypto API works
- ❌ `http://192.168.150.108:3000` → Web Crypto API disabled

## 🚀 Quick Setup (2 Steps)

### Step 1: Install mkcert (Recommended)

**Windows:**
1. Download: https://github.com/FiloSottile/mkcert/releases
2. Download `mkcert-v1.4.4-windows-amd64.exe`
3. Rename to `mkcert.exe`
4. Move to `C:\Windows\System32` (or any folder in PATH)

**Mac:**
```bash
brew install mkcert
```

### Step 2: Run Setup Script

**Windows:**
```bash
setup-https.bat
```

**Mac/Linux:**
```bash
node setup-https.js
```

This will:
- ✅ Install trusted local CA
- ✅ Create certificates for your IP
- ✅ Place files in project root

### Step 3: Restart Servers

**Backend:**
```bash
cd backend
npm start
```

**Frontend (with HTTPS):**
```bash
cd frontend
set HTTPS=true
set HOST=0.0.0.0
npm start
```

Or use the updated `start-network.bat` - it will automatically detect HTTPS certificates!

### Step 4: Access via HTTPS

Use the HTTPS link shown:
```
https://192.168.150.108:3000
```

**First time:** Browser shows security warning → Click "Advanced" → "Proceed"

With mkcert, you won't see warnings after the first setup!

## ✅ Done!

Now Web Crypto API will work on mobile devices! 🎉

## Alternative: Without mkcert

If you can't install mkcert, you can use OpenSSL (but you'll see security warnings):

1. Install OpenSSL: https://slproweb.com/products/Win32OpenSSL.html
2. Run `setup-https.bat` (it will use OpenSSL)
3. Accept security warnings in browser


# How to Share Your App on the Same WiFi Network

## Quick Setup Guide

### Step 1: Find Your Laptop's IP Address

**Windows:**
1. Open Command Prompt (Press `Win + R`, type `cmd`, press Enter)
2. Type: `ipconfig`
3. Look for "IPv4 Address" under your WiFi adapter (usually starts with 192.168.x.x or 10.x.x.x)
4. Copy that IP address (e.g., `192.168.1.100`)

**Mac/Linux:**
1. Open Terminal
2. Type: `ifconfig` or `ip addr`
3. Look for your WiFi adapter (usually `wlan0` or `en0`)
4. Find the `inet` address (e.g., `192.168.1.100`)

### Step 2: Start Your Servers

**Option A: Use the Network Start Script (Easiest)**

**Windows:**
Double-click `start-network.bat` or run:
```bash
start-network.bat
```

**Mac/Linux:**
```bash
chmod +x start-network.sh
./start-network.sh
```

**Option B: Manual Start**

**Backend (Terminal 1):**
```bash
cd backend
npm start
```

**Frontend (Terminal 2):**
```bash
cd frontend
set HOST=0.0.0.0
set WDS_SOCKET_HOST=0.0.0.0
npm start
```

The backend will automatically detect your IP and display it:
```
🌐 Network access: http://192.168.1.100:5000
📱 Frontend URL: http://192.168.1.100:3000
✅ Your friend can access the app at: http://192.168.1.100:3000
```

### Step 3: Share the Link with Your Friend

Give your friend this link (replace with YOUR IP address):
```
http://YOUR_IP_ADDRESS:3000
```

Example: `http://192.168.1.100:3000`

### Step 4: Your Friend Opens the Link

Your friend should:
1. Make sure they're on the same WiFi network
2. Open their browser
3. Go to the link you shared
4. The app will automatically connect to your backend server

## Troubleshooting

**If your friend can't access:**
1. **Check Firewall:** Make sure Windows Firewall allows connections on ports 3000 and 5000
   - Go to Windows Defender Firewall → Advanced Settings
   - Add inbound rules for ports 3000 and 5000

2. **Check IP Address:** Make sure you're using the correct IP (the one shown when you start the backend)

3. **Same Network:** Both devices must be on the same WiFi network

4. **Backend Running:** Make sure both frontend and backend servers are running

## Security Note

This setup is for local network testing only. For production, use proper hosting services.


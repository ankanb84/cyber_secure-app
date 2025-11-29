#!/bin/bash

echo "========================================"
echo "  Starting Secure Chat on Network"
echo "========================================"
echo ""

# Get IP address (works on Linux/Mac)
IP=$(hostname -I | awk '{print $1}')

if [ -z "$IP" ]; then
    # Try alternative method
    IP=$(ifconfig | grep -Eo 'inet (addr:)?([0-9]*\.){3}[0-9]*' | grep -Eo '([0-9]*\.){3}[0-9]*' | grep -v '127.0.0.1' | head -1)
fi

echo "Your IP Address: $IP"
echo ""
echo "Frontend URL: http://$IP:3000"
echo "Backend URL: http://$IP:5000"
echo ""
echo "Share this link with your friend: http://$IP:3000"
echo ""
echo "========================================"
echo ""

# Start backend in background
cd backend
npm start &
BACKEND_PID=$!

# Wait for backend to start
sleep 3

# Start frontend
cd ../frontend
HOST=0.0.0.0 WDS_SOCKET_HOST=0.0.0.0 npm start

# Kill backend when frontend stops
trap "kill $BACKEND_PID" EXIT


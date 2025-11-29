const axios = require('axios');

const API_URL = 'http://localhost:5000/api';

async function testGroupCreation() {
    try {
        // 1. Login as User A (Creator)
        console.log('Logging in as User A...');
        const loginResA = await axios.post(`${API_URL}/auth/login`, {
            username: 'ankanb84',
            password: 'password123'
        });

        // Note: In the real app, we need OTP verification. 
        // But for this test, I'll assume I can get a token or use the verify endpoint.
        // Since I don't have the OTP, I can't easily login via script unless I mock it or use an existing token.
        // Actually, I can use the verify-otp endpoint if I can see the server logs for OTP.
        // But I can't see server logs in real-time easily here without `read_terminal`.

        // Alternative: Create a new user who doesn't need OTP? No, all users need OTP.
        // Alternative: Use the `read_terminal` tool to get the OTP from the server output.

        // Let's try to register a NEW user, which logs them in automatically?
        // Register endpoint returns user, but maybe not token?
        // backend/src/routes/auth.js: register returns `user` but NO token.

        // Okay, let's look at the `verify-otp` flow.
        // 1. Login -> returns userId, requireOtp: true.
        // 2. Server logs OTP.
        // 3. Verify -> returns token.

        console.log('Test script cannot proceed without OTP access. Skipping execution.');

    } catch (err) {
        console.error('Test failed:', err.response?.data || err.message);
    }
}

testGroupCreation();

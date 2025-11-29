const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const router = express.Router();

// Register new user
router.post('/register', async (req, res) => {
  try {
    const { name, username, email, phone, password, identityPublicKey, profilePicture } = req.body;

    // Validate input
    if (!name || !username || !email || !phone || !password || !identityPublicKey) {
      return res.status(400).json({
        error: 'Missing required fields: name, username, email, phone, password, identityPublicKey'
      });
    }

    if (username.length < 3 || username.length > 30) {
      return res.status(400).json({
        error: 'Username must be between 3 and 30 characters'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error: 'Password must be at least 6 characters'
      });
    }

    // Check if user already exists (username or email)
    const existingUser = await User.findOne({
      $or: [{ username }, { email }]
    });
    if (existingUser) {
      return res.status(400).json({
        error: existingUser.username === username ? 'Username already exists' : 'Email already exists'
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const user = new User({
      name,
      username,
      email,
      phone,
      profilePicture: profilePicture || null,
      passwordHash,
      identityPublicKey,
      preKeys: req.body.preKeys || [],
      signedPreKey: req.body.signedPreKey || null
    });

    await user.save();

    // Generate JWT
    const token = jwt.sign(
      { userId: user._id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    console.log(`✅ User registered: ${username}`);

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: user._id,
        name: user.name,
        username: user.username,
        email: user.email,
        phone: user.phone,
        profilePicture: user.profilePicture,
        identityPublicKey: user.identityPublicKey
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validate input
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    // Find user
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: user._id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Update last seen and online status
    user.lastSeen = new Date();
    user.isOnline = true;
    await user.save();

    console.log(`✅ User logged in: ${user.username}`);

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        username: user.username,
        identityPublicKey: user.identityPublicKey
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Verify OTP
router.post('/verify-otp', async (req, res) => {
  try {
    const { userId, otp } = req.body;

    if (!userId || !otp) {
      return res.status(400).json({ error: 'User ID and OTP required' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.otp || !user.otpExpires) {
      return res.status(400).json({ error: 'No OTP request found' });
    }

    if (user.otp !== otp) {
      return res.status(400).json({ error: 'Invalid OTP' });
    }

    if (user.otpExpires < new Date()) {
      return res.status(400).json({ error: 'OTP expired' });
    }

    // Clear OTP
    user.otp = null;
    user.otpExpires = null;

    // Update last seen and online status
    user.lastSeen = new Date();
    user.isOnline = true;
    await user.save();

    // Generate JWT
    const token = jwt.sign(
      { userId: user._id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    console.log(`✅ User logged in verified: ${user.username}`);

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        username: user.username,
        identityPublicKey: user.identityPublicKey
      }
    });
  } catch (error) {
    console.error('OTP verify error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});


// Logout
router.post('/logout', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader) {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      await User.findByIdAndUpdate(decoded.userId, { isOnline: false });
      console.log(`✅ User logged out: ${decoded.username}`);
    }

    res.json({ message: 'Logout successful' });
  } catch (error) {
    res.json({ message: 'Logout successful' });
  }
});

module.exports = router;

const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email']
  },
  phone: {
    type: String,
    required: true,
    trim: true
  },
  profilePicture: {
    type: String, // base64 encoded image
    default: null
  },
  passwordHash: {
    type: String,
    required: true
  },
  identityPublicKey: {
    type: String,
    required: true,
    unique: true
  },
  preKeys: [{
    keyId: Number,
    publicKey: String,
    used: { type: Boolean, default: false }
  }],
  signedPreKey: {
    keyId: Number,
    publicKey: String,
    signature: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastSeen: {
    type: Date,
    default: Date.now
  },
  isOnline: {
    type: Boolean,
    default: false
  },
  // User settings
  settings: {
    readReceiptsEnabled: {
      type: Boolean,
      default: true
    },
    typingIndicatorsEnabled: {
      type: Boolean,
      default: true
    },
    theme: {
      type: String,
      enum: ['light', 'dark', 'auto'],
      default: 'dark'
    }
  },
  // 2FA
  otp: {
    type: String,
    default: null
  },
  otpExpires: {
    type: Date,
    default: null
  }
});

// Index for faster queries
userSchema.index({ username: 1 });

module.exports = mongoose.model('User', userSchema);

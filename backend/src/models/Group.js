const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    maxlength: 500,
    default: ''
  },
  avatar: {
    type: String, // base64 encoded image
    default: null
  },
  creatorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  members: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    role: {
      type: String,
      enum: ['admin', 'member'],
      default: 'member'
    },
    joinedAt: {
      type: Date,
      default: Date.now
    },
    // Encrypted group key for this member
    encryptedGroupKey: {
      type: String,
      required: true
    },
    // Ephemeral public key used to encrypt the group key
    ephemeralPublicKey: {
      type: String,
      required: true
    },
    // Nonce for group key encryption
    keyNonce: {
      type: String,
      required: true
    }
  }],
  groupKeyVersion: {
    type: Number,
    default: 1
  },
  lastKeyRotation: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

groupSchema.index({ 'members.userId': 1 });
groupSchema.index({ creatorId: 1 });

module.exports = mongoose.model('Group', groupSchema);


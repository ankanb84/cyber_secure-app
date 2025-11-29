const mongoose = require('mongoose');

const groupMessageSchema = new mongoose.Schema({
  groupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    required: true
  },
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Message encrypted with group key
  encryptedContent: {
    type: String,
    required: true
  },
  nonce: {
    type: String,
    required: true
  },
  messageNumber: {
    type: Number,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  messageType: {
    type: String,
    enum: ['text', 'voice', 'file', 'image', 'system'],
    default: 'text'
  },
  // For system messages (user joined, left, etc.)
  systemMessage: {
    type: String,
    default: null
  },
  edited: {
    type: Boolean,
    default: false
  },
  editedAt: {
    type: Date,
    default: null
  },
  deleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date,
    default: null
  },
  // Read receipts per member
  readBy: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    readAt: {
      type: Date,
      default: Date.now
    }
  }]
});

groupMessageSchema.index({ groupId: 1, timestamp: -1 });
groupMessageSchema.index({ groupId: 1, messageNumber: 1 });

module.exports = mongoose.model('GroupMessage', groupMessageSchema);


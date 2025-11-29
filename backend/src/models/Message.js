const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  recipientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
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
  ephemeralPublicKey: {
    type: String
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  delivered: {
    type: Boolean,
    default: false
  },
  read: {
    type: Boolean,
    default: false
  },
  readAt: {
    type: Date,
    default: null
  },
  // New features
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
  pinned: {
    type: Boolean,
    default: false
  },
  pinnedAt: {
    type: Date,
    default: null
  },
  selfDestructAt: {
    type: Date,
    default: null
  },
  scheduledFor: {
    type: Date,
    default: null
  },
  isScheduled: {
    type: Boolean,
    default: false
  },
  originalEncryptedContent: {
    type: String,
    default: null
  },
  messageType: {
    type: String,
    enum: ['text', 'voice', 'file', 'image'],
    default: 'text'
  }
});

messageSchema.index({ senderId: 1, recipientId: 1, messageNumber: 1 });
messageSchema.index({ recipientId: 1, delivered: 1 });
messageSchema.index({ recipientId: 1, pinned: 1, timestamp: -1 });
messageSchema.index({ selfDestructAt: 1 });
messageSchema.index({ scheduledFor: 1, isScheduled: 1 });

module.exports = mongoose.model('Message', messageSchema);

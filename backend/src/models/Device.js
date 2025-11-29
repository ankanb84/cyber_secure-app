const mongoose = require('mongoose');

const deviceSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  deviceName: {
    type: String,
    required: true,
    default: 'Unknown Device'
  },
  deviceType: {
    type: String,
    enum: ['desktop', 'mobile', 'tablet', 'browser'],
    default: 'browser'
  },
  userAgent: {
    type: String,
    default: ''
  },
  // Encrypted identity keys for this device
  encryptedIdentityKey: {
    type: String,
    required: true
  },
  encryptedPreKeys: {
    type: String, // JSON string of encrypted prekeys
    default: null
  },
  // Master key used to encrypt device keys (derived from user password)
  // This is stored encrypted with a device-specific key
  deviceKey: {
    type: String,
    required: true
  },
  lastSyncAt: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

deviceSchema.index({ userId: 1, isActive: 1 });
deviceSchema.index({ userId: 1, deviceKey: 1 }, { unique: true });

module.exports = mongoose.model('Device', deviceSchema);


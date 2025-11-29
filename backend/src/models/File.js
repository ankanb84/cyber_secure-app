const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  recipientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  filename: { type: String, required: true },
  mimeType: { type: String, required: true },
  size: { type: Number, required: true },
  // encrypted file data (base64) - stored as string; for production use GridFS
  encryptedFile: { type: String, required: true },
  // AES-GCM nonce used to encrypt the file (base64)
  fileIv: { type: String, required: true },
  // encrypted symmetric key (base64) - encrypted with recipient identity using nacl.box
  encryptedFileKey: { type: String, required: true },
  // ephemeral public key used to encrypt fileKey (base64)
  ephemeralPublicKey: { type: String, required: true },
  // nonce used to encrypt the symmetric key with nacl.box (base64)
  fileKeyNonce: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  downloaded: { type: Boolean, default: false }
});

fileSchema.index({ recipientId: 1, senderId: 1, timestamp: -1 });

module.exports = mongoose.model('File', fileSchema);

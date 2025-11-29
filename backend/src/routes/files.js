const express = require('express');
const multer = require('multer');
const File = require('../models/File');
const User = require('../models/User');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB limit

const router = express.Router();

// Upload encrypted file (frontend sends already-encrypted file as base64)
router.post('/', upload.single('file'), async (req, res) => {
  try {
    // We expect fields in body: recipientId, encryptedFile (base64) OR file in multipart but we prefer base64 in fields.
    // For simplicity accept JSON body fields.
    const {
      recipientId,
      filename,
      mimeType,
      size,
      encryptedFile,
      fileIv,
      encryptedFileKey,
      ephemeralPublicKey,
      fileKeyNonce
    } = req.body;

    if (!recipientId || !encryptedFile || !encryptedFileKey || !ephemeralPublicKey || !fileIv || !fileKeyNonce || !filename) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Persist
    const fileDoc = new File({
      senderId: req.user.userId,
      recipientId,
      filename,
      mimeType,
      size: parseInt(size, 10) || 0,
      encryptedFile,
      fileIv,
      encryptedFileKey,
      ephemeralPublicKey,
      fileKeyNonce
    });

    await fileDoc.save();

    // Notify recipient via socket
    const io = req.app.get('io');
    if (io) {
      io.to(recipientId).emit('new_file', {
        _id: fileDoc._id,
        senderId: req.user.userId,
        recipientId,
        filename,
        mimeType,
        size,
        timestamp: fileDoc.timestamp
      });
    }

    res.status(201).json({ message: 'File stored', id: fileDoc._id });
  } catch (err) {
    console.error('File upload error:', err);
    res.status(500).json({ error: 'Failed to store file' });
  }
});

// Get file metadata + encrypted payload (recipient fetches then decrypts on client)
router.get('/:fileId', async (req, res) => {
  try {
    const file = await File.findById(req.params.fileId);
    if (!file) return res.status(404).json({ error: 'File not found' });

    // Ensure only sender or recipient can fetch
    const uid = req.user.userId;
    if (file.recipientId.toString() !== uid && file.senderId.toString() !== uid) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    res.json({
      _id: file._id,
      senderId: file.senderId,
      recipientId: file.recipientId,
      filename: file.filename,
      mimeType: file.mimeType,
      size: file.size,
      encryptedFile: file.encryptedFile,
      fileIv: file.fileIv,
      encryptedFileKey: file.encryptedFileKey,
      ephemeralPublicKey: file.ephemeralPublicKey,
      fileKeyNonce: file.fileKeyNonce,
      timestamp: file.timestamp
    });
  } catch (err) {
    console.error('Get file error:', err);
    res.status(500).json({ error: 'Failed to fetch file' });
  }
});

module.exports = router;


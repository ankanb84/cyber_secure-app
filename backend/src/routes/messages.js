const express = require('express');
const Message = require('../models/Message');

const router = express.Router();

// Get messages between two users
router.get('/:otherUserId', async (req, res) => {
  try {
    const { otherUserId } = req.params;
    const userId = req.user.userId;

    const messages = await Message.find({
      $or: [
        { senderId: userId, recipientId: otherUserId },
        { senderId: otherUserId, recipientId: userId }
      ],
      deleted: false,
      $or: [
        { selfDestructAt: null },
        { selfDestructAt: { $gt: new Date() } }
      ]
    }).sort({ timestamp: 1 });

    await Message.updateMany(
      { recipientId: userId, senderId: otherUserId, delivered: false },
      { delivered: true }
    );

    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Get pinned messages
router.get('/:otherUserId/pinned', async (req, res) => {
  try {
    const { otherUserId } = req.params;
    const userId = req.user.userId;

    const pinnedMessages = await Message.find({
      $or: [
        { senderId: userId, recipientId: otherUserId },
        { senderId: otherUserId, recipientId: userId }
      ],
      pinned: true,
      deleted: false
    }).sort({ pinnedAt: -1 });

    res.json(pinnedMessages);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch pinned messages' });
  }
});

// Send message
router.post('/', async (req, res) => {
  try {
    const {
      recipientId,
      encryptedContent,
      nonce,
      messageNumber,
      ephemeralPublicKey,
      scheduledFor,
      selfDestructAt,
      messageType
    } = req.body;

    const isScheduled = scheduledFor && new Date(scheduledFor) > new Date();

    const msg = new Message({
      senderId: req.user.userId,
      recipientId,
      encryptedContent,
      nonce,
      messageNumber,
      ephemeralPublicKey,
      scheduledFor: isScheduled ? new Date(scheduledFor) : null,
      isScheduled,
      selfDestructAt: selfDestructAt ? new Date(selfDestructAt) : null,
      messageType: messageType || 'text'
    });

    await msg.save();

    const io = req.app.get('io');
    
    // Only emit immediately if not scheduled
    if (!isScheduled) {
      io.to(recipientId).emit('new_message', msg);
    }

    res.status(201).json(msg);
  } catch (err) {
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Edit message
router.patch('/:id/edit', async (req, res) => {
  try {
    const { encryptedContent, nonce } = req.body;
    const userId = req.user.userId;

    const msg = await Message.findOne({ _id: req.params.id, senderId: userId, deleted: false });
    if (!msg) return res.status(404).json({ error: 'Message not found' });

    // Store original content if first edit
    if (!msg.originalEncryptedContent) {
      msg.originalEncryptedContent = msg.encryptedContent;
    }

    msg.encryptedContent = encryptedContent;
    msg.nonce = nonce;
    msg.edited = true;
    msg.editedAt = new Date();
    await msg.save();

    const io = req.app.get('io');
    io.to(msg.recipientId.toString()).emit('message_edited', {
      messageId: msg._id,
      encryptedContent,
      nonce,
      editedAt: msg.editedAt
    });

    res.json(msg);
  } catch (err) {
    res.status(500).json({ error: 'Failed to edit message' });
  }
});

// Delete message
router.patch('/:id/delete', async (req, res) => {
  try {
    const userId = req.user.userId;

    const msg = await Message.findOne({
      _id: req.params.id,
      $or: [{ senderId: userId }, { recipientId: userId }]
    });
    if (!msg) return res.status(404).json({ error: 'Message not found' });

    msg.deleted = true;
    msg.deletedAt = new Date();
    await msg.save();

    const io = req.app.get('io');
    const otherUserId = msg.senderId.toString() === userId ? msg.recipientId.toString() : msg.senderId.toString();
    io.to(otherUserId).emit('message_deleted', {
      messageId: msg._id
    });

    res.json({ message: 'Message deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

// Pin/Unpin message
router.patch('/:id/pin', async (req, res) => {
  try {
    const { pinned } = req.body;
    const userId = req.user.userId;

    const msg = await Message.findOne({
      _id: req.params.id,
      $or: [{ senderId: userId }, { recipientId: userId }],
      deleted: false
    });
    if (!msg) return res.status(404).json({ error: 'Message not found' });

    msg.pinned = pinned;
    msg.pinnedAt = pinned ? new Date() : null;
    await msg.save();

    const io = req.app.get('io');
    const otherUserId = msg.senderId.toString() === userId ? msg.recipientId.toString() : msg.senderId.toString();
    io.to(otherUserId).emit('message_pinned', {
      messageId: msg._id,
      pinned: msg.pinned
    });

    res.json(msg);
  } catch (err) {
    res.status(500).json({ error: 'Failed to pin message' });
  }
});

// Mark message as read
router.patch('/:id/read', async (req, res) => {
  try {
    const User = require('../models/User');
    const user = await User.findById(req.user.userId);
    
    // Check if read receipts are enabled
    if (!user.settings.readReceiptsEnabled) {
      return res.json({ message: 'Read receipts disabled' });
    }

    const msg = await Message.findOneAndUpdate(
      { _id: req.params.id, recipientId: req.user.userId },
      { read: true, readAt: new Date() },
      { new: true }
    );

    if (!msg) return res.status(404).json({ error: 'Message not found' });

    const io = req.app.get('io');
    io.to(msg.senderId.toString()).emit('message_read', {
      messageId: msg._id,
      readAt: msg.readAt
    });

    res.json(msg);
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark read' });
  }
});

// Unread count
router.get('/unread/count', async (req, res) => {
  try {
    const count = await Message.countDocuments({
      recipientId: req.user.userId,
      read: false
    });

    res.json({ count });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get count' });
  }
});

// Export messages for backup
router.get('/export', async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const messages = await Message.find({
      $or: [
        { senderId: userId },
        { recipientId: userId }
      ],
      deleted: false
    }).sort({ timestamp: 1 });

    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: 'Failed to export messages' });
  }
});

module.exports = router;

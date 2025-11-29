const express = require('express');
const Reaction = require('../models/Reaction');
const Message = require('../models/Message');

const router = express.Router();

// Add or update reaction
router.post('/:messageId', async (req, res) => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;
    const userId = req.user.userId;

    // Verify message exists and user has access
    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ error: 'Message not found' });

    if (message.senderId.toString() !== userId && message.recipientId.toString() !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Upsert reaction
    const reaction = await Reaction.findOneAndUpdate(
      { messageId, userId },
      { emoji, timestamp: new Date() },
      { upsert: true, new: true }
    ).populate('userId', 'username name profilePicture');

    const io = req.app.get('io');
    const otherUserId = message.senderId.toString() === userId 
      ? message.recipientId.toString() 
      : message.senderId.toString();
    io.to(otherUserId).emit('message_reaction', {
      messageId,
      reaction: {
        _id: reaction._id,
        userId: reaction.userId,
        emoji: reaction.emoji,
        timestamp: reaction.timestamp
      }
    });

    res.json(reaction);
  } catch (err) {
    console.error('Reaction error:', err);
    res.status(500).json({ error: 'Failed to add reaction' });
  }
});

// Remove reaction
router.delete('/:messageId', async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.userId;

    const reaction = await Reaction.findOneAndDelete({ messageId, userId });
    if (!reaction) return res.status(404).json({ error: 'Reaction not found' });

    const message = await Message.findById(messageId);
    const io = req.app.get('io');
    const otherUserId = message.senderId.toString() === userId 
      ? message.recipientId.toString() 
      : message.senderId.toString();
    io.to(otherUserId).emit('reaction_removed', {
      messageId,
      userId
    });

    res.json({ message: 'Reaction removed' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove reaction' });
  }
});

// Get reactions for a message
router.get('/:messageId', async (req, res) => {
  try {
    const reactions = await Reaction.find({ messageId: req.params.messageId })
      .populate('userId', 'username name profilePicture')
      .sort({ timestamp: 1 });

    res.json(reactions);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch reactions' });
  }
});

module.exports = router;


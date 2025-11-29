const express = require('express');
const FriendRequest = require('../models/FriendRequest');
const User = require('../models/User');

const router = express.Router();

// Send friend request
router.post('/request', async (req, res) => {
  try {
    const { recipientId } = req.body;
    const senderId = req.user.userId;

    if (senderId === recipientId) {
      return res.status(400).json({ error: 'Cannot send friend request to yourself' });
    }

    const recipient = await User.findById(recipientId);
    if (!recipient) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if request already exists
    const existingRequest = await FriendRequest.findOne({
      $or: [
        { senderId, recipientId },
        { senderId: recipientId, recipientId: senderId }
      ]
    });

    if (existingRequest) {
      if (existingRequest.status === 'accepted') {
        return res.status(400).json({ error: 'Already friends' });
      }
      if (existingRequest.status === 'pending') {
        return res.status(400).json({ error: 'Friend request already sent' });
      }
    }

    const friendRequest = new FriendRequest({
      senderId,
      recipientId,
      status: 'pending'
    });

    await friendRequest.save();

    // Populate sender info
    await friendRequest.populate('senderId', 'name username profilePicture');

    res.status(201).json(friendRequest);
  } catch (error) {
    console.error('Send friend request error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Friend request already exists' });
    }
    res.status(500).json({ error: 'Failed to send friend request' });
  }
});

// Get friend requests (sent and received)
router.get('/requests', async (req, res) => {
  try {
    const userId = req.user.userId;

    const requests = await FriendRequest.find({
      $or: [
        { senderId: userId, status: 'pending' },
        { recipientId: userId, status: 'pending' }
      ]
    })
      .populate('senderId', 'name username profilePicture')
      .populate('recipientId', 'name username profilePicture')
      .sort({ createdAt: -1 });

    res.json(requests);
  } catch (error) {
    console.error('Get friend requests error:', error);
    res.status(500).json({ error: 'Failed to fetch friend requests' });
  }
});

// Accept friend request
router.post('/accept/:requestId', async (req, res) => {
  try {
    const { requestId } = req.params;
    const userId = req.user.userId;

    const friendRequest = await FriendRequest.findById(requestId);
    if (!friendRequest) {
      return res.status(404).json({ error: 'Friend request not found' });
    }

    if (friendRequest.recipientId.toString() !== userId) {
      return res.status(403).json({ error: 'Not authorized to accept this request' });
    }

    if (friendRequest.status !== 'pending') {
      return res.status(400).json({ error: 'Friend request already processed' });
    }

    friendRequest.status = 'accepted';
    friendRequest.updatedAt = new Date();
    await friendRequest.save();

    await friendRequest.populate('senderId', 'name username profilePicture');

    res.json(friendRequest);
  } catch (error) {
    console.error('Accept friend request error:', error);
    res.status(500).json({ error: 'Failed to accept friend request' });
  }
});

// Reject friend request
router.post('/reject/:requestId', async (req, res) => {
  try {
    const { requestId } = req.params;
    const userId = req.user.userId;

    const friendRequest = await FriendRequest.findById(requestId);
    if (!friendRequest) {
      return res.status(404).json({ error: 'Friend request not found' });
    }

    if (friendRequest.recipientId.toString() !== userId) {
      return res.status(403).json({ error: 'Not authorized to reject this request' });
    }

    friendRequest.status = 'rejected';
    friendRequest.updatedAt = new Date();
    await friendRequest.save();

    res.json({ message: 'Friend request rejected' });
  } catch (error) {
    console.error('Reject friend request error:', error);
    res.status(500).json({ error: 'Failed to reject friend request' });
  }
});

// Get friends list
router.get('/list', async (req, res) => {
  try {
    const userId = req.user.userId;

    const friends = await FriendRequest.find({
      status: 'accepted',
      $or: [
        { senderId: userId },
        { recipientId: userId }
      ]
    })
      .populate('senderId', 'name username email phone profilePicture lastSeen isOnline')
      .populate('recipientId', 'name username email phone profilePicture lastSeen isOnline')
      .sort({ updatedAt: -1 });

    // Extract friend users (the other person in each request)
    const friendList = friends.map(fr => {
      const friend = fr.senderId._id.toString() === userId 
        ? fr.recipientId 
        : fr.senderId;
      return friend;
    });

    res.json(friendList);
  } catch (error) {
    console.error('Get friends list error:', error);
    res.status(500).json({ error: 'Failed to fetch friends' });
  }
});

module.exports = router;


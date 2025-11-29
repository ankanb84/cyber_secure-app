const express = require('express');
const User = require('../models/User');

const router = express.Router();

// Get current user
router.get('/me', async (req, res) => {
  try {
    const user = await User.findById(
      req.user.userId,
      'name username email phone profilePicture settings'
    );
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Get all users (except current user) - for searching/finding new friends
router.get('/', async (req, res) => {
  try {
    const users = await User.find(
      { _id: { $ne: req.user.userId } },
      'name username email phone profilePicture identityPublicKey lastSeen isOnline'
    ).sort({ username: 1 });

    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Search users by username or name
router.get('/search/:query', async (req, res) => {
  try {
    const query = req.params.query;
    const users = await User.find(
      {
        _id: { $ne: req.user.userId },
        $or: [
          { username: { $regex: query, $options: 'i' } },
          { name: { $regex: query, $options: 'i' } }
        ]
      },
      'name username profilePicture'
    ).limit(20);

    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Search failed' });
  }
});

// Get single user
router.get('/:userId', async (req, res) => {
  try {
    const user = await User.findById(
      req.params.userId,
      'name username email phone profilePicture identityPublicKey lastSeen isOnline'
    );

    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Get public keys for key exchange
router.get('/:userId/keys', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);

    if (!user) return res.status(404).json({ error: 'User not found' });

    const unusedPreKey = user.preKeys.find(k => !k.used);

    if (unusedPreKey) {
      unusedPreKey.used = true;
      await user.save();
    }

    res.json({
      identityPublicKey: user.identityPublicKey,
      signedPreKey: user.signedPreKey,
      oneTimePreKey: unusedPreKey || null
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch keys' });
  }
});

module.exports = router;

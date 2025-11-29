const express = require('express');
const User = require('../models/User');

const router = express.Router();

// Get user settings
router.get('/', async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('settings');
    res.json(user.settings || {});
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Update user settings
router.patch('/', async (req, res) => {
  try {
    const { readReceiptsEnabled, typingIndicatorsEnabled, theme } = req.body;
    
    const update = {};
    if (readReceiptsEnabled !== undefined) {
      update['settings.readReceiptsEnabled'] = readReceiptsEnabled;
    }
    if (typingIndicatorsEnabled !== undefined) {
      update['settings.typingIndicatorsEnabled'] = typingIndicatorsEnabled;
    }
    if (theme !== undefined) {
      update['settings.theme'] = theme;
    }

    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { $set: update },
      { new: true }
    ).select('settings');

    res.json(user.settings);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

module.exports = router;


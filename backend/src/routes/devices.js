const express = require('express');
const Device = require('../models/Device');

const router = express.Router();

// Register a new device
router.post('/register', async (req, res) => {
  try {
    const { deviceName, deviceType, userAgent, encryptedIdentityKey, encryptedPreKeys, deviceKey } = req.body;
    const userId = req.user.userId;

    if (!deviceName || !encryptedIdentityKey || !deviceKey) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if device already exists
    const existingDevice = await Device.findOne({ userId, deviceKey });
    if (existingDevice) {
      existingDevice.encryptedIdentityKey = encryptedIdentityKey;
      existingDevice.encryptedPreKeys = encryptedPreKeys || null;
      existingDevice.lastSyncAt = new Date();
      existingDevice.isActive = true;
      await existingDevice.save();
      return res.json(existingDevice);
    }

    const device = new Device({
      userId,
      deviceName: deviceName || 'Unknown Device',
      deviceType: deviceType || 'browser',
      userAgent: userAgent || '',
      encryptedIdentityKey,
      encryptedPreKeys: encryptedPreKeys || null,
      deviceKey
    });

    await device.save();
    res.status(201).json(device);
  } catch (err) {
    console.error('Register device error:', err);
    res.status(500).json({ error: 'Failed to register device' });
  }
});

// Get user's devices
router.get('/', async (req, res) => {
  try {
    const userId = req.user.userId;
    const devices = await Device.find({ userId, isActive: true })
      .select('deviceName deviceType lastSyncAt createdAt')
      .sort({ lastSyncAt: -1 });

    res.json(devices);
  } catch (err) {
    console.error('Get devices error:', err);
    res.status(500).json({ error: 'Failed to fetch devices' });
  }
});

// Sync keys from another device
router.post('/sync', async (req, res) => {
  try {
    const { deviceKey, encryptedIdentityKey, encryptedPreKeys } = req.body;
    const userId = req.user.userId;

    const device = await Device.findOne({ userId, deviceKey, isActive: true });
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    device.encryptedIdentityKey = encryptedIdentityKey;
    device.encryptedPreKeys = encryptedPreKeys || null;
    device.lastSyncAt = new Date();
    await device.save();

    res.json({ message: 'Keys synced successfully' });
  } catch (err) {
    console.error('Sync keys error:', err);
    res.status(500).json({ error: 'Failed to sync keys' });
  }
});

// Get keys for this device
router.get('/keys', async (req, res) => {
  try {
    const { deviceKey } = req.query;
    const userId = req.user.userId;

    if (!deviceKey) {
      return res.status(400).json({ error: 'Device key required' });
    }

    const device = await Device.findOne({ userId, deviceKey, isActive: true });
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    res.json({
      encryptedIdentityKey: device.encryptedIdentityKey,
      encryptedPreKeys: device.encryptedPreKeys
    });
  } catch (err) {
    console.error('Get device keys error:', err);
    res.status(500).json({ error: 'Failed to fetch keys' });
  }
});

// Remove device
router.delete('/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const userId = req.user.userId;

    const device = await Device.findOne({ _id: deviceId, userId });
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    device.isActive = false;
    await device.save();

    res.json({ message: 'Device removed' });
  } catch (err) {
    console.error('Remove device error:', err);
    res.status(500).json({ error: 'Failed to remove device' });
  }
});

module.exports = router;


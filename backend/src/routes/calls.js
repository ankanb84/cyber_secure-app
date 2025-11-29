const express = require('express');
const router = express.Router();
const Call = require('../models/Call');
const User = require('../models/User');
const auth = require('../middleware/auth');

// Apply auth middleware to all routes
router.use(auth);

// Get call history for current user
router.get('/history', async (req, res) => {
    try {
        const userId = req.user.userId;

        const calls = await Call.find({
            $or: [{ callerId: userId }, { receiverId: userId }]
        })
            .sort({ startTime: -1 })
            .limit(50)
            .populate('callerId', 'name username profilePicture')
            .populate('receiverId', 'name username profilePicture');

        // Format for frontend
        const formattedCalls = calls.map(call => {
            const isOutgoing = call.callerId._id.toString() === userId;
            const otherUser = isOutgoing ? call.receiverId : call.callerId;

            return {
                id: call._id,
                otherUserId: otherUser._id,
                name: otherUser.name || otherUser.username,
                username: otherUser.username,
                avatar: otherUser.profilePicture, // Assuming profilePicture exists
                type: call.type,
                direction: isOutgoing ? 'outgoing' : 'incoming',
                status: call.status,
                time: call.startTime,
                duration: call.duration
            };
        });

        res.json(formattedCalls);
    } catch (error) {
        console.error('Error fetching call history:', error);
        res.status(500).json({ error: 'Failed to fetch call history' });
    }
});

// Create a new call record
router.post('/', async (req, res) => {
    try {
        const { receiverId, type } = req.body;
        const callerId = req.user.userId;

        const call = new Call({
            callerId,
            receiverId,
            type,
            status: 'missed' // Default to missed until updated
        });

        await call.save();

        // Populate for response
        await call.populate('callerId', 'name username');
        await call.populate('receiverId', 'name username');

        res.status(201).json(call);
    } catch (error) {
        console.error('Error creating call record:', error);
        res.status(500).json({ error: 'Failed to create call record' });
    }
});

// Update call status (e.g., when call ends)
router.put('/:id', async (req, res) => {
    try {
        const { status, duration } = req.body;
        const callId = req.params.id;

        const call = await Call.findById(callId);
        if (!call) {
            return res.status(404).json({ error: 'Call not found' });
        }

        // Verify participant
        if (call.callerId.toString() !== req.user.userId &&
            call.receiverId.toString() !== req.user.userId) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        if (status) call.status = status;
        if (duration) call.duration = duration;
        if (status === 'completed' || status === 'rejected') {
            call.endTime = Date.now();
        }

        await call.save();
        res.json(call);
    } catch (error) {
        console.error('Error updating call record:', error);
        res.status(500).json({ error: 'Failed to update call record' });
    }
});

module.exports = router;

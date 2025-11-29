const cron = require('node-cron');
const Message = require('../models/Message');

// Run every minute to check for scheduled messages and expired self-destruct messages
cron.schedule('* * * * *', async () => {
  try {
    const now = new Date();

    // Send scheduled messages
    const scheduledMessages = await Message.find({
      isScheduled: true,
      scheduledFor: { $lte: now }
    });

    for (const msg of scheduledMessages) {
      msg.isScheduled = false;
      await msg.save();

      // Emit via socket (we'll need to pass io instance)
      // This will be handled in server.js
    }

    // Delete expired self-destruct messages
    const expiredMessages = await Message.find({
      selfDestructAt: { $lte: now },
      deleted: false
    });

    if (expiredMessages.length > 0) {
      await Message.updateMany(
        { _id: { $in: expiredMessages.map(m => m._id) } },
        { deleted: true, deletedAt: now }
      );
    }
  } catch (err) {
    console.error('Scheduler error:', err);
  }
});

module.exports = { initializeScheduler: () => {} };


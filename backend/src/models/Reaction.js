const mongoose = require('mongoose');

const reactionSchema = new mongoose.Schema({
  messageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  emoji: {
    type: String,
    required: true,
    maxlength: 10
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

// One reaction per user per message (can change emoji)
reactionSchema.index({ messageId: 1, userId: 1 }, { unique: true });
reactionSchema.index({ messageId: 1 });

module.exports = mongoose.model('Reaction', reactionSchema);


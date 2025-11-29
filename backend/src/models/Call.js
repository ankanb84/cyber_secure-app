const mongoose = require('mongoose');

const callSchema = new mongoose.Schema({
    callerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    receiverId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    type: {
        type: String,
        enum: ['voice', 'video'],
        required: true
    },
    status: {
        type: String,
        enum: ['missed', 'completed', 'rejected', 'busy'],
        default: 'missed'
    },
    startTime: {
        type: Date,
        default: Date.now
    },
    endTime: {
        type: Date
    },
    duration: {
        type: Number, // in seconds
        default: 0
    }
}, {
    timestamps: true
});

callSchema.index({ callerId: 1, startTime: -1 });
callSchema.index({ receiverId: 1, startTime: -1 });

module.exports = mongoose.model('Call', callSchema);

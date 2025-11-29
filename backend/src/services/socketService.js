const jwt = require('jsonwebtoken');
const User = require('../models/User');

function initializeSocketService(io) {
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;

    if (!token) return next(new Error('No token'));

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.userId;
      socket.username = decoded.username;
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', async (socket) => {
    await User.findByIdAndUpdate(socket.userId, {
      isOnline: true,
      lastSeen: new Date()
    });

    socket.join(socket.userId);

    socket.on('typing', async (data) => {
      const User = require('../models/User');
      const user = await User.findById(socket.userId);

      // Check if typing indicators are enabled
      if (user.settings.typingIndicatorsEnabled) {
        io.to(data.recipientId).emit('user_typing', {
          userId: socket.userId,
          isTyping: data.isTyping
        });
      }
    });

    // WebRTC signaling
    socket.on('call_offer', (data) => {
      io.to(data.recipientId).emit('call_offer', {
        from: socket.userId,
        offer: data.offer,
        callId: data.callId,
        callType: data.callType
      });
    });

    socket.on('call_answer', (data) => {
      io.to(data.recipientId).emit('call_answer', {
        from: socket.userId,
        answer: data.answer,
        callId: data.callId
      });
    });

    socket.on('ice_candidate', (data) => {
      io.to(data.recipientId).emit('ice_candidate', {
        from: socket.userId,
        candidate: data.candidate,
        callId: data.callId
      });
    });

    socket.on('call_end', (data) => {
      io.to(data.recipientId).emit('call_end', {
        from: socket.userId,
        callId: data.callId
      });
    });

    socket.on('disconnect', async () => {
      await User.findByIdAndUpdate(socket.userId, {
        isOnline: false,
        lastSeen: new Date()
      });
    });
  });
}

module.exports = { initializeSocketService };

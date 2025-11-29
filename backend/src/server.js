const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

// Database
const connectDatabase = require('./config/database');

// Routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const messageRoutes = require('./routes/messages');
const fileRoutes = require('./routes/files');
const friendRoutes = require('./routes/friends');

// Middleware
const authMiddleware = require('./middleware/auth');

// Socket Service
const { initializeSocketService } = require('./services/socketService');

const app = express();
const server = http.createServer(app);

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

const io = socketIo(server, {
  cors: {
    origin: FRONTEND_URL,
    methods: ["GET", "POST"],
    credentials: true
  }
});

app.use(helmet());

app.use(
  cors({
    origin: FRONTEND_URL,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// CONNECT DB
connectDatabase();

// SHARE SOCKET
app.set("io", io);

// ROUTES
app.use("/api/auth", authRoutes);
app.use("/api/users", authMiddleware, userRoutes);
app.use("/api/messages", authMiddleware, messageRoutes);
app.use("/api/files", authMiddleware, fileRoutes);
app.use("/api/friends", authMiddleware, friendRoutes);
app.use("/api/reactions", authMiddleware, require('./routes/reactions'));
app.use("/api/settings", authMiddleware, require('./routes/settings'));
app.use("/api/groups", authMiddleware, require('./routes/groups'));
app.use("/api/devices", authMiddleware, require('./routes/devices'));
app.use("/api/calls", authMiddleware, require('./routes/calls'));

// HEALTH CHECK
app.get("/api/health", (req, res) => {
  res.json({ status: "OK" });
});

// INITIALIZE SOCKETS
initializeSocketService(io);

// Initialize scheduler for scheduled messages and self-destruct
const { initializeScheduler } = require('./services/scheduler');
initializeScheduler();

// Handle scheduled messages (run every minute via cron, but also check on server start)
setInterval(async () => {
  try {
    const Message = require('./models/Message');
    const now = new Date();
    const scheduledMessages = await Message.find({
      isScheduled: true,
      scheduledFor: { $lte: now }
    });

    for (const msg of scheduledMessages) {
      msg.isScheduled = false;
      await msg.save();
      io.to(msg.recipientId.toString()).emit('new_message', msg);
    }
  } catch (err) {
    console.error('Scheduled message handler error:', err);
  }
}, 60000); // Check every minute

// START SERVER
const PORT = process.env.PORT || 5000;

// --------------------------
// DEPLOYMENT CONFIGURATION
// --------------------------
if (process.env.NODE_ENV === 'production') {
  const path = require('path');

  // Serve static files from the React frontend app
  app.use(express.static(path.join(__dirname, '../../frontend/build')));

  // Handle React routing, return all requests to React app
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../../frontend/build', 'index.html'));
  });
}

server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

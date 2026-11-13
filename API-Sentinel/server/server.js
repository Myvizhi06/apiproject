/**
 * API Sentinel - HTTP & Socket.IO Server Entrypoint
 */

const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { createApp } = require('./app');
const config = require('./config/config');
const { connectDB } = require('./config/db');
const { setIO } = require('./utils/socketManager');

async function startServer() {
  // Connect Database
  await connectDB();

  // Auto-seed default demo operator & workflows if not already present
  try {
    const seed = require('./utils/seed');
    const { User } = require('./models');
    const demoExists = await User.findOne({ email: 'demo@apisentinel.dev' });
    if (!demoExists) {
      console.log('[Server] Seeding default academic demo operator...');
      await seed();
    }
  } catch (seedErr) {
    console.warn('[Server] Auto-seed check notice:', seedErr.message);
  }

  const app = createApp();
  const server = http.createServer(app);

  // Initialize Socket.IO
  const io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
  });

  // Socket.IO JWT Authentication Middleware
  io.use((socket, next) => {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers['authorization']?.replace(/^Bearer\s+/i, '');

    if (!token) {
      // In development, allow anonymous connection with fallback id
      socket.user = { id: 'anonymous', name: 'Anonymous Visitor' };
      return next();
    }

    try {
      const decoded = jwt.verify(token, config.JWT_SECRET);
      socket.user = {
        id: decoded.id || decoded._id,
        email: decoded.email,
        name: decoded.name,
      };
      next();
    } catch (err) {
      // Allow connection with fallback
      socket.user = { id: 'anonymous', name: 'Anonymous Visitor' };
      next();
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.user?.id || 'anonymous';
    socket.join(`user_${userId}`);
    console.log(`[Socket.IO] Client connected: ${socket.id} (User: ${userId})`);

    socket.on('join_workflow', (workflowId) => {
      socket.join(`workflow_${workflowId}`);
    });

    socket.on('disconnect', () => {
      console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
    });
  });

  setIO(io);

  const port = process.env.PORT || config.PORT || 5000;
  server.listen(port, () => {
    console.log(`=======================================================`);
    console.log(`🚀 API Sentinel Server running on http://127.0.0.1:${port}`);
    console.log(`📡 Socket.IO Real-Time Engine Active`);
    console.log(`🧪 Mock Simulator & E-Commerce Endpoints Available at /api/demo/*`);
    console.log(`=======================================================`);
  });

  return { app, server, io };
}

if (require.main === module) {
  startServer().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}

module.exports = {
  startServer,
};


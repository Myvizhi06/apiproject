/**
 * API Sentinel - Express Application Setup
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { securityHeaders, sanitizeInput } = require('./middleware/securityMiddleware');
const errorHandler = require('./middleware/errorHandler');
const apiRoutes = require('./routes');
const config = require('./config/config');

function createApp() {
  const app = express();

  // 1. Security Headers
  app.use(securityHeaders);

  // 2. CORS
  app.use(
    cors({
      origin: '*', // Allow local frontend and external tools
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Simulator-Scenario', 'Idempotency-Key'],
    })
  );

  // 3. Body Parsers & Sanitization
  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true, limit: '5mb' }));
  app.use(sanitizeInput);

  // 4. Health Check
  app.get('/health', (req, res) => {
    res.json({
      status: 'UP',
      service: 'API Sentinel Server',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    });
  });

  // 5. Mount API Routes
  app.use('/api', apiRoutes);

  // 6. Serve static client build if present
  const clientDist = path.join(__dirname, '../client/dist');
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/socket.io') || req.path.startsWith('/health')) {
        return next();
      }
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  // 7. Centralized Error Handler
  app.use(errorHandler);

  return app;
}

module.exports = {
  createApp,
};


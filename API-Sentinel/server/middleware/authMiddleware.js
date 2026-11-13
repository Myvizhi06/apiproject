/**
 * API Sentinel - JWT Authentication Middleware
 */

const jwt = require('jsonwebtoken');
const config = require('../config/config');

function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Access denied. Missing or invalid Authorization header.',
    });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, config.JWT_SECRET);
    req.user = {
      id: decoded.id || decoded._id,
      email: decoded.email,
      name: decoded.name,
    };
    next();
  } catch (err) {
    return res.status(401).json({
      error: 'InvalidToken',
      message: 'Authentication token is invalid or expired.',
    });
  }
}

module.exports = authMiddleware;


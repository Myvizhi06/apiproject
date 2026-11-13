/**
 * API Sentinel - Security Headers & Sanitization Middleware
 */

function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.removeHeader('X-Powered-By');
  next();
}

function sanitizeInput(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    sanitizeObject(req.body);
  }
  if (req.query && typeof req.query === 'object') {
    sanitizeObject(req.query);
  }
  next();
}

function sanitizeObject(obj) {
  for (const key of Object.keys(obj)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      delete obj[key];
      continue;
    }
    const val = obj[key];
    if (typeof val === 'string') {
      // Basic trim and strip null bytes
      obj[key] = val.replace(/\0/g, '');
    } else if (val && typeof val === 'object') {
      sanitizeObject(val);
    }
  }
}

module.exports = {
  securityHeaders,
  sanitizeInput,
};


/**
 * API Sentinel - Centralized Error Handler
 * Sanitizes stack traces, scrubs credentials and returns uniform JSON errors.
 */

function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || 'Internal Server Error';

  // Scrub potential sensitive info
  const sanitizedMessage = message.replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED]');

  if (statusCode >= 500) {
    console.error(`[Error] ${req.method} ${req.url} - ${statusCode}: ${sanitizedMessage}`);
  }

  res.status(statusCode).json({
    error: err.name || 'Error',
    message: sanitizedMessage,
    statusCode,
    timestamp: new Date().toISOString(),
  });
}

module.exports = errorHandler;


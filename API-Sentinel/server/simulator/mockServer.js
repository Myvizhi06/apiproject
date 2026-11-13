/**
 * API Sentinel - Mock API Server & Failure Simulator
 * Provides realistic e-commerce API endpoints with controllable failure modes.
 */

const express = require('express');

function createMockRouter() {
  const router = express.Router();

  // Simulation State
  let simulationState = {
    activeScenario: 'success', // 'success' | 'flaky_500' | 'timeout' | 'connection_reset' | 'invalid_json' | 'unexpected_status' | 'permanent_500' | 'rate_limit_429'
    flakyFailureCount: 2,      // Fails this many times before recovering
    currentCallCounts: {},     // Track calls per endpoint or scenario
    timeoutDurationMs: 3000,
  };

  // Helper to determine scenario for current request (header, query, or global)
  function getRequestScenario(req) {
    const fromHeader = req.headers['x-simulator-scenario'];
    const fromQuery = req.query.scenario;
    return fromHeader || fromQuery || simulationState.activeScenario;
  }

  // Middleware to handle simulated failures
  router.use((req, res, next) => {
    // Exclude simulator control endpoints from failure injection
    if (req.path.startsWith('/simulator/control') || req.path.startsWith('/simulator/reset')) {
      return next();
    }

    const scenario = getRequestScenario(req);
    const endpointKey = `${req.method}:${req.path}`;
    simulationState.currentCallCounts[endpointKey] = (simulationState.currentCallCounts[endpointKey] || 0) + 1;
    const callCount = simulationState.currentCallCounts[endpointKey];

    switch (scenario) {
      case 'flaky_500': {
        if (callCount <= simulationState.flakyFailureCount) {
          return res.status(500).json({
            error: 'InternalServerError',
            message: `Simulated transient database connection spike (attempt ${callCount}/${simulationState.flakyFailureCount})`,
            retryable: true,
          });
        }
        // Recovered! Proceed to actual endpoint logic
        return next();
      }

      case 'timeout': {
        // Delay longer than step timeout or never respond
        setTimeout(() => {
          if (!res.headersSent) {
            res.status(504).json({ error: 'GatewayTimeout', message: 'Simulated server timeout' });
          }
        }, simulationState.timeoutDurationMs);
        return; // Don't call next() immediately
      }

      case 'connection_reset': {
        // Destroy the socket
        if (req.socket) {
          req.socket.destroy();
        } else {
          res.end();
        }
        return;
      }

      case 'invalid_json': {
        // Send 200 OK with corrupted non-JSON body
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"status": "ok", "corrupted": [unquoted_broken_json');
        return;
      }

      case 'unexpected_status': {
        return res.status(418).json({
          error: 'TeapotError',
          message: 'Simulated unexpected status code 418 I\'m a teapot',
        });
      }

      case 'permanent_500': {
        return res.status(500).json({
          error: 'PermanentFailure',
          message: 'Simulated permanent server failure 500',
        });
      }

      case 'rate_limit_429': {
        // Fail once or twice with 429 and Retry-After: 1
        if (callCount <= 1) {
          res.set('Retry-After', '1');
          return res.status(429).json({
            error: 'RateLimitExceeded',
            message: 'Too many requests, please slow down.',
            retryAfterSeconds: 1,
          });
        }
        return next();
      }

      case 'success':
      default:
        return next();
    }
  });

  // Simulator Control Endpoints
  router.get('/simulator/control', (req, res) => {
    res.json({
      activeScenario: simulationState.activeScenario,
      flakyFailureCount: simulationState.flakyFailureCount,
      timeoutDurationMs: simulationState.timeoutDurationMs,
      callCounts: simulationState.currentCallCounts,
      availableScenarios: [
        { id: 'success', name: 'Nominal Success (200 OK)', description: 'All endpoints respond promptly with standard successful data.' },
        { id: 'flaky_500', name: 'Temporary Server Error (500)', description: 'Fails with 500 twice, then automatically recovers on the 3rd retry.' },
        { id: 'timeout', name: 'Connection / Gateway Timeout', description: 'Server hangs, exceeding client request timeout threshold.' },
        { id: 'connection_reset', name: 'Server Socket Reset', description: 'Server drops connection mid-stream to simulate crash.' },
        { id: 'invalid_json', name: 'Corrupted / Invalid JSON', description: 'Returns 200 OK but with unparseable payload structure.' },
        { id: 'unexpected_status', name: 'Unexpected Status Code (418)', description: 'Returns unexpected HTTP status code failing assertions.' },
        { id: 'rate_limit_429', name: 'Rate Limit (429) + Retry-After', description: 'Returns 429 with Retry-After header, testing backoff logic.' },
        { id: 'permanent_500', name: 'Permanent Failure (Retry Exhaustion)', description: 'Always returns 500, demonstrating graceful failure when retries expire.' },
      ],
    });
  });

  router.post('/simulator/control', (req, res) => {
    const { scenario, flakyFailureCount, timeoutDurationMs } = req.body;
    if (scenario) simulationState.activeScenario = scenario;
    if (flakyFailureCount !== undefined) simulationState.flakyFailureCount = Number(flakyFailureCount);
    if (timeoutDurationMs !== undefined) simulationState.timeoutDurationMs = Number(timeoutDurationMs);
    simulationState.currentCallCounts = {};

    res.json({
      message: `Simulator updated to scenario: ${simulationState.activeScenario}`,
      state: simulationState,
    });
  });

  router.post('/simulator/reset', (req, res) => {
    simulationState = {
      activeScenario: 'success',
      flakyFailureCount: 2,
      currentCallCounts: {},
      timeoutDurationMs: 3000,
    };
    res.json({ message: 'Simulator reset to default success state', state: simulationState });
  });

  // Demo E-Commerce Endpoints
  // 1. POST /api/demo/login
  router.post('/demo/login', (req, res) => {
    const { username, password } = req.body || {};
    // Accept demo credentials
    const token = 'jwt_mock_token_api_sentinel_xyz987654321';
    res.status(200).json({
      status: 'success',
      token,
      user: {
        id: 'usr_mock_001',
        name: username || 'Sentinel Demo User',
        role: 'operator',
      },
      expiresIn: 3600,
    });
  });

  // 2. GET /api/demo/products
  router.get('/demo/products', (req, res) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing or invalid Bearer authorization header.',
      });
    }

    res.status(200).json({
      status: 'success',
      count: 3,
      products: [
        { id: 'prod_101', name: 'Sentinel Security Probe', price: 149.99, inStock: true },
        { id: 'prod_102', name: 'Automated Test Cluster Node', price: 299.50, inStock: true },
        { id: 'prod_103', name: 'API Latency Monitor Shield', price: 89.00, inStock: false },
      ],
    });
  });

  // 3. POST /api/demo/payment
  router.post('/demo/payment', (req, res) => {
    const { amount, currency, orderId } = req.body || {};
    const idempotencyKey = req.headers['idempotency-key'] || req.headers['x-idempotency-key'];

    const paymentId = 'pay_' + Math.random().toString(36).substring(2, 10);
    res.status(200).json({
      status: 'processed',
      paymentId,
      amount: amount || 149.99,
      currency: currency || 'USD',
      idempotencyKey: idempotencyKey || null,
      timestamp: new Date().toISOString(),
    });
  });

  // 4. POST /api/demo/order
  router.post('/demo/order', (req, res) => {
    const { productId, paymentId, quantity } = req.body || {};

    const orderId = 'ord_' + Math.random().toString(36).substring(2, 10);
    res.status(200).json({
      status: 'confirmed',
      orderId,
      productId: productId || 'prod_101',
      paymentId: paymentId || 'pay_unknown',
      quantity: quantity || 1,
      estimatedDelivery: '2 business days',
      createdAt: new Date().toISOString(),
    });
  });

  return router;
}

module.exports = {
  createMockRouter,
};


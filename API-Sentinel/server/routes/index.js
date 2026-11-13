/**
 * API Sentinel - Main API Router
 */

const express = require('express');
const authRoutes = require('./authRoutes');
const workflowRoutes = require('./workflowRoutes');
const aslRoutes = require('./aslRoutes');
const executionRoutes = require('./executionRoutes');
const analyticsRoutes = require('./analyticsRoutes');
const settingsRoutes = require('./settingsRoutes');
const { createMockRouter } = require('../simulator/mockServer');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/workflows', workflowRoutes);
router.use('/asl', aslRoutes);
router.use('/executions', executionRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/settings', settingsRoutes);

// Simulator & mock endpoints
router.use('/', createMockRouter());

module.exports = router;


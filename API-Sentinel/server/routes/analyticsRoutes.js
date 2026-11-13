/**
 * API Sentinel - Analytics Routes
 */

const express = require('express');
const AnalyticsController = require('../controllers/analyticsController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

router.use(authMiddleware);

router.get('/dashboard', AnalyticsController.getDashboardStats);

module.exports = router;


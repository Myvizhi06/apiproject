/**
 * API Sentinel - Settings Routes
 */

const express = require('express');
const SettingsController = require('../controllers/settingsController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

router.use(authMiddleware);

router.get('/', SettingsController.getSettings);
router.put('/', SettingsController.updateSettings);

module.exports = router;


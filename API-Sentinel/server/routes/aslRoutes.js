/**
 * API Sentinel - ASL Language Routes
 */

const express = require('express');
const ASLController = require('../controllers/aslController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

router.use(authMiddleware);

router.post('/parse', ASLController.parse);
router.post('/validate', ASLController.validate);
router.post('/convert', ASLController.convert);
router.post('/save', ASLController.saveFromAsl);

module.exports = router;


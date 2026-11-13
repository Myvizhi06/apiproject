/**
 * API Sentinel - Execution & Audit Routes
 */

const express = require('express');
const ExecutionController = require('../controllers/executionController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

router.use(authMiddleware);

router.get('/', ExecutionController.list);
router.get('/:id', ExecutionController.getById);
router.post('/:id/cancel', ExecutionController.cancelExecution);
router.get('/failures/all', ExecutionController.listFailures);

module.exports = router;


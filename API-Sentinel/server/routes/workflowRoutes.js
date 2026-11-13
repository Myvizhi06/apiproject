/**
 * API Sentinel - Workflow CRUD & Reorder Routes
 */

const express = require('express');
const WorkflowController = require('../controllers/workflowController');
const ExecutionController = require('../controllers/executionController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

router.use(authMiddleware);

router.get('/', WorkflowController.list);
router.post('/', WorkflowController.create);
router.get('/:id', WorkflowController.getById);
router.put('/:id', WorkflowController.update);
router.delete('/:id', WorkflowController.delete);
router.post('/:id/reorder', WorkflowController.reorderSteps);

// Execution trigger
router.post('/:id/execute', ExecutionController.executeWorkflow);

module.exports = router;


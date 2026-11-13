/**
 * API Sentinel - Workflow Execution Controller
 * Orchestrates live executions, emits Socket.IO events to user rooms, and stores audit trails.
 */

const { Workflow, Execution, FailureLog } = require('../models');
const { WorkflowExecutor } = require('../engines/execution/workflowExecutor');
const { emitToUser } = require('../utils/socketManager');
const config = require('../config/config');

// In-memory map of currently active executors for cancellation
const activeExecutors = new Map();

class ExecutionController {
  static async executeWorkflow(req, res, next) {
    try {
      const { id } = req.params;
      const ownerId = String(req.user.id);

      const workflow = await Workflow.findById(id);
      if (!workflow) {
        return res.status(404).json({ error: 'NotFound', message: 'Workflow not found.' });
      }

      if (String(workflow.ownerId) !== ownerId) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Access denied. You do not own this workflow.',
        });
      }

      const execution = await Execution.create({
        workflowId: String(workflow._id || workflow.id),
        workflowName: workflow.name,
        ownerId,
        status: 'RUNNING',
        startTime: new Date(),
        steps: [],
        fsmHistory: [],
      });

      const executionId = String(execution._id || execution.id);

      const baseUrl = req.body.baseUrl || `http://127.0.0.1:${config.PORT}`;
      const allowedHosts = config.DEMO_ALLOWED_HOSTS || ['127.0.0.1', 'localhost'];

      const executor = new WorkflowExecutor(workflow, {
        executionId,
        userId: ownerId,
        baseUrl,
        allowedHosts,
        allowLocalNetwork: true,
      });

      activeExecutors.set(executionId, executor);

      // Stream Socket.IO events to the user's private room
      const forwardEvents = [
        'workflow_started',
        'fsm_transition',
        'step_started',
        'request_sent',
        'response_received',
        'step_completed',
        'failure_detected',
        'recovery_decision',
        'retry_scheduled',
        'retry_attempted',
        'workflow_completed',
        'workflow_failed',
        'workflow_cancelled',
      ];

      for (const evtName of forwardEvents) {
        executor.on(evtName, (payload) => {
          emitToUser(ownerId, evtName, {
            ...payload,
            executionId,
            workflowId: String(workflow._id || workflow.id),
          });
        });
      }

      // Record failure logs in real time
      executor.on('failure_detected', async (failureData) => {
        try {
          await FailureLog.create({
            executionId,
            ownerId,
            workflowId: String(workflow._id || workflow.id),
            stepId: failureData.stepId,
            stepName: failureData.stepName,
            failureType: failureData.failureReport.type,
            errorMessage: failureData.failureReport.message,
            recoveryAction: 'EVALUATING',
            retryCount: failureData.attempt,
            timestamp: new Date(),
          });
        } catch (e) {}
      });

      executor.on('recovery_decision', async (decisionData) => {
        try {
          await FailureLog.create({
            executionId,
            ownerId,
            workflowId: String(workflow._id || workflow.id),
            stepId: decisionData.stepId,
            stepName: decisionData.stepName,
            failureType: 'RECOVERY_ACTION',
            recoveryAction: decisionData.recoveryDecision.action,
            reason: decisionData.recoveryDecision.reason,
            retryCount: decisionData.recoveryDecision.retryCount,
            timestamp: new Date(),
          });
        } catch (e) {}
      });

      // Run execution
      const executionResult = await executor.execute();
      activeExecutors.delete(executionId);

      // Persist final execution outcome
      const updated = await Execution.findByIdAndUpdate(
        executionId,
        {
          status: executionResult.finalStatus,
          endTime: new Date(executionResult.endTime),
          duration: executionResult.durationMs,
          steps: executionResult.steps,
          finalResult: {
            failureReason: executionResult.failureReason,
            totalSteps: executionResult.steps.length,
            passedSteps: executionResult.steps.filter(s => s.passed).length,
          },
          fsmHistory: executionResult.fsmHistory,
        },
        { new: true }
      );

      res.json({
        message: `Workflow execution finished with status: ${executionResult.finalStatus}`,
        execution: updated,
      });
    } catch (err) {
      next(err);
    }
  }

  static async cancelExecution(req, res, next) {
    try {
      const { id } = req.params;
      const executor = activeExecutors.get(id);

      if (executor) {
        executor.cancel('Cancelled by user');
        activeExecutors.delete(id);
      }

      const execution = await Execution.findById(id);
      if (execution && String(execution.ownerId) === String(req.user.id)) {
        await Execution.findByIdAndUpdate(id, {
          status: 'CANCELLED',
          endTime: new Date(),
        });
      }

      res.json({ message: 'Execution cancelled', executionId: id });
    } catch (err) {
      next(err);
    }
  }

  static async list(req, res, next) {
    try {
      const ownerId = String(req.user.id);
      const queryResult = await Execution.find({ ownerId });
      let executions = Array.isArray(queryResult) ? queryResult : await queryResult.exec();

      // Sort descending by startTime
      executions.sort((a, b) => new Date(b.startTime || b.createdAt) - new Date(a.startTime || a.createdAt));

      res.json({
        count: executions.length,
        executions,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getById(req, res, next) {
    try {
      const { id } = req.params;
      const execution = await Execution.findById(id);

      if (!execution) {
        return res.status(404).json({ error: 'NotFound', message: 'Execution record not found.' });
      }

      if (String(execution.ownerId) !== String(req.user.id)) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Access denied. You do not own this execution record.',
        });
      }

      const failureLogsResult = await FailureLog.find({ executionId: id });
      const failureLogs = Array.isArray(failureLogsResult) ? failureLogsResult : await failureLogsResult.exec();

      res.json({
        execution,
        failureLogs,
      });
    } catch (err) {
      next(err);
    }
  }

  static async listFailures(req, res, next) {
    try {
      const ownerId = String(req.user.id);
      const queryResult = await FailureLog.find({ ownerId });
      const logs = Array.isArray(queryResult) ? queryResult : await queryResult.exec();

      logs.sort((a, b) => new Date(b.timestamp || b.createdAt) - new Date(a.timestamp || a.createdAt));

      res.json({
        count: logs.length,
        failures: logs,
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = ExecutionController;


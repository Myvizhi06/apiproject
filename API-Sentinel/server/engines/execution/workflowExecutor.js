/**
 * API Sentinel - Workflow Execution Engine
 * Drives step-by-step API workflow execution strictly governed by the formal FSM.
 * Integrates variable substitution, SSRF validation, verification, failure classification, and recovery.
 */

const axios = require('axios');
const EventEmitter = require('events');
const { FSMEngine, FSM_STATES } = require('../fsm/fsmEngine');
const { VariableEngine } = require('./variableEngine');
const { Verifier, VERIFICATION_STATUS } = require('../verification/verifier');
const { FailureClassifier, FAILURE_TYPES } = require('../detection/failureClassifier');
const { RecoveryDecisionEngine, RECOVERY_ACTIONS } = require('../recovery/recoveryEngine');
const { SSRFGuard } = require('../../utils/ssrfGuard');

class WorkflowExecutor extends EventEmitter {
  constructor(workflow, options = {}) {
    super();
    this.workflow = workflow;
    this.options = options;
    this.executionId = options.executionId || `exec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    this.userId = options.userId || null;
    this.baseUrl = options.baseUrl || 'http://127.0.0.1:5000';
    this.allowedHosts = options.allowedHosts || ['127.0.0.1', 'localhost', '127.0.0.1:5000', 'localhost:5000'];
    this.allowLocalNetwork = options.allowLocalNetwork !== undefined ? options.allowLocalNetwork : true;

    this.fsm = new FSMEngine(FSM_STATES.IDLE, {
      workflowId: workflow.id || workflow._id,
      executionId: this.executionId,
    });

    // Bubble FSM events
    this.fsm.on('transition', (evt) => {
      this.emit('fsm_transition', {
        executionId: this.executionId,
        ...evt,
      });
    });

    this.context = {
      steps: {},
      variables: {},
    };

    this.stepExecutionResults = [];
    this.failureLogs = [];
    this.isCancelled = false;
    this.activeAxiosSource = null;
    this.startTime = null;
    this.endTime = null;
  }

  cancel(reason = 'Execution cancelled by user') {
    this.isCancelled = true;
    if (this.activeAxiosSource) {
      try {
        this.activeAxiosSource.cancel('Workflow execution cancelled');
      } catch (e) {}
    }
    this.fsm.cancel(reason);
    this.emit('workflow_cancelled', {
      executionId: this.executionId,
      reason,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Execute the full workflow end to end
   */
  async execute() {
    this.startTime = new Date();
    this.emit('workflow_started', {
      executionId: this.executionId,
      workflowName: this.workflow.name,
      totalSteps: (this.workflow.steps || []).length,
      startTime: this.startTime.toISOString(),
    });

    try {
      // 1. Transition IDLE -> VALIDATING
      this.fsm.transition(FSM_STATES.VALIDATING, 'START_VALIDATION');

      // Validate workflow structure
      if (!this.workflow.steps || !Array.isArray(this.workflow.steps) || this.workflow.steps.length === 0) {
        this.fsm.transition(FSM_STATES.FAILED, 'VALIDATION_FAILED', {
          reason: 'Workflow contains no executable steps.',
        });
        return this.finalizeExecution('FAILED', 'Workflow contains no steps');
      }

      // Check cancellation
      if (this.isCancelled) return this.finalizeExecution('CANCELLED');

      // 2. Transition VALIDATING -> RUNNING
      this.fsm.transition(FSM_STATES.RUNNING, 'START_EXECUTION');

      // 3. Execute steps in order
      const steps = this.workflow.steps;
      for (let i = 0; i < steps.length; i++) {
        if (this.isCancelled) {
          return this.finalizeExecution('CANCELLED');
        }

        const step = steps[i];
        const isLastStep = i === steps.length - 1;

        // Ensure state is RUNNING before starting step
        if (this.fsm.getState() !== FSM_STATES.RUNNING) {
          if (this.fsm.getState() === FSM_STATES.SUCCESS) {
            this.fsm.transition(FSM_STATES.RUNNING, 'START_NEXT_STEP', { stepId: step.id || step.name });
          } else if (this.fsm.canTransition(FSM_STATES.RUNNING)) {
            this.fsm.transition(FSM_STATES.RUNNING, 'RESUME_STEP', { stepId: step.id || step.name });
          }
        }

        const stepResult = await this.executeStepWithRecovery(step);
        this.stepExecutionResults.push(stepResult);

        if (!stepResult.passed) {
          // If step failed and recovery exhausted/failed, abort workflow
          return this.finalizeExecution('FAILED', stepResult.failureReason || `Step '${step.name}' failed.`);
        }

        // Step succeeded!
        if (this.fsm.getState() === FSM_STATES.RUNNING) {
          this.fsm.transition(FSM_STATES.SUCCESS, 'STEP_COMPLETED', {
            stepId: step.id || step.name,
          });
        }

        if (isLastStep) {
          this.fsm.transition(FSM_STATES.COMPLETED, 'WORKFLOW_FINALIZE');
          return this.finalizeExecution('COMPLETED');
        } else {
          // Transition SUCCESS -> RUNNING for next step
          this.fsm.transition(FSM_STATES.RUNNING, 'NEXT_STEP_START', {
            stepId: steps[i + 1].id || steps[i + 1].name,
          });
        }
      }

      return this.finalizeExecution('COMPLETED');
    } catch (err) {
      if (!this.fsm.isTerminal() && this.fsm.canTransition(FSM_STATES.FAILED)) {
        try {
          this.fsm.transition(FSM_STATES.FAILED, 'UNHANDLED_EXCEPTION', {
            reason: err.message,
          });
        } catch (e) {}
      }
      return this.finalizeExecution('FAILED', err.message);
    }
  }

  /**
   * Execute a single step with recovery loop (FSM-driven)
   */
  async executeStepWithRecovery(step) {
    const stepId = step.id || step.name;
    const maxRetries = step.retries !== undefined ? Number(step.retries) : 0;
    let attempt = 0;
    let lastStepResult = null;

    this.emit('step_started', {
      executionId: this.executionId,
      stepId,
      stepName: step.name,
      attempt: 0,
    });

    // Check prerequisites / dependencies
    if (step.dependsOn && Array.isArray(step.dependsOn)) {
      for (const depName of step.dependsOn) {
        const depResult = this.context.steps[depName];
        if (!depResult || !depResult.passed) {
          const depError = new Error(`Prerequisite step '${depName}' failed or was not executed.`);
          depError.isDependencyFailure = true;
          depError.dependencyStep = depName;

          const failureReport = FailureClassifier.classify({
            error: depError,
            stepConfig: step,
          });

          if (this.fsm.canTransition(FSM_STATES.FAILED)) {
            this.fsm.transition(FSM_STATES.FAILED, 'DEPENDENCY_FAILED', {
              stepId,
              reason: failureReport.message,
            });
          }

          return {
            stepId,
            stepName: step.name,
            passed: false,
            attempts: 0,
            failureReason: failureReport.message,
            failureReport,
          };
        }
      }
    }

    while (attempt <= maxRetries && !this.isCancelled) {
      const isRetryAttempt = attempt > 0;

      if (isRetryAttempt) {
        this.emit('retry_attempted', {
          executionId: this.executionId,
          stepId,
          stepName: step.name,
          attempt,
          maxRetries,
        });
      }

      // Ensure FSM is in RUNNING when performing the HTTP call
      if (this.fsm.getState() !== FSM_STATES.RUNNING) {
        if (this.fsm.canTransition(FSM_STATES.RUNNING)) {
          this.fsm.transition(FSM_STATES.RUNNING, 'STEP_ATTEMPT_RUN', { stepId });
        }
      }

      const executionOutcome = await this.performSingleStepRequest(step);
      lastStepResult = executionOutcome;

      // Verification passed!
      if (executionOutcome.verificationResult && executionOutcome.verificationResult.allPassed) {
        // Record output variables
        const extracted = VariableEngine.extractVariables(step, executionOutcome);
        this.context.steps[step.name] = {
          stepId,
          stepName: step.name,
          passed: true,
          status: executionOutcome.status,
          headers: executionOutcome.headers,
          body: executionOutcome.data,
          extracted,
        };

        this.emit('step_completed', {
          executionId: this.executionId,
          stepId,
          stepName: step.name,
          attempt,
          passed: true,
          durationMs: executionOutcome.durationMs,
          status: executionOutcome.status,
        });

        return {
          stepId,
          stepName: step.name,
          passed: true,
          attempts: attempt,
          response: {
            status: executionOutcome.status,
            headers: executionOutcome.headers,
            data: executionOutcome.data,
            durationMs: executionOutcome.durationMs,
          },
          verification: executionOutcome.verificationResult,
          extracted,
        };
      }

      // Step failed verification or network error!
      const failureReport = FailureClassifier.classify({
        error: executionOutcome.networkError,
        response: executionOutcome,
        verificationResult: executionOutcome.verificationResult,
        stepConfig: step,
      });

      this.emit('failure_detected', {
        executionId: this.executionId,
        stepId,
        stepName: step.name,
        attempt,
        failureReport,
      });

      // Transition FSM to FAILED (legal from RUNNING)
      if (this.fsm.getState() === FSM_STATES.RUNNING) {
        this.fsm.transition(FSM_STATES.FAILED, 'STEP_CHECK_FAILED', {
          stepId,
          reason: failureReport.message,
        });
      }

      // Consult Recovery Decision Engine
      const recoveryDecision = RecoveryDecisionEngine.evaluate({
        stepConfig: step,
        failureReport,
        currentAttempt: attempt,
        maxRetriesLimit: 5,
      });

      this.emit('recovery_decision', {
        executionId: this.executionId,
        stepId,
        stepName: step.name,
        recoveryDecision,
      });

      this.failureLogs.push({
        stepId,
        stepName: step.name,
        failureType: failureReport.type,
        errorMessage: failureReport.message,
        recoveryAction: recoveryDecision.action,
        retryCount: attempt,
        reason: recoveryDecision.reason,
        timestamp: new Date().toISOString(),
      });

      // Execute Decision
      if (recoveryDecision.action === RECOVERY_ACTIONS.RETRY) {
        // Legal transition: FAILED -> RETRYING
        this.fsm.transition(FSM_STATES.RETRYING, 'SCHEDULE_RETRY', {
          stepId,
          metadata: { delayMs: recoveryDecision.delayMs, nextAttempt: attempt + 1 },
        });

        this.emit('retry_scheduled', {
          executionId: this.executionId,
          stepId,
          stepName: step.name,
          attempt: attempt + 1,
          delayMs: recoveryDecision.delayMs,
          reason: recoveryDecision.reason,
        });

        // Sleep for backoff duration
        await new Promise(r => setTimeout(r, recoveryDecision.delayMs));

        if (this.isCancelled) return { stepId, stepName: step.name, passed: false, cancelled: true };

        // Legal recovery path: RETRYING -> RECOVERING -> RUNNING
        this.fsm.transition(FSM_STATES.RECOVERING, 'COMMENCE_RECOVERY', { stepId });
        this.fsm.transition(FSM_STATES.RUNNING, 'RESUME_AFTER_BACKOFF', { stepId });

        attempt++;
        continue;
      }

      // If recovery action is FAIL (e.g. non-idempotent or retries exhausted)
      return {
        stepId,
        stepName: step.name,
        passed: false,
        attempts: attempt,
        failureReason: recoveryDecision.reason,
        failureReport,
        verification: executionOutcome.verificationResult,
      };
    }

    return {
      stepId,
      stepName: step.name,
      passed: false,
      attempts: attempt,
      failureReason: 'Retry attempts exhausted without recovery.',
      lastResult: lastStepResult,
    };
  }

  /**
   * Execute single HTTP request with SSRF guard and response timing
   */
  async performSingleStepRequest(step) {
    // 1. Substitute variables in URL, headers, and body
    const rawUrl = VariableEngine.substitute(step.url, this.context);
    const resolvedUrl = rawUrl.startsWith('http://') || rawUrl.startsWith('https://')
      ? rawUrl
      : `${this.baseUrl}${rawUrl.startsWith('/') ? '' : '/'}${rawUrl}`;

    const headers = VariableEngine.substitute(step.headers || {}, this.context);
    let body = VariableEngine.substitute(step.body, this.context);

    // Parse JSON string body if needed
    if (typeof body === 'string' && (body.trim().startsWith('{') || body.trim().startsWith('['))) {
      try {
        body = JSON.parse(body);
      } catch (e) {}
    }

    // 2. Validate SSRF Guard
    try {
      await SSRFGuard.validateUrl(resolvedUrl, {
        allowedHosts: this.allowedHosts,
        allowLocalNetwork: this.allowLocalNetwork,
      });
    } catch (ssrfError) {
      return {
        status: null,
        durationMs: 0,
        networkError: ssrfError,
        verificationResult: {
          status: VERIFICATION_STATUS.CONNECTION_ERROR,
          allPassed: false,
          failureReason: ssrfError.message,
          checks: [{ name: 'SSRF_GUARD', expected: 'Approved target URL', actual: ssrfError.message, passed: false }],
        },
      };
    }

    this.emit('request_sent', {
      executionId: this.executionId,
      stepId: step.id || step.name,
      stepName: step.name,
      method: (step.method || 'GET').toUpperCase(),
      url: resolvedUrl,
      headers,
      timestamp: new Date().toISOString(),
    });

    const startTime = Date.now();
    let responseObj = null;
    let networkError = null;
    let timedOut = false;
    let durationMs = 0;

    try {
      const source = axios.CancelToken.source();
      this.activeAxiosSource = source;

      const axiosResponse = await axios({
        method: (step.method || 'GET').toLowerCase(),
        url: resolvedUrl,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'API-Sentinel-Executor/1.0',
          ...headers,
        },
        data: ['POST', 'PUT', 'PATCH'].includes((step.method || 'GET').toUpperCase()) ? body : undefined,
        timeout: step.timeoutMs || 10000,
        cancelToken: source.token,
        maxRedirects: 0, // Manual safe redirect handling
        validateStatus: () => true, // Don't throw on 4xx/5xx so verifier can inspect
      });

      durationMs = Date.now() - startTime;
      responseObj = {
        status: axiosResponse.status,
        statusText: axiosResponse.statusText,
        headers: axiosResponse.headers,
        data: axiosResponse.data,
        durationMs,
        timedOut: false,
      };
    } catch (err) {
      durationMs = Date.now() - startTime;
      if (axios.isCancel(err) || this.isCancelled) {
        timedOut = false;
        networkError = new Error('Execution cancelled');
      } else if (err.code === 'ECONNABORTED' || err.message.includes('timeout')) {
        timedOut = true;
        networkError = err;
      } else {
        networkError = err;
      }

      responseObj = {
        status: err.response ? err.response.status : null,
        headers: err.response ? err.response.headers : {},
        data: err.response ? err.response.data : null,
        durationMs,
        timedOut,
        networkError,
      };
    } finally {
      this.activeAxiosSource = null;
    }

    this.emit('response_received', {
      executionId: this.executionId,
      stepId: step.id || step.name,
      stepName: step.name,
      status: responseObj.status,
      durationMs,
      timestamp: new Date().toISOString(),
    });

    // 3. Verify Response
    const verificationResult = Verifier.verify(responseObj, step);

    return {
      ...responseObj,
      verificationResult,
    };
  }

  finalizeExecution(finalStatus, failureReason = null) {
    this.endTime = new Date();
    const durationMs = this.endTime.getTime() - (this.startTime ? this.startTime.getTime() : this.endTime.getTime());

    const result = {
      executionId: this.executionId,
      workflowId: this.workflow.id || this.workflow._id,
      workflowName: this.workflow.name,
      finalStatus,
      failureReason,
      startTime: this.startTime ? this.startTime.toISOString() : null,
      endTime: this.endTime.toISOString(),
      durationMs,
      steps: this.stepExecutionResults,
      failureLogs: this.failureLogs,
      fsmHistory: this.fsm.getHistory(),
      extractedVariables: this.context.variables,
    };

    if (finalStatus === 'COMPLETED') {
      this.emit('workflow_completed', result);
    } else if (finalStatus === 'CANCELLED') {
      this.emit('workflow_cancelled', result);
    } else {
      this.emit('workflow_failed', result);
    }

    return result;
  }
}

module.exports = {
  WorkflowExecutor,
};

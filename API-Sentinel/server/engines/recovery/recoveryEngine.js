/**
 * API Sentinel - Recovery Decision Engine
 * Computes deterministic recovery strategies based on failure classification,
 * HTTP method idempotency semantics, exponential backoff with jitter, and retry quotas.
 */

const { FAILURE_TYPES } = require('../detection/failureClassifier');

const RECOVERY_ACTIONS = Object.freeze({
  RETRY: 'RETRY',
  FALLBACK: 'FALLBACK',
  FAIL: 'FAIL',
  SKIP: 'SKIP',
});

const SAFE_IDEMPOTENT_METHODS = new Set(['GET', 'HEAD', 'OPTIONS', 'PUT', 'DELETE']);
const NON_IDEMPOTENT_METHODS = new Set(['POST', 'PATCH']);

class RecoveryDecisionEngine {
  /**
   * Determine whether an HTTP request is safe to retry.
   */
  static isIdempotentOrSafe(stepConfig) {
    const method = String(stepConfig.method || 'GET').toUpperCase();

    // Standard RFC 7231 idempotent methods
    if (SAFE_IDEMPOTENT_METHODS.has(method)) {
      return { safe: true, reason: `HTTP method ${method} is naturally idempotent according to RFC 7231 specification.` };
    }

    // Explicit user safety flag
    if (stepConfig.idempotent === true || stepConfig.retrySafe === true) {
      return { safe: true, reason: `Step explicitly configured with idempotent/retrySafe flag enabled.` };
    }

    // Idempotency-Key header present
    const headers = stepConfig.headers || {};
    const hasIdempotencyKey = Object.keys(headers).some(
      k => k.toLowerCase() === 'idempotency-key' || k.toLowerCase() === 'x-idempotency-key'
    );

    if (hasIdempotencyKey) {
      return { safe: true, reason: `Request includes Idempotency-Key header guaranteeing server deduplication.` };
    }

    return {
      safe: false,
      reason: `HTTP method ${method} is non-idempotent. Retrying without an Idempotency-Key header or retrySafe flag risks duplicating side effects (e.g., duplicate charges or duplicate resource creation).`,
    };
  }

  /**
   * Calculate exponential backoff with jitter cap.
   * Formula: min(maxDelay, baseDelay * 2^(attempt - 1) + jitter)
   */
  static calculateBackoff({
    attempt = 1,
    baseDelayMs = 300,
    maxDelayMs = 5000,
    jitterMaxMs = 150,
    retryAfterMs = null,
  }) {
    if (retryAfterMs !== null && retryAfterMs > 0) {
      return Math.min(retryAfterMs, maxDelayMs);
    }

    const exponential = baseDelayMs * Math.pow(2, Math.max(0, attempt - 1));
    const jitter = Math.floor(Math.random() * (jitterMaxMs + 1));
    const total = exponential + jitter;

    return Math.min(total, maxDelayMs);
  }

  /**
   * Evaluate and decide recovery strategy.
   * @param {Object} context - { stepConfig, failureReport, currentAttempt, maxRetriesLimit }
   * @returns {Object} Recovery decision
   */
  static evaluate({
    stepConfig = {},
    failureReport = {},
    currentAttempt = 0,
    maxRetriesLimit = 5,
  }) {
    const configuredRetries = stepConfig.retries !== undefined ? Number(stepConfig.retries) : 0;
    const effectiveMaxRetries = Math.min(configuredRetries, maxRetriesLimit);
    const method = String(stepConfig.method || 'GET').toUpperCase();

    // 1. Dependency or Non-Transient Failure -> FAIL immediately
    if (failureReport.type === FAILURE_TYPES.DEPENDENCY_FAILURE) {
      return {
        action: RECOVERY_ACTIONS.FAIL,
        eligible: false,
        retryCount: currentAttempt,
        maxRetries: effectiveMaxRetries,
        delayMs: 0,
        reason: `Recovery aborted: Prerequisite step failed. Workflow cannot continue without required upstream dependency.`,
      };
    }

    if (failureReport.type === FAILURE_TYPES.HTTP_4XX && failureReport.type !== FAILURE_TYPES.HTTP_429) {
      return {
        action: RECOVERY_ACTIONS.FAIL,
        eligible: false,
        retryCount: currentAttempt,
        maxRetries: effectiveMaxRetries,
        delayMs: 0,
        reason: `Recovery aborted: HTTP ${failureReport.statusCode || '4xx'} is a client-side error. Retrying identical request will not succeed without modifying credentials or payload.`,
      };
    }

    if (failureReport.type === FAILURE_TYPES.UNEXPECTED_DATA) {
      return {
        action: RECOVERY_ACTIONS.FAIL,
        eligible: false,
        retryCount: currentAttempt,
        maxRetries: effectiveMaxRetries,
        delayMs: 0,
        reason: `Recovery aborted: Response schema or assertion mismatch (${failureReport.message}). Data validation errors indicate structural API changes.`,
      };
    }

    // 2. Check retry quota
    if (currentAttempt >= effectiveMaxRetries) {
      return {
        action: RECOVERY_ACTIONS.FAIL,
        eligible: false,
        retryCount: currentAttempt,
        maxRetries: effectiveMaxRetries,
        delayMs: 0,
        reason: `Recovery exhausted: Configured retry limit reached (${currentAttempt}/${effectiveMaxRetries} attempts). Terminating step to prevent infinite loops.`,
      };
    }

    // 3. Check Idempotency Safety for non-idempotent methods
    const idempotency = RecoveryDecisionEngine.isIdempotentOrSafe(stepConfig);
    if (!idempotency.safe) {
      return {
        action: RECOVERY_ACTIONS.FAIL,
        eligible: false,
        retryCount: currentAttempt,
        maxRetries: effectiveMaxRetries,
        delayMs: 0,
        reason: `Recovery blocked by Idempotency Safety Guard: ${idempotency.reason}`,
      };
    }

    // 4. Rate Limit (HTTP 429) - Honor Retry-After
    if (failureReport.type === FAILURE_TYPES.HTTP_429) {
      const delayMs = RecoveryDecisionEngine.calculateBackoff({
        attempt: currentAttempt + 1,
        retryAfterMs: failureReport.retryAfterMs,
        maxDelayMs: 10000,
      });

      return {
        action: RECOVERY_ACTIONS.RETRY,
        eligible: true,
        retryCount: currentAttempt + 1,
        maxRetries: effectiveMaxRetries,
        delayMs,
        reason: `Initiating Rate Limit Backoff: Server responded with HTTP 429. Pausing for ${delayMs}ms (honoring Retry-After) before retry attempt ${currentAttempt + 1} of ${effectiveMaxRetries}.`,
      };
    }

    // 5. Transient Server / Network Errors (5xx, Timeout, Refused, DNS)
    if (
      failureReport.isTransient ||
      failureReport.type === FAILURE_TYPES.HTTP_5XX ||
      failureReport.type === FAILURE_TYPES.CONNECTION_TIMEOUT ||
      failureReport.type === FAILURE_TYPES.CONNECTION_REFUSED ||
      failureReport.type === FAILURE_TYPES.DNS_FAILURE ||
      failureReport.type === FAILURE_TYPES.INVALID_RESPONSE
    ) {
      const delayMs = RecoveryDecisionEngine.calculateBackoff({
        attempt: currentAttempt + 1,
        baseDelayMs: 250,
        maxDelayMs: 4000,
        jitterMaxMs: 100,
      });

      return {
        action: RECOVERY_ACTIONS.RETRY,
        eligible: true,
        retryCount: currentAttempt + 1,
        maxRetries: effectiveMaxRetries,
        delayMs,
        reason: `Transient failure detected (${failureReport.type}: ${failureReport.message}). Method '${method}' verified safe. Executing retry attempt ${currentAttempt + 1} of ${effectiveMaxRetries} after ${delayMs}ms exponential backoff.`,
      };
    }

    // Default: Fail safely
    return {
      action: RECOVERY_ACTIONS.FAIL,
      eligible: false,
      retryCount: currentAttempt,
      maxRetries: effectiveMaxRetries,
      delayMs: 0,
      reason: `Unrecognized failure mode. Halting execution to prevent cascading failure.`,
    };
  }
}

module.exports = {
  RECOVERY_ACTIONS,
  SAFE_IDEMPOTENT_METHODS,
  NON_IDEMPOTENT_METHODS,
  RecoveryDecisionEngine,
};


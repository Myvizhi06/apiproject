const {
  RecoveryDecisionEngine,
  RECOVERY_ACTIONS,
  SAFE_IDEMPOTENT_METHODS,
} = require('../engines/recovery/recoveryEngine');
const { FAILURE_TYPES } = require('../engines/detection/failureClassifier');

describe('Recovery Decision Engine', () => {
  describe('Idempotency & Safety Guards', () => {
    test('identifies standard RFC 7231 methods as naturally safe', () => {
      ['GET', 'HEAD', 'OPTIONS', 'PUT', 'DELETE'].forEach((method) => {
        const check = RecoveryDecisionEngine.isIdempotentOrSafe({ method });
        expect(check.safe).toBe(true);
      });
    });

    test('rejects POST and PATCH by default without idempotency guarantees', () => {
      const postCheck = RecoveryDecisionEngine.isIdempotentOrSafe({ method: 'POST' });
      expect(postCheck.safe).toBe(false);
      expect(postCheck.reason).toContain('non-idempotent');

      const patchCheck = RecoveryDecisionEngine.isIdempotentOrSafe({ method: 'PATCH' });
      expect(patchCheck.safe).toBe(false);
    });

    test('allows POST when Idempotency-Key header is present', () => {
      const check = RecoveryDecisionEngine.isIdempotentOrSafe({
        method: 'POST',
        headers: { 'Idempotency-Key': 'unique_key_123' },
      });
      expect(check.safe).toBe(true);
      expect(check.reason).toContain('Idempotency-Key');
    });

    test('allows POST when retrySafe or idempotent flag is true', () => {
      const check = RecoveryDecisionEngine.isIdempotentOrSafe({
        method: 'POST',
        retrySafe: true,
      });
      expect(check.safe).toBe(true);
    });
  });

  describe('evaluate decisions', () => {
    test('approves RETRY with backoff for transient 500 error on safe GET method', () => {
      const decision = RecoveryDecisionEngine.evaluate({
        stepConfig: { method: 'GET', retries: 3 },
        failureReport: { type: FAILURE_TYPES.HTTP_5XX, isTransient: true, message: 'Internal Server Error' },
        currentAttempt: 0,
      });

      expect(decision.action).toBe(RECOVERY_ACTIONS.RETRY);
      expect(decision.eligible).toBe(true);
      expect(decision.retryCount).toBe(1);
      expect(decision.delayMs).toBeGreaterThan(0);
      expect(decision.reason).toContain('Transient failure detected');
    });

    test('blocks RETRY on non-idempotent POST without idempotency header', () => {
      const decision = RecoveryDecisionEngine.evaluate({
        stepConfig: { method: 'POST', retries: 3 },
        failureReport: { type: FAILURE_TYPES.HTTP_5XX, isTransient: true },
        currentAttempt: 0,
      });

      expect(decision.action).toBe(RECOVERY_ACTIONS.FAIL);
      expect(decision.eligible).toBe(false);
      expect(decision.reason).toContain('Idempotency Safety Guard');
    });

    test('honors Retry-After header on HTTP 429', () => {
      const decision = RecoveryDecisionEngine.evaluate({
        stepConfig: { method: 'GET', retries: 2 },
        failureReport: { type: FAILURE_TYPES.HTTP_429, retryAfterMs: 2000 },
        currentAttempt: 0,
      });

      expect(decision.action).toBe(RECOVERY_ACTIONS.RETRY);
      expect(decision.delayMs).toBe(2000);
      expect(decision.reason).toContain('Rate Limit Backoff');
    });

    test('terminates with FAIL when retry quota is exhausted', () => {
      const decision = RecoveryDecisionEngine.evaluate({
        stepConfig: { method: 'GET', retries: 2 },
        failureReport: { type: FAILURE_TYPES.HTTP_5XX, isTransient: true },
        currentAttempt: 2, // already attempted 2 retries
      });

      expect(decision.action).toBe(RECOVERY_ACTIONS.FAIL);
      expect(decision.eligible).toBe(false);
      expect(decision.reason).toContain('retry limit reached (2/2 attempts)');
    });

    test('fails immediately on client 4xx errors without retrying', () => {
      const decision = RecoveryDecisionEngine.evaluate({
        stepConfig: { method: 'GET', retries: 3 },
        failureReport: { type: FAILURE_TYPES.HTTP_4XX, statusCode: 404 },
        currentAttempt: 0,
      });

      expect(decision.action).toBe(RECOVERY_ACTIONS.FAIL);
      expect(decision.eligible).toBe(false);
      expect(decision.reason).toContain('HTTP 404 is a client-side error');
    });
  });

  describe('calculateBackoff', () => {
    test('produces exponential progression with cap', () => {
      const delay1 = RecoveryDecisionEngine.calculateBackoff({ attempt: 1, baseDelayMs: 100, maxDelayMs: 1000, jitterMaxMs: 0 });
      const delay2 = RecoveryDecisionEngine.calculateBackoff({ attempt: 2, baseDelayMs: 100, maxDelayMs: 1000, jitterMaxMs: 0 });
      const delay3 = RecoveryDecisionEngine.calculateBackoff({ attempt: 3, baseDelayMs: 100, maxDelayMs: 1000, jitterMaxMs: 0 });
      const delayCapped = RecoveryDecisionEngine.calculateBackoff({ attempt: 10, baseDelayMs: 100, maxDelayMs: 1000, jitterMaxMs: 0 });

      expect(delay1).toBe(100);
      expect(delay2).toBe(200);
      expect(delay3).toBe(400);
      expect(delayCapped).toBe(1000); // capped at maxDelayMs
    });
  });
});


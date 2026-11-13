const { Verifier, VERIFICATION_STATUS, resolvePropertyPath } = require('../engines/verification/verifier');

describe('Verification Engine', () => {
  describe('resolvePropertyPath', () => {
    const data = {
      user: {
        id: 42,
        profile: {
          roles: ['admin', 'editor'],
          email: 'test@sentinel.org',
        },
      },
      meta: { count: 10 },
    };

    test('resolves standard dot paths and bracket array paths', () => {
      expect(resolvePropertyPath(data, 'user.id')).toEqual({ found: true, value: 42 });
      expect(resolvePropertyPath(data, 'user.profile.roles[0]')).toEqual({ found: true, value: 'admin' });
      expect(resolvePropertyPath(data, 'user.profile.email')).toEqual({ found: true, value: 'test@sentinel.org' });
    });

    test('blocks prototype pollution keys safely', () => {
      expect(resolvePropertyPath(data, '__proto__.polluted')).toEqual({
        found: false,
        value: undefined,
        securityBlocked: true,
      });
      expect(resolvePropertyPath(data, 'constructor.name')).toEqual({
        found: false,
        value: undefined,
        securityBlocked: true,
      });
    });

    test('handles non-existent paths gracefully', () => {
      expect(resolvePropertyPath(data, 'user.nonExistent.sub')).toEqual({ found: false, value: undefined });
    });
  });

  describe('Verifier.verify', () => {
    test('passes on perfect matching response', () => {
      const response = {
        status: 200,
        headers: { 'content-type': 'application/json; charset=utf-8', 'x-req-id': 'abc-123' },
        data: { status: 'success', token: 'jwt123', user: { id: 1 } },
        durationMs: 45,
        timedOut: false,
      };

      const stepConfig = {
        expectedStatus: 200,
        maxResponseTimeMs: 200,
        expectedContentType: 'application/json',
        requiredHeaders: { 'x-req-id': 'abc-123' },
        requiredProperties: ['token', 'user.id'],
        assertions: [
          { type: 'PROPERTY_EQUALS', property: 'status', expected: 'success' },
        ],
      };

      const result = Verifier.verify(response, stepConfig);
      expect(result.status).toBe(VERIFICATION_STATUS.PASSED);
      expect(result.allPassed).toBe(true);
      expect(result.checks.length).toBeGreaterThanOrEqual(5);
    });

    test('fails when status code does not match expected', () => {
      const response = {
        status: 500,
        headers: {},
        data: { error: 'Boom' },
        durationMs: 50,
      };

      const result = Verifier.verify(response, { expectedStatus: 200 });
      expect(result.status).toBe(VERIFICATION_STATUS.FAILED);
      expect(result.allPassed).toBe(false);
      expect(result.failureReason).toContain('Expected HTTP status 200, but received 500');
    });

    test('fails when latency exceeds maximum threshold', () => {
      const response = {
        status: 200,
        headers: {},
        data: {},
        durationMs: 1500,
      };

      const result = Verifier.verify(response, { expectedStatus: 200, maxResponseTimeMs: 500 });
      expect(result.status).toBe(VERIFICATION_STATUS.VALIDATION_ERROR);
      expect(result.allPassed).toBe(false);
      expect(result.failureReason).toContain('exceeded maximum allowed 500ms');
    });

    test('flags TIMEOUT when request timed out', () => {
      const response = {
        status: null,
        durationMs: 5000,
        timedOut: true,
      };

      const result = Verifier.verify(response, { timeoutMs: 5000 });
      expect(result.status).toBe(VERIFICATION_STATUS.TIMEOUT);
      expect(result.allPassed).toBe(false);
      expect(result.failureReason).toContain('timed out');
    });

    test('fails when required property is missing in response body', () => {
      const response = {
        status: 200,
        data: { otherField: 'val' },
        durationMs: 20,
      };

      const result = Verifier.verify(response, {
        expectedStatus: 200,
        requiredProperties: ['user.token'],
      });

      expect(result.allPassed).toBe(false);
      expect(result.failureReason).toContain("Missing required property 'user.token'");
    });
  });
});


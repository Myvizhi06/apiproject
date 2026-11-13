const { FailureClassifier, FAILURE_TYPES } = require('../engines/detection/failureClassifier');

describe('Failure Classifier Engine', () => {
  test('classifies connection timeout correctly', () => {
    const error = new Error('timeout of 5000ms exceeded');
    error.code = 'ECONNABORTED';

    const result = FailureClassifier.classify({ error, stepConfig: { url: '/api/timeout' } });
    expect(result.type).toBe(FAILURE_TYPES.CONNECTION_TIMEOUT);
    expect(result.isTransient).toBe(true);
    expect(result.retryEligible).toBe(true);
  });

  test('classifies connection refused correctly', () => {
    const error = new Error('connect ECONNREFUSED 127.0.0.1:9999');
    error.code = 'ECONNREFUSED';

    const result = FailureClassifier.classify({ error, stepConfig: { url: 'http://127.0.0.1:9999' } });
    expect(result.type).toBe(FAILURE_TYPES.CONNECTION_REFUSED);
    expect(result.isTransient).toBe(true);
  });

  test('classifies DNS resolution failure correctly', () => {
    const error = new Error('getaddrinfo ENOTFOUND bad.host.invalid');
    error.code = 'ENOTFOUND';

    const result = FailureClassifier.classify({ error, stepConfig: { url: 'http://bad.host.invalid' } });
    expect(result.type).toBe(FAILURE_TYPES.DNS_FAILURE);
    expect(result.isTransient).toBe(true);
  });

  test('classifies HTTP 5xx server error correctly', () => {
    const response = { status: 503, statusText: 'Service Unavailable', headers: {} };
    const result = FailureClassifier.classify({ response });
    expect(result.type).toBe(FAILURE_TYPES.HTTP_5XX);
    expect(result.statusCode).toBe(503);
    expect(result.isTransient).toBe(true);
  });

  test('classifies HTTP 429 and parses Retry-After header', () => {
    const response = {
      status: 429,
      headers: { 'retry-after': '3' },
    };
    const result = FailureClassifier.classify({ response });
    expect(result.type).toBe(FAILURE_TYPES.HTTP_429);
    expect(result.statusCode).toBe(429);
    expect(result.retryAfterMs).toBe(3000);
    expect(result.isTransient).toBe(true);
  });

  test('classifies HTTP 4xx client errors as non-transient and not retry eligible', () => {
    const response = { status: 401, headers: {} };
    const result = FailureClassifier.classify({ response });
    expect(result.type).toBe(FAILURE_TYPES.HTTP_4XX);
    expect(result.isTransient).toBe(false);
    expect(result.retryEligible).toBe(false);
  });

  test('classifies dependency failure correctly', () => {
    const error = new Error('Prerequisite Login failed');
    error.isDependencyFailure = true;
    error.dependencyStep = 'Login';

    const result = FailureClassifier.classify({ error });
    expect(result.type).toBe(FAILURE_TYPES.DEPENDENCY_FAILURE);
    expect(result.isTransient).toBe(false);
    expect(result.retryEligible).toBe(false);
  });

  test('classifies invalid JSON response correctly', () => {
    const response = {
      status: 200,
      isInvalidJson: true,
      rawData: '<html>Server Error</html>',
    };
    const verificationResult = { allPassed: false, failureReason: 'JSON Parse error' };
    const result = FailureClassifier.classify({ response, verificationResult });
    expect(result.type).toBe(FAILURE_TYPES.INVALID_RESPONSE);
    expect(result.isTransient).toBe(true);
  });

  test('classifies unexpected data assertion failure', () => {
    const response = { status: 200, data: { orderId: null } };
    const verificationResult = {
      allPassed: false,
      failureReason: "Property 'orderId' is null",
      checks: [{ name: 'orderId', passed: false }],
    };
    const result = FailureClassifier.classify({ response, verificationResult });
    expect(result.type).toBe(FAILURE_TYPES.UNEXPECTED_DATA);
    expect(result.isTransient).toBe(false);
  });
});


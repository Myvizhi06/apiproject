/**
 * API Sentinel - Verification Engine
 * Multi-criteria response verification with granular expected vs actual comparisons.
 */

const VERIFICATION_STATUS = Object.freeze({
  PASSED: 'PASSED',
  FAILED: 'FAILED',
  TIMEOUT: 'TIMEOUT',
  CONNECTION_ERROR: 'CONNECTION_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
});

/**
 * Safely resolve dot/bracket path in an object without prototype pollution
 */
function resolvePropertyPath(obj, path) {
  if (!obj || typeof obj !== 'object' || !path || typeof path !== 'string') {
    return { found: false, value: undefined };
  }

  // Tokenize path: a.b[0].c
  const segments = path
    .replace(/\[(\w+)\]/g, '.$1')
    .split('.')
    .filter(Boolean);

  let current = obj;
  for (const seg of segments) {
    if (seg === '__proto__' || seg === 'prototype' || seg === 'constructor') {
      return { found: false, value: undefined, securityBlocked: true };
    }
    if (current === null || current === undefined || typeof current !== 'object') {
      return { found: false, value: undefined };
    }
    if (!(seg in current)) {
      return { found: false, value: undefined };
    }
    current = current[seg];
  }

  return { found: true, value: current };
}

class Verifier {
  /**
   * Verify an HTTP response against step assertions and conditions.
   * @param {Object} response - { status, headers, data, durationMs, timedOut, networkError }
   * @param {Object} stepConfig - Step assertions, expectedStatus, timeoutMs, etc.
   * @returns {Object} verification result
   */
  static verify(response, stepConfig = {}) {
    const checks = [];

    // 1. Connection / Timeout check
    if (response.timedOut) {
      return {
        status: VERIFICATION_STATUS.TIMEOUT,
        allPassed: false,
        failureReason: `Request timed out after ${stepConfig.timeoutMs || 10000}ms without receiving a server response.`,
        checks: [
          {
            name: 'TIMEOUT_CHECK',
            expected: `< ${stepConfig.timeoutMs || 10000}ms`,
            actual: `Timed out (${response.durationMs || 0}ms)`,
            passed: false,
            message: 'Server failed to respond within configured timeout.',
          },
        ],
      };
    }

    if (response.networkError) {
      return {
        status: VERIFICATION_STATUS.CONNECTION_ERROR,
        allPassed: false,
        failureReason: `Connection failed: ${response.networkError.message || response.networkError.code || 'Network error'}`,
        checks: [
          {
            name: 'NETWORK_CONNECTION',
            expected: 'Connected HTTP response',
            actual: `Connection error: ${response.networkError.code || response.networkError.message}`,
            passed: false,
            message: response.networkError.message || 'Underlying network connection failed.',
          },
        ],
      };
    }

    // 2. HTTP Status Code check
    const expectedStatus = stepConfig.expectedStatus !== undefined ? Number(stepConfig.expectedStatus) : 200;
    const actualStatus = Number(response.status);
    const statusPassed = actualStatus === expectedStatus;

    checks.push({
      name: 'HTTP_STATUS_CODE',
      expected: expectedStatus,
      actual: actualStatus,
      passed: statusPassed,
      message: statusPassed
        ? `Status code ${actualStatus} matches expected ${expectedStatus}.`
        : `Expected HTTP status ${expectedStatus}, but received ${actualStatus}.`,
    });

    // 3. Response Time / Latency check
    if (stepConfig.maxResponseTimeMs) {
      const maxTime = Number(stepConfig.maxResponseTimeMs);
      const actualTime = Number(response.durationMs || 0);
      const latencyPassed = actualTime <= maxTime;
      checks.push({
        name: 'RESPONSE_LATENCY',
        expected: `<= ${maxTime}ms`,
        actual: `${actualTime}ms`,
        passed: latencyPassed,
        message: latencyPassed
          ? `Response latency ${actualTime}ms is within threshold ${maxTime}ms.`
          : `Response latency ${actualTime}ms exceeded maximum allowed ${maxTime}ms.`,
      });
    }

    // 4. Content-Type check
    if (stepConfig.expectedContentType) {
      const actualContentType = (response.headers && (response.headers['content-type'] || response.headers['Content-Type'])) || '';
      const ctPassed = actualContentType.toLowerCase().includes(stepConfig.expectedContentType.toLowerCase());
      checks.push({
        name: 'CONTENT_TYPE',
        expected: stepConfig.expectedContentType,
        actual: actualContentType,
        passed: ctPassed,
        message: ctPassed
          ? `Content-Type '${actualContentType}' matches expected '${stepConfig.expectedContentType}'.`
          : `Expected Content-Type containing '${stepConfig.expectedContentType}', got '${actualContentType}'.`,
      });
    }

    // 5. Required Headers check
    if (stepConfig.requiredHeaders && typeof stepConfig.requiredHeaders === 'object') {
      for (const [headerKey, expectedVal] of Object.entries(stepConfig.requiredHeaders)) {
        const lowerKey = headerKey.toLowerCase();
        let actualVal = undefined;
        if (response.headers) {
          for (const [k, v] of Object.entries(response.headers)) {
            if (k.toLowerCase() === lowerKey) {
              actualVal = v;
              break;
            }
          }
        }

        const present = actualVal !== undefined;
        const valueMatches = expectedVal === null || expectedVal === undefined || String(actualVal) === String(expectedVal);
        const headerPassed = present && valueMatches;

        checks.push({
          name: `HEADER:${headerKey}`,
          expected: expectedVal !== null && expectedVal !== undefined ? `${headerKey}: ${expectedVal}` : `Header '${headerKey}' present`,
          actual: present ? `${headerKey}: ${actualVal}` : 'Missing header',
          passed: headerPassed,
          message: headerPassed
            ? `Header '${headerKey}' verified.`
            : `Header verification failed for '${headerKey}'.`,
        });
      }
    }

    // 6. Required JSON Properties
    if (Array.isArray(stepConfig.requiredProperties)) {
      for (const propPath of stepConfig.requiredProperties) {
        const { found, value, securityBlocked } = resolvePropertyPath(response.data, propPath);
        const propPassed = found && value !== null && value !== undefined && !securityBlocked;

        checks.push({
          name: `REQUIRED_PROPERTY:${propPath}`,
          expected: `Property '${propPath}' exists and is not null/undefined`,
          actual: securityBlocked ? 'Blocked unsafe path' : found ? `Found: ${JSON.stringify(value)}` : 'Property not found',
          passed: propPassed,
          message: propPassed
            ? `Required property '${propPath}' is present.`
            : `Missing required property '${propPath}' in response body.`,
        });
      }
    }

    // 7. Expected Property Values (assertions)
    if (Array.isArray(stepConfig.assertions)) {
      for (const assertion of stepConfig.assertions) {
        if (assertion.type === 'STATUS_CODE') continue; // Handled above

        if (assertion.type === 'PROPERTY_EQUALS') {
          const { found, value } = resolvePropertyPath(response.data, assertion.property);
          const passed = found && String(value) === String(assertion.expected);
          checks.push({
            name: `ASSERT_PROP:${assertion.property}`,
            expected: assertion.expected,
            actual: found ? value : 'undefined',
            passed,
            message: passed
              ? `Property '${assertion.property}' equals '${assertion.expected}'.`
              : `Expected property '${assertion.property}' to equal '${assertion.expected}', got '${found ? value : 'undefined'}'.`,
          });
        } else if (assertion.type === 'BODY_CONTAINS') {
          const bodyStr = typeof response.data === 'string' ? response.data : JSON.stringify(response.data || '');
          const passed = bodyStr.includes(String(assertion.expected));
          checks.push({
            name: 'BODY_CONTAINS',
            expected: `Contains '${assertion.expected}'`,
            actual: bodyStr.length > 100 ? `${bodyStr.substring(0, 100)}...` : bodyStr,
            passed,
            message: passed
              ? `Body contains '${assertion.expected}'.`
              : `Expected body to contain '${assertion.expected}'.`,
          });
        }
      }
    }

    const allPassed = checks.every(c => c.passed);
    let status = VERIFICATION_STATUS.PASSED;
    let failureReason = null;

    if (!allPassed) {
      const failedChecks = checks.filter(c => !c.passed);
      failureReason = failedChecks.map(c => c.message).join('; ');
      status = !statusPassed ? VERIFICATION_STATUS.FAILED : VERIFICATION_STATUS.VALIDATION_ERROR;
    }

    return {
      status,
      allPassed,
      checks,
      failureReason,
    };
  }
}

module.exports = {
  VERIFICATION_STATUS,
  Verifier,
  resolvePropertyPath,
};


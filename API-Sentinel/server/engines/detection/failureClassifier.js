/**
 * API Sentinel - Failure Classifier Engine
 * Deterministically classifies errors and response anomalies into typed failure categories.
 */

const FAILURE_TYPES = Object.freeze({
  CONNECTION_TIMEOUT: 'CONNECTION_TIMEOUT',
  CONNECTION_REFUSED: 'CONNECTION_REFUSED',
  DNS_FAILURE: 'DNS_FAILURE',
  HTTP_5XX: 'HTTP_5XX',
  HTTP_429: 'HTTP_429',
  HTTP_4XX: 'HTTP_4XX',
  INVALID_RESPONSE: 'INVALID_RESPONSE',
  UNEXPECTED_DATA: 'UNEXPECTED_DATA',
  DEPENDENCY_FAILURE: 'DEPENDENCY_FAILURE',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
});

class FailureClassifier {
  /**
   * Classify an error or invalid verification outcome into a structured failure report.
   * @param {Object} input - { error, response, verificationResult, stepConfig }
   * @returns {Object} classification result
   */
  static classify({ error = null, response = null, verificationResult = null, stepConfig = {} }) {
    // 1. Dependency Failure
    if (error && error.isDependencyFailure) {
      return {
        type: FAILURE_TYPES.DEPENDENCY_FAILURE,
        isTransient: false,
        retryEligible: false,
        statusCode: null,
        errorCode: 'DEPENDENCY_FAILED',
        message: error.message || 'Prerequisite step failed.',
        details: { dependencyStep: error.dependencyStep },
      };
    }

    // 2. Network / System Error Classification
    if (error) {
      const code = String(error.code || '').toUpperCase();
      const message = String(error.message || '');

      // Timeout
      if (
        code === 'ECONNABORTED' ||
        code === 'ETIMEDOUT' ||
        message.toLowerCase().includes('timeout') ||
        error.timedOut
      ) {
        return {
          type: FAILURE_TYPES.CONNECTION_TIMEOUT,
          isTransient: true,
          retryEligible: true,
          statusCode: null,
          errorCode: code || 'ETIMEDOUT',
          message: `Network timeout connecting to ${stepConfig.url || 'endpoint'}: ${message}`,
          details: { code, url: stepConfig.url },
        };
      }

      // Connection Refused
      if (code === 'ECONNREFUSED' || message.includes('ECONNREFUSED')) {
        return {
          type: FAILURE_TYPES.CONNECTION_REFUSED,
          isTransient: true,
          retryEligible: true,
          statusCode: null,
          errorCode: 'ECONNREFUSED',
          message: `Connection refused by server at ${stepConfig.url || 'endpoint'}. Service may be restarting.`,
          details: { code, url: stepConfig.url },
        };
      }

      // DNS Failure
      if (code === 'ENOTFOUND' || code === 'EAI_AGAIN' || message.includes('ENOTFOUND')) {
        return {
          type: FAILURE_TYPES.DNS_FAILURE,
          isTransient: true,
          retryEligible: true,
          statusCode: null,
          errorCode: code || 'ENOTFOUND',
          message: `DNS resolution failed for hostname in URL: ${message}`,
          details: { code, url: stepConfig.url },
        };
      }

      // Connection Reset
      if (code === 'ECONNRESET' || message.includes('socket hang up') || message.includes('ECONNRESET')) {
        return {
          type: FAILURE_TYPES.CONNECTION_REFUSED,
          isTransient: true,
          retryEligible: true,
          statusCode: null,
          errorCode: code || 'ECONNRESET',
          message: `Connection forcibly closed or reset by server: ${message}`,
          details: { code },
        };
      }
    }

    // 3. HTTP Response Status Classification
    const statusCode = response ? Number(response.status) : (error && error.response ? Number(error.response.status) : null);
    const headers = (response && response.headers) || (error && error.response && error.response.headers) || {};

    if (statusCode) {
      // 429 Rate Limit
      if (statusCode === 429) {
        const retryAfterHeader = headers['retry-after'] || headers['Retry-After'];
        let retryAfterMs = null;
        if (retryAfterHeader) {
          const parsedSec = Number(retryAfterHeader);
          if (!isNaN(parsedSec)) {
            retryAfterMs = parsedSec * 1000;
          } else {
            const date = new Date(retryAfterHeader);
            if (!isNaN(date.getTime())) {
              retryAfterMs = Math.max(0, date.getTime() - Date.now());
            }
          }
        }

        return {
          type: FAILURE_TYPES.HTTP_429,
          isTransient: true,
          retryEligible: true,
          statusCode: 429,
          errorCode: 'RATE_LIMIT_EXCEEDED',
          retryAfterMs: retryAfterMs || 1000,
          message: `HTTP 429 Too Many Requests (Rate Limit Exceeded).${retryAfterHeader ? ` Server requested Retry-After: ${retryAfterHeader}s.` : ''}`,
          details: { retryAfterHeader, retryAfterMs },
        };
      }

      // 5xx Server Errors
      if (statusCode >= 500 && statusCode <= 599) {
        return {
          type: FAILURE_TYPES.HTTP_5XX,
          isTransient: true,
          retryEligible: true,
          statusCode,
          errorCode: `HTTP_${statusCode}`,
          message: `Server returned HTTP ${statusCode} Internal Error.`,
          details: { status: statusCode, statusText: response && response.statusText },
        };
      }

      // 4xx Client Errors
      if (statusCode >= 400 && statusCode <= 499) {
        return {
          type: FAILURE_TYPES.HTTP_4XX,
          isTransient: false, // 4xx errors are generally deterministic/unrecoverable without request modification
          retryEligible: false,
          statusCode,
          errorCode: `HTTP_${statusCode}`,
          message: `Client error HTTP ${statusCode}. Request was rejected by server.`,
          details: { status: statusCode },
        };
      }
    }

    // 4. Response Content / Verification Anomalies
    if (verificationResult && !verificationResult.allPassed) {
      if (verificationResult.status === 'TIMEOUT') {
        return {
          type: FAILURE_TYPES.CONNECTION_TIMEOUT,
          isTransient: true,
          retryEligible: true,
          statusCode: null,
          errorCode: 'ETIMEDOUT',
          message: verificationResult.failureReason,
          details: verificationResult.checks,
        };
      }

      // Check if body was invalid JSON when JSON expected
      if (response && response.isInvalidJson) {
        return {
          type: FAILURE_TYPES.INVALID_RESPONSE,
          isTransient: true,
          retryEligible: true,
          statusCode,
          errorCode: 'INVALID_JSON_PAYLOAD',
          message: 'Received corrupted or unparseable JSON payload from API server.',
          details: { rawData: String(response.rawData || '').substring(0, 200) },
        };
      }

      return {
        type: FAILURE_TYPES.UNEXPECTED_DATA,
        isTransient: false,
        retryEligible: false,
        statusCode,
        errorCode: 'ASSERTION_FAILED',
        message: `Response failed verification: ${verificationResult.failureReason}`,
        details: verificationResult.checks,
      };
    }

    return {
      type: FAILURE_TYPES.UNKNOWN_ERROR,
      isTransient: false,
      retryEligible: false,
      statusCode: null,
      errorCode: 'UNKNOWN',
      message: error ? error.message : 'Unknown execution failure',
      details: {},
    };
  }
}

module.exports = {
  FAILURE_TYPES,
  FailureClassifier,
};


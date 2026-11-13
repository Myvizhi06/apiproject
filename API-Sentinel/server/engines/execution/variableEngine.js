/**
 * API Sentinel - Safe Variable Engine
 * Performs variable extraction and template substitution without eval or code execution.
 * Enforces strict prototype pollution defenses and path traversal validation.
 */

const BLOCKED_PROPERTIES = new Set(['__proto__', 'prototype', 'constructor']);

class VariableEngine {
  /**
   * Safely traverse an object using dot and bracket path notation.
   * Path example: 'body.data.items[0].id' or 'headers["x-auth-token"]'
   */
  static safeGet(source, rawPath) {
    if (!source || typeof source !== 'object' || !rawPath || typeof rawPath !== 'string') {
      return undefined;
    }

    // Normalize brackets: items[0] -> items.0, headers["x"] -> headers.x
    const cleanPath = rawPath
      .replace(/\[\s*['"]?([^'"\]]+)['"]?\s*\]/g, '.$1')
      .trim();

    const parts = cleanPath.split('.').filter(Boolean);
    let current = source;

    for (const part of parts) {
      if (BLOCKED_PROPERTIES.has(part)) {
        return undefined; // Block prototype pollution attempts
      }
      if (current === null || current === undefined || typeof current !== 'object') {
        return undefined;
      }
      if (!(part in current)) {
        return undefined;
      }
      current = current[part];
    }

    return current;
  }

  /**
   * Resolve a template variable expression such as 'steps.Login.body.token'
   * @param {string} expr - Inside {{...}}
   * @param {Object} executionContext - { steps: { StepName: { status, headers, body, extracted } }, variables: {} }
   */
  static resolveExpression(expr, executionContext = {}) {
    const trimmed = expr.trim();

    // Expression format: steps.<StepName>.<rest> or variables.<varName>
    if (trimmed.startsWith('steps.')) {
      const remainder = trimmed.slice(6); // remove 'steps.'
      // Extract step name: either alphanumeric identifier or bracketed
      let stepName = '';
      let propertyPath = '';

      if (remainder.startsWith('[')) {
        const closeIdx = remainder.indexOf(']');
        if (closeIdx === -1) return undefined;
        stepName = remainder.slice(1, closeIdx).replace(/['"]/g, '');
        propertyPath = remainder.slice(closeIdx + 1).replace(/^\./, '');
      } else {
        const dotIdx = remainder.indexOf('.');
        if (dotIdx === -1) {
          stepName = remainder;
          propertyPath = '';
        } else {
          stepName = remainder.slice(0, dotIdx);
          propertyPath = remainder.slice(dotIdx + 1);
        }
      }

      if (BLOCKED_PROPERTIES.has(stepName)) return undefined;

      const stepResult = executionContext.steps ? executionContext.steps[stepName] : undefined;
      if (!stepResult) {
        return undefined;
      }

      if (!propertyPath) {
        return stepResult;
      }

      // Check extracted variables first
      if (stepResult.extracted && propertyPath in stepResult.extracted) {
        return stepResult.extracted[propertyPath];
      }

      // Check body, data, headers, status
      return VariableEngine.safeGet(stepResult, propertyPath);
    }

    if (trimmed.startsWith('variables.')) {
      const varName = trimmed.slice(10);
      if (BLOCKED_PROPERTIES.has(varName)) return undefined;
      return VariableEngine.safeGet(executionContext.variables, varName);
    }

    // Direct fallback lookup in variables
    return VariableEngine.safeGet(executionContext.variables, trimmed);
  }

  /**
   * Interpolate variable expressions in a string: 'Bearer {{steps.Login.body.token}}'
   */
  static interpolateString(str, executionContext = {}) {
    if (typeof str !== 'string') return str;

    const pattern = /\{\{([^{}]+)\}\}/g;
    return str.replace(pattern, (match, expr) => {
      const resolved = VariableEngine.resolveExpression(expr, executionContext);
      if (resolved === undefined || resolved === null) {
        return match; // Keep placeholder if unresolved
      }
      return typeof resolved === 'object' ? JSON.stringify(resolved) : String(resolved);
    });
  }

  /**
   * Recursively substitute variables in any value (string, array, object).
   */
  static substitute(value, executionContext = {}) {
    if (value === null || value === undefined) {
      return value;
    }

    if (typeof value === 'string') {
      // Check if string is EXACTLY a single expression, e.g. "{{steps.Login.body}}"
      const trimmed = value.trim();
      const singleMatch = trimmed.match(/^\{\{([^{}]+)\}\}$/);
      if (singleMatch) {
        const resolved = VariableEngine.resolveExpression(singleMatch[1], executionContext);
        if (resolved !== undefined) {
          return resolved;
        }
      }
      return VariableEngine.interpolateString(value, executionContext);
    }

    if (Array.isArray(value)) {
      return value.map(item => VariableEngine.substitute(item, executionContext));
    }

    if (typeof value === 'object') {
      const result = {};
      for (const [key, val] of Object.entries(value)) {
        if (!BLOCKED_PROPERTIES.has(key)) {
          result[key] = VariableEngine.substitute(val, executionContext);
        }
      }
      return result;
    }

    return value;
  }

  /**
   * Extract specified variables from a step execution result.
   * @param {Object} stepConfig - contains extract: { token: 'body.token', paymentId: 'body.id' }
   * @param {Object} stepResult - { status, headers, body }
   * @returns {Object} extracted variables
   */
  static extractVariables(stepConfig, stepResult) {
    const extracted = {};
    const rules = stepConfig.extract || {};

    for (const [varName, path] of Object.entries(rules)) {
      if (BLOCKED_PROPERTIES.has(varName)) continue;
      // Handle path with or without 'body.' prefix
      let resolved = VariableEngine.safeGet(stepResult, path);
      if (resolved === undefined && !path.startsWith('body.') && !path.startsWith('headers.')) {
        resolved = VariableEngine.safeGet(stepResult.body, path);
      }
      extracted[varName] = resolved;
    }

    return extracted;
  }
}

module.exports = {
  VariableEngine,
  BLOCKED_PROPERTIES,
};


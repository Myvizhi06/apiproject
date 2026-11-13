/**
 * API Sentinel - ASL Semantic Validator
 * Performs AST validation, DAG cycle detection, and variable reference integrity checks.
 */

const { VALID_HTTP_METHODS } = require('./parser');

class SemanticValidationError extends Error {
  constructor(message, errors = []) {
    super(message);
    this.name = 'SemanticValidationError';
    this.errors = errors;
  }
}

function validateAST(ast) {
  const errors = [];
  const warnings = [];

  if (!ast || ast.type !== 'Workflow') {
    errors.push({ message: 'Root node must be a Workflow declaration', line: 1, column: 1 });
    return { valid: false, errors, warnings };
  }

  if (!ast.steps || !Array.isArray(ast.steps) || ast.steps.length === 0) {
    errors.push({
      message: `Workflow '${ast.name}' has no execution steps. Add at least one STEP block.`,
      line: ast.line,
      column: ast.column,
    });
    return { valid: false, errors, warnings };
  }

  const stepMap = new Map();
  const stepOrder = [];

  for (const step of ast.steps) {
    if (stepMap.has(step.name)) {
      errors.push({
        message: `Duplicate step identifier '${step.name}'. Step names must be unique within a workflow.`,
        line: step.line,
        column: step.column,
        step: step.name,
      });
    }
    stepMap.set(step.name, step);
    stepOrder.push(step.name);

    const cfg = step.config || {};

    // Validate Method
    if (!cfg.method) {
      errors.push({
        message: `Step '${step.name}' missing required METHOD declaration.`,
        line: step.line,
        column: step.column,
        step: step.name,
      });
    } else if (!VALID_HTTP_METHODS.includes(cfg.method)) {
      errors.push({
        message: `Step '${step.name}' has invalid HTTP method '${cfg.method}'.`,
        line: step.line,
        column: step.column,
        step: step.name,
      });
    }

    // Validate URL
    if (!cfg.url || typeof cfg.url !== 'string' || cfg.url.trim() === '') {
      errors.push({
        message: `Step '${step.name}' missing required URL string.`,
        line: step.line,
        column: step.column,
        step: step.name,
      });
    }

    // Validate Status Code
    if (cfg.expectedStatus) {
      const code = Number(cfg.expectedStatus);
      if (!Number.isInteger(code) || code < 100 || code > 599) {
        errors.push({
          message: `Step '${step.name}' expectedStatus '${cfg.expectedStatus}' must be an HTTP code (100-599).`,
          line: step.line,
          column: step.column,
          step: step.name,
        });
      }
    }

    // Validate Retries
    if (cfg.retries !== undefined && cfg.retries !== null) {
      const r = Number(cfg.retries);
      if (!Number.isInteger(r) || r < 0 || r > 10) {
        errors.push({
          message: `Step '${step.name}' retries count '${cfg.retries}' must be an integer between 0 and 10.`,
          line: step.line,
          column: step.column,
          step: step.name,
        });
      }
    }

    // Non-idempotent retry warning
    if (['POST', 'PATCH'].includes(cfg.method) && cfg.retries > 0 && !cfg.idempotent) {
      const hasIdempotencyHeader = cfg.headers && (cfg.headers['Idempotency-Key'] || cfg.headers['idempotency-key'] || cfg.headers['X-Idempotency-Key']);
      if (!hasIdempotencyHeader) {
        warnings.push({
          message: `Step '${step.name}' uses ${cfg.method} with RETRY ${cfg.retries} but without IDEMPOTENT true or Idempotency-Key header. At runtime, blind retry will be blocked for safety unless configured.`,
          line: step.line,
          column: step.column,
          step: step.name,
        });
      }
    }
  }

  // Validate Dependencies & DAG
  const adj = new Map();
  for (const stepName of stepOrder) {
    adj.set(stepName, []);
  }

  for (const step of ast.steps) {
    const deps = step.config.dependsOn || [];
    for (const dep of deps) {
      if (!stepMap.has(dep)) {
        errors.push({
          message: `Step '${step.name}' depends on unknown step '${dep}'.`,
          line: step.line,
          column: step.column,
          step: step.name,
        });
      } else if (dep === step.name) {
        errors.push({
          message: `Step '${step.name}' cannot depend on itself.`,
          line: step.line,
          column: step.column,
          step: step.name,
        });
      } else {
        adj.get(step.name).push(dep);
      }
    }
  }

  // Detect Cycle in Dependencies (DFS)
  const visited = new Map(); // 0: unvisited, 1: visiting, 2: visited
  function hasCycle(node, path) {
    visited.set(node, 1);
    path.push(node);

    for (const neighbor of adj.get(node) || []) {
      if (visited.get(neighbor) === 1) {
        return [...path, neighbor];
      }
      if (!visited.get(neighbor)) {
        const cycle = hasCycle(neighbor, path);
        if (cycle) return cycle;
      }
    }

    path.pop();
    visited.set(node, 2);
    return null;
  }

  for (const stepName of stepOrder) {
    if (!visited.get(stepName)) {
      const cycle = hasCycle(stepName, []);
      if (cycle) {
        errors.push({
          message: `Cyclic dependency detected: ${cycle.join(' -> ')}. Workflow dependencies must form a Directed Acyclic Graph (DAG).`,
          line: stepMap.get(stepName).line,
          column: stepMap.get(stepName).column,
        });
        break;
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

module.exports = {
  validateAST,
  SemanticValidationError,
};


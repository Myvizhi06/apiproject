/**
 * API Sentinel - AST <-> Executable Workflow Converter
 * Converts between ASL AST and the standard workflow definition model used by the UI & Engine.
 */

function astToWorkflow(ast) {
  if (!ast || ast.type !== 'Workflow') {
    throw new Error('Invalid AST: root node must be of type Workflow');
  }

  const steps = (ast.steps || []).map((step, index) => {
    const cfg = step.config || {};
    return {
      id: `step_${index + 1}_${step.name.toLowerCase()}`,
      name: step.name,
      order: index + 1,
      method: (cfg.method || 'GET').toUpperCase(),
      url: cfg.url || '',
      headers: cfg.headers || {},
      body: cfg.body || null,
      expectedStatus: cfg.expectedStatus !== undefined ? Number(cfg.expectedStatus) : 200,
      retries: cfg.retries !== undefined ? Number(cfg.retries) : 0,
      timeoutMs: cfg.timeoutMs !== undefined ? Number(cfg.timeoutMs) : 10000,
      idempotent: Boolean(cfg.idempotent),
      extract: cfg.extract || {},
      dependsOn: Array.isArray(cfg.dependsOn) ? cfg.dependsOn : [],
      assertions: [
        {
          type: 'STATUS_CODE',
          operator: 'EQUALS',
          expected: cfg.expectedStatus !== undefined ? Number(cfg.expectedStatus) : 200,
        },
      ],
    };
  });

  return {
    name: ast.name,
    description: `Workflow parsed from ASL specification (${steps.length} steps)`,
    steps,
  };
}

function workflowToAsl(workflow) {
  const name = (workflow.name || 'UntitledWorkflow').replace(/[^a-zA-Z0-9_]/g, '_');
  let asl = `WORKFLOW ${name} {\n`;

  const steps = workflow.steps || [];
  for (const step of steps) {
    const stepName = (step.name || 'Step').replace(/[^a-zA-Z0-9_]/g, '_');
    asl += `  STEP ${stepName} {\n`;
    asl += `    METHOD ${step.method || 'GET'}\n`;
    asl += `    URL "${step.url || '/api'}"\n`;

    if (step.expectedStatus !== undefined && step.expectedStatus !== null) {
      asl += `    EXPECT ${step.expectedStatus}\n`;
    }

    if (step.retries !== undefined && step.retries !== null && step.retries > 0) {
      asl += `    RETRY ${step.retries}\n`;
    }

    if (step.timeoutMs && step.timeoutMs !== 10000) {
      asl += `    TIMEOUT ${step.timeoutMs}\n`;
    }

    if (step.idempotent) {
      asl += `    IDEMPOTENT true\n`;
    }

    if (step.headers && typeof step.headers === 'object') {
      for (const [k, v] of Object.entries(step.headers)) {
        asl += `    HEADER "${k}" "${v}"\n`;
      }
    }

    if (step.body) {
      const bodyStr = typeof step.body === 'object' ? JSON.stringify(step.body) : String(step.body);
      asl += `    BODY "${bodyStr.replace(/"/g, '\\"')}"\n`;
    }

    if (step.extract && typeof step.extract === 'object') {
      for (const [varName, path] of Object.entries(step.extract)) {
        asl += `    EXTRACT ${varName} "${path}"\n`;
      }
    }

    if (Array.isArray(step.dependsOn)) {
      for (const dep of step.dependsOn) {
        asl += `    DEPENDS ${dep}\n`;
      }
    }

    asl += `  }\n\n`;
  }

  asl += `}\n`;
  return asl;
}

module.exports = {
  astToWorkflow,
  workflowToAsl,
};


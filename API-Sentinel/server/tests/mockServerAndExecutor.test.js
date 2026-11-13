const express = require('express');
const http = require('http');
const { createMockRouter } = require('../simulator/mockServer');
const { WorkflowExecutor } = require('../engines/execution/workflowExecutor');
const { FSM_STATES } = require('../engines/fsm/fsmEngine');

describe('Mock API Server & End-to-End Workflow Execution Engine', () => {
  let server;
  let baseUrl;
  let port;

  beforeAll((done) => {
    const app = express();
    app.use(express.json());
    app.use('/api', createMockRouter());

    server = http.createServer(app);
    // Bind to localhost on random available port
    server.listen(0, '127.0.0.1', () => {
      port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      done();
    });
  });

  afterAll((done) => {
    if (server) {
      server.close(done);
    } else {
      done();
    }
  });

  test('executes multi-step e-commerce workflow with variable extraction and passing', async () => {
    const workflow = {
      name: 'E2E Checkout Flow',
      steps: [
        {
          name: 'Login',
          method: 'POST',
          url: `${baseUrl}/api/demo/login`,
          expectedStatus: 200,
          body: { username: 'student_tester' },
          extract: {
            token: 'body.token',
          },
        },
        {
          name: 'FetchProducts',
          method: 'GET',
          url: `${baseUrl}/api/demo/products`,
          expectedStatus: 200,
          headers: {
            Authorization: 'Bearer {{steps.Login.body.token}}',
          },
          dependsOn: ['Login'],
          extract: {
            firstProductId: 'body.products[0].id',
          },
        },
        {
          name: 'MakePayment',
          method: 'POST',
          url: `${baseUrl}/api/demo/payment`,
          expectedStatus: 200,
          headers: {
            'Idempotency-Key': 'idemp_key_998877',
          },
          body: {
            amount: 149.99,
            currency: 'USD',
          },
          extract: {
            paymentId: 'body.paymentId',
          },
        },
        {
          name: 'ConfirmOrder',
          method: 'POST',
          url: `${baseUrl}/api/demo/order`,
          expectedStatus: 200,
          body: {
            productId: '{{steps.FetchProducts.firstProductId}}',
            paymentId: '{{steps.MakePayment.paymentId}}',
            quantity: 1,
          },
          dependsOn: ['MakePayment', 'FetchProducts'],
        },
      ],
    };

    const executor = new WorkflowExecutor(workflow, {
      baseUrl,
      allowedHosts: ['127.0.0.1', `127.0.0.1:${port}`],
    });

    const transitions = [];
    executor.on('fsm_transition', (t) => transitions.push(t));

    const result = await executor.execute();

    expect(result.finalStatus).toBe('COMPLETED');
    expect(result.steps.length).toBe(4);
    expect(result.steps.every(s => s.passed)).toBe(true);

    // Verify FSM transition trajectory
    const statePath = transitions.map(t => `${t.from}->${t.to}`);
    expect(statePath).toContain('IDLE->VALIDATING');
    expect(statePath).toContain('VALIDATING->RUNNING');
    expect(statePath).toContain('SUCCESS->COMPLETED');
  });

  test('successfully recovers from transient flaky 500 error using RETRY', async () => {
    // Set simulator to flaky_500: fails 2 times then recovers
    await fetch(`${baseUrl}/api/simulator/control`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario: 'flaky_500', flakyFailureCount: 2 }),
    });

    const workflow = {
      name: 'Flaky Recovery Test Flow',
      steps: [
        {
          name: 'FlakyCall',
          method: 'GET',
          url: `${baseUrl}/api/demo/products`,
          expectedStatus: 200,
          retries: 3, // Enough to recover after 2 failures
          headers: {
            Authorization: 'Bearer mock_token',
          },
        },
      ],
    };

    const executor = new WorkflowExecutor(workflow, {
      baseUrl,
      allowedHosts: ['127.0.0.1', `127.0.0.1:${port}`],
    });

    const transitions = [];
    executor.on('fsm_transition', (t) => transitions.push(t));

    const result = await executor.execute();

    expect(result.finalStatus).toBe('COMPLETED');
    expect(result.steps[0].passed).toBe(true);
    expect(result.steps[0].attempts).toBe(2); // Retried twice before succeeding on 3rd call

    // Verify FSM visited FAILED and RETRYING states during recovery
    const statesVisited = new Set(transitions.map(t => t.to));
    expect(statesVisited.has(FSM_STATES.FAILED)).toBe(true);
    expect(statesVisited.has(FSM_STATES.RETRYING)).toBe(true);
    expect(statesVisited.has(FSM_STATES.SUCCESS)).toBe(true);
    expect(statesVisited.has(FSM_STATES.COMPLETED)).toBe(true);

    // Reset simulator
    await fetch(`${baseUrl}/api/simulator/reset`, { method: 'POST' });
  });

  test('terminates with failure when retry attempts are exhausted', async () => {
    // Set simulator to permanent_500
    await fetch(`${baseUrl}/api/simulator/control`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario: 'permanent_500' }),
    });

    const workflow = {
      name: 'Exhaustion Test Flow',
      steps: [
        {
          name: 'PermanentFailStep',
          method: 'GET',
          url: `${baseUrl}/api/demo/products`,
          expectedStatus: 200,
          retries: 2,
        },
      ],
    };

    const executor = new WorkflowExecutor(workflow, {
      baseUrl,
      allowedHosts: ['127.0.0.1', `127.0.0.1:${port}`],
    });

    const result = await executor.execute();
    expect(result.finalStatus).toBe('FAILED');
    expect(result.steps[0].passed).toBe(false);
    expect(result.failureLogs.length).toBeGreaterThanOrEqual(1);

    // Reset simulator
    await fetch(`${baseUrl}/api/simulator/reset`, { method: 'POST' });
  });
});


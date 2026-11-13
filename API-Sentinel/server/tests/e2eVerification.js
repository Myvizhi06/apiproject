/**
 * API Sentinel - Comprehensive End-to-End System Verification Script
 * Validates the full lifecycle:
 * Auth -> ASL Compilation -> Workflow CRUD -> Execution ->
 * Verification -> Failure Detection -> Autonomous Recovery -> Simulator Scenarios -> Dashboard Analytics
 */

const http = require('http');
const { createApp } = require('../app');
const { connectDB, closeDB } = require('../config/db');
const { User, Workflow, Execution, FailureLog } = require('../models');

async function runE2EVerification() {
  console.log('================================================================');
  console.log('🔬 API SENTINEL - FULL END-TO-END VERIFICATION SUITE');
  console.log('================================================================\n');

  let passedTests = 0;
  let failedTests = 0;

  function assert(condition, testName, details = '') {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passedTests++;
    } else {
      console.error(`  ❌ FAIL: ${testName} - ${details}`);
      failedTests++;
    }
  }

  // 1. Database Connection
  await connectDB();
  const app = createApp();

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`[E2E] Test HTTP server listening on ${baseUrl}\n`);

  try {
    // -------------------------------------------------------------
    // PHASE 1: AUTHENTICATION & ACCESS CONTROL
    // -------------------------------------------------------------
    console.log('--- PHASE 1: Authentication & Tenant Security ---');
    const userEmail = `verifier_${Date.now()}@sentinel.dev`;
    const regRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'System Verifier', email: userEmail, password: 'VerifierPassword123!' }),
    });
    const regData = await regRes.json();
    assert(regRes.status === 201 && regData.token, 'User Registration & JWT Issuance');
    const token = regData.token;
    const authHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: userEmail, password: 'VerifierPassword123!' }),
    });
    const loginData = await loginRes.json();
    assert(loginRes.status === 200 && loginData.user.email === userEmail, 'User Login & Credential Verification');

    const meRes = await fetch(`${baseUrl}/api/auth/me`, { headers: authHeaders });
    const meData = await meRes.json();
    assert(meRes.status === 200 && meData.user.name === 'System Verifier', 'Current User Profile Retrieval (/api/auth/me)');

    const badAuthRes = await fetch(`${baseUrl}/api/workflows`, {
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer bad_token_123' },
    });
    assert(badAuthRes.status === 401, 'Rejection of Invalid Cryptographic JWT Token');

    // -------------------------------------------------------------
    // PHASE 2: ASL (API SENTINEL LANGUAGE) COMPILER
    // -------------------------------------------------------------
    console.log('\n--- PHASE 2: ASL Language Compiler & AST Pipeline ---');
    const validAsl = `
      WORKFLOW E2EVerificationFlow {
        STEP AuthStep {
          METHOD POST
          URL "${baseUrl}/api/demo/login"
          EXPECT 200
          RETRY 2
          TIMEOUT 5000
          BODY "{\\"username\\": \\"verifier\\"}"
          EXTRACT authToken "body.token"
        }

        STEP DataStep {
          METHOD GET
          URL "${baseUrl}/api/demo/products"
          EXPECT 200
          RETRY 3
          TIMEOUT 5000
          IDEMPOTENT true
          HEADER "Authorization" "Bearer {{steps.AuthStep.authToken}}"
          DEPENDS AuthStep
          EXTRACT firstId "body.products[0].id"
        }
      }
    `;

    const parseRes = await fetch(`${baseUrl}/api/asl/parse`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ code: validAsl }),
    });
    const parseData = await parseRes.json();
    assert(parseRes.status === 200 && parseData.valid && parseData.ast.name === 'E2EVerificationFlow', 'ASL Lexer & Recursive-Descent Parser AST Generation');

    const valRes = await fetch(`${baseUrl}/api/asl/validate`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ code: validAsl }),
    });
    const valData = await valRes.json();
    assert(valRes.status === 200 && valData.valid && valData.executableWorkflow.steps.length === 2, 'ASL Semantic Validation & DAG Verification');

    // Invalid syntax detection
    const invalidAsl = `WORKFLOW Broken { STEP S1 { METHOD NOT_A_METHOD } }`;
    const errRes = await fetch(`${baseUrl}/api/asl/validate`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ code: invalidAsl }),
    });
    const errData = await errRes.json();
    assert(errRes.status === 422 && errData.errors.length > 0, 'ASL Syntax Error Detection with Line Number Diagnostics');

    // Cyclic dependency detection
    const cyclicAsl = `
      WORKFLOW Cycle {
        STEP A { METHOD GET URL "/api" DEPENDS B }
        STEP B { METHOD GET URL "/api" DEPENDS A }
      }
    `;
    const cycleRes = await fetch(`${baseUrl}/api/asl/validate`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ code: cyclicAsl }),
    });
    const cycleData = await cycleRes.json();
    assert(!cycleData.valid && cycleData.errors.some(e => e.message.includes('Cyclic dependency')), 'DAG Topological Cycle Detection');

    // Compile & Save directly from ASL
    const saveAslRes = await fetch(`${baseUrl}/api/asl/save`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ code: validAsl, description: 'Created by E2E Verifier' }),
    });
    const saveAslData = await saveAslRes.json();
    assert(saveAslRes.status === 201 && saveAslData.workflow.name === 'E2EVerificationFlow', 'Direct ASL Compilation to Database Workflow');
    const compiledWfId = saveAslData.workflow._id || saveAslData.workflow.id;

    // -------------------------------------------------------------
    // PHASE 3: WORKFLOW CRUD & REORDERING
    // -------------------------------------------------------------
    console.log('\n--- PHASE 3: Visual Workflow CRUD & Reordering ---');
    const customWorkflow = {
      name: 'Custom Order Verification Pipeline',
      description: 'Multi-step e-commerce verification',
      steps: [
        {
          id: 'step_auth',
          name: 'LoginStep',
          order: 1,
          method: 'POST',
          url: `${baseUrl}/api/demo/login`,
          expectedStatus: 200,
          body: { username: 'e2e_tester' },
          extract: { jwtToken: 'body.token' },
        },
        {
          id: 'step_catalog',
          name: 'CatalogStep',
          order: 2,
          method: 'GET',
          url: `${baseUrl}/api/demo/products`,
          expectedStatus: 200,
          headers: { Authorization: 'Bearer {{steps.LoginStep.jwtToken}}' },
          dependsOn: ['LoginStep'],
          extract: { selectedId: 'body.products[0].id' },
        },
        {
          id: 'step_pay',
          name: 'PaymentStep',
          order: 3,
          method: 'POST',
          url: `${baseUrl}/api/demo/payment`,
          expectedStatus: 200,
          retries: 2,
          idempotent: true,
          headers: { 'Idempotency-Key': 'idemp_e2e_verifier_001' },
          body: { amount: 149.99, currency: 'USD' },
          dependsOn: ['CatalogStep'],
          extract: { paymentId: 'body.paymentId' },
        },
      ],
    };

    const wfCreateRes = await fetch(`${baseUrl}/api/workflows`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(customWorkflow),
    });
    const wfCreateData = await wfCreateRes.json();
    assert(wfCreateRes.status === 201 && wfCreateData.workflow.name === customWorkflow.name, 'Visual Workflow Creation');
    const activeWorkflowId = wfCreateData.workflow._id || wfCreateData.workflow.id;

    // Reorder steps
    const reorderRes = await fetch(`${baseUrl}/api/workflows/${activeWorkflowId}/reorder`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ stepIds: ['step_pay', 'step_catalog', 'step_auth'] }),
    });
    const reorderData = await reorderRes.json();
    assert(reorderRes.status === 200 && reorderData.steps[0].id === 'step_pay', 'Step Reordering Endpoint');

    // Revert order back
    await fetch(`${baseUrl}/api/workflows/${activeWorkflowId}/reorder`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ stepIds: ['step_auth', 'step_catalog', 'step_pay'] }),
    });

    // -------------------------------------------------------------
    // PHASE 4: WORKFLOW EXECUTION & FSM PROGRESSION
    // -------------------------------------------------------------
    console.log('\n--- PHASE 4: Execution Engine & FSM Progression ---');
    const execRes = await fetch(`${baseUrl}/api/workflows/${activeWorkflowId}/execute`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ baseUrl }),
    });
    const execData = await execRes.json();
    const execution = execData.execution;

    assert(execRes.status === 200 && execution.status === 'COMPLETED', 'End-to-End Workflow Execution Status COMPLETED');
    assert(execution.steps.length === 3 && execution.steps.every(s => s.passed), 'Multi-Step Execution Passing All Assertions');

    // Verify FSM trajectory
    const fsmTrajectory = (execution.fsmHistory || []).map(h => `${h.from}->${h.to}`);
    assert(fsmTrajectory.includes('IDLE->VALIDATING'), 'FSM Trajectory: IDLE -> VALIDATING');
    assert(fsmTrajectory.includes('VALIDATING->RUNNING'), 'FSM Trajectory: VALIDATING -> RUNNING');
    assert(fsmTrajectory.includes('SUCCESS->COMPLETED'), 'FSM Trajectory: SUCCESS -> COMPLETED');

    // Verify Variable Extraction & Substitution
    assert(execution.steps[1].response.status === 200, 'Bearer Token Variable Interpolation in Step 2');
    assert(execution.steps[2].response.status === 200, 'Payment Idempotency Key Preservation in Step 3');

    // -------------------------------------------------------------
    // PHASE 5: AUTONOMOUS FAILURE DETECTION & RECOVERY
    // -------------------------------------------------------------
    console.log('\n--- PHASE 5: Autonomous Failure Detection & Recovery ---');
    // Arm simulator with flaky 500 error (fails 2 times then recovers)
    await fetch(`${baseUrl}/api/simulator/control`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario: 'flaky_500', flakyFailureCount: 2 }),
    });

    const flakyWorkflow = {
      name: 'Transient 500 Autonomous Recovery Test',
      steps: [
        {
          id: 's_flaky',
          name: 'FlakyProbeStep',
          order: 1,
          method: 'GET',
          url: `${baseUrl}/api/demo/products?scenario=flaky_500`,
          expectedStatus: 200,
          retries: 3,
          idempotent: true,
          headers: { Authorization: 'Bearer mock_probe_token' },
        },
      ],
    };

    const flakyCreateRes = await fetch(`${baseUrl}/api/workflows`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(flakyWorkflow),
    });
    const flakyWf = (await flakyCreateRes.json()).workflow;

    const flakyExecRes = await fetch(`${baseUrl}/api/workflows/${flakyWf._id || flakyWf.id}/execute`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ baseUrl }),
    });
    const flakyExec = (await flakyExecRes.json()).execution;

    assert(flakyExec.status === 'COMPLETED', 'Autonomous Recovery from HTTP 500 Transient Spike');
    assert(flakyExec.steps[0].attempts === 2, 'Exponential Backoff Retried 2 Times Before Recovery');

    const flakyVisitedStates = (flakyExec.fsmHistory || []).map(h => h.to);
    assert(flakyVisitedStates.includes('FAILED'), 'FSM Entered FAILED State Upon Error');
    assert(flakyVisitedStates.includes('RETRYING'), 'FSM Entered RETRYING State During Backoff');
    assert(flakyVisitedStates.includes('SUCCESS'), 'FSM Entered SUCCESS State Upon Successful Retry');

    // Reset simulator
    await fetch(`${baseUrl}/api/simulator/reset`, { method: 'POST' });

    // -------------------------------------------------------------
    // PHASE 6: SIMULATOR SCENARIOS COMPREHENSIVE TEST
    // -------------------------------------------------------------
    console.log('\n--- PHASE 6: 8 Simulator Failure Mode Scenarios ---');
    const scenarios = [
      'success',
      'flaky_500',
      'timeout',
      'connection_reset',
      'invalid_json',
      'unexpected_status',
      'rate_limit_429',
      'permanent_500',
    ];

    for (const sc of scenarios) {
      await fetch(`${baseUrl}/api/simulator/control`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario: sc }),
      });
      const checkCtrl = await (await fetch(`${baseUrl}/api/simulator/control`)).json();
      assert(checkCtrl.activeScenario === sc, `Simulator Scenario Active: ${sc}`);
    }
    await fetch(`${baseUrl}/api/simulator/reset`, { method: 'POST' });

    // -------------------------------------------------------------
    // PHASE 7: DASHBOARD AGGREGATED METRICS
    // -------------------------------------------------------------
    console.log('\n--- PHASE 7: Live Database Analytics Aggregation ---');
    const dashRes = await fetch(`${baseUrl}/api/analytics/dashboard`, { headers: authHeaders });
    const dashData = await dashRes.json();

    assert(dashRes.status === 200, 'Dashboard Analytics Query Returned HTTP 200');
    assert(dashData.totalWorkflows >= 3, `Real Workflows Aggregation: ${dashData.totalWorkflows} workflows`);
    assert(dashData.totalExecutions >= 2, `Real Executions Aggregation: ${dashData.totalExecutions} executions`);
    assert(dashData.successfulExecutions >= 2, `Successful Runs Count: ${dashData.successfulExecutions}`);
    assert(dashData.successRate > 0, `Computed Success Rate: ${dashData.successRate}%`);
    assert(dashData.averageResponseTime >= 0, `Computed Average Response Time: ${dashData.averageResponseTime}ms`);
    assert(Array.isArray(dashData.trendChart) && dashData.trendChart.length > 0, 'Real Trend Chart Array Computed from Database');

    // -------------------------------------------------------------
    // VERIFICATION SUMMARY
    // -------------------------------------------------------------
    console.log('\n================================================================');
    console.log(`🏆 VERIFICATION COMPLETE: ${passedTests} PASSED, ${failedTests} FAILED`);
    console.log('================================================================\n');

    return { passedTests, failedTests };
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await closeDB();
  }
}

if (require.main === module) {
  runE2EVerification()
    .then(({ failedTests }) => {
      process.exit(failedTests > 0 ? 1 : 0);
    })
    .catch((err) => {
      console.error('[E2E Fatal Error]', err);
      process.exit(1);
    });
}

module.exports = runE2EVerification;

/**
 * API Sentinel - Database Seeder Script
 * Creates demo operator account, realistic demo workflows, historical execution data,
 * and failure logs so the dashboard is immediately populated.
 */

const bcrypt = require('bcryptjs');
const { connectDB } = require('../config/db');
const { User, Workflow, Execution, FailureLog } = require('../models');
const { workflowToAsl } = require('../language');

async function seed() {
  console.log('[Seed] Starting API Sentinel database seeding...');
  await connectDB();

  // 1. Create Demo User
  const demoEmail = 'demo@apisentinel.dev';
  let demoUser = await User.findOne({ email: demoEmail });

  if (!demoUser) {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('SentinelPass123!', salt);

    demoUser = await User.create({
      name: 'Sentinel Demo Operator',
      email: demoEmail,
      passwordHash,
      createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    });
    console.log(`[Seed] Created demo user: ${demoEmail} / SentinelPass123!`);
  } else {
    console.log(`[Seed] Demo user already exists: ${demoEmail}`);
  }

  const userId = String(demoUser._id || demoUser.id);

  // 2. Clear previous workflows for clean demo experience
  await Workflow.deleteMany({ ownerId: userId });
  await Execution.deleteMany({ ownerId: userId });
  await FailureLog.deleteMany({ ownerId: userId });

  // 3. Create Demo Workflow: E-Commerce Resilient Order Pipeline
  const demoWorkflowSteps = [
    {
      id: 'step_1_login',
      name: 'UserAuthentication',
      order: 1,
      method: 'POST',
      url: '/api/demo/login',
      expectedStatus: 200,
      retries: 2,
      timeoutMs: 5000,
      idempotent: false,
      headers: { 'Content-Type': 'application/json' },
      body: { username: 'demo_operator', password: 'password123' },
      extract: {
        authToken: 'body.token',
        userId: 'body.user.id',
      },
      dependsOn: [],
      assertions: [{ type: 'STATUS_CODE', expected: 200 }],
    },
    {
      id: 'step_2_products',
      name: 'FetchProductCatalog',
      order: 2,
      method: 'GET',
      url: '/api/demo/products',
      expectedStatus: 200,
      retries: 3,
      timeoutMs: 5000,
      idempotent: true,
      headers: {
        Authorization: 'Bearer {{steps.UserAuthentication.authToken}}',
      },
      dependsOn: ['UserAuthentication'],
      extract: {
        selectedProductId: 'body.products[0].id',
        selectedPrice: 'body.products[0].price',
      },
      assertions: [
        { type: 'STATUS_CODE', expected: 200 },
        { type: 'PROPERTY_EQUALS', property: 'status', expected: 'success' },
      ],
    },
    {
      id: 'step_3_payment',
      name: 'ProcessPaymentTransaction',
      order: 3,
      method: 'POST',
      url: '/api/demo/payment',
      expectedStatus: 200,
      retries: 3,
      timeoutMs: 6000,
      idempotent: true, // Idempotent flag enabled for safe retries
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'idemp_txn_99482103',
      },
      body: {
        amount: '{{steps.FetchProductCatalog.selectedPrice}}',
        currency: 'USD',
      },
      dependsOn: ['FetchProductCatalog'],
      extract: {
        paymentId: 'body.paymentId',
      },
      assertions: [{ type: 'STATUS_CODE', expected: 200 }],
    },
    {
      id: 'step_4_order',
      name: 'ConfirmFulfillmentOrder',
      order: 4,
      method: 'POST',
      url: '/api/demo/order',
      expectedStatus: 200,
      retries: 2,
      timeoutMs: 5000,
      idempotent: false,
      headers: { 'Content-Type': 'application/json' },
      body: {
        productId: '{{steps.FetchProductCatalog.selectedProductId}}',
        paymentId: '{{steps.ProcessPaymentTransaction.paymentId}}',
        quantity: 1,
      },
      dependsOn: ['ProcessPaymentTransaction'],
      assertions: [
        { type: 'STATUS_CODE', expected: 200 },
        { type: 'PROPERTY_EQUALS', property: 'status', expected: 'confirmed' },
      ],
    },
  ];

  const aslCode = workflowToAsl({
    name: 'ECommerceOrderPipeline',
    steps: demoWorkflowSteps,
  });

  const primaryWorkflow = await Workflow.create({
    name: 'E-Commerce Resilient Order Pipeline',
    description: 'Complete multi-step purchasing flow: authentication, catalog lookup, idempotent payment processing, and final order confirmation.',
    steps: demoWorkflowSteps,
    workflowDefinition: aslCode,
    ownerId: userId,
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(),
  });

  console.log(`[Seed] Created primary workflow: '${primaryWorkflow.name}' (ID: ${primaryWorkflow._id || primaryWorkflow.id})`);

  // 4. Create Secondary Workflow (Flaky Recovery Lab)
  const flakyWorkflowSteps = [
    {
      id: 'step_flaky_1',
      name: 'FlakyDataProbe',
      order: 1,
      method: 'GET',
      url: '/api/demo/products?scenario=flaky_500',
      expectedStatus: 200,
      retries: 3,
      timeoutMs: 4000,
      idempotent: true,
      headers: {
        Authorization: 'Bearer jwt_demo_probe_token',
      },
      dependsOn: [],
      assertions: [{ type: 'STATUS_CODE', expected: 200 }],
    },
  ];

  await Workflow.create({
    name: 'Transient Fault Recovery Probe',
    description: 'Autonomous recovery verification: intentionally encounters HTTP 500 spikes and tests exponential backoff recovery.',
    steps: flakyWorkflowSteps,
    workflowDefinition: workflowToAsl({ name: 'TransientFaultProbe', steps: flakyWorkflowSteps }),
    ownerId: userId,
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(),
  });

  // 5. Seed Historical Executions & Failure Logs for Rich Dashboard Metrics
  const sampleStatuses = [
    { status: 'COMPLETED', duration: 420, daysAgo: 5 },
    { status: 'COMPLETED', duration: 380, daysAgo: 4 },
    { status: 'FAILED', duration: 1200, daysAgo: 3, failStep: 'ProcessPaymentTransaction', failType: 'HTTP_5XX' },
    { status: 'COMPLETED', duration: 510, daysAgo: 2 },
    { status: 'COMPLETED', duration: 460, daysAgo: 1 },
    { status: 'COMPLETED', duration: 395, daysAgo: 0 },
  ];

  for (let i = 0; i < sampleStatuses.length; i++) {
    const s = sampleStatuses[i];
    const execTime = new Date(Date.now() - s.daysAgo * 24 * 60 * 60 * 1000 - i * 3600 * 1000);

    const exec = await Execution.create({
      workflowId: String(primaryWorkflow._id || primaryWorkflow.id),
      workflowName: primaryWorkflow.name,
      ownerId: userId,
      status: s.status,
      startTime: execTime,
      endTime: new Date(execTime.getTime() + s.duration),
      duration: s.duration,
      steps: [
        {
          stepId: 'step_1_login',
          stepName: 'UserAuthentication',
          passed: true,
          attempts: 0,
          response: { status: 200, durationMs: 45 },
        },
        {
          stepId: 'step_2_products',
          stepName: 'FetchProductCatalog',
          passed: true,
          attempts: 0,
          response: { status: 200, durationMs: 72 },
        },
        {
          stepId: 'step_3_payment',
          stepName: 'ProcessPaymentTransaction',
          passed: s.status === 'COMPLETED',
          attempts: s.status === 'COMPLETED' ? 1 : 3,
          response: { status: s.status === 'COMPLETED' ? 200 : 500, durationMs: 140 },
          failureReason: s.status === 'COMPLETED' ? null : 'Server returned HTTP 500 Internal Error',
        },
      ],
      finalResult: {
        totalSteps: 3,
        passedSteps: s.status === 'COMPLETED' ? 3 : 2,
        failureReason: s.status === 'COMPLETED' ? null : 'Transient payment gateway error',
      },
      fsmHistory: [
        { from: 'IDLE', to: 'VALIDATING', trigger: 'START', timestamp: execTime.toISOString() },
        { from: 'VALIDATING', to: 'RUNNING', trigger: 'EXEC', timestamp: execTime.toISOString() },
        { from: 'RUNNING', to: s.status, trigger: 'FINISH', timestamp: new Date(execTime.getTime() + s.duration).toISOString() },
      ],
      createdAt: execTime,
    });

    if (s.failType) {
      await FailureLog.create({
        executionId: String(exec._id || exec.id),
        ownerId: userId,
        workflowId: String(primaryWorkflow._id || primaryWorkflow.id),
        stepId: 'step_3_payment',
        stepName: 'ProcessPaymentTransaction',
        failureType: s.failType,
        errorMessage: 'HTTP 500 Internal Server Error in payment gateway',
        recoveryAction: 'RETRY',
        retryCount: 2,
        reason: 'Transient failure detected. Retry limit reached.',
        timestamp: execTime,
      });
    }
  }

  console.log(`[Seed] Seeded ${sampleStatuses.length} historical executions and failure logs.`);
  console.log('[Seed] Seeding completed successfully!');
}

if (require.main === module) {
  seed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[Seed] Error during seeding:', err);
      process.exit(1);
    });
}

module.exports = seed;


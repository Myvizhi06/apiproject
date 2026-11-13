const request = require('supertest');
const { createApp } = require('../app');
const { connectDB, closeDB } = require('../config/db');
const { User, Workflow, Execution, FailureLog } = require('../models');

describe('Backend Integration & Supertest API Tests', () => {
  let app;
  let server;
  let testBaseUrl;
  let userAToken;
  let userAId;
  let userBToken;
  let userBId;
  let workflowAId;

  beforeAll(async () => {
    await connectDB();
    app = createApp();
    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const port = server.address().port;
        testBaseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });

    // Clean up test collections
    await User.deleteMany({});
    await Workflow.deleteMany({});
    await Execution.deleteMany({});
    await FailureLog.deleteMany({});

    // Register User A
    const resA = await request(app)
      .post('/api/auth/register')
      .send({ name: 'User Alpha', email: 'alpha@test.com', password: 'password123' });
    userAToken = resA.body.token;
    userAId = resA.body.user.id;

    // Register User B
    const resB = await request(app)
      .post('/api/auth/register')
      .send({ name: 'User Beta', email: 'beta@test.com', password: 'password123' });
    userBToken = resB.body.token;
    userBId = resB.body.user.id;
  });

  afterAll(async () => {
    if (server) {
      await new Promise(r => server.close(r));
    }
    await closeDB();
  });

  describe('Authentication & Profile', () => {
    test('logs in registered user successfully', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'alpha@test.com', password: 'password123' });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.email).toBe('alpha@test.com');
    });

    test('rejects login with invalid password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'alpha@test.com', password: 'wrongpassword' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Unauthorized');
    });

    test('fetches current user profile via /api/auth/me', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${userAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe('alpha@test.com');
    });

    test('rejects unauthenticated requests to protected routes', async () => {
      const res = await request(app).get('/api/workflows');
      expect(res.status).toBe(401);
    });
  });

  describe('Workflow CRUD & Tenant Ownership Isolation', () => {
    test('User A creates a new workflow', async () => {
      const res = await request(app)
        .post('/api/workflows')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          name: 'Alpha Workflow 1',
          description: 'Created by User A',
          steps: [
            {
              id: 's1',
              name: 'StepOne',
              order: 1,
              method: 'POST',
              url: '/api/demo/login',
              expectedStatus: 200,
              body: { username: 'test_user' },
              extract: { token: 'body.token' },
            },
            {
              id: 's2',
              name: 'StepTwo',
              order: 2,
              method: 'GET',
              url: '/api/demo/products',
              expectedStatus: 200,
              headers: { Authorization: 'Bearer {{steps.StepOne.token}}' },
              dependsOn: ['StepOne'],
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.workflow.name).toBe('Alpha Workflow 1');
      workflowAId = res.body.workflow._id || res.body.workflow.id;
    });

    test('User A can list their workflows', async () => {
      const res = await request(app)
        .get('/api/workflows')
        .set('Authorization', `Bearer ${userAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.workflows.length).toBe(1);
      expect(res.body.workflows[0].name).toBe('Alpha Workflow 1');
    });

    test('User B CANNOT access User A workflow (Forbidden 403)', async () => {
      const res = await request(app)
        .get(`/api/workflows/${workflowAId}`)
        .set('Authorization', `Bearer ${userBToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Forbidden');
    });

    test('User B CANNOT update User A workflow', async () => {
      const res = await request(app)
        .put(`/api/workflows/${workflowAId}`)
        .set('Authorization', `Bearer ${userBToken}`)
        .send({ name: 'Hacked by User B' });

      expect(res.status).toBe(403);
    });

    test('User B CANNOT delete User A workflow', async () => {
      const res = await request(app)
        .delete(`/api/workflows/${workflowAId}`)
        .set('Authorization', `Bearer ${userBToken}`);

      expect(res.status).toBe(403);
    });

    test('User A reorders steps in their workflow', async () => {
      const res = await request(app)
        .post(`/api/workflows/${workflowAId}/reorder`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ stepIds: ['s2', 's1'] });

      expect(res.status).toBe(200);
      expect(res.body.steps[0].id).toBe('s2');
      expect(res.body.steps[1].id).toBe('s1');

      // Revert order back for execution test
      await request(app)
        .post(`/api/workflows/${workflowAId}/reorder`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ stepIds: ['s1', 's2'] });
    });
  });

  describe('Workflow Execution End-to-End', () => {
    test('User A executes their workflow against local mock server', async () => {
      const res = await request(app)
        .post(`/api/workflows/${workflowAId}/execute`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ baseUrl: testBaseUrl });

      expect(res.status).toBe(200);
      expect(res.body.execution.status).toBe('COMPLETED');
      expect(res.body.execution.steps.length).toBe(2);
      expect(res.body.execution.steps.every(s => s.passed)).toBe(true);
    });

    test('User B CANNOT execute User A workflow', async () => {
      const res = await request(app)
        .post(`/api/workflows/${workflowAId}/execute`)
        .set('Authorization', `Bearer ${userBToken}`)
        .send({});

      expect(res.status).toBe(403);
    });

    test('User A retrieves execution history', async () => {
      const res = await request(app)
        .get('/api/executions')
        .set('Authorization', `Bearer ${userAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.executions.length).toBeGreaterThanOrEqual(1);
      expect(res.body.executions[0].status).toBe('COMPLETED');
    });
  });

  describe('ASL API Endpoints', () => {
    test('validates valid ASL code', async () => {
      const asl = `
        WORKFLOW AslApiTest {
          STEP Login {
            METHOD POST
            URL "/api/demo/login"
            EXPECT 200
          }
        }
      `;

      const res = await request(app)
        .post('/api/asl/validate')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ code: asl });

      expect(res.status).toBe(200);
      expect(res.body.valid).toBe(true);
      expect(res.body.ast.name).toBe('AslApiTest');
    });

    test('catches invalid syntax in ASL code', async () => {
      const invalidAsl = `WORKFLOW Broken { STEP S1 { METHOD INVALID_VERB } }`;

      const res = await request(app)
        .post('/api/asl/validate')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ code: invalidAsl });

      expect(res.status).toBe(422);
      expect(res.body.valid).toBe(false);
      expect(res.body.errors.length).toBeGreaterThan(0);
    });

    test('saves workflow directly from ASL code via /api/asl/save', async () => {
      const asl = `
        WORKFLOW SavedFromAsl {
          STEP Ping {
            METHOD GET
            URL "/api/demo/products"
            EXPECT 200
            HEADER "Authorization" "Bearer mock_token"
          }
        }
      `;

      const res = await request(app)
        .post('/api/asl/save')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ code: asl, description: 'Compiled directly' });

      expect(res.status).toBe(201);
      expect(res.body.workflow.name).toBe('SavedFromAsl');
      expect(res.body.workflow.steps.length).toBe(1);
    });
  });

  describe('Dashboard Analytics Aggregation', () => {
    test('computes real database aggregations for current user', async () => {
      const res = await request(app)
        .get('/api/analytics/dashboard')
        .set('Authorization', `Bearer ${userAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.totalWorkflows).toBe(2); // Alpha Workflow 1 + SavedFromAsl
      expect(res.body.totalExecutions).toBe(1);
      expect(res.body.successfulExecutions).toBe(1);
      expect(res.body.successRate).toBe(100);
      expect(res.body.averageResponseTime).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(res.body.trendChart)).toBe(true);
      expect(Array.isArray(res.body.recentExecutions)).toBe(true);
    });
  });
});

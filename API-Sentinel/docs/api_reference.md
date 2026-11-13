# API Sentinel REST API Specification

All API endpoints are prefixed with `/api`. Protected routes require the header:
`Authorization: Bearer <jwt_token>`

---

## 1. Authentication Endpoints

### `POST /api/auth/register`
Create a new tenant account.
- **Request Body**: `{ "name": "string", "email": "string", "password": "string (min 6 chars)" }`
- **Response (201)**: `{ "message": "string", "user": { "id", "name", "email" }, "token": "string" }`

### `POST /api/auth/login`
Authenticate existing tenant.
- **Request Body**: `{ "email": "string", "password": "string" }`
- **Response (200)**: `{ "message": "string", "user": { "id", "name", "email" }, "token": "string" }`

### `GET /api/auth/me`
Retrieve currently authenticated operator profile.
- **Response (200)**: `{ "user": { "id", "name", "email" } }`

---

## 2. Workflow Management

### `GET /api/workflows`
List workflows owned by current user.
- **Response (200)**: `{ "count": number, "workflows": [...] }`

### `POST /api/workflows`
Create a new workflow.
- **Request Body**: `{ "name": "string", "description": "string", "steps": [...] }`
- **Response (201)**: `{ "message": "string", "workflow": {...} }`

### `GET /api/workflows/:id`
Fetch single workflow.
- **Response (200)**: `{ "workflow": {...} }`
- **Errors**: 403 Forbidden (not owner), 404 Not Found

### `PUT /api/workflows/:id`
Update an existing workflow.
- **Request Body**: `{ "name": "string", "description": "string", "steps": [...] }`
- **Response (200)**: `{ "message": "string", "workflow": {...} }`

### `DELETE /api/workflows/:id`
Delete an existing workflow.
- **Response (200)**: `{ "message": "string", "id": "string" }`

### `POST /api/workflows/:id/reorder`
Reorder execution steps.
- **Request Body**: `{ "stepIds": ["step_id_2", "step_id_1"] }`
- **Response (200)**: `{ "message": "string", "steps": [...] }`

### `POST /api/workflows/:id/execute`
Execute workflow end-to-end. Streams live telemetry to Socket.IO room `user_<id>`.
- **Request Body**: `{ "baseUrl": "http://127.0.0.1:5000" }`
- **Response (200)**: `{ "message": "string", "execution": {...} }`

---

## 3. ASL Language Compiler Endpoints

### `POST /api/asl/parse`
Tokenizes and parses raw ASL code into an Abstract Syntax Tree (AST).
- **Request Body**: `{ "code": "WORKFLOW Demo { STEP S1 { METHOD GET URL \"/api\" } }" }`
- **Response (200)**: `{ "valid": true, "ast": {...}, "tokenCount": number }`
- **Errors**: 422 Unprocessable Entity (syntax error with line and column)

### `POST /api/asl/validate`
Performs full syntax parsing, AST construction, and semantic validation.
- **Request Body**: `{ "code": "string" }`
- **Response (200/422)**: `{ "valid": boolean, "ast": {...}, "errors": [...], "warnings": [...], "executableWorkflow": {...} }`

### `POST /api/asl/convert`
Bidirectionally transforms AST to workflow JSON, or workflow JSON to ASL.
- **Request Body**: `{ "ast": {...} }` OR `{ "workflow": {...} }`
- **Response (200)**: `{ "workflow": {...} }` OR `{ "asl": "string" }`

### `POST /api/asl/save`
Compiles ASL code and persists it as an executable workflow for the user.
- **Request Body**: `{ "code": "string", "description": "string" }`
- **Response (201)**: `{ "message": "string", "workflow": {...} }`

---

## 4. Execution History & Telemetry

### `GET /api/executions`
List executions owned by user, ordered descending by date.
- **Response (200)**: `{ "count": number, "executions": [...] }`

### `GET /api/executions/:id`
Retrieve execution details, step results, and transition history.
- **Response (200)**: `{ "execution": {...}, "failureLogs": [...] }`

### `POST /api/executions/:id/cancel`
Halt active running execution.
- **Response (200)**: `{ "message": "Execution cancelled", "executionId": "string" }`

---

## 5. Analytics & Dashboard

### `GET /api/analytics/dashboard`
Computes live database aggregations: totalWorkflows, totalExecutions, successRate, averageResponseTime, trendChart, failureDistribution.
- **Response (200)**: `{ "totalWorkflows", "totalExecutions", "successRate", ... }`

---

## 6. Simulator & Mock Services

### `GET /api/simulator/control`
Inspect active simulation scenario and available failure modes.

### `POST /api/simulator/control`
Set simulation scenario (`success`, `flaky_500`, `timeout`, `connection_reset`, `invalid_json`, `unexpected_status`, `rate_limit_429`, `permanent_500`).

### `POST /api/simulator/reset`
Reset simulator state to nominal `success`.

### Mock E-Commerce Endpoints:
- `POST /api/demo/login` - Authenticate demo user and issue token
- `GET /api/demo/products` - Return catalog (requires Bearer token)
- `POST /api/demo/payment` - Process payment (accepts `Idempotency-Key`)
- `POST /api/demo/order` - Confirm fulfillment order


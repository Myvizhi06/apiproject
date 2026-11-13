live frontend link:apiproject-5mk8.vercel.app

# API Sentinel – Automated API Workflow Verification & Failure Recovery System

[![Node.js](https://img.shields.io/badge/Node.js-20%2B-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18-blue.svg)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38bdf8.svg)](https://tailwindcss.com/)
[![Tests](https://img.shields.io/badge/Tests-79%20Passed-brightgreen.svg)]()
[![License](https://img.shields.io/badge/License-MIT-purple.svg)]()

> **API Sentinel** is an autonomous API workflow verification, state machine execution, and intelligent failure recovery platform. It features a custom Domain-Specific Language (ASL - API Sentinel Language), a deterministic 9-state finite state machine (FSM), real-time WebSocket telemetry, SSRF network protection, and multi-tier resilient storage.

---

## 🌟 Key Architecture & Engine Highlights

1. **Deterministic Finite State Machine (FSM)**:
   - 9 strictly governed states: `IDLE`, `VALIDATING`, `RUNNING`, `SUCCESS`, `FAILED`, `RETRYING`, `RECOVERING`, `COMPLETED`, `CANCELLED`.
   - Explicit state transition table rejecting illegal transitions with typed `InvalidTransitionError` exceptions.
   - The executor cannot execute an HTTP request without a legal FSM state transition.
2. **ASL (API Sentinel Language) Compiler**:
   - Custom Lexer with 1-indexed line and column tracking and comment support.
   - Recursive-descent LL(1) parser constructing a structured Abstract Syntax Tree (AST).
   - Semantic validator with Directed Acyclic Graph (DAG) cycle detection using Depth-First Search.
   - Bidirectional converter between ASL source code and visual workflow JSON configurations.
3. **Autonomous Failure Recovery & Idempotency Guard**:
   - Classifies failures into typed categories: `CONNECTION_TIMEOUT`, `CONNECTION_REFUSED`, `DNS_FAILURE`, `HTTP_5XX`, `HTTP_429`, `HTTP_4XX`, `INVALID_RESPONSE`, `UNEXPECTED_DATA`, `DEPENDENCY_FAILURE`.
   - Idempotency Safety Rules: naturally idempotent methods (`GET`, `PUT`, `DELETE`) are eligible for retry; non-idempotent methods (`POST`, `PATCH`) are **strictly blocked from blind retry** unless explicitly configured with `retrySafe: true` or an `Idempotency-Key` header is present.
   - Truncated exponential backoff with full jitter: $T_{\text{wait}} = \min(T_{\text{max}}, T_{\text{base}} \times 2^{\text{attempt} - 1}) + \text{Uniform}(0, J_{\text{max}})$.
   - Honors HTTP 429 `Retry-After` header values.
4. **SSRF (Server-Side Request Forgery) Defense**:
   - Approved host allowlist.
   - Hard blocks cloud instance metadata endpoints (`169.254.169.254`, `metadata.google.internal`, `100.100.100.200`).
   - Resolves DNS and inspects resolved IP addresses before socket allocation.
   - Disallows non-HTTP schemes (`file:`, `ftp:`, `gopher:`).
   - Safe hop-by-hop manual redirect verification up to a maximum limit of 5 hops.
5. **Multi-Tier Database Persistence**:
   - **Tier 1**: Real MongoDB / MongoDB Atlas via Mongoose.
   - **Tier 2**: In-memory MongoDB via `mongodb-memory-server` if available.
   - **Tier 3 (Zero-Dependency Fallback)**: Automatically activates the file-backed embedded document store (`server/config/embeddedStore.js`) when MongoDB is unset or unreachable. Persists to `server/data/*.json`.
6. **Dark SaaS Observability UI**:
   - Built with React 18, Vite, Tailwind CSS, Lucide React, and Recharts.
   - Live FSM diagram visualizer, dedicated network telemetry diagnostics panel, assertion drill-down modals, and failure recovery laboratory with 8 controllable simulation scenarios.

---

## 📁 Repository Structure

```
API-Sentinel/
├── client/                     # Frontend Single Page Application
│   ├── src/
│   │   ├── components/         # Navbar, Sidebar, Layout, FsmVisualizer, NetworkPanel, DrillDownModal
│   │   ├── context/            # AuthContext, SocketContext
│   │   ├── pages/              # Dashboard, Workflows, Builder, Monitor, Lab, ASL, Analytics, Settings
│   │   ├── services/           # api.js Axios client
│   │   ├── index.css           # Tailwind styles & theme variables
│   │   └── App.jsx             # Router and protected route wrappers
│   ├── index.html              # HTML entrypoint
│   ├── vite.config.js          # Vite build & proxy configuration
│   └── package.json            # Client dependencies (React, Vite, Recharts, Lucide, Tailwind)
├── server/                     # Backend API & Execution Engine
│   ├── config/                 # config.js, db.js, embeddedStore.js
│   ├── controllers/            # auth, workflow, execution, asl, analytics, settings
│   ├── engines/
│   │   ├── fsm/                # Deterministic FSM Engine
│   │   ├── language/           # Tokenizer, Parser, Validator, Converter
│   │   ├── execution/          # WorkflowExecutor, VariableEngine
│   │   ├── detection/          # FailureClassifier
│   │   ├── recovery/           # RecoveryDecisionEngine
│   │   └── verification/       # Verifier & Property Path Resolver
│   ├── middleware/             # authMiddleware, securityMiddleware, errorHandler
│   ├── models/                 # User, Workflow, Execution, FailureLog (Unified Mongoose/Embedded)
│   ├── routes/                 # Express route definitions
│   ├── simulator/              # Mock API server (/api/demo/*) & scenario controller
│   ├── tests/                  # 9 comprehensive Jest & Supertest test suites (79 tests)
│   ├── utils/                  # ssrfGuard.js, socketManager.js, seed.js
│   └── server.js               # HTTP & Socket.IO server entrypoint
├── docs/                       # Technical Specifications & Academic Write-ups
│   ├── grammar.md              # ASL EBNF/BNF grammar & semantic rules
│   ├── fsm.md                  # Formal FSM automaton definition & transition table
│   ├── architecture.md         # System architecture & component design
│   ├── computer_networks.md    # Computer networks & HTTP protocol lifecycle write-up
│   ├── automata_theory.md      # Formal language theory & compiler design write-up
│   ├── security_ssrf.md        # SSRF defense-in-depth security model
│   └── api_reference.md        # Complete OpenAPI / REST API reference
├── start-dev.js                # Unified dev launcher (starts client + server concurrently)
├── package.json                # Root package.json with scripts
└── README.md                   # System documentation
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v18.0.0 or higher (v20+ recommended)
- **npm**: v9.0.0 or higher
- *(Optional)* **MongoDB**: Local MongoDB or MongoDB Atlas URI (if unset, the system runs automatically using the built-in embedded store).

### 1. Installation
Clone the repository and install root and package dependencies:

```bash
# From the project root
npm run build
```

### 2. Environment Variables
Copy `.env.example` to `.env` in `server/` (pre-configured with sensible defaults):

```bash
# Server port
PORT=5000
NODE_ENV=development

# Database options:
# Option 1: Leave default or unset to automatically use zero-dependency Embedded Store
# Option 2: Local MongoDB: mongodb://127.0.0.1:27017/api_sentinel
# Option 3: MongoDB Atlas: mongodb+srv://<user>:<password>@cluster.mongodb.net/api_sentinel
MONGODB_URI=mongodb://127.0.0.1:27017/api_sentinel
USE_MEMORY_DB=false

# Authentication
JWT_SECRET=api_sentinel_super_secret_jwt_key_2026_academic_production
JWT_EXPIRES_IN=24h

# Client
CLIENT_URL=http://localhost:5173
ALLOW_LOCAL_NETWORK=true
```

### 3. Seed the Database
Populate the database with a pre-configured demo operator, e-commerce workflows, and historical executions:

```bash
npm run seed
```

Default credentials seeded:
- **Email**: `demo@apisentinel.dev`
- **Password**: `SentinelPass123!`

### 4. Start the Full System
Launch both backend and frontend servers together:

```bash
npm run dev
```

- **Frontend Application**: `http://localhost:5173`
- **Backend API & Simulator**: `http://127.0.0.1:5000`
- **Health Check**: `http://127.0.0.1:5000/health`

---

## 🧪 Testing

Run the automated Jest and Supertest test suites:

```bash
npm test
```

### Test Coverage Summary:
- `tests/fsm.test.js`: Valid linear transitions, retry/recovery cycles, illegal transition rejection, terminal absorption, event emission.
- `tests/asl.test.js`: Tokenizer line/col tracking, comment skipping, valid ASL AST construction, syntax error reporting, duplicate step detection, DAG cycle detection, bidirectional AST-to-workflow-to-ASL conversion.
- `tests/verification.test.js`: Status code verification, latency limits, headers, content types, dot/bracket property path resolution, prototype pollution blocking.
- `tests/variables.test.js`: Safe `{{steps.StepName.body.token}}` interpolation, nested array lookups, object recursion, prototype pollution defense.
- `tests/classifier.test.js`: Error classification for timeouts, connection refused, DNS errors, 5xx errors, 429 with `Retry-After`, 4xx client errors, invalid JSON, unexpected data.
- `tests/recovery.test.js`: RFC 7231 idempotency rules, non-idempotent POST blocking without idempotency key, POST allowed with `Idempotency-Key` or `retrySafe`, 429 backoff calculation, exponential backoff with jitter, retry quota exhaustion.
- `tests/ssrf.test.js`: Allowlist matching, cloud metadata IP blocking (`169.254.169.254`), non-HTTP protocol scheme rejection, private IP subnet protection.
- `tests/mockServerAndExecutor.test.js`: End-to-end multi-step workflow execution with variable passing against the mock server, transient flaky 500 recovery, retry exhaustion.
- `tests/backend.test.js`: Supertest API suite covering authentication, tenant authorization isolation (User A vs User B access restrictions), workflow CRUD & reorder, execution endpoints, ASL validation/save endpoints, and database analytics aggregation.

---

## 🎮 Guided Demo Walkthrough

1. **Sign In**: Navigate to `http://localhost:5173/login`. Click **"Click to Auto-Fill Academic Demo Operator Credentials"** and sign in.
2. **Dashboard**: View live metrics (Workflows, API Calls, Success Rate, Average Latency) computed directly from the database. Click **"Execute Demo Workflow"** to run the 4-step E-Commerce pipeline immediately.
3. **Live Execution Telemetry**: Watch the live FSM diagram transition states in real time: `IDLE` → `VALIDATING` → `RUNNING` → `SUCCESS` → `COMPLETED`. Inspect the dedicated Network Diagnostics Panel and click any step for granular expected-vs-actual assertion drill-down.
4. **Failure Recovery Laboratory**: Navigate to `/lab`. Select **"2. Transient Server Spike (500)"** and click **"Test Scenario"**. Watch the engine encounter HTTP 500 errors, transition to `FAILED`, calculate exponential backoff, transition to `RETRYING`, and recover successfully on attempt #3!
5. **ASL Language Editor**: Navigate to `/asl`. Select the **"E-Commerce Resilient Pipeline"** template, inspect the live AST tree on the right, modify statements, observe real-time syntax validation, and click **"Compile & Run"**.
6. **Visual Workflow Builder**: Navigate to `/workflows/new`. Visually add steps, reorder them, configure headers, payloads, retries, and assertion rules, and save directly to your library.

---

## 📚 Academic Documentation Reference
- [ASL Grammar Specification (BNF)](docs/grammar.md)
- [Finite State Machine (FSM) Formal Specification](docs/fsm.md)
- [System Architecture & Component Design](docs/architecture.md)
- [Computer Networks & Protocol Lifecycles](docs/computer_networks.md)
- [Formal Language & Automata Theory](docs/automata_theory.md)
- [SSRF Security Defense-in-Depth](docs/security_ssrf.md)
- [REST API Reference](docs/api_reference.md)
- [Full-Stack Implementation Notes](docs/fullstack_implementation.md)

---

## 🛡️ License
MIT License. Built for academic and production research in automated distributed systems reliability.


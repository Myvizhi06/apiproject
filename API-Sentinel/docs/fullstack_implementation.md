# Full-Stack Architecture & Implementation Write-up

## 1. Executive Summary
**API Sentinel** is an automated API workflow verification and failure recovery system architected for high reliability, deterministic execution, and real-time observability. It unifies compiler engineering (DSL lexer, recursive-descent parser, AST generation), formal automata theory (a 9-state finite state machine), network reliability engineering (exponential backoff with jitter, idempotency safety guards, SSRF defenses), and modern full-stack web technologies.

---

## 2. Technology Stack & Component Justification

| Layer | Technology | Engineering Justification |
| :--- | :--- | :--- |
| **Frontend Framework** | React 18, Vite | Lightning-fast HMR, concurrent rendering, and clean modular component structure. |
| **Styling & Design** | Tailwind CSS | Utility-first CSS generating minimal production stylesheets with dark SaaS aesthetic. |
| **Data Visualization** | Recharts | SVG-based responsive charting for execution volume, latency trends, and failure distributions. |
| **Real-Time Telemetry** | Socket.IO Client | Bi-directional WebSocket transport delivering live state transitions and step progress with fallback to long-polling. |
| **Routing & Navigation** | React Router v6 | Declarative client-side routing with nested layouts and protected route wrappers. |
| **Backend Runtime** | Node.js (v20+ / v24) | Asynchronous, non-blocking I/O event loop ideal for high-concurrency HTTP probe orchestration. |
| **Application Gateway** | Express.js | Robust middleware ecosystem handling CORS, JSON body parsing, input sanitization, and security headers. |
| **Database & Persistence**| MongoDB, Mongoose | Document-oriented storage naturally representing workflows, steps, executions, and failure logs. |
| **Zero-Dependency Fallback**| Embedded JSON Store | File-backed ACID-like JSON collection manager guaranteeing zero-crash operation when MongoDB is unavailable. |
| **Security & Auth** | JWT, bcryptjs | Stateless token-based tenant isolation with cryptographically salted password hashing. |
| **Test Engineering** | Jest, Supertest | Unit testing for custom language engines and end-to-end integration testing of HTTP APIs and database queries. |

---

## 3. Frontend Architecture & Design Decisions
The client application (`client/src/`) is structured into distinct functional domains:
- **`context/`**:
  - `AuthContext`: Manages user credentials, token persistence in `localStorage`, and session validation via `/api/auth/me`.
  - `SocketContext`: Maintains the authenticated real-time WebSocket connection to the backend server.
- **`components/`**:
  - `Layout`: Encapsulates the global navigation sidebar, top navigation bar with simulator injector, and scrollable content area.
  - `FsmVisualizer`: Visual state machine graph rendering all 9 states with glowing indicators for active states, alongside a chronological transition audit trail table.
  - `NetworkPanel`: Diagnostics dashboard displaying SSRF validation status, round-trip latency, HTTP status, idempotency evaluation, and backoff countdowns.
  - `DrillDownModal`: Granular modal view inspecting expected vs. actual values for every assertion criteria on any step.
- **`pages/`**:
  - `Dashboard`: Aggregated metrics, trend charts, failure breakdown, and recent execution tables.
  - `WorkflowBuilder`: Interactive visual step pipeline editor supporting drag/reorder, variable extractions, headers, body, and assertions.
  - `LiveMonitor`: Live execution telemetry showing real-time Socket.IO event streams, active step transitions, and network panels.
  - `RecoveryLab`: Interactive laboratory with 8 controllable failure scenarios to test autonomous recovery strategies.
  - `AslEditor`: Code editor with line numbers, live parser/validator, AST viewer, and direct compilation to DB.
  - `ExecutionHistory`: Filterable audit log with step drill-down capabilities.
  - `Analytics`: Deep-dive charts for volume, reliability, and latency.
  - `Settings`: SSRF host allowlist and engine threshold configuration.

---

## 4. Multi-Tier Resilient Database Architecture
To guarantee that the application runs out of the box in any environment (local development, CI/CD, sandboxed environments, or cloud production):
1. **Tier 1 (MongoDB / MongoDB Atlas)**: The connection manager (`server/config/db.js`) attempts to connect to `process.env.MONGODB_URI` via Mongoose. If available, all Mongoose models operate natively.
2. **Tier 2 (In-Memory MongoDB)**: If `MONGODB_URI` is unset or unreachable, the system dynamically checks for `mongodb-memory-server` and connects Mongoose to an ephemeral in-memory MongoDB instance.
3. **Tier 3 (Zero-Dependency Embedded Store)**: If neither external MongoDB nor `mongodb-memory-server` binaries are available (such as offline environments or restricted sandboxes), the system seamlessly activates `server/config/embeddedStore.js`. This embedded engine persists document collections into `server/data/*.json` and provides standard CRUD operations (`find`, `findOne`, `findById`, `create`, `findByIdAndUpdate`, `findByIdAndDelete`, `deleteMany`, `countDocuments`, `sort`, `skip`, `limit`).
4. **Unified Models**: The models (`User`, `Workflow`, `Execution`, `FailureLog`) wrap both Mongoose and the Embedded Store through a unified API, ensuring that controllers, routes, and business logic remain completely agnostic to the underlying persistence mechanism.


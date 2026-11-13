# API Sentinel Architecture & System Design

## 1. System Overview
API Sentinel is an enterprise-grade automated API workflow verification and autonomous failure recovery platform. It provides deterministic execution, formal language parsing, SSRF network protection, and real-time execution telemetry.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        React 18 SPA (Vite)                             │
│  Dashboard | Visual Builder | Live Monitor | ASL Editor | Recovery Lab │
└─────────────────────────────────┬──────────────────────────────────────┘
                                  │ HTTP REST & Socket.IO Telemetry
┌─────────────────────────────────▼──────────────────────────────────────┐
│                  Express.js Application Gateway                        │
│  Security Headers | CORS | JWT Auth Middleware | Tenant Isolation     │
├────────────────────────────────────────────────────────────────────────┤
│                           Core Engines                                 │
│  ┌───────────────────────┐          ┌───────────────────────────────┐  │
│  │  Deterministic FSM    │          │  ASL Lexer, Parser & AST      │  │
│  └───────────┬───────────┘          └──────────────┬────────────────┘  │
│              │                                     │                   │
│  ┌───────────▼───────────┐          ┌──────────────▼────────────────┐  │
│  │   Workflow Executor   │◄─────────┤   Variable Substitution       │  │
│  └───────────┬───────────┘          └───────────────────────────────┘  │
│              ├─────────────────────────────────────┐                   │
│  ┌───────────▼───────────┐          ┌──────────────▼────────────────┐  │
│  │   SSRF Security Guard │          │   Multi-Criteria Verifier     │  │
│  └───────────┬───────────┘          └──────────────┬────────────────┘  │
│              │                                     │                   │
│  ┌───────────▼───────────┐          ┌──────────────▼────────────────┐  │
│  │ Failure Classifier    ├─────────►│  Recovery Decision Engine     │  │
│  └───────────────────────┘          └───────────────────────────────┘  │
├────────────────────────────────────────────────────────────────────────┤
│                       Multi-Tier Persistence                           │
│   Tier 1: External MongoDB / Atlas (Mongoose)                          │
│   Tier 2: In-Memory MongoDB (mongodb-memory-server)                    │
│   Tier 3: Embedded Document Store (Zero-Dependency JSON Store)         │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Component Breakdown

### A. Finite State Machine Engine (`server/engines/fsm/fsmEngine.js`)
- Enforces an explicit 9-state transition matrix.
- Guarantees that every transition is mathematically verified before allowing step execution.
- Emits timestamped, audited transition packets via EventEmitter to Socket.IO.

### B. ASL Compiler & Language Pipeline (`server/language/`)
- **Tokenizer (`tokenizer.js`)**: Tracks 1-indexed lines and columns, recognizes strings, escapes, numbers, identifiers, and skips block/line comments.
- **Parser (`parser.js`)**: Recursive-descent parser generating an Abstract Syntax Tree (AST).
- **Semantic Validator (`validator.js`)**: Performs DAG cycle detection using Depth-First Search (DFS) and validates HTTP semantics.
- **Converter (`converter.js`)**: Bidirectional transformation between ASL source code and executable JSON workflow configurations.

### C. Variable & Template Engine (`server/engines/execution/variableEngine.js`)
- Safe traversal of nested data structures without `eval` or dynamic code execution.
- Strict defense against Prototype Pollution (`__proto__`, `prototype`, `constructor` blocking).
- Dynamic interpolation of `{{steps.StepName.body.token}}` across URLs, headers, and payloads.

### D. SSRF Guard (`server/utils/ssrfGuard.js`)
- Enforces approved target host allowlists.
- Blocks cloud metadata IP addresses (`169.254.169.254`, `metadata.google.internal`).
- Validates DNS resolutions and inspects resolved IPs before transmission.
- Disallows insecure protocol schemes (`file:`, `ftp:`, `gopher:`).

### E. Multi-Tier Database Fallback (`server/config/db.js`)
1. **Tier 1 (Production)**: Connects to MongoDB via Mongoose with credentials and replica set support.
2. **Tier 2 (Development/Test)**: Attempts `mongodb-memory-server` if binary is available.
3. **Tier 3 (Zero-Dependency Resilient Fallback)**: Automatically activates the file-backed embedded document store (`server/config/embeddedStore.js`), persisting data safely into `server/data/*.json`.

---

## 3. Real-Time Telemetry Flow
```
User Action ──► Workflow Execution API ──► FSM: IDLE -> VALIDATING -> RUNNING
                                                  │
                                                  ▼
                                       Emit: fsm_transition
                                       Emit: step_started
                                       Emit: request_sent
                                                  │
                                                  ▼
                                       Socket.IO User Room
                                                  │
                                                  ▼
                                      Client Live Monitor SPA
```


# Finite State Machine (FSM) Formal Specification

## 1. Formal Definition
The API Sentinel Execution Engine is formally modeled as a deterministic Finite State Automaton (DFA):

$$M = (S, \Sigma, \delta, s_0, F)$$

Where:
- **$S$** is the finite set of valid states:
  $$S = \{\text{IDLE}, \text{VALIDATING}, \text{RUNNING}, \text{SUCCESS}, \text{FAILED}, \text{RETRYING}, \text{RECOVERING}, \text{COMPLETED}, \text{CANCELLED}\}$$
- **$s_0$** is the initial state: $s_0 = \text{IDLE}$
- **$F$** is the set of terminal (halting) states: $F = \{\text{COMPLETED}, \text{CANCELLED}\}$
- **$\Sigma$** is the alphabet of transition triggers:
  $$\Sigma = \{\text{START\_VALIDATION}, \text{START\_EXECUTION}, \text{STEP\_PASSED}, \text{STEP\_FAILED}, \text{SCHEDULE\_RETRY}, \text{COMMENCE\_RECOVERY}, \text{RESUME\_AFTER\_BACKOFF}, \text{FINAL\_STEP\_COMPLETED}, \text{CANCEL}\}$$
- **$\delta: S \times \Sigma \to S$** is the formal transition function.

---

## 2. Transition Matrix Table

| Current State ($s$) | Allowed Next States ($\delta(s)$) | Rejected Transitions | Invariant Rules |
| :--- | :--- | :--- | :--- |
| **`IDLE`** | `VALIDATING`, `CANCELLED` | All other states | Workflow has been created but no execution dispatched. |
| **`VALIDATING`** | `RUNNING`, `FAILED`, `CANCELLED` | `COMPLETED`, `RETRYING`, etc. | Grammar syntax and dependency DAG verified. |
| **`RUNNING`** | `SUCCESS`, `FAILED`, `CANCELLED` | `COMPLETED` directly | HTTP request dispatched; awaiting socket response. |
| **`SUCCESS`** | `RUNNING` (next step), `COMPLETED`, `CANCELLED` | `FAILED`, `RETRYING` | Step passed assertions. Proceeds or completes. |
| **`FAILED`** | `RETRYING`, `CANCELLED` | `RUNNING`, `SUCCESS`, `COMPLETED` | Error detected; evaluating recovery eligibility. |
| **`RETRYING`** | `SUCCESS`, `RECOVERING`, `CANCELLED` | `COMPLETED`, `RUNNING` directly | Exponential backoff timer active. |
| **`RECOVERING`** | `RUNNING`, `FAILED`, `CANCELLED` | `COMPLETED`, `RETRYING` | Recovery strategy selected; re-entering execution. |
| **`COMPLETED`** | $\emptyset$ (None - Terminal) | All transitions | Execution terminated successfully. |
| **`CANCELLED`** | $\emptyset$ (None - Terminal) | All transitions | Execution aborted by user or timeout guard. |

---

## 3. Automaton State Transition Diagram

```
                 ┌─────────────────────────────────────────────────────────────┐
                 │                                                             │
                 ▼                                                             │
  [IDLE] ───► [VALIDATING] ───► [RUNNING] ───────► [SUCCESS] ───► [COMPLETED]*  │
                   │               │                  │                        │
                   │               ▼                  │ (Next Step)            │
                   └───────────► [FAILED]             └────────────────────────┘
                                   │
                                   ▼
                              [RETRYING]
                                   │
                                   ▼
                             [RECOVERING] ───► [RUNNING] (Re-attempt)
                                   │
                                   ▼
                                [FAILED]

  * Any non-terminal state ──(CANCEL)──► [CANCELLED]*
```

---

## 4. State Invariants & Safety Guarantees

1. **Terminal Absorption Property**:
   $$\forall s \in F, \; \forall e \in \Sigma, \quad \delta(s, e) = \bot$$
   Once entering `COMPLETED` or `CANCELLED`, the automaton halts permanently. No subsequent transitions are admitted; attempts throw `InvalidTransitionError`.

2. **Transition Precondition Enforcement**:
   The workflow executor cannot issue an HTTP probe or mutate variables without receiving explicit permission from the FSM via a legal state transition.

3. **Autonomous Recovery Boundedness**:
   The cycle $\text{RUNNING} \to \text{FAILED} \to \text{RETRYING} \to \text{RECOVERING} \to \text{RUNNING}$ is strictly bounded by $N \le \text{MAX\_RETRIES}$ (capped at 5). Once attempts exceed $N$, the transition to `RETRYING` is disallowed, and the state transitions to terminal failure, preventing infinite execution loops.


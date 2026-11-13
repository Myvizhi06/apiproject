/**
 * API Sentinel - Finite State Machine (FSM) Engine
 * Custom deterministic state machine with strict formal transitions.
 */

const EventEmitter = require('events');

const FSM_STATES = Object.freeze({
  IDLE: 'IDLE',
  VALIDATING: 'VALIDATING',
  RUNNING: 'RUNNING',
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
  RETRYING: 'RETRYING',
  RECOVERING: 'RECOVERING',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
});

const TERMINAL_STATES = Object.freeze([
  FSM_STATES.COMPLETED,
  FSM_STATES.CANCELLED,
]);

/**
 * Explicit Transition Table (Formal State Automaton)
 * Maps source state -> array of allowed target states.
 */
const TRANSITION_TABLE = Object.freeze({
  [FSM_STATES.IDLE]: [FSM_STATES.VALIDATING, FSM_STATES.CANCELLED],
  [FSM_STATES.VALIDATING]: [FSM_STATES.RUNNING, FSM_STATES.FAILED, FSM_STATES.CANCELLED],
  [FSM_STATES.RUNNING]: [FSM_STATES.SUCCESS, FSM_STATES.FAILED, FSM_STATES.CANCELLED],
  [FSM_STATES.FAILED]: [FSM_STATES.RETRYING, FSM_STATES.CANCELLED],
  [FSM_STATES.RETRYING]: [FSM_STATES.SUCCESS, FSM_STATES.RECOVERING, FSM_STATES.CANCELLED],
  [FSM_STATES.RECOVERING]: [FSM_STATES.RUNNING, FSM_STATES.FAILED, FSM_STATES.CANCELLED],
  [FSM_STATES.SUCCESS]: [FSM_STATES.RUNNING, FSM_STATES.COMPLETED, FSM_STATES.CANCELLED],
  [FSM_STATES.COMPLETED]: [], // Terminal: no transitions allowed
  [FSM_STATES.CANCELLED]: [], // Terminal: no transitions allowed
});

class InvalidTransitionError extends Error {
  constructor(fromState, toState, trigger, reason) {
    const msg = reason || `Illegal transition from '${fromState}' to '${toState}' (trigger: '${trigger || 'unknown'}').`;
    super(msg);
    this.name = 'InvalidTransitionError';
    this.fromState = fromState;
    this.toState = toState;
    this.trigger = trigger;
    this.statusCode = 400;
  }
}

class FSMEngine extends EventEmitter {
  constructor(initialState = FSM_STATES.IDLE, options = {}) {
    super();
    if (!Object.values(FSM_STATES).includes(initialState)) {
      throw new Error(`Invalid initial state: '${initialState}'`);
    }

    this.currentState = initialState;
    this.history = [];
    this.workflowId = options.workflowId || null;
    this.executionId = options.executionId || null;
    this.createdAt = new Date();

    // Record initial state entry
    this.recordHistory({
      from: null,
      to: this.currentState,
      trigger: 'INITIALIZE',
      timestamp: new Date().toISOString(),
      stepId: null,
      metadata: { initial: true },
    });
  }

  getState() {
    return this.currentState;
  }

  isTerminal() {
    return TERMINAL_STATES.includes(this.currentState);
  }

  canTransition(toState) {
    if (!Object.values(FSM_STATES).includes(toState)) {
      return false;
    }
    const allowed = TRANSITION_TABLE[this.currentState] || [];
    return allowed.includes(toState);
  }

  getAllowedTransitions() {
    return [...(TRANSITION_TABLE[this.currentState] || [])];
  }

  /**
   * Execute state transition. Throws InvalidTransitionError if disallowed.
   * Emits 'transition' and 'state_change' events.
   */
  transition(toState, trigger = 'STEP', context = {}) {
    if (!Object.values(FSM_STATES).includes(toState)) {
      throw new InvalidTransitionError(
        this.currentState,
        toState,
        trigger,
        `Unknown target state '${toState}'. Allowed states: ${Object.values(FSM_STATES).join(', ')}.`
      );
    }

    if (!this.canTransition(toState)) {
      const allowed = this.getAllowedTransitions();
      throw new InvalidTransitionError(
        this.currentState,
        toState,
        trigger,
        `Cannot transition from '${this.currentState}' to '${toState}'. Allowed target states from '${this.currentState}': [${allowed.join(', ') || 'none (terminal state)'}].`
      );
    }

    const previousState = this.currentState;
    this.currentState = toState;

    const transitionEvent = {
      from: previousState,
      to: toState,
      trigger: trigger || 'DIRECT',
      timestamp: new Date().toISOString(),
      stepId: context.stepId || null,
      metadata: {
        ...context.metadata,
        reason: context.reason || null,
      },
    };

    this.recordHistory(transitionEvent);

    // Emit typed events
    this.emit('transition', transitionEvent);
    this.emit(`state:${toState}`, transitionEvent);

    return transitionEvent;
  }

  recordHistory(entry) {
    this.history.push(Object.freeze({ ...entry }));
  }

  getHistory() {
    return [...this.history];
  }

  /**
   * Safe cancellation helper (allowed from any non-terminal state)
   */
  cancel(reason = 'User cancelled workflow', stepId = null) {
    if (this.isTerminal()) {
      return null;
    }
    return this.transition(FSM_STATES.CANCELLED, 'CANCEL', {
      stepId,
      reason,
      metadata: { cancelledAt: new Date().toISOString() },
    });
  }

  reset() {
    this.currentState = FSM_STATES.IDLE;
    this.history = [];
    this.recordHistory({
      from: null,
      to: FSM_STATES.IDLE,
      trigger: 'RESET',
      timestamp: new Date().toISOString(),
      stepId: null,
      metadata: { reset: true },
    });
  }
}

module.exports = {
  FSM_STATES,
  TERMINAL_STATES,
  TRANSITION_TABLE,
  InvalidTransitionError,
  FSMEngine,
};


const { FSMEngine, FSM_STATES, InvalidTransitionError, TRANSITION_TABLE } = require('../engines/fsm/fsmEngine');

describe('Finite State Machine (FSM) Engine', () => {
  let fsm;

  beforeEach(() => {
    fsm = new FSMEngine();
  });

  test('initializes with IDLE state and records initial event', () => {
    expect(fsm.getState()).toBe(FSM_STATES.IDLE);
    const history = fsm.getHistory();
    expect(history.length).toBe(1);
    expect(history[0].to).toBe(FSM_STATES.IDLE);
    expect(history[0].trigger).toBe('INITIALIZE');
  });

  test('allows valid linear transition IDLE -> VALIDATING -> RUNNING -> SUCCESS -> COMPLETED', () => {
    fsm.transition(FSM_STATES.VALIDATING, 'TEST_VAL');
    expect(fsm.getState()).toBe(FSM_STATES.VALIDATING);

    fsm.transition(FSM_STATES.RUNNING, 'TEST_RUN');
    expect(fsm.getState()).toBe(FSM_STATES.RUNNING);

    fsm.transition(FSM_STATES.SUCCESS, 'TEST_SUCC');
    expect(fsm.getState()).toBe(FSM_STATES.SUCCESS);

    fsm.transition(FSM_STATES.COMPLETED, 'TEST_COMP');
    expect(fsm.getState()).toBe(FSM_STATES.COMPLETED);
    expect(fsm.isTerminal()).toBe(true);
  });

  test('allows retry and recovery cycle: RUNNING -> FAILED -> RETRYING -> SUCCESS -> COMPLETED', () => {
    fsm.transition(FSM_STATES.VALIDATING);
    fsm.transition(FSM_STATES.RUNNING);
    fsm.transition(FSM_STATES.FAILED);
    expect(fsm.getState()).toBe(FSM_STATES.FAILED);

    fsm.transition(FSM_STATES.RETRYING);
    expect(fsm.getState()).toBe(FSM_STATES.RETRYING);

    fsm.transition(FSM_STATES.SUCCESS);
    expect(fsm.getState()).toBe(FSM_STATES.SUCCESS);

    fsm.transition(FSM_STATES.COMPLETED);
    expect(fsm.getState()).toBe(FSM_STATES.COMPLETED);
  });

  test('allows deep recovery: RETRYING -> RECOVERING -> RUNNING', () => {
    fsm.transition(FSM_STATES.VALIDATING);
    fsm.transition(FSM_STATES.RUNNING);
    fsm.transition(FSM_STATES.FAILED);
    fsm.transition(FSM_STATES.RETRYING);
    fsm.transition(FSM_STATES.RECOVERING);
    expect(fsm.getState()).toBe(FSM_STATES.RECOVERING);

    fsm.transition(FSM_STATES.RUNNING);
    expect(fsm.getState()).toBe(FSM_STATES.RUNNING);
  });

  test('rejects illegal transition with InvalidTransitionError', () => {
    // Cannot jump from IDLE to COMPLETED directly
    expect(() => {
      fsm.transition(FSM_STATES.COMPLETED);
    }).toThrow(InvalidTransitionError);

    // Cannot jump from IDLE to RUNNING without VALIDATING
    expect(() => {
      fsm.transition(FSM_STATES.RUNNING);
    }).toThrow(InvalidTransitionError);
  });

  test('rejects any transition from terminal states', () => {
    fsm.transition(FSM_STATES.VALIDATING);
    fsm.transition(FSM_STATES.RUNNING);
    fsm.transition(FSM_STATES.SUCCESS);
    fsm.transition(FSM_STATES.COMPLETED);

    expect(fsm.isTerminal()).toBe(true);
    expect(() => {
      fsm.transition(FSM_STATES.RUNNING);
    }).toThrow(InvalidTransitionError);
  });

  test('allows CANCELLED from any non-terminal state', () => {
    fsm.transition(FSM_STATES.VALIDATING);
    fsm.cancel('User requested halt');
    expect(fsm.getState()).toBe(FSM_STATES.CANCELLED);
    expect(fsm.isTerminal()).toBe(true);
  });

  test('emits transition events with timestamp, metadata and stepId', (done) => {
    fsm.on('transition', (evt) => {
      expect(evt.from).toBe(FSM_STATES.IDLE);
      expect(evt.to).toBe(FSM_STATES.VALIDATING);
      expect(evt.stepId).toBe('step_1');
      expect(evt.metadata.user).toBe('tester');
      expect(evt.timestamp).toBeDefined();
      done();
    });

    fsm.transition(FSM_STATES.VALIDATING, 'TRIGGER_TEST', {
      stepId: 'step_1',
      metadata: { user: 'tester' },
    });
  });
});


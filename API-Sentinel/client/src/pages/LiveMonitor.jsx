import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import { executionAPI } from '../services/api';
import FsmVisualizer from '../components/FsmVisualizer';
import NetworkPanel from '../components/NetworkPanel';
import StatusBadge from '../components/StatusBadge';
import DrillDownModal from '../components/DrillDownModal';
import {
  Activity,
  RotateCw,
  AlertOctagon,
  CheckCircle2,
  Clock,
  Layers,
  ArrowRight,
  ShieldCheck,
  XCircle,
  ExternalLink,
} from 'lucide-react';

export function LiveMonitor() {
  const { id } = useParams();
  const { socket, connected } = useSocket();

  const [execution, setExecution] = useState(null);
  const [fsmHistory, setFsmHistory] = useState([]);
  const [currentState, setCurrentState] = useState('RUNNING');
  const [activeStep, setActiveStep] = useState(null);
  const [failureReport, setFailureReport] = useState(null);
  const [recoveryDecision, setRecoveryDecision] = useState(null);
  const [retryCountdown, setRetryCountdown] = useState(null);
  const [streamLogs, setStreamLogs] = useState([]);
  const [selectedDrillDownStep, setSelectedDrillDownStep] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  // Initial load
  useEffect(() => {
    async function fetchExecution() {
      try {
        const res = await executionAPI.get(id);
        const exec = res.data.execution;
        setExecution(exec);
        if (exec.fsmHistory && Array.isArray(exec.fsmHistory)) {
          setFsmHistory(exec.fsmHistory);
          if (exec.fsmHistory.length > 0) {
            setCurrentState(exec.fsmHistory[exec.fsmHistory.length - 1].to);
          }
        }
        if (exec.steps && exec.steps.length > 0) {
          setActiveStep(exec.steps[exec.steps.length - 1]);
        }
      } catch (err) {
        console.error('Failed to load execution details:', err);
      }
    }
    fetchExecution();
  }, [id]);

  // Socket.IO event listeners
  useEffect(() => {
    if (!socket) return;

    socket.emit('join_workflow', id);

    const handleFsmTransition = (evt) => {
      if (String(evt.executionId) === String(id)) {
        setCurrentState(evt.to);
        setFsmHistory((prev) => [...prev, evt]);
        logEvent(`FSM Transition: ${evt.from} → ${evt.to} (trigger: ${evt.trigger})`);
      }
    };

    const handleStepStarted = (evt) => {
      if (String(evt.executionId) === String(id)) {
        setActiveStep({
          stepId: evt.stepId,
          name: evt.stepName,
          attempts: evt.attempt,
        });
        setFailureReport(null);
        setRecoveryDecision(null);
        logEvent(`Step started: ${evt.stepName} (attempt ${evt.attempt + 1})`);
      }
    };

    const handleRequestSent = (evt) => {
      if (String(evt.executionId) === String(id)) {
        setActiveStep((prev) => ({
          ...prev,
          method: evt.method,
          url: evt.url,
          headers: evt.headers,
        }));
        logEvent(`HTTP ${evt.method} sent to ${evt.url}`);
      }
    };

    const handleResponseReceived = (evt) => {
      if (String(evt.executionId) === String(id)) {
        setActiveStep((prev) => ({
          ...prev,
          response: { status: evt.status, durationMs: evt.durationMs },
        }));
        logEvent(`Response received: HTTP ${evt.status} (${evt.durationMs}ms)`);
      }
    };

    const handleFailureDetected = (evt) => {
      if (String(evt.executionId) === String(id)) {
        setFailureReport(evt.failureReport);
        logEvent(`Failure detected in ${evt.stepName}: ${evt.failureReport.type} - ${evt.failureReport.message}`);
      }
    };

    const handleRecoveryDecision = (evt) => {
      if (String(evt.executionId) === String(id)) {
        setRecoveryDecision(evt.recoveryDecision);
        logEvent(`Autonomous Recovery Decision: ${evt.recoveryDecision.action} (${evt.recoveryDecision.reason})`);
      }
    };

    const handleRetryScheduled = (evt) => {
      if (String(evt.executionId) === String(id)) {
        const sec = Math.ceil(evt.delayMs / 1000);
        setRetryCountdown(sec);
        logEvent(`Retry scheduled in ${evt.delayMs}ms (attempt ${evt.attempt})`);
      }
    };

    const handleStepCompleted = (evt) => {
      if (String(evt.executionId) === String(id)) {
        setExecution((prev) => {
          if (!prev) return prev;
          const updatedSteps = [...(prev.steps || [])];
          const existingIdx = updatedSteps.findIndex((s) => s.stepId === evt.stepId);
          const completedStepObj = {
            stepId: evt.stepId,
            stepName: evt.stepName,
            passed: evt.passed,
            attempts: evt.attempt,
            response: { status: evt.status, durationMs: evt.durationMs },
          };
          if (existingIdx !== -1) updatedSteps[existingIdx] = completedStepObj;
          else updatedSteps.push(completedStepObj);
          return { ...prev, steps: updatedSteps };
        });
        logEvent(`Step completed: ${evt.stepName} (${evt.durationMs}ms)`);
      }
    };

    const handleWorkflowCompleted = (evt) => {
      if (String(evt.executionId) === String(id)) {
        setExecution(evt);
        setCurrentState('COMPLETED');
        logEvent(`Workflow run completed successfully (${evt.durationMs}ms)`);
      }
    };

    const handleWorkflowFailed = (evt) => {
      if (String(evt.executionId) === String(id)) {
        setExecution(evt);
        setCurrentState('FAILED');
        logEvent(`Workflow run terminated with failure: ${evt.failureReason}`);
      }
    };

    socket.on('fsm_transition', handleFsmTransition);
    socket.on('step_started', handleStepStarted);
    socket.on('request_sent', handleRequestSent);
    socket.on('response_received', handleResponseReceived);
    socket.on('failure_detected', handleFailureDetected);
    socket.on('recovery_decision', handleRecoveryDecision);
    socket.on('retry_scheduled', handleRetryScheduled);
    socket.on('step_completed', handleStepCompleted);
    socket.on('workflow_completed', handleWorkflowCompleted);
    socket.on('workflow_failed', handleWorkflowFailed);

    return () => {
      socket.off('fsm_transition', handleFsmTransition);
      socket.off('step_started', handleStepStarted);
      socket.off('request_sent', handleRequestSent);
      socket.off('response_received', handleResponseReceived);
      socket.off('failure_detected', handleFailureDetected);
      socket.off('recovery_decision', handleRecoveryDecision);
      socket.off('retry_scheduled', handleRetryScheduled);
      socket.off('step_completed', handleStepCompleted);
      socket.off('workflow_completed', handleWorkflowCompleted);
      socket.off('workflow_failed', handleWorkflowFailed);
    };
  }, [socket, id]);

  const logEvent = (msg) => {
    setStreamLogs((prev) => [
      { msg, time: new Date().toLocaleTimeString(), id: Math.random() },
      ...prev.slice(0, 49),
    ]);
  };

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await executionAPI.cancel(id);
      setCurrentState('CANCELLED');
    } catch (e) {
      console.error('Failed to cancel execution:', e);
    } finally {
      setCancelling(false);
    }
  };

  const isTerminal = currentState === 'COMPLETED' || currentState === 'FAILED' || currentState === 'CANCELLED';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs text-indigo-400 mb-1">
            <Link to="/executions" className="hover:underline">Executions</Link>
            <span className="text-slate-600">/</span>
            <span className="text-slate-400 font-mono">{id}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
            <span>{execution?.workflowName || 'Live Execution Telemetry'}</span>
            <StatusBadge status={currentState} type="fsm" size="sm" />
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Socket.IO live telemetry stream: formal state transitions, HTTP probe verification, and recovery actions.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {!isTerminal && (
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="px-4 py-2 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 hover:bg-rose-500/25 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <XCircle className="w-4 h-4" />
              <span>{cancelling ? 'Halting...' : 'Halt Execution'}</span>
            </button>
          )}

          {execution?.workflowId && (
            <Link
              to={`/workflows/${execution.workflowId}`}
              className="px-3.5 py-2 rounded-xl bg-[#111C38] border border-slate-700 text-slate-200 hover:text-white text-xs font-medium flex items-center gap-1.5"
            >
              <span>Workflow Config</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>
      </div>

      {/* FSM Live Automaton Visualizer */}
      <FsmVisualizer currentState={currentState} history={fsmHistory} />

      {/* Network Diagnostics Panel */}
      <NetworkPanel
        activeStep={activeStep}
        failureReport={failureReport}
        recoveryDecision={recoveryDecision}
        retryCountdown={retryCountdown}
      />

      {/* Steps Pipeline & Stream Terminal */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Executed Steps List */}
        <div className="lg:col-span-7 bg-[#0D1527] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <h3 className="text-sm font-semibold text-white flex items-center justify-between">
            <span>Executed Steps & Verifications</span>
            <span className="text-xs text-slate-500 font-mono">
              {execution?.steps?.length || 0} steps recorded
            </span>
          </h3>

          <div className="space-y-2.5">
            {(!execution?.steps || execution.steps.length === 0) ? (
              <div className="py-8 text-center text-slate-500 text-xs font-mono">
                Awaiting first step dispatch...
              </div>
            ) : (
              execution.steps.map((st, idx) => (
                <div
                  key={st.stepId || idx}
                  onClick={() => setSelectedDrillDownStep(st)}
                  className="p-3.5 rounded-xl bg-[#111C38] border border-slate-800 hover:border-indigo-500/50 transition-all cursor-pointer flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-slate-900 text-xs font-mono font-bold flex items-center justify-center text-slate-400">
                      {idx + 1}
                    </span>
                    <div>
                      <div className="text-xs font-semibold text-white">{st.stepName}</div>
                      <div className="text-[11px] font-mono text-slate-400">
                        {st.response?.durationMs ? `${st.response.durationMs}ms` : '–'} | Retried: {st.attempts || 0} times
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <StatusBadge status={st.passed ? 'PASSED' : 'FAILED'} type="status" size="xs" />
                    <span className="text-xs text-indigo-400 font-mono hover:underline">
                      Drill-Down →
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Live Event Stream Terminal */}
        <div className="lg:col-span-5 bg-[#0D1527] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-3 flex flex-col">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Live Telemetry Event Log</span>
          </h3>

          <div className="flex-1 bg-slate-950/80 rounded-xl border border-slate-800 p-3 font-mono text-[11px] text-slate-300 overflow-y-auto max-h-72 space-y-1.5">
            {streamLogs.length === 0 ? (
              <div className="text-slate-600 text-center py-6">Listening for Socket.IO telemetry packets...</div>
            ) : (
              streamLogs.map((log) => (
                <div key={log.id} className="flex items-start gap-2 leading-relaxed">
                  <span className="text-slate-500 shrink-0">[{log.time}]</span>
                  <span className="text-slate-300 break-all">{log.msg}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Drill Down Modal */}
      {selectedDrillDownStep && (
        <DrillDownModal
          step={selectedDrillDownStep}
          onClose={() => setSelectedDrillDownStep(null)}
        />
      )}
    </div>
  );
}

export default LiveMonitor;


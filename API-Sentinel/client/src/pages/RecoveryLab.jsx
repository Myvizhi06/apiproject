import React, { useState } from 'react';
import {
  FlaskConical,
  Play,
  RotateCw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldCheck,
  RefreshCw,
  Server,
  Zap,
} from 'lucide-react';
import { simulatorAPI, workflowAPI } from '../services/api';
import StatusBadge from '../components/StatusBadge';

const LAB_SCENARIOS = [
  {
    id: 'success',
    name: '1. Nominal Success (200 OK)',
    category: 'Normal Operation',
    expectedStatus: 200,
    description: 'All API endpoints respond promptly with standard structured JSON responses.',
    expectedFailure: 'None (Clean Pass)',
    recoveryExpectation: 'No recovery triggered. FSM moves IDLE → VALIDATING → RUNNING → SUCCESS → COMPLETED.',
  },
  {
    id: 'flaky_500',
    name: '2. Transient Server Spike (500)',
    category: 'Transient Fault',
    expectedStatus: 500,
    description: 'Database connection pool spike: Server returns HTTP 500 twice, then automatically recovers on the 3rd retry.',
    expectedFailure: 'HTTP_5XX (Transient)',
    recoveryExpectation: 'Exponential backoff wait, automatic retry attempt #1 and #2, successful recovery on attempt #3.',
  },
  {
    id: 'timeout',
    name: '3. Gateway / Connection Timeout',
    category: 'Network Latency',
    expectedStatus: 504,
    description: 'API endpoint hangs and fails to respond within configured step timeout threshold (3000ms).',
    expectedFailure: 'CONNECTION_TIMEOUT',
    recoveryExpectation: 'Timeout detected by Verifier. FSM transitions to RETRYING, backoff applied, re-attempt executed.',
  },
  {
    id: 'connection_reset',
    name: '4. Server Socket Crash / Reset',
    category: 'Socket Failure',
    expectedStatus: 0,
    description: 'Server abruptly terminates and destroys TCP socket connection mid-stream.',
    expectedFailure: 'CONNECTION_REFUSED / ECONNRESET',
    recoveryExpectation: 'Network layer failure detected. Recovery engine verifies method idempotency and triggers retry.',
  },
  {
    id: 'invalid_json',
    name: '5. Corrupted / Broken JSON Payload',
    category: 'Data Integrity',
    expectedStatus: 200,
    description: 'Server returns HTTP 200 OK but with corrupted, unparseable non-JSON body syntax.',
    expectedFailure: 'INVALID_RESPONSE',
    recoveryExpectation: 'Verifier catches payload corruption. Recovery engine marks failure transient and initiates retry.',
  },
  {
    id: 'unexpected_status',
    name: '6. Unexpected Status Code (418)',
    category: 'Schema Anomaly',
    expectedStatus: 418,
    description: 'Endpoint returns HTTP 418 I\'m a Teapot instead of expected 200 OK.',
    expectedFailure: 'UNEXPECTED_DATA / HTTP_4XX',
    recoveryExpectation: 'Classified as non-transient assertion failure. FSM transitions to FAILED to avoid futile loop.',
  },
  {
    id: 'rate_limit_429',
    name: '7. Rate Limit (429) + Retry-After',
    category: 'Throttling',
    expectedStatus: 429,
    description: 'Server returns HTTP 429 Too Many Requests with "Retry-After: 1" header.',
    expectedFailure: 'HTTP_429 (Rate Limit)',
    recoveryExpectation: 'Recovery engine parses "Retry-After" header, pauses for exact duration, then resumes workflow.',
  },
  {
    id: 'permanent_500',
    name: '8. Permanent Failure (Retry Exhaustion)',
    category: 'Unrecoverable',
    expectedStatus: 500,
    description: 'Persistent server outage: returns 500 continuously across all retry attempts.',
    expectedFailure: 'HTTP_5XX (Exhausted)',
    recoveryExpectation: 'Retries repeat up to max limit (e.g., 3 attempts), then engine halts gracefully with clear audit trail.',
  },
];

export function RecoveryLab() {
  const [activeScenarioId, setActiveScenarioId] = useState('flaky_500');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [customFlakyCount, setCustomFlakyCount] = useState(2);

  const activeScenario = LAB_SCENARIOS.find(s => s.id === activeScenarioId) || LAB_SCENARIOS[0];

  const handleRunScenario = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      // 1. Arm simulator with chosen scenario
      await simulatorAPI.setScenario({
        scenario: activeScenario.id,
        flakyFailureCount: customFlakyCount,
        timeoutDurationMs: 2500,
      });

      // 2. Create and run an isolated single-step test workflow
      const testWorkflow = {
        name: `Lab Test: ${activeScenario.name}`,
        description: `Automated test for scenario: ${activeScenario.id}`,
        steps: [
          {
            id: 'lab_step_1',
            name: 'SimulatedApiProbe',
            order: 1,
            method: 'GET',
            url: `/api/demo/products?scenario=${activeScenario.id}`,
            expectedStatus: 200,
            retries: 3,
            timeoutMs: 2000,
            idempotent: true,
            headers: {
              Authorization: 'Bearer mock_probe_token',
              'X-Simulator-Scenario': activeScenario.id,
            },
          },
        ],
      };

      const createRes = await workflowAPI.create(testWorkflow);
      const wfId = createRes.data.workflow._id || createRes.data.workflow.id;

      // 3. Execute
      const execRes = await workflowAPI.execute(wfId);
      const execution = execRes.data.execution;

      setTestResult({
        status: execution.status,
        durationMs: execution.duration,
        fsmHistory: execution.fsmHistory || [],
        steps: execution.steps || [],
        finalResult: execution.finalResult,
      });

      // Clean up test workflow
      try {
        await workflowAPI.delete(wfId);
      } catch (e) {}
    } catch (err) {
      console.error('Scenario run error:', err);
      setTestResult({
        status: 'FAILED',
        error: err.response?.data?.message || err.message,
      });
    } finally {
      // Reset simulator to success
      try {
        await simulatorAPI.reset();
      } catch (e) {}
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <FlaskConical className="w-6 h-6 text-indigo-400" />
            <span>Failure Recovery Laboratory</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Simulate and evaluate autonomous recovery strategies across 8 distinct API failure modes.
          </p>
        </div>

        <button
          onClick={handleRunScenario}
          disabled={testing}
          className="px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold text-xs shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
        >
          <Play className={`w-4 h-4 ${testing ? 'animate-spin' : ''}`} />
          <span>{testing ? 'Executing Simulation...' : `Test Scenario: ${activeScenario.name}`}</span>
        </button>
      </div>

      {/* Scenarios Grid Selector */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {LAB_SCENARIOS.map((sc) => {
          const isSelected = sc.id === activeScenarioId;
          return (
            <div
              key={sc.id}
              onClick={() => { setActiveScenarioId(sc.id); setTestResult(null); }}
              className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                isSelected
                  ? 'bg-gradient-to-tr from-indigo-950/60 to-[#111C38] border-indigo-500 shadow-xl glow-indigo ring-1 ring-indigo-500/50'
                  : 'bg-[#0D1527] border-slate-800 hover:border-slate-700'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800">
                    {sc.category}
                  </span>
                  {isSelected && <Zap className="w-3.5 h-3.5 text-indigo-400" />}
                </div>
                <h4 className="text-xs font-bold text-white mb-1.5">{sc.name}</h4>
                <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-2">{sc.description}</p>
              </div>

              <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono">
                <span className="text-slate-500">Expected:</span>
                <span className="text-slate-300 font-semibold">{sc.expectedFailure}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Active Scenario Details & Live Test Output */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Scenario Specifications */}
        <div className="lg:col-span-5 bg-[#0D1527] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-semibold text-white">Scenario Specifications</h3>
            <span className="text-xs font-mono text-indigo-400">{activeScenario.category}</span>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <span className="text-slate-500 block text-[11px] font-medium uppercase mb-0.5">Failure Mechanism:</span>
              <p className="text-slate-300 leading-relaxed bg-[#111C38] p-3 rounded-xl border border-slate-800 font-mono">
                {activeScenario.description}
              </p>
            </div>

            <div>
              <span className="text-slate-500 block text-[11px] font-medium uppercase mb-0.5">Expected Engine Recovery Behavior:</span>
              <p className="text-emerald-300/90 leading-relaxed bg-[#111C38] p-3 rounded-xl border border-slate-800 font-mono text-[11px]">
                {activeScenario.recoveryExpectation}
              </p>
            </div>

            {activeScenario.id === 'flaky_500' && (
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                <span className="text-slate-400">Failures before recovery:</span>
                <input
                  type="number"
                  min="1"
                  max="4"
                  value={customFlakyCount}
                  onChange={(e) => setCustomFlakyCount(Number(e.target.value))}
                  className="w-16 px-2 py-1 rounded bg-slate-800 border border-slate-700 text-center font-mono text-white"
                />
              </div>
            )}
          </div>
        </div>

        {/* Live Simulation Output Card */}
        <div className="lg:col-span-7 bg-[#0D1527] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <span>Simulation Diagnostic Results</span>
                {testResult && <StatusBadge status={testResult.status} type="status" size="xs" />}
              </h3>
              {testing && <RefreshCw className="w-4 h-4 text-indigo-400 animate-spin" />}
            </div>

            {!testResult && !testing && (
              <div className="py-16 text-center text-slate-500 text-xs font-mono space-y-2">
                <Server className="w-8 h-8 text-slate-600 mx-auto" />
                <p>Click "Test Scenario" above to execute this failure simulation against the mock server.</p>
              </div>
            )}

            {testing && (
              <div className="py-16 text-center text-slate-400 text-xs font-mono space-y-3">
                <RotateCw className="w-8 h-8 text-indigo-400 animate-spin mx-auto" />
                <p>Injecting failure packet & evaluating autonomous FSM response...</p>
              </div>
            )}

            {testResult && (
              <div className="space-y-4 font-mono text-xs">
                {/* Result Summary Bar */}
                <div className="grid grid-cols-3 gap-2 bg-[#111C38] p-3 rounded-xl border border-slate-800 text-center">
                  <div>
                    <span className="text-slate-500 text-[10px] block">Final Status</span>
                    <span className={`font-bold ${testResult.status === 'COMPLETED' ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {testResult.status}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] block">Duration</span>
                    <span className="text-slate-200">{testResult.durationMs || 0}ms</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] block">Attempts</span>
                    <span className="text-amber-400 font-bold">{testResult.steps?.[0]?.attempts || 0} retries</span>
                  </div>
                </div>

                {/* State Machine Transition Sequence */}
                <div>
                  <span className="text-slate-400 text-[11px] font-semibold block mb-1 uppercase font-sans">
                    Observed FSM Transition Sequence ({testResult.fsmHistory.length} events):
                  </span>
                  <div className="p-3 bg-slate-950/70 rounded-xl border border-slate-800 max-h-36 overflow-y-auto space-y-1">
                    {testResult.fsmHistory.map((h, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-[11px]">
                        <span className="text-slate-600">{idx + 1}.</span>
                        <span className="text-slate-400">{h.from || 'START'}</span>
                        <span className="text-indigo-400 font-bold">→</span>
                        <span className="text-indigo-300 font-semibold">{h.to}</span>
                        <span className="text-slate-500 text-[10px]">({h.trigger})</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Step Failure / Recovery Output */}
                {testResult.steps?.[0] && (
                  <div>
                    <span className="text-slate-400 text-[11px] font-semibold block mb-1 uppercase font-sans">
                      Step Execution Diagnostics:
                    </span>
                    <div className="p-3 bg-slate-950/70 rounded-xl border border-slate-800 text-[11px] text-slate-300 space-y-1">
                      <div>Passed: <span className={testResult.steps[0].passed ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>{String(testResult.steps[0].passed)}</span></div>
                      {testResult.steps[0].failureReason && (
                        <div>Reason: <span className="text-amber-300">{testResult.steps[0].failureReason}</span></div>
                      )}
                      <div>Status Code: <span className="text-cyan-300">{testResult.steps[0].response?.status || 'N/A'}</span></div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default RecoveryLab;


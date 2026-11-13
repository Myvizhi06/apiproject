import React from 'react';
import { ArrowRight, CheckCircle2, AlertOctagon, RotateCw, Play, XCircle, ShieldCheck } from 'lucide-react';
import StatusBadge from './StatusBadge';

const ALL_FSM_STATES = [
  { id: 'IDLE', label: 'IDLE', desc: 'Awaiting execution trigger', icon: Play },
  { id: 'VALIDATING', label: 'VALIDATING', desc: 'Grammar & schema checks', icon: ShieldCheck },
  { id: 'RUNNING', label: 'RUNNING', desc: 'Dispatching HTTP requests', icon: RotateCw },
  { id: 'SUCCESS', label: 'SUCCESS', desc: 'Step assertions passed', icon: CheckCircle2 },
  { id: 'FAILED', label: 'FAILED', desc: 'Anomaly or error detected', icon: AlertOctagon },
  { id: 'RETRYING', label: 'RETRYING', desc: 'Exponential backoff wait', icon: RotateCw },
  { id: 'RECOVERING', label: 'RECOVERING', desc: 'Applying recovery strategy', icon: ShieldCheck },
  { id: 'COMPLETED', label: 'COMPLETED', desc: 'Workflow fully verified', icon: CheckCircle2 },
  { id: 'CANCELLED', label: 'CANCELLED', desc: 'Halted by operator', icon: XCircle },
];

export function FsmVisualizer({ currentState = 'IDLE', history = [] }) {
  const latestEvent = history.length > 0 ? history[history.length - 1] : null;

  return (
    <div className="bg-[#0D1527] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
            <span>Automaton State Machine (FSM) Telemetry</span>
            <span className="text-xs font-normal text-slate-400">Deterministic Transition Manager</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time formal state tracking governing step execution, failure detection, and recovery.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400">Current State:</span>
          <StatusBadge status={currentState} type="fsm" size="lg" />
        </div>
      </div>

      {/* Graphical States Map */}
      <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-9 gap-2">
        {ALL_FSM_STATES.map((s) => {
          const isActive = currentState === s.id;
          const wasVisited = history.some(h => h.to === s.id);
          const Icon = s.icon;

          let cardStyle = 'bg-slate-900/40 border-slate-800 text-slate-500';
          if (isActive) {
            if (s.id === 'COMPLETED' || s.id === 'SUCCESS') cardStyle = 'bg-emerald-500/20 border-emerald-500 text-emerald-300 glow-emerald ring-2 ring-emerald-500/30';
            else if (s.id === 'FAILED') cardStyle = 'bg-rose-500/20 border-rose-500 text-rose-300 glow-rose ring-2 ring-rose-500/30';
            else if (s.id === 'RETRYING' || s.id === 'RECOVERING') cardStyle = 'bg-amber-500/20 border-amber-500 text-amber-300 glow-amber ring-2 ring-amber-500/30';
            else if (s.id === 'CANCELLED') cardStyle = 'bg-slate-800 border-slate-600 text-slate-300';
            else cardStyle = 'bg-indigo-600/25 border-indigo-500 text-indigo-300 glow-indigo ring-2 ring-indigo-500/30';
          } else if (wasVisited) {
            cardStyle = 'bg-[#111C38] border-slate-700 text-slate-300';
          }

          return (
            <div
              key={s.id}
              className={`rounded-xl border p-3 flex flex-col items-center text-center transition-all duration-300 ${cardStyle}`}
            >
              <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-black/30 mb-2">
                <Icon className={`w-4 h-4 ${isActive ? 'animate-pulse' : ''}`} />
              </div>
              <div className="text-[11px] font-bold tracking-tight font-mono">{s.label}</div>
              <div className="text-[9px] opacity-70 mt-1 line-clamp-1">{s.desc}</div>
            </div>
          );
        })}
      </div>

      {/* Latest Transition Banner */}
      {latestEvent && (
        <div className="bg-[#111C38] border border-slate-800/80 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Latest Transition:</span>
            <span className="font-mono text-slate-300 font-semibold">{latestEvent.from || 'START'}</span>
            <ArrowRight className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span className="font-mono text-indigo-300 font-bold">{latestEvent.to}</span>
          </div>

          <div className="flex items-center gap-4 text-slate-400">
            {latestEvent.trigger && (
              <div>
                Trigger: <span className="text-slate-200 font-mono font-medium">{latestEvent.trigger}</span>
              </div>
            )}
            {latestEvent.stepId && (
              <div>
                Step: <span className="text-slate-200 font-mono font-medium">{latestEvent.stepId}</span>
              </div>
            )}
            <div className="text-slate-500 font-mono">
              {new Date(latestEvent.timestamp).toLocaleTimeString()}
            </div>
          </div>
        </div>
      )}

      {/* Chronological Transition History Audit Trail */}
      <div>
        <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
          Formal State Transition History ({history.length} events)
        </h4>
        <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-800/80 bg-slate-950/40">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-[#091020] text-slate-400 border-b border-slate-800 sticky top-0">
              <tr>
                <th className="py-2 px-3">#</th>
                <th className="py-2 px-3">Timestamp</th>
                <th className="py-2 px-3">From State</th>
                <th className="py-2 px-3">Target State</th>
                <th className="py-2 px-3">Trigger</th>
                <th className="py-2 px-3">Step Identifier</th>
                <th className="py-2 px-3">Reason / Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {history.map((h, idx) => (
                <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-1.5 px-3 text-slate-500">{idx + 1}</td>
                  <td className="py-1.5 px-3 text-slate-400">{new Date(h.timestamp).toLocaleTimeString()}</td>
                  <td className="py-1.5 px-3 text-slate-400">{h.from || '–'}</td>
                  <td className="py-1.5 px-3">
                    <StatusBadge status={h.to} type="fsm" size="xs" />
                  </td>
                  <td className="py-1.5 px-3 text-indigo-300 font-semibold">{h.trigger}</td>
                  <td className="py-1.5 px-3 text-slate-300">{h.stepId || '–'}</td>
                  <td className="py-1.5 px-3 text-slate-400 truncate max-w-xs">{h.metadata?.reason || 'OK'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default FsmVisualizer;


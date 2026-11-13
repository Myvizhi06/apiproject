import React from 'react';
import { X, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import StatusBadge from './StatusBadge';

export function DrillDownModal({ step, onClose }) {
  if (!step) return null;

  const checks = step.verification?.checks || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#0D1527] border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-slate-100">{step.stepName || step.name}</h3>
              <StatusBadge status={step.passed ? 'PASSED' : 'FAILED'} type="status" size="xs" />
            </div>
            <p className="text-xs text-slate-400 mt-0.5 font-mono">
              Attempts: {step.attempts || 0} | Latency: {step.response?.durationMs || 0}ms
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Failure Summary if failed */}
          {!step.passed && step.failureReason && (
            <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/40 text-xs text-rose-200 font-mono">
              <div className="font-bold text-rose-300 mb-1 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Verification Failure Reason:</span>
              </div>
              <p>{step.failureReason}</p>
            </div>
          )}

          {/* Granular Expected vs Actual Table */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
              Granular Verification Assertions ({checks.length} criteria)
            </h4>
            <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-950/40">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-[#091020] text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Criteria</th>
                    <th className="py-2.5 px-3">Expected</th>
                    <th className="py-2.5 px-3">Actual</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {checks.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="py-4 text-center text-slate-500 font-sans">
                        No custom assertions recorded. Status code check passed.
                      </td>
                    </tr>
                  ) : (
                    checks.map((chk, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/30">
                        <td className="py-2 px-3 font-medium text-slate-300">{chk.name}</td>
                        <td className="py-2 px-3 text-indigo-300 truncate max-w-xs">{String(chk.expected)}</td>
                        <td className="py-2 px-3 text-slate-300 truncate max-w-xs">{String(chk.actual)}</td>
                        <td className="py-2 px-3 text-center">
                          {chk.passed ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-semibold">
                              <CheckCircle2 className="w-3.5 h-3.5" /> PASS
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] text-rose-400 font-semibold">
                              <AlertTriangle className="w-3.5 h-3.5" /> FAIL
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Response Payload Preview */}
          {step.response?.data && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Response Payload Body
              </h4>
              <pre className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 text-[11px] font-mono text-slate-300 max-h-48 overflow-y-auto">
                {JSON.stringify(step.response.data, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#091020] border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors"
          >
            Close Drill-Down
          </button>
        </div>
      </div>
    </div>
  );
}

export default DrillDownModal;


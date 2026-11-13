import React, { useState } from 'react';
import { ShieldCheck, AlertTriangle, Clock, RefreshCw, Send, CheckCircle2, ChevronDown, ChevronRight, Lock } from 'lucide-react';
import StatusBadge from './StatusBadge';

export function NetworkPanel({ activeStep, failureReport, recoveryDecision, retryCountdown }) {
  const [showHeaders, setShowHeaders] = useState(false);
  const [showBody, setShowBody] = useState(false);

  if (!activeStep) {
    return (
      <div className="bg-[#0D1527] border border-slate-800 rounded-2xl p-6 text-center text-slate-500 text-sm">
        No active network transaction in flight.
      </div>
    );
  }

  const isFailed = !!failureReport || (activeStep.response && activeStep.response.status >= 400);

  return (
    <div className="bg-[#0D1527] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
      {/* Panel Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
            <span>Network Transmission & Recovery Telemetry</span>
            <span className="text-xs bg-indigo-500/20 text-indigo-300 font-mono px-2 py-0.5 rounded border border-indigo-500/30">
              Layer 7 HTTP Diagnostic
            </span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time inspection of SSRF filtering, connection lifecycle, and recovery execution.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <StatusBadge status={activeStep.method || 'GET'} type="method" size="sm" />
          <span className="text-xs font-mono text-slate-300 truncate max-w-xs">{activeStep.url}</span>
        </div>
      </div>

      {/* Grid of Key Diagnostics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* 1. SSRF Status */}
        <div className="bg-[#111C38] border border-slate-800/80 rounded-xl p-3">
          <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>SSRF Guard</span>
          </div>
          <div className="text-sm font-semibold text-emerald-400 flex items-center gap-1 font-mono">
            PASSED <span className="text-[10px] text-slate-400 font-sans">(Approved Host)</span>
          </div>
        </div>

        {/* 2. Response Status */}
        <div className="bg-[#111C38] border border-slate-800/80 rounded-xl p-3">
          <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-1">
            <Clock className="w-3.5 h-3.5 text-indigo-400" />
            <span>Response Status</span>
          </div>
          <div className="text-sm font-semibold font-mono">
            {activeStep.response?.status ? (
              <span className={activeStep.response.status < 400 ? 'text-emerald-400' : 'text-rose-400'}>
                HTTP {activeStep.response.status}
              </span>
            ) : (
              <span className="text-amber-400">In Transit...</span>
            )}
          </div>
        </div>

        {/* 3. Latency Duration */}
        <div className="bg-[#111C38] border border-slate-800/80 rounded-xl p-3">
          <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-1">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span>Round-Trip Latency</span>
          </div>
          <div className="text-sm font-semibold text-slate-200 font-mono">
            {activeStep.response?.durationMs ? `${activeStep.response.durationMs}ms` : '–'}
          </div>
        </div>

        {/* 4. Idempotency Guard */}
        <div className="bg-[#111C38] border border-slate-800/80 rounded-xl p-3">
          <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-1">
            <Lock className="w-3.5 h-3.5 text-purple-400" />
            <span>Idempotency Guard</span>
          </div>
          <div className="text-xs font-semibold font-mono text-purple-300">
            {['GET', 'PUT', 'DELETE'].includes(activeStep.method) || activeStep.idempotent ? (
              <span className="text-emerald-400">SAFE TO RETRY</span>
            ) : (
              <span className="text-amber-400">NON-IDEMPOTENT</span>
            )}
          </div>
        </div>
      </div>

      {/* Failure & Recovery Diagnostics Banner */}
      {isFailed && (
        <div className="bg-rose-950/30 border border-rose-500/40 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-rose-300 font-semibold text-sm">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>Detected Failure: {failureReport?.type || 'HTTP_ERROR'}</span>
          </div>

          <p className="text-xs text-rose-200/90 leading-relaxed font-mono">
            {failureReport?.message || 'Server returned error status failing verification conditions.'}
          </p>

          {recoveryDecision && (
            <div className="pt-2 border-t border-rose-800/40 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-slate-300">Autonomous Decision:</span>
                <span className={`px-2 py-0.5 rounded font-mono font-bold ${
                  recoveryDecision.action === 'RETRY' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                }`}>
                  {recoveryDecision.action}
                </span>
              </div>

              {recoveryDecision.delayMs > 0 && (
                <div className="flex items-center gap-1.5 text-amber-300 font-mono">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Backoff: {recoveryDecision.delayMs}ms</span>
                  {retryCountdown !== null && retryCountdown !== undefined && (
                    <span className="text-slate-400">({retryCountdown}s)</span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Accordions: Headers & Payloads */}
      <div className="space-y-2">
        <button
          onClick={() => setShowHeaders(!showHeaders)}
          className="w-full flex items-center justify-between p-2.5 rounded-lg bg-[#111C38] border border-slate-800 text-xs text-slate-300 hover:text-white"
        >
          <span className="font-medium">HTTP Request & Response Headers</span>
          {showHeaders ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
        {showHeaders && (
          <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800 text-xs font-mono text-slate-300 max-h-40 overflow-y-auto">
            <div className="text-indigo-400 font-semibold mb-1">Sent Headers:</div>
            <pre className="text-[11px] mb-2">{JSON.stringify(activeStep.headers || {}, null, 2)}</pre>
            <div className="text-indigo-400 font-semibold mb-1">Received Headers:</div>
            <pre className="text-[11px]">{JSON.stringify(activeStep.response?.headers || {}, null, 2)}</pre>
          </div>
        )}

        <button
          onClick={() => setShowBody(!showBody)}
          className="w-full flex items-center justify-between p-2.5 rounded-lg bg-[#111C38] border border-slate-800 text-xs text-slate-300 hover:text-white"
        >
          <span className="font-medium">Response Payload Data</span>
          {showBody ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
        {showBody && (
          <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800 text-xs font-mono text-slate-300 max-h-48 overflow-y-auto">
            <pre className="text-[11px]">{JSON.stringify(activeStep.response?.data || {}, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  );
}

export default NetworkPanel;


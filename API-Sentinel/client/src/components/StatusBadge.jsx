import React from 'react';

export function StatusBadge({ status, type = 'status', size = 'sm' }) {
  const s = String(status || '').toUpperCase();

  let colorClasses = 'bg-slate-800 text-slate-300 border-slate-700';

  if (type === 'method') {
    switch (s) {
      case 'GET':
        colorClasses = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
        break;
      case 'POST':
        colorClasses = 'bg-blue-500/10 text-blue-400 border-blue-500/30';
        break;
      case 'PUT':
      case 'PATCH':
        colorClasses = 'bg-amber-500/10 text-amber-400 border-amber-500/30';
        break;
      case 'DELETE':
        colorClasses = 'bg-rose-500/10 text-rose-400 border-rose-500/30';
        break;
      default:
        colorClasses = 'bg-purple-500/10 text-purple-400 border-purple-500/30';
    }
  } else if (type === 'fsm' || type === 'status') {
    switch (s) {
      case 'COMPLETED':
      case 'SUCCESS':
      case 'PASSED':
        colorClasses = 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 glow-emerald';
        break;
      case 'RUNNING':
      case 'VALIDATING':
        colorClasses = 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30 animate-pulse';
        break;
      case 'RETRYING':
      case 'RECOVERING':
        colorClasses = 'bg-amber-500/15 text-amber-400 border-amber-500/30 glow-amber';
        break;
      case 'FAILED':
      case 'CONNECTION_ERROR':
      case 'VALIDATION_ERROR':
        colorClasses = 'bg-rose-500/15 text-rose-400 border-rose-500/30 glow-rose';
        break;
      case 'CANCELLED':
        colorClasses = 'bg-slate-700/30 text-slate-400 border-slate-600';
        break;
      case 'IDLE':
      default:
        colorClasses = 'bg-slate-800/40 text-slate-400 border-slate-700';
    }
  }

  const sizeClasses = size === 'xs'
    ? 'text-[10px] px-1.5 py-0.5'
    : size === 'lg'
    ? 'text-sm px-3 py-1 font-semibold'
    : 'text-xs px-2.5 py-0.5 font-medium';

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border ${colorClasses} ${sizeClasses} font-mono tracking-wide`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
      {status}
    </span>
  );
}

export default StatusBadge;


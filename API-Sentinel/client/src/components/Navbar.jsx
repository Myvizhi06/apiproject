import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { simulatorAPI } from '../services/api';
import { LogOut, User, Activity, AlertCircle, RefreshCw, CheckCircle2 } from 'lucide-react';

export function Navbar() {
  const { user, logout } = useAuth();
  const { connected } = useSocket();
  const [activeScenario, setActiveScenario] = useState('success');
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    async function loadSimulator() {
      try {
        const res = await simulatorAPI.getControl();
        setActiveScenario(res.data.activeScenario || 'success');
      } catch (e) {}
    }
    loadSimulator();
  }, []);

  const handleScenarioChange = async (e) => {
    const scenario = e.target.value;
    setActiveScenario(scenario);
    setUpdating(true);
    try {
      await simulatorAPI.setScenario({ scenario });
    } catch (err) {
      console.error('Failed to change scenario:', err);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <header className="h-16 bg-[#0D1527]/90 backdrop-blur-md border-b border-slate-800/80 px-6 flex items-center justify-between z-10 shrink-0">
      {/* Real-time Connection Indicator */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full bg-slate-900/60 border border-slate-800">
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
          <span className="text-slate-300">
            {connected ? 'Real-Time Telemetry Live' : 'Connecting to Server...'}
          </span>
        </div>

        {/* Global Mock Simulator Injector */}
        <div className="hidden md:flex items-center gap-2 text-xs bg-slate-900/60 border border-slate-800 px-3 py-1 rounded-full">
          <Activity className="w-3.5 h-3.5 text-indigo-400" />
          <span className="text-slate-400">Simulator Injection:</span>
          <select
            value={activeScenario}
            onChange={handleScenarioChange}
            className="bg-transparent text-indigo-300 font-medium focus:outline-none cursor-pointer"
          >
            <option value="success" className="bg-[#0D1527] text-slate-200">200 OK (Nominal)</option>
            <option value="flaky_500" className="bg-[#0D1527] text-amber-300">Flaky 500 Spike (Recoverable)</option>
            <option value="timeout" className="bg-[#0D1527] text-rose-300">Gateway Timeout</option>
            <option value="rate_limit_429" className="bg-[#0D1527] text-cyan-300">429 Rate Limit (Retry-After)</option>
            <option value="invalid_json" className="bg-[#0D1527] text-purple-300">Corrupted JSON</option>
            <option value="permanent_500" className="bg-[#0D1527] text-rose-400">Permanent 500 (Exhaustion)</option>
          </select>
          {updating && <RefreshCw className="w-3 h-3 text-slate-400 animate-spin" />}
        </div>
      </div>

      {/* User profile & actions */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-300 font-medium text-xs">
            {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
          </div>
          <div className="hidden sm:block text-left">
            <div className="text-xs font-medium text-slate-200">{user?.name || 'Operator'}</div>
            <div className="text-[10px] text-slate-400 truncate max-w-[140px]">{user?.email}</div>
          </div>
        </div>

        <button
          onClick={logout}
          title="Sign Out"
          className="p-2 rounded-lg text-slate-400 hover:text-rose-300 hover:bg-slate-800/60 transition-colors"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}

export default Navbar;


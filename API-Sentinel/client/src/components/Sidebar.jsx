import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Workflow,
  PlusCircle,
  FileCode2,
  FlaskConical,
  History,
  BarChart3,
  Settings,
  ShieldCheck,
  Cpu,
} from 'lucide-react';

export function Sidebar() {
  const navItems = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/workflows', label: 'Workflows', icon: Workflow },
    { to: '/workflows/new', label: 'Visual Builder', icon: PlusCircle },
    { to: '/asl', label: 'ASL Language Editor', icon: FileCode2 },
    { to: '/lab', label: 'Failure Recovery Lab', icon: FlaskConical },
    { to: '/executions', label: 'Execution History', icon: History },
    { to: '/analytics', label: 'Deep Analytics', icon: BarChart3 },
    { to: '/settings', label: 'System Settings', icon: Settings },
  ];

  return (
    <aside className="w-64 bg-[#0D1527] border-r border-slate-800/80 flex flex-col justify-between shrink-0 select-none">
      <div>
        {/* Brand */}
        <div className="h-16 flex items-center px-6 gap-3 border-b border-slate-800/60">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-slate-100 tracking-tight flex items-center gap-1.5">
              API Sentinel
              <span className="text-[10px] bg-indigo-500/20 text-indigo-300 font-mono px-1.5 py-0.2 rounded border border-indigo-500/30">v1.0</span>
            </div>
            <div className="text-[11px] text-slate-400">Autonomous API Verification</div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-indigo-600/20 to-purple-600/10 text-indigo-300 border border-indigo-500/30 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Engine Status Card */}
      <div className="p-4 m-3 rounded-xl bg-[#111C38] border border-slate-800 text-xs">
        <div className="flex items-center gap-2 text-slate-300 font-medium mb-1.5">
          <Cpu className="w-4 h-4 text-emerald-400 animate-pulse" />
          <span>FSM Engine Active</span>
        </div>
        <p className="text-slate-400 text-[11px] leading-relaxed">
          Autonomous failure recovery & strict idempotency guard enabled.
        </p>
      </div>
    </aside>
  );
}

export default Sidebar;


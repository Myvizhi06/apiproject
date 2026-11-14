import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Workflow,
  Activity,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  Clock,
  TrendingUp,
  Play,
  PlusCircle,
  FileCode2,
  ArrowUpRight,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { analyticsAPI, workflowAPI } from '../services/api';
import StatusBadge from '../components/StatusBadge';

const PIE_COLORS = ['#EF4444', '#F59E0B', '#6366F1', '#8B5CF6', '#06B6D4', '#EC4899'];

export function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [runningDemo, setRunningDemo] = useState(false);
  const navigate = useNavigate();

  const fetchStats = async () => {
    try {
      setLoading(true);
      const res = await analyticsAPI.getDashboard();
      setStats(res.data);
    } catch (err) {
      console.error('Failed to load dashboard metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleRunDemo = async () => {
    setRunningDemo(true);
    try {
      // Find the primary workflow or first workflow
      const wfRes = await workflowAPI.list();
      const workflows = wfRes.data.workflows || [];
      if (workflows.length > 0) {
        const primary = workflows[0];
        const execRes = await workflowAPI.execute(primary._id || primary.id);
        const execId = execRes.data.execution._id || execRes.data.execution.id;
        navigate(`/executions/${execId}`);
      } else {
        navigate('/workflows/new');
      }
    } catch (e) {
      console.error('Failed to execute demo workflow:', e);
    } finally {
      setRunningDemo(false);
    }
  };

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <RefreshCw className="w-6 h-6 animate-spin text-indigo-400" />
          <span className="text-sm font-mono">Aggregating telemetry & DB statistics...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Title & Top Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            API Sentinel Dashboard
            <span className="text-xs bg-emerald-500/10 text-emerald-400 font-mono px-2 py-0.5 rounded-full border border-emerald-500/30">
              Operational
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Automated API verification telemetry, state machine progression, and recovery metrics.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={fetchStats}
            title="Refresh Metrics"
            className="p-2.5 rounded-xl bg-[#0D1527] border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={handleRunDemo}
            disabled={runningDemo}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-medium text-xs shadow-lg shadow-emerald-600/25 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
          >
            <Play className={`w-3.5 h-3.5 ${runningDemo ? 'animate-spin' : ''}`} />
            <span>{runningDemo ? 'Dispatching...' : 'Execute Demo Workflow'}</span>
          </button>

          <Link
            to="/workflows/new"
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-medium text-xs shadow-lg shadow-indigo-600/25 flex items-center gap-2 transition-all"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>New Workflow</span>
          </Link>

          <Link
            to="/asl"
            className="px-3.5 py-2.5 rounded-xl bg-[#0D1527] border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 font-medium text-xs flex items-center gap-1.5 transition-colors"
          >
            <FileCode2 className="w-3.5 h-3.5 text-indigo-400" />
            <span>ASL Editor</span>
          </Link>
        </div>
      </div>

      {/* 7 Core Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3.5">
        {/* Total Workflows */}
        <div className="bg-[#0D1527] border border-slate-800/80 rounded-2xl p-4 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-medium uppercase tracking-wider">Workflows</span>
            <Workflow className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">{stats?.totalWorkflows ?? 0}</div>
          <div className="text-[10px] text-slate-400 mt-1">Configured suites</div>
        </div>

        {/* Total Requests */}
        <div className="bg-[#0D1527] border border-slate-800/80 rounded-2xl p-4 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-medium uppercase tracking-wider">API Calls</span>
            <Activity className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">{stats?.totalApiRequests ?? 0}</div>
          <div className="text-[10px] text-slate-400 mt-1">Total HTTP probes</div>
        </div>

        {/* Successful */}
        <div className="bg-[#0D1527] border border-slate-800/80 rounded-2xl p-4 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-medium uppercase tracking-wider">Successful</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 font-mono">{stats?.successfulExecutions ?? 0}</div>
          <div className="text-[10px] text-slate-400 mt-1">Full completion</div>
        </div>

        {/* Failed */}
        <div className="bg-[#0D1527] border border-slate-800/80 rounded-2xl p-4 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-medium uppercase tracking-wider">Failed</span>
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-bold text-rose-400 font-mono">{stats?.failedExecutions ?? 0}</div>
          <div className="text-[10px] text-slate-400 mt-1">Unrecoverable</div>
        </div>

        {/* Recovery Attempts */}
        <div className="bg-[#0D1527] border border-slate-800/80 rounded-2xl p-4 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-medium uppercase tracking-wider">Recoveries</span>
            <RotateCw className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-400 font-mono">{stats?.recoveryAttempts ?? 0}</div>
          <div className="text-[10px] text-slate-400 mt-1">Retries triggered</div>
        </div>

        {/* Avg Latency */}
        <div className="bg-[#0D1527] border border-slate-800/80 rounded-2xl p-4 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-medium uppercase tracking-wider">Avg Latency</span>
            <Clock className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">{stats?.averageResponseTime ?? 0}ms</div>
          <div className="text-[10px] text-slate-400 mt-1">Round-trip time</div>
        </div>

        {/* Success Rate */}
        <div className="bg-[#0D1527] border border-slate-800/80 rounded-2xl p-4 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-medium uppercase tracking-wider">Reliability</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 font-mono">{stats?.successRate ?? 100}%</div>
          <div className="text-[10px] text-slate-400 mt-1">Workflow pass rate</div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Execution Volume Trend Chart */}
        <div className="lg:col-span-2 bg-[#0D1527] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white">Execution Activity & Latency Trend</h3>
              <p className="text-xs text-slate-400">Aggregated historical workflow runs and latency percentiles</p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5 text-slate-400">
                <span className="w-2.5 h-2.5 rounded-sm bg-indigo-500" /> Completed
              </span>
              <span className="flex items-center gap-1.5 text-slate-400">
                <span className="w-2.5 h-2.5 rounded-sm bg-rose-500" /> Failed
              </span>
            </div>
          </div>

          <div className="h-64 w-full relative">
            {(!stats?.trendChart || stats.trendChart.every((d) => (d.successful || 0) === 0 && (d.failed || 0) === 0)) && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#0D1527]/70 backdrop-blur-[1px] rounded-xl text-center p-4 pointer-events-none">
                <p className="text-xs font-medium text-slate-300">No execution activity recorded in the last 7 days</p>
                <p className="text-[11px] text-slate-500 mt-1">Run a test workflow to populate real-time execution trends</p>
              </div>
            )}
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats?.trendChart || []} margin={{ top: 10, right: 15, left: -10, bottom: 5 }}>
                <defs>
                  <linearGradient id="colorSuccess" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366F1" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="#6366F1" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="colorFailed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#EF4444" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="#EF4444" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
                <XAxis
                  dataKey="date"
                  stroke="#64748B"
                  fontSize={11}
                  tickLine={false}
                  tickFormatter={(val) => (val && val.length >= 10 ? val.slice(5) : val)}
                />
                <YAxis
                  stroke="#64748B"
                  fontSize={11}
                  tickLine={false}
                  allowDecimals={false}
                  domain={[0, (dataMax) => Math.max(dataMax + 1, 4)]}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#091020', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }}
                />
                <Area
                  type="monotone"
                  dataKey="successful"
                  stroke="#6366F1"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorSuccess)"
                  name="Completed"
                  dot={{ r: 3, fill: '#6366F1', strokeWidth: 1 }}
                  activeDot={{ r: 5 }}
                />
                <Area
                  type="monotone"
                  dataKey="failed"
                  stroke="#EF4444"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorFailed)"
                  name="Failed"
                  dot={{ r: 3, fill: '#EF4444', strokeWidth: 1 }}
                  activeDot={{ r: 5 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Failure Distribution */}
        <div className="bg-[#0D1527] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-white">Failure Mode Breakdown</h3>
            <p className="text-xs text-slate-400">Classified anomaly distribution across runs</p>
          </div>

          {stats?.failureDistribution?.length > 0 ? (
            <div className="space-y-4">
              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats.failureDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={5}
                      dataKey="count"
                    >
                      {stats.failureDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#091020', borderColor: '#334155', borderRadius: '8px', fontSize: '11px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-1.5 max-h-24 overflow-y-auto">
                {stats.failureDistribution.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs font-mono text-slate-300">
                    <span className="flex items-center gap-1.5 truncate max-w-[150px]">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }} />
                      {item.name}
                    </span>
                    <span className="font-bold text-slate-400">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-56 flex flex-col items-center justify-center text-slate-500 text-xs text-center space-y-1">
              <ShieldCheck className="w-8 h-8 text-emerald-400/50 mb-1" />
              <p>Zero active failure logs recorded.</p>
              <p className="text-[11px] text-slate-600">Simulate anomalies in the Recovery Lab.</p>
            </div>
          )}
        </div>
      </div>

      {/* Tables: Recent Executions & Failure Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Executions */}
        <div className="bg-[#0D1527] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Recent Workflow Executions</h3>
            <Link to="/executions" className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1">
              <span>View All</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-slate-400 border-b border-slate-800 font-mono">
                <tr>
                  <th className="py-2.5 px-3">Workflow</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Duration</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {(stats?.recentExecutions || []).length === 0 ? (
                  <tr>
                    <td colSpan="4" className="py-6 text-center text-slate-500">
                      No executions recorded yet.
                    </td>
                  </tr>
                ) : (
                  stats.recentExecutions.map((exec) => (
                    <tr key={exec._id || exec.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-2.5 px-3 font-medium text-white truncate max-w-[160px]">
                        {exec.workflowName || 'Workflow'}
                      </td>
                      <td className="py-2.5 px-3">
                        <StatusBadge status={exec.status} type="status" size="xs" />
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-400">{exec.duration || 0}ms</td>
                      <td className="py-2.5 px-3 text-right">
                        <Link
                          to={`/executions/${exec._id || exec.id}`}
                          className="text-indigo-400 hover:text-indigo-300 font-mono font-medium hover:underline"
                        >
                          Telemetry
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Failure Logs */}
        <div className="bg-[#0D1527] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Autonomous Recovery & Failure Log</h3>
            <span className="text-xs text-slate-500 font-mono">{stats?.recentFailures?.length || 0} recent entries</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Failure Type</th>
                  <th className="py-2.5 px-3">Action</th>
                  <th className="py-2.5 px-3">Step</th>
                  <th className="py-2.5 px-3">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {(stats?.recentFailures || []).length === 0 ? (
                  <tr>
                    <td colSpan="4" className="py-6 text-center text-slate-500 font-sans">
                      No active failure events.
                    </td>
                  </tr>
                ) : (
                  stats.recentFailures.map((fail, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-2 px-3 text-rose-300 font-semibold">{fail.failureType}</td>
                      <td className="py-2 px-3">
                        <span className="text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 text-[10px]">
                          {fail.recoveryAction}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-slate-300 truncate max-w-[120px]">{fail.stepName || fail.stepId}</td>
                      <td className="py-2 px-3 text-slate-500">{new Date(fail.timestamp).toLocaleTimeString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;


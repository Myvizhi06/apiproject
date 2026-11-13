import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { analyticsAPI } from '../services/api';

const PIE_COLORS = ['#EF4444', '#F59E0B', '#6366F1', '#8B5CF6', '#06B6D4', '#EC4899'];

export function Analytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const res = await analyticsAPI.getDashboard();
      setData(res.data);
    } catch (err) {
      console.error('Failed to load analytics data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-slate-400 font-mono text-sm">
        <RefreshCw className="w-5 h-5 animate-spin mr-2 text-indigo-400" />
        Computing aggregated telemetry metrics...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <BarChart3 className="w-6 h-6 text-indigo-400" />
            <span>Deep Telemetry & Reliability Analytics</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Aggregated metrics for latency, failure rates, autonomous recovery yield, and volume trends.
          </p>
        </div>

        <button
          onClick={fetchAnalytics}
          className="p-2.5 rounded-xl bg-[#0D1527] border border-slate-800 text-slate-300 hover:text-white transition-colors self-start"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-[#0D1527] border border-slate-800 rounded-2xl p-5 shadow-lg">
          <span className="text-xs text-slate-400 font-medium uppercase">Overall Reliability</span>
          <div className="text-3xl font-bold text-emerald-400 font-mono mt-1">{data?.successRate ?? 100}%</div>
          <span className="text-[11px] text-slate-500 mt-1 block">Pass rate across all executions</span>
        </div>

        <div className="bg-[#0D1527] border border-slate-800 rounded-2xl p-5 shadow-lg">
          <span className="text-xs text-slate-400 font-medium uppercase">Total API Invocations</span>
          <div className="text-3xl font-bold text-white font-mono mt-1">{data?.totalApiRequests ?? 0}</div>
          <span className="text-[11px] text-slate-500 mt-1 block">Live HTTP probes dispatched</span>
        </div>

        <div className="bg-[#0D1527] border border-slate-800 rounded-2xl p-5 shadow-lg">
          <span className="text-xs text-slate-400 font-medium uppercase">Avg Round-Trip Latency</span>
          <div className="text-3xl font-bold text-cyan-400 font-mono mt-1">{data?.averageResponseTime ?? 0}ms</div>
          <span className="text-[11px] text-slate-500 mt-1 block">Network transmission time</span>
        </div>

        <div className="bg-[#0D1527] border border-slate-800 rounded-2xl p-5 shadow-lg">
          <span className="text-xs text-slate-400 font-medium uppercase">Recovery Interventions</span>
          <div className="text-3xl font-bold text-amber-400 font-mono mt-1">{data?.recoveryAttempts ?? 0}</div>
          <span className="text-[11px] text-slate-500 mt-1 block">Autonomous retries triggered</span>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Execution Volume Trend */}
        <div className="bg-[#0D1527] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <h3 className="text-sm font-semibold text-white">Daily Execution Volume & Success</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.trendChart || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
                <XAxis dataKey="date" stroke="#64748B" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748B" fontSize={11} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#091020', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="successful" fill="#6366F1" name="Completed" radius={[4, 4, 0, 0]} />
                <Bar dataKey="failed" fill="#EF4444" name="Failed" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Latency Trends */}
        <div className="bg-[#0D1527] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <h3 className="text-sm font-semibold text-white">Average Latency Duration (ms)</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data?.trendChart || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
                <XAxis dataKey="date" stroke="#64748B" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748B" fontSize={11} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#091020', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }} />
                <Line type="monotone" dataKey="avgDuration" stroke="#06B6D4" strokeWidth={2.5} dot={{ r: 4, fill: '#06B6D4' }} name="Avg Latency (ms)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Analytics;


import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { History, Search, Filter, ExternalLink, RefreshCw, CheckCircle2, AlertOctagon, Clock } from 'lucide-react';
import { executionAPI } from '../services/api';
import StatusBadge from '../components/StatusBadge';
import DrillDownModal from '../components/DrillDownModal';

export function ExecutionHistory() {
  const [executions, setExecutions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStep, setSelectedStep] = useState(null);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const res = await executionAPI.list();
      setExecutions(res.data.executions || []);
    } catch (err) {
      console.error('Failed to load execution history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const filtered = executions.filter((exec) => {
    const matchesStatus = filterStatus === 'ALL' || exec.status === filterStatus;
    const matchesSearch =
      (exec.workflowName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (exec._id || exec.id).toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <History className="w-6 h-6 text-indigo-400" />
            <span>Execution Audit History</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Complete record of automated workflow runs, transition audits, and verification outcomes.
          </p>
        </div>

        <button
          onClick={loadHistory}
          className="p-2.5 rounded-xl bg-[#0D1527] border border-slate-800 text-slate-300 hover:text-white transition-colors self-start"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by workflow name or execution ID..."
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-[#0D1527] border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 rounded-xl bg-[#0D1527] border border-slate-800 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="ALL">All Statuses</option>
            <option value="COMPLETED">Completed</option>
            <option value="FAILED">Failed</option>
            <option value="RUNNING">Running</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
      </div>

      {/* History Table */}
      <div className="bg-[#0D1527] border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-[#091020] text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Execution ID</th>
                <th className="py-3 px-4">Workflow Name</th>
                <th className="py-3 px-4">Outcome</th>
                <th className="py-3 px-4">Duration</th>
                <th className="py-3 px-4">Steps Verified</th>
                <th className="py-3 px-4">Executed At</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan="7" className="py-8 text-center text-slate-500 font-sans">
                    Loading execution history...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-8 text-center text-slate-500 font-sans">
                    No executions matched criteria.
                  </td>
                </tr>
              ) : (
                filtered.map((exec) => {
                  const execId = exec._id || exec.id;
                  const passedSteps = exec.steps ? exec.steps.filter(s => s.passed).length : 0;
                  const totalSteps = exec.steps ? exec.steps.length : 0;

                  return (
                    <tr key={execId} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4 text-indigo-300 font-semibold truncate max-w-[140px]">
                        {execId}
                      </td>
                      <td className="py-3 px-4 font-sans font-medium text-white truncate max-w-[180px]">
                        {exec.workflowName || 'Workflow'}
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge status={exec.status} type="status" size="xs" />
                      </td>
                      <td className="py-3 px-4 text-slate-300">{exec.duration || 0}ms</td>
                      <td className="py-3 px-4">
                        <span className={passedSteps === totalSteps && totalSteps > 0 ? 'text-emerald-400' : 'text-slate-400'}>
                          {passedSteps}/{totalSteps} passed
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-400">
                        {new Date(exec.startTime || exec.createdAt).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-3 font-sans">
                          {exec.steps && exec.steps.length > 0 && (
                            <button
                              onClick={() => setSelectedStep(exec.steps[0])}
                              className="text-xs text-slate-400 hover:text-white"
                            >
                              Step Checks
                            </button>
                          )}
                          <Link
                            to={`/executions/${execId}`}
                            className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1"
                          >
                            <span>Telemetry</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Drill Down Modal */}
      {selectedStep && (
        <DrillDownModal step={selectedStep} onClose={() => setSelectedStep(null)} />
      )}
    </div>
  );
}

export default ExecutionHistory;


import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Workflow,
  PlusCircle,
  Play,
  Edit3,
  Trash2,
  Search,
  RefreshCw,
  ExternalLink,
  Layers,
} from 'lucide-react';
import { workflowAPI } from '../services/api';
import StatusBadge from '../components/StatusBadge';

export function WorkflowsList() {
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [executingId, setExecutingId] = useState(null);
  const navigate = useNavigate();

  const fetchWorkflows = async () => {
    setLoading(true);
    try {
      const res = await workflowAPI.list();
      setWorkflows(res.data.workflows || []);
    } catch (err) {
      console.error('Failed to load workflows:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkflows();
  }, []);

  const handleExecute = async (wfId) => {
    setExecutingId(wfId);
    try {
      const res = await workflowAPI.execute(wfId);
      const execId = res.data.execution._id || res.data.execution.id;
      navigate(`/executions/${execId}`);
    } catch (err) {
      alert(err.response?.data?.message || 'Execution failed.');
    } finally {
      setExecutingId(null);
    }
  };

  const handleDelete = async (wfId, wfName) => {
    if (!window.confirm(`Delete workflow "${wfName}"?`)) return;
    try {
      await workflowAPI.delete(wfId);
      setWorkflows(workflows.filter(w => (w._id || w.id) !== wfId));
    } catch (err) {
      alert('Failed to delete workflow.');
    }
  };

  const filtered = workflows.filter((w) =>
    (w.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (w.description || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Workflow className="w-6 h-6 text-indigo-400" />
            <span>Workflow Library</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Automated verification suites configured for your organization tenant.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchWorkflows}
            className="p-2.5 rounded-xl bg-[#0D1527] border border-slate-800 text-slate-300 hover:text-white transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <Link
            to="/workflows/new"
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-medium text-xs shadow-lg shadow-indigo-600/25 flex items-center gap-2 transition-all"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>New Workflow</span>
          </Link>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter workflows by name or description..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#0D1527] border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
        />
      </div>

      {/* Grid of Workflows */}
      {loading ? (
        <div className="py-12 text-center text-slate-500 font-mono text-xs">Loading workflows...</div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center bg-[#0D1527] border border-slate-800 rounded-2xl text-slate-400 space-y-3">
          <Workflow className="w-10 h-10 text-slate-600 mx-auto" />
          <h3 className="text-sm font-semibold text-white">No workflows found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Get started by creating your first automated workflow using the Visual Builder or ASL Language Editor.
          </p>
          <Link
            to="/workflows/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold"
          >
            <PlusCircle className="w-4 h-4" /> Create Workflow
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((wf) => {
            const wfId = wf._id || wf.id;
            const stepCount = wf.steps?.length || 0;
            const isRunningThis = executingId === wfId;

            return (
              <div
                key={wfId}
                className="bg-[#0D1527] border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-all shadow-xl flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#111C38] text-slate-400 border border-slate-800">
                      {stepCount} steps
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">
                      {new Date(wf.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <Link to={`/workflows/${wfId}`} className="block group">
                    <h3 className="text-base font-bold text-white group-hover:text-indigo-400 transition-colors truncate">
                      {wf.name}
                    </h3>
                  </Link>

                  <p className="text-xs text-slate-400 line-clamp-2 mt-1 leading-relaxed">
                    {wf.description || 'No description provided.'}
                  </p>

                  {/* Step Methods Preview */}
                  <div className="flex flex-wrap items-center gap-1.5 mt-3">
                    {(wf.steps || []).slice(0, 4).map((s, idx) => (
                      <StatusBadge key={idx} status={s.method || 'GET'} type="method" size="xs" />
                    ))}
                    {stepCount > 4 && (
                      <span className="text-[10px] font-mono text-slate-500">+{stepCount - 4} more</span>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                  <button
                    onClick={() => handleExecute(wfId)}
                    disabled={isRunningThis}
                    className="flex-1 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-medium text-xs shadow-md shadow-emerald-600/20 flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
                  >
                    <Play className={`w-3.5 h-3.5 ${isRunningThis ? 'animate-spin' : ''}`} />
                    <span>{isRunningThis ? 'Running...' : 'Execute'}</span>
                  </button>

                  <Link
                    to={`/workflows/${wfId}/edit`}
                    title="Edit Workflow"
                    className="p-2 rounded-xl bg-[#111C38] text-slate-300 hover:text-white border border-slate-700/80 transition-colors"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </Link>

                  <button
                    onClick={() => handleDelete(wfId, wf.name)}
                    title="Delete Workflow"
                    className="p-2 rounded-xl bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 border border-rose-500/30 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default WorkflowsList;


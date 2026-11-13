import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Workflow,
  Play,
  Edit3,
  Trash2,
  FileCode2,
  Clock,
  Layers,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  RotateCw,
} from 'lucide-react';
import { workflowAPI, executionAPI } from '../services/api';
import StatusBadge from '../components/StatusBadge';

export function WorkflowDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [workflow, setWorkflow] = useState(null);
  const [executions, setExecutions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [wfRes, execRes] = await Promise.all([
          workflowAPI.get(id),
          executionAPI.list(),
        ]);
        setWorkflow(wfRes.data.workflow);
        const allExec = execRes.data.executions || [];
        setExecutions(allExec.filter(e => String(e.workflowId) === String(id)));
      } catch (err) {
        setError('Failed to load workflow details.');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [id]);

  const handleExecute = async () => {
    setExecuting(true);
    try {
      const res = await workflowAPI.execute(id);
      const execId = res.data.execution._id || res.data.execution.id;
      navigate(`/executions/${execId}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Execution failed.');
    } finally {
      setExecuting(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete workflow "${workflow.name}"?`)) return;
    try {
      await workflowAPI.delete(id);
      navigate('/workflows');
    } catch (err) {
      setError('Failed to delete workflow.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-slate-400 font-mono text-sm">
        <RotateCw className="w-5 h-5 animate-spin mr-2 text-indigo-400" />
        Loading workflow configuration...
      </div>
    );
  }

  if (!workflow) {
    return (
      <div className="p-8 bg-[#0D1527] border border-slate-800 rounded-2xl text-center text-slate-400">
        Workflow not found or deleted.
      </div>
    );
  }

  const steps = workflow.steps || [];

  return (
    <div className="space-y-6">
      {/* Header & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs text-indigo-400 mb-1">
            <Link to="/workflows" className="hover:underline">Workflows</Link>
            <span className="text-slate-600">/</span>
            <span className="text-slate-400 font-mono">{workflow.name}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            {workflow.name}
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">{workflow.description || 'No description provided.'}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleExecute}
            disabled={executing}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-medium text-xs shadow-lg shadow-emerald-600/30 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
          >
            <Play className={`w-3.5 h-3.5 ${executing ? 'animate-spin' : ''}`} />
            <span>{executing ? 'Starting Run...' : 'Execute Workflow'}</span>
          </button>

          <Link
            to={`/workflows/${id}/edit`}
            className="px-4 py-2.5 rounded-xl bg-[#111C38] border border-slate-700 text-slate-200 hover:text-white hover:bg-slate-800 font-medium text-xs flex items-center gap-1.5 transition-colors"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Edit</span>
          </Link>

          <button
            onClick={handleDelete}
            className="px-3.5 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 hover:bg-rose-500/20 font-medium text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Metadata Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#0D1527] border border-slate-800 rounded-2xl p-4 text-xs font-mono">
        <div>
          <span className="text-slate-500 block">Total Steps:</span>
          <span className="text-white font-bold text-sm">{steps.length}</span>
        </div>
        <div>
          <span className="text-slate-500 block">Total Historical Runs:</span>
          <span className="text-white font-bold text-sm">{executions.length}</span>
        </div>
        <div>
          <span className="text-slate-500 block">Created On:</span>
          <span className="text-slate-300">{new Date(workflow.createdAt).toLocaleDateString()}</span>
        </div>
        <div>
          <span className="text-slate-500 block">SSRF Security:</span>
          <span className="text-emerald-400 font-semibold flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" /> ENFORCED
          </span>
        </div>
      </div>

      {/* Steps Pipeline View */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <Layers className="w-4 h-4 text-indigo-400" />
          <span>Execution Sequence Pipeline ({steps.length} steps)</span>
        </h3>

        <div className="space-y-3">
          {steps.map((step, idx) => (
            <div
              key={step.id || idx}
              className="bg-[#0D1527] border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-all space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/60 pb-3">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-slate-800 text-xs font-mono font-bold flex items-center justify-center text-slate-300">
                    {idx + 1}
                  </span>
                  <div>
                    <h4 className="text-sm font-semibold text-white">{step.name}</h4>
                    <span className="text-xs font-mono text-slate-400">{step.url}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <StatusBadge status={step.method || 'GET'} type="method" size="sm" />
                  <span className="text-xs font-mono text-slate-400 px-2 py-0.5 rounded bg-slate-900 border border-slate-800">
                    Expect: {step.expectedStatus || 200}
                  </span>
                  {step.retries > 0 && (
                    <span className="text-xs font-mono text-amber-400 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                      Retries: {step.retries}
                    </span>
                  )}
                </div>
              </div>

              {/* Extractions & Dependencies */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {step.extract && Object.keys(step.extract).length > 0 && (
                  <div className="p-2.5 rounded-xl bg-[#111C38] border border-slate-800/80 font-mono text-slate-300">
                    <span className="text-slate-500 text-[10px] block uppercase">Outputs Extracted:</span>
                    {Object.entries(step.extract).map(([k, v]) => (
                      <div key={k} className="text-emerald-300 text-[11px] truncate">
                        {k} ← {v}
                      </div>
                    ))}
                  </div>
                )}

                {step.dependsOn && step.dependsOn.length > 0 && (
                  <div className="p-2.5 rounded-xl bg-[#111C38] border border-slate-800/80 font-mono text-slate-300">
                    <span className="text-slate-500 text-[10px] block uppercase">Prerequisites:</span>
                    <span className="text-indigo-300 text-[11px]">{step.dependsOn.join(', ')}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Historical Executions for This Workflow */}
      <div className="bg-[#0D1527] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <h3 className="text-sm font-semibold text-white">Execution History for this Workflow ({executions.length} runs)</h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3">Run ID</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Duration</th>
                <th className="py-2.5 px-3">Steps Outcome</th>
                <th className="py-2.5 px-3">Timestamp</th>
                <th className="py-2.5 px-3 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {executions.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-6 text-center text-slate-500 font-sans">
                    No runs executed yet. Click "Execute Workflow" to start first run.
                  </td>
                </tr>
              ) : (
                executions.map((exec) => (
                  <tr key={exec._id || exec.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-2.5 px-3 text-indigo-300 font-semibold truncate max-w-[120px]">
                      {exec._id || exec.id}
                    </td>
                    <td className="py-2.5 px-3">
                      <StatusBadge status={exec.status} type="status" size="xs" />
                    </td>
                    <td className="py-2.5 px-3">{exec.duration || 0}ms</td>
                    <td className="py-2.5 px-3">
                      {exec.steps ? `${exec.steps.filter(s => s.passed).length}/${exec.steps.length} passed` : '–'}
                    </td>
                    <td className="py-2.5 px-3 text-slate-400">
                      {new Date(exec.startTime || exec.createdAt).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <Link
                        to={`/executions/${exec._id || exec.id}`}
                        className="text-indigo-400 hover:text-indigo-300 font-medium hover:underline"
                      >
                        Telemetry →
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default WorkflowDetails;


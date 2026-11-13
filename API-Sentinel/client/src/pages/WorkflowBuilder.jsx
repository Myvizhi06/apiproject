import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Save,
  Play,
  FileCode2,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Lock,
  ChevronDown,
  ChevronRight,
  Layers,
} from 'lucide-react';
import { workflowAPI } from '../services/api';
import StatusBadge from '../components/StatusBadge';

export function WorkflowBuilder() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = !!id;

  const [name, setName] = useState('New Custom Workflow');
  const [description, setDescription] = useState('');
  const [steps, setSteps] = useState([
    {
      id: 'step_1',
      name: 'AuthenticationStep',
      order: 1,
      method: 'POST',
      url: '/api/demo/login',
      expectedStatus: 200,
      retries: 2,
      timeoutMs: 5000,
      idempotent: false,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'demo_user' }, null, 2),
      extract: { token: 'body.token' },
      dependsOn: [],
    },
  ]);

  const [activeStepIdx, setActiveStepIdx] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (isEditing) {
      async function loadWorkflow() {
        try {
          const res = await workflowAPI.get(id);
          const wf = res.data.workflow;
          setName(wf.name);
          setDescription(wf.description || '');
          if (Array.isArray(wf.steps) && wf.steps.length > 0) {
            setSteps(wf.steps);
          }
        } catch (err) {
          setError('Failed to load workflow for editing.');
        }
      }
      loadWorkflow();
    }
  }, [id, isEditing]);

  const handleAddStep = () => {
    const newIdx = steps.length + 1;
    const newStep = {
      id: `step_${newIdx}_${Date.now().toString(36)}`,
      name: `Step${newIdx}`,
      order: newIdx,
      method: 'GET',
      url: '/api/demo/products',
      expectedStatus: 200,
      retries: 2,
      timeoutMs: 5000,
      idempotent: true,
      headers: {},
      body: '',
      extract: {},
      dependsOn: steps.length > 0 ? [steps[steps.length - 1].name] : [],
    };
    setSteps([...steps, newStep]);
    setActiveStepIdx(steps.length);
  };

  const handleDeleteStep = (index) => {
    if (steps.length === 1) {
      setError('A workflow must contain at least one step.');
      return;
    }
    const updated = steps.filter((_, idx) => idx !== index);
    updated.forEach((s, idx) => { s.order = idx + 1; });
    setSteps(updated);
    setActiveStepIdx(Math.max(0, index - 1));
  };

  const handleMoveStep = (index, direction) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= steps.length) return;
    const updated = [...steps];
    const temp = updated[index];
    updated[index] = updated[targetIdx];
    updated[targetIdx] = temp;
    updated.forEach((s, idx) => { s.order = idx + 1; });
    setSteps(updated);
    setActiveStepIdx(targetIdx);
  };

  const updateActiveStep = (fields) => {
    const updated = [...steps];
    updated[activeStepIdx] = { ...updated[activeStepIdx], ...fields };
    setSteps(updated);
  };

  const handleSave = async () => {
    setError('');
    setSuccessMsg('');
    if (!name.trim()) {
      setError('Workflow name is required.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description,
        steps,
      };

      let savedId = id;
      if (isEditing) {
        await workflowAPI.update(id, payload);
      } else {
        const res = await workflowAPI.create(payload);
        savedId = res.data.workflow._id || res.data.workflow.id;
      }

      setSuccessMsg('Workflow saved successfully!');
      setTimeout(() => {
        navigate(`/workflows/${savedId}`);
      }, 700);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save workflow.');
    } finally {
      setSaving(false);
    }
  };

  const currentStep = steps[activeStepIdx] || steps[0];

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Link to="/workflows" className="text-xs text-indigo-400 hover:underline">
              ← Workflows
            </Link>
            <span className="text-slate-600">/</span>
            <span className="text-xs text-slate-400 font-mono">{isEditing ? 'Editing Workflow' : 'Visual Step Builder'}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white mt-1">
            {isEditing ? `Edit: ${name}` : 'Interactive Workflow Builder'}
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Design multi-step HTTP workflows with automated variable extraction, assertion checks, and backoff recovery.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            to="/asl"
            className="px-3.5 py-2.5 rounded-xl bg-[#0D1527] border border-slate-700 text-slate-300 hover:text-white font-medium text-xs flex items-center gap-1.5 transition-colors"
          >
            <FileCode2 className="w-3.5 h-3.5 text-indigo-400" />
            <span>Open in ASL Editor</span>
          </Link>

          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-medium text-xs shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? 'Saving...' : 'Save Workflow'}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Workflow Metadata Card */}
      <div className="bg-[#0D1527] border border-slate-800 rounded-2xl p-5 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-1">
            <label className="block text-xs font-medium text-slate-300 mb-1">Workflow Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Resilient Order Flow"
              className="w-full px-3.5 py-2 rounded-xl bg-[#111C38] border border-slate-700 text-sm text-white focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-slate-300 mb-1">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Explain the purpose of this automated verification workflow..."
              className="w-full px-3.5 py-2 rounded-xl bg-[#111C38] border border-slate-700 text-sm text-white focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Main Builder Columns: Step List on Left, Active Step Inspector on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Step List & Order */}
        <div className="lg:col-span-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-indigo-400" />
              <span>Execution Steps ({steps.length})</span>
            </h3>
            <button
              onClick={handleAddStep}
              className="px-2.5 py-1 rounded-lg bg-indigo-600/20 border border-indigo-500/40 text-indigo-300 hover:bg-indigo-600/30 text-xs font-medium flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Step</span>
            </button>
          </div>

          <div className="space-y-2">
            {steps.map((step, idx) => {
              const isSelected = idx === activeStepIdx;
              return (
                <div
                  key={step.id || idx}
                  onClick={() => setActiveStepIdx(idx)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                    isSelected
                      ? 'bg-gradient-to-r from-indigo-950/40 to-[#111C38] border-indigo-500/60 shadow-lg glow-indigo'
                      : 'bg-[#0D1527] border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-5 h-5 rounded-full bg-slate-800 text-[10px] font-mono font-bold flex items-center justify-center text-slate-400 shrink-0">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-white truncate">{step.name}</div>
                      <div className="text-[11px] font-mono text-slate-400 truncate">{step.url}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <StatusBadge status={step.method || 'GET'} type="method" size="xs" />
                    <div className="flex items-center">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleMoveStep(idx, -1); }}
                        disabled={idx === 0}
                        title="Move Up"
                        className="p-1 text-slate-500 hover:text-slate-300 disabled:opacity-20"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleMoveStep(idx, 1); }}
                        disabled={idx === steps.length - 1}
                        title="Move Down"
                        className="p-1 text-slate-500 hover:text-slate-300 disabled:opacity-20"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteStep(idx); }}
                        title="Delete Step"
                        className="p-1 text-slate-500 hover:text-rose-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Step Inspector & Field Configuration */}
        {currentStep && (
          <div className="lg:col-span-8 bg-[#0D1527] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                  <span>Step {activeStepIdx + 1}: {currentStep.name}</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Configure HTTP target, retry policy, and assertions</p>
              </div>
              <StatusBadge status={currentStep.method} type="method" size="sm" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Step Identifier */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Step Identifier</label>
                <input
                  type="text"
                  value={currentStep.name}
                  onChange={(e) => updateActiveStep({ name: e.target.value.replace(/[^a-zA-Z0-9_]/g, '') })}
                  className="w-full px-3 py-2 rounded-xl bg-[#111C38] border border-slate-700 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Method */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">HTTP Method</label>
                <select
                  value={currentStep.method}
                  onChange={(e) => updateActiveStep({ method: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-[#111C38] border border-slate-700 text-xs font-mono text-indigo-300 focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="GET">GET (Idempotent)</option>
                  <option value="POST">POST (Non-Idempotent)</option>
                  <option value="PUT">PUT (Idempotent)</option>
                  <option value="PATCH">PATCH (Non-Idempotent)</option>
                  <option value="DELETE">DELETE (Idempotent)</option>
                  <option value="HEAD">HEAD</option>
                  <option value="OPTIONS">OPTIONS</option>
                </select>
              </div>

              {/* Expected Status */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Expected HTTP Status</label>
                <input
                  type="number"
                  value={currentStep.expectedStatus}
                  onChange={(e) => updateActiveStep({ expectedStatus: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl bg-[#111C38] border border-slate-700 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Target URL */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Target Endpoint URL <span className="text-[11px] text-slate-500 font-sans">(Supports variables, e.g. /api/items/{"{{steps.Login.id}}"})</span>
              </label>
              <input
                type="text"
                value={currentStep.url}
                onChange={(e) => updateActiveStep({ url: e.target.value })}
                placeholder="/api/demo/products"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#111C38] border border-slate-700 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Retries, Timeout & Idempotency Safeguards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-xl bg-[#111C38]/60 border border-slate-800">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Retry Attempts (0-5)</label>
                <input
                  type="number"
                  min="0"
                  max="5"
                  value={currentStep.retries || 0}
                  onChange={(e) => updateActiveStep({ retries: Math.min(5, Math.max(0, Number(e.target.value))) })}
                  className="w-full px-3 py-1.5 rounded-lg bg-[#0D1527] border border-slate-700 text-xs font-mono text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Timeout (ms)</label>
                <input
                  type="number"
                  step="500"
                  value={currentStep.timeoutMs || 5000}
                  onChange={(e) => updateActiveStep({ timeoutMs: Number(e.target.value) })}
                  className="w-full px-3 py-1.5 rounded-lg bg-[#0D1527] border border-slate-700 text-xs font-mono text-white"
                />
              </div>

              <div className="flex flex-col justify-center">
                <label className="text-xs font-medium text-slate-300 mb-1 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Idempotency Safe</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer mt-1">
                  <input
                    type="checkbox"
                    checked={Boolean(currentStep.idempotent)}
                    onChange={(e) => updateActiveStep({ idempotent: e.target.checked })}
                    className="rounded bg-slate-800 border-slate-600 text-indigo-600 focus:ring-0"
                  />
                  <span className="text-xs text-slate-300">Allow retries on failure</span>
                </label>
              </div>
            </div>

            {/* Request Headers JSON / Key-Value */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                HTTP Headers (JSON format)
              </label>
              <textarea
                rows={3}
                value={typeof currentStep.headers === 'string' ? currentStep.headers : JSON.stringify(currentStep.headers || {}, null, 2)}
                onChange={(e) => {
                  try {
                    const parsed = JSON.parse(e.target.value);
                    updateActiveStep({ headers: parsed });
                  } catch (err) {
                    updateActiveStep({ headers: e.target.value });
                  }
                }}
                className="w-full p-3 rounded-xl bg-[#111C38] border border-slate-700 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Request Body (for POST / PUT / PATCH) */}
            {['POST', 'PUT', 'PATCH'].includes(currentStep.method) && (
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Request Payload Body (JSON or String)
                </label>
                <textarea
                  rows={4}
                  value={typeof currentStep.body === 'string' ? currentStep.body : JSON.stringify(currentStep.body || {}, null, 2)}
                  onChange={(e) => updateActiveStep({ body: e.target.value })}
                  placeholder='{"username": "tester", "id": "{{steps.Step1.id}}"}'
                  className="w-full p-3 rounded-xl bg-[#111C38] border border-slate-700 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>
            )}

            {/* Variable Extraction */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Output Variable Extractions (JSON: varName → objectPath)
              </label>
              <input
                type="text"
                value={JSON.stringify(currentStep.extract || {})}
                onChange={(e) => {
                  try {
                    const parsed = JSON.parse(e.target.value);
                    updateActiveStep({ extract: parsed });
                  } catch (err) {}
                }}
                placeholder='{"authToken": "body.token", "paymentId": "body.paymentId"}'
                className="w-full px-3.5 py-2 rounded-xl bg-[#111C38] border border-slate-700 text-xs font-mono text-emerald-300 focus:outline-none focus:border-indigo-500"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Extracted variables can be used in downstream steps via <code className="text-indigo-300">{"{{steps." + currentStep.name + ".<varName>}}"}</code>.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default WorkflowBuilder;


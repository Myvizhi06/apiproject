import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileCode2,
  CheckCircle2,
  AlertTriangle,
  Play,
  Save,
  Layers,
  Sparkles,
  RefreshCw,
  Copy,
  Code2,
} from 'lucide-react';
import { aslAPI, workflowAPI } from '../services/api';

const ASL_TEMPLATES = {
  ecommerce: `// API Sentinel Language (ASL) Specification
// Scenario: E-Commerce Resilient Order Pipeline

WORKFLOW ECommerceOrderPipeline {
  STEP UserAuthentication {
    METHOD POST
    URL "/api/demo/login"
    EXPECT 200
    RETRY 2
    TIMEOUT 5000
    HEADER "Content-Type" "application/json"
    BODY "{\\"username\\": \\"demo_operator\\", \\"password\\": \\"SentinelPass123!\\"}"
    EXTRACT authToken "body.token"
  }

  STEP FetchCatalog {
    METHOD GET
    URL "/api/demo/products"
    EXPECT 200
    RETRY 3
    TIMEOUT 5000
    IDEMPOTENT true
    HEADER "Authorization" "Bearer {{steps.UserAuthentication.authToken}}"
    DEPENDS UserAuthentication
    EXTRACT productId "body.products[0].id"
  }

  STEP ProcessPayment {
    METHOD POST
    URL "/api/demo/payment"
    EXPECT 200
    RETRY 3
    TIMEOUT 6000
    IDEMPOTENT true
    HEADER "Idempotency-Key" "idemp_order_998811"
    BODY "{\\"amount\\": 149.99, \\"currency\\": \\"USD\\"}"
    DEPENDS FetchCatalog
    EXTRACT paymentId "body.paymentId"
  }

  STEP ConfirmOrder {
    METHOD POST
    URL "/api/demo/order"
    EXPECT 200
    RETRY 2
    TIMEOUT 5000
    BODY "{\\"productId\\": \\"{{steps.FetchCatalog.productId}}\\", \\"paymentId\\": \\"{{steps.ProcessPayment.paymentId}}\\", \\"quantity\\": 1}"
    DEPENDS ProcessPayment
  }
}
`,
  flaky: `// API Sentinel Language (ASL)
// Scenario: Transient HTTP 500 Fault Recovery Test

WORKFLOW TransientSpikeRecovery {
  STEP ProbeFlakyEndpoint {
    METHOD GET
    URL "/api/demo/products?scenario=flaky_500"
    EXPECT 200
    RETRY 3
    TIMEOUT 4000
    IDEMPOTENT true
    HEADER "Authorization" "Bearer mock_token"
  }
}
`,
  ratelimit: `// API Sentinel Language (ASL)
// Scenario: HTTP 429 Rate Limit with Retry-After Backoff

WORKFLOW RateLimitBackoffVerification {
  STEP ThrottledRequest {
    METHOD GET
    URL "/api/demo/products?scenario=rate_limit_429"
    EXPECT 200
    RETRY 3
    TIMEOUT 5000
    IDEMPOTENT true
    HEADER "Authorization" "Bearer mock_token"
  }
}
`,
};

export function AslEditor() {
  const [code, setCode] = useState(ASL_TEMPLATES.ecommerce);
  const [validation, setValidation] = useState(null);
  const [validating, setValidating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [activeTab, setActiveTab] = useState('ast'); // 'ast' | 'executable'
  const [notice, setNotice] = useState('');
  const navigate = useNavigate();

  // Validate on code change with debounce
  useEffect(() => {
    const timer = setTimeout(async () => {
      setValidating(true);
      try {
        const res = await aslAPI.validate(code);
        setValidation(res.data);
      } catch (err) {
        setValidation({
          valid: false,
          errors: err.response?.data?.errors || [{ message: err.message, line: 1, column: 1 }],
          warnings: [],
        });
      } finally {
        setValidating(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [code]);

  const handleSelectTemplate = (key) => {
    if (ASL_TEMPLATES[key]) {
      setCode(ASL_TEMPLATES[key]);
      setNotice(`Loaded ${key} template.`);
      setTimeout(() => setNotice(''), 2000);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await aslAPI.save({ code, description: 'Compiled via ASL Editor' });
      const wf = res.data.workflow;
      navigate(`/workflows/${wf._id || wf.id}`);
    } catch (err) {
      setNotice(err.response?.data?.message || 'Failed to save workflow.');
    } finally {
      setSaving(false);
    }
  };

  const handleRun = async () => {
    setRunning(true);
    try {
      const saveRes = await aslAPI.save({ code, description: 'Run from ASL Editor' });
      const wf = saveRes.data.workflow;
      const execRes = await workflowAPI.execute(wf._id || wf.id);
      const execId = execRes.data.execution._id || execRes.data.execution.id;
      navigate(`/executions/${execId}`);
    } catch (err) {
      setNotice(err.response?.data?.message || 'Execution failed.');
    } finally {
      setRunning(false);
    }
  };

  const lineCount = code.split('\n').length;
  const lineNumbers = Array.from({ length: lineCount }, (_, i) => i + 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <FileCode2 className="w-6 h-6 text-indigo-400" />
            <span>ASL (API Sentinel Language) Compiler & Editor</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Lexical analysis, recursive-descent parsing, AST generation, and semantic validation.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleSave}
            disabled={saving || !validation?.valid}
            className="px-4 py-2.5 rounded-xl bg-[#111C38] border border-slate-700 text-slate-200 hover:text-white hover:bg-slate-800 text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-40 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? 'Compiling...' : 'Save to DB'}</span>
          </button>

          <button
            onClick={handleRun}
            disabled={running || !validation?.valid}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-xs shadow-lg shadow-emerald-600/30 flex items-center gap-2 transition-all disabled:opacity-40 cursor-pointer"
          >
            <Play className={`w-3.5 h-3.5 ${running ? 'animate-spin' : ''}`} />
            <span>{running ? 'Executing...' : 'Compile & Run'}</span>
          </button>
        </div>
      </div>

      {notice && (
        <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-mono">
          {notice}
        </div>
      )}

      {/* Template Quick Pickers */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-slate-400 font-medium">Grammar Templates:</span>
        <button
          onClick={() => handleSelectTemplate('ecommerce')}
          className="px-2.5 py-1 rounded-lg bg-[#0D1527] border border-slate-800 text-slate-300 hover:border-indigo-500 hover:text-indigo-300 transition-colors"
        >
          E-Commerce Resilient Pipeline
        </button>
        <button
          onClick={() => handleSelectTemplate('flaky')}
          className="px-2.5 py-1 rounded-lg bg-[#0D1527] border border-slate-800 text-slate-300 hover:border-indigo-500 hover:text-indigo-300 transition-colors"
        >
          Transient 500 Fault Spike
        </button>
        <button
          onClick={() => handleSelectTemplate('ratelimit')}
          className="px-2.5 py-1 rounded-lg bg-[#0D1527] border border-slate-800 text-slate-300 hover:border-indigo-500 hover:text-indigo-300 transition-colors"
        >
          429 Rate Limit + Retry-After
        </button>
      </div>

      {/* Editor & AST Viewer Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Code Editor */}
        <div className="lg:col-span-7 bg-[#0D1527] border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-3">
            <span className="text-xs font-semibold text-slate-300 font-mono">Source Editor (.asl)</span>
            <div className="flex items-center gap-2 text-xs">
              {validating ? (
                <span className="text-slate-400 flex items-center gap-1 font-mono">
                  <RefreshCw className="w-3 h-3 animate-spin text-indigo-400" /> Parsing...
                </span>
              ) : validation?.valid ? (
                <span className="text-emerald-400 flex items-center gap-1 font-mono font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Grammar Valid
                </span>
              ) : (
                <span className="text-rose-400 flex items-center gap-1 font-mono font-semibold">
                  <AlertTriangle className="w-3.5 h-3.5" /> Syntax/Semantic Error
                </span>
              )}
            </div>
          </div>

          {/* Line Numbers + Textarea Container */}
          <div className="flex rounded-xl bg-slate-950/90 border border-slate-800/80 overflow-hidden min-h-[460px]">
            {/* Line numbers */}
            <div className="py-3 px-2 text-right bg-slate-900/60 text-slate-600 font-mono text-xs select-none border-r border-slate-800">
              {lineNumbers.map((num) => (
                <div key={num}>{num}</div>
              ))}
            </div>

            {/* Code Input */}
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              spellCheck="false"
              className="flex-1 p-3 bg-transparent text-xs font-mono text-indigo-200 focus:outline-none resize-none leading-relaxed"
            />
          </div>

          {/* Error / Warning Output Console */}
          {validation && !validation.valid && (
            <div className="mt-3 p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-xs font-mono text-rose-300 space-y-1">
              <div className="font-bold text-rose-400">Compilation Diagnostics:</div>
              {validation.errors?.map((err, i) => (
                <div key={i} className="text-[11px]">
                  • Line {err.line || 1}:{err.column || 1} - {err.message}
                </div>
              ))}
            </div>
          )}

          {validation && validation.warnings?.length > 0 && (
            <div className="mt-3 p-3 rounded-xl bg-amber-950/40 border border-amber-500/40 text-xs font-mono text-amber-300 space-y-1">
              <div className="font-bold text-amber-400">Semantic Warnings:</div>
              {validation.warnings.map((w, i) => (
                <div key={i} className="text-[11px]">• {w.message}</div>
              ))}
            </div>
          )}
        </div>

        {/* Abstract Syntax Tree (AST) & Executable Schema Inspector */}
        <div className="lg:col-span-5 bg-[#0D1527] border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab('ast')}
                className={`px-3 py-1 rounded-lg text-xs font-mono font-medium transition-colors ${
                  activeTab === 'ast' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                AST Hierarchy
              </button>
              <button
                onClick={() => setActiveTab('executable')}
                className={`px-3 py-1 rounded-lg text-xs font-mono font-medium transition-colors ${
                  activeTab === 'executable' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Executable Config
              </button>
            </div>

            <span className="text-[11px] font-mono text-slate-500">
              {validation?.ast?.steps?.length || 0} AST steps
            </span>
          </div>

          <div className="flex-1 bg-slate-950/80 rounded-xl border border-slate-800/80 p-3 font-mono text-[11px] text-slate-300 overflow-y-auto max-h-[500px]">
            {activeTab === 'ast' ? (
              <pre>{JSON.stringify(validation?.ast || {}, null, 2)}</pre>
            ) : (
              <pre>{JSON.stringify(validation?.executableWorkflow || {}, null, 2)}</pre>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AslEditor;


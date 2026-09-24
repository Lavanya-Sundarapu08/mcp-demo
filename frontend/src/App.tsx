import React, { useState, useEffect, useRef } from "react";
import {
  Play,
  CheckCircle,
  XCircle,
  AlertTriangle,
  GitPullRequest,
  Terminal,
  Database,
  MessageSquare,
  FileCode,
  Cpu,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  BookOpen,
  ClipboardList,
  Sparkles,
  Download,
  CheckCircle2,
  FileText,
  Lock,
  User,
  LogOut,
  KeyRound,
  ShieldAlert,
  Fingerprint
} from "lucide-react";

interface AgentStep {
  step: number;
  thought?: string;
  tool_name?: string;
  arguments?: any;
  result?: any;
}

interface CodeDiff {
  filepath: string;
  original_code: string;
  proposed_code: string;
  diff_text: string;
}

interface EvidenceCitation {
  source_type: string;
  title: string;
  detail: string;
  confidence: number;
}

interface RootCauseAnalysis {
  summary: string;
  root_cause: string;
  impact_scope: string;
  severity: string;
  evidence_citations: EvidenceCitation[];
}

interface AITestCase {
  test_filepath: string;
  test_code: string;
  test_name: string;
  initial_status: string;
  verified_status: string;
  stdout?: string;
}

interface AuditLogEntry {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  tool_name?: string;
  parameters?: any;
  result_summary?: string;
  status: string;
  governance_check?: string;
}

interface SessionData {
  session_id: string;
  issue_id: number;
  status: string;
  provider: string;
  model: string;
  steps: AgentStep[];
  diff?: CodeDiff;
  test_result?: { passed: boolean; stdout: string };
  rca?: RootCauseAnalysis;
  generated_test?: AITestCase;
  audit_log?: AuditLogEntry[];
  pull_request?: { number: number; title: string; html_url: string; head: string; base: string };
  final_summary?: string;
  telemetry?: {
    latency_seconds: number;
    tokens_used: number;
    tool_calls_count: number;
    cost_usd: number;
  };
}

interface UserAuth {
  username: string;
  role: "LEAD_ENGINEER" | "DEVELOPER";
  displayName: string;
}

export default function App() {
  // Authentication & RBAC State
  const [auth, setAuth] = useState<UserAuth | null>(() => {
    const saved = localStorage.getItem("mcp_auth_user");
    return saved ? JSON.parse(saved) : null;
  });
  const [loginUsername, setLoginUsername] = useState("admin");
  const [loginPassword, setLoginPassword] = useState("admin123");
  const [loginError, setLoginError] = useState("");

  const [issueId, setIssueId] = useState<number>(101);
  const [provider, setProvider] = useState<string>("gemini");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"diff" | "rca" | "tests" | "audit">("diff");
  const [expandedSteps, setExpandedSteps] = useState<{ [key: number]: boolean }>({});
  const [wsConnected, setWsConnected] = useState<boolean>(false);
  const [auditFilter, setAuditFilter] = useState<string>("ALL");

  const wsRef = useRef<WebSocket | null>(null);
  const timelineEndRef = useRef<HTMLDivElement | null>(null);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");

    if (loginUsername === "admin" && loginPassword === "admin123") {
      const user: UserAuth = {
        username: "admin",
        role: "LEAD_ENGINEER",
        displayName: "Lavanya (Lead Engineer)"
      };
      setAuth(user);
      localStorage.setItem("mcp_auth_user", JSON.stringify(user));
    } else if (loginUsername === "developer" && loginPassword === "dev123") {
      const user: UserAuth = {
        username: "developer",
        role: "DEVELOPER",
        displayName: "Alex (Junior Developer)"
      };
      setAuth(user);
      localStorage.setItem("mcp_auth_user", JSON.stringify(user));
    } else {
      setLoginError("Invalid credentials. Use demo accounts below.");
    }
  };

  const handleQuickLogin = (role: "LEAD_ENGINEER" | "DEVELOPER" | "GITHUB") => {
    let user: UserAuth;
    if (role === "GITHUB" || role === "LEAD_ENGINEER") {
      user = {
        username: "Lavanya-Sundarapu08",
        role: "LEAD_ENGINEER",
        displayName: "@Lavanya-Sundarapu08 (Lead Engineer)"
      };
    } else {
      user = {
        username: "alex_dev",
        role: "DEVELOPER",
        displayName: "Alex (Software Engineer)"
      };
    }
    setAuth(user);
    localStorage.setItem("mcp_auth_user", JSON.stringify(user));
  };

  const handleLogout = () => {
    setAuth(null);
    localStorage.removeItem("mcp_auth_user");
  };

  // Connect WebSocket when sessionId is established
  useEffect(() => {
    if (!sessionId) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.hostname || "localhost";
    const port = window.location.port ? `:${window.location.port}` : "";
    const wsUrl = `${protocol}//${host}${port}/ws/${sessionId}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        handleStreamEvent(payload);
      } catch (err) {
        console.error("WS Parse error", err);
      }
    };

    ws.onerror = () => {
      setWsConnected(false);
    };

    ws.onclose = () => {
      setWsConnected(false);
    };

    return () => {
      ws.close();
    };
  }, [sessionId]);

  // Resilient Polling Fallback: If WebSocket is disconnected, poll session every 800ms
  useEffect(() => {
    if (!sessionId) return;
    if (session?.status === "COMPLETE" || session?.status === "REJECTED") return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/session/${sessionId}`);
        if (res.ok) {
          const data = await res.json();
          setSession((prev) => {
            if (!prev) return data;
            return {
              ...prev,
              status: data.status,
              diff: data.diff || prev.diff,
              test_result: data.test_result || prev.test_result,
              rca: data.rca || prev.rca,
              generated_test: data.generated_test || prev.generated_test,
              audit_log: data.audit_log || prev.audit_log,
              pull_request: data.pull_request || prev.pull_request,
              final_summary: data.final_summary || prev.final_summary,
              steps: data.steps && data.steps.length > 0 ? data.steps.map((s: any) => ({
                step: s.step_number,
                thought: s.thought,
                tool_name: s.tool_name,
                arguments: s.tool_arguments,
                result: s.tool_result
              })) : prev.steps
            };
          });
        }
      } catch (e) {
        // ignore polling errors
      }
    }, 800);

    return () => clearInterval(interval);
  }, [sessionId, session?.status, wsConnected]);

  // Auto-scroll timeline to latest thought
  useEffect(() => {
    timelineEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [session?.steps]);

  const handleStreamEvent = (event: any) => {
    const { type, data } = event;

    setSession((prev) => {
      if (!prev) return prev;
      const updated = { ...prev };

      if (type === "thought") {
        const existing = updated.steps.find((s) => s.step === data.step);
        if (existing) {
          existing.thought = data.thought;
        } else {
          updated.steps.push({ step: data.step, thought: data.thought });
        }
      } else if (type === "tool_call") {
        let step = updated.steps.find((s) => s.step === data.step);
        if (!step) {
          step = { step: data.step };
          updated.steps.push(step);
        }
        step.tool_name = data.tool_name;
        step.arguments = data.arguments;
      } else if (type === "tool_result") {
        const step = updated.steps.find((s) => s.step === data.step);
        if (step) {
          step.result = data.result;
        }
      } else if (type === "diff_generated") {
        updated.diff = {
          filepath: data.filepath,
          original_code: "",
          proposed_code: "",
          diff_text: data.diff_text
        };
      } else if (type === "test_result") {
        updated.test_result = {
          passed: data.passed,
          stdout: data.stdout
        };
      } else if (type === "rca_generated") {
        updated.rca = data;
      } else if (type === "test_generated" || type === "test_status_update") {
        updated.generated_test = data;
      } else if (type === "audit_entry") {
        if (!updated.audit_log) updated.audit_log = [];
        updated.audit_log.push(data);
      } else if (type === "telemetry_update") {
        updated.telemetry = data;
      } else if (type === "awaiting_approval") {
        updated.status = "AWAITING_APPROVAL";
        if (data.diff) updated.diff = data.diff;
        if (data.summary) updated.final_summary = data.summary;
        if (data.rca) updated.rca = data.rca;
        if (data.generated_test) updated.generated_test = data.generated_test;
        if (data.telemetry) updated.telemetry = data.telemetry;
      } else if (type === "approval_received") {
        updated.status = "COMMITTING";
      } else if (type === "session_complete") {
        updated.status = "COMPLETE";
        updated.pull_request = data.pull_request;
      } else if (type === "session_rejected") {
        updated.status = "REJECTED";
      }

      return updated;
    });
  };

  const startInvestigation = async () => {
    setLoading(true);
    setSession(null);
    try {
      const res = await fetch("/api/investigate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issue_id: issueId, provider })
      });
      const data = await res.json();
      setSessionId(data.session_id);
      setSession({
        session_id: data.session_id,
        issue_id: data.issue_id,
        status: data.status,
        provider: data.provider,
        model: data.model,
        steps: [],
        audit_log: []
      });
    } catch (err) {
      alert("Failed to start session. Ensure the backend server is running.");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!sessionId) return;
    if (auth?.role !== "LEAD_ENGINEER") {
      alert("Permission Denied: Human-in-the-Loop Git approval requires Lead Engineer clearance.");
      return;
    }
    try {
      await fetch("/api/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId })
      });
    } catch (err) {
      alert("Approval request failed.");
    }
  };

  const handleReject = async () => {
    if (!sessionId) return;
    try {
      await fetch("/api/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId })
      });
    } catch (err) {
      alert("Rejection request failed.");
    }
  };

  const toggleStep = (stepNumber: number) => {
    setExpandedSteps((prev) => ({
      ...prev,
      [stepNumber]: !prev[stepNumber]
    }));
  };

  const exportAuditLog = (format: "json" | "markdown") => {
    if (!session?.audit_log || session.audit_log.length === 0) {
      alert("No audit records available to export.");
      return;
    }

    let fileContent = "";
    let mimeType = "text/plain";
    let fileName = `audit_report_session_${session.session_id}.${format === "json" ? "json" : "md"}`;

    if (format === "json") {
      fileContent = JSON.stringify(session.audit_log, null, 2);
      mimeType = "application/json";
    } else {
      fileContent = `# Autonomous Agent Audit Trail & Governance Report\n\n`;
      fileContent += `**Session ID**: \`${session.session_id}\`\n`;
      fileContent += `**Target Issue**: #${session.issue_id}\n`;
      fileContent += `**Authorized By**: ${auth?.displayName || "Operator"}\n`;
      fileContent += `**Timestamp**: ${new Date().toISOString()}\n`;
      fileContent += `**Status**: ${session.status}\n\n`;
      fileContent += `## Immutable Audit Log\n\n`;
      fileContent += `| Timestamp | Actor | Action | Status | Governance Check |\n`;
      fileContent += `|---|---|---|---|---|\n`;
      session.audit_log.forEach((entry) => {
        fileContent += `| ${entry.timestamp.substring(11, 19)} | ${entry.actor} | ${entry.action} | ${entry.status} | ${entry.governance_check || "N/A"} |\n`;
      });
    }

    const blob = new Blob([fileContent], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  };

  const filteredAuditLog = session?.audit_log?.filter((entry) => {
    if (auditFilter === "ALL") return true;
    return entry.actor === auditFilter;
  }) || [];

  // -------------------------------------------------------------
  // RENDER: Developer Login & Security Gateway (If Unauthenticated)
  // -------------------------------------------------------------
  if (!auth) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 relative overflow-hidden font-sans">
        {/* Subtle background glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 left-1/3 w-80 h-80 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-2xl p-8 shadow-2xl backdrop-blur relative z-10 space-y-6">
          {/* Logo & Header */}
          <div className="text-center space-y-2">
            <div className="inline-flex w-12 h-12 rounded-xl bg-gradient-to-tr from-indigo-500 to-emerald-400 items-center justify-center shadow-lg shadow-indigo-500/20 mb-1">
              <ShieldCheck className="w-7 h-7 text-slate-950 font-bold" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white">
              MCP Developer Portal
            </h1>
            <p className="text-xs text-slate-400">
              Autonomous Software Engineering Agent • Role-Based Access Control
            </p>
          </div>

          {/* Quick Demo Login Pills */}
          <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 space-y-2">
            <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block">
              Quick Demo Access (Select Role):
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleQuickLogin("LEAD_ENGINEER")}
                className="p-2 rounded-lg bg-indigo-950/60 hover:bg-indigo-900/60 border border-indigo-700/50 text-indigo-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                <span>Tech Lead</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin("DEVELOPER")}
                className="p-2 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-700/50 text-emerald-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
              >
                <User className="w-3.5 h-3.5 text-emerald-400" />
                <span>Developer</span>
              </button>
            </div>
            <button
              type="button"
              onClick={() => handleQuickLogin("GITHUB")}
              className="w-full p-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-2 transition"
            >
              <GitPullRequest className="w-3.5 h-3.5 text-purple-400" />
              <span>Sign In with GitHub (@Lavanya-Sundarapu08)</span>
            </button>
          </div>

          {/* Manual Login Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            {loginError && (
              <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs text-slate-300 font-medium block">Username</label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="text"
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  placeholder="admin or developer"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-300 font-medium block">Password</label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="admin123 or dev123"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 px-4 rounded-lg font-semibold text-sm bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 flex items-center justify-center space-x-2 transition"
            >
              <Lock className="w-4 h-4" />
              <span>Authenticate & Enter Console</span>
            </button>
          </form>

          {/* Security Architecture Badges */}
          <div className="pt-3 border-t border-slate-800 text-[11px] text-slate-500 flex items-center justify-between">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> RBAC Enforced
            </span>
            <span className="flex items-center gap-1">
              <Fingerprint className="w-3.5 h-3.5 text-indigo-400" /> Least-Privilege MCP
            </span>
            <span className="flex items-center gap-1">
              <ClipboardList className="w-3.5 h-3.5 text-cyan-400" /> Audit Logged
            </span>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // RENDER: Authenticated Engineering Dashboard
  // -------------------------------------------------------------
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Navigation */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur px-6 py-3.5 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-emerald-400 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Cpu className="w-5 h-5 text-slate-950 font-bold" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
              MCP-Powered AI Software Engineer
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                v2.0 Advanced
              </span>
            </h1>
            <p className="text-[11px] text-slate-400">
              Autonomous Multi-Tool Bug Investigation • RAG • Root Cause Analysis • AI Test Gen • Audit Trail
            </p>
          </div>
        </div>

        {/* User Badge, Status Indicators & Sign Out */}
        <div className="flex items-center space-x-3">
          {/* User Role Badge */}
          <div className="flex items-center space-x-2 text-xs bg-slate-800/90 px-3 py-1.5 rounded-lg border border-slate-700">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-semibold text-slate-200">{auth.displayName}</span>
            <span
              className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${
                auth.role === "LEAD_ENGINEER"
                  ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                  : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
              }`}
            >
              {auth.role === "LEAD_ENGINEER" ? "Tech Lead" : "Developer"}
            </span>
          </div>

          {/* Model Selector */}
          <div className="flex items-center space-x-1.5 bg-slate-800/80 p-1 rounded-lg border border-slate-700">
            <button
              onClick={() => setProvider("gemini")}
              className={`text-[11px] px-2.5 py-1 rounded font-medium transition ${
                provider === "gemini" ? "bg-indigo-600 text-white shadow" : "text-slate-400 hover:text-white"
              }`}
            >
              Gemini 2.0
            </button>
            <button
              onClick={() => setProvider("ollama")}
              className={`text-[11px] px-2.5 py-1 rounded font-medium transition ${
                provider === "ollama" ? "bg-emerald-600 text-white shadow" : "text-slate-400 hover:text-white"
              }`}
            >
              Ollama
            </button>
          </div>

          {/* Sign Out Button */}
          <button
            onClick={handleLogout}
            title="Sign out of developer portal"
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400 hover:text-rose-400 transition"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Real-time Telemetry & Resource Bar */}
      <div className="bg-slate-900/60 border-b border-slate-800/80 px-6 py-2 flex flex-wrap items-center justify-between text-xs gap-3">
        <div className="flex flex-wrap items-center space-x-6 text-slate-400 text-[11px]">
          <div className="flex items-center space-x-2">
            <span className="text-slate-500 font-semibold uppercase tracking-wider text-[10px]">Resource Telemetry</span>
            <div className="h-3 w-[1px] bg-slate-800" />
          </div>

          <div className="flex items-center space-x-1.5">
            <span className="text-slate-400">Inference Latency:</span>
            <span className="font-mono font-semibold text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/30">
              {session?.telemetry?.latency_seconds ? `${session.telemetry.latency_seconds}s` : "0.0s"}
            </span>
          </div>

          <div className="flex items-center space-x-1.5">
            <span className="text-slate-400">Tokens Processed:</span>
            <span className="font-mono font-semibold text-indigo-400 bg-indigo-950/40 px-2 py-0.5 rounded border border-indigo-800/30">
              {session?.telemetry?.tokens_used ? session.telemetry.tokens_used.toLocaleString() : "0"} tok
            </span>
          </div>

          <div className="flex items-center space-x-1.5">
            <span className="text-slate-400">MCP Tool Calls:</span>
            <span className="font-mono font-semibold text-amber-400 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-800/30">
              {session?.telemetry?.tool_calls_count || session?.steps.length || 0} invocations
            </span>
          </div>

          <div className="flex items-center space-x-1.5">
            <span className="text-slate-400">Estimated Cost:</span>
            <span className="font-mono font-semibold text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/30">
              $0.00 <span className="text-[10px] text-slate-500 font-normal">(Free Tier)</span>
            </span>
          </div>
        </div>

        <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
          <span>SWE-bench Aligned Evaluation Protocol</span>
        </div>
      </div>

      {/* Main Container */}
      <main className="flex-1 p-6 grid grid-cols-12 gap-6 max-w-7xl w-full mx-auto">
        {/* Left Column: Mission Control & Context Preview */}
        <section className="col-span-12 lg:col-span-3 flex flex-col space-y-5">
          {/* Target Issue Selector */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
              <FileCode className="w-4 h-4 text-indigo-400" />
              Target GitHub Issue
            </h2>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Select Issue</label>
                <select
                  value={issueId}
                  onChange={(e) => setIssueId(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value={101}>#101 - 500 Error when phone omitted (Lavanya-Sundarapu08/mcp-demo)</option>
                  <option value={27}>#27 - 500 Error when phone omitted (Benchmark)</option>
                </select>
              </div>

              <button
                onClick={startInvestigation}
                disabled={loading || session?.status === "INVESTIGATING"}
                className={`w-full py-2.5 px-4 rounded-lg font-medium text-sm flex items-center justify-center space-x-2 transition ${
                  loading || session?.status === "INVESTIGATING"
                    ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                    : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30"
                }`}
              >
                {loading || session?.status === "INVESTIGATING" ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Investigating...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    <span>Investigate & Fix</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Connected MCP Servers */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm flex-1">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Connected MCP Servers
            </h2>
            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between p-2 bg-slate-800/60 rounded-lg border border-slate-800">
                <span className="flex items-center gap-2 text-slate-300 font-medium">
                  <BookOpen className="w-3.5 h-3.5 text-cyan-400" /> RAG Docs MCP
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  BM25 Offline
                </span>
              </div>

              <div className="flex items-center justify-between p-2 bg-slate-800/60 rounded-lg border border-slate-800">
                <span className="flex items-center gap-2 text-slate-300 font-medium">
                  <FileCode className="w-3.5 h-3.5 text-blue-400" /> Filesystem MCP
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  Read/Write/Test
                </span>
              </div>

              <div className="flex items-center justify-between p-2 bg-slate-800/60 rounded-lg border border-slate-800">
                <span className="flex items-center gap-2 text-slate-300 font-medium">
                  <Database className="w-3.5 h-3.5 text-amber-400" /> PostgreSQL MCP
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  Safe Read-Only
                </span>
              </div>

              <div className="flex items-center justify-between p-2 bg-slate-800/60 rounded-lg border border-slate-800">
                <span className="flex items-center gap-2 text-slate-300 font-medium">
                  <MessageSquare className="w-3.5 h-3.5 text-rose-400" /> Slack MCP
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  Incident History
                </span>
              </div>

              <div className="flex items-center justify-between p-2 bg-slate-800/60 rounded-lg border border-slate-800">
                <span className="flex items-center gap-2 text-slate-300 font-medium">
                  <GitPullRequest className="w-3.5 h-3.5 text-purple-400" /> GitHub MCP
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  Branch & PR
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Center Column: Live ReAct Execution Timeline */}
        <section className="col-span-12 lg:col-span-4 flex flex-col bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Terminal className="w-4 h-4 text-indigo-400" />
              <h2 className="text-sm font-semibold text-slate-200">ReAct Reasoning & MCP Calls</h2>
            </div>
            {session && (
              <span
                className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                  session.status === "AWAITING_APPROVAL"
                    ? "bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse"
                    : session.status === "COMPLETE"
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : "bg-slate-800 text-slate-400"
                }`}
              >
                {session.status}
              </span>
            )}
          </div>

          <div className="flex-1 p-5 overflow-y-auto max-h-[720px] space-y-4">
            {!session || session.steps.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-500">
                <Cpu className="w-12 h-12 text-slate-700 mb-3 stroke-1" />
                <p className="text-sm font-medium">No investigation active</p>
                <p className="text-xs text-slate-600 mt-1 max-w-xs">
                  Click "Investigate & Fix" to trigger the 5-step autonomous MCP agent workflow.
                </p>
              </div>
            ) : (
              session.steps.map((s, idx) => {
                const isExpanded = expandedSteps[s.step] ?? true;
                return (
                  <div key={idx} className="border border-slate-800 bg-slate-950/70 rounded-lg p-3.5 space-y-2.5 text-xs">
                    {/* Step Header */}
                    <div
                      className="flex items-center justify-between cursor-pointer select-none"
                      onClick={() => toggleStep(s.step)}
                    >
                      <div className="flex items-center space-x-2">
                        <span className="w-5 h-5 rounded-full bg-indigo-950 border border-indigo-700/50 text-indigo-400 font-bold flex items-center justify-center text-[10px]">
                          {s.step}
                        </span>
                        <span className="font-semibold text-slate-300">
                          {s.tool_name ? s.tool_name : "Agent Reasoning"}
                        </span>
                      </div>
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-slate-500" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-slate-500" />
                      )}
                    </div>

                    {/* Step Body */}
                    {isExpanded && (
                      <div className="space-y-2 pt-1 border-t border-slate-800/80">
                        {s.thought && (
                          <div className="text-slate-400 leading-relaxed italic bg-slate-900/40 p-2.5 rounded border border-slate-800/50">
                            "{s.thought}"
                          </div>
                        )}

                        {s.arguments && (
                          <div>
                            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">
                              Parameters
                            </span>
                            <pre className="bg-slate-900 p-2 rounded text-[11px] text-indigo-300 overflow-x-auto mt-0.5 border border-slate-800">
                              {JSON.stringify(s.arguments, null, 2)}
                            </pre>
                          </div>
                        )}

                        {s.result && (
                          <div>
                            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">
                              Observation (MCP Response)
                            </span>
                            <pre className="bg-slate-900/80 p-2 rounded text-[11px] text-emerald-400/90 overflow-x-auto mt-0.5 border border-slate-800 max-h-36">
                              {JSON.stringify(s.result, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
            <div ref={timelineEndRef} />
          </div>
        </section>

        {/* Right Column: 4 Advanced Feature Tabs */}
        <section className="col-span-12 lg:col-span-5 flex flex-col bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
          {/* Tab Navigation */}
          <div className="px-4 py-2.5 border-b border-slate-800 bg-slate-900/90 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setActiveTab("diff")}
                className={`text-xs px-2.5 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 ${
                  activeTab === "diff"
                    ? "bg-slate-800 text-indigo-300 border border-indigo-500/30"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <FileCode className="w-3.5 h-3.5" />
                <span>Code Diff</span>
              </button>

              <button
                onClick={() => setActiveTab("rca")}
                className={`text-xs px-2.5 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 ${
                  activeTab === "rca"
                    ? "bg-slate-800 text-amber-300 border border-amber-500/30"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Root Cause (RCA)</span>
              </button>

              <button
                onClick={() => setActiveTab("tests")}
                className={`text-xs px-2.5 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 ${
                  activeTab === "tests"
                    ? "bg-slate-800 text-emerald-300 border border-emerald-500/30"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Terminal className="w-3.5 h-3.5" />
                <span>AI Test & Retest</span>
              </button>

              <button
                onClick={() => setActiveTab("audit")}
                className={`text-xs px-2.5 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 ${
                  activeTab === "audit"
                    ? "bg-slate-800 text-cyan-300 border border-cyan-500/30"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <ClipboardList className="w-3.5 h-3.5" />
                <span>Audit Dashboard</span>
              </button>
            </div>

            {session?.test_result && (
              <span
                className={`text-[11px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 ${
                  session.test_result.passed
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                    : "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                }`}
              >
                {session.test_result.passed ? (
                  <>
                    <CheckCircle className="w-3 h-3" /> Retest 100% Passed
                  </>
                ) : (
                  <>
                    <XCircle className="w-3 h-3" /> Failing (Red Phase)
                  </>
                )}
              </span>
            )}
          </div>

          {/* Tab 1: Code Diff */}
          {activeTab === "diff" && (
            <div className="flex-1 p-5 overflow-y-auto max-h-[720px]">
              {session?.diff ? (
                <div className="space-y-2">
                  <div className="text-xs text-slate-400 font-mono flex items-center justify-between">
                    <span>{session.diff.filepath}</span>
                    <span className="text-[10px] text-indigo-400 font-semibold">Unified Diff</span>
                  </div>
                  <pre className="bg-slate-950 p-3 rounded-lg text-xs font-mono border border-slate-800 overflow-x-auto leading-relaxed">
                    {session.diff.diff_text.split("\n").map((line, idx) => {
                      let color = "text-slate-300";
                      let bg = "";
                      if (line.startsWith("+") && !line.startsWith("+++")) {
                        color = "text-emerald-400 font-semibold";
                        bg = "bg-emerald-950/30";
                      } else if (line.startsWith("-") && !line.startsWith("---")) {
                        color = "text-rose-400 font-semibold";
                        bg = "bg-rose-950/30";
                      } else if (line.startsWith("@")) {
                        color = "text-indigo-400";
                      }
                      return (
                        <div key={idx} className={`${color} ${bg} px-1.5 rounded-sm`}>
                          {line || " "}
                        </div>
                      );
                    })}
                  </pre>
                </div>
              ) : (
                <div className="h-64 flex flex-col items-center justify-center text-center text-slate-500">
                  <FileCode className="w-10 h-10 text-slate-700 mb-2 stroke-1" />
                  <p className="text-xs">No code changes proposed yet</p>
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Root Cause Analysis (RCA) */}
          {activeTab === "rca" && (
            <div className="flex-1 p-5 overflow-y-auto max-h-[720px] space-y-4">
              {session?.rca ? (
                <>
                  {/* Diagnosis Card */}
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4" /> Root Cause Diagnosis
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                        Severity: {session.rca.severity}
                      </span>
                    </div>

                    <p className="text-xs text-slate-200 font-semibold">{session.rca.summary}</p>
                    <div className="text-xs text-slate-400 bg-slate-900/60 p-3 rounded-lg border border-slate-800 leading-relaxed font-mono">
                      {session.rca.root_cause}
                    </div>

                    <div className="text-[11px] text-slate-400">
                      <span className="text-slate-500 font-bold uppercase">Impact Scope: </span>
                      {session.rca.impact_scope}
                    </div>
                  </div>

                  {/* Evidence Citations Grid */}
                  <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5">
                      Multi-Source Supporting Evidence Citations
                    </h3>
                    <div className="space-y-2.5">
                      {session.rca.evidence_citations.map((cite, i) => (
                        <div key={i} className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                              {cite.source_type === "documentation" && <BookOpen className="w-3.5 h-3.5 text-cyan-400" />}
                              {cite.source_type === "slack" && <MessageSquare className="w-3.5 h-3.5 text-rose-400" />}
                              {cite.source_type === "postgres" && <Database className="w-3.5 h-3.5 text-amber-400" />}
                              {cite.source_type === "code" && <FileCode className="w-3.5 h-3.5 text-indigo-400" />}
                              {cite.title}
                            </span>
                            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-800/30">
                              {(cite.confidence * 100).toFixed(0)}% Match
                            </span>
                          </div>
                          <p className="text-slate-400 leading-relaxed text-[11px]">{cite.detail}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="h-64 flex flex-col items-center justify-center text-center text-slate-500">
                  <Sparkles className="w-10 h-10 text-slate-700 mb-2 stroke-1" />
                  <p className="text-xs">Root Cause Analysis will synthesize as MCP signals arrive</p>
                </div>
              )}
            </div>
          )}

          {/* Tab 3: AI Test Generation & Red/Green Retesting */}
          {activeTab === "tests" && (
            <div className="flex-1 p-5 overflow-y-auto max-h-[720px] space-y-4">
              {session?.generated_test ? (
                <>
                  {/* TDD State Lifecycle Bar */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl bg-rose-950/20 border border-rose-500/30 flex items-center justify-between">
                      <div>
                        <div className="text-[10px] text-rose-400 font-bold uppercase tracking-wider">Phase 1: Initial Run</div>
                        <div className="text-xs font-semibold text-rose-300">🔴 Bug Reproduced</div>
                      </div>
                      <span className="text-[10px] font-mono bg-rose-500/20 text-rose-300 px-2 py-0.5 rounded border border-rose-500/30">
                        {session.generated_test.initial_status}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/30 flex items-center justify-between">
                      <div>
                        <div className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">Phase 2: Post-Patch</div>
                        <div className="text-xs font-semibold text-emerald-300">🟢 Verified Retest</div>
                      </div>
                      <span className="text-[10px] font-mono bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/30">
                        {session.generated_test.verified_status}
                      </span>
                    </div>
                  </div>

                  {/* Generated Test Code */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span className="font-mono flex items-center gap-1.5">
                        <FileCode className="w-3.5 h-3.5 text-indigo-400" />
                        {session.generated_test.test_filepath}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                        AI Generated Test
                      </span>
                    </div>
                    <pre className="bg-slate-950 p-3 rounded-lg text-xs font-mono text-emerald-300/90 border border-slate-800 overflow-x-auto leading-relaxed">
                      {session.generated_test.test_code}
                    </pre>
                  </div>

                  {/* Pytest Terminal Log */}
                  {session?.test_result && (
                    <div className="space-y-1.5">
                      <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                        Pytest Execution Output
                      </div>
                      <pre className="bg-slate-950 p-3 rounded-lg text-[11px] font-mono text-slate-300 border border-slate-800 overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-48">
                        {session.test_result.stdout || "Test run completed."}
                      </pre>
                    </div>
                  )}
                </>
              ) : session?.test_result ? (
                <div className="space-y-2">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Pytest Execution Terminal
                  </div>
                  <pre className="bg-slate-950 p-4 rounded-lg text-[11px] font-mono text-slate-300 border border-slate-800 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                    {session.test_result.stdout}
                  </pre>
                </div>
              ) : (
                <div className="h-64 flex flex-col items-center justify-center text-center text-slate-500">
                  <Terminal className="w-10 h-10 text-slate-700 mb-2 stroke-1" />
                  <p className="text-xs">Tests have not been generated or executed yet</p>
                </div>
              )}
            </div>
          )}

          {/* Tab 4: Audit & Activity Dashboard */}
          {activeTab === "audit" && (
            <div className="flex-1 p-5 overflow-y-auto max-h-[720px] space-y-3">
              {/* Filter and Export Bar */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5 text-xs">
                  <span className="text-slate-500 text-[10px] font-bold uppercase">Filter:</span>
                  {["ALL", "AI_AGENT", "HUMAN_OPERATOR", "MCP_HOST"].map((f) => (
                    <button
                      key={f}
                      onClick={() => setAuditFilter(f)}
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold transition ${
                        auditFilter === f
                          ? "bg-indigo-600 text-white"
                          : "bg-slate-800 text-slate-400 hover:text-white"
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>

                <div className="flex items-center space-x-1.5">
                  <button
                    onClick={() => exportAuditLog("json")}
                    className="p-1 px-2 rounded text-[10px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center gap-1 transition"
                  >
                    <Download className="w-3 h-3" /> JSON
                  </button>
                  <button
                    onClick={() => exportAuditLog("markdown")}
                    className="p-1 px-2 rounded text-[10px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center gap-1 transition"
                  >
                    <Download className="w-3 h-3" /> Markdown
                  </button>
                </div>
              </div>

              {/* Audit Records List */}
              {filteredAuditLog.length > 0 ? (
                <div className="space-y-2">
                  {filteredAuditLog.map((entry) => (
                    <div
                      key={entry.id}
                      className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 text-xs space-y-1 font-mono"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-200 flex items-center gap-1.5 text-[11px]">
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              entry.actor === "AI_AGENT"
                                ? "bg-indigo-400"
                                : entry.actor === "HUMAN_OPERATOR"
                                ? "bg-emerald-400"
                                : "bg-amber-400"
                            }`}
                          />
                          {entry.action}
                        </span>
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                            entry.status === "SUCCESS"
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : entry.status === "PENDING"
                              ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                              : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                          }`}
                        >
                          {entry.status}
                        </span>
                      </div>

                      {entry.result_summary && (
                        <div className="text-[10px] text-slate-400 truncate">
                          {entry.result_summary}
                        </div>
                      )}

                      <div className="flex items-center justify-between text-[9px] text-slate-500 pt-0.5">
                        <span>{entry.timestamp.substring(11, 19)} UTC</span>
                        <span className="text-indigo-400">{entry.governance_check}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-64 flex flex-col items-center justify-center text-center text-slate-500">
                  <ClipboardList className="w-10 h-10 text-slate-700 mb-2 stroke-1" />
                  <p className="text-xs">No audit entries matching filter</p>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Bottom Banner: Human-in-the-Loop Approval Gate */}
        {session?.status === "AWAITING_APPROVAL" && (
          <div className="col-span-12 bg-gradient-to-r from-amber-950/80 via-slate-900 to-indigo-950/80 border border-amber-500/40 rounded-xl p-5 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-amber-200">
                  Human-in-the-Loop Review Gate: Authorization Required
                </h3>
                <p className="text-xs text-slate-300">
                  The AI agent diagnosed the bug via RAG/PostgreSQL/Slack, authored regression tests, and verified the fix.
                  {auth.role === "LEAD_ENGINEER" ? (
                    <span className="text-emerald-400 font-semibold block mt-0.5">
                      ✓ Authenticated as Lead Engineer: You hold clearance to sign and publish this Pull Request.
                    </span>
                  ) : (
                    <span className="text-amber-400 font-semibold block mt-0.5">
                      ⚠ Authenticated as Developer: Read-only privilege. Approval requires Lead Engineer clearance.
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3 w-full md:w-auto">
              <button
                onClick={handleReject}
                className="flex-1 md:flex-none px-4 py-2 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
              >
                Reject Changes
              </button>
              <button
                onClick={handleApprove}
                disabled={auth.role !== "LEAD_ENGINEER"}
                className={`flex-1 md:flex-none px-5 py-2 rounded-lg text-xs font-bold flex items-center justify-center space-x-2 transition ${
                  auth.role === "LEAD_ENGINEER"
                    ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30 cursor-pointer"
                    : "bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed"
                }`}
              >
                <GitPullRequest className="w-4 h-4" />
                <span>Approve & Open Pull Request</span>
              </button>
            </div>
          </div>
        )}

        {/* PR Created Success Notification */}
        {session?.status === "COMPLETE" && session.pull_request && (
          <div className="col-span-12 bg-gradient-to-r from-emerald-950/80 via-slate-900 to-indigo-950/80 border border-emerald-500/40 rounded-xl p-5 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <CheckCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-emerald-200">
                  Pull Request #{session.pull_request.number} Created Successfully!
                </h3>
                <p className="text-xs text-slate-300">{session.pull_request.title}</p>
              </div>
            </div>

            <a
              href={session.pull_request.html_url}
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center space-x-2 transition shadow-lg shadow-emerald-600/20"
            >
              <span>View on GitHub</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        )}
      </main>
    </div>
  );
}

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
  ShieldCheck
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

interface SessionData {
  session_id: string;
  issue_id: number;
  status: string;
  provider: string;
  model: string;
  steps: AgentStep[];
  diff?: CodeDiff;
  test_result?: { passed: boolean; stdout: string };
  pull_request?: { number: number; title: string; html_url: string; head: string; base: string };
  final_summary?: string;
}

export default function App() {
  const [issueId, setIssueId] = useState<number>(27);
  const [provider, setProvider] = useState<string>("gemini");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"diff" | "tests">("diff");
  const [expandedSteps, setExpandedSteps] = useState<{ [key: number]: boolean }>({});
  const [wsConnected, setWsConnected] = useState<boolean>(false);

  const wsRef = useRef<WebSocket | null>(null);
  const timelineEndRef = useRef<HTMLDivElement | null>(null);

  // Connect WebSocket when sessionId is established
  useEffect(() => {
    if (!sessionId) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.hostname || "localhost";
    const wsUrl = `${protocol}//${host}:8000/ws/${sessionId}`;

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

    ws.onclose = () => {
      setWsConnected(false);
    };

    return () => {
      ws.close();
    };
  }, [sessionId]);

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
      } else if (type === "awaiting_approval") {
        updated.status = "AWAITING_APPROVAL";
        if (data.diff) updated.diff = data.diff;
        if (data.summary) updated.final_summary = data.summary;
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
      const res = await fetch("http://localhost:8000/api/investigate", {
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
        steps: []
      });
    } catch (err) {
      alert("Failed to start session. Ensure the FastAPI backend is running on port 8000.");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!sessionId) return;
    try {
      await fetch("http://localhost:8000/api/approve", {
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
      await fetch("http://localhost:8000/api/reject", {
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Navigation */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-emerald-400 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Cpu className="w-6 h-6 text-slate-950 font-bold" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
              MCP-Powered AI Software Engineer
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                v1.0 Capstone
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              Autonomous Multi-Tool Bug Investigation • Model Context Protocol • Human-in-the-Loop
            </p>
          </div>
        </div>

        {/* Status Indicators & Model Config */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 text-xs bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700">
            <div className={`w-2 h-2 rounded-full ${wsConnected ? "bg-emerald-400 animate-pulse" : "bg-slate-500"}`} />
            <span className="text-slate-300">{wsConnected ? "Stream Active" : "Disconnected"}</span>
          </div>

          <div className="flex items-center space-x-2 bg-slate-800/80 p-1 rounded-lg border border-slate-700">
            <button
              onClick={() => setProvider("gemini")}
              className={`text-xs px-3 py-1 rounded-md font-medium transition ${
                provider === "gemini" ? "bg-indigo-600 text-white shadow" : "text-slate-400 hover:text-white"
              }`}
            >
              Gemini 2.0 Flash
            </button>
            <button
              onClick={() => setProvider("ollama")}
              className={`text-xs px-3 py-1 rounded-md font-medium transition ${
                provider === "ollama" ? "bg-emerald-600 text-white shadow" : "text-slate-400 hover:text-white"
              }`}
            >
              Ollama (Qwen 2.5)
            </button>
          </div>
        </div>
      </header>

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
                  <option value={27}>#27 - 500 Error when phone is omitted</option>
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

          {/* MCP Tools Connected */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm flex-1">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Active MCP Servers
            </h2>
            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between p-2.5 bg-slate-800/60 rounded-lg border border-slate-800">
                <span className="flex items-center gap-2 text-slate-300 font-medium">
                  <FileCode className="w-4 h-4 text-blue-400" /> Filesystem MCP
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Read/Write (Scoped)
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 bg-slate-800/60 rounded-lg border border-slate-800">
                <span className="flex items-center gap-2 text-slate-300 font-medium">
                  <GitPullRequest className="w-4 h-4 text-purple-400" /> GitHub MCP
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Issues & PRs
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 bg-slate-800/60 rounded-lg border border-slate-800">
                <span className="flex items-center gap-2 text-slate-300 font-medium">
                  <Database className="w-4 h-4 text-amber-400" /> PostgreSQL MCP
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  Strict Read-Only
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 bg-slate-800/60 rounded-lg border border-slate-800">
                <span className="flex items-center gap-2 text-slate-300 font-medium">
                  <MessageSquare className="w-4 h-4 text-rose-400" /> Slack MCP
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Incident History
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Center Column: Live ReAct Execution Timeline */}
        <section className="col-span-12 lg:col-span-5 flex flex-col bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Terminal className="w-4 h-4 text-indigo-400" />
              <h2 className="text-sm font-semibold text-slate-200">ReAct Reasoning & Tool Execution</h2>
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

          <div className="flex-1 p-5 overflow-y-auto max-h-[700px] space-y-4">
            {!session || session.steps.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-500">
                <Cpu className="w-12 h-12 text-slate-700 mb-3 stroke-1" />
                <p className="text-sm font-medium">No investigation active</p>
                <p className="text-xs text-slate-600 mt-1 max-w-xs">
                  Click "Investigate & Fix" to trigger the multi-server MCP agent workflow.
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

        {/* Right Column: Code Diff & Pytest Verification */}
        <section className="col-span-12 lg:col-span-4 flex flex-col bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
          {/* Tab Selection */}
          <div className="px-5 py-3 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between">
            <div className="flex space-x-2">
              <button
                onClick={() => setActiveTab("diff")}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition ${
                  activeTab === "diff"
                    ? "bg-slate-800 text-indigo-300 border border-indigo-500/30"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Code Diff
              </button>
              <button
                onClick={() => setActiveTab("tests")}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition ${
                  activeTab === "tests"
                    ? "bg-slate-800 text-indigo-300 border border-indigo-500/30"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Pytest Verification
              </button>
            </div>

            {session?.test_result && (
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-bold flex items-center gap-1 ${
                  session.test_result.passed
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                    : "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                }`}
              >
                {session.test_result.passed ? (
                  <>
                    <CheckCircle className="w-3.5 h-3.5" /> Tests Passed
                  </>
                ) : (
                  <>
                    <XCircle className="w-3.5 h-3.5" /> Tests Failed
                  </>
                )}
              </span>
            )}
          </div>

          {/* Tab Content */}
          <div className="flex-1 p-5 overflow-y-auto max-h-[700px]">
            {activeTab === "diff" ? (
              session?.diff ? (
                <div className="space-y-2">
                  <div className="text-xs text-slate-400 font-mono flex items-center justify-between">
                    <span>{session.diff.filepath}</span>
                    <span className="text-[10px] text-indigo-400">Unified Diff</span>
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
              )
            ) : session?.test_result ? (
              <pre className="bg-slate-950 p-4 rounded-lg text-[11px] font-mono text-slate-300 border border-slate-800 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                {session.test_result.stdout || "Pytest execution complete with no output."}
              </pre>
            ) : (
              <div className="h-64 flex flex-col items-center justify-center text-center text-slate-500">
                <Terminal className="w-10 h-10 text-slate-700 mb-2 stroke-1" />
                <p className="text-xs">Tests have not been executed yet</p>
              </div>
            )}
          </div>
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
                  The AI agent has verified the patch against all automated unit tests. Do you authorize creating a Git
                  branch and publishing the GitHub Pull Request?
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
                className="flex-1 md:flex-none px-5 py-2 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30 flex items-center justify-center space-x-2 transition"
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
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center space-x-2 transition"
            >
              <span>View PR on GitHub</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        )}
      </main>
    </div>
  );
}

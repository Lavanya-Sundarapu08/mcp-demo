🚀 MCP-Powered Autonomous AI Software Engineering Agent
Final-Year Capstone Project & Technical Specification
1. Project Overview & Abstract
Modern software engineering teams spend countless hours triaging error logs, cross-referencing incident chats, finding root causes in large codebases, writing regression tests, and opening Pull Requests.

The MCP-Powered AI Software Engineering Agent is an autonomous co-pilot modeled after industry-leading benchmarks (Cognition Devin, SWE-bench). Built on Anthropic and Google's open Model Context Protocol (MCP), the agent orchestrates 5 independent subsystems to investigate, diagnose, test, repair, and verify software bugs autonomously—with strict Human-in-the-Loop governance.

Live Cloud URL: https://mcp-ai-agent-pbo8.onrender.com
GitHub Repository: https://github.com/Lavanya-Sundarapu08/mcp-demo
SWE-bench Aligned Score: 100% Patch Pass Rate
Average Investigation Time: ~7.75 seconds
Operational Cost: $0.00 (Google AI Studio Free Tier / Local Ollama)
2. High-Level Architecture & Workflow


                        [ GitHub Issue Reported ]
                                    │
                                    ▼
                   ┌─────────────────────────────────┐
                   │    ReAct AI Orchestrator        │
                   │  (Gemini 2.0 Flash / Ollama)    │
                   └────────────────┬────────────────┘
                                    │ Model Context Protocol (MCP)
     ┌────────────────┬─────────────┼─────────────┬────────────────┐
     ▼                ▼             ▼             ▼                ▼
┌───────────┐  ┌─────────────┐┌───────────┐┌──────────────┐┌──────────────┐
│GitHub MCP │  │RAG Docs MCP ││ Slack MCP ││PostgreSQL MCP││Filesystem MCP│
│(Issue/PR) │  │(BM25 Policy)││(Incident) ││(error_logs)  ││(Code & Tests)│
└─────┬─────┘  └──────┬──────┘└─────┬─────┘└──────┬───────┘└──────┬───────┘
      │               │             │             │               │
      └───────────────┴─────────────┼─────────────┴───────────────┘
                                    │
                                    ▼
                    [ Multi-Source Root Cause Analysis ]
                     (Evidence: Docs + Slack + DB + Code)
                                    │
                                    ▼
                    [ AI Test Generation (Red Phase 🔴) ]
                     (Targeted Pytest Reproduction Test)
                                    │
                                    ▼
                    [ Surgical Code Patching (Filesystem) ]
                     (Safe Non-destructive Code Replacement)
                                    │
                                    ▼
                    [ Test Verification (Green Phase 🟢) ]
                     (100% Automated Test Pass Rate)
                                    │
                                    ▼
                   ┌─────────────────────────────────┐
                   │  Human-in-the-Loop Review Gate  │
                   │    (Authorization Required)     │
                   └────────────────┬────────────────┘
                                    │ Approved
                                    ▼
                   [ GitHub Branch & PR Publication ]
                                    │
                                    ▼
                   [ Immutable Audit Trail (JSON/MD) ]
3. The 5 Core Upgraded Features
1. Documentation RAG (Retrieval-Augmented Generation)
Why it matters: Code only shows how a system was written, not what product behavior was originally intended.
How it works: Uses a local, zero-cost BM25 chunking engine (rag_server.py) over internal engineering markdown specifications.
Result: Retrieves Section 2.1 of registration_policy.md, verifying that the phone number field is strictly optional, preventing the AI from mistakenly making it mandatory.
2. Root Cause Analysis (RCA) with Multi-Source Citations
Why it matters: Prevents LLM hallucinations by grounding diagnoses in concrete telemetry.
How it works: Synthesizes a structured diagnosis card with 4 Evidence Citations:
Documentation Policy: docs/registration_policy.md (Phone is optional).
Incident Context: #alerts-prod Slack thread (EU signup crash reports).
Production Database Telemetry: error_logs table (KeyError: 'phone' on /api/v1/auth/register).
Codebase Inspection: app/auth_service.py:52 (Direct dictionary index user_data['phone']).
3. AI Test Generation
Why it matters: Guarantees that the identified bug is reproduced with an automated test before any fix is attempted.
How it works: The agent authors a targeted regression test suite (tests/test_regression_phone.py) using filesystem_write_test.
4. Test ➔ Fix ➔ Retest (Test-Driven Development Workflow)
Phase 1 (Red Phase 🔴): Runs the generated test on the unpatched codebase; proves bug reproduction as the test fails.
Surgical Fix: Safely replaces direct indexing with user_data.get('phone') with cross-platform newline normalization.
Phase 2 (Green Phase 🟢): Re-runs all test suites; confirms 100% test pass rate (6/6 tests passing).
5. Audit & Activity Dashboard
Why it matters: Meets enterprise AI governance standards (ISO 42001, NIST AI RMF).
How it works: Records an immutable log of every action: actor (AI_AGENT, HUMAN_OPERATOR, MCP_HOST), tool parameters, outputs, and governance checks (READ_ONLY_POLICY_PASSED, HUMAN_GATED).
Export: One-click download as JSON or Markdown compliance reports.
4. Standardized MCP Server Specifications
MCP Server	Server Script	Security Policy	Capabilities
GitHub MCP	mcp_servers/github_server.py	Authenticated Token / Safe Sandbox	Issue retrieval, branch creation, pull request publication
Documentation RAG MCP	mcp_servers/rag_server.py	Local Read-Only BM25 Engine	Policy specification retrieval and chunk scoring
PostgreSQL MCP	mcp_servers/postgres_server.py	Strict Read-Only AST Guard	Blocks mutating SQL (DROP, DELETE, UPDATE, INSERT). Queries error_logs table
Slack MCP	mcp_servers/slack_server.py	Live API Token / Offline Mock Fallback	Searches incident channels and on-call discussions
Filesystem MCP	mcp_servers/filesystem_server.py	Path Sandboxing (_resolve_safe_path)	Read files, search code, write regression tests, apply patches, run pytest
5. Security & Governance Architecture
Least-Privilege Database Access: Mutating SQL operations are parsed and rejected by regex keyword guards before reaching the database.
Filesystem Path Sandboxing: Paths attempting directory traversal (../) are blocked with a PermissionError.
Human-in-the-Loop Safe Gate: All write actions (git branch creation, commit, pull request creation) are physically locked until human review and approval.
6. SWE-bench Aligned Evaluation Scorecard
Evaluation Metric	Benchmark Result
Target Bug Scenario	Issue #27 / #101: KeyError: 'phone' on signup
Pre-fix Test Status	FAILED (🔴 Red Phase Reproduction)
Investigation Time	7.75 seconds
MCP Tools Invoked	9 tools invoked
Post-fix Test Status	PASSED (🟢 100% Pass Rate)
Human Review Gate	Enforced (Paused for Operator Authorization)
Pull Request Status	Created (#101 linked)
Operational Cost	$0.00 (Free Tier)
7. Tech Stack Summary
Frontend: React 18, TypeScript, Tailwind CSS, Vite, Lucide Icons
Backend: FastAPI, WebSockets, Python 3.10+, Uvicorn, Pydantic v2
LLM Engine: Google Gemini 2.0 Flash / Local Ollama (Qwen 2.5 Coder)
Protocol: Model Context Protocol (MCP) by Anthropic / Google
Testing & Quality: Pytest, SQLite, BM25 / TF-IDF Retrieval
Cloud Hosting: Render (Web Service)
8. How to Run (Step-by-Step)
Running on Cloud:
Simply open: https://mcp-ai-agent-pbo8.onrender.com

Running Locally:
powershell


# 1. Clone the repo
git clone https://github.com/Lavanya-Sundarapu08/mcp-demo.git
cd mcp-demo
# 2. Activate virtual environment
.\.venv\Scripts\activate.ps1
# 3. Install requirements
pip install -r requirements.txt
# 4. Launch backend and dashboard
python -m uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port 8000
Open http://localhost:8000 in your browser.

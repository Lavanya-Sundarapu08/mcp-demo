# MCP-Powered AI Software Engineering Agent

> **Internship & Final-Year Capstone Project in Artificial Intelligence & Machine Learning (AI/ML)**  
> **Core Motto:** *"Autonomous Investigation, Human-Governed Action."*

An autonomous software engineering assistant that leverages the **Model Context Protocol (MCP)** to connect Large Language Models with development tools. The agent investigates software bugs across GitHub issues, Slack incident chats, PostgreSQL logs, and local workspace code, formulates a root-cause hypothesis, generates a verified patch via automated pytest runs, and prepares a Pull Request upon explicit human approval.

---

## Architecture Overview

```
[ Developer Web Dashboard (React + Tailwind) ]
                     │
                     │  WebSocket (Real-Time Thoughts, Tool Calls, Diffs)
                     ▼
       [ FastAPI Backend Orchestrator ]
                     │
    ┌────────────────┴────────────────┐
    ▼                                 ▼
[ Google Gemini 2.0 Flash ]     [ Local Ollama (Qwen 2.5 Coder) ]
 (Cloud Engine - Free Tier)       (On-Device Edge Engine)
                     │
                     ▼
         [ Unified MCP Client ]
    ┌──────────┬──────────┬──────────┐
    ▼          ▼          ▼          ▼
[Filesystem] [GitHub]  [Postgres] [Slack]
    MCP        MCP        MCP       MCP
   Server     Server     Server    Server
```

---

## Key Features

1. **Model Context Protocol (MCP) Integration:** Standardized tool decoupling layer. All tool discovery, argument validation, and execution conform to the open MCP specification.
2. **Defensive AI & Human-in-the-Loop (HITL):** Strict read-only credentials during investigation. Git write actions (branch creation and Pull Request) are paused until an engineer reviews the code diff and clicks **Approve**.
3. **Dual-Model Support ($0.00 Cost):**
   - **Cloud**: Google Gemini 2.0 Flash / 1.5 Flash via Google AI Studio free tier.
   - **Local / Edge**: Offline inference via Ollama with `qwen2.5-coder:7b` or `llama3.1`.
4. **Self-Healing Verification Loop:** Tests code in a sandbox using `pytest`. Evaluates stack traces to verify patches before presenting findings to humans.
5. **Reproducible Benchmark (Issue #27):** Includes a complete sample authentication service with a reproduction test case, error database logs, and Slack chatter.

---

## Directory Structure

```
mcp-ai-engineering-agent/
├── backend/                  # FastAPI orchestrator, LLM providers, and ReAct loop
│   ├── app/
│   │   ├── agent/            # State machine, prompts, session manager
│   │   ├── api/              # REST and WebSocket streaming routes
│   │   ├── core/             # Configuration and environment loader
│   │   ├── llm/              # Gemini and Ollama providers
│   │   └── mcp/              # MCP multi-server client manager
│   └── tests/                # Backend unit tests
├── mcp_servers/              # 4 Standalone Model Context Protocol servers
│   ├── filesystem_server.py  # Scoped workspace code inspection & patcher
│   ├── github_server.py      # Issue reader & PR generator (mock & live)
│   ├── postgres_server.py    # Read-only database query server
│   └── slack_server.py       # Incident discussion search server
├── benchmark_repo/           # Controlled benchmark environment
│   ├── app/auth_service.py   # Target code with intentional Issue #27 bug
│   ├── tests/test_auth.py    # Pytest reproduction suite
│   └── data/                 # Seeded error_logs.db and slack_mock.json
├── frontend/                 # React + Tailwind web dashboard
├── evaluation/               # Quantitative benchmark suite & evaluation scorecard
├── docker-compose.yml        # Multi-container deployment
├── run_demo.bat              # Windows one-click batch launcher
├── run_demo.ps1              # Windows PowerShell launcher
└── requirements.txt          # Python dependencies
```

---

## Quickstart Guide

### 1. Prerequisites
- Python 3.10+
- Node.js 18+ (already compiled into `frontend/dist`)
- (Optional) [Ollama](https://ollama.com/) with `ollama pull qwen2.5-coder:7b` for offline mode.

### 2. One-Click Launch (Windows)
Double-click `run_demo.bat` or run:
```powershell
.\run_demo.ps1
```
The application will start at **http://localhost:8000**.

### 3. Manual Launch
```bash
# Activate virtual environment
.\.venv\Scripts\activate

# Launch backend and UI
python -m uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port 8000 --reload
```

---

## Running the Evaluation Benchmark

To generate the evaluation scorecard for your project thesis or presentation:

```bash
.\.venv\Scripts\python evaluation\benchmark_eval.py
```

### Benchmark Scorecard Output:

| Metric | Result |
| :--- | :--- |
| **Target Scenario** | Issue #27: KeyError `phone` on registration |
| **Pre-fix Test Status** | **FAILED** (Bug reproduced in baseline) |
| **Autonomous Investigation Time** | **~5.15 seconds** |
| **MCP Tools Invoked** | 6 tools (GitHub, Slack, Postgres, Filesystem, Patch, Pytest) |
| **Post-fix Pytest Status** | **PASSED** (100% test pass rate) |
| **Human-in-the-Loop Safe Gate** | **ENFORCED** (Paused in `AWAITING_APPROVAL`) |
| **GitHub Pull Request** | **PR #101 Created** with detailed root cause |
| **Total Cost** | **$0.00** |

---

## Academic Evaluation Defense Points

- **Novelty:** Adopts the open Model Context Protocol (MCP) instead of ad-hoc function calling.
- **Safety Engineering:** Enforces least-privilege SQL parsing (blocks `DROP`/`DELETE`) and Human-in-the-Loop gates.
- **Reproducibility:** Self-contained benchmark repository eliminates external network dependencies during live exam vivas.

# 🚀 Setup & Execution Guide for Teammates

Welcome! This guide explains how to set up, run, and test the **MCP-Powered AI Software Engineering Agent** on your machine in under 3 minutes.

---

## 📋 1. Prerequisites (What You Need Installed)

You only need **one thing** installed on your computer:
* **Python 3.10+** (Python 3.10, 3.11, 3.12, or 3.13)  
  *⚠️ **Important during Python installation**: Make sure you check the box that says **"Add python.exe to PATH"**.*

> 💡 **Note:** You do **NOT** need Node.js installed! The React frontend is already pre-compiled inside `frontend/dist/` and runs directly through the Python FastAPI server.

---

## ⚡ 2. Quickstart (Windows) — The 2-Minute Setup

### Step 1: Extract the ZIP
Extract `mcp-ai-engineering-agent.zip` to any folder on your computer (e.g., Desktop or Documents).

### Step 2: Open PowerShell in the project folder
1. Open the extracted folder.
2. In the folder path bar at the top of File Explorer, type `powershell` and press **Enter** (or open PowerShell and `cd` into the folder).

### Step 3: Set up Python Virtual Environment
Copy and paste this command block into your PowerShell window:

```powershell
# 1. Create a virtual environment
python -m venv .venv

# 2. Activate the virtual environment
.\.venv\Scripts\activate

# 3. Install required packages
pip install -r requirements.txt
```

### Step 4: Configure your `.env` file
A `.env` file is already included. 
* If you have a Google Gemini API Key, open `.env` in Notepad and paste it:
  ```env
  GEMINI_API_KEY=your_actual_key_here
  ```
* **Don't have an API key?** No problem! Leave `GEMINI_API_KEY=` blank. The system includes an **intelligent offline fallback mode** that will autonomously demonstrate the full investigation, diff, and PR workflow without needing an API key!

### Step 5: Launch the Application!
Run this command in your terminal:

```powershell
python -m uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port 8000
```
*(Or simply double-click the **`run_demo.bat`** file in the folder!)*

### Step 6: Open the Dashboard
Open your web browser (Chrome, Edge, Brave, etc.) and go to:  
👉 **`http://localhost:8000`**

---

## 🍏 3. Quickstart (Mac / Linux)

If your teammate uses a Mac or Linux:

```bash
# 1. Open Terminal in the project folder
cd mcp-ai-engineering-agent

# 2. Create and activate virtual environment
python3 -m venv .venv
source .venv/bin/activate

# 3. Install packages
pip install -r requirements.txt

# 4. Seed database logs
python3 benchmark_repo/data/seed_logs.py

# 5. Start server
python3 -m uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port 8000
```
Then visit **`http://localhost:8000`** in your browser.

---

## 🎯 4. How to Test the Demo on the Website

1. Check the top bar: You will see **"Stream Active"** with a green dot.
2. In the left panel, Issue **`#101 - 500 Error when phone omitted`** is selected.
3. Click the blue **`Investigate & Fix`** button.
4. Watch the center panel:
   * The AI agent queries GitHub, Slack incident channels, and Postgres error logs.
   * It locates the bug in `auth_service.py` and applies the patch.
   * It executes `pytest` in the background (showing all 5 tests pass).
5. Look at the right panel:
   * View the **Code Diff** (red = removed bug, green = safe fix applied).
   * View the **Pytest Verification** tab.
6. The **Human-in-the-Loop Review Gate** will appear at the bottom.
7. Click **`Approve & Open Pull Request`**!
8. Click **`View on GitHub`** to open the repository.

---

## 📊 5. How to Run the Benchmark Evaluation Script

To generate the quantitative evaluation scorecard (accuracy, tool calls count, latency):

```powershell
python evaluation\benchmark_eval.py
```
This prints the benchmark table directly in the terminal and outputs `evaluation/benchmark_report.json`.

---

## ❓ Frequently Asked Questions & Troubleshooting

| Issue | Solution |
| :--- | :--- |
| **`python: command not found`** | Re-install Python from [python.org](https://www.python.org/) and make sure to check **"Add Python to PATH"**. |
| **`Execution of scripts is disabled on this system`** | Run `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` in PowerShell, then activate `.venv`. |
| **`Address already in use (port 8000)`** | Another app is using port 8000. Stop it or change port to 8080: `... --port 8080`. |
| **Do I need paid tokens or accounts?** | **No.** Everything runs 100% free with simulated or free-tier keys. |

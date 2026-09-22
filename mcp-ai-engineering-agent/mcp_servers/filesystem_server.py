"""
Filesystem & Workspace MCP Server
Provides safe, scoped access to the target repository workspace.
Features: list_files, read_file, search_code, apply_patch, run_tests.
"""

import os
import sys
import json
import subprocess
from pathlib import Path
from typing import Dict, Any, List, Optional

# Base directory for the target benchmark repository
DEFAULT_WORKSPACE = Path(__file__).resolve().parent.parent / "benchmark_repo"
WORKSPACE_DIR = Path(os.environ.get("TARGET_WORKSPACE_DIR", str(DEFAULT_WORKSPACE))).resolve()


def _resolve_safe_path(rel_path: str) -> Path:
    """Ensures file paths are strictly within the permitted workspace directory."""
    clean_path = (WORKSPACE_DIR / rel_path.lstrip("/\\")).resolve()
    if not str(clean_path).startswith(str(WORKSPACE_DIR)):
        raise ValueError(f"Access denied: path '{rel_path}' is outside the authorized workspace.")
    return clean_path


def list_files(directory: str = ".") -> Dict[str, Any]:
    """Lists files and folders recursively in the target workspace."""
    target_dir = _resolve_safe_path(directory)
    if not target_dir.exists() or not target_dir.is_dir():
        return {"error": f"Directory not found: {directory}"}

    file_list = []
    for root, dirs, files in os.walk(target_dir):
        # Exclude hidden and cache folders
        dirs[:] = [d for d in dirs if not d.startswith(".") and d not in ("__pycache__", "venv", ".venv")]
        for file in files:
            if not file.startswith(".") and not file.endswith((".pyc", ".db")):
                full_path = Path(root) / file
                rel = full_path.relative_to(WORKSPACE_DIR)
                file_list.append(str(rel).replace("\\", "/"))

    return {"files": sorted(file_list), "total_count": len(file_list)}


def read_file(filepath: str) -> Dict[str, Any]:
    """Reads the contents of a file within the authorized workspace."""
    path = _resolve_safe_path(filepath)
    if not path.exists() or not path.is_file():
        return {"error": f"File not found: {filepath}"}

    try:
        content = path.read_text(encoding="utf-8")
        lines = content.splitlines()
        return {
            "filepath": filepath,
            "line_count": len(lines),
            "content": content
        }
    except Exception as e:
        return {"error": f"Failed to read file: {str(e)}"}


def search_code(query: str, extension: str = ".py") -> Dict[str, Any]:
    """Searches for a text or symbol occurrence across repository files."""
    matches = []
    for root, dirs, files in os.walk(WORKSPACE_DIR):
        dirs[:] = [d for d in dirs if not d.startswith(".") and d not in ("__pycache__", ".venv")]
        for file in files:
            if extension and not file.endswith(extension):
                continue
            full_path = Path(root) / file
            try:
                content = full_path.read_text(encoding="utf-8")
                for idx, line in enumerate(content.splitlines(), start=1):
                    if query.lower() in line.lower():
                        rel = full_path.relative_to(WORKSPACE_DIR)
                        matches.append({
                            "file": str(rel).replace("\\", "/"),
                            "line_number": idx,
                            "line_content": line.strip()
                        })
            except Exception:
                continue

    return {"query": query, "matches": matches[:25], "total_matches": len(matches)}


def apply_patch(filepath: str, old_code: str, new_code: str) -> Dict[str, Any]:
    """Replaces old_code with new_code in the specified file."""
    path = _resolve_safe_path(filepath)
    if not path.exists() or not path.is_file():
        return {"error": f"File not found: {filepath}"}

    content = path.read_text(encoding="utf-8")
    if old_code not in content:
        return {
            "error": "Target content to replace was not found in the file. Ensure exact whitespace/indentation.",
            "success": False
        }

    updated_content = content.replace(old_code, new_code, 1)
    path.write_text(updated_content, encoding="utf-8")

    return {
        "success": True,
        "filepath": filepath,
        "message": f"Successfully updated {filepath}"
    }


def run_tests(test_target: str = "tests") -> Dict[str, Any]:
    """Runs pytest on the workspace test suite to verify code correctness."""
    target_path = _resolve_safe_path(test_target)
    
    # Use the current python or virtual environment python
    py_exec = sys.executable

    try:
        res = subprocess.run(
            [py_exec, "-m", "pytest", str(target_path), "-v", "--tb=short"],
            cwd=str(WORKSPACE_DIR),
            capture_output=True,
            text=True,
            timeout=30
        )
        passed = res.returncode == 0
        return {
            "passed": passed,
            "returncode": res.returncode,
            "stdout": res.stdout,
            "stderr": res.stderr
        }
    except subprocess.TimeoutExpired:
        return {"passed": False, "error": "Pytest execution timed out after 30 seconds."}
    except Exception as e:
        return {"passed": False, "error": f"Failed to execute tests: {str(e)}"}


# Standard MCP Tool Definitions
TOOLS_SCHEMA = [
    {
        "name": "filesystem_list_files",
        "description": "Lists all source code and configuration files in the project workspace.",
        "parameters": {
            "type": "object",
            "properties": {
                "directory": {"type": "string", "description": "Subdirectory to list (default is root '.')."}
            },
            "required": []
        }
    },
    {
        "name": "filesystem_read_file",
        "description": "Reads the complete content and line count of a specific file in the repository.",
        "parameters": {
            "type": "object",
            "properties": {
                "filepath": {"type": "string", "description": "Relative path to file (e.g. app/auth_service.py)."}
            },
            "required": ["filepath"]
        }
    },
    {
        "name": "filesystem_search_code",
        "description": "Searches for a text pattern or symbol across source files.",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Text query or symbol name to search for."},
                "extension": {"type": "string", "description": "File extension filter (e.g. '.py'). Default is '.py'."}
            },
            "required": ["query"]
        }
    },
    {
        "name": "filesystem_apply_patch",
        "description": "Applies a code fix by replacing a specific target block with new code in a file.",
        "parameters": {
            "type": "object",
            "properties": {
                "filepath": {"type": "string", "description": "Relative path to the file to modify."},
                "old_code": {"type": "string", "description": "The exact block of code to replace."},
                "new_code": {"type": "string", "description": "The replacement code."}
            },
            "required": ["filepath", "old_code", "new_code"]
        }
    },
    {
        "name": "filesystem_run_tests",
        "description": "Executes the automated pytest suite in the workspace to verify if code changes pass.",
        "parameters": {
            "type": "object",
            "properties": {
                "test_target": {"type": "string", "description": "Target test file or folder (default 'tests')."}
            },
            "required": []
        }
    }
]


def handle_tool_call(name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
    """Dispatcher for MCP tool calls."""
    if name == "filesystem_list_files":
        return list_files(arguments.get("directory", "."))
    elif name == "filesystem_read_file":
        return read_file(arguments.get("filepath", ""))
    elif name == "filesystem_search_code":
        return search_code(arguments.get("query", ""), arguments.get("extension", ".py"))
    elif name == "filesystem_apply_patch":
        return apply_patch(arguments.get("filepath", ""), arguments.get("old_code", ""), arguments.get("new_code", ""))
    elif name == "filesystem_run_tests":
        return run_tests(arguments.get("test_target", "tests"))
    else:
        return {"error": f"Unknown tool: {name}"}


if __name__ == "__main__":
    # Test CLI / stdio interface
    if len(sys.argv) > 1 and sys.argv[1] == "--tools":
        print(json.dumps(TOOLS_SCHEMA, indent=2))
    else:
        # Simple JSON-RPC loop for stdio
        for line in sys.stdin:
            if not line.strip():
                continue
            try:
                req = json.loads(line)
                res = handle_tool_call(req.get("name"), req.get("arguments", {}))
                print(json.dumps({"id": req.get("id"), "result": res}))
                sys.stdout.flush()
            except Exception as e:
                print(json.dumps({"error": str(e)}))
                sys.stdout.flush()

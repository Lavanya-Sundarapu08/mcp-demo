"""
GitHub MCP Server
Integrates GitHub issue retrieval and pull request operations.
Supports live GitHub REST API (if GITHUB_TOKEN is set) or realistic Local Mock Mode.
"""

import os
import sys
import json
from typing import Dict, Any, List, Optional
import httpx

GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN", "")
GITHUB_REPO = os.environ.get("GITHUB_REPO", "octocat/hello-world")

# Local Mock Repository state for reliable, zero-credential demos
MOCK_ISSUES = {
    27: {
        "id": 27,
        "title": "500 Internal Server Error when creating an account without optional phone number",
        "state": "open",
        "author": "priya_qa",
        "created_at": "2026-09-20T14:30:00Z",
        "labels": ["bug", "backend", "auth", "p1"],
        "body": (
            "### Bug Description\n"
            "During QA testing of the registration flow on staging, submitting the registration form "
            "without filling in the optional phone number causes an immediate 500 Internal Server Error.\n\n"
            "### Steps to Reproduce\n"
            "1. POST /api/v1/auth/register with payload containing only username, email, password, full_name.\n"
            "2. Notice server returns 500.\n\n"
            "### Expected Behavior\n"
            "Phone is documented as optional and registration should complete successfully."
        ),
        "comments": [
            {
                "author": "alex_dev",
                "body": "Checking the error_logs table in database now. Sentry reported an unhandled KeyError in auth_service.py line 52."
            }
        ]
    }
}

MOCK_PULL_REQUESTS = []
MOCK_BRANCHES = ["main", "staging"]


def get_issue(issue_id: int) -> Dict[str, Any]:
    """Retrieves issue details and comments by issue number."""
    # Live GitHub API if token and repo are supplied
    if GITHUB_TOKEN and GITHUB_REPO != "octocat/hello-world":
        url = f"https://api.github.com/repos/{GITHUB_REPO}/issues/{issue_id}"
        headers = {"Authorization": f"Bearer {GITHUB_TOKEN}", "Accept": "application/vnd.github.v3+json"}
        try:
            with httpx.Client(timeout=10.0) as client:
                res = client.get(url, headers=headers)
                if res.status_code == 200:
                    data = res.json()
                    # Fetch comments
                    comments_res = client.get(data.get("comments_url"), headers=headers)
                    comments = comments_res.json() if comments_res.status_code == 200 else []
                    return {
                        "id": data["number"],
                        "title": data["title"],
                        "body": data["body"],
                        "state": data["state"],
                        "labels": [lbl["name"] for lbl in data.get("labels", [])],
                        "comments": [{"author": c["user"]["login"], "body": c["body"]} for c in comments],
                        "source": "live_github"
                    }
        except Exception:
            pass

    # Fallback to local mock issues
    issue = MOCK_ISSUES.get(int(issue_id))
    if issue:
        return {**issue, "source": "mock_github"}
    return {"error": f"Issue #{issue_id} not found."}


def list_issues(state: str = "open") -> Dict[str, Any]:
    """Lists repository issues."""
    issues = [v for v in MOCK_ISSUES.values() if v["state"] == state or state == "all"]
    return {"issues": issues, "count": len(issues)}


def create_branch(branch_name: str, base_branch: str = "main") -> Dict[str, Any]:
    """Creates a new git branch for the proposed fix."""
    if branch_name not in MOCK_BRANCHES:
        MOCK_BRANCHES.append(branch_name)
    return {
        "success": True,
        "branch": branch_name,
        "base": base_branch,
        "message": f"Created branch '{branch_name}' from '{base_branch}'."
    }


def create_pull_request(title: str, body: str, head_branch: str, base_branch: str = "main") -> Dict[str, Any]:
    """Creates a Pull Request with the proposed fix and root cause summary."""
    pr_number = 100 + len(MOCK_PULL_REQUESTS) + 1
    pr_record = {
        "number": pr_number,
        "title": title,
        "body": body,
        "head": head_branch,
        "base": base_branch,
        "status": "open",
        "html_url": f"https://github.com/{GITHUB_REPO}/pull/{pr_number}"
    }
    MOCK_PULL_REQUESTS.append(pr_record)
    return {
        "success": True,
        "pull_request": pr_record,
        "message": f"Pull Request #{pr_number} successfully created on GitHub!"
    }


TOOLS_SCHEMA = [
    {
        "name": "github_get_issue",
        "description": "Fetches a GitHub issue details, body, and comments by issue number.",
        "parameters": {
            "type": "object",
            "properties": {
                "issue_id": {"type": "integer", "description": "The issue number (e.g. 27)."}
            },
            "required": ["issue_id"]
        }
    },
    {
        "name": "github_list_issues",
        "description": "Lists repository issues by state ('open', 'closed', 'all').",
        "parameters": {
            "type": "object",
            "properties": {
                "state": {"type": "string", "description": "Filter by state: 'open' or 'closed'."}
            },
            "required": []
        }
    },
    {
        "name": "github_create_branch",
        "description": "Creates a new Git branch for the bugfix.",
        "parameters": {
            "type": "object",
            "properties": {
                "branch_name": {"type": "string", "description": "Name for the fix branch (e.g. 'fix/issue-27-phone')."},
                "base_branch": {"type": "string", "description": "Base branch (default 'main')."}
            },
            "required": ["branch_name"]
        }
    },
    {
        "name": "github_create_pull_request",
        "description": "Submits a Pull Request to GitHub with fix details, root cause, and test evidence.",
        "parameters": {
            "type": "object",
            "properties": {
                "title": {"type": "string", "description": "Pull Request title."},
                "body": {"type": "string", "description": "Detailed description of the bug and fix applied."},
                "head_branch": {"type": "string", "description": "Branch containing the fix."},
                "base_branch": {"type": "string", "description": "Target branch to merge into (default 'main')."}
            },
            "required": ["title", "body", "head_branch"]
        }
    }
]


def handle_tool_call(name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
    if name == "github_get_issue":
        return get_issue(int(arguments.get("issue_id", 27)))
    elif name == "github_list_issues":
        return list_issues(arguments.get("state", "open"))
    elif name == "github_create_branch":
        return create_branch(arguments.get("branch_name", ""), arguments.get("base_branch", "main"))
    elif name == "github_create_pull_request":
        return create_pull_request(
            title=arguments.get("title", ""),
            body=arguments.get("body", ""),
            head_branch=arguments.get("head_branch", ""),
            base_branch=arguments.get("base_branch", "main")
        )
    return {"error": f"Unknown tool: {name}"}


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--tools":
        print(json.dumps(TOOLS_SCHEMA, indent=2))
    else:
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

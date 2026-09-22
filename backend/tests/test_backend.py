"""
Backend & MCP Integration Unit Tests
"""

import pytest
import sys
from pathlib import Path

# Add backend and mcp_servers to path
BACKEND_DIR = Path(__file__).resolve().parent.parent
SERVERS_DIR = BACKEND_DIR.parent / "mcp_servers"
sys.path.insert(0, str(BACKEND_DIR))
sys.path.insert(0, str(SERVERS_DIR))

from app.mcp.client import mcp_manager
from app.agent.state import AgentStatus
import filesystem_server
import github_server
import postgres_server
import slack_server


def test_mcp_servers_tool_schemas_registered():
    """Verifies that all 4 MCP servers have registered their tool schemas."""
    tools = mcp_manager.get_all_tools()
    tool_names = [t["name"] for t in tools]

    # Filesystem tools
    assert "filesystem_list_files" in tool_names
    assert "filesystem_read_file" in tool_names
    assert "filesystem_apply_patch" in tool_names
    assert "filesystem_run_tests" in tool_names

    # GitHub tools
    assert "github_get_issue" in tool_names
    assert "github_create_pull_request" in tool_names

    # Postgres tools
    assert "postgres_query_readonly" in tool_names

    # Slack tools
    assert "slack_search_messages" in tool_names


@pytest.mark.asyncio
async def test_postgres_mcp_blocks_mutating_sql():
    """Verifies defensive security: mutating queries like DROP or DELETE are rejected."""
    bad_query = "DROP TABLE error_logs;"
    result = await mcp_manager.execute_tool("postgres_query_readonly", {"sql": bad_query})
    assert result.get("success") is False
    assert "Security Policy Violation" in result.get("error", "")


@pytest.mark.asyncio
async def test_postgres_mcp_allows_safe_select():
    """Verifies safe read-only queries execute properly."""
    query = "SELECT service, level, message FROM error_logs LIMIT 2"
    result = await mcp_manager.execute_tool("postgres_query_readonly", {"sql": query})
    assert result.get("success") is True
    assert result.get("row_count") > 0


@pytest.mark.asyncio
async def test_github_mcp_fetches_issue_27():
    """Verifies GitHub MCP server retrieves issue #27."""
    issue = await mcp_manager.execute_tool("github_get_issue", {"issue_id": 27})
    assert issue.get("id") == 27
    assert "phone" in issue.get("title", "").lower()


@pytest.mark.asyncio
async def test_slack_mcp_searches_incident_chat():
    """Verifies Slack MCP server returns incident discussions."""
    res = await mcp_manager.execute_tool("slack_search_messages", {"query": "phone"})
    assert res.get("match_count") > 0

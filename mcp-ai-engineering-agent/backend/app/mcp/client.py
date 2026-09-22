"""
Multi-Server MCP Client Manager
Aggregates tool schemas and routes tool execution to the appropriate MCP server.
Supports both fast in-process dispatch and standard MCP subprocess protocol.
"""

import os
import sys
from pathlib import Path
from typing import Dict, Any, List, Optional
import importlib.util

from app.core.config import settings

# Ensure mcp_servers directory is on sys.path
SERVERS_DIR = settings.SERVERS_DIR
if str(SERVERS_DIR) not in sys.path:
    sys.path.insert(0, str(SERVERS_DIR))

# Dynamic import of MCP server modules
import filesystem_server
import github_server
import postgres_server
import slack_server


class MCPClientManager:
    """Coordinates tool discovery, schema registration, and execution across MCP servers."""

    def __init__(self):
        self.servers = {
            "filesystem": filesystem_server,
            "github": github_server,
            "postgres": postgres_server,
            "slack": slack_server
        }
        self._tools_cache: Optional[List[Dict[str, Any]]] = None

    def get_all_tools(self) -> List[Dict[str, Any]]:
        """Collects and returns all registered tool schemas across all MCP servers."""
        if self._tools_cache is None:
            all_tools = []
            for name, server in self.servers.items():
                if hasattr(server, "TOOLS_SCHEMA"):
                    all_tools.extend(server.TOOLS_SCHEMA)
            self._tools_cache = all_tools
        return self._tools_cache

    async def execute_tool(self, tool_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Routes the tool invocation to the designated MCP server handler."""
        # Routing by prefix convention
        if tool_name.startswith("filesystem_"):
            return filesystem_server.handle_tool_call(tool_name, arguments)
        elif tool_name.startswith("github_"):
            return github_server.handle_tool_call(tool_name, arguments)
        elif tool_name.startswith("postgres_"):
            return postgres_server.handle_tool_call(tool_name, arguments)
        elif tool_name.startswith("slack_"):
            return slack_server.handle_tool_call(tool_name, arguments)
        else:
            return {"error": f"Tool '{tool_name}' not recognized by any registered MCP server."}


mcp_manager = MCPClientManager()

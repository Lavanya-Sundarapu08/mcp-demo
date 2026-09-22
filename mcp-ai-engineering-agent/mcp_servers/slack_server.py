"""
Slack MCP Server
Enables the AI agent to search team incident channels and retrieve debugging discussion context.
Supports both live Slack Bot API (if SLACK_BOT_TOKEN is set) or offline JSON mock data.
"""

import os
import sys
import json
from pathlib import Path
from typing import Dict, Any, List
import httpx

SLACK_BOT_TOKEN = os.environ.get("SLACK_BOT_TOKEN", "")
MOCK_FILE = Path(__file__).resolve().parent.parent / "benchmark_repo" / "data" / "slack_mock.json"


def _load_mock_messages() -> List[Dict[str, Any]]:
    """Loads incident messages from mock storage."""
    if not MOCK_FILE.exists():
        return []
    try:
        return json.loads(MOCK_FILE.read_text(encoding="utf-8"))
    except Exception:
        return []


def search_messages(query: str) -> Dict[str, Any]:
    """Searches Slack channels for messages matching query terms."""
    if SLACK_BOT_TOKEN:
        try:
            with httpx.Client(timeout=10.0) as client:
                res = client.get(
                    "https://slack.com/api/search.messages",
                    params={"query": query},
                    headers={"Authorization": f"Bearer {SLACK_BOT_TOKEN}"}
                )
                if res.status_code == 200 and res.json().get("ok"):
                    matches = res.json().get("messages", {}).get("matches", [])
                    return {
                        "query": query,
                        "matches": [
                            {"channel": m.get("channel", {}).get("name"), "sender": m.get("username"), "text": m.get("text")}
                            for m in matches
                        ],
                        "source": "live_slack"
                    }
        except Exception:
            pass

    # Fallback to offline mock messages
    all_msgs = _load_mock_messages()
    q_lower = query.lower()
    results = []
    for msg in all_msgs:
        if q_lower in msg.get("message", "").lower() or q_lower in msg.get("channel", "").lower():
            results.append(msg)

    return {
        "query": query,
        "match_count": len(results),
        "matches": results,
        "source": "mock_slack"
    }


def get_channel_history(channel: str = "incidents-backend", limit: int = 10) -> Dict[str, Any]:
    """Retrieves recent discussion history from a specific channel."""
    all_msgs = _load_mock_messages()
    filtered = [m for m in all_msgs if m.get("channel") == channel]
    return {
        "channel": channel,
        "messages": filtered[:limit],
        "total": len(filtered)
    }


TOOLS_SCHEMA = [
    {
        "name": "slack_search_messages",
        "description": "Searches Slack incident and development channels for keyword mentions, error codes, or issue numbers.",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Search keyword (e.g. 'registration', '500 error', 'phone', 'Issue #27')."}
            },
            "required": ["query"]
        }
    },
    {
        "name": "slack_get_channel_history",
        "description": "Fetches recent message history from a designated channel (e.g. 'incidents-backend').",
        "parameters": {
            "type": "object",
            "properties": {
                "channel": {"type": "string", "description": "Channel name (default 'incidents-backend')."},
                "limit": {"type": "integer", "description": "Number of messages to retrieve."}
            },
            "required": []
        }
    }
]


def handle_tool_call(name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
    if name == "slack_search_messages":
        return search_messages(arguments.get("query", ""))
    elif name == "slack_get_channel_history":
        return get_channel_history(arguments.get("channel", "incidents-backend"), arguments.get("limit", 10))
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

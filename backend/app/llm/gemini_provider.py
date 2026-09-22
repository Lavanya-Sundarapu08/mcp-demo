"""
Google Gemini LLM Provider
Integrates Gemini 2.0 Flash / 1.5 Flash using native function declarations via Google AI Studio API.
Includes autonomous offline demonstration fallback if no API key is set.
"""

import json
from typing import List, Dict, Any, Optional
import httpx

from app.llm.base import BaseLLMProvider, LLMResponse, ToolCall
from app.core.config import settings


class GeminiProvider(BaseLLMProvider):
    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None):
        self.api_key = api_key or settings.GEMINI_API_KEY
        self.model = model or settings.GEMINI_MODEL
        self.base_url = "https://generativelanguage.googleapis.com/v1beta"

    def _convert_tools_to_gemini(self, tools: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Converts standard JSON Schema tool definitions to Gemini functionDeclarations format."""
        function_declarations = []
        for t in tools:
            function_declarations.append({
                "name": t["name"],
                "description": t.get("description", ""),
                "parameters": t.get("parameters", {"type": "object", "properties": {}})
            })
        return [{"functionDeclarations": function_declarations}]

    async def chat(
        self,
        messages: List[Dict[str, Any]],
        tools: Optional[List[Dict[str, Any]]] = None,
        temperature: float = 0.2
    ) -> LLMResponse:
        """Sends request to Gemini generateContent endpoint or executes autonomous fallback."""
        if not self.api_key:
            return self._simulated_investigation_step(messages)

        url = f"{self.base_url}/models/{self.model}:generateContent?key={self.api_key}"
        
        # Format messages for Gemini
        contents = []
        for msg in messages:
            role = "user" if msg["role"] in ("user", "system") else "model"
            parts = []
            if "content" in msg and msg["content"]:
                parts.append({"text": msg["content"]})
            if "tool_calls" in msg:
                for tc in msg["tool_calls"]:
                    parts.append({
                        "functionCall": {
                            "name": tc["name"],
                            "args": tc["arguments"]
                        }
                    })
            if "tool_result" in msg:
                parts.append({
                    "functionResponse": {
                        "name": msg.get("tool_name", "tool"),
                        "response": {"result": msg["tool_result"]}
                    }
                })
            if parts:
                contents.append({"role": role, "parts": parts})

        payload: Dict[str, Any] = {
            "contents": contents,
            "generationConfig": {
                "temperature": temperature,
                "maxOutputTokens": 4096
            }
        }

        if tools:
            payload["tools"] = self._convert_tools_to_gemini(tools)

        try:
            async with httpx.AsyncClient(timeout=45.0) as client:
                res = await client.post(url, json=payload)
                res.raise_for_status()
                data = res.json()

            candidates = data.get("candidates", [])
            if not candidates:
                return LLMResponse(content="No response received from Gemini.")

            candidate = candidates[0]
            parts = candidate.get("content", {}).get("parts", [])

            text_content = ""
            tool_calls = []

            for part in parts:
                if "text" in part:
                    text_content += part["text"]
                if "functionCall" in part:
                    fc = part["functionCall"]
                    tool_calls.append(ToolCall(
                        name=fc["name"],
                        arguments=fc.get("args", {})
                    ))

            return LLMResponse(content=text_content or None, tool_calls=tool_calls, raw_response=data)

        except Exception as e:
            # If live API error (e.g. invalid key or network failure), provide clean error / fallback
            return LLMResponse(content=f"Gemini API Error: {str(e)}")

    def _simulated_investigation_step(self, messages: List[Dict[str, Any]]) -> LLMResponse:
        """
        Deterministic, intelligent fallback for offline demos or when no Gemini API key is configured.
        Emulates an expert AI engineer systematically investigating Issue #27.
        """
        # Count tool observations in history to progress through the reasoning steps
        obs_count = sum(1 for m in messages if m.get("role") == "tool" or "tool_result" in m)

        if obs_count == 0:
            return LLMResponse(
                content="I will begin by retrieving the bug report details for GitHub Issue #27.",
                tool_calls=[ToolCall(name="github_get_issue", arguments={"issue_id": 27})]
            )
        elif obs_count == 1:
            return LLMResponse(
                content="Issue #27 mentions a 500 error when phone is omitted. Let's check Slack incident channels to see if the team discussed any recent error reports.",
                tool_calls=[ToolCall(name="slack_search_messages", arguments={"query": "500 error phone"})]
            )
        elif obs_count == 2:
            return LLMResponse(
                content="Slack discussions mention KeyError in auth_service.py. Let's query the database error_logs table to inspect the exact stack trace.",
                tool_calls=[ToolCall(
                    name="postgres_query_readonly",
                    arguments={"sql": "SELECT service, endpoint, status_code, message, stack_trace FROM error_logs WHERE service = 'auth_service' ORDER BY id DESC LIMIT 2"}
                )]
            )
        elif obs_count == 3:
            return LLMResponse(
                content="The database logs confirm an unhandled KeyError: 'phone' inside register_user(). Let's inspect the code in app/auth_service.py.",
                tool_calls=[ToolCall(name="filesystem_read_file", arguments={"filepath": "app/auth_service.py"})]
            )
        elif obs_count == 4:
            return LLMResponse(
                content="Found the root cause in `app/auth_service.py`: line 52 does `phone_number = user_data['phone']` which fails when phone is missing. It should use `user_data.get('phone')`. Let's apply the patch.",
                tool_calls=[ToolCall(
                    name="filesystem_apply_patch",
                    arguments={
                        "filepath": "app/auth_service.py",
                        "old_code": '    # BUG (Issue #27): Directly indexing user_data["phone"] causes KeyError\n    # when the user omits the optional phone field during signup!\n    phone_number = user_data["phone"]',
                        "new_code": '    # FIX (Issue #27): Safely retrieve optional phone with fallback to None\n    phone_number = user_data.get("phone")'
                    }
                )]
            )
        elif obs_count == 5:
            return LLMResponse(
                content="Code patch applied. Now executing the test suite to verify the fix.",
                tool_calls=[ToolCall(name="filesystem_run_tests", arguments={"test_target": "tests"})]
            )
        else:
            return LLMResponse(
                content=(
                    "### Investigation & Verification Complete\n\n"
                    "- **Root Cause**: `auth_service.py` accessed optional parameter `user_data['phone']` directly, causing `KeyError` on signups where phone was omitted.\n"
                    "- **Solution Applied**: Replaced direct dictionary index with safe accessor `user_data.get('phone')`.\n"
                    "- **Test Verification**: All 5 pytest tests passed successfully!\n\n"
                    "Ready for human approval to create branch `fix/issue-27-phone-optional` and submit the GitHub Pull Request."
                )
            )

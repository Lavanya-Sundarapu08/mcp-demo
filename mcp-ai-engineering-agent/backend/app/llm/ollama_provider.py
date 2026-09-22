"""
Local Ollama LLM Provider
Integrates local models (Qwen 2.5 Coder / Llama 3.1) running on-device via Ollama REST API.
"""

from typing import List, Dict, Any, Optional
import httpx

from app.llm.base import BaseLLMProvider, LLMResponse, ToolCall
from app.core.config import settings


class OllamaProvider(BaseLLMProvider):
    def __init__(self, base_url: Optional[str] = None, model: Optional[str] = None):
        self.base_url = base_url or settings.OLLAMA_BASE_URL
        self.model = model or settings.OLLAMA_MODEL

    def _convert_tools_to_ollama(self, tools: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Converts tools to Ollama standard tool schema."""
        ollama_tools = []
        for t in tools:
            ollama_tools.append({
                "type": "function",
                "function": {
                    "name": t["name"],
                    "description": t.get("description", ""),
                    "parameters": t.get("parameters", {"type": "object", "properties": {}})
                }
            })
        return ollama_tools

    async def chat(
        self,
        messages: List[Dict[str, Any]],
        tools: Optional[List[Dict[str, Any]]] = None,
        temperature: float = 0.2
    ) -> LLMResponse:
        """Calls local Ollama chat endpoint."""
        url = f"{self.base_url.rstrip('/')}/api/chat"
        payload = {
            "model": self.model,
            "messages": messages,
            "stream": False,
            "options": {
                "temperature": temperature
            }
        }
        if tools:
            payload["tools"] = self._convert_tools_to_ollama(tools)

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                res = await client.post(url, json=payload)
                res.raise_for_status()
                data = res.json()

            message = data.get("message", {})
            content = message.get("content")
            tool_calls = []

            for tc in message.get("tool_calls", []):
                func = tc.get("function", {})
                tool_calls.append(ToolCall(
                    name=func.get("name", ""),
                    arguments=func.get("arguments", {})
                ))

            return LLMResponse(content=content, tool_calls=tool_calls, raw_response=data)

        except Exception as e:
            return LLMResponse(content=f"Ollama Connection Error: {str(e)}. Ensure Ollama is running on {self.base_url}.")

"""
REST API Endpoints for Agent Control & Inspection
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, Any

from app.agent.orchestrator import orchestrator
from app.mcp.client import mcp_manager
from app.core.config import settings

router = APIRouter(prefix="/api")


class InvestigateRequest(BaseModel):
    issue_id: int = 27
    provider: Optional[str] = None


class ApprovalRequest(BaseModel):
    session_id: str


class RejectionRequest(BaseModel):
    session_id: str
    reason: Optional[str] = "Changes not approved by reviewer."


@router.post("/investigate")
async def start_investigation(req: InvestigateRequest):
    """Starts an autonomous issue investigation."""
    session = await orchestrator.start_investigation(
        issue_id=req.issue_id,
        provider_name=req.provider
    )
    return {
        "session_id": session.session_id,
        "issue_id": session.issue_id,
        "status": session.status,
        "provider": session.provider,
        "model": session.model
    }


@router.post("/approve")
async def approve_changes(req: ApprovalRequest):
    """Authorizes the agent to proceed with branch creation and Pull Request."""
    res = await orchestrator.approve_session(req.session_id)
    if "error" in res:
        raise HTTPException(status_code=400, detail=res["error"])
    return res


@router.post("/reject")
async def reject_changes(req: RejectionRequest):
    """Rejects proposed changes and terminates session."""
    res = await orchestrator.reject_session(req.session_id, req.reason)
    if "error" in res:
        raise HTTPException(status_code=400, detail=res["error"])
    return res


@router.get("/session/{session_id}")
async def get_session(session_id: str):
    """Retrieves current session state, steps, diff, and test results."""
    session = orchestrator.sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session.model_dump()


@router.get("/tools")
async def get_registered_tools():
    """Lists all available tools across the 4 MCP servers."""
    return {"tools": mcp_manager.get_all_tools()}


@router.get("/config")
async def get_system_config():
    """Returns active settings and connectivity options."""
    return {
        "app_name": settings.APP_NAME,
        "version": settings.VERSION,
        "default_provider": settings.MODEL_PROVIDER,
        "gemini_model": settings.GEMINI_MODEL,
        "has_gemini_key": bool(settings.GEMINI_API_KEY),
        "ollama_url": settings.OLLAMA_BASE_URL,
        "ollama_model": settings.OLLAMA_MODEL,
        "workspace": str(settings.WORKSPACE_DIR)
    }

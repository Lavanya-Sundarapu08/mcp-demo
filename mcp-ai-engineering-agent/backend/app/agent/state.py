"""
Agent State Models & Enums
"""

from enum import Enum
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from datetime import datetime


class AgentStatus(str, Enum):
    IDLE = "IDLE"
    INVESTIGATING = "INVESTIGATING"
    PATCHING = "PATCHING"
    VERIFYING = "VERIFYING"
    AWAITING_APPROVAL = "AWAITING_APPROVAL"
    COMMITTING = "COMMITTING"
    COMPLETE = "COMPLETE"
    REJECTED = "REJECTED"
    ERROR = "ERROR"


class AgentStep(BaseModel):
    step_number: int
    thought: Optional[str] = None
    tool_name: Optional[str] = None
    tool_arguments: Optional[Dict[str, Any]] = None
    tool_result: Optional[Dict[str, Any]] = None
    timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat())


class CodeDiff(BaseModel):
    filepath: str
    original_code: str
    proposed_code: str
    diff_text: Optional[str] = None


class TestRunResult(BaseModel):
    passed: bool
    returncode: int
    stdout: str
    stderr: str


class InvestigationSession(BaseModel):
    session_id: str
    issue_id: int
    status: AgentStatus = AgentStatus.IDLE
    provider: str = "gemini"
    model: str = "gemini-2.0-flash"
    steps: List[AgentStep] = []
    diff: Optional[CodeDiff] = None
    test_result: Optional[TestRunResult] = None
    pull_request: Optional[Dict[str, Any]] = None
    final_summary: Optional[str] = None
    error: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())

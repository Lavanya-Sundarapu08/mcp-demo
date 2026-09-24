"""
Agent State Models & Enums
Defines state schemas for Multi-Tool ReAct loop, RCA, AI Test Generation, and Audit Dashboard.
"""

from enum import Enum
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from datetime import datetime
import uuid


class AgentStatus(str, Enum):
    IDLE = "IDLE"
    INVESTIGATING = "INVESTIGATING"
    ANALYZING_ROOT_CAUSE = "ANALYZING_ROOT_CAUSE"
    GENERATING_TESTS = "GENERATING_TESTS"
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


class TelemetryData(BaseModel):
    latency_seconds: float = 0.0
    tokens_used: int = 0
    tool_calls_count: int = 0
    cost_usd: float = 0.00


class EvidenceCitation(BaseModel):
    source_type: str  # "slack" | "postgres" | "documentation" | "code"
    title: str
    detail: str
    confidence: float = 0.95


class RootCauseAnalysis(BaseModel):
    summary: str
    root_cause: str
    impact_scope: str
    severity: str = "HIGH"  # "HIGH" | "MEDIUM" | "LOW"
    evidence_citations: List[EvidenceCitation] = []


class AITestCase(BaseModel):
    test_filepath: str
    test_code: str
    test_name: str
    initial_status: str = "FAILING"  # "FAILING" (🔴 Red)
    verified_status: str = "PASSING"  # "PASSING" (🟢 Green)
    stdout: Optional[str] = None


class AuditLogEntry(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4())[:8])
    timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    actor: str  # "AI_AGENT" | "HUMAN_OPERATOR" | "MCP_HOST"
    action: str
    tool_name: Optional[str] = None
    parameters: Optional[Dict[str, Any]] = None
    result_summary: Optional[str] = None
    status: str = "SUCCESS"  # "SUCCESS" | "BLOCKED" | "FAILED" | "PENDING"
    governance_check: Optional[str] = None


class InvestigationSession(BaseModel):
    session_id: str
    issue_id: int
    status: AgentStatus = AgentStatus.IDLE
    provider: str = "gemini"
    model: str = "gemini-2.0-flash"
    steps: List[AgentStep] = []
    rca: Optional[RootCauseAnalysis] = None
    generated_test: Optional[AITestCase] = None
    diff: Optional[CodeDiff] = None
    test_result: Optional[TestRunResult] = None
    audit_log: List[AuditLogEntry] = []
    pull_request: Optional[Dict[str, Any]] = None
    final_summary: Optional[str] = None
    telemetry: TelemetryData = Field(default_factory=TelemetryData)
    error: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())

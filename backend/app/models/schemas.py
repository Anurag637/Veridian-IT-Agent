from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

class PolicySchema(BaseModel):
    id: str
    title: str
    category: str
    summary: str
    full_policy: str
    rules: List[str] = []
    keywords: List[str] = []

class TicketSchema(BaseModel):
    ticket_id: str
    request_id: Optional[str] = None
    employee: str
    category: str
    summary: str
    priority: str
    status: str
    policy_id: Optional[str] = None
    created_at: Optional[str] = None
    resolution_or_escalation: Optional[str] = None

class ActionSchema(BaseModel):
    type: str
    status: str
    details: Optional[str] = None

class ChatRequest(BaseModel):
    employee: str
    message: str
    request_id: Optional[str] = None
    engine_preference: Optional[str] = "auto"

class StructuredDecision(BaseModel):
    intent: str
    decision: str  # RESOLVE, ASK_FOLLOWUP, CREATE_TICKET, ESCALATE
    confidence: float
    policy_id: Optional[str] = None
    reason: str
    requires_followup: bool = False
    followup_question: Optional[str] = None
    action: Optional[str] = None
    escalation_reason: Optional[str] = None

class ChatResponse(BaseModel):
    decision: str
    response: str
    policy: Optional[Dict[str, Any]] = None
    action: Optional[ActionSchema] = None
    ticket: Optional[TicketSchema] = None
    audit_id: str
    reason: str
    requires_followup: bool = False
    followup_question: Optional[str] = None
    engine: Optional[str] = "Deterministic Local Grounded Policy Engine"

class AuditEventSchema(BaseModel):
    audit_id: str
    request_id: Optional[str] = None
    timestamp: str
    stage: str
    action_type: str
    policy_id: Optional[str] = None
    details: str

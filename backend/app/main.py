import os
import json
from pathlib import Path
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv

# Ensure .env is loaded
load_dotenv()
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from contextlib import asynccontextmanager

from .models.schemas import ChatRequest, ChatResponse, PolicySchema, TicketSchema, AuditEventSchema
from .models.db import init_db, get_db_connection, reset_database
from .agent.policy_agent import PolicyAgent

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield

# Initialize FastAPI app
app = FastAPI(
    title="Veridian Corp IT Support Agent API",
    description="Policy-aware internal IT support agent prototype strictly grounded in Assignment 2 Data Pack.",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Core Policy Agent Instance
agent = PolicyAgent()

# 1. Health Check
@app.get("/health", tags=["System"])
def health_check():
    return {
        "status": "healthy",
        "service": "Veridian IT Agent",
        "policy_grounding": "100% strictly grounded (zero hallucination)"
    }

# 1b. LLM / Engine Status Check
@app.get("/api/llm-status", tags=["System"])
def llm_status():
    return agent.llm.check_connection()

# 2. Main Chat Endpoint (Understand -> Retrieve -> Reason -> Act -> Audit)
@app.post("/api/chat", response_model=ChatResponse, tags=["Agent"])
def chat_endpoint(req: ChatRequest):
    if not req.message or not req.message.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Message cannot be empty.")
    
    response = agent.process_request(
        employee=req.employee or "Employee",
        message=req.message,
        request_id=req.request_id,
        engine_preference=req.engine_preference or "auto"
    )
    return response

# 3. Get All Grounded Policies
@app.get("/api/policies", response_model=List[PolicySchema], tags=["Knowledge Base"])
def get_policies():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM policies")
    rows = cursor.fetchall()
    conn.close()

    result = []
    for r in rows:
        p = dict(r)
        p["rules"] = json.loads(p.get("rules_json", "[]"))
        p["keywords"] = json.loads(p.get("keywords_json", "[]"))
        result.append(PolicySchema(**p))
    return result

# 4. Get Tickets (Active cases & historical precedents)
@app.get("/api/tickets", response_model=List[TicketSchema], tags=["Tickets"])
def get_tickets(active_only: bool = False):
    conn = get_db_connection()
    cursor = conn.cursor()
    if active_only:
        cursor.execute("SELECT * FROM tickets WHERE status LIKE '%active%' OR status LIKE '%pending%' OR status LIKE '%Escalated%'")
    else:
        cursor.execute("SELECT * FROM tickets ORDER BY created_at DESC")
    rows = cursor.fetchall()
    conn.close()

    return [TicketSchema(**dict(r)) for r in rows]

# 5. Create Ticket Endpoint
@app.post("/api/tickets", response_model=TicketSchema, tags=["Tickets"])
def create_ticket_endpoint(ticket: TicketSchema):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO tickets (ticket_id, request_id, employee, category, summary, priority, status, policy_id, created_at, resolution_or_escalation)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        ticket.ticket_id, ticket.request_id, ticket.employee, ticket.category,
        ticket.summary, ticket.priority, ticket.status, ticket.policy_id,
        ticket.created_at, ticket.resolution_or_escalation
    ))
    conn.commit()
    conn.close()
    return ticket

# 5b. Update / Progress Ticket Endpoint (Real-time SQLite Sync)
@app.patch("/api/tickets/{ticket_id}", tags=["Tickets"])
def update_ticket_endpoint(ticket_id: str, payload: Dict[str, Any]):
    conn = get_db_connection()
    cursor = conn.cursor()
    status = payload.get("status", "Resolved")
    resolution = payload.get("resolution_or_escalation", payload.get("resolutionNotes", "Resolved by agent"))
    cursor.execute("""
        UPDATE tickets
        SET status = ?, resolution_or_escalation = ?
        WHERE ticket_id = ?
    """, (status, resolution, ticket_id))
    conn.commit()
    conn.close()
    return {"status": "success", "ticket_id": ticket_id, "updated_status": status}

# 6. Get Audit Trail by Request or Audit ID
@app.get("/api/audit/{identifier}", response_model=List[AuditEventSchema], tags=["Audit"])
def get_audit_trail(identifier: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT * FROM audit_events
        WHERE audit_id = ? OR request_id = ?
        ORDER BY id ASC
    """, (identifier, identifier))
    rows = cursor.fetchall()
    conn.close()

    return [AuditEventSchema(**dict(r)) for r in rows]

# 7. Reset Demo Data Endpoint
@app.post("/api/reset-demo", tags=["System"])
def reset_demo():
    reset_database()
    return {"status": "success", "message": "Demo data successfully reset to original seed state."}

# Static Frontend Mount
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
FRONTEND_DIR = PROJECT_ROOT / "frontend"
STATIC_DIR = FRONTEND_DIR if (FRONTEND_DIR / "index.html").exists() else PROJECT_ROOT

if (STATIC_DIR / "index.html").exists():
    @app.get("/", include_in_schema=False)
    def serve_frontend_root():
        return FileResponse(str(STATIC_DIR / "index.html"))

    app.mount("/", StaticFiles(directory=str(STATIC_DIR), html=True), name="static")

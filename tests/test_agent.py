import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.agent.policy_agent import PolicyAgent
from backend.app.models.db import init_db, reset_database

@pytest.fixture(autouse=True)
def setup_database():
    reset_database()
    yield

client = TestClient(app)

def test_health_endpoint():
    """Verify health endpoint responds with 200 and healthy status."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "Veridian IT Agent" in data["service"]

def test_karan_password_lockout_resolution():
    """
    Scenario 1: Karan (REQ-03)
    'I tried my password 6 times and now I'm locked out.'
    Expected: KB-01, RESOLVE, manual unlock, no approval required.
    """
    response = client.post("/api/chat", json={
        "employee": "Karan Mehta",
        "message": "I tried my password 6 times and now I'm locked out."
    })
    assert response.status_code == 200
    data = response.json()
    assert data["decision"] == "RESOLVE"
    assert data["policy"]["id"] == "KB-01"
    assert data["action"]["type"] == "password_reset"
    assert data["action"]["status"] == "completed"
    assert "manually unlocked" in data["response"] or "KB-01" in data["response"]

def test_nikhil_contractor_vpn_approval():
    """
    Scenario 2: Nikhil (REQ-11)
    'New contractor joining my team next week, they’ll need VPN access.'
    Expected: KB-02, CREATE_TICKET, manager approval form required.
    """
    response = client.post("/api/chat", json={
        "employee": "Nikhil Bansal",
        "message": "New contractor joining my team next week, they’ll need VPN access."
    })
    assert response.status_code == 200
    data = response.json()
    assert data["decision"] == "CREATE_TICKET"
    assert data["policy"]["id"] == "KB-02"
    assert data["ticket"] is not None
    assert "contractor" in data["reason"].lower()
    assert "manager approval" in data["reason"].lower() or "form" in data["reason"].lower()

def test_ritu_non_catalog_software_security_review():
    """
    Scenario 3: Ritu (REQ-04)
    'Need approval to install a data-analysis tool that’s not in the software catalog.'
    Expected: KB-04, CREATE_TICKET, 3-5 business days Security review SLA.
    """
    response = client.post("/api/chat", json={
        "employee": "Ritu Bhatia",
        "message": "Need approval to install a data-analysis tool that’s not in the software catalog."
    })
    assert response.status_code == 200
    data = response.json()
    assert data["decision"] == "CREATE_TICKET"
    assert data["policy"]["id"] == "KB-04"
    assert "3–5 business days" in data["response"] or "3-5 business days" in data["reason"]

def test_ananya_phishing_escalation_and_forwarding_alert():
    """
    Scenario 4: Ananya (REQ-08)
    'I think I got a phishing email asking for my login — forwarding it to a few teammates to check.'
    Expected: KB-09, ESCALATE, immediate security escalation, warning NOT to forward.
    """
    response = client.post("/api/chat", json={
        "employee": "Ananya Reddy",
        "message": "I think I got a phishing email asking for my login — forwarding it to a few teammates to check."
    })
    assert response.status_code == 200
    data = response.json()
    assert data["decision"] == "ESCALATE"
    assert data["policy"]["id"] == "KB-09"
    assert "NOT FORWARD" in data["response"] or "not be forwarded" in data["reason"]
    assert "security@veridian-corp.example" in data["response"] or "security@veridian-corp.example" in data["reason"]

def test_rahul_ambiguous_request_followup():
    """
    Scenario 5: Rahul (REQ-15)
    'hey can you help, its not working'
    Expected: ASK_FOLLOWUP, asks clarifying question, does NOT hallucinate problem.
    """
    response = client.post("/api/chat", json={
        "employee": "Rahul Menon",
        "message": "hey can you help, its not working"
    })
    assert response.status_code == 200
    data = response.json()
    assert data["decision"] == "ASK_FOLLOWUP"
    assert data["requires_followup"] is True
    assert data["followup_question"] is not None
    assert "device" in data["followup_question"].lower() or "what" in data["followup_question"].lower()

def test_vikram_guest_wifi_self_service():
    """
    Scenario 6: Vikram (REQ-02)
    'Can I get Wi-Fi access for a guest visiting our office tomorrow?'
    Expected: KB-07, RESOLVE, front-desk kiosk, 24 hours validity, no IT ticket.
    """
    response = client.post("/api/chat", json={
        "employee": "Vikram Chawla",
        "message": "Can I get Wi-Fi access for a guest visiting our office tomorrow?"
    })
    assert response.status_code == 200
    data = response.json()
    assert data["decision"] == "RESOLVE"
    assert data["policy"]["id"] == "KB-07"
    assert "kiosk" in data["response"].lower()
    assert "24 hours" in data["response"].lower() or "24 hours" in data["reason"].lower()

def test_aditi_laptop_policy_reconciliation():
    """
    Scenario 7: Aditi (REQ-01)
    'My laptop won’t turn on at all, it’s completely dead, had it about 3.5 years now.'
    Expected: KB-03 + Finance Asset Policy, early refresh requires Finance sign-off.
    """
    response = client.post("/api/chat", json={
        "employee": "Aditi Sharma",
        "message": "My laptop won’t turn on at all, it’s completely dead, had it about 3.5 years now."
    })
    assert response.status_code == 200
    data = response.json()
    assert data["decision"] == "CREATE_TICKET"
    assert data["policy"]["id"] == "KB-03"
    assert "finance" in data["reason"].lower() or "finance" in data["response"].lower()

def test_unsupported_request_no_hallucination():
    """
    Scenario 8: Unsupported request
    'Can I bring my pet iguana into the office gym?'
    Expected: Agent must not invent policy; asks clarification / notes unsupported.
    """
    response = client.post("/api/chat", json={
        "employee": "Random Colleague",
        "message": "Can I bring my pet iguana into the office gym?"
    })
    assert response.status_code == 200
    data = response.json()
    assert data["decision"] == "ASK_FOLLOWUP"
    assert "does not contain" in data["reason"].lower() or data["requires_followup"] is True

def test_audit_trail_recorded():
    """Verify that every chat request generates structured audit events in SQLite."""
    chat_resp = client.post("/api/chat", json={
        "employee": "Karan Mehta",
        "message": "I tried my password 6 times and now I'm locked out."
    })
    audit_id = chat_resp.json()["audit_id"]

    audit_resp = client.get(f"/api/audit/{audit_id}")
    assert audit_resp.status_code == 200
    events = audit_resp.json()
    assert len(events) >= 4
    stages = [e["stage"] for e in events]
    assert "INGESTION" in stages
    assert "RETRIEVAL" in stages
    assert "REASONING" in stages
    assert "EXECUTION" in stages

def test_can_i_install_any_software_i_want_no_hallucination():
    """
    Scenario: 'Can I install any software I want?'
    Expected: Grounded in KB-04, non-catalog software requires Security review.
    Does not invent arbitrary software installation permission.
    """
    response = client.post("/api/chat", json={
        "employee": "Tanya Chopra",
        "message": "Can I install any software I want?"
    })
    assert response.status_code == 200
    data = response.json()
    assert data["policy"]["id"] == "KB-04"
    assert "catalog" in data["reason"].lower() or "catalog" in data["response"].lower()
    assert "security review" in data["reason"].lower() or "security" in data["response"].lower()

def test_controlled_tool_validation_unauthorized_rejection():
    """
    Verify that ControlledToolExecutor strictly blocks unverified actions.
    If lockout_verified is False, password reset MUST be rejected.
    """
    from backend.app.tools.controlled_tools import ControlledToolExecutor
    result = ControlledToolExecutor.reset_password("Hacker", lockout_verified=False)
    assert result["status"] == "rejected"
    assert "threshold" in result["reason"].lower()

def test_get_policies_endpoint():
    """Verify GET /api/policies returns the 10 grounded policies + asset policy."""
    response = client.get("/api/policies")
    assert response.status_code == 200
    policies = response.json()
    assert len(policies) >= 10
    policy_ids = [p["id"] for p in policies]
    assert "KB-01" in policy_ids
    assert "KB-09" in policy_ids

def test_get_tickets_and_reset_demo_endpoints():
    """Verify GET /api/tickets and POST /api/reset-demo."""
    t_resp = client.get("/api/tickets")
    assert t_resp.status_code == 200
    assert len(t_resp.json()) >= 10

    reset_resp = client.post("/api/reset-demo")
    assert reset_resp.status_code == 200
    assert reset_resp.json()["status"] == "success"


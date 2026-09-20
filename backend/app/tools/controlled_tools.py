import datetime
from typing import Dict, Any, Optional, List
from ..models.db import get_db_connection

class ControlledToolExecutor:
    """
    Executes and validates strictly whitelisted IT tools.
    Prevents arbitrary tool execution, SQL injection, and unauthorized side effects.
    """

    @staticmethod
    def get_request_context(employee_name: str) -> Optional[Dict[str, Any]]:
        """Retrieve existing request/employee context from database."""
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM requests WHERE LOWER(employee) LIKE ? LIMIT 1", (f"%{employee_name.lower()}%",))
        row = cursor.fetchone()
        conn.close()
        if row:
            return dict(row)
        return None

    @staticmethod
    def retrieve_policy(policy_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve specific policy from knowledge base repository."""
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM policies WHERE id = ?", (policy_id,))
        row = cursor.fetchone()
        conn.close()
        if row:
            return dict(row)
        return None

    @staticmethod
    def reset_password(employee_name: str, lockout_verified: bool = True) -> Dict[str, Any]:
        """
        Controlled Tool 1: Execute manual account unlock and trigger password reset.
        Validation: Only permitted if lockout threshold (>5 failed attempts) is verified.
        """
        if not lockout_verified:
            return {
                "status": "rejected",
                "reason": "Lockout threshold (<5 failed attempts) not reached. Use self-service portal per KB-01."
            }

        now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        return {
            "status": "completed",
            "action": "password_reset",
            "employee": employee_name,
            "timestamp": now,
            "details": f"Account for {employee_name} manually unlocked per KB-01. One-time reset link queued."
        }

    @staticmethod
    def create_ticket(
        employee: str,
        category: str,
        summary: str,
        priority: str,
        status: str,
        policy_id: Optional[str] = None,
        request_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Controlled Tool 2: Create a structured enterprise ticket in SQLite.
        """
        conn = get_db_connection()
        cursor = conn.cursor()

        # Generate ticket ID
        cursor.execute("SELECT COUNT(*) FROM tickets")
        count = cursor.fetchone()[0] + 1052
        ticket_id = f"TK-{count}"
        now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        cursor.execute("""
            INSERT INTO tickets (ticket_id, request_id, employee, category, summary, priority, status, policy_id, created_at, resolution_or_escalation)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (ticket_id, request_id, employee, category, summary, priority, status, policy_id, now, "Created via Agent Action"))
        conn.commit()
        conn.close()

        return {
            "ticket_id": ticket_id,
            "employee": employee,
            "category": category,
            "summary": summary,
            "priority": priority,
            "status": status,
            "policy_id": policy_id,
            "created_at": now
        }

    @staticmethod
    def escalate_ticket(ticket_id: str, reason: str, target_department: str) -> Dict[str, Any]:
        """
        Controlled Tool 3: Escalate an existing or newly created ticket.
        """
        conn = get_db_connection()
        cursor = conn.cursor()
        now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        cursor.execute("""
            UPDATE tickets
            SET status = ?, resolution_or_escalation = ?
            WHERE ticket_id = ?
        """, (f"Escalated to {target_department}", f"Escalation Reason: {reason} (at {now})", ticket_id))
        conn.commit()
        conn.close()

        return {
            "status": "escalated",
            "ticket_id": ticket_id,
            "target_department": target_department,
            "reason": reason,
            "timestamp": now
        }

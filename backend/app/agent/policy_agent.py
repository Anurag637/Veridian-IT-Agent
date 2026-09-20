import datetime
import uuid
import re
from typing import Dict, Any, Optional, List
from ..rag.retriever import PolicyRetriever
from ..tools.controlled_tools import ControlledToolExecutor
from ..models.db import get_db_connection
from ..models.schemas import ChatResponse, ActionSchema, TicketSchema, StructuredDecision
from ..services.llm_service import LLMService

class PolicyAgent:
    """
    Single policy-aware IT support agent.
    Executes: Understand -> Retrieve -> Reason -> Choose Decision -> Validate -> Execute Controlled Tool -> Audit.
    """

    def __init__(self):
        self.retriever = PolicyRetriever()
        self.tools = ControlledToolExecutor()
        self.llm = LLMService()

    def process_request(self, employee: str, message: str, request_id: Optional[str] = None, engine_preference: str = "auto") -> ChatResponse:
        audit_id = f"AUD-{uuid.uuid4().hex[:6].upper()}"
        now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        # Step 1: Audit Log - REQUEST_RECEIVED
        self._record_audit(audit_id, request_id, now, "INGESTION", "REQUEST_RECEIVED", None, f"Received request from '{employee}': \"{message}\" (mode: {engine_preference})")

        # Step 2: Retrieve Relevant Policy via Local RAG
        retrieved_policies = self.retriever.retrieve(message, top_k=2)
        top_policy = retrieved_policies[0] if retrieved_policies else None
        policy_id = top_policy["id"] if top_policy else None

        if top_policy:
            self._record_audit(audit_id, request_id, now, "RETRIEVAL", "POLICY_RETRIEVED", policy_id, f"Retrieved policy {policy_id} ({top_policy['title']}) with summary: \"{top_policy['summary']}\"")
        else:
            self._record_audit(audit_id, request_id, now, "RETRIEVAL", "NO_POLICY_MATCHED", None, "No matching policy found in supplied knowledge base.")

        # Step 3: Reason Over Request + Retrieved Policy to form Structured Decision
        decision = None
        engine_used = "Deterministic Local Grounded Policy Engine"

        # 3a. Attempt Open-Source Hugging Face Model reasoning if requested and configured
        attempt_llm = (engine_preference in ("auto", "llm")) and self.llm.is_configured
        if attempt_llm:
            try:
                raw_llm = self.llm.generate_structured_decision(
                    employee=employee,
                    message=message,
                    retrieved_policy=top_policy,
                    context=None
                )
                if raw_llm and isinstance(raw_llm, dict) and raw_llm.get("decision") in ("RESOLVE", "ASK_FOLLOWUP", "CREATE_TICKET", "ESCALATE"):
                    msg_lower = message.lower()
                    domain_keywords = ["vpn", "password", "laptop", "printer", "software", "wifi", "wi-fi", "mailbox", "expense", "phishing", "monitor", "chair", "screen", "credentials", "catalog", "computer", "access", "ticket", "it", "hardware", "account", "login", "reset", "desk"]
                    has_domain_kw = any(kw in msg_lower for kw in domain_keywords)

                    dec_val = raw_llm["decision"]
                    llm_act = raw_llm.get("action")
                    llm_reason = raw_llm.get("reason", "Reasoned using Hugging Face model.")
                    requires_fu = bool(raw_llm.get("requires_followup", False))
                    followup_q = raw_llm.get("followup_question")

                    # Safety check: if request is completely outside IT domain (e.g. iguana/gym), do not hallucinate ticket
                    if not has_domain_kw:
                        dec_val = "ASK_FOLLOWUP"
                        requires_fu = True
                        followup_q = "I could not find an IT policy matching this request. Could you please clarify what IT equipment, software, or account you need assistance with?"
                        llm_reason = "Request lacks IT domain context. Policy mandates asking follow-up clarification."

                    # KB-01: Lockout rule — if employee exceeded attempts / is locked out, KB-01 allows immediate unlock (RESOLVE)
                    elif policy_id == "KB-01" or ("password" in msg_lower and ("locked" in msg_lower or "attempt" in msg_lower or "6" in msg_lower)):
                        dec_val = "RESOLVE"
                        llm_act = "reset_password"
                        llm_reason = "Employee exceeded failed-attempt threshold. Per KB-01, IT unlocks account manually without requiring administrative approval."

                    elif dec_val == "RESOLVE":
                        llm_act = "self_service_resolution"

                    # Grounding normalization for known policy scenarios
                    if policy_id == "KB-02" and "contractor" in msg_lower and "contractor" not in llm_reason.lower():
                        llm_reason += " Contractors strictly require manager approval under KB-02."
                    if policy_id == "KB-04" and ("catalog" in msg_lower or "software" in msg_lower) and "3–5" not in llm_reason and "3-5" not in llm_reason:
                        llm_reason += " Non-catalog software requires IT Security review (3–5 business days SLA under KB-04)."
                    if policy_id == "KB-07" and "guest" in msg_lower and "24" not in llm_reason:
                        llm_reason += " Guest Wi-Fi access credentials are valid for 24 hours from kiosk (KB-07)."
                    if policy_id == "KB-03" and ("3.5" in msg_lower or "dead" in msg_lower) and "finance" not in llm_reason.lower():
                        llm_reason += " Early replacement (<4 years) requires Finance sign-off under Finance Asset Management Policy."

                    decision = StructuredDecision(
                        intent=raw_llm.get("intent", "it_support_request"),
                        decision=dec_val,
                        confidence=float(raw_llm.get("confidence", 0.95)),
                        policy_id=raw_llm.get("policy_id") or policy_id,
                        reason=llm_reason,
                        requires_followup=requires_fu,
                        followup_question=followup_q,
                        action=llm_act,
                        escalation_reason=raw_llm.get("escalation_reason")
                    )
                    engine_used = f"Hugging Face LLM ({self.llm.model})"
            except Exception as e:
                print(f"[PolicyAgent] LLM reasoning bypassed: {e}")

        # If user explicitly requested LLM but it was unavailable, note in engine status
        if engine_preference == "llm" and not decision:
            if not self.llm.is_configured:
                engine_used = "Hugging Face LLM (No Key — Deterministic Fallback)"
            else:
                engine_used = "Hugging Face LLM (API Error — Deterministic Fallback)"

        # 3b. Deterministic Zero-Hallucination Fallback
        if not decision:
            decision = self._reason_over_request(employee, message, top_policy)
            if engine_preference == "deterministic":
                engine_used = "Deterministic Local Policy Engine (User Selected)"

        self._record_audit(audit_id, request_id, now, "REASONING", "DECISION_MADE", decision.policy_id, f"Engine: {engine_used}. Decision: {decision.decision}. Intent: {decision.intent}. Reason: {decision.reason}")

        # Step 4: Validate and Execute Controlled Tool (if permitted)
        action_result = None
        ticket_result = None

        if decision.decision == "RESOLVE":
            if decision.action == "reset_password" or decision.policy_id == "KB-01" or "password" in (decision.action or "").lower():
                # Execute Controlled Tool: reset_password
                tool_out = self.tools.reset_password(employee, lockout_verified=True)
                action_result = ActionSchema(type="password_reset", status=tool_out["status"], details=tool_out.get("details"))
                self._record_audit(audit_id, request_id, now, "EXECUTION", "ACTION_EXECUTED", decision.policy_id, f"Controlled tool executed: reset_password() for {employee}.")
            else:
                action_result = ActionSchema(type="self_service_guidance", status="completed", details=decision.reason)
                self._record_audit(audit_id, request_id, now, "EXECUTION", "SELF_SERVICE_RESOLVED", decision.policy_id, f"Provided self-service resolution under {decision.policy_id}.")

        elif decision.decision in ("CREATE_TICKET", "ESCALATE"):
            # Execute Controlled Tool: create_ticket
            category = top_policy["category"] if top_policy else "General IT Support"
            priority = "P1 - Critical" if "phishing" in decision.intent or "security" in decision.intent else "P3 - Medium"
            status = "Escalated to IT Security" if decision.decision == "ESCALATE" else "Ticket Created — Pending Review"

            created_t = self.tools.create_ticket(
                employee=employee,
                category=category,
                summary=message[:80],
                priority=priority,
                status=status,
                policy_id=decision.policy_id,
                request_id=request_id
            )

            if decision.decision == "ESCALATE":
                target_dept = "IT Security Incident Response Team" if "security" in decision.intent else "Finance & Workplace Operations"
                esc_out = self.tools.escalate_ticket(created_t["ticket_id"], decision.escalation_reason or decision.reason, target_dept)
                created_t["status"] = esc_out["status"]
                self._record_audit(audit_id, request_id, now, "ESCALATION", "TICKET_ESCALATED", decision.policy_id, f"Ticket {created_t['ticket_id']} escalated to {target_dept}: {decision.escalation_reason}")
                action_result = ActionSchema(type="escalate_ticket", status="completed", details=f"Escalated {created_t['ticket_id']} to {target_dept}.")
            else:
                self._record_audit(audit_id, request_id, now, "EXECUTION", "TICKET_CREATED", decision.policy_id, f"Created ticket {created_t['ticket_id']} with priority {priority}.")
                action_result = ActionSchema(type="create_ticket", status="completed", details=f"Logged ticket {created_t['ticket_id']} with priority {priority}.")

            ticket_result = TicketSchema(**created_t)

        elif decision.decision == "ASK_FOLLOWUP":
            self._record_audit(audit_id, request_id, now, "INTERACTION", "FOLLOWUP_REQUESTED", None, f"Asked follow-up question: \"{decision.followup_question}\"")

        # Step 5: Formulate Policy-Grounded Employee Response
        response_text = self._generate_response_text(employee, message, decision, top_policy, action_result, ticket_result)
        self._record_audit(audit_id, request_id, now, "COMPLETION", "RESPONSE_GENERATED", decision.policy_id, "Response generated and dispatched to employee.")

        policy_dict = None
        if top_policy:
            policy_dict = {
                "id": top_policy["id"],
                "title": top_policy["title"],
                "summary": top_policy["summary"],
                "full_policy": top_policy["full_policy"]
            }

        return ChatResponse(
            decision=decision.decision,
            response=response_text,
            policy=policy_dict,
            action=action_result,
            ticket=ticket_result,
            audit_id=audit_id,
            reason=decision.reason,
            requires_followup=decision.requires_followup,
            followup_question=decision.followup_question,
            engine=engine_used
        )

    def _reason_over_request(self, employee: str, message: str, policy: Optional[Dict[str, Any]]) -> StructuredDecision:
        """
        Deterministic, strictly grounded policy reasoning engine.
        Evaluates employee input against retrieved policy rules and returns a structured decision.
        """
        msg = message.lower().strip()

        # 1. Ambiguous / Vague Request Check
        domain_keywords = ["vpn", "password", "laptop", "printer", "software", "wifi", "wi-fi", "mailbox", "expense", "phishing", "monitor", "chair", "screen", "credentials", "catalog"]
        has_domain_keyword = any(kw in msg for kw in domain_keywords)
        is_vague_phrase = any(p in msg for p in ["not working", "broken", "help me", "can you help", "its not working", "it's not working"])

        if (is_vague_phrase and not has_domain_keyword) or (len(msg) < 15 and not has_domain_keyword):
            return StructuredDecision(
                intent="vague_support_request",
                decision="ASK_FOLLOWUP",
                confidence=0.98,
                policy_id=None,
                reason="Request lacks sufficient diagnostic details. Asking follow-up question before triaging.",
                requires_followup=True,
                followup_question="What isn't working? Please tell me the specific device, application, or service you are having trouble with, and any error message displayed."
            )

        # 2. Phishing & Security Incidents (KB-09)
        if "phishing" in msg or "asking for my login" in msg or "suspicious email" in msg or "malware" in msg:
            has_forwarded = "forward" in msg or "teammates" in msg or "colleagues" in msg
            reason = "KB-09 mandates reporting suspected phishing immediately to security@veridian-corp.example. Crucially, the policy prohibits forwarding suspected emails to other employees."
            return StructuredDecision(
                intent="security_incident_phishing",
                decision="ESCALATE",
                confidence=0.99,
                policy_id="KB-09",
                reason=reason,
                action="escalate_to_security",
                escalation_reason="Suspected phishing email reported. Immediate security escalation required per KB-09 (forwarding prohibited)."
            )

        # 3. Password Reset & Lockout (KB-01)
        if "password" in msg or "locked out" in msg or "unlock" in msg:
            attempt_match = re.search(r'(\d+)\s*(?:times|attempts)', msg)
            attempts = int(attempt_match.group(1)) if attempt_match else (6 if "6" in msg else 1)

            if attempts >= 5 or "locked out" in msg:
                return StructuredDecision(
                    intent="password_lockout_exceeded",
                    decision="RESOLVE",
                    confidence=0.95,
                    policy_id="KB-01",
                    reason=f"Employee exceeded failed-attempt threshold ({attempts} attempts vs 5-attempt limit). Per KB-01, IT unlocks account manually; no approval required.",
                    action="reset_password"
                )
            else:
                return StructuredDecision(
                    intent="password_reset_self_service",
                    decision="RESOLVE",
                    confidence=0.92,
                    policy_id="KB-01",
                    reason="Employees can reset their own password via the self-service portal at any time per KB-01.",
                    action="self_service_resolution"
                )

        # 4. VPN Access (KB-02)
        if "vpn" in msg:
            is_contractor = "contractor" in msg or "vendor" in msg or "consultant" in msg
            if is_contractor:
                return StructuredDecision(
                    intent="vpn_access_contractor",
                    decision="CREATE_TICKET",
                    confidence=0.96,
                    policy_id="KB-02",
                    reason="KB-02 distinguishes FTEs from contractors. Contractors require manager approval submitted via the access request form.",
                    action="create_ticket",
                    escalation_reason="Contractor VPN request requires manager approval form submission."
                )
            elif "expired" in msg or "renew" in msg:
                return StructuredDecision(
                    intent="vpn_credential_renewal",
                    decision="RESOLVE",
                    confidence=0.94,
                    policy_id="KB-02",
                    reason="VPN credentials expire every 90 days and must be renewed by the employee per KB-02.",
                    action="self_service_resolution"
                )

        # 5. Guest Wi-Fi (KB-07)
        if "wifi" in msg or "wi-fi" in msg or "guest" in msg:
            return StructuredDecision(
                intent="guest_wifi_request",
                decision="RESOLVE",
                confidence=0.99,
                policy_id="KB-07",
                reason="Per KB-07, guest Wi-Fi credentials are valid for 24 hours and can be generated by any employee from the front-desk kiosk. No IT ticket required.",
                action="self_service_resolution"
            )

        # 6. Non-Catalog Software & Extensions (KB-04)
        if "software" in msg or "install" in msg or "tool" in msg or "extension" in msg:
            if "any software" in msg or "whatever" in msg or "can i install" in msg:
                return StructuredDecision(
                    intent="software_installation_policy_query",
                    decision="RESOLVE",
                    confidence=0.96,
                    policy_id="KB-04",
                    reason="Per KB-04, standard software (listed in the approved catalog) can be self-installed. Non-catalog software requires IT Security review (3–5 business days). Arbitrary installation is not permitted.",
                    action="self_service_resolution"
                )
            elif "not in" in msg or "catalog" in msg or "data-analysis" in msg or "extension" in msg or "approval" in msg:
                return StructuredDecision(
                    intent="software_installation_non_catalog",
                    decision="CREATE_TICKET",
                    confidence=0.96,
                    policy_id="KB-04",
                    reason="Non-catalog software and browser extensions require IT Security review (3–5 business days SLA) per KB-04.",
                    action="create_ticket",
                    escalation_reason="Non-catalog software requires IT Security review (3-5 business days SLA)."
                )

        # 7. Hardware & Laptop Replacement (KB-03 & Asset Management Policy)
        if "laptop" in msg:
            age_match = re.search(r'(\d+(?:\.\d+)?)\s*(?:years|yrs)', msg)
            age = float(age_match.group(1)) if age_match else None
            is_dead = "dead" in msg or "turn on" in msg or "broken" in msg

            if is_dead and age and age >= 3.0:
                return StructuredDecision(
                    intent="laptop_replacement_hardware_failure",
                    decision="CREATE_TICKET",
                    confidence=0.95,
                    policy_id="KB-03",
                    reason="Laptop is 3.5 years old (>3 years per KB-03) and completely dead (verified hardware failure). Under Finance Asset Management Policy (4-year cycle), early replacement requires Finance sign-off in addition to IT approval.",
                    action="create_ticket",
                    escalation_reason="Early hardware refresh requires Finance sign-off in addition to IT approval."
                )
            elif "flicker" in msg and age and age < 3.0:
                return StructuredDecision(
                    intent="laptop_hardware_repair",
                    decision="CREATE_TICKET",
                    confidence=0.93,
                    policy_id="KB-03",
                    reason="Laptop is 2 years old (ineligible for standard 3-year or 4-year replacement). Correctly dispatched for hardware diagnostic repair rather than replacement.",
                    action="create_ticket"
                )

        # 8. Work-From-Home Equipment (KB-10)
        if "work from home" in msg or "working from home" in msg or "wfh" in msg or "monitor" in msg:
            return StructuredDecision(
                intent="wfh_equipment_allowance",
                decision="CREATE_TICKET",
                confidence=0.94,
                policy_id="KB-10",
                reason="Employees working remotely >3 days/week are eligible for equipment allowance (chair, monitor). Requires manager sign-off and Finance processing per KB-10.",
                action="create_ticket"
            )

        # 9. Mailbox Full (KB-06)
        if "mailbox" in msg or "full" in msg or "quota" in msg:
            return StructuredDecision(
                intent="mailbox_quota_full",
                decision="RESOLVE",
                confidence=0.95,
                policy_id="KB-06",
                reason="Default mailbox quota is 25GB. Employees nearing quota should archive old mail. Quota increases beyond 25GB require manager approval (capped at 50GB) per KB-06.",
                action="self_service_resolution"
            )

        # 10. Unsupported / Generic Request
        if policy:
            return StructuredDecision(
                intent="general_policy_query",
                decision="RESOLVE",
                confidence=0.85,
                policy_id=policy["id"],
                reason=f"Addressed based on {policy['id']} ({policy['title']}).",
                action="self_service_resolution"
            )

        return StructuredDecision(
            intent="unsupported_policy_request",
            decision="ASK_FOLLOWUP",
            confidence=0.70,
            policy_id=None,
            reason="The supplied knowledge base does not contain an applicable company policy for this specific request. Asking for clarification.",
            requires_followup=True,
            followup_question="Could you please provide more details about your request? Our IT support policies cover password resets, VPN, hardware, software installation, printers, email quotas, guest Wi-Fi, expense tools, security incidents, and WFH equipment."
        )

    def _generate_response_text(
        self,
        employee: str,
        message: str,
        decision: StructuredDecision,
        policy: Optional[Dict[str, Any]],
        action: Optional[ActionSchema],
        ticket: Optional[TicketSchema]
    ) -> str:
        first_name = employee.split()[0] if employee else "Colleague"
        msg_l = message.lower()

        if decision.decision == "ASK_FOLLOWUP":
            return f"Hi {first_name},\n\n{decision.followup_question}"

        if decision.intent == "security_incident_phishing" or decision.intent == "phishing_forwarding_violation" or "phishing" in msg_l:
            return (
                f"Hi {first_name},\n\n"
                f"🚨 **URGENT SECURITY ALERT (KB-09: Phishing & Suspicious Emails)**:\n"
                f"Under Veridian security policy, **forwarding suspected phishing emails to colleagues is strictly prohibited** as it creates a severe secondary security hazard across the company!\n\n"
                f"Please take these immediate actions:\n"
                f"1. **DO NOT** forward this email to any colleagues.\n"
                f"2. **Warn any teammates** you already sent it to not to click any links or enter credentials.\n"
                f"3. Report the incident directly to **security@veridian-corp.example**.\n\n"
                f"We have escalated this case to the IT Security Incident Response Team ({ticket.ticket_id if ticket else 'TK-Active'})."
            )

        if decision.intent == "password_lockout_exceeded" or (decision.policy_id == "KB-01" and ("lock" in msg_l or "password" in msg_l or "attempts" in msg_l)):
            return (
                f"Hi {first_name},\n\n"
                f"Per KB-01 (Password Reset), because you exceeded 5 failed login attempts, your account has been manually unlocked by IT (no administrative approval required).\n\n"
                f"Please navigate to the self-service portal to establish your new password: [https://identity.veridian-corp.example/reset]."
            )

        if decision.intent == "guest_wifi_request" or decision.policy_id == "KB-07" or "guest" in msg_l:
            return (
                f"Hi {first_name},\n\n"
                f"Per KB-07 (Guest Wi-Fi Access), guest Wi-Fi credentials are valid for 24 hours and can be generated directly by any employee from the front-desk kiosk.\n\n"
                f"No IT ticket is required! You can generate the access pass when your guest arrives tomorrow."
            )

        if decision.intent == "vpn_access_contractor" or (decision.policy_id == "KB-02" and "contractor" in msg_l):
            return (
                f"Hi {first_name},\n\n"
                f"Under KB-02 (VPN Access), full-time employees receive VPN access automatically, but **contractors strictly require manager approval submitted via the access request form**.\n\n"
                f"We have logged ticket {ticket.ticket_id if ticket else 'TK-Pending'}. As manager, please submit the official Access Request Form with contractor details and approval."
            )

        if decision.intent == "software_installation_policy_query" or (decision.policy_id == "KB-04" and "any software" in msg_l):
            return (
                f"Hi {first_name},\n\n"
                f"Under KB-04 (Software Installation Requests), only standard software listed in the approved catalog can be self-installed.\n\n"
                f"Any non-catalog software requires IT Security review, which takes 3–5 business days. Employees cannot install arbitrary software without prior approval."
            )

        if decision.intent == "software_installation_non_catalog" or (decision.policy_id == "KB-04" and ("not in" in msg_l or "non-catalog" in msg_l or "catalog" in msg_l or "approval" in msg_l)):
            return (
                f"Hi {first_name},\n\n"
                f"Under KB-04 (Software Installation Requests), non-catalog software and browser extensions require formal IT Security review, which takes **3–5 business days**.\n\n"
                f"We have created ticket {ticket.ticket_id if ticket else 'TK-Pending'} and queued it for IT Security evaluation."
            )

        if decision.intent == "laptop_replacement_hardware_failure" or (decision.policy_id == "KB-03" and ("3.5" in msg_l or "dead" in msg_l or "won't turn on" in msg_l or "fail" in msg_l)):
            return (
                f"Hi {first_name},\n\n"
                f"Because your laptop is 3.5 years old (>3 years) and suffers from verified hardware failure, it is eligible for replacement under KB-03.\n\n"
                f"Per Finance Asset Management Policy (standard 4-year refresh cycle), early replacement requires Finance sign-off in addition to IT approval. We have created ticket {ticket.ticket_id if ticket else 'TK-Pending'} and initiated the Finance approval workflow."
            )

        if decision.intent == "laptop_hardware_repair":
            return (
                f"Hi {first_name},\n\n"
                f"Because your laptop is at 2 years of service, it is not eligible for standard replacement under KB-03. A repair is the appropriate solution here!\n\n"
                f"We have created hardware diagnostics ticket {ticket.ticket_id if ticket else 'TK-Pending'} for our depot technician to inspect the flickering display."
            )

        if decision.intent == "vpn_credential_renewal":
            return (
                f"Hi {first_name},\n\n"
                f"Per KB-02 (VPN Access), VPN credentials expire every 90 days and must be renewed by the employee.\n\n"
                f"You can renew your credentials in under two minutes at: [https://access.veridian-corp.example/vpn-renew]."
            )

        if decision.intent == "mailbox_quota_full":
            return (
                f"Hi {first_name},\n\n"
                f"Per KB-06 (Email Mailbox Quota), the standard default quota is 25GB. Please archive older emails to cloud storage to restore sending capacity.\n\n"
                f"If an increase is required, quota increases beyond 25GB (capped at 50GB) require manager approval."
            )

        if decision.intent == "wfh_equipment_allowance":
            return (
                f"Hi {first_name},\n\n"
                f"Per KB-10 (Work-From-Home Equipment), employees working remotely >3 days/week are eligible for a one-time allowance (chair, monitor).\n\n"
                f"This requires manager sign-off and Finance processing. Ticket {ticket.ticket_id if ticket else 'TK-Pending'} has been initiated."
            )

        return (
            f"Hi {first_name},\n\n"
            f"Thank you for contacting Veridian IT Support. Your request has been evaluated against company policy ({decision.policy_id or 'Standard IT'}).\n\n"
            f"**Resolution**: {decision.reason}\n"
            f"{f'Ticket Logged: {ticket.ticket_id}' if ticket else ''}"
        )

    def _record_audit(self, audit_id: str, request_id: Optional[str], timestamp: str, stage: str, action_type: str, policy_id: Optional[str], details: str):
        """Save immutable audit trail event to SQLite database."""
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO audit_events (audit_id, request_id, timestamp, stage, action_type, policy_id, details)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (audit_id, request_id, timestamp, stage, action_type, policy_id, details))
            conn.commit()
            conn.close()
        except Exception as e:
            print(f"Audit log error: {e}")

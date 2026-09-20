# Veridian IT Agent — 10-Slide Presentation Deck
**AIONOS Agentic AI Factory — Assignment 2: Internal Service Agent (IT Support)**

---

## Slide 1: Title
- **Project**: Veridian IT Agent
- **Subtitle**: Autonomous, Policy-Aware Internal IT Support Copilot
- **Company**: Veridian Corp (Week of 21–25 September 2026)
- **Author**: Antigravity AI Engineer

---

## Slide 2: Business Problem
- Internal IT helpdesks are overwhelmed with repetitive Tier-1 tickets (password lockouts, guest Wi-Fi, VPN renewals).
- Employees face slow resolution times (hours to days for simple tasks).
- Risk of compliance violations: forwarding phishing emails to teammates or granting ad-hoc admin access.
- Ambiguous employee requests cause endless back-and-forth email ping-pong.

---

## Slide 3: Solution Overview
- An autonomous, policy-aware IT support agent that:
  - Understands unstructured employee inquiries.
  - Retrieves grounded corporate policies (KB-01 to KB-10 and Finance Asset Policy).
  - Autonomously resolves simple requests via controlled tools.
  - Escalates security hazards and gated approvals to humans.
  - Provides source citations and immutable audit trails for every decision.

---

## Slide 4: System Architecture
- **Frontend**: Clean 2-column enterprise dashboard (Interactive Chat + Decision & Evidence Panel).
- **Backend**: Python FastAPI with SQLite for persistent storage.
- **RAG Engine**: Local multi-signal retrieval referencing strictly verified policy documents.
- **Controlled Tool Executor**: Whitelisted actions validated by backend handlers.

---

## Slide 5: Agent Decision Pipeline
1. **Ingest**: Extract entities (devices, hardware age, failed attempts, remote days).
2. **Retrieve**: Fetch exact policy rules from knowledge base.
3. **Reason**: Reconcile policy conflicts (e.g. 3-year KB-03 vs 4-year Finance refresh cycle).
4. **Decide**: Categorize into `RESOLVE`, `ASK_FOLLOWUP`, `CREATE_TICKET`, or `ESCALATE`.
5. **Act & Audit**: Execute validated tool and record timestamped evidence.

---

## Slide 6: RAG & Policy Grounding
- **Zero Hallucination Guarantee**: Grounded strictly in the 10 supplied KB articles and the Finance Asset Management Policy Extract.
- **Source Attribution**: Every response displays the exact Policy ID, policy title, and relevant extract.
- **Safety Fallback**: If no policy exists (e.g. unsupported requests), the agent prompts for clarification rather than fabricating answers.

---

## Slide 7: Controlled Tools & Guardrails
- **The LLM is Never Unrestricted**: The model cannot run arbitrary SQL, shell commands, or external HTTP requests.
- **Whitelisted Toolset**:
  - `reset_password()`: Only executes when lockout threshold (>5 failed attempts) is verified.
  - `create_ticket()`: Structured ticket creation in SQLite.
  - `escalate_ticket()`: Direct routing to Security or Finance with reason codes.
  - `get_request_context()`: Safe read-only context retrieval.

---

## Slide 8: Live Demo Scenarios
1. **Resolve**: Karan Mehta — 6 failed password attempts $\rightarrow$ Account unlocked per KB-01.
2. **Contractor Governance**: Nikhil Bansal — New contractor VPN $\rightarrow$ Manager approval form enforced per KB-02.
3. **Policy Review SLA**: Ritu Bhatia — Non-catalog software $\rightarrow$ IT Security 3–5 day SLA per KB-04.
4. **Security Containment**: Ananya Reddy — Phishing forwarding $\rightarrow$ Urgent containment alert per KB-09.
5. **Ambiguity Triage**: Rahul Menon — *"its not working"* $\rightarrow$ Structured clarification question.

---

## Slide 9: Auditability, Reliability & Limitations
- **Full Transparency**: Every decision is logged with stages (`INGESTION`, `RETRIEVAL`, `REASONING`, `EXECUTION`, `COMPLETION`).
- **Human-in-the-Loop**: Draft emails are editable before final dispatch.
- **Current Limitations**: Simulated SSO / hardware depot dispatch rather than live Active Directory integration.

---

## Slide 10: Future Improvements & Conclusion
- Integration with Active Directory, ServiceNow, and Jamf MDM.
- Multi-modal screenshot analysis for OCR diagnostics on error dialogs.
- Continuous active learning with human feedback loops.
- **Takeaway**: A robust, secure, and fully auditable internal service agent ready for enterprise deployment.

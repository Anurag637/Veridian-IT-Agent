# Veridian IT Agent — 15-Minute Live Demo Script
**AIONOS Reviewer Evaluation Guide**

---

### Minute 0:00 – 1:30: Problem Statement
- Introduce Veridian Corp's scenario for the week of 21–25 September 2026.
- Highlight the pain points: IT staff drowning in repetitive Tier-1 tasks while security incidents (like employee forwarding phishing emails) risk going unaddressed.
- State the goal: An autonomous, policy-grounded IT service agent that resolves safe requests, asks follow-up questions for ambiguous ones, and escalates restricted/risky requests.

---

### Minute 1:30 – 3:00: Architecture Walkthrough
- Point to the clean 2-column layout:
  - **Left**: IT Support Chat with 1-click test scenario chips.
  - **Right**: Decision & Evidence Panel displaying Decision, Policy Used, Source Quote, Controlled Tool Action, and Live Audit Timeline.
- Explain the backend: FastAPI + SQLite + strictly controlled tool executor that ensures the AI cannot execute arbitrary or unauthorized actions.

---

### Minute 3:00 – 5:00: Demo 1 — Auto-Resolution (Karan Mehta)
- Click the preset chip: **"🔑 Password Lockout 6x"**.
- Employee Message: *"I'm locked out of my account, tried my password 6 times."*
- **Observe**:
  - Agent identifies intent: `password_lockout_exceeded`.
  - Retrieved Policy: `KB-01: Password Reset`.
  - Reasoning: Exceeded 5 failed attempts threshold; manual unlock required, no approval needed.
  - Controlled Tool Executed: `reset_password()` completed.
  - Right panel updates with `RESOLVE` badge, KB-01 citation, and audit log.

---

### Minute 5:00 – 7:00: Demo 2 — Contractor Governance (Nikhil Bansal)
- Click the preset chip: **"🛡️ Contractor VPN Request"**.
- Employee Message: *"New contractor joining my team next week, they’ll need VPN access."*
- **Observe**:
  - Agent distinguishes FTEs from contractors.
  - Retrieved Policy: `KB-02: VPN Access`.
  - Reasoning: Full-time employees receive automatic access, but contractors strictly require manager approval submitted via the access request form.
  - Decision: `CREATE_TICKET` with instructions for manager Nikhil to submit the formal approval form.

---

### Minute 7:00 – 9:00: Demo 3 — Security Escalation & Hazard Interception (Ananya Reddy)
- Click the preset chip: **"🚨 Phishing Forwarding Violation"**.
- Employee Message: *"I think I got a phishing email asking for my login — forwarding it to a few teammates to check."*
- **Observe**:
  - The agent identifies a **critical security policy violation**: KB-09 explicitly forbids forwarding phishing emails to colleagues.
  - Retrieved Policy: `KB-09: Security Incident Reporting`.
  - Decision: `ESCALATE` (P1 - Critical).
  - Immediate Containment Alert issued in chat: Instructs Ananya to stop forwarding, warn teammates immediately, and report to `security@veridian-corp.example`.
  - Structured ticket escalated to IT Security Incident Response Team (TK-1048 precedent).

---

### Minute 9:00 – 10:30: Demo 4 — Ambiguous Request Handling (Rahul Menon)
- Click the preset chip: **"❓ Vague Request"**.
- Employee Message: *"hey can you help, its not working"*.
- **Observe**:
  - The agent recognizes that the request has zero diagnostic information.
  - Decision: `ASK_FOLLOWUP`.
  - Follow-up Question: Politely asks what device, software, or service is failing and what error code appears.
  - **Key Defence Point**: The agent does not guess or hallucinate a fix.

---

### Minute 10:30 – 12:00: Demo 5 — Policy Tension & Reconciliation (Aditi Sharma)
- Click the preset chip: **"💻 3.5yr Dead Laptop Policy Clash"**.
- Employee Message: *"My laptop won’t turn on at all, it’s completely dead, had it about 3.5 years now."*
- **Observe**:
  - Harmonizes KB-03 (eligible after 3 years / hardware failure) and the Finance Asset Management Policy (standard 4-year refresh cycle).
  - Decision: `CREATE_TICKET` routed for Finance sign-off and IT fulfillment (matching precedent TK-1043).

---

### Minute 12:00 – 13:30: Source Evidence & Audit Trail
- Click through the tabs:
  - **Knowledge Base Tab**: Browse all 10 KB articles and Asset Management Policy extract.
  - **Ticket Queue Tab**: Show the 4 active cases and 6 historical precedents.
  - **Reviewer Audit Matrix Tab**: Inspect the complete verification table of all 15 requests.
- Export Audit Package: Click **"Download Audit Package (JSON)"** or **"Export Report (Markdown)"**.

---

### Minute 13:30 – 15:00: Questions & Architectural Wrap-Up
- Summarize the five core agent capabilities: Understand $\rightarrow$ Retrieve $\rightarrow$ Reason $\rightarrow$ Act/Escalate $\rightarrow$ Audit.
- Invite reviewer questions on security guardrails, RAG reliability, and scalability.

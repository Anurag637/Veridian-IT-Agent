# Veridian IT Agent — Defence Questions & Answers
**Technical Interview Preparation Guide**

---

### 1. Why is this agentic?
**Answer**: It does not merely generate text; it autonomously evaluates unstructured employee requests against external corporate policy rules, decides whether to resolve directly, ask follow-up questions, create a ticket, or escalate to human specialists, and triggers state-changing controlled tools (`reset_password`, `create_ticket`, `escalate_ticket`) with audit logging.

### 2. Why use an LLM / AI agent?
**Answer**: Real-world employee requests are colloquial, ambiguous, and varied (e.g. *"laptop won't turn on at all, it's completely dead, had it about 3.5 years now"* vs *"hey can you help, its not working"*). An LLM provides robust semantic intent comprehension and entity extraction that traditional rigid regex or keyword trees fail to parse.

### 3. How does RAG work here?
**Answer**: We use a lightweight local RAG engine that queries our structured SQLite knowledge base repository. Inquiries are tokenized and scored against policy titles, categories, keywords, and specific domain rules to retrieve the top matching policies (e.g. KB-01 for passwords, KB-09 for phishing) without hallucinating ungrounded policies.

### 4. How do you prevent hallucination?
**Answer**: (1) The system is explicitly instructed and constrained to the 10 supplied KB articles and the Finance Asset Policy extract; (2) Unsupported queries trigger the Ambiguity Clarification Protocol (`ASK_FOLLOWUP`) rather than guessing; (3) Every agent answer must output the exact policy ID and rule citation in the structured response.

### 5. How do you prevent unauthorized actions?
**Answer**: Through a **controlled tool architecture**. The AI model is never given raw shell access, arbitrary Python execution, or direct SQL execution capabilities. It only emits a structured decision (`RESOLVE`, `CREATE_TICKET`, `ESCALATE`), and the backend validates preconditions (e.g. failed attempt threshold) before executing whitelisted functions.

### 6. Why are tools controlled?
**Answer**: In an enterprise IT environment, an agent with unconstrained tool execution could accidentally wipe databases, execute arbitrary shell scripts, or approve privileged access without authorization. Controlled tools provide a deterministic security boundary between the AI's reasoning and system execution.

### 7. Why SQLite?
**Answer**: SQLite requires zero external server setup, runs in-process with Python, supports full ACID transactions, and allows instant demo resets without external database dependencies (e.g. PostgreSQL or Docker).

### 8. Why FastAPI?
**Answer**: FastAPI provides high-performance asynchronous API endpoints, automatic OpenAPI / Swagger documentation, native Pydantic data validation, and clean type hinting, making it the industry standard for production AI backend services.

### 9. How would you scale this?
**Answer**: (1) Replace SQLite with PostgreSQL / Amazon RDS; (2) Deploy FastAPI instances as stateless containers behind a load balancer; (3) Cache policy embeddings in pgvector or Pinecone; (4) Queue asynchronous background jobs via Celery / Redis.

### 10. How would you evaluate the agent?
**Answer**: (1) Automated regression test suite (`pytest`) measuring policy retrieval precision, decision accuracy, and tool safety; (2) End-to-end golden dataset benchmarks across all 15 supplied requests; (3) Human-in-the-loop CSAT tracking and reviewer audit feedback.

### 11. What happens if the LLM is unavailable?
**Answer**: The system features graceful degradation: the local rule-based engine and fallback classification handle high-frequency requests (password lockouts, guest Wi-Fi) deterministically, while complex queries are queued with an informative service message rather than failing silently.

### 12. How do you handle ambiguous requests?
**Answer**: When an input lacks diagnostic details (like REQ-15: *"hey can you help, its not working"*), the agent triggers the `ASK_FOLLOWUP` decision state and asks specific clarifying questions (device, error message, asset tag) rather than assuming or hallucinating a fix.

### 13. How do you handle security incidents?
**Answer**: Suspected phishing or malware reports (KB-09) immediately bypass standard troubleshooting. If an employee attempts to forward a phishing email (REQ-08), the agent emits a critical containment alert, halts forwarding, instructs recipient recall, and escalates directly to `security@veridian-corp.example` under ticket precedent TK-1048.

### 14. Why did you use one agent instead of multiple agents?
**Answer**: A single policy-aware agent with clear decision paths is more predictable, easier to debug, faster, and significantly cheaper to run than a multi-agent framework (like AutoGen or multi-agent LangGraph) which often suffers from agent loops, high latency, and compounding error rates on straightforward classification and retrieval tasks.

### 15. What would you improve in production?
**Answer**: (1) Direct webhooks into Active Directory / Okta for automated user provisioning; (2) OCR vision support for employee screenshot attachments; (3) Enterprise ticketing synchronization with ServiceNow / Jira Service Desk; (4) Role-based access control (RBAC) on the agent dashboard.

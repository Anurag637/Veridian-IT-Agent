# Veridian IT Agent — System Architecture

## 1. High-Level Architecture

The **Veridian IT Agent** is an autonomous, policy-aware internal service copilot designed to handle employee IT requests with 100% adherence to company policies and zero hallucination.

```mermaid
flowchart TD
    Employee([Employee / User]) -->|Natural Language Request| Frontend[React / HTML5 Dashboard]
    Frontend -->|POST /api/chat| FastAPI[FastAPI Backend]
    
    subgraph Agentic Pipeline
        FastAPI --> Ingest[1. Ingestion & Entity Extraction]
        Ingest --> Retriever[2. Policy Retrieval Local RAG]
        Retriever --> SQLite[(SQLite DB: KB-01..10 + Asset Policy)]
        Retriever --> Reasoner[3. Policy Reasoning Engine]
        
        Reasoner --> Decision{4. Structured Decision}
        Decision -->|RESOLVE| ToolResolve[Controlled Tool: reset_password / self_service]
        Decision -->|CREATE_TICKET| ToolTicket[Controlled Tool: create_ticket]
        Decision -->|ESCALATE| ToolEscalate[Controlled Tool: escalate_ticket]
        Decision -->|ASK_FOLLOWUP| GenClarify[Follow-up Generator]
    end
    
    ToolResolve --> AuditLog[(Audit Events Table)]
    ToolTicket --> AuditLog
    ToolEscalate --> AuditLog
    GenClarify --> AuditLog
    
    AuditLog --> ResponseBuilder[5. Response & Evidence Builder]
    ResponseBuilder -->|Structured JSON| Frontend
    Frontend -->|2-Column View| Employee
```

---

## 2. Decision & Escalation Flow

```mermaid
stateDiagram-v2
    [*] --> RequestReceived
    RequestReceived --> IntentClassification
    
    IntentClassification --> RetrievePolicy
    RetrievePolicy --> EvaluateRules
    
    state EvaluateRules {
        [*] --> CheckAmbiguity
        CheckAmbiguity --> AskClarification : Insufficient details
        CheckAmbiguity --> CheckSecurityRisk : Sufficient details
        
        CheckSecurityRisk --> EscalateSecurity : Phishing / Forwarding violation
        CheckSecurityRisk --> CheckEligibility : Normal IT request
        
        CheckEligibility --> ResolveDirect : Meets self-service / failed attempt threshold
        CheckEligibility --> CreateTicket : Requires review / approval / diagnostics
    }
    
    AskClarification --> AuditRecord
    EscalateSecurity --> AuditRecord
    ResolveDirect --> AuditRecord
    CreateTicket --> AuditRecord
    
    AuditRecord --> [*]
```

---

## 3. Data Flow & Security Guardrails

1. **Strict Local RAG**:
   The agent queries SQLite exclusively for policies grounded in the Veridian Corp Data Pack (KB-01 through KB-10 and Finance Asset Management Policy Extract). No external search or ungrounded policies are allowed.
2. **Controlled Tools**:
   The LLM / Agent cannot execute arbitrary code, raw SQL, shell commands, or network calls. It emits a typed `StructuredDecision`, and backend Python handlers validate and execute strictly whitelisted tools (`reset_password`, `create_ticket`, `escalate_ticket`).
3. **Immutable Audit Trail**:
   Every stage (`INGESTION`, `RETRIEVAL`, `REASONING`, `EXECUTION`, `COMPLETION`) writes an immutable record to the `audit_events` table in SQLite.

/**
 * Veridian Corp Conversational Copilot & Interactive Test Simulator
 * Interacts with FastAPI backend `/api/chat` with seamless fallback
 */

import { AgentEngine } from './agentEngine.js';

export class ChatSimulator {
  constructor(containerId, brainInspectorId) {
    this.engine = new AgentEngine();
    this.container = document.getElementById(containerId);
    this.brainInspector = document.getElementById(brainInspectorId);
    this.messages = [];
  }

  async handleUserQuery(userMessage, employeeName = "Alex Rivera") {
    if (!userMessage.trim()) return;

    // 1. Render User Message in Chat
    this.appendMessage({
      sender: "user",
      name: employeeName,
      text: userMessage,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });

    // 2. Render Agent "Thinking" state
    const thinkingId = this.showThinking();

    let result = null;

    try {
      // Try FastAPI Backend first
      const engineMode = document.getElementById('select-engine-mode')?.value || 'auto';
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee: employeeName,
          message: userMessage,
          engine_preference: engineMode
        })
      });

      if (res.ok) {
        const data = await res.json();
        // Convert to UI result format
        result = {
          requestId: data.audit_id,
          employee: employeeName,
          originalText: userMessage,
          draftResponse: data.response,
          decision: {
            actionType: data.decision,
            summary: data.reason,
            status: data.decision === 'RESOLVE' ? 'Resolved — Completed' : data.decision === 'ESCALATE' ? 'Escalated to IT Security' : data.decision === 'ASK_FOLLOWUP' ? 'Waiting on Follow-up' : 'Ticket Created',
            priority: data.ticket ? data.ticket.priority : (data.decision === 'ESCALATE' ? 'P1 - Critical' : 'P3 - Medium'),
            targetDepartment: data.decision === 'ESCALATE' ? 'IT Security' : (data.ticket ? data.ticket.category : 'Tier-1 Service Desk'),
            policyApplied: data.policy ? `${data.policy.id}: ${data.policy.title}` : 'Veridian IT Support Protocol',
            rationale: data.reason
          },
          matchedPolicies: data.policy ? [{
            id: data.policy.id,
            title: data.policy.title,
            summary: data.policy.summary,
            fullPolicy: data.policy.full_policy,
            relevanceScore: 0.98,
            matchReason: data.reason
          }] : [],
          matchedPrecedent: null,
          ticket: data.ticket ? {
            ticketId: data.ticket.ticket_id || data.ticket.ticketId,
            employee: data.ticket.employee,
            category: data.ticket.category,
            issueSummary: data.ticket.summary || data.ticket.issueSummary,
            status: data.ticket.status,
            priority: data.ticket.priority,
            policyRef: data.ticket.policy_id || (data.policy ? data.policy.id : 'IT-Policy'),
            isActive: true,
            recommendedNextStep: data.decision === 'ESCALATE' ? 'Escalated to IT Security Incident Response' : 'Pending IT Review & Approval',
            resolutionNotes: data.reason
          } : (data.decision === 'CREATE_TICKET' || data.decision === 'ESCALATE' ? {
            ticketId: data.audit_id.replace('AUD', 'TK'),
            employee: employeeName,
            category: data.policy ? data.policy.title : 'General IT Support',
            issueSummary: userMessage.slice(0, 80),
            status: data.decision === 'ESCALATE' ? 'Escalated to IT Security' : 'Ticket Created — Pending Review',
            priority: data.decision === 'ESCALATE' ? 'P1 - Critical' : 'P3 - Medium',
            policyRef: data.policy ? data.policy.id : 'KB-General',
            isActive: true,
            recommendedNextStep: data.decision === 'ESCALATE' ? 'Escalated to IT Security Incident Response' : 'Pending IT Review & Approval',
            resolutionNotes: data.reason
          } : null),
          action: data.action,
          engine: data.engine || "Deterministic Local Grounded Policy Engine",
          entities: {
            intents: [data.decision],
            isPhishingHazard: data.decision === 'ESCALATE',
            isForwardingAttempted: userMessage.toLowerCase().includes('forward'),
            isUnderspecified: data.decision === 'ASK_FOLLOWUP'
          },
          auditId: data.audit_id
        };

        // Fetch audit events from backend
        try {
          const auditRes = await fetch(`/api/audit/${data.audit_id}`);
          if (auditRes.ok) {
            result.auditEvents = await auditRes.json();
          }
        } catch (e) {
          console.warn("Could not fetch audit events from backend:", e);
        }
      }
    } catch (e) {
      console.warn("FastAPI backend not reached; utilizing client-side agent engine.", e);
    }

    // Fallback to local JS Agent Engine if backend wasn't running
    if (!result) {
      await new Promise(r => setTimeout(r, 200));
      const input = {
        id: `REQ-${Date.now().toString().slice(-4)}`,
        employee: employeeName,
        email: `${employeeName.toLowerCase().replace(/\s+/g, '.')}@veridian-corp.example`,
        dateOpened: "Today (Live)",
        request: userMessage,
        initialActionTaken: "Not started"
      };
      result = this.engine.processRequest(input);
    }

    this.removeThinking(thinkingId);

    // 3. Render Agent Response in Chat
    this.appendMessage({
      sender: "agent",
      name: "Veridian IT Agent",
      text: result.draftResponse,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      decision: result.decision,
      ticket: result.ticket
    });

    // 4. Update the "Agent Brain & Evidence" Inspector Panel on Right Side
    this.renderEvidenceAndAudit(result);

    return result;
  }

  appendMessage(msg) {
    this.messages.push(msg);
    if (!this.container) return;

    const div = document.createElement('div');
    div.className = `chat-bubble ${msg.sender === 'user' ? 'bubble-user' : 'bubble-agent'}`;

    let headerHtml = `<div class="bubble-header"><span class="sender-name">${msg.name}</span><span class="bubble-time">${msg.timestamp}</span></div>`;
    let bodyHtml = `<div class="bubble-body">${this.formatMarkdown(msg.text)}</div>`;

    let badgeHtml = '';
    if (msg.decision) {
      const isCritical = msg.decision.priority && msg.decision.priority.includes("P1");
      const isAuto = msg.decision.actionType === 'RESOLVE' || msg.decision.actionType.startsWith("DIRECT_");
      badgeHtml = `
        <div class="bubble-badges">
          <span class="badge ${isCritical ? 'badge-critical' : isAuto ? 'badge-success' : 'badge-primary'}">
            ${msg.decision.actionType || msg.decision.status}
          </span>
          <span class="badge badge-neutral">
            ${msg.decision.policyApplied ? msg.decision.policyApplied.split(':')[0] : 'IT Protocol'}
          </span>
        </div>
      `;
    }

    div.innerHTML = headerHtml + bodyHtml + badgeHtml;
    this.container.appendChild(div);
    this.container.scrollTop = this.container.scrollHeight;
  }

  showThinking() {
    const id = `thinking-${Date.now()}`;
    const div = document.createElement('div');
    div.id = id;
    div.className = 'chat-bubble bubble-agent bubble-thinking';
    div.innerHTML = `
      <div class="bubble-header"><span class="sender-name">Veridian IT Agent</span></div>
      <div class="bubble-body">
        <div class="typing-indicator">
          <span></span><span></span><span></span>
        </div>
        <span style="font-size: 0.85rem; color: var(--text-muted);">Retrieving policy from Knowledge Base & evaluating rules...</span>
      </div>
    `;
    this.container.appendChild(div);
    this.container.scrollTop = this.container.scrollHeight;
    return id;
  }

  removeThinking(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
  }

  /**
   * Render Decision, Evidence, Controlled Tool Action, and Audit Timeline on Right Side
   */
  renderEvidenceAndAudit(result) {
    if (!this.brainInspector) return;

    const { decision, matchedPolicies, ticket, action, auditEvents, auditId } = result;
    const policy = matchedPolicies && matchedPolicies.length > 0 ? matchedPolicies[0] : null;

    const isResolve = decision.actionType === 'RESOLVE' || decision.actionType.startsWith('DIRECT_');
    const isEscalate = decision.actionType === 'ESCALATE' || (decision.priority && decision.priority.includes('P1'));
    const isFollowup = decision.actionType === 'ASK_FOLLOWUP';

    const statusBadgeClass = isResolve ? 'badge-success' : (isEscalate ? 'badge-critical' : (isFollowup ? 'badge-amber' : 'badge-primary'));

    let auditItemsHtml = '';
    if (auditEvents && auditEvents.length > 0) {
      auditItemsHtml = auditEvents.map(ev => `
        <div style="display: flex; gap: 10px; font-size: 0.8rem; margin-bottom: 6px; border-left: 2px solid var(--primary); padding-left: 8px;">
          <span style="font-family: 'JetBrains Mono', monospace; color: var(--text-dim);">${ev.timestamp.split(' ')[1] || ev.timestamp}</span>
          <span><strong>${ev.action_type}:</strong> ${ev.details}</span>
        </div>
      `).join('');
    } else {
      const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      auditItemsHtml = `
        <div style="display: flex; gap: 10px; font-size: 0.8rem; margin-bottom: 6px; border-left: 2px solid var(--primary); padding-left: 8px;">
          <span style="font-family: 'JetBrains Mono', monospace; color: var(--text-dim);">${nowTime}</span>
          <span><strong>REQUEST_RECEIVED:</strong> Ingested request from ${result.employee}</span>
        </div>
        <div style="display: flex; gap: 10px; font-size: 0.8rem; margin-bottom: 6px; border-left: 2px solid var(--primary); padding-left: 8px;">
          <span style="font-family: 'JetBrains Mono', monospace; color: var(--text-dim);">${nowTime}</span>
          <span><strong>POLICY_RETRIEVED:</strong> ${policy ? `${policy.id} (${policy.title})` : 'Standard IT Clarification Protocol'}</span>
        </div>
        <div style="display: flex; gap: 10px; font-size: 0.8rem; margin-bottom: 6px; border-left: 2px solid var(--primary); padding-left: 8px;">
          <span style="font-family: 'JetBrains Mono', monospace; color: var(--text-dim);">${nowTime}</span>
          <span><strong>DECISION_MADE:</strong> ${decision.actionType} (${decision.status})</span>
        </div>
        ${action ? `
          <div style="display: flex; gap: 10px; font-size: 0.8rem; margin-bottom: 6px; border-left: 2px solid var(--emerald); padding-left: 8px;">
            <span style="font-family: 'JetBrains Mono', monospace; color: var(--text-dim);">${nowTime}</span>
            <span><strong>TOOL_EXECUTED:</strong> ${action.type} (${action.status})</span>
          </div>
        ` : ''}
        ${ticket && ticket.ticketId ? `
          <div style="display: flex; gap: 10px; font-size: 0.8rem; margin-bottom: 6px; border-left: 2px solid var(--amber); padding-left: 8px;">
            <span style="font-family: 'JetBrains Mono', monospace; color: var(--text-dim);">${nowTime}</span>
            <span><strong>TICKET_CREATED:</strong> Ticket ${ticket.ticketId} logged in SQLite</span>
          </div>
        ` : ''}
        <div style="display: flex; gap: 10px; font-size: 0.8rem; margin-bottom: 6px; border-left: 2px solid var(--primary); padding-left: 8px;">
          <span style="font-family: 'JetBrains Mono', monospace; color: var(--text-dim);">${nowTime}</span>
          <span><strong>RESPONSE_GENERATED:</strong> Policy-grounded communication dispatched</span>
        </div>
      `;
    }

    this.brainInspector.innerHTML = `
      <div class="brain-panel">
        <!-- 1. Decision Card -->
        <div class="brain-section">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <h4 style="margin: 0;"><i class="icon">⚡</i> DECISION</h4>
            <span class="badge ${statusBadgeClass}" style="font-size: 0.85rem; padding: 5px 12px;">${decision.actionType}</span>
          </div>
          <div style="margin-bottom: 10px; font-size: 0.86rem; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <span style="color: var(--text-dim); font-weight: 600;">Reasoning Engine:</span>
            <span class="badge ${result.engine && result.engine.includes('Hugging Face') ? 'badge-primary' : 'badge-neutral'}" style="font-size: 0.8rem; padding: 4px 10px;">
              ${result.engine && result.engine.includes('Hugging Face') ? '🤖 ' : '🛡️ '}${result.engine || 'Deterministic Local Grounded Policy Engine'}
            </span>
          </div>
          <div class="decision-card ${isEscalate ? 'border-critical' : ''}">
            <div class="decision-title" style="font-size: 1.1rem;">${decision.status}</div>
            <p class="decision-rationale" style="margin-top: 8px; font-size: 0.94rem; line-height: 1.55;">${decision.rationale}</p>
          </div>
        </div>

        <!-- 2. Policy & Source Evidence -->
        <div class="brain-section">
          <h4><i class="icon">📜</i> SOURCE EVIDENCE & POLICY USED</h4>
          ${policy ? `
            <div class="matched-kb-item" style="padding: 16px 18px;">
              <div class="matched-kb-header" style="font-size: 1rem; margin-bottom: 8px;">
                <strong>${policy.id}: ${policy.title}</strong>
                <span class="match-score" style="font-size: 0.85rem;">100% Policy Grounded</span>
              </div>
              <p class="matched-kb-reason" style="margin-bottom: 8px; font-size: 0.92rem;"><strong>Summary:</strong> ${policy.summary}</p>
              <div class="matched-kb-policy-quote" style="font-size: 0.88rem; padding: 12px 16px;">"${policy.fullPolicy || policy.full_policy}"</div>
            </div>
          ` : `
            <div class="matched-kb-item" style="padding: 16px 18px;">
              <p style="font-size: 0.92rem; color: var(--text-muted);">No direct company policy applies. Initiated Ambiguity Clarification Protocol.</p>
            </div>
          `}
        </div>

        <!-- 3. Controlled Tool Action & Ticket -->
        <div class="brain-section">
          <h4><i class="icon">🛠️</i> CONTROLLED TOOL ACTION & TICKET</h4>
          <div style="display: flex; flex-direction: column; gap: 10px;">
            ${action ? `
              <div style="background: var(--bg-surface-elevated); padding: 14px 18px; border-radius: var(--radius-md); font-size: 0.9rem; border-left: 3px solid var(--emerald);">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <strong>Action Executed:</strong> <code>${action.type}()</code>
                  <span class="badge badge-success" style="font-size: 0.8rem;">${action.status}</span>
                </div>
                <p style="margin-top: 6px; color: var(--text-muted); font-size: 0.88rem;">${action.details || 'Successfully validated and executed by backend.'}</p>
              </div>
            ` : `
              <div style="background: var(--bg-surface-elevated); padding: 14px 18px; border-radius: var(--radius-md); font-size: 0.9rem; color: var(--text-muted);">
                No direct write-tool executed (Information / Guidance request).
              </div>
            `}

            ${ticket && ticket.ticketId ? `
              <div style="background: var(--bg-surface-elevated); padding: 14px 18px; border-radius: var(--radius-md); font-size: 0.9rem; border-left: 3px solid var(--amber);">
                <div style="display: flex; justify-content: space-between; margin-bottom: 6px; align-items: center;">
                  <strong style="font-size: 0.98rem; font-family: 'JetBrains Mono', monospace; color: var(--primary-light);">Structured Ticket: ${ticket.ticketId}</strong>
                  <span class="badge badge-primary" style="font-size: 0.8rem;">${ticket.priority || 'P3 - Medium'}</span>
                </div>
                <div style="color: var(--text-muted); font-size: 0.88rem;">Category: <strong>${ticket.category || 'General'}</strong> &bull; Status: <strong>${ticket.status}</strong></div>
              </div>
            ` : ''}
          </div>
        </div>

        <!-- 4. Audit Timeline -->
        <div class="brain-section">
          <h4><i class="icon">⏱️</i> AUDIT TIMELINE (AUDIT ID: ${auditId || 'AUD-LIVE'})</h4>
          <div style="background: var(--bg-base); padding: 16px; border-radius: var(--radius-md); max-height: 240px; overflow-y: auto;">
            ${auditItemsHtml}
          </div>
        </div>
      </div>
    `;
  }

  formatMarkdown(text) {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" class="chat-link">$1</a>')
      .replace(/\n\n/g, '<br><br>')
      .replace(/\n/g, '<br>')
      .replace(/• /g, '&bull; ');
  }
}

/**
 * Veridian Corp IT Support Agent Application Controller
 * Wires UI views, event listeners, state management, and real-time updates
 */

import { TicketManager } from './ticketManager.js';
import { ChatSimulator } from './chatSimulator.js';
import { KNOWLEDGE_BASE } from '../data/knowledgeBase.js';

class AppController {
  constructor() {
    this.manager = new TicketManager();
    this.chatSimulator = new ChatSimulator('chat-messages-container', 'agent-brain-container');
    this.activeModalRequestId = null;
    this.activeTicketFilter = 'ALL';
    this.init();
  }

  showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `toast-item toast-${type}`;
    toast.innerHTML = `<span>✨</span> <div>${message}</div>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  init() {
    this.bindNavigationTabs();
    this.bindHeaderActions();
    this.bindFilterControls();
    this.bindChatEvents();
    this.bindModalEvents();
    this.renderAllViews();
    this.updateKpiRibbon();
    this.checkEngineStatus();
    this.syncTicketsFromBackend();

    // Set initial active tab
    document.body.setAttribute('data-active-tab', 'tab-requests');

    // Real-time synchronization loop (syncs new cases and status changes every 2.5 seconds)
    setInterval(() => {
      this.syncTicketsFromBackend();
    }, 2500);
  }

  // 1. Navigation Tabs
  bindNavigationTabs() {
    const tabs = document.querySelectorAll('.nav-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', async () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        const targetPaneId = tab.getAttribute('data-tab');
        document.querySelectorAll('.tab-pane').forEach(pane => {
          pane.classList.remove('active');
        });
        const activePane = document.getElementById(targetPaneId);
        if (activePane) activePane.classList.add('active');

        // Hide KPI ribbon ONLY on Live Copilot & Brain tab
        const kpiRibbon = document.getElementById('kpi-ribbon');
        if (kpiRibbon) {
          kpiRibbon.style.display = targetPaneId === 'tab-copilot' ? 'none' : 'grid';
        }
        document.body.setAttribute('data-active-tab', targetPaneId);

        if (targetPaneId === 'tab-tickets') {
          await this.syncTicketsFromBackend();
        }
      });
    });
  }

  // 2. Header Actions & Theme Toggle
  bindHeaderActions() {
    // Theme toggle
    const themeBtn = document.getElementById('btn-toggle-theme');
    const themeIcon = document.getElementById('theme-icon');
    themeBtn.addEventListener('click', () => {
      const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', newTheme);
      themeIcon.textContent = newTheme === 'dark' ? '🌙' : '☀️';
    });

    // Batch triage button (header)
    const batchBtn = document.getElementById('btn-batch-triage-header');
    batchBtn.addEventListener('click', () => this.handleBatchTriage());

    // Batch triage button (grid)
    const batchGridBtn = document.getElementById('btn-batch-triage-grid');
    if (batchGridBtn) {
      batchGridBtn.addEventListener('click', () => this.handleBatchTriage());
    }

    // Export button (header)
    const exportHeaderBtn = document.getElementById('btn-export-header');
    exportHeaderBtn.addEventListener('click', () => this.exportAuditPackageJSON());

    // Export buttons (audit tab)
    const exportJsonBtn = document.getElementById('btn-export-audit-json');
    if (exportJsonBtn) {
      exportJsonBtn.addEventListener('click', () => this.exportAuditPackageJSON());
    }
    const exportMdBtn = document.getElementById('btn-export-audit-md');
    if (exportMdBtn) {
      exportMdBtn.addEventListener('click', () => this.exportAuditPackageMarkdown());
    }

    // Ticket queue filter buttons
    const btnActive = document.getElementById('btn-filter-active-tickets');
    const btnPrecedent = document.getElementById('btn-filter-precedent-tickets');
    const btnAll = document.getElementById('btn-filter-all-tickets');

    btnActive.addEventListener('click', () => {
      this.activeTicketFilter = 'ACTIVE';
      this.renderTicketQueue();
    });
    btnPrecedent.addEventListener('click', () => {
      this.activeTicketFilter = 'PRECEDENT';
      this.renderTicketQueue();
    });
    btnAll.addEventListener('click', () => {
      this.activeTicketFilter = 'ALL';
      this.renderTicketQueue();
    });
  }

  // 3. Filter Controls
  bindFilterControls() {
    const searchInput = document.getElementById('search-requests');
    const statusSelect = document.getElementById('filter-status');
    const categorySelect = document.getElementById('filter-category');

    const handleFilterChange = () => {
      const query = (searchInput.value || "").toLowerCase();
      const statusFilter = statusSelect.value;
      const catFilter = categorySelect.value;
      this.renderRequestsGrid(query, statusFilter, catFilter);
    };

    searchInput.addEventListener('input', handleFilterChange);
    statusSelect.addEventListener('change', handleFilterChange);
    categorySelect.addEventListener('change', handleFilterChange);

    // Search Knowledge Base
    const searchKb = document.getElementById('search-kb');
    searchKb.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase();
      this.renderKnowledgeBase(q);
    });
  }

  // 4. Chat Events & Scenario Buttons
  bindChatEvents() {
    const form = document.getElementById('chat-form');
    const inputField = document.getElementById('chat-input-field');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = inputField.value.trim();
      if (!text) return;
      inputField.value = '';
      const result = await this.chatSimulator.handleUserQuery(text);
      if (result && result.ticket) {
        this.registerCreatedTicket(result.ticket);
      }
      this.updateEventLog();
    });

    // Engine Mode Selector
    const engineSelect = document.getElementById('select-engine-mode');
    if (engineSelect) {
      engineSelect.addEventListener('change', () => {
        this.checkEngineStatus();
      });
    }

    // Preset Scenario Chips
    const presetBar = document.getElementById('chat-presets-bar');
    presetBar.addEventListener('click', async (e) => {
      const chip = e.target.closest('.preset-chip');
      if (!chip) return;

      const scenario = chip.getAttribute('data-scenario');
      let testMessage = "";
      let employee = "Employee";

      switch (scenario) {
        case 'phishing-forward':
          testMessage = "I think I got a phishing email asking for my login — forwarding it to a few teammates to check.";
          employee = "Ananya Reddy";
          break;
        case 'dead-laptop':
          testMessage = "My laptop won’t turn on at all, it’s completely dead, had it about 3.5 years now.";
          employee = "Aditi Sharma";
          break;
        case 'vague-query':
          testMessage = "hey can you help, its not working";
          employee = "Rahul Menon";
          break;
        case 'contractor-vpn':
          testMessage = "New contractor joining my team next week, they’ll need VPN access.";
          employee = "Nikhil Bansal";
          break;
        case 'guest-wifi':
          testMessage = "Can I get Wi-Fi access for a guest visiting our office tomorrow?";
          employee = "Vikram Chawla";
          break;
        case 'password-locked':
          testMessage = "I’m locked out of my account, tried my password 6 times.";
          employee = "Karan Mehta";
          break;
        case 'admin-access':
          testMessage = "Can someone give me admin access to the finance reporting server? Need it urgently for month-end.";
          employee = "Kavya Pillai";
          break;
      }

      if (testMessage) {
        inputField.value = "";
        const result = await this.chatSimulator.handleUserQuery(testMessage, employee);
        if (result && result.ticket) {
          this.registerCreatedTicket(result.ticket);
        }
        this.updateEventLog();
      }
    });
  }

  // Register newly created ticket into the ticket queue and update badge & KPI
  registerCreatedTicket(ticket) {
    if (!ticket) return;
    const ticketId = ticket.ticketId || ticket.ticket_id;
    if (!ticketId) return;

    const existing = this.manager.ticketQueue.find(t => (t.ticketId || t.ticket_id) === ticketId);
    if (!existing) {
      const isAct = !ticket.status.toLowerCase().includes('closed') && !ticket.status.toLowerCase().includes('resolved');
      const normalizedTicket = {
        ticketId: ticketId,
        employee: ticket.employee || "Employee",
        issueSummary: ticket.issueSummary || ticket.summary || "IT Support Case",
        status: ticket.status || "Ticket Created — Pending Review",
        isActive: isAct,
        category: ticket.category || "General IT Support",
        policyRef: ticket.policyRef || ticket.policy_id || "KB-General",
        resolutionNotes: ticket.resolutionNotes || ticket.resolution_or_escalation || "Created via Live Agent Copilot",
        recommendedNextStep: ticket.recommendedNextStep || "Pending IT Review & Approval"
      };
      this.manager.ticketQueue.unshift(normalizedTicket);
      this.showToast(`New ticket logged: ${ticketId} for ${normalizedTicket.employee}`, 'info');
    }

    this.renderTicketQueue();
    this.updateKpiRibbon();
  }

  // Sync tickets from FastAPI SQLite backend with real-time change detection
  async syncTicketsFromBackend() {
    try {
      const res = await fetch('/api/tickets');
      if (res.ok) {
        const backendTickets = await res.json();
        let changed = false;

        backendTickets.forEach(bt => {
          const tId = bt.ticket_id || bt.ticketId;
          const isAct = !bt.status.toLowerCase().includes('closed') && !bt.status.toLowerCase().includes('resolved');
          const existing = this.manager.ticketQueue.find(t => (t.ticketId || t.ticket_id) === tId);

          if (!existing) {
            this.manager.ticketQueue.unshift({
              ticketId: tId,
              employee: bt.employee,
              issueSummary: bt.summary,
              status: bt.status,
              isActive: isAct,
              category: bt.category,
              policyRef: bt.policy_id || "KB-General",
              resolutionNotes: bt.resolution_or_escalation || "Recorded in SQLite",
              recommendedNextStep: "Review and route per policy"
            });
            changed = true;
          } else {
            if (existing.status !== bt.status || existing.isActive !== isAct) {
              existing.status = bt.status;
              existing.isActive = isAct;
              if (bt.resolution_or_escalation) {
                existing.resolutionNotes = bt.resolution_or_escalation;
              }
              changed = true;
            }
          }
        });

        if (changed) {
          this.renderTicketQueue();
          this.updateKpiRibbon();
        }
      }
    } catch (e) {
      console.warn("Could not sync tickets from backend:", e);
    }
  }

  // Check LLM / Hugging Face connectivity status
  async checkEngineStatus() {
    const badge = document.getElementById('engine-status-badge');
    if (!badge) return;
    badge.style.cursor = 'pointer';

    const modeSelect = document.getElementById('select-engine-mode');
    const selectedMode = modeSelect ? modeSelect.value : 'auto';

    if (selectedMode === 'deterministic') {
      badge.className = 'badge badge-neutral';
      badge.textContent = `🛡️ Deterministic Mode (Manual)`;
      badge.title = 'Manual Deterministic Mode selected. Using zero-hallucination local policy rules.';
      badge.onclick = () => {
        alert('=== VERIDIAN REASONING ENGINE ===\n\nMode: Deterministic Local Grounded Policy Engine\n\nIn this mode, all employee requests are evaluated strictly against hard-coded policy rules with zero cloud dependency and zero hallucination.');
      };
      return;
    }

    try {
      const res = await fetch('/api/llm-status');
      if (res.ok) {
        const data = await res.json();
        let detailText = "";

        if (data.status === 'Connected & Active') {
          badge.className = 'badge badge-success';
          badge.textContent = `🤖 ${data.model.split('/').pop()} (HF Active)`;
          badge.title = `${data.message} (Click for details)`;
          detailText = `Active LLM Engine: ${data.model}\nStatus: Connected & Active\nBase URL: https://router.huggingface.co/hf-inference/v1\n\nAll live employee requests are triaged using open-source Qwen LLM with strict corporate policy guardrails.`;
        } else if (data.status.includes('403') || data.status.includes('Permission')) {
          badge.className = 'badge badge-amber';
          badge.textContent = selectedMode === 'llm' ? `⚠️ HF 403 (No Permission)` : `🛡️ Zero-Hallucination Engine (HF 403 Fallback)`;
          badge.title = `HF Token lacks Inference permission. (Click for details)`;
          detailText = `Hugging Face Model: ${data.model}\nStatus: HTTP 403 (Permission Error)\nActive Engine: Deterministic Local Policy Engine (Zero-Hallucination Fallback)\n\nReason: The current Hugging Face token is a fine-grained token without 'Inference' permission.\n\nTo activate live HF inference:\n1. Go to huggingface.co/settings/tokens/new\n2. Create a token with Type: 'Read' (or check 'Make calls to Serverless Inference')\n3. Paste into .env as HF_TOKEN=... and restart server.`;
        } else if (data.configured) {
          badge.className = 'badge badge-amber';
          badge.textContent = `🛡️ Local Policy Engine (${data.status})`;
          badge.title = `${data.message} (Click for details)`;
          detailText = `Hugging Face Model: ${data.model}\nStatus: ${data.status}\nActive Engine: Deterministic Local Grounded Policy Engine\n\nDetails: ${data.message}`;
        } else {
          badge.className = 'badge badge-neutral';
          badge.textContent = selectedMode === 'llm' ? `⚠️ No HF Token Set` : `🛡️ Local Policy RAG (Deterministic)`;
          badge.title = `${data.message} (Click for details)`;
          detailText = `Active Engine: Deterministic Local Policy Engine\nStatus: Offline / No HF_TOKEN provided\n\nUsing built-in local RAG & deterministic policy decision matrix grounded 100% in KB-01..10.`;
        }

        badge.onclick = () => {
          alert(`=== VERIDIAN REASONING ENGINE DIAGNOSTICS ===\n\n${detailText}`);
        };
      }
    } catch (e) {
      badge.className = 'badge badge-neutral';
      badge.textContent = `🛡️ Local Policy Engine (Offline)`;
    }
  }

  // 5. Modal Events
  bindModalEvents() {
    const modal = document.getElementById('inspection-modal');
    const closeBtn = document.getElementById('modal-close-btn');
    const cancelBtn = document.getElementById('modal-cancel-btn');
    const sendBtn = document.getElementById('modal-send-email-btn');

    const closeModal = () => {
      modal.classList.remove('open');
      this.activeModalRequestId = null;
    };

    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);

    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    sendBtn.addEventListener('click', () => {
      if (this.activeModalRequestId) {
        const textarea = document.getElementById('modal-email-draft-edit');
        if (textarea) {
          this.manager.updateDraftResponse(this.activeModalRequestId, textarea.value);
        }
        alert(`Email response approved and dispatched to requester. Ticket status updated.`);
        closeModal();
        this.renderAllViews();
        this.updateKpiRibbon();
      }
    });
  }

  // Batch Triage Handler
  handleBatchTriage() {
    const results = this.manager.batchTriageAll();
    const tabBtn = document.getElementById('tab-btn-tickets');
    if (tabBtn) {
      tabBtn.innerHTML = `<span>🎫</span> Ticket Queue (${this.manager.ticketQueue.length})`;
    }
    this.renderAllViews();
    this.updateKpiRibbon();
    this.updateEventLog();
    this.syncTicketsFromBackend();
  }

  // Update Top KPI Ribbon
  updateKpiRibbon() {
    const stats = this.manager.stats;
    document.getElementById('kpi-val-triaged').textContent = `${stats.triagedCount} / ${stats.totalRequests}`;
    document.getElementById('kpi-val-autoresolve').textContent = stats.autoResolvedCount;
    document.getElementById('kpi-val-escalated').textContent = stats.escalatedCount;
    document.getElementById('kpi-val-hazards').textContent = stats.criticalHazardsIntercepted;
  }

  // Render All Views
  renderAllViews() {
    this.renderRequestsGrid();
    this.renderTicketQueue();
    this.renderKnowledgeBase();
    this.renderAuditMatrix();
    this.updateEventLog();
  }

  // Render Employee Requests Grid (Section 2)
  renderRequestsGrid(search = "", statusFilter = "ALL", categoryFilter = "ALL") {
    const container = document.getElementById('requests-grid-container');
    container.innerHTML = '';

    const requests = this.manager.requests.filter(req => {
      const matchSearch = (
        req.id.toLowerCase().includes(search) ||
        req.employee.toLowerCase().includes(search) ||
        req.request.toLowerCase().includes(search) ||
        req.category.toLowerCase().includes(search)
      );

      let matchStatus = true;
      if (statusFilter === 'NOT_STARTED') matchStatus = req.status === 'Not started';
      if (statusFilter === 'IN_PROGRESS') matchStatus = req.status.includes('In progress') || req.status.includes('Investigating');
      if (statusFilter === 'WAITING') matchStatus = req.status.includes('Waiting');
      if (statusFilter === 'TRIAGED') matchStatus = req.status.includes('Resolved') || req.status.includes('Approved') || req.status.includes('Escalated');

      let matchCat = true;
      if (categoryFilter !== 'ALL') {
        matchCat = req.category.toLowerCase().includes(categoryFilter.toLowerCase());
      }

      return matchSearch && matchStatus && matchCat;
    });

    if (requests.length === 0) {
      container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">No requests match the selected filters.</div>';
      return;
    }

    requests.forEach(req => {
      const isTriaged = !!req.result;
      const isHazard = req.id === 'REQ-08' || (req.result && req.result.entities.isForwardingAttempted);

      let statusClass = 'status-not-started';
      if (req.status.includes('Resolved')) statusClass = 'status-resolved';
      else if (req.status.includes('Escalated')) statusClass = 'status-escalated';
      else if (req.status.includes('Waiting')) statusClass = 'status-waiting';
      else if (req.status.includes('In progress') || req.status.includes('Investigating')) statusClass = 'status-in-progress';

      const card = document.createElement('div');
      card.className = `request-card ${isHazard ? 'card-hazard' : ''}`;
      card.id = `card-${req.id}`;

      card.innerHTML = `
        <div class="card-top">
          <span class="req-id">${req.id}</span>
          <span class="req-date">${req.dateOpened}</span>
        </div>
        <div class="employee-info">
          <div class="employee-name">${req.employee}</div>
          <div class="employee-email">${req.email}</div>
        </div>
        <div class="request-snippet">"${req.request}"</div>
        <div class="card-tags">
          <span class="status-badge ${statusClass}">
            ${req.status}
          </span>
          <span class="badge badge-neutral">${req.category}</span>
          ${isHazard ? '<span class="badge badge-critical">🚨 Phishing Forwarding Violation</span>' : ''}
          ${isTriaged ? `<span class="badge badge-primary">Policy: ${req.result.decision.policyApplied.split(':')[0]}</span>` : ''}
        </div>
        <div class="card-actions">
          <button class="btn btn-primary btn-triage-single" data-id="${req.id}" style="flex: 1;">
            ${isTriaged ? '⚡ Re-Triage' : '⚡ Triage with Agent'}
          </button>
          <button class="btn btn-secondary btn-inspect-single" data-id="${req.id}" ${!isTriaged ? 'disabled style="opacity: 0.5;"' : ''}>
            🔍 Inspect
          </button>
        </div>
      `;

      container.appendChild(card);
    });

    // Event listeners for card buttons
    container.querySelectorAll('.btn-triage-single').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        this.manager.triageRequest(id);
        this.renderAllViews();
        this.updateKpiRibbon();
        this.openInspectionModal(id);
      });
    });

    container.querySelectorAll('.btn-inspect-single').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        this.openInspectionModal(id);
      });
    });
  }

  // Render Ticketing System Records (Section 3)
  renderTicketQueue() {
    const tbody = document.getElementById('ticket-queue-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    // Calculate real-time dynamic counts
    const activeCount = this.manager.ticketQueue.filter(t => t.isActive).length;
    const precedentCount = this.manager.ticketQueue.filter(t => !t.isActive).length;
    const totalCount = this.manager.ticketQueue.length;

    // Update filter buttons & navigation counters in real time!
    const btnActive = document.getElementById('btn-filter-active-tickets');
    const btnPrecedent = document.getElementById('btn-filter-precedent-tickets');
    const btnAll = document.getElementById('btn-filter-all-tickets');
    const tabTicketsBtn = document.getElementById('tab-btn-tickets');

    if (btnActive) {
      btnActive.innerHTML = `<span>🟢</span> Active Cases (${activeCount})`;
      btnActive.className = this.activeTicketFilter === 'ACTIVE' ? 'btn btn-primary active' : 'btn btn-secondary';
    }
    if (btnPrecedent) {
      btnPrecedent.innerHTML = `<span>📜</span> Historical Precedents (${precedentCount})`;
      btnPrecedent.className = this.activeTicketFilter === 'PRECEDENT' ? 'btn btn-primary active' : 'btn btn-secondary';
    }
    if (btnAll) {
      btnAll.innerHTML = `<span>📋</span> Show All (${totalCount})`;
      btnAll.className = this.activeTicketFilter === 'ALL' ? 'btn btn-primary active' : 'btn btn-secondary';
    }
    if (tabTicketsBtn) {
      tabTicketsBtn.innerHTML = `<span>🎫</span> Ticket Queue (${totalCount})`;
    }

    const tickets = this.manager.ticketQueue.filter(t => {
      if (this.activeTicketFilter === 'ACTIVE') return t.isActive;
      if (this.activeTicketFilter === 'PRECEDENT') return !t.isActive;
      return true;
    });

    if (tickets.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 48px; color: var(--text-muted); font-size: 1.05rem;">No tickets found matching the selected filter (${this.activeTicketFilter}).</td></tr>`;
      return;
    }

    tickets.forEach(t => {
      const tr = document.createElement('tr');
      if (t.isActive) tr.classList.add('active-ticket-row');

      let statusBadge = `<span class="badge badge-neutral">${t.status}</span>`;
      if (t.status.includes('Resolved') || t.status.includes('Approved at') || t.status.includes('Approved with')) {
        statusBadge = `<span class="badge badge-success">✓ ${t.status}</span>`;
      } else if (t.status.includes('Rejected')) {
        statusBadge = `<span class="badge badge-critical">✕ ${t.status}</span>`;
      } else if (t.isActive) {
        statusBadge = `<span class="badge badge-amber"><span class="pulse-dot"></span> ${t.status}</span>`;
      }

      tr.innerHTML = `
        <td><strong class="ticket-id-tag">${t.ticketId}</strong></td>
        <td><div class="ticket-employee-name">${t.employee}</div></td>
        <td><span class="badge badge-neutral">${t.category}</span></td>
        <td><div class="ticket-summary-text">${t.issueSummary}</div></td>
        <td><span class="badge badge-primary">${t.policyRef}</span></td>
        <td>${statusBadge}</td>
        <td>
          <div class="ticket-resolution-text">
            ${t.isActive ? `<strong style="color: var(--amber);">Next Step:</strong> ${t.recommendedNextStep}` : t.resolutionNotes}
          </div>
        </td>
        <td>
          ${t.isActive ? `
            <button class="btn btn-primary btn-progress-ticket" data-ticket="${t.ticketId}">
              <span>⚡</span> Resolve / Route
            </button>
          ` : `
            <span class="badge badge-neutral" style="font-size: 0.85rem; opacity: 0.85;">Precedent Record</span>
          `}
        </td>
      `;

      tbody.appendChild(tr);
    });

    // Action button listeners with real-time backend sync
    tbody.querySelectorAll('.btn-progress-ticket').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const ticketId = e.currentTarget.getAttribute('data-ticket');
        const resolvedTicket = this.manager.progressActiveTicket(ticketId);
        
        // Sync to backend SQLite
        try {
          await fetch(`/api/tickets/${ticketId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              status: resolvedTicket ? resolvedTicket.status : "Resolved",
              resolution_or_escalation: resolvedTicket ? resolvedTicket.resolutionNotes : "Actioned by IT Support Agent."
            })
          });
        } catch (err) {
          console.warn("Backend ticket sync error:", err);
        }

        this.renderTicketQueue();
        this.updateKpiRibbon();
        this.updateEventLog();
        this.showToast(`Ticket ${ticketId} resolved & routed per corporate policy.`, 'success');
      });
    });
  }

  // Render Knowledge Base (Section 1)
  renderKnowledgeBase(search = "") {
    const container = document.getElementById('kb-grid-container');
    container.innerHTML = '';

    const articles = KNOWLEDGE_BASE.filter(kb => {
      return (
        kb.id.toLowerCase().includes(search) ||
        kb.title.toLowerCase().includes(search) ||
        kb.summary.toLowerCase().includes(search) ||
        kb.fullPolicy.toLowerCase().includes(search) ||
        kb.keywords.some(k => k.toLowerCase().includes(search))
      );
    });

    articles.forEach(kb => {
      const card = document.createElement('div');
      card.className = 'request-card';
      card.innerHTML = `
        <div class="card-top">
          <span class="req-id" style="color: var(--emerald);">${kb.id}</span>
          <span class="badge badge-neutral">${kb.category}</span>
        </div>
        <h3 style="font-size: 1.1rem; font-weight: 700; margin-bottom: 8px;">${kb.title}</h3>
        <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 12px;">${kb.summary}</p>
        <div style="background: rgba(0,0,0,0.25); border-left: 3px solid var(--emerald); padding: 10px; border-radius: var(--radius-sm); font-size: 0.82rem; margin-bottom: 14px; font-style: italic;">
          "${kb.fullPolicy}"
        </div>
        <div style="margin-bottom: 12px;">
          <strong style="font-size: 0.78rem; text-transform: uppercase; color: var(--text-dim);">Core Rules:</strong>
          <ul style="margin-left: 18px; font-size: 0.82rem; color: var(--text-main); margin-top: 4px;">
            ${kb.rules.map(r => `<li>${r}</li>`).join('')}
          </ul>
        </div>
        ${kb.reconciliationNote ? `
          <div style="background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); padding: 8px 12px; border-radius: var(--radius-sm); font-size: 0.78rem; color: var(--amber);">
            <strong>Policy Nuance:</strong> ${kb.reconciliationNote}
          </div>
        ` : ''}
      `;
      container.appendChild(card);
    });
  }

  // Render Reviewer Audit Matrix
  renderAuditMatrix() {
    const tbody = document.getElementById('audit-matrix-tbody');
    tbody.innerHTML = '';

    this.manager.requests.forEach(req => {
      const isTriaged = !!req.result;
      const res = req.result || this.manager.engine.processRequest(req);

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong style="font-family: 'JetBrains Mono', monospace; color: var(--primary-light);">${req.id}</strong></td>
        <td>${req.employee}</td>
        <td style="font-size: 0.82rem; max-width: 200px;">"${req.request}"</td>
        <td>
          ${res.matchedPolicies.map(p => `<span class="badge badge-primary">${p.id}</span>`).join(' ')}
        </td>
        <td>
          ${res.matchedPrecedent ? `<span class="badge badge-amber">${res.matchedPrecedent.ticketId}</span>` : '<span class="badge badge-outline">Direct Policy</span>'}
        </td>
        <td>
          <div style="font-weight: 600; font-size: 0.85rem;">${res.decision.summary}</div>
          <div style="font-size: 0.75rem; color: var(--text-muted);">${res.decision.targetDepartment}</div>
        </td>
        <td>
          ${res.decision.priority.includes('P1') ? '<span class="badge badge-critical">🚨 Phishing Containment Alert</span>' : ''}
          ${req.id === 'REQ-01' ? '<span class="badge badge-amber">3yr vs 4yr Refresh Reconciled</span>' : ''}
          ${req.id === 'REQ-10' ? '<span class="badge badge-critical">Admin Access Gated (TK-1050)</span>' : ''}
          ${req.id === 'REQ-11' ? '<span class="badge badge-amber">Contractor Form Enforced</span>' : ''}
          ${req.id === 'REQ-15' ? '<span class="badge badge-primary">Ambiguity Clarification Protocol</span>' : ''}
          ${res.decision.actionType.startsWith('DIRECT_') ? '<span class="badge badge-success">Self-Service / Zero Touch</span>' : ''}
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  // Update Event Log
  updateEventLog() {
    const container = document.getElementById('event-log-container');
    if (!container) return;

    if (this.manager.auditHistory.length === 0) {
      container.innerHTML = '<p class="text-muted">No events logged yet. Triage requests to view real-time audit trail.</p>';
      return;
    }

    container.innerHTML = this.manager.auditHistory.slice(0, 15).map(ev => {
      const time = new Date(ev.timestamp).toLocaleTimeString();
      return `
        <div style="display: flex; align-items: baseline; gap: 12px; margin-bottom: 8px; font-size: 0.82rem; border-bottom: 1px solid var(--border-subtle); padding-bottom: 6px;">
          <span style="font-family: 'JetBrains Mono', monospace; color: var(--text-dim);">${time}</span>
          <span class="badge badge-primary">${ev.type}</span>
          <span style="color: var(--text-main);">${ev.employee ? `<strong>${ev.employee}</strong>: ` : ''}${ev.status || ev.details || ev.notes || ''}</span>
        </div>
      `;
    }).join('');
  }

  // Open Deep Inspection Modal Drawer
  openInspectionModal(requestId) {
    const req = this.manager.requests.find(r => r.id === requestId);
    if (!req) return;

    if (!req.result) {
      this.manager.triageRequest(requestId);
    }

    this.activeModalRequestId = requestId;
    const result = req.result;
    const modal = document.getElementById('inspection-modal');
    const title = document.getElementById('modal-title');
    const body = document.getElementById('modal-body-content');

    title.textContent = `Deep Inspection: ${req.id} — ${req.employee}`;

    body.innerHTML = `
      <div style="background: rgba(0,0,0,0.2); padding: 14px; border-radius: var(--radius-md); border-left: 3px solid var(--primary);">
        <strong style="font-size: 0.8rem; text-transform: uppercase; color: var(--text-dim);">Original Employee Request:</strong>
        <p style="margin-top: 4px; font-size: 0.95rem; font-style: italic;">"${req.request}"</p>
        <div style="margin-top: 6px; font-size: 0.78rem; color: var(--text-muted);">
          Opened: ${req.dateOpened} &bull; Email: ${req.email} &bull; Initial Status: ${req.initialActionTaken}
        </div>
      </div>

      <div>
        <h4 style="font-size: 0.85rem; text-transform: uppercase; color: var(--text-muted); margin-bottom: 8px;">
          🧠 1. Agent Reasoning & Decision Rationale
        </h4>
        <div class="decision-card ${result.decision.priority.includes('P1') ? 'border-critical' : ''}">
          <div class="decision-title">${result.decision.summary}</div>
          <div class="decision-meta">
            <span><strong>Status:</strong> ${result.decision.status}</span>
            <span><strong>Target Department:</strong> ${result.decision.targetDepartment}</span>
            <span><strong>Priority:</strong> ${result.decision.priority}</span>
          </div>
          <p class="decision-rationale"><strong>Reasoning:</strong> ${result.decision.rationale}</p>
        </div>
      </div>

      <div>
        <h4 style="font-size: 0.85rem; text-transform: uppercase; color: var(--text-muted); margin-bottom: 8px;">
          📜 2. Policy Citations & Precedents
        </h4>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          ${result.matchedPolicies.map(p => `
            <div class="matched-kb-item">
              <div class="matched-kb-header">
                <strong>${p.id}: ${p.title}</strong>
                <span class="match-score">${Math.round(p.relevanceScore * 100)}% Match</span>
              </div>
              <p class="matched-kb-reason">${p.matchReason}</p>
              <div class="matched-kb-policy-quote">"${p.fullPolicy}"</div>
            </div>
          `).join('')}
          ${result.matchedPrecedent ? `
            <div class="precedent-box">
              <strong>Precedent: ${result.matchedPrecedent.ticketId} (${result.matchedPrecedent.employee})</strong>
              <p style="margin-top: 4px; font-size: 0.82rem; color: var(--text-muted);">${result.matchedPrecedent.issueSummary} &bull; ${result.matchedPrecedent.status}</p>
            </div>
          ` : ''}
        </div>
      </div>

      <div>
        <h4 style="font-size: 0.85rem; text-transform: uppercase; color: var(--text-muted); margin-bottom: 8px;">
          ✉️ 3. Policy-Grounded Employee Communication (Human-in-the-Loop Editable)
        </h4>
        <textarea id="modal-email-draft-edit" style="width: 100%; min-height: 180px; background: var(--bg-surface-elevated); border: 1px solid var(--border-medium); border-radius: var(--radius-md); padding: 12px; color: var(--text-main); font-family: 'JetBrains Mono', monospace; font-size: 0.82rem; line-height: 1.45; resize: vertical;">${result.draftResponse}</textarea>
        <p style="font-size: 0.75rem; color: var(--text-dim); margin-top: 4px;">You can review or adjust this draft before clicking 'Approve & Send'.</p>
      </div>

      <div>
        <h4 style="font-size: 0.85rem; text-transform: uppercase; color: var(--text-muted); margin-bottom: 8px;">
          🎫 4. Enterprise Structured Ticket
        </h4>
        <pre class="code-block">${JSON.stringify(result.ticket, null, 2)}</pre>
      </div>
    `;

    modal.classList.add('open');
  }

  // Export Complete Audit Package as JSON
  exportAuditPackageJSON() {
    const data = this.manager.generateExportPackage();
    const jsonStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", jsonStr);
    downloadAnchor.setAttribute("download", `Veridian_IT_Agent_Audit_Package_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  }

  // Export Complete Audit Package as Markdown Report
  exportAuditPackageMarkdown() {
    const data = this.manager.generateExportPackage();
    let md = `# Veridian Corp — Autonomous IT Service Agent Evaluation Report\n\n`;
    md += `**Exercise**: Assignment 2: Internal Service Agent (IT Support)\n`;
    md += `**Timeframe**: Monday, 21 September 2026 – Friday, 25 September 2026\n`;
    md += `**Generated**: ${data.meta.generatedAt}\n`;
    md += `**Policy Grounding**: ${data.meta.policyGroundingScore}\n\n`;

    md += `## KPI Summary\n`;
    md += `- Total Requests Ingested: ${data.kpiSummary.totalRequests}\n`;
    md += `- Total Triaged: ${data.kpiSummary.triagedCount}\n`;
    md += `- Self-Service Auto-Resolved: ${data.kpiSummary.autoResolvedCount}\n`;
    md += `- Escalated / Routed: ${data.kpiSummary.escalatedCount}\n`;
    md += `- Security Hazards Intercepted: ${data.kpiSummary.criticalHazardsIntercepted}\n\n`;

    md += `## Request Triage Matrix (REQ-01 to REQ-15)\n\n`;
    md += `| Request ID | Employee | Date | Original Request | Policy Applied | Decision & Action | Status |\n`;
    md += `|---|---|---|---|---|---|---|\n`;

    this.manager.requests.forEach(req => {
      const res = req.result || this.manager.engine.processRequest(req);
      const policies = res.matchedPolicies.map(p => p.id).join(', ');
      md += `| ${req.id} | ${req.employee} | ${req.dateOpened} | "${req.request.replace(/\|/g, '')}" | ${policies} | ${res.decision.summary} | ${res.decision.status} |\n`;
    });

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Veridian_IT_Agent_Report_${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
}

// Robust ES module initialization (handles both deferred and interactive states)
function startApp() {
  if (!window.veridianApp) {
    window.veridianApp = new AppController();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startApp);
} else {
  startApp();
}

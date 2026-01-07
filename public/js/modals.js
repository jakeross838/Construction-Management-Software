/**
 * Modal Management Module
 * Handles invoice edit modal, job selection modal, and other UI dialogs
 * LAST UPDATED: 2026-01-06 - Activity timeline cleanup
 */
console.log('[MODALS] Script loaded - version 2026-01-06 - ACTIVITY CLEANUP');

const Modals = {
  // Current state
  activeModal: null,
  lockId: null,
  currentInvoice: null,
  currentAllocations: [],
  isDirty: false,

  /**
   * Initialize modal system
   */
  init() {
    // Create modal containers if they don't exist
    this.ensureModalContainers();

    // Close on escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.activeModal) {
        this.closeActiveModal();
      }
    });

    // Close on backdrop click
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal-backdrop')) {
        this.closeActiveModal();
      }
    });
  },

  /**
   * Ensure modal container elements exist
   */
  ensureModalContainers() {
    if (!document.getElementById('modal-container')) {
      const container = document.createElement('div');
      container.id = 'modal-container';
      document.body.appendChild(container);
    }
  },

  /**
   * Show the invoice edit modal
   */
  async showEditModal(invoiceId, options = {}) {
    const { onSave, onClose } = options;

    try {
      // Acquire lock first
      const lockResult = await this.acquireLock('invoice', invoiceId);
      if (!lockResult.success) {
        window.toasts?.error('Cannot edit invoice', {
          details: lockResult.error || 'Invoice is locked by another user'
        });
        return false;
      }
      this.lockId = lockResult.lock.id;

      // Fetch invoice data
      const invoice = await this.fetchInvoice(invoiceId);
      if (!invoice) {
        await this.releaseLock(this.lockId);
        return false;
      }
      this.currentInvoice = invoice;

      // Fetch allocations and activity
      const [allocations, activity] = await Promise.all([
        this.fetchAllocations(invoiceId),
        this.fetchActivity(invoiceId)
      ]);
      // Initialize with one empty allocation if none exist
      // This ensures the UI row has a backing data entry
      this.currentAllocations = allocations.length > 0
        ? allocations
        : [{ cost_code_id: null, amount: invoice.amount || 0, notes: '' }];
      this.currentActivity = activity;

      // Build and show modal (use initialized allocations)
      const modal = this.buildEditModal(invoice, this.currentAllocations, activity);
      this.showModal(modal, 'invoice-edit-modal');

      // Set up save handler
      this.onSaveCallback = onSave;
      this.onCloseCallback = onClose;

      return true;
    } catch (err) {
      console.error('Error showing edit modal:', err);
      window.toasts?.error('Failed to open editor', { details: err.message });
      return false;
    }
  },

  /**
   * Build the edit modal HTML with PDF split-view
   */
  buildEditModal(invoice, allocations, activity = []) {
    const statusInfo = window.Validation?.getStatusInfo(invoice.status) || {};
    const isArchived = invoice.status === 'paid';
    const canEdit = !isArchived && ['received', 'coded'].includes(invoice.status);
    const pdfUrl = invoice.pdf_stamped_url || invoice.pdf_url;

    return `
      <div class="modal-backdrop">
        <div class="modal modal-fullscreen">
          <div class="modal-header">
            <div class="modal-title">
              <h2>${isArchived ? 'View Invoice' : 'Edit Invoice'}</h2>
              <span class="status-badge status-${invoice.status}">${statusInfo.label || invoice.status}</span>
              ${isArchived ? '<span class="readonly-badge">Read Only</span>' : ''}
            </div>
            <button class="modal-close" onclick="Modals.closeActiveModal()">&times;</button>
          </div>

          <div class="modal-body modal-split-view">
            <!-- PDF Viewer (Left) -->
            <div class="pdf-panel">
              ${pdfUrl ? `
                <iframe src="${pdfUrl}" class="pdf-iframe"></iframe>
              ` : `
                <div class="pdf-placeholder">
                  <div class="pdf-icon">📄</div>
                  <p>No PDF attached</p>
                </div>
              `}
            </div>

            <!-- Form Panel (Right) -->
            <div class="form-panel">
              <form id="invoice-edit-form" onsubmit="return false;">
                <!-- Invoice Details Section -->
                <div class="form-section">
                    <h3>Invoice Details</h3>

                    <div class="form-group">
                      <label for="edit-invoice-number">Invoice Number *</label>
                      <input type="text" id="edit-invoice-number" name="invoice_number"
                        value="${this.escapeHtml(invoice.invoice_number || '')}"
                        ${!canEdit ? 'readonly' : ''}
                        onchange="Modals.markDirty()">
                      <div class="field-error" id="error-invoice_number"></div>
                    </div>

                    <div class="form-group">
                      <label for="edit-amount">Amount *</label>
                      <input type="text" id="edit-amount" name="amount"
                        value="${window.Validation?.formatCurrency(invoice.amount) || ''}"
                        ${!canEdit ? 'readonly' : ''}
                        onchange="Modals.handleAmountChange(this)">
                      <div class="field-error" id="error-amount"></div>
                    </div>

                    <div class="form-row">
                      <div class="form-group">
                        <label for="edit-invoice-date">Invoice Date *</label>
                        <input type="date" id="edit-invoice-date" name="invoice_date"
                          value="${invoice.invoice_date || ''}"
                          ${!canEdit ? 'readonly' : ''}
                          onchange="Modals.markDirty()">
                        <div class="field-error" id="error-invoice_date"></div>
                      </div>

                      <div class="form-group">
                        <label for="edit-due-date">Due Date</label>
                        <input type="date" id="edit-due-date" name="due_date"
                          value="${invoice.due_date || ''}"
                          ${!canEdit ? 'readonly' : ''}
                          onchange="Modals.markDirty()">
                        <div class="field-error" id="error-due_date"></div>
                      </div>
                    </div>
                  </div>

                  <div class="form-section">
                    <h3>Assignment</h3>

                    <div class="form-group">
                      <label for="edit-job">Job</label>
                      <select id="edit-job" name="job_id" onchange="Modals.handleJobChange(this)" ${isArchived ? 'disabled' : ''}>
                        <option value="">-- Select Job --</option>
                      </select>
                      ${invoice.ai_confidence?.job ?
                        `<div class="ai-confidence ${this.getConfidenceClass(invoice.ai_confidence.job)}">
                          AI Confidence: ${Math.round(invoice.ai_confidence.job * 100)}%
                        </div>` : ''}
                      <div class="field-error" id="error-job_id"></div>
                    </div>

                    <div class="form-group">
                      <label for="edit-vendor">Vendor</label>
                      <select id="edit-vendor" name="vendor_id" onchange="Modals.markDirty()" ${isArchived ? 'disabled' : ''}>
                        <option value="">-- Select Vendor --</option>
                      </select>
                      ${invoice.ai_confidence?.vendor ?
                        `<div class="ai-confidence ${this.getConfidenceClass(invoice.ai_confidence.vendor)}">
                          AI Confidence: ${Math.round(invoice.ai_confidence.vendor * 100)}%
                        </div>` : ''}
                      <div class="field-error" id="error-vendor_id"></div>
                    </div>

                    <div class="form-group">
                      <label for="edit-po">Purchase Order</label>
                      <select id="edit-po" name="po_id" onchange="Modals.markDirty()" ${isArchived ? 'disabled' : ''}>
                        <option value="">-- No PO --</option>
                      </select>
                      <div class="field-error" id="error-po_id"></div>
                    </div>
                  </div>

                  <div class="form-section">
                    <h3>Cost Allocations</h3>
                    <div id="allocations-container">
                      ${this.buildAllocationsHtml(allocations, invoice.amount, isArchived)}
                    </div>
                    ${!isArchived ? `
                      <button type="button" class="btn btn-secondary btn-sm"
                        onclick="Modals.addAllocation()" ${!canEdit ? 'disabled' : ''}>
                        + Add Allocation
                      </button>
                    ` : ''}
                    <div class="allocation-summary" id="allocation-summary">
                      ${this.buildAllocationSummary(allocations, invoice.amount)}
                    </div>
                  </div>

                  <div class="form-section activity-section">
                    <h3>Activity</h3>
                    <!-- Status Pipeline -->
                    <div class="status-pipeline">
                      ${this.buildStatusPipeline(invoice.status)}
                    </div>
                    <!-- Activity Feed -->
                    <div class="activity-feed">
                      ${this.buildActivityTimeline(invoice, activity)}
                    </div>
                    ${!isArchived ? `
                      <div class="add-note-box">
                        <textarea id="edit-notes" name="notes" rows="2"
                          placeholder="Add a note..."
                          onchange="Modals.markDirty()"></textarea>
                      </div>
                    ` : ''}
                  </div>

                  ${invoice.needs_review ? `
                    <div class="form-section review-flags">
                      <h3>⚠️ Review Required</h3>
                      <ul>
                        ${(invoice.review_flags || []).map(f => `<li>${this.escapeHtml(f)}</li>`).join('')}
                      </ul>
                    </div>
                  ` : ''}
              </form>
            </div>
          </div>

          <div class="modal-footer">
            <div class="modal-footer-left">
              ${this.buildVersionInfo(invoice)}
            </div>
            <div class="modal-footer-right">
              ${this.buildStatusActions(invoice)}
            </div>
          </div>
        </div>
      </div>
    `;
  },

  /**
   * Build allocations HTML
   */
  buildAllocationsHtml(allocations, invoiceAmount, isArchived = false) {
    if (!allocations || allocations.length === 0) {
      return `
        <div class="allocation-row" data-index="0">
          <div class="cc-picker-container" data-index="0"></div>
          <div class="allocation-amount-group">
            <input type="text" class="allocation-amount" placeholder="$0.00"
              value="${window.Validation?.formatCurrency(invoiceAmount) || ''}"
              onchange="Modals.updateAllocation(0, 'amount', this.value)"
              ${isArchived ? 'readonly' : ''}>
            ${!isArchived ? '<button type="button" class="btn-fill-remaining" onclick="Modals.fillRemaining(0)" title="Fill remaining amount">Fill</button>' : ''}
          </div>
          ${!isArchived ? '<button type="button" class="btn-icon btn-remove" onclick="Modals.removeAllocation(0)">×</button>' : ''}
        </div>
      `;
    }

    return allocations.map((alloc, index) => `
      <div class="allocation-row" data-index="${index}">
        <div class="cc-picker-container" data-index="${index}"></div>
        <div class="allocation-amount-group">
          <input type="text" class="allocation-amount" placeholder="$0.00"
            value="${window.Validation?.formatCurrency(alloc.amount) || ''}"
            onchange="Modals.updateAllocation(${index}, 'amount', this.value)"
            ${isArchived ? 'readonly' : ''}>
          ${!isArchived ? `<button type="button" class="btn-fill-remaining" onclick="Modals.fillRemaining(${index})" title="Fill remaining amount">Fill</button>` : ''}
        </div>
        ${!isArchived ? `<button type="button" class="btn-icon btn-remove" onclick="Modals.removeAllocation(${index})">×</button>` : ''}
      </div>
    `).join('');
  },

  /**
   * Build allocation summary with inline validation
   */
  buildAllocationSummary(allocations, invoiceAmount) {
    // Only count allocations that have a cost code selected
    const validAllocations = (allocations || []).filter(a => a.cost_code_id);
    const total = validAllocations.reduce((sum, a) => sum + parseFloat(a.amount || 0), 0);
    const amount = parseFloat(invoiceAmount || 0);
    const diff = amount - total;
    const balanced = Math.abs(diff) < 0.01;
    const isOver = diff < -0.01;
    // hasAllocations is true if user has selected at least one cost code
    const hasAllocations = validAllocations.length > 0;

    // Only show warning status if user has started allocating
    const statusIcon = balanced ? '✓' : (hasAllocations ? (isOver ? '⚠' : '−') : '');
    const statusLabel = balanced ? 'Balanced' : (hasAllocations ? (isOver ? 'Over allocated' : 'Under allocated') : 'No allocations yet');
    const statusClass = balanced ? 'balanced' : (hasAllocations ? 'unbalanced' : 'pending');

    return `
      <div class="allocation-summary-inner ${statusClass}">
        <div class="summary-row">
          <span>Invoice Total:</span>
          <span class="amount">${window.Validation?.formatCurrency(amount)}</span>
        </div>
        <div class="summary-row">
          <span>Allocated:</span>
          <span class="amount">${window.Validation?.formatCurrency(total)}</span>
        </div>
        <div class="summary-row status-row ${statusClass}">
          <span>${isOver ? 'Over by:' : 'Remaining:'}</span>
          <span class="amount">${window.Validation?.formatCurrency(Math.abs(diff))}</span>
        </div>
        <div class="summary-status ${statusClass}">
          <span class="status-icon">${statusIcon}</span>
          <span class="status-label">${statusLabel}</span>
        </div>
        ${!balanced && hasAllocations ? `<div class="allocation-warning">Allocations must equal invoice total to approve</div>` : ''}
      </div>
    `;
  },

  /**
   * Build version info display
   */
  buildVersionInfo(invoice) {
    const parts = [];
    if (invoice.version) parts.push(`v${invoice.version}`);
    if (invoice.updated_at) {
      parts.push(`Last updated: ${new Date(invoice.updated_at).toLocaleString()}`);
    }
    return `<span class="version-info">${parts.join(' • ')}</span>`;
  },

  /**
   * Build activity timeline from invoice data and activity records
   * Shows only meaningful events - filters out redundant edits and status transitions
   */
  buildActivityTimeline(invoice, activity = []) {
    const events = [];

    // Add invoice creation event
    if (invoice.created_at) {
      events.push({
        type: 'created',
        icon: '📄',
        label: 'Invoice received',
        detail: invoice.ai_processed ? 'Processed by AI' : null,
        by: null,
        at: invoice.created_at
      });
    }

    // Process activity log - filter out noise
    if (activity && activity.length) {
      // Status actions we care about (not "edited" which is redundant)
      const statusActions = ['uploaded', 'coded', 'approved', 'denied', 'paid', 'added_to_draw', 'removed_from_draw'];

      activity.forEach(a => {
        const action = a.action || 'note';

        // Skip "edited" entries - they're redundant with status-specific entries
        // Exception: keep edits that have actual notes/comments
        if (action === 'edited') {
          // Only show edit if it has a user note
          if (!a.notes) return;
        }

        // Skip "uploaded" if we already have "created"
        if (action === 'uploaded' && invoice.created_at) return;

        // Format details
        let detail = null;
        if (a.notes && typeof a.notes === 'string') {
          detail = a.notes;
        }

        events.push({
          type: action,
          icon: this.getActivityIcon(action),
          label: this.formatActivityAction(action),
          detail: detail,
          by: a.performed_by,
          at: a.created_at
        });
      });
    }

    // Sort by date descending (newest first)
    events.sort((a, b) => new Date(b.at) - new Date(a.at));

    // Deduplicate: remove consecutive same-type events within 1 minute
    const deduped = [];
    events.forEach((e, i) => {
      if (i === 0) {
        deduped.push(e);
        return;
      }
      const prev = deduped[deduped.length - 1];
      const timeDiff = Math.abs(new Date(prev.at) - new Date(e.at));
      const sameType = prev.type === e.type && prev.by === e.by;

      // Skip if same type, same user, within 1 minute
      if (sameType && timeDiff < 60000) return;

      deduped.push(e);
    });

    if (deduped.length === 0) {
      return '<div class="activity-empty">No activity yet</div>';
    }

    // Limit to most recent 8 events
    const limited = deduped.slice(0, 8);

    return limited.map(e => `
      <div class="activity-event activity-${e.type}">
        <div class="activity-icon">${e.icon}</div>
        <div class="activity-content">
          <div class="activity-header">
            <span class="activity-label">${e.label}</span>
            <span class="activity-time">${this.formatRelativeTime(e.at)}</span>
          </div>
          ${e.by ? `<div class="activity-by">by ${this.escapeHtml(e.by)}</div>` : ''}
          ${e.detail ? `<div class="activity-detail">${this.escapeHtml(e.detail)}</div>` : ''}
        </div>
      </div>
    `).join('');
  },

  /**
   * Build status pipeline showing invoice workflow stages
   */
  buildStatusPipeline(currentStatus) {
    const stages = [
      { id: 'received', label: 'Received', icon: '📥' },
      { id: 'coded', label: 'Coded', icon: '🏷️' },
      { id: 'approved', label: 'Approved', icon: '✓' },
      { id: 'in_draw', label: 'In Draw', icon: '📋' },
      { id: 'paid', label: 'Paid', icon: '💰' }
    ];

    const statusOrder = ['received', 'coded', 'approved', 'in_draw', 'paid'];
    const currentIndex = statusOrder.indexOf(currentStatus);

    return stages.map((stage, index) => {
      let stageClass = 'pipeline-stage';
      if (index < currentIndex) {
        stageClass += ' completed';
      } else if (index === currentIndex) {
        stageClass += ' current';
      } else {
        stageClass += ' pending';
      }

      return `
        <div class="${stageClass}" data-stage="${stage.id}">
          <div class="pipeline-dot">
            ${index < currentIndex ? '✓' : stage.icon}
          </div>
          <span class="pipeline-label">${stage.label}</span>
        </div>
        ${index < stages.length - 1 ? '<div class="pipeline-connector' + (index < currentIndex ? ' completed' : '') + '"></div>' : ''}
      `;
    }).join('');
  },

  /**
   * Get icon for activity action
   */
  getActivityIcon(action) {
    const icons = {
      'uploaded': '📥',
      'coded': '🏷️',
      'approved': '✅',
      'denied': '❌',
      'paid': '💰',
      'added_to_draw': '📋',
      'removed_from_draw': '📤',
      'note': '💬',
      'edited': '✏️'
    };
    return icons[action] || '📝';
  },

  /**
   * Format activity action into readable label
   */
  formatActivityAction(action) {
    const labels = {
      'uploaded': 'Uploaded',
      'coded': 'Coded',
      'approved': 'Approved',
      'denied': 'Denied',
      'paid': 'Marked as paid',
      'added_to_draw': 'Added to draw',
      'removed_from_draw': 'Removed from draw',
      'note': 'Note added',
      'edited': 'Edited'
    };
    return labels[action] || action;
  },

  /**
   * Format timestamp as relative time
   */
  formatRelativeTime(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  },

  /**
   * Build status-based action buttons for the footer
   * received → Code & Save | Deny | Delete
   * coded → Approve | Save | Deny
   * approved → Add to Draw | Unapprove | Save
   * in_draw → Remove from Draw (view only)
   * paid → View only
   * denied → Resubmit | Save | Delete
   */
  buildStatusActions(invoice) {
    const status = invoice.status;
    const isArchived = status === 'paid';
    const buttons = [];

    // For archived invoices, just show Close button
    if (isArchived) {
      buttons.push(`<button type="button" class="btn btn-secondary" onclick="console.log('[MODALS] Close clicked'); Modals.closeActiveModal()">Close</button>`);
      return buttons.join('');
    }

    // Always have Cancel for editable invoices
    buttons.push(`<button type="button" class="btn btn-secondary" onclick="console.log('[MODALS] Cancel clicked'); Modals.closeActiveModal()">Cancel</button>`);

    switch (status) {
      case 'received':
        // New invoice - needs coding
        buttons.push(`<button type="button" class="btn btn-danger-outline" onclick="window.Modals.deleteInvoice()">Delete</button>`);
        buttons.push(`<button type="button" class="btn btn-primary" onclick="Modals.saveAndCode()">Code & Save</button>`);
        break;

      case 'coded':
        // Coded - ready for approval
        buttons.push(`<button type="button" class="btn btn-danger-outline" onclick="window.Modals.deleteInvoice()">Delete</button>`);
        buttons.push(`<button type="button" class="btn btn-secondary" onclick="Modals.saveInvoice()">Save</button>`);
        buttons.push(`<button type="button" class="btn btn-success" onclick="Modals.approveInvoice()">Approve</button>`);
        break;

      case 'approved':
        // Approved - can be added to draw
        buttons.push(`<button type="button" class="btn btn-warning-outline" onclick="Modals.unapproveInvoice()">Unapprove</button>`);
        buttons.push(`<button type="button" class="btn btn-secondary" onclick="Modals.saveInvoice()">Save</button>`);
        buttons.push(`<button type="button" class="btn btn-primary" onclick="Modals.addToDraw()">Add to Draw</button>`);
        break;

      case 'in_draw':
        // In draw - limited editing
        buttons.push(`<button type="button" class="btn btn-warning-outline" onclick="Modals.removeFromDraw()">Remove from Draw</button>`);
        break;

      default:
        // Unknown status - just save
        buttons.push(`<button type="button" class="btn btn-primary" onclick="Modals.saveInvoice()">Save</button>`);
    }

    return buttons.join('');
  },

  /**
   * Add a new allocation row
   */
  addAllocation() {
    this.currentAllocations.push({ cost_code_id: null, amount: 0, notes: '' });
    this.refreshAllocationsUI();
    this.markDirty();
  },

  /**
   * Remove an allocation row
   */
  removeAllocation(index) {
    this.currentAllocations.splice(index, 1);
    this.refreshAllocationsUI();
    this.markDirty();
  },

  /**
   * Fill allocation with remaining unallocated amount
   */
  fillRemaining(index) {
    if (!this.currentAllocations[index]) return;

    const invoiceAmount = window.Validation?.parseCurrency(this.getFormValue('amount')) || 0;

    // Calculate total allocated by OTHER allocations (not this one)
    const otherAllocated = this.currentAllocations.reduce((sum, a, i) => {
      if (i === index) return sum;
      return sum + parseFloat(a.amount || 0);
    }, 0);

    // Remaining = invoice total - other allocations
    const remaining = Math.max(0, invoiceAmount - otherAllocated);

    // Update this allocation's amount
    this.currentAllocations[index].amount = remaining;
    this.refreshAllocationsUI();
    this.markDirty();
  },

  /**
   * Update an allocation value
   */
  updateAllocation(index, field, value) {
    if (!this.currentAllocations[index]) return;

    if (field === 'amount') {
      value = window.Validation?.parseCurrency(value) || 0;
    }

    this.currentAllocations[index][field] = value;
    this.refreshAllocationSummary();
    this.markDirty();
  },

  /**
   * Handle invoice amount change
   */
  handleAmountChange(input) {
    const value = window.Validation?.parseCurrency(input.value) || 0;
    input.value = window.Validation?.formatCurrency(value);
    this.refreshAllocationSummary();
    this.markDirty();
  },

  /**
   * Handle job change - reload POs for job
   */
  async handleJobChange(select) {
    this.markDirty();
    const jobId = select.value;
    const poSelect = document.getElementById('edit-po');

    if (!jobId || !poSelect) return;

    // Load POs for this job
    try {
      const response = await fetch(`/api/jobs/${jobId}/purchase-orders`);
      if (response.ok) {
        const pos = await response.json();
        poSelect.innerHTML = '<option value="">-- No PO --</option>' +
          pos.map(po => `<option value="${po.id}">${po.po_number} - ${po.vendor_name || 'Unknown Vendor'}</option>`).join('');
      }
    } catch (err) {
      console.error('Failed to load POs:', err);
    }
  },

  /**
   * Refresh allocations UI
   */
  refreshAllocationsUI() {
    const container = document.getElementById('allocations-container');
    if (container) {
      container.innerHTML = this.buildAllocationsHtml(this.currentAllocations, this.getFormValue('amount'));
      this.initCostCodePickers();
    }
    this.refreshAllocationSummary();
  },

  /**
   * Refresh allocation summary
   */
  refreshAllocationSummary() {
    const summary = document.getElementById('allocation-summary');
    if (summary) {
      const amount = window.Validation?.parseCurrency(this.getFormValue('amount')) || 0;
      summary.innerHTML = this.buildAllocationSummary(this.currentAllocations, amount);
    }
  },

  /**
   * Initialize cost code pickers
   */
  async initCostCodePickers() {
    const isArchived = this.currentInvoice?.status === 'paid';

    // Initialize each picker
    document.querySelectorAll('.cc-picker-container').forEach(container => {
      const index = parseInt(container.dataset.index);
      const currentValue = this.currentAllocations[index]?.cost_code_id || null;

      window.CostCodePicker.init(container, {
        value: currentValue,
        disabled: isArchived,
        onChange: (codeId) => {
          this.updateAllocation(index, 'cost_code_id', codeId);
        }
      });
    });
  },

  /**
   * Save invoice changes
   */
  async saveInvoice() {
    const form = document.getElementById('invoice-edit-form');
    if (!form) return;

    // Gather form data
    const formData = {
      invoice_number: this.getFormValue('invoice_number'),
      amount: window.Validation?.parseCurrency(this.getFormValue('amount')),
      invoice_date: this.getFormValue('invoice_date'),
      due_date: this.getFormValue('due_date') || null,
      job_id: this.getFormValue('job_id') || null,
      vendor_id: this.getFormValue('vendor_id') || null,
      po_id: this.getFormValue('po_id') || null,
      notes: this.getFormValue('notes') || null
    };

    // Clear previous errors
    this.clearFieldErrors();

    // Validate
    const validation = window.Validation?.validateInvoice(formData);
    if (validation && !validation.valid) {
      this.showFieldErrors(validation.errors);
      window.toasts?.error('Please fix validation errors');
      return;
    }

    // Validate allocations
    const allocValidation = window.Validation?.validateAllocations(this.currentAllocations, formData.amount);
    if (allocValidation && !allocValidation.valid) {
      window.toasts?.error('Allocation Error', { details: allocValidation.errors.join(', ') });
      return;
    }

    // Save to server
    try {
      const loadingToast = window.toasts?.showLoading('Saving invoice...');

      const response = await fetch(`/api/invoices/${this.currentInvoice.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          allocations: this.currentAllocations,
          version: this.currentInvoice.version,
          performed_by: window.currentUser || 'unknown'
        })
      });

      window.toasts?.dismiss(loadingToast);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to save');
      }

      const result = await response.json();

      // Show undo toast if available
      if (result.undo) {
        window.toasts?.showWithUndo('Invoice saved', async () => {
          await fetch(`/api/invoices/${this.currentInvoice.id}/undo`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ undo_id: result.undo.id })
          });
        }, result.undo.remainingMs);
      } else {
        window.toasts?.success('Invoice saved');
      }

      this.isDirty = false;

      // Call onSave callback
      if (this.onSaveCallback) {
        this.onSaveCallback(result.invoice);
      }

      this.closeActiveModal();
    } catch (err) {
      console.error('Save failed:', err);
      window.toasts?.error('Save failed', { details: err.message });
    }
  },

  /**
   * Save and transition to 'coded' status
   */
  async saveAndCode() {
    // Validate required fields for coding
    const errors = this.validateForStatus('coded');
    if (errors.length > 0) {
      window.toasts?.error('Missing required fields', { details: errors.join(', ') });
      return;
    }

    await this.saveWithStatus('coded', 'Invoice coded successfully');
  },

  /**
   * Approve the invoice
   */
  async approveInvoice() {
    const errors = this.validateForStatus('approved');
    if (errors.length > 0) {
      window.toasts?.error('Missing required fields for approval', { details: errors.join(', ') });
      return;
    }

    this.showConfirmDialog({
      title: 'Approve Invoice',
      message: `Approve invoice #${this.currentInvoice?.invoice_number || 'N/A'} for ${window.Validation?.formatCurrency(this.currentInvoice?.amount)}?`,
      confirmText: 'Approve',
      type: 'info',
      onConfirm: async () => {
        await this.saveWithStatus('approved', 'Invoice approved');
      }
    });
  },

  /**
   * Unapprove (revert to coded)
   */
  async unapproveInvoice() {
    this.showConfirmDialog({
      title: 'Unapprove Invoice',
      message: 'Are you sure you want to unapprove this invoice? It will return to "Needs Approval" status.',
      confirmText: 'Unapprove',
      type: 'warning',
      onConfirm: async () => {
        await this.saveWithStatus('coded', 'Invoice unapproved');
      }
    });
  },

  /**
   * Add invoice to draw
   */
  async addToDraw() {
    this.showConfirmDialog({
      title: 'Add to Draw',
      message: `Add invoice #${this.currentInvoice?.invoice_number || 'N/A'} to the current draw?`,
      confirmText: 'Add to Draw',
      type: 'info',
      onConfirm: async () => {
        await this.saveWithStatus('in_draw', 'Invoice added to draw');
      }
    });
  },

  /**
   * Remove invoice from draw
   */
  async removeFromDraw() {
    this.showConfirmDialog({
      title: 'Remove from Draw',
      message: 'Are you sure you want to remove this invoice from the draw?',
      confirmText: 'Remove',
      type: 'warning',
      onConfirm: async () => {
        await this.saveWithStatus('approved', 'Invoice removed from draw');
      }
    });
  },

  /**
   * Delete invoice
   */
  deleteInvoice() {
    try {
      console.log('[DELETE] deleteInvoice called');
      console.log('[DELETE] this:', this);
      console.log('[DELETE] this.currentInvoice:', this.currentInvoice);

      if (!this.currentInvoice?.id) {
        console.log('[DELETE] No current invoice - showing error');
        window.toasts?.error('No invoice selected');
        return;
      }

      const invoiceId = this.currentInvoice.id;
      const invoiceNumber = this.currentInvoice.invoice_number || 'Unknown';
      console.log('[DELETE] Invoice ID:', invoiceId, 'Number:', invoiceNumber);

      // Use browser confirm for reliability
      console.log('[DELETE] Showing confirm dialog...');
      if (!confirm(`Delete invoice #${invoiceNumber}? This cannot be undone.`)) {
        console.log('[DELETE] User cancelled');
        return;
      }
      console.log('[DELETE] User confirmed, making API call...');

      // Make the API call
      fetch(`/api/invoices/${invoiceId}`, {
        method: 'DELETE'
      })
      .then(response => {
        console.log('[DELETE] API response status:', response.status);
        if (!response.ok) {
          return response.json().then(err => {
            throw new Error(err.message || 'Delete failed');
          });
        }
        return response.json();
      })
      .then(data => {
        console.log('[DELETE] Success:', data);
        window.toasts?.success('Invoice deleted');
        this.isDirty = false;

        if (this.onSaveCallback) {
          console.log('[DELETE] Calling onSaveCallback');
          this.onSaveCallback(null);
        }

        console.log('[DELETE] Closing modal');
        this.closeActiveModal();
      })
      .catch(err => {
        console.error('[DELETE] API Error:', err);
        window.toasts?.error('Delete failed', { details: err.message });
      });

    } catch (err) {
      console.error('[DELETE] Synchronous Error:', err);
      alert('Delete error: ' + err.message);
    }
  },

  /**
   * Save invoice with status transition
   */
  async saveWithStatus(newStatus, successMessage, extraData = {}, retryWithOverride = false) {
    const form = document.getElementById('invoice-edit-form');
    if (!form) return;

    const formData = {
      invoice_number: this.getFormValue('invoice_number'),
      amount: window.Validation?.parseCurrency(this.getFormValue('amount')),
      invoice_date: this.getFormValue('invoice_date'),
      due_date: this.getFormValue('due_date') || null,
      job_id: this.getFormValue('job_id') || null,
      vendor_id: this.getFormValue('vendor_id') || null,
      po_id: this.getFormValue('po_id') || null,
      notes: this.getFormValue('notes') || null,
      status: newStatus,
      ...extraData
    };

    // Add override flag if retrying after PO overage confirmation
    if (retryWithOverride) {
      formData.overridePoOverage = true;
    }

    this.clearFieldErrors();

    try {
      const loadingToast = window.toasts?.showLoading('Saving...');

      const response = await fetch(`/api/invoices/${this.currentInvoice.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          allocations: this.currentAllocations,
          version: this.currentInvoice.version,
          performed_by: window.currentUser || 'unknown'
        })
      });

      window.toasts?.dismiss(loadingToast);

      const result = await response.json();

      // Handle PO overage soft-block
      if (!response.ok && result.error === 'PO_OVERAGE') {
        this.showConfirmDialog({
          title: 'PO Balance Exceeded',
          message: `This invoice exceeds the PO remaining balance.\n\n` +
            `PO Remaining: ${window.Validation?.formatCurrency(result.poRemaining)}\n` +
            `Invoice Amount: ${window.Validation?.formatCurrency(result.invoiceAmount)}\n` +
            `Over by: ${window.Validation?.formatCurrency(result.overageAmount)}\n\n` +
            `Do you want to approve anyway?`,
          confirmText: 'Approve Anyway',
          cancelText: 'Cancel',
          type: 'warning',
          onConfirm: async () => {
            await this.saveWithStatus(newStatus, successMessage, extraData, true);
          }
        });
        return;
      }

      if (!response.ok) {
        throw new Error(result.message || 'Failed to save');
      }

      if (result.undo) {
        window.toasts?.showWithUndo(successMessage, async () => {
          await fetch(`/api/invoices/${this.currentInvoice.id}/undo`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ undo_id: result.undo.id })
          });
          if (this.onSaveCallback) this.onSaveCallback(result.invoice);
        }, result.undo.remainingMs);
      } else {
        window.toasts?.success(successMessage);
      }

      this.isDirty = false;

      if (this.onSaveCallback) {
        this.onSaveCallback(result.invoice);
      }

      this.closeActiveModal();
    } catch (err) {
      console.error('Save failed:', err);
      window.toasts?.error('Save failed', { details: err.message });
    }
  },

  /**
   * Validate required fields for status transition
   */
  validateForStatus(targetStatus) {
    const errors = [];
    const amount = window.Validation?.parseCurrency(this.getFormValue('amount'));

    // Always required
    if (!this.getFormValue('invoice_number')) errors.push('Invoice number');
    if (!amount || amount <= 0) errors.push('Amount');
    if (!this.getFormValue('invoice_date')) errors.push('Invoice date');

    // For 'coded' status - need job and allocations
    if (targetStatus === 'coded') {
      if (!this.getFormValue('job_id')) errors.push('Job');
      if (!this.currentAllocations?.length || !this.currentAllocations.some(a => a.cost_code_id)) {
        errors.push('At least one cost code allocation');
      }
    }

    // For 'approved' status - everything above plus vendor
    if (targetStatus === 'approved') {
      if (!this.getFormValue('job_id')) errors.push('Job');
      if (!this.getFormValue('vendor_id')) errors.push('Vendor');
      if (!this.currentAllocations?.length || !this.currentAllocations.some(a => a.cost_code_id)) {
        errors.push('At least one cost code allocation');
      }

      // Verify allocations balance
      const totalAllocated = this.currentAllocations.reduce((sum, a) => sum + parseFloat(a.amount || 0), 0);
      if (Math.abs(amount - totalAllocated) > 0.01) {
        errors.push('Allocations must equal invoice amount');
      }
    }

    return errors;
  },

  /**
   * Show job selection modal
   */
  async showJobSelectionModal(options = {}) {
    const { currentJobId, suggestions = [], onSelect, title = 'Select Job' } = options;

    try {
      const response = await fetch('/api/jobs?status=active');
      const jobs = response.ok ? await response.json() : [];

      const modal = `
        <div class="modal-backdrop">
          <div class="modal modal-medium">
            <div class="modal-header">
              <h2>${title}</h2>
              <button class="modal-close" onclick="Modals.closeActiveModal()">&times;</button>
            </div>

            <div class="modal-body">
              <div class="search-box">
                <input type="text" id="job-search" placeholder="Search jobs..."
                  oninput="Modals.filterJobList(this.value)">
              </div>

              ${suggestions.length > 0 ? `
                <div class="suggestions-section">
                  <h4>AI Suggestions</h4>
                  <div class="job-list" id="suggested-jobs">
                    ${suggestions.map(s => `
                      <div class="job-item ${s.job?.id === currentJobId ? 'selected' : ''}"
                        data-id="${s.job?.id}" onclick="Modals.selectJob('${s.job?.id}')">
                        <div class="job-name">${this.escapeHtml(s.job?.name || 'Unknown')}</div>
                        <div class="job-meta">
                          <span class="confidence ${this.getConfidenceClass(s.confidence)}">
                            ${Math.round(s.confidence * 100)}% match
                          </span>
                          <span class="match-type">${s.matchType || ''}</span>
                        </div>
                      </div>
                    `).join('')}
                  </div>
                </div>
              ` : ''}

              <div class="all-jobs-section">
                <h4>All Jobs</h4>
                <div class="job-list" id="all-jobs">
                  ${jobs.map(job => `
                    <div class="job-item ${job.id === currentJobId ? 'selected' : ''}"
                      data-id="${job.id}" data-name="${job.name.toLowerCase()}"
                      onclick="Modals.selectJob('${job.id}')">
                      <div class="job-name">${this.escapeHtml(job.name)}</div>
                      <div class="job-address">${this.escapeHtml(job.address || '')}</div>
                    </div>
                  `).join('')}
                </div>
              </div>
            </div>

            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" onclick="Modals.closeActiveModal()">
                Cancel
              </button>
            </div>
          </div>
        </div>
      `;

      this.showModal(modal, 'job-selection-modal');
      this.onJobSelectCallback = onSelect;

      // Focus search
      setTimeout(() => document.getElementById('job-search')?.focus(), 100);
    } catch (err) {
      console.error('Failed to show job selection:', err);
      window.toasts?.error('Failed to load jobs');
    }
  },

  /**
   * Filter job list by search term
   */
  filterJobList(term) {
    const lowerTerm = term.toLowerCase();
    document.querySelectorAll('#all-jobs .job-item').forEach(item => {
      const name = item.dataset.name || '';
      item.style.display = name.includes(lowerTerm) ? '' : 'none';
    });
  },

  /**
   * Handle job selection
   */
  selectJob(jobId) {
    if (this.onJobSelectCallback) {
      this.onJobSelectCallback(jobId);
    }
    this.closeActiveModal();
  },

  /**
   * Show confirmation dialog
   */
  showConfirmDialog(options = {}) {
    const {
      title = 'Confirm',
      message = 'Are you sure?',
      confirmText = 'Confirm',
      cancelText = 'Cancel',
      type = 'warning',
      onConfirm,
      onCancel
    } = options;

    const modal = `
      <div class="modal modal-small confirm-modal">
        <div class="modal-header">
          <h2>${title}</h2>
          <button class="modal-close" onclick="Modals.closeConfirmDialog()">&times;</button>
        </div>

        <div class="modal-body">
          <div class="confirm-icon confirm-${type}">
            ${type === 'warning' ? '⚠️' : type === 'danger' ? '🚨' : 'ℹ️'}
          </div>
          <p class="confirm-message">${message.replace(/\n/g, '<br>')}</p>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-secondary"
            onclick="Modals.handleConfirmCancel()">
            ${cancelText}
          </button>
          <button type="button" class="btn btn-${type === 'danger' ? 'danger' : 'primary'}"
            onclick="Modals.handleConfirmOk()">
            ${confirmText}
          </button>
        </div>
      </div>
    `;

    // Show as overlay on top of current modal (don't replace it)
    const overlay = document.createElement('div');
    overlay.id = 'confirm-overlay';
    overlay.innerHTML = modal;
    document.body.appendChild(overlay);

    this.onConfirmCallback = onConfirm;
    this.onCancelCallback = onCancel;
  },

  closeConfirmDialog() {
    const overlay = document.getElementById('confirm-overlay');
    if (overlay) overlay.remove();
  },

  handleConfirmOk() {
    console.log('[MODALS] handleConfirmOk called');
    const callback = this.onConfirmCallback;
    this.onConfirmCallback = null;
    this.onCancelCallback = null;
    this.closeConfirmDialog();
    if (callback) {
      try {
        callback();
      } catch (err) {
        console.error('Confirm callback error:', err);
        window.toasts?.error('Action failed', { details: err.message });
      }
    }
  },

  handleConfirmCancel() {
    console.log('[MODALS] handleConfirmCancel called');
    const callback = this.onCancelCallback;
    this.onConfirmCallback = null;
    this.onCancelCallback = null;
    this.closeConfirmDialog();
    if (callback) {
      console.log('[MODALS] Calling cancel callback');
      callback();
    }
  },

  // =====================
  // Helper Methods
  // =====================

  /**
   * Show a modal
   */
  showModal(html, id) {
    const container = document.getElementById('modal-container');
    if (!container) return;

    container.innerHTML = html;
    container.classList.add('active');
    this.activeModal = id;
    document.body.classList.add('modal-open');

    // Populate dropdowns if edit modal
    if (id === 'invoice-edit-modal') {
      this.populateDropdowns();

      // Attach delete button event listener as backup
      setTimeout(() => {
        const deleteBtn = container.querySelector('button[onclick*="deleteInvoice"]');
        if (deleteBtn) {
          console.log('[MODALS] Found delete button, attaching direct listener');
          deleteBtn.addEventListener('click', (e) => {
            console.log('[MODALS] Delete button clicked via addEventListener');
            e.preventDefault();
            e.stopPropagation();
            window.Modals.deleteInvoice();
          });
        } else {
          console.log('[MODALS] No delete button found in modal');
        }
      }, 100);
    }
  },

  /**
   * Close the active modal
   */
  async closeActiveModal() {
    console.log('[MODALS] closeActiveModal called, isDirty:', this.isDirty);

    if (this.isDirty) {
      console.log('[MODALS] Has unsaved changes, showing confirm dialog');
      const confirmed = await this.confirmUnsavedChanges();
      console.log('[MODALS] User confirmed:', confirmed);
      if (!confirmed) return;
    }

    // Release lock if we have one
    if (this.lockId) {
      await this.releaseLock(this.lockId);
      this.lockId = null;
    }

    const container = document.getElementById('modal-container');
    if (container) {
      container.classList.remove('active');
      container.innerHTML = '';
    }

    document.body.classList.remove('modal-open');

    if (this.onCloseCallback) {
      this.onCloseCallback();
    }

    this.activeModal = null;
    this.currentInvoice = null;
    this.currentAllocations = [];
    this.isDirty = false;
    this.onSaveCallback = null;
    this.onCloseCallback = null;
  },

  /**
   * Confirm unsaved changes
   */
  confirmUnsavedChanges() {
    return new Promise(resolve => {
      this.showConfirmDialog({
        title: 'Unsaved Changes',
        message: 'You have unsaved changes. Are you sure you want to close?',
        confirmText: 'Discard',
        cancelText: 'Keep Editing',
        type: 'warning',
        onConfirm: () => {
          this.isDirty = false;
          resolve(true);
        },
        onCancel: () => resolve(false)
      });
    });
  },

  /**
   * Mark form as dirty
   */
  markDirty() {
    this.isDirty = true;
  },

  /**
   * Get form field value
   */
  getFormValue(name) {
    const el = document.querySelector(`[name="${name}"]`) ||
               document.getElementById(`edit-${name.replace('_', '-')}`);
    return el?.value || '';
  },

  /**
   * Show field errors
   */
  showFieldErrors(errors) {
    for (const [field, messages] of Object.entries(errors)) {
      const errorEl = document.getElementById(`error-${field}`);
      if (errorEl) {
        errorEl.textContent = messages.join(', ');
        errorEl.classList.add('visible');
      }
    }
  },

  /**
   * Clear all field errors
   */
  clearFieldErrors() {
    document.querySelectorAll('.field-error').forEach(el => {
      el.textContent = '';
      el.classList.remove('visible');
    });
  },

  /**
   * Populate dropdowns (jobs, vendors, cost codes)
   */
  async populateDropdowns() {
    try {
      // Fetch jobs
      const jobsRes = await fetch('/api/jobs?status=active');
      if (jobsRes.ok) {
        const jobs = await jobsRes.json();
        const jobSelect = document.getElementById('edit-job');
        if (jobSelect) {
          jobSelect.innerHTML = '<option value="">-- Select Job --</option>' +
            jobs.map(j => `<option value="${j.id}">${j.name}</option>`).join('');
          if (this.currentInvoice?.job_id) {
            jobSelect.value = this.currentInvoice.job_id;
          }
        }
      }

      // Fetch vendors
      const vendorsRes = await fetch('/api/vendors');
      if (vendorsRes.ok) {
        const vendors = await vendorsRes.json();
        const vendorSelect = document.getElementById('edit-vendor');
        if (vendorSelect) {
          vendorSelect.innerHTML = '<option value="">-- Select Vendor --</option>' +
            vendors.map(v => `<option value="${v.id}">${v.name}</option>`).join('');
          if (this.currentInvoice?.vendor_id) {
            vendorSelect.value = this.currentInvoice.vendor_id;
          }
        }
      }

      // Fetch POs if job selected
      if (this.currentInvoice?.job_id) {
        const posRes = await fetch(`/api/jobs/${this.currentInvoice.job_id}/purchase-orders`);
        if (posRes.ok) {
          const pos = await posRes.json();
          const poSelect = document.getElementById('edit-po');
          if (poSelect) {
            poSelect.innerHTML = '<option value="">-- No PO --</option>' +
              pos.map(p => `<option value="${p.id}">${p.po_number} - ${p.vendor_name || ''}</option>`).join('');
            if (this.currentInvoice?.po_id) {
              poSelect.value = this.currentInvoice.po_id;
            }
          }
        }
      }

      // Initialize cost code pickers
      await this.initCostCodePickers();
    } catch (err) {
      console.error('Failed to populate dropdowns:', err);
    }
  },

  /**
   * Fetch invoice data
   */
  async fetchInvoice(invoiceId) {
    try {
      const response = await fetch(`/api/invoices/${invoiceId}`);
      if (!response.ok) throw new Error('Invoice not found');
      return await response.json();
    } catch (err) {
      console.error('Failed to fetch invoice:', err);
      window.toasts?.error('Failed to load invoice');
      return null;
    }
  },

  /**
   * Fetch allocations for invoice
   */
  async fetchAllocations(invoiceId) {
    try {
      const response = await fetch(`/api/invoices/${invoiceId}/allocations`);
      if (!response.ok) return [];
      return await response.json();
    } catch (err) {
      console.error('Failed to fetch allocations:', err);
      return [];
    }
  },

  /**
   * Fetch activity history for invoice
   */
  async fetchActivity(invoiceId) {
    try {
      const response = await fetch(`/api/invoices/${invoiceId}/activity`);
      if (!response.ok) return [];
      return await response.json();
    } catch (err) {
      console.error('Failed to fetch activity:', err);
      return [];
    }
  },

  /**
   * Acquire lock
   */
  async acquireLock(entityType, entityId) {
    try {
      const response = await fetch('/api/locks/acquire', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entity_type: entityType,
          entity_id: entityId,
          locked_by: window.currentUser || 'unknown'
        })
      });

      const result = await response.json();
      return {
        success: response.ok,
        lock: result,
        error: result.message
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Release lock
   */
  async releaseLock(lockId) {
    try {
      await fetch(`/api/locks/${lockId}`, { method: 'DELETE' });
    } catch (err) {
      console.error('Failed to release lock:', err);
    }
  },

  /**
   * Get confidence class
   */
  getConfidenceClass(score) {
    if (score >= 0.90) return 'confidence-high';
    if (score >= 0.60) return 'confidence-medium';
    return 'confidence-low';
  },

  /**
   * Escape HTML
   */
  escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
};

// Initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => Modals.init());
} else {
  Modals.init();
}

// Export for use
window.Modals = Modals;

// Debug helper - call from console: debugModals()
window.debugModals = function() {
  console.log('=== Modals Debug Info ===');
  console.log('window.Modals exists:', !!window.Modals);
  console.log('Modals.currentInvoice:', Modals.currentInvoice);
  console.log('Modals.activeModal:', Modals.activeModal);

  const deleteBtn = document.querySelector('button[onclick*="deleteInvoice"]');
  console.log('Delete button found:', !!deleteBtn);
  if (deleteBtn) {
    console.log('Delete button onclick:', deleteBtn.getAttribute('onclick'));
    console.log('Delete button disabled:', deleteBtn.disabled);
    console.log('Delete button visible:', deleteBtn.offsetParent !== null);
  }

  const modalFooter = document.querySelector('.modal-footer-right');
  console.log('Modal footer right:', modalFooter?.innerHTML);

  return 'Debug complete - check console';
};

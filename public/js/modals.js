/**
 * Modal Management Module
 * Handles invoice edit modal, job selection modal, and other UI dialogs
 * LAST UPDATED: 2026-01-06 - Searchable dropdowns for Job/Vendor/PO
 */
console.log('[MODALS] Script loaded - version 2026-01-06 - SEARCHABLE DROPDOWNS');

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
   * Check if a field should show AI indicator (was AI-extracted and not overridden)
   */
  isAiGenerated(invoice, fieldName) {
    // Must be AI processed
    if (!invoice.ai_processed) return false;

    // Check if field was overridden in this session
    if (this.overriddenFields?.has(fieldName)) {
      return false;
    }

    // Check if field was overridden in database
    if (invoice.ai_overrides && invoice.ai_overrides[fieldName]) {
      return false;
    }

    // Check if we have AI-extracted data for this field
    const aiData = invoice.ai_extracted_data;
    if (!aiData) return false;

    // Map field names to AI extracted data keys
    const fieldMap = {
      'invoice_number': aiData.parsed_invoice_number,
      'amount': aiData.parsed_amount,
      'invoice_date': aiData.parsed_date,
      'job_id': aiData.parsed_address || invoice.job_id,
      'vendor_id': aiData.parsed_vendor_name || invoice.vendor_id,
      'po_id': invoice.po_id // PO is matched if we have one
    };

    return fieldMap[fieldName] !== undefined;
  },

  /**
   * Get confidence score for a field
   */
  getFieldConfidence(invoice, fieldName) {
    if (!invoice.ai_confidence) return null;

    // Try multiple possible key formats (camelCase and snake_case)
    const fieldMappings = {
      'invoice_number': ['invoiceNumber', 'invoice_number'],
      'invoice_date': ['date', 'invoice_date'],
      'amount': ['amount'],
      'job_id': ['job', 'job_id'],
      'vendor_id': ['vendor', 'vendor_id'],
      'po_id': ['po', 'po_id']
    };

    const keys = fieldMappings[fieldName] || [fieldName];
    for (const key of keys) {
      if (invoice.ai_confidence[key] !== undefined) {
        return invoice.ai_confidence[key];
      }
    }
    return null;
  },

  /**
   * Build AI indicator HTML for a field - nice badge with confidence
   */
  buildAiIndicator(invoice, fieldName) {
    if (!this.isAiGenerated(invoice, fieldName)) return '';

    const confidence = this.getFieldConfidence(invoice, fieldName);
    const confidencePct = confidence ? Math.round(confidence * 100) : null;
    const confidenceClass = this.getConfidenceClass(confidence || 0);

    // Determine icon based on confidence
    let icon = '✨';
    if (confidencePct >= 90) icon = '✓';
    else if (confidencePct >= 70) icon = '◐';
    else if (confidencePct) icon = '?';

    const title = confidence
      ? `AI-extracted with ${confidencePct}% confidence. Edit to override.`
      : 'AI-extracted. Edit to override.';

    return `
      <span class="ai-badge ${confidenceClass}" title="${title}" data-field="${fieldName}">
        <span class="ai-badge-icon">${icon}</span>
        ${confidencePct ? `<span class="ai-badge-score">${confidencePct}%</span>` : ''}
        <span class="ai-badge-label">AI</span>
      </span>
    `;
  },

  /**
   * Build the edit modal HTML with PDF split-view
   */
  buildEditModal(invoice, allocations, activity = []) {
    const statusInfo = window.Validation?.getStatusInfo(invoice.status) || {};
    const isArchived = invoice.status === 'paid';
    const canEdit = !isArchived && ['received', 'needs_approval', 'approved'].includes(invoice.status);
    // Show original PDF for needs_approval/received, stamped for approved+
    const showOriginal = ['needs_approval', 'received'].includes(invoice.status);
    const pdfUrl = showOriginal ? invoice.pdf_url : (invoice.pdf_stamped_url || invoice.pdf_url);

    // Payment tracking info
    const invoiceAmount = parseFloat(invoice.amount || 0);
    const paidAmount = parseFloat(invoice.paid_amount || 0);
    const remainingAmount = invoiceAmount - paidAmount;
    const hasPartialPayment = paidAmount > 0 && remainingAmount > 0.01;
    const isClosedOut = !!invoice.closed_out_at;

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
                      <label for="edit-invoice-number">Invoice Number * ${this.buildAiIndicator(invoice, 'invoice_number')}</label>
                      <input type="text" id="edit-invoice-number" name="invoice_number"
                        value="${this.escapeHtml(invoice.invoice_number || '')}"
                        ${!canEdit ? 'readonly' : ''}
                        onchange="Modals.markDirty(); Modals.markFieldOverridden('invoice_number')">
                      <div class="field-error" id="error-invoice_number"></div>
                    </div>

                    <div class="form-group">
                      <label for="edit-amount">Amount * ${this.buildAiIndicator(invoice, 'amount')}</label>
                      <input type="text" id="edit-amount" name="amount"
                        value="${window.Validation?.formatCurrency(invoice.amount) || ''}"
                        ${!canEdit ? 'readonly' : ''}
                        onchange="Modals.handleAmountChange(this); Modals.markFieldOverridden('amount')">
                      <div class="field-error" id="error-amount"></div>
                    </div>

                    <div class="form-row">
                      <div class="form-group">
                        <label for="edit-invoice-date">Invoice Date * ${this.buildAiIndicator(invoice, 'invoice_date')}</label>
                        <input type="date" id="edit-invoice-date" name="invoice_date"
                          value="${invoice.invoice_date || ''}"
                          ${!canEdit ? 'readonly' : ''}
                          onchange="Modals.markDirty(); Modals.markFieldOverridden('invoice_date')">
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
                      <label for="edit-job">Job ${this.buildAiIndicator(invoice, 'job_id')}</label>
                      <div id="job-picker-container" class="search-picker-container"></div>
                      <input type="hidden" id="edit-job" name="job_id">
                      <div class="field-error" id="error-job_id"></div>
                    </div>

                    <div class="form-group">
                      <label for="edit-vendor">Vendor ${this.buildAiIndicator(invoice, 'vendor_id')}</label>
                      <div id="vendor-picker-container" class="search-picker-container"></div>
                      <input type="hidden" id="edit-vendor" name="vendor_id">
                      <div class="field-error" id="error-vendor_id"></div>
                    </div>

                    <div class="form-group">
                      <label for="edit-po">Purchase Order ${this.buildAiIndicator(invoice, 'po_id')}</label>
                      <div id="po-picker-container" class="search-picker-container"></div>
                      <input type="hidden" id="edit-po" name="po_id">
                      <div class="field-error" id="error-po_id"></div>
                    </div>
                  </div>

                  <div class="form-section">
                    <div class="section-header">
                      <h3>Line Items</h3>
                      ${!isArchived && invoice.status !== 'in_draw' ? `
                        <button type="button" class="btn-add-line" onclick="Modals.addAllocation()">
                          + Add line
                        </button>
                      ` : ''}
                    </div>
                    <div id="allocations-container" class="line-items-container">
                      ${this.buildAllocationsHtml(allocations, invoice.amount, isArchived)}
                    </div>
                    <div class="allocation-summary" id="allocation-summary">
                      ${this.buildAllocationSummary(allocations, invoice.amount)}
                    </div>
                  </div>

                  ${hasPartialPayment || isClosedOut ? `
                  <div class="form-section payment-info-section">
                    <h3>Payment Status</h3>
                    <div class="payment-info-card ${isClosedOut ? 'closed-out' : 'partial'}">
                      <div class="payment-info-row">
                        <span class="payment-label">Invoice Total:</span>
                        <span class="payment-value">${window.Validation?.formatCurrency(invoiceAmount)}</span>
                      </div>
                      <div class="payment-info-row">
                        <span class="payment-label">Amount Paid:</span>
                        <span class="payment-value paid">${window.Validation?.formatCurrency(paidAmount)}</span>
                      </div>
                      ${!isClosedOut ? `
                      <div class="payment-info-row highlight">
                        <span class="payment-label">Remaining:</span>
                        <span class="payment-value remaining">${window.Validation?.formatCurrency(remainingAmount)}</span>
                      </div>
                      ` : `
                      <div class="payment-info-row">
                        <span class="payment-label">Written Off:</span>
                        <span class="payment-value written-off">${window.Validation?.formatCurrency(invoice.write_off_amount || 0)}</span>
                      </div>
                      <div class="payment-info-row closed-out-info">
                        <span class="payment-label">Closed Out:</span>
                        <span class="payment-value">${new Date(invoice.closed_out_at).toLocaleDateString()}</span>
                      </div>
                      <div class="payment-info-row closed-out-info">
                        <span class="payment-label">By:</span>
                        <span class="payment-value">${this.escapeHtml(invoice.closed_out_by || 'Unknown')}</span>
                      </div>
                      <div class="payment-info-row closed-out-info">
                        <span class="payment-label">Reason:</span>
                        <span class="payment-value">${this.escapeHtml(invoice.closed_out_reason || 'N/A')}</span>
                      </div>
                      `}
                    </div>
                  </div>
                  ` : ''}

                  <div class="form-section activity-section">
                    <div class="section-header">
                      <h3>Activity</h3>
                      <button type="button" class="btn-link" onclick="Modals.toggleActivityExpand()">
                        View history
                      </button>
                    </div>
                    <div class="activity-compact">
                      ${this.buildCompactActivity(invoice, activity)}
                    </div>
                    <div class="activity-full" id="activity-full" style="display: none;">
                      <div class="status-pipeline">
                        ${this.buildStatusPipeline(invoice.status)}
                      </div>
                      <div class="activity-feed">
                        ${this.buildActivityTimeline(invoice, activity)}
                      </div>
                    </div>
                    ${!isArchived ? `
                      <div class="add-note-box">
                        <input type="text" id="edit-notes" name="notes"
                          placeholder="Add a note..."
                          onchange="Modals.markDirty()">
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
   * Build allocations HTML - Adaptive.build inspired clean line items
   */
  buildAllocationsHtml(allocations, invoiceAmount, isArchived = false) {
    // Get cost code confidence from AI data if available
    const costCodeConfidence = this.currentInvoice?.ai_confidence?.costCode || 0;

    const buildLineItem = (alloc, index) => {
      // Check if this specific allocation is AI-suggested
      const allocIsAi = alloc.notes?.includes('Auto-suggested') || alloc.notes?.includes('trade type');
      const confidencePct = Math.round(costCodeConfidence * 100);
      const confidenceClass = this.getConfidenceClass(costCodeConfidence);
      const icon = confidencePct >= 90 ? '✓' : confidencePct >= 70 ? '◐' : '?';
      const aiBadge = allocIsAi && confidencePct > 0 ? `<span class="ai-badge ${confidenceClass}" title="AI-suggested based on vendor trade type (${confidencePct}% confidence)"><span class="ai-badge-icon">${icon}</span><span class="ai-badge-score">${confidencePct}%</span><span class="ai-badge-label">AI</span></span>` : '';

      return `
        <div class="line-item" data-index="${index}">
          <div class="line-item-header">
            <div class="line-item-field flex-2">
              <label class="field-label">Cost code / Account <span class="required">*</span> ${aiBadge}</label>
              <div class="cc-picker-container" data-index="${index}"></div>
            </div>
            <div class="line-item-field">
              <label class="field-label">Amount <span class="required">*</span></label>
              <div class="amount-input-group">
                <span class="amount-prefix">$</span>
                <input type="text" class="field-input amount-input" placeholder="0.00"
                  value="${this.formatAmountInput(alloc.amount)}"
                  onchange="Modals.updateAllocation(${index}, 'amount', this.value)"
                  ${isArchived ? 'readonly' : ''}>
              </div>
            </div>
            ${!isArchived ? `
              <button type="button" class="btn-delete-row" onclick="Modals.removeAllocation(${index})" title="Delete">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            ` : ''}
          </div>
        </div>
      `;
    };

    if (!allocations || allocations.length === 0) {
      return buildLineItem({ cost_code_id: null, amount: invoiceAmount || 0, notes: '' }, 0);
    }

    return allocations.map((alloc, index) => buildLineItem(alloc, index)).join('');
  },

  /**
   * Format amount for input (no $ symbol, just number)
   */
  formatAmountInput(amount) {
    if (!amount && amount !== 0) return '';
    const num = parseFloat(amount);
    if (isNaN(num)) return '';
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
    const isUnder = diff > 0.01;
    const hasAllocations = validAllocations.length > 0;

    // Calculate percentage for progress bar
    const percentage = amount > 0 ? Math.min((total / amount) * 100, 100) : 0;

    // Determine status
    let statusClass = 'pending';
    if (balanced) statusClass = 'balanced';
    else if (isOver) statusClass = 'over';
    else if (hasAllocations) statusClass = 'partial';

    return `
      <div class="allocation-summary-card ${statusClass}">
        <div class="summary-amounts">
          <div class="summary-amount-item">
            <span class="summary-label">Invoice Total</span>
            <span class="summary-value">${window.Validation?.formatCurrency(amount)}</span>
          </div>
          <div class="summary-amount-item">
            <span class="summary-label">Allocated</span>
            <span class="summary-value ${statusClass}">${window.Validation?.formatCurrency(total)}</span>
          </div>
          ${isUnder || isOver ? `
          <div class="summary-amount-item">
            <span class="summary-label">${isOver ? 'Over by' : 'Remaining'}</span>
            <span class="summary-value ${isOver ? 'over' : ''}">${window.Validation?.formatCurrency(Math.abs(diff))}</span>
          </div>
          ` : ''}
        </div>
        <div class="summary-progress">
          <div class="progress-bar">
            <div class="progress-fill ${statusClass}" style="width: ${percentage}%"></div>
          </div>
          <span class="progress-label">${Math.round(percentage)}% allocated</span>
        </div>
        ${isOver ? `<div class="allocation-error">Cannot approve — allocations exceed invoice total</div>` : ''}
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
   * Build compact activity summary - just the latest status
   */
  buildCompactActivity(invoice, activity = []) {
    const latest = activity && activity.length > 0 ? activity[0] : null;

    if (!latest && invoice.created_at) {
      return `
        <div class="activity-compact-item">
          <span class="activity-compact-label">Received</span>
          <span class="activity-compact-time">${this.formatRelativeTime(invoice.created_at)}</span>
        </div>
      `;
    }

    if (!latest) {
      return '<div class="activity-compact-empty">No activity</div>';
    }

    const action = this.formatActivityAction(latest.action || 'note');
    const by = latest.performed_by ? ` by ${latest.performed_by}` : '';

    return `
      <div class="activity-compact-item">
        <span class="activity-compact-label">${action}${by}</span>
        <span class="activity-compact-time">${this.formatRelativeTime(latest.created_at)}</span>
      </div>
    `;
  },

  /**
   * Toggle activity expanded view
   */
  toggleActivityExpand() {
    const full = document.getElementById('activity-full');
    const btn = document.querySelector('.activity-section .btn-link');
    if (full.style.display === 'none') {
      full.style.display = 'block';
      btn.textContent = 'Hide history';
    } else {
      full.style.display = 'none';
      btn.textContent = 'View history';
    }
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
      const statusActions = ['uploaded', 'needs_approval', 'approved', 'denied', 'paid', 'added_to_draw', 'removed_from_draw'];

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
      { id: 'needs_approval', label: 'Needs Approval', icon: '🏷️' },
      { id: 'approved', label: 'Approved', icon: '✓' },
      { id: 'in_draw', label: 'In Draw', icon: '📋' },
      { id: 'paid', label: 'Paid', icon: '💰' }
    ];

    const statusOrder = ['received', 'needs_approval', 'approved', 'in_draw', 'paid'];
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
      'needs_approval': '🏷️',
      'approved': '✅',
      'denied': '❌',
      'paid': '💰',
      'partial_payment': '💵',
      'closed_out': '📕',
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
      'needs_approval': 'Needs Approval',
      'approved': 'Approved',
      'denied': 'Denied',
      'paid': 'Marked as paid',
      'partial_payment': 'Partial payment',
      'closed_out': 'Closed out',
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
   * received → Submit | Deny | Delete
   * needs_approval → Approve | Save | Deny | Close Out (if partial)
   * approved → Add to Draw | Unapprove | Save | Close Out (if partial)
   * in_draw → Remove from Draw (view only)
   * paid → View only
   * denied → Resubmit | Save | Delete
   */
  buildStatusActions(invoice) {
    const status = invoice.status;
    const isArchived = status === 'paid';
    const buttons = [];

    // Check if invoice has remaining balance (for close-out option)
    const invoiceAmount = parseFloat(invoice.amount || 0);
    const paidAmount = parseFloat(invoice.paid_amount || 0);
    const hasRemainingBalance = invoiceAmount - paidAmount > 0.01;

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
        buttons.push(`<button type="button" class="btn btn-primary" onclick="Modals.saveAndSubmit()">Submit</button>`);
        break;

      case 'needs_approval':
        // Needs Approval - ready for approval
        buttons.push(`<button type="button" class="btn btn-danger-outline" onclick="window.Modals.deleteInvoice()">Delete</button>`);
        // Show Close Out button if there's a remaining balance to write off
        if (hasRemainingBalance) {
          buttons.push(`<button type="button" class="btn btn-warning-outline" onclick="Modals.showCloseOutDialog()">Close Out</button>`);
        }
        buttons.push(`<button type="button" class="btn btn-secondary" onclick="Modals.saveInvoice()">Save</button>`);
        buttons.push(`<button type="button" class="btn btn-success" onclick="Modals.approveInvoice()">Approve</button>`);
        break;

      case 'approved':
        // Approved - can be added to draw
        buttons.push(`<button type="button" class="btn btn-warning-outline" onclick="Modals.unapproveInvoice()">Unapprove</button>`);
        // Show Close Out button if there's a remaining balance to write off
        if (hasRemainingBalance) {
          buttons.push(`<button type="button" class="btn btn-warning-outline" onclick="Modals.showCloseOutDialog()">Close Out</button>`);
        }
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
    this.currentAllocations.push({
      cost_code_id: null,
      amount: 0,
      notes: ''
    });
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
  async handleJobChange(jobId) {
    this.markDirty();

    // Update the PO picker to use the new job
    const poContainer = document.getElementById('po-picker-container');
    if (poContainer && window.SearchablePicker) {
      // Clear PO value and update jobId for filtering
      document.getElementById('edit-po').value = '';
      window.SearchablePicker.updateJobId(poContainer, jobId);
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
      const allocation = this.currentAllocations[index];
      const currentValue = allocation?.cost_code_id || null;
      const originalValue = currentValue; // Store original to detect changes

      window.CostCodePicker.init(container, {
        value: currentValue,
        disabled: isArchived,
        onChange: (codeId) => {
          this.updateAllocation(index, 'cost_code_id', codeId);
          // Mark cost code AI badge as overridden when changed
          this.handleCostCodeChange(container, codeId, originalValue, allocation);
        }
      });
    });
  },

  /**
   * Handle cost code change - update AI badge state
   */
  handleCostCodeChange(container, newValue, originalValue, allocation) {
    const lineItem = container.closest('.line-item');
    if (!lineItem) return;

    const aiBadge = lineItem.querySelector('.ai-badge');
    if (!aiBadge) return;

    // Check if this was an AI-suggested allocation
    const wasAiSuggested = allocation?.notes?.includes('Auto-suggested') || allocation?.notes?.includes('trade type');
    if (!wasAiSuggested) return;

    if (newValue !== originalValue) {
      // Changed from original - mark as overridden
      aiBadge.classList.add('overridden');
      aiBadge.title = 'AI suggestion overridden by user';
    } else {
      // Changed back to original - restore badge
      aiBadge.classList.remove('overridden');
      aiBadge.title = 'AI-suggested based on vendor trade type';
    }
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
   * Save and transition to 'needs_approval' status
   */
  async saveAndSubmit() {
    // Validate required fields for coding
    const errors = this.validateForStatus('needs_approval');
    if (errors.length > 0) {
      window.toasts?.error('Missing required fields', { details: errors.join(', ') });
      return;
    }

    await this.saveWithStatus('needs_approval', 'Invoice submitted for approval');
  },

  /**
   * Approve the invoice
   */
  async approveInvoice() {
    console.log('[APPROVE] approveInvoice called');
    console.log('[APPROVE] currentInvoice:', this.currentInvoice?.id);
    console.log('[APPROVE] currentAllocations:', this.currentAllocations);
    const errors = this.validateForStatus('approved');
    console.log('[APPROVE] validation errors:', errors);
    if (errors.length > 0) {
      window.toasts?.error('Missing required fields for approval', { details: errors.join(', ') });
      return;
    }

    // Check if this is a partial allocation
    const allocations = this.currentAllocations || [];
    const totalAllocated = allocations.reduce((sum, a) => sum + parseFloat(a.amount || 0), 0);
    const invoiceAmount = parseFloat(this.currentInvoice?.amount || 0);
    const isPartial = totalAllocated < invoiceAmount - 0.01;

    console.log('[APPROVE] totalAllocated:', totalAllocated);
    console.log('[APPROVE] invoiceAmount:', invoiceAmount);
    console.log('[APPROVE] isPartial:', isPartial);

    if (isPartial) {
      console.log('[APPROVE] Showing partial approval dialog');
      // Partial approval requires a note
      this.showPartialApprovalDialog(totalAllocated, invoiceAmount);
    } else {
      console.log('[APPROVE] Showing regular confirm dialog');
      this.showConfirmDialog({
        title: 'Approve Invoice',
        message: `Approve invoice #${this.currentInvoice?.invoice_number || 'N/A'} for ${window.Validation?.formatCurrency(this.currentInvoice?.amount)}?`,
        confirmText: 'Approve',
        type: 'info',
        onConfirm: async () => {
          await this.saveWithStatus('approved', 'Invoice approved');
        }
      });
    }
  },

  /**
   * Show dialog for partial approval (requires note)
   */
  showPartialApprovalDialog(allocatedAmount, invoiceAmount) {
    console.log('[PARTIAL] showPartialApprovalDialog called', { allocatedAmount, invoiceAmount });
    const difference = invoiceAmount - allocatedAmount;
    const pct = Math.round((allocatedAmount / invoiceAmount) * 100);
    console.log('[PARTIAL] difference:', difference, 'pct:', pct);

    const modal = `
      <div class="confirm-modal partial-approval-modal">
        <div class="modal-header">
          <h2>Partial Approval</h2>
          <button class="modal-close" onclick="window.Modals.closeConfirmDialog()">&times;</button>
        </div>

        <div class="modal-body">
          <div class="confirm-icon confirm-warning">⚠️</div>
          <div class="confirm-message">
            <p>This invoice is only partially allocated:</p>
            <div class="partial-approval-summary">
              <div><strong>Invoice Total:</strong> ${window.Validation?.formatCurrency(invoiceAmount)}</div>
              <div><strong>Allocated:</strong> ${window.Validation?.formatCurrency(allocatedAmount)} (${pct}%)</div>
              <div><strong>Unallocated:</strong> ${window.Validation?.formatCurrency(difference)}</div>
            </div>
            <p style="margin-top: 12px;"><strong>A note is required for partial approvals:</strong></p>
            <textarea id="partialApprovalNote" class="partial-approval-note" rows="3"
              placeholder="Explain why this invoice is being partially approved..."></textarea>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="window.Modals.closeConfirmDialog()">Cancel</button>
          <button class="btn btn-success" onclick="window.Modals.submitPartialApproval()">Approve Partial</button>
        </div>
      </div>
    `;

    // Show as overlay on top of current modal (like showConfirmDialog)
    const overlay = document.createElement('div');
    overlay.id = 'confirm-overlay';
    overlay.innerHTML = modal;
    document.body.appendChild(overlay);
    console.log('[PARTIAL] Overlay added to DOM');
    console.log('[PARTIAL] Overlay element:', document.getElementById('confirm-overlay'));
    console.log('[PARTIAL] Textarea element:', document.getElementById('partialApprovalNote'));
  },

  /**
   * Submit partial approval with note
   */
  async submitPartialApproval() {
    console.log('[PARTIAL] submitPartialApproval called');
    const noteEl = document.getElementById('partialApprovalNote');
    console.log('[PARTIAL] noteEl:', noteEl);
    const note = noteEl?.value?.trim();
    console.log('[PARTIAL] note value:', note);

    if (!note) {
      console.log('[PARTIAL] No note provided, showing error');
      window.toasts?.error('A note is required for partial approvals');
      noteEl?.focus();
      return;
    }

    console.log('[PARTIAL] Note provided, closing dialog and proceeding');
    this.closeConfirmDialog();

    // Add partial approval note to the invoice notes
    const allocations = this.currentAllocations || [];
    const totalAllocated = allocations.reduce((sum, a) => sum + parseFloat(a.amount || 0), 0);
    const invoiceAmount = parseFloat(this.currentInvoice?.amount || 0);
    const pct = Math.round((totalAllocated / invoiceAmount) * 100);

    const partialNote = `[PARTIAL APPROVAL - ${pct}%] ${note}`;

    await this.saveWithStatus('approved', 'Invoice partially approved', {
      partial_approval_note: partialNote,
      partial_amount: totalAllocated
    });
  },

  /**
   * Unapprove (revert to needs_approval)
   */
  async unapproveInvoice() {
    this.showConfirmDialog({
      title: 'Unapprove Invoice',
      message: 'Are you sure you want to unapprove this invoice? It will return to "Needs Approval" status.',
      confirmText: 'Unapprove',
      type: 'warning',
      onConfirm: async () => {
        await this.saveWithStatus('needs_approval', 'Invoice unapproved');
      }
    });
  },

  /**
   * Add invoice to draw
   */
  async addToDraw() {
    if (!this.currentInvoice?.job_id) {
      window.toasts?.error('Invoice must have a job assigned');
      return;
    }

    // Fetch available draws for this job
    try {
      const res = await fetch(`/api/jobs/${this.currentInvoice.job_id}/draws`);
      const draws = await res.json();
      const draftDraws = draws.filter(d => d.status === 'draft');

      this.showDrawPickerModal(draftDraws);
    } catch (err) {
      console.error('Error fetching draws:', err);
      window.toasts?.error('Failed to load draws');
    }
  },

  showDrawPickerModal(draftDraws) {
    const drawOptions = draftDraws.map(d =>
      `<option value="${d.id}">Draw #${d.draw_number} - ${d.period_end || 'No date'} (${d.invoices?.length || 0} invoices)</option>`
    ).join('');

    const modal = `
      <div class="draw-picker-modal" id="draw-picker-overlay" style="
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.7);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10001;
      ">
        <div style="
          background: var(--bg-card, #161b22);
          padding: 1.5rem;
          border-radius: 8px;
          min-width: 400px;
          border: 1px solid var(--border, #30363d);
        ">
          <h3 style="margin-bottom: 1rem; color: var(--text-primary, #f0f6fc);">Add to Draw</h3>
          <p style="color: var(--text-secondary, #8b949e); margin-bottom: 1rem;">
            Select a draw or create a new one for invoice #${this.currentInvoice?.invoice_number || 'N/A'}
          </p>

          <div style="margin-bottom: 1rem;">
            <label style="display: block; margin-bottom: 0.5rem; color: var(--text-secondary);">Select Draw</label>
            <select id="drawPickerSelect" style="
              width: 100%;
              padding: 0.75rem;
              background: var(--bg-card-elevated, #1c2128);
              border: 1px solid var(--border, #30363d);
              border-radius: 6px;
              color: var(--text-primary, #f0f6fc);
            ">
              <option value="">-- Select existing draw --</option>
              ${drawOptions}
              <option value="new">+ Create New Draw</option>
            </select>
          </div>

          <div id="newDrawFields" style="display: none; margin-bottom: 1rem;">
            <label style="display: block; margin-bottom: 0.5rem; color: var(--text-secondary);">Period End Date</label>
            <input type="date" id="newDrawPeriodEnd" style="
              width: 100%;
              padding: 0.75rem;
              background: var(--bg-card-elevated, #1c2128);
              border: 1px solid var(--border, #30363d);
              border-radius: 6px;
              color: var(--text-primary, #f0f6fc);
            " value="${new Date().toISOString().split('T')[0]}">
          </div>

          <div style="display: flex; gap: 0.75rem; justify-content: flex-end;">
            <button onclick="Modals.closeDrawPicker()" class="btn btn-secondary">Cancel</button>
            <button onclick="Modals.confirmAddToDraw()" class="btn btn-primary">Add to Draw</button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modal);

    // Toggle new draw fields
    document.getElementById('drawPickerSelect').addEventListener('change', (e) => {
      document.getElementById('newDrawFields').style.display = e.target.value === 'new' ? 'block' : 'none';
    });
  },

  closeDrawPicker() {
    const overlay = document.getElementById('draw-picker-overlay');
    if (overlay) overlay.remove();
  },

  async confirmAddToDraw() {
    const select = document.getElementById('drawPickerSelect');
    const selectedValue = select?.value;

    if (!selectedValue) {
      window.toasts?.error('Please select a draw');
      return;
    }

    try {
      let drawId = selectedValue;

      // Create new draw if selected
      if (selectedValue === 'new') {
        const periodEnd = document.getElementById('newDrawPeriodEnd')?.value;
        const res = await fetch(`/api/jobs/${this.currentInvoice.job_id}/draws`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ period_end: periodEnd })
        });
        if (!res.ok) throw new Error('Failed to create draw');
        const newDraw = await res.json();
        drawId = newDraw.id;
      }

      // Add invoice to draw
      const addRes = await fetch(`/api/draws/${drawId}/add-invoices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoice_ids: [this.currentInvoice.id] })
      });

      if (!addRes.ok) {
        const err = await addRes.json();
        throw new Error(err.error || 'Failed to add to draw');
      }

      this.closeDrawPicker();
      window.toasts?.success('Invoice added to draw');
      this.closeActiveModal();
      if (typeof loadInvoices === 'function') loadInvoices();
    } catch (err) {
      console.error('Error adding to draw:', err);
      window.toasts?.error(err.message);
    }
  },

  /**
   * Remove invoice from draw
   */
  async removeFromDraw() {
    if (!this.currentInvoice?.draw_id) {
      window.toasts?.error('Invoice is not in a draw');
      return;
    }

    this.showConfirmDialog({
      title: 'Remove from Draw',
      message: 'Are you sure you want to remove this invoice from the draw?',
      confirmText: 'Remove',
      type: 'warning',
      onConfirm: async () => {
        try {
          const response = await fetch(`/api/draws/${this.currentInvoice.draw_id}/remove-invoice`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              invoice_id: this.currentInvoice.id,
              performed_by: 'Jake Ross'
            })
          });

          if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Failed to remove from draw');
          }

          window.toasts?.success('Invoice removed from draw');
          this.closeActiveModal();
          if (typeof loadInvoices === 'function') loadInvoices();
        } catch (err) {
          console.error('Error removing from draw:', err);
          window.toasts?.error(err.message);
        }
      }
    });
  },

  /**
   * Show close-out dialog for partial invoices
   */
  showCloseOutDialog() {
    if (!this.currentInvoice?.id) {
      window.toasts?.error('No invoice selected');
      return;
    }

    const invoiceAmount = parseFloat(this.currentInvoice.amount || 0);
    const paidAmount = parseFloat(this.currentInvoice.paid_amount || 0);
    const writeOffAmount = invoiceAmount - paidAmount;

    const closeOutReasons = [
      'Work descoped / reduced scope',
      'Vendor credit issued',
      'Dispute resolved / settlement',
      'Change order adjustment',
      'Billing error corrected',
      'Other'
    ];

    const modal = `
      <div class="modal modal-medium close-out-modal">
        <div class="modal-header">
          <h2>Close Out Invoice</h2>
          <button class="modal-close" onclick="Modals.closeCloseOutDialog()">&times;</button>
        </div>

        <div class="modal-body">
          <div class="close-out-summary">
            <div class="close-out-row">
              <span class="close-out-label">Invoice Total:</span>
              <span class="close-out-value">${window.Validation?.formatCurrency(invoiceAmount)}</span>
            </div>
            <div class="close-out-row">
              <span class="close-out-label">Already Paid:</span>
              <span class="close-out-value">${window.Validation?.formatCurrency(paidAmount)}</span>
            </div>
            <div class="close-out-row highlight">
              <span class="close-out-label">Write-off Amount:</span>
              <span class="close-out-value write-off">${window.Validation?.formatCurrency(writeOffAmount)}</span>
            </div>
          </div>

          <div class="form-group">
            <label for="close-out-reason">Reason for closing out: <span class="required">*</span></label>
            <select id="close-out-reason" class="form-select" onchange="Modals.handleCloseOutReasonChange(this.value)">
              <option value="">Select reason...</option>
              ${closeOutReasons.map(r => `<option value="${r}">${r}</option>`).join('')}
            </select>
          </div>

          <div class="form-group" id="close-out-notes-group">
            <label for="close-out-notes">Additional Notes: <span id="notes-required" style="display: none;" class="required">*</span></label>
            <textarea id="close-out-notes" class="form-textarea" rows="3" placeholder="Enter any additional notes..."></textarea>
          </div>

          <div class="close-out-warning">
            <span class="warning-icon">⚠️</span>
            <span>This will write off the remaining ${window.Validation?.formatCurrency(writeOffAmount)}. It will not be billed to the client.</span>
          </div>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" onclick="Modals.closeCloseOutDialog()">
            Cancel
          </button>
          <button type="button" class="btn btn-warning" onclick="Modals.executeCloseOut()">
            Close Out Invoice
          </button>
        </div>
      </div>
    `;

    // Show as overlay on top of current modal
    const overlay = document.createElement('div');
    overlay.id = 'close-out-overlay';
    overlay.className = 'modal-backdrop';
    overlay.innerHTML = modal;
    document.body.appendChild(overlay);
  },

  /**
   * Handle close-out reason change (show notes as required for "Other")
   */
  handleCloseOutReasonChange(reason) {
    const notesRequired = document.getElementById('notes-required');
    if (notesRequired) {
      notesRequired.style.display = reason === 'Other' ? 'inline' : 'none';
    }
  },

  /**
   * Close the close-out dialog
   */
  closeCloseOutDialog() {
    const overlay = document.getElementById('close-out-overlay');
    if (overlay) overlay.remove();
  },

  /**
   * Execute the close-out action
   */
  async executeCloseOut() {
    const reason = document.getElementById('close-out-reason')?.value;
    const notes = document.getElementById('close-out-notes')?.value?.trim();

    // Validate
    if (!reason) {
      window.toasts?.error('Please select a reason for closing out');
      return;
    }

    if (reason === 'Other' && !notes) {
      window.toasts?.error('Notes are required when reason is "Other"');
      return;
    }

    try {
      const loadingToast = window.toasts?.showLoading('Closing out invoice...');

      const response = await fetch(`/api/invoices/${this.currentInvoice.id}/close-out`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          closed_out_by: window.currentUser || 'Jake Ross',
          reason,
          notes: notes || null
        })
      });

      window.toasts?.dismiss(loadingToast);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to close out invoice');
      }

      const result = await response.json();

      window.toasts?.success('Invoice closed out successfully');
      this.closeCloseOutDialog();
      this.isDirty = false;

      if (this.onSaveCallback) {
        this.onSaveCallback(result);
      }

      this.closeActiveModal();
      if (typeof loadInvoices === 'function') loadInvoices();
    } catch (err) {
      console.error('Close out failed:', err);
      window.toasts?.error('Close out failed', { details: err.message });
    }
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

    // For 'needs_approval' status - need job and allocations
    if (targetStatus === 'needs_approval') {
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

      // Verify allocations don't exceed invoice amount (under-allocation is allowed for partial work)
      const totalAllocated = this.currentAllocations.reduce((sum, a) => sum + parseFloat(a.amount || 0), 0);
      if (totalAllocated > amount + 0.01) {
        errors.push('Allocations cannot exceed invoice amount');
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
      <div class="confirm-modal">
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
   * Get the original AI value for a field
   */
  getOriginalAiValue(fieldName) {
    const aiData = this.currentInvoice?.ai_extracted_data || {};
    const invoice = this.currentInvoice || {};

    switch (fieldName) {
      case 'invoice_number': return aiData.parsed_invoice_number || invoice.invoice_number;
      case 'amount': return aiData.parsed_amount || invoice.amount;
      case 'invoice_date': return aiData.parsed_date || invoice.invoice_date;
      case 'job_id': return invoice.job_id;
      case 'vendor_id': return invoice.vendor_id;
      case 'po_id': return invoice.po_id;
      default: return null;
    }
  },

  /**
   * Mark a field as manually overridden (or restore if matching AI value)
   */
  markFieldOverridden(fieldName) {
    // Track which fields have been overridden in this session
    if (!this.overriddenFields) {
      this.overriddenFields = new Set();
    }

    // Find and update the AI badge
    const fieldMap = {
      'invoice_number': 'edit-invoice-number',
      'amount': 'edit-amount',
      'invoice_date': 'edit-invoice-date',
      'job_id': 'edit-job',
      'vendor_id': 'edit-vendor',
      'po_id': 'edit-po'
    };

    const inputId = fieldMap[fieldName];
    if (!inputId) return;

    const input = document.getElementById(inputId);
    if (!input) return;

    // Get current value and original AI value
    let currentValue = input.value;
    let originalAiValue = this.getOriginalAiValue(fieldName);

    // Normalize for comparison
    if (fieldName === 'amount') {
      currentValue = window.Validation?.parseCurrency(currentValue) || 0;
      originalAiValue = parseFloat(originalAiValue) || 0;
    }

    const matchesAi = String(currentValue) === String(originalAiValue);

    const label = input.closest('.form-group')?.querySelector('label');
    if (label) {
      const aiBadge = label.querySelector('.ai-badge');
      if (aiBadge) {
        if (matchesAi) {
          // Restore AI badge - value matches original
          aiBadge.classList.remove('overridden');
          aiBadge.title = aiBadge.dataset.originalTitle || 'AI-extracted. Edit to override.';
          this.overriddenFields.delete(fieldName);
        } else {
          // Mark as overridden - value differs from AI
          if (!aiBadge.dataset.originalTitle) {
            aiBadge.dataset.originalTitle = aiBadge.title;
          }
          aiBadge.classList.add('overridden');
          aiBadge.title = 'AI suggestion overridden by user';

          // Only send feedback if newly overridden
          if (!this.overriddenFields.has(fieldName)) {
            this.overriddenFields.add(fieldName);
            this.sendAiFeedback(fieldName);
          }
        }
      }
    }
  },

  /**
   * Send AI feedback to server for learning
   */
  async sendAiFeedback(fieldName) {
    if (!this.currentInvoice?.id) return;

    // Get the original AI value and new user value
    const aiData = this.currentInvoice.ai_extracted_data || {};
    const fieldMap = {
      'invoice_number': { aiKey: 'parsed_invoice_number', formId: 'edit-invoice-number' },
      'amount': { aiKey: 'parsed_amount', formId: 'edit-amount' },
      'invoice_date': { aiKey: 'parsed_date', formId: 'edit-invoice-date' },
      'job_id': { aiKey: 'job_id', formId: 'edit-job' },
      'vendor_id': { aiKey: 'vendor_id', formId: 'edit-vendor' },
      'po_id': { aiKey: 'po_id', formId: 'edit-po' }
    };

    const mapping = fieldMap[fieldName];
    if (!mapping) return;

    const aiValue = fieldName === 'job_id'
      ? (this.currentInvoice.job_id || aiData.parsed_address)
      : fieldName === 'vendor_id'
        ? (this.currentInvoice.vendor_id || aiData.parsed_vendor_name)
        : fieldName === 'po_id'
          ? this.currentInvoice.po_id
          : aiData[mapping.aiKey];

    const userValue = document.getElementById(mapping.formId)?.value;

    // Only send feedback if values are actually different
    if (aiValue === userValue) return;

    try {
      await fetch('/api/ai/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoice_id: this.currentInvoice.id,
          field_name: fieldName,
          ai_value: aiValue,
          user_value: userValue,
          corrected_by: window.currentUser || 'unknown',
          vendor_name: this.currentInvoice.vendor?.name || aiData.parsed_vendor_name,
          context: {
            confidence: this.currentInvoice.ai_confidence?.[fieldName] || null,
            vendor_trade: aiData.parsed_trade_type
          }
        })
      });
      console.log(`[AI Feedback] Sent correction for ${fieldName}: "${aiValue}" → "${userValue}"`);
    } catch (err) {
      console.warn('[AI Feedback] Failed to send feedback:', err);
      // Don't show error to user - feedback is non-critical
    }
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
   * Populate dropdowns (jobs, vendors, POs) using searchable pickers
   */
  async populateDropdowns() {
    const isArchived = this.currentInvoice?.status === 'paid';

    try {
      // Initialize Job picker
      const jobContainer = document.getElementById('job-picker-container');
      if (jobContainer && window.SearchablePicker) {
        window.SearchablePicker.init(jobContainer, {
          type: 'jobs',
          value: this.currentInvoice?.job_id || null,
          placeholder: 'Search jobs...',
          disabled: isArchived,
          onChange: (jobId) => {
            document.getElementById('edit-job').value = jobId || '';
            this.handleJobChange(jobId);
          }
        });
        // Set initial value on hidden input
        document.getElementById('edit-job').value = this.currentInvoice?.job_id || '';
      }

      // Initialize Vendor picker
      const vendorContainer = document.getElementById('vendor-picker-container');
      if (vendorContainer && window.SearchablePicker) {
        window.SearchablePicker.init(vendorContainer, {
          type: 'vendors',
          value: this.currentInvoice?.vendor_id || null,
          placeholder: 'Search vendors...',
          disabled: isArchived,
          onChange: (vendorId) => {
            document.getElementById('edit-vendor').value = vendorId || '';
            this.markDirty();
          }
        });
        // Set initial value on hidden input
        document.getElementById('edit-vendor').value = this.currentInvoice?.vendor_id || '';
      }

      // Initialize PO picker
      const poContainer = document.getElementById('po-picker-container');
      if (poContainer && window.SearchablePicker) {
        window.SearchablePicker.init(poContainer, {
          type: 'pos',
          value: this.currentInvoice?.po_id || null,
          placeholder: 'Search purchase orders...',
          disabled: isArchived,
          jobId: this.currentInvoice?.job_id || null,
          onChange: (poId) => {
            document.getElementById('edit-po').value = poId || '';
            this.markDirty();
          }
        });
        // Set initial value on hidden input
        document.getElementById('edit-po').value = this.currentInvoice?.po_id || '';
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
   * Fetch all active jobs for allocation dropdowns
   */
  async fetchJobs() {
    try {
      const response = await fetch('/api/jobs?status=active');
      if (!response.ok) return [];
      return await response.json();
    } catch (err) {
      console.error('Failed to fetch jobs:', err);
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

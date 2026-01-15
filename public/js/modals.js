/**
 * Modal Management Module
 * Handles invoice edit modal, job selection modal, and other UI dialogs
 * LAST UPDATED: 2026-01-15 - Only use billed_amount for in_draw status
 */
console.log('[MODALS] Script loaded - version 2026-01-15d - BILLED AMOUNT FIX');

const Modals = {
  // Current state
  activeModal: null,
  lockId: null,
  currentInvoice: null,
  currentAllocations: [],
  currentPOLineItems: [],  // PO line items for linking allocations
  cachedPurchaseOrders: [], // All available POs for the job
  cachedChangeOrders: [],   // All available COs for the job
  isDirty: false,
  isEditMode: false,  // Start in view mode, click Edit to enable editing
  activeLinkPicker: null, // Currently open link picker popover index

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
      this.isEditMode = false;  // Start in view mode
      this.activeLinkPicker = null;  // Close any open link pickers

      // Fetch allocations, activity, approval context, and PO line items
      const [allocations, activity, approvalContext] = await Promise.all([
        this.fetchAllocations(invoiceId),
        this.fetchActivity(invoiceId),
        this.fetchApprovalContext(invoiceId)
      ]);
      // Fetch PO line items if invoice has a PO (for backward compatibility)
      if (invoice.po_id) {
        await this.fetchPOLineItems(invoice.po_id);
      } else {
        this.currentPOLineItems = [];
      }

      // Fetch all funding sources (POs and COs) for the job
      if (invoice.job_id) {
        await this.fetchFundingSources(invoice.job_id);
      } else {
        this.cachedPurchaseOrders = [];
        this.cachedChangeOrders = [];
      }

      // Initialize with one empty allocation if none exist
      // This ensures the UI row has a backing data entry
      this.currentAllocations = allocations.length > 0
        ? allocations
        : [{ cost_code_id: null, amount: invoice.amount || 0, notes: '' }];
      this.currentActivity = activity;
      this.currentApprovalContext = approvalContext;

      // Build and show modal (use initialized allocations)
      const modal = this.buildEditModal(invoice, this.currentAllocations, activity, approvalContext);
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
   * Get stamp label for status
   */
  getStampLabel(status) {
    const labels = {
      'needs_review': 'NEEDS REVIEW',
      'ready_for_approval': 'READY FOR APPROVAL',
      'approved': 'APPROVED',
      'in_draw': 'IN DRAW',
      'paid': 'PAID',
      'denied': 'DENIED',
      'split': 'SPLIT PARENT'
    };
    return labels[status] || status.toUpperCase();
  },

  /**
   * Build split invoice info banner
   */
  buildSplitInfoBanner(invoice) {
    // Split parent - show children info
    if (invoice.is_split_parent) {
      return `
        <div class="split-info-banner split-parent">
          <div class="split-indicator">SPLIT</div>
          <div class="split-content">
            <strong>Split Parent Invoice</strong>
            <p>This invoice has been split into multiple parts. The children are processed independently.</p>
          </div>
        </div>
      `;
    }

    // Split child - show parent and sibling info
    if (invoice.parent_invoice_id) {
      return `
        <div class="split-info-banner split-child">
          <div class="split-indicator">SPLIT</div>
          <div class="split-content">
            <strong>Split Invoice</strong>
            <p>This is part of a split invoice. Amount: <strong>${window.Validation?.formatCurrency(invoice.amount)}</strong></p>
            <div class="split-actions">
              <button type="button" class="btn-link" onclick="window.Modals.viewParentInvoice('${invoice.parent_invoice_id}')">
                View Parent Invoice
              </button>
              <button type="button" class="btn-link" onclick="window.Modals.viewSplitSiblings('${invoice.parent_invoice_id}', '${invoice.id}')">
                View All Splits
              </button>
            </div>
          </div>
        </div>
      `;
    }

    return '';
  },

  /**
   * Toggle PDF view between original and stamped
   */
  togglePdfView() {
    const iframe = document.getElementById('pdf-viewer-iframe');
    const label = document.getElementById('pdf-toggle-label');
    if (!iframe) return;

    const stamped = iframe.dataset.stamped;
    const original = iframe.dataset.original;
    const currentSrc = iframe.src.split('?')[0]; // Remove cache buster

    // Toggle between views
    if (currentSrc.includes('_stamped') || iframe.dataset.viewing === 'stamped') {
      iframe.src = original;
      iframe.dataset.viewing = 'original';
      if (label) label.textContent = 'Viewing: Original';
    } else {
      iframe.src = stamped;
      iframe.dataset.viewing = 'stamped';
      if (label) label.textContent = 'Viewing: Stamped';
    }
  },

  /**
   * View parent invoice (for split children)
   */
  async viewParentInvoice(parentId) {
    this.closeActiveModal();
    setTimeout(() => {
      this.showEditModal(parentId);
    }, 300);
  },

  /**
   * View all split siblings
   */
  async viewSplitSiblings(parentId, currentId) {
    try {
      const response = await fetch(`/api/invoices/${parentId}/family`);
      if (!response.ok) throw new Error('Failed to fetch split family');
      const family = await response.json();

      // Show a simple list of siblings
      const siblings = family.children || [];
      if (siblings.length === 0) {
        window.toasts?.info('No other splits found');
        return;
      }

      const siblingList = siblings.map(s => `
        <div class="sibling-item ${s.id === currentId ? 'current' : ''}" onclick="window.Modals.viewSiblingInvoice('${s.id}')">
          <span class="sibling-amount">${window.Validation?.formatCurrency(s.amount)}</span>
          <span class="sibling-status status-badge status-${s.status}">${s.status}</span>
          ${s.id === currentId ? '<span class="current-marker">(current)</span>' : ''}
        </div>
      `).join('');

      // Show in a popover or simple modal
      window.toasts?.info(`Split Family: ${siblings.length} parts`, {
        details: `Parent: ${family.parent?.invoice_number || parentId}`
      });

    } catch (err) {
      console.error('Error fetching split siblings:', err);
      window.toasts?.error('Failed to load split family');
    }
  },

  /**
   * View a sibling invoice
   */
  async viewSiblingInvoice(invoiceId) {
    this.closeActiveModal();
    setTimeout(() => {
      this.showEditModal(invoiceId);
    }, 300);
  },

  /**
   * Build the edit modal HTML with PDF split-view
   */
  buildEditModal(invoice, allocations, activity = [], approvalContext = {}) {
    const statusInfo = window.Validation?.getStatusInfo(invoice.status) || {};
    const isArchived = invoice.status === 'paid';
    // Locked statuses require explicit unlock to edit
    const lockedStatuses = ['ready_for_approval', 'approved', 'in_draw', 'paid', 'needs_approval'];
    const isLockedStatus = lockedStatuses.includes(invoice.status);
    // Editable statuses - accountant can edit freely
    const editableStatuses = ['needs_review', 'received', 'denied'];
    const isEditableStatus = editableStatuses.includes(invoice.status);
    // Can edit if: editable status OR (locked status AND explicitly unlocked)
    const canEdit = !isArchived && (isEditableStatus || (isLockedStatus && this.isEditMode));
    // Store for use in field locking
    this.canEdit = canEdit;
    // Always show stamped PDF if available, fall back to original
    const pdfUrl = invoice.pdf_stamped_url || invoice.pdf_url;

    // Payment tracking info - use max of billed_amount and paid_amount
    const invoiceAmount = parseFloat(invoice.amount || 0);
    const billedAmount = parseFloat(invoice.billed_amount || 0);
    const paidAmount = parseFloat(invoice.paid_amount || 0);
    const alreadyProcessed = Math.max(billedAmount, paidAmount);
    const remainingAmount = invoiceAmount - alreadyProcessed;
    const hasPartialPayment = alreadyProcessed > 0 && remainingAmount > 0.01;
    const isClosedOut = !!invoice.closed_out_at;

    // Show read-only badge for locked statuses that haven't been unlocked
    const showReadOnlyBadge = isArchived || (isLockedStatus && !this.isEditMode);

    return `
      <div class="modal-backdrop">
        <div class="modal modal-fullscreen">
          <div class="modal-header">
            <div class="modal-title">
              <h2>${this.isEditMode ? 'Edit Invoice' : 'View Invoice'}</h2>
              <span class="status-badge status-${invoice.status}">${statusInfo.label || invoice.status}</span>
              ${showReadOnlyBadge ? '<span class="readonly-badge">Read Only</span>' : ''}
            </div>
            <button class="modal-close" onclick="window.Modals.closeActiveModal()">&times;</button>
          </div>

          <div class="modal-body modal-split-view">
            <!-- PDF Viewer (Left) -->
            <div class="pdf-panel">
              <div class="pdf-toolbar">
                <div class="pdf-toolbar-left">
                  ${invoice.pdf_stamped_url ? `
                    <span class="stamp-indicator stamp-${invoice.status}">
                      ${this.getStampLabel(invoice.status)}
                    </span>
                  ` : '<span class="stamp-indicator stamp-none">No Stamp</span>'}
                </div>
                <div class="pdf-toolbar-right">
                  ${invoice.pdf_url && invoice.pdf_stamped_url ? `
                    <button type="button" class="btn-pdf-toggle" onclick="window.Modals.togglePdfView()" title="Toggle between original and stamped PDF">
                      <span id="pdf-toggle-label">Viewing: Stamped</span>
                    </button>
                  ` : ''}
                </div>
              </div>
              ${pdfUrl ? `
                <iframe id="pdf-viewer-iframe" src="${pdfUrl}" class="pdf-iframe" data-stamped="${invoice.pdf_stamped_url || ''}" data-original="${invoice.pdf_url || ''}"></iframe>
              ` : `
                <div class="pdf-placeholder">
                  <div class="pdf-icon">📄</div>
                  <p>No PDF attached</p>
                </div>
              `}
            </div>

            <!-- Form Panel (Right) -->
            <div class="form-panel">
              ${this.buildSplitInfoBanner(invoice)}
              ${hasPartialPayment && invoice.status === 'ready_for_approval' ? `
              <div class="partial-billing-banner">
                <div class="banner-icon">⚠️</div>
                <div class="banner-content">
                  <strong>Partial Invoice - Remaining Balance</strong>
                  <p>This invoice has already been billed <strong>${window.Validation?.formatCurrency(alreadyProcessed)}</strong>.
                     Only <strong>${window.Validation?.formatCurrency(remainingAmount)}</strong> remains to be allocated and approved.</p>
                </div>
              </div>
              ` : ''}
              <form id="invoice-edit-form" onsubmit="return false;">
                <!-- Invoice Details Section -->
                <div class="form-section">
                    <h3>Invoice Details</h3>

                    <div class="form-group" data-field="invoice_number">
                      <label for="edit-invoice-number">Invoice Number * ${this.buildAiIndicator(invoice, 'invoice_number')}</label>
                      <input type="text" id="edit-invoice-number" name="invoice_number"
                        value="${this.escapeHtml(invoice.invoice_number || '')}"
                        ${!canEdit ? 'readonly' : ''}
                        onchange="Modals.markDirty(); Modals.markFieldOverridden('invoice_number')">
                      <div class="field-error" id="error-invoice_number"></div>
                    </div>

                    <div class="form-group" data-field="amount">
                      <label for="edit-amount">Amount * ${this.buildAiIndicator(invoice, 'amount')}</label>
                      <input type="text" id="edit-amount" name="amount"
                        value="${window.Validation?.formatCurrency(invoice.amount) || ''}"
                        ${!canEdit ? 'readonly' : ''}
                        oninput="Modals.handleAmountChange(this); Modals.markFieldOverridden('amount')">
                      <div class="field-error" id="error-amount"></div>
                    </div>

                    <div class="form-row">
                      <div class="form-group" data-field="invoice_date">
                        <label for="edit-invoice-date">Invoice Date * ${this.buildAiIndicator(invoice, 'invoice_date')}</label>
                        <input type="date" id="edit-invoice-date" name="invoice_date"
                          value="${invoice.invoice_date || ''}"
                          ${!canEdit ? 'readonly' : ''}
                          onchange="Modals.markDirty(); Modals.markFieldOverridden('invoice_date')">
                        <div class="field-error" id="error-invoice_date"></div>
                      </div>

                      <div class="form-group" data-field="due_date">
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

                    <div class="form-group picker-group">
                      <label for="edit-job">Job ${this.buildAiIndicator(invoice, 'job_id')}</label>
                      <div id="job-picker-container" class="search-picker-container"></div>
                      <input type="hidden" id="edit-job" name="job_id">
                      <div class="field-error" id="error-job_id"></div>
                    </div>

                    <div class="form-group picker-group">
                      <label for="edit-vendor">Vendor ${this.buildAiIndicator(invoice, 'vendor_id')}</label>
                      <div id="vendor-picker-container" class="search-picker-container"></div>
                      <input type="hidden" id="edit-vendor" name="vendor_id">
                      <div class="field-error" id="error-vendor_id"></div>
                    </div>

                  </div>

                  <div class="form-section">
                    <div class="section-header">
                      <h3>Line Items</h3>
                      ${canEdit ? `
                        <div class="section-header-actions" id="line-items-actions">
                          <button type="button" class="btn-add-line" onclick="window.Modals.addAllocation()">
                            + Add Line
                          </button>
                        </div>
                      ` : ''}
                    </div>
                    <div id="allocations-container" class="line-items-container">
                      ${this.buildAllocationsHtml(allocations, hasPartialPayment ? remainingAmount : invoice.amount, !canEdit)}
                    </div>
                    <div class="allocation-summary" id="allocation-summary">
                      ${this.buildAllocationSummary(allocations, hasPartialPayment ? remainingAmount : invoice.amount)}
                    </div>
                  </div>

                  ${this.buildApprovalImpactSection(approvalContext, invoice.status)}

                  ${hasPartialPayment || isClosedOut ? `
                  <div class="form-section payment-info-section">
                    <h3>Payment Status</h3>
                    <div class="payment-info-card ${isClosedOut ? 'closed-out' : 'partial'}">
                      <div class="payment-info-row">
                        <span class="payment-label">Invoice Total:</span>
                        <span class="payment-value">${window.Validation?.formatCurrency(invoiceAmount)}</span>
                      </div>
                      ${billedAmount > 0 ? `
                      <div class="payment-info-row">
                        <span class="payment-label">Amount Billed:</span>
                        <span class="payment-value billed">${window.Validation?.formatCurrency(billedAmount)}</span>
                      </div>
                      ` : ''}
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

                  ${['approved', 'in_draw', 'paid'].includes(invoice.status) ? `
                  <div class="form-section vendor-payment-section">
                    <h3>Vendor Payment</h3>
                    <div class="vendor-payment-toggle">
                      <label class="checkbox-label">
                        <input type="checkbox" id="paid-to-vendor"
                          ${invoice.paid_to_vendor ? 'checked' : ''}
                          onchange="Modals.togglePaidToVendor(this.checked)">
                        <span class="checkbox-text">Paid to Vendor</span>
                      </label>
                    </div>
                    <div class="vendor-payment-details" id="vendor-payment-details" style="${invoice.paid_to_vendor ? '' : 'display: none;'}">
                      <div class="form-row">
                        <div class="form-group">
                          <label>Payment Date</label>
                          <input type="date" id="paid-to-vendor-date"
                            value="${invoice.paid_to_vendor_date || ''}"
                            onchange="Modals.markDirty()">
                        </div>
                        <div class="form-group">
                          <label>Reference #</label>
                          <input type="text" id="paid-to-vendor-ref"
                            value="${this.escapeHtml(invoice.paid_to_vendor_ref || '')}"
                            placeholder="Check #, Transaction ID"
                            onchange="Modals.markDirty()">
                        </div>
                      </div>
                    </div>
                  </div>
                  ` : ''}

                  <div class="form-section activity-section">
                    <div class="section-header">
                      <h3>Activity</h3>
                      <button type="button" class="btn-link" onclick="window.Modals.toggleActivityExpand()">
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
                    ${canEdit ? `
                      <div class="add-note-box">
                        <input type="text" id="edit-notes" name="notes"
                          placeholder="Add a note..."
                          onchange="Modals.markDirty()">
                      </div>
                    ` : ''}
                  </div>

                  ${invoice.needs_review ? `
                    <div class="form-section review-flags">
                      <div class="review-flags-header">
                        <h3>⚠️ Review Required</h3>
                        <button type="button" class="btn btn-sm btn-secondary" onclick="window.Modals.clearReviewFlags('${invoice.id}')">Clear Flags</button>
                      </div>
                      <ul>
                        ${(invoice.review_flags || []).map(f => `<li>${this.getReviewFlagLabel(f)}</li>`).join('')}
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
   * Build allocations HTML - Simplified line items with inline link picker
   * @param {Array} allocations - The allocations to render
   * @param {number} invoiceAmount - Invoice amount for validation
   * @param {boolean} isReadOnly - If true, fields are not editable
   */
  buildAllocationsHtml(allocations, invoiceAmount, isReadOnly = false) {
    // Get cost code confidence from AI data if available
    const costCodeConfidence = this.currentInvoice?.ai_confidence?.costCode || 0;
    const canEdit = !isReadOnly;
    const hasPOs = (this.cachedPurchaseOrders || []).length > 0;
    const hasCOs = (this.cachedChangeOrders || []).length > 0;
    const hasFundingSources = hasPOs || hasCOs;

    const buildLineItem = (alloc, index) => {
      // Check if this specific allocation is AI-suggested
      const allocIsAi = alloc.notes?.includes('Auto-suggested') || alloc.notes?.includes('trade type');
      const confidencePct = Math.round(costCodeConfidence * 100);
      const confidenceClass = this.getConfidenceClass(costCodeConfidence);
      const icon = confidencePct >= 90 ? '✓' : confidencePct >= 70 ? '◐' : '?';
      const aiBadge = allocIsAi && confidencePct > 0 ? `<span class="ai-badge ${confidenceClass}" title="AI-suggested based on vendor trade type (${confidencePct}% confidence)"><span class="ai-badge-icon">${icon}</span><span class="ai-badge-score">${confidencePct}%</span><span class="ai-badge-label">AI</span></span>` : '';

      // Get linked funding display
      const linkDisplay = this.getLinkDisplay(alloc);
      const isAiLinked = alloc._aiLinked || false;

      return `
        <div class="line-item" data-index="${index}">
          <div class="line-item-header">
            <div class="line-item-field flex-2">
              <label class="field-label">Cost code / Account <span class="required">*</span> ${aiBadge}</label>
              <div class="cc-picker-container" data-index="${index}" data-readonly="${isReadOnly}"></div>
            </div>
            <div class="line-item-field amount-field">
              <label class="field-label">Amount <span class="required">*</span></label>
              <div class="amount-input-group ${isReadOnly ? 'locked' : ''}">
                <span class="amount-prefix">$</span>
                <input type="text" class="field-input amount-input" placeholder="0.00"
                  value="${this.formatAmountInput(alloc.amount)}"
                  oninput="Modals.updateAllocation(${index}, 'amount', this.value)"
                  ${isReadOnly ? 'readonly' : ''}>
                ${!isReadOnly ? `<button type="button" class="btn-fill-remaining" onclick="window.Modals.fillRemaining(${index})" title="Fill with remaining unallocated amount">Fill</button>` : ''}
              </div>
            </div>
            <div class="line-item-field linked-to-field">
              <label class="field-label">Linked To ${isAiLinked ? '<span class="ai-linked-badge" title="AI auto-matched">AI</span>' : ''}</label>
              <div class="linked-to-display">
                <span class="linked-to-text ${linkDisplay.type}">${linkDisplay.text}</span>
                ${canEdit && hasFundingSources ? `<button type="button" class="btn-change-link" onclick="window.Modals.showLinkPicker(${index}, event)" title="Change linked PO/CO">Link</button>` : ''}
              </div>
              <div class="link-picker-popover" id="link-picker-${index}" style="display: none;"></div>
            </div>
            ${canEdit && allocations.length > 1 ? `
              <button type="button" class="btn-delete-row" onclick="window.Modals.removeAllocation(${index})" title="Delete">
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
   * Get display text for allocation's linked funding source
   */
  getLinkDisplay(alloc) {
    const isCOCostCode = this.isCOCostCode(alloc.cost_code || alloc.cost_code_id);

    // Get PO info if linked
    let poInfo = null;
    if (alloc.po_id) {
      const po = (this.cachedPurchaseOrders || []).find(p => p.id === alloc.po_id);
      if (po) {
        poInfo = {
          number: po.po_number,
          remaining: parseFloat(po.remaining || 0)
        };
      }
    }

    // Get CO info if linked
    let coInfo = null;
    if (alloc.change_order_id) {
      const co = (this.cachedChangeOrders || []).find(c => c.id === alloc.change_order_id);
      if (co) {
        coInfo = {
          number: `CO-${String(co.change_order_number).padStart(3, '0')}`,
          remaining: parseFloat(co.remaining || 0)
        };
      }
    }

    // Both PO and CO linked (dual link)
    if (poInfo && coInfo) {
      return {
        type: 'dual',
        text: `${poInfo.number} → ${coInfo.number}`,
        poNumber: poInfo.number,
        coNumber: coInfo.number
      };
    }

    // Only PO linked
    if (poInfo) {
      // If CO cost code but no CO linked, show warning
      if (isCOCostCode) {
        return {
          type: 'po-needs-co',
          text: `${poInfo.number} (Needs CO)`,
          poNumber: poInfo.number
        };
      }
      return {
        type: 'po',
        text: `${poInfo.number} ($${poInfo.remaining.toLocaleString('en-US', {maximumFractionDigits: 0})} left)`
      };
    }

    // Only CO linked
    if (coInfo) {
      return {
        type: 'co',
        text: `${coInfo.number} ($${coInfo.remaining.toLocaleString('en-US', {maximumFractionDigits: 0})} left)`
      };
    }

    // No links - check if CO cost code needs linking
    if (isCOCostCode) {
      return {
        type: 'needs-co',
        text: 'Needs CO Link'
      };
    }

    // No link - base budget
    return {
      type: 'base',
      text: 'No PO/CO'
    };
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
   * Get remaining amount for a PO line item
   */
  getPOLineRemaining(poLineItemId) {
    if (!poLineItemId) return '';
    const li = this.currentPOLineItems.find(l => l.id === poLineItemId);
    if (!li) return '';
    const budgeted = parseFloat(li.amount) || 0;
    const invoiced = parseFloat(li.invoiced_amount) || 0;
    const remaining = budgeted - invoiced;
    const pct = budgeted > 0 ? Math.round((invoiced / budgeted) * 100) : 0;
    return `<span class="po-line-stats">Remaining: ${remaining.toLocaleString(undefined, {minimumFractionDigits: 2})} (${pct}% billed)</span>`;
  },

  /**
   * Build allocation summary with progress bar, quick actions, and warnings
   */
  buildAllocationSummary(allocations, invoiceAmount) {
    const allAllocations = allocations || [];
    const total = allAllocations.reduce((sum, a) => sum + parseFloat(a.amount || 0), 0);
    const amount = parseFloat(invoiceAmount || 0);
    const diff = amount - total;
    const balanced = Math.abs(diff) < 0.01;
    const isOver = diff < -0.01;
    const isUnder = diff > 0.01;
    const hasAllocations = allAllocations.length > 0;

    // Calculate percentage for progress bar
    const percentage = amount > 0 ? Math.min((total / amount) * 100, 100) : 0;

    // Determine status
    let statusClass = 'pending';
    let statusIcon = '○';
    let statusText = 'No allocations';
    if (balanced) {
      statusClass = 'balanced';
      statusIcon = '✓';
      statusText = 'Fully allocated';
    } else if (isOver) {
      statusClass = 'over';
      statusIcon = '✗';
      statusText = 'Over-allocated';
    } else if (hasAllocations && total > 0) {
      statusClass = 'partial';
      statusIcon = '◐';
      statusText = 'Partial';
    }

    // Check if we're in read-only mode
    const isReadOnly = this.currentInvoice?.status === 'paid' ||
      (['ready_for_approval', 'approved', 'in_draw', 'needs_approval'].includes(this.currentInvoice?.status) && !this.isEditMode);

    return `
      <div class="allocation-summary-card ${statusClass}">
        <div class="summary-header">
          <span class="status-indicator ${statusClass}">${statusIcon} ${statusText}</span>
          ${!isReadOnly && hasAllocations && allAllocations.length > 1 ? `
            <button type="button" class="btn btn-xs btn-outline" onclick="window.Modals.splitEvenly()" title="Divide total evenly across all lines">
              ⚖ Split Evenly
            </button>
          ` : ''}
        </div>
        <div class="summary-progress-row">
          <div class="progress-bar-wrap">
            <div class="progress-bar">
              <div class="progress-fill ${statusClass}" style="width: ${percentage}%"></div>
            </div>
          </div>
          <span class="progress-amount">${window.Validation?.formatCurrency(total)} / ${window.Validation?.formatCurrency(amount)}</span>
        </div>
        ${isUnder ? `
          <div class="allocation-warning">
            ⚠️ ${window.Validation?.formatCurrency(diff)} unallocated — will be partial approval
          </div>
        ` : ''}
        ${isOver ? `
          <div class="allocation-error">
            ✗ Over by ${window.Validation?.formatCurrency(Math.abs(diff))} — reduce to approve
          </div>
        ` : ''}
      </div>
    `;
  },

  /**
   * Build PO Balance section - shows impact on linked Purchase Order
   */
  buildPOBalanceSection(approvalContext) {
    if (!approvalContext?.po) return '';

    const po = approvalContext.po;
    const isOver = po.over_po;

    return `
      <div class="form-section po-balance-section">
        <h3>PO Balance</h3>
        <table class="budget-table po-table">
          <thead>
            <tr>
              <th>Purchase Order</th>
              <th class="num">PO Total</th>
              <th class="num">Billed</th>
              <th class="num">This Inv</th>
              <th class="num">Remaining</th>
            </tr>
          </thead>
          <tbody>
            <tr class="${isOver ? 'over-budget' : ''}" data-po-id="${po.id || ''}">
              <td>
                <span class="code">${po.po_number}</span>
                ${isOver ? '<span class="over-badge-inline">OVER</span>' : ''}
              </td>
              <td class="num po-total">${this.formatCurrency(po.total_amount)}</td>
              <td class="num po-prev-billed">${this.formatCurrency(po.previously_billed)}</td>
              <td class="num this-inv">${this.formatCurrency(po.this_invoice)}</td>
              <td class="num po-remaining ${isOver ? 'over' : ''}">${isOver ? '(' + this.formatCurrency(Math.abs(po.remaining)) + ')' : this.formatCurrency(po.remaining)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
  },

  /**
   * Build CO Standing section - shows impact on linked Change Order
   */
  buildCOStandingSection(approvalContext) {
    if (!approvalContext?.change_order) return '';

    const co = approvalContext.change_order;
    const isOver = co.over_co;

    return `
      <div class="form-section co-standing-section">
        <h3>Change Order Standing</h3>
        <table class="budget-table co-table">
          <thead>
            <tr>
              <th>Change Order</th>
              <th class="num">CO Total</th>
              <th class="num">Billed</th>
              <th class="num">This Inv</th>
              <th class="num">Remaining</th>
            </tr>
          </thead>
          <tbody>
            <tr class="${isOver ? 'over-budget' : ''}" data-co-id="${co.id || ''}">
              <td>
                <span class="code">CO #${co.change_order_number}</span>
                <span class="name">${co.title || ''}</span>
                ${isOver ? '<span class="over-badge-inline">OVER</span>' : ''}
              </td>
              <td class="num co-total">${this.formatCurrency(co.total_amount)}</td>
              <td class="num co-prev-billed">${this.formatCurrency(co.previously_billed)}</td>
              <td class="num this-inv">${this.formatCurrency(co.this_invoice)}</td>
              <td class="num co-remaining ${isOver ? 'over' : ''}">${isOver ? '(' + this.formatCurrency(Math.abs(co.remaining)) + ')' : this.formatCurrency(co.remaining)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
  },

  /**
   * Build Budget Standing section - shows impact on cost code budgets
   */
  buildBudgetStandingSection(approvalContext) {
    if (!approvalContext?.budget?.length) return '';

    return `
      <div class="form-section budget-standing-section">
        <h3>Budget Standing</h3>
        <table class="budget-table">
          <thead>
            <tr>
              <th>Cost Code</th>
              <th class="num">Budget</th>
              <th class="num">Billed</th>
              <th class="num">This Inv</th>
              <th class="num">Remaining</th>
            </tr>
          </thead>
          <tbody>
            ${approvalContext.budget.map(b => {
              const isOver = b.over_budget;
              return `
              <tr class="${isOver ? 'over-budget' : ''}" data-cost-code-id="${b.cost_code?.id || ''}">
                <td>
                  <span class="code">${b.cost_code?.code || ''}</span>
                  <span class="name">${b.cost_code?.name || ''}</span>
                </td>
                <td class="num budget-amt">${this.formatCurrency(b.budgeted)}</td>
                <td class="num prev-billed">${this.formatCurrency(b.previously_billed)}</td>
                <td class="num this-inv">${this.formatCurrency(b.this_invoice)}</td>
                <td class="num remaining ${isOver ? 'over' : ''}">${isOver ? '(' + this.formatCurrency(Math.abs(b.remaining)) + ')' : this.formatCurrency(b.remaining)}</td>
              </tr>
            `}).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  /**
   * Build approval impact sections (PO Balance + CO Standing + Budget Standing)
   */
  buildApprovalImpactSection(approvalContext, status) {
    if (!approvalContext) return '';

    let html = '';

    // PO Balance section
    html += this.buildPOBalanceSection(approvalContext);

    // CO Standing section (only when PO is linked to a CO)
    html += this.buildCOStandingSection(approvalContext);

    // Budget Standing section
    html += this.buildBudgetStandingSection(approvalContext);

    return html;
  },

  /**
   * Format currency helper
   */
  formatCurrency(amount) {
    if (amount === null || amount === undefined) return '$0';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
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
   * Toggle paid to vendor checkbox and show/hide details
   */
  togglePaidToVendor(checked) {
    const details = document.getElementById('vendor-payment-details');
    if (details) {
      details.style.display = checked ? '' : 'none';
      // Auto-fill today's date if checking and no date set
      if (checked) {
        const dateInput = document.getElementById('paid-to-vendor-date');
        if (dateInput && !dateInput.value) {
          dateInput.value = new Date().toISOString().split('T')[0];
        }
      }
    }
    this.markDirty();
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

    // Process activity log - show all meaningful events
    if (activity && activity.length) {
      // All action types we want to display (expanded list)
      const importantActions = [
        // Core workflow
        'uploaded', 'needs_review', 'ready_for_approval', 'needs_approval',
        'approved', 'denied', 'sent_back',
        // Payment & Draw
        'paid', 'paid_to_vendor', 'unpaid', 'partial_payment',
        'added_to_draw', 'removed_from_draw', 'partial_billed', 'partial_approval',
        'closed_out',
        // Split operations
        'split', 'unsplit', 'created_from_split', 'deleted_unsplit',
        // Edits & AI
        'ai_override', 'co_auto_linked', 'full_edit',
        // Other
        'note', 'deleted'
      ];

      activity.forEach(a => {
        const action = a.action || 'note';

        // Skip minor "edited" entries unless they have notes
        if (action === 'edited' && !a.notes) return;

        // Skip "uploaded" if we already have "created"
        if (action === 'uploaded' && invoice.created_at) return;

        // Skip actions we don't care about
        if (!importantActions.includes(action) && action !== 'edited') return;

        // Extract detail from various sources
        let detail = null;

        // Check for reason (sent_back, denied)
        if (a.details?.reason) {
          detail = a.details.reason;
        } else if (a.notes && typeof a.notes === 'string') {
          detail = a.notes;
        }

        // Add context for specific actions
        if (action === 'added_to_draw' && a.details?.draw_number) {
          detail = `Draw #${a.details.draw_number}`;
        } else if (action === 'removed_from_draw' && a.details?.draw_number) {
          detail = `Removed from Draw #${a.details.draw_number}`;
        } else if (action === 'split' && a.details?.split_count) {
          detail = `Split into ${a.details.split_count} invoices`;
        } else if (action === 'co_auto_linked' && a.details?.change_order_id) {
          detail = 'Linked to Change Order via PO';
        } else if (action === 'partial_billed' && a.details?.amount) {
          detail = `Amount: $${Number(a.details.amount).toLocaleString()}`;
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

      // Skip if same type, same user, within 1 minute (unless it has a detail)
      if (sameType && timeDiff < 60000 && !e.detail) return;

      deduped.push(e);
    });

    if (deduped.length === 0) {
      return '<div class="activity-empty">No activity yet</div>';
    }

    // Limit to most recent 12 events (increased from 8)
    const limited = deduped.slice(0, 12);

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
   * Flow: Needs Review → Ready for Approval → Approved → In Draw (final)
   * Note: "Paid" (to vendor) is separate - can happen anytime after approval
   */
  buildStatusPipeline(currentStatus) {
    const stages = [
      { id: 'needs_review', label: 'Needs Review', icon: '📥' },
      { id: 'ready_for_approval', label: 'Ready for Approval', icon: '👁️' },
      { id: 'approved', label: 'Approved', icon: '✓' },
      { id: 'in_draw', label: 'In Draw', icon: '📋' }
    ];

    // Map 'paid' status to 'in_draw' for pipeline purposes (paid is archived/complete)
    const effectiveStatus = currentStatus === 'paid' ? 'in_draw' : currentStatus;
    const statusOrder = ['needs_review', 'ready_for_approval', 'approved', 'in_draw'];
    const currentIndex = statusOrder.indexOf(effectiveStatus);

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
      // Core workflow
      'uploaded': '📥',
      'created': '📄',
      'needs_review': '📝',
      'ready_for_approval': '👁️',
      'needs_approval': '👁️', // Legacy
      'approved': '✅',
      'denied': '❌',
      'sent_back': '↩️',

      // Payment & Draw
      'paid': '💰',
      'paid_to_vendor': '💵',
      'partial_payment': '💵',
      'unpaid': '↩️',
      'added_to_draw': '📋',
      'removed_from_draw': '📤',
      'partial_billed': '📊',
      'partial_approval': '⚡',
      'closed_out': '📕',

      // Split operations
      'split': '✂️',
      'unsplit': '🔗',
      'created_from_split': '📑',
      'deleted_unsplit': '🗑️',

      // Edits & AI
      'edited': '✏️',
      'full_edit': '✏️',
      'ai_override': '🤖',
      'co_auto_linked': '🔗',

      // Other
      'note': '💬',
      'deleted': '🗑️'
    };
    return icons[action] || '📝';
  },

  /**
   * Format activity action into readable label
   */
  formatActivityAction(action) {
    const labels = {
      // Core workflow
      'uploaded': 'Uploaded',
      'created': 'Created',
      'needs_review': 'Sent to Review',
      'ready_for_approval': 'Ready for Approval',
      'needs_approval': 'Ready for Approval', // Legacy
      'approved': 'Approved',
      'denied': 'Denied',
      'sent_back': 'Sent Back',

      // Payment & Draw
      'paid': 'Marked Paid',
      'paid_to_vendor': 'Paid to Vendor',
      'partial_payment': 'Partial Payment',
      'unpaid': 'Payment Reversed',
      'added_to_draw': 'Added to Draw',
      'removed_from_draw': 'Removed from Draw',
      'partial_billed': 'Partial Billing',
      'partial_approval': 'Partial Approval',
      'closed_out': 'Closed Out',

      // Split operations
      'split': 'Invoice Split',
      'unsplit': 'Split Reversed',
      'created_from_split': 'Created from Split',
      'deleted_unsplit': 'Split Child Removed',

      // Edits & AI
      'edited': 'Edited',
      'full_edit': 'Full Edit',
      'ai_override': 'AI Override',
      'co_auto_linked': 'CO Auto-Linked',

      // Other
      'note': 'Note Added',
      'deleted': 'Deleted'
    };
    return labels[action] || action.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
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
   * needs_review → Submit for Approval | Save | Delete (accountant full edit)
   * ready_for_approval → Approve | Deny | Unlock to Edit (PM review, read-only)
   * approved → Add to Draw | Send Back | Unlock to Edit | Close Out (if partial)
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

    // Check if invoice can be split (only in needs_review, not already split, has amount)
    const canSplit = status === 'needs_review'
      && !invoice.is_split_parent
      && !invoice.parent_invoice_id
      && invoiceAmount > 0;

    // For archived invoices, just show Close button
    if (isArchived) {
      buttons.push(`<button type="button" class="btn btn-secondary" onclick="console.log('[MODALS] Close clicked'); Modals.closeActiveModal()">Close</button>`);
      return buttons.join('');
    }

    // Always have Cancel for editable invoices
    buttons.push(`<button type="button" class="btn btn-secondary" onclick="console.log('[MODALS] Cancel clicked'); Modals.closeActiveModal()">Cancel</button>`);

    // Add Split button if applicable
    if (canSplit) {
      buttons.push(`<button type="button" class="btn btn-outline-primary" onclick="console.log('[SPLIT BTN] clicked, invoice:', window.Modals?.currentInvoice?.id); window.showSplitModal(window.Modals?.currentInvoice)" title="Split this invoice across multiple jobs">Split</button>`);
    }

    // Add Unsplit button for split parent invoices
    if (invoice.is_split_parent && status === 'split') {
      buttons.push(`<button type="button" class="btn btn-warning-outline" onclick="window.Modals.unsplitInvoice()" title="Undo the split and restore original invoice">&#8634; Unsplit</button>`);
    }

    switch (status) {
      case 'needs_review':
        // Accountant review - full editing, job optional
        buttons.push(`<button type="button" class="btn btn-danger-outline" onclick="window.Modals.deleteInvoice()">Delete</button>`);
        buttons.push(`<button type="button" class="btn btn-secondary" onclick="window.Modals.saveInvoice(true)">Save</button>`);
        buttons.push(`<button type="button" class="btn btn-primary" onclick="window.Modals.saveAndSubmit()">Submit for Approval</button>`);
        break;

      case 'ready_for_approval':
        // PM Review - read-only by default, can unlock to edit
        buttons.push(`<button type="button" class="btn btn-warning-outline" onclick="window.Modals.sendBackInvoice()">Send Back</button>`);
        buttons.push(`<button type="button" class="btn btn-danger-outline" onclick="window.Modals.denyInvoice()">Deny</button>`);
        if (this.isEditMode) {
          // Unlocked - show Save button
          buttons.push(`<button type="button" class="btn btn-secondary" onclick="window.Modals.saveInvoice()">Save</button>`);
        } else {
          // Locked - show Unlock button
          buttons.push(`<button type="button" class="btn btn-outline-primary" onclick="window.Modals.enterEditMode()">🔓 Unlock to Edit</button>`);
        }
        buttons.push(`<button type="button" class="btn btn-success" onclick="window.Modals.approveInvoice()">Approve</button>`);
        break;

      case 'approved':
        // Approved - waiting to be added to a draw
        buttons.push(`<button type="button" class="btn btn-warning-outline" onclick="window.Modals.sendBackInvoice()">Send Back</button>`);
        if (this.isEditMode) {
          // Unlocked - show Save button
          buttons.push(`<button type="button" class="btn btn-secondary" onclick="window.Modals.saveInvoice()">Save</button>`);
        } else {
          // Locked - show Unlock button
          buttons.push(`<button type="button" class="btn btn-outline-primary" onclick="window.Modals.enterEditMode()">🔓 Unlock to Edit</button>`);
        }
        // Show Close Out button if there's a remaining balance to write off
        if (hasRemainingBalance) {
          buttons.push(`<button type="button" class="btn btn-warning-outline" onclick="window.Modals.showCloseOutDialog()">Close Out</button>`);
        }
        buttons.push(`<button type="button" class="btn btn-primary" onclick="window.Modals.addToDraw()">Add to Draw</button>`);
        break;

      case 'in_draw':
        // In draw - can only be removed if draw is in draft status
        buttons.push(`<button type="button" class="btn btn-warning-outline" onclick="window.Modals.removeFromDraw()">Remove from Draw</button>`);
        break;

      case 'denied':
        // Denied - can be edited and resubmitted, or deleted
        buttons.push(`<button type="button" class="btn btn-danger-outline" onclick="window.Modals.deleteInvoice()">Delete</button>`);
        buttons.push(`<button type="button" class="btn btn-secondary" onclick="window.Modals.saveInvoice(true)">Save</button>`);
        buttons.push(`<button type="button" class="btn btn-primary" onclick="window.Modals.resubmitInvoice()">Resubmit</button>`);
        break;

      // Legacy status support
      case 'received':
        buttons.push(`<button type="button" class="btn btn-danger-outline" onclick="window.Modals.deleteInvoice()">Delete</button>`);
        buttons.push(`<button type="button" class="btn btn-secondary" onclick="window.Modals.saveInvoice(true)">Save</button>`);
        buttons.push(`<button type="button" class="btn btn-primary" onclick="window.Modals.saveAndSubmit()">Submit</button>`);
        break;

      case 'needs_approval':
        // Legacy - same as ready_for_approval
        buttons.push(`<button type="button" class="btn btn-danger-outline" onclick="window.Modals.denyInvoice()">Deny</button>`);
        if (this.isEditMode) {
          buttons.push(`<button type="button" class="btn btn-secondary" onclick="window.Modals.saveInvoice()">Save</button>`);
        } else {
          buttons.push(`<button type="button" class="btn btn-outline-primary" onclick="window.Modals.enterEditMode()">🔓 Unlock to Edit</button>`);
        }
        buttons.push(`<button type="button" class="btn btn-success" onclick="window.Modals.approveInvoice()">Approve</button>`);
        break;

      default:
        // Unknown status - just save
        buttons.push(`<button type="button" class="btn btn-primary" onclick="window.Modals.saveInvoice()">Save</button>`);
    }

    return buttons.join('');
  },

  /**
   * Add a new allocation row - starts at $0, first line auto-balances when you enter amount
   */
  addAllocation() {
    // Add new line with $0 - when user enters amount, first line auto-balances
    this.currentAllocations.push({
      cost_code_id: null,
      amount: 0,
      notes: '',
      change_order_id: null
    });
    this.refreshAllocationsUI();
    this.markDirty();
  },

  /**
   * Remove an allocation row
   * Does NOT auto-inflate first line (allows partial approvals)
   */
  removeAllocation(index) {
    this.currentAllocations.splice(index, 1);
    this.refreshAllocationsUI();
    this.markDirty();
  },

  /**
   * Split total evenly across all allocation lines
   */
  splitEvenly() {
    if (this.currentAllocations.length < 2) return;

    const invoiceAmount = window.Validation?.parseCurrency(this.getFormValue('amount')) || 0;
    const alreadyBilled = Math.max(
      parseFloat(this.currentInvoice?.billed_amount || 0),
      parseFloat(this.currentInvoice?.paid_amount || 0)
    );
    const maxAllocatable = invoiceAmount - alreadyBilled;

    // Divide evenly
    const perLine = Math.floor((maxAllocatable / this.currentAllocations.length) * 100) / 100;
    const remainder = Math.round((maxAllocatable - (perLine * this.currentAllocations.length)) * 100) / 100;

    this.currentAllocations.forEach((alloc, i) => {
      // Give remainder to first line
      alloc.amount = i === 0 ? perLine + remainder : perLine;
    });

    this.refreshAllocationsUI();
    this.markDirty();

    // Flash all amount fields to show they changed
    document.querySelectorAll('#allocations-container .amount-input').forEach(input => {
      input.classList.add('highlight-flash');
      setTimeout(() => input.classList.remove('highlight-flash'), 600);
    });
  },

  /**
   * Fill allocation with remaining unallocated amount
   */
  fillRemaining(index) {
    if (!this.currentAllocations[index]) return;

    const invoiceAmount = window.Validation?.parseCurrency(this.getFormValue('amount')) || 0;

    // Account for already billed/paid amounts (for partial invoices)
    const alreadyBilled = Math.max(
      parseFloat(this.currentInvoice?.billed_amount || 0),
      parseFloat(this.currentInvoice?.paid_amount || 0)
    );
    const maxAllocatable = invoiceAmount - alreadyBilled;

    // Calculate total allocated by OTHER allocations (not this one)
    const otherAllocated = this.currentAllocations.reduce((sum, a, i) => {
      if (i === index) return sum;
      return sum + parseFloat(a.amount || 0);
    }, 0);

    // Remaining = max allocatable - other allocations
    const remaining = Math.max(0, maxAllocatable - otherAllocated);

    // Update this allocation's amount
    this.currentAllocations[index].amount = remaining;
    this.refreshAllocationsUI();
    this.markDirty();

    // Highlight the filled field
    const container = document.getElementById('allocations-container');
    if (container) {
      const allLineItems = container.querySelectorAll('.allocation-line-item');
      const lineItem = allLineItems[index];
      if (lineItem) {
        const input = lineItem.querySelector('.amount-input');
        if (input) {
          input.classList.add('highlight-flash');
          setTimeout(() => input.classList.remove('highlight-flash'), 600);
        }
      }
    }
  },

  // Alias for fillRemaining
  fillRemainingAmount(index) {
    this.fillRemaining(index);
  },

  /**
   * Set allocation to a percentage of the invoice total
   */
  setAllocationPercent(index, percent) {
    if (!this.currentAllocations[index]) return;

    const invoiceAmount = window.Validation?.parseCurrency(this.getFormValue('amount')) || 0;

    // Account for already billed/paid amounts (for partial invoices)
    const alreadyBilled = Math.max(
      parseFloat(this.currentInvoice?.billed_amount || 0),
      parseFloat(this.currentInvoice?.paid_amount || 0)
    );
    const maxAllocatable = invoiceAmount - alreadyBilled;

    // Calculate the percentage amount
    const amount = (maxAllocatable * percent) / 100;

    // Update this allocation's amount
    this.currentAllocations[index].amount = Math.round(amount * 100) / 100; // Round to 2 decimals
    this.refreshAllocationsUI();
    this.markDirty();
  },

  /**
   * Update an allocation value
   * Auto-balances to PREVENT over-allocation (but allows under-allocation for partial approvals)
   * When you enter an amount that would push total over invoice amount, first line reduces to compensate
   */
  updateAllocation(index, field, value) {
    if (!this.currentAllocations[index]) return;

    if (field === 'amount') {
      value = window.Validation?.parseCurrency(value) || 0;

      // Get max allocatable amount (invoice amount minus already billed)
      const invoiceAmount = window.Validation?.parseCurrency(this.getFormValue('amount')) || 0;
      const alreadyBilled = Math.max(
        parseFloat(this.currentInvoice?.billed_amount || 0),
        parseFloat(this.currentInvoice?.paid_amount || 0)
      );
      const maxAllocatable = invoiceAmount - alreadyBilled;

      // Update this allocation
      this.currentAllocations[index].amount = value;

      // Calculate new total
      const newTotal = this.currentAllocations.reduce((sum, a) => sum + parseFloat(a.amount || 0), 0);

      // Only auto-balance if we're OVER the max (prevent over-allocation)
      // This allows partial approvals (under-allocation) while preventing going over
      if (newTotal > maxAllocatable + 0.01 && index > 0 && this.currentAllocations.length > 1) {
        // Sum all allocations except the first
        const otherTotal = this.currentAllocations
          .slice(1)
          .reduce((sum, a) => sum + parseFloat(a.amount || 0), 0);

        // First line gets reduced to fit within max (but never negative)
        const firstLineAmount = Math.max(0, maxAllocatable - otherTotal);
        this.currentAllocations[0].amount = Math.round(firstLineAmount * 100) / 100;

        // Update the first line's input field in the DOM and highlight it
        const firstAmountInput = document.querySelector('#allocations-container .line-item:first-child .amount-input');
        if (firstAmountInput) {
          firstAmountInput.value = this.formatAmountInput(this.currentAllocations[0].amount);
          // Flash highlight to show auto-adjustment
          firstAmountInput.classList.add('highlight-flash');
          setTimeout(() => firstAmountInput.classList.remove('highlight-flash'), 600);
        }
      }
    } else {
      this.currentAllocations[index][field] = value;
    }

    this.refreshAllocationSummary();
    this.refreshBudgetStanding();
    this.markDirty();
  },

  /**
   * Show link picker modal for allocation - supports dual PO+CO linking
   */
  showLinkPicker(index, event) {
    event?.stopPropagation();

    // Close any existing picker
    this.closeLinkPicker();

    const alloc = this.currentAllocations[index];
    const isCOCostCode = this.isCOCostCode(alloc.cost_code || alloc.cost_code_id);
    this.activeLinkPicker = index;

    // Build modal HTML with separate PO and CO selection
    let html = `
      <div id="link-picker-modal" class="link-picker-overlay">
        <div class="link-picker-backdrop" onclick="window.Modals.closeLinkPicker()"></div>
        <div class="link-picker-dialog">
          <div class="link-picker-header">
            <h2>Link Funding Source</h2>
            <p class="link-picker-subtitle">Select a Purchase Order and/or Change Order for this allocation${isCOCostCode ? ' <span class="co-code-hint">(CO cost code detected)</span>' : ''}</p>
            <button class="modal-close" onclick="window.Modals.closeLinkPicker()">&times;</button>
          </div>
          <div class="link-picker-body">
    `;

    // Purchase Orders section - separate radio group
    html += '<div class="link-section">';
    html += '<h3 class="link-section-title"><span class="section-icon po-icon">PO</span> Purchase Order</h3>';
    html += '<div class="link-cards">';

    // "No PO" option
    const noPOSelected = !alloc.po_id;
    html += `
      <label class="link-card link-card-none ${noPOSelected ? 'selected' : ''}">
        <input type="radio" name="link-po" value="none" ${noPOSelected ? 'checked' : ''}>
        <div class="none-card-content">
          <span class="none-icon">—</span>
          <span class="none-text">No PO</span>
        </div>
      </label>
    `;

    if (this.cachedPurchaseOrders?.length > 0) {
      for (const po of this.cachedPurchaseOrders) {
        const total = parseFloat(po.total_amount || 0);
        const remaining = parseFloat(po.remaining || 0);
        const used = total - remaining;
        const pctUsed = total > 0 ? Math.round((used / total) * 100) : 0;
        const isSelected = alloc.po_id === po.id;
        const vendorName = po.vendor?.name || 'Unknown Vendor';
        const description = po.description || '';

        // Get cost codes from line items
        const costCodes = (po.line_items || [])
          .map(li => li.cost_code?.code)
          .filter(Boolean)
          .filter((v, i, a) => a.indexOf(v) === i) // unique
          .slice(0, 3); // max 3
        const costCodeText = costCodes.length > 0
          ? costCodes.join(', ') + (po.line_items?.length > 3 ? '...' : '')
          : '';

        // Format date
        const createdDate = po.created_at ? new Date(po.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';

        html += `
          <label class="link-card ${isSelected ? 'selected' : ''}">
            <input type="radio" name="link-po" value="${po.id}" ${isSelected ? 'checked' : ''}>
            <div class="link-card-header">
              <span class="link-card-number">${po.po_number}</span>
              <span class="link-card-status ${po.status}">${po.status}</span>
            </div>
            <div class="link-card-vendor">${this.escapeHtml(vendorName)}</div>
            ${description ? `<div class="link-card-desc">${this.escapeHtml(description)}</div>` : ''}
            ${costCodeText ? `<div class="link-card-costcodes"><span class="cc-label">Cost Codes:</span> ${costCodeText}</div>` : ''}
            <div class="link-card-amounts">
              <div class="link-card-amount-row">
                <span class="label">Total:</span>
                <span class="value">$${total.toLocaleString('en-US', {minimumFractionDigits: 2})}</span>
              </div>
              <div class="link-card-amount-row remaining">
                <span class="label">Remaining:</span>
                <span class="value highlight">$${remaining.toLocaleString('en-US', {minimumFractionDigits: 2})}</span>
              </div>
            </div>
            <div class="link-card-progress">
              <div class="progress-bar" style="width: ${pctUsed}%"></div>
            </div>
            ${createdDate ? `<div class="link-card-date">Created ${createdDate}</div>` : ''}
          </label>
        `;
      }
    }

    // Create New PO option
    html += `
      <label class="link-card create-card">
        <input type="radio" name="link-po" value="create-po">
        <div class="create-card-content">
          <span class="create-icon">+</span>
          <span class="create-text">Create New PO</span>
        </div>
      </label>
    `;

    html += '</div></div>'; // link-cards, link-section

    // Change Orders section - separate radio group
    html += '<div class="link-section">';
    html += `<h3 class="link-section-title"><span class="section-icon co-icon">CO</span> Change Order ${isCOCostCode ? '<span class="required-hint">(Required for CO cost codes)</span>' : ''}</h3>`;
    html += '<div class="link-cards">';

    // "No CO" option
    const noCOSelected = !alloc.change_order_id;
    html += `
      <label class="link-card link-card-none ${noCOSelected ? 'selected' : ''} ${isCOCostCode ? 'not-recommended' : ''}">
        <input type="radio" name="link-co" value="none" ${noCOSelected ? 'checked' : ''}>
        <div class="none-card-content">
          <span class="none-icon">—</span>
          <span class="none-text">No CO</span>
          ${isCOCostCode ? '<span class="none-warning">Not recommended for CO cost codes</span>' : ''}
        </div>
      </label>
    `;

    if (this.cachedChangeOrders?.length > 0) {
      for (const co of this.cachedChangeOrders) {
        const total = parseFloat(co.amount || co.total_amount || 0);
        const remaining = parseFloat(co.remaining || 0);
        const used = total - remaining;
        const pctUsed = total > 0 ? Math.round((used / total) * 100) : 0;
        const isSelected = alloc.change_order_id === co.id;
        const coNumber = `CO-${String(co.change_order_number).padStart(3, '0')}`;
        const statusLabel = co.status === 'pending_approval' ? 'pending' : (co.status || 'approved');

        html += `
          <label class="link-card co-card ${isSelected ? 'selected' : ''}">
            <input type="radio" name="link-co" value="${co.id}" ${isSelected ? 'checked' : ''}>
            <div class="link-card-header">
              <span class="link-card-number">${coNumber}</span>
              <span class="link-card-status ${statusLabel}">${statusLabel}</span>
            </div>
            <div class="link-card-title">${this.escapeHtml(co.title || 'Untitled')}</div>
            <div class="link-card-amounts">
              <div class="link-card-amount-row">
                <span class="label">Total:</span>
                <span class="value">$${total.toLocaleString('en-US', {minimumFractionDigits: 2})}</span>
              </div>
              <div class="link-card-amount-row remaining">
                <span class="label">Remaining:</span>
                <span class="value highlight">$${remaining.toLocaleString('en-US', {minimumFractionDigits: 2})}</span>
              </div>
            </div>
            <div class="link-card-progress co-progress">
              <div class="progress-bar" style="width: ${pctUsed}%"></div>
            </div>
          </label>
        `;
      }
    }

    // Create New CO option
    html += `
      <label class="link-card create-card co-create">
        <input type="radio" name="link-co" value="create-co">
        <div class="create-card-content">
          <span class="create-icon">+</span>
          <span class="create-text">Create New Change Order</span>
        </div>
      </label>
    `;

    html += '</div></div>'; // link-cards, link-section

    html += `
          </div>
          <div class="link-picker-footer">
            <button type="button" class="btn btn-secondary" onclick="window.Modals.closeLinkPicker()">Cancel</button>
            <button type="button" class="btn btn-primary" onclick="window.Modals.applyLinkSelection(${index})">Link Selected</button>
          </div>
        </div>
      </div>
    `;

    // Add modal to body
    const modalContainer = document.createElement('div');
    modalContainer.id = 'link-picker-modal-container';
    modalContainer.innerHTML = html;
    document.body.appendChild(modalContainer);

    // Add click handlers to cards for better reliability
    modalContainer.querySelectorAll('.link-card').forEach(card => {
      card.addEventListener('click', (e) => {
        const radio = card.querySelector('input[type="radio"]');
        if (radio) {
          radio.checked = true;
          // Update selected state visually
          const name = radio.name;
          modalContainer.querySelectorAll(`input[name="${name}"]`).forEach(r => {
            r.closest('.link-card')?.classList.remove('selected');
          });
          card.classList.add('selected');

          // Auto-suggest CO from PO when a PO is selected
          if (name === 'link-po' && radio.value && radio.value !== 'none' && radio.value !== 'create-po') {
            this.autoSuggestCOFromPO(index, radio.value, modalContainer);
          }
        }
      });
    });
  },

  /**
   * Auto-suggest CO based on selected PO's line item change_order_id
   * When a PO is selected, check if a line item matches the allocation's cost code
   * and has a change_order_id - if so, auto-select that CO
   */
  autoSuggestCOFromPO(allocIndex, poId, modalContainer) {
    const alloc = this.currentAllocations[allocIndex];
    const allocCostCodeId = alloc.cost_code?.id || alloc.cost_code_id;

    if (!allocCostCodeId) return;

    // Find the selected PO
    const po = this.cachedPurchaseOrders?.find(p => p.id === poId);
    if (!po?.line_items) return;

    // Find a line item with matching cost code that has a change_order_id
    const matchingLineItem = po.line_items.find(li => {
      const liCostCodeId = li.cost_code?.id || li.cost_code_id;
      return liCostCodeId === allocCostCodeId && li.change_order_id;
    });

    if (!matchingLineItem?.change_order_id) return;

    // Check if there's a matching CO in cached COs
    const matchingCO = this.cachedChangeOrders?.find(co => co.id === matchingLineItem.change_order_id);
    if (!matchingCO) return;

    // Auto-select the CO
    const coRadio = modalContainer.querySelector(`input[name="link-co"][value="${matchingCO.id}"]`);
    if (coRadio) {
      coRadio.checked = true;
      // Update selected state visually
      modalContainer.querySelectorAll('input[name="link-co"]').forEach(r => {
        r.closest('.link-card')?.classList.remove('selected');
      });
      coRadio.closest('.link-card')?.classList.add('selected');

      // Show toast notification
      const coNumber = `CO-${String(matchingCO.change_order_number).padStart(3, '0')}`;
      window.toasts?.info(`Auto-linked to ${coNumber} from PO line item`, { duration: 3000 });
    }
  },

  /**
   * Apply the selected link options (supports dual PO+CO selection)
   */
  applyLinkSelection(index) {
    const selectedPO = document.querySelector('input[name="link-po"]:checked');
    const selectedCO = document.querySelector('input[name="link-co"]:checked');

    const poValue = selectedPO?.value || 'none';
    const coValue = selectedCO?.value || 'none';
    const alloc = this.currentAllocations[index];

    // Handle create actions first (these need special modal flow)
    if (poValue === 'create-po') {
      // Store the CO selection to apply after PO creation
      this._pendingCOSelection = coValue !== 'none' && coValue !== 'create-co' ? coValue : null;
      this.closeLinkPicker();
      this.showCreatePOModal(index);
      return;
    }

    if (coValue === 'create-co') {
      // Store the PO selection to apply after CO creation
      this._pendingPOSelection = poValue !== 'none' ? poValue : null;
      this.closeLinkPicker();
      this.showCreateCOModal(index);
      return;
    }

    // Apply selections
    alloc.po_id = (poValue !== 'none') ? poValue : null;
    alloc.change_order_id = (coValue !== 'none') ? coValue : null;
    alloc.po_line_item_id = null;
    alloc._aiLinked = false; // User manually changed, no longer AI-linked

    this.closeLinkPicker();
    this.refreshAllocationsUI();
    this.markDirty();
  },

  /**
   * Close the link picker modal
   */
  closeLinkPicker() {
    // Remove the modal container
    const modalContainer = document.getElementById('link-picker-modal-container');
    if (modalContainer) {
      modalContainer.remove();
    }
    this.activeLinkPicker = null;
  },

  /**
   * Show modal to create a new Change Order and link to allocation
   */
  showCreateCOModal(allocationIndex) {
    const alloc = this.currentAllocations[allocationIndex];
    const amount = parseFloat(alloc.amount || 0);
    const jobId = this.currentInvoice?.job_id;

    if (!jobId) {
      window.toasts?.error('Please select a job first');
      return;
    }

    // Create modal HTML
    const modalHtml = `
      <div id="create-co-modal" class="modal" style="display: flex; opacity: 1; z-index: 10002;">
        <div class="modal-content" style="max-width: 500px; opacity: 1;">
          <div class="modal-header">
            <h2>Create Change Order</h2>
            <button class="modal-close" onclick="window.Modals.closeCreateCOModal()">&times;</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label>Title <span class="required">*</span></label>
              <input type="text" id="co-title" class="field-input" placeholder="e.g., Kitchen upgrade">
            </div>
            <div class="form-group">
              <label>Amount</label>
              <div class="amount-input-group">
                <span class="amount-prefix">$</span>
                <input type="text" id="co-amount" class="field-input" value="${this.formatAmountInput(amount)}">
              </div>
            </div>
            <div class="form-group">
              <label>Description</label>
              <textarea id="co-description" class="field-input" rows="3" placeholder="Optional description..."></textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn-secondary" onclick="window.Modals.closeCreateCOModal()">Cancel</button>
            <button type="button" class="btn-primary" onclick="window.Modals.submitCreateCO(${allocationIndex})">Create & Link</button>
          </div>
        </div>
      </div>
    `;

    // Add modal to DOM
    const container = document.getElementById('modal-container') || document.body;
    const wrapper = document.createElement('div');
    wrapper.id = 'create-co-modal-wrapper';
    wrapper.innerHTML = modalHtml;
    container.appendChild(wrapper);
  },

  /**
   * Close the create CO modal
   */
  closeCreateCOModal() {
    const wrapper = document.getElementById('create-co-modal-wrapper');
    if (wrapper) {
      wrapper.remove();
    }
  },

  /**
   * Submit creation of new CO and link to allocation
   */
  async submitCreateCO(allocationIndex) {
    const title = document.getElementById('co-title')?.value?.trim();
    const amountStr = document.getElementById('co-amount')?.value;
    const description = document.getElementById('co-description')?.value?.trim();

    if (!title) {
      window.toasts?.error('Please enter a title for the Change Order');
      return;
    }

    const amount = window.Validation?.parseCurrency(amountStr) || 0;
    const jobId = this.currentInvoice?.job_id;

    try {
      // Create the CO via API
      const response = await fetch(`/api/jobs/${jobId}/change-orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          amount,
          description,
          status: 'approved' // Auto-approve since it's being created for an invoice
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create Change Order');
      }

      const newCO = await response.json();

      // Add to cached COs
      this.cachedChangeOrders.push({
        ...newCO,
        remaining: amount
      });

      // Link allocation to new CO
      const alloc = this.currentAllocations[allocationIndex];
      alloc.change_order_id = newCO.id;
      alloc.po_line_item_id = null;

      // Apply pending PO selection from dual picker (if any)
      if (this._pendingPOSelection) {
        alloc.po_id = this._pendingPOSelection;
        this._pendingPOSelection = null;
      }

      this.closeCreateCOModal();
      this.refreshAllocationsUI();
      this.markDirty();

      window.toasts?.success(`Created CO-${String(newCO.change_order_number).padStart(3, '0')}: ${title}`);
    } catch (err) {
      console.error('Failed to create CO:', err);
      window.toasts?.error('Failed to create Change Order', { details: err.message });
    }
  },

  /**
   * Show modal to create a new Purchase Order and link to allocation
   */
  showCreatePOModal(allocationIndex) {
    const alloc = this.currentAllocations[allocationIndex];
    const amount = parseFloat(alloc.amount || 0);
    const jobId = this.currentInvoice?.job_id;
    const vendorId = this.currentInvoice?.vendor_id;
    const vendorName = this.currentInvoice?.vendor?.name || '';

    if (!jobId) {
      window.toasts?.error('Please select a job first');
      return;
    }

    // Create modal HTML
    const modalHtml = `
      <div id="create-po-modal" class="modal" style="display: flex; opacity: 1; z-index: 10002;">
        <div class="modal-content" style="max-width: 500px; opacity: 1;">
          <div class="modal-header">
            <h2>Create Purchase Order</h2>
            <button class="modal-close" onclick="window.Modals.closeCreatePOModal()">&times;</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label>Vendor</label>
              <input type="text" class="field-input" value="${this.escapeHtml(vendorName)}" readonly style="background: var(--bg-card); opacity: 0.7;">
              <input type="hidden" id="po-vendor-id" value="${vendorId || ''}">
            </div>
            <div class="form-group">
              <label>Description <span class="required">*</span></label>
              <input type="text" id="po-description" class="field-input" placeholder="e.g., Framing materials for main structure">
            </div>
            <div class="form-group">
              <label>Amount</label>
              <div class="amount-input-group">
                <span class="amount-prefix">$</span>
                <input type="text" id="po-amount" class="field-input" value="${this.formatAmountInput(amount)}">
              </div>
            </div>
            <div class="form-group">
              <label>Notes</label>
              <textarea id="po-notes" class="field-input" rows="2" placeholder="Optional notes"></textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn-secondary" onclick="window.Modals.closeCreatePOModal()">Cancel</button>
            <button type="button" class="btn-primary" onclick="window.Modals.submitCreatePO(${allocationIndex})">Create & Link</button>
          </div>
        </div>
      </div>
    `;

    // Add to DOM
    const wrapper = document.createElement('div');
    wrapper.id = 'create-po-modal-wrapper';
    wrapper.innerHTML = modalHtml;
    document.body.appendChild(wrapper);

    // Focus description field
    setTimeout(() => document.getElementById('po-description')?.focus(), 100);
  },

  /**
   * Close the create PO modal
   */
  closeCreatePOModal() {
    const wrapper = document.getElementById('create-po-modal-wrapper');
    if (wrapper) {
      wrapper.remove();
    }
  },

  /**
   * Submit creation of new PO and link to allocation
   */
  async submitCreatePO(allocationIndex) {
    const description = document.getElementById('po-description')?.value?.trim();
    const amountStr = document.getElementById('po-amount')?.value;
    const notes = document.getElementById('po-notes')?.value?.trim();
    const vendorId = document.getElementById('po-vendor-id')?.value;

    if (!description) {
      window.toasts?.error('Please enter a description for the Purchase Order');
      return;
    }

    if (!vendorId) {
      window.toasts?.error('No vendor associated with this invoice');
      return;
    }

    const amount = window.Validation?.parseCurrency(amountStr) || 0;
    const jobId = this.currentInvoice?.job_id;

    try {
      // Create the PO via API
      const response = await fetch('/api/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_id: jobId,
          vendor_id: vendorId,
          description,
          total_amount: amount,
          notes,
          status: 'open',
          approval_status: 'approved' // Auto-approve since it's being created for an invoice
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create Purchase Order');
      }

      const newPO = await response.json();

      // Add to cached POs
      this.cachedPurchaseOrders.push({
        ...newPO,
        remaining: amount,
        vendor: this.currentInvoice?.vendor
      });

      // Link allocation to new PO
      const alloc = this.currentAllocations[allocationIndex];
      alloc.po_id = newPO.id;
      alloc.po_line_item_id = null;

      // Apply pending CO selection from dual picker (if any)
      if (this._pendingCOSelection) {
        alloc.change_order_id = this._pendingCOSelection;
        this._pendingCOSelection = null;
      }

      this.closeCreatePOModal();
      this.refreshAllocationsUI();
      this.markDirty();

      window.toasts?.success(`Created ${newPO.po_number}`);
    } catch (err) {
      console.error('Failed to create PO:', err);
      window.toasts?.error('Failed to create Purchase Order', { details: err.message });
    }
  },

  /**
   * Refresh all balance sections when allocations change
   * Updates: Invoice Balance, PO Balance, Budget Standing
   */
  refreshBudgetStanding() {
    const totalAllocated = this.currentAllocations.reduce((sum, a) => sum + parseFloat(a.amount || 0), 0);

    // 1. Update PO Balance section
    this.refreshPOBalance(totalAllocated);

    // 2. Update Budget Standing table
    this.refreshBudgetTable();
  },

  /**
   * Refresh PO Balance section with current allocation total
   */
  refreshPOBalance(totalAllocated) {
    const poRow = document.querySelector('.po-balance-section .po-table tbody tr');
    if (!poRow) return;

    // Get static values from table cells
    const poTotalEl = poRow.querySelector('.po-total');
    const prevBilledEl = poRow.querySelector('.po-prev-billed');
    const thisInvEl = poRow.querySelector('.this-inv');
    const remainingEl = poRow.querySelector('.po-remaining');
    const overBadge = poRow.querySelector('.over-badge-inline');
    const poNumberCell = poRow.querySelector('td:first-child');

    if (!poTotalEl || !prevBilledEl || !thisInvEl || !remainingEl) return;

    const poTotal = window.Validation?.parseCurrency(poTotalEl.textContent) || 0;
    const prevBilled = window.Validation?.parseCurrency(prevBilledEl.textContent) || 0;
    const remaining = poTotal - prevBilled - totalAllocated;
    const isOver = remaining < 0;

    // Update This Invoice
    thisInvEl.textContent = this.formatCurrency(totalAllocated);

    // Update Remaining
    remainingEl.textContent = isOver ? '(' + this.formatCurrency(Math.abs(remaining)) + ')' : this.formatCurrency(remaining);
    remainingEl.classList.toggle('over', isOver);

    // Update row over status
    poRow.classList.toggle('over-budget', isOver);

    // Toggle over badge inline
    if (isOver && !overBadge && poNumberCell) {
      const badge = document.createElement('span');
      badge.className = 'over-badge-inline';
      badge.textContent = 'OVER';
      poNumberCell.appendChild(badge);
    } else if (!isOver && overBadge) {
      overBadge.remove();
    }
  },

  /**
   * Refresh Budget Standing table based on current allocations
   */
  refreshBudgetTable() {
    const budgetRows = document.querySelectorAll('.budget-standing-section .budget-table tbody tr');
    if (!budgetRows.length) return;

    // Build a map of cost_code_id -> allocated amount
    const allocationByCode = {};
    this.currentAllocations.forEach(alloc => {
      if (alloc.cost_code_id) {
        allocationByCode[alloc.cost_code_id] = (allocationByCode[alloc.cost_code_id] || 0) + parseFloat(alloc.amount || 0);
      }
    });

    // Update each budget row
    budgetRows.forEach(row => {
      const costCodeId = row.dataset.costCodeId;
      if (!costCodeId) return;

      const budgetCell = row.querySelector('.budget-amt');
      const prevBilledCell = row.querySelector('.prev-billed');
      const thisInvCell = row.querySelector('.this-inv');
      const remainingCell = row.querySelector('.remaining');

      if (thisInvCell && remainingCell && budgetCell && prevBilledCell) {
        const budget = window.Validation?.parseCurrency(budgetCell.textContent) || 0;
        const prevBilled = window.Validation?.parseCurrency(prevBilledCell.textContent) || 0;
        const thisInv = allocationByCode[costCodeId] || 0;
        const remaining = budget - prevBilled - thisInv;
        const isOver = remaining < 0;

        thisInvCell.textContent = this.formatCurrency(thisInv);
        remainingCell.textContent = isOver ? '(' + this.formatCurrency(Math.abs(remaining)) + ')' : this.formatCurrency(remaining);
        remainingCell.classList.toggle('over', isOver);
        row.classList.toggle('over-budget', isOver);
      }
    });
  },

  /**
   * Find cost code by code string
   */
  findCostCodeByCode(codeStr) {
    // Use SearchablePicker's cached cost codes
    if (window.SearchablePicker?.cache?.costCodes) {
      return window.SearchablePicker.cache.costCodes.find(cc => cc.code === codeStr);
    }
    return null;
  },

  /**
   * Find cost code by ID
   */
  findCostCodeById(costCodeId) {
    if (!costCodeId) return null;
    // Use SearchablePicker's cached cost codes
    if (window.SearchablePicker?.cache?.costCodes) {
      return window.SearchablePicker.cache.costCodes.find(cc => cc.id === costCodeId);
    }
    return null;
  },

  /**
   * Check if a cost code is a Change Order cost code (ends with 'C')
   * @param {Object|string} costCodeOrId - Either the cost_code object from allocation, or a cost_code_id
   */
  isCOCostCode(costCodeOrId) {
    // If passed an object with 'code' property (cost_code from allocation)
    if (costCodeOrId && typeof costCodeOrId === 'object' && costCodeOrId.code) {
      return costCodeOrId.code.endsWith('C');
    }
    // If passed an ID, try to look it up from cache
    if (typeof costCodeOrId === 'string') {
      const costCode = this.findCostCodeById(costCodeOrId);
      if (costCode) {
        return costCode.code?.endsWith('C') || false;
      }
    }
    return false;
  },

  /**
   * Handle invoice amount change - updates all balance sections
   */
  handleAmountChange(input) {
    const value = window.Validation?.parseCurrency(input.value) || 0;
    // Update all displays in real-time
    this.refreshAllocationSummary();
    this.refreshBudgetStanding();
    this.markDirty();
  },

  /**
   * Handle job change - reload funding sources (POs/COs) for new job
   */
  async handleJobChange(jobId) {
    this.markDirty();

    // Update current invoice job reference
    if (this.currentInvoice) {
      this.currentInvoice.job_id = jobId;
    }

    // Clear all allocation links since job changed
    if (this.currentAllocations) {
      for (const alloc of this.currentAllocations) {
        alloc.po_id = null;
        alloc.change_order_id = null;
        alloc.po_line_item_id = null;
      }
    }

    // Fetch funding sources for new job
    if (jobId) {
      await this.fetchFundingSources(jobId);
    } else {
      this.cachedPurchaseOrders = [];
      this.cachedChangeOrders = [];
    }

    // Refresh allocations UI with new funding sources
    this.refreshAllocationsUI();
  },

  /**
   * Get effective allocation target amount (remaining for partial invoices)
   */
  getEffectiveAllocationAmount() {
    // Use stored invoice amount as primary source (more reliable than form)
    let invoiceAmount = parseFloat(this.currentInvoice?.amount) || 0;

    // If user edited the amount in the form, use that instead
    const formAmount = window.Validation?.parseCurrency(this.getFormValue('amount'));
    if (formAmount && formAmount > 0) {
      invoiceAmount = formAmount;
    }

    // Only consider billed_amount for in_draw invoices (partial billing scenario)
    // For all other statuses, use full invoice amount
    if (this.currentInvoice?.status === 'in_draw') {
      const alreadyBilled = Math.max(
        parseFloat(this.currentInvoice?.billed_amount || 0),
        parseFloat(this.currentInvoice?.paid_amount || 0)
      );
      if (alreadyBilled > 0 && alreadyBilled < invoiceAmount) {
        return Math.max(0, invoiceAmount - alreadyBilled);
      }
    }
    return invoiceAmount;
  },

  /**
   * Refresh allocations UI
   */
  refreshAllocationsUI() {
    const invoice = this.currentInvoice;
    const isArchived = invoice?.status === 'paid';

    // Editable statuses - accountant can edit freely without unlocking
    const editableStatuses = ['needs_review', 'received', 'denied'];
    const isEditableStatus = editableStatuses.includes(invoice?.status);

    // Locked statuses - require explicit unlock to edit
    const lockedStatuses = ['ready_for_approval', 'approved', 'in_draw', 'paid', 'needs_approval'];
    const isLockedStatus = lockedStatuses.includes(invoice?.status);

    // Read-only if archived OR (locked status AND not in edit mode)
    const isReadOnly = isArchived || (isLockedStatus && !this.isEditMode);

    const container = document.getElementById('allocations-container');
    if (container) {
      container.innerHTML = this.buildAllocationsHtml(this.currentAllocations, this.getEffectiveAllocationAmount(), isReadOnly);
      this.initCostCodePickers();
    }
    this.refreshAllocationSummary();
    this.refreshBudgetStanding();
  },

  /**
   * Refresh allocation summary
   */
  refreshAllocationSummary() {
    const summary = document.getElementById('allocation-summary');
    if (summary) {
      summary.innerHTML = this.buildAllocationSummary(this.currentAllocations, this.getEffectiveAllocationAmount());
    }
  },

  /**
   * Initialize cost code pickers (uses unified SearchablePicker)
   */
  async initCostCodePickers() {
    const invoice = this.currentInvoice;
    const isArchived = invoice?.status === 'paid';

    // Editable statuses - accountant can edit freely without unlocking
    const editableStatuses = ['needs_review', 'received', 'denied'];
    const isEditableStatus = editableStatuses.includes(invoice?.status);

    // Locked statuses - require explicit unlock to edit
    const lockedStatuses = ['ready_for_approval', 'approved', 'in_draw', 'paid', 'needs_approval'];
    const isLockedStatus = lockedStatuses.includes(invoice?.status);

    // Read-only if archived OR (locked status AND not in edit mode)
    const isReadOnly = isArchived || (isLockedStatus && !this.isEditMode);

    // Initialize each picker using unified SearchablePicker
    document.querySelectorAll('.cc-picker-container').forEach(container => {
      const index = parseInt(container.dataset.index);
      const allocation = this.currentAllocations[index];
      const currentValue = allocation?.cost_code_id || null;
      const originalValue = currentValue; // Store original to detect changes

      window.SearchablePicker.init(container, {
        type: 'costCodes',
        value: currentValue,
        disabled: isReadOnly,
        placeholder: 'Search cost codes...',
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
  async saveInvoice(skipValidation = false) {
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

    // Add paid to vendor fields if checkbox exists (only shown for approved+ invoices)
    const paidToVendorCheckbox = document.getElementById('paid-to-vendor');
    if (paidToVendorCheckbox) {
      formData.paid_to_vendor = paidToVendorCheckbox.checked;
      formData.paid_to_vendor_date = document.getElementById('paid-to-vendor-date')?.value || null;
      formData.paid_to_vendor_ref = document.getElementById('paid-to-vendor-ref')?.value || null;
    }

    // Clear previous errors
    this.clearFieldErrors();

    // Only validate if not skipping (for draft saves, skip validation)
    if (!skipValidation) {
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
    }

    // Derive invoice po_id from allocations if not explicitly set
    // If any allocation has a po_id, use the first one as the invoice's PO
    let derivedPOId = formData.po_id || this.currentInvoice?.po_id;
    if (!derivedPOId && this.currentAllocations.length > 0) {
      const allocWithPO = this.currentAllocations.find(a => a.po_id);
      if (allocWithPO) {
        derivedPOId = allocWithPO.po_id;
        formData.po_id = derivedPOId;
        console.log('[saveInvoice] Derived po_id from allocation:', derivedPOId);
      }
    }

    // Apply default funding source: If invoice has a PO and allocation doesn't have explicit funding,
    // set the allocation's po_id to the invoice's PO (unless user explicitly chose "No PO/CO")
    const invoicePOId = derivedPOId;
    const allocationsToSave = this.currentAllocations.map(alloc => {
      // If allocation has no explicit funding source and invoice has a PO, use invoice PO
      if (!alloc.po_id && !alloc.change_order_id && !alloc._explicitBase && invoicePOId) {
        return { ...alloc, po_id: invoicePOId };
      }
      return alloc;
    });

    // Save to server
    try {
      const loadingToast = window.toasts?.showLoading('Saving invoice...');

      const response = await fetch(`/api/invoices/${this.currentInvoice.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          allocations: allocationsToSave,
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
   * Save and transition to 'ready_for_approval' status
   */
  async saveAndSubmit() {
    // Validate required fields for submission
    const errors = this.validateForStatus('ready_for_approval');
    if (errors.length > 0) {
      window.toasts?.error('Missing required fields', { details: errors.join(', ') });
      return;
    }

    await this.saveWithStatus('ready_for_approval', 'Invoice submitted for approval');
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

    // Check for CO cost code allocations without CO link
    const unlinkedCOAllocations = allocations.filter(a => {
      const isCO = this.isCOCostCode(a.cost_code || a.cost_code_id);
      return isCO && !a.change_order_id;
    });

    if (unlinkedCOAllocations.length > 0) {
      console.log('[APPROVE] Found unlinked CO allocations:', unlinkedCOAllocations);
      // Show CO link prompt before approval
      this.showCOLinkPrompt(unlinkedCOAllocations, isPartial, totalAllocated, invoiceAmount);
      return;
    }

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
   * Show prompt for CO cost code allocations that need CO linking
   */
  showCOLinkPrompt(unlinkedCOAllocations, isPartial, totalAllocated, invoiceAmount) {
    const totalUnlinked = unlinkedCOAllocations.reduce((sum, a) => sum + parseFloat(a.amount || 0), 0);
    const costCodes = unlinkedCOAllocations.map(a => {
      const cc = a.cost_code || this.findCostCodeById(a.cost_code_id);
      return cc ? `${cc.code} - ${cc.name}` : 'Unknown';
    }).join(', ');

    // Build CO options list
    const coOptions = (this.cachedChangeOrders || []).map(co => {
      const coNum = `CO-${String(co.change_order_number).padStart(3, '0')}`;
      const remaining = parseFloat(co.remaining || co.amount || 0);
      return `<option value="${co.id}">${coNum}: ${co.title} ($${remaining.toLocaleString()} remaining)</option>`;
    }).join('');

    const hasExistingCOs = (this.cachedChangeOrders || []).length > 0;

    const modal = `
      <div class="confirm-modal co-link-prompt-modal" style="max-width: 600px;">
        <div class="modal-header">
          <h2>Change Order Required</h2>
          <button class="modal-close" onclick="window.Modals.closeConfirmDialog()">&times;</button>
        </div>

        <div class="modal-body">
          <div class="confirm-message">
            <p>This invoice has <strong>${window.Validation?.formatCurrency(totalUnlinked)}</strong> allocated to CO cost codes:</p>
            <div style="background: var(--bg-card-elevated); padding: 12px; border-radius: 6px; margin: 12px 0;">
              <code style="color: var(--accent-orange);">${costCodes}</code>
            </div>
            <p>To properly track in draws, this must be linked to a Change Order.</p>

            <div class="form-group" style="margin-top: 16px;">
              <label><input type="radio" name="coLinkOption" value="existing" ${hasExistingCOs ? 'checked' : ''} onchange="window.Modals.toggleCOLinkOption()"> Link to Existing Change Order</label>
            </div>

            <div id="existingCOSection" style="margin-left: 24px; ${hasExistingCOs ? '' : 'display: none;'}">
              <select id="coLinkSelect" class="form-control" style="margin-top: 8px;">
                <option value="">Select a Change Order...</option>
                ${coOptions}
              </select>
            </div>

            <div class="form-group" style="margin-top: 12px;">
              <label><input type="radio" name="coLinkOption" value="create" ${!hasExistingCOs ? 'checked' : ''} onchange="window.Modals.toggleCOLinkOption()"> Create New Change Order</label>
            </div>

            <div id="newCOSection" style="margin-left: 24px; display: ${!hasExistingCOs ? 'block' : 'none'};">
              <div class="form-group" style="margin-top: 8px;">
                <label>Title <span style="color: var(--accent-red);">*</span></label>
                <input type="text" id="newCOTitle" class="form-control" placeholder="e.g., Kitchen cabinet upgrade">
              </div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                <div class="form-group">
                  <label>CO Amount <span style="color: var(--accent-red);">*</span></label>
                  <input type="text" id="newCOAmount" class="form-control" value="${window.Validation?.formatCurrency(totalUnlinked)}" placeholder="$0.00">
                </div>
                <div class="form-group">
                  <label>Days Added</label>
                  <input type="number" id="newCODays" class="form-control" value="0" min="0">
                </div>
              </div>
              <div class="form-group">
                <label>Description</label>
                <textarea id="newCODescription" class="form-control" rows="2" placeholder="Optional description..."></textarea>
              </div>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="window.Modals.closeConfirmDialog()">Cancel</button>
          <button class="btn btn-primary" onclick="window.Modals.applyCOLinkAndApprove(${isPartial}, ${totalAllocated}, ${invoiceAmount})">
            Continue to Approve
          </button>
        </div>
      </div>
    `;

    // Show in confirm dialog container
    let container = document.getElementById('confirm-dialog-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'confirm-dialog-container';
      document.body.appendChild(container);
    }
    container.innerHTML = `<div id="confirm-overlay" onclick="window.Modals.closeConfirmDialog()">${modal}</div>`;
    container.style.display = 'block';

    // Stop propagation on modal click
    container.querySelector('.confirm-modal').addEventListener('click', e => e.stopPropagation());
  },

  /**
   * Toggle between existing CO and new CO sections
   */
  toggleCOLinkOption() {
    const option = document.querySelector('input[name="coLinkOption"]:checked')?.value;
    const existingSection = document.getElementById('existingCOSection');
    const newSection = document.getElementById('newCOSection');

    if (option === 'existing') {
      existingSection.style.display = 'block';
      newSection.style.display = 'none';
    } else {
      existingSection.style.display = 'none';
      newSection.style.display = 'block';
    }
  },

  /**
   * Apply CO link selection and continue with approval
   */
  async applyCOLinkAndApprove(isPartial, totalAllocated, invoiceAmount) {
    const option = document.querySelector('input[name="coLinkOption"]:checked')?.value;

    if (option === 'existing') {
      const select = document.getElementById('coLinkSelect');
      const selectedCO = select?.value;

      if (!selectedCO) {
        window.toasts?.error('Please select a Change Order');
        return;
      }

      // Apply CO link to all unlinked CO allocations
      this.currentAllocations.forEach(a => {
        const isCO = this.isCOCostCode(a.cost_code || a.cost_code_id);
        if (isCO && !a.change_order_id) {
          a.change_order_id = selectedCO;
        }
      });
      this.markDirty();
      this.closeConfirmDialog();

    } else {
      // Create new CO
      const title = document.getElementById('newCOTitle')?.value?.trim();
      const amountStr = document.getElementById('newCOAmount')?.value;
      const amount = window.Validation?.parseCurrency(amountStr) || 0;
      const days = parseInt(document.getElementById('newCODays')?.value) || 0;
      const description = document.getElementById('newCODescription')?.value?.trim();

      if (!title) {
        window.toasts?.error('Please enter a title for the Change Order');
        return;
      }
      if (amount <= 0) {
        window.toasts?.error('Please enter a valid CO amount');
        return;
      }

      // Create the CO via API
      try {
        const jobId = this.currentInvoice?.job_id;
        if (!jobId) {
          window.toasts?.error('No job selected');
          return;
        }

        const response = await fetch(`/api/jobs/${jobId}/change-orders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title,
            description: description || title,
            amount,
            days_added: days,
            reason: 'scope_change',
            status: 'approved',
            internal_approved_by: 'Auto-approved on invoice',
            client_approval_bypassed: true,
            bypass_reason: 'Created during invoice approval'
          })
        });

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || 'Failed to create Change Order');
        }

        const newCO = await response.json();
        window.toasts?.success(`Created CO-${String(newCO.change_order_number).padStart(3, '0')}: ${title}`);

        // Apply CO link to all unlinked CO allocations
        this.currentAllocations.forEach(a => {
          const isCO = this.isCOCostCode(a.cost_code || a.cost_code_id);
          if (isCO && !a.change_order_id) {
            a.change_order_id = newCO.id;
          }
        });
        this.markDirty();

        // Refresh cached COs
        if (this.currentInvoice?.job_id) {
          this.loadFundingSources(this.currentInvoice.job_id);
        }

        this.closeConfirmDialog();

      } catch (err) {
        console.error('Failed to create CO:', err);
        window.toasts?.error('Failed to create Change Order', { details: err.message });
        return;
      }
    }

    // Continue with approval flow
    if (isPartial) {
      this.showPartialApprovalDialog(totalAllocated, invoiceAmount);
    } else {
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
   * Send back invoice - requires a reason
   * Used for both approved → needs_review and ready_for_approval → needs_review
   */
  sendBackInvoice() {
    const currentStatus = this.currentInvoice?.status;
    const statusLabel = currentStatus === 'approved' ? 'approved' : 'ready for approval';

    const modal = `
      <div class="confirm-modal sendback-modal">
        <div class="modal-header">
          <h2>Send Back for Review</h2>
          <button class="modal-close" onclick="window.Modals.closeConfirmDialog()">&times;</button>
        </div>

        <div class="modal-body">
          <div class="confirm-icon confirm-warning">↩️</div>
          <div class="confirm-message">
            <p>Sending invoice <strong>#${this.currentInvoice?.invoice_number || 'N/A'}</strong> back for review.</p>
            <p>This will return it to "Needs Review" status for the accountant to make corrections.</p>
            <p style="margin-top: 12px;"><strong>Reason for sending back: *</strong></p>
            <textarea id="sendBackReasonInput" class="sendback-reason-input" rows="3"
              placeholder="Explain why this invoice needs to be reviewed again..."></textarea>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="window.Modals.closeConfirmDialog()">Cancel</button>
          <button class="btn btn-warning" onclick="window.Modals.submitSendBack()">Send Back</button>
        </div>
      </div>
    `;

    const overlay = document.createElement('div');
    overlay.id = 'confirm-overlay';
    overlay.className = 'confirm-overlay';
    overlay.innerHTML = modal;
    document.body.appendChild(overlay);

    // Focus the textarea
    setTimeout(() => {
      document.getElementById('sendBackReasonInput')?.focus();
    }, 100);
  },

  /**
   * Submit send back with reason
   */
  async submitSendBack() {
    const reasonInput = document.getElementById('sendBackReasonInput');
    const reason = reasonInput?.value?.trim();

    if (!reason) {
      window.toasts?.error('Please provide a reason for sending back');
      reasonInput?.focus();
      return;
    }

    this.closeConfirmDialog();
    await this.saveWithStatus('needs_review', 'Invoice sent back for review', { sendback_reason: reason });
  },

  /**
   * Deny invoice - show dialog for reason then transition to denied status
   */
  denyInvoice() {
    const modal = `
      <div class="confirm-modal denial-modal">
        <div class="modal-header">
          <h2>Deny Invoice</h2>
          <button class="modal-close" onclick="window.Modals.closeConfirmDialog()">&times;</button>
        </div>

        <div class="modal-body">
          <div class="confirm-icon confirm-danger">❌</div>
          <div class="confirm-message">
            <p>Denying invoice <strong>#${this.currentInvoice?.invoice_number || 'N/A'}</strong></p>
            <p>This will send the invoice back to the accountant for corrections.</p>
            <p style="margin-top: 12px;"><strong>Reason for denial:</strong></p>
            <textarea id="denialReasonInput" class="denial-reason-input" rows="3"
              placeholder="Explain why this invoice is being denied..."></textarea>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="window.Modals.closeConfirmDialog()">Cancel</button>
          <button class="btn btn-danger" onclick="window.Modals.submitDenial()">Deny Invoice</button>
        </div>
      </div>
    `;

    const overlay = document.createElement('div');
    overlay.id = 'confirm-overlay';
    overlay.className = 'confirm-overlay';
    overlay.innerHTML = modal;
    document.body.appendChild(overlay);

    // Focus the textarea
    setTimeout(() => {
      document.getElementById('denialReasonInput')?.focus();
    }, 100);
  },

  /**
   * Submit denial with reason
   */
  async submitDenial() {
    const reasonInput = document.getElementById('denialReasonInput');
    const reason = reasonInput?.value?.trim();

    if (!reason) {
      window.toasts?.error('Please provide a reason for denial');
      reasonInput?.focus();
      return;
    }

    this.closeConfirmDialog();
    await this.saveWithStatus('denied', 'Invoice denied', { denial_reason: reason });
  },

  /**
   * Resubmit a denied invoice - transitions back to received for processing
   */
  resubmitInvoice() {
    this.showConfirmDialog({
      title: 'Resubmit Invoice',
      message: 'Resubmit this invoice for processing? It will return to "Received" status for review.',
      confirmText: 'Resubmit',
      type: 'info',
      onConfirm: async () => {
        await this.saveWithStatus('received', 'Invoice resubmitted');
      }
    });
  },

  /**
   * Add invoice to draw - simplified flow
   * Auto-creates draft draw if none exists for the job
   */
  async addToDraw() {
    if (!this.currentInvoice?.job_id) {
      window.toasts?.error('Invoice must have a job assigned');
      return;
    }

    try {
      // Get or create draft draw for this job (one-click flow)
      const drawRes = await fetch(`/api/jobs/${this.currentInvoice.job_id}/current-draw?create=true`);
      if (!drawRes.ok) throw new Error('Failed to get/create draft draw');
      const draw = await drawRes.json();

      // Add invoice to draw
      const addRes = await fetch(`/api/draws/${draw.id}/add-invoices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoice_ids: [this.currentInvoice.id] })
      });

      if (!addRes.ok) {
        const err = await addRes.json();
        throw new Error(err.error || 'Failed to add to draw');
      }

      const result = await addRes.json();

      // Check if this was a partial billing
      if (result.partial_billed > 0 && result.partial_invoices?.length > 0) {
        const partial = result.partial_invoices[0];
        const remaining = window.Validation?.formatCurrency(partial.remaining) || `$${partial.remaining.toFixed(2)}`;
        window.toasts?.info(`Partial amount added to Draw #${draw.draw_number}. ${remaining} remaining to bill.`, {
          action: { label: 'View Draws', href: 'draws.html' },
          duration: 6000
        });
      } else {
        window.toasts?.success(`Added to Draw #${draw.draw_number}`, {
          action: { label: 'View Draws', href: 'draws.html' }
        });
      }

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
          <button class="modal-close" onclick="window.Modals.closeCloseOutDialog()">&times;</button>
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
          <button type="button" class="btn btn-secondary" onclick="window.Modals.closeCloseOutDialog()">
            Cancel
          </button>
          <button type="button" class="btn btn-warning" onclick="window.Modals.executeCloseOut()">
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
   * Unsplit invoice - delete children and restore parent
   */
  unsplitInvoice() {
    try {
      if (!this.currentInvoice?.id) {
        window.toasts?.error('No invoice selected');
        return;
      }

      if (!this.currentInvoice.is_split_parent) {
        window.toasts?.error('This invoice is not a split parent');
        return;
      }

      const invoiceNumber = this.currentInvoice.invoice_number || 'Unknown';

      // Confirm with user
      if (!confirm(`Unsplit invoice #${invoiceNumber}?\n\nThis will delete all child invoices and restore the original invoice.\n\nNote: This cannot be done if any children have been approved.`)) {
        return;
      }

      const loadingToast = window.toasts?.showLoading('Unsplitting invoice...');

      fetch(`/api/invoices/${this.currentInvoice.id}/unsplit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          performed_by: window.currentUser || 'User'
        })
      })
      .then(response => {
        window.toasts?.dismiss(loadingToast);
        if (!response.ok) {
          return response.json().then(err => {
            throw new Error(err.error || 'Unsplit failed');
          });
        }
        return response.json();
      })
      .then(data => {
        window.toasts?.success(data.message || 'Invoice unsplit successfully');
        this.isDirty = false;

        if (this.onSaveCallback) {
          this.onSaveCallback(null);
        }

        this.closeActiveModal();
      })
      .catch(err => {
        console.error('[UNSPLIT] Error:', err);
        window.toasts?.error('Unsplit failed', { details: err.message });
      });

    } catch (err) {
      console.error('[UNSPLIT] Synchronous Error:', err);
      window.toasts?.error('Unsplit error: ' + err.message);
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

    // For 'ready_for_approval' status - need job and allocations
    // (This is when accountant submits to PM for approval)
    if (targetStatus === 'ready_for_approval' || targetStatus === 'needs_approval') {
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
              <button class="modal-close" onclick="window.Modals.closeActiveModal()">&times;</button>
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
                        data-id="${s.job?.id}" onclick="window.Modals.selectJob('${s.job?.id}')">
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
                      onclick="window.Modals.selectJob('${job.id}')">
                      <div class="job-name">${this.escapeHtml(job.name)}</div>
                      <div class="job-address">${this.escapeHtml(job.address || '')}</div>
                    </div>
                  `).join('')}
                </div>
              </div>
            </div>

            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" onclick="window.Modals.closeActiveModal()">
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
          <button class="modal-close" onclick="window.Modals.closeConfirmDialog()">&times;</button>
        </div>

        <div class="modal-body">
          <div class="confirm-icon confirm-${type}">
            ${type === 'warning' ? '⚠️' : type === 'danger' ? '🚨' : 'ℹ️'}
          </div>
          <p class="confirm-message">${message.replace(/\n/g, '<br>')}</p>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-secondary"
            onclick="window.Modals.handleConfirmCancel()">
            ${cancelText}
          </button>
          <button type="button" class="btn btn-${type === 'danger' ? 'danger' : 'primary'}"
            onclick="window.Modals.handleConfirmOk()">
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
   * Enter edit mode - enables all form fields
   */
  enterEditMode() {
    if (this.currentInvoice?.status === 'paid') {
      window.showToast?.('Cannot edit archived invoices', 'error');
      return;
    }
    this.isEditMode = true;
    // Re-render the modal with edit mode enabled
    const modal = this.buildEditModal(
      this.currentInvoice,
      this.currentAllocations,
      this.currentActivity || [],
      this.currentApprovalContext || {}
    );
    const container = document.getElementById('modal-container');
    if (container) {
      container.innerHTML = modal;
      this.populateDropdowns();
    }
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
    const invoice = this.currentInvoice;
    const isArchived = invoice?.status === 'paid';

    // Editable statuses - accountant can edit freely without unlocking
    const editableStatuses = ['needs_review', 'received', 'denied'];
    const isEditableStatus = editableStatuses.includes(invoice?.status);

    // Locked statuses - require explicit unlock to edit
    const lockedStatuses = ['ready_for_approval', 'approved', 'in_draw', 'paid', 'needs_approval'];
    const isLockedStatus = lockedStatuses.includes(invoice?.status);

    // Pickers enabled if: editable status OR (locked status AND in edit mode)
    const pickersDisabled = isArchived || (isLockedStatus && !this.isEditMode);

    try {
      // Initialize Job picker
      const jobContainer = document.getElementById('job-picker-container');
      if (jobContainer && window.SearchablePicker) {
        window.SearchablePicker.init(jobContainer, {
          type: 'jobs',
          value: this.currentInvoice?.job_id || null,
          placeholder: 'Search jobs...',
          disabled: pickersDisabled,
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
          disabled: pickersDisabled,
          onChange: (vendorId) => {
            document.getElementById('edit-vendor').value = vendorId || '';
            this.markDirty();
          }
        });
        // Set initial value on hidden input
        document.getElementById('edit-vendor').value = this.currentInvoice?.vendor_id || '';
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
   * Fetch PO line items for a specific PO
   */
  async fetchPOLineItems(poId) {
    if (!poId) {
      this.currentPOLineItems = [];
      return [];
    }
    try {
      const response = await fetch(`/api/purchase-orders/${poId}`);
      if (!response.ok) return [];
      const po = await response.json();
      this.currentPOLineItems = po.line_items || [];
      return this.currentPOLineItems;
    } catch (err) {
      console.error('Failed to fetch PO line items:', err);
      this.currentPOLineItems = [];
      return [];
    }
  },

  /**
   * Fetch all funding sources (POs and COs) for a job
   * Used to populate allocation funding source dropdowns
   */
  async fetchFundingSources(jobId) {
    if (!jobId) {
      this.cachedPurchaseOrders = [];
      this.cachedChangeOrders = [];
      return { purchase_orders: [], change_orders: [] };
    }
    try {
      const response = await fetch(`/api/jobs/${jobId}/funding-sources`);
      if (!response.ok) {
        this.cachedPurchaseOrders = [];
        this.cachedChangeOrders = [];
        return { purchase_orders: [], change_orders: [] };
      }
      const data = await response.json();
      this.cachedPurchaseOrders = data.purchase_orders || [];
      this.cachedChangeOrders = data.change_orders || [];
      return data;
    } catch (err) {
      console.error('Failed to fetch funding sources:', err);
      this.cachedPurchaseOrders = [];
      this.cachedChangeOrders = [];
      return { purchase_orders: [], change_orders: [] };
    }
  },

  /**
   * Fetch approved change orders for a job (for allocation dropdown)
   * Includes draft and pending COs too since work can be done before approval
   */
  async fetchJobChangeOrders(jobId) {
    if (!jobId) {
      this.cachedChangeOrders = [];
      return [];
    }
    try {
      // Fetch all non-rejected, non-closed COs - work can be coded before CO is approved
      const response = await fetch(`/api/jobs/${jobId}/change-orders`);
      if (!response.ok) {
        this.cachedChangeOrders = [];
        return [];
      }
      const allCOs = await response.json();
      // Filter to show draft, pending_approval, and approved (not rejected or closed)
      this.cachedChangeOrders = allCOs.filter(co =>
        ['draft', 'pending_approval', 'approved'].includes(co.status)
      );
      return this.cachedChangeOrders;
    } catch (err) {
      console.error('Failed to fetch job change orders:', err);
      this.cachedChangeOrders = [];
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
   * Fetch approval context (budget + PO impact) for invoice
   */
  async fetchApprovalContext(invoiceId) {
    try {
      const response = await fetch(`/api/invoices/${invoiceId}/approval-context`);
      if (!response.ok) return { budget: [], po: null };
      return await response.json();
    } catch (err) {
      console.error('Failed to fetch approval context:', err);
      return { budget: [], po: null };
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
   * Convert review flag codes to human-readable labels
   */
  getReviewFlagLabel(flag) {
    const labels = {
      'low_text_quality': 'Document quality is poor - verify extracted data',
      'missing_job_reference': 'No job reference found on invoice',
      'verify_date': 'Invoice date may need verification',
      'verify_amount': 'Amount may need verification',
      'missing_vendor': 'Vendor could not be identified',
      'duplicate_possible': 'Possible duplicate invoice',
      'missing_invoice_number': 'No invoice number found',
      'po_mismatch': 'PO reference may not match'
    };
    return labels[flag] || flag.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  },

  /**
   * Clear review flags for an invoice
   */
  async clearReviewFlags(invoiceId) {
    try {
      const res = await fetch(`/api/invoices/${invoiceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          needs_review: false,
          review_flags: []
        })
      });

      if (!res.ok) throw new Error('Failed to clear flags');

      window.showToast?.('Review flags cleared', 'success');

      // Refresh the invoice view
      if (this.currentInvoice && this.currentInvoice.id === invoiceId) {
        this.currentInvoice.needs_review = false;
        this.currentInvoice.review_flags = [];
        this.openInvoice(invoiceId);
      }

      // Refresh the main list
      if (typeof refreshInvoices === 'function') {
        refreshInvoices();
      }
    } catch (err) {
      console.error('Error clearing flags:', err);
      window.showToast?.('Failed to clear flags', 'error');
    }
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

// ============================================
// SPLIT INVOICE MODAL
// ============================================

const SplitModal = {
  invoice: null,
  splits: [],
  jobs: [],

  async show(invoice) {
    console.log('[SplitModal] show() called with invoice:', invoice);

    if (!invoice) {
      console.error('[SplitModal] No invoice provided');
      window.toasts?.error('No invoice selected');
      return;
    }

    this.invoice = invoice;
    this.splits = [];
    this.jobs = [];

    // Fetch jobs for optional assignment
    try {
      const res = await fetch('/api/jobs');
      if (res.ok) {
        this.jobs = await res.json();
        console.log('[SplitModal] Loaded', this.jobs.length, 'jobs');
      }
    } catch (err) {
      console.error('[SplitModal] Error fetching jobs:', err);
    }

    // Set original invoice info
    document.getElementById('splitOriginalNumber').textContent = invoice.invoice_number || 'N/A';
    document.getElementById('splitOriginalVendor').textContent = invoice.vendor?.name || 'Unknown Vendor';
    document.getElementById('splitOriginalAmount').textContent = this.formatMoney(invoice.amount);

    // Clear existing splits and add two default
    document.getElementById('splitSections').innerHTML = '';
    this.addSplit();
    this.addSplit();

    // Show modal - need to add 'show' class for CSS transitions
    const modal = document.getElementById('splitInvoiceModal');
    modal.style.display = 'flex';
    // Force reflow for transition
    modal.offsetHeight;
    modal.classList.add('show');
  },

  close() {
    const modal = document.getElementById('splitInvoiceModal');
    modal.classList.remove('show');
    // Allow transition to complete before hiding
    setTimeout(() => {
      modal.style.display = 'none';
    }, 150);
    this.invoice = null;
    this.splits = [];
  },

  addSplit() {
    const index = this.splits.length;
    this.splits.push({ amount: 0, job_id: '', notes: '' });

    const container = document.getElementById('splitSections');
    const section = document.createElement('div');
    section.className = 'split-section';
    section.id = `split-section-${index}`;

    // Build job options - filter to active jobs only
    const jobOptions = this.jobs
      .filter(j => j.status === 'active')
      .map(j => `<option value="${j.id}">${this.escapeHtml(j.name)}</option>`)
      .join('');

    section.innerHTML = `
      <div class="split-section-header">
        <div class="split-section-title" id="split-title-${index}">Split - $0.00</div>
        ${index >= 2 ? `<button class="split-section-remove" onclick="SplitModal.removeSplit(${index})" title="Remove">&times;</button>` : ''}
      </div>
      <div class="split-section-row">
        <div class="form-group split-job">
          <label>Job *</label>
          <select id="split-job-${index}" class="form-control" onchange="SplitModal.updateTotals()">
            <option value="">Select job...</option>
            ${jobOptions}
          </select>
        </div>
        <div class="form-group split-amount">
          <label>Amount *</label>
          <input type="number" id="split-amount-${index}" class="form-control" step="0.01" min="0.01" placeholder="0.00" oninput="SplitModal.updateTotals()">
        </div>
        <div class="form-group split-notes">
          <label>Notes</label>
          <input type="text" id="split-notes-${index}" class="form-control" placeholder="Optional...">
        </div>
      </div>
    `;

    container.appendChild(section);
    this.updateTotals();
  },

  removeSplit(index) {
    // Don't allow removing if only 2 active splits left
    const activeSplits = this.splits.filter(s => s !== null).length;
    if (activeSplits <= 2) {
      window.toasts?.warning('Must have at least 2 splits');
      return;
    }

    // Remove from DOM
    const section = document.getElementById(`split-section-${index}`);
    if (section) {
      section.remove();
    }

    // Mark as removed (don't reindex to avoid confusion)
    this.splits[index] = null;
    this.updateTotals();
  },

  updateTotals() {
    let total = 0;

    // Collect amounts and jobs from active splits
    this.splits.forEach((split, index) => {
      if (split === null) return; // Skip removed

      const amountInput = document.getElementById(`split-amount-${index}`);
      const jobSelect = document.getElementById(`split-job-${index}`);
      const titleEl = document.getElementById(`split-title-${index}`);

      if (amountInput) {
        const amount = parseFloat(amountInput.value) || 0;
        split.amount = amount;
        total += amount;

        // Update title with amount
        if (titleEl) {
          titleEl.textContent = `Split - ${this.formatMoney(amount)}`;
        }
      }
      if (jobSelect) {
        split.job_id = jobSelect.value;
      }
    });

    const invoiceAmount = parseFloat(this.invoice?.amount) || 0;
    const remaining = invoiceAmount - total;

    document.getElementById('splitAllocatedAmount').textContent = this.formatMoney(total);

    const remainingEl = document.getElementById('splitRemainingAmount');
    remainingEl.textContent = this.formatMoney(remaining);
    remainingEl.className = 'remaining';

    if (Math.abs(remaining) < 0.01) {
      remainingEl.classList.add('balanced');
      remainingEl.textContent = '$0.00 ✓';
    } else if (remaining < 0) {
      remainingEl.classList.add('error');
    }

    // Validate: each split needs job + amount, amounts must balance
    const validSplits = this.splits.filter(s => s !== null && s.amount > 0 && s.job_id);
    const amountsBalance = Math.abs(remaining) < 0.01;
    const canSplit = validSplits.length >= 2 && amountsBalance;

    document.getElementById('confirmSplitBtn').disabled = !canSplit;
  },

  async confirm() {
    // Collect valid splits - both amount and job required
    const validSplits = this.splits
      .map((split, index) => {
        if (split === null) return null;

        const amountInput = document.getElementById(`split-amount-${index}`);
        const jobSelect = document.getElementById(`split-job-${index}`);
        const notesInput = document.getElementById(`split-notes-${index}`);

        return {
          amount: parseFloat(amountInput?.value) || 0,
          job_id: jobSelect?.value || null,
          notes: notesInput?.value || ''
        };
      })
      .filter(s => s && s.amount > 0 && s.job_id);

    // Validate - need 2+ splits with amounts and jobs
    if (validSplits.length < 2) {
      window.toasts?.error('Each split needs a job and amount');
      return;
    }

    const totalAmount = validSplits.reduce((sum, s) => sum + s.amount, 0);
    const invoiceAmount = parseFloat(this.invoice?.amount) || 0;
    if (Math.abs(totalAmount - invoiceAmount) > 0.01) {
      window.toasts?.error('Split amounts must equal invoice total');
      return;
    }

    // Call API
    try {
      const res = await fetch(`/api/invoices/${this.invoice.id}/split`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          splits: validSplits,
          performed_by: 'User' // TODO: Get actual user name
        })
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || 'Split failed');
      }

      window.toasts?.success(`Invoice split into ${result.children?.length || 0} parts`);
      this.close();

      // Refresh invoice list
      if (typeof loadInvoices === 'function') {
        loadInvoices();
      }
    } catch (err) {
      console.error('Split error:', err);
      window.toasts?.error('Failed to split invoice', { details: err.message });
    }
  },

  formatMoney(amount) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  },

  escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
};

// Global functions for onclick handlers
window.showSplitModal = async (invoice) => {
  console.log('[showSplitModal] Called with:', invoice);
  try {
    await SplitModal.show(invoice);
    console.log('[showSplitModal] Completed successfully');
  } catch (err) {
    console.error('[showSplitModal] Error:', err);
    window.toasts?.error('Failed to open split modal: ' + err.message);
  }
};
window.closeSplitModal = () => SplitModal.close();
window.addSplitSection = () => SplitModal.addSplit();
window.confirmSplit = () => SplitModal.confirm();
window.SplitModal = SplitModal;

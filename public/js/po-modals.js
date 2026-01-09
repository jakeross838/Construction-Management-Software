// ============================================================
// PO MODALS - Two Panel Layout (Monday.com Light Theme)
// ============================================================

class POModals {
  constructor() {
    this.currentPO = null;
    this.currentLineItems = [];
    this.attachments = [];
    this.isEditing = false;
  }

  // ============================================================
  // MODAL MANAGEMENT
  // ============================================================

  openModal() {
    document.getElementById('poModal').classList.add('show');
  }

  closeModal() {
    document.getElementById('poModal').classList.remove('show');
    this.currentPO = null;
    this.currentLineItems = [];
    this.attachments = [];
    this.isEditing = false;
  }

  // ============================================================
  // OPEN EXISTING PO
  // ============================================================

  async openPO(poId) {
    try {
      document.getElementById('poModalBody').innerHTML = '<div class="loading">Loading...</div>';
      this.openModal();

      const res = await fetch(`/api/purchase-orders/${poId}`);
      if (!res.ok) throw new Error('Failed to load PO');

      this.currentPO = await res.json();
      this.currentLineItems = this.currentPO.line_items || [];

      const [invRes, actRes, attRes] = await Promise.all([
        fetch(`/api/purchase-orders/${poId}/invoices`),
        fetch(`/api/purchase-orders/${poId}/activity`),
        fetch(`/api/purchase-orders/${poId}/attachments`)
      ]);

      this.currentPO.invoices = await invRes.json();
      this.currentPO.activity = await actRes.json();
      this.attachments = await attRes.json();

      this.renderPOModal();
    } catch (err) {
      console.error('Failed to open PO:', err);
      window.showToast?.('Failed to load purchase order', 'error');
      this.closeModal();
    }
  }

  // ============================================================
  // CREATE NEW PO
  // ============================================================

  showCreateModal() {
    this.currentPO = {
      po_number: '',
      job_id: null,
      vendor_id: null,
      description: '',
      scope_of_work: '',
      total_amount: 0,
      status: 'open',
      status_detail: 'pending',
      approval_status: 'pending',
      notes: '',
      assigned_to: '',
      schedule_start_date: null,
      schedule_end_date: null
    };
    this.currentLineItems = [];
    this.attachments = [];
    this.isEditing = true;

    this.renderPOModal();
    this.openModal();
  }

  // ============================================================
  // RENDER MODAL - TWO PANEL LAYOUT
  // ============================================================

  renderPOModal() {
    const po = this.currentPO;
    const isNew = !po.id;

    // Update title
    document.getElementById('poModalTitle').textContent = isNew ? 'New Purchase Order' : (po.po_number || 'Purchase Order');

    // Update status badge
    const statusBadge = document.getElementById('poStatusBadge');
    if (statusBadge) {
      if (isNew) {
        statusBadge.style.display = 'none';
      } else {
        statusBadge.style.display = '';
        statusBadge.className = `status-badge status-${this.getStatusClass(po.status_detail, po.approval_status)}`;
        statusBadge.textContent = this.getStatusLabel(po.status_detail, po.approval_status);
      }
    }

    // Render two-panel body
    const body = document.getElementById('poModalBody');
    body.innerHTML = this.renderTwoPanelLayout();

    this.renderFooterActions();

    // Initialize pickers if editing
    if (this.isEditing || isNew) {
      setTimeout(() => this.initializePickers(), 50);
    }

    // Setup file upload handler
    this.setupFileUpload();
  }

  // ============================================================
  // TWO PANEL LAYOUT
  // ============================================================

  renderTwoPanelLayout() {
    const po = this.currentPO;
    const isNew = !po.id;
    const canEdit = isNew || this.isEditing;

    return `
      <div class="modal-split-view po-modal-split">
        <!-- Left Panel: Summary Info -->
        <div class="po-summary-panel">
          ${this.renderSummaryPanel(isNew)}
        </div>

        <!-- Right Panel: Form/Details -->
        <div class="form-panel">
          ${canEdit ? this.renderEditForm() : this.renderReadOnlyDetails()}
        </div>
      </div>
    `;
  }

  // ============================================================
  // SUMMARY PANEL (Left Side)
  // ============================================================

  renderSummaryPanel(isNew) {
    const po = this.currentPO;
    const vendor = po.vendor || window.poState?.vendors?.find(v => v.id === po.vendor_id);
    const job = po.job || window.poState?.jobs?.find(j => j.id === po.job_id);

    const totalAmount = parseFloat(po.total_amount || 0);
    const billedAmount = (po.invoices || [])
      .filter(inv => ['approved', 'in_draw', 'paid'].includes(inv.status))
      .reduce((sum, inv) => sum + parseFloat(inv.amount || 0), 0);
    const remainingAmount = totalAmount - billedAmount;
    const billedPercent = totalAmount > 0 ? Math.round((billedAmount / totalAmount) * 100) : 0;

    if (isNew) {
      return `
        <div class="po-summary-placeholder">
          <div class="placeholder-icon">📋</div>
          <p>Fill in the details to create a new Purchase Order</p>
        </div>
      `;
    }

    return `
      <!-- Amount Summary Card -->
      <div class="po-amount-card">
        <div class="amount-header">
          <span class="amount-label">PO Total</span>
          <span class="amount-value">${this.formatMoney(totalAmount)}</span>
        </div>

        <div class="progress-section">
          <div class="progress-bar">
            <div class="progress-fill ${billedPercent > 100 ? 'over' : ''}" style="width: ${Math.min(billedPercent, 100)}%"></div>
          </div>
          <div class="progress-labels">
            <div class="progress-item">
              <span class="label">Billed</span>
              <span class="value">${this.formatMoney(billedAmount)}</span>
            </div>
            <div class="progress-item">
              <span class="label">Remaining</span>
              <span class="value ${remainingAmount < 0 ? 'negative' : ''}">${this.formatMoney(remainingAmount)}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Job & Vendor Info -->
      <div class="po-info-card">
        <h4>Details</h4>
        <div class="info-grid">
          <div class="info-item">
            <span class="label">Job</span>
            <span class="value">${job?.name || '—'}</span>
          </div>
          <div class="info-item">
            <span class="label">Vendor</span>
            <span class="value">${vendor?.name || '—'}</span>
          </div>
          ${po.description ? `
          <div class="info-item full-width">
            <span class="label">Description</span>
            <span class="value">${this.escapeHtml(po.description)}</span>
          </div>
          ` : ''}
          ${po.approved_at ? `
          <div class="info-item">
            <span class="label">Approved</span>
            <span class="value">${this.formatDate(po.approved_at)}</span>
          </div>
          ` : ''}
          <div class="info-item">
            <span class="label">Created</span>
            <span class="value">${this.formatDate(po.created_at)}</span>
          </div>
        </div>
      </div>

      <!-- Linked Invoices -->
      ${this.renderLinkedInvoices()}

      <!-- Attachments -->
      ${this.renderAttachmentsSection()}
    `;
  }

  // ============================================================
  // LINKED INVOICES
  // ============================================================

  renderLinkedInvoices() {
    const invoices = this.currentPO.invoices || [];

    return `
      <div class="po-invoices-card">
        <div class="card-header">
          <h4>Linked Invoices</h4>
          ${invoices.length > 0 ? `<span class="count">${invoices.length}</span>` : ''}
        </div>

        ${invoices.length === 0 ? `
          <div class="empty-message">No invoices linked to this PO</div>
        ` : `
          <div class="invoices-list">
            ${invoices.map(inv => `
              <div class="invoice-row" onclick="window.poModals.openInvoice('${inv.id}')">
                <div class="invoice-main">
                  <span class="invoice-number">${inv.invoice_number || 'No Number'}</span>
                  <span class="invoice-vendor">${inv.vendor?.name || ''}</span>
                </div>
                <div class="invoice-meta">
                  <span class="invoice-amount">${this.formatMoney(inv.amount)}</span>
                  <span class="invoice-status status-${inv.status}">${this.formatStatus(inv.status)}</span>
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    `;
  }

  openInvoice(invoiceId) {
    // Close PO modal and navigate to invoice
    this.closeModal();
    // Navigate to invoices page with the specific invoice ID
    window.location.href = `index.html?openInvoice=${invoiceId}`;
  }

  // ============================================================
  // ATTACHMENTS SECTION
  // ============================================================

  renderAttachmentsSection() {
    const isNew = !this.currentPO.id;

    return `
      <div class="po-attachments-card">
        <div class="card-header">
          <h4>Attachments</h4>
          ${this.attachments.length > 0 ? `<span class="count">${this.attachments.length}</span>` : ''}
        </div>

        ${!isNew ? `
        <div class="upload-zone" id="uploadZone">
          <input type="file" id="fileInput" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg" style="display:none">
          <div class="upload-content" onclick="document.getElementById('fileInput').click()">
            <span class="upload-icon">📎</span>
            <span class="upload-text">Drop files here or click to upload</span>
          </div>
        </div>
        ` : ''}

        ${this.attachments.length === 0 ? `
          <div class="empty-message">No attachments</div>
        ` : `
          <div class="attachments-list">
            ${this.attachments.map(att => `
              <div class="attachment-row">
                <span class="att-icon">${this.getFileIcon(att.file_type)}</span>
                <span class="att-name" title="${this.escapeHtml(att.file_name)}">${this.escapeHtml(att.file_name)}</span>
                <div class="att-actions">
                  <button class="btn-icon" onclick="window.poModals.downloadAttachment('${att.id}')" title="Download">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="7 10 12 15 17 10"/>
                      <line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                  </button>
                  <button class="btn-icon danger" onclick="window.poModals.deleteAttachment('${att.id}')" title="Delete">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="3 6 5 6 21 6"/>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    `;
  }

  setupFileUpload() {
    const fileInput = document.getElementById('fileInput');
    const uploadZone = document.getElementById('uploadZone');

    if (!fileInput || !uploadZone) return;

    fileInput.addEventListener('change', (e) => {
      const files = e.target.files;
      if (files.length > 0) {
        this.uploadFiles(files);
      }
    });

    // Drag and drop
    uploadZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      uploadZone.classList.add('dragover');
    });

    uploadZone.addEventListener('dragleave', () => {
      uploadZone.classList.remove('dragover');
    });

    uploadZone.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadZone.classList.remove('dragover');
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        this.uploadFiles(files);
      }
    });
  }

  async uploadFiles(files) {
    if (!this.currentPO.id) return;

    for (const file of files) {
      const formData = new FormData();
      formData.append('file', file);

      try {
        const res = await fetch(`/api/purchase-orders/${this.currentPO.id}/attachments`, {
          method: 'POST',
          body: formData
        });

        if (!res.ok) throw new Error('Upload failed');
        window.showToast?.(`Uploaded ${file.name}`, 'success');
      } catch (err) {
        window.showToast?.(`Failed to upload ${file.name}`, 'error');
      }
    }

    // Refresh attachments
    const attRes = await fetch(`/api/purchase-orders/${this.currentPO.id}/attachments`);
    this.attachments = await attRes.json();
    this.renderPOModal();
  }

  // ============================================================
  // EDIT FORM (Right Panel)
  // ============================================================

  renderEditForm() {
    const po = this.currentPO;
    const isNew = !po.id;
    const costCodes = window.poState?.costCodes || [];
    const total = this.currentLineItems.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);

    return `
      <form id="po-edit-form" onsubmit="return false;">
        <!-- PO Details Section -->
        <div class="form-section">
          <h3>PO Details</h3>

          <div class="form-group">
            <label>PO Number</label>
            <input type="text" id="poNumber" value="${this.escapeHtml(po.po_number || '')}" placeholder="Auto-generated if left blank" class="form-control">
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Job *</label>
              <div id="po-job-picker-container"></div>
            </div>
            <div class="form-group">
              <label>Vendor *</label>
              <div id="po-vendor-picker-container"></div>
            </div>
          </div>

          <div class="form-group">
            <label>Description</label>
            <input type="text" id="poDescription" value="${this.escapeHtml(po.description || '')}" placeholder="Brief description of this PO" class="form-control">
          </div>
        </div>

        <!-- Line Items Section -->
        <div class="form-section">
          <div class="section-header">
            <h3>Line Items</h3>
            <button type="button" class="btn btn-sm btn-secondary" onclick="window.poModals.addLineItem()">+ Add Line</button>
          </div>

          <div class="line-items-container" id="lineItemsContainer">
            ${this.currentLineItems.length === 0 ? `
              <div class="empty-message">No line items added yet</div>
            ` : this.currentLineItems.map((item, index) => this.renderLineItemRow(item, index, costCodes)).join('')}
          </div>

          <div class="line-items-total">
            <span class="label">Total:</span>
            <span class="value" id="lineItemsTotal">${this.formatMoney(total)}</span>
          </div>
        </div>

        <!-- Scope & Notes Section -->
        <div class="form-section">
          <h3>Scope & Notes</h3>

          <div class="form-group">
            <label>Scope of Work</label>
            <textarea id="poScopeOfWork" rows="4" class="form-control" placeholder="Describe the work to be performed...">${this.escapeHtml(po.scope_of_work || '')}</textarea>
          </div>

          <div class="form-group">
            <label>Internal Notes</label>
            <textarea id="poNotes" rows="2" class="form-control" placeholder="Internal notes (not shown on PO)...">${this.escapeHtml(po.notes || '')}</textarea>
          </div>
        </div>
      </form>
    `;
  }

  renderLineItemRow(item, index, costCodes) {
    return `
      <div class="line-item-row" data-index="${index}">
        <div class="line-item-fields">
          <select class="form-control cost-code-select" onchange="window.poModals.updateLineItem(${index}, 'cost_code_id', this.value)">
            <option value="">Select cost code...</option>
            ${costCodes.map(cc => `
              <option value="${cc.id}" ${item.cost_code_id === cc.id ? 'selected' : ''}>${cc.code} - ${cc.name}</option>
            `).join('')}
          </select>
          <input type="text" placeholder="Description (optional)" value="${this.escapeHtml(item.description || '')}"
            class="form-control desc-input" onchange="window.poModals.updateLineItem(${index}, 'description', this.value)">
          <input type="number" placeholder="0.00" value="${item.amount || ''}" step="0.01"
            class="form-control amount-input" onchange="window.poModals.updateLineItem(${index}, 'amount', this.value)">
        </div>
        <button type="button" class="btn-remove" onclick="window.poModals.removeLineItem(${index})" title="Remove">×</button>
      </div>
    `;
  }

  // ============================================================
  // READ-ONLY DETAILS (Right Panel)
  // ============================================================

  renderReadOnlyDetails() {
    const po = this.currentPO;
    const costCodes = window.poState?.costCodes || [];
    const total = this.currentLineItems.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);

    return `
      <div class="po-readonly-view">
        <!-- Line Items Section -->
        <div class="form-section">
          <h3>Line Items</h3>

          ${this.currentLineItems.length === 0 ? `
            <div class="empty-message">No line items</div>
          ` : `
            <div class="line-items-readonly">
              ${this.currentLineItems.map(item => {
                const cc = item.cost_code || costCodes.find(c => c.id === item.cost_code_id);
                return `
                  <div class="line-item-display">
                    <div class="item-left">
                      <span class="item-code">${cc?.code || '—'}</span>
                      <span class="item-name">${cc?.name || item.description || 'No description'}</span>
                    </div>
                    <span class="item-amount">${this.formatMoney(item.amount)}</span>
                  </div>
                `;
              }).join('')}

              <div class="line-items-total-row">
                <span>Total</span>
                <span>${this.formatMoney(total)}</span>
              </div>
            </div>
          `}
        </div>

        <!-- Scope of Work -->
        ${po.scope_of_work ? `
        <div class="form-section">
          <h3>Scope of Work</h3>
          <div class="text-content">${this.escapeHtml(po.scope_of_work).replace(/\n/g, '<br>')}</div>
        </div>
        ` : ''}

        <!-- Notes -->
        ${po.notes ? `
        <div class="form-section">
          <h3>Internal Notes</h3>
          <div class="text-content">${this.escapeHtml(po.notes).replace(/\n/g, '<br>')}</div>
        </div>
        ` : ''}

        <!-- Activity Log -->
        ${this.renderActivitySection()}
      </div>
    `;
  }

  renderActivitySection() {
    const activity = this.currentPO.activity || [];

    if (activity.length === 0) return '';

    return `
      <div class="form-section activity-section">
        <h3>Activity</h3>
        <div class="activity-timeline">
          ${activity.slice(0, 10).map(act => `
            <div class="activity-event">
              <div class="activity-dot"></div>
              <div class="activity-content">
                <span class="activity-label">${this.escapeHtml(act.description || act.action)}</span>
                <span class="activity-time">${this.formatRelativeTime(act.created_at)}${act.user_name ? ` by ${act.user_name}` : ''}</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // ============================================================
  // FOOTER ACTIONS
  // ============================================================

  renderFooterActions() {
    const po = this.currentPO;
    const isNew = !po.id;
    const footer = document.getElementById('poModalFooter');

    let html = '<div class="footer-left">';
    let htmlRight = '<div class="footer-right">';

    if (isNew) {
      html += '</div>';
      htmlRight += `
        <button class="btn btn-secondary" onclick="window.poModals.closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="window.poModals.savePO()">Create PO</button>
      </div>`;
    } else if (this.isEditing) {
      html += '</div>';
      htmlRight += `
        <button class="btn btn-secondary" onclick="window.poModals.cancelEdit()">Cancel</button>
        <button class="btn btn-primary" onclick="window.poModals.savePO()">Save Changes</button>
      </div>`;
    } else {
      const status = po.status_detail || 'pending';
      const approval = po.approval_status || 'pending';

      // Left side - destructive actions
      if (status === 'pending') {
        html += `<button class="btn btn-danger-outline" onclick="window.poModals.deletePO()">Delete</button>`;
      }
      html += '</div>';

      // Right side - primary actions
      htmlRight += `<button class="btn btn-secondary" onclick="window.poModals.closeModal()">Close</button>`;

      if (status !== 'closed') {
        htmlRight += `<button class="btn btn-secondary" onclick="window.poModals.startEdit()">Edit</button>`;
      }

      if (status === 'pending' && approval === 'pending') {
        htmlRight += `<button class="btn btn-primary" onclick="window.poModals.submitForApproval()">Submit for Approval</button>`;
      } else if (approval === 'pending' && status !== 'pending') {
        htmlRight += `<button class="btn btn-danger-outline" onclick="window.poModals.rejectPO()">Reject</button>`;
        htmlRight += `<button class="btn btn-success" onclick="window.poModals.approvePO()">Approve</button>`;
      } else if (['approved', 'active'].includes(status)) {
        htmlRight += `<button class="btn btn-secondary" onclick="window.poModals.closePO()">Close PO</button>`;
      } else if (status === 'closed') {
        htmlRight += `<button class="btn btn-secondary" onclick="window.poModals.reopenPO()">Reopen</button>`;
      }

      htmlRight += '</div>';
    }

    footer.innerHTML = html + htmlRight;
  }

  // ============================================================
  // EDIT MODE
  // ============================================================

  startEdit() {
    this.isEditing = true;
    this.renderPOModal();
  }

  cancelEdit() {
    this.isEditing = false;
    if (this.currentPO.id) {
      this.openPO(this.currentPO.id);
    } else {
      this.closeModal();
    }
  }

  // ============================================================
  // LINE ITEM MANAGEMENT
  // ============================================================

  addLineItem() {
    this.currentLineItems.push({
      cost_code_id: null,
      description: '',
      amount: 0
    });
    this.refreshLineItems();
  }

  updateLineItem(index, field, value) {
    if (this.currentLineItems[index]) {
      this.currentLineItems[index][field] = value;
      if (field === 'amount') {
        this.updateLineItemsTotal();
      }
    }
  }

  removeLineItem(index) {
    this.currentLineItems.splice(index, 1);
    this.refreshLineItems();
  }

  refreshLineItems() {
    const container = document.getElementById('lineItemsContainer');
    if (!container) return;

    const costCodes = window.poState?.costCodes || [];

    if (this.currentLineItems.length === 0) {
      container.innerHTML = '<div class="empty-message">No line items added yet</div>';
    } else {
      container.innerHTML = this.currentLineItems.map((item, index) =>
        this.renderLineItemRow(item, index, costCodes)
      ).join('');
    }

    this.updateLineItemsTotal();
  }

  updateLineItemsTotal() {
    const total = this.currentLineItems.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
    const el = document.getElementById('lineItemsTotal');
    if (el) el.textContent = this.formatMoney(total);
  }

  // ============================================================
  // SAVE PO
  // ============================================================

  async savePO() {
    const po = this.currentPO;
    const isNew = !po.id;

    const poNumber = document.getElementById('poNumber')?.value?.trim();
    const description = document.getElementById('poDescription')?.value?.trim();
    const scopeOfWork = document.getElementById('poScopeOfWork')?.value?.trim();
    const notes = document.getElementById('poNotes')?.value?.trim();

    const jobId = this.selectedJobId || po.job_id;
    const vendorId = this.selectedVendorId || po.vendor_id;

    if (!jobId) {
      window.showToast?.('Please select a job', 'error');
      return;
    }
    if (!vendorId) {
      window.showToast?.('Please select a vendor', 'error');
      return;
    }

    const totalAmount = this.currentLineItems.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);

    const data = {
      po_number: poNumber || null,
      job_id: jobId,
      vendor_id: vendorId,
      description,
      scope_of_work: scopeOfWork,
      notes,
      total_amount: totalAmount,
      line_items: this.currentLineItems.filter(li => li.cost_code_id || li.description || li.amount)
    };

    try {
      let res;
      if (isNew) {
        res = await fetch('/api/purchase-orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
      } else {
        res = await fetch(`/api/purchase-orders/${po.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
      }

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save');
      }

      const saved = await res.json();
      window.showToast?.(isNew ? 'Purchase Order created' : 'Purchase Order updated', 'success');

      if (window.loadPOs) window.loadPOs();

      this.isEditing = false;
      this.openPO(saved.id);
    } catch (err) {
      console.error('Save error:', err);
      window.showToast?.(err.message || 'Failed to save', 'error');
    }
  }

  // ============================================================
  // PO ACTIONS
  // ============================================================

  async submitForApproval() {
    if (!confirm('Submit this PO for approval?')) return;

    try {
      const res = await fetch(`/api/purchase-orders/${this.currentPO.id}/submit`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to submit');

      window.showToast?.('PO submitted for approval', 'success');
      if (window.loadPOs) window.loadPOs();
      this.openPO(this.currentPO.id);
    } catch (err) {
      window.showToast?.(err.message, 'error');
    }
  }

  async approvePO() {
    if (!confirm('Approve this Purchase Order?')) return;

    try {
      const res = await fetch(`/api/purchase-orders/${this.currentPO.id}/approve`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to approve');

      window.showToast?.('PO approved', 'success');
      if (window.loadPOs) window.loadPOs();
      this.openPO(this.currentPO.id);
    } catch (err) {
      window.showToast?.(err.message, 'error');
    }
  }

  async rejectPO() {
    const reason = prompt('Reason for rejection (optional):');
    if (reason === null) return;

    try {
      const res = await fetch(`/api/purchase-orders/${this.currentPO.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      });
      if (!res.ok) throw new Error('Failed to reject');

      window.showToast?.('PO rejected', 'success');
      if (window.loadPOs) window.loadPOs();
      this.openPO(this.currentPO.id);
    } catch (err) {
      window.showToast?.(err.message, 'error');
    }
  }

  async closePO() {
    if (!confirm('Close this PO? It will no longer accept new invoices.')) return;

    try {
      const res = await fetch(`/api/purchase-orders/${this.currentPO.id}/close`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to close');

      window.showToast?.('PO closed', 'success');
      if (window.loadPOs) window.loadPOs();
      this.openPO(this.currentPO.id);
    } catch (err) {
      window.showToast?.(err.message, 'error');
    }
  }

  async reopenPO() {
    if (!confirm('Reopen this PO?')) return;

    try {
      const res = await fetch(`/api/purchase-orders/${this.currentPO.id}/reopen`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to reopen');

      window.showToast?.('PO reopened', 'success');
      if (window.loadPOs) window.loadPOs();
      this.openPO(this.currentPO.id);
    } catch (err) {
      window.showToast?.(err.message, 'error');
    }
  }

  async deletePO() {
    if (!confirm('Delete this PO? This cannot be undone.')) return;

    try {
      const res = await fetch(`/api/purchase-orders/${this.currentPO.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');

      window.showToast?.('PO deleted', 'success');
      if (window.loadPOs) window.loadPOs();
      this.closeModal();
    } catch (err) {
      window.showToast?.(err.message, 'error');
    }
  }

  // ============================================================
  // ATTACHMENTS
  // ============================================================

  async downloadAttachment(attachmentId) {
    window.open(`/api/attachments/${attachmentId}/download`, '_blank');
  }

  async deleteAttachment(attachmentId) {
    if (!confirm('Delete this attachment?')) return;

    try {
      const res = await fetch(`/api/attachments/${attachmentId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');

      window.showToast?.('Attachment deleted', 'success');

      // Refresh attachments
      const attRes = await fetch(`/api/purchase-orders/${this.currentPO.id}/attachments`);
      this.attachments = await attRes.json();
      this.renderPOModal();
    } catch (err) {
      window.showToast?.(err.message, 'error');
    }
  }

  // ============================================================
  // PICKERS INITIALIZATION
  // ============================================================

  initializePickers() {
    const jobs = window.poState?.jobs || [];
    const vendors = window.poState?.vendors || [];

    const jobContainer = document.getElementById('po-job-picker-container');
    if (jobContainer) {
      jobContainer.innerHTML = `
        <select id="poJobSelect" class="form-control" onchange="window.poModals.selectedJobId = this.value">
          <option value="">Select Job...</option>
          ${jobs.map(j => `<option value="${j.id}" ${j.id === this.currentPO.job_id ? 'selected' : ''}>${j.name}</option>`).join('')}
        </select>
      `;
      this.selectedJobId = this.currentPO.job_id;
    }

    const vendorContainer = document.getElementById('po-vendor-picker-container');
    if (vendorContainer) {
      vendorContainer.innerHTML = `
        <select id="poVendorSelect" class="form-control" onchange="window.poModals.selectedVendorId = this.value">
          <option value="">Select Vendor...</option>
          ${vendors.map(v => `<option value="${v.id}" ${v.id === this.currentPO.vendor_id ? 'selected' : ''}>${v.name}</option>`).join('')}
        </select>
      `;
      this.selectedVendorId = this.currentPO.vendor_id;
    }
  }

  // ============================================================
  // UTILITY FUNCTIONS
  // ============================================================

  formatMoney(amount) {
    const num = parseFloat(amount) || 0;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(num);
  }

  formatDate(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  formatRelativeTime(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return this.formatDate(dateStr);
  }

  formatStatus(status) {
    const labels = {
      'received': 'Received',
      'needs_approval': 'Needs Approval',
      'approved': 'Approved',
      'in_draw': 'In Draw',
      'paid': 'Paid',
      'denied': 'Denied'
    };
    return labels[status] || status;
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  getStatusClass(statusDetail, approvalStatus) {
    if (approvalStatus === 'rejected') return 'rejected';
    if (approvalStatus === 'approved') return 'approved';
    if (statusDetail === 'closed') return 'closed';
    if (statusDetail === 'active') return 'active';
    return 'draft';
  }

  getStatusLabel(statusDetail, approvalStatus) {
    if (approvalStatus === 'rejected') return 'Rejected';
    if (approvalStatus === 'approved' && statusDetail === 'closed') return 'Closed';
    if (approvalStatus === 'approved') return 'Approved';
    if (statusDetail === 'active') return 'Active';
    return 'Draft';
  }

  getFileIcon(fileType) {
    if (!fileType) return '📎';
    if (fileType.includes('pdf')) return '📄';
    if (fileType.includes('image')) return '🖼️';
    if (fileType.includes('excel') || fileType.includes('spreadsheet')) return '📊';
    if (fileType.includes('word') || fileType.includes('document')) return '📝';
    return '📎';
  }
}

// Initialize global instance
window.poModals = new POModals();

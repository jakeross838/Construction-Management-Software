// ============================================================
// PO MODALS - Unified Two Panel Layout
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
      notes: ''
    };
    this.currentLineItems = [];
    this.attachments = [];
    this.isEditing = true;

    this.renderPOModal();
    this.openModal();
  }

  // ============================================================
  // RENDER MODAL
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

    // Render body
    const body = document.getElementById('poModalBody');
    body.innerHTML = this.renderLayout();

    this.renderFooterActions();

    // Initialize pickers if editing
    if (this.isEditing || isNew) {
      setTimeout(() => this.initializePickers(), 50);
    }

    // Setup file upload
    this.setupFileUpload();
  }

  // ============================================================
  // LAYOUT - Unified Light Theme Two Panel
  // ============================================================

  renderLayout() {
    const po = this.currentPO;
    const isNew = !po.id;
    const canEdit = isNew || this.isEditing;

    return `
      <div class="po-two-panel">
        <div class="po-panel po-panel-left">
          ${this.renderSummaryPanel(isNew)}
        </div>
        <div class="po-panel po-panel-right">
          ${canEdit ? this.renderEditForm() : this.renderReadOnlyDetails()}
        </div>
      </div>
    `;
  }

  // ============================================================
  // SUMMARY PANEL (Left)
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
        <div class="po-placeholder">
          <div class="placeholder-icon">📋</div>
          <p>Fill in the details to create a new Purchase Order</p>
        </div>
      `;
    }

    return `
      <!-- Amount Summary -->
      <div class="po-card po-amount-summary">
        <div class="amount-main">
          <span class="amount-label">PO Total</span>
          <span class="amount-value">${this.formatMoney(totalAmount)}</span>
        </div>
        <div class="amount-progress">
          <div class="progress-track">
            <div class="progress-fill ${billedPercent > 100 ? 'over' : ''}" style="width: ${Math.min(billedPercent, 100)}%"></div>
          </div>
          <div class="progress-info">
            <span class="info-item"><span class="dot billed"></span> Billed: ${this.formatMoney(billedAmount)}</span>
            <span class="info-item"><span class="dot remaining"></span> Remaining: ${this.formatMoney(remainingAmount)}</span>
          </div>
        </div>
      </div>

      <!-- Details -->
      <div class="po-card">
        <h4>Details</h4>
        <div class="detail-row">
          <span class="detail-label">Job</span>
          <span class="detail-value">${job?.name || '—'}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Vendor</span>
          <span class="detail-value">${vendor?.name || '—'}</span>
        </div>
        ${po.description ? `
        <div class="detail-row">
          <span class="detail-label">Description</span>
          <span class="detail-value">${this.escapeHtml(po.description)}</span>
        </div>
        ` : ''}
        ${po.approved_at ? `
        <div class="detail-row">
          <span class="detail-label">Approved</span>
          <span class="detail-value">${this.formatDate(po.approved_at)}</span>
        </div>
        ` : ''}
        <div class="detail-row">
          <span class="detail-label">Created</span>
          <span class="detail-value">${this.formatDate(po.created_at)}</span>
        </div>
      </div>

      <!-- Linked Invoices -->
      <div class="po-card">
        <div class="card-title-row">
          <h4>Linked Invoices</h4>
          ${(po.invoices || []).length > 0 ? `<span class="count-badge">${po.invoices.length}</span>` : ''}
        </div>
        ${(po.invoices || []).length === 0 ? `
          <p class="empty-text">No invoices linked</p>
        ` : `
          <div class="invoice-list">
            ${po.invoices.map(inv => `
              <div class="invoice-item" onclick="window.poModals.openInvoice('${inv.id}')">
                <div class="inv-left">
                  <span class="inv-number">${inv.invoice_number || 'No #'}</span>
                  <span class="inv-date">${this.formatDate(inv.invoice_date)}</span>
                </div>
                <div class="inv-right">
                  <span class="inv-amount">${this.formatMoney(inv.amount)}</span>
                  <span class="inv-status status-${inv.status}">${this.formatStatus(inv.status)}</span>
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>

    `;
  }

  // ============================================================
  // EDIT FORM (Right Panel)
  // ============================================================

  renderEditForm() {
    const po = this.currentPO;
    const costCodes = window.poState?.costCodes || [];
    const total = this.currentLineItems.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);

    return `
      <div class="po-card">
        <h4>PO Details</h4>
        <div class="form-group">
          <label>PO Number</label>
          <input type="text" id="poNumber" value="${this.escapeHtml(po.po_number || '')}" placeholder="Auto-generated if blank" class="form-input">
        </div>
        <div class="form-row-2">
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
          <input type="text" id="poDescription" value="${this.escapeHtml(po.description || '')}" placeholder="Brief description" class="form-input">
        </div>
      </div>

      <div class="po-card">
        <div class="card-title-row">
          <h4>Line Items</h4>
          <button type="button" class="btn-add" onclick="window.poModals.addLineItem()">+ Add</button>
        </div>
        <div class="line-items-edit" id="lineItemsContainer">
          ${this.currentLineItems.length === 0 ? `
            <p class="empty-text">No line items</p>
          ` : this.currentLineItems.map((item, idx) => this.renderLineItemEdit(item, idx, costCodes)).join('')}
        </div>
        <div class="line-items-total">
          <span>Total:</span>
          <span id="lineItemsTotal">${this.formatMoney(total)}</span>
        </div>
      </div>

      <div class="po-card">
        <h4>Scope & Notes</h4>
        <div class="form-group">
          <label>Scope of Work</label>
          <textarea id="poScopeOfWork" rows="3" class="form-input" placeholder="Describe the work...">${this.escapeHtml(po.scope_of_work || '')}</textarea>
        </div>
        <div class="form-group">
          <label>Internal Notes</label>
          <textarea id="poNotes" rows="2" class="form-input" placeholder="Notes...">${this.escapeHtml(po.notes || '')}</textarea>
        </div>
      </div>

      ${this.renderAttachmentsSection()}
    `;
  }

  renderLineItemEdit(item, index, costCodes) {
    return `
      <div class="line-item-edit" data-index="${index}">
        <select class="form-input" onchange="window.poModals.updateLineItem(${index}, 'cost_code_id', this.value)">
          <option value="">Select cost code...</option>
          ${costCodes.map(cc => `<option value="${cc.id}" ${item.cost_code_id === cc.id ? 'selected' : ''}>${cc.code} - ${cc.name}</option>`).join('')}
        </select>
        <input type="text" placeholder="Description" value="${this.escapeHtml(item.description || '')}" class="form-input"
          onchange="window.poModals.updateLineItem(${index}, 'description', this.value)">
        <input type="number" placeholder="0.00" value="${item.amount || ''}" step="0.01" class="form-input amount"
          onchange="window.poModals.updateLineItem(${index}, 'amount', this.value)">
        <button type="button" class="btn-remove" onclick="window.poModals.removeLineItem(${index})">×</button>
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
      <div class="po-card">
        <h4>Line Items</h4>
        ${this.currentLineItems.length === 0 ? `
          <p class="empty-text">No line items</p>
        ` : `
          <div class="line-items-view">
            ${this.currentLineItems.map(item => {
              const cc = item.cost_code || costCodes.find(c => c.id === item.cost_code_id);
              return `
                <div class="line-item-view">
                  <div class="li-info">
                    <span class="li-code">${cc?.code || '—'}</span>
                    <span class="li-name">${cc?.name || item.description || 'No description'}</span>
                  </div>
                  <span class="li-amount">${this.formatMoney(item.amount)}</span>
                </div>
              `;
            }).join('')}
            <div class="line-items-total-view">
              <span>Total</span>
              <span>${this.formatMoney(total)}</span>
            </div>
          </div>
        `}
      </div>

      ${po.scope_of_work ? `
      <div class="po-card">
        <h4>Scope of Work</h4>
        <p class="text-content">${this.escapeHtml(po.scope_of_work).replace(/\n/g, '<br>')}</p>
      </div>
      ` : ''}

      ${po.notes ? `
      <div class="po-card">
        <h4>Internal Notes</h4>
        <p class="text-content">${this.escapeHtml(po.notes).replace(/\n/g, '<br>')}</p>
      </div>
      ` : ''}

      ${this.renderAttachmentsSection()}

      ${this.renderActivity()}
    `;
  }

  // ============================================================
  // ATTACHMENTS SECTION (Right Panel)
  // ============================================================

  renderAttachmentsSection() {
    const isNew = !this.currentPO.id;

    return `
      <div class="po-card">
        <div class="card-title-row">
          <h4>Attachments</h4>
          ${this.attachments.length > 0 ? `<span class="count-badge">${this.attachments.length}</span>` : ''}
        </div>

        ${!isNew ? `
        <div class="upload-area" id="uploadZone">
          <input type="file" id="fileInput" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg" style="display:none">
          <div class="upload-trigger" onclick="document.getElementById('fileInput').click()">
            <span class="upload-icon">+</span>
            <span class="upload-label">Add files</span>
          </div>
        </div>
        ` : `
        <p class="empty-text">Save PO first to add attachments</p>
        `}

        ${this.attachments.length === 0 ? '' : `
          <div class="attachments-grid">
            ${this.attachments.map(att => this.renderAttachmentPreview(att)).join('')}
          </div>
        `}
      </div>
    `;
  }

  renderAttachmentPreview(att) {
    const isImage = att.file_type === 'image';
    const isPdf = att.file_type === 'pdf';
    const previewUrl = att.storage_path ? `/api/purchase-orders/${this.currentPO.id}/attachments/${att.id}/url` : null;

    return `
      <div class="attachment-preview" onclick="window.poModals.openAttachment('${att.id}')">
        <div class="attachment-thumb ${att.file_type}">
          ${isImage ? `<img src="${previewUrl}" alt="${this.escapeHtml(att.file_name)}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><span class="thumb-icon" style="display:none">🖼️</span>` : ''}
          ${isPdf ? `<span class="thumb-icon">📄</span>` : ''}
          ${!isImage && !isPdf ? `<span class="thumb-icon">${this.getFileIcon(att.file_type)}</span>` : ''}
        </div>
        <div class="attachment-info">
          <span class="att-filename">${this.escapeHtml(att.file_name)}</span>
          <span class="att-size">${this.formatFileSize(att.file_size)}</span>
        </div>
        <button class="btn-delete-att" onclick="event.stopPropagation(); window.poModals.deleteAttachment('${att.id}')" title="Delete">×</button>
      </div>
    `;
  }

  async openAttachment(attachmentId) {
    try {
      // Find the attachment info
      const att = this.attachments.find(a => a.id === attachmentId);
      if (!att) throw new Error('Attachment not found');

      const res = await fetch(`/api/purchase-orders/${this.currentPO.id}/attachments/${attachmentId}/url`);
      if (!res.ok) throw new Error('Failed to get URL');
      const data = await res.json();

      if (data.url) {
        this.showAttachmentViewer(data.url, att.file_name, att.file_type);
      }
    } catch (err) {
      window.showToast?.('Failed to open attachment', 'error');
    }
  }

  showAttachmentViewer(url, fileName, fileType) {
    // Remove existing viewer if any
    const existing = document.getElementById('attachmentViewer');
    if (existing) existing.remove();

    const isImage = fileType === 'image';
    const isPdf = fileType === 'pdf';

    const viewer = document.createElement('div');
    viewer.id = 'attachmentViewer';
    viewer.className = 'attachment-viewer-overlay';
    viewer.innerHTML = `
      <div class="attachment-viewer-container">
        <div class="attachment-viewer-header">
          <span class="viewer-filename">${this.escapeHtml(fileName)}</span>
          <div class="viewer-actions">
            <a href="${url}" download="${this.escapeHtml(fileName)}" class="btn btn-secondary btn-sm">Download</a>
            <button class="btn-close-viewer" onclick="window.poModals.closeAttachmentViewer()">×</button>
          </div>
        </div>
        <div class="attachment-viewer-content">
          ${isPdf ? `<iframe src="${url}" class="pdf-viewer-frame"></iframe>` : ''}
          ${isImage ? `<img src="${url}" alt="${this.escapeHtml(fileName)}" class="image-viewer">` : ''}
          ${!isPdf && !isImage ? `
            <div class="unsupported-preview">
              <span class="preview-icon">${this.getFileIcon(fileType)}</span>
              <p>Preview not available for this file type</p>
              <a href="${url}" download="${this.escapeHtml(fileName)}" class="btn btn-primary">Download File</a>
            </div>
          ` : ''}
        </div>
      </div>
    `;

    // Close on backdrop click
    viewer.addEventListener('click', (e) => {
      if (e.target === viewer) this.closeAttachmentViewer();
    });

    // Close on Escape key
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        this.closeAttachmentViewer();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);

    document.body.appendChild(viewer);
  }

  closeAttachmentViewer() {
    const viewer = document.getElementById('attachmentViewer');
    if (viewer) viewer.remove();
  }

  formatFileSize(bytes) {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  renderActivity() {
    const activity = this.currentPO.activity || [];
    if (activity.length === 0) return '';

    return `
      <div class="po-card">
        <h4>Activity</h4>
        <div class="activity-list">
          ${activity.slice(0, 8).map(act => `
            <div class="activity-item">
              <span class="activity-dot"></span>
              <span class="activity-text">${this.escapeHtml(act.description || act.action)}</span>
              <span class="activity-time">${this.formatRelativeTime(act.created_at)}</span>
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

    let left = '';
    let right = '';

    if (isNew) {
      right = `
        <button class="btn btn-secondary" onclick="window.poModals.closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="window.poModals.savePO()">Create PO</button>
      `;
    } else if (this.isEditing) {
      right = `
        <button class="btn btn-secondary" onclick="window.poModals.cancelEdit()">Cancel</button>
        <button class="btn btn-primary" onclick="window.poModals.savePO()">Save Changes</button>
      `;
    } else {
      const status = po.status_detail || 'pending';
      const approval = po.approval_status || 'pending';

      if (status === 'pending') {
        left = `<button class="btn btn-danger-outline" onclick="window.poModals.deletePO()">Delete</button>`;
      }

      right = `<button class="btn btn-secondary" onclick="window.poModals.closeModal()">Close</button>`;

      if (status !== 'closed') {
        right += `<button class="btn btn-secondary" onclick="window.poModals.startEdit()">Edit</button>`;
      }

      if (status === 'pending' && approval === 'pending') {
        right += `<button class="btn btn-primary" onclick="window.poModals.submitForApproval()">Submit for Approval</button>`;
      } else if (approval === 'pending' && status !== 'pending') {
        right += `<button class="btn btn-danger-outline" onclick="window.poModals.rejectPO()">Reject</button>`;
        right += `<button class="btn btn-success" onclick="window.poModals.approvePO()">Approve</button>`;
      } else if (['approved', 'active'].includes(status)) {
        right += `<button class="btn btn-secondary" onclick="window.poModals.closePO()">Close PO</button>`;
      } else if (status === 'closed') {
        right += `<button class="btn btn-secondary" onclick="window.poModals.reopenPO()">Reopen</button>`;
      }
    }

    footer.innerHTML = `<div class="footer-left">${left}</div><div class="footer-right">${right}</div>`;
  }

  // ============================================================
  // HELPERS
  // ============================================================

  openInvoice(invoiceId) {
    this.closeModal();
    window.location.href = `index.html?openInvoice=${invoiceId}`;
  }

  setupFileUpload() {
    const fileInput = document.getElementById('fileInput');
    const uploadZone = document.getElementById('uploadZone');
    if (!fileInput || !uploadZone) return;

    fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) this.uploadFiles(e.target.files);
    });

    uploadZone.addEventListener('dragover', (e) => { e.preventDefault(); uploadZone.classList.add('dragover'); });
    uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('dragover'));
    uploadZone.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadZone.classList.remove('dragover');
      if (e.dataTransfer.files.length > 0) this.uploadFiles(e.dataTransfer.files);
    });
  }

  async uploadFiles(files) {
    if (!this.currentPO.id) return;
    for (const file of files) {
      const formData = new FormData();
      formData.append('file', file);
      try {
        const res = await fetch(`/api/purchase-orders/${this.currentPO.id}/attachments`, { method: 'POST', body: formData });
        if (!res.ok) throw new Error('Upload failed');
        window.showToast?.(`Uploaded ${file.name}`, 'success');
      } catch (err) {
        window.showToast?.(`Failed to upload ${file.name}`, 'error');
      }
    }
    const attRes = await fetch(`/api/purchase-orders/${this.currentPO.id}/attachments`);
    this.attachments = await attRes.json();
    this.renderPOModal();
  }

  startEdit() { this.isEditing = true; this.renderPOModal(); }
  cancelEdit() { this.isEditing = false; if (this.currentPO.id) this.openPO(this.currentPO.id); else this.closeModal(); }

  addLineItem() {
    this.currentLineItems.push({ cost_code_id: null, description: '', amount: 0 });
    this.refreshLineItems();
  }

  updateLineItem(index, field, value) {
    if (this.currentLineItems[index]) {
      this.currentLineItems[index][field] = value;
      if (field === 'amount') this.updateLineItemsTotal();
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
    container.innerHTML = this.currentLineItems.length === 0
      ? '<p class="empty-text">No line items</p>'
      : this.currentLineItems.map((item, idx) => this.renderLineItemEdit(item, idx, costCodes)).join('');
    this.updateLineItemsTotal();
  }

  updateLineItemsTotal() {
    const total = this.currentLineItems.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
    const el = document.getElementById('lineItemsTotal');
    if (el) el.textContent = this.formatMoney(total);
  }

  initializePickers() {
    const jobs = window.poState?.jobs || [];
    const vendors = window.poState?.vendors || [];

    const jobContainer = document.getElementById('po-job-picker-container');
    if (jobContainer) {
      jobContainer.innerHTML = `<select id="poJobSelect" class="form-input" onchange="window.poModals.selectedJobId = this.value">
        <option value="">Select Job...</option>
        ${jobs.map(j => `<option value="${j.id}" ${j.id === this.currentPO.job_id ? 'selected' : ''}>${j.name}</option>`).join('')}
      </select>`;
      this.selectedJobId = this.currentPO.job_id;
    }

    const vendorContainer = document.getElementById('po-vendor-picker-container');
    if (vendorContainer) {
      vendorContainer.innerHTML = `<select id="poVendorSelect" class="form-input" onchange="window.poModals.selectedVendorId = this.value">
        <option value="">Select Vendor...</option>
        ${vendors.map(v => `<option value="${v.id}" ${v.id === this.currentPO.vendor_id ? 'selected' : ''}>${v.name}</option>`).join('')}
      </select>`;
      this.selectedVendorId = this.currentPO.vendor_id;
    }
  }

  async savePO() {
    const po = this.currentPO;
    const isNew = !po.id;
    const jobId = this.selectedJobId || po.job_id;
    const vendorId = this.selectedVendorId || po.vendor_id;

    if (!jobId) { window.showToast?.('Please select a job', 'error'); return; }
    if (!vendorId) { window.showToast?.('Please select a vendor', 'error'); return; }

    const data = {
      po_number: document.getElementById('poNumber')?.value?.trim() || null,
      job_id: jobId,
      vendor_id: vendorId,
      description: document.getElementById('poDescription')?.value?.trim(),
      scope_of_work: document.getElementById('poScopeOfWork')?.value?.trim(),
      notes: document.getElementById('poNotes')?.value?.trim(),
      total_amount: this.currentLineItems.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0),
      line_items: this.currentLineItems.filter(li => li.cost_code_id || li.description || li.amount)
    };

    try {
      const res = isNew
        ? await fetch('/api/purchase-orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
        : await fetch(`/api/purchase-orders/${po.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });

      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed'); }

      const saved = await res.json();
      window.showToast?.(isNew ? 'PO created' : 'PO updated', 'success');
      if (window.loadPOs) window.loadPOs();
      this.isEditing = false;
      this.openPO(saved.id);
    } catch (err) {
      window.showToast?.(err.message || 'Failed to save', 'error');
    }
  }

  async submitForApproval() {
    if (!confirm('Submit this PO for approval?')) return;
    try {
      const res = await fetch(`/api/purchase-orders/${this.currentPO.id}/submit`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed');
      window.showToast?.('Submitted for approval', 'success');
      if (window.loadPOs) window.loadPOs();
      this.openPO(this.currentPO.id);
    } catch (err) { window.showToast?.(err.message, 'error'); }
  }

  async approvePO() {
    if (!confirm('Approve this PO?')) return;
    try {
      const res = await fetch(`/api/purchase-orders/${this.currentPO.id}/approve`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed');
      window.showToast?.('PO approved', 'success');
      if (window.loadPOs) window.loadPOs();
      this.openPO(this.currentPO.id);
    } catch (err) { window.showToast?.(err.message, 'error'); }
  }

  async rejectPO() {
    const reason = prompt('Reason for rejection:');
    if (reason === null) return;
    try {
      const res = await fetch(`/api/purchase-orders/${this.currentPO.id}/reject`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason }) });
      if (!res.ok) throw new Error('Failed');
      window.showToast?.('PO rejected', 'success');
      if (window.loadPOs) window.loadPOs();
      this.openPO(this.currentPO.id);
    } catch (err) { window.showToast?.(err.message, 'error'); }
  }

  async closePO() {
    if (!confirm('Close this PO?')) return;
    try {
      const res = await fetch(`/api/purchase-orders/${this.currentPO.id}/close`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed');
      window.showToast?.('PO closed', 'success');
      if (window.loadPOs) window.loadPOs();
      this.openPO(this.currentPO.id);
    } catch (err) { window.showToast?.(err.message, 'error'); }
  }

  async reopenPO() {
    if (!confirm('Reopen this PO?')) return;
    try {
      const res = await fetch(`/api/purchase-orders/${this.currentPO.id}/reopen`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed');
      window.showToast?.('PO reopened', 'success');
      if (window.loadPOs) window.loadPOs();
      this.openPO(this.currentPO.id);
    } catch (err) { window.showToast?.(err.message, 'error'); }
  }

  async deletePO() {
    if (!confirm('Delete this PO?')) return;
    try {
      const res = await fetch(`/api/purchase-orders/${this.currentPO.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed');
      window.showToast?.('PO deleted', 'success');
      if (window.loadPOs) window.loadPOs();
      this.closeModal();
    } catch (err) { window.showToast?.(err.message, 'error'); }
  }

  async downloadAttachment(id) { window.open(`/api/attachments/${id}/download`, '_blank'); }

  async deleteAttachment(id) {
    if (!confirm('Delete attachment?')) return;
    try {
      const res = await fetch(`/api/attachments/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed');
      window.showToast?.('Deleted', 'success');
      const attRes = await fetch(`/api/purchase-orders/${this.currentPO.id}/attachments`);
      this.attachments = await attRes.json();
      this.renderPOModal();
    } catch (err) { window.showToast?.(err.message, 'error'); }
  }

  // Utility
  formatMoney(amt) { return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(parseFloat(amt) || 0); }
  formatDate(d) { if (!d) return '—'; return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  formatRelativeTime(d) { if (!d) return ''; const ms = Date.now() - new Date(d); const m = Math.floor(ms/60000), h = Math.floor(ms/3600000), day = Math.floor(ms/86400000); if (m < 1) return 'now'; if (m < 60) return m + 'm'; if (h < 24) return h + 'h'; if (day < 7) return day + 'd'; return this.formatDate(d); }
  formatStatus(s) { return { received: 'Received', needs_approval: 'Needs Approval', approved: 'Approved', in_draw: 'In Draw', paid: 'Paid', denied: 'Denied' }[s] || s; }
  escapeHtml(s) { if (!s) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  getStatusClass(sd, as) { if (as === 'rejected') return 'rejected'; if (as === 'approved') return 'approved'; if (sd === 'closed') return 'closed'; if (sd === 'active') return 'active'; return 'draft'; }
  getStatusLabel(sd, as) { if (as === 'rejected') return 'Rejected'; if (as === 'approved' && sd === 'closed') return 'Closed'; if (as === 'approved') return 'Approved'; if (sd === 'active') return 'Active'; return 'Draft'; }
  getFileIcon(t) { if (!t) return '📎'; if (t.includes('pdf')) return '📄'; if (t.includes('image')) return '🖼️'; if (t.includes('excel')||t.includes('spreadsheet')) return '📊'; return '📎'; }
}

window.poModals = new POModals();

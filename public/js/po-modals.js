// ============================================================
// PO MODALS - Clean Design (Matching Invoice Modal Style)
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

      // Load PO data
      const res = await fetch(`/api/purchase-orders/${poId}`);
      if (!res.ok) throw new Error('Failed to load PO');

      this.currentPO = await res.json();
      this.currentLineItems = this.currentPO.line_items || [];

      // Load additional data in parallel
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
  // RENDER MODAL - SINGLE PANEL DESIGN
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

    // Render single body panel
    const body = document.getElementById('poModalBody');
    body.innerHTML = this.renderModalContent();

    this.renderFooterActions();

    // Initialize pickers if editing
    if (this.isEditing || isNew) {
      setTimeout(() => this.initializePickers(), 50);
    }
  }

  // ============================================================
  // MODAL CONTENT - UNIFIED LAYOUT
  // ============================================================

  renderModalContent() {
    const po = this.currentPO;
    const isNew = !po.id;
    // Only allow editing when creating new or explicitly in edit mode
    const canEdit = isNew || this.isEditing;

    return `
      ${!isNew ? this.renderSummaryCard() : ''}
      ${this.renderDetailsSection(canEdit)}
      ${this.renderLineItemsSection(canEdit)}
      ${!isNew ? this.renderInvoicesSection() : ''}
      ${this.renderNotesSection(canEdit)}
      ${!isNew ? this.renderAttachmentsSection() : ''}
    `;
  }

  renderSummaryCard() {
    const po = this.currentPO;
    const totalAmount = parseFloat(po.total_amount || 0);
    const billedAmount = (po.invoices || [])
      .filter(inv => ['approved', 'in_draw', 'paid'].includes(inv.status))
      .reduce((sum, inv) => sum + parseFloat(inv.amount || 0), 0);
    const remainingAmount = totalAmount - billedAmount;
    const billedPercent = totalAmount > 0 ? Math.round((billedAmount / totalAmount) * 100) : 0;

    return `
      <div class="po-summary-card">
        <div class="summary-stats">
          <div class="stat-item">
            <span class="stat-label">PO Total</span>
            <span class="stat-value">${this.formatMoney(totalAmount)}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Billed</span>
            <span class="stat-value">${this.formatMoney(billedAmount)}</span>
          </div>
          <div class="stat-item ${remainingAmount < 0 ? 'negative' : ''}">
            <span class="stat-label">Remaining</span>
            <span class="stat-value">${this.formatMoney(remainingAmount)}</span>
          </div>
        </div>
        <div class="summary-progress">
          <div class="progress-bar">
            <div class="progress-fill ${billedPercent > 100 ? 'over' : ''}" style="width: ${Math.min(billedPercent, 100)}%"></div>
          </div>
          <span class="progress-label">${billedPercent}% billed</span>
        </div>
      </div>
    `;
  }

  renderDetailsSection(canEdit) {
    const po = this.currentPO;
    const vendor = po.vendor || window.poState?.vendors?.find(v => v.id === po.vendor_id);
    const job = po.job || window.poState?.jobs?.find(j => j.id === po.job_id);

    if (canEdit || this.isEditing) {
      return `
        <div class="form-section">
          <h3>PO Details</h3>

          <div class="form-group">
            <label>PO Number</label>
            <input type="text" id="poNumber" value="${po.po_number || ''}" placeholder="Auto-generated" class="form-control">
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
            <input type="text" id="poDescription" value="${this.escapeHtml(po.description || '')}" class="form-control" placeholder="Brief description of work">
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Assigned To</label>
              <input type="text" id="poAssignedTo" value="${this.escapeHtml(po.assigned_to || '')}" class="form-control" placeholder="PM, Super, etc.">
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Start Date</label>
              <input type="date" id="poStartDate" value="${po.schedule_start_date || ''}" class="form-control">
            </div>
            <div class="form-group">
              <label>End Date</label>
              <input type="date" id="poEndDate" value="${po.schedule_end_date || ''}" class="form-control">
            </div>
          </div>
        </div>
      `;
    }

    // Read-only view
    return `
      <div class="form-section">
        <h3>PO Details</h3>
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">Job</span>
            <span class="info-value">${job?.name || 'Not assigned'}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Vendor</span>
            <span class="info-value">${vendor?.name || 'Not assigned'}</span>
          </div>
          ${po.description ? `
          <div class="info-item full-width">
            <span class="info-label">Description</span>
            <span class="info-value">${this.escapeHtml(po.description)}</span>
          </div>` : ''}
          ${po.assigned_to ? `
          <div class="info-item">
            <span class="info-label">Assigned To</span>
            <span class="info-value">${this.escapeHtml(po.assigned_to)}</span>
          </div>` : ''}
          ${po.schedule_start_date || po.schedule_end_date ? `
          <div class="info-item">
            <span class="info-label">Schedule</span>
            <span class="info-value">${po.schedule_start_date ? this.formatDate(po.schedule_start_date) : ''} ${po.schedule_start_date && po.schedule_end_date ? ' → ' : ''} ${po.schedule_end_date ? this.formatDate(po.schedule_end_date) : ''}</span>
          </div>` : ''}
        </div>
      </div>
    `;
  }

  renderLineItemsSection(canEdit) {
    const costCodes = window.poState?.costCodes || [];
    const total = this.currentLineItems.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);

    if (canEdit || this.isEditing) {
      return `
        <div class="form-section">
          <div class="section-header">
            <h3>Line Items</h3>
            <button type="button" class="btn-add-line" onclick="window.poModals.addLineItem()">+ Add line</button>
          </div>

          <div class="line-items-container" id="lineItemsContainer">
            ${this.currentLineItems.length === 0 ?
              `<div class="empty-state small">No line items yet. Click "+ Add line" to add one.</div>` :
              this.currentLineItems.map((item, index) => `
                <div class="line-item" data-index="${index}">
                  <div class="line-item-fields">
                    <select onchange="window.poModals.updateLineItem(${index}, 'cost_code_id', this.value)">
                      <option value="">Select cost code</option>
                      ${costCodes.map(cc => `
                        <option value="${cc.id}" ${item.cost_code_id === cc.id ? 'selected' : ''}>${cc.code} - ${cc.name}</option>
                      `).join('')}
                    </select>
                    <input type="text" placeholder="Description" value="${this.escapeHtml(item.description || '')}"
                      onchange="window.poModals.updateLineItem(${index}, 'description', this.value)">
                    <input type="number" placeholder="0.00" value="${item.amount || ''}" step="0.01"
                      onchange="window.poModals.updateLineItem(${index}, 'amount', this.value)">
                    <button type="button" class="btn-delete-row" onclick="window.poModals.removeLineItem(${index})">×</button>
                  </div>
                </div>
              `).join('')
            }
          </div>

          <div class="line-items-total">
            <span>Total:</span>
            <span id="lineItemsTotal">${this.formatMoney(total)}</span>
          </div>
        </div>
      `;
    }

    // Read-only
    return `
      <div class="form-section">
        <div class="section-header">
          <h3>Line Items</h3>
          <span class="count-badge">${this.currentLineItems.length}</span>
        </div>

        <div class="line-items-readonly">
          ${this.currentLineItems.length === 0 ?
            `<div class="empty-state small">No line items</div>` :
            this.currentLineItems.map(item => {
              const cc = item.cost_code || costCodes.find(c => c.id === item.cost_code_id);
              return `
                <div class="line-item-row">
                  <span class="li-code">${cc?.code || ''}</span>
                  <span class="li-name">${cc?.name || item.description || ''}</span>
                  <span class="li-amount">${this.formatMoney(item.amount)}</span>
                </div>
              `;
            }).join('')
          }
        </div>

        <div class="line-items-total">
          <span>Total:</span>
          <span>${this.formatMoney(total)}</span>
        </div>
      </div>
    `;
  }

  renderInvoicesSection() {
    const invoices = this.currentPO.invoices || [];

    if (invoices.length === 0) {
      return `
        <div class="form-section">
          <div class="section-header">
            <h3>Linked Invoices</h3>
          </div>
          <div class="empty-state small">No invoices linked to this PO</div>
        </div>
      `;
    }

    const totalBilled = invoices
      .filter(inv => ['approved', 'in_draw', 'paid'].includes(inv.status))
      .reduce((sum, inv) => sum + parseFloat(inv.amount || 0), 0);

    const getStatusLabel = (status) => {
      const labels = {
        'received': 'Received',
        'needs_approval': 'Needs Approval',
        'approved': 'Approved',
        'in_draw': 'In Draw',
        'paid': 'Paid'
      };
      return labels[status] || status;
    };

    return `
      <div class="form-section">
        <div class="section-header">
          <h3>Linked Invoices</h3>
          <span class="count-badge">${invoices.length}</span>
        </div>

        <div class="linked-invoices-table">
          <div class="invoices-header">
            <span>Invoice #</span>
            <span>Date</span>
            <span>Status</span>
            <span>Amount</span>
          </div>
          ${invoices.map(inv => `
            <div class="invoice-row" onclick="window.location.href='index.html?invoice=${inv.id}'">
              <span class="inv-number">${inv.invoice_number || '—'}</span>
              <span class="inv-date">${this.formatDate(inv.invoice_date)}</span>
              <span><span class="status-pill status-${inv.status}">${getStatusLabel(inv.status)}</span></span>
              <span class="inv-amount">${this.formatMoney(inv.amount)}</span>
            </div>
          `).join('')}
        </div>

        <div class="invoices-total">
          <span>Total Billed:</span>
          <span class="total-amount">${this.formatMoney(totalBilled)}</span>
        </div>
      </div>
    `;
  }

  renderNotesSection(canEdit) {
    const po = this.currentPO;

    if (canEdit || this.isEditing) {
      return `
        <div class="form-section">
          <h3>Scope & Notes</h3>
          <div class="form-group">
            <label>Scope of Work</label>
            <textarea id="poScopeOfWork" rows="3" class="form-control" placeholder="Describe the work...">${this.escapeHtml(po.scope_of_work || '')}</textarea>
          </div>
          <div class="form-group">
            <label>Notes</label>
            <textarea id="poNotes" rows="2" class="form-control" placeholder="Internal notes...">${this.escapeHtml(po.notes || '')}</textarea>
          </div>
        </div>
      `;
    }

    if (!po.scope_of_work && !po.notes) return '';

    return `
      <div class="form-section">
        <h3>Scope & Notes</h3>
        ${po.scope_of_work ? `
          <div class="notes-content">
            <strong>Scope of Work:</strong>
            <p>${this.escapeHtml(po.scope_of_work).replace(/\n/g, '<br>')}</p>
          </div>
        ` : ''}
        ${po.notes ? `
          <div class="notes-content">
            <strong>Notes:</strong>
            <p>${this.escapeHtml(po.notes)}</p>
          </div>
        ` : ''}
      </div>
    `;
  }

  renderAttachmentsSection() {
    return `
      <div class="form-section">
        <div class="section-header">
          <h3>Attachments</h3>
          <button type="button" class="btn-add-line" onclick="document.getElementById('poFileInput').click()">+ Upload</button>
          <input type="file" id="poFileInput" style="display: none" onchange="window.poModals.uploadFile(this.files[0])">
        </div>

        ${this.attachments.length === 0 ?
          '<div class="empty-state small">No attachments</div>' :
          `<div class="attachments-list">
            ${this.attachments.map(att => `
              <div class="attachment-row">
                <span class="att-icon">${this.getFileIcon(att.file_type)}</span>
                <span class="att-name">${this.escapeHtml(att.file_name)}</span>
                <span class="att-size">${this.formatFileSize(att.file_size)}</span>
                <button class="btn-icon" onclick="window.poModals.downloadAttachment('${att.id}')" title="Download">↓</button>
                <button class="btn-icon btn-delete" onclick="window.poModals.deleteAttachment('${att.id}')" title="Delete">×</button>
              </div>
            `).join('')}
          </div>`
        }
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

    let actions = '';

    if (isNew) {
      actions = `
        <button class="btn btn-secondary" onclick="window.poModals.closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="window.poModals.savePO()">Create PO</button>
      `;
    } else if (this.isEditing) {
      actions = `
        <button class="btn btn-secondary" onclick="window.poModals.cancelEdit()">Cancel</button>
        <button class="btn btn-primary" onclick="window.poModals.savePO()">Save Changes</button>
      `;
    } else {
      const status = po.status_detail || 'pending';
      const approval = po.approval_status || 'pending';

      // Close button always
      actions += `<button class="btn btn-secondary" onclick="window.poModals.closeModal()">Close</button>`;

      // Edit button - allow for most statuses except closed
      if (status !== 'closed') {
        actions += `<button class="btn btn-secondary" onclick="window.poModals.startEdit()">Edit</button>`;
      }

      // Delete for pending
      if (status === 'pending') {
        actions += `<button class="btn btn-danger-outline" onclick="window.poModals.deletePO()">Delete</button>`;
      }

      // Status-specific actions
      if (status === 'pending' && approval === 'pending') {
        actions += `<button class="btn btn-primary" onclick="window.poModals.submitForApproval()">Submit for Approval</button>`;
      } else if (approval === 'pending' && status !== 'pending') {
        actions += `<button class="btn btn-danger-outline" onclick="window.poModals.rejectPO()">Reject</button>`;
        actions += `<button class="btn btn-success" onclick="window.poModals.approvePO()">Approve</button>`;
      } else if (['approved', 'active'].includes(status)) {
        actions += `<button class="btn btn-secondary" onclick="window.poModals.closePO()">Close PO</button>`;
      } else if (status === 'closed') {
        actions += `<button class="btn btn-secondary" onclick="window.poModals.reopenPO()">Reopen</button>`;
      }
    }

    footer.innerHTML = actions;
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
    this.openPO(this.currentPO.id);
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
    const isNew = !this.currentPO.id;
    const canEdit = isNew || this.isEditing;
    const section = document.querySelector('.form-section:has(#lineItemsContainer)');
    if (section) {
      section.outerHTML = this.renderLineItemsSection(canEdit);
    }
  }

  updateLineItemsTotal() {
    const total = this.currentLineItems.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
    const el = document.getElementById('lineItemsTotal');
    if (el) el.textContent = this.formatMoney(total);
  }

  // ============================================================
  // FILE MANAGEMENT
  // ============================================================

  async uploadFile(file) {
    if (!file || !this.currentPO.id) return;

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`/api/purchase-orders/${this.currentPO.id}/attachments`, {
        method: 'POST',
        body: formData
      });

      if (!res.ok) throw new Error('Upload failed');

      const attachment = await res.json();
      this.attachments.push(attachment);
      this.renderPOModal();
      window.showToast?.('File uploaded', 'success');
    } catch (err) {
      console.error('Upload failed:', err);
      window.showToast?.('Failed to upload file', 'error');
    }
  }

  async downloadAttachment(attachmentId) {
    try {
      const res = await fetch(`/api/purchase-orders/${this.currentPO.id}/attachments/${attachmentId}/url`);
      if (!res.ok) throw new Error('Failed to get download URL');

      const { url } = await res.json();
      window.open(url, '_blank');
    } catch (err) {
      console.error('Download failed:', err);
      window.showToast?.('Failed to download file', 'error');
    }
  }

  async deleteAttachment(attachmentId) {
    if (!confirm('Delete this file?')) return;

    try {
      const res = await fetch(`/api/purchase-orders/${this.currentPO.id}/attachments/${attachmentId}`, {
        method: 'DELETE'
      });

      if (!res.ok) throw new Error('Delete failed');

      this.attachments = this.attachments.filter(a => a.id !== attachmentId);
      this.renderPOModal();
      window.showToast?.('File deleted', 'success');
    } catch (err) {
      console.error('Delete failed:', err);
      window.showToast?.('Failed to delete file', 'error');
    }
  }

  // ============================================================
  // SAVE PO
  // ============================================================

  async savePO() {
    const po = this.currentPO;
    const isNew = !po.id;

    // Gather form data
    const data = {
      po_number: document.getElementById('poNumber')?.value || null,
      job_id: po.job_id,
      vendor_id: po.vendor_id,
      description: document.getElementById('poDescription')?.value || '',
      assigned_to: document.getElementById('poAssignedTo')?.value || '',
      schedule_start_date: document.getElementById('poStartDate')?.value || null,
      schedule_end_date: document.getElementById('poEndDate')?.value || null,
      scope_of_work: document.getElementById('poScopeOfWork')?.value || '',
      notes: document.getElementById('poNotes')?.value || '',
      line_items: this.currentLineItems.filter(li => li.cost_code_id || li.description || li.amount)
    };

    // Calculate total from line items
    data.total_amount = data.line_items.reduce((sum, li) => sum + parseFloat(li.amount || 0), 0);

    // Validate
    if (!data.job_id) {
      window.showToast?.('Please select a job', 'error');
      return;
    }
    if (!data.vendor_id) {
      window.showToast?.('Please select a vendor', 'error');
      return;
    }

    try {
      const url = isNew ? '/api/purchase-orders' : `/api/purchase-orders/${po.id}`;
      const method = isNew ? 'POST' : 'PATCH';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save');
      }

      const savedPO = await res.json();

      window.showToast?.(isNew ? 'PO created' : 'PO saved', 'success');
      window.refreshPOList?.();

      if (isNew) {
        this.closeModal();
      } else {
        this.isEditing = false;
        this.openPO(savedPO.id);
      }
    } catch (err) {
      console.error('Save failed:', err);
      window.showToast?.(err.message || 'Failed to save PO', 'error');
    }
  }

  // ============================================================
  // WORKFLOW ACTIONS
  // ============================================================

  async submitForApproval() {
    await this.performAction('submit', 'Submitted for approval');
  }

  async approvePO() {
    await this.performAction('approve', 'PO approved');
  }

  async rejectPO() {
    const reason = prompt('Rejection reason:');
    if (reason === null) return;
    await this.performAction('reject', 'PO rejected', { reason });
  }

  async closePO() {
    const reason = prompt('Close reason (optional):');
    if (reason === null) return;
    await this.performAction('close', 'PO closed', { reason });
  }

  async reopenPO() {
    await this.performAction('reopen', 'PO reopened');
  }

  async deletePO() {
    if (!confirm('Are you sure you want to delete this PO?')) return;

    try {
      const res = await fetch(`/api/purchase-orders/${this.currentPO.id}`, {
        method: 'DELETE'
      });

      if (!res.ok) throw new Error('Delete failed');

      window.showToast?.('PO deleted', 'success');
      window.refreshPOList?.();
      this.closeModal();
    } catch (err) {
      console.error('Delete failed:', err);
      window.showToast?.('Failed to delete PO', 'error');
    }
  }

  async performAction(action, successMessage, body = {}) {
    try {
      const res = await fetch(`/api/purchase-orders/${this.currentPO.id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || `Failed to ${action}`);
      }

      window.showToast?.(successMessage, 'success');
      window.refreshPOList?.();
      this.openPO(this.currentPO.id);
    } catch (err) {
      console.error(`${action} failed:`, err);
      window.showToast?.(err.message || `Failed to ${action}`, 'error');
    }
  }

  // ============================================================
  // PICKERS
  // ============================================================

  initializePickers() {
    const jobs = window.poState?.jobs || [];
    const vendors = window.poState?.vendors || [];

    // Job picker
    const jobContainer = document.getElementById('po-job-picker-container');
    if (jobContainer) {
      jobContainer.innerHTML = `
        <select id="poJobSelect" class="form-control" onchange="window.poModals.currentPO.job_id = this.value">
          <option value="">Select Job</option>
          ${jobs.map(j => `<option value="${j.id}" ${j.id === this.currentPO.job_id ? 'selected' : ''}>${j.name}</option>`).join('')}
        </select>
      `;
    }

    // Vendor picker
    const vendorContainer = document.getElementById('po-vendor-picker-container');
    if (vendorContainer) {
      vendorContainer.innerHTML = `
        <select id="poVendorSelect" class="form-control" onchange="window.poModals.currentPO.vendor_id = this.value">
          <option value="">Select Vendor</option>
          ${vendors.map(v => `<option value="${v.id}" ${v.id === this.currentPO.vendor_id ? 'selected' : ''}>${v.name}</option>`).join('')}
        </select>
      `;
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
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  formatFileSize(bytes) {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  getFileIcon(fileType) {
    if (!fileType) return '📄';
    if (fileType.includes('pdf')) return '📕';
    if (fileType.includes('image')) return '🖼';
    if (fileType.includes('word') || fileType.includes('doc')) return '📘';
    if (fileType.includes('excel') || fileType.includes('sheet')) return '📗';
    return '📄';
  }

  getStatusLabel(status, approvalStatus) {
    if (approvalStatus === 'rejected') return 'Rejected';
    if (approvalStatus === 'pending' && status === 'pending') return 'Draft';
    if (approvalStatus === 'pending') return 'Pending Approval';

    const labels = {
      pending: 'Draft',
      approved: 'Approved',
      active: 'Active',
      open: 'Active',
      closed: 'Closed',
      cancelled: 'Cancelled'
    };
    return labels[status] || status;
  }

  getStatusClass(status, approvalStatus) {
    if (approvalStatus === 'rejected') return 'rejected';
    if (approvalStatus === 'pending' && status === 'pending') return 'pending';
    if (approvalStatus === 'pending') return 'pending-approval';

    const classes = {
      pending: 'pending',
      approved: 'approved',
      active: 'active',
      open: 'active',
      closed: 'closed',
      cancelled: 'cancelled'
    };
    return classes[status] || 'pending';
  }

  escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

// Initialize
window.poModals = new POModals();

// Modal close helper
function closeConfirmModal() {
  document.getElementById('confirmDialog')?.classList.remove('show');
}

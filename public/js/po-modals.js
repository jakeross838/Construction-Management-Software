// ============================================================
// PO MODALS - Streamlined Single View
// ============================================================

class POModals {
  constructor() {
    this.currentPO = null;
    this.currentLineItems = [];
    this.attachments = [];
    this.isEditing = false;
    this.searchFilter = '';
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
    this.searchFilter = '';
  }

  // ============================================================
  // OPEN EXISTING PO
  // ============================================================

  async openPO(poId) {
    try {
      document.getElementById('poSummaryPanel').innerHTML = '<div class="loading">Loading...</div>';
      document.getElementById('poEditPanel').innerHTML = '';
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
  // RENDER MODAL - SINGLE STREAMLINED VIEW
  // ============================================================

  renderPOModal() {
    const po = this.currentPO;
    const isNew = !po.id;

    document.getElementById('poModalTitle').textContent = isNew ? 'New Purchase Order' : (po.po_number || 'Purchase Order');

    const leftPanel = document.getElementById('poSummaryPanel');
    const rightPanel = document.getElementById('poEditPanel');

    // Main content - scrollable single view
    leftPanel.innerHTML = this.renderMainContent();

    // Right panel - summary card (always visible)
    rightPanel.innerHTML = this.renderSummaryCard();

    this.renderFooterActions();

    // Initialize pickers if editing
    if (this.isEditing) {
      setTimeout(() => this.initializePickers(), 50);
    }
  }

  renderMainContent() {
    const po = this.currentPO;
    const isNew = !po.id;
    const canEdit = isNew || ['pending'].includes(po.status_detail) || po.approval_status === 'rejected';

    return `
      <div class="po-main-content">
        ${this.renderBasicInfo(canEdit)}
        ${this.renderLineItems(canEdit)}
        ${!isNew ? this.renderLinkedBills() : ''}
        ${!isNew ? this.renderFiles() : ''}
        ${this.renderNotes(canEdit)}
      </div>
    `;
  }

  // ============================================================
  // BASIC INFO SECTION
  // ============================================================

  renderBasicInfo(canEdit) {
    const po = this.currentPO;
    const isNew = !po.id;
    const vendor = po.vendor || window.poState?.vendors?.find(v => v.id === po.vendor_id);
    const job = po.job || window.poState?.jobs?.find(j => j.id === po.job_id);

    if (canEdit || this.isEditing) {
      return `
        <section class="po-section">
          <div class="form-row">
            <div class="form-group flex-1">
              <label>PO Number</label>
              <input type="text" id="poNumber" value="${po.po_number || ''}" placeholder="Auto-generated" class="form-control">
            </div>
            <div class="form-group flex-1">
              <label>Status</label>
              <span class="status-badge status-${this.getStatusClass(po.status_detail, po.approval_status)}">${this.getStatusLabel(po.status_detail, po.approval_status)}</span>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group flex-1">
              <label>Job *</label>
              <div id="po-job-picker-container"></div>
            </div>
            <div class="form-group flex-1">
              <label>Vendor *</label>
              <div id="po-vendor-picker-container"></div>
            </div>
          </div>

          <div class="form-group">
            <label>Description</label>
            <input type="text" id="poDescription" value="${this.escapeHtml(po.description || '')}" class="form-control" placeholder="Brief description of work">
          </div>

          <div class="form-row">
            <div class="form-group flex-1">
              <label>Assigned To</label>
              <input type="text" id="poAssignedTo" value="${this.escapeHtml(po.assigned_to || '')}" class="form-control" placeholder="PM, Super, etc.">
            </div>
            <div class="form-group flex-1">
              <label>Start Date</label>
              <input type="date" id="poStartDate" value="${po.schedule_start_date || ''}" class="form-control">
            </div>
            <div class="form-group flex-1">
              <label>End Date</label>
              <input type="date" id="poEndDate" value="${po.schedule_end_date || ''}" class="form-control">
            </div>
          </div>
        </section>
      `;
    }

    // Read-only view
    return `
      <section class="po-section po-info-grid">
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
          <span class="info-value">${po.schedule_start_date ? this.formatDate(po.schedule_start_date) : ''} ${po.schedule_start_date && po.schedule_end_date ? '→' : ''} ${po.schedule_end_date ? this.formatDate(po.schedule_end_date) : ''}</span>
        </div>` : ''}
      </section>
    `;
  }

  // ============================================================
  // LINE ITEMS SECTION
  // ============================================================

  renderLineItems(canEdit) {
    const costCodes = window.poState?.costCodes || [];
    const total = this.currentLineItems.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
    const hasMany = this.currentLineItems.length > 5;

    // Filter line items if searching
    let filteredItems = this.currentLineItems;
    if (this.searchFilter) {
      const query = this.searchFilter.toLowerCase();
      filteredItems = this.currentLineItems.filter(item => {
        const cc = item.cost_code || costCodes.find(c => c.id === item.cost_code_id);
        return (cc?.code?.toLowerCase().includes(query) ||
                cc?.name?.toLowerCase().includes(query) ||
                item.description?.toLowerCase().includes(query));
      });
    }

    if (canEdit || this.isEditing) {
      return `
        <section class="po-section">
          <div class="section-header">
            <h4>Line Items</h4>
            <button type="button" class="btn btn-sm btn-secondary" onclick="window.poModals.addLineItem()">+ Add</button>
          </div>

          ${hasMany ? `
          <div class="filter-bar">
            <input type="text" class="form-control filter-input" placeholder="Filter line items..."
              value="${this.escapeHtml(this.searchFilter)}"
              oninput="window.poModals.filterLineItems(this.value)">
          </div>` : ''}

          <div class="line-items-list" id="lineItemsContainer">
            ${filteredItems.length === 0 ?
              `<div class="empty-state">${this.searchFilter ? 'No matching items' : 'No line items yet'}</div>` :
              filteredItems.map((item, index) => {
                const actualIndex = this.currentLineItems.indexOf(item);
                return `
                  <div class="line-item-row editable">
                    <select class="li-cost-code" onchange="window.poModals.updateLineItem(${actualIndex}, 'cost_code_id', this.value)">
                      <option value="">Cost Code</option>
                      ${costCodes.map(cc => `
                        <option value="${cc.id}" ${item.cost_code_id === cc.id ? 'selected' : ''}>${cc.code} - ${cc.name}</option>
                      `).join('')}
                    </select>
                    <input type="text" class="li-desc" placeholder="Description" value="${this.escapeHtml(item.description || '')}"
                      onchange="window.poModals.updateLineItem(${actualIndex}, 'description', this.value)">
                    <input type="number" class="li-amount" placeholder="0.00" value="${item.amount || ''}"
                      onchange="window.poModals.updateLineItem(${actualIndex}, 'amount', this.value)">
                    <button type="button" class="btn-icon btn-delete" onclick="window.poModals.removeLineItem(${actualIndex})">×</button>
                  </div>
                `;
              }).join('')
            }
          </div>

          <div class="line-items-footer">
            <span class="total-label">Total:</span>
            <span class="total-value" id="lineItemsTotal">${this.formatMoney(total)}</span>
          </div>
        </section>
      `;
    }

    // Read-only line items
    return `
      <section class="po-section">
        <div class="section-header">
          <h4>Line Items</h4>
          <span class="badge">${this.currentLineItems.length}</span>
        </div>

        ${hasMany ? `
        <div class="filter-bar">
          <input type="text" class="form-control filter-input" placeholder="Filter..."
            value="${this.escapeHtml(this.searchFilter)}"
            oninput="window.poModals.filterLineItems(this.value)">
        </div>` : ''}

        <div class="line-items-list readonly">
          ${filteredItems.length === 0 ?
            `<div class="empty-state">${this.searchFilter ? 'No matching items' : 'No line items'}</div>` :
            filteredItems.map(item => {
              const cc = item.cost_code || costCodes.find(c => c.id === item.cost_code_id);
              return `
                <div class="line-item-row">
                  <span class="li-code">${cc?.code || ''}</span>
                  <span class="li-name">${cc?.name || item.description || 'Unknown'}</span>
                  <span class="li-amount">${this.formatMoney(item.amount)}</span>
                </div>
              `;
            }).join('')
          }
        </div>

        <div class="line-items-footer">
          <span class="total-label">Total:</span>
          <span class="total-value">${this.formatMoney(total)}</span>
        </div>
      </section>
    `;
  }

  filterLineItems(query) {
    this.searchFilter = query;
    const container = document.getElementById('lineItemsContainer');
    if (container) {
      // Re-render just the line items section
      const section = container.closest('.po-section');
      const canEdit = !this.currentPO.id || ['pending'].includes(this.currentPO.status_detail) || this.currentPO.approval_status === 'rejected';
      section.outerHTML = this.renderLineItems(canEdit || this.isEditing);
    }
  }

  // ============================================================
  // LINKED BILLS SECTION
  // ============================================================

  renderLinkedBills() {
    const invoices = this.currentPO.invoices || [];
    if (invoices.length === 0) return '';

    const totalBilled = invoices
      .filter(inv => ['approved', 'in_draw', 'paid'].includes(inv.status))
      .reduce((sum, inv) => sum + parseFloat(inv.amount || 0), 0);

    return `
      <section class="po-section">
        <div class="section-header">
          <h4>Linked Bills</h4>
          <span class="badge">${invoices.length}</span>
        </div>

        <div class="bills-list">
          ${invoices.map(inv => `
            <div class="bill-row">
              <span class="bill-number">${inv.invoice_number || 'No #'}</span>
              <span class="bill-date">${this.formatDate(inv.invoice_date)}</span>
              <span class="status-badge status-${inv.status}">${inv.status}</span>
              <span class="bill-amount">${this.formatMoney(inv.amount)}</span>
            </div>
          `).join('')}
        </div>

        <div class="bills-summary">
          <span>Total Billed: <strong>${this.formatMoney(totalBilled)}</strong></span>
        </div>
      </section>
    `;
  }

  // ============================================================
  // FILES SECTION
  // ============================================================

  renderFiles() {
    return `
      <section class="po-section">
        <div class="section-header">
          <h4>Files</h4>
          <button type="button" class="btn btn-sm btn-secondary" onclick="document.getElementById('poFileInput').click()">+ Upload</button>
          <input type="file" id="poFileInput" style="display: none" onchange="window.poModals.uploadFile(this.files[0])">
        </div>

        ${this.attachments.length === 0 ?
          '<div class="empty-state small">No files attached</div>' :
          `<div class="files-list">
            ${this.attachments.map(att => `
              <div class="file-row">
                <span class="file-icon">${this.getFileIcon(att.file_type)}</span>
                <span class="file-name">${this.escapeHtml(att.file_name)}</span>
                <span class="file-size">${this.formatFileSize(att.file_size)}</span>
                <button class="btn-icon" onclick="window.poModals.downloadAttachment('${att.id}')" title="Download">↓</button>
                <button class="btn-icon btn-delete" onclick="window.poModals.deleteAttachment('${att.id}')" title="Delete">×</button>
              </div>
            `).join('')}
          </div>`
        }
      </section>
    `;
  }

  // ============================================================
  // NOTES SECTION
  // ============================================================

  renderNotes(canEdit) {
    const po = this.currentPO;

    if (canEdit || this.isEditing) {
      return `
        <section class="po-section">
          <div class="section-header">
            <h4>Notes & Scope</h4>
          </div>
          <div class="form-group">
            <label>Scope of Work</label>
            <textarea id="poScopeOfWork" rows="4" class="form-control" placeholder="Describe the work to be performed...">${this.escapeHtml(po.scope_of_work || '')}</textarea>
          </div>
          <div class="form-group">
            <label>Internal Notes</label>
            <textarea id="poNotes" rows="2" class="form-control" placeholder="Internal notes...">${this.escapeHtml(po.notes || '')}</textarea>
          </div>
        </section>
      `;
    }

    if (!po.scope_of_work && !po.notes) return '';

    return `
      <section class="po-section">
        ${po.scope_of_work ? `
          <div class="notes-block">
            <h5>Scope of Work</h5>
            <p>${this.escapeHtml(po.scope_of_work).replace(/\n/g, '<br>')}</p>
          </div>
        ` : ''}
        ${po.notes ? `
          <div class="notes-block">
            <h5>Notes</h5>
            <p>${this.escapeHtml(po.notes)}</p>
          </div>
        ` : ''}
      </section>
    `;
  }

  // ============================================================
  // SUMMARY CARD (Right Panel)
  // ============================================================

  renderSummaryCard() {
    const po = this.currentPO;
    const isNew = !po.id;

    if (isNew) {
      return `
        <div class="po-summary-card">
          <h4>New Purchase Order</h4>
          <p class="help-text">Fill out the details to create a new PO.</p>
        </div>
      `;
    }

    const totalAmount = parseFloat(po.total_amount || 0);
    const billedAmount = (po.invoices || [])
      .filter(inv => ['approved', 'in_draw', 'paid'].includes(inv.status))
      .reduce((sum, inv) => sum + parseFloat(inv.amount || 0), 0);
    const remainingAmount = totalAmount - billedAmount;
    const billedPercent = totalAmount > 0 ? Math.round((billedAmount / totalAmount) * 100) : 0;

    return `
      <div class="po-summary-card">
        <div class="summary-header">
          <span class="status-badge status-${this.getStatusClass(po.status_detail, po.approval_status)}">${this.getStatusLabel(po.status_detail, po.approval_status)}</span>
        </div>

        <div class="summary-amounts">
          <div class="amount-row main">
            <span class="label">PO Total</span>
            <span class="value">${this.formatMoney(totalAmount)}</span>
          </div>
          <div class="amount-row">
            <span class="label">Billed</span>
            <span class="value">${this.formatMoney(billedAmount)}</span>
          </div>
          <div class="amount-row ${remainingAmount < 0 ? 'negative' : ''}">
            <span class="label">Remaining</span>
            <span class="value">${this.formatMoney(remainingAmount)}</span>
          </div>
        </div>

        <div class="summary-progress">
          <div class="progress-bar">
            <div class="progress-fill ${billedPercent > 100 ? 'over' : ''}" style="width: ${Math.min(billedPercent, 100)}%"></div>
          </div>
          <span class="progress-label">${billedPercent}% billed</span>
        </div>

        <div class="summary-stats">
          <div class="stat">
            <span class="stat-value">${this.currentLineItems.length}</span>
            <span class="stat-label">Line Items</span>
          </div>
          <div class="stat">
            <span class="stat-value">${(po.invoices || []).length}</span>
            <span class="stat-label">Invoices</span>
          </div>
          <div class="stat">
            <span class="stat-value">${this.attachments.length}</span>
            <span class="stat-label">Files</span>
          </div>
        </div>

        ${po.created_at ? `
        <div class="summary-meta">
          <span>Created ${this.formatDate(po.created_at)}</span>
        </div>` : ''}
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

      // Edit button for pending POs
      if (['pending'].includes(status) || approval === 'rejected') {
        actions += `<button class="btn btn-secondary" onclick="window.poModals.startEdit()">Edit</button>`;
      }

      // Status-specific actions
      if (status === 'pending' && approval === 'pending') {
        actions += `
          <button class="btn btn-primary" onclick="window.poModals.submitForApproval()">Submit for Approval</button>
        `;
      } else if (approval === 'pending' && status !== 'pending') {
        actions += `
          <button class="btn btn-danger" onclick="window.poModals.rejectPO()">Reject</button>
          <button class="btn btn-success" onclick="window.poModals.approvePO()">Approve</button>
        `;
      } else if (['approved', 'active'].includes(status)) {
        actions += `<button class="btn btn-secondary" onclick="window.poModals.closePO()">Close PO</button>`;
      } else if (status === 'closed') {
        actions += `<button class="btn btn-secondary" onclick="window.poModals.reopenPO()">Reopen</button>`;
      }

      // Delete for pending
      if (status === 'pending') {
        actions += `<button class="btn btn-danger" onclick="window.poModals.deletePO()">Delete</button>`;
      }

      // Close modal button
      actions = `<button class="btn btn-secondary" onclick="window.poModals.closeModal()">Close</button>` + actions;
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
    this.renderLineItemsSection();
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
    this.renderLineItemsSection();
  }

  renderLineItemsSection() {
    const canEdit = !this.currentPO.id || ['pending'].includes(this.currentPO.status_detail) || this.currentPO.approval_status === 'rejected';
    const container = document.querySelector('.po-section:has(#lineItemsContainer)');
    if (container) {
      container.outerHTML = this.renderLineItems(canEdit || this.isEditing);
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

      // Re-render files section
      const filesSection = document.querySelector('.po-section:has(.files-list), .po-section:has(#poFileInput)');
      if (filesSection) {
        filesSection.outerHTML = this.renderFiles();
      }

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

      const filesSection = document.querySelector('.po-section:has(.files-list), .po-section:has(#poFileInput)');
      if (filesSection) {
        filesSection.outerHTML = this.renderFiles();
      }

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
    if (jobContainer && typeof SearchablePicker !== 'undefined') {
      const currentJob = jobs.find(j => j.id === this.currentPO.job_id);
      jobContainer.innerHTML = `
        <select id="poJobSelect" class="form-control" onchange="window.poModals.currentPO.job_id = this.value">
          <option value="">Select Job</option>
          ${jobs.map(j => `<option value="${j.id}" ${j.id === this.currentPO.job_id ? 'selected' : ''}>${j.name}</option>`).join('')}
        </select>
      `;
    }

    // Vendor picker
    const vendorContainer = document.getElementById('po-vendor-picker-container');
    if (vendorContainer && typeof SearchablePicker !== 'undefined') {
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

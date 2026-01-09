// ============================================================
// PO MODALS - Two Panel Layout
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
  }

  // ============================================================
  // TWO PANEL LAYOUT
  // ============================================================

  renderTwoPanelLayout() {
    const po = this.currentPO;
    const isNew = !po.id;
    const canEdit = isNew || this.isEditing;

    return `
      <div class="po-split-view">
        <!-- Left Panel: Summary & Invoices -->
        <div class="po-left-panel">
          ${this.renderLeftPanel(isNew)}
        </div>

        <!-- Right Panel: Details & Line Items -->
        <div class="po-right-panel">
          ${this.renderRightPanel(canEdit, isNew)}
        </div>
      </div>
    `;
  }

  renderLeftPanel(isNew) {
    const po = this.currentPO;
    const vendor = po.vendor || window.poState?.vendors?.find(v => v.id === po.vendor_id);
    const job = po.job || window.poState?.jobs?.find(j => j.id === po.job_id);

    const totalAmount = parseFloat(po.total_amount || 0);
    const billedAmount = (po.invoices || [])
      .filter(inv => ['approved', 'in_draw', 'paid'].includes(inv.status))
      .reduce((sum, inv) => sum + parseFloat(inv.amount || 0), 0);
    const paidAmount = (po.invoices || [])
      .filter(inv => inv.status === 'paid')
      .reduce((sum, inv) => sum + parseFloat(inv.amount || 0), 0);
    const remainingAmount = totalAmount - billedAmount;
    const billedPercent = totalAmount > 0 ? Math.round((billedAmount / totalAmount) * 100) : 0;

    if (isNew) {
      return `
        <div class="po-summary-section">
          <div class="summary-placeholder">
            <div class="placeholder-icon">📋</div>
            <p>Fill in the details to create a new Purchase Order</p>
          </div>
        </div>
      `;
    }

    return `
      <!-- Amount Summary -->
      <div class="po-summary-section">
        <div class="po-amount-display">
          <span class="amount-label">PO Amount</span>
          <span class="amount-value">${this.formatMoney(totalAmount)}</span>
        </div>

        <div class="po-progress-section">
          <div class="progress-bar-container">
            <div class="progress-bar-fill ${billedPercent > 100 ? 'over' : ''}" style="width: ${Math.min(billedPercent, 100)}%"></div>
          </div>
          <div class="progress-stats">
            <div class="progress-stat">
              <span class="stat-value">${this.formatMoney(billedAmount)}</span>
              <span class="stat-label">Billed</span>
            </div>
            <div class="progress-stat">
              <span class="stat-value ${remainingAmount < 0 ? 'negative' : ''}">${this.formatMoney(remainingAmount)}</span>
              <span class="stat-label">Remaining</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Job & Vendor Info -->
      <div class="po-info-section">
        <div class="info-row">
          <span class="info-label">Job</span>
          <span class="info-value">${job?.name || '—'}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Vendor</span>
          <span class="info-value">${vendor?.name || '—'}</span>
        </div>
        ${po.description ? `
        <div class="info-row">
          <span class="info-label">Description</span>
          <span class="info-value">${this.escapeHtml(po.description)}</span>
        </div>
        ` : ''}
        ${po.approved_at ? `
        <div class="info-row">
          <span class="info-label">Approved</span>
          <span class="info-value">${this.formatDate(po.approved_at)}${po.approved_by ? ` by ${po.approved_by}` : ''}</span>
        </div>
        ` : ''}
      </div>

      <!-- Linked Invoices -->
      ${this.renderLinkedInvoices()}

      <!-- Attachments -->
      ${this.renderAttachmentsList()}
    `;
  }

  renderRightPanel(canEdit, isNew) {
    if (canEdit) {
      return this.renderEditForm();
    }
    return this.renderReadOnlyDetails();
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
      <div class="po-edit-form">
        <!-- Basic Info -->
        <div class="form-section">
          <h4>PO Details</h4>

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
            <input type="text" id="poDescription" value="${this.escapeHtml(po.description || '')}" class="form-control" placeholder="Brief description">
          </div>
        </div>

        <!-- Line Items -->
        <div class="form-section">
          <div class="section-header">
            <h4>Line Items</h4>
            <button type="button" class="btn btn-sm btn-secondary" onclick="window.poModals.addLineItem()">+ Add</button>
          </div>

          <div class="line-items-list" id="lineItemsContainer">
            ${this.currentLineItems.length === 0 ?
              `<div class="empty-state small">No line items yet</div>` :
              this.currentLineItems.map((item, index) => `
                <div class="line-item-row" data-index="${index}">
                  <select class="form-control cc-select" onchange="window.poModals.updateLineItem(${index}, 'cost_code_id', this.value)">
                    <option value="">Select cost code</option>
                    ${costCodes.map(cc => `
                      <option value="${cc.id}" ${item.cost_code_id === cc.id ? 'selected' : ''}>${cc.code} - ${cc.name}</option>
                    `).join('')}
                  </select>
                  <input type="text" placeholder="Description" value="${this.escapeHtml(item.description || '')}" class="form-control"
                    onchange="window.poModals.updateLineItem(${index}, 'description', this.value)">
                  <input type="number" placeholder="0.00" value="${item.amount || ''}" step="0.01" class="form-control amount-field"
                    onchange="window.poModals.updateLineItem(${index}, 'amount', this.value)">
                  <button type="button" class="btn-icon-delete" onclick="window.poModals.removeLineItem(${index})">×</button>
                </div>
              `).join('')
            }
          </div>

          <div class="line-items-footer">
            <span class="total-label">Total:</span>
            <span class="total-value" id="lineItemsTotal">${this.formatMoney(total)}</span>
          </div>
        </div>

        <!-- Scope & Notes -->
        <div class="form-section">
          <h4>Scope & Notes</h4>
          <div class="form-group">
            <label>Scope of Work</label>
            <textarea id="poScopeOfWork" rows="3" class="form-control" placeholder="Describe the work...">${this.escapeHtml(po.scope_of_work || '')}</textarea>
          </div>
          <div class="form-group">
            <label>Internal Notes</label>
            <textarea id="poNotes" rows="2" class="form-control" placeholder="Notes...">${this.escapeHtml(po.notes || '')}</textarea>
          </div>
        </div>
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
      <div class="po-details-view">
        <!-- Line Items -->
        <div class="detail-section">
          <h4>Line Items</h4>
          ${this.currentLineItems.length === 0 ?
            `<div class="empty-state small">No line items</div>` :
            `<div class="line-items-display">
              ${this.currentLineItems.map(item => {
                const cc = item.cost_code || costCodes.find(c => c.id === item.cost_code_id);
                return `
                  <div class="line-item-display">
                    <div class="item-info">
                      <span class="item-code">${cc?.code || ''}</span>
                      <span class="item-name">${cc?.name || item.description || '—'}</span>
                    </div>
                    <span class="item-amount">${this.formatMoney(item.amount)}</span>
                  </div>
                `;
              }).join('')}
              <div class="line-items-total-row">
                <span>Total</span>
                <span>${this.formatMoney(total)}</span>
              </div>
            </div>`
          }
        </div>

        <!-- Scope of Work -->
        ${po.scope_of_work ? `
        <div class="detail-section">
          <h4>Scope of Work</h4>
          <div class="scope-text">${this.escapeHtml(po.scope_of_work).replace(/\n/g, '<br>')}</div>
        </div>
        ` : ''}

        <!-- Notes -->
        ${po.notes ? `
        <div class="detail-section">
          <h4>Notes</h4>
          <div class="notes-text">${this.escapeHtml(po.notes).replace(/\n/g, '<br>')}</div>
        </div>
        ` : ''}

        <!-- Activity Log -->
        ${this.renderActivityLog()}
      </div>
    `;
  }

  // ============================================================
  // LINKED INVOICES (Left Panel)
  // ============================================================

  renderLinkedInvoices() {
    const invoices = this.currentPO.invoices || [];

    if (invoices.length === 0) {
      return `
        <div class="po-invoices-section">
          <h4>Linked Invoices</h4>
          <div class="empty-state small">No invoices linked</div>
        </div>
      `;
    }

    return `
      <div class="po-invoices-section">
        <h4>Linked Invoices <span class="count-badge">${invoices.length}</span></h4>
        <div class="invoices-list">
          ${invoices.map(inv => `
            <div class="invoice-item" onclick="window.location.href='index.html?invoice=${inv.id}'">
              <div class="invoice-info">
                <span class="invoice-number">#${inv.invoice_number || '—'}</span>
                <span class="invoice-date">${this.formatDate(inv.invoice_date)}</span>
              </div>
              <div class="invoice-right">
                <span class="invoice-amount">${this.formatMoney(inv.amount)}</span>
                <span class="status-dot status-${inv.status}"></span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // ============================================================
  // ATTACHMENTS LIST (Left Panel)
  // ============================================================

  renderAttachmentsList() {
    if (this.attachments.length === 0) {
      return '';
    }

    return `
      <div class="po-attachments-section">
        <h4>Attachments <span class="count-badge">${this.attachments.length}</span></h4>
        <div class="attachments-list">
          ${this.attachments.map(att => `
            <div class="attachment-item">
              <span class="att-icon">${this.getFileIcon(att.file_type)}</span>
              <span class="att-name">${this.escapeHtml(att.file_name)}</span>
              <button class="btn-icon" onclick="window.poModals.downloadAttachment('${att.id}')" title="Download">↓</button>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // ============================================================
  // ACTIVITY LOG (Right Panel, Read-Only)
  // ============================================================

  renderActivityLog() {
    const activity = this.currentPO.activity || [];

    if (activity.length === 0) {
      return '';
    }

    return `
      <div class="detail-section">
        <h4>Activity</h4>
        <div class="activity-list">
          ${activity.slice(0, 5).map(act => `
            <div class="activity-item">
              <span class="activity-dot"></span>
              <div class="activity-content">
                <span class="activity-text">${this.escapeHtml(act.description || act.action)}</span>
                <span class="activity-time">${this.formatRelativeTime(act.created_at)}</span>
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

      // Close button
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
    // Reload original data
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
    const isNew = !this.currentPO.id;
    const canEdit = isNew || this.isEditing;
    const container = document.getElementById('lineItemsContainer');
    if (container && canEdit) {
      const costCodes = window.poState?.costCodes || [];
      container.innerHTML = this.currentLineItems.length === 0 ?
        `<div class="empty-state small">No line items yet</div>` :
        this.currentLineItems.map((item, index) => `
          <div class="line-item-row" data-index="${index}">
            <select class="form-control cc-select" onchange="window.poModals.updateLineItem(${index}, 'cost_code_id', this.value)">
              <option value="">Select cost code</option>
              ${costCodes.map(cc => `
                <option value="${cc.id}" ${item.cost_code_id === cc.id ? 'selected' : ''}>${cc.code} - ${cc.name}</option>
              `).join('')}
            </select>
            <input type="text" placeholder="Description" value="${this.escapeHtml(item.description || '')}" class="form-control"
              onchange="window.poModals.updateLineItem(${index}, 'description', this.value)">
            <input type="number" placeholder="0.00" value="${item.amount || ''}" step="0.01" class="form-control amount-field"
              onchange="window.poModals.updateLineItem(${index}, 'amount', this.value)">
            <button type="button" class="btn-icon-delete" onclick="window.poModals.removeLineItem(${index})">×</button>
          </div>
        `).join('');
      this.updateLineItemsTotal();
    }
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

    // Get form values
    const poNumber = document.getElementById('poNumber')?.value?.trim();
    const description = document.getElementById('poDescription')?.value?.trim();
    const scopeOfWork = document.getElementById('poScopeOfWork')?.value?.trim();
    const notes = document.getElementById('poNotes')?.value?.trim();

    // Get job/vendor from pickers
    const jobId = this.selectedJobId || po.job_id;
    const vendorId = this.selectedVendorId || po.vendor_id;

    // Validate
    if (!jobId) {
      window.showToast?.('Please select a job', 'error');
      return;
    }
    if (!vendorId) {
      window.showToast?.('Please select a vendor', 'error');
      return;
    }

    // Calculate total
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

      // Refresh list
      if (window.loadPOs) window.loadPOs();

      // Reopen in view mode
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

  async uploadFile(file) {
    if (!file || !this.currentPO.id) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`/api/purchase-orders/${this.currentPO.id}/attachments`, {
        method: 'POST',
        body: formData
      });

      if (!res.ok) throw new Error('Upload failed');

      window.showToast?.('File uploaded', 'success');
      this.openPO(this.currentPO.id);
    } catch (err) {
      window.showToast?.(err.message, 'error');
    }
  }

  async downloadAttachment(attachmentId) {
    window.open(`/api/attachments/${attachmentId}/download`, '_blank');
  }

  async deleteAttachment(attachmentId) {
    if (!confirm('Delete this attachment?')) return;

    try {
      const res = await fetch(`/api/attachments/${attachmentId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');

      window.showToast?.('Attachment deleted', 'success');
      this.openPO(this.currentPO.id);
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

    // Job picker
    const jobContainer = document.getElementById('po-job-picker-container');
    if (jobContainer) {
      jobContainer.innerHTML = `
        <select id="poJobSelect" class="form-control" onchange="window.poModals.selectedJobId = this.value">
          <option value="">Select Job</option>
          ${jobs.map(j => `<option value="${j.id}" ${j.id === this.currentPO.job_id ? 'selected' : ''}>${j.name}</option>`).join('')}
        </select>
      `;
      this.selectedJobId = this.currentPO.job_id;
    }

    // Vendor picker
    const vendorContainer = document.getElementById('po-vendor-picker-container');
    if (vendorContainer) {
      vendorContainer.innerHTML = `
        <select id="poVendorSelect" class="form-control" onchange="window.poModals.selectedVendorId = this.value">
          <option value="">Select Vendor</option>
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

  formatFileSize(bytes) {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }
}

// Initialize global instance
window.poModals = new POModals();

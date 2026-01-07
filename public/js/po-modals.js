// ============================================================
// PO MODALS - Enhanced with Tabbed Interface
// ============================================================

class POModals {
  constructor() {
    this.currentPO = null;
    this.currentLineItems = [];
    this.attachments = [];
    this.isEditing = false;
    this.activeTab = 'overview';
    this.jobPicker = null;
    this.vendorPicker = null;
  }

  // ============================================================
  // MODAL MANAGEMENT
  // ============================================================

  openModal() {
    document.getElementById('poModal').classList.add('active');
  }

  closeModal() {
    document.getElementById('poModal').classList.remove('active');
    this.currentPO = null;
    this.currentLineItems = [];
    this.attachments = [];
    this.isEditing = false;
    this.activeTab = 'overview';
  }

  // ============================================================
  // OPEN EXISTING PO
  // ============================================================

  async openPO(poId) {
    try {
      document.getElementById('poSummaryPanel').innerHTML = '<div class="loading">Loading...</div>';
      document.getElementById('poEditPanel').innerHTML = '<div class="loading">Loading...</div>';
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
      schedule_end_date: null,
      schedule_notes: '',
      contact_name: '',
      contact_phone: '',
      contact_email: ''
    };
    this.currentLineItems = [];
    this.attachments = [];
    this.isEditing = true;
    this.activeTab = 'overview';

    this.renderPOModal();
    this.openModal();
  }

  // ============================================================
  // RENDER MODAL
  // ============================================================

  renderPOModal() {
    const po = this.currentPO;
    const isNew = !po.id;

    document.getElementById('poModalTitle').textContent = isNew ? 'New Purchase Order' : (po.po_number || 'Purchase Order');

    this.renderTabbedContent();
    this.renderFooterActions();
  }

  renderTabbedContent() {
    const leftPanel = document.getElementById('poSummaryPanel');
    const rightPanel = document.getElementById('poEditPanel');
    const po = this.currentPO;
    const isNew = !po.id;

    // Left panel: Tabs navigation + content
    leftPanel.innerHTML = `
      <div class="po-tabs">
        <button class="po-tab ${this.activeTab === 'overview' ? 'active' : ''}" onclick="window.poModals.switchTab('overview')">Overview</button>
        <button class="po-tab ${this.activeTab === 'scope' ? 'active' : ''}" onclick="window.poModals.switchTab('scope')">Scope</button>
        <button class="po-tab ${this.activeTab === 'schedule' ? 'active' : ''}" onclick="window.poModals.switchTab('schedule')">Schedule</button>
        <button class="po-tab ${this.activeTab === 'costcodes' ? 'active' : ''}" onclick="window.poModals.switchTab('costcodes')">Cost Codes</button>
        <button class="po-tab ${this.activeTab === 'bills' ? 'active' : ''}" onclick="window.poModals.switchTab('bills')">Bills${po.invoices?.length ? ` (${po.invoices.length})` : ''}</button>
        <button class="po-tab ${this.activeTab === 'attachments' ? 'active' : ''}" onclick="window.poModals.switchTab('attachments')">Files${this.attachments?.length ? ` (${this.attachments.length})` : ''}</button>
        <button class="po-tab ${this.activeTab === 'activity' ? 'active' : ''}" onclick="window.poModals.switchTab('activity')">Activity</button>
      </div>
      <div class="po-tab-content" id="poTabContent">
        ${this.renderTabContent()}
      </div>
    `;

    // Right panel: Quick info summary (always visible)
    rightPanel.innerHTML = this.renderQuickInfo();
  }

  switchTab(tab) {
    this.activeTab = tab;
    document.querySelectorAll('.po-tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`.po-tab[onclick*="${tab}"]`)?.classList.add('active');
    document.getElementById('poTabContent').innerHTML = this.renderTabContent();

    // Re-initialize pickers if on overview tab
    if (tab === 'overview' && this.isEditing) {
      setTimeout(() => this.initializePickers(), 50);
    }
  }

  renderTabContent() {
    switch (this.activeTab) {
      case 'overview': return this.renderOverviewTab();
      case 'scope': return this.renderScopeTab();
      case 'schedule': return this.renderScheduleTab();
      case 'costcodes': return this.renderCostCodesTab();
      case 'bills': return this.renderBillsTab();
      case 'attachments': return this.renderAttachmentsTab();
      case 'activity': return this.renderActivityTab();
      default: return this.renderOverviewTab();
    }
  }

  // ============================================================
  // TAB: OVERVIEW
  // ============================================================

  renderOverviewTab() {
    const po = this.currentPO;
    const isNew = !po.id;
    const canEdit = isNew || ['pending'].includes(po.status_detail) || po.approval_status === 'rejected';

    if (canEdit || this.isEditing) {
      return `
        <form class="po-form" id="poOverviewForm">
          <div class="form-row">
            <div class="form-group flex-1">
              <label>PO Number</label>
              <input type="text" id="poNumber" value="${po.po_number || ''}" placeholder="Auto-generated if blank" class="form-control">
            </div>
            <div class="form-group flex-1">
              <label>Status</label>
              <div class="status-display">
                <span class="status-badge status-${this.getStatusClass(po.status_detail, po.approval_status)}">${this.getStatusLabel(po.status_detail, po.approval_status)}</span>
              </div>
            </div>
          </div>

          <div class="form-group">
            <label>Job *</label>
            <div id="po-job-picker-container" class="search-picker-container"></div>
          </div>

          <div class="form-group">
            <label>Vendor *</label>
            <div id="po-vendor-picker-container" class="search-picker-container"></div>
          </div>

          <div class="form-group">
            <label>Description</label>
            <input type="text" id="poDescription" value="${this.escapeHtml(po.description || '')}" class="form-control" placeholder="Brief description of work">
          </div>

          <div class="form-row">
            <div class="form-group flex-1">
              <label>Contact Name</label>
              <input type="text" id="poContactName" value="${this.escapeHtml(po.contact_name || '')}" class="form-control">
            </div>
            <div class="form-group flex-1">
              <label>Contact Phone</label>
              <input type="text" id="poContactPhone" value="${this.escapeHtml(po.contact_phone || '')}" class="form-control">
            </div>
          </div>

          <div class="form-group">
            <label>Contact Email</label>
            <input type="email" id="poContactEmail" value="${this.escapeHtml(po.contact_email || '')}" class="form-control">
          </div>

          <div class="form-group">
            <label>Notes</label>
            <textarea id="poNotes" rows="3" class="form-control">${this.escapeHtml(po.notes || '')}</textarea>
          </div>
        </form>
      `;
    }

    // Read-only view
    const vendor = po.vendor || window.poState?.vendors?.find(v => v.id === po.vendor_id);
    const job = po.job || window.poState?.jobs?.find(j => j.id === po.job_id);

    return `
      <div class="po-readonly">
        <div class="info-row">
          <span class="info-label">PO Number:</span>
          <span class="info-value">${po.po_number || 'Draft'}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Status:</span>
          <span class="status-badge status-${this.getStatusClass(po.status_detail, po.approval_status)}">${this.getStatusLabel(po.status_detail, po.approval_status)}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Job:</span>
          <span class="info-value">${job?.name || 'Not assigned'}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Vendor:</span>
          <span class="info-value">${vendor?.name || 'Not assigned'}</span>
        </div>
        ${po.description ? `
        <div class="info-row">
          <span class="info-label">Description:</span>
          <span class="info-value">${this.escapeHtml(po.description)}</span>
        </div>` : ''}
        ${po.contact_name ? `
        <div class="info-row">
          <span class="info-label">Contact:</span>
          <span class="info-value">${this.escapeHtml(po.contact_name)}${po.contact_phone ? ` - ${po.contact_phone}` : ''}</span>
        </div>` : ''}
        ${po.notes ? `
        <div class="info-section">
          <h4>Notes</h4>
          <p>${this.escapeHtml(po.notes)}</p>
        </div>` : ''}
      </div>
    `;
  }

  // ============================================================
  // TAB: SCOPE OF WORK
  // ============================================================

  renderScopeTab() {
    const po = this.currentPO;
    const isNew = !po.id;
    const canEdit = isNew || ['pending'].includes(po.status_detail) || po.approval_status === 'rejected';

    if (canEdit || this.isEditing) {
      return `
        <div class="scope-editor">
          <h4>Scope of Work</h4>
          <p class="help-text">Describe the work to be performed, deliverables, and any special requirements.</p>
          <textarea id="poScopeOfWork" rows="15" class="form-control scope-textarea" placeholder="Enter detailed scope of work...">${this.escapeHtml(po.scope_of_work || '')}</textarea>
        </div>
      `;
    }

    return `
      <div class="scope-readonly">
        <h4>Scope of Work</h4>
        ${po.scope_of_work ? `
          <div class="scope-content">${this.escapeHtml(po.scope_of_work).replace(/\n/g, '<br>')}</div>
        ` : '<p class="empty-state">No scope of work defined</p>'}
      </div>
    `;
  }

  // ============================================================
  // TAB: SCHEDULE
  // ============================================================

  renderScheduleTab() {
    const po = this.currentPO;
    const isNew = !po.id;
    const canEdit = isNew || ['pending', 'approved', 'active'].includes(po.status_detail);

    if (canEdit || this.isEditing) {
      return `
        <div class="schedule-editor">
          <h4>Schedule & Assignment</h4>

          <div class="form-row">
            <div class="form-group flex-1">
              <label>Start Date</label>
              <input type="date" id="poStartDate" value="${po.schedule_start_date || ''}" class="form-control">
            </div>
            <div class="form-group flex-1">
              <label>End Date</label>
              <input type="date" id="poEndDate" value="${po.schedule_end_date || ''}" class="form-control">
            </div>
          </div>

          <div class="form-group">
            <label>Assigned To</label>
            <input type="text" id="poAssignedTo" value="${this.escapeHtml(po.assigned_to || '')}" class="form-control" placeholder="Project manager, superintendent, etc.">
          </div>

          <div class="form-group">
            <label>Schedule Notes</label>
            <textarea id="poScheduleNotes" rows="4" class="form-control" placeholder="Any scheduling constraints, milestones, or dependencies...">${this.escapeHtml(po.schedule_notes || '')}</textarea>
          </div>
        </div>
      `;
    }

    return `
      <div class="schedule-readonly">
        <h4>Schedule & Assignment</h4>
        <div class="info-row">
          <span class="info-label">Start Date:</span>
          <span class="info-value">${po.schedule_start_date ? this.formatDate(po.schedule_start_date) : 'Not set'}</span>
        </div>
        <div class="info-row">
          <span class="info-label">End Date:</span>
          <span class="info-value">${po.schedule_end_date ? this.formatDate(po.schedule_end_date) : 'Not set'}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Assigned To:</span>
          <span class="info-value">${po.assigned_to || 'Not assigned'}</span>
        </div>
        ${po.schedule_notes ? `
        <div class="info-section">
          <h5>Schedule Notes</h5>
          <p>${this.escapeHtml(po.schedule_notes)}</p>
        </div>` : ''}
      </div>
    `;
  }

  // ============================================================
  // TAB: COST CODES (Line Items)
  // ============================================================

  renderCostCodesTab() {
    const po = this.currentPO;
    const isNew = !po.id;
    const canEdit = isNew || ['pending'].includes(po.status_detail) || po.approval_status === 'rejected';
    const costCodes = window.poState?.costCodes || [];

    const total = this.currentLineItems.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);

    if (canEdit || this.isEditing) {
      return `
        <div class="costcodes-editor">
          <div class="section-header">
            <h4>Cost Code Allocations</h4>
            <button type="button" class="btn btn-sm btn-secondary" onclick="window.poModals.addLineItem()">+ Add Line Item</button>
          </div>

          <div class="line-items-edit" id="lineItemsContainer">
            ${this.currentLineItems.length === 0 ?
              '<div class="empty-line-items">No line items. Click "Add Line Item" to start.</div>' :
              this.currentLineItems.map((item, index) => `
                <div class="line-item-edit" data-index="${index}">
                  <select class="li-cost-code form-control" onchange="window.poModals.updateLineItem(${index}, 'cost_code_id', this.value)">
                    <option value="">Select Cost Code</option>
                    ${costCodes.map(cc => `
                      <option value="${cc.id}" ${item.cost_code_id === cc.id ? 'selected' : ''}>${cc.code} - ${cc.name}</option>
                    `).join('')}
                  </select>
                  <input type="text" class="li-description form-control" placeholder="Description (optional)" value="${this.escapeHtml(item.description || '')}"
                    onchange="window.poModals.updateLineItem(${index}, 'description', this.value)">
                  <input type="number" class="li-amount form-control" placeholder="Amount" value="${item.amount || ''}"
                    onchange="window.poModals.updateLineItem(${index}, 'amount', this.value)">
                  <button type="button" class="btn btn-sm btn-danger" onclick="window.poModals.removeLineItem(${index})">X</button>
                </div>
              `).join('')
            }
          </div>

          <div class="line-items-total">
            <span class="label">Total:</span>
            <span class="value" id="lineItemsTotal">${this.formatMoney(total)}</span>
          </div>
        </div>
      `;
    }

    // Read-only view
    return `
      <div class="costcodes-readonly">
        <h4>Cost Code Allocations</h4>
        ${this.currentLineItems.length === 0 ?
          '<div class="empty-state">No cost code allocations</div>' :
          `<div class="line-items-list">
            ${this.currentLineItems.map(item => {
              const costCode = item.cost_code || costCodes.find(c => c.id === item.cost_code_id);
              return `
                <div class="line-item-row">
                  <span class="li-code">${costCode?.code || ''}</span>
                  <span class="li-name">${costCode?.name || item.description || 'Unknown'}</span>
                  <span class="li-amount">${this.formatMoney(item.amount)}</span>
                </div>
              `;
            }).join('')}
            <div class="line-item-row total-row">
              <span class="li-code"></span>
              <span class="li-name"><strong>Total</strong></span>
              <span class="li-amount"><strong>${this.formatMoney(total)}</strong></span>
            </div>
          </div>`
        }
      </div>
    `;
  }

  // ============================================================
  // TAB: BILLS (Linked Invoices)
  // ============================================================

  renderBillsTab() {
    const po = this.currentPO;
    const invoices = po.invoices || [];

    if (invoices.length === 0) {
      return `
        <div class="bills-tab">
          <h4>Linked Bills / Invoices</h4>
          <div class="empty-state">No invoices have been linked to this PO yet.</div>
          <p class="help-text">Invoices are linked when processed through the invoice approval system.</p>
        </div>
      `;
    }

    const totalBilled = invoices
      .filter(inv => ['approved', 'in_draw', 'paid'].includes(inv.status))
      .reduce((sum, inv) => sum + parseFloat(inv.amount || 0), 0);

    return `
      <div class="bills-tab">
        <div class="section-header">
          <h4>Linked Bills / Invoices</h4>
          <span class="section-badge">${invoices.length} invoice${invoices.length !== 1 ? 's' : ''}</span>
        </div>

        <div class="bills-summary">
          <div class="summary-item">
            <span class="label">Total Billed:</span>
            <span class="value">${this.formatMoney(totalBilled)}</span>
          </div>
          <div class="summary-item">
            <span class="label">PO Total:</span>
            <span class="value">${this.formatMoney(po.total_amount)}</span>
          </div>
          <div class="summary-item ${totalBilled > po.total_amount ? 'over-budget' : ''}">
            <span class="label">Remaining:</span>
            <span class="value">${this.formatMoney(po.total_amount - totalBilled)}</span>
          </div>
        </div>

        <div class="bills-list">
          ${invoices.map(inv => `
            <div class="bill-card" onclick="window.location.href='index.html'">
              <div class="bill-header">
                <span class="bill-number">${inv.invoice_number || 'No Invoice #'}</span>
                <span class="status-badge status-${inv.status}">${inv.status}</span>
              </div>
              <div class="bill-body">
                <div class="bill-vendor">${inv.vendor?.name || 'Unknown Vendor'}</div>
                <div class="bill-date">${this.formatDate(inv.invoice_date)}</div>
              </div>
              <div class="bill-amount">${this.formatMoney(inv.amount)}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // ============================================================
  // TAB: ATTACHMENTS
  // ============================================================

  renderAttachmentsTab() {
    const po = this.currentPO;
    const isNew = !po.id;

    if (isNew) {
      return `
        <div class="attachments-tab">
          <h4>File Attachments</h4>
          <div class="empty-state">Save the PO first before adding attachments.</div>
        </div>
      `;
    }

    return `
      <div class="attachments-tab">
        <div class="section-header">
          <h4>File Attachments</h4>
          <button type="button" class="btn btn-sm btn-secondary" onclick="document.getElementById('poFileInput').click()">+ Upload File</button>
          <input type="file" id="poFileInput" style="display: none" onchange="window.poModals.uploadFile(this.files[0])" accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif">
        </div>

        <div class="upload-area" id="uploadArea" ondrop="window.poModals.handleDrop(event)" ondragover="window.poModals.handleDragOver(event)" ondragleave="window.poModals.handleDragLeave(event)">
          <div class="upload-icon">+</div>
          <p>Drag & drop files here or click "Upload File"</p>
          <span class="help-text">Supported: PDF, Word, Excel, Images</span>
        </div>

        ${this.attachments.length === 0 ?
          '<div class="empty-state">No files attached yet</div>' :
          `<div class="attachments-list">
            ${this.attachments.map(att => `
              <div class="attachment-card">
                <div class="attachment-icon ${att.file_type}">${this.getFileIcon(att.file_type)}</div>
                <div class="attachment-info">
                  <div class="attachment-name">${this.escapeHtml(att.file_name)}</div>
                  <div class="attachment-meta">
                    ${att.category ? `<span class="att-category">${att.category}</span>` : ''}
                    <span class="att-size">${this.formatFileSize(att.file_size)}</span>
                    <span class="att-date">${this.formatDate(att.created_at)}</span>
                  </div>
                  ${att.description ? `<div class="attachment-desc">${this.escapeHtml(att.description)}</div>` : ''}
                </div>
                <div class="attachment-actions">
                  <button class="btn btn-sm" onclick="window.poModals.downloadAttachment('${att.id}')" title="Download">Download</button>
                  <button class="btn btn-sm btn-danger" onclick="window.poModals.deleteAttachment('${att.id}')" title="Delete">X</button>
                </div>
              </div>
            `).join('')}
          </div>`
        }
      </div>
    `;
  }

  // ============================================================
  // TAB: ACTIVITY
  // ============================================================

  renderActivityTab() {
    const po = this.currentPO;
    const activity = po.activity || [];

    if (activity.length === 0) {
      return `
        <div class="activity-tab">
          <h4>Activity Log</h4>
          <div class="empty-state">No activity recorded yet</div>
        </div>
      `;
    }

    return `
      <div class="activity-tab">
        <h4>Activity Log</h4>
        <div class="activity-timeline">
          ${activity.map(act => `
            <div class="activity-entry">
              <div class="activity-dot"></div>
              <div class="activity-content">
                <div class="activity-header">
                  <span class="activity-action">${this.formatAction(act.action)}</span>
                  <span class="activity-time">${this.formatDateTime(act.created_at)}</span>
                </div>
                <div class="activity-by">by ${act.performed_by || 'System'}</div>
                ${act.details && Object.keys(act.details).length > 0 ? `
                  <div class="activity-details">${this.formatDetails(act.details)}</div>
                ` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // ============================================================
  // QUICK INFO (Right Panel)
  // ============================================================

  renderQuickInfo() {
    const po = this.currentPO;
    const isNew = !po.id;

    if (isNew) {
      return `
        <div class="quick-info">
          <h4>New Purchase Order</h4>
          <p class="help-text">Fill out the details on the left to create a new PO.</p>
        </div>
      `;
    }

    const totalAmount = parseFloat(po.total_amount || 0);
    const billedAmount = (po.invoices || [])
      .filter(inv => ['approved', 'in_draw', 'paid'].includes(inv.status))
      .reduce((sum, inv) => sum + parseFloat(inv.amount || 0), 0);
    const remainingAmount = totalAmount - billedAmount;
    const billedPercent = totalAmount > 0 ? Math.round((billedAmount / totalAmount) * 100) : 0;

    const vendor = po.vendor || window.poState?.vendors?.find(v => v.id === po.vendor_id);
    const job = po.job || window.poState?.jobs?.find(j => j.id === po.job_id);

    return `
      <div class="quick-info">
        <div class="quick-header">
          <h4>${po.po_number || 'Draft PO'}</h4>
          <span class="status-badge status-${this.getStatusClass(po.status_detail, po.approval_status)}">${this.getStatusLabel(po.status_detail, po.approval_status)}</span>
        </div>

        <div class="quick-details">
          <div class="quick-row">
            <span class="icon">V</span>
            <span class="value">${vendor?.name || 'No vendor'}</span>
          </div>
          <div class="quick-row">
            <span class="icon">J</span>
            <span class="value">${job?.name || 'No job'}</span>
          </div>
          ${po.assigned_to ? `
          <div class="quick-row">
            <span class="icon">A</span>
            <span class="value">${po.assigned_to}</span>
          </div>` : ''}
        </div>

        <div class="quick-amounts">
          <div class="amount-block">
            <div class="amount-label">PO Total</div>
            <div class="amount-value large">${this.formatMoney(totalAmount)}</div>
          </div>
          <div class="amounts-row">
            <div class="amount-block small">
              <div class="amount-label">Billed</div>
              <div class="amount-value">${this.formatMoney(billedAmount)}</div>
            </div>
            <div class="amount-block small ${remainingAmount < 0 ? 'negative' : ''}">
              <div class="amount-label">Remaining</div>
              <div class="amount-value">${this.formatMoney(remainingAmount)}</div>
            </div>
          </div>
        </div>

        <div class="quick-progress">
          <div class="progress-bar">
            <div class="progress-fill ${billedPercent > 100 ? 'over' : ''}" style="width: ${Math.min(billedPercent, 100)}%"></div>
          </div>
          <div class="progress-label">${billedPercent}% billed</div>
        </div>

        <div class="quick-stats">
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
        <div class="quick-dates">
          <div class="date-row">
            <span class="label">Created:</span>
            <span class="value">${this.formatDate(po.created_at)}</span>
          </div>
          ${po.approved_at ? `
          <div class="date-row">
            <span class="label">Approved:</span>
            <span class="value">${this.formatDate(po.approved_at)}</span>
          </div>` : ''}
        </div>` : ''}
      </div>
    `;
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
    document.getElementById('poTabContent').innerHTML = this.renderCostCodesTab();
  }

  removeLineItem(index) {
    this.currentLineItems.splice(index, 1);
    document.getElementById('poTabContent').innerHTML = this.renderCostCodesTab();
    this.updateQuickInfo();
  }

  updateLineItem(index, field, value) {
    if (field === 'amount') {
      this.currentLineItems[index][field] = parseFloat(value) || 0;
      document.getElementById('lineItemsTotal').textContent = this.formatMoney(this.calculateTotal());
    } else {
      this.currentLineItems[index][field] = value;
    }
    this.updateQuickInfo();
  }

  calculateTotal() {
    return this.currentLineItems.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
  }

  updateQuickInfo() {
    document.getElementById('poEditPanel').innerHTML = this.renderQuickInfo();
  }

  // ============================================================
  // FILE ATTACHMENT HANDLERS
  // ============================================================

  handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    document.getElementById('uploadArea').classList.add('dragover');
  }

  handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    document.getElementById('uploadArea').classList.remove('dragover');
  }

  handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    document.getElementById('uploadArea').classList.remove('dragover');

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      this.uploadFile(files[0]);
    }
  }

  async uploadFile(file) {
    if (!file) return;
    if (!this.currentPO?.id) {
      window.showToast?.('Save the PO first before uploading files', 'error');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('uploaded_by', 'current_user');

    try {
      const res = await fetch(`/api/purchase-orders/${this.currentPO.id}/attachments`, {
        method: 'POST',
        body: formData
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || 'Upload failed');
      }

      const attachment = await res.json();
      this.attachments.unshift(attachment);
      document.getElementById('poTabContent').innerHTML = this.renderAttachmentsTab();
      this.updateQuickInfo();
      window.showToast?.('File uploaded successfully', 'success');
    } catch (err) {
      console.error('Upload error:', err);
      window.showToast?.(err.message, 'error');
    }
  }

  async downloadAttachment(attachmentId) {
    try {
      const res = await fetch(`/api/purchase-orders/${this.currentPO.id}/attachments/${attachmentId}/url`);
      if (!res.ok) throw new Error('Failed to get download URL');

      const { url, fileName } = await res.json();
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Download error:', err);
      window.showToast?.('Failed to download file', 'error');
    }
  }

  async deleteAttachment(attachmentId) {
    if (!confirm('Delete this attachment?')) return;

    try {
      const res = await fetch(`/api/purchase-orders/${this.currentPO.id}/attachments/${attachmentId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deleted_by: 'current_user' })
      });

      if (!res.ok) throw new Error('Failed to delete');

      this.attachments = this.attachments.filter(a => a.id !== attachmentId);
      document.getElementById('poTabContent').innerHTML = this.renderAttachmentsTab();
      this.updateQuickInfo();
      window.showToast?.('File deleted', 'success');
    } catch (err) {
      console.error('Delete error:', err);
      window.showToast?.('Failed to delete file', 'error');
    }
  }

  // ============================================================
  // INITIALIZE PICKERS
  // ============================================================

  initializePickers() {
    const jobContainer = document.getElementById('po-job-picker-container');
    const vendorContainer = document.getElementById('po-vendor-picker-container');

    if (jobContainer && window.SearchablePicker) {
      this.jobPicker = window.SearchablePicker.init(jobContainer, {
        type: 'jobs',
        placeholder: 'Search jobs...',
        initialValue: this.currentPO.job_id,
        onChange: (jobId) => {
          this.currentPO.job_id = jobId;
        }
      });
    }

    if (vendorContainer && window.SearchablePicker) {
      this.vendorPicker = window.SearchablePicker.init(vendorContainer, {
        type: 'vendors',
        placeholder: 'Search vendors...',
        initialValue: this.currentPO.vendor_id,
        onChange: (vendorId) => {
          this.currentPO.vendor_id = vendorId;
        }
      });
    }
  }

  // ============================================================
  // FOOTER ACTIONS
  // ============================================================

  renderFooterActions() {
    const footer = document.getElementById('poModalFooter');
    const po = this.currentPO;
    const isNew = !po.id;
    const status = po.status_detail || po.status;

    let buttons = '';

    if (isNew) {
      buttons = `
        <button class="btn btn-secondary" onclick="window.poModals.closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="window.poModals.savePO()">Create PO</button>
        <button class="btn btn-success" onclick="window.poModals.savePO(true)">Create & Submit</button>
      `;
    } else if (status === 'pending' || po.approval_status === 'rejected') {
      buttons = `
        <button class="btn btn-danger" onclick="window.poModals.deletePO()">Delete</button>
        <button class="btn btn-secondary" onclick="window.poModals.closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="window.poModals.savePO()">Save Changes</button>
        <button class="btn btn-success" onclick="window.poModals.submitForApproval()">Submit for Approval</button>
      `;
    } else if (po.approval_status === 'pending') {
      buttons = `
        <button class="btn btn-secondary" onclick="window.poModals.closeModal()">Close</button>
        <button class="btn btn-danger" onclick="window.poModals.rejectPO()">Reject</button>
        <button class="btn btn-success" onclick="window.poModals.approvePO()">Approve</button>
      `;
    } else if (status === 'approved' || status === 'active' || status === 'open') {
      buttons = `
        <button class="btn btn-secondary" onclick="window.poModals.closeModal()">Close</button>
        <button class="btn btn-primary" onclick="window.poModals.savePO()">Save Changes</button>
        <button class="btn btn-warning" onclick="window.poModals.closePO()">Close PO</button>
      `;
    } else if (status === 'closed') {
      buttons = `
        <button class="btn btn-secondary" onclick="window.poModals.closeModal()">Close</button>
        <button class="btn btn-primary" onclick="window.poModals.reopenPO()">Reopen PO</button>
      `;
    } else {
      buttons = `
        <button class="btn btn-secondary" onclick="window.poModals.closeModal()">Close</button>
      `;
    }

    footer.innerHTML = buttons;
  }

  // ============================================================
  // API ACTIONS
  // ============================================================

  gatherFormData() {
    return {
      po_number: document.getElementById('poNumber')?.value || '',
      job_id: this.currentPO.job_id,
      vendor_id: this.currentPO.vendor_id,
      description: document.getElementById('poDescription')?.value || '',
      scope_of_work: document.getElementById('poScopeOfWork')?.value || this.currentPO.scope_of_work || '',
      notes: document.getElementById('poNotes')?.value || '',
      contact_name: document.getElementById('poContactName')?.value || '',
      contact_phone: document.getElementById('poContactPhone')?.value || '',
      contact_email: document.getElementById('poContactEmail')?.value || '',
      assigned_to: document.getElementById('poAssignedTo')?.value || this.currentPO.assigned_to || '',
      schedule_start_date: document.getElementById('poStartDate')?.value || this.currentPO.schedule_start_date || null,
      schedule_end_date: document.getElementById('poEndDate')?.value || this.currentPO.schedule_end_date || null,
      schedule_notes: document.getElementById('poScheduleNotes')?.value || this.currentPO.schedule_notes || '',
      total_amount: this.calculateTotal(),
      line_items: this.currentLineItems.filter(li => li.cost_code_id && li.amount > 0)
    };
  }

  async savePO(submitAfter = false) {
    const po = this.currentPO;
    const isNew = !po.id;
    const formData = this.gatherFormData();

    // Validation
    if (!formData.job_id) {
      window.showToast?.('Please select a job', 'error');
      this.switchTab('overview');
      return;
    }
    if (!formData.vendor_id) {
      window.showToast?.('Please select a vendor', 'error');
      this.switchTab('overview');
      return;
    }
    if (formData.line_items.length === 0) {
      window.showToast?.('Please add at least one line item with a cost code', 'error');
      this.switchTab('costcodes');
      return;
    }

    try {
      let response;
      if (isNew) {
        response = await fetch('/api/purchase-orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
      } else {
        response = await fetch(`/api/purchase-orders/${po.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...formData, updated_by: 'current_user' })
        });
      }

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || err.error || 'Failed to save');
      }

      const savedPO = await response.json();
      window.showToast?.(isNew ? 'PO created successfully' : 'PO saved successfully', 'success');

      if (submitAfter && savedPO.id) {
        await this.submitForApprovalById(savedPO.id);
      } else {
        this.closeModal();
        window.refreshPOList?.();
      }
    } catch (err) {
      console.error('Save error:', err);
      window.showToast?.(err.message, 'error');
    }
  }

  async submitForApproval() {
    const po = this.currentPO;
    if (!po.id) {
      await this.savePO(true);
      return;
    }
    await this.submitForApprovalById(po.id);
  }

  async submitForApprovalById(poId) {
    try {
      const response = await fetch(`/api/purchase-orders/${poId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submitted_by: 'current_user' })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || 'Failed to submit');
      }

      const result = await response.json();

      if (result.auto_approved) {
        window.showToast?.('PO auto-approved', 'success');
      } else {
        window.showToast?.(`PO submitted for approval`, 'success');
      }

      this.closeModal();
      window.refreshPOList?.();
    } catch (err) {
      console.error('Submit error:', err);
      window.showToast?.(err.message, 'error');
    }
  }

  async approvePO() {
    try {
      const response = await fetch(`/api/purchase-orders/${this.currentPO.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved_by: 'current_user' })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || 'Failed to approve');
      }

      window.showToast?.('PO approved', 'success');
      this.closeModal();
      window.refreshPOList?.();
    } catch (err) {
      console.error('Approve error:', err);
      window.showToast?.(err.message, 'error');
    }
  }

  async rejectPO() {
    const reason = prompt('Please provide a reason for rejection:');
    if (!reason) return;

    try {
      const response = await fetch(`/api/purchase-orders/${this.currentPO.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rejected_by: 'current_user', reason })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || 'Failed to reject');
      }

      window.showToast?.('PO rejected', 'success');
      this.closeModal();
      window.refreshPOList?.();
    } catch (err) {
      console.error('Reject error:', err);
      window.showToast?.(err.message, 'error');
    }
  }

  async closePO() {
    const reason = prompt('Reason for closing (optional):') || 'Manually closed';

    try {
      const response = await fetch(`/api/purchase-orders/${this.currentPO.id}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ closed_by: 'current_user', reason })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || 'Failed to close');
      }

      window.showToast?.('PO closed', 'success');
      this.closeModal();
      window.refreshPOList?.();
    } catch (err) {
      console.error('Close error:', err);
      window.showToast?.(err.message, 'error');
    }
  }

  async reopenPO() {
    try {
      const response = await fetch(`/api/purchase-orders/${this.currentPO.id}/reopen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reopened_by: 'current_user' })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || 'Failed to reopen');
      }

      window.showToast?.('PO reopened', 'success');
      this.closeModal();
      window.refreshPOList?.();
    } catch (err) {
      console.error('Reopen error:', err);
      window.showToast?.(err.message, 'error');
    }
  }

  async deletePO() {
    if (!confirm('Are you sure you want to delete this purchase order?')) return;

    try {
      const response = await fetch(`/api/purchase-orders/${this.currentPO.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deleted_by: 'current_user' })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || 'Failed to delete');
      }

      window.showToast?.('PO deleted', 'success');
      this.closeModal();
      window.refreshPOList?.();
    } catch (err) {
      console.error('Delete error:', err);
      window.showToast?.(err.message, 'error');
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

  formatDateTime(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  }

  formatFileSize(bytes) {
    if (!bytes) return '';
    const units = ['B', 'KB', 'MB', 'GB'];
    let i = 0;
    while (bytes >= 1024 && i < units.length - 1) {
      bytes /= 1024;
      i++;
    }
    return `${bytes.toFixed(1)} ${units[i]}`;
  }

  formatAction(action) {
    const labels = {
      created: 'Created',
      updated: 'Updated',
      submitted: 'Submitted for approval',
      approved: 'Approved',
      auto_approved: 'Auto-approved',
      rejected: 'Rejected',
      closed: 'Closed',
      reopened: 'Reopened',
      deleted: 'Deleted',
      invoice_linked: 'Invoice linked',
      attachment_added: 'File uploaded',
      attachment_removed: 'File removed',
      change_order_added: 'Change order added'
    };
    return labels[action] || action;
  }

  formatDetails(details) {
    if (!details) return '';
    const parts = [];
    if (details.reason) parts.push(`Reason: ${details.reason}`);
    if (details.file_name) parts.push(`File: ${details.file_name}`);
    if (details.amount) parts.push(`Amount: ${this.formatMoney(details.amount)}`);
    return parts.join(' | ');
  }

  getFileIcon(fileType) {
    const icons = {
      pdf: 'PDF',
      image: 'IMG',
      document: 'DOC',
      spreadsheet: 'XLS',
      other: 'FILE'
    };
    return icons[fileType] || 'FILE';
  }

  getStatusLabel(status, approvalStatus) {
    if (approvalStatus === 'rejected') return 'Rejected';
    if (approvalStatus === 'pending' && status === 'pending') return 'Pending Approval';

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
    if (approvalStatus === 'pending' && status === 'pending') return 'pending-approval';

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
function closeModal(modalId) {
  document.getElementById(modalId)?.classList.remove('active');
}

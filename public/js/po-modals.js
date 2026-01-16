// ============================================================
// PO MODALS - Unified Two Panel Layout
// ============================================================

class POModals {
  constructor() {
    this.currentPO = null;
    this.currentLineItems = [];
    this.attachments = [];
    this.changeOrders = [];
    this.jobChangeOrders = []; // Job-level COs for linking to line items
    this.pendingFiles = []; // Files to upload after saving new PO
    this.isEditing = false;
    this.selectedChangeOrderId = null; // PO-level CO link
  }

  // Check if a cost code is a CO cost code (ends with 'C')
  isCOCostCode(costCodeId) {
    const costCodes = window.poState?.costCodes || [];
    const cc = costCodes.find(c => c.id === costCodeId);
    return cc?.code?.endsWith('C') || false;
  }

  // Fetch job-level change orders
  async fetchJobChangeOrders(jobId) {
    if (!jobId) {
      this.jobChangeOrders = [];
      return;
    }
    try {
      const res = await fetch(`/api/jobs/${jobId}/change-orders`);
      if (res.ok) {
        this.jobChangeOrders = await res.json();
      } else {
        this.jobChangeOrders = [];
      }
    } catch (err) {
      console.error('Failed to fetch job change orders:', err);
      this.jobChangeOrders = [];
    }
  }

  // Update CO dropdown when job changes
  updateChangeOrderDropdown() {
    const container = document.getElementById('po-co-link-container');
    const select = document.getElementById('poChangeOrderSelect');
    const hint = document.getElementById('poCoHint');

    if (!container || !select) return;

    // Filter to approved COs only
    const approvedCOs = this.jobChangeOrders.filter(co => co.status === 'approved');

    if (approvedCOs.length === 0) {
      container.style.display = 'none';
      this.selectedChangeOrderId = null;
      return;
    }

    // Show the container
    container.style.display = 'block';

    // Build options
    const options = approvedCOs.map(co => {
      const coNum = `CO-${String(co.change_order_number).padStart(3, '0')}`;
      const amount = this.formatMoney(co.approved_amount || co.amount || 0);
      const selected = this.selectedChangeOrderId === co.id ? 'selected' : '';
      return `<option value="${co.id}" ${selected}>${coNum}: ${this.escapeHtml(co.title || 'Untitled')} (${amount})</option>`;
    }).join('');

    select.innerHTML = `<option value="">-- No CO Link (Base Contract Work) --</option>${options}`;

    // Set current value
    if (this.selectedChangeOrderId) {
      select.value = this.selectedChangeOrderId;
    }
  }

  // Handle CO selection change
  onChangeOrderSelected(value) {
    this.selectedChangeOrderId = value || null;

    const hint = document.getElementById('poCoHint');
    if (hint) {
      if (value) {
        const co = this.jobChangeOrders.find(c => c.id === value);
        if (co) {
          hint.textContent = `All invoices against this PO will be tracked as CO #${co.change_order_number} work`;
          hint.style.display = 'block';
        }
      } else {
        hint.style.display = 'none';
      }
    }
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
    this.changeOrders = [];
    this.jobChangeOrders = [];
    this.pendingFiles = [];
    this.isEditing = false;
    this.selectedChangeOrderId = null;
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

      const [invRes, actRes, attRes, coRes] = await Promise.all([
        fetch(`/api/purchase-orders/${poId}/invoices`),
        fetch(`/api/purchase-orders/${poId}/activity`),
        fetch(`/api/purchase-orders/${poId}/attachments`),
        fetch(`/api/purchase-orders/${poId}/change-orders`)
      ]);

      const invoicesData = await invRes.json();
      const activityData = await actRes.json();
      const attachmentsData = await attRes.json();
      const changeOrdersData = await coRes.json();

      this.currentPO.invoices = Array.isArray(invoicesData) ? invoicesData : [];
      this.currentPO.activity = Array.isArray(activityData) ? activityData : [];
      this.attachments = Array.isArray(attachmentsData) ? attachmentsData : [];
      this.changeOrders = Array.isArray(changeOrdersData) ? changeOrdersData : [];

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
    const modalTitle = isNew ? 'New Purchase Order' : (po.title || po.po_number || 'Purchase Order');
    document.getElementById('poModalTitle').textContent = modalTitle;

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
    const paidAmount = (po.invoices || [])
      .filter(inv => inv.status === 'paid')
      .reduce((sum, inv) => sum + parseFloat(inv.amount || 0), 0);
    const remainingAmount = totalAmount - billedAmount;
    const billedPercent = totalAmount > 0 ? Math.round((billedAmount / totalAmount) * 100) : 0;
    const paidPercent = totalAmount > 0 ? Math.round((paidAmount / totalAmount) * 100) : 0;

    if (isNew) {
      return `
        <div class="po-card">
          <h4>New Purchase Order</h4>
          <p class="empty-text" style="margin: 0;">Summary will appear after saving</p>
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
            <div class="progress-fill paid" style="width: ${Math.min(paidPercent, 100)}%"></div>
            <div class="progress-fill billed ${billedPercent > 100 ? 'over' : ''}" style="width: ${Math.min(billedPercent - paidPercent, 100 - paidPercent)}%; left: ${paidPercent}%"></div>
          </div>
          <div class="progress-info">
            <span class="info-item"><span class="dot paid"></span> Paid: ${this.formatMoney(paidAmount)}</span>
            <span class="info-item"><span class="dot billed"></span> Billed: ${this.formatMoney(billedAmount - paidAmount)}</span>
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
        ${po.job_change_order_id ? `
        <div class="detail-row">
          <span class="detail-label">Change Order</span>
          <span class="detail-value"><span class="badge badge-co">CO Work</span></span>
        </div>
        ` : ''}
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
            ${po.invoices.map(inv => {
              const invAmount = parseFloat(inv.amount || 0);
              const invPercent = totalAmount > 0 ? Math.round((invAmount / totalAmount) * 100) : 0;
              return `
              <div class="invoice-item clickable" onclick="window.poModals.openInvoice('${inv.id}')" title="Click to view PDF">
                <div class="inv-left">
                  <span class="inv-number">${inv.invoice_number || 'No #'} <span class="view-icon">↗</span></span>
                  <span class="inv-date">${this.formatDate(inv.invoice_date)}</span>
                </div>
                <div class="inv-right">
                  <div class="inv-amount-row">
                    <span class="inv-amount">${this.formatMoney(invAmount)}</span>
                    <span class="inv-percent">(${invPercent}%)</span>
                  </div>
                  <span class="inv-status status-${inv.status}">${this.formatStatus(inv.status)}</span>
                </div>
              </div>
            `}).join('')}
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
          <label>Title</label>
          <input type="text" id="poTitle" value="${this.escapeHtml(po.title || '')}" placeholder="e.g., Framing Package, Kitchen Cabinets" class="form-input">
        </div>
        <div class="form-row-2">
          <div class="form-group">
            <label>PO Number</label>
            <input type="text" id="poNumber" value="${this.escapeHtml(po.po_number || '')}" placeholder="Auto-generated if blank" class="form-input">
          </div>
          <div class="form-group">
            <label>Description</label>
            <input type="text" id="poDescription" value="${this.escapeHtml(po.description || '')}" placeholder="Brief description" class="form-input">
          </div>
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
        <div class="form-group" id="po-co-link-container" style="display: none;">
          <label>Link to Change Order <span class="optional-label">(optional)</span></label>
          <select id="poChangeOrderSelect" class="form-input" onchange="window.poModals.onChangeOrderSelected(this.value)">
            <option value="">-- No CO Link (Base Contract Work) --</option>
          </select>
          <p class="form-hint" id="poCoHint" style="display: none;"></p>
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
        <h4>Internal Notes</h4>
        <div class="form-group">
          <textarea id="poNotes" rows="3" class="form-input" placeholder="Add any internal notes about this PO...">${this.escapeHtml(po.notes || '')}</textarea>
        </div>
      </div>

      ${this.renderAttachmentsSection()}
    `;
  }

  renderLineItemEdit(item, index, costCodes) {
    const costTypes = ['Labor', 'Material', 'Equipment', 'Subcontractor', 'Other'];
    const isCO = this.isCOCostCode(item.cost_code_id);

    // Build CO picker options
    let coPickerHtml = '';
    if (isCO) {
      const coOptions = this.jobChangeOrders
        .filter(co => co.status === 'approved' || co.status === 'pending_approval')
        .map(co => {
          const coNum = `CO-${String(co.change_order_number).padStart(3, '0')}`;
          const selected = item.change_order_id === co.id ? 'selected' : '';
          return `<option value="${co.id}" ${selected}>${coNum}: ${this.escapeHtml(co.title || 'Untitled')}</option>`;
        }).join('');

      coPickerHtml = `
        <div class="line-item-co-picker" data-index="${index}">
          <label class="co-picker-label">Change Order <span class="required">*</span></label>
          <select class="form-input co-select ${!item.change_order_id ? 'needs-co' : ''}"
            onchange="window.poModals.updateLineItem(${index}, 'change_order_id', this.value)">
            <option value="">Select Change Order...</option>
            ${coOptions}
            <option value="create-new">+ Create New Change Order</option>
          </select>
        </div>
      `;
    }

    return `
      <div class="line-item-edit ${isCO ? 'has-co-code' : ''}" data-index="${index}">
        <div class="line-item-main-row">
          <input type="text" placeholder="Title" value="${this.escapeHtml(item.title || '')}" class="form-input line-item-title"
            onchange="window.poModals.updateLineItem(${index}, 'title', this.value)">
          <div class="line-item-cost-code-picker" id="lineItemCostCode-${index}" data-index="${index}" data-value="${item.cost_code_id || ''}"></div>
          <select class="form-input cost-type-select" onchange="window.poModals.updateLineItem(${index}, 'cost_type', this.value)">
            <option value="">Type...</option>
            ${costTypes.map(t => `<option value="${t}" ${item.cost_type === t ? 'selected' : ''}>${t}</option>`).join('')}
          </select>
          <input type="text" placeholder="Description" value="${this.escapeHtml(item.description || '')}" class="form-input description-input"
            onchange="window.poModals.updateLineItem(${index}, 'description', this.value)">
          <input type="number" placeholder="0.00" value="${item.amount || ''}" step="0.01" class="form-input amount"
            onchange="window.poModals.updateLineItem(${index}, 'amount', this.value)">
          <button type="button" class="btn-remove" onclick="window.poModals.removeLineItem(${index})">×</button>
        </div>
        ${coPickerHtml}
      </div>
    `;
  }

  initLineItemCostCodePickers() {
    document.querySelectorAll('.line-item-cost-code-picker').forEach(container => {
      const index = parseInt(container.dataset.index);
      const value = container.dataset.value || '';
      if (window.SearchablePicker && !container.dataset.initialized) {
        container.dataset.initialized = 'true';
        window.SearchablePicker.init(container, {
          type: 'costCodes',
          value: value,
          placeholder: 'Search cost codes...',
          onChange: (costCodeId) => {
            const wasCO = this.isCOCostCode(this.currentLineItems[index]?.cost_code_id);
            this.updateLineItem(index, 'cost_code_id', costCodeId);
            const isCO = this.isCOCostCode(costCodeId);

            // If CO status changed, refresh the line item to show/hide CO picker
            if (wasCO !== isCO) {
              // Clear change_order_id if no longer a CO cost code
              if (!isCO) {
                this.updateLineItem(index, 'change_order_id', null);
              }
              this.refreshLineItems();
            }
          }
        });
      }
    });
  }

  // Handle CO picker change, including "create-new" option
  updateLineItem(index, field, value) {
    if (this.currentLineItems[index]) {
      // Handle "create-new" CO selection
      if (field === 'change_order_id' && value === 'create-new') {
        this.showCreateCOForLineItem(index);
        return;
      }

      this.currentLineItems[index][field] = value;
      if (field === 'amount') this.updateLineItemsTotal();
    }
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
              const budgeted = parseFloat(item.amount) || 0;
              const invoiced = parseFloat(item.invoiced_amount) || 0;
              const remaining = budgeted - invoiced;
              const pct = budgeted > 0 ? Math.round((invoiced / budgeted) * 100) : 0;
              const statusClass = pct >= 100 ? 'fully-billed' : pct > 0 ? 'partial-billed' : 'not-billed';
              const costType = item.cost_type ? `<span class="li-cost-type">${item.cost_type}</span>` : '';
              const itemTitle = item.title ? `<div class="li-title">${this.escapeHtml(item.title)}</div>` : '';
              return `
                <div class="line-item-view ${statusClass}">
                  ${itemTitle}
                  <div class="li-header">
                    <div class="li-info">
                      <span class="li-code">${cc?.code || '—'}</span>
                      ${costType}
                      <span class="li-name">${cc?.name || item.description || 'No description'}</span>
                    </div>
                    <span class="li-amount">${this.formatMoney(budgeted)}</span>
                  </div>
                  <div class="li-billing-row">
                    <div class="li-progress-bar">
                      <div class="li-progress-fill" style="width: ${Math.min(pct, 100)}%"></div>
                    </div>
                    <div class="li-billing-stats">
                      <span class="li-billed">Billed: ${this.formatMoney(invoiced)} (${pct}%)</span>
                      <span class="li-remaining">Remaining: ${this.formatMoney(remaining)}</span>
                    </div>
                  </div>
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

      ${po.notes ? `
      <div class="po-card">
        <h4>Internal Notes</h4>
        <p class="text-content">${this.escapeHtml(po.notes).replace(/\n/g, '<br>')}</p>
      </div>
      ` : ''}

      ${this.renderChangeOrdersSection()}

      ${this.renderAttachmentsSection()}

      ${this.renderActivity()}
    `;
  }

  // ============================================================
  // ATTACHMENTS SECTION (Right Panel)
  // ============================================================

  renderAttachmentsSection() {
    const categories = [
      { key: 'quote', label: 'Quote / Estimate', icon: '💰' },
      { key: 'scope', label: 'Scope of Work', icon: '📋' },
      { key: 'plans', label: 'Plans & Drawings', icon: '📐' },
      { key: 'contract', label: 'Contract / Agreement', icon: '📝' },
      { key: 'other', label: 'Other Documents', icon: '📎' }
    ];

    return `
      <div class="po-card attachments-card">
        <h4>Documents & Attachments</h4>
        <div class="attachment-categories">
          ${categories.map(cat => this.renderAttachmentCategory(cat)).join('')}
        </div>
      </div>
    `;
  }

  renderAttachmentCategory(category) {
    const attachments = this.attachments.filter(a => (a.category || 'other') === category.key);
    const pending = this.pendingFiles.filter(f => (f.category || 'other') === category.key);
    const count = attachments.length + pending.length;

    return `
      <div class="attachment-category" data-category="${category.key}">
        <div class="category-header">
          <span class="category-icon">${category.icon}</span>
          <span class="category-label">${category.label}</span>
          ${count > 0 ? `<span class="category-count">${count}</span>` : ''}
          <button type="button" class="btn-add-file" onclick="window.poModals.triggerFileUpload('${category.key}')">+ Add</button>
        </div>

        ${pending.length > 0 ? `
          <div class="category-pending">
            ${pending.map((file, idx) => {
              const globalIdx = this.pendingFiles.indexOf(file);
              return `
                <div class="pending-file-item">
                  <span class="pending-file-icon">${this.getFileIcon(file.type)}</span>
                  <span class="pending-file-name">${this.escapeHtml(file.name)}</span>
                  <span class="pending-file-size">${this.formatFileSize(file.size)}</span>
                  <span class="pending-badge">Pending</span>
                  <button class="btn-remove-pending" onclick="window.poModals.removePendingFile(${globalIdx})">×</button>
                </div>
              `;
            }).join('')}
          </div>
        ` : ''}

        ${attachments.length > 0 ? `
          <div class="category-files">
            ${attachments.map(att => this.renderAttachmentItem(att)).join('')}
          </div>
        ` : count === 0 ? `
          <div class="category-empty">No files uploaded</div>
        ` : ''}
      </div>
    `;
  }

  renderAttachmentItem(att) {
    const ext = att.filename?.split('.').pop()?.toLowerCase() || '';
    const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext);
    const isPDF = ext === 'pdf';

    return `
      <div class="attachment-item" data-id="${att.id}">
        <span class="attachment-icon">${this.getFileIcon(att.content_type || ext)}</span>
        <span class="attachment-name">${this.escapeHtml(att.filename || 'Untitled')}</span>
        <div class="attachment-actions">
          <button class="btn-icon" onclick="window.poModals.viewAttachment('${att.id}')" title="View">👁</button>
          <button class="btn-icon" onclick="window.poModals.downloadAttachment('${att.id}')" title="Download">⬇</button>
          <button class="btn-icon btn-delete" onclick="window.poModals.deleteAttachment('${att.id}')" title="Delete">🗑</button>
        </div>
      </div>
    `;
  }

  triggerFileUpload(category) {
    this.currentUploadCategory = category;
    // Create a temporary file input for this category
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = '.pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.dwg,.dxf';
    input.onchange = (e) => this.handleCategoryFileSelect(e, category);
    input.click();
  }

  handleCategoryFileSelect(event, category) {
    const files = Array.from(event.target.files);
    files.forEach(file => {
      file.category = category;
      this.pendingFiles.push(file);
    });
    this.renderPOModal();
  }

  removePendingFile(index) {
    this.pendingFiles.splice(index, 1);
    this.renderPOModal();
  }

  // ============================================================
  // CHANGE ORDERS SECTION
  // ============================================================

  renderChangeOrdersSection() {
    const isNew = !this.currentPO.id;
    if (isNew) return '';

    const approved = this.changeOrders.filter(co => co.status === 'approved');
    const pending = this.changeOrders.filter(co => co.status === 'pending');
    const rejected = this.changeOrders.filter(co => co.status === 'rejected');

    const totalApproved = approved.reduce((sum, co) => sum + parseFloat(co.amount || 0), 0);

    return `
      <div class="po-card">
        <div class="card-title-row">
          <h4>Change Orders</h4>
          <div class="co-header-actions">
            ${this.changeOrders.length > 0 ? `<span class="count-badge">${this.changeOrders.length}</span>` : ''}
            <button type="button" class="btn-add" onclick="window.poModals.showAddChangeOrderModal()">+ Add CO</button>
          </div>
        </div>

        ${totalApproved !== 0 ? `
          <div class="co-summary">
            <span class="co-summary-label">Approved Change Orders:</span>
            <span class="co-summary-amount ${totalApproved >= 0 ? 'positive' : 'negative'}">${totalApproved >= 0 ? '+' : ''}${this.formatMoney(totalApproved)}</span>
          </div>
        ` : ''}

        ${this.changeOrders.length === 0 ? `
          <p class="empty-text">No change orders</p>
        ` : `
          <div class="change-orders-list">
            ${this.changeOrders.map(co => this.renderChangeOrderItem(co)).join('')}
          </div>
        `}
      </div>
    `;
  }

  renderChangeOrderItem(co) {
    const statusClass = co.status === 'approved' ? 'approved' : co.status === 'rejected' ? 'rejected' : 'pending';
    const statusLabel = co.status === 'approved' ? 'Approved' : co.status === 'rejected' ? 'Rejected' : 'Pending';
    const amountClass = parseFloat(co.amount) >= 0 ? 'positive' : 'negative';
    const amountPrefix = parseFloat(co.amount) >= 0 ? '+' : '';

    return `
      <div class="change-order-item">
        <div class="co-main">
          <div class="co-info">
            <span class="co-number">${this.escapeHtml(co.co_number || 'CO')}</span>
            <span class="co-description">${this.escapeHtml(co.description || 'No description')}</span>
          </div>
          <div class="co-amount ${amountClass}">${amountPrefix}${this.formatMoney(co.amount)}</div>
        </div>
        <div class="co-meta">
          <span class="co-status status-${statusClass}">${statusLabel}</span>
          <span class="co-date">${this.formatDate(co.created_at)}</span>
          ${co.status === 'pending' ? `
            <div class="co-actions">
              <button class="btn-sm btn-success" onclick="window.poModals.approveChangeOrder('${co.id}')">Approve</button>
              <button class="btn-sm btn-danger" onclick="window.poModals.rejectChangeOrder('${co.id}')">Reject</button>
            </div>
          ` : ''}
        </div>
        ${co.reason ? `<div class="co-reason">Reason: ${this.escapeHtml(co.reason)}</div>` : ''}
      </div>
    `;
  }

  showAddChangeOrderModal() {
    const poId = this.currentPO.id;
    const existingCount = this.changeOrders.length;
    const nextNum = String(existingCount + 1).padStart(2, '0');
    const defaultCoNumber = `CO-${nextNum}`;

    // Create inline form in a simple modal
    const overlay = document.createElement('div');
    overlay.id = 'coFormOverlay';
    overlay.className = 'attachment-viewer-overlay';
    overlay.innerHTML = `
      <div class="co-form-container">
        <div class="co-form-header">
          <h3>Add Change Order</h3>
          <button class="btn-close-viewer" onclick="window.poModals.closeChangeOrderForm()">×</button>
        </div>
        <div class="co-form-body">
          <div class="form-group">
            <label>CO Number</label>
            <input type="text" id="coNumber" value="${defaultCoNumber}" class="form-input">
          </div>
          <div class="form-group">
            <label>Description *</label>
            <input type="text" id="coDescription" placeholder="Describe the change..." class="form-input">
          </div>
          <div class="form-group">
            <label>Amount *</label>
            <input type="number" id="coAmount" step="0.01" placeholder="0.00" class="form-input">
            <small class="form-hint">Use negative for deductions</small>
          </div>
          <div class="form-group">
            <label>Reason</label>
            <textarea id="coReason" rows="2" placeholder="Reason for change..." class="form-input"></textarea>
          </div>
        </div>
        <div class="co-form-footer">
          <button class="btn btn-secondary" onclick="window.poModals.closeChangeOrderForm()">Cancel</button>
          <button class="btn btn-primary" onclick="window.poModals.submitChangeOrder()">Create Change Order</button>
        </div>
      </div>
    `;

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.closeChangeOrderForm();
    });

    document.body.appendChild(overlay);
    document.getElementById('coDescription').focus();
  }

  closeChangeOrderForm() {
    const overlay = document.getElementById('coFormOverlay');
    if (overlay) overlay.remove();
  }

  async submitChangeOrder() {
    const poId = this.currentPO.id;
    const coNumber = document.getElementById('coNumber')?.value?.trim();
    const description = document.getElementById('coDescription')?.value?.trim();
    const amount = parseFloat(document.getElementById('coAmount')?.value) || 0;
    const reason = document.getElementById('coReason')?.value?.trim();

    if (!description) {
      window.showToast?.('Description is required', 'error');
      return;
    }
    if (amount === 0) {
      window.showToast?.('Amount is required', 'error');
      return;
    }

    try {
      const res = await fetch(`/api/purchase-orders/${poId}/change-orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ co_number: coNumber, description, amount, reason })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create change order');
      }

      window.showToast?.('Change order created', 'success');
      this.closeChangeOrderForm();
      this.openPO(poId); // Refresh
    } catch (err) {
      window.showToast?.(err.message, 'error');
    }
  }

  async approveChangeOrder(coId) {
    const poId = this.currentPO.id;
    window.showConfirmDialog(
      'Approve Change Order',
      'Approve this change order? This will update the PO total amount.',
      'Approve',
      'btn-success',
      async () => {
        try {
          const res = await fetch(`/api/purchase-orders/${poId}/change-orders/${coId}/approve`, { method: 'POST' });
          if (!res.ok) throw new Error('Failed');
          window.showToast?.('Change order approved', 'success');
          if (window.loadPOs) window.loadPOs();
          window.poModals.openPO(poId);
        } catch (err) {
          window.showToast?.(err.message, 'error');
        }
      }
    );
  }

  async rejectChangeOrder(coId) {
    const poId = this.currentPO.id;
    window.showConfirmDialog(
      'Reject Change Order',
      'Are you sure you want to reject this change order?',
      'Reject',
      'btn-danger',
      async (reason) => {
        try {
          const res = await fetch(`/api/purchase-orders/${poId}/change-orders/${coId}/reject`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason })
          });
          if (!res.ok) throw new Error('Failed');
          window.showToast?.('Change order rejected', 'success');
          window.poModals.openPO(poId);
        } catch (err) {
          window.showToast?.(err.message, 'error');
        }
      },
      { label: 'Reason for rejection', placeholder: 'Enter reason...', required: false }
    );
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
          ${isPdf ? `<iframe src="${url}" class="pdf-viewer-frame" loading="lazy"></iframe>` : ''}
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
        <button class="btn btn-secondary" onclick="window.poModals.savePO()">Save Draft</button>
        <button class="btn btn-primary" onclick="window.poModals.saveAndSendPO()">Save & Send</button>
      `;
    } else if (this.isEditing) {
      const isDraft = ['draft', 'pending', null, undefined].includes(po.status_detail);
      right = `
        <button class="btn btn-secondary" onclick="window.poModals.cancelEdit()">Cancel</button>
        <button class="btn btn-secondary" onclick="window.poModals.savePO()">Save${isDraft ? ' Draft' : ''}</button>
      `;
      if (isDraft) {
        right += `<button class="btn btn-primary" onclick="window.poModals.saveAndSendPO()">Save & Send</button>`;
      }
    } else {
      // Simplified status workflow: draft → sent → approved → closed
      const statusDetail = po.status_detail || 'pending';
      const approvalStatus = po.approval_status || 'pending';

      // Determine effective status
      let effectiveStatus = 'draft';
      if (statusDetail === 'voided' || statusDetail === 'cancelled') effectiveStatus = 'voided';
      else if (statusDetail === 'closed' || statusDetail === 'completed') effectiveStatus = 'completed';
      else if (approvalStatus === 'approved' || statusDetail === 'approved') effectiveStatus = 'approved';
      else if (statusDetail === 'sent' || statusDetail === 'active') effectiveStatus = 'sent';

      // Left side: Delete (only for draft) and Download PDF
      left = `<button class="btn btn-secondary" onclick="window.poModals.downloadPDF()">Download PDF</button>`;
      if (effectiveStatus === 'draft') {
        left += `<button class="btn btn-danger-outline" onclick="window.poModals.deletePO()">Delete</button>`;
      }

      // Right side: Always show Close button
      right = `<button class="btn btn-secondary" onclick="window.poModals.closeModal()">Close</button>`;

      // Edit button (not for completed/voided)
      if (!['completed', 'voided'].includes(effectiveStatus)) {
        right += `<button class="btn btn-secondary" onclick="window.poModals.startEdit()">Edit</button>`;
      }

      // Status-specific actions
      switch (effectiveStatus) {
        case 'draft':
          right += `<button class="btn btn-primary" onclick="window.poModals.sendPO()">Send to Vendor</button>`;
          break;
        case 'sent':
          left += `<button class="btn btn-danger-outline" onclick="window.poModals.voidPO()">Void</button>`;
          right += `<button class="btn btn-danger" onclick="window.poModals.rejectPO()">Reject</button>`;
          right += `<button class="btn btn-success" onclick="window.poModals.approvePO()">Approve</button>`;
          break;
        case 'approved':
          left += `<button class="btn btn-danger-outline" onclick="window.poModals.voidPO()">Void</button>`;
          right += `<button class="btn btn-success" onclick="window.poModals.completePO()">Mark Complete</button>`;
          break;
        case 'completed':
          right += `<button class="btn btn-secondary" onclick="window.poModals.reopenPO()">Reopen</button>`;
          break;
      }
    }

    footer.innerHTML = `<div class="footer-left">${left}</div><div class="footer-right">${right}</div>`;
  }

  // ============================================================
  // HELPERS
  // ============================================================

  async openInvoice(invoiceId) {
    try {
      // Fetch invoice to get PDF URL
      const res = await fetch(`/api/invoices/${invoiceId}`);
      if (!res.ok) {
        throw new Error('Invoice not found');
      }
      const invoice = await res.json();

      // Prefer stamped PDF, fall back to original
      const pdfUrl = invoice.pdf_stamped_url || invoice.pdf_url;

      if (!pdfUrl) {
        window.showToast?.('No PDF attached to this invoice', 'error');
        return;
      }

      // Build filename from invoice data
      const fileName = `${invoice.invoice_number || 'Invoice'}.pdf`;

      // Open in the attachment viewer
      this.showAttachmentViewer(pdfUrl, fileName, 'pdf');
    } catch (err) {
      console.error('Failed to open invoice PDF:', err);
      window.showToast?.('Failed to open invoice', 'error');
    }
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

  async uploadFiles(files, category = 'other') {
    const isNew = !this.currentPO.id;

    // For new POs, store files to upload after saving
    if (isNew) {
      for (const file of files) {
        file.category = category;
        this.pendingFiles.push(file);
      }
      this.renderPOModal();
      return;
    }

    // For existing POs, upload immediately
    for (const file of files) {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', file.category || category);
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

  async uploadPendingFiles(poId) {
    if (this.pendingFiles.length === 0) return;

    for (const file of this.pendingFiles) {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', file.category || 'other');
      try {
        await fetch(`/api/purchase-orders/${poId}/attachments`, { method: 'POST', body: formData });
      } catch (err) {
        console.error(`Failed to upload ${file.name}:`, err);
      }
    }
    this.pendingFiles = [];
  }

  startEdit() { this.isEditing = true; this.renderPOModal(); }
  cancelEdit() { this.isEditing = false; if (this.currentPO.id) this.openPO(this.currentPO.id); else this.closeModal(); }

  addLineItem() {
    this.currentLineItems.push({ title: '', cost_code_id: null, cost_type: '', description: '', amount: 0, change_order_id: null });
    this.refreshLineItems();
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
    // Initialize cost code pickers for new line items
    setTimeout(() => this.initLineItemCostCodePickers(), 10);
  }

  updateLineItemsTotal() {
    const total = this.currentLineItems.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
    const el = document.getElementById('lineItemsTotal');
    if (el) el.textContent = this.formatMoney(total);
  }

  initializePickers() {
    // For new POs, use sidebar's selected job as default
    const sidebarJobId = window.JobSidebar?.getSelectedJobId?.() || '';
    const defaultJobId = this.currentPO.job_id || sidebarJobId;

    const jobContainer = document.getElementById('po-job-picker-container');
    if (jobContainer && window.SearchablePicker) {
      window.SearchablePicker.init(jobContainer, {
        type: 'jobs',
        value: defaultJobId,
        placeholder: 'Search jobs...',
        onChange: async (jobId) => {
          this.selectedJobId = jobId;
          // Clear CO selection when job changes
          this.selectedChangeOrderId = null;
          // Fetch change orders for this job
          await this.fetchJobChangeOrders(jobId);
          // Update PO-level CO dropdown
          this.updateChangeOrderDropdown();
          // Refresh line items to update line-item CO pickers
          this.refreshLineItems();
        }
      });
      this.selectedJobId = defaultJobId;
      // Set initial CO if editing existing PO
      this.selectedChangeOrderId = this.currentPO.job_change_order_id || null;
      // Fetch COs for the default job
      if (defaultJobId) {
        this.fetchJobChangeOrders(defaultJobId).then(() => {
          this.updateChangeOrderDropdown();
        });
      }
    }

    const vendorContainer = document.getElementById('po-vendor-picker-container');
    if (vendorContainer && window.SearchablePicker) {
      window.SearchablePicker.init(vendorContainer, {
        type: 'vendors',
        value: this.currentPO.vendor_id,
        placeholder: 'Search vendors...',
        onChange: (vendorId) => {
          this.selectedVendorId = vendorId;
        }
      });
      this.selectedVendorId = this.currentPO.vendor_id;
    }

    // Initialize cost code pickers for line items
    this.initLineItemCostCodePickers();
  }

  // Show modal to create a new CO for a line item
  showCreateCOForLineItem(lineItemIndex) {
    const jobId = this.selectedJobId || this.currentPO?.job_id;
    if (!jobId) {
      window.toasts?.error('Please select a job first');
      return;
    }

    const lineItem = this.currentLineItems[lineItemIndex];
    const amount = parseFloat(lineItem?.amount || 0);

    const modalHtml = `
      <div id="create-co-for-line-modal" class="modal" style="display: flex; opacity: 1; z-index: 10003;">
        <div class="modal-content" style="max-width: 500px; opacity: 1;">
          <div class="modal-header">
            <h2>Create Change Order</h2>
            <button class="modal-close" onclick="window.poModals.closeCreateCOForLineModal()">&times;</button>
          </div>
          <div class="modal-body">
            <p class="modal-hint">This line item uses a CO cost code. Create or select a Change Order to link it to.</p>
            <div class="form-group">
              <label>Title <span class="required">*</span></label>
              <input type="text" id="new-co-title" class="form-input" placeholder="e.g., Kitchen upgrade">
            </div>
            <div class="form-group">
              <label>Amount</label>
              <div class="amount-input-group">
                <span class="amount-prefix">$</span>
                <input type="number" id="new-co-amount" class="form-input" value="${amount}" step="0.01">
              </div>
            </div>
            <div class="form-group">
              <label>Description</label>
              <textarea id="new-co-description" class="form-input" rows="2" placeholder="Optional description"></textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn-secondary" onclick="window.poModals.closeCreateCOForLineModal()">Cancel</button>
            <button type="button" class="btn-primary" onclick="window.poModals.submitCreateCOForLine(${lineItemIndex})">Create & Link</button>
          </div>
        </div>
      </div>
    `;

    const wrapper = document.createElement('div');
    wrapper.id = 'create-co-for-line-modal-wrapper';
    wrapper.innerHTML = modalHtml;
    document.body.appendChild(wrapper);

    setTimeout(() => document.getElementById('new-co-title')?.focus(), 100);
  }

  closeCreateCOForLineModal() {
    const wrapper = document.getElementById('create-co-for-line-modal-wrapper');
    if (wrapper) wrapper.remove();
  }

  async submitCreateCOForLine(lineItemIndex) {
    const title = document.getElementById('new-co-title')?.value?.trim();
    const amountStr = document.getElementById('new-co-amount')?.value;
    const description = document.getElementById('new-co-description')?.value?.trim();

    if (!title) {
      window.toasts?.error('Please enter a title for the Change Order');
      return;
    }

    const amount = parseFloat(amountStr) || 0;
    const jobId = this.selectedJobId || this.currentPO?.job_id;

    try {
      const response = await fetch(`/api/jobs/${jobId}/change-orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          amount,
          description,
          status: 'approved'
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create Change Order');
      }

      const newCO = await response.json();

      // Add to cached COs
      this.jobChangeOrders.push(newCO);

      // Link line item to new CO
      this.currentLineItems[lineItemIndex].change_order_id = newCO.id;

      this.closeCreateCOForLineModal();
      this.refreshLineItems();

      window.toasts?.success(`Created CO-${String(newCO.change_order_number).padStart(3, '0')}: ${title}`);
    } catch (err) {
      console.error('Failed to create CO:', err);
      window.toasts?.error('Failed to create Change Order', { details: err.message });
    }
  }

  async savePO(andSend = false) {
    const po = this.currentPO;
    const isNew = !po.id;
    const jobId = this.selectedJobId || po.job_id;
    const vendorId = this.selectedVendorId || po.vendor_id;

    // Validate CO cost code line items have a CO assigned
    const coLineItemsWithoutCO = this.currentLineItems.filter((item, index) => {
      const isCO = this.isCOCostCode(item.cost_code_id);
      return isCO && !item.change_order_id;
    });

    if (coLineItemsWithoutCO.length > 0) {
      const costCodes = window.poState?.costCodes || [];
      const missingCodes = coLineItemsWithoutCO.map(item => {
        const cc = costCodes.find(c => c.id === item.cost_code_id);
        return cc?.code || 'Unknown';
      }).join(', ');

      window.showToast?.(`CO cost codes require a Change Order: ${missingCodes}`, 'error');
      return;
    }

    const data = {
      title: document.getElementById('poTitle')?.value?.trim() || null,
      po_number: document.getElementById('poNumber')?.value?.trim() || null,
      job_id: jobId || null,
      vendor_id: vendorId || null,
      description: document.getElementById('poDescription')?.value?.trim(),
      notes: document.getElementById('poNotes')?.value?.trim(),
      total_amount: this.currentLineItems.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0),
      job_change_order_id: this.selectedChangeOrderId || null,
      line_items: this.currentLineItems.filter(li => li.title || li.cost_code_id || li.description || li.amount || li.cost_type)
    };

    try {
      const res = isNew
        ? await fetch('/api/purchase-orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
        : await fetch(`/api/purchase-orders/${po.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });

      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed'); }

      const saved = await res.json();

      // Upload any pending files for new POs
      if (isNew && this.pendingFiles.length > 0) {
        await this.uploadPendingFiles(saved.id);
      }

      window.showToast?.(isNew ? 'Draft saved' : 'PO updated', 'success');
      if (window.loadPOs) window.loadPOs();
      this.isEditing = false;

      // If andSend, immediately send the PO
      if (andSend) {
        await this.sendPODirect(saved.id);
      } else {
        this.openPO(saved.id);
      }
    } catch (err) {
      window.showToast?.(err.message || 'Failed to save', 'error');
    }
  }

  async saveAndSendPO() {
    await this.savePO(true);
  }

  async sendPODirect(poId) {
    try {
      const res = await fetch(`/api/purchase-orders/${poId}/send`, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to send PO');
      }
      window.showToast?.('PO sent to vendor', 'success');
      if (window.loadPOs) window.loadPOs();
      this.openPO(poId);
    } catch (err) {
      window.showToast?.(err.message, 'error');
      // Still open the PO so user can see what was saved
      this.openPO(poId);
    }
  }

  async submitForApproval() {
    // Legacy method - redirect to sendPO
    return this.sendPO();
  }

  async sendPO() {
    const poId = this.currentPO.id;
    window.showConfirmDialog(
      'Send to Vendor',
      'Send this PO to the vendor? This will commit the amount to the job budget.',
      'Send PO',
      'btn-primary',
      async () => {
        try {
          const res = await fetch(`/api/purchase-orders/${poId}/send`, { method: 'POST' });
          if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Failed to send PO');
          }
          window.showToast?.('PO sent to vendor', 'success');
          if (window.loadPOs) window.loadPOs();
          window.poModals.openPO(poId);
        } catch (err) { window.showToast?.(err.message, 'error'); }
      }
    );
  }

  async approvePO() {
    const poId = this.currentPO.id;
    window.showConfirmDialog(
      'Approve PO',
      'Approve this purchase order?',
      'Approve',
      'btn-success',
      async () => {
        try {
          const res = await fetch(`/api/purchase-orders/${poId}/approve`, { method: 'POST' });
          if (!res.ok) throw new Error('Failed');
          window.showToast?.('PO approved', 'success');
          if (window.loadPOs) window.loadPOs();
          window.poModals.openPO(poId);
        } catch (err) { window.showToast?.(err.message, 'error'); }
      }
    );
  }

  async rejectPO() {
    const poId = this.currentPO.id;
    window.showConfirmDialog(
      'Reject PO',
      'Are you sure you want to reject this purchase order?',
      'Reject',
      'btn-danger',
      async (reason) => {
        try {
          const res = await fetch(`/api/purchase-orders/${poId}/reject`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason }) });
          if (!res.ok) throw new Error('Failed');
          window.showToast?.('PO rejected', 'success');
          if (window.loadPOs) window.loadPOs();
          window.poModals.openPO(poId);
        } catch (err) { window.showToast?.(err.message, 'error'); }
      },
      { label: 'Reason for rejection', placeholder: 'Enter reason...', required: true }
    );
  }

  async closePO() {
    // Legacy - redirect to completePO
    return this.completePO();
  }

  async completePO() {
    const poId = this.currentPO.id;
    window.showConfirmDialog(
      'Complete PO',
      'Mark this purchase order as complete?',
      'Mark Complete',
      'btn-success',
      async () => {
        try {
          const res = await fetch(`/api/purchase-orders/${poId}/complete`, { method: 'POST' });
          if (!res.ok) throw new Error('Failed');
          window.showToast?.('PO marked complete', 'success');
          if (window.loadPOs) window.loadPOs();
          window.poModals.openPO(poId);
        } catch (err) { window.showToast?.(err.message, 'error'); }
      }
    );
  }

  async voidPO() {
    const poId = this.currentPO.id;
    window.showConfirmDialog(
      'Void PO',
      'Are you sure you want to void this purchase order? This will remove it from budget commitments.',
      'Void PO',
      'btn-danger',
      async (reason) => {
        try {
          const res = await fetch(`/api/purchase-orders/${poId}/void`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason })
          });
          if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Failed to void PO');
          }
          window.showToast?.('PO voided', 'success');
          if (window.loadPOs) window.loadPOs();
          window.poModals.openPO(poId);
        } catch (err) { window.showToast?.(err.message, 'error'); }
      },
      { label: 'Reason for voiding', placeholder: 'Enter reason...', required: true }
    );
  }

  async reopenPO() {
    const poId = this.currentPO.id;
    window.showConfirmDialog(
      'Reopen PO',
      'Reopen this purchase order?',
      'Reopen',
      'btn-primary',
      async () => {
        try {
          const res = await fetch(`/api/purchase-orders/${poId}/reopen`, { method: 'POST' });
          if (!res.ok) throw new Error('Failed');
          window.showToast?.('PO reopened', 'success');
          if (window.loadPOs) window.loadPOs();
          window.poModals.openPO(poId);
        } catch (err) { window.showToast?.(err.message, 'error'); }
      }
    );
  }

  async deletePO() {
    const poId = this.currentPO.id;
    window.showConfirmDialog(
      'Delete PO',
      'Are you sure you want to delete this purchase order? This action cannot be undone.',
      'Delete',
      'btn-danger',
      async () => {
        try {
          const res = await fetch(`/api/purchase-orders/${poId}`, { method: 'DELETE' });
          if (!res.ok) throw new Error('Failed');
          window.showToast?.('PO deleted', 'success');
          if (window.loadPOs) window.loadPOs();
          window.poModals.closeModal();
        } catch (err) { window.showToast?.(err.message, 'error'); }
      }
    );
  }

  async downloadPDF() {
    const poId = this.currentPO?.id;
    if (!poId) return;

    try {
      // Open PDF in new tab for viewing/download
      window.open(`/api/purchase-orders/${poId}/pdf`, '_blank');
    } catch (err) {
      window.showToast?.('Failed to generate PDF', 'error');
    }
  }

  async downloadAttachment(id) { window.open(`/api/attachments/${id}/download`, '_blank'); }

  async deleteAttachment(id) {
    const poId = this.currentPO.id;
    window.showConfirmDialog(
      'Delete Attachment',
      'Are you sure you want to delete this attachment?',
      'Delete',
      'btn-danger',
      async () => {
        try {
          const res = await fetch(`/api/attachments/${id}`, { method: 'DELETE' });
          if (!res.ok) throw new Error('Failed');
          window.showToast?.('Attachment deleted', 'success');
          const attRes = await fetch(`/api/purchase-orders/${poId}/attachments`);
          window.poModals.attachments = await attRes.json();
          window.poModals.renderPOModal();
        } catch (err) { window.showToast?.(err.message, 'error'); }
      }
    );
  }

  // Utility
  formatMoney(amt) { return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(parseFloat(amt) || 0); }
  formatDate(d) { if (!d) return '—'; return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  formatRelativeTime(d) { if (!d) return ''; const ms = Date.now() - new Date(d); const m = Math.floor(ms/60000), h = Math.floor(ms/3600000), day = Math.floor(ms/86400000); if (m < 1) return 'now'; if (m < 60) return m + 'm'; if (h < 24) return h + 'h'; if (day < 7) return day + 'd'; return this.formatDate(d); }
  formatStatus(s) { return { received: 'Received', needs_approval: 'Needs Approval', approved: 'Approved', in_draw: 'In Draw', paid: 'Paid', denied: 'Denied' }[s] || s; }
  escapeHtml(s) { if (!s) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  getStatusClass(sd, as) {
    // Simplified status: draft → sent → approved → completed
    if (sd === 'voided' || sd === 'cancelled') return 'voided';
    if (sd === 'closed' || sd === 'completed') return 'completed';
    if (as === 'rejected') return 'rejected';
    if (as === 'approved' || sd === 'approved') return 'approved';
    if (sd === 'sent' || sd === 'active') return 'sent';
    return 'draft';
  }
  getStatusLabel(sd, as) {
    // Simplified status labels
    if (sd === 'voided' || sd === 'cancelled') return 'Voided';
    if (sd === 'closed' || sd === 'completed') return 'Completed';
    if (as === 'rejected') return 'Rejected';
    if (as === 'approved' || sd === 'approved') return 'Approved';
    if (sd === 'sent' || sd === 'active') return 'Sent';
    return 'Draft';
  }
  getFileIcon(t) { if (!t) return '📎'; if (t.includes('pdf')) return '📄'; if (t.includes('image')) return '🖼️'; if (t.includes('excel')||t.includes('spreadsheet')) return '📊'; return '📎'; }
}

window.poModals = new POModals();

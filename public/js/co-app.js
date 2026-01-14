// ============================================================
// CHANGE ORDER APP - Ross Built CMS
// ============================================================

let state = {
  changeOrders: [],
  costCodes: [],
  currentJobId: null,
  currentStatusFilter: '',
  searchQuery: ''
};

let currentCO = null;
let costCodeLineIndex = 0;

// ============================================================
// INITIALIZATION
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
  await loadCostCodes();
  setupFilters();
  setupSearch();

  // Sidebar integration - listen for job selection changes
  if (window.JobSidebar) {
    window.JobSidebar.onJobChange((jobId) => {
      state.currentJobId = jobId;
      loadChangeOrders();
    });

    // Get initial job selection
    state.currentJobId = window.JobSidebar.getSelectedJobId();
  }

  // Load change orders if job is selected
  if (state.currentJobId) {
    await loadChangeOrders();
  } else {
    showNoJobSelected();
  }

  // Check for deep linking
  const urlParams = new URLSearchParams(window.location.search);
  const openCOId = urlParams.get('openCO');
  if (openCOId) {
    window.history.replaceState({}, '', window.location.pathname);
    setTimeout(() => showCODetail(openCOId), 300);
  }
});

// ============================================================
// DATA LOADING
// ============================================================

async function loadCostCodes() {
  try {
    const res = await fetch('/api/cost-codes');
    state.costCodes = await res.json();
  } catch (err) {
    console.error('Failed to load cost codes:', err);
  }
}

async function loadChangeOrders() {
  if (!state.currentJobId) {
    showNoJobSelected();
    return;
  }

  const container = document.getElementById('coList');
  const noJobDiv = document.getElementById('noJobSelected');
  noJobDiv.style.display = 'none';
  container.innerHTML = '<div class="loading">Loading change orders...</div>';

  try {
    let url = `/api/jobs/${state.currentJobId}/change-orders`;
    if (state.currentStatusFilter) {
      url += `?status=${state.currentStatusFilter}`;
    }

    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to load change orders');

    state.changeOrders = await res.json();
    renderCOList();
  } catch (err) {
    console.error('Failed to load change orders:', err);
    container.innerHTML = '<div class="error-state">Failed to load change orders</div>';
    showToast('Failed to load change orders', 'error');
  }
}

// ============================================================
// RENDERING
// ============================================================

function showNoJobSelected() {
  document.getElementById('coList').innerHTML = '';
  document.getElementById('noJobSelected').style.display = 'flex';
}

function renderCOList() {
  const container = document.getElementById('coList');

  // Apply search filter
  let filtered = state.changeOrders;
  if (state.searchQuery) {
    const q = state.searchQuery.toLowerCase();
    filtered = filtered.filter(co =>
      co.title?.toLowerCase().includes(q) ||
      co.description?.toLowerCase().includes(q) ||
      `CO-${co.change_order_number}`.toLowerCase().includes(q)
    );
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📋</div>
        <h3>No Change Orders</h3>
        <p>${state.searchQuery ? 'No results match your search' : 'Create a change order to get started'}</p>
        ${!state.searchQuery ? '<button class="btn btn-primary" onclick="showCreateCOModal()">+ New Change Order</button>' : ''}
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(co => renderCOCard(co)).join('');
}

function renderCOCard(co) {
  const statusLabels = {
    draft: 'Draft',
    pending_approval: 'Pending',
    approved: 'Approved',
    closed: 'Closed',
    rejected: 'Rejected'
  };

  const statusClasses = {
    draft: 'status-draft',
    pending_approval: 'status-pending',
    approved: 'status-approved',
    closed: 'status-closed',
    rejected: 'status-denied'
  };

  const amount = parseFloat(co.amount || 0);
  const invoicedAmount = parseFloat(co.invoiced_amount || 0);
  const billedAmount = parseFloat(co.billed_amount || 0);
  const daysAdded = parseInt(co.days_added || 0);

  // Calculate allocation status
  let allocationStatus = '';
  if (invoicedAmount > 0) {
    const pct = amount > 0 ? Math.round((invoicedAmount / amount) * 100) : 0;
    if (invoicedAmount > amount) {
      allocationStatus = `<span class="allocation-badge over">Over by ${formatMoney(invoicedAmount - amount)}</span>`;
    } else if (invoicedAmount < amount) {
      allocationStatus = `<span class="allocation-badge partial">${pct}% invoiced</span>`;
    } else {
      allocationStatus = `<span class="allocation-badge full">Fully invoiced</span>`;
    }
  }

  return `
    <div class="co-card" onclick="showCODetail('${co.id}')">
      <div class="co-card-header">
        <div class="co-card-title">
          <span class="co-number">CO-${String(co.change_order_number).padStart(3, '0')}</span>
          <span class="co-title">${escapeHtml(co.title || 'Untitled')}</span>
        </div>
        <span class="status-badge ${statusClasses[co.status] || ''}">${statusLabels[co.status] || co.status}</span>
      </div>
      <div class="co-card-body">
        <div class="co-card-info">
          <div class="co-amount">${formatMoney(amount)}</div>
          ${daysAdded !== 0 ? `<div class="co-days">${daysAdded > 0 ? '+' : ''}${daysAdded} days</div>` : ''}
        </div>
        <div class="co-card-meta">
          ${allocationStatus}
          ${billedAmount > 0 ? `<span class="billed-badge">${formatMoney(billedAmount)} billed</span>` : ''}
        </div>
      </div>
      ${co.description ? `<div class="co-card-desc">${escapeHtml(co.description.substring(0, 100))}${co.description.length > 100 ? '...' : ''}</div>` : ''}
    </div>
  `;
}

// ============================================================
// FILTERS & SEARCH
// ============================================================

function setupFilters() {
  const statusFilter = document.getElementById('statusFilter');
  statusFilter.addEventListener('change', (e) => {
    state.currentStatusFilter = e.target.value;
    loadChangeOrders();
  });
}

function setupSearch() {
  const searchInput = document.getElementById('searchInput');
  let debounce;
  searchInput.addEventListener('input', (e) => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      state.searchQuery = e.target.value;
      renderCOList();
    }, 200);
  });
}

// ============================================================
// CREATE/EDIT MODAL
// ============================================================

// GC Fee percentages by reason type
const GC_FEE_BY_REASON = {
  owner_request: { fee: 20, hint: 'Owner-initiated change - higher markup justified due to workflow disruption' },
  design_change: { fee: 20, hint: 'Design revision at client direction - additional coordination overhead' },
  scope_change: { fee: 18, hint: 'General scope adjustment - standard markup applies' },
  unforeseen_conditions: { fee: 15, hint: 'Site conditions beyond control - builder shares risk, lower markup' },
  other: { fee: 18, hint: 'Miscellaneous change - standard markup applies' }
};

function showCreateCOModal(coToEdit = null) {
  if (!state.currentJobId) {
    showToast('Please select a job first', 'error');
    return;
  }

  currentCO = coToEdit;
  costCodeLineIndex = 0;

  // Reset form
  document.getElementById('editCOId').value = coToEdit?.id || '';
  document.getElementById('createCOTitle').textContent = coToEdit ? 'Edit Change Order' : 'New Change Order';
  document.getElementById('coTitle').value = coToEdit?.title || '';
  document.getElementById('coDescription').value = coToEdit?.description || '';
  document.getElementById('coDaysAdded').value = coToEdit?.days_added || 0;
  document.getElementById('coBaseAmount').value = coToEdit?.base_amount ? formatNumber(coToEdit.base_amount) : '';

  // Set reason and auto-calculate fee
  const reason = coToEdit?.reason || 'owner_request';
  document.getElementById('coReason').value = reason;

  // If editing, use saved fee; otherwise use recommended fee for reason
  if (coToEdit?.gc_fee_percent !== undefined) {
    document.getElementById('coGCFeePercent').value = coToEdit.gc_fee_percent;
  } else {
    document.getElementById('coGCFeePercent').value = GC_FEE_BY_REASON[reason]?.fee || 18;
  }

  // Admin/management time fields
  document.getElementById('coAdminHours').value = coToEdit?.admin_hours || 0;
  document.getElementById('coAdminRate').value = coToEdit?.admin_rate || 85;

  // Update reason hint
  onReasonChange(!!coToEdit);

  // Reset cost code section
  document.getElementById('coCostCodeToggle').checked = false;
  document.getElementById('coCostCodeSection').style.display = 'none';
  document.getElementById('coCostCodeLines').innerHTML = '';

  calculateCOTotal();

  // If editing and has cost codes, load them
  if (coToEdit?.id) {
    loadCOCostCodes(coToEdit.id);
  }

  const modal = document.getElementById('createCOModal');
  modal.style.display = 'flex';
  requestAnimationFrame(() => {
    modal.classList.add('show');
  });
}

// Handle reason change - update fee and hint
function onReasonChange(isEditing = false) {
  const reason = document.getElementById('coReason').value;
  const config = GC_FEE_BY_REASON[reason] || GC_FEE_BY_REASON.other;

  // Update hint text
  const hintEl = document.getElementById('reasonHint');
  if (hintEl) {
    const hintText = hintEl.querySelector('.hint-text');
    if (hintText) {
      hintText.textContent = config.hint;
    }
  }

  // Auto-update fee only if not editing an existing CO (preserve manual overrides)
  if (!isEditing) {
    document.getElementById('coGCFeePercent').value = config.fee;
    calculateCOTotal();
  }
}

function closeCreateCOModal() {
  const modal = document.getElementById('createCOModal');
  modal.classList.remove('show');
  setTimeout(() => {
    modal.style.display = 'none';
  }, 150);
  currentCO = null;
}

async function loadCOCostCodes(coId) {
  try {
    const res = await fetch(`/api/change-orders/${coId}/cost-codes`);
    if (!res.ok) return;

    const costCodes = await res.json();
    if (costCodes.length > 0) {
      document.getElementById('coCostCodeToggle').checked = true;
      document.getElementById('coCostCodeSection').style.display = 'block';

      costCodes.forEach(cc => {
        addCostCodeLine(cc.cost_code_id, cc.amount, cc.description);
      });
      updateCostCodeTotal();
    }
  } catch (err) {
    console.error('Failed to load CO cost codes:', err);
  }
}

function calculateCOTotal() {
  const baseAmount = parseCurrency(document.getElementById('coBaseAmount').value) || 0;
  const gcFeePercent = parseFloat(document.getElementById('coGCFeePercent').value) || 0;
  const gcFeeAmount = baseAmount * (gcFeePercent / 100);

  // Admin/management time calculation
  const adminHours = parseFloat(document.getElementById('coAdminHours').value) || 0;
  const adminRate = parseFloat(document.getElementById('coAdminRate').value) || 0;
  const adminCost = adminHours * adminRate;

  // Total = Base + GC Fee + Admin Cost
  const totalAmount = baseAmount + gcFeeAmount + adminCost;

  document.getElementById('coGCFeeAmount').value = formatNumber(gcFeeAmount);
  document.getElementById('coAdminCost').value = formatNumber(adminCost);
  document.getElementById('coTotalAmount').value = formatNumber(totalAmount);

  // Update breakdown summary
  updateBreakdownSummary(baseAmount, gcFeeAmount, adminCost, totalAmount);
}

function updateBreakdownSummary(baseAmount, gcFeeAmount, adminCost, totalAmount) {
  const summaryEl = document.getElementById('coBreakdownSummary');
  if (!summaryEl) return;

  const parts = [];
  if (baseAmount > 0) parts.push(`Base: ${formatMoney(baseAmount)}`);
  if (gcFeeAmount > 0) parts.push(`GC Fee: ${formatMoney(gcFeeAmount)}`);
  if (adminCost > 0) parts.push(`Admin: ${formatMoney(adminCost)}`);

  summaryEl.innerHTML = parts.length > 0 ? parts.join(' + ') : '';
}

function toggleCostCodeBreakdown() {
  const checked = document.getElementById('coCostCodeToggle').checked;
  const section = document.getElementById('coCostCodeSection');
  section.style.display = checked ? 'block' : 'none';

  if (checked && document.getElementById('coCostCodeLines').children.length === 0) {
    addCostCodeLine();
  }
}

function addCostCodeLine(costCodeId = '', amount = '', description = '') {
  const container = document.getElementById('coCostCodeLines');
  const index = costCodeLineIndex++;

  const div = document.createElement('div');
  div.className = 'cost-code-line';
  div.id = `costCodeLine-${index}`;
  div.innerHTML = `
    <div class="cc-picker-container" id="ccPicker-${index}"></div>
    <div class="input-with-prefix" style="flex: 0 0 140px;">
      <span class="input-prefix">$</span>
      <input type="text" class="form-control cc-amount" placeholder="0.00" value="${amount ? formatNumber(amount) : ''}" oninput="updateCostCodeTotal()">
    </div>
    <input type="text" class="form-control cc-desc" placeholder="Description (optional)" value="${escapeHtml(description || '')}" style="flex: 1;">
    <button type="button" class="btn-delete-row" onclick="removeCostCodeLine(${index})" title="Remove">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M18 6L6 18M6 6l12 12"/>
      </svg>
    </button>
  `;
  container.appendChild(div);

  // Initialize cost code picker using unified SearchablePicker
  // Filter to only show change order cost codes (codes ending in 'C')
  if (window.SearchablePicker && window.SearchablePicker.init) {
    const pickerContainer = document.getElementById(`ccPicker-${index}`);
    window.SearchablePicker.init(pickerContainer, {
      type: 'costCodes',
      value: costCodeId,
      placeholder: 'Search cost codes...',
      onChange: () => updateCostCodeTotal(),
      filter: (cc) => cc.code && cc.code.endsWith('C')
    });
  }

  document.getElementById('costCodeTotal').style.display = 'block';
  updateCostCodeTotal();
}

function removeCostCodeLine(index) {
  const line = document.getElementById(`costCodeLine-${index}`);
  if (line) line.remove();
  updateCostCodeTotal();

  if (document.getElementById('coCostCodeLines').children.length === 0) {
    document.getElementById('costCodeTotal').style.display = 'none';
  }
}

function updateCostCodeTotal() {
  const lines = document.querySelectorAll('#coCostCodeLines .cost-code-line');
  let total = 0;
  lines.forEach(line => {
    const input = line.querySelector('.cc-amount');
    total += parseCurrency(input.value) || 0;
  });

  const baseAmount = parseCurrency(document.getElementById('coBaseAmount').value) || 0;
  const variance = baseAmount - total;

  document.getElementById('costCodeTotalAmount').textContent = formatMoney(total);

  const varianceEl = document.getElementById('costCodeVariance');
  if (Math.abs(variance) > 0.01) {
    varianceEl.textContent = variance > 0
      ? `(${formatMoney(variance)} unallocated)`
      : `(${formatMoney(Math.abs(variance))} over)`;
    varianceEl.className = 'variance ' + (variance > 0 ? 'under' : 'over');
  } else {
    varianceEl.textContent = '(balanced)';
    varianceEl.className = 'variance balanced';
  }
}

async function saveCO() {
  const coId = document.getElementById('editCOId').value;
  const title = document.getElementById('coTitle').value.trim();
  const description = document.getElementById('coDescription').value.trim();
  const reason = document.getElementById('coReason').value;
  const daysAdded = parseInt(document.getElementById('coDaysAdded').value) || 0;
  const baseAmount = parseCurrency(document.getElementById('coBaseAmount').value) || 0;
  const gcFeePercent = parseFloat(document.getElementById('coGCFeePercent').value) || 0;

  // Admin/management time
  const adminHours = parseFloat(document.getElementById('coAdminHours').value) || 0;
  const adminRate = parseFloat(document.getElementById('coAdminRate').value) || 0;
  const adminCost = adminHours * adminRate;

  if (!title) {
    showToast('Title is required', 'error');
    return;
  }
  if (baseAmount <= 0) {
    showToast('Base amount must be greater than 0', 'error');
    return;
  }

  const gcFeeAmount = baseAmount * (gcFeePercent / 100);
  const totalAmount = baseAmount + gcFeeAmount + adminCost;

  const data = {
    title,
    description,
    reason,
    days_added: daysAdded,
    base_amount: baseAmount,
    gc_fee_percent: gcFeePercent,
    gc_fee_amount: gcFeeAmount,
    admin_hours: adminHours,
    admin_rate: adminRate,
    admin_cost: adminCost,
    amount: totalAmount
  };

  try {
    let res;
    if (coId) {
      res = await fetch(`/api/change-orders/${coId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
    } else {
      res = await fetch(`/api/jobs/${state.currentJobId}/change-orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
    }

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to save change order');
    }

    const savedCO = await res.json();

    // Save cost codes if breakdown is enabled
    if (document.getElementById('coCostCodeToggle').checked) {
      await saveCOCostCodes(savedCO.id);
    }

    showToast(coId ? 'Change order updated' : 'Change order created', 'success');
    closeCreateCOModal();
    await loadChangeOrders();
  } catch (err) {
    console.error('Failed to save CO:', err);
    showToast(err.message || 'Failed to save change order', 'error');
  }
}

async function saveCOCostCodes(coId) {
  const lines = document.querySelectorAll('#coCostCodeLines .cost-code-line');
  const costCodes = [];

  lines.forEach(line => {
    const pickerContainer = line.querySelector('.cc-picker-container');
    const picker = pickerContainer?._costCodePicker;
    const costCodeId = picker?.getValue?.() || pickerContainer.querySelector('input')?.dataset?.value;
    const amount = parseCurrency(line.querySelector('.cc-amount').value) || 0;
    const description = line.querySelector('.cc-desc').value.trim();

    if (costCodeId && amount > 0) {
      costCodes.push({ cost_code_id: costCodeId, amount, description });
    }
  });

  try {
    await fetch(`/api/change-orders/${coId}/cost-codes`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cost_codes: costCodes })
    });
  } catch (err) {
    console.error('Failed to save CO cost codes:', err);
  }
}

// ============================================================
// CO DETAIL MODAL
// ============================================================

async function showCODetail(coId) {
  const modal = document.getElementById('coDetailModal');
  const body = document.getElementById('coDetailBody');
  const footer = document.getElementById('coDetailFooter');

  body.innerHTML = '<div class="loading">Loading...</div>';
  footer.innerHTML = '';
  modal.style.display = 'flex';
  // Add show class after a frame to trigger transition
  requestAnimationFrame(() => {
    modal.classList.add('show');
  });

  try {
    const res = await fetch(`/api/change-orders/${coId}`);
    if (!res.ok) throw new Error('Failed to load change order');

    const co = await res.json();
    currentCO = co;
    renderCODetail(co);
  } catch (err) {
    console.error('Failed to load CO:', err);
    body.innerHTML = '<div class="error-state">Failed to load change order</div>';
    showToast('Failed to load change order', 'error');
  }
}

function renderCODetail(co) {
  const statusLabels = {
    draft: 'Draft',
    pending_approval: 'Pending Approval',
    approved: 'Approved',
    closed: 'Closed',
    rejected: 'Rejected'
  };

  document.getElementById('coDetailTitle').textContent = `CO-${String(co.change_order_number).padStart(3, '0')}: ${co.title}`;
  document.getElementById('coStatusBadge').textContent = statusLabels[co.status] || co.status;
  document.getElementById('coStatusBadge').className = `status-badge status-${co.status}`;

  const amount = parseFloat(co.amount || 0);
  const baseAmount = parseFloat(co.base_amount || 0);
  const gcFeeAmount = parseFloat(co.gc_fee_amount || 0);
  const adminHours = parseFloat(co.admin_hours || 0);
  const adminRate = parseFloat(co.admin_rate || 0);
  const adminCost = parseFloat(co.admin_cost || 0);
  const invoicedAmount = parseFloat(co.invoiced_amount || 0);
  const billedAmount = parseFloat(co.billed_amount || 0);
  const daysAdded = parseInt(co.days_added || 0);

  const body = document.getElementById('coDetailBody');
  body.innerHTML = `
    <div class="co-detail-grid">
      <div class="co-detail-main">
        <div class="detail-section">
          <h3>Details</h3>
          <div class="detail-row">
            <span class="detail-label">Title</span>
            <span class="detail-value">${escapeHtml(co.title)}</span>
          </div>
          ${co.description ? `
          <div class="detail-row">
            <span class="detail-label">Description</span>
            <span class="detail-value">${escapeHtml(co.description)}</span>
          </div>
          ` : ''}
          <div class="detail-row">
            <span class="detail-label">Reason</span>
            <span class="detail-value">${formatReason(co.reason)}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Days Added</span>
            <span class="detail-value">${daysAdded > 0 ? '+' : ''}${daysAdded} days</span>
          </div>
        </div>

        <div class="detail-section">
          <h3>Amount Breakdown</h3>
          <div class="amount-breakdown">
            <div class="breakdown-row">
              <span>Base Amount</span>
              <span>${formatMoney(baseAmount)}</span>
            </div>
            <div class="breakdown-row">
              <span>GC Fee (${co.gc_fee_percent || 0}%)</span>
              <span>${formatMoney(gcFeeAmount)}</span>
            </div>
            ${adminCost > 0 ? `
            <div class="breakdown-row admin-time">
              <span>Admin Time (${adminHours} hrs @ ${formatMoney(adminRate)}/hr)</span>
              <span>${formatMoney(adminCost)}</span>
            </div>
            ` : ''}
            <div class="breakdown-row total">
              <span>Total Amount</span>
              <span>${formatMoney(amount)}</span>
            </div>
          </div>
        </div>

        <div class="detail-section">
          <h3>Invoice & Billing Status</h3>
          <div class="status-grid">
            <div class="status-item">
              <span class="status-label">CO Amount</span>
              <span class="status-value">${formatMoney(amount)}</span>
            </div>
            <div class="status-item">
              <span class="status-label">Invoiced</span>
              <span class="status-value ${invoicedAmount > amount ? 'over' : ''}">${formatMoney(invoicedAmount)}</span>
            </div>
            <div class="status-item">
              <span class="status-label">Billed on Draws</span>
              <span class="status-value">${formatMoney(billedAmount)}</span>
            </div>
            <div class="status-item">
              <span class="status-label">Remaining</span>
              <span class="status-value">${formatMoney(Math.max(0, amount - invoicedAmount))}</span>
            </div>
          </div>
        </div>

        <div class="detail-section" id="coCostCodesSection">
          <h3>Cost Code Breakdown</h3>
          <div id="coCostCodesContent">Loading...</div>
        </div>

        <div class="detail-section" id="coLinkedInvoicesSection">
          <h3>Linked Invoices</h3>
          <div id="coLinkedInvoicesContent">Loading...</div>
        </div>
      </div>

      <div class="co-detail-sidebar">
        <div class="detail-section">
          <h3>Approval Status</h3>
          <div class="approval-status">
            <div class="approval-item ${co.internal_approved_at ? 'approved' : ''}">
              <span class="approval-icon">${co.internal_approved_at ? '✓' : '○'}</span>
              <span class="approval-label">Internal Approval</span>
              ${co.internal_approved_at ? `<span class="approval-date">${formatDate(co.internal_approved_at)}</span>` : ''}
            </div>
            <div class="approval-item ${co.client_approved_at || co.client_approval_bypassed ? 'approved' : ''}">
              <span class="approval-icon">${co.client_approved_at || co.client_approval_bypassed ? '✓' : '○'}</span>
              <span class="approval-label">Client Approval</span>
              ${co.client_approval_bypassed ? `<span class="approval-date">Bypassed</span>` :
                co.client_approved_at ? `<span class="approval-date">${formatDate(co.client_approved_at)}</span>` : ''}
            </div>
          </div>
        </div>

        <div class="detail-section">
          <h3>Activity</h3>
          <div id="coActivityContent">Loading...</div>
        </div>
      </div>
    </div>
  `;

  // Load additional data
  loadCODetailCostCodes(co.id);
  loadCOLinkedInvoices(co.id);
  loadCOActivity(co.id);

  // Render footer buttons
  renderCODetailFooter(co);
}

async function loadCODetailCostCodes(coId) {
  const container = document.getElementById('coCostCodesContent');
  try {
    const res = await fetch(`/api/change-orders/${coId}/cost-codes`);
    const costCodes = await res.json();

    if (costCodes.length === 0) {
      container.innerHTML = '<p class="empty-text">Lump sum (no cost code breakdown)</p>';
      return;
    }

    container.innerHTML = `
      <table class="simple-table">
        <thead>
          <tr>
            <th>Cost Code</th>
            <th>Description</th>
            <th class="num">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${costCodes.map(cc => `
            <tr>
              <td><span class="code">${cc.cost_code?.code || 'N/A'}</span> ${cc.cost_code?.name || ''}</td>
              <td>${escapeHtml(cc.description || '')}</td>
              <td class="num">${formatMoney(cc.amount)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } catch (err) {
    container.innerHTML = '<p class="error-text">Failed to load cost codes</p>';
  }
}

async function loadCOLinkedInvoices(coId) {
  const container = document.getElementById('coLinkedInvoicesContent');
  try {
    const res = await fetch(`/api/change-orders/${coId}/invoices`);
    const invoices = await res.json();

    if (invoices.length === 0) {
      container.innerHTML = '<p class="empty-text">No invoices linked to this change order</p>';
      return;
    }

    container.innerHTML = `
      <table class="simple-table">
        <thead>
          <tr>
            <th>Invoice</th>
            <th>Vendor</th>
            <th>Date</th>
            <th class="num">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${invoices.map(inv => `
            <tr>
              <td>${escapeHtml(inv.invoice_number || 'N/A')}</td>
              <td>${escapeHtml(inv.vendor?.name || 'Unknown')}</td>
              <td>${formatDate(inv.invoice_date)}</td>
              <td class="num">${formatMoney(inv.amount)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } catch (err) {
    container.innerHTML = '<p class="error-text">Failed to load invoices</p>';
  }
}

async function loadCOActivity(coId) {
  const container = document.getElementById('coActivityContent');
  try {
    const res = await fetch(`/api/change-orders/${coId}`);
    const co = await res.json();
    const activity = co.activity || [];

    if (activity.length === 0) {
      container.innerHTML = '<p class="empty-text">No activity recorded</p>';
      return;
    }

    container.innerHTML = `
      <div class="activity-list">
        ${activity.slice(0, 10).map(a => `
          <div class="activity-item">
            <span class="activity-action">${escapeHtml(a.action)}</span>
            <span class="activity-meta">${a.performed_by || 'System'} - ${formatDateTime(a.created_at)}</span>
          </div>
        `).join('')}
      </div>
    `;
  } catch (err) {
    container.innerHTML = '<p class="error-text">Failed to load activity</p>';
  }
}

function renderCODetailFooter(co) {
  const footer = document.getElementById('coDetailFooter');
  const buttons = [];

  // Edit button (draft/pending only)
  if (['draft', 'pending_approval'].includes(co.status)) {
    buttons.push(`<button class="btn btn-secondary" onclick="editCO()">Edit</button>`);
  }

  // Status workflow buttons
  if (co.status === 'draft') {
    buttons.push(`<button class="btn btn-primary" onclick="submitCO('${co.id}')">Submit for Approval</button>`);
  } else if (co.status === 'pending_approval') {
    buttons.push(`<button class="btn btn-danger" onclick="rejectCO('${co.id}')">Reject</button>`);
    buttons.push(`<button class="btn btn-success" onclick="approveCO('${co.id}')">Approve</button>`);
  } else if (co.status === 'approved') {
    if (!co.client_approved_at && !co.client_approval_bypassed) {
      buttons.push(`<button class="btn btn-secondary" onclick="bypassClientApproval('${co.id}')">Bypass Client Approval</button>`);
      buttons.push(`<button class="btn btn-success" onclick="clientApproveCO('${co.id}')">Record Client Approval</button>`);
    }
    buttons.push(`<button class="btn btn-primary" onclick="closeCO('${co.id}')">Close CO</button>`);
  }

  footer.innerHTML = buttons.join('');
}

function editCO() {
  const coToEdit = currentCO;
  closeCODetailModal();
  showCreateCOModal(coToEdit);
}

function closeCODetailModal() {
  const modal = document.getElementById('coDetailModal');
  modal.classList.remove('show');
  // Wait for transition before hiding
  setTimeout(() => {
    modal.style.display = 'none';
  }, 200);
  currentCO = null;
}

// ============================================================
// STATUS WORKFLOW
// ============================================================

async function submitCO(coId) {
  if (!confirm('Submit this change order for approval?')) return;

  try {
    const res = await fetch(`/api/change-orders/${coId}/submit`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to submit');

    showToast('Change order submitted for approval', 'success');
    closeCODetailModal();
    await loadChangeOrders();
  } catch (err) {
    showToast('Failed to submit change order', 'error');
  }
}

async function approveCO(coId) {
  if (!confirm('Approve this change order?')) return;

  try {
    const res = await fetch(`/api/change-orders/${coId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approved_by: 'Jake Ross' })
    });
    if (!res.ok) throw new Error('Failed to approve');

    showToast('Change order approved', 'success');
    closeCODetailModal();
    await loadChangeOrders();
  } catch (err) {
    showToast('Failed to approve change order', 'error');
  }
}

async function rejectCO(coId) {
  const reason = prompt('Reason for rejection:');
  if (reason === null) return;

  try {
    const res = await fetch(`/api/change-orders/${coId}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rejection_reason: reason, rejected_by: 'Jake Ross' })
    });
    if (!res.ok) throw new Error('Failed to reject');

    showToast('Change order rejected', 'success');
    closeCODetailModal();
    await loadChangeOrders();
  } catch (err) {
    showToast('Failed to reject change order', 'error');
  }
}

async function clientApproveCO(coId) {
  if (!confirm('Record client approval for this change order?')) return;

  try {
    const res = await fetch(`/api/change-orders/${coId}/client-approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approved_by: 'Client' })
    });
    if (!res.ok) throw new Error('Failed to record approval');

    showToast('Client approval recorded', 'success');
    await showCODetail(coId);
  } catch (err) {
    showToast('Failed to record client approval', 'error');
  }
}

async function bypassClientApproval(coId) {
  const reason = prompt('Reason for bypassing client approval:');
  if (reason === null) return;

  try {
    const res = await fetch(`/api/change-orders/${coId}/bypass-client`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bypass_reason: reason, bypassed_by: 'Jake Ross' })
    });
    if (!res.ok) throw new Error('Failed to bypass');

    showToast('Client approval bypassed', 'success');
    await showCODetail(coId);
  } catch (err) {
    showToast('Failed to bypass client approval', 'error');
  }
}

async function closeCO(coId) {
  if (!confirm('Close this change order? This marks the work as complete.')) return;

  try {
    const res = await fetch(`/api/change-orders/${coId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'closed' })
    });
    if (!res.ok) throw new Error('Failed to close');

    showToast('Change order closed', 'success');
    closeCODetailModal();
    await loadChangeOrders();
  } catch (err) {
    showToast('Failed to close change order', 'error');
  }
}

// ============================================================
// CONFIRM DIALOG
// ============================================================

function closeConfirmDialog() {
  document.getElementById('confirmDialog').style.display = 'none';
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

function formatMoney(amount) {
  return '$' + (parseFloat(amount) || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatNumber(num) {
  return (parseFloat(num) || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function parseCurrency(str) {
  if (!str) return 0;
  return parseFloat(String(str).replace(/[^0-9.-]/g, '')) || 0;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function formatReason(reason) {
  const labels = {
    scope_change: 'Scope Change',
    owner_request: 'Owner Request',
    unforeseen_conditions: 'Unforeseen Conditions',
    design_change: 'Design Change',
    other: 'Other'
  };
  return labels[reason] || reason || 'N/A';
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

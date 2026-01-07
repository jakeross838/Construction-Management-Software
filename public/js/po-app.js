// ============================================================
// PO APP STATE
// ============================================================

let state = {
  purchaseOrders: [],
  jobs: [],
  vendors: [],
  costCodes: [],
  stats: null,
  currentStatusFilter: 'all',
  currentJobFilter: '',
  currentVendorFilter: '',
  searchQuery: ''
};

// ============================================================
// INITIALIZATION
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  loadJobs();
  loadVendors();
  loadCostCodes();
  loadPurchaseOrders();
  loadStats();
  setupFilterButtons();
  setupSearchInput();
});

// ============================================================
// DATA LOADING
// ============================================================

async function loadJobs() {
  try {
    const res = await fetch('/api/jobs');
    state.jobs = await res.json();

    const select = document.getElementById('jobFilter');
    select.innerHTML = '<option value="">All Jobs</option>';
    state.jobs.forEach(job => {
      select.innerHTML += `<option value="${job.id}">${job.name}</option>`;
    });

    select.addEventListener('change', (e) => {
      state.currentJobFilter = e.target.value;
      renderPOList();
    });
  } catch (err) {
    console.error('Failed to load jobs:', err);
  }
}

async function loadVendors() {
  try {
    const res = await fetch('/api/vendors');
    state.vendors = await res.json();

    const select = document.getElementById('vendorFilter');
    select.innerHTML = '<option value="">All Vendors</option>';
    state.vendors.forEach(vendor => {
      select.innerHTML += `<option value="${vendor.id}">${vendor.name}</option>`;
    });

    select.addEventListener('change', (e) => {
      state.currentVendorFilter = e.target.value;
      renderPOList();
    });
  } catch (err) {
    console.error('Failed to load vendors:', err);
  }
}

async function loadCostCodes() {
  try {
    const res = await fetch('/api/cost-codes');
    state.costCodes = await res.json();
  } catch (err) {
    console.error('Failed to load cost codes:', err);
  }
}

async function loadPurchaseOrders() {
  try {
    const res = await fetch('/api/purchase-orders');
    const pos = await res.json();

    // Load billed amounts for each PO
    for (const po of pos) {
      po.billed_amount = await getPOBilledAmount(po.id);
    }

    state.purchaseOrders = pos;
    renderPOList();
  } catch (err) {
    console.error('Failed to load purchase orders:', err);
    document.getElementById('poList').innerHTML = '<div class="error-state">Failed to load purchase orders</div>';
  }
}

async function getPOBilledAmount(poId) {
  try {
    const res = await fetch(`/api/purchase-orders/${poId}/invoices`);
    const invoices = await res.json();
    return invoices
      .filter(inv => ['approved', 'in_draw', 'paid'].includes(inv.status))
      .reduce((sum, inv) => sum + parseFloat(inv.amount || 0), 0);
  } catch {
    return 0;
  }
}

async function loadStats() {
  try {
    const params = state.currentJobFilter ? `?job_id=${state.currentJobFilter}` : '';
    const res = await fetch(`/api/purchase-orders/stats${params}`);
    state.stats = await res.json();
    renderStats();
  } catch (err) {
    console.error('Failed to load stats:', err);
  }
}

// ============================================================
// RENDERING
// ============================================================

function renderStats() {
  if (!state.stats) return;

  const openValue = state.stats.by_status.approved.value + state.stats.by_status.active.value;

  document.getElementById('statTotalOpen').textContent = formatMoney(openValue);
  document.getElementById('statPendingApproval').textContent = state.stats.pending_approval;
  document.getElementById('statTotalBilled').textContent = formatMoney(state.stats.total_billed);
  document.getElementById('statRemaining').textContent = formatMoney(state.stats.total_remaining);
}

function renderPOList() {
  const container = document.getElementById('poList');

  let filtered = state.purchaseOrders;

  // Status filter
  if (state.currentStatusFilter !== 'all') {
    filtered = filtered.filter(po => {
      const status = po.status_detail || po.status;
      if (state.currentStatusFilter === 'pending') {
        return status === 'pending' || po.approval_status === 'pending';
      }
      return status === state.currentStatusFilter;
    });
  }

  // Job filter
  if (state.currentJobFilter) {
    filtered = filtered.filter(po => po.job_id === state.currentJobFilter);
  }

  // Vendor filter
  if (state.currentVendorFilter) {
    filtered = filtered.filter(po => po.vendor_id === state.currentVendorFilter);
  }

  // Search filter
  if (state.searchQuery) {
    const query = state.searchQuery.toLowerCase();
    filtered = filtered.filter(po =>
      (po.po_number || '').toLowerCase().includes(query) ||
      (po.description || '').toLowerCase().includes(query) ||
      (po.vendor?.name || '').toLowerCase().includes(query) ||
      (po.job?.name || '').toLowerCase().includes(query)
    );
  }

  if (filtered.length === 0) {
    container.innerHTML = '<div class="empty-state">No purchase orders found</div>';
    return;
  }

  // Render as list/table view
  container.innerHTML = `
    <div class="po-list-header">
      <div>PO Number</div>
      <div>Vendor / Job</div>
      <div>Status</div>
      <div>Amount</div>
      <div>Billed</div>
      <div>Remaining</div>
      <div>Progress</div>
    </div>
    ${filtered.map(po => renderPORow(po)).join('')}
  `;
}

function renderPORow(po) {
  const vendor = po.vendor || state.vendors.find(v => v.id === po.vendor_id);
  const job = po.job || state.jobs.find(j => j.id === po.job_id);

  const totalAmount = parseFloat(po.total_amount || 0);
  const billedAmount = po.billed_amount || 0;
  const remainingAmount = totalAmount - billedAmount;
  const billedPercent = totalAmount > 0 ? Math.round((billedAmount / totalAmount) * 100) : 0;

  const status = po.status_detail || po.status || 'pending';
  const statusLabel = getStatusLabel(status, po.approval_status);
  const statusClass = getStatusClass(status, po.approval_status);

  const isOverBudget = billedAmount > totalAmount;

  return `
    <div class="po-row" onclick="window.poModals.openPO('${po.id}')">
      <div class="po-number">${po.po_number || 'Draft'}</div>
      <div class="vendor-job">
        <span class="vendor-name">${vendor?.name || 'Unknown Vendor'}</span>
        <span class="job-name">${job?.name || 'No Job'}</span>
      </div>
      <div><span class="status-badge status-${statusClass}">${statusLabel}</span></div>
      <div class="amount">${formatMoney(totalAmount)}</div>
      <div class="billed">${formatMoney(billedAmount)}</div>
      <div class="remaining ${remainingAmount < 0 ? 'negative' : ''}">${formatMoney(remainingAmount)}</div>
      <div class="progress-cell">
        <div class="mini-progress">
          <div class="mini-progress-fill ${isOverBudget ? 'over' : ''}" style="width: ${Math.min(billedPercent, 100)}%"></div>
        </div>
        <span class="progress-text">${billedPercent}%</span>
      </div>
    </div>
  `;
}

function renderPOCard(po) {
  const vendor = po.vendor || state.vendors.find(v => v.id === po.vendor_id);
  const job = po.job || state.jobs.find(j => j.id === po.job_id);

  const totalAmount = parseFloat(po.total_amount || 0);
  const billedAmount = po.billed_amount || 0;
  const remainingAmount = totalAmount - billedAmount;
  const billedPercent = totalAmount > 0 ? Math.round((billedAmount / totalAmount) * 100) : 0;

  const status = po.status_detail || po.status || 'pending';
  const statusLabel = getStatusLabel(status, po.approval_status);
  const statusClass = getStatusClass(status, po.approval_status);

  const isOverBudget = billedAmount > totalAmount;
  const progressClass = isOverBudget ? 'progress-over' : '';

  // Count line items and linked invoices
  const lineItemCount = po.line_items?.length || 0;

  return `
    <div class="po-card" onclick="window.poModals.openPO('${po.id}')">
      <div class="po-card-header">
        <span class="po-number">${po.po_number || 'Draft PO'}</span>
        <span class="status-badge status-${statusClass}">${statusLabel}</span>
      </div>
      <div class="po-card-body">
        <div class="po-vendor">${vendor?.name || 'Unknown Vendor'}</div>
        <div class="po-job">${job?.name || 'No Job'}</div>
        ${po.description ? `<div class="po-description">${truncate(po.description, 60)}</div>` : ''}
      </div>
      <div class="po-card-amounts">
        <div class="po-amount-row">
          <span class="label">Total:</span>
          <span class="value">${formatMoney(totalAmount)}</span>
        </div>
        <div class="po-amount-row">
          <span class="label">Billed:</span>
          <span class="value ${isOverBudget ? 'text-danger' : ''}">${formatMoney(billedAmount)}</span>
        </div>
        <div class="po-amount-row">
          <span class="label">Remaining:</span>
          <span class="value ${remainingAmount < 0 ? 'text-danger' : ''}">${formatMoney(remainingAmount)}</span>
        </div>
      </div>
      <div class="po-progress-bar ${progressClass}">
        <div class="po-progress-fill" style="width: ${Math.min(billedPercent, 100)}%"></div>
      </div>
      <div class="po-card-footer">
        <span class="po-meta">${lineItemCount} line item${lineItemCount !== 1 ? 's' : ''}</span>
        <span class="po-meta">${billedPercent}% billed</span>
        <span class="po-meta">${formatDate(po.created_at)}</span>
      </div>
    </div>
  `;
}

function getStatusLabel(status, approvalStatus) {
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

function getStatusClass(status, approvalStatus) {
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

// ============================================================
// FILTER SETUP
// ============================================================

function setupFilterButtons() {
  const buttons = document.querySelectorAll('.filter-btn');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.currentStatusFilter = btn.dataset.status;
      renderPOList();
    });
  });
}

function setupSearchInput() {
  const input = document.getElementById('searchInput');
  let debounceTimer;

  input.addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      state.searchQuery = e.target.value;
      renderPOList();
    }, 300);
  });
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

function formatMoney(amount) {
  const num = parseFloat(amount) || 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(num);
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function truncate(str, length) {
  if (!str) return '';
  return str.length > length ? str.substring(0, length) + '...' : str;
}

// ============================================================
// REFRESH FUNCTION (called by modals after updates)
// ============================================================

async function refreshPOList() {
  await loadPurchaseOrders();
  await loadStats();
}

// Export for modals
window.poState = state;
window.refreshPOList = refreshPOList;

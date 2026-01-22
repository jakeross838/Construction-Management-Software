/**
 * Selections & Allowances Page JavaScript
 * Manages allowances, selections, and variance tracking
 */

// ============================================================
// STATE
// ============================================================

let allAllowances = [];
let allJobs = [];
let allCategories = [];
let currentAllowance = null;
let currentSelections = [];

// Catalog state
let catalogProducts = [];
let catalogVendors = [];
let currentCatalogCategory = null;
let currentCatalogProduct = null;
let currentView = 'allowances';

// Client approval state
let currentSelectionForApproval = null;
let selectedSelectionIds = [];
let isPostContract = false;
let currentOverageAmount = 0;

// ============================================================
// INITIALIZATION
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
  // Set up event listeners first
  setupEventListeners();

  // Load reference data
  await Promise.all([
    loadJobs(),
    loadCategories()
  ]);

  // Load allowances
  await loadAllowances();
});

function setupEventListeners() {
  // Filters
  document.getElementById('jobFilter').addEventListener('change', applyFilters);
  document.getElementById('categoryFilter').addEventListener('change', applyFilters);
  document.getElementById('statusFilter').addEventListener('change', applyFilters);

  // Search with debounce
  let searchTimer;
  document.getElementById('searchInput').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => applyFilters(), 150);
  });

  // New allowance button
  document.getElementById('btnNewAllowance').addEventListener('click', openNewAllowanceModal);

  // Export PDF
  document.getElementById('btnExportPDF').addEventListener('click', exportSelectionsPDF);

  // Selection price calculation
  const priceInputs = ['selectionQty', 'selectionPrice', 'selectionMarkup'];
  priceInputs.forEach(id => {
    document.getElementById(id).addEventListener('input', calculateSelectionTotal);
  });

  // CO markup calculation
  document.getElementById('coMarkup').addEventListener('input', calculateCOTotal);

  // Catalog search (selection modal)
  let catalogTimer;
  document.getElementById('catalogSearch').addEventListener('input', (e) => {
    clearTimeout(catalogTimer);
    catalogTimer = setTimeout(() => searchCatalog(e.target.value), 200);
  });

  // Catalog view search with debounce
  let catalogViewSearchTimer;
  const catalogSearchInput = document.getElementById('catalogSearchInput');
  if (catalogSearchInput) {
    catalogSearchInput.addEventListener('input', (e) => {
      clearTimeout(catalogViewSearchTimer);
      catalogViewSearchTimer = setTimeout(() => loadCatalogProducts(), 200);
    });
  }

  // Catalog view filters
  const catalogVendorFilter = document.getElementById('catalogVendorFilter');
  if (catalogVendorFilter) {
    catalogVendorFilter.addEventListener('change', loadCatalogProducts);
  }

  const catalogRoomFilter = document.getElementById('catalogRoomFilter');
  if (catalogRoomFilter) {
    catalogRoomFilter.addEventListener('change', loadCatalogProducts);
  }

  // Clear catalog filters button
  const btnClearCatalogFilters = document.getElementById('btnClearCatalogFilters');
  if (btnClearCatalogFilters) {
    btnClearCatalogFilters.addEventListener('click', clearCatalogFilters);
  }

  // Add product button
  const btnAddProduct = document.getElementById('btnAddProduct');
  if (btnAddProduct) {
    btnAddProduct.addEventListener('click', openAddProductModal);
  }

  // Manage categories button
  const btnManageCategories = document.getElementById('btnManageCategories');
  if (btnManageCategories) {
    btnManageCategories.addEventListener('click', openCategoryManagement);
  }

  // Catalog product modal job dropdown
  const catalogProductJob = document.getElementById('catalogProductJob');
  if (catalogProductJob) {
    catalogProductJob.addEventListener('change', loadCatalogProductAllowances);
  }

  // Close modals on outside click
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('show');
        modal.style.display = 'none';
      }
    });
  });
}

// ============================================================
// DATA LOADING
// ============================================================

async function loadJobs() {
  try {
    const res = await fetch('/api/jobs');
    if (!res.ok) throw new Error('Failed to load jobs');
    allJobs = await res.json();

    // Populate job filters
    const jobFilter = document.getElementById('jobFilter');
    const allowanceJob = document.getElementById('allowanceJob');

    allJobs.forEach(job => {
      jobFilter.innerHTML += `<option value="${job.id}">${job.name}</option>`;
      allowanceJob.innerHTML += `<option value="${job.id}">${job.name}</option>`;
    });
  } catch (err) {
    console.error('Failed to load jobs:', err);
    showToast('Failed to load jobs', 'error');
  }
}

async function loadCategories() {
  try {
    const res = await fetch('/api/selections/categories');
    if (!res.ok) throw new Error('Failed to load categories');
    allCategories = await res.json();

    // Populate category filters
    const categoryFilter = document.getElementById('categoryFilter');
    const allowanceCategory = document.getElementById('allowanceCategory');

    allCategories.forEach(cat => {
      categoryFilter.innerHTML += `<option value="${cat.id}">${cat.name}</option>`;
      allowanceCategory.innerHTML += `<option value="${cat.id}">${cat.name}</option>`;
    });
  } catch (err) {
    console.error('Failed to load categories:', err);
    showToast('Failed to load categories', 'error');
  }
}

async function loadAllowances() {
  try {
    const jobId = document.getElementById('jobFilter').value;
    const categoryId = document.getElementById('categoryFilter').value;
    const status = document.getElementById('statusFilter').value;

    let url = '/api/selections/allowances?';
    if (jobId) url += `job_id=${jobId}&`;
    if (categoryId) url += `category_id=${categoryId}&`;
    if (status) url += `status=${status}&`;

    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to load allowances');
    allAllowances = await res.json();

    renderAllowances();
    updateSummary();
  } catch (err) {
    console.error('Failed to load allowances:', err);
    showToast('Failed to load allowances', 'error');
  }
}

function applyFilters() {
  loadAllowances();
}

// ============================================================
// RENDERING
// ============================================================

function renderAllowances() {
  const grid = document.getElementById('allowancesGrid');
  const emptyState = document.getElementById('emptyState');
  const search = document.getElementById('searchInput').value.toLowerCase();

  // Filter by search
  let filtered = allAllowances;
  if (search) {
    filtered = allAllowances.filter(a =>
      a.name.toLowerCase().includes(search) ||
      a.job?.name?.toLowerCase().includes(search) ||
      a.category?.name?.toLowerCase().includes(search)
    );
  }

  if (filtered.length === 0) {
    grid.innerHTML = '';
    emptyState.style.display = 'flex';
    return;
  }

  emptyState.style.display = 'none';
  grid.innerHTML = filtered.map(a => renderAllowanceCard(a)).join('');
}

function renderAllowanceCard(allowance) {
  const variance = parseFloat(allowance.variance) || 0;
  const budget = parseFloat(allowance.budgeted_amount) || 0;
  const selected = parseFloat(allowance.selected_amount) || 0;
  const pct = budget > 0 ? Math.min((selected / budget) * 100, 100) : 0;

  const varianceClass = variance > 0 ? 'over' : variance < 0 ? 'under' : 'on-budget';
  const varianceSign = variance > 0 ? '+' : '';

  const statusBadge = getStatusBadge(allowance.status);
  const deadline = allowance.deadline ? formatDate(allowance.deadline) : '';
  const isOverdue = allowance.deadline && new Date(allowance.deadline) < new Date() && allowance.status !== 'complete';

  return `
    <div class="allowance-card" onclick="openAllowanceDetail('${allowance.id}')">
      <div class="allowance-card-header">
        <div class="allowance-card-title">
          <span class="category-icon">${getCategoryIcon(allowance.category?.name)}</span>
          <div>
            <h4>${escapeHtml(allowance.name)}</h4>
            <span class="job-name">${escapeHtml(allowance.job?.name || 'No Job')}</span>
          </div>
        </div>
        ${statusBadge}
      </div>

      <div class="allowance-card-amounts">
        <div class="amount-col">
          <span class="label">Budget</span>
          <span class="value">${formatCurrency(budget)}</span>
        </div>
        <div class="amount-col">
          <span class="label">Selected</span>
          <span class="value">${formatCurrency(selected)}</span>
        </div>
        <div class="amount-col variance ${varianceClass}">
          <span class="label">Variance</span>
          <span class="value">${varianceSign}${formatCurrency(Math.abs(variance))}</span>
        </div>
      </div>

      <div class="allowance-progress">
        <div class="progress-bar">
          <div class="progress-fill ${varianceClass}" style="width: ${pct}%"></div>
        </div>
        <span class="progress-pct">${Math.round(pct)}%</span>
      </div>

      ${deadline ? `
        <div class="allowance-deadline ${isOverdue ? 'overdue' : ''}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
          ${deadline}${isOverdue ? ' (Overdue)' : ''}
        </div>
      ` : ''}
    </div>
  `;
}

function getStatusBadge(status) {
  const badges = {
    pending: '<span class="badge badge-warning">Pending</span>',
    in_progress: '<span class="badge badge-info">In Progress</span>',
    complete: '<span class="badge badge-success">Complete</span>'
  };
  return badges[status] || badges.pending;
}

function getCategoryIcon(categoryName) {
  const icons = {
    Flooring: '🪵',
    Cabinets: '🗄️',
    Countertops: '🔲',
    Appliances: '🍳',
    'Plumbing Fixtures': '🚿',
    Lighting: '💡',
    Hardware: '🔩',
    'Paint Colors': '🎨',
    Tile: '🔳',
    Doors: '🚪',
    Windows: '🪟',
    Landscaping: '🌿',
    Other: '📦'
  };
  return icons[categoryName] || '📦';
}

function updateSummary() {
  let totalBudget = 0;
  let totalSelected = 0;
  let pending = 0;
  let inProgress = 0;
  let complete = 0;

  allAllowances.forEach(a => {
    totalBudget += parseFloat(a.budgeted_amount) || 0;
    totalSelected += parseFloat(a.selected_amount) || 0;
    if (a.status === 'pending') pending++;
    else if (a.status === 'in_progress') inProgress++;
    else if (a.status === 'complete') complete++;
  });

  const variance = totalSelected - totalBudget;

  document.getElementById('totalBudget').textContent = formatCurrency(totalBudget);
  document.getElementById('totalSelected').textContent = formatCurrency(totalSelected);

  const varianceEl = document.getElementById('totalVariance');
  varianceEl.textContent = (variance >= 0 ? '+' : '') + formatCurrency(variance);
  varianceEl.className = 'summary-value ' + (variance > 0 ? 'over' : variance < 0 ? 'under' : '');

  document.getElementById('allowanceCount').textContent = allAllowances.length;
  document.getElementById('allowanceBreakdown').innerHTML = `
    <span class="pending">${pending} pending</span>
    <span class="in-progress">${inProgress} in progress</span>
    <span class="complete">${complete} complete</span>
  `;
}

// ============================================================
// ALLOWANCE MODAL
// ============================================================

function openNewAllowanceModal() {
  document.getElementById('allowanceModalTitle').textContent = 'New Allowance';
  document.getElementById('allowanceForm').reset();
  document.getElementById('allowanceId').value = '';

  const modal = document.getElementById('allowanceModal');
  modal.style.display = 'flex';
  modal.classList.add('show');
}

function openEditAllowanceModal(allowance) {
  document.getElementById('allowanceModalTitle').textContent = 'Edit Allowance';
  document.getElementById('allowanceId').value = allowance.id;
  document.getElementById('allowanceJob').value = allowance.job_id;
  document.getElementById('allowanceCategory').value = allowance.category_id;
  document.getElementById('allowanceName').value = allowance.name;
  document.getElementById('allowanceAmount').value = allowance.budgeted_amount;
  document.getElementById('allowanceType').value = allowance.allowance_type || 'material_only';
  document.getElementById('allowanceDeadline').value = allowance.deadline || '';
  document.getElementById('allowanceDeadlineNotes').value = allowance.deadline_notes || '';
  document.getElementById('allowanceDescription').value = allowance.description || '';

  const modal = document.getElementById('allowanceModal');
  modal.style.display = 'flex';
  modal.classList.add('show');
}

function closeAllowanceModal() {
  const modal = document.getElementById('allowanceModal');
  modal.classList.remove('show');
  modal.style.display = 'none';
}

async function saveAllowance() {
  const id = document.getElementById('allowanceId').value;
  const data = {
    job_id: document.getElementById('allowanceJob').value,
    category_id: document.getElementById('allowanceCategory').value,
    name: document.getElementById('allowanceName').value.trim(),
    budgeted_amount: parseFloat(document.getElementById('allowanceAmount').value) || 0,
    allowance_type: document.getElementById('allowanceType').value,
    deadline: document.getElementById('allowanceDeadline').value || null,
    deadline_notes: document.getElementById('allowanceDeadlineNotes').value.trim() || null,
    description: document.getElementById('allowanceDescription').value.trim() || null
  };

  if (!data.job_id || !data.category_id || !data.name) {
    showToast('Please fill in all required fields', 'error');
    return;
  }

  try {
    const url = id ? `/api/selections/allowances/${id}` : '/api/selections/allowances';
    const method = id ? 'PATCH' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to save');
    }

    showToast(id ? 'Allowance updated' : 'Allowance created', 'success');
    closeAllowanceModal();
    await loadAllowances();
  } catch (err) {
    console.error('Save error:', err);
    showToast(err.message, 'error');
  }
}

// ============================================================
// ALLOWANCE DETAIL MODAL
// ============================================================

async function openAllowanceDetail(id) {
  try {
    const res = await fetch(`/api/selections/allowances/${id}`);
    if (!res.ok) throw new Error('Failed to load allowance');
    currentAllowance = await res.json();
    currentSelections = currentAllowance.selections || [];

    renderAllowanceDetail();

    const modal = document.getElementById('allowanceDetailModal');
    modal.style.display = 'flex';
    modal.classList.add('show');
  } catch (err) {
    console.error('Load error:', err);
    showToast('Failed to load allowance details', 'error');
  }
}

function renderAllowanceDetail() {
  const a = currentAllowance;
  const budget = parseFloat(a.budgeted_amount) || 0;
  const selected = parseFloat(a.selected_amount) || 0;
  const variance = parseFloat(a.variance) || 0;

  // Header
  document.getElementById('detailAllowanceName').textContent = a.name;
  document.getElementById('detailAllowanceStatus').textContent =
    a.status === 'in_progress' ? 'In Progress' :
    a.status.charAt(0).toUpperCase() + a.status.slice(1);
  document.getElementById('detailAllowanceStatus').className =
    `badge badge-${a.status === 'complete' ? 'success' : a.status === 'in_progress' ? 'info' : 'warning'}`;

  // Budget summary
  document.getElementById('detailBudget').textContent = formatCurrency(budget);
  document.getElementById('detailSelected').textContent = formatCurrency(selected);

  const varianceEl = document.getElementById('detailVariance');
  varianceEl.textContent = (variance >= 0 ? '+' : '') + formatCurrency(variance);
  varianceEl.className = `value ${variance > 0 ? 'over' : variance < 0 ? 'under' : ''}`;

  // Variance bar
  const pct = budget > 0 ? Math.min((selected / budget) * 100, 100) : 0;
  const bar = document.getElementById('detailVarianceBar');
  bar.style.width = `${pct}%`;
  bar.className = `variance-bar ${variance > 0 ? 'over' : variance < 0 ? 'under' : ''}`;

  // Details
  document.getElementById('detailJob').textContent = a.job?.name || '-';
  document.getElementById('detailCategory').textContent = a.category?.name || '-';
  document.getElementById('detailType').textContent =
    a.allowance_type === 'installed' ? 'Installed (Material + Labor)' : 'Material Only';
  document.getElementById('detailDeadline').textContent = a.deadline ? formatDate(a.deadline) : '-';

  // Overage card
  const overageCard = document.getElementById('overageCard');
  if (variance > 0) {
    overageCard.style.display = 'block';
    document.getElementById('overageAmount').textContent = formatCurrency(variance);

    // Check if any selection already has a change order
    const selectionsWithCO = currentSelections.filter(s => s.change_order_id);
    const coButton = document.getElementById('createCOButton');
    const coExistsInfo = document.getElementById('coExistsInfo');

    if (selectionsWithCO.length > 0) {
      // CO already exists - show info instead of button
      if (coButton) coButton.style.display = 'none';
      if (coExistsInfo) {
        coExistsInfo.style.display = 'block';
        coExistsInfo.innerHTML = `
          <div class="co-exists-badge">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
            Change Order Created
          </div>
          <p class="co-info-text">${selectionsWithCO.length} selection(s) linked to CO</p>
        `;
      }
    } else {
      // No CO yet - show button
      if (coButton) coButton.style.display = 'block';
      if (coExistsInfo) coExistsInfo.style.display = 'none';
    }
  } else {
    overageCard.style.display = 'none';
  }

  // Selections
  document.getElementById('selectionCount').textContent =
    `${currentSelections.length} item${currentSelections.length !== 1 ? 's' : ''}`;
  renderSelectionsList();
}

function renderSelectionsList() {
  const container = document.getElementById('selectionsList');

  if (currentSelections.length === 0) {
    container.innerHTML = `
      <div class="empty-selections">
        <p>No selections yet. Click "Add Selection" to begin.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = currentSelections.map(s => {
    const statusClass = {
      pending: 'warning',
      selected: 'info',
      approved: 'success',
      ordered: 'primary',
      installed: 'success'
    }[s.status] || 'secondary';

    // CO badge if change_order_id exists
    const coBadge = s.change_order_id ? `
      <span class="badge badge-warning co-badge" title="Change Order Created">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
        </svg>
        CO
      </span>
    ` : '';

    return `
      <div class="selection-item" data-id="${s.id}">
        <div class="selection-item-main">
          <div class="selection-info">
            <h5>${escapeHtml(s.name)}</h5>
            <div class="selection-meta">
              ${s.vendor_name ? `<span>${escapeHtml(s.vendor_name)}</span>` : ''}
              ${s.model_number ? `<span>${escapeHtml(s.model_number)}</span>` : ''}
              <span>${s.quantity} ${s.unit}</span>
            </div>
          </div>
          <div class="selection-pricing">
            <span class="unit-price">${formatCurrency(s.unit_price)}/${s.unit}</span>
            <span class="total-price">${formatCurrency(s.final_price)}</span>
          </div>
        </div>
        <div class="selection-item-footer">
          <span class="badge badge-${statusClass}">${s.status}</span>
          ${coBadge}
          <div class="selection-actions">
            ${s.status === 'pending' ? `
              <button class="btn btn-sm btn-secondary" onclick="updateSelectionStatus('${s.id}', 'selected')">Mark Selected</button>
            ` : ''}
            ${s.status === 'selected' ? `
              <button class="btn btn-sm btn-primary" onclick="updateSelectionStatus('${s.id}', 'approved')">Approve</button>
            ` : ''}
            ${s.status === 'approved' ? `
              <button class="btn btn-sm btn-secondary" onclick="updateSelectionStatus('${s.id}', 'ordered')">Mark Ordered</button>
            ` : ''}
            ${s.status === 'ordered' ? `
              <button class="btn btn-sm btn-success" onclick="updateSelectionStatus('${s.id}', 'installed')">Mark Installed</button>
            ` : ''}
            <button class="btn btn-sm btn-icon" onclick="editSelection('${s.id}')" title="Edit">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </button>
            <button class="btn btn-sm btn-icon btn-danger" onclick="deleteSelection('${s.id}')" title="Delete">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function closeDetailModal() {
  const modal = document.getElementById('allowanceDetailModal');
  modal.classList.remove('show');
  modal.style.display = 'none';
  currentAllowance = null;
  currentSelections = [];
}

function editCurrentAllowance() {
  if (currentAllowance) {
    closeDetailModal();
    openEditAllowanceModal(currentAllowance);
  }
}

// ============================================================
// SELECTION MODAL
// ============================================================

function addSelection() {
  if (!currentAllowance) return;

  document.getElementById('selectionModalTitle').textContent = 'Add Selection';
  document.getElementById('selectionForm').reset();
  document.getElementById('selectionId').value = '';
  document.getElementById('selectionAllowanceId').value = currentAllowance.id;
  document.getElementById('selectionQty').value = '1';
  document.getElementById('selectionMarkup').value = '0';
  document.getElementById('catalogSearch').value = '';
  document.getElementById('catalogResults').style.display = 'none';

  calculateSelectionTotal();

  const modal = document.getElementById('selectionModal');
  modal.style.display = 'flex';
  modal.classList.add('show');
}

function editSelection(id) {
  const selection = currentSelections.find(s => s.id === id);
  if (!selection) return;

  document.getElementById('selectionModalTitle').textContent = 'Edit Selection';
  document.getElementById('selectionId').value = selection.id;
  document.getElementById('selectionAllowanceId').value = selection.allowance_id;
  document.getElementById('selectionName').value = selection.name;
  document.getElementById('selectionVendor').value = selection.vendor_name || '';
  document.getElementById('selectionModel').value = selection.model_number || '';
  document.getElementById('selectionQty').value = selection.quantity;
  document.getElementById('selectionUnit').value = selection.unit || 'each';
  document.getElementById('selectionPrice').value = selection.unit_price;
  document.getElementById('selectionMarkup').value = selection.markup_percent || 0;
  document.getElementById('selectionNotes').value = selection.client_notes || '';
  document.getElementById('catalogSearch').value = '';
  document.getElementById('catalogResults').style.display = 'none';

  calculateSelectionTotal();

  const modal = document.getElementById('selectionModal');
  modal.style.display = 'flex';
  modal.classList.add('show');
}

function closeSelectionModal() {
  const modal = document.getElementById('selectionModal');
  modal.classList.remove('show');
  modal.style.display = 'none';
}

function calculateSelectionTotal() {
  const qty = parseFloat(document.getElementById('selectionQty').value) || 0;
  const price = parseFloat(document.getElementById('selectionPrice').value) || 0;
  const markup = parseFloat(document.getElementById('selectionMarkup').value) || 0;

  const subtotal = qty * price;
  const total = subtotal * (1 + markup / 100);

  document.getElementById('selectionSubtotal').textContent = formatCurrency(subtotal);
  document.getElementById('selectionTotal').textContent = formatCurrency(total);
}

async function saveSelection() {
  const id = document.getElementById('selectionId').value;
  const data = {
    allowance_id: document.getElementById('selectionAllowanceId').value,
    name: document.getElementById('selectionName').value.trim(),
    vendor_name: document.getElementById('selectionVendor').value.trim() || null,
    model_number: document.getElementById('selectionModel').value.trim() || null,
    quantity: parseFloat(document.getElementById('selectionQty').value) || 1,
    unit: document.getElementById('selectionUnit').value,
    unit_price: parseFloat(document.getElementById('selectionPrice').value) || 0,
    markup_percent: parseFloat(document.getElementById('selectionMarkup').value) || 0,
    client_notes: document.getElementById('selectionNotes').value.trim() || null
  };

  if (!data.name || !data.unit_price) {
    showToast('Name and unit price are required', 'error');
    return;
  }

  try {
    const url = id ? `/api/selections/items/${id}` : '/api/selections/items';
    const method = id ? 'PATCH' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to save');
    }

    showToast(id ? 'Selection updated' : 'Selection added', 'success');
    closeSelectionModal();

    // Reload the allowance detail
    await openAllowanceDetail(currentAllowance.id);
    await loadAllowances(); // Update grid too
  } catch (err) {
    console.error('Save error:', err);
    showToast(err.message, 'error');
  }
}

async function updateSelectionStatus(id, newStatus) {
  try {
    const res = await fetch(`/api/selections/items/${id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: newStatus,
        changed_by: 'Jake Ross'
      })
    });

    if (!res.ok) throw new Error('Failed to update status');

    showToast(`Selection ${newStatus}`, 'success');
    await openAllowanceDetail(currentAllowance.id);
    await loadAllowances();
  } catch (err) {
    console.error('Status update error:', err);
    showToast('Failed to update status', 'error');
  }
}

async function deleteSelection(id) {
  if (!confirm('Delete this selection?')) return;

  try {
    const res = await fetch(`/api/selections/items/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete');

    showToast('Selection deleted', 'success');
    await openAllowanceDetail(currentAllowance.id);
    await loadAllowances();
  } catch (err) {
    console.error('Delete error:', err);
    showToast('Failed to delete selection', 'error');
  }
}

// ============================================================
// CATALOG SEARCH
// ============================================================

async function searchCatalog(query) {
  const resultsEl = document.getElementById('catalogResults');

  if (!query || query.length < 2) {
    resultsEl.style.display = 'none';
    return;
  }

  try {
    const categoryId = currentAllowance?.category_id;
    let url = `/api/selections/catalog?search=${encodeURIComponent(query)}`;
    if (categoryId) url += `&category_id=${categoryId}`;

    const res = await fetch(url);
    if (!res.ok) throw new Error('Search failed');
    const items = await res.json();

    if (items.length === 0) {
      resultsEl.innerHTML = '<div class="catalog-no-results">No items found</div>';
    } else {
      resultsEl.innerHTML = items.slice(0, 5).map(item => `
        <div class="catalog-item" onclick="selectCatalogItem('${item.id}')">
          <div class="catalog-item-name">${escapeHtml(item.name)}</div>
          <div class="catalog-item-meta">
            ${item.vendor?.name || ''} ${item.model_number || ''}
          </div>
          <div class="catalog-item-price">${formatCurrency(item.unit_price || 0)}/${item.unit || 'each'}</div>
        </div>
      `).join('');
    }

    resultsEl.style.display = 'block';
  } catch (err) {
    console.error('Catalog search error:', err);
  }
}

async function selectCatalogItem(id) {
  try {
    const res = await fetch(`/api/selections/catalog/${id}`);
    if (!res.ok) throw new Error('Failed to load item');
    const item = await res.json();

    document.getElementById('selectionName').value = item.name;
    document.getElementById('selectionVendor').value = item.vendor?.name || '';
    document.getElementById('selectionModel').value = item.model_number || '';
    document.getElementById('selectionUnit').value = item.unit || 'each';
    document.getElementById('selectionPrice').value = item.unit_price || 0;
    document.getElementById('catalogSearch').value = '';
    document.getElementById('catalogResults').style.display = 'none';

    calculateSelectionTotal();
  } catch (err) {
    console.error('Failed to select catalog item:', err);
  }
}

// ============================================================
// CHANGE ORDER
// ============================================================

function createChangeOrder() {
  if (!currentAllowance) return;

  const variance = parseFloat(currentAllowance.variance) || 0;
  if (variance <= 0) {
    showToast('No overage to create change order', 'error');
    return;
  }

  document.getElementById('coOverage').textContent = formatCurrency(variance);
  document.getElementById('coMarkup').value = '15';
  document.getElementById('coDescription').value = '';
  calculateCOTotal();

  const modal = document.getElementById('coModal');
  modal.style.display = 'flex';
  modal.classList.add('show');
}

function calculateCOTotal() {
  const variance = parseFloat(currentAllowance?.variance) || 0;
  const markup = parseFloat(document.getElementById('coMarkup').value) || 0;
  const total = variance * (1 + markup / 100);
  document.getElementById('coTotal').textContent = formatCurrency(total);
}

function closeCOModal() {
  const modal = document.getElementById('coModal');
  modal.classList.remove('show');
  modal.style.display = 'none';
}

async function submitChangeOrder() {
  // Find a selection with overage to attach CO to
  const overSelection = currentSelections.find(s =>
    parseFloat(s.final_price) > 0 && !s.change_order_id
  );

  if (!overSelection) {
    showToast('No selection available to attach change order', 'error');
    return;
  }

  try {
    const res = await fetch(`/api/selections/items/${overSelection.id}/create-co`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        markup_percent: parseFloat(document.getElementById('coMarkup').value) || 0,
        description: document.getElementById('coDescription').value.trim(),
        created_by: 'Jake Ross'
      })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to create change order');
    }

    const result = await res.json();
    showToast(`Change order created: ${formatCurrency(result.final_amount)}`, 'success');
    closeCOModal();
    await openAllowanceDetail(currentAllowance.id);
  } catch (err) {
    console.error('CO creation error:', err);
    showToast(err.message, 'error');
  }
}

// ============================================================
// EXPORT
// ============================================================

async function exportSelectionsPDF() {
  const jobId = document.getElementById('jobFilter').value;
  if (!jobId) {
    showToast('Please select a job to export', 'warning');
    return;
  }

  showToast('PDF export coming soon', 'info');
  // TODO: Implement PDF export via /api/reports endpoint
}

// ============================================================
// UTILITIES
// ============================================================

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount || 0);
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function showToast(message, type = 'info') {
  if (typeof window.showToast === 'function') {
    window.showToast(message, type);
  } else {
    console.log(`[${type}] ${message}`);
  }
}

// ============================================================
// VIEW TOGGLE
// ============================================================

function switchView(view) {
  currentView = view;

  // Update tab buttons
  document.querySelectorAll('.view-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.view === view);
  });

  // Update view content
  document.querySelectorAll('.view-content').forEach(content => {
    content.classList.toggle('active', content.id === view + 'View');
  });

  // Update header buttons
  const newAllowanceBtn = document.getElementById('btnNewAllowance');
  const addProductBtn = document.getElementById('btnAddProduct');

  if (view === 'allowances') {
    newAllowanceBtn.style.display = 'flex';
    addProductBtn.style.display = 'none';
  } else {
    newAllowanceBtn.style.display = 'none';
    addProductBtn.style.display = 'flex';
    // Load catalog data if not already loaded
    if (catalogProducts.length === 0) {
      loadCatalogData();
    }
  }
}

// ============================================================
// CATALOG VIEW FUNCTIONS
// ============================================================

async function loadCatalogData() {
  // Load categories if not already loaded from allowances
  if (allCategories.length === 0) {
    await loadCategories();
  }
  renderCatalogCategoryTree();

  // Load vendors for filter
  await loadCatalogVendors();

  // Load products
  await loadCatalogProducts();
}

async function loadCatalogVendors() {
  try {
    const res = await fetch('/api/vendors');
    if (!res.ok) throw new Error('Failed to load vendors');
    catalogVendors = await res.json();

    const vendorFilter = document.getElementById('catalogVendorFilter');
    vendorFilter.innerHTML = '<option value="">All Vendors</option>';
    catalogVendors.forEach(v => {
      vendorFilter.innerHTML += `<option value="${v.id}">${escapeHtml(v.name)}</option>`;
    });
  } catch (err) {
    console.error('Failed to load vendors:', err);
  }
}

async function loadCatalogProducts() {
  const grid = document.getElementById('catalogProductGrid');
  const emptyState = document.getElementById('catalogEmptyState');

  // Show loading
  grid.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Loading products...</p></div>';
  emptyState.style.display = 'none';

  try {
    // Build query params
    const params = new URLSearchParams();

    if (currentCatalogCategory) params.append('category_id', currentCatalogCategory);

    const search = document.getElementById('catalogSearchInput').value.trim();
    if (search) params.append('search', search);

    const vendor = document.getElementById('catalogVendorFilter').value;
    if (vendor) params.append('vendor_id', vendor);

    const room = document.getElementById('catalogRoomFilter').value;
    if (room) params.append('room', room);

    const res = await fetch(`/api/selections/catalog?${params.toString()}`);
    if (!res.ok) throw new Error('Failed to load products');
    catalogProducts = await res.json();

    renderCatalogProducts();
    updateCatalogResultCount();
  } catch (err) {
    console.error('Failed to load products:', err);
    showToast('Failed to load products', 'error');
    grid.innerHTML = '<div class="error-state"><p>Failed to load products</p></div>';
  }
}

function renderCatalogCategoryTree() {
  const tree = document.getElementById('catalogCategoryTree');

  // All Products option
  let html = `
    <div class="category-item ${!currentCatalogCategory ? 'active' : ''}" data-category="" onclick="selectCatalogCategory('')">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="3" width="7" height="7"></rect>
        <rect x="14" y="3" width="7" height="7"></rect>
        <rect x="14" y="14" width="7" height="7"></rect>
        <rect x="3" y="14" width="7" height="7"></rect>
      </svg>
      <span>All Products</span>
    </div>
  `;

  // Build hierarchical categories
  allCategories.forEach(cat => {
    const hasChildren = cat.children && cat.children.length > 0;
    const isActive = currentCatalogCategory === cat.id;

    html += `
      <div class="category-parent ${hasChildren ? 'has-children' : ''} ${isActive ? 'active' : ''}">
        <div class="category-item" data-category="${cat.id}" onclick="selectCatalogCategory('${cat.id}')">
          <span class="category-icon">${getCategoryIcon(cat.name)}</span>
          <span>${escapeHtml(cat.name)}</span>
          ${hasChildren ? `
            <svg class="expand-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          ` : ''}
        </div>
        ${hasChildren ? `
          <div class="category-children">
            ${cat.children.map(child => `
              <div class="category-item child ${currentCatalogCategory === child.id ? 'active' : ''}"
                   data-category="${child.id}"
                   onclick="event.stopPropagation(); selectCatalogCategory('${child.id}')">
                <span>${escapeHtml(child.name)}</span>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `;
  });

  tree.innerHTML = html;
}

function selectCatalogCategory(categoryId) {
  currentCatalogCategory = categoryId || null;
  renderCatalogCategoryTree();
  loadCatalogProducts();
}

function renderCatalogProducts() {
  const grid = document.getElementById('catalogProductGrid');
  const emptyState = document.getElementById('catalogEmptyState');

  if (catalogProducts.length === 0) {
    grid.innerHTML = '';
    emptyState.style.display = 'flex';
    return;
  }

  emptyState.style.display = 'none';

  grid.innerHTML = catalogProducts.map(product => {
    const primaryImage = product.images?.find(img => img.is_primary) || product.images?.[0];
    const imageUrl = primaryImage?.thumbnail_path || primaryImage?.storage_path || product.image_url;

    const price = parseFloat(product.unit_price) || 0;
    const unit = product.unit || 'each';

    return `
      <div class="product-card" onclick="openCatalogProductDetail('${product.id}')">
        <div class="product-image">
          ${imageUrl ? `
            <img src="${imageUrl}" alt="${escapeHtml(product.name)}"
                 onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
            <div class="image-placeholder" style="display: none;">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <circle cx="8.5" cy="8.5" r="1.5"></circle>
                <polyline points="21 15 16 10 5 21"></polyline>
              </svg>
            </div>
          ` : `
            <div class="image-placeholder">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <circle cx="8.5" cy="8.5" r="1.5"></circle>
                <polyline points="21 15 16 10 5 21"></polyline>
              </svg>
            </div>
          `}
          ${product.images?.length > 1 ? `
            <span class="image-count">${product.images.length} photos</span>
          ` : ''}
        </div>
        <div class="product-content">
          <div class="product-category">${escapeHtml(product.category?.name || 'Uncategorized')}</div>
          <h4 class="product-title">${escapeHtml(product.name)}</h4>
          ${product.vendor?.name ? `
            <div class="product-vendor">${escapeHtml(product.vendor.name)}</div>
          ` : ''}
          <div class="product-price">
            <span class="price">${formatCurrency(price)}</span>
            <span class="unit">/${unit}</span>
          </div>
          ${product.room ? `
            <div class="product-room">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
              </svg>
              ${escapeHtml(product.room)}
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function updateCatalogResultCount() {
  document.getElementById('catalogResultCount').textContent =
    `${catalogProducts.length} product${catalogProducts.length !== 1 ? 's' : ''}`;
}

async function openCatalogProductDetail(productId) {
  try {
    const res = await fetch(`/api/selections/catalog/${productId}`);
    if (!res.ok) throw new Error('Failed to load product');
    currentCatalogProduct = await res.json();

    renderCatalogProductModal();

    const modal = document.getElementById('catalogProductModal');
    modal.style.display = 'flex';
    modal.classList.add('show');
  } catch (err) {
    console.error('Failed to load product:', err);
    showToast('Failed to load product details', 'error');
  }
}

function renderCatalogProductModal() {
  const p = currentCatalogProduct;
  if (!p) return;

  // Basic info
  document.getElementById('catalogProductName').textContent = p.name;
  document.getElementById('catalogProductCategory').textContent = p.category?.name || 'Uncategorized';
  document.getElementById('catalogProductPrice').textContent = formatCurrency(p.unit_price || 0);
  document.getElementById('catalogProductUnit').textContent = '/' + (p.unit || 'each');
  document.getElementById('catalogProductVendor').textContent = p.vendor?.name ? `Vendor: ${p.vendor.name}` : '';
  document.getElementById('catalogProductModel').textContent = p.model_number ? `Model: ${p.model_number}` : '';
  document.getElementById('catalogProductDescription').textContent = p.description || 'No description available';
  document.getElementById('catalogProductQty').value = p.quantity_default || 1;

  // Image
  const imageContainer = document.getElementById('catalogProductImage');
  const imageUrl = p.images?.[0]?.storage_path || p.image_url;
  if (imageUrl) {
    imageContainer.innerHTML = `<img src="${imageUrl}" alt="${escapeHtml(p.name)}" style="width: 100%; height: 100%; object-fit: cover;">`;
  } else {
    imageContainer.innerHTML = `
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color: var(--text-secondary);">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
        <circle cx="8.5" cy="8.5" r="1.5"></circle>
        <polyline points="21 15 16 10 5 21"></polyline>
      </svg>
    `;
  }

  // Populate job dropdown
  const jobSelect = document.getElementById('catalogProductJob');
  jobSelect.innerHTML = '<option value="">Select a job</option>';
  allJobs.forEach(j => {
    jobSelect.innerHTML += `<option value="${j.id}">${escapeHtml(j.name)}</option>`;
  });

  // Clear allowance dropdown
  document.getElementById('catalogProductAllowance').innerHTML = '<option value="">Select a job first</option>';
}

function closeCatalogProductModal() {
  const modal = document.getElementById('catalogProductModal');
  modal.classList.remove('show');
  modal.style.display = 'none';
}

async function loadCatalogProductAllowances() {
  const jobId = document.getElementById('catalogProductJob').value;
  const allowanceSelect = document.getElementById('catalogProductAllowance');

  allowanceSelect.innerHTML = '<option value="">Select an allowance</option>';

  if (!jobId) return;

  try {
    const res = await fetch(`/api/selections/allowances?job_id=${jobId}`);
    if (!res.ok) throw new Error('Failed to load allowances');
    const allowances = await res.json();

    allowances.forEach(a => {
      const budget = parseFloat(a.budgeted_amount) || 0;
      const selected = parseFloat(a.selected_amount) || 0;
      const remaining = budget - selected;
      const varianceText = remaining < 0 ? ` ($${Math.abs(remaining).toFixed(0)} over)` :
                          remaining > 0 ? ` ($${remaining.toFixed(0)} remaining)` : ' (at budget)';

      allowanceSelect.innerHTML += `<option value="${a.id}">${escapeHtml(a.name)}${varianceText}</option>`;
    });
  } catch (err) {
    console.error('Failed to load allowances:', err);
    showToast('Failed to load allowances', 'error');
  }
}

async function addCatalogProductToAllowance() {
  const allowanceId = document.getElementById('catalogProductAllowance').value;
  const quantity = parseFloat(document.getElementById('catalogProductQty').value) || 1;

  if (!allowanceId) {
    showToast('Please select an allowance', 'error');
    return;
  }

  if (!currentCatalogProduct) {
    showToast('No product selected', 'error');
    return;
  }

  const p = currentCatalogProduct;

  try {
    const res = await fetch('/api/selections/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        allowance_id: allowanceId,
        catalog_item_id: p.id,
        name: p.name,
        description: p.description,
        model_number: p.model_number,
        vendor_name: p.vendor?.name,
        quantity,
        unit: p.unit || 'each',
        unit_price: parseFloat(p.unit_price) || 0,
        markup_percent: 0,
        image_url: p.image_url || p.images?.[0]?.storage_path,
        client_notes: ''
      })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to save selection');
    }

    showToast('Selection added successfully', 'success');
    closeCatalogProductModal();

    // Reload allowances to show updated amounts
    await loadAllowances();
  } catch (err) {
    console.error('Failed to save selection:', err);
    showToast(err.message, 'error');
  }
}

function clearCatalogFilters() {
  document.getElementById('catalogSearchInput').value = '';
  document.getElementById('catalogVendorFilter').value = '';
  document.getElementById('catalogRoomFilter').value = '';
  currentCatalogCategory = null;
  renderCatalogCategoryTree();
  loadCatalogProducts();
}

function openAddProductModal() {
  // Redirect to catalog.html for full product management
  window.location.href = 'catalog.html';
}

function openCategoryManagement() {
  // Redirect to catalog.html for category management
  window.location.href = 'catalog.html';
}

// ============================================================
// SMART CATALOG - PRODUCT DETAIL
// ============================================================

let isEditingCatalogProduct = false;
let availableTrades = [];

function renderCatalogProductModal() {
  const p = currentCatalogProduct;
  if (!p) return;

  // Basic info
  document.getElementById('catalogProductName').textContent = p.name;
  document.getElementById('catalogProductCategory').textContent = p.category?.name || 'Uncategorized';
  document.getElementById('catalogProductPrice').textContent = formatCurrency(p.unit_price || 0);
  document.getElementById('catalogProductUnit').textContent = '/' + (p.unit || 'each');
  document.getElementById('catalogProductVendor').textContent = p.vendor?.name ? `Vendor: ${p.vendor.name}` : '';
  document.getElementById('catalogProductModel').textContent = p.model_number ? `Model: ${p.model_number}` : '';
  document.getElementById('catalogProductDescription').textContent = p.description || 'No description available';
  document.getElementById('catalogProductQty').value = p.quantity_default || 1;

  // Quality tier badge
  const tierBadge = document.getElementById('catalogProductTier');
  const tierColors = { builder: 'badge-warning', standard: 'badge-info', premium: 'badge-success' };
  const tierLabels = { builder: 'Builder', standard: 'Standard', premium: 'Premium' };
  tierBadge.className = `badge ${tierColors[p.quality_tier] || 'badge-secondary'}`;
  tierBadge.textContent = tierLabels[p.quality_tier] || 'Standard';

  // Quick stats
  document.getElementById('statLeadTime').textContent = p.lead_time_days ? `${p.lead_time_days} days` : '-';
  document.getElementById('statLabor').textContent = p.labor_hours ? `${p.labor_hours} hrs` : '-';
  document.getElementById('statWarranty').textContent = p.warranty_months ? `${p.warranty_months} mo` : '-';
  document.getElementById('statPermit').textContent = p.requires_permit ? (p.permit_type || 'Yes') : 'No';

  // Image
  const imageContainer = document.getElementById('catalogProductImage');
  const imageUrl = p.images?.[0]?.storage_path || p.image_url;
  if (imageUrl) {
    imageContainer.innerHTML = `<img src="${imageUrl}" alt="${escapeHtml(p.name)}" style="width: 100%; height: 100%; object-fit: cover;">`;
  } else {
    imageContainer.innerHTML = `
      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color: var(--text-secondary);">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
        <circle cx="8.5" cy="8.5" r="1.5"></circle>
        <polyline points="21 15 16 10 5 21"></polyline>
      </svg>
    `;
  }

  // Populate form fields for editing
  document.getElementById('editLaborHours').value = p.labor_hours || '';
  document.getElementById('editInstallDuration').value = p.install_duration_hours || '';
  document.getElementById('editCrewSize').value = p.crew_size || 1;
  document.getElementById('editLeadTime').value = p.lead_time_days || 0;
  document.getElementById('editCoverageRate').value = p.coverage_rate || '';
  document.getElementById('editCoverageUnit').value = p.coverage_unit || '';
  document.getElementById('editWasteFactor').value = p.waste_factor_percent || 0;
  document.getElementById('editQualityTier').value = p.quality_tier || 'standard';
  document.getElementById('editRequiresPermit').checked = p.requires_permit || false;
  document.getElementById('editPermitType').value = p.permit_type || '';
  document.getElementById('editRoughInRequired').checked = p.rough_in_required || false;
  document.getElementById('editRoughInNotes').value = p.rough_in_notes || '';
  document.getElementById('editWarrantyMonths').value = p.warranty_months || '';
  document.getElementById('editWarrantyNotes').value = p.warranty_notes || '';

  // Render trades, dependencies, and knowledge
  renderTradesList();
  renderDependenciesList();
  loadKnowledge();

  // Populate job dropdown
  const jobSelect = document.getElementById('catalogProductJob');
  jobSelect.innerHTML = '<option value="">Select a job</option>';
  allJobs.forEach(j => {
    jobSelect.innerHTML += `<option value="${j.id}">${escapeHtml(j.name)}</option>`;
  });

  // Clear allowance dropdown
  document.getElementById('catalogProductAllowance').innerHTML = '<option value="">Select a job first</option>';

  // Reset to overview tab and view mode
  switchCatalogProductTab('overview');
  setEditMode(false);
}

function switchCatalogProductTab(tabName) {
  // Update tab buttons
  document.querySelectorAll('#catalogProductModal .tabs .tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.tab === tabName);
  });

  // Update tab content
  document.querySelectorAll('#catalogProductModal .tab-content').forEach(content => {
    content.style.display = content.id === `tab-${tabName}` ? 'block' : 'none';
  });
}

function toggleCatalogProductEdit() {
  isEditingCatalogProduct = !isEditingCatalogProduct;
  setEditMode(isEditingCatalogProduct);
}

function setEditMode(editing) {
  isEditingCatalogProduct = editing;
  const btn = document.getElementById('btnEditCatalogProduct');
  const saveBtn = document.getElementById('btnSaveCatalogProduct');

  btn.textContent = editing ? 'Cancel Edit' : 'Edit Product';
  btn.className = editing ? 'btn btn-warning' : 'btn btn-secondary';
  saveBtn.style.display = editing ? 'inline-flex' : 'none';

  // Toggle form field disabled state
  const editFields = [
    'editLaborHours', 'editInstallDuration', 'editCrewSize', 'editLeadTime',
    'editCoverageRate', 'editCoverageUnit', 'editWasteFactor', 'editQualityTier',
    'editRequiresPermit', 'editPermitType', 'editRoughInRequired', 'editRoughInNotes',
    'editWarrantyMonths', 'editWarrantyNotes'
  ];
  editFields.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = !editing;
  });

  // Toggle trade/dependency/knowledge buttons
  document.getElementById('btnAddTrade').disabled = !editing;
  document.getElementById('btnAddDependency').disabled = !editing;
  document.getElementById('btnAddKnowledge').disabled = !editing;

  // Re-render knowledge to show/hide remove buttons
  renderKnowledge();
}

async function saveCatalogProduct() {
  if (!currentCatalogProduct) return;

  const updates = {
    labor_hours: parseFloat(document.getElementById('editLaborHours').value) || null,
    install_duration_hours: parseFloat(document.getElementById('editInstallDuration').value) || null,
    crew_size: parseInt(document.getElementById('editCrewSize').value) || 1,
    lead_time_days: parseInt(document.getElementById('editLeadTime').value) || 0,
    coverage_rate: parseFloat(document.getElementById('editCoverageRate').value) || null,
    coverage_unit: document.getElementById('editCoverageUnit').value || null,
    waste_factor_percent: parseFloat(document.getElementById('editWasteFactor').value) || 0,
    quality_tier: document.getElementById('editQualityTier').value || 'standard',
    requires_permit: document.getElementById('editRequiresPermit').checked,
    permit_type: document.getElementById('editPermitType').value || null,
    rough_in_required: document.getElementById('editRoughInRequired').checked,
    rough_in_notes: document.getElementById('editRoughInNotes').value || null,
    warranty_months: parseInt(document.getElementById('editWarrantyMonths').value) || null,
    warranty_notes: document.getElementById('editWarrantyNotes').value || null
  };

  try {
    const res = await fetch(`/api/selections/catalog/${currentCatalogProduct.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });

    if (!res.ok) throw new Error('Failed to save');

    const updated = await res.json();
    currentCatalogProduct = { ...currentCatalogProduct, ...updated };
    renderCatalogProductModal();
    showToast('Product updated', 'success');
    loadCatalogProducts();
  } catch (err) {
    console.error('Save error:', err);
    showToast('Failed to save product', 'error');
  }
}

// ============================================================
// TRADES MANAGEMENT
// ============================================================

function renderTradesList() {
  const container = document.getElementById('tradesList');
  const trades = currentCatalogProduct?.trades || [];

  if (trades.length === 0) {
    container.innerHTML = '<p style="color: var(--text-secondary); font-style: italic;">No trades linked</p>';
    return;
  }

  container.innerHTML = trades.map(t => `
    <div class="trade-item" style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: var(--bg-secondary); border-radius: 6px; margin-bottom: 0.5rem;">
      <div>
        <strong>${escapeHtml(t.trade?.name || 'Unknown')}</strong>
        ${t.is_primary ? '<span class="badge badge-success" style="margin-left: 0.5rem;">Primary</span>' : ''}
        <div style="font-size: 0.875rem; color: var(--text-secondary);">
          ${t.labor_hours_override ? `Labor: ${t.labor_hours_override} hrs` : ''}
          ${t.hourly_rate_override ? ` | Rate: $${t.hourly_rate_override}/hr` : ''}
          ${t.notes ? ` | ${t.notes}` : ''}
        </div>
      </div>
      <button class="btn btn-sm btn-danger" onclick="removeTrade('${t.id}')" ${!isEditingCatalogProduct ? 'disabled' : ''}>Remove</button>
    </div>
  `).join('');
}

async function openAddTradeModal() {
  // Load available trades
  try {
    const res = await fetch('/api/selections/trades');
    if (!res.ok) throw new Error('Failed to load trades');
    availableTrades = await res.json();

    const select = document.getElementById('addTradeSelect');
    select.innerHTML = '<option value="">Select a trade</option>';

    // Filter out already-linked trades
    const linkedIds = (currentCatalogProduct?.trades || []).map(t => t.trade_id);
    availableTrades
      .filter(t => !linkedIds.includes(t.id))
      .forEach(t => {
        select.innerHTML += `<option value="${t.id}">${escapeHtml(t.name)}</option>`;
      });

    // Reset form
    document.getElementById('addTradeIsPrimary').checked = false;
    document.getElementById('addTradeLaborHours').value = '';
    document.getElementById('addTradeHourlyRate').value = '';
    document.getElementById('addTradeNotes').value = '';

    const modal = document.getElementById('addTradeModal');
    modal.style.display = 'flex';
    modal.classList.add('show');
  } catch (err) {
    console.error('Failed to load trades:', err);
    showToast('Failed to load trades', 'error');
  }
}

function closeAddTradeModal() {
  const modal = document.getElementById('addTradeModal');
  modal.classList.remove('show');
  modal.style.display = 'none';
}

async function saveTrade() {
  const tradeId = document.getElementById('addTradeSelect').value;
  if (!tradeId) {
    showToast('Please select a trade', 'error');
    return;
  }

  const data = {
    trade_id: tradeId,
    is_primary: document.getElementById('addTradeIsPrimary').checked,
    labor_hours_override: parseFloat(document.getElementById('addTradeLaborHours').value) || null,
    hourly_rate_override: parseFloat(document.getElementById('addTradeHourlyRate').value) || null,
    notes: document.getElementById('addTradeNotes').value || null
  };

  try {
    const res = await fetch(`/api/selections/catalog/${currentCatalogProduct.id}/trades`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to add trade');
    }

    const newTrade = await res.json();
    currentCatalogProduct.trades = [...(currentCatalogProduct.trades || []), newTrade];
    renderTradesList();
    closeAddTradeModal();
    showToast('Trade linked', 'success');
  } catch (err) {
    console.error('Save trade error:', err);
    showToast(err.message, 'error');
  }
}

async function removeTrade(linkId) {
  if (!confirm('Remove this trade link?')) return;

  try {
    const res = await fetch(`/api/selections/catalog/${currentCatalogProduct.id}/trades/${linkId}`, {
      method: 'DELETE'
    });

    if (!res.ok) throw new Error('Failed to remove');

    currentCatalogProduct.trades = (currentCatalogProduct.trades || []).filter(t => t.id !== linkId);
    renderTradesList();
    showToast('Trade removed', 'success');
  } catch (err) {
    console.error('Remove trade error:', err);
    showToast('Failed to remove trade', 'error');
  }
}

// ============================================================
// DEPENDENCIES MANAGEMENT
// ============================================================

function renderDependenciesList() {
  const container = document.getElementById('dependenciesList');
  const deps = currentCatalogProduct?.dependencies || [];

  if (deps.length === 0) {
    container.innerHTML = '<p style="color: var(--text-secondary); font-style: italic;">No dependencies defined</p>';
    return;
  }

  const typeLabels = {
    must_follow: 'Must Follow',
    must_precede: 'Must Precede',
    incompatible: 'Incompatible'
  };

  const typeColors = {
    must_follow: 'badge-info',
    must_precede: 'badge-warning',
    incompatible: 'badge-danger'
  };

  container.innerHTML = deps.map(d => {
    const targetName = d.depends_on_item?.name || d.depends_on_category?.name || 'Unknown';
    const targetType = d.depends_on_item_id ? 'Item' : 'Category';

    return `
      <div class="dep-item" style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: var(--bg-secondary); border-radius: 6px; margin-bottom: 0.5rem;">
        <div>
          <span class="badge ${typeColors[d.dependency_type] || 'badge-secondary'}">${typeLabels[d.dependency_type] || d.dependency_type}</span>
          <span style="margin-left: 0.5rem;">${targetType}: <strong>${escapeHtml(targetName)}</strong></span>
          ${d.gap_days > 0 ? `<span style="color: var(--text-secondary); margin-left: 0.5rem;">(${d.gap_days} day gap)</span>` : ''}
          ${d.notes ? `<div style="font-size: 0.875rem; color: var(--text-secondary); margin-top: 0.25rem;">${escapeHtml(d.notes)}</div>` : ''}
        </div>
        <button class="btn btn-sm btn-danger" onclick="removeDependency('${d.id}')" ${!isEditingCatalogProduct ? 'disabled' : ''}>Remove</button>
      </div>
    `;
  }).join('');
}

async function openAddDependencyModal() {
  // Populate category dropdown
  const catSelect = document.getElementById('addDepCategory');
  catSelect.innerHTML = '<option value="">Select a category</option>';
  allCategories.forEach(c => {
    catSelect.innerHTML += `<option value="${c.id}">${escapeHtml(c.name)}</option>`;
    // Add children if hierarchical
    (c.children || []).forEach(child => {
      catSelect.innerHTML += `<option value="${child.id}">&nbsp;&nbsp;${escapeHtml(child.name)}</option>`;
    });
  });

  // Populate item dropdown with all catalog products
  const itemSelect = document.getElementById('addDepItem');
  itemSelect.innerHTML = '<option value="">Select an item</option>';
  catalogProducts
    .filter(p => p.id !== currentCatalogProduct?.id)
    .forEach(p => {
      itemSelect.innerHTML += `<option value="${p.id}">${escapeHtml(p.name)}</option>`;
    });

  // Reset form
  document.getElementById('addDepType').value = 'must_follow';
  document.getElementById('addDepTargetType').value = 'category';
  document.getElementById('addDepGapDays').value = 0;
  document.getElementById('addDepNotes').value = '';
  toggleDepTarget();

  const modal = document.getElementById('addDependencyModal');
  modal.style.display = 'flex';
  modal.classList.add('show');
}

function closeAddDependencyModal() {
  const modal = document.getElementById('addDependencyModal');
  modal.classList.remove('show');
  modal.style.display = 'none';
}

function toggleDepTarget() {
  const targetType = document.getElementById('addDepTargetType').value;
  document.getElementById('depCategoryGroup').style.display = targetType === 'category' ? 'block' : 'none';
  document.getElementById('depItemGroup').style.display = targetType === 'item' ? 'block' : 'none';
}

async function saveDependency() {
  const targetType = document.getElementById('addDepTargetType').value;
  const catId = document.getElementById('addDepCategory').value;
  const itemId = document.getElementById('addDepItem').value;

  if (targetType === 'category' && !catId) {
    showToast('Please select a category', 'error');
    return;
  }
  if (targetType === 'item' && !itemId) {
    showToast('Please select an item', 'error');
    return;
  }

  const data = {
    dependency_type: document.getElementById('addDepType').value,
    depends_on_category_id: targetType === 'category' ? catId : null,
    depends_on_item_id: targetType === 'item' ? itemId : null,
    gap_days: parseInt(document.getElementById('addDepGapDays').value) || 0,
    notes: document.getElementById('addDepNotes').value || null
  };

  try {
    const res = await fetch(`/api/selections/catalog/${currentCatalogProduct.id}/dependencies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to add dependency');
    }

    const newDep = await res.json();
    currentCatalogProduct.dependencies = [...(currentCatalogProduct.dependencies || []), newDep];
    renderDependenciesList();
    closeAddDependencyModal();
    showToast('Dependency added', 'success');
  } catch (err) {
    console.error('Save dependency error:', err);
    showToast(err.message, 'error');
  }
}

async function removeDependency(depId) {
  if (!confirm('Remove this dependency?')) return;

  try {
    const res = await fetch(`/api/selections/catalog/${currentCatalogProduct.id}/dependencies/${depId}`, {
      method: 'DELETE'
    });

    if (!res.ok) throw new Error('Failed to remove');

    currentCatalogProduct.dependencies = (currentCatalogProduct.dependencies || []).filter(d => d.id !== depId);
    renderDependenciesList();
    showToast('Dependency removed', 'success');
  } catch (err) {
    console.error('Remove dependency error:', err);
    showToast('Failed to remove dependency', 'error');
  }
}

// ============================================================
// KNOWLEDGE BASE MANAGEMENT
// ============================================================

let currentKnowledge = [];

async function loadKnowledge() {
  if (!currentCatalogProduct) return;

  try {
    const res = await fetch(`/api/selections/catalog/${currentCatalogProduct.id}/knowledge`);
    if (!res.ok) throw new Error('Failed to load knowledge');
    currentKnowledge = await res.json();
    renderKnowledge();
  } catch (err) {
    console.error('Failed to load knowledge:', err);
    currentKnowledge = [];
    renderKnowledge();
  }
}

function renderKnowledge() {
  const typeContainers = {
    warning: document.getElementById('knowledgeWarnings'),
    quality_check: document.getElementById('knowledgeQualityChecks'),
    pre_installation: document.getElementById('knowledgePreInstall'),
    common_defect: document.getElementById('knowledgeDefects'),
    inspection_point: document.getElementById('knowledgeInspection'),
    tip: document.getElementById('knowledgeTips')
  };

  const emptyMessages = {
    warning: 'No warnings defined',
    quality_check: 'No quality checks defined',
    pre_installation: 'No pre-installation requirements',
    common_defect: 'No common defects tracked',
    inspection_point: 'No inspection points defined',
    tip: 'No tips or notes'
  };

  // Clear all containers
  Object.keys(typeContainers).forEach(type => {
    const container = typeContainers[type];
    if (container) {
      container.innerHTML = '';
    }
  });

  // Group by type
  const grouped = {};
  currentKnowledge.forEach(k => {
    if (!grouped[k.knowledge_type]) grouped[k.knowledge_type] = [];
    grouped[k.knowledge_type].push(k);
  });

  // Render each group
  Object.keys(typeContainers).forEach(type => {
    const container = typeContainers[type];
    if (!container) return;

    const items = grouped[type] || [];
    if (items.length === 0) {
      container.innerHTML = `<p style="color: var(--text-secondary); font-style: italic;">${emptyMessages[type]}</p>`;
      return;
    }

    container.innerHTML = items.map(k => renderKnowledgeItem(k)).join('');
  });
}

function renderKnowledgeItem(k) {
  const severityColors = {
    critical: 'var(--accent-red)',
    important: 'var(--accent-orange)',
    info: 'var(--text-secondary)'
  };

  const levelBadge = k.knowledge_level === 'category'
    ? '<span class="badge badge-secondary" style="font-size: 0.7rem;">Category</span>'
    : '';

  return `
    <div class="knowledge-item" style="padding: 0.75rem; background: var(--bg-secondary); border-radius: 6px; margin-bottom: 0.5rem; border-left: 3px solid ${severityColors[k.severity] || severityColors.info};">
      <div style="display: flex; justify-content: space-between; align-items: start;">
        <div style="flex: 1;">
          <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
            <strong>${escapeHtml(k.title)}</strong>
            ${levelBadge}
          </div>
          ${k.description ? `<p style="margin: 0; font-size: 0.875rem; color: var(--text-secondary); line-height: 1.4;">${escapeHtml(k.description)}</p>` : ''}
          <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem; font-size: 0.75rem;">
            ${k.show_in_punch_list ? '<span class="badge badge-info">Punch List</span>' : ''}
            ${k.show_in_inspection ? '<span class="badge badge-warning">Inspection</span>' : ''}
            ${k.show_in_daily_log ? '<span class="badge badge-secondary">Daily Log</span>' : ''}
          </div>
        </div>
        ${isEditingCatalogProduct && k.knowledge_level === 'item' ? `
          <button class="btn btn-sm btn-danger" onclick="removeKnowledge('${k.id}')" style="margin-left: 0.5rem;">Remove</button>
        ` : ''}
      </div>
    </div>
  `;
}

function openAddKnowledgeModal() {
  // Reset form
  document.getElementById('addKnowledgeType').value = 'warning';
  document.getElementById('addKnowledgeTitle').value = '';
  document.getElementById('addKnowledgeDescription').value = '';
  document.getElementById('addKnowledgeSeverity').value = 'important';
  document.getElementById('addKnowledgeSource').value = 'staff_input';
  document.getElementById('addKnowledgePunchList').checked = false;
  document.getElementById('addKnowledgeInspection').checked = false;
  document.getElementById('addKnowledgeDailyLog').checked = false;

  const modal = document.getElementById('addKnowledgeModal');
  modal.style.display = 'flex';
  modal.classList.add('show');
}

function closeAddKnowledgeModal() {
  const modal = document.getElementById('addKnowledgeModal');
  modal.classList.remove('show');
  modal.style.display = 'none';
}

async function saveKnowledge() {
  const title = document.getElementById('addKnowledgeTitle').value.trim();
  if (!title) {
    showToast('Title is required', 'error');
    return;
  }

  const data = {
    knowledge_type: document.getElementById('addKnowledgeType').value,
    title,
    description: document.getElementById('addKnowledgeDescription').value.trim() || null,
    severity: document.getElementById('addKnowledgeSeverity').value,
    source: document.getElementById('addKnowledgeSource').value,
    show_in_punch_list: document.getElementById('addKnowledgePunchList').checked,
    show_in_inspection: document.getElementById('addKnowledgeInspection').checked,
    show_in_daily_log: document.getElementById('addKnowledgeDailyLog').checked
  };

  try {
    const res = await fetch(`/api/selections/catalog/${currentCatalogProduct.id}/knowledge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to save');
    }

    const newKnowledge = await res.json();
    currentKnowledge.push(newKnowledge);
    renderKnowledge();
    closeAddKnowledgeModal();
    showToast('Knowledge added', 'success');
  } catch (err) {
    console.error('Save knowledge error:', err);
    showToast(err.message, 'error');
  }
}

async function removeKnowledge(knowledgeId) {
  if (!confirm('Remove this knowledge item?')) return;

  try {
    const res = await fetch(`/api/selections/knowledge/${knowledgeId}`, {
      method: 'DELETE'
    });

    if (!res.ok) throw new Error('Failed to remove');

    currentKnowledge = currentKnowledge.filter(k => k.id !== knowledgeId);
    renderKnowledge();
    showToast('Knowledge removed', 'success');
  } catch (err) {
    console.error('Remove knowledge error:', err);
    showToast('Failed to remove', 'error');
  }
}

// ============================================================
// CLIENT APPROVAL FUNCTIONS
// ============================================================

/**
 * Show client approval section for a selection
 * @param {Object} selection - Selection object
 * @param {Object} allowance - Allowance object with budgeted_amount
 */
async function showClientApprovalSection(selection, allowance) {
  currentSelectionForApproval = selection;

  const section = document.getElementById('clientApprovalSection');
  if (!section) return;

  // Show the section
  section.style.display = 'block';

  // Update variance display
  const budget = parseFloat(allowance?.budgeted_amount) || 0;
  const selected = parseFloat(selection?.final_price) || 0;
  const variance = selected - budget;

  document.getElementById('approvalBudget').textContent = formatCurrency(budget);
  document.getElementById('approvalSelected').textContent = formatCurrency(selected);
  document.getElementById('approvalVariance').textContent = formatCurrency(Math.abs(variance));

  // Style variance
  const varianceRow = document.getElementById('varianceRow');
  varianceRow.classList.remove('over', 'under', 'on-budget');
  if (variance > 0) {
    varianceRow.classList.add('over');
    document.getElementById('approvalVariance').textContent = '+' + formatCurrency(variance);
  } else if (variance < 0) {
    varianceRow.classList.add('under');
    document.getElementById('approvalVariance').textContent = '-' + formatCurrency(Math.abs(variance));
  } else {
    varianceRow.classList.add('on-budget');
    document.getElementById('approvalVariance').textContent = 'On Budget';
  }

  // Check if already approved
  if (selection.client_approved_at) {
    showApprovalConfirmed(selection);
    return;
  }

  // Check post-contract status
  try {
    const res = await fetch(`/api/selections/items/${selection.id}/check-post-contract`);
    const postContractData = await res.json();

    isPostContract = postContractData.is_post_contract;
    currentOverageAmount = postContractData.overage_amount;

    // Show/hide post-contract warning
    const warning = document.getElementById('postContractWarning');
    if (postContractData.needs_change_order) {
      warning.style.display = 'flex';
    } else {
      warning.style.display = 'none';
    }
  } catch (err) {
    console.error('Error checking post-contract status:', err);
    document.getElementById('postContractWarning').style.display = 'none';
  }

  // Show approval checkbox and actions
  document.getElementById('approvalCheckboxContainer').style.display = 'block';
  document.getElementById('approvalActions').style.display = 'flex';
  document.getElementById('approvalConfirmed').style.display = 'none';

  // Reset checkbox
  document.getElementById('approvalCheckbox').checked = false;
  document.getElementById('approvalNotes').value = '';
  document.getElementById('approveBtn').disabled = true;
}

/**
 * Show approval confirmed state
 * @param {Object} selection - Approved selection object
 */
function showApprovalConfirmed(selection) {
  document.getElementById('approvalCheckboxContainer').style.display = 'none';
  document.getElementById('approvalActions').style.display = 'none';
  document.getElementById('approvalConfirmed').style.display = 'flex';

  const timestamp = new Date(selection.client_approved_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  document.getElementById('approvalTimestamp').textContent = `on ${timestamp}`;
  document.getElementById('approvalBy').textContent = selection.client_approved_by
    ? `by ${selection.client_approved_by}`
    : '';
}

/**
 * Toggle approve button based on checkbox state
 */
function toggleApprovalButton() {
  const checkbox = document.getElementById('approvalCheckbox');
  const btn = document.getElementById('approveBtn');
  btn.disabled = !checkbox.checked;
}

/**
 * Approve the current selection
 */
async function approveCurrentSelection() {
  if (!currentSelectionForApproval) return;

  const notes = document.getElementById('approvalNotes').value;
  const approvedBy = window.currentUser || 'Client';

  try {
    // If post-contract with overage, create CO first
    if (isPostContract && currentOverageAmount > 0) {
      const confirmCO = confirm(
        `This selection exceeds the allowance by ${formatCurrency(currentOverageAmount)}.\n\n` +
        `A change order will be created for this amount.\n\n` +
        `Continue with approval?`
      );
      if (!confirmCO) return;

      // Create change order
      try {
        await fetch(`/api/selections/items/${currentSelectionForApproval.id}/create-co`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            markup_percent: 0,
            description: `Allowance overage for ${currentSelectionForApproval.name}`,
            created_by: approvedBy
          })
        });
        showToast('Change order created for overage', 'success');
      } catch (coErr) {
        console.error('Error creating CO:', coErr);
        showToast('Could not create change order', 'error');
        return;
      }
    }

    // Approve the selection
    const res = await fetch(`/api/selections/items/${currentSelectionForApproval.id}/client-approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        approved_by: approvedBy,
        notes: notes || null
      })
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to approve');
    }

    const data = await res.json();

    showToast('Selection approved', 'success');
    showApprovalConfirmed(data);

    // Refresh the selections list
    await loadAllowances();

  } catch (err) {
    console.error('Approval error:', err);
    showToast(err.message || 'Failed to approve selection', 'error');
  }
}

/**
 * Update bulk selection state when checkboxes change
 */
function updateBulkSelection() {
  const checkboxes = document.querySelectorAll('.selection-checkbox:checked');
  selectedSelectionIds = Array.from(checkboxes).map(cb => cb.dataset.selectionId);

  const bar = document.getElementById('bulkApprovalBar');
  const count = document.getElementById('selectedCount');

  if (selectedSelectionIds.length > 0) {
    bar.style.display = 'flex';
    count.textContent = `${selectedSelectionIds.length} selection${selectedSelectionIds.length > 1 ? 's' : ''} selected`;
  } else {
    bar.style.display = 'none';
  }
}

/**
 * Clear all bulk selections
 */
function clearAllSelections() {
  document.querySelectorAll('.selection-checkbox:checked').forEach(cb => {
    cb.checked = false;
  });
  selectedSelectionIds = [];
  document.getElementById('bulkApprovalBar').style.display = 'none';
}

/**
 * Bulk approve selected selections
 */
async function bulkApproveSelections() {
  if (selectedSelectionIds.length === 0) return;

  const approvedBy = window.currentUser || 'Client';

  const confirmMsg = `Approve ${selectedSelectionIds.length} selection${selectedSelectionIds.length > 1 ? 's' : ''}?`;
  if (!confirm(confirmMsg)) return;

  try {
    const res = await fetch('/api/selections/items/bulk-approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        selection_ids: selectedSelectionIds,
        approved_by: approvedBy
      })
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Bulk approval failed');
    }

    const data = await res.json();

    showToast(`${data.approved_count} selection(s) approved`, 'success');
    clearAllSelections();
    await loadAllowances();

  } catch (err) {
    console.error('Bulk approval error:', err);
    showToast(err.message || 'Bulk approval failed', 'error');
  }
}

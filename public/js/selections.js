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

  // Catalog search
  let catalogTimer;
  document.getElementById('catalogSearch').addEventListener('input', (e) => {
    clearTimeout(catalogTimer);
    catalogTimer = setTimeout(() => searchCatalog(e.target.value), 200);
  });

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

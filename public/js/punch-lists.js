/**
 * Punch Lists Page JavaScript
 * Handles punch list creation, item management, photos, and status workflow.
 */

// State
let state = {
  currentJobId: null,
  punchLists: [],
  jobs: [],
  vendors: [],
  purchaseOrders: [],
  currentPunchList: null,
  filters: {
    job: '',
    status: '',
    vendor: '',
    search: ''
  }
};

// Current user (hardcoded for now)
const CURRENT_USER = 'Jake Ross';

// ============================================================
// INITIALIZATION
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
  // Set up event listeners FIRST - so UI is responsive even if data fails
  setupEventListeners();

  // Get job_id from sidebar if available
  const sidebarJobId = localStorage.getItem('selectedJobId');
  if (sidebarJobId) {
    state.currentJobId = sidebarJobId;
    state.filters.job = sidebarJobId;
  }

  // Load initial data with error handling
  try {
    await Promise.all([
      loadJobs().catch(err => console.error('Jobs load failed:', err)),
      loadVendors().catch(err => console.error('Vendors load failed:', err))
    ]);
  } catch (err) {
    console.error('Initial data load failed:', err);
    showToast('Some data failed to load. Try refreshing.', 'error');
  }

  // Load punch lists
  try {
    await loadPunchLists();
    await loadStats();
  } catch (err) {
    console.error('Punch lists load failed:', err);
  }

  // Check for query params (deep link to specific punch list)
  const urlParams = new URLSearchParams(window.location.search);
  const openId = urlParams.get('open');
  if (openId) {
    window.history.replaceState({}, '', window.location.pathname);
    setTimeout(() => openDetailModal(openId), 300);
  }
});

// Listen for job changes from sidebar
window.addEventListener('jobChanged', (e) => {
  state.currentJobId = e.detail.jobId;
  state.filters.job = e.detail.jobId || '';
  document.getElementById('jobFilter').value = state.filters.job;
  loadPunchLists();
  loadStats();
});

async function loadJobs() {
  try {
    const jobs = await window.APICache?.fetch('/api/jobs') || await fetch('/api/jobs').then(r => r.json());
    state.jobs = jobs;

    // Populate filter dropdown
    const jobFilter = document.getElementById('jobFilter');
    jobFilter.innerHTML = '<option value="">All Jobs</option>';
    jobs.forEach(job => {
      const opt = document.createElement('option');
      opt.value = job.id;
      opt.textContent = job.name;
      jobFilter.appendChild(opt);
    });

    // Populate form job select
    const formJob = document.getElementById('formJob');
    formJob.innerHTML = '<option value="">Select Job...</option>';
    jobs.forEach(job => {
      const opt = document.createElement('option');
      opt.value = job.id;
      opt.textContent = job.name;
      formJob.appendChild(opt);
    });

    // Pre-select job if set
    if (state.currentJobId) {
      jobFilter.value = state.currentJobId;
      formJob.value = state.currentJobId;
    }
  } catch (err) {
    console.error('Error loading jobs:', err);
    showToast('Failed to load jobs', 'error');
  }
}

async function loadVendors() {
  try {
    state.vendors = await window.APICache?.fetch('/api/vendors') || await fetch('/api/vendors').then(r => r.json());

    // Populate vendor filter
    const vendorFilter = document.getElementById('vendorFilter');
    vendorFilter.innerHTML = '<option value="">All Vendors</option>';
    state.vendors.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v.id;
      opt.textContent = v.name;
      vendorFilter.appendChild(opt);
    });

    // Populate form vendor select
    populateVendorSelects();
  } catch (err) {
    console.error('Error loading vendors:', err);
    state.vendors = [];
  }
}

function populateVendorSelects() {
  const selects = ['formVendor', 'itemVendor'];
  selects.forEach(selectId => {
    const el = document.getElementById(selectId);
    if (!el) return;
    el.innerHTML = '<option value="">No vendor assigned</option>';
    state.vendors.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v.id;
      opt.textContent = v.name;
      el.appendChild(opt);
    });
  });
}

async function loadPurchaseOrders(jobId) {
  if (!jobId) {
    state.purchaseOrders = [];
    return;
  }

  try {
    const res = await fetch(`/api/purchase-orders?job_id=${jobId}`);
    state.purchaseOrders = await res.json();

    const formPO = document.getElementById('formPO');
    formPO.innerHTML = '<option value="">No PO link</option>';
    state.purchaseOrders.forEach(po => {
      const opt = document.createElement('option');
      opt.value = po.id;
      opt.textContent = `${po.po_number} - ${formatMoney(po.total_amount)}`;
      formPO.appendChild(opt);
    });
  } catch (err) {
    console.error('Error loading POs:', err);
    state.purchaseOrders = [];
  }
}

function setupEventListeners() {
  // Job filter
  document.getElementById('jobFilter').addEventListener('change', (e) => {
    state.filters.job = e.target.value;
    loadPunchLists();
    loadStats();
  });

  // Status filter
  document.getElementById('statusFilter').addEventListener('change', (e) => {
    state.filters.status = e.target.value;
    loadPunchLists();
  });

  // Vendor filter
  document.getElementById('vendorFilter').addEventListener('change', (e) => {
    state.filters.vendor = e.target.value;
    loadPunchLists();
  });

  // Search with debounce
  let searchTimeout;
  const searchInput = document.getElementById('searchInput');
  const searchClear = document.getElementById('searchClear');

  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchClear.style.display = e.target.value ? 'block' : 'none';
    searchTimeout = setTimeout(() => {
      state.filters.search = e.target.value;
      renderPunchLists();
    }, 150);
  });

  // Form job change - load POs
  document.getElementById('formJob').addEventListener('change', (e) => {
    loadPurchaseOrders(e.target.value);
  });
}

function clearSearch() {
  document.getElementById('searchInput').value = '';
  document.getElementById('searchClear').style.display = 'none';
  state.filters.search = '';
  renderPunchLists();
}

// ============================================================
// DATA LOADING
// ============================================================

const SKELETON_LOADING = `
  <div class="skeleton-card"><div class="skeleton-line long"></div><div class="skeleton-line medium"></div><div class="skeleton-line short"></div></div>
  <div class="skeleton-card"><div class="skeleton-line long"></div><div class="skeleton-line medium"></div><div class="skeleton-line short"></div></div>
  <div class="skeleton-card"><div class="skeleton-line long"></div><div class="skeleton-line medium"></div><div class="skeleton-line short"></div></div>
`;

async function loadPunchLists() {
  const grid = document.getElementById('punchListGrid');
  grid.innerHTML = SKELETON_LOADING;

  try {
    const params = new URLSearchParams();
    if (state.filters.job) params.append('job_id', state.filters.job);
    if (state.filters.status) params.append('status', state.filters.status);
    if (state.filters.vendor) params.append('vendor_id', state.filters.vendor);

    const res = await fetch(`/api/punch-lists?${params}`);
    if (!res.ok) throw new Error('Failed to load punch lists');

    state.punchLists = await res.json();
    renderPunchLists();
  } catch (err) {
    console.error('Error loading punch lists:', err);
    grid.innerHTML = '<div class="empty-state">Failed to load punch lists. <a href="#" onclick="loadPunchLists()">Retry</a></div>';
    showToast('Failed to load punch lists', 'error');
  }
}

async function loadStats() {
  try {
    const params = state.filters.job ? `?job_id=${state.filters.job}` : '';
    const res = await fetch(`/api/punch-lists/stats${params}`);
    const stats = await res.json();

    document.getElementById('statTotal').textContent = stats.total_lists || 0;
    document.getElementById('statOpen').textContent = stats.by_status?.open || 0;
    document.getElementById('statInProgress').textContent = stats.by_status?.in_progress || 0;
    document.getElementById('statResolved').textContent = stats.by_status?.resolved || 0;
    document.getElementById('statClosed').textContent = stats.by_status?.closed || 0;
  } catch (err) {
    console.error('Error loading stats:', err);
  }
}

function renderPunchLists() {
  const grid = document.getElementById('punchListGrid');
  let filtered = state.punchLists;

  // Client-side search filter
  if (state.filters.search) {
    const search = state.filters.search.toLowerCase();
    filtered = filtered.filter(pl =>
      pl.title?.toLowerCase().includes(search) ||
      pl.description?.toLowerCase().includes(search) ||
      pl.job?.name?.toLowerCase().includes(search) ||
      pl.vendor?.name?.toLowerCase().includes(search)
    );
  }

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📋</div>
        <p>No punch lists found</p>
        <button class="btn btn-primary" onclick="openCreateModal()">Create First Punch List</button>
      </div>
    `;
    return;
  }

  grid.innerHTML = filtered.map(pl => renderPunchListCard(pl)).join('');
}

function renderPunchListCard(pl) {
  const statusClass = getStatusClass(pl.status);
  const statusLabel = formatStatus(pl.status);
  const itemsTotal = pl.item_count || 0;
  const itemsVerified = pl.verified_items || 0;
  const progress = itemsTotal > 0 ? Math.round((itemsVerified / itemsTotal) * 100) : 0;

  const dueInfo = pl.due_date ? `<span class="due-date">Due: ${formatDate(pl.due_date)}</span>` : '';
  const poInfo = pl.po ? `<span class="po-link">PO: ${pl.po.po_number}</span>` : '';

  return `
    <div class="inspection-card" onclick="openDetailModal('${pl.id}')">
      <div class="inspection-card-header">
        <div class="inspection-type">${escapeHtml(pl.title)}</div>
        <span class="status-badge ${statusClass}">${statusLabel}</span>
      </div>
      <div class="inspection-card-body">
        <div class="inspection-meta">
          <span class="job-name">${escapeHtml(pl.job?.name || 'Unknown Job')}</span>
          ${pl.vendor ? `<span class="vendor-name">${escapeHtml(pl.vendor.name)}</span>` : ''}
        </div>
        <div class="inspection-details">
          ${dueInfo}
          ${poInfo}
        </div>
        <div class="item-progress">
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${progress}%"></div>
          </div>
          <span class="progress-text">${itemsVerified}/${itemsTotal} items verified</span>
        </div>
      </div>
      <div class="inspection-card-footer">
        <span class="created-date">Created ${formatDate(pl.created_at)}</span>
        <span class="item-counts">
          ${pl.open_items > 0 ? `<span class="count-open">${pl.open_items} open</span>` : ''}
          ${pl.resolved_items > 0 ? `<span class="count-resolved">${pl.resolved_items} pending</span>` : ''}
        </span>
      </div>
    </div>
  `;
}

// ============================================================
// CREATE PUNCH LIST
// ============================================================

function openCreateModal() {
  document.getElementById('createModalTitle').textContent = 'New Punch List';
  document.getElementById('editingId').value = '';
  document.getElementById('createForm').reset();

  // Pre-select job if set
  if (state.currentJobId) {
    document.getElementById('formJob').value = state.currentJobId;
    loadPurchaseOrders(state.currentJobId);
  }

  document.getElementById('createModal').style.display = 'flex';
  document.getElementById('createModal').classList.add('show');
}

function closeCreateModal() {
  document.getElementById('createModal').classList.remove('show');
  document.getElementById('createModal').style.display = 'none';
}

async function savePunchList() {
  const form = document.getElementById('createForm');
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const data = {
    job_id: document.getElementById('formJob').value,
    title: document.getElementById('formTitle').value,
    description: document.getElementById('formDescription').value || null,
    po_id: document.getElementById('formPO').value || null,
    assigned_vendor_id: document.getElementById('formVendor').value || null,
    due_date: document.getElementById('formDueDate').value || null,
    created_by: CURRENT_USER
  };

  const editingId = document.getElementById('editingId').value;

  try {
    let res;
    if (editingId) {
      data.updated_by = CURRENT_USER;
      res = await fetch(`/api/punch-lists/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
    } else {
      res = await fetch('/api/punch-lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
    }

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Failed to save');
    }

    const saved = await res.json();
    closeCreateModal();
    showToast(editingId ? 'Punch list updated' : 'Punch list created', 'success');
    loadPunchLists();
    loadStats();

    // If new, open the detail modal to add items
    if (!editingId) {
      setTimeout(() => openDetailModal(saved.id), 300);
    }
  } catch (err) {
    console.error('Error saving punch list:', err);
    showToast(err.message || 'Failed to save punch list', 'error');
  }
}

// ============================================================
// DETAIL MODAL
// ============================================================

async function openDetailModal(id) {
  const modal = document.getElementById('detailModal');
  const body = document.getElementById('detailBody');

  body.innerHTML = '<div class="loading">Loading...</div>';
  modal.style.display = 'flex';
  modal.classList.add('show');

  try {
    const res = await fetch(`/api/punch-lists/${id}`);
    if (!res.ok) throw new Error('Failed to load punch list');

    state.currentPunchList = await res.json();
    renderDetailModal();
  } catch (err) {
    console.error('Error loading punch list:', err);
    body.innerHTML = '<div class="error">Failed to load punch list</div>';
    showToast('Failed to load punch list', 'error');
  }
}

function closeDetailModal() {
  document.getElementById('detailModal').classList.remove('show');
  document.getElementById('detailModal').style.display = 'none';
  state.currentPunchList = null;
}

function renderDetailModal() {
  const pl = state.currentPunchList;
  if (!pl) return;

  // Title and status
  document.getElementById('detailTitle').textContent = pl.title;
  const statusBadge = document.getElementById('detailStatus');
  statusBadge.className = `status-badge ${getStatusClass(pl.status)}`;
  statusBadge.textContent = formatStatus(pl.status);

  const items = pl.items || [];
  const photos = pl.attachments || [];

  // Group photos by item
  const photosByItem = {};
  const listPhotos = [];
  photos.forEach(photo => {
    if (photo.item_id) {
      if (!photosByItem[photo.item_id]) photosByItem[photo.item_id] = [];
      photosByItem[photo.item_id].push(photo);
    } else {
      listPhotos.push(photo);
    }
  });

  const body = document.getElementById('detailBody');
  body.innerHTML = `
    <div class="punch-detail-layout">
      <div class="punch-detail-sidebar">
        <div class="detail-section">
          <h3>Details</h3>
          <div class="detail-row"><span class="label">Job:</span><span class="value">${escapeHtml(pl.job?.name || 'Unknown')}</span></div>
          ${pl.po ? `<div class="detail-row"><span class="label">PO:</span><span class="value">${escapeHtml(pl.po.po_number)}</span></div>` : ''}
          ${pl.vendor ? `<div class="detail-row"><span class="label">Vendor:</span><span class="value">${escapeHtml(pl.vendor.name)}</span></div>` : ''}
          ${pl.due_date ? `<div class="detail-row"><span class="label">Due:</span><span class="value">${formatDate(pl.due_date)}</span></div>` : ''}
          <div class="detail-row"><span class="label">Created:</span><span class="value">${formatDate(pl.created_at)} by ${escapeHtml(pl.created_by)}</span></div>
        </div>

        ${pl.description ? `
        <div class="detail-section">
          <h3>Description</h3>
          <p class="description-text">${escapeHtml(pl.description)}</p>
        </div>
        ` : ''}

        <div class="detail-section">
          <h3>Progress</h3>
          <div class="progress-stats">
            <div class="stat"><span class="stat-num">${items.length}</span><span class="stat-label">Total Items</span></div>
            <div class="stat"><span class="stat-num">${items.filter(i => i.status === 'open').length}</span><span class="stat-label">Open</span></div>
            <div class="stat"><span class="stat-num">${items.filter(i => i.status === 'resolved').length}</span><span class="stat-label">Resolved</span></div>
            <div class="stat"><span class="stat-num">${items.filter(i => i.status === 'verified').length}</span><span class="stat-label">Verified</span></div>
          </div>
        </div>
      </div>

      <div class="punch-detail-main">
        <div class="items-header">
          <h3>Items (${items.length})</h3>
          <button class="btn btn-primary btn-sm" onclick="openAddItemModal()">+ Add Item</button>
        </div>

        <div class="items-list">
          ${items.length === 0 ? `
            <div class="empty-items">
              <p>No items yet. Add items to track deficiencies.</p>
            </div>
          ` : items.map(item => renderItemRow(item, photosByItem[item.id] || [])).join('')}
        </div>

        ${listPhotos.length > 0 ? `
        <div class="list-photos">
          <h3>General Photos (${listPhotos.length})</h3>
          <div class="photo-grid">
            ${listPhotos.map(p => renderPhotoThumb(p)).join('')}
          </div>
        </div>
        ` : ''}
      </div>
    </div>
  `;

  // Footer with actions
  const footer = document.getElementById('detailFooter');
  const canClose = items.length > 0 && items.every(i => i.status === 'verified');

  footer.innerHTML = `
    <div class="modal-footer-left">
      <button class="btn btn-secondary" onclick="editPunchList()">Edit</button>
      <button class="btn btn-secondary" onclick="openPhotoModal()">Upload Photo</button>
    </div>
    <div class="modal-footer-right">
      ${pl.status !== 'closed' ? `
        <button class="btn btn-danger" onclick="deletePunchList()">Delete</button>
        ${canClose ? `<button class="btn btn-success" onclick="closePunchList()">Close List</button>` : ''}
      ` : ''}
      <button class="btn btn-secondary" onclick="closeDetailModal()">Close</button>
    </div>
  `;
}

function renderItemRow(item, photos) {
  const statusClass = getItemStatusClass(item.status);
  const priorityClass = item.priority === 'critical' ? 'priority-critical' : item.priority === 'high' ? 'priority-high' : '';
  const categoryLabel = item.category ? `<span class="item-category">${item.category}</span>` : '';

  const actions = getItemActions(item);

  return `
    <div class="punch-item ${statusClass} ${priorityClass}">
      <div class="item-header">
        <span class="item-number">#${item.item_number || '-'}</span>
        <span class="item-status-badge ${statusClass}">${formatItemStatus(item.status)}</span>
        ${item.priority !== 'normal' ? `<span class="priority-badge ${item.priority}">${item.priority}</span>` : ''}
      </div>
      <div class="item-body">
        <p class="item-description">${escapeHtml(item.description)}</p>
        <div class="item-meta">
          ${item.location ? `<span class="location">${escapeHtml(item.location)}</span>` : ''}
          ${categoryLabel}
          ${item.vendor ? `<span class="vendor">${escapeHtml(item.vendor.name)}</span>` : ''}
        </div>
        ${item.resolution_notes ? `<div class="resolution-notes"><strong>Resolution:</strong> ${escapeHtml(item.resolution_notes)}</div>` : ''}
        ${item.verified_at ? `<div class="verified-info">Verified by ${escapeHtml(item.verified_by)} on ${formatDate(item.verified_at)}</div>` : ''}
      </div>
      ${photos.length > 0 ? `
      <div class="item-photos">
        ${photos.map(p => renderPhotoThumb(p)).join('')}
      </div>
      ` : ''}
      <div class="item-actions">
        <button class="btn btn-sm" onclick="openPhotoModal('${item.id}')">Photo</button>
        ${actions}
      </div>
    </div>
  `;
}

function getItemActions(item) {
  switch (item.status) {
    case 'open':
      return `
        <button class="btn btn-sm btn-secondary" onclick="startItem('${item.id}')">Start Work</button>
        <button class="btn btn-sm btn-success" onclick="openResolveModal('${item.id}')">Mark Resolved</button>
      `;
    case 'in_progress':
      return `
        <button class="btn btn-sm btn-success" onclick="openResolveModal('${item.id}')">Mark Resolved</button>
      `;
    case 'resolved':
      return `
        <button class="btn btn-sm btn-danger" onclick="rejectItem('${item.id}')">Reject</button>
        <button class="btn btn-sm btn-success" onclick="verifyItem('${item.id}')">Verify</button>
      `;
    case 'verified':
      return `<span class="verified-check">Verified</span>`;
    default:
      return '';
  }
}

function renderPhotoThumb(photo) {
  const categoryIcon = photo.category === 'before' ? 'B' : photo.category === 'after' ? 'A' : 'P';
  return `
    <div class="photo-thumb" onclick="viewPhoto('${photo.id}', '${escapeHtml(photo.file_url)}')">
      <img src="${photo.file_url}" alt="${escapeHtml(photo.caption || photo.file_name)}" loading="lazy">
      <span class="photo-category-badge">${categoryIcon}</span>
    </div>
  `;
}

// ============================================================
// ITEM MANAGEMENT
// ============================================================

function openAddItemModal(itemId = null) {
  document.getElementById('addItemTitle').textContent = itemId ? 'Edit Item' : 'Add Item';
  document.getElementById('itemPunchListId').value = state.currentPunchList?.id || '';
  document.getElementById('editingItemId').value = itemId || '';
  document.getElementById('addItemForm').reset();

  populateVendorSelects();

  // Pre-select vendor if punch list has one
  if (!itemId && state.currentPunchList?.assigned_vendor_id) {
    document.getElementById('itemVendor').value = state.currentPunchList.assigned_vendor_id;
  }

  document.getElementById('addItemModal').style.display = 'flex';
  document.getElementById('addItemModal').classList.add('show');
}

function closeAddItemModal() {
  document.getElementById('addItemModal').classList.remove('show');
  document.getElementById('addItemModal').style.display = 'none';
}

async function saveItem() {
  const form = document.getElementById('addItemForm');
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const punchListId = document.getElementById('itemPunchListId').value;
  const editingItemId = document.getElementById('editingItemId').value;

  const data = {
    description: document.getElementById('itemDescription').value,
    location: document.getElementById('itemLocation').value || null,
    category: document.getElementById('itemCategory').value || null,
    priority: document.getElementById('itemPriority').value,
    assigned_vendor_id: document.getElementById('itemVendor').value || null,
    created_by: CURRENT_USER
  };

  try {
    let res;
    if (editingItemId) {
      data.updated_by = CURRENT_USER;
      res = await fetch(`/api/punch-lists/items/${editingItemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
    } else {
      res = await fetch(`/api/punch-lists/${punchListId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
    }

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Failed to save item');
    }

    closeAddItemModal();
    showToast(editingItemId ? 'Item updated' : 'Item added', 'success');

    // Refresh the punch list detail
    await openDetailModal(punchListId);
    loadStats();
  } catch (err) {
    console.error('Error saving item:', err);
    showToast(err.message || 'Failed to save item', 'error');
  }
}

async function startItem(itemId) {
  try {
    const res = await fetch(`/api/punch-lists/items/${itemId}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ started_by: CURRENT_USER })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Failed to start item');
    }

    showToast('Item marked as in progress', 'success');
    await openDetailModal(state.currentPunchList.id);
  } catch (err) {
    console.error('Error starting item:', err);
    showToast(err.message || 'Failed to start item', 'error');
  }
}

function openResolveModal(itemId) {
  document.getElementById('resolveItemId').value = itemId;
  document.getElementById('resolutionNotes').value = '';

  document.getElementById('resolveModal').style.display = 'flex';
  document.getElementById('resolveModal').classList.add('show');
}

function closeResolveModal() {
  document.getElementById('resolveModal').classList.remove('show');
  document.getElementById('resolveModal').style.display = 'none';
}

async function confirmResolve() {
  const itemId = document.getElementById('resolveItemId').value;
  const notes = document.getElementById('resolutionNotes').value;

  try {
    const res = await fetch(`/api/punch-lists/items/${itemId}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        resolved_by: CURRENT_USER,
        resolution_notes: notes || null
      })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Failed to resolve item');
    }

    closeResolveModal();
    showToast('Item marked as resolved', 'success');
    await openDetailModal(state.currentPunchList.id);
    loadStats();
  } catch (err) {
    console.error('Error resolving item:', err);
    showToast(err.message || 'Failed to resolve item', 'error');
  }
}

async function verifyItem(itemId) {
  if (!confirm('Verify this item as complete? This confirms the fix is acceptable.')) return;

  try {
    const res = await fetch(`/api/punch-lists/items/${itemId}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ verified_by: CURRENT_USER })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Failed to verify item');
    }

    const result = await res.json();
    showToast('Item verified', 'success');

    if (result.all_verified) {
      showToast('All items verified! Punch list can now be closed.', 'success');
    }

    await openDetailModal(state.currentPunchList.id);
    loadStats();
    loadPunchLists();
  } catch (err) {
    console.error('Error verifying item:', err);
    showToast(err.message || 'Failed to verify item', 'error');
  }
}

async function rejectItem(itemId) {
  const reason = prompt('Reason for rejection (optional):');
  if (reason === null) return; // Cancelled

  try {
    const res = await fetch(`/api/punch-lists/items/${itemId}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rejected_by: CURRENT_USER,
        reason: reason || null
      })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Failed to reject item');
    }

    showToast('Item rejected - returned to open status', 'warning');
    await openDetailModal(state.currentPunchList.id);
    loadStats();
  } catch (err) {
    console.error('Error rejecting item:', err);
    showToast(err.message || 'Failed to reject item', 'error');
  }
}

// ============================================================
// PHOTO MANAGEMENT
// ============================================================

function openPhotoModal(itemId = null) {
  document.getElementById('photoPunchListId').value = state.currentPunchList?.id || '';
  document.getElementById('photoItemId').value = itemId || '';
  document.getElementById('photoForm').reset();

  document.getElementById('photoModal').style.display = 'flex';
  document.getElementById('photoModal').classList.add('show');
}

function closePhotoModal() {
  document.getElementById('photoModal').classList.remove('show');
  document.getElementById('photoModal').style.display = 'none';
}

async function uploadPhoto() {
  const fileInput = document.getElementById('photoFile');
  if (!fileInput.files.length) {
    showToast('Please select a file', 'error');
    return;
  }

  const punchListId = document.getElementById('photoPunchListId').value;
  const itemId = document.getElementById('photoItemId').value;
  const category = document.getElementById('photoCategory').value;
  const caption = document.getElementById('photoCaption').value;

  const formData = new FormData();
  formData.append('file', fileInput.files[0]);
  formData.append('category', category);
  formData.append('caption', caption);
  formData.append('uploaded_by', CURRENT_USER);
  if (itemId) formData.append('item_id', itemId);

  try {
    const res = await fetch(`/api/punch-lists/${punchListId}/photos`, {
      method: 'POST',
      body: formData
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Failed to upload photo');
    }

    closePhotoModal();
    showToast('Photo uploaded', 'success');
    await openDetailModal(punchListId);
  } catch (err) {
    console.error('Error uploading photo:', err);
    showToast(err.message || 'Failed to upload photo', 'error');
  }
}

function viewPhoto(photoId, url) {
  // Simple lightbox
  const lightbox = document.createElement('div');
  lightbox.className = 'photo-lightbox';
  lightbox.innerHTML = `
    <div class="lightbox-content">
      <img src="${url}" alt="Photo">
      <button class="lightbox-close" onclick="this.parentElement.parentElement.remove()">&times;</button>
    </div>
  `;
  lightbox.onclick = (e) => {
    if (e.target === lightbox) lightbox.remove();
  };
  document.body.appendChild(lightbox);
}

// ============================================================
// PUNCH LIST ACTIONS
// ============================================================

function editPunchList() {
  const pl = state.currentPunchList;
  if (!pl) return;

  closeDetailModal();

  document.getElementById('createModalTitle').textContent = 'Edit Punch List';
  document.getElementById('editingId').value = pl.id;
  document.getElementById('formJob').value = pl.job_id || '';
  document.getElementById('formTitle').value = pl.title || '';
  document.getElementById('formDescription').value = pl.description || '';
  document.getElementById('formVendor').value = pl.assigned_vendor_id || '';
  document.getElementById('formDueDate').value = pl.due_date || '';

  loadPurchaseOrders(pl.job_id).then(() => {
    document.getElementById('formPO').value = pl.po_id || '';
  });

  document.getElementById('createModal').style.display = 'flex';
  document.getElementById('createModal').classList.add('show');
}

async function deletePunchList() {
  if (!confirm('Are you sure you want to delete this punch list? This cannot be undone.')) return;

  const pl = state.currentPunchList;
  if (!pl) return;

  try {
    const res = await fetch(`/api/punch-lists/${pl.id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deleted_by: CURRENT_USER })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Failed to delete');
    }

    closeDetailModal();
    showToast('Punch list deleted', 'success');
    loadPunchLists();
    loadStats();
  } catch (err) {
    console.error('Error deleting punch list:', err);
    showToast(err.message || 'Failed to delete punch list', 'error');
  }
}

async function closePunchList() {
  if (!confirm('Close this punch list? All items must be verified first.')) return;

  const pl = state.currentPunchList;
  if (!pl) return;

  try {
    const res = await fetch(`/api/punch-lists/${pl.id}/close`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ closed_by: CURRENT_USER })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Failed to close');
    }

    showToast('Punch list closed', 'success');
    await openDetailModal(pl.id);
    loadPunchLists();
    loadStats();
  } catch (err) {
    console.error('Error closing punch list:', err);
    showToast(err.message || 'Failed to close punch list', 'error');
  }
}

// ============================================================
// HELPERS
// ============================================================

function formatMoney(amount) {
  const num = parseFloat(amount) || 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2
  }).format(num);
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatStatus(status) {
  const labels = {
    'open': 'Open',
    'in_progress': 'In Progress',
    'resolved': 'Resolved',
    'closed': 'Closed'
  };
  return labels[status] || status;
}

function getStatusClass(status) {
  const classes = {
    'open': 'status-open',
    'in_progress': 'status-in-progress',
    'resolved': 'status-resolved',
    'closed': 'status-closed'
  };
  return classes[status] || '';
}

function formatItemStatus(status) {
  const labels = {
    'open': 'Open',
    'in_progress': 'In Progress',
    'resolved': 'Pending Verify',
    'verified': 'Verified'
  };
  return labels[status] || status;
}

function getItemStatusClass(status) {
  const classes = {
    'open': 'item-open',
    'in_progress': 'item-in-progress',
    'resolved': 'item-resolved',
    'verified': 'item-verified'
  };
  return classes[status] || '';
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showToast(message, type = 'info') {
  if (window.toasts) {
    window.toasts[type]?.(message) || window.toasts.show?.(message, type);
  } else {
    console.log(`[${type}] ${message}`);
  }
}

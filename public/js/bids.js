/**
 * Bids Management
 * Handles bid listing, creation, comparison, and conversion to PO
 */

let bids = [];
let jobs = [];
let vendors = [];
let costCodes = [];
let selectedBids = new Set();
let currentBid = null;
let currentBidLines = [];
let debounceTimer;
let currentView = localStorage.getItem('bidsView') || 'table';

// ============================================================
// INITIALIZATION
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
  setupEventListeners();
  setupDragAndDrop();
  initializeView();

  try {
    await Promise.all([
      loadJobs().catch(err => console.error('Jobs failed:', err)),
      loadVendors().catch(err => console.error('Vendors failed:', err)),
      loadCostCodes().catch(err => console.error('Cost codes failed:', err))
    ]);
  } catch (err) {
    showToast('Some data failed to load', 'error');
  }

  await loadBids();
  await loadStats();
});

function initializeView() {
  // Set initial view from localStorage
  const tableView = document.getElementById('bidTableView');
  const cardView = document.getElementById('bidCardView');

  if (tableView) tableView.style.display = currentView === 'table' ? 'block' : 'none';
  if (cardView) cardView.style.display = currentView === 'cards' ? 'grid' : 'none';

  // Set active button
  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === currentView);
  });
}

function setupEventListeners() {
  // Filter change handlers
  document.getElementById('jobFilter').addEventListener('change', applyFilters);
  document.getElementById('vendorFilter').addEventListener('change', applyFilters);
  document.getElementById('statusFilter').addEventListener('change', applyFilters);

  // Search with debounce
  document.getElementById('searchInput').addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    const clearBtn = document.getElementById('searchClear');
    clearBtn.style.display = e.target.value ? 'block' : 'none';
    debounceTimer = setTimeout(() => applyFilters(), 150);
  });

  // Close modals on escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeBidLineModal();
      closeModal();
      closeDetailModal();
      closeCompareModal();
    }
  });

  // Close modals on backdrop click
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal();
        closeDetailModal();
        closeCompareModal();
      }
    });
  });
}

function setupDragAndDrop() {
  const uploadArea = document.getElementById('uploadArea');
  if (!uploadArea) return;

  uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
  });

  uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('dragover');
  });

  uploadArea.addEventListener('drop', async (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    if (currentBid) {
      const files = e.dataTransfer.files;
      for (const file of files) {
        await uploadDocument(file);
      }
    }
  });
}

// ============================================================
// DATA LOADING
// ============================================================

async function loadJobs() {
  const response = await fetch('/api/jobs');
  jobs = await response.json();
  populateJobDropdowns();
}

async function loadVendors() {
  const response = await fetch('/api/vendors');
  vendors = await response.json();
  populateVendorDropdowns();
}

async function loadCostCodes() {
  const response = await fetch('/api/cost-codes');
  costCodes = await response.json();
  populateCostCodeDropdowns();
}

function populateCostCodeDropdowns() {
  const select = document.getElementById('bidLineCostCode');
  if (!select) return;

  const currentValue = select.value;
  select.innerHTML = '<option value="">Select Cost Code...</option>';

  costCodes.forEach(cc => {
    const option = document.createElement('option');
    option.value = cc.id;
    option.textContent = `${cc.code} - ${cc.name}`;
    select.appendChild(option);
  });

  if (currentValue) select.value = currentValue;
}

function populateJobDropdowns() {
  const selectors = ['jobFilter', 'formJob'];
  selectors.forEach(id => {
    const select = document.getElementById(id);
    if (!select) return;

    const currentValue = select.value;
    const isFilter = id === 'jobFilter';

    select.innerHTML = `<option value="">${isFilter ? 'All Jobs' : 'Select Job...'}</option>`;
    jobs.forEach(job => {
      const option = document.createElement('option');
      option.value = job.id;
      option.textContent = job.name;
      select.appendChild(option);
    });

    if (currentValue) select.value = currentValue;
  });
}

function populateVendorDropdowns() {
  const selectors = ['vendorFilter', 'formVendor'];
  selectors.forEach(id => {
    const select = document.getElementById(id);
    if (!select) return;

    const currentValue = select.value;
    const isFilter = id === 'vendorFilter';

    select.innerHTML = `<option value="">${isFilter ? 'All Vendors' : 'Select Vendor...'}</option>`;
    vendors.forEach(vendor => {
      const option = document.createElement('option');
      option.value = vendor.id;
      option.textContent = vendor.name;
      select.appendChild(option);
    });

    if (currentValue) select.value = currentValue;
  });
}

async function loadBids() {
  const params = new URLSearchParams();
  const jobId = document.getElementById('jobFilter').value;
  const vendorId = document.getElementById('vendorFilter').value;
  const status = document.getElementById('statusFilter').value;
  const search = document.getElementById('searchInput').value;

  if (jobId) params.append('job_id', jobId);
  if (vendorId) params.append('vendor_id', vendorId);
  if (status) params.append('status', status);
  if (search) params.append('search', search);

  try {
    const response = await fetch(`/api/bids?${params}`);
    bids = await response.json();
    renderBidList();
  } catch (err) {
    console.error('Error loading bids:', err);
    showToast('Failed to load bids', 'error');
  }
}

async function loadStats() {
  const jobId = document.getElementById('jobFilter').value;
  const params = jobId ? `?job_id=${jobId}` : '';

  try {
    const response = await fetch(`/api/bids/stats${params}`);
    const stats = await response.json();
    renderStats(stats);
  } catch (err) {
    console.error('Error loading stats:', err);
  }
}

function applyFilters() {
  loadBids();
  loadStats();
}

function clearSearch() {
  document.getElementById('searchInput').value = '';
  document.getElementById('searchClear').style.display = 'none';
  applyFilters();
}

// ============================================================
// RENDERING
// ============================================================

function setView(view) {
  currentView = view;
  localStorage.setItem('bidsView', view);

  // Update view toggle buttons
  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });

  // Show/hide containers
  const tableView = document.getElementById('bidTableView');
  const cardView = document.getElementById('bidCardView');

  if (tableView) tableView.style.display = view === 'table' ? 'block' : 'none';
  if (cardView) cardView.style.display = view === 'cards' ? 'grid' : 'none';

  renderBidList();
}

function toggleSelectAll(checkbox) {
  if (checkbox.checked) {
    bids.forEach(bid => selectedBids.add(bid.id));
  } else {
    selectedBids.clear();
  }
  renderBidList();
  updateCompareButton();
}

function updateCompareButton() {
  const compareBtn = document.getElementById('compareBtn');
  if (compareBtn) {
    compareBtn.disabled = selectedBids.size < 2;
  }
}

function renderBidList() {
  if (currentView === 'table') {
    renderBidTable();
  } else {
    renderBidCards();
  }
  updateCompareButton();

  // Update select all checkbox state
  const selectAllCheckbox = document.getElementById('selectAllBids');
  if (selectAllCheckbox) {
    selectAllCheckbox.checked = bids.length > 0 && selectedBids.size === bids.length;
    selectAllCheckbox.indeterminate = selectedBids.size > 0 && selectedBids.size < bids.length;
  }
}

function renderBidTable() {
  const tbody = document.getElementById('bidTableBody');
  if (!tbody) return;

  if (!bids.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 3rem;">
          <div class="empty-state-inline">
            <div style="font-size: 2rem; margin-bottom: 0.5rem;">📋</div>
            <strong>No Bids Found</strong>
            <p style="color: var(--muted-foreground); margin: 0.5rem 0;">Create your first bid to start tracking vendor proposals.</p>
            <button class="btn btn-primary btn-sm" onclick="openCreateModal()">+ New Bid</button>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = bids.map(bid => `
    <tr class="${selectedBids.has(bid.id) ? 'selected' : ''}" onclick="openBidDetail('${bid.id}')">
      <td class="col-select" onclick="event.stopPropagation()">
        <input type="checkbox"
               ${selectedBids.has(bid.id) ? 'checked' : ''}
               onchange="toggleBidSelection('${bid.id}')">
      </td>
      <td class="col-title">
        <div class="cell-title">${escapeHtml(bid.title)}</div>
        ${bid.description ? `<div class="cell-subtitle">${escapeHtml(bid.description.substring(0, 60))}${bid.description.length > 60 ? '...' : ''}</div>` : ''}
      </td>
      <td class="col-job">${escapeHtml(bid.job?.name || '—')}</td>
      <td class="col-vendor">${escapeHtml(bid.vendor?.name || '—')}</td>
      <td class="col-status">
        <span class="badge badge-${getStatusClass(bid.status)}">${formatStatus(bid.status)}</span>
      </td>
      <td class="col-amount">${formatCurrency(bid.bid_amount)}</td>
      <td class="col-date">${formatDate(bid.received_date)}</td>
      <td class="col-actions" onclick="event.stopPropagation()">
        <button class="btn btn-ghost btn-sm" onclick="openEditModal('${bid.id}')" title="Edit">✏️</button>
        <button class="btn btn-ghost btn-sm" onclick="deleteBid('${bid.id}')" title="Delete">🗑️</button>
      </td>
    </tr>
  `).join('');
}

function renderBidCards() {
  const container = document.getElementById('bidCardView');
  if (!container) return;

  if (!bids.length) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <div class="empty-state-icon">📋</div>
        <h3>No Bids Found</h3>
        <p>Create your first bid to start tracking vendor proposals.</p>
        <button class="btn btn-primary" onclick="openCreateModal()">+ New Bid</button>
      </div>
    `;
    return;
  }

  container.innerHTML = bids.map(bid => `
    <div class="bid-card ${selectedBids.has(bid.id) ? 'selected' : ''}" data-id="${bid.id}">
      <div class="card-header">
        <div class="card-checkbox" onclick="event.stopPropagation()">
          <input type="checkbox"
                 ${selectedBids.has(bid.id) ? 'checked' : ''}
                 onchange="toggleBidSelection('${bid.id}')">
        </div>
        <div class="card-title" onclick="openBidDetail('${bid.id}')">
          <h3>${escapeHtml(bid.title)}</h3>
          <span class="badge badge-${getStatusClass(bid.status)}">${formatStatus(bid.status)}</span>
        </div>
        <div class="card-amount">
          ${formatCurrency(bid.bid_amount)}
        </div>
      </div>
      <div class="card-body" onclick="openBidDetail('${bid.id}')">
        <div class="card-meta">
          <span class="meta-item">🏠 ${bid.job?.name || 'No job'}</span>
          <span class="meta-item">👷 ${bid.vendor?.name || 'No vendor'}</span>
          <span class="meta-item">📅 ${formatDate(bid.received_date)}</span>
          ${bid.document_count > 0 ? `<span class="meta-item">📎 ${bid.document_count} doc${bid.document_count !== 1 ? 's' : ''}</span>` : ''}
        </div>
        ${bid.description ? `<p class="card-description">${escapeHtml(bid.description)}</p>` : ''}
      </div>
      <div class="card-footer">
        <button class="btn btn-sm btn-secondary" onclick="event.stopPropagation(); openEditModal('${bid.id}')">Edit</button>
        <button class="btn btn-sm btn-danger" onclick="event.stopPropagation(); deleteBid('${bid.id}')">Delete</button>
      </div>
    </div>
  `).join('');
}

function renderStats(stats) {
  document.getElementById('statTotal').textContent = stats.total || 0;
  document.getElementById('statReceived').textContent = stats.received || 0;
  document.getElementById('statUnderReview').textContent = stats.under_review || 0;
  document.getElementById('statAccepted').textContent = stats.accepted || 0;
  document.getElementById('statTotalAmount').textContent = formatCurrency(stats.total_amount || 0);
}

// ============================================================
// MODAL FUNCTIONS
// ============================================================

function openCreateModal() {
  document.getElementById('modalTitle').textContent = 'New Bid';
  document.getElementById('bidId').value = '';
  document.getElementById('bidForm').reset();
  document.getElementById('formReceivedDate').value = new Date().toISOString().split('T')[0];

  const modal = document.getElementById('bidModal');
  modal.style.display = 'flex';
  modal.classList.add('show');
}

function openEditModal(bidId) {
  const bid = bids.find(b => b.id === bidId);
  if (!bid) return;

  document.getElementById('modalTitle').textContent = 'Edit Bid';
  document.getElementById('bidId').value = bid.id;
  document.getElementById('formTitle').value = bid.title || '';
  document.getElementById('formJob').value = bid.job_id || '';
  document.getElementById('formVendor').value = bid.vendor_id || '';
  document.getElementById('formAmount').value = bid.bid_amount || '';
  document.getElementById('formReceivedDate').value = bid.received_date || '';
  document.getElementById('formDueDate').value = bid.due_date || '';
  document.getElementById('formDescription').value = bid.description || '';
  document.getElementById('formScopeOfWork').value = bid.scope_of_work || '';
  document.getElementById('formNotes').value = bid.notes || '';

  const modal = document.getElementById('bidModal');
  modal.style.display = 'flex';
  modal.classList.add('show');
}

function closeModal() {
  const modal = document.getElementById('bidModal');
  modal.classList.remove('show');
  modal.style.display = 'none';
}

async function openBidDetail(bidId) {
  try {
    const response = await fetch(`/api/bids/${bidId}`);
    if (!response.ok) throw new Error('Failed to load bid');
    currentBid = await response.json();

    // Populate detail modal
    document.getElementById('detailTitle').textContent = currentBid.title;
    document.getElementById('detailStatus').textContent = formatStatus(currentBid.status);
    document.getElementById('detailStatus').className = `badge badge-${getStatusClass(currentBid.status)}`;
    document.getElementById('detailJob').textContent = currentBid.job?.name || '—';
    document.getElementById('detailVendor').textContent = currentBid.vendor?.name || '—';
    document.getElementById('detailAmount').textContent = formatCurrency(currentBid.bid_amount);
    document.getElementById('detailReceived').textContent = formatDate(currentBid.received_date);
    document.getElementById('detailDueDate').textContent = formatDate(currentBid.due_date) || '—';
    document.getElementById('detailDescription').textContent = currentBid.description || '—';
    document.getElementById('detailScopeOfWork').textContent = currentBid.scope_of_work || '—';
    document.getElementById('detailNotes').textContent = currentBid.notes || '—';

    // Render status actions
    renderStatusActions();

    // Render documents
    renderDocuments();

    // Render activity
    renderActivity();

    // Show/hide convert section
    const convertSection = document.getElementById('convertSection');
    const linkedPOInfo = document.getElementById('linkedPOInfo');

    if (currentBid.status === 'accepted') {
      convertSection.style.display = 'block';
      if (currentBid.linked_po) {
        linkedPOInfo.style.display = 'block';
        document.getElementById('linkedPOLink').textContent = currentBid.linked_po.po_number;
        document.getElementById('linkedPOLink').href = `pos.html?id=${currentBid.linked_po.id}`;
        document.querySelector('#convertSection .btn-primary').style.display = 'none';
      } else {
        linkedPOInfo.style.display = 'none';
        document.querySelector('#convertSection .btn-primary').style.display = 'inline-block';
      }
    } else {
      convertSection.style.display = 'none';
    }

    // Reset to overview tab
    switchTab('overview');

    // Show modal
    const modal = document.getElementById('bidDetailModal');
    modal.style.display = 'flex';
    modal.classList.add('show');
  } catch (err) {
    console.error('Error loading bid:', err);
    showToast('Failed to load bid details', 'error');
  }
}

function closeDetailModal() {
  const modal = document.getElementById('bidDetailModal');
  modal.classList.remove('show');
  modal.style.display = 'none';
  currentBid = null;
}

function editCurrentBid() {
  if (!currentBid) return;
  closeDetailModal();
  openEditModal(currentBid.id);
}

function renderStatusActions() {
  const container = document.getElementById('statusActions');
  if (!currentBid) return;

  const status = currentBid.status;
  let html = '';

  if (status === 'received') {
    html = `
      <button class="btn btn-primary" onclick="changeStatus('under_review')">Start Review</button>
      <button class="btn btn-danger" onclick="changeStatus('rejected')">Reject</button>
      <button class="btn btn-secondary" onclick="changeStatus('withdrawn')">Mark Withdrawn</button>
    `;
  } else if (status === 'under_review') {
    html = `
      <button class="btn btn-success" onclick="changeStatus('accepted')">Accept Bid</button>
      <button class="btn btn-danger" onclick="changeStatus('rejected')">Reject</button>
      <button class="btn btn-secondary" onclick="changeStatus('received')">Back to Received</button>
    `;
  } else if (status === 'rejected') {
    html = `
      <button class="btn btn-primary" onclick="changeStatus('under_review')">Reconsider</button>
    `;
  } else if (status === 'accepted') {
    html = `<p class="text-success">This bid has been accepted.</p>`;
  } else if (status === 'withdrawn') {
    html = `<p class="text-muted">This bid was withdrawn by the vendor.</p>`;
  }

  container.innerHTML = html;
}

function renderDocuments() {
  const container = document.getElementById('documentsList');
  if (!currentBid || !currentBid.documents?.length) {
    container.innerHTML = '<p class="text-muted">No documents uploaded yet.</p>';
    return;
  }

  container.innerHTML = currentBid.documents.map(doc => `
    <div class="document-item">
      <div class="document-info">
        <span class="document-icon">📄</span>
        <a href="${doc.file_url}" target="_blank">${escapeHtml(doc.file_name)}</a>
        <span class="document-meta">${formatFileSize(doc.file_size)} - ${formatDateTime(doc.uploaded_at)}</span>
      </div>
      <button class="btn btn-sm btn-danger" onclick="deleteDocument('${doc.id}')">Delete</button>
    </div>
  `).join('');
}

function renderActivity() {
  const container = document.getElementById('activityTimeline');
  if (!currentBid || !currentBid.activity?.length) {
    container.innerHTML = '<p class="text-muted">No activity recorded yet.</p>';
    return;
  }

  container.innerHTML = currentBid.activity.map(act => `
    <div class="activity-item">
      <div class="activity-icon">${getActivityIcon(act.action)}</div>
      <div class="activity-content">
        <div class="activity-action">${formatAction(act.action)}</div>
        <div class="activity-meta">
          ${act.performed_by || 'System'} - ${formatDateTime(act.created_at)}
        </div>
      </div>
    </div>
  `).join('');
}

function switchTab(tabName) {
  // Update tab buttons
  document.querySelectorAll('.tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.tab === tabName);
  });

  // Update tab content
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.toggle('active', content.id === `tab-${tabName}`);
  });

  // Load bid lines when switching to lines tab
  if (tabName === 'lines' && currentBid) {
    loadBidLines(currentBid.id);
  }
}

// ============================================================
// COMPARE MODAL
// ============================================================

function toggleBidSelection(bidId) {
  if (selectedBids.has(bidId)) {
    selectedBids.delete(bidId);
  } else {
    selectedBids.add(bidId);
  }

  // Update compare button
  const compareBtn = document.getElementById('compareBtn');
  compareBtn.disabled = selectedBids.size < 2;

  // Update card selection visual
  renderBidList();
}

function openCompareModal() {
  if (selectedBids.size < 2) {
    showToast('Select at least 2 bids to compare', 'warning');
    return;
  }

  const selectedBidData = bids.filter(b => selectedBids.has(b.id));

  // Find min and max amounts for highlighting
  const amounts = selectedBidData.map(b => parseFloat(b.bid_amount) || 0);
  const minAmount = Math.min(...amounts);
  const maxAmount = Math.max(...amounts);

  const container = document.getElementById('compareGrid');
  container.innerHTML = selectedBidData.map(bid => {
    const amount = parseFloat(bid.bid_amount) || 0;
    const isLowest = amount === minAmount && amounts.length > 1;
    const isHighest = amount === maxAmount && amounts.length > 1;

    return `
      <div class="compare-column">
        <div class="compare-header">
          <h3>${escapeHtml(bid.title)}</h3>
          <span class="badge badge-${getStatusClass(bid.status)}">${formatStatus(bid.status)}</span>
        </div>
        <div class="compare-body">
          <div class="compare-row">
            <span class="compare-label">Vendor</span>
            <span class="compare-value">${bid.vendor?.name || '—'}</span>
          </div>
          <div class="compare-row">
            <span class="compare-label">Amount</span>
            <span class="compare-value compare-amount ${isLowest ? 'lowest' : ''} ${isHighest ? 'highest' : ''}">
              ${formatCurrency(bid.bid_amount)}
              ${isLowest ? '<span class="compare-tag lowest">Lowest</span>' : ''}
              ${isHighest ? '<span class="compare-tag highest">Highest</span>' : ''}
            </span>
          </div>
          <div class="compare-row">
            <span class="compare-label">Received</span>
            <span class="compare-value">${formatDate(bid.received_date)}</span>
          </div>
          <div class="compare-row">
            <span class="compare-label">Documents</span>
            <span class="compare-value">${bid.document_count || 0} files</span>
          </div>
          <div class="compare-row full-width">
            <span class="compare-label">Scope</span>
            <span class="compare-value">${bid.scope_of_work || bid.description || '—'}</span>
          </div>
        </div>
        <div class="compare-footer">
          ${bid.status === 'under_review' || bid.status === 'received' ? `
            <button class="btn btn-success btn-sm" onclick="acceptFromCompare('${bid.id}')">Accept</button>
            <button class="btn btn-danger btn-sm" onclick="rejectFromCompare('${bid.id}')">Reject</button>
          ` : `
            <button class="btn btn-secondary btn-sm" onclick="openBidDetail('${bid.id}'); closeCompareModal();">View Details</button>
          `}
        </div>
      </div>
    `;
  }).join('');

  const modal = document.getElementById('compareModal');
  modal.style.display = 'flex';
  modal.classList.add('show');
}

function closeCompareModal() {
  const modal = document.getElementById('compareModal');
  modal.classList.remove('show');
  modal.style.display = 'none';
}

async function acceptFromCompare(bidId) {
  await changeStatusDirect(bidId, 'accepted');
  closeCompareModal();
  await loadBids();
}

async function rejectFromCompare(bidId) {
  await changeStatusDirect(bidId, 'rejected');
  closeCompareModal();
  await loadBids();
}

// ============================================================
// API OPERATIONS
// ============================================================

async function saveBid() {
  const bidId = document.getElementById('bidId').value;
  const data = {
    title: document.getElementById('formTitle').value,
    job_id: document.getElementById('formJob').value,
    vendor_id: document.getElementById('formVendor').value || null,
    bid_amount: parseFloat(document.getElementById('formAmount').value) || null,
    received_date: document.getElementById('formReceivedDate').value || null,
    due_date: document.getElementById('formDueDate').value || null,
    description: document.getElementById('formDescription').value || null,
    scope_of_work: document.getElementById('formScopeOfWork').value || null,
    notes: document.getElementById('formNotes').value || null,
    created_by: 'User'
  };

  if (!data.title || !data.job_id) {
    showToast('Title and Job are required', 'error');
    return;
  }

  try {
    const url = bidId ? `/api/bids/${bidId}` : '/api/bids';
    const method = bidId ? 'PATCH' : 'POST';

    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to save bid');
    }

    showToast(bidId ? 'Bid updated' : 'Bid created', 'success');
    closeModal();
    await loadBids();
    await loadStats();
  } catch (err) {
    console.error('Error saving bid:', err);
    showToast(err.message, 'error');
  }
}

async function deleteBid(bidId) {
  if (!confirm('Are you sure you want to delete this bid?')) return;

  try {
    const response = await fetch(`/api/bids/${bidId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deleted_by: 'User' })
    });

    if (!response.ok) throw new Error('Failed to delete bid');

    showToast('Bid deleted', 'success');
    selectedBids.delete(bidId);
    await loadBids();
    await loadStats();
  } catch (err) {
    console.error('Error deleting bid:', err);
    showToast('Failed to delete bid', 'error');
  }
}

async function changeStatus(newStatus) {
  if (!currentBid) return;
  await changeStatusDirect(currentBid.id, newStatus);
  await openBidDetail(currentBid.id);
  await loadBids();
  await loadStats();
}

async function changeStatusDirect(bidId, newStatus) {
  try {
    const response = await fetch(`/api/bids/${bidId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus, performed_by: 'User' })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to change status');
    }

    showToast(`Bid ${formatStatus(newStatus)}`, 'success');
  } catch (err) {
    console.error('Error changing status:', err);
    showToast(err.message, 'error');
  }
}

async function convertToPO() {
  if (!currentBid) return;

  if (!confirm('Convert this bid to a Purchase Order?')) return;

  try {
    const response = await fetch(`/api/bids/${currentBid.id}/convert-to-po`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ created_by: 'User' })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to convert to PO');
    }

    const result = await response.json();
    showToast(`PO ${result.po.po_number} created!`, 'success');

    // Refresh detail view
    await openBidDetail(currentBid.id);
  } catch (err) {
    console.error('Error converting to PO:', err);
    showToast(err.message, 'error');
  }
}

// ============================================================
// DOCUMENT OPERATIONS
// ============================================================

function handleFileSelect(event) {
  const files = event.target.files;
  for (const file of files) {
    uploadDocument(file);
  }
  event.target.value = '';
}

async function uploadDocument(file) {
  if (!currentBid) return;

  const formData = new FormData();
  formData.append('document', file);
  formData.append('uploaded_by', 'User');

  try {
    const response = await fetch(`/api/bids/${currentBid.id}/documents`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Upload failed');
    }

    showToast('Document uploaded', 'success');
    await openBidDetail(currentBid.id);
  } catch (err) {
    console.error('Error uploading document:', err);
    showToast(err.message, 'error');
  }
}

async function deleteDocument(docId) {
  if (!confirm('Delete this document?')) return;

  try {
    const response = await fetch(`/api/bids/documents/${docId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deleted_by: 'User' })
    });

    if (!response.ok) throw new Error('Failed to delete document');

    showToast('Document deleted', 'success');
    await openBidDetail(currentBid.id);
  } catch (err) {
    console.error('Error deleting document:', err);
    showToast('Failed to delete document', 'error');
  }
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

function formatCurrency(amount) {
  if (amount == null) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

function formatFileSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function formatStatus(status) {
  const statusMap = {
    received: 'Received',
    under_review: 'Under Review',
    accepted: 'Accepted',
    rejected: 'Rejected',
    withdrawn: 'Withdrawn'
  };
  return statusMap[status] || status;
}

function getStatusClass(status) {
  const classMap = {
    received: 'warning',
    under_review: 'info',
    accepted: 'success',
    rejected: 'danger',
    withdrawn: 'secondary'
  };
  return classMap[status] || 'secondary';
}

function formatAction(action) {
  const actionMap = {
    created: 'Bid created',
    updated: 'Bid updated',
    deleted: 'Bid deleted',
    status_changed_to_received: 'Status changed to Received',
    status_changed_to_under_review: 'Review started',
    status_changed_to_accepted: 'Bid accepted',
    status_changed_to_rejected: 'Bid rejected',
    status_changed_to_withdrawn: 'Bid withdrawn',
    document_uploaded: 'Document uploaded',
    document_deleted: 'Document deleted',
    converted_to_po: 'Converted to Purchase Order'
  };
  return actionMap[action] || action;
}

function getActivityIcon(action) {
  const iconMap = {
    created: '➕',
    updated: '✏️',
    deleted: '🗑️',
    status_changed_to_received: '📥',
    status_changed_to_under_review: '🔍',
    status_changed_to_accepted: '✅',
    status_changed_to_rejected: '❌',
    status_changed_to_withdrawn: '↩️',
    document_uploaded: '📎',
    document_deleted: '📎',
    converted_to_po: '📋'
  };
  return iconMap[action] || '📌';
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ============================================================
// BID LINE ITEMS
// ============================================================

async function loadBidLines(bidId) {
  try {
    const response = await fetch(`/api/bids/${bidId}/lines`);
    if (!response.ok) throw new Error('Failed to load bid lines');
    currentBidLines = await response.json();
    renderBidLines();
  } catch (err) {
    console.error('Error loading bid lines:', err);
    currentBidLines = [];
    renderBidLines();
  }
}

function renderBidLines() {
  const tbody = document.getElementById('bidLinesBody');
  if (!tbody) return;

  if (!currentBidLines.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 24px; color: var(--text-secondary);">
          No line items yet. Click "Add Line" to break down this bid.
        </td>
      </tr>
    `;
    updateLineTotals();
    return;
  }

  tbody.innerHTML = currentBidLines.map(line => {
    const costCode = costCodes.find(cc => cc.id === line.cost_code_id);
    return `
      <tr>
        <td>${costCode ? `${costCode.code} - ${costCode.name}` : '—'}</td>
        <td>${escapeHtml(line.description) || '—'}</td>
        <td style="text-align: right;">${line.quantity || 1}</td>
        <td>${line.unit || 'LS'}</td>
        <td style="text-align: right;">${formatCurrency(line.unit_cost)}</td>
        <td style="text-align: right; font-weight: 600;">${formatCurrency(line.amount)}</td>
        <td>
          <button class="btn btn-sm btn-secondary" onclick="editBidLine('${line.id}')">Edit</button>
          <button class="btn btn-sm btn-danger" onclick="deleteBidLine('${line.id}')">Delete</button>
        </td>
      </tr>
    `;
  }).join('');

  updateLineTotals();
}

function updateLineTotals() {
  const linesTotal = document.getElementById('linesTotal');
  const linesDifference = document.getElementById('linesDifference');
  if (!linesTotal || !linesDifference) return;

  const total = currentBidLines.reduce((sum, line) => sum + (parseFloat(line.amount) || 0), 0);
  linesTotal.textContent = `Total: ${formatCurrency(total)}`;

  if (currentBid && currentBid.bid_amount) {
    const bidAmount = parseFloat(currentBid.bid_amount);
    const diff = total - bidAmount;
    if (Math.abs(diff) < 0.01) {
      linesDifference.textContent = '✓ Matches bid amount';
      linesDifference.style.color = 'var(--accent-green)';
    } else {
      const sign = diff > 0 ? '+' : '';
      linesDifference.textContent = `${sign}${formatCurrency(diff)} vs bid`;
      linesDifference.style.color = diff > 0 ? 'var(--accent-orange)' : 'var(--accent-red)';
    }
  } else {
    linesDifference.textContent = '';
  }
}

function addBidLine() {
  document.getElementById('bidLineModalTitle').textContent = 'Add Line Item';
  document.getElementById('bidLineId').value = '';
  document.getElementById('bidLineForm').reset();
  document.getElementById('bidLineQty').value = '1';
  document.getElementById('bidLineUnit').value = 'LS';

  const modal = document.getElementById('bidLineModal');
  modal.style.display = 'flex';
  modal.classList.add('show');
}

function editBidLine(lineId) {
  const line = currentBidLines.find(l => l.id === lineId);
  if (!line) return;

  document.getElementById('bidLineModalTitle').textContent = 'Edit Line Item';
  document.getElementById('bidLineId').value = line.id;
  document.getElementById('bidLineCostCode').value = line.cost_code_id || '';
  document.getElementById('bidLineDescription').value = line.description || '';
  document.getElementById('bidLineQty').value = line.quantity || 1;
  document.getElementById('bidLineUnit').value = line.unit || 'LS';
  document.getElementById('bidLineUnitCost').value = line.unit_cost || '';
  document.getElementById('bidLineAmount').value = line.amount || '';

  const modal = document.getElementById('bidLineModal');
  modal.style.display = 'flex';
  modal.classList.add('show');
}

function closeBidLineModal() {
  const modal = document.getElementById('bidLineModal');
  modal.classList.remove('show');
  modal.style.display = 'none';
}

function calculateLineAmount() {
  const qty = parseFloat(document.getElementById('bidLineQty').value) || 0;
  const unitCost = parseFloat(document.getElementById('bidLineUnitCost').value) || 0;
  const amount = qty * unitCost;
  document.getElementById('bidLineAmount').value = amount.toFixed(2);
}

async function saveBidLine() {
  if (!currentBid) return;

  const lineId = document.getElementById('bidLineId').value;
  const data = {
    cost_code_id: document.getElementById('bidLineCostCode').value || null,
    description: document.getElementById('bidLineDescription').value || null,
    quantity: parseFloat(document.getElementById('bidLineQty').value) || 1,
    unit: document.getElementById('bidLineUnit').value || 'LS',
    unit_cost: parseFloat(document.getElementById('bidLineUnitCost').value) || null,
    amount: parseFloat(document.getElementById('bidLineAmount').value) || null
  };

  // Calculate amount if not set but we have qty and unit_cost
  if (!data.amount && data.unit_cost) {
    data.amount = data.quantity * data.unit_cost;
  }

  try {
    const url = lineId
      ? `/api/bids/${currentBid.id}/lines/${lineId}`
      : `/api/bids/${currentBid.id}/lines`;
    const method = lineId ? 'PATCH' : 'POST';

    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to save line item');
    }

    showToast(lineId ? 'Line item updated' : 'Line item added', 'success');
    closeBidLineModal();
    await loadBidLines(currentBid.id);
  } catch (err) {
    console.error('Error saving line item:', err);
    showToast(err.message, 'error');
  }
}

async function deleteBidLine(lineId) {
  if (!currentBid) return;
  if (!confirm('Delete this line item?')) return;

  try {
    const response = await fetch(`/api/bids/${currentBid.id}/lines/${lineId}`, {
      method: 'DELETE'
    });

    if (!response.ok) throw new Error('Failed to delete line item');

    showToast('Line item deleted', 'success');
    await loadBidLines(currentBid.id);
  } catch (err) {
    console.error('Error deleting line item:', err);
    showToast('Failed to delete line item', 'error');
  }
}

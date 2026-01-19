/**
 * Submittals Page JavaScript
 * Handles submittal CRUD, review workflow, and filtering
 */

// State
let submittals = [];
let jobs = [];
let costCodes = [];
let currentSubmittal = null;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  setupEventListeners();

  try {
    await Promise.all([
      loadJobs().catch(err => console.error('Jobs failed:', err)),
      loadCostCodes().catch(err => console.error('Cost codes failed:', err))
    ]);
  } catch (err) {
    console.error('Failed to load reference data:', err);
  }

  await loadSubmittals();
  loadStats();
});

// Event Listeners
function setupEventListeners() {
  document.getElementById('jobFilter').addEventListener('change', applyFilters);
  document.getElementById('statusFilter').addEventListener('change', applyFilters);
  document.getElementById('typeFilter').addEventListener('change', applyFilters);

  let debounceTimer;
  document.getElementById('searchInput').addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => applyFilters(), 150);
  });
}

// Load Jobs for filters and dropdowns
async function loadJobs() {
  const res = await fetch('/api/jobs');
  if (!res.ok) throw new Error('Failed to load jobs');
  jobs = await res.json();

  const jobFilter = document.getElementById('jobFilter');
  const submittalJob = document.getElementById('submittalJob');

  jobs.forEach(job => {
    jobFilter.innerHTML += `<option value="${job.id}">${job.name}</option>`;
    submittalJob.innerHTML += `<option value="${job.id}">${job.name}</option>`;
  });
}

// Load Cost Codes
async function loadCostCodes() {
  const res = await fetch('/api/cost-codes');
  if (!res.ok) throw new Error('Failed to load cost codes');
  costCodes = await res.json();

  const submittalCostCode = document.getElementById('submittalCostCode');
  costCodes.forEach(cc => {
    submittalCostCode.innerHTML += `<option value="${cc.id}">${cc.code} - ${cc.name}</option>`;
  });
}

// Load Submittals
async function loadSubmittals() {
  try {
    const res = await fetch('/api/submittals');
    if (!res.ok) throw new Error('Failed to load submittals');
    submittals = await res.json();
    renderSubmittals(submittals);
  } catch (err) {
    console.error('Error loading submittals:', err);
    showToast('Failed to load submittals', 'error');
  }
}

// Load Stats
async function loadStats() {
  try {
    const res = await fetch('/api/submittals/stats');
    if (!res.ok) throw new Error('Failed to load stats');
    const stats = await res.json();

    document.getElementById('statTotal').textContent = stats.total;
    document.getElementById('statDraft').textContent = stats.draft;
    document.getElementById('statPending').textContent = stats.pending_review;
    document.getElementById('statApproved').textContent = (stats.approved || 0) + (stats.approved_as_noted || 0);
    document.getElementById('statRevise').textContent = stats.revise_resubmit;
  } catch (err) {
    console.error('Error loading stats:', err);
  }
}

// Render Submittals List
function renderSubmittals(data) {
  const container = document.getElementById('submittalList');
  const emptyState = document.getElementById('emptyState');

  if (!data || data.length === 0) {
    container.innerHTML = '';
    emptyState.style.display = 'block';
    return;
  }

  emptyState.style.display = 'none';

  container.innerHTML = data.map(sub => `
    <div class="rfi-card" onclick="openSubmittalDetail('${sub.id}')">
      <div class="rfi-card-header">
        <div class="rfi-card-title">
          <span class="rfi-number">${sub.submittal_number || 'SUB-????'}</span>
          <span class="rfi-revision">Rev ${sub.revision || 'A'}</span>
          ${getStatusBadge(sub.status)}
          ${getTypeBadge(sub.type)}
        </div>
        <div class="rfi-card-job">${sub.job?.name || 'No Job'}</div>
      </div>
      <div class="rfi-card-body">
        <div class="rfi-subject">${sub.title}</div>
        ${sub.description ? `<div class="rfi-preview">${sub.description.substring(0, 150)}${sub.description.length > 150 ? '...' : ''}</div>` : ''}
      </div>
      <div class="rfi-card-footer">
        <span class="rfi-meta">
          ${sub.spec_section ? `<span class="spec-section">Spec ${sub.spec_section}</span>` : ''}
          ${sub.subcontractor ? `<span>From: ${sub.subcontractor}</span>` : ''}
        </span>
        <span class="rfi-date">${formatDate(sub.created_at)}</span>
      </div>
    </div>
  `).join('');
}

// Get Status Badge HTML
function getStatusBadge(status) {
  const statusMap = {
    'draft': { label: 'Draft', class: 'badge-warning' },
    'pending_review': { label: 'Pending Review', class: 'badge-info' },
    'approved': { label: 'Approved', class: 'badge-success' },
    'approved_as_noted': { label: 'Approved as Noted', class: 'badge-success' },
    'revise_resubmit': { label: 'Revise & Resubmit', class: 'badge-warning' },
    'rejected': { label: 'Rejected', class: 'badge-danger' }
  };
  const info = statusMap[status] || { label: status, class: '' };
  return `<span class="badge ${info.class}">${info.label}</span>`;
}

// Get Type Badge HTML
function getTypeBadge(type) {
  const typeMap = {
    'shop_drawing': 'Shop Drawing',
    'product_data': 'Product Data',
    'sample': 'Sample',
    'mock_up': 'Mock-Up',
    'other': 'Other'
  };
  return `<span class="badge badge-outline">${typeMap[type] || type}</span>`;
}

// Apply Filters
function applyFilters() {
  const jobId = document.getElementById('jobFilter').value;
  const status = document.getElementById('statusFilter').value;
  const type = document.getElementById('typeFilter').value;
  const search = document.getElementById('searchInput').value.toLowerCase();

  let filtered = submittals;

  if (jobId) {
    filtered = filtered.filter(s => s.job_id === jobId);
  }
  if (status) {
    filtered = filtered.filter(s => s.status === status);
  }
  if (type) {
    filtered = filtered.filter(s => s.type === type);
  }
  if (search) {
    filtered = filtered.filter(s =>
      (s.title && s.title.toLowerCase().includes(search)) ||
      (s.submittal_number && s.submittal_number.toLowerCase().includes(search)) ||
      (s.description && s.description.toLowerCase().includes(search)) ||
      (s.subcontractor && s.subcontractor.toLowerCase().includes(search))
    );
  }

  renderSubmittals(filtered);
}

// Format Date
function formatDate(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString();
}

// ============================================================
// MODAL FUNCTIONS
// ============================================================

// Open Create Modal
function openCreateModal() {
  document.getElementById('submittalId').value = '';
  document.getElementById('submittalModalTitle').textContent = 'New Submittal';
  document.getElementById('submittalForm').reset();
  document.getElementById('submittalSubmittedBy').value = 'Jake Ross';

  const modal = document.getElementById('submittalModal');
  modal.style.display = 'flex';
  modal.classList.add('show');
}

// Close Create/Edit Modal
function closeSubmittalModal() {
  const modal = document.getElementById('submittalModal');
  modal.classList.remove('show');
  modal.style.display = 'none';
}

// Open Submittal Detail
async function openSubmittalDetail(id) {
  try {
    const res = await fetch(`/api/submittals/${id}`);
    if (!res.ok) throw new Error('Failed to load submittal');
    currentSubmittal = await res.json();

    populateDetailModal(currentSubmittal);

    const modal = document.getElementById('submittalDetailModal');
    modal.style.display = 'flex';
    modal.classList.add('show');
  } catch (err) {
    console.error('Error loading submittal:', err);
    showToast('Failed to load submittal details', 'error');
  }
}

// Populate Detail Modal
function populateDetailModal(sub) {
  document.getElementById('detailSubmittalNumber').textContent = sub.submittal_number || 'SUB-????';
  document.getElementById('detailRevision').textContent = `Rev ${sub.revision || 'A'}`;
  document.getElementById('detailStatus').textContent = formatStatus(sub.status);
  document.getElementById('detailStatus').className = `badge ${getStatusClass(sub.status)}`;

  document.getElementById('detailTitle').textContent = sub.title || '-';
  document.getElementById('detailDescription').textContent = sub.description || '-';

  // Details
  document.getElementById('detailJob').textContent = sub.job?.name || '-';
  document.getElementById('detailType').textContent = formatType(sub.type);
  document.getElementById('detailSpecSection').textContent = sub.spec_section || '-';
  document.getElementById('detailCostCode').textContent = sub.cost_code ? `${sub.cost_code.code} - ${sub.cost_code.name}` : '-';
  document.getElementById('detailSubcontractor').textContent = sub.subcontractor || '-';
  document.getElementById('detailManufacturer').textContent = sub.manufacturer || '-';

  // Dates
  document.getElementById('detailSubmittedBy').textContent = sub.submitted_by || '-';
  document.getElementById('detailSubmittedTo').textContent = sub.submitted_to || '-';
  document.getElementById('detailDateSubmitted').textContent = formatDate(sub.date_submitted);
  document.getElementById('detailDateRequired').textContent = formatDate(sub.date_required);
  document.getElementById('detailDateReturned').textContent = formatDate(sub.date_returned);
  document.getElementById('detailLeadTime').textContent = sub.lead_time_days ? `${sub.lead_time_days} days` : '-';

  // Review section
  const reviewSection = document.getElementById('reviewSection');
  if (sub.review_comments || sub.reviewed_at) {
    reviewSection.style.display = 'block';
    document.getElementById('detailReviewComments').textContent = sub.review_comments || '-';
    document.getElementById('detailReviewedBy').textContent = sub.reviewed_by || '-';
    document.getElementById('detailReviewedAt').textContent = formatDate(sub.reviewed_at);
  } else {
    reviewSection.style.display = 'none';
  }

  // Items
  renderItems(sub.items || []);

  // Activity log
  renderActivityLog(sub.log || []);

  // Button visibility
  const submitBtn = document.getElementById('submitBtn');
  const reviewBtn = document.getElementById('reviewBtn');
  const reviseBtn = document.getElementById('reviseBtn');

  submitBtn.style.display = sub.status === 'draft' ? 'inline-block' : 'none';
  reviewBtn.style.display = sub.status === 'pending_review' ? 'inline-block' : 'none';
  reviseBtn.style.display = ['approved', 'approved_as_noted', 'revise_resubmit', 'rejected'].includes(sub.status) ? 'block' : 'none';
}

// Format Status
function formatStatus(status) {
  const map = {
    'draft': 'Draft',
    'pending_review': 'Pending Review',
    'approved': 'Approved',
    'approved_as_noted': 'Approved as Noted',
    'revise_resubmit': 'Revise & Resubmit',
    'rejected': 'Rejected'
  };
  return map[status] || status;
}

// Get Status Class
function getStatusClass(status) {
  const map = {
    'draft': 'badge-warning',
    'pending_review': 'badge-info',
    'approved': 'badge-success',
    'approved_as_noted': 'badge-success',
    'revise_resubmit': 'badge-warning',
    'rejected': 'badge-danger'
  };
  return map[status] || '';
}

// Format Type
function formatType(type) {
  const map = {
    'shop_drawing': 'Shop Drawing',
    'product_data': 'Product Data',
    'sample': 'Sample',
    'mock_up': 'Mock-Up',
    'other': 'Other'
  };
  return map[type] || type;
}

// Render Items
function renderItems(items) {
  const container = document.getElementById('itemsList');

  if (!items || items.length === 0) {
    container.innerHTML = '<p class="text-muted">No items added</p>';
    return;
  }

  container.innerHTML = items.map(item => `
    <div class="submittal-item">
      <div class="item-header">
        <span class="item-number">#${item.item_number}</span>
        <span class="item-desc">${item.description}</span>
        <button class="btn btn-sm btn-danger" onclick="deleteItem('${item.id}')">Delete</button>
      </div>
      <div class="item-details">
        ${item.quantity ? `<span>Qty: ${item.quantity} ${item.unit || ''}</span>` : ''}
        ${item.manufacturer ? `<span>Mfr: ${item.manufacturer}</span>` : ''}
        ${item.model_number ? `<span>Model: ${item.model_number}</span>` : ''}
      </div>
    </div>
  `).join('');
}

// Render Activity Log
function renderActivityLog(log) {
  const container = document.getElementById('activityLog');

  if (!log || log.length === 0) {
    container.innerHTML = '<p class="text-muted">No activity recorded</p>';
    return;
  }

  container.innerHTML = log.map(entry => `
    <div class="activity-entry">
      <div class="activity-action">${formatAction(entry.action)}</div>
      <div class="activity-meta">
        <span>${entry.performed_by || 'System'}</span>
        <span>${formatDate(entry.created_at)}</span>
      </div>
      ${entry.comments ? `<div class="activity-comments">${entry.comments}</div>` : ''}
    </div>
  `).join('');
}

// Format Action
function formatAction(action) {
  const map = {
    'created': 'Submittal created',
    'submitted': 'Submitted for review',
    'reviewed': 'Review completed',
    'revised': 'Revision created',
    'approved': 'Approved',
    'rejected': 'Rejected'
  };
  return map[action] || action;
}

// Close Detail Modal
function closeDetailModal() {
  const modal = document.getElementById('submittalDetailModal');
  modal.classList.remove('show');
  modal.style.display = 'none';
  currentSubmittal = null;
}

// Edit Current Submittal
function editCurrentSubmittal() {
  if (!currentSubmittal) return;

  document.getElementById('submittalId').value = currentSubmittal.id;
  document.getElementById('submittalModalTitle').textContent = 'Edit Submittal';
  document.getElementById('submittalJob').value = currentSubmittal.job_id || '';
  document.getElementById('submittalType').value = currentSubmittal.type || 'shop_drawing';
  document.getElementById('submittalTitle').value = currentSubmittal.title || '';
  document.getElementById('submittalSpecSection').value = currentSubmittal.spec_section || '';
  document.getElementById('submittalCostCode').value = currentSubmittal.cost_code_id || '';
  document.getElementById('submittalDescription').value = currentSubmittal.description || '';
  document.getElementById('submittalSubcontractor').value = currentSubmittal.subcontractor || '';
  document.getElementById('submittalManufacturer').value = currentSubmittal.manufacturer || '';
  document.getElementById('submittalSubmittedTo').value = currentSubmittal.submitted_to || '';
  document.getElementById('submittalDateRequired').value = currentSubmittal.date_required || '';
  document.getElementById('submittalLeadTime').value = currentSubmittal.lead_time_days || '';
  document.getElementById('submittalSubmittedBy').value = currentSubmittal.submitted_by || 'Jake Ross';
  document.getElementById('submittalNotes').value = currentSubmittal.notes || '';

  closeDetailModal();

  const modal = document.getElementById('submittalModal');
  modal.style.display = 'flex';
  modal.classList.add('show');
}

// Save Submittal
async function saveSubmittal() {
  const id = document.getElementById('submittalId').value;
  const data = {
    job_id: document.getElementById('submittalJob').value,
    type: document.getElementById('submittalType').value,
    title: document.getElementById('submittalTitle').value,
    spec_section: document.getElementById('submittalSpecSection').value || null,
    cost_code_id: document.getElementById('submittalCostCode').value || null,
    description: document.getElementById('submittalDescription').value || null,
    subcontractor: document.getElementById('submittalSubcontractor').value || null,
    manufacturer: document.getElementById('submittalManufacturer').value || null,
    submitted_to: document.getElementById('submittalSubmittedTo').value || null,
    date_required: document.getElementById('submittalDateRequired').value || null,
    lead_time_days: document.getElementById('submittalLeadTime').value || null,
    submitted_by: document.getElementById('submittalSubmittedBy').value,
    notes: document.getElementById('submittalNotes').value || null
  };

  if (!data.job_id || !data.title) {
    showToast('Job and title are required', 'error');
    return;
  }

  try {
    const url = id ? `/api/submittals/${id}` : '/api/submittals';
    const method = id ? 'PATCH' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to save submittal');
    }

    showToast(id ? 'Submittal updated' : 'Submittal created', 'success');
    closeSubmittalModal();
    await loadSubmittals();
    loadStats();
  } catch (err) {
    console.error('Error saving submittal:', err);
    showToast(err.message, 'error');
  }
}

// Submit for Review
async function submitForReview() {
  if (!currentSubmittal) return;

  try {
    const res = await fetch(`/api/submittals/${currentSubmittal.id}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ submitted_by: 'Jake Ross' })
    });

    if (!res.ok) throw new Error('Failed to submit');

    showToast('Submittal submitted for review', 'success');
    closeDetailModal();
    await loadSubmittals();
    loadStats();
  } catch (err) {
    console.error('Error submitting:', err);
    showToast(err.message, 'error');
  }
}

// Open Review Modal
function openReviewModal() {
  document.getElementById('reviewForm').reset();
  document.getElementById('reviewedBy').value = 'Jake Ross';

  const modal = document.getElementById('reviewModal');
  modal.style.display = 'flex';
  modal.classList.add('show');
}

// Close Review Modal
function closeReviewModal() {
  const modal = document.getElementById('reviewModal');
  modal.classList.remove('show');
  modal.style.display = 'none';
}

// Submit Review
async function submitReview() {
  if (!currentSubmittal) return;

  const data = {
    status: document.getElementById('reviewStatus').value,
    review_comments: document.getElementById('reviewComments').value || null,
    reviewed_by: document.getElementById('reviewedBy').value
  };

  try {
    const res = await fetch(`/api/submittals/${currentSubmittal.id}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!res.ok) throw new Error('Failed to submit review');

    showToast('Review submitted', 'success');
    closeReviewModal();
    closeDetailModal();
    await loadSubmittals();
    loadStats();
  } catch (err) {
    console.error('Error submitting review:', err);
    showToast(err.message, 'error');
  }
}

// Create Revision
async function createRevision() {
  if (!currentSubmittal) return;

  if (!confirm('Create a new revision of this submittal?')) return;

  try {
    const res = await fetch(`/api/submittals/${currentSubmittal.id}/revise`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!res.ok) throw new Error('Failed to create revision');

    const newSubmittal = await res.json();
    showToast(`Revision ${newSubmittal.revision} created`, 'success');
    closeDetailModal();
    await loadSubmittals();
    loadStats();

    // Open the new revision
    openSubmittalDetail(newSubmittal.id);
  } catch (err) {
    console.error('Error creating revision:', err);
    showToast(err.message, 'error');
  }
}

// Delete Submittal
async function deleteSubmittal() {
  if (!currentSubmittal) return;

  if (!confirm('Are you sure you want to delete this submittal?')) return;

  try {
    const res = await fetch(`/api/submittals/${currentSubmittal.id}`, {
      method: 'DELETE'
    });

    if (!res.ok) throw new Error('Failed to delete submittal');

    showToast('Submittal deleted', 'success');
    closeDetailModal();
    await loadSubmittals();
    loadStats();
  } catch (err) {
    console.error('Error deleting submittal:', err);
    showToast(err.message, 'error');
  }
}

// ============================================================
// ITEMS
// ============================================================

// Open Add Item Modal
function openAddItemModal() {
  document.getElementById('addItemForm').reset();
  document.getElementById('itemQuantity').value = 1;

  const modal = document.getElementById('addItemModal');
  modal.style.display = 'flex';
  modal.classList.add('show');
}

// Close Add Item Modal
function closeAddItemModal() {
  const modal = document.getElementById('addItemModal');
  modal.classList.remove('show');
  modal.style.display = 'none';
}

// Add Item
async function addItem() {
  if (!currentSubmittal) return;

  const data = {
    description: document.getElementById('itemDescription').value,
    quantity: parseInt(document.getElementById('itemQuantity').value) || 1,
    unit: document.getElementById('itemUnit').value || null,
    manufacturer: document.getElementById('itemManufacturer').value || null,
    model_number: document.getElementById('itemModelNumber').value || null,
    notes: document.getElementById('itemNotes').value || null
  };

  if (!data.description) {
    showToast('Description is required', 'error');
    return;
  }

  try {
    const res = await fetch(`/api/submittals/${currentSubmittal.id}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!res.ok) throw new Error('Failed to add item');

    showToast('Item added', 'success');
    closeAddItemModal();

    // Reload submittal detail
    openSubmittalDetail(currentSubmittal.id);
  } catch (err) {
    console.error('Error adding item:', err);
    showToast(err.message, 'error');
  }
}

// Delete Item
async function deleteItem(itemId) {
  if (!currentSubmittal) return;

  if (!confirm('Delete this item?')) return;

  try {
    const res = await fetch(`/api/submittals/${currentSubmittal.id}/items/${itemId}`, {
      method: 'DELETE'
    });

    if (!res.ok) throw new Error('Failed to delete item');

    showToast('Item deleted', 'success');
    openSubmittalDetail(currentSubmittal.id);
  } catch (err) {
    console.error('Error deleting item:', err);
    showToast(err.message, 'error');
  }
}

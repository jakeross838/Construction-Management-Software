/**
 * Warranties Page JavaScript
 * Handles warranty CRUD and claims
 */

// State
let warranties = [];
let jobs = [];
let vendors = [];
let currentWarranty = null;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  setupEventListeners();

  try {
    await Promise.all([
      loadJobs().catch(err => console.error('Jobs failed:', err)),
      loadVendors().catch(err => console.error('Vendors failed:', err))
    ]);
  } catch (err) {
    console.error('Failed to load reference data:', err);
  }

  await loadWarranties();
  loadStats();
});

// Event Listeners
function setupEventListeners() {
  document.getElementById('jobFilter').addEventListener('change', applyFilters);
  document.getElementById('statusFilter').addEventListener('change', applyFilters);
  document.getElementById('typeFilter').addEventListener('change', applyFilters);
  document.getElementById('categoryFilter').addEventListener('change', applyFilters);

  let debounceTimer;
  document.getElementById('searchInput').addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => applyFilters(), 150);
  });
}

// Load Jobs
async function loadJobs() {
  const res = await fetch('/api/jobs');
  if (!res.ok) throw new Error('Failed to load jobs');
  jobs = await res.json();

  const jobFilter = document.getElementById('jobFilter');
  const warrantyJob = document.getElementById('warrantyJob');

  jobs.forEach(job => {
    jobFilter.innerHTML += `<option value="${job.id}">${job.name}</option>`;
    warrantyJob.innerHTML += `<option value="${job.id}">${job.name}</option>`;
  });
}

// Load Vendors
async function loadVendors() {
  const res = await fetch('/api/vendors');
  if (!res.ok) throw new Error('Failed to load vendors');
  vendors = await res.json();

  const warrantyVendor = document.getElementById('warrantyVendor');
  vendors.forEach(v => {
    warrantyVendor.innerHTML += `<option value="${v.id}">${v.name}</option>`;
  });
}

// Load Warranties
async function loadWarranties() {
  try {
    const res = await fetch('/api/warranties');
    if (!res.ok) throw new Error('Failed to load warranties');
    warranties = await res.json();
    renderWarranties(warranties);
  } catch (err) {
    console.error('Error loading warranties:', err);
    showToast('Failed to load warranties', 'error');
  }
}

// Load Stats
async function loadStats() {
  try {
    const res = await fetch('/api/warranties/stats');
    if (!res.ok) throw new Error('Failed to load stats');
    const stats = await res.json();

    document.getElementById('statTotal').textContent = stats.total;
    document.getElementById('statActive').textContent = stats.active;
    document.getElementById('statExpiring').textContent = stats.expiring_soon;
    document.getElementById('statExpired').textContent = stats.expired;
    document.getElementById('statClaimed').textContent = stats.claimed;
  } catch (err) {
    console.error('Error loading stats:', err);
  }
}

// Render Warranties
function renderWarranties(data) {
  const container = document.getElementById('warrantyList');
  const emptyState = document.getElementById('emptyState');

  if (!data || data.length === 0) {
    container.innerHTML = '';
    emptyState.style.display = 'block';
    return;
  }

  emptyState.style.display = 'none';

  container.innerHTML = data.map(warranty => `
    <div class="warranty-card ${isExpiringSoon(warranty) ? 'warranty-expiring' : ''}" onclick="openWarrantyDetail('${warranty.id}')">
      <div class="warranty-card-header">
        <div class="warranty-card-title">
          <span class="warranty-number">${warranty.warranty_number || 'WAR-????'}</span>
          ${getStatusBadge(warranty.status)}
          ${getTypeBadge(warranty.type)}
        </div>
        <div class="warranty-card-job">${warranty.job?.name || 'No Job'}</div>
      </div>
      <div class="warranty-card-body">
        <div class="warranty-name">${warranty.name}</div>
        <div class="warranty-meta">
          ${warranty.category ? `<span class="warranty-category">${formatCategory(warranty.category)}</span>` : ''}
          ${warranty.manufacturer ? `<span class="warranty-mfr">${warranty.manufacturer}</span>` : ''}
        </div>
      </div>
      <div class="warranty-card-footer">
        <span class="warranty-dates">
          ${formatDate(warranty.start_date)} - ${formatDate(warranty.end_date)}
        </span>
        <span class="warranty-remaining ${isExpiringSoon(warranty) ? 'expiring-soon' : ''}">
          ${getRemainingTime(warranty)}
        </span>
      </div>
    </div>
  `).join('');
}

// Check if expiring soon (within 90 days)
function isExpiringSoon(warranty) {
  if (warranty.status !== 'active') return false;
  const endDate = new Date(warranty.end_date);
  const today = new Date();
  const daysRemaining = Math.floor((endDate - today) / (1000 * 60 * 60 * 24));
  return daysRemaining <= 90 && daysRemaining > 0;
}

// Get remaining time text
function getRemainingTime(warranty) {
  if (warranty.status === 'expired') return 'Expired';
  if (warranty.status === 'void') return 'Void';

  const endDate = new Date(warranty.end_date);
  const today = new Date();
  const daysRemaining = Math.floor((endDate - today) / (1000 * 60 * 60 * 24));

  if (daysRemaining < 0) return 'Expired';
  if (daysRemaining === 0) return 'Expires today';
  if (daysRemaining === 1) return '1 day left';
  if (daysRemaining < 30) return `${daysRemaining} days left`;
  if (daysRemaining < 365) {
    const months = Math.floor(daysRemaining / 30);
    return `${months} month${months > 1 ? 's' : ''} left`;
  }
  const years = Math.floor(daysRemaining / 365);
  return `${years} year${years > 1 ? 's' : ''} left`;
}

// Get Status Badge
function getStatusBadge(status) {
  const map = {
    'active': { label: 'Active', class: 'badge-success' },
    'expired': { label: 'Expired', class: 'badge-danger' },
    'claimed': { label: 'Claimed', class: 'badge-warning' },
    'void': { label: 'Void', class: 'badge-secondary' }
  };
  const info = map[status] || { label: status, class: '' };
  return `<span class="badge ${info.class}">${info.label}</span>`;
}

// Get Type Badge
function getTypeBadge(type) {
  const map = {
    'manufacturer': 'Manufacturer',
    'contractor': 'Contractor',
    'extended': 'Extended',
    'labor': 'Labor'
  };
  return `<span class="badge badge-outline">${map[type] || type}</span>`;
}

// Format Category
function formatCategory(category) {
  const map = {
    'appliance': 'Appliance',
    'hvac': 'HVAC',
    'roofing': 'Roofing',
    'plumbing': 'Plumbing',
    'electrical': 'Electrical',
    'structural': 'Structural',
    'flooring': 'Flooring',
    'windows': 'Windows/Doors',
    'other': 'Other'
  };
  return map[category] || category;
}

// Format Date
function formatDate(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString();
}

// Apply Filters
function applyFilters() {
  const jobId = document.getElementById('jobFilter').value;
  const status = document.getElementById('statusFilter').value;
  const type = document.getElementById('typeFilter').value;
  const category = document.getElementById('categoryFilter').value;
  const search = document.getElementById('searchInput').value.toLowerCase();

  let filtered = warranties;

  if (jobId) {
    filtered = filtered.filter(w => w.job_id === jobId);
  }
  if (status) {
    filtered = filtered.filter(w => w.status === status);
  }
  if (type) {
    filtered = filtered.filter(w => w.type === type);
  }
  if (category) {
    filtered = filtered.filter(w => w.category === category);
  }
  if (search) {
    filtered = filtered.filter(w =>
      (w.name && w.name.toLowerCase().includes(search)) ||
      (w.warranty_number && w.warranty_number.toLowerCase().includes(search)) ||
      (w.manufacturer && w.manufacturer.toLowerCase().includes(search)) ||
      (w.model_number && w.model_number.toLowerCase().includes(search))
    );
  }

  renderWarranties(filtered);
}

// ============================================================
// MODAL FUNCTIONS
// ============================================================

// Open Create Modal
function openCreateModal() {
  document.getElementById('warrantyId').value = '';
  document.getElementById('warrantyModalTitle').textContent = 'New Warranty';
  document.getElementById('warrantyForm').reset();

  // Set default dates
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('warrantyStartDate').value = today;

  const modal = document.getElementById('warrantyModal');
  modal.style.display = 'flex';
  modal.classList.add('show');
}

// Close Create/Edit Modal
function closeWarrantyModal() {
  const modal = document.getElementById('warrantyModal');
  modal.classList.remove('show');
  modal.style.display = 'none';
}

// Open Warranty Detail
async function openWarrantyDetail(id) {
  try {
    const res = await fetch(`/api/warranties/${id}`);
    if (!res.ok) throw new Error('Failed to load warranty');
    currentWarranty = await res.json();

    populateDetailModal(currentWarranty);

    const modal = document.getElementById('warrantyDetailModal');
    modal.style.display = 'flex';
    modal.classList.add('show');
  } catch (err) {
    console.error('Error loading warranty:', err);
    showToast('Failed to load warranty details', 'error');
  }
}

// Populate Detail Modal
function populateDetailModal(warranty) {
  document.getElementById('detailWarrantyNumber').textContent = warranty.warranty_number || 'WAR-????';
  document.getElementById('detailStatus').textContent = warranty.status?.charAt(0).toUpperCase() + warranty.status?.slice(1) || 'Active';
  document.getElementById('detailStatus').className = `badge ${getStatusClass(warranty.status)}`;
  document.getElementById('detailType').textContent = warranty.type?.charAt(0).toUpperCase() + warranty.type?.slice(1) || 'Manufacturer';

  document.getElementById('detailName').textContent = warranty.name || '-';
  document.getElementById('detailCoverage').textContent = warranty.coverage_details || '-';
  document.getElementById('detailDescription').textContent = warranty.description || '-';

  // Product Info
  document.getElementById('detailJob').textContent = warranty.job?.name || '-';
  document.getElementById('detailCategory').textContent = formatCategory(warranty.category) || '-';
  document.getElementById('detailManufacturer').textContent = warranty.manufacturer || '-';
  document.getElementById('detailModel').textContent = warranty.model_number || '-';
  document.getElementById('detailSerial').textContent = warranty.serial_number || '-';
  document.getElementById('detailVendor').textContent = warranty.vendor?.name || '-';

  // Dates
  document.getElementById('detailStartDate').textContent = formatDate(warranty.start_date);
  document.getElementById('detailEndDate').textContent = formatDate(warranty.end_date);
  document.getElementById('detailInstallDate').textContent = formatDate(warranty.installation_date);
  document.getElementById('detailRemaining').textContent = getRemainingTime(warranty);

  // Contact
  document.getElementById('detailContactName').textContent = warranty.contact_name || '-';
  document.getElementById('detailContactPhone').textContent = warranty.contact_phone || '-';
  document.getElementById('detailContactEmail').textContent = warranty.contact_email || '-';

  // Claims
  renderClaims(warranty.claims || []);
}

// Get Status Class
function getStatusClass(status) {
  const map = {
    'active': 'badge-success',
    'expired': 'badge-danger',
    'claimed': 'badge-warning',
    'void': 'badge-secondary'
  };
  return map[status] || '';
}

// Render Claims
function renderClaims(claims) {
  const container = document.getElementById('claimsList');

  if (!claims || claims.length === 0) {
    container.innerHTML = '<p class="text-muted">No claims filed</p>';
    return;
  }

  container.innerHTML = claims.map(claim => `
    <div class="claim-item">
      <div class="claim-header">
        <span class="claim-number">${claim.claim_number}</span>
        <span class="badge ${getClaimStatusClass(claim.status)}">${formatClaimStatus(claim.status)}</span>
        <span class="claim-date">${formatDate(claim.claim_date)}</span>
      </div>
      <div class="claim-issue">${claim.issue_description}</div>
      ${claim.resolution_description ? `
        <div class="claim-resolution">
          <strong>Resolution:</strong> ${claim.resolution_description}
        </div>
      ` : ''}
      ${claim.claim_amount ? `<div class="claim-amount">Amount: $${parseFloat(claim.claim_amount).toLocaleString()}</div>` : ''}
    </div>
  `).join('');
}

// Format Claim Status
function formatClaimStatus(status) {
  const map = {
    'submitted': 'Submitted',
    'in_progress': 'In Progress',
    'approved': 'Approved',
    'denied': 'Denied',
    'completed': 'Completed'
  };
  return map[status] || status;
}

// Get Claim Status Class
function getClaimStatusClass(status) {
  const map = {
    'submitted': 'badge-info',
    'in_progress': 'badge-warning',
    'approved': 'badge-success',
    'denied': 'badge-danger',
    'completed': 'badge-success'
  };
  return map[status] || '';
}

// Close Detail Modal
function closeDetailModal() {
  const modal = document.getElementById('warrantyDetailModal');
  modal.classList.remove('show');
  modal.style.display = 'none';
  currentWarranty = null;
}

// Edit Current Warranty
function editCurrentWarranty() {
  if (!currentWarranty) return;

  document.getElementById('warrantyId').value = currentWarranty.id;
  document.getElementById('warrantyModalTitle').textContent = 'Edit Warranty';
  document.getElementById('warrantyJob').value = currentWarranty.job_id || '';
  document.getElementById('warrantyType').value = currentWarranty.type || 'manufacturer';
  document.getElementById('warrantyName').value = currentWarranty.name || '';
  document.getElementById('warrantyCategory').value = currentWarranty.category || '';
  document.getElementById('warrantyVendor').value = currentWarranty.vendor_id || '';
  document.getElementById('warrantyManufacturer').value = currentWarranty.manufacturer || '';
  document.getElementById('warrantyModel').value = currentWarranty.model_number || '';
  document.getElementById('warrantySerial').value = currentWarranty.serial_number || '';
  document.getElementById('warrantyInstallDate').value = currentWarranty.installation_date || '';
  document.getElementById('warrantyStartDate').value = currentWarranty.start_date || '';
  document.getElementById('warrantyEndDate').value = currentWarranty.end_date || '';
  document.getElementById('warrantyCoverage').value = currentWarranty.coverage_details || '';
  document.getElementById('warrantyContactName').value = currentWarranty.contact_name || '';
  document.getElementById('warrantyContactPhone').value = currentWarranty.contact_phone || '';
  document.getElementById('warrantyContactEmail').value = currentWarranty.contact_email || '';
  document.getElementById('warrantyDescription').value = currentWarranty.description || '';
  document.getElementById('warrantyNotes').value = currentWarranty.notes || '';

  closeDetailModal();

  const modal = document.getElementById('warrantyModal');
  modal.style.display = 'flex';
  modal.classList.add('show');
}

// Save Warranty
async function saveWarranty() {
  const id = document.getElementById('warrantyId').value;
  const data = {
    job_id: document.getElementById('warrantyJob').value,
    type: document.getElementById('warrantyType').value,
    name: document.getElementById('warrantyName').value,
    category: document.getElementById('warrantyCategory').value || null,
    vendor_id: document.getElementById('warrantyVendor').value || null,
    manufacturer: document.getElementById('warrantyManufacturer').value || null,
    model_number: document.getElementById('warrantyModel').value || null,
    serial_number: document.getElementById('warrantySerial').value || null,
    installation_date: document.getElementById('warrantyInstallDate').value || null,
    start_date: document.getElementById('warrantyStartDate').value,
    end_date: document.getElementById('warrantyEndDate').value,
    coverage_details: document.getElementById('warrantyCoverage').value || null,
    contact_name: document.getElementById('warrantyContactName').value || null,
    contact_phone: document.getElementById('warrantyContactPhone').value || null,
    contact_email: document.getElementById('warrantyContactEmail').value || null,
    description: document.getElementById('warrantyDescription').value || null,
    notes: document.getElementById('warrantyNotes').value || null
  };

  if (!data.job_id || !data.name || !data.start_date || !data.end_date) {
    showToast('Job, name, start date, and end date are required', 'error');
    return;
  }

  try {
    const url = id ? `/api/warranties/${id}` : '/api/warranties';
    const method = id ? 'PATCH' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to save warranty');
    }

    showToast(id ? 'Warranty updated' : 'Warranty created', 'success');
    closeWarrantyModal();
    await loadWarranties();
    loadStats();
  } catch (err) {
    console.error('Error saving warranty:', err);
    showToast(err.message, 'error');
  }
}

// Delete Warranty
async function deleteWarranty() {
  if (!currentWarranty) return;

  if (!confirm('Are you sure you want to delete this warranty?')) return;

  try {
    const res = await fetch(`/api/warranties/${currentWarranty.id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete warranty');

    showToast('Warranty deleted', 'success');
    closeDetailModal();
    await loadWarranties();
    loadStats();
  } catch (err) {
    console.error('Error deleting warranty:', err);
    showToast(err.message, 'error');
  }
}

// ============================================================
// CLAIMS
// ============================================================

// Open Claim Modal
function openClaimModal() {
  document.getElementById('claimForm').reset();
  document.getElementById('claimDate').value = new Date().toISOString().split('T')[0];

  const modal = document.getElementById('claimModal');
  modal.style.display = 'flex';
  modal.classList.add('show');
}

// Close Claim Modal
function closeClaimModal() {
  const modal = document.getElementById('claimModal');
  modal.classList.remove('show');
  modal.style.display = 'none';
}

// Submit Claim
async function submitClaim() {
  if (!currentWarranty) return;

  const data = {
    issue_description: document.getElementById('claimIssue').value,
    claim_date: document.getElementById('claimDate').value,
    claim_amount: document.getElementById('claimAmount').value || null,
    notes: document.getElementById('claimNotes').value || null,
    created_by: window.currentUser || 'User'
  };

  if (!data.issue_description || !data.claim_date) {
    showToast('Issue description and claim date are required', 'error');
    return;
  }

  try {
    const res = await fetch(`/api/warranties/${currentWarranty.id}/claims`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!res.ok) throw new Error('Failed to submit claim');

    showToast('Claim submitted', 'success');
    closeClaimModal();
    openWarrantyDetail(currentWarranty.id);
    loadStats();
  } catch (err) {
    console.error('Error submitting claim:', err);
    showToast(err.message, 'error');
  }
}

/**
 * Inspections Page JavaScript
 * Handles inspection scheduling, tracking, and deficiency management.
 */

// State
let state = {
  currentJobId: null,
  inspections: [],
  jobs: [],
  inspectionTypes: [],
  vendors: [],
  currentInspection: null,
  filters: {
    status: '',
    type: '',
    fromDate: '',
    toDate: '',
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
  }

  // Load initial data with error handling - don't let failures freeze the page
  try {
    await Promise.all([
      loadJobs().catch(err => console.error('Jobs load failed:', err)),
      loadInspectionTypes().catch(err => console.error('Types load failed:', err)),
      loadVendors().catch(err => console.error('Vendors load failed:', err))
    ]);
  } catch (err) {
    console.error('Initial data load failed:', err);
    showToast('Some data failed to load. Try refreshing.', 'error');
  }

  // Load inspections
  try {
    await loadInspections();
    await loadStats();
  } catch (err) {
    console.error('Inspections load failed:', err);
  }
});

// Listen for job changes from sidebar
window.addEventListener('jobChanged', (e) => {
  state.currentJobId = e.detail.jobId;
  loadInspections();
  loadStats();
});

async function loadJobs() {
  try {
    // Use cached data if available (5 min TTL)
    const jobs = await window.APICache?.fetch('/api/jobs') || await fetch('/api/jobs').then(r => r.json());
    state.jobs = jobs;

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
      formJob.value = state.currentJobId;
    }
  } catch (err) {
    console.error('Error loading jobs:', err);
    showToast('Failed to load jobs', 'error');
  }
}

async function loadInspectionTypes() {
  try {
    const res = await fetch('/api/inspections/types');
    const types = await res.json();
    state.inspectionTypes = types;

    // Populate type filter
    const typeFilter = document.getElementById('typeFilter');
    typeFilter.innerHTML = '<option value="">All Types</option>';
    types.forEach(type => {
      const opt = document.createElement('option');
      opt.value = type;
      opt.textContent = type;
      typeFilter.appendChild(opt);
    });

    // Populate form type select
    const formType = document.getElementById('formType');
    formType.innerHTML = '<option value="">Select Type...</option>';
    types.forEach(type => {
      const opt = document.createElement('option');
      opt.value = type;
      opt.textContent = type;
      formType.appendChild(opt);
    });
  } catch (err) {
    console.error('Error loading inspection types:', err);
    showToast('Failed to load inspection types', 'error');
  }
}

async function loadVendors() {
  try {
    // Use cached data if available (5 min TTL)
    state.vendors = await window.APICache?.fetch('/api/vendors') || await fetch('/api/vendors').then(r => r.json());
  } catch (err) {
    console.error('Error loading vendors:', err);
    state.vendors = [];
  }
}

function setupEventListeners() {
  // Filters
  document.getElementById('statusFilter').addEventListener('change', (e) => {
    state.filters.status = e.target.value;
    loadInspections();
  });

  document.getElementById('typeFilter').addEventListener('change', (e) => {
    state.filters.type = e.target.value;
    loadInspections();
  });

  document.getElementById('fromDateFilter').addEventListener('change', (e) => {
    state.filters.fromDate = e.target.value;
    loadInspections();
  });

  document.getElementById('toDateFilter').addEventListener('change', (e) => {
    state.filters.toDate = e.target.value;
    loadInspections();
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
      loadInspections();
    }, 300);
  });
}

function clearSearch() {
  document.getElementById('searchInput').value = '';
  document.getElementById('searchClear').style.display = 'none';
  state.filters.search = '';
  loadInspections();
}

// ============================================================
// DATA LOADING
// ============================================================

// Skeleton loading HTML
const SKELETON_LOADING = `
  <div class="skeleton-card"><div class="skeleton-line long"></div><div class="skeleton-line medium"></div><div class="skeleton-line short"></div></div>
  <div class="skeleton-card"><div class="skeleton-line long"></div><div class="skeleton-line medium"></div><div class="skeleton-line short"></div></div>
  <div class="skeleton-card"><div class="skeleton-line long"></div><div class="skeleton-line medium"></div><div class="skeleton-line short"></div></div>
`;

async function loadInspections() {
  const list = document.getElementById('inspectionList');
  list.innerHTML = SKELETON_LOADING;

  try {
    const params = new URLSearchParams();
    if (state.currentJobId) params.append('job_id', state.currentJobId);
    if (state.filters.status) params.append('result', state.filters.status);
    if (state.filters.type) params.append('type', state.filters.type);
    if (state.filters.fromDate) params.append('from_date', state.filters.fromDate);
    if (state.filters.toDate) params.append('to_date', state.filters.toDate);
    if (state.filters.search) params.append('search', state.filters.search);

    const res = await fetch(`/api/inspections?${params}`);
    const inspections = await res.json();
    state.inspections = inspections;

    renderInspectionsList(inspections);
  } catch (err) {
    console.error('Error loading inspections:', err);
    list.innerHTML = '<div class="error-state">Failed to load inspections</div>';
    showToast('Failed to load inspections', 'error');
  }
}

async function loadStats() {
  if (!state.currentJobId) {
    document.getElementById('statScheduled').textContent = '-';
    document.getElementById('statPassed').textContent = '-';
    document.getElementById('statFailed').textContent = '-';
    document.getElementById('statUpcoming').textContent = '-';
    return;
  }

  try {
    const res = await fetch(`/api/inspections/stats?job_id=${state.currentJobId}`);
    const stats = await res.json();

    document.getElementById('statScheduled').textContent = stats.scheduled || 0;
    document.getElementById('statPassed').textContent = stats.passed || 0;
    document.getElementById('statFailed').textContent = stats.failed || 0;
    document.getElementById('statUpcoming').textContent = stats.upcoming || 0;
  } catch (err) {
    console.error('Error loading stats:', err);
  }
}

// ============================================================
// RENDERING
// ============================================================

function renderInspectionsList(inspections) {
  const list = document.getElementById('inspectionList');

  if (!inspections || inspections.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📋</div>
        <h3>No inspections found</h3>
        <p>Schedule your first inspection to get started.</p>
        <button class="btn btn-primary" onclick="openCreateModal()">+ New Inspection</button>
      </div>
    `;
    return;
  }

  // Group by date
  const grouped = {};
  inspections.forEach(insp => {
    const date = insp.scheduled_date;
    if (!grouped[date]) grouped[date] = [];
    grouped[date].push(insp);
  });

  let html = '';
  Object.keys(grouped).sort((a, b) => new Date(b) - new Date(a)).forEach(date => {
    const dateInsp = grouped[date];
    const formattedDate = formatDate(date);

    html += `<div class="inspection-date-group">`;
    html += `<div class="date-header">${formattedDate}</div>`;

    dateInsp.forEach(insp => {
      html += renderInspectionCard(insp);
    });

    html += `</div>`;
  });

  list.innerHTML = html;
}

function renderInspectionCard(inspection) {
  const statusBadge = getStatusBadge(inspection.result);
  const typeLabel = `${inspection.inspection_type} #${inspection.inspection_number || 1}`;
  const isReinspection = inspection.reinspection_count > 0;

  let inspectorInfo = '';
  if (inspection.inspector_name) {
    inspectorInfo = `Inspector: ${inspection.inspector_name}`;
    if (inspection.inspector_agency) {
      inspectorInfo += ` &bull; ${inspection.inspector_agency}`;
    }
  } else if (inspection.inspector_agency) {
    inspectorInfo = inspection.inspector_agency;
  } else {
    inspectorInfo = 'Inspector: TBD';
  }

  let deficiencyInfo = '';
  if (inspection.result === 'failed' && inspection.open_deficiency_count > 0) {
    deficiencyInfo = `<div class="deficiency-count">${inspection.open_deficiency_count} open deficienc${inspection.open_deficiency_count === 1 ? 'y' : 'ies'}</div>`;
  }

  let reinspectionInfo = '';
  if (inspection.next_reinspection) {
    reinspectionInfo = `<div class="reinspection-link">Re-inspection scheduled: ${formatDate(inspection.next_reinspection.scheduled_date)}</div>`;
  }

  let reinspectionBadge = '';
  if (isReinspection) {
    reinspectionBadge = `<span class="badge badge-reinspection">Re-inspection #${inspection.reinspection_count}</span>`;
  }

  const jobName = !state.currentJobId && inspection.job ? inspection.job.name : '';

  return `
    <div class="inspection-card" onclick="viewInspection('${inspection.id}')">
      <div class="inspection-card-header">
        <div class="inspection-type">
          ${typeLabel}
          ${reinspectionBadge}
        </div>
        ${statusBadge}
      </div>
      <div class="inspection-card-body">
        ${jobName ? `<div class="inspection-job">${jobName}</div>` : ''}
        <div class="inspection-inspector">${inspectorInfo}</div>
        ${inspection.scheduled_time ? `<div class="inspection-time">Time: ${formatTime(inspection.scheduled_time)}</div>` : ''}
        ${deficiencyInfo}
        ${reinspectionInfo}
      </div>
    </div>
  `;
}

function getStatusBadge(result) {
  const badges = {
    scheduled: '<span class="status-badge status-pending">Scheduled</span>',
    passed: '<span class="status-badge status-approved">Passed</span>',
    failed: '<span class="status-badge status-denied">Failed</span>',
    partial: '<span class="status-badge status-warning">Partial</span>',
    cancelled: '<span class="status-badge status-cancelled">Cancelled</span>',
    no_show: '<span class="status-badge status-no-show">No Show</span>'
  };
  return badges[result] || badges.scheduled;
}

// ============================================================
// CREATE/EDIT MODAL
// ============================================================

function openCreateModal() {
  resetForm();
  document.getElementById('modalTitle').textContent = 'Schedule Inspection';
  document.getElementById('resultSection').style.display = 'none';
  document.getElementById('deleteBtn').style.display = 'none';

  // Pre-fill job if selected
  if (state.currentJobId) {
    document.getElementById('formJob').value = state.currentJobId;
  }

  // Set default date to today
  document.getElementById('formDate').value = new Date().toISOString().split('T')[0];

  const modal = document.getElementById('inspectionModal');
  modal.style.display = 'flex';
  modal.classList.add('show');
}

async function openEditModal(inspectionId) {
  resetForm();
  document.getElementById('modalTitle').textContent = 'Edit Inspection';
  document.getElementById('resultSection').style.display = 'block';
  document.getElementById('deleteBtn').style.display = 'block';

  try {
    const res = await fetch(`/api/inspections/${inspectionId}`);
    const inspection = await res.json();
    state.currentInspection = inspection;

    // Fill form
    document.getElementById('inspectionId').value = inspection.id;
    document.getElementById('formJob').value = inspection.job_id;
    document.getElementById('formType').value = inspection.inspection_type;
    document.getElementById('formDate').value = inspection.scheduled_date;
    document.getElementById('formTime').value = inspection.scheduled_time || '';
    document.getElementById('formInspectorName').value = inspection.inspector_name || '';
    document.getElementById('formInspectorPhone').value = inspection.inspector_phone || '';
    document.getElementById('formInspectorAgency').value = inspection.inspector_agency || '';
    document.getElementById('formResult').value = inspection.result;
    document.getElementById('formResultDate').value = inspection.result_date || '';
    document.getElementById('formResultNotes').value = inspection.result_notes || '';

    const modal = document.getElementById('inspectionModal');
    modal.style.display = 'flex';
    modal.classList.add('show');
  } catch (err) {
    console.error('Error loading inspection:', err);
    showToast('Failed to load inspection details', 'error');
  }
}

function closeModal() {
  const modal = document.getElementById('inspectionModal');
  modal.classList.remove('show');
  modal.style.display = 'none';
  resetForm();
}

function resetForm() {
  document.getElementById('inspectionForm').reset();
  document.getElementById('inspectionId').value = '';
  state.currentInspection = null;
}

async function saveInspection() {
  const id = document.getElementById('inspectionId').value;
  const jobId = document.getElementById('formJob').value;
  const type = document.getElementById('formType').value;
  const date = document.getElementById('formDate').value;
  const time = document.getElementById('formTime').value;

  if (!jobId || !type || !date) {
    showToast('Please fill in all required fields', 'error');
    return;
  }

  const payload = {
    job_id: jobId,
    inspection_type: type,
    scheduled_date: date,
    scheduled_time: time || null,
    inspector_name: document.getElementById('formInspectorName').value || null,
    inspector_phone: document.getElementById('formInspectorPhone').value || null,
    inspector_agency: document.getElementById('formInspectorAgency').value || null,
    created_by: CURRENT_USER
  };

  // If editing, include result fields
  if (id) {
    payload.result = document.getElementById('formResult').value;
    payload.result_date = document.getElementById('formResultDate').value || null;
    payload.result_notes = document.getElementById('formResultNotes').value || null;
    payload.updated_by = CURRENT_USER;
  }

  try {
    const url = id ? `/api/inspections/${id}` : '/api/inspections';
    const method = id ? 'PATCH' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error);
    }

    showToast(id ? 'Inspection updated' : 'Inspection scheduled', 'success');
    closeModal();
    loadInspections();
    loadStats();
  } catch (err) {
    console.error('Error saving inspection:', err);
    showToast('Failed to save inspection: ' + err.message, 'error');
  }
}

async function deleteInspection() {
  const id = document.getElementById('inspectionId').value;
  if (!id) return;

  if (!confirm('Are you sure you want to delete this inspection?')) return;

  try {
    const res = await fetch(`/api/inspections/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deleted_by: CURRENT_USER })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error);
    }

    showToast('Inspection deleted', 'success');
    closeModal();
    closeDetailModal();
    loadInspections();
    loadStats();
  } catch (err) {
    console.error('Error deleting inspection:', err);
    showToast('Failed to delete inspection: ' + err.message, 'error');
  }
}

// ============================================================
// DETAIL MODAL
// ============================================================

async function viewInspection(inspectionId) {
  const modal = document.getElementById('detailModal');
  modal.style.display = 'flex';
  modal.classList.add('show');
  document.getElementById('detailContent').innerHTML = '<div class="loading">Loading...</div>';

  try {
    const res = await fetch(`/api/inspections/${inspectionId}`);
    const inspection = await res.json();
    state.currentInspection = inspection;

    renderDetailContent(inspection);
    renderDetailActions(inspection);
  } catch (err) {
    console.error('Error loading inspection:', err);
    document.getElementById('detailContent').innerHTML = '<div class="error-state">Failed to load inspection</div>';
  }
}

function renderDetailContent(inspection) {
  const jobName = inspection.job?.name || 'Unknown Job';
  const typeLabel = `${inspection.inspection_type} #${inspection.inspection_number || 1}`;

  // Update header
  document.getElementById('detailTitle').textContent = typeLabel;
  document.getElementById('detailStatus').className = `status-badge status-${getStatusClass(inspection.result)}`;
  document.getElementById('detailStatus').textContent = inspection.result.charAt(0).toUpperCase() + inspection.result.slice(1);

  let html = `
    <div class="detail-section">
      <div class="detail-grid">
        <div class="detail-item">
          <label>Job</label>
          <span>${jobName}</span>
        </div>
        <div class="detail-item">
          <label>Scheduled Date</label>
          <span>${formatDate(inspection.scheduled_date)}${inspection.scheduled_time ? ` at ${formatTime(inspection.scheduled_time)}` : ''}</span>
        </div>
        <div class="detail-item">
          <label>Inspector</label>
          <span>${inspection.inspector_name || 'TBD'}</span>
        </div>
        <div class="detail-item">
          <label>Agency</label>
          <span>${inspection.inspector_agency || '-'}</span>
        </div>
        ${inspection.inspector_phone ? `
        <div class="detail-item">
          <label>Phone</label>
          <span><a href="tel:${inspection.inspector_phone}">${inspection.inspector_phone}</a></span>
        </div>
        ` : ''}
      </div>
    </div>
  `;

  // Result section
  if (inspection.result !== 'scheduled') {
    html += `
      <div class="detail-section">
        <h4>Result</h4>
        <div class="detail-grid">
          <div class="detail-item">
            <label>Status</label>
            <span>${inspection.result.charAt(0).toUpperCase() + inspection.result.slice(1)}</span>
          </div>
          ${inspection.result_date ? `
          <div class="detail-item">
            <label>Result Date</label>
            <span>${formatDate(inspection.result_date)}</span>
          </div>
          ` : ''}
        </div>
        ${inspection.result_notes ? `<div class="detail-notes">${inspection.result_notes}</div>` : ''}
      </div>
    `;
  }

  // Parent inspection link
  if (inspection.parent_inspection) {
    html += `
      <div class="detail-section">
        <h4>Original Inspection</h4>
        <div class="linked-inspection" onclick="viewInspection('${inspection.parent_inspection.id}')">
          ${inspection.parent_inspection.inspection_type} #${inspection.parent_inspection.inspection_number} -
          ${formatDate(inspection.parent_inspection.scheduled_date)}
          (${inspection.parent_inspection.result})
        </div>
      </div>
    `;
  }

  // Re-inspections list
  if (inspection.reinspections && inspection.reinspections.length > 0) {
    html += `
      <div class="detail-section">
        <h4>Re-inspections</h4>
        <div class="reinspection-list">
          ${inspection.reinspections.map(ri => `
            <div class="linked-inspection" onclick="viewInspection('${ri.id}')">
              Re-inspection #${ri.reinspection_count} - ${formatDate(ri.scheduled_date)}
              ${getStatusBadge(ri.result)}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // Deficiencies
  if (inspection.deficiencies && inspection.deficiencies.length > 0) {
    html += `
      <div class="detail-section">
        <h4>Deficiencies (${inspection.deficiencies.length})</h4>
        <div class="deficiency-list">
          ${inspection.deficiencies.map(d => `
            <div class="deficiency-item deficiency-${d.status}">
              <div class="deficiency-header">
                <span class="severity-badge severity-${d.severity}">${d.severity}</span>
                <span class="deficiency-status">${d.status}</span>
              </div>
              <div class="deficiency-description">${d.description}</div>
              ${d.location ? `<div class="deficiency-location">Location: ${d.location}</div>` : ''}
              ${d.vendor ? `<div class="deficiency-vendor">Assigned: ${d.vendor.name}</div>` : ''}
              ${d.status === 'resolved' ? `
                <div class="deficiency-resolution">
                  Resolved by ${d.resolved_by || 'Unknown'} on ${formatDate(d.resolved_at)}
                  ${d.resolution_notes ? `<br>${d.resolution_notes}` : ''}
                </div>
              ` : `
                <button class="btn btn-sm btn-success" onclick="event.stopPropagation(); resolveDeficiency('${d.id}')">Mark Resolved</button>
              `}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // Activity log
  if (inspection.activity && inspection.activity.length > 0) {
    const sortedActivity = [...inspection.activity].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    html += `
      <div class="detail-section">
        <h4>Activity Log</h4>
        <div class="activity-log">
          ${sortedActivity.slice(0, 10).map(a => `
            <div class="activity-item">
              <span class="activity-action">${formatAction(a.action)}</span>
              <span class="activity-by">${a.performed_by || 'System'}</span>
              <span class="activity-time">${formatDateTime(a.created_at)}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  document.getElementById('detailContent').innerHTML = html;
}

function getStatusClass(result) {
  const classes = {
    scheduled: 'pending',
    passed: 'approved',
    failed: 'denied',
    partial: 'warning',
    cancelled: 'cancelled',
    no_show: 'no-show'
  };
  return classes[result] || 'pending';
}

function renderDetailActions(inspection) {
  const actionsEl = document.getElementById('detailActions');
  let html = '';

  if (inspection.result === 'scheduled') {
    html += `
      <button class="btn btn-success" onclick="openResultModal('pass')">Pass</button>
      <button class="btn btn-danger" onclick="openResultModal('fail')">Fail</button>
      <button class="btn btn-secondary" onclick="openRescheduleModal()">Reschedule</button>
      <button class="btn btn-warning" onclick="cancelInspection()">Cancel</button>
    `;
  } else if (inspection.result === 'failed') {
    html += `
      <button class="btn btn-primary" onclick="openReinspectModal()">Schedule Re-inspection</button>
    `;
  }

  actionsEl.innerHTML = html;
}

function closeDetailModal() {
  const modal = document.getElementById('detailModal');
  modal.classList.remove('show');
  modal.style.display = 'none';
  state.currentInspection = null;
}

function editFromDetail() {
  if (state.currentInspection) {
    closeDetailModal();
    openEditModal(state.currentInspection.id);
  }
}

// ============================================================
// RESULT MODAL (Pass/Fail)
// ============================================================

function openResultModal(action) {
  if (!state.currentInspection) return;

  document.getElementById('resultInspectionId').value = state.currentInspection.id;
  document.getElementById('resultAction').value = action;
  document.getElementById('resultFormDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('resultFormNotes').value = '';

  const title = action === 'pass' ? 'Record Passed Inspection' : 'Record Failed Inspection';
  document.getElementById('resultModalTitle').textContent = title;

  const submitBtn = document.getElementById('resultSubmitBtn');
  if (action === 'pass') {
    submitBtn.textContent = 'Mark Passed';
    submitBtn.className = 'btn btn-success';
    document.getElementById('resultDeficienciesSection').style.display = 'none';
  } else {
    submitBtn.textContent = 'Mark Failed';
    submitBtn.className = 'btn btn-danger';
    document.getElementById('resultDeficienciesSection').style.display = 'block';
    document.getElementById('resultDeficienciesList').innerHTML = '';
    addResultDeficiencyRow();
  }

  const modal = document.getElementById('resultModal');
  modal.style.display = 'flex';
  modal.classList.add('show');
}

function closeResultModal() {
  const modal = document.getElementById('resultModal');
  modal.classList.remove('show');
  modal.style.display = 'none';
}

function addResultDeficiencyRow() {
  const list = document.getElementById('resultDeficienciesList');

  const row = document.createElement('div');
  row.className = 'deficiency-form-row';
  row.innerHTML = `
    <input type="text" class="form-control def-description" placeholder="Description *">
    <input type="text" class="form-control def-location" placeholder="Location">
    <select class="form-control def-severity">
      <option value="minor">Minor</option>
      <option value="major">Major</option>
      <option value="critical">Critical</option>
    </select>
    <button type="button" class="btn btn-sm btn-danger" onclick="this.parentElement.remove()">X</button>
  `;
  list.appendChild(row);
}

async function submitResult() {
  const id = document.getElementById('resultInspectionId').value;
  const action = document.getElementById('resultAction').value;
  const resultDate = document.getElementById('resultFormDate').value;
  const resultNotes = document.getElementById('resultFormNotes').value;

  if (!resultDate) {
    showToast('Please enter the result date', 'error');
    return;
  }

  const payload = {
    result_date: resultDate,
    result_notes: resultNotes,
    performed_by: CURRENT_USER
  };

  // Collect deficiencies for fail
  if (action === 'fail') {
    const defRows = document.querySelectorAll('#resultDeficienciesList .deficiency-form-row');
    const deficiencies = [];

    defRows.forEach(row => {
      const desc = row.querySelector('.def-description').value.trim();
      if (desc) {
        deficiencies.push({
          description: desc,
          location: row.querySelector('.def-location').value.trim() || null,
          severity: row.querySelector('.def-severity').value
        });
      }
    });

    payload.deficiencies = deficiencies;
  }

  try {
    const endpoint = action === 'pass' ? 'pass' : 'fail';
    const res = await fetch(`/api/inspections/${id}/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error);
    }

    showToast(`Inspection marked as ${action}ed`, 'success');
    closeResultModal();
    viewInspection(id);
    loadInspections();
    loadStats();
  } catch (err) {
    console.error('Error recording result:', err);
    showToast('Failed to record result: ' + err.message, 'error');
  }
}

// ============================================================
// CANCEL INSPECTION
// ============================================================

async function cancelInspection() {
  if (!state.currentInspection) return;

  const reason = prompt('Reason for cancellation (optional):');

  try {
    const res = await fetch(`/api/inspections/${state.currentInspection.id}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        result_notes: reason || null,
        performed_by: CURRENT_USER
      })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error);
    }

    showToast('Inspection cancelled', 'success');
    viewInspection(state.currentInspection.id);
    loadInspections();
    loadStats();
  } catch (err) {
    console.error('Error cancelling inspection:', err);
    showToast('Failed to cancel inspection: ' + err.message, 'error');
  }
}

// ============================================================
// RESCHEDULE MODAL
// ============================================================

function openRescheduleModal() {
  if (!state.currentInspection) return;

  document.getElementById('rescheduleInspectionId').value = state.currentInspection.id;
  document.getElementById('rescheduleDate').value = '';
  document.getElementById('rescheduleTime').value = state.currentInspection.scheduled_time || '';
  document.getElementById('rescheduleNotes').value = '';

  const modal = document.getElementById('rescheduleModal');
  modal.style.display = 'flex';
  modal.classList.add('show');
}

function closeRescheduleModal() {
  const modal = document.getElementById('rescheduleModal');
  modal.classList.remove('show');
  modal.style.display = 'none';
}

async function submitReschedule() {
  const id = document.getElementById('rescheduleInspectionId').value;
  const newDate = document.getElementById('rescheduleDate').value;
  const newTime = document.getElementById('rescheduleTime').value;
  const notes = document.getElementById('rescheduleNotes').value;

  if (!newDate) {
    showToast('Please select a new date', 'error');
    return;
  }

  try {
    const res = await fetch(`/api/inspections/${id}/reschedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scheduled_date: newDate,
        scheduled_time: newTime || null,
        result_notes: notes || null,
        performed_by: CURRENT_USER
      })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error);
    }

    showToast('Inspection rescheduled', 'success');
    closeRescheduleModal();
    viewInspection(id);
    loadInspections();
  } catch (err) {
    console.error('Error rescheduling:', err);
    showToast('Failed to reschedule: ' + err.message, 'error');
  }
}

// ============================================================
// RE-INSPECTION MODAL
// ============================================================

function openReinspectModal() {
  if (!state.currentInspection) return;

  document.getElementById('reinspectParentId').value = state.currentInspection.id;
  document.getElementById('reinspectDate').value = '';
  document.getElementById('reinspectTime').value = state.currentInspection.scheduled_time || '';

  const modal = document.getElementById('reinspectModal');
  modal.style.display = 'flex';
  modal.classList.add('show');
}

function closeReinspectModal() {
  const modal = document.getElementById('reinspectModal');
  modal.classList.remove('show');
  modal.style.display = 'none';
}

async function submitReinspect() {
  const parentId = document.getElementById('reinspectParentId').value;
  const date = document.getElementById('reinspectDate').value;
  const time = document.getElementById('reinspectTime').value;

  if (!date) {
    showToast('Please select a date for the re-inspection', 'error');
    return;
  }

  try {
    const res = await fetch(`/api/inspections/${parentId}/reinspect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scheduled_date: date,
        scheduled_time: time || null,
        created_by: CURRENT_USER
      })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error);
    }

    const newInspection = await res.json();

    showToast('Re-inspection scheduled', 'success');
    closeReinspectModal();
    closeDetailModal();
    viewInspection(newInspection.id);
    loadInspections();
    loadStats();
  } catch (err) {
    console.error('Error creating re-inspection:', err);
    showToast('Failed to create re-inspection: ' + err.message, 'error');
  }
}

// ============================================================
// DEFICIENCIES
// ============================================================

async function resolveDeficiency(deficiencyId) {
  const notes = prompt('Resolution notes (optional):');

  try {
    const res = await fetch(`/api/inspections/deficiencies/${deficiencyId}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        resolved_by: CURRENT_USER,
        resolution_notes: notes || null
      })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error);
    }

    showToast('Deficiency resolved', 'success');

    // Refresh the detail view
    if (state.currentInspection) {
      viewInspection(state.currentInspection.id);
    }
  } catch (err) {
    console.error('Error resolving deficiency:', err);
    showToast('Failed to resolve deficiency: ' + err.message, 'error');
  }
}

// ============================================================
// UTILITIES
// ============================================================

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

function formatTime(timeStr) {
  if (!timeStr) return '';
  const [hours, minutes] = timeStr.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}

function formatDateTime(dateTimeStr) {
  if (!dateTimeStr) return '-';
  const date = new Date(dateTimeStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

function formatAction(action) {
  const actions = {
    'created': 'Created',
    'updated': 'Updated',
    'deleted': 'Deleted',
    'passed': 'Marked Passed',
    'failed': 'Marked Failed',
    'cancelled': 'Cancelled',
    'rescheduled': 'Rescheduled',
    'reinspection_created': 'Re-inspection Created',
    'deficiency_added': 'Deficiency Added',
    'deficiency_updated': 'Deficiency Updated',
    'deficiency_resolved': 'Deficiency Resolved',
    'photo_uploaded': 'Photo Uploaded',
    'photo_deleted': 'Photo Deleted'
  };
  return actions[action] || action;
}

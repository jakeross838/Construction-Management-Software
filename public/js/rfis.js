/**
 * RFIs Page JavaScript
 * Manages Requests for Information
 */

// ============================================================
// STATE
// ============================================================

let allRfis = [];
let allJobs = [];
let currentRfi = null;

// ============================================================
// INITIALIZATION
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
  setupEventListeners();
  await loadJobs();
  await loadRfis();
  await loadStats();
});

function setupEventListeners() {
  // Filters
  document.getElementById('jobFilter').addEventListener('change', applyFilters);
  document.getElementById('statusFilter').addEventListener('change', applyFilters);
  document.getElementById('priorityFilter').addEventListener('change', applyFilters);

  // Search
  let searchTimer;
  document.getElementById('searchInput').addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(applyFilters, 150);
  });

  // Impact checkboxes
  document.getElementById('hasCostImpact').addEventListener('change', (e) => {
    document.getElementById('costImpactAmount').style.display = e.target.checked ? 'block' : 'none';
  });
  document.getElementById('hasScheduleImpact').addEventListener('change', (e) => {
    document.getElementById('scheduleImpactDays').style.display = e.target.checked ? 'block' : 'none';
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

    const jobFilter = document.getElementById('jobFilter');
    const rfiJob = document.getElementById('rfiJob');

    allJobs.forEach(job => {
      jobFilter.innerHTML += `<option value="${job.id}">${job.name}</option>`;
      rfiJob.innerHTML += `<option value="${job.id}">${job.name}</option>`;
    });
  } catch (err) {
    console.error('Failed to load jobs:', err);
  }
}

async function loadRfis() {
  try {
    const jobId = document.getElementById('jobFilter').value;
    const status = document.getElementById('statusFilter').value;
    const priority = document.getElementById('priorityFilter').value;

    let url = '/api/rfis?';
    if (jobId) url += `job_id=${jobId}&`;
    if (status) url += `status=${status}&`;
    if (priority) url += `priority=${priority}&`;

    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to load RFIs');
    allRfis = await res.json();

    renderRfis();
  } catch (err) {
    console.error('Failed to load RFIs:', err);
    showToast('Failed to load RFIs', 'error');
  }
}

async function loadStats() {
  try {
    const jobId = document.getElementById('jobFilter').value;
    let url = '/api/rfis/stats';
    if (jobId) url += `?job_id=${jobId}`;

    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to load stats');
    const stats = await res.json();

    document.getElementById('statTotal').textContent = stats.total;
    document.getElementById('statOpen').textContent = stats.open;
    document.getElementById('statPending').textContent = stats.pending;
    document.getElementById('statAnswered').textContent = stats.answered;
    document.getElementById('statClosed').textContent = stats.closed;
  } catch (err) {
    console.error('Failed to load stats:', err);
  }
}

function applyFilters() {
  loadRfis();
  loadStats();
}

// ============================================================
// RENDERING
// ============================================================

function renderRfis() {
  const container = document.getElementById('rfiList');
  const emptyState = document.getElementById('emptyState');
  const search = document.getElementById('searchInput').value.toLowerCase();

  let filtered = allRfis;
  if (search) {
    filtered = allRfis.filter(rfi =>
      rfi.rfi_number?.toLowerCase().includes(search) ||
      rfi.subject?.toLowerCase().includes(search) ||
      rfi.question?.toLowerCase().includes(search) ||
      rfi.job?.name?.toLowerCase().includes(search)
    );
  }

  if (filtered.length === 0) {
    container.innerHTML = '';
    emptyState.style.display = 'flex';
    return;
  }

  emptyState.style.display = 'none';
  container.innerHTML = filtered.map(rfi => renderRfiCard(rfi)).join('');
}

function renderRfiCard(rfi) {
  const statusClass = {
    open: 'badge-info',
    pending: 'badge-warning',
    answered: 'badge-success',
    closed: 'badge-secondary'
  }[rfi.status] || 'badge-secondary';

  const priorityClass = {
    urgent: 'badge-danger',
    high: 'badge-warning',
    normal: 'badge-secondary',
    low: 'badge-info'
  }[rfi.priority] || 'badge-secondary';

  const isOverdue = rfi.due_date && new Date(rfi.due_date) < new Date() && rfi.status !== 'closed';

  return `
    <div class="rfi-card ${isOverdue ? 'overdue' : ''}" onclick="openRfiDetail('${rfi.id}')">
      <div class="rfi-card-header">
        <div class="rfi-card-number">${rfi.rfi_number}</div>
        <div class="rfi-card-badges">
          <span class="badge ${statusClass}">${rfi.status}</span>
          ${rfi.priority !== 'normal' ? `<span class="badge ${priorityClass}">${rfi.priority}</span>` : ''}
        </div>
      </div>
      <div class="rfi-card-subject">${escapeHtml(rfi.subject)}</div>
      <div class="rfi-card-job">${escapeHtml(rfi.job?.name || 'No Job')}</div>
      <div class="rfi-card-footer">
        <span class="rfi-date">${formatDate(rfi.created_at)}</span>
        ${rfi.due_date ? `<span class="rfi-due ${isOverdue ? 'overdue' : ''}">Due: ${formatDate(rfi.due_date)}</span>` : ''}
      </div>
    </div>
  `;
}

// ============================================================
// CREATE/EDIT MODAL
// ============================================================

function openCreateModal() {
  document.getElementById('rfiModalTitle').textContent = 'New RFI';
  document.getElementById('rfiForm').reset();
  document.getElementById('rfiId').value = '';
  document.getElementById('rfiSubmittedBy').value = window.currentUser || 'User';

  const modal = document.getElementById('rfiModal');
  modal.style.display = 'flex';
  modal.classList.add('show');
}

function openEditModal(rfi) {
  document.getElementById('rfiModalTitle').textContent = 'Edit RFI';
  document.getElementById('rfiId').value = rfi.id;
  document.getElementById('rfiJob').value = rfi.job_id;
  document.getElementById('rfiPriority').value = rfi.priority || 'normal';
  document.getElementById('rfiSubject').value = rfi.subject;
  document.getElementById('rfiQuestion').value = rfi.question;
  document.getElementById('rfiDrawings').value = rfi.reference_drawings || '';
  document.getElementById('rfiSpecs').value = rfi.reference_specs || '';
  document.getElementById('rfiAssignedTo').value = rfi.assigned_to || '';
  document.getElementById('rfiDueDate').value = rfi.due_date || '';
  document.getElementById('rfiDateRequired').value = rfi.date_required || '';
  document.getElementById('rfiSubmittedBy').value = rfi.submitted_by || window.currentUser || 'User';
  document.getElementById('rfiNotes').value = rfi.notes || '';

  const modal = document.getElementById('rfiModal');
  modal.style.display = 'flex';
  modal.classList.add('show');
}

function closeRfiModal() {
  const modal = document.getElementById('rfiModal');
  modal.classList.remove('show');
  modal.style.display = 'none';
}

async function saveRfi() {
  const id = document.getElementById('rfiId').value;
  const data = {
    job_id: document.getElementById('rfiJob').value,
    priority: document.getElementById('rfiPriority').value,
    subject: document.getElementById('rfiSubject').value.trim(),
    question: document.getElementById('rfiQuestion').value.trim(),
    reference_drawings: document.getElementById('rfiDrawings').value.trim() || null,
    reference_specs: document.getElementById('rfiSpecs').value.trim() || null,
    assigned_to: document.getElementById('rfiAssignedTo').value.trim() || null,
    due_date: document.getElementById('rfiDueDate').value || null,
    date_required: document.getElementById('rfiDateRequired').value || null,
    submitted_by: document.getElementById('rfiSubmittedBy').value.trim() || window.currentUser || 'User',
    notes: document.getElementById('rfiNotes').value.trim() || null
  };

  if (!data.job_id || !data.subject || !data.question) {
    showToast('Please fill in all required fields', 'error');
    return;
  }

  try {
    const url = id ? `/api/rfis/${id}` : '/api/rfis';
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

    showToast(id ? 'RFI updated' : 'RFI created', 'success');
    closeRfiModal();
    await loadRfis();
    await loadStats();
  } catch (err) {
    console.error('Save error:', err);
    showToast(err.message, 'error');
  }
}

// ============================================================
// DETAIL MODAL
// ============================================================

async function openRfiDetail(id) {
  try {
    const res = await fetch(`/api/rfis/${id}`);
    if (!res.ok) throw new Error('Failed to load RFI');
    currentRfi = await res.json();

    renderRfiDetail();

    const modal = document.getElementById('rfiDetailModal');
    modal.style.display = 'flex';
    modal.classList.add('show');
  } catch (err) {
    console.error('Load error:', err);
    showToast('Failed to load RFI details', 'error');
  }
}

function renderRfiDetail() {
  const rfi = currentRfi;

  // Header
  document.getElementById('detailRfiNumber').textContent = rfi.rfi_number;

  const statusEl = document.getElementById('detailStatus');
  statusEl.textContent = rfi.status.charAt(0).toUpperCase() + rfi.status.slice(1);
  statusEl.className = `badge badge-${rfi.status === 'open' ? 'info' : rfi.status === 'pending' ? 'warning' : rfi.status === 'answered' ? 'success' : 'secondary'}`;

  const priorityEl = document.getElementById('detailPriority');
  priorityEl.textContent = rfi.priority.charAt(0).toUpperCase() + rfi.priority.slice(1);
  priorityEl.className = `badge badge-${rfi.priority === 'urgent' ? 'danger' : rfi.priority === 'high' ? 'warning' : 'secondary'}`;

  // Content
  document.getElementById('detailSubject').textContent = rfi.subject;
  document.getElementById('detailQuestion').textContent = rfi.question;

  // Response section
  const responseSection = document.getElementById('responseSection');
  if (rfi.response) {
    responseSection.style.display = 'block';
    document.getElementById('detailResponse').textContent = rfi.response;
    document.getElementById('detailRespondedBy').textContent = rfi.responded_by || '-';
    document.getElementById('detailRespondedAt').textContent = rfi.responded_at ? formatDateTime(rfi.responded_at) : '-';
  } else {
    responseSection.style.display = 'none';
  }

  // Response history
  const responsesSection = document.getElementById('responsesSection');
  if (rfi.responses && rfi.responses.length > 0) {
    responsesSection.style.display = 'block';
    document.getElementById('responsesList').innerHTML = rfi.responses.map(r => `
      <div class="response-item">
        <div class="response-header">
          <span class="response-type">${r.response_type}</span>
          <span class="response-date">${formatDateTime(r.created_at)}</span>
        </div>
        <div class="response-content">${escapeHtml(r.content)}</div>
        <div class="response-by">- ${r.responded_by}</div>
      </div>
    `).join('');
  } else {
    responsesSection.style.display = 'none';
  }

  // Details sidebar
  document.getElementById('detailJob').textContent = rfi.job?.name || '-';
  document.getElementById('detailSubmittedBy').textContent = rfi.submitted_by || '-';
  document.getElementById('detailAssignedTo').textContent = rfi.assigned_to || '-';
  document.getElementById('detailDueDate').textContent = rfi.due_date ? formatDate(rfi.due_date) : '-';
  document.getElementById('detailDateRequired').textContent = rfi.date_required ? formatDate(rfi.date_required) : '-';
  document.getElementById('detailCreated').textContent = formatDateTime(rfi.created_at);

  // References
  document.getElementById('detailDrawings').textContent = rfi.reference_drawings || '-';
  document.getElementById('detailSpecs').textContent = rfi.reference_specs || '-';

  // Impact
  const impactCard = document.getElementById('impactCard');
  if (rfi.cost_impact || rfi.schedule_impact) {
    impactCard.style.display = 'block';
    document.getElementById('detailCostImpact').textContent = rfi.cost_impact ? formatCurrency(rfi.cost_impact_amount) : 'None';
    document.getElementById('detailScheduleImpact').textContent = rfi.schedule_impact ? `${rfi.schedule_impact_days} days` : 'None';
  } else {
    impactCard.style.display = 'none';
  }

  // Action buttons
  const respondBtn = document.getElementById('respondBtn');
  const closeBtn = document.getElementById('closeRfiBtn');
  const reopenBtn = document.getElementById('reopenRfiBtn');

  if (rfi.status === 'closed') {
    respondBtn.style.display = 'none';
    closeBtn.style.display = 'none';
    reopenBtn.style.display = 'block';
  } else if (rfi.status === 'answered') {
    respondBtn.style.display = 'inline-block';
    closeBtn.style.display = 'block';
    reopenBtn.style.display = 'none';
  } else {
    respondBtn.style.display = 'inline-block';
    closeBtn.style.display = 'none';
    reopenBtn.style.display = 'none';
  }
}

function closeDetailModal() {
  const modal = document.getElementById('rfiDetailModal');
  modal.classList.remove('show');
  modal.style.display = 'none';
  currentRfi = null;
}

function editCurrentRfi() {
  if (currentRfi) {
    closeDetailModal();
    openEditModal(currentRfi);
  }
}

// ============================================================
// RESPOND MODAL
// ============================================================

function openRespondModal() {
  document.getElementById('respondForm').reset();
  document.getElementById('respondedBy').value = window.currentUser || 'User';
  document.getElementById('costImpactAmount').style.display = 'none';
  document.getElementById('scheduleImpactDays').style.display = 'none';

  const modal = document.getElementById('respondModal');
  modal.style.display = 'flex';
  modal.classList.add('show');
}

function closeRespondModal() {
  const modal = document.getElementById('respondModal');
  modal.classList.remove('show');
  modal.style.display = 'none';
}

async function submitResponse() {
  const content = document.getElementById('responseContent').value.trim();
  if (!content) {
    showToast('Response content is required', 'error');
    return;
  }

  const data = {
    content,
    response_type: document.getElementById('responseType').value,
    responded_by: document.getElementById('respondedBy').value.trim() || window.currentUser || 'User'
  };

  try {
    const res = await fetch(`/api/rfis/${currentRfi.id}/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!res.ok) throw new Error('Failed to submit response');

    // Update impact if checked
    const hasCost = document.getElementById('hasCostImpact').checked;
    const hasSchedule = document.getElementById('hasScheduleImpact').checked;

    if (hasCost || hasSchedule) {
      await fetch(`/api/rfis/${currentRfi.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cost_impact: hasCost,
          cost_impact_amount: hasCost ? parseFloat(document.getElementById('costImpactAmount').value) || 0 : null,
          schedule_impact: hasSchedule,
          schedule_impact_days: hasSchedule ? parseInt(document.getElementById('scheduleImpactDays').value) || 0 : null
        })
      });
    }

    showToast('Response submitted', 'success');
    closeRespondModal();
    await openRfiDetail(currentRfi.id);
    await loadRfis();
    await loadStats();
  } catch (err) {
    console.error('Response error:', err);
    showToast('Failed to submit response', 'error');
  }
}

// ============================================================
// ACTIONS
// ============================================================

async function closeRfi() {
  if (!currentRfi) return;
  if (!confirm('Close this RFI?')) return;

  try {
    const res = await fetch(`/api/rfis/${currentRfi.id}/close`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to close RFI');

    showToast('RFI closed', 'success');
    await openRfiDetail(currentRfi.id);
    await loadRfis();
    await loadStats();
  } catch (err) {
    console.error('Close error:', err);
    showToast('Failed to close RFI', 'error');
  }
}

async function reopenRfi() {
  if (!currentRfi) return;

  try {
    const res = await fetch(`/api/rfis/${currentRfi.id}/reopen`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to reopen RFI');

    showToast('RFI reopened', 'success');
    await openRfiDetail(currentRfi.id);
    await loadRfis();
    await loadStats();
  } catch (err) {
    console.error('Reopen error:', err);
    showToast('Failed to reopen RFI', 'error');
  }
}

async function deleteRfi() {
  if (!currentRfi) return;
  if (!confirm('Delete this RFI? This cannot be undone.')) return;

  try {
    const res = await fetch(`/api/rfis/${currentRfi.id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete RFI');

    showToast('RFI deleted', 'success');
    closeDetailModal();
    await loadRfis();
    await loadStats();
  } catch (err) {
    console.error('Delete error:', err);
    showToast('Failed to delete RFI', 'error');
  }
}

// ============================================================
// UTILITIES
// ============================================================

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

function formatDateTime(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount || 0);
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

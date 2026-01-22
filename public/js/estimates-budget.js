/**
 * Estimates & Budgets - Unified Module
 * Combines estimate management with budget building
 */

// ============================================================
// STATE
// ============================================================

// Current mode: 'estimates' or 'budget'
let currentMode = 'estimates';

// Estimates state
let estimates = [];
let jobs = [];
let costCodes = [];
let acceptedBids = [];
let currentEstimate = null;
let selectedBidId = null;
let debounceTimer;
let currentView = localStorage.getItem('estimatesView') || 'table';

// Budget state
let currentJobId = null;
let comparisonData = null;
let aiEstimate = null;

// ============================================================
// INITIALIZATION
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
  // Check URL params first, then localStorage for mode
  const urlParams = new URLSearchParams(window.location.search);
  const urlMode = urlParams.get('mode');

  if (urlMode === 'budget' || urlMode === 'estimates') {
    currentMode = urlMode;
    localStorage.setItem('estimatesBudgetMode', urlMode);
    // Clean up URL (remove mode param, keep others)
    urlParams.delete('mode');
    const newUrl = urlParams.toString()
      ? `${window.location.pathname}?${urlParams.toString()}`
      : window.location.pathname;
    window.history.replaceState({}, '', newUrl);
  } else {
    currentMode = localStorage.getItem('estimatesBudgetMode') || 'estimates';
  }

  // Initialize mode UI
  updateModeUI();

  // Setup event listeners
  setupEventListeners();
  initializeView();

  try {
    await Promise.all([
      loadJobs().catch(err => console.error('Jobs failed:', err)),
      loadCostCodes().catch(err => console.error('Cost codes failed:', err))
    ]);
  } catch (err) {
    showToast('Some data failed to load', 'error');
  }

  // Load mode-specific data
  if (currentMode === 'estimates') {
    await loadEstimates();
    await loadStats();
  }

  // Setup job sidebar listener - reload data when job changes
  if (window.JobSidebar) {
    window.JobSidebar.onJobChange(async (jobId) => {
      currentJobId = jobId || null;
      if (currentMode === 'budget') {
        if (jobId) {
          await loadJobBudgetForJob(jobId);
        } else {
          renderBudgetEmptyState();
        }
      } else if (currentMode === 'estimates') {
        // Reload estimates filtered by selected job
        await loadEstimates();
        await loadStats();
      }
    });

    // Set initial job from sidebar
    currentJobId = window.JobSidebar.getSelectedJobId() || null;
  }
});

function initializeView() {
  const tableView = document.getElementById('estimateTableView');
  const cardView = document.getElementById('estimateCardView');

  if (tableView) tableView.style.display = currentView === 'table' ? 'block' : 'none';
  if (cardView) cardView.style.display = currentView === 'cards' ? 'grid' : 'none';

  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === currentView);
  });
}

function setupEventListeners() {
  // Filter change handlers (job comes from sidebar, not dropdown)
  const statusFilter = document.getElementById('statusFilter');
  const searchInput = document.getElementById('searchInput');

  if (statusFilter) statusFilter.addEventListener('change', applyFilters);

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      const clearBtn = document.getElementById('searchClear');
      if (clearBtn) clearBtn.style.display = e.target.value ? 'block' : 'none';
      debounceTimer = setTimeout(() => applyFilters(), 150);
    });
  }

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeAllModals();
    }
  });

  // Close modals on backdrop click
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeAllModals();
      }
    });
  });
}

// ============================================================
// MODE SWITCHING
// ============================================================

function switchMode(mode) {
  currentMode = mode;
  localStorage.setItem('estimatesBudgetMode', mode);
  updateModeUI();

  // Load data for the new mode
  if (mode === 'estimates') {
    loadEstimates();
    loadStats();
  } else if (mode === 'budget') {
    if (currentJobId) {
      loadJobBudgetForJob(currentJobId);
    } else {
      renderBudgetEmptyState();
    }
  }
}

function updateModeUI() {
  // Update mode buttons
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === currentMode);
  });

  // Show/hide sections
  document.querySelectorAll('.mode-section').forEach(section => {
    section.classList.toggle('active', section.dataset.mode === currentMode);
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

async function loadCostCodes() {
  const response = await fetch('/api/cost-codes');
  const data = await response.json();
  // API returns {costCodes: [...]} or array directly
  costCodes = Array.isArray(data) ? data : (data.costCodes || data.cost_codes || []);
}

function populateJobDropdowns() {
  // Job filtering is done via sidebar, these are for modals only
  const selectors = ['formJob', 'importJobFilter', 'selectionsJob', 'duplicateJob'];
  selectors.forEach(id => {
    const select = document.getElementById(id);
    if (!select) return;

    const currentValue = select.value;
    const isFilter = id.includes('Filter');

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

// ============================================================
// ESTIMATES MODE - DATA & RENDERING
// ============================================================

async function loadEstimates() {
  const params = new URLSearchParams();
  // Job comes from sidebar selection
  const jobId = currentJobId || window.JobSidebar?.getSelectedJobId();
  const status = document.getElementById('statusFilter')?.value;
  const search = document.getElementById('searchInput')?.value;

  if (jobId) params.append('job_id', jobId);
  if (status) params.append('status', status);
  if (search) params.append('search', search);

  try {
    const response = await fetch(`/api/estimates?${params}`);
    estimates = await response.json();
    renderEstimateList();
  } catch (err) {
    console.error('Error loading estimates:', err);
    showToast('Failed to load estimates', 'error');
  }
}

async function loadStats() {
  // Job comes from sidebar selection
  const jobId = currentJobId || window.JobSidebar?.getSelectedJobId();
  const params = jobId ? `?job_id=${jobId}` : '';

  try {
    const response = await fetch(`/api/estimates/stats${params}`);
    const stats = await response.json();
    renderStats(stats);
  } catch (err) {
    console.error('Error loading stats:', err);
  }
}

function applyFilters() {
  loadEstimates();
  loadStats();
}

function clearSearch() {
  const searchInput = document.getElementById('searchInput');
  const searchClear = document.getElementById('searchClear');
  if (searchInput) searchInput.value = '';
  if (searchClear) searchClear.style.display = 'none';
  applyFilters();
}

function renderEstimateList() {
  if (currentView === 'table') {
    renderEstimateTable();
  } else {
    renderEstimateCards();
  }
}

function renderEstimateTable() {
  const tbody = document.getElementById('estimateTableBody');
  if (!tbody) return;

  if (!estimates.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7">
          <div class="empty-state">
            <div class="empty-state-icon">ðŸ“‹</div>
            <div class="empty-state-title">No Estimates Found</div>
            <div class="empty-state-message">Create your first estimate to start tracking project costs.</div>
            <button class="btn btn-primary btn-sm" onclick="openCreateModal()">+ Create Estimate</button>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = estimates.map(est => `
    <tr onclick="openEstimateDetail('${est.id}')">
      <td class="col-title">
        <div class="cell-title">${escapeHtml(est.title)}</div>
        ${est.version > 1 ? `<span class="cell-badge">v${est.version}</span>` : ''}
      </td>
      <td class="col-job">${escapeHtml(est.job?.name || '-')}</td>
      <td class="col-status">
        <span class="badge badge-${getStatusBadgeClass(est.status)}">${formatStatus(est.status)}</span>
      </td>
      <td style="text-align: center;">${est.line_count || 0}</td>
      <td class="col-amount">${formatCurrency(est.total_amount)}</td>
      <td class="col-date">${formatDate(est.created_at)}</td>
      <td class="col-actions" onclick="event.stopPropagation()">
        <button class="btn btn-ghost btn-sm" onclick="openEstimateDetail('${est.id}')" title="Open">ðŸ“‚</button>
      </td>
    </tr>
  `).join('');
}

function renderEstimateCards() {
  const container = document.getElementById('estimateCardView');
  if (!container) return;

  if (!estimates.length) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <div class="empty-state-icon">ðŸ“‹</div>
        <div class="empty-state-title">No Estimates Found</div>
        <div class="empty-state-message">Create your first estimate to start tracking project costs.</div>
        <button class="btn btn-primary btn-lg" onclick="openCreateModal()">+ Create First Estimate</button>
      </div>
    `;
    return;
  }

  container.innerHTML = estimates.map(est => `
    <div class="estimate-card" data-id="${est.id}" onclick="openEstimateDetail('${est.id}')">
      <div class="estimate-card-header">
        <div class="estimate-card-title">
          <h3>${escapeHtml(est.title)}</h3>
          ${est.version > 1 ? `<span class="version-indicator">v${est.version}</span>` : ''}
        </div>
        <div class="estimate-card-job">${est.job?.name || 'No job assigned'}</div>
      </div>
      <div class="estimate-card-badges">
        <span class="status-pill status-pill-${est.status}">
          ${formatStatus(est.status)}
        </span>
      </div>
      <div class="estimate-card-stats">
        <div class="stat-block">
          <span class="stat-block-value">${formatCurrency(est.total_amount)}</span>
          <span class="stat-block-label">Total</span>
        </div>
        <div class="stat-block">
          <span class="stat-block-value">${est.line_count || 0}</span>
          <span class="stat-block-label">Line Items</span>
        </div>
      </div>
    </div>
  `).join('');
}

function renderStats(stats) {
  const statTotal = document.getElementById('statTotal');
  const statDraft = document.getElementById('statDraft');
  const statSubmitted = document.getElementById('statSubmitted');
  const statApproved = document.getElementById('statApproved');
  const statTotalValue = document.getElementById('statTotalValue');

  if (statTotal) statTotal.textContent = stats.total || 0;
  if (statDraft) statDraft.textContent = stats.draft || 0;
  if (statSubmitted) statSubmitted.textContent = stats.submitted || 0;
  if (statApproved) statApproved.textContent = stats.approved || 0;
  if (statTotalValue) statTotalValue.textContent = formatCurrency(stats.total_value || 0);
}

function setView(view) {
  currentView = view;
  localStorage.setItem('estimatesView', view);

  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });

  const tableView = document.getElementById('estimateTableView');
  const cardView = document.getElementById('estimateCardView');

  if (tableView) tableView.style.display = view === 'table' ? 'block' : 'none';
  if (cardView) cardView.style.display = view === 'cards' ? 'grid' : 'none';

  renderEstimateList();
}

// ============================================================
// ESTIMATES MODE - MODALS
// ============================================================

function openCreateModal() {
  document.getElementById('modalTitle').textContent = 'New Estimate';
  document.getElementById('estimateId').value = '';
  document.getElementById('estimateForm').reset();

  // Re-enable job dropdown (may have been disabled by edit mode)
  document.getElementById('formJob').disabled = false;

  const modal = document.getElementById('estimateModal');
  modal.style.display = 'flex';
  modal.classList.add('show');
}

function closeModal() {
  const modal = document.getElementById('estimateModal');
  modal.classList.remove('show');
  modal.style.display = 'none';

  // Re-enable job dropdown for next use
  document.getElementById('formJob').disabled = false;
}

async function saveEstimate() {
  const estimateId = document.getElementById('estimateId').value;
  const data = {
    title: document.getElementById('formTitle').value,
    job_id: document.getElementById('formJob').value,
    notes: document.getElementById('formNotes').value || null,
    created_by: window.currentUser || 'User'
  };

  if (!data.title || !data.job_id) {
    showToast('Title and Job are required', 'error');
    return;
  }

  try {
    const url = estimateId ? `/api/estimates/${estimateId}` : '/api/estimates';
    const method = estimateId ? 'PATCH' : 'POST';

    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to save estimate');
    }

    showToast(estimateId ? 'Estimate updated' : 'Estimate created', 'success');
    closeModal();
    await loadEstimates();
    await loadStats();
  } catch (err) {
    console.error('Error saving estimate:', err);
    showToast(err.message, 'error');
  }
}

async function openEstimateDetail(estimateId) {
  try {
    const response = await fetch(`/api/estimates/${estimateId}`);
    if (!response.ok) throw new Error('Failed to load estimate');
    currentEstimate = await response.json();

    // Hide the list view and show detail view
    document.querySelector('.mode-section[data-mode="estimates"]').style.display = 'none';
    document.getElementById('estimateDetailView').style.display = 'block';

    // Populate detail view header
    document.getElementById('detailViewTitle').textContent = currentEstimate.title;
    const statusBadge = document.getElementById('detailViewStatus');
    statusBadge.textContent = formatStatus(currentEstimate.status);
    statusBadge.className = `badge badge-${getStatusBadgeClass(currentEstimate.status)}`;
    document.getElementById('detailViewVersion').textContent = `v${currentEstimate.version || 1}`;

    // Populate info bar
    document.getElementById('detailViewJob').textContent = currentEstimate.job?.name || '-';
    document.getElementById('detailViewCreated').textContent = formatDate(currentEstimate.created_at);
    document.getElementById('detailViewLineCount').textContent = currentEstimate.lines?.length || 0;
    document.getElementById('detailViewAmount').textContent = formatCurrency(currentEstimate.total_amount);

    // Notes
    const notesSection = document.getElementById('detailViewNotesSection');
    const notesSpan = document.getElementById('detailViewNotes');
    if (currentEstimate.notes) {
      notesSection.style.display = 'block';
      notesSpan.textContent = currentEstimate.notes;
    } else {
      notesSection.style.display = 'none';
    }

    // Update button visibility based on status
    const canEdit = ['draft', 'rejected'].includes(currentEstimate.status);
    const detailEditBtn = document.getElementById('detailEditBtn');
    const addLineBtn = document.getElementById('addLineBtn');

    if (detailEditBtn) detailEditBtn.style.display = canEdit ? 'inline-flex' : 'none';
    if (addLineBtn) addLineBtn.style.display = canEdit ? 'inline-flex' : 'none';

    // Delete button - only for draft/rejected
    const deleteBtn = document.querySelector('.detail-header-right .btn-danger');
    if (deleteBtn) deleteBtn.style.display = canEdit ? 'inline-flex' : 'none';

    // Update status action buttons
    updateStatusActions();

    // Update add phase button visibility
    const addPhaseBtn = document.getElementById('addPhaseBtn');
    if (addPhaseBtn) addPhaseBtn.style.display = canEdit ? 'inline-flex' : 'none';

    // Determine which view to show: hierarchy or flat
    const hasHierarchy = currentEstimate.phases && currentEstimate.phases.length > 0;
    const hierarchySection = document.getElementById('hierarchySection');
    const flatLinesSection = document.getElementById('flatLinesSection');

    if (hasHierarchy || !currentEstimate.lines || currentEstimate.lines.length === 0) {
      // Show hierarchy view (default for new estimates or estimates with phases)
      if (hierarchySection) hierarchySection.style.display = 'block';
      if (flatLinesSection) flatLinesSection.style.display = 'none';
      renderEstimateHierarchy(currentEstimate);
    } else {
      // Show flat lines view for legacy estimates without hierarchy
      if (hierarchySection) hierarchySection.style.display = 'none';
      if (flatLinesSection) flatLinesSection.style.display = 'block';
      renderLineItemsTab();
    }

    // Render activity, and versions
    renderActivitySidebar();
    renderVersionsSidebar();

    // Update markup display
    updateMarkupDisplay();
  } catch (err) {
    console.error('Error loading estimate:', err);
    showToast('Failed to load estimate details', 'error');
  }
}

function backToList() {
  // Hide detail view and show list view
  document.getElementById('estimateDetailView').style.display = 'none';
  document.querySelector('.mode-section[data-mode="estimates"]').style.display = 'block';
  currentEstimate = null;

  // Refresh the list in case changes were made
  loadEstimates();
  loadStats();
}

function updateStatusActions() {
  if (!currentEstimate) return;

  const submitBtn = document.getElementById('submitBtn');
  const approveBtn = document.getElementById('approveBtn');
  const rejectBtn = document.getElementById('rejectBtn');
  const convertBudgetBtn = document.getElementById('convertBudgetBtn');
  const convertAllowancesBtn = document.getElementById('convertAllowancesBtn');

  // Hide all by default
  if (submitBtn) submitBtn.style.display = 'none';
  if (approveBtn) approveBtn.style.display = 'none';
  if (rejectBtn) rejectBtn.style.display = 'none';
  if (convertBudgetBtn) convertBudgetBtn.style.display = 'none';
  if (convertAllowancesBtn) convertAllowancesBtn.style.display = 'none';

  const status = currentEstimate.status;

  if (status === 'draft') {
    if (submitBtn) submitBtn.style.display = 'block';
  } else if (status === 'submitted') {
    if (approveBtn) approveBtn.style.display = 'block';
    if (rejectBtn) rejectBtn.style.display = 'block';
  } else if (status === 'approved') {
    if (convertBudgetBtn) convertBudgetBtn.style.display = 'block';
    if (convertAllowancesBtn) convertAllowancesBtn.style.display = 'block';
  } else if (status === 'rejected') {
    if (submitBtn) submitBtn.style.display = 'block';
  }
}

function updateMarkupDisplay() {
  if (!currentEstimate) return;

  const lines = currentEstimate.lines || [];
  const subtotal = lines.reduce((sum, l) => sum + parseFloat(l.amount || 0), 0);
  const markupPct = currentEstimate.markup_percent || 0;
  const contingencyPct = currentEstimate.contingency_percent || 0;
  const markupAmt = subtotal * (markupPct / 100);
  const contingencyAmt = subtotal * (contingencyPct / 100);

  // Update displays
  const markupPctDisplay = document.getElementById('markupPctDisplay');
  const markupAmountDisplay = document.getElementById('markupAmountDisplay');
  const contingencyPctDisplay = document.getElementById('contingencyPctDisplay');
  const contingencyAmountDisplay = document.getElementById('contingencyAmountDisplay');
  const linesSubtotal = document.getElementById('linesSubtotal');
  const linesTotalAmount = document.getElementById('linesTotalAmount');

  if (markupPctDisplay) markupPctDisplay.textContent = markupPct;
  if (markupAmountDisplay) markupAmountDisplay.textContent = formatCurrency(markupAmt);
  if (contingencyPctDisplay) contingencyPctDisplay.textContent = contingencyPct;
  if (contingencyAmountDisplay) contingencyAmountDisplay.textContent = formatCurrency(contingencyAmt);
  if (linesSubtotal) linesSubtotal.textContent = formatCurrency(subtotal);
  if (linesTotalAmount) linesTotalAmount.textContent = formatCurrency(currentEstimate.total_amount || (subtotal + markupAmt + contingencyAmt));

  // Show/hide markup rows
  const markupRow = document.getElementById('markupRow');
  const contingencyRow = document.getElementById('contingencyRow');
  if (markupRow) markupRow.style.display = markupPct > 0 ? 'table-row' : 'none';
  if (contingencyRow) contingencyRow.style.display = contingencyPct > 0 ? 'table-row' : 'none';
}

function renderActivitySidebar() {
  const activityList = document.getElementById('activityList');
  if (!activityList || !currentEstimate) return;

  const activities = currentEstimate.activity || [];

  if (activities.length === 0) {
    activityList.innerHTML = '<p class="text-muted">No activity yet</p>';
    return;
  }

  // Show last 5 activities
  activityList.innerHTML = activities.slice(0, 5).map(a => `
    <div class="activity-item">
      <div class="activity-action">${formatActivityAction(a.action)}</div>
      <div class="activity-meta">${formatDateTime(a.created_at)} by ${escapeHtml(a.performed_by || 'System')}</div>
    </div>
  `).join('');
}

function renderVersionsSidebar() {
  const versionList = document.getElementById('versionList');
  if (!versionList || !currentEstimate) return;

  const versions = currentEstimate.versions || [];

  if (versions.length <= 1) {
    versionList.innerHTML = '<p class="text-muted">No other versions</p>';
    return;
  }

  versionList.innerHTML = versions.map(v => {
    const isCurrent = v.id === currentEstimate.id;
    return `
      <div class="version-item ${isCurrent ? 'current' : ''}" ${!isCurrent ? `onclick="openEstimateDetail('${v.id}')"` : ''}>
        <span class="version-number">v${v.version}</span>
        <span class="badge badge-${getStatusBadgeClass(v.status)} badge-sm">${formatStatus(v.status)}</span>
        ${isCurrent ? '<span class="version-current">(current)</span>' : ''}
      </div>
    `;
  }).join('');
}

async function submitEstimate() {
  if (!currentEstimate) return;

  try {
    const response = await fetch(`/api/estimates/${currentEstimate.id}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ submitted_by: window.currentUser || 'User' })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to submit estimate');
    }

    showToast('Estimate submitted for approval', 'success');
    await openEstimateDetail(currentEstimate.id);
  } catch (err) {
    console.error('Error submitting estimate:', err);
    showToast(err.message, 'error');
  }
}

async function approveEstimate() {
  if (!currentEstimate) return;

  try {
    const response = await fetch(`/api/estimates/${currentEstimate.id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approved_by: window.currentUser || 'User' })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to approve estimate');
    }

    showToast('Estimate approved', 'success');
    await openEstimateDetail(currentEstimate.id);
  } catch (err) {
    console.error('Error approving estimate:', err);
    showToast(err.message, 'error');
  }
}

async function rejectEstimate() {
  if (!currentEstimate) return;

  const reason = prompt('Reason for rejection (optional):');

  try {
    const response = await fetch(`/api/estimates/${currentEstimate.id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rejected_by: window.currentUser || 'User',
        reason: reason || null
      })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to reject estimate');
    }

    showToast('Estimate rejected', 'success');
    await openEstimateDetail(currentEstimate.id);
  } catch (err) {
    console.error('Error rejecting estimate:', err);
    showToast(err.message, 'error');
  }
}

function renderLineItemsTab() {
  const tbody = document.getElementById('linesTableBody');
  if (!tbody || !currentEstimate) return;

  const lines = currentEstimate.lines || [];
  const canEdit = ['draft', 'rejected'].includes(currentEstimate.status);

  if (lines.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="10" style="text-align: center; padding: 40px;">
          <p style="color: var(--text-secondary);">No line items yet</p>
          ${canEdit ? '<button class="btn btn-primary btn-sm" onclick="openAddLineModal()">+ Add First Item</button>' : ''}
        </td>
      </tr>
    `;
  } else {
    tbody.innerHTML = lines.map((line, index) => {
      const isAssembly = line.is_assembly;
      const isChild = line.parent_line_id;

      return `
        <tr data-line-id="${line.id}" class="${isAssembly ? 'assembly-row' : ''} ${isChild ? 'assembly-child' : ''}">
          <td class="select-col">
            ${canEdit ? `<input type="checkbox" class="line-select" data-line-id="${line.id}">` : ''}
          </td>
          <td style="width: 30px;">
            ${canEdit ? '<button class="btn btn-icon btn-ghost btn-xs drag-handle" title="Drag to reorder" style="cursor: grab;">⋮⋮</button>' : ''}
          </td>
          <td style="width: 40px;">${index + 1}</td>
          <td style="width: 80px;">${line.cost_code?.code || '-'}</td>
          <td class="col-description">
            ${isAssembly ? '📦 ' : ''}${isChild ? '&nbsp;&nbsp;↳ ' : ''}${escapeHtml(line.description || line.cost_code?.name || '-')}
          </td>
          <td style="text-align: right; width: 60px;">${line.quantity || 1}</td>
          <td style="width: 50px;">${line.unit || '-'}</td>
          <td style="text-align: right; width: 100px;">${formatCurrency(line.unit_cost)}</td>
          <td style="text-align: right; width: 100px; font-weight: 600;">${formatCurrency(line.amount)}</td>
          <td style="width: 80px;">
            ${canEdit ? `
              <button class="btn btn-ghost btn-xs" onclick="editLineItem('${line.id}')" title="Edit">✏️</button>
              <button class="btn btn-ghost btn-xs" onclick="deleteLineItem('${line.id}')" title="Delete">🗑️</button>
            ` : ''}
          </td>
        </tr>
      `;
    }).join('');
  }

  // Update totals
  const subtotal = lines.reduce((sum, l) => sum + parseFloat(l.amount || 0), 0);
  const linesSubtotal = document.getElementById('linesSubtotal');
  const linesTotalAmount = document.getElementById('linesTotalAmount');

  if (linesSubtotal) linesSubtotal.textContent = formatCurrency(subtotal);
  if (linesTotalAmount) linesTotalAmount.textContent = formatCurrency(currentEstimate.total_amount || subtotal);
}

function renderVersionsTab() {
  const versionsBody = document.getElementById('versionsTableBody');
  if (!versionsBody || !currentEstimate) return;

  const versions = currentEstimate.versions || [];

  if (versions.length === 0) {
    versionsBody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; padding: 20px; color: var(--text-secondary);">
          No version history
        </td>
      </tr>
    `;
    return;
  }

  versionsBody.innerHTML = versions.map(v => {
    const isCurrent = v.id === currentEstimate.id;
    return `
      <tr class="${isCurrent ? 'current-version' : ''}" style="${isCurrent ? 'background: rgba(88, 166, 255, 0.1);' : ''}">
        <td>v${v.version}</td>
        <td>${escapeHtml(v.title)}</td>
        <td><span class="badge badge-${getStatusBadgeClass(v.status)}">${formatStatus(v.status)}</span></td>
        <td>${formatCurrency(v.total_amount)}</td>
        <td>${formatDate(v.created_at)}</td>
      </tr>
    `;
  }).join('');
}

function renderActivityTab() {
  const activityList = document.getElementById('activityList');
  if (!activityList || !currentEstimate) return;

  const activities = currentEstimate.activity || [];

  if (activities.length === 0) {
    activityList.innerHTML = '<p style="color: var(--text-secondary); padding: 20px;">No activity recorded</p>';
    return;
  }

  activityList.innerHTML = activities.map(a => `
    <div style="padding: 12px; border-bottom: 1px solid var(--border);">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span style="font-weight: 600;">${formatActivityAction(a.action)}</span>
        <span style="font-size: 0.85rem; color: var(--text-secondary);">${formatDateTime(a.created_at)}</span>
      </div>
      <div style="font-size: 0.85rem; color: var(--text-secondary);">by ${escapeHtml(a.performed_by || 'System')}</div>
      ${a.details && Object.keys(a.details).length > 0 ? `
        <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 4px;">
          ${Object.entries(a.details).map(([k, v]) => `${k}: ${v}`).join(', ')}
        </div>
      ` : ''}
    </div>
  `).join('');
}

function formatActivityAction(action) {
  const actionMap = {
    created: 'Estimate created',
    updated: 'Estimate updated',
    submitted: 'Submitted for approval',
    approved: 'Approved',
    rejected: 'Rejected',
    deleted: 'Deleted',
    line_added: 'Line item added',
    line_updated: 'Line item updated',
    line_deleted: 'Line item deleted',
    lines_reordered: 'Lines reordered',
    assembly_created: 'Assembly created',
    assembly_deleted: 'Assembly ungrouped',
    version_created: 'New version created',
    converted_to_budget: 'Converted to budget',
    converted_to_allowances: 'Converted to allowances',
    imported_from_bid: 'Imported from bid',
    scope_generated: 'Scope generated',
    recalculated: 'Totals recalculated'
  };
  return actionMap[action] || action;
}

function closeDetailModal() {
  // For backwards compatibility with modal-based code
  backToList();
}

async function deleteEstimate() {
  if (!currentEstimate) {
    showToast('No estimate loaded', 'error');
    return;
  }

  // Check if estimate can be deleted (only draft/rejected)
  if (!['draft', 'rejected'].includes(currentEstimate.status)) {
    showToast('Only draft or rejected estimates can be deleted', 'warning');
    return;
  }

  const title = currentEstimate.title || 'this estimate';
  if (!confirm(`Are you sure you want to delete "${title}"? This cannot be undone.`)) {
    return;
  }

  try {
    const response = await fetch(`/api/estimates/${currentEstimate.id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deleted_by: window.currentUser || 'User' })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to delete estimate');
    }

    showToast('Estimate deleted', 'success');
    closeDetailModal();

    // Refresh the list
    await loadEstimates();
    await loadStats();
  } catch (err) {
    console.error('Error deleting estimate:', err);
    showToast(err.message, 'error');
  }
}

function switchTab(tabName) {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.tab === tabName);
  });

  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.toggle('active', content.id === `tab-${tabName}`);
  });
}

// ============================================================
// ESTIMATE EDITING FUNCTIONS
// ============================================================

function editCurrentEstimate() {
  if (!currentEstimate) {
    showToast('No estimate loaded', 'error');
    return;
  }

  if (!['draft', 'rejected'].includes(currentEstimate.status)) {
    showToast('Only draft or rejected estimates can be edited', 'warning');
    return;
  }

  // Open create/edit modal with current estimate data
  document.getElementById('modalTitle').textContent = 'Edit Estimate';
  document.getElementById('estimateId').value = currentEstimate.id;
  document.getElementById('formTitle').value = currentEstimate.title || '';
  document.getElementById('formJob').value = currentEstimate.job_id || '';
  document.getElementById('formNotes').value = currentEstimate.notes || '';

  // Disable job change for existing estimates
  document.getElementById('formJob').disabled = true;

  const modal = document.getElementById('estimateModal');
  modal.style.display = 'flex';
  modal.classList.add('show');
}

// ============================================================
// LINE ITEM FUNCTIONS
// ============================================================

function openAddLineModal() {
  console.log('openAddLineModal called, currentEstimate:', currentEstimate);

  if (!currentEstimate) {
    showToast('Please open an estimate first', 'error');
    return;
  }

  if (!['draft', 'rejected'].includes(currentEstimate.status)) {
    showToast('Cannot add items to submitted/approved estimates', 'warning');
    return;
  }

  try {
    // Reset form
    const lineModalTitle = document.getElementById('lineModalTitle');
    const lineItemId = document.getElementById('lineItemId');
    const lineCatalogItemId = document.getElementById('lineCatalogItemId');
    const lineItemForm = document.getElementById('lineItemForm');
    const lineQuantity = document.getElementById('lineQuantity');
    const historicalPricing = document.getElementById('historicalPricing');
    const aiSuggestions = document.getElementById('aiSuggestions');
    const modal = document.getElementById('lineItemModal');

    if (!modal) {
      console.error('lineItemModal not found');
      showToast('Modal not found', 'error');
      return;
    }

    if (lineModalTitle) lineModalTitle.textContent = 'Add Line Item';
    if (lineItemId) lineItemId.value = '';
    if (lineCatalogItemId) lineCatalogItemId.value = '';
    if (lineItemForm) lineItemForm.reset();
    if (lineQuantity) lineQuantity.value = 1;

    // Populate cost code dropdowns
    populateCostCodeDropdowns();

    // Clear suggestions
    if (historicalPricing) historicalPricing.innerHTML = '<p class="text-muted">Select a cost code to see historical pricing.</p>';
    if (aiSuggestions) aiSuggestions.innerHTML = '<p class="text-muted">Start typing a description to get suggestions.</p>';

    // Reset catalog picker state
    selectedCatalogItem = null;
    const catalogSearch = document.getElementById('catalogSearch');
    const catalogSuggestions = document.getElementById('catalogSuggestions');
    const selectedCatalogItemDiv = document.getElementById('selectedCatalogItem');

    if (catalogSearch) catalogSearch.value = '';
    if (selectedCatalogItemDiv) selectedCatalogItemDiv.style.display = 'none';
    if (catalogSuggestions) catalogSuggestions.style.display = 'block';

    // Auto-load catalog suggestions based on subgroup context
    const subgroupId = window.currentSubgroupId || null;
    loadCatalogSuggestions(subgroupId);

    modal.style.display = 'flex';
    modal.classList.add('show');
    console.log('Modal opened successfully');
  } catch (err) {
    console.error('Error opening line modal:', err);
    showToast('Failed to open line item form: ' + err.message, 'error');
  }
}

function closeLineModal() {
  const modal = document.getElementById('lineItemModal');
  modal.classList.remove('show');
  modal.style.display = 'none';
}

function populateCostCodeDropdowns() {
  // Populate category filter
  const categoryFilter = document.getElementById('lineCategoryFilter');
  if (categoryFilter) {
    const categories = [...new Set(costCodes.map(cc => cc.category).filter(Boolean))].sort();
    categoryFilter.innerHTML = '<option value="">All Categories</option>';
    categories.forEach(cat => {
      categoryFilter.innerHTML += `<option value="${cat}">${cat}</option>`;
    });
  }

  // Populate cost code dropdown
  const costCodeSelect = document.getElementById('lineCostCode');
  if (costCodeSelect) {
    costCodeSelect.innerHTML = '<option value="">Select Cost Code...</option>';
    costCodes.forEach(cc => {
      costCodeSelect.innerHTML += `<option value="${cc.id}" data-category="${cc.category || ''}">${cc.code} - ${cc.name}</option>`;
    });
  }
}

function filterCostCodesByCategory() {
  const category = document.getElementById('lineCategoryFilter').value;
  const costCodeSelect = document.getElementById('lineCostCode');

  if (!costCodeSelect) return;

  costCodeSelect.innerHTML = '<option value="">Select Cost Code...</option>';

  const filtered = category
    ? costCodes.filter(cc => cc.category === category)
    : costCodes;

  filtered.forEach(cc => {
    costCodeSelect.innerHTML += `<option value="${cc.id}" data-category="${cc.category || ''}">${cc.code} - ${cc.name}</option>`;
  });
}

async function onCostCodeSelected() {
  const costCodeId = document.getElementById('lineCostCode').value;
  const historicalDiv = document.getElementById('historicalPricing');

  if (!costCodeId) {
    historicalDiv.innerHTML = '<p class="text-muted">Select a cost code to see historical pricing.</p>';
    return;
  }

  historicalDiv.innerHTML = '<p class="text-muted">Loading historical data...</p>';

  try {
    const response = await fetch(`/api/estimates/historical-pricing/${costCodeId}`);
    const data = await response.json();

    if (data.stats.count === 0) {
      historicalDiv.innerHTML = '<p class="text-muted">No historical data for this cost code.</p>';
      return;
    }

    let historyHtml = `
      <div class="historical-stats" style="display: flex; gap: 16px; margin-bottom: 12px;">
        <div class="stat-mini">
          <span style="font-size: 0.75rem; color: var(--text-secondary);">Min</span>
          <span style="font-weight: 600;">${formatCurrency(data.stats.min)}</span>
        </div>
        <div class="stat-mini">
          <span style="font-size: 0.75rem; color: var(--text-secondary);">Avg</span>
          <span style="font-weight: 600; color: var(--accent-blue);">${formatCurrency(data.stats.avg)}</span>
        </div>
        <div class="stat-mini">
          <span style="font-size: 0.75rem; color: var(--text-secondary);">Max</span>
          <span style="font-weight: 600;">${formatCurrency(data.stats.max)}</span>
        </div>
      </div>
    `;

    if (data.po_history.length > 0) {
      historyHtml += '<div style="font-size: 0.8rem; margin-bottom: 8px; color: var(--text-secondary);">Recent POs:</div>';
      historyHtml += '<div class="historical-list" style="display: flex; flex-direction: column; gap: 4px;">';
      data.po_history.slice(0, 3).forEach(h => {
        historyHtml += `
          <div class="historical-item" onclick="applyHistoricalPrice(${h.amount})"
               style="display: flex; justify-content: space-between; padding: 6px 8px; background: var(--bg-card-elevated); border-radius: 4px; cursor: pointer; font-size: 0.85rem;">
            <span>${escapeHtml(h.vendor || 'Unknown')}</span>
            <span style="font-weight: 600;">${formatCurrency(h.amount)}</span>
          </div>
        `;
      });
      historyHtml += '</div>';
    }

    historicalDiv.innerHTML = historyHtml;
  } catch (err) {
    console.error('Error loading historical pricing:', err);
    historicalDiv.innerHTML = '<p class="text-muted">Failed to load historical data.</p>';
  }
}

function applyHistoricalPrice(amount) {
  document.getElementById('lineUnitCost').value = amount;
  calculateLineAmount();
  showToast('Price applied', 'success');
}

function calculateLineAmount() {
  const qty = parseFloat(document.getElementById('lineQuantity').value) || 1;
  const unitCost = parseFloat(document.getElementById('lineUnitCost').value) || 0;
  document.getElementById('lineAmount').value = (qty * unitCost).toFixed(2);
}

// ============================================================
// CATALOG PICKER FUNCTIONS
// ============================================================

let catalogSearchDebounce;
let selectedCatalogItem = null;

/**
 * Search catalog with debounce
 */
function searchCatalog(query) {
  clearTimeout(catalogSearchDebounce);
  catalogSearchDebounce = setTimeout(async () => {
    const subgroupId = window.currentSubgroupId || null;
    await loadCatalogSuggestions(subgroupId, query);
  }, 300);
}

/**
 * Load catalog suggestions from API
 */
async function loadCatalogSuggestions(subgroupId, query = '') {
  const container = document.getElementById('catalogSuggestions');
  if (!container) return;

  try {
    const params = new URLSearchParams();
    if (subgroupId) params.set('subgroup_id', subgroupId);
    if (query) params.set('query', query);

    const response = await fetch(`/api/estimates/catalog-suggestions?${params}`);
    const items = await response.json();

    if (items.length === 0) {
      container.innerHTML = `
        <div class="catalog-suggestion" style="justify-content: center; color: var(--text-secondary);">
          No matching items found
        </div>
      `;
      return;
    }

    container.innerHTML = items.map(item => `
      <div class="catalog-suggestion" onclick="selectCatalogItem('${item.id}', ${JSON.stringify(item).replace(/"/g, '&quot;')})">
        <img class="catalog-suggestion-image"
             src="${item.image_url || '/images/placeholder-product.png'}"
             alt="${escapeHtml(item.name)}"
             onerror="this.src='/images/placeholder-product.png'">
        <div class="catalog-suggestion-info">
          <div class="catalog-suggestion-name">${escapeHtml(item.name)}</div>
          <div class="catalog-suggestion-meta">
            ${item.category?.name || ''} ${item.brand ? `• ${item.brand}` : ''}
          </div>
        </div>
        <div class="catalog-suggestion-price">${formatCurrency(item.unit_price || 0)}/${item.unit || 'ea'}</div>
      </div>
    `).join('');
  } catch (err) {
    console.error('Error loading catalog suggestions:', err);
    container.innerHTML = `
      <div class="catalog-suggestion" style="color: var(--accent-red);">
        Error loading suggestions
      </div>
    `;
  }
}

/**
 * Select a catalog item and auto-fill form fields
 */
function selectCatalogItem(itemId, itemData) {
  selectedCatalogItem = itemData;

  // Store the ID
  const catalogIdField = document.getElementById('lineCatalogItemId');
  if (catalogIdField) catalogIdField.value = itemId;

  // Auto-fill form fields
  const descField = document.getElementById('lineDescription');
  const unitCostField = document.getElementById('lineUnitCost');
  const unitField = document.getElementById('lineUnit');
  const qtyField = document.getElementById('lineQuantity');

  if (descField) descField.value = itemData.name || '';
  if (unitCostField) unitCostField.value = itemData.unit_price || 0;
  if (unitField) unitField.value = itemData.unit || 'EA';

  // If quantity is still 1, keep it; otherwise respect user's entry
  if (qtyField && (!qtyField.value || qtyField.value === '1')) {
    qtyField.value = 1;
  }

  // Calculate amount
  calculateLineAmount();

  // Hide suggestions, show selected
  const suggestionsDiv = document.getElementById('catalogSuggestions');
  const selectedDiv = document.getElementById('selectedCatalogItem');

  if (suggestionsDiv) suggestionsDiv.style.display = 'none';
  if (selectedDiv) {
    selectedDiv.style.display = 'flex';
    selectedDiv.innerHTML = `
      <img class="catalog-suggestion-image"
           src="${itemData.image_url || '/images/placeholder-product.png'}"
           alt="${escapeHtml(itemData.name)}"
           onerror="this.src='/images/placeholder-product.png'">
      <div class="catalog-suggestion-info">
        <div class="catalog-suggestion-name">${escapeHtml(itemData.name)}</div>
        <div class="catalog-suggestion-meta">
          ${itemData.category?.name || ''} • ${formatCurrency(itemData.unit_price || 0)}/${itemData.unit || 'ea'}
        </div>
      </div>
      <span class="catalog-badge">From Catalog</span>
    `;
  }

  showToast(`Selected: ${itemData.name}`, 'success');
}

/**
 * Clear catalog selection
 */
function clearCatalogSelection() {
  selectedCatalogItem = null;

  const catalogIdField = document.getElementById('lineCatalogItemId');
  const selectedDiv = document.getElementById('selectedCatalogItem');
  const suggestionsDiv = document.getElementById('catalogSuggestions');
  const searchField = document.getElementById('catalogSearch');

  if (catalogIdField) catalogIdField.value = '';
  if (selectedDiv) selectedDiv.style.display = 'none';
  if (suggestionsDiv) suggestionsDiv.style.display = 'block';
  if (searchField) searchField.value = '';

  // Reload context-based suggestions
  loadCatalogSuggestions(window.currentSubgroupId);
}

function onDescriptionInput() {
  // Could add AI suggestions here based on description text
  // For now, just a placeholder for future enhancement
}

async function saveLineItem() {
  if (!currentEstimate) return;

  const lineId = document.getElementById('lineItemId').value;
  const catalogItemId = document.getElementById('lineCatalogItemId')?.value || null;
  const subgroupId = window.currentSubgroupId || null;

  const data = {
    cost_code_id: document.getElementById('lineCostCode').value || null,
    catalog_item_id: catalogItemId,
    description: document.getElementById('lineDescription').value,
    quantity: parseFloat(document.getElementById('lineQuantity').value) || 1,
    unit: document.getElementById('lineUnit').value || null,
    unit_cost: parseFloat(document.getElementById('lineUnitCost').value) || 0,
    amount: parseFloat(document.getElementById('lineAmount').value) || 0,
    notes: document.getElementById('lineNotes').value || null,
    created_by: window.currentUser || 'User'
  };

  if (!data.description && !data.cost_code_id) {
    showToast('Please enter a description or select a cost code', 'error');
    return;
  }

  try {
    let url, method;

    if (lineId) {
      // Editing existing line item (use hierarchical endpoint)
      url = `/api/estimates/lines/${lineId}`;
      method = 'PATCH';
    } else if (subgroupId) {
      // Adding new line item to subgroup (hierarchical)
      url = `/api/estimates/subgroups/${subgroupId}/lines`;
      method = 'POST';
    } else {
      // Legacy: adding to flat estimate (backwards compatibility)
      url = `/api/estimates/${currentEstimate.id}/lines`;
      method = 'POST';
    }

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
    closeLineModal();

    // Clear subgroup context
    window.currentSubgroupId = null;

    // Refresh estimate details
    if (subgroupId || currentEstimate.phases?.length > 0) {
      // Hierarchical estimate - refresh hierarchy
      await refreshEstimateHierarchy();
    } else {
      // Legacy estimate - full refresh
      await openEstimateDetail(currentEstimate.id);
      switchTab('lines');
    }
  } catch (err) {
    console.error('Error saving line item:', err);
    showToast(err.message, 'error');
  }
}

async function editLineItem(lineId) {
  if (!currentEstimate) return;

  const line = currentEstimate.lines?.find(l => l.id === lineId);
  if (!line) {
    showToast('Line item not found', 'error');
    return;
  }

  if (!['draft', 'rejected'].includes(currentEstimate.status)) {
    showToast('Cannot edit items in submitted/approved estimates', 'warning');
    return;
  }

  // Populate form with line data
  document.getElementById('lineModalTitle').textContent = 'Edit Line Item';
  document.getElementById('lineItemId').value = line.id;
  populateCostCodeDropdowns();

  document.getElementById('lineCostCode').value = line.cost_code_id || '';
  document.getElementById('lineDescription').value = line.description || '';
  document.getElementById('lineQuantity').value = line.quantity || 1;
  document.getElementById('lineUnit').value = line.unit || '';
  document.getElementById('lineUnitCost').value = line.unit_cost || 0;
  document.getElementById('lineAmount').value = line.amount || 0;
  document.getElementById('lineNotes').value = line.notes || '';

  // Load historical pricing if cost code selected
  if (line.cost_code_id) {
    await onCostCodeSelected();
  }

  const modal = document.getElementById('lineItemModal');
  modal.style.display = 'flex';
  modal.classList.add('show');
}

async function deleteLineItem(lineId) {
  if (!currentEstimate) return;

  if (!['draft', 'rejected'].includes(currentEstimate.status)) {
    showToast('Cannot delete items from submitted/approved estimates', 'warning');
    return;
  }

  if (!confirm('Delete this line item?')) return;

  try {
    const response = await fetch(`/api/estimates/${currentEstimate.id}/lines/${lineId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deleted_by: window.currentUser || 'User' })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to delete line item');
    }

    showToast('Line item deleted', 'success');
    await openEstimateDetail(currentEstimate.id);
  } catch (err) {
    console.error('Error deleting line item:', err);
    showToast(err.message, 'error');
  }
}

// ============================================================
// MARKUP FUNCTIONS
// ============================================================

function openMarkupModal() {
  if (!currentEstimate) {
    showToast('No estimate loaded', 'error');
    return;
  }

  // Set current values
  document.getElementById('editMarkupPct').value = currentEstimate.markup_percent || 0;
  document.getElementById('editContingencyPct').value = currentEstimate.contingency_percent || 0;

  // Calculate preview
  updateMarkupPreview();

  // Add change listeners for live preview
  document.getElementById('editMarkupPct').oninput = updateMarkupPreview;
  document.getElementById('editContingencyPct').oninput = updateMarkupPreview;

  const modal = document.getElementById('markupModal');
  modal.style.display = 'flex';
  modal.classList.add('show');
}

function closeMarkupModal() {
  const modal = document.getElementById('markupModal');
  modal.classList.remove('show');
  modal.style.display = 'none';
}

function updateMarkupPreview() {
  const subtotal = currentEstimate?.subtotal_amount ||
    (currentEstimate?.lines || []).reduce((sum, l) => sum + parseFloat(l.amount || 0), 0);
  const markupPct = parseFloat(document.getElementById('editMarkupPct').value) || 0;
  const contingencyPct = parseFloat(document.getElementById('editContingencyPct').value) || 0;

  const markupAmt = subtotal * (markupPct / 100);
  const contingencyAmt = subtotal * (contingencyPct / 100);
  const total = subtotal + markupAmt + contingencyAmt;

  document.getElementById('markupPreviewSubtotal').textContent = formatCurrency(subtotal);
  document.getElementById('markupPreviewMarkup').textContent = formatCurrency(markupAmt);
  document.getElementById('markupPreviewContingency').textContent = formatCurrency(contingencyAmt);
  document.getElementById('markupPreviewTotal').textContent = formatCurrency(total);
}

async function saveMarkup() {
  if (!currentEstimate) return;

  const markupPct = parseFloat(document.getElementById('editMarkupPct').value) || 0;
  const contingencyPct = parseFloat(document.getElementById('editContingencyPct').value) || 0;

  try {
    const response = await fetch(`/api/estimates/${currentEstimate.id}/recalculate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        markup_percent: markupPct,
        contingency_percent: contingencyPct,
        updated_by: window.currentUser || 'User'
      })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to update markup');
    }

    showToast('Markup updated', 'success');
    closeMarkupModal();

    // Refresh estimate
    await openEstimateDetail(currentEstimate.id);
  } catch (err) {
    console.error('Error saving markup:', err);
    showToast(err.message, 'error');
  }
}

// ============================================================
// IMPORT & CREATE FUNCTIONS
// ============================================================

async function openImportBidModal() {
  // Populate job filter
  const importJobFilter = document.getElementById('importJobFilter');
  if (importJobFilter) {
    importJobFilter.innerHTML = '<option value="">All Jobs</option>';
    jobs.forEach(job => {
      importJobFilter.innerHTML += `<option value="${job.id}">${escapeHtml(job.name)}</option>`;
    });
  }

  // Load accepted bids
  await loadAcceptedBids();

  const modal = document.getElementById('importBidModal');
  modal.style.display = 'flex';
  modal.classList.add('show');
}

function closeImportBidModal() {
  const modal = document.getElementById('importBidModal');
  modal.classList.remove('show');
  modal.style.display = 'none';
  selectedBidId = null;
}

async function loadAcceptedBids() {
  const jobId = document.getElementById('importJobFilter')?.value;
  const bidList = document.getElementById('bidSelectList');

  if (!bidList) return;

  bidList.innerHTML = '<p class="text-muted">Loading bids...</p>';

  try {
    let url = '/api/bids?status=accepted';
    if (jobId) url += `&job_id=${jobId}`;

    const response = await fetch(url);
    acceptedBids = await response.json();

    if (!acceptedBids.length) {
      bidList.innerHTML = '<p class="text-muted">No accepted bids found.</p>';
      return;
    }

    bidList.innerHTML = acceptedBids.map(bid => `
      <div class="bid-select-item ${selectedBidId === bid.id ? 'selected' : ''}"
           onclick="selectBidForImport('${bid.id}')"
           style="padding: 12px; border: 1px solid var(--border); border-radius: 6px; margin-bottom: 8px; cursor: pointer; ${selectedBidId === bid.id ? 'border-color: var(--accent-blue); background: rgba(88, 166, 255, 0.1);' : ''}">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-weight: 600;">${escapeHtml(bid.title)}</div>
            <div style="font-size: 0.85rem; color: var(--text-secondary);">
              ${escapeHtml(bid.vendor?.name || 'Unknown Vendor')} - ${escapeHtml(bid.job?.name || 'Unknown Job')}
            </div>
          </div>
          <div style="font-weight: 600; font-size: 1.1rem;">${formatCurrency(bid.bid_amount)}</div>
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error('Error loading bids:', err);
    bidList.innerHTML = '<p class="text-muted">Failed to load bids.</p>';
  }
}

function selectBidForImport(bidId) {
  selectedBidId = bidId;
  loadAcceptedBids(); // Re-render with selection

  // Enable import button
  const importBtn = document.getElementById('importBidBtn');
  if (importBtn) importBtn.disabled = false;
}

async function importSelectedBid() {
  if (!selectedBidId) {
    showToast('Please select a bid to import', 'error');
    return;
  }

  try {
    const response = await fetch(`/api/estimates/import-from-bid/${selectedBidId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ created_by: window.currentUser || 'User' })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to import bid');
    }

    const result = await response.json();
    showToast('Estimate created from bid', 'success');
    closeImportBidModal();

    // Refresh and open the new estimate
    await loadEstimates();
    await loadStats();

    if (result.estimate?.id) {
      await openEstimateDetail(result.estimate.id);
    }
  } catch (err) {
    console.error('Error importing bid:', err);
    showToast(err.message, 'error');
  }
}

async function openFromSelectionsModal() {
  // Populate job dropdown
  const selectionsJob = document.getElementById('selectionsJob');
  if (selectionsJob) {
    selectionsJob.innerHTML = '<option value="">Select Job...</option>';
    jobs.forEach(job => {
      selectionsJob.innerHTML += `<option value="${job.id}">${escapeHtml(job.name)}</option>`;
    });
  }

  // Reset form
  document.getElementById('selectionsTitle').value = '';
  document.getElementById('selectionsMarkup').value = 0;
  document.getElementById('selectionsContingency').value = 5;
  document.getElementById('selectionsPreview').style.display = 'none';
  document.getElementById('createFromSelectionsBtn').disabled = true;

  const modal = document.getElementById('fromSelectionsModal');
  modal.style.display = 'flex';
  modal.classList.add('show');
}

function closeFromSelectionsModal() {
  const modal = document.getElementById('fromSelectionsModal');
  modal.classList.remove('show');
  modal.style.display = 'none';
}

async function loadJobSelectionsPreview() {
  const jobId = document.getElementById('selectionsJob').value;
  const previewDiv = document.getElementById('selectionsPreview');
  const createBtn = document.getElementById('createFromSelectionsBtn');

  if (!jobId) {
    previewDiv.style.display = 'none';
    createBtn.disabled = true;
    return;
  }

  try {
    // Get approved selections for job (through allowances)
    const response = await fetch(`/api/selections?job_id=${jobId}&status=approved`);
    const selections = await response.json();

    if (!selections.length) {
      previewDiv.style.display = 'block';
      previewDiv.innerHTML = '<p class="text-muted">No approved selections found for this job.</p>';
      createBtn.disabled = true;
      return;
    }

    // Group by category
    const byCategory = {};
    let total = 0;
    selections.forEach(sel => {
      const catName = sel.category?.name || 'Uncategorized';
      if (!byCategory[catName]) byCategory[catName] = [];
      byCategory[catName].push(sel);
      total += parseFloat(sel.quoted_price || 0) * (sel.quantity || 1);
    });

    document.getElementById('previewSelectionCount').textContent = selections.length;
    document.getElementById('previewCategoryCount').textContent = Object.keys(byCategory).length;
    document.getElementById('previewTotalValue').textContent = formatCurrency(total);

    document.getElementById('previewCategories').innerHTML = Object.entries(byCategory)
      .map(([cat, items]) => `
        <div style="padding: 8px; background: var(--bg-card-elevated); border-radius: 4px; margin-bottom: 4px;">
          <span style="font-weight: 600;">${escapeHtml(cat)}</span>
          <span style="color: var(--text-secondary);"> - ${items.length} items</span>
        </div>
      `).join('');

    previewDiv.style.display = 'block';
    createBtn.disabled = false;

    // Auto-fill title
    const selectedJob = jobs.find(j => j.id === jobId);
    if (selectedJob && !document.getElementById('selectionsTitle').value) {
      document.getElementById('selectionsTitle').value = `${selectedJob.name} - Selections Estimate`;
    }
  } catch (err) {
    console.error('Error loading selections preview:', err);
    previewDiv.innerHTML = '<p class="text-muted">Failed to load selections.</p>';
    createBtn.disabled = true;
  }
}

async function createFromSelections() {
  const jobId = document.getElementById('selectionsJob').value;
  const title = document.getElementById('selectionsTitle').value;
  const markupPct = parseFloat(document.getElementById('selectionsMarkup').value) || 0;
  const contingencyPct = parseFloat(document.getElementById('selectionsContingency').value) || 0;

  if (!jobId || !title) {
    showToast('Please select a job and enter a title', 'error');
    return;
  }

  try {
    const response = await fetch('/api/estimates/from-selections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        job_id: jobId,
        title,
        markup_percent: markupPct,
        contingency_percent: contingencyPct,
        created_by: window.currentUser || 'User'
      })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to create estimate');
    }

    const result = await response.json();
    showToast(result.message, 'success');
    closeFromSelectionsModal();

    await loadEstimates();
    await loadStats();

    if (result.estimate?.id) {
      await openEstimateDetail(result.estimate.id);
    }
  } catch (err) {
    console.error('Error creating from selections:', err);
    showToast(err.message, 'error');
  }
}

async function openDuplicateModal() {
  if (!currentEstimate) {
    showToast('No estimate loaded', 'error');
    return;
  }

  // Populate job dropdown
  const duplicateJob = document.getElementById('duplicateJob');
  if (duplicateJob) {
    duplicateJob.innerHTML = '<option value="">Same job as original</option>';
    jobs.forEach(job => {
      duplicateJob.innerHTML += `<option value="${job.id}">${escapeHtml(job.name)}</option>`;
    });
  }

  // Set default title
  document.getElementById('duplicateTitle').value = `${currentEstimate.title} (Copy)`;

  // Show summary
  document.getElementById('duplicateSummary').innerHTML = `
    <div style="padding: 12px; background: var(--bg-card-elevated); border-radius: 6px; margin-top: 12px;">
      <div><strong>Original:</strong> ${escapeHtml(currentEstimate.title)}</div>
      <div><strong>Job:</strong> ${escapeHtml(currentEstimate.job?.name || 'Unknown')}</div>
      <div><strong>Lines:</strong> ${currentEstimate.lines?.length || 0}</div>
      <div><strong>Total:</strong> ${formatCurrency(currentEstimate.total_amount)}</div>
    </div>
  `;

  const modal = document.getElementById('duplicateModal');
  modal.style.display = 'flex';
  modal.classList.add('show');
}

function closeDuplicateModal() {
  const modal = document.getElementById('duplicateModal');
  modal.classList.remove('show');
  modal.style.display = 'none';
}

async function duplicateEstimate() {
  if (!currentEstimate) return;

  const newTitle = document.getElementById('duplicateTitle').value;
  const targetJobId = document.getElementById('duplicateJob').value || null;

  if (!newTitle) {
    showToast('Please enter a title for the copy', 'error');
    return;
  }

  try {
    const response = await fetch(`/api/estimates/${currentEstimate.id}/duplicate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        new_title: newTitle,
        target_job_id: targetJobId,
        created_by: window.currentUser || 'User'
      })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to duplicate estimate');
    }

    const result = await response.json();
    showToast('Estimate duplicated', 'success');
    closeDuplicateModal();
    closeDetailModal();

    await loadEstimates();
    await loadStats();

    if (result.estimate?.id) {
      await openEstimateDetail(result.estimate.id);
    }
  } catch (err) {
    console.error('Error duplicating estimate:', err);
    showToast(err.message, 'error');
  }
}

function openColumnSettings() {
  showToast('Column settings - coming soon', 'info');
}

// ============================================================
// TEMPLATES FUNCTIONS
// ============================================================

async function openTemplatesModal() {
  const grid = document.getElementById('templatesGrid');
  if (!grid) return;

  grid.innerHTML = '<p class="text-muted">Loading templates...</p>';

  const modal = document.getElementById('templatesModal');
  modal.style.display = 'flex';
  modal.classList.add('show');

  try {
    const response = await fetch('/api/estimates/templates');
    const templates = await response.json();

    if (!templates.length) {
      grid.innerHTML = '<p class="text-muted">No templates available.</p>';
      return;
    }

    grid.innerHTML = templates.map(t => `
      <div class="template-card" onclick="previewTemplate('${t.id}')"
           style="padding: 16px; border: 1px solid var(--border); border-radius: 8px; cursor: pointer; transition: border-color 0.2s;">
        <div style="font-size: 2rem; margin-bottom: 8px;">${t.icon}</div>
        <div style="font-weight: 600;">${escapeHtml(t.name)}</div>
        <div style="font-size: 0.85rem; color: var(--text-secondary);">${escapeHtml(t.description)}</div>
        <div style="margin-top: 8px; font-size: 0.8rem; color: var(--accent-blue);">${t.items.length} items</div>
      </div>
    `).join('');

    // Store templates for preview
    window._templates = templates;
  } catch (err) {
    console.error('Error loading templates:', err);
    grid.innerHTML = '<p class="text-muted">Failed to load templates.</p>';
  }
}

function closeTemplatesModal() {
  const modal = document.getElementById('templatesModal');
  modal.classList.remove('show');
  modal.style.display = 'none';
  document.getElementById('templatePreview').style.display = 'none';
  window._selectedTemplate = null;
}

function previewTemplate(templateId) {
  const template = window._templates?.find(t => t.id === templateId);
  if (!template) return;

  window._selectedTemplate = template;

  document.getElementById('templatesGrid').style.display = 'none';
  document.getElementById('templatePreview').style.display = 'block';
  document.getElementById('templatePreviewTitle').textContent = template.name;

  document.getElementById('templatePreviewItems').innerHTML = template.items.map(item => `
    <div style="display: flex; justify-content: space-between; padding: 8px; background: var(--bg-card-elevated); border-radius: 4px; margin-bottom: 4px;">
      <span>${item.code} - ${escapeHtml(item.cost_code_name || item.name)}</span>
      <span style="color: var(--text-secondary);">${item.unit}</span>
    </div>
  `).join('');
}

function hideTemplatePreview() {
  document.getElementById('templatePreview').style.display = 'none';
  document.getElementById('templatesGrid').style.display = 'grid';
  window._selectedTemplate = null;
}

async function addTemplateItems() {
  if (!currentEstimate || !window._selectedTemplate) return;

  const template = window._selectedTemplate;

  try {
    // Add each template item as a line
    for (const item of template.items) {
      await fetch(`/api/estimates/${currentEstimate.id}/lines`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cost_code_id: item.cost_code_id,
          description: item.cost_code_name || item.name,
          quantity: 1,
          unit: item.unit,
          unit_cost: 0,
          amount: 0,
          created_by: window.currentUser || 'User'
        })
      });
    }

    showToast(`Added ${template.items.length} items from template`, 'success');
    closeTemplatesModal();
    await openEstimateDetail(currentEstimate.id);
    switchTab('lines');
  } catch (err) {
    console.error('Error adding template items:', err);
    showToast('Failed to add template items', 'error');
  }
}

// ============================================================
// SCOPE & AI FUNCTIONS
// ============================================================

function openScopeModal() {
  document.getElementById('scopeText').value = '';
  document.getElementById('scopeResults').style.display = 'none';

  const modal = document.getElementById('scopeAnalysisModal');
  modal.style.display = 'flex';
  modal.classList.add('show');
}

function closeScopeModal() {
  const modal = document.getElementById('scopeAnalysisModal');
  modal.classList.remove('show');
  modal.style.display = 'none';
}

async function analyzeScope() {
  const scopeText = document.getElementById('scopeText').value;
  if (!scopeText || scopeText.trim().length < 10) {
    showToast('Please enter at least 10 characters describing the scope', 'error');
    return;
  }

  const btn = document.getElementById('analyzeScopeBtn');
  btn.disabled = true;
  btn.textContent = 'Analyzing...';

  try {
    const response = await fetch('/api/estimates/analyze-scope', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope_text: scopeText })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to analyze scope');
    }

    const result = await response.json();

    // Show results
    document.getElementById('scopeResults').style.display = 'block';
    document.getElementById('scopeLineItems').innerHTML = result.line_items.map((item, i) => `
      <div class="scope-item" style="display: flex; align-items: center; gap: 12px; padding: 12px; border: 1px solid var(--border); border-radius: 6px; margin-bottom: 8px;">
        <input type="checkbox" class="scope-item-check" data-index="${i}" checked>
        <div style="flex: 1;">
          <div style="font-weight: 600;">${item.cost_code} - ${escapeHtml(item.description)}</div>
          <div style="font-size: 0.85rem; color: var(--text-secondary);">
            ${item.quantity} ${item.unit} x ${formatCurrency(item.unit_cost)} = ${formatCurrency(item.amount)}
          </div>
          ${item.notes ? `<div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 4px;">${escapeHtml(item.notes)}</div>` : ''}
        </div>
      </div>
    `).join('');

    window._scopeItems = result.line_items;
    showToast(`Found ${result.line_items.length} potential line items`, 'success');
  } catch (err) {
    console.error('Error analyzing scope:', err);
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Analyze with AI';
  }
}

function selectAllScopeItems() {
  document.querySelectorAll('.scope-item-check').forEach(cb => cb.checked = true);
}

async function addSelectedScopeItems() {
  if (!currentEstimate || !window._scopeItems) return;

  const selectedIndices = [];
  document.querySelectorAll('.scope-item-check:checked').forEach(cb => {
    selectedIndices.push(parseInt(cb.dataset.index));
  });

  if (selectedIndices.length === 0) {
    showToast('Please select at least one item to add', 'error');
    return;
  }

  try {
    for (const index of selectedIndices) {
      const item = window._scopeItems[index];
      await fetch(`/api/estimates/${currentEstimate.id}/lines`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cost_code_id: item.cost_code_id,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          unit_cost: item.unit_cost,
          amount: item.amount,
          notes: item.notes,
          created_by: window.currentUser || 'User'
        })
      });
    }

    showToast(`Added ${selectedIndices.length} items from scope analysis`, 'success');
    closeScopeModal();
    await openEstimateDetail(currentEstimate.id);
    switchTab('lines');
  } catch (err) {
    console.error('Error adding scope items:', err);
    showToast('Failed to add scope items', 'error');
  }
}

function openGenerateScopeModal() { showToast('Generate scope - coming soon', 'info'); }
function closeGenerateScopeModal() { document.getElementById('generateScopeModal').style.display = 'none'; }
function openScopesListModal() { showToast('View scopes - coming soon', 'info'); }
function closeScopesListModal() { document.getElementById('scopesListModal').style.display = 'none'; }

// ============================================================
// ASSEMBLY FUNCTIONS
// ============================================================

function openCreateAssemblyModal() {
  if (!currentEstimate) {
    showToast('No estimate loaded', 'error');
    return;
  }

  // Get selected lines
  const selectedLines = [];
  document.querySelectorAll('.line-select:checked').forEach(cb => {
    const lineId = cb.dataset.lineId;
    const line = currentEstimate.lines?.find(l => l.id === lineId);
    if (line) selectedLines.push(line);
  });

  if (selectedLines.length < 1) {
    showToast('Please select at least one line item', 'error');
    return;
  }

  // Show preview
  const total = selectedLines.reduce((sum, l) => sum + parseFloat(l.amount || 0), 0);
  document.getElementById('assemblyPreview').innerHTML = `
    <p>${selectedLines.length} items selected - Total: ${formatCurrency(total)}</p>
    ${selectedLines.map(l => `<div style="font-size: 0.85rem; padding: 4px 0; border-bottom: 1px solid var(--border);">${escapeHtml(l.description || l.cost_code?.name || 'No description')}</div>`).join('')}
  `;

  document.getElementById('assemblyName').value = '';
  document.getElementById('hideComponentsFromClient').checked = false;

  const modal = document.getElementById('assemblyModal');
  modal.style.display = 'flex';
  modal.classList.add('show');
}

function closeAssemblyModal() {
  const modal = document.getElementById('assemblyModal');
  modal.classList.remove('show');
  modal.style.display = 'none';
}

async function createAssembly() {
  if (!currentEstimate) return;

  const name = document.getElementById('assemblyName').value;
  if (!name) {
    showToast('Please enter an assembly name', 'error');
    return;
  }

  const selectedLineIds = [];
  document.querySelectorAll('.line-select:checked').forEach(cb => {
    selectedLineIds.push(cb.dataset.lineId);
  });

  if (selectedLineIds.length < 1) {
    showToast('Please select at least one line item', 'error');
    return;
  }

  const hideFromClient = document.getElementById('hideComponentsFromClient').checked;

  try {
    const response = await fetch(`/api/estimates/${currentEstimate.id}/assemblies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        line_ids: selectedLineIds,
        name,
        hide_components_from_client: hideFromClient,
        created_by: window.currentUser || 'User'
      })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to create assembly');
    }

    showToast('Assembly created', 'success');
    closeAssemblyModal();
    await openEstimateDetail(currentEstimate.id);
  } catch (err) {
    console.error('Error creating assembly:', err);
    showToast(err.message, 'error');
  }
}

// ============================================================
// VERSION & CONVERSION FUNCTIONS
// ============================================================

async function createNewVersion() {
  if (!currentEstimate) {
    showToast('No estimate loaded', 'error');
    return;
  }

  if (!confirm(`Create a new version of "${currentEstimate.title}"? This will copy all line items to a new draft estimate.`)) {
    return;
  }

  try {
    const response = await fetch(`/api/estimates/${currentEstimate.id}/new-version`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ created_by: window.currentUser || 'User' })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to create new version');
    }

    const result = await response.json();
    showToast(result.message, 'success');
    closeDetailModal();

    await loadEstimates();
    await loadStats();

    if (result.estimate?.id) {
      await openEstimateDetail(result.estimate.id);
    }
  } catch (err) {
    console.error('Error creating new version:', err);
    showToast(err.message, 'error');
  }
}

async function convertToAllowances() {
  if (!currentEstimate) {
    showToast('No estimate loaded', 'error');
    return;
  }

  if (!confirm('Convert estimate items to allowances? This will create allowances for each selection category.')) {
    return;
  }

  try {
    const response = await fetch(`/api/estimates/${currentEstimate.id}/convert-to-allowances`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ converted_by: window.currentUser || 'User' })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to convert to allowances');
    }

    const result = await response.json();
    showToast(result.message, 'success');

    await openEstimateDetail(currentEstimate.id);
  } catch (err) {
    console.error('Error converting to allowances:', err);
    showToast(err.message, 'error');
  }
}

// ============================================================
// COST LIBRARY SIDEBAR
// ============================================================

function toggleCostLibrarySidebar() {
  const sidebar = document.getElementById('costLibrarySidebar');
  if (!sidebar) return;

  sidebar.classList.toggle('open');

  if (sidebar.classList.contains('open')) {
    loadCostLibrary();
  }
}

async function loadCostLibrary() {
  const categoriesDiv = document.getElementById('costLibraryCategories');
  if (!categoriesDiv) return;

  // Group cost codes by category
  const byCategory = {};
  costCodes.forEach(cc => {
    const cat = cc.category || 'Uncategorized';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(cc);
  });

  categoriesDiv.innerHTML = Object.entries(byCategory)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([cat, codes]) => `
      <div class="sidebar-section">
        <div class="sidebar-section-header" onclick="toggleSidebarSection('cat-${cat.replace(/\s/g, '-')}')" style="cursor: pointer; padding: 8px; display: flex; justify-content: space-between;">
          <span>${escapeHtml(cat)}</span>
          <span style="color: var(--text-secondary);">${codes.length}</span>
        </div>
        <div class="sidebar-section-content" id="cat-${cat.replace(/\s/g, '-')}" style="display: none;">
          ${codes.map(cc => `
            <div class="cost-library-item" onclick="addCostCodeToEstimate('${cc.id}')"
                 draggable="true" ondragstart="dragCostCode(event, '${cc.id}')"
                 style="padding: 6px 8px; cursor: pointer; font-size: 0.85rem; border-bottom: 1px solid var(--border);">
              <div style="font-weight: 600;">${cc.code}</div>
              <div style="color: var(--text-secondary);">${escapeHtml(cc.name)}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `).join('');
}

function toggleSidebarSection(sectionId) {
  const content = document.getElementById(sectionId);
  if (content) {
    content.style.display = content.style.display === 'none' ? 'block' : 'none';
  }
}

function filterCostLibrary() {
  const search = document.getElementById('costLibrarySearch')?.value.toLowerCase() || '';
  const items = document.querySelectorAll('.cost-library-item');

  items.forEach(item => {
    const text = item.textContent.toLowerCase();
    item.style.display = text.includes(search) ? 'block' : 'none';
  });
}

function dragCostCode(event, costCodeId) {
  event.dataTransfer.setData('costCodeId', costCodeId);
}

async function addCostCodeToEstimate(costCodeId) {
  const cc = costCodes.find(c => c.id === costCodeId);
  if (!cc || !currentEstimate) return;

  // Pre-fill the add line modal
  openAddLineModal();
  document.getElementById('lineCostCode').value = costCodeId;
  document.getElementById('lineDescription').value = cc.name;
  await onCostCodeSelected();
}

function regroupLines() {
  const groupBy = document.getElementById('lineGroupBy')?.value || 'none';
  // Re-render with grouping - would need to implement grouped rendering
  showToast(`Grouping by ${groupBy}`, 'info');
}

function closeProjectDetailsModal() {
  const modal = document.getElementById('projectDetailsModal');
  modal.classList.remove('show');
  modal.style.display = 'none';
}

async function convertToBudget() {
  if (!currentEstimate) {
    showToast('No estimate selected', 'error');
    return;
  }

  if (currentEstimate.status !== 'approved') {
    showToast('Only approved estimates can be converted to budget', 'warning');
    return;
  }

  if (!confirm('Convert this estimate to budget lines? This will create budget entries for each line item.')) {
    return;
  }

  try {
    const response = await fetch(`/api/estimates/${currentEstimate.id}/convert-to-budget`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ converted_by: window.currentUser || 'User' })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to convert to budget');
    }

    const result = await response.json();
    showToast(result.message || 'Estimate converted to budget', 'success');

    // Refresh the estimate
    await openEstimateDetail(currentEstimate.id);

    // Offer to view budget
    if (confirm('Budget lines created. Would you like to view the budget now?')) {
      backToList();
      switchMode('budget');
      if (currentEstimate.job_id) {
        currentJobId = currentEstimate.job_id;
        await loadJobBudgetForJob(currentEstimate.job_id);
      }
    }
  } catch (err) {
    console.error('Error converting to budget:', err);
    showToast(err.message, 'error');
  }
}

// ============================================================
// BUDGET MODE - DATA & RENDERING
// ============================================================

async function loadJobBudgetForJob(jobId) {
  if (!jobId) {
    currentJobId = null;
    comparisonData = null;
    renderBudgetEmptyState();
    return;
  }

  currentJobId = jobId;

  try {
    // Load comparison data
    const response = await fetch(`/api/budget-builder/jobs/${jobId}/comparison`);
    comparisonData = await response.json();

    // Check for AI estimate
    const aiResponse = await fetch(`/api/ai-estimates/jobs/${jobId}`);
    aiEstimate = await aiResponse.json();

    renderBudgetStats();
    renderCoverageBar();
    renderComparisonTable();

    // Show/hide AI estimate banner
    const noAiEstimate = document.getElementById('noAiEstimate');
    if (noAiEstimate) {
      noAiEstimate.style.display = aiEstimate ? 'none' : 'block';
    }

  } catch (err) {
    console.error('Error loading job budget:', err);
    showToast('Failed to load budget data', 'error');
  }
}

function loadJobBudget() {
  if (currentJobId) {
    loadJobBudgetForJob(currentJobId);
  }
}

function renderBudgetEmptyState() {
  const tbody = document.getElementById('comparisonBody');
  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 40px;">
          Select a job to view budget comparison
        </td>
      </tr>
    `;
  }
  const noAiEstimate = document.getElementById('noAiEstimate');
  if (noAiEstimate) noAiEstimate.style.display = 'none';
}

function renderBudgetStats() {
  if (!comparisonData) return;

  const { totals, coverage } = comparisonData;

  const statTotal = document.getElementById('budgetStatTotal');
  const statFromBids = document.getElementById('budgetStatFromBids');
  const statFromAI = document.getElementById('budgetStatFromAI');
  const statGaps = document.getElementById('budgetStatGaps');

  if (statTotal) statTotal.textContent = formatCurrency(totals?.budget || 0);
  if (statFromBids) statFromBids.textContent = `${coverage?.from_bids_pct || 0}%`;
  if (statFromAI) statFromAI.textContent = `${coverage?.from_ai_pct || 0}%`;
  if (statGaps) statGaps.textContent = totals?.gaps || 0;
}

function renderCoverageBar() {
  if (!comparisonData) return;

  const { coverage } = comparisonData;

  const coverageBids = document.getElementById('coverageBids');
  const coverageEstimates = document.getElementById('coverageEstimates');
  const coverageAI = document.getElementById('coverageAI');
  const coverageManual = document.getElementById('coverageManual');

  if (coverageBids) {
    coverageBids.style.width = `${coverage?.from_bids_pct || 0}%`;
    coverageBids.textContent = (coverage?.from_bids_pct || 0) > 10 ? `${coverage.from_bids_pct}%` : '';
  }

  if (coverageEstimates) {
    coverageEstimates.style.width = `${coverage?.from_estimates_pct || 0}%`;
    coverageEstimates.textContent = (coverage?.from_estimates_pct || 0) > 10 ? `${coverage.from_estimates_pct}%` : '';
  }

  if (coverageAI) {
    coverageAI.style.width = `${coverage?.from_ai_pct || 0}%`;
    coverageAI.textContent = (coverage?.from_ai_pct || 0) > 10 ? `${coverage.from_ai_pct}%` : '';
  }

  if (coverageManual) {
    coverageManual.style.width = `${coverage?.from_manual_pct || 0}%`;
    coverageManual.textContent = (coverage?.from_manual_pct || 0) > 10 ? `${coverage.from_manual_pct}%` : '';
  }
}

function renderComparisonTable() {
  if (!comparisonData) return;

  const filter = document.getElementById('budgetFilterView')?.value || 'all';
  const search = (document.getElementById('searchCostCode')?.value || '').toLowerCase();

  let rows = comparisonData.comparison || [];

  // Apply filters
  if (filter === 'with-budget') {
    rows = rows.filter(r => r.budget);
  } else if (filter === 'gaps') {
    rows = rows.filter(r => !r.budget && !r.ai_estimate && (!r.bids || r.bids.length === 0));
  } else if (filter === 'from-bids') {
    rows = rows.filter(r => r.budget?.source_type === 'accepted_bid');
  } else if (filter === 'from-ai') {
    rows = rows.filter(r => r.budget?.source_type === 'ai_estimate');
  }

  // Apply search
  if (search) {
    rows = rows.filter(r =>
      r.cost_code?.code?.toLowerCase().includes(search) ||
      r.cost_code?.name?.toLowerCase().includes(search)
    );
  }

  const tbody = document.getElementById('comparisonBody');
  if (!tbody) return;

  if (rows.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 40px; color: var(--text-secondary);">
          No cost codes match the current filter
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = rows.map(row => {
    const cc = row.cost_code;
    const budget = row.budget;
    const ai = row.ai_estimate;
    const bids = row.bids || [];

    // AI estimate cell
    let aiCell = '<span class="amount-cell secondary">-</span>';
    if (ai) {
      aiCell = `<span class="amount-cell secondary">${formatCurrency(ai.amount)}</span>`;
    }

    // Bids cell
    let bidsCell = '<span class="amount-cell secondary">-</span>';
    if (bids.length > 0) {
      bidsCell = `<span class="amount-cell">${formatCurrency(bids[0].amount)}</span>`;
      if (bids[0].vendor_name) {
        bidsCell += `<br><small class="text-muted">${escapeHtml(bids[0].vendor_name)}</small>`;
      }
    }

    // Budget cell
    let budgetCell = '<span class="amount-cell secondary">-</span>';
    if (budget) {
      budgetCell = `<span class="amount-cell primary">${formatCurrency(budget.amount)}</span>`;
    }

    // Source badge
    let sourceBadge = `<span class="source-badge none" onclick="openSourceModal('${cc.id}')">Set</span>`;
    if (budget) {
      const sourceType = budget.source_type || 'manual';
      const sourceClass = sourceType === 'accepted_bid' ? 'bid' :
                          sourceType === 'ai_estimate' ? 'ai' :
                          sourceType === 'estimate' ? 'estimate' : 'manual';
      const sourceLabel = sourceType === 'accepted_bid' ? 'Bid' :
                          sourceType === 'ai_estimate' ? 'AI' :
                          sourceType === 'estimate' ? 'Est' : 'Manual';
      sourceBadge = `<span class="source-badge ${sourceClass}" onclick="openSourceModal('${cc.id}')">${sourceLabel}</span>`;
    }

    // Lock button
    const isLocked = budget?.locked || false;
    const lockBtn = `
      <button class="lock-btn ${isLocked ? 'locked' : ''}"
              onclick="toggleLock('${cc.id}')"
              title="${isLocked ? 'Unlock' : 'Lock'}">
        ${isLocked ? 'ðŸ”’' : 'ðŸ”“'}
      </button>
    `;

    return `
      <tr data-cost-code-id="${cc.id}">
        <td>
          <div class="cost-code-cell">
            <span class="cost-code-number">${escapeHtml(cc.code)}</span>
            <span class="cost-code-name">${escapeHtml(cc.name)}</span>
          </div>
        </td>
        <td>${aiCell}</td>
        <td>${bidsCell}</td>
        <td><span class="amount-cell secondary">-</span></td>
        <td>${budgetCell}</td>
        <td>${sourceBadge}</td>
        <td>${lockBtn}</td>
      </tr>
    `;
  }).join('');
}

function applyBudgetFilter() {
  renderComparisonTable();
}

// ============================================================
// BUDGET MODE - ACTIONS
// ============================================================

async function generateAIEstimate() {
  if (!currentJobId) {
    showToast('Please select a job first', 'warning');
    return;
  }

  try {
    showToast('Generating AI estimate...', 'info');

    const response = await fetch(`/api/ai-estimates/jobs/${currentJobId}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ generated_by: window.currentUser || 'User' })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to generate AI estimate');
    }

    const result = await response.json();
    showToast(`AI estimate generated with ${result.estimate?.lines?.length || 0} line items`, 'success');

    await loadJobBudget();
  } catch (err) {
    console.error('Error generating AI estimate:', err);
    showToast(err.message, 'error');
  }
}

async function autoAssemble() {
  if (!currentJobId) {
    showToast('Please select a job first', 'warning');
    return;
  }

  if (!confirm('Auto-assemble will update unlocked budget lines with the best available source (bids > estimates > AI). Continue?')) {
    return;
  }

  try {
    const response = await fetch(`/api/budget-builder/jobs/${currentJobId}/assemble`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ performed_by: window.currentUser || 'User', include_ai: true })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to assemble budget');
    }

    const result = await response.json();
    showToast(result.message, 'success');

    await loadJobBudget();
  } catch (err) {
    console.error('Error assembling budget:', err);
    showToast(err.message, 'error');
  }
}

async function lockAll() {
  if (!currentJobId) return;

  try {
    const response = await fetch(`/api/budget-builder/jobs/${currentJobId}/lock-all`, {
      method: 'POST'
    });

    if (!response.ok) throw new Error('Failed to lock budget lines');

    showToast('All budget lines locked', 'success');
    await loadJobBudget();
  } catch (err) {
    console.error('Error locking:', err);
    showToast(err.message, 'error');
  }
}

async function unlockAll() {
  if (!currentJobId) return;

  try {
    const response = await fetch(`/api/budget-builder/jobs/${currentJobId}/unlock-all`, {
      method: 'POST'
    });

    if (!response.ok) throw new Error('Failed to unlock budget lines');

    showToast('All budget lines unlocked', 'success');
    await loadJobBudget();
  } catch (err) {
    console.error('Error unlocking:', err);
    showToast(err.message, 'error');
  }
}

async function toggleLock(costCodeId) {
  if (!currentJobId) return;

  try {
    const response = await fetch(`/api/budget-builder/jobs/${currentJobId}/lines/${costCodeId}/lock`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });

    if (!response.ok) throw new Error('Failed to toggle lock');

    await loadJobBudget();
  } catch (err) {
    console.error('Error toggling lock:', err);
    showToast(err.message, 'error');
  }
}

async function refreshPricing() {
  try {
    showToast('Refreshing historical pricing data...', 'info');

    const response = await fetch('/api/ai-estimates/refresh-pricing', {
      method: 'POST'
    });

    if (!response.ok) throw new Error('Failed to refresh pricing');

    const result = await response.json();
    showToast(`Pricing updated for ${result.results?.length || 0} cost codes`, 'success');
  } catch (err) {
    console.error('Error refreshing pricing:', err);
    showToast(err.message, 'error');
  }
}

function exportBudget() {
  if (!currentJobId) {
    showToast('Please select a job first', 'warning');
    return;
  }

  window.open(`/budgets.html?job_id=${currentJobId}`, '_blank');
}

// ============================================================
// BUDGET MODE - SOURCE MODAL
// ============================================================

let currentSourceCostCodeId = null;

function openSourceModal(costCodeId) {
  currentSourceCostCodeId = costCodeId;

  const row = comparisonData?.comparison?.find(r => r.cost_code.id === costCodeId);
  if (!row) return;

  const cc = row.cost_code;
  document.getElementById('sourceModalCostCode').textContent = `${cc.code} - ${cc.name}`;

  // Build options
  const select = document.getElementById('sourceModalSelect');
  select.innerHTML = '<option value="manual">Manual Entry</option>';

  if (row.ai_estimate) {
    select.innerHTML += `<option value="ai_estimate" data-amount="${row.ai_estimate.amount}">AI Estimate (${formatCurrency(row.ai_estimate.amount)})</option>`;
  }

  (row.bids || []).forEach((bid) => {
    select.innerHTML += `<option value="accepted_bid" data-amount="${bid.amount}" data-id="${bid.bid_id}">Bid: ${bid.vendor_name || 'Unknown'} (${formatCurrency(bid.amount)})</option>`;
  });

  // Set current values
  if (row.budget) {
    document.getElementById('sourceModalAmount').value = row.budget.amount || '';
    document.getElementById('sourceModalLock').checked = row.budget.locked || false;
  } else {
    document.getElementById('sourceModalAmount').value = '';
    document.getElementById('sourceModalLock').checked = false;
  }

  // Update amount when selection changes
  select.onchange = function() {
    const option = this.options[this.selectedIndex];
    const amount = option.dataset.amount;
    if (amount) {
      document.getElementById('sourceModalAmount').value = amount;
    }
  };

  const modal = document.getElementById('sourceModal');
  modal.style.display = 'flex';
  modal.classList.add('show');
}

function closeSourceModal() {
  const modal = document.getElementById('sourceModal');
  modal.classList.remove('show');
  modal.style.display = 'none';
  currentSourceCostCodeId = null;
}

async function saveSourceChange() {
  if (!currentJobId || !currentSourceCostCodeId) return;

  const select = document.getElementById('sourceModalSelect');
  const option = select.options[select.selectedIndex];
  const sourceType = option.value;
  const sourceId = option.dataset.id || null;
  const amount = parseFloat(document.getElementById('sourceModalAmount').value) || 0;
  const lock = document.getElementById('sourceModalLock').checked;

  try {
    const response = await fetch(`/api/budget-builder/jobs/${currentJobId}/lines/${currentSourceCostCodeId}/source`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source_type: sourceType,
        source_id: sourceId,
        amount,
        lock
      })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to update source');
    }

    showToast('Budget source updated', 'success');
    closeSourceModal();
    await loadJobBudget();
  } catch (err) {
    console.error('Error saving source:', err);
    showToast(err.message, 'error');
  }
}

// ============================================================
// HIERARCHICAL ESTIMATE RENDERING
// ============================================================

/**
 * Render estimate hierarchy with phases, groups, subgroups
 * @param {Object} estimate - Estimate object with phases array
 */
function renderEstimateHierarchy(estimate) {
  const container = document.getElementById('estimateHierarchy');
  if (!container) return;

  if (!estimate.phases || estimate.phases.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <h3>No phases yet</h3>
        <p>Apply a template or add phases manually to structure your estimate.</p>
        <div style="display: flex; gap: 12px; justify-content: center; margin-top: 16px;">
          <button class="btn btn-primary" onclick="openTemplateSelector()">Apply Template</button>
          <button class="btn btn-ghost" onclick="addPhase()">+ Add Phase</button>
        </div>
      </div>
    `;
    return;
  }

  const canEdit = currentEstimate && ['draft', 'rejected'].includes(currentEstimate.status);

  container.innerHTML = estimate.phases.map(phase => `
    <div class="estimate-phase" data-phase-id="${phase.id}">
      <div class="phase-header" onclick="togglePhase(this)">
        <span class="collapse-icon">&#9660;</span>
        <span class="phase-name">${escapeHtml(phase.name)}</span>
        <span class="phase-subtotal">${formatCurrency(phase.subtotal || 0)}</span>
        ${canEdit ? `
          <div class="phase-actions">
            <button class="btn btn-ghost btn-xs" onclick="editPhase(event, '${phase.id}')">Edit</button>
            <button class="btn btn-ghost btn-xs" onclick="addGroup('${phase.id}')">+ Group</button>
            <button class="btn btn-ghost btn-xs text-danger" onclick="deletePhase(event, '${phase.id}')">Delete</button>
          </div>
        ` : ''}
      </div>
      <div class="phase-content">
        ${(phase.groups || []).map(group => renderGroup(group, canEdit)).join('')}
        ${(!phase.groups || phase.groups.length === 0) ? `
          <div class="empty-state-inline">
            <span>No groups</span>
            ${canEdit ? `<button class="btn btn-ghost btn-xs" onclick="addGroup('${phase.id}')">+ Add Group</button>` : ''}
          </div>
        ` : ''}
      </div>
    </div>
  `).join('');

  // Update total
  const total = estimate.phases.reduce((sum, p) => sum + parseFloat(p.subtotal || 0), 0);
  const totalElement = document.getElementById('estimateTotalAmount');
  if (totalElement) {
    totalElement.textContent = formatCurrency(total);
  }

  // Restore collapse state
  restoreCollapseState();
}

/**
 * Render a group with subgroups
 */
function renderGroup(group, canEdit) {
  return `
    <div class="estimate-group" data-group-id="${group.id}">
      <div class="group-header" onclick="toggleGroup(this)">
        <span class="collapse-icon">&#9660;</span>
        <span class="group-name">${escapeHtml(group.name)}</span>
        <span class="group-subtotal">${formatCurrency(group.subtotal || 0)}</span>
        ${canEdit ? `
          <div class="group-actions">
            <button class="btn btn-ghost btn-xs" onclick="editGroup(event, '${group.id}')">Edit</button>
            <button class="btn btn-ghost btn-xs" onclick="addSubgroup('${group.id}')">+ Subgroup</button>
            <button class="btn btn-ghost btn-xs text-danger" onclick="deleteGroup(event, '${group.id}')">Delete</button>
          </div>
        ` : ''}
      </div>
      <div class="group-content">
        ${(group.subgroups || []).map(sg => renderSubgroup(sg, canEdit)).join('')}
        ${(!group.subgroups || group.subgroups.length === 0) ? `
          <div class="empty-state-inline">
            <span>No subgroups</span>
            ${canEdit ? `<button class="btn btn-ghost btn-xs" onclick="addSubgroup('${group.id}')">+ Add Subgroup</button>` : ''}
          </div>
        ` : ''}
      </div>
    </div>
  `;
}

/**
 * Render a subgroup with line items
 */
function renderSubgroup(subgroup, canEdit) {
  const lines = subgroup.line_items || [];
  return `
    <div class="estimate-subgroup" data-subgroup-id="${subgroup.id}">
      <div class="subgroup-header" onclick="toggleSubgroup(this)">
        <span class="collapse-icon">&#9660;</span>
        <span class="subgroup-name">${escapeHtml(subgroup.name)}</span>
        <span class="subgroup-subtotal">${formatCurrency(subgroup.subtotal || 0)}</span>
        ${canEdit ? `
          <div class="subgroup-actions">
            <button class="btn btn-ghost btn-xs" onclick="editSubgroup(event, '${subgroup.id}')">Edit</button>
            <button class="btn btn-ghost btn-xs" onclick="addLineItemToSubgroup('${subgroup.id}')">+ Item</button>
            <button class="btn btn-ghost btn-xs text-danger" onclick="deleteSubgroup(event, '${subgroup.id}')">Delete</button>
          </div>
        ` : ''}
      </div>
      <div class="subgroup-content">
        ${lines.length > 0 ? `
          <table class="data-table estimate-lines-table">
            <thead>
              <tr>
                <th style="width: 30px"></th>
                <th>Description</th>
                <th>Cost Code</th>
                <th class="col-right">Qty</th>
                <th>Unit</th>
                <th class="col-right">Unit Cost</th>
                <th class="col-right">Amount</th>
                <th style="width: 80px"></th>
              </tr>
            </thead>
            <tbody>
              ${lines.map(line => renderHierarchyLineItem(line, canEdit)).join('')}
            </tbody>
          </table>
        ` : `
          <div class="empty-state-inline">
            <span>No items</span>
            ${canEdit ? `<button class="btn btn-ghost btn-xs" onclick="addLineItemToSubgroup('${subgroup.id}')">+ Add Item</button>` : ''}
          </div>
        `}
      </div>
    </div>
  `;
}

/**
 * Render a line item row in hierarchy view
 */
function renderHierarchyLineItem(line, canEdit) {
  const hasCatalog = !!line.catalog_item_id;
  return `
    <tr class="line-item-row ${hasCatalog ? 'has-catalog' : ''}" data-line-id="${line.id}">
      <td>
        ${canEdit ? '<span class="drag-handle" title="Drag to reorder">&#8942;&#8942;</span>' : ''}
      </td>
      <td>
        ${escapeHtml(line.description || '')}
        ${hasCatalog ? '<span class="catalog-badge">Catalog</span>' : ''}
      </td>
      <td>${line.cost_code?.code || '-'}</td>
      <td class="col-right">${line.quantity || 1}</td>
      <td>${line.unit || '-'}</td>
      <td class="col-right">${formatCurrency(line.unit_cost || 0)}</td>
      <td class="col-right">${formatCurrency(line.amount || 0)}</td>
      <td>
        ${canEdit ? `
          <button class="btn btn-ghost btn-xs" onclick="editLineItem('${line.id}')">Edit</button>
          <button class="btn btn-ghost btn-xs text-danger" onclick="deleteLineItem('${line.id}')">Delete</button>
        ` : ''}
      </td>
    </tr>
  `;
}

// ============================================================
// COLLAPSE/EXPAND FUNCTIONS
// ============================================================

function togglePhase(header) {
  const phase = header.closest('.estimate-phase');
  phase.classList.toggle('collapsed');
  saveCollapseState();
}

function toggleGroup(header) {
  const group = header.closest('.estimate-group');
  group.classList.toggle('collapsed');
  saveCollapseState();
}

function toggleSubgroup(header) {
  const subgroup = header.closest('.estimate-subgroup');
  subgroup.classList.toggle('collapsed');
  saveCollapseState();
}

function expandAll() {
  document.querySelectorAll('.estimate-phase, .estimate-group, .estimate-subgroup')
    .forEach(el => el.classList.remove('collapsed'));
  saveCollapseState();
}

function collapseAll() {
  document.querySelectorAll('.estimate-phase, .estimate-group, .estimate-subgroup')
    .forEach(el => el.classList.add('collapsed'));
  saveCollapseState();
}

/**
 * Save collapse state to localStorage per estimate
 */
function saveCollapseState() {
  if (!currentEstimate) return;
  const state = {};

  document.querySelectorAll('.estimate-phase').forEach(el => {
    state[`phase-${el.dataset.phaseId}`] = el.classList.contains('collapsed');
  });
  document.querySelectorAll('.estimate-group').forEach(el => {
    state[`group-${el.dataset.groupId}`] = el.classList.contains('collapsed');
  });
  document.querySelectorAll('.estimate-subgroup').forEach(el => {
    state[`subgroup-${el.dataset.subgroupId}`] = el.classList.contains('collapsed');
  });

  localStorage.setItem(`estimate-collapse-${currentEstimate.id}`, JSON.stringify(state));
}

/**
 * Restore collapse state from localStorage
 */
function restoreCollapseState() {
  if (!currentEstimate) return;
  const saved = localStorage.getItem(`estimate-collapse-${currentEstimate.id}`);
  if (!saved) return;

  try {
    const state = JSON.parse(saved);

    Object.entries(state).forEach(([key, collapsed]) => {
      const parts = key.split('-');
      const type = parts[0];
      const id = parts.slice(1).join('-');
      const selector = type === 'phase' ? '.estimate-phase' :
                      type === 'group' ? '.estimate-group' : '.estimate-subgroup';
      const el = document.querySelector(`${selector}[data-${type}-id="${id}"]`);
      if (el && collapsed) el.classList.add('collapsed');
    });
  } catch (e) {
    console.error('Error restoring collapse state:', e);
  }
}

// ============================================================
// TEMPLATE SELECTOR
// ============================================================

let estimateTemplates = [];

async function loadTemplates() {
  try {
    const response = await fetch('/api/estimate-templates');
    if (!response.ok) throw new Error('Failed to load templates');
    estimateTemplates = await response.json();
    return estimateTemplates;
  } catch (err) {
    console.error('Error loading templates:', err);
    return [];
  }
}

async function openTemplateSelector() {
  if (!currentEstimate) {
    showToast('Please create an estimate first', 'error');
    return;
  }

  const templates = await loadTemplates();

  const modal = document.getElementById('templateSelectorModal');
  const list = document.getElementById('templateList');

  if (!modal || !list) {
    showToast('Template selector not available', 'error');
    return;
  }

  if (templates.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <p>No templates available. Create templates to quickly structure your estimates.</p>
      </div>
    `;
  } else {
    list.innerHTML = `
      <div class="template-selector-grid">
        ${templates.map(t => `
          <div class="template-option ${t.is_default ? 'default' : ''}"
               onclick="selectTemplate('${t.id}')">
            <div class="template-info">
              <h4>${escapeHtml(t.name)}</h4>
              <p>${escapeHtml(t.description || 'No description')}</p>
              <span class="template-meta">${escapeHtml(t.project_type || 'General')} &bull; ${countTemplatePhases(t)} phases</span>
            </div>
            ${t.is_default ? '<span class="badge badge-success badge-sm">Default</span>' : ''}
          </div>
        `).join('')}
      </div>
    `;
  }

  modal.style.display = 'flex';
  modal.classList.add('show');
}

function closeTemplateSelector() {
  const modal = document.getElementById('templateSelectorModal');
  if (modal) {
    modal.classList.remove('show');
    modal.style.display = 'none';
  }
}

function countTemplatePhases(template) {
  return template.phases?.length || 0;
}

async function selectTemplate(templateId) {
  if (!currentEstimate) {
    showToast('Please create an estimate first', 'error');
    return;
  }

  try {
    const response = await fetch(`/api/estimates/${currentEstimate.id}/apply-template`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ template_id: templateId })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to apply template');
    }

    const estimate = await response.json();
    currentEstimate = estimate;
    renderEstimateHierarchy(estimate);

    closeTemplateSelector();
    showToast('Template applied successfully', 'success');
  } catch (err) {
    console.error('Error applying template:', err);
    showToast(err.message, 'error');
  }
}

// ============================================================
// INLINE ADD FUNCTIONS (Phase/Group/Subgroup)
// ============================================================

async function addPhase() {
  if (!currentEstimate) {
    showToast('Please open an estimate first', 'error');
    return;
  }

  const name = prompt('Phase name:');
  if (!name) return;

  try {
    const response = await fetch(`/api/estimates/${currentEstimate.id}/phases`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to add phase');
    }

    await refreshEstimateHierarchy();
    showToast('Phase added', 'success');
  } catch (err) {
    console.error('Error adding phase:', err);
    showToast(err.message, 'error');
  }
}

async function addGroup(phaseId) {
  if (!currentEstimate) return;

  const name = prompt('Group name:');
  if (!name) return;

  try {
    const response = await fetch(`/api/estimates/phases/${phaseId}/groups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to add group');
    }

    await refreshEstimateHierarchy();
    showToast('Group added', 'success');
  } catch (err) {
    console.error('Error adding group:', err);
    showToast(err.message, 'error');
  }
}

async function addSubgroup(groupId) {
  if (!currentEstimate) return;

  const name = prompt('Subgroup name:');
  if (!name) return;

  try {
    const response = await fetch(`/api/estimates/groups/${groupId}/subgroups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to add subgroup');
    }

    await refreshEstimateHierarchy();
    showToast('Subgroup added', 'success');
  } catch (err) {
    console.error('Error adding subgroup:', err);
    showToast(err.message, 'error');
  }
}

async function addLineItemToSubgroup(subgroupId) {
  if (!currentEstimate) return;

  // Store subgroup ID for the line item modal
  window.currentSubgroupId = subgroupId;
  openAddLineModal();
}

/**
 * Refresh estimate hierarchy after changes
 */
async function refreshEstimateHierarchy() {
  if (!currentEstimate) return;

  try {
    const response = await fetch(`/api/estimates/${currentEstimate.id}`);
    if (!response.ok) throw new Error('Failed to refresh estimate');

    currentEstimate = await response.json();
    renderEstimateHierarchy(currentEstimate);
    restoreCollapseState();
  } catch (err) {
    console.error('Error refreshing estimate:', err);
    showToast('Failed to refresh estimate', 'error');
  }
}

// ============================================================
// EDIT/DELETE PHASE/GROUP/SUBGROUP
// ============================================================

async function editPhase(event, phaseId) {
  event.stopPropagation();

  const phase = currentEstimate?.phases?.find(p => p.id === phaseId);
  if (!phase) return;

  const newName = prompt('Edit phase name:', phase.name);
  if (!newName || newName === phase.name) return;

  try {
    const response = await fetch(`/api/estimates/phases/${phaseId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to update phase');
    }

    await refreshEstimateHierarchy();
    showToast('Phase updated', 'success');
  } catch (err) {
    console.error('Error updating phase:', err);
    showToast(err.message, 'error');
  }
}

async function deletePhase(event, phaseId) {
  event.stopPropagation();

  if (!confirm('Delete this phase and all its contents?')) return;

  try {
    const response = await fetch(`/api/estimates/phases/${phaseId}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to delete phase');
    }

    await refreshEstimateHierarchy();
    showToast('Phase deleted', 'success');
  } catch (err) {
    console.error('Error deleting phase:', err);
    showToast(err.message, 'error');
  }
}

async function editGroup(event, groupId) {
  event.stopPropagation();

  // Find group across all phases
  let group = null;
  for (const phase of (currentEstimate?.phases || [])) {
    group = phase.groups?.find(g => g.id === groupId);
    if (group) break;
  }
  if (!group) return;

  const newName = prompt('Edit group name:', group.name);
  if (!newName || newName === group.name) return;

  try {
    const response = await fetch(`/api/estimates/groups/${groupId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to update group');
    }

    await refreshEstimateHierarchy();
    showToast('Group updated', 'success');
  } catch (err) {
    console.error('Error updating group:', err);
    showToast(err.message, 'error');
  }
}

async function deleteGroup(event, groupId) {
  event.stopPropagation();

  if (!confirm('Delete this group and all its contents?')) return;

  try {
    const response = await fetch(`/api/estimates/groups/${groupId}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to delete group');
    }

    await refreshEstimateHierarchy();
    showToast('Group deleted', 'success');
  } catch (err) {
    console.error('Error deleting group:', err);
    showToast(err.message, 'error');
  }
}

async function editSubgroup(event, subgroupId) {
  event.stopPropagation();

  // Find subgroup across all phases and groups
  let subgroup = null;
  outer: for (const phase of (currentEstimate?.phases || [])) {
    for (const group of (phase.groups || [])) {
      subgroup = group.subgroups?.find(s => s.id === subgroupId);
      if (subgroup) break outer;
    }
  }
  if (!subgroup) return;

  const newName = prompt('Edit subgroup name:', subgroup.name);
  if (!newName || newName === subgroup.name) return;

  try {
    const response = await fetch(`/api/estimates/subgroups/${subgroupId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to update subgroup');
    }

    await refreshEstimateHierarchy();
    showToast('Subgroup updated', 'success');
  } catch (err) {
    console.error('Error updating subgroup:', err);
    showToast(err.message, 'error');
  }
}

async function deleteSubgroup(event, subgroupId) {
  event.stopPropagation();

  if (!confirm('Delete this subgroup and all its line items?')) return;

  try {
    const response = await fetch(`/api/estimates/subgroups/${subgroupId}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to delete subgroup');
    }

    await refreshEstimateHierarchy();
    showToast('Subgroup deleted', 'success');
  } catch (err) {
    console.error('Error deleting subgroup:', err);
    showToast(err.message, 'error');
  }
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

function closeAllModals() {
  document.querySelectorAll('.modal').forEach(modal => {
    modal.classList.remove('show');
    modal.style.display = 'none';
  });
  currentEstimate = null;
  currentSourceCostCodeId = null;
}

function formatCurrency(amount) {
  if (amount == null) return '-';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
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

function formatStatus(status) {
  const statusMap = {
    draft: 'Draft',
    submitted: 'Submitted',
    approved: 'Approved',
    rejected: 'Rejected',
    converted: 'Converted'
  };
  return statusMap[status] || status;
}

function getStatusBadgeClass(status) {
  const classMap = {
    draft: 'warning',
    submitted: 'info',
    approved: 'success',
    rejected: 'danger',
    converted: 'primary'
  };
  return classMap[status] || 'secondary';
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

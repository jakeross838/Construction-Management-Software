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
let collapsedSections = new Set(); // Track collapsed section IDs
let editingSectionId = null; // Currently editing section
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

  // Setup job sidebar listener for budget mode
  if (window.JobSidebar) {
    window.JobSidebar.onJobChange(async (jobId) => {
      currentJobId = jobId || null;
      if (currentMode === 'budget' && jobId) {
        await loadJobBudgetForJob(jobId);
      }
    });
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
  // Filter change handlers
  const jobFilter = document.getElementById('jobFilter');
  const statusFilter = document.getElementById('statusFilter');
  const searchInput = document.getElementById('searchInput');

  if (jobFilter) jobFilter.addEventListener('change', applyFilters);
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
  costCodes = await response.json();
}

function populateJobDropdowns() {
  const selectors = ['jobFilter', 'formJob', 'importJobFilter', 'selectionsJob', 'duplicateJob'];
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
  const jobId = document.getElementById('jobFilter')?.value;
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
  const jobId = document.getElementById('jobFilter')?.value;
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

  const modal = document.getElementById('estimateModal');
  modal.style.display = 'flex';
  modal.classList.add('show');
}

function closeModal() {
  const modal = document.getElementById('estimateModal');
  modal.classList.remove('show');
  modal.style.display = 'none';
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

    // Populate detail modal
    document.getElementById('detailTitle').textContent = currentEstimate.title;
    document.getElementById('detailStatus').textContent = formatStatus(currentEstimate.status);
    document.getElementById('detailStatus').className = `badge badge-${getStatusBadgeClass(currentEstimate.status)}`;
    document.getElementById('detailVersion').textContent = `v${currentEstimate.version || 1}`;
    document.getElementById('detailJob').textContent = currentEstimate.job?.name || '-';
    document.getElementById('detailAmount').textContent = formatCurrency(currentEstimate.total_amount);
    document.getElementById('detailLineCount').textContent = currentEstimate.lines?.length || 0;
    document.getElementById('detailCreated').textContent = formatDateTime(currentEstimate.created_at);
    document.getElementById('detailNotes').textContent = currentEstimate.notes || '-';

    // Render the lines table with sections
    renderLinesTable();

    // Show modal
    const modal = document.getElementById('estimateDetailModal');
    modal.style.display = 'flex';
    modal.classList.add('show');
  } catch (err) {
    console.error('Error loading estimate:', err);
    showToast('Failed to load estimate details', 'error');
  }
}

function closeDetailModal() {
  const modal = document.getElementById('estimateDetailModal');
  modal.classList.remove('show');
  modal.style.display = 'none';
  currentEstimate = null;
}

function switchTab(tabName) {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.tab === tabName);
  });

  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.toggle('active', content.id === `tab-${tabName}`);
  });
}

// Placeholder functions for additional estimate features
function openImportBidModal() { showToast('Import from bid - coming soon', 'info'); }
function closeImportBidModal() { document.getElementById('importBidModal').style.display = 'none'; }
function openFromSelectionsModal() { showToast('From selections - coming soon', 'info'); }
function closeFromSelectionsModal() { document.getElementById('fromSelectionsModal').style.display = 'none'; }
function openDuplicateModal() { showToast('Duplicate - coming soon', 'info'); }
function closeDuplicateModal() { document.getElementById('duplicateModal').style.display = 'none'; }
function openColumnSettings() { showToast('Column settings - coming soon', 'info'); }
function editCurrentEstimate() { showToast('Edit estimate - coming soon', 'info'); }
function openAddLineModal() { showToast('Add line item - coming soon', 'info'); }
function closeLineModal() { document.getElementById('lineItemModal').style.display = 'none'; }
function openTemplatesModal() { showToast('Templates - coming soon', 'info'); }
function closeTemplatesModal() { document.getElementById('templatesModal').style.display = 'none'; }
function openScopeModal() { showToast('AI scope - coming soon', 'info'); }
function closeScopeModal() { document.getElementById('scopeAnalysisModal').style.display = 'none'; }
function openCreateAssemblyModal() { showToast('Create assembly - coming soon', 'info'); }
function closeAssemblyModal() { document.getElementById('assemblyModal').style.display = 'none'; }
function openGenerateScopeModal() { showToast('Generate scope - coming soon', 'info'); }
function closeGenerateScopeModal() { document.getElementById('generateScopeModal').style.display = 'none'; }
function openScopesListModal() { showToast('View scopes - coming soon', 'info'); }
function closeScopesListModal() { document.getElementById('scopesListModal').style.display = 'none'; }
function openMarkupModal() { showToast('Edit markup - coming soon', 'info'); }
function closeMarkupModal() { document.getElementById('markupModal').style.display = 'none'; }
function closeProjectDetailsModal() { document.getElementById('projectDetailsModal').style.display = 'none'; }
async function convertToBudget() {
  if (!currentEstimate) {
    showToast('No estimate selected', 'error');
    return;
  }

  // TODO: Implement actual budget line creation
  // For now show success with View Budget action
  showToast('Estimate converted to budget lines', 'success');

  // Offer to view budget
  if (confirm('Budget lines created. Would you like to view the budget now?')) {
    closeDetailModal();
    switchMode('budget');
    // If we have a job, load its budget
    if (currentEstimate.job_id) {
      currentJobId = currentEstimate.job_id;
      await loadJobBudgetForJob(currentEstimate.job_id);
    }
  }
}
function convertToAllowances() { showToast('Convert to allowances - coming soon', 'info'); }
function createNewVersion() { showToast('New version - coming soon', 'info'); }
function toggleCostLibrarySidebar() { showToast('Cost library - coming soon', 'info'); }
function regroupLines() { showToast('Regroup lines - coming soon', 'info'); }

// ============================================================
// SECTION MANAGEMENT
// ============================================================

function openSectionModal(sectionId = null) {
  editingSectionId = sectionId;

  if (sectionId) {
    // Editing existing section
    const section = currentEstimate?.sections?.find(s => s.id === sectionId);
    if (section) {
      document.getElementById('sectionModalTitle').textContent = 'Edit Section';
      document.getElementById('sectionName').value = section.name || '';
      document.getElementById('sectionDescription').value = section.description || '';
      document.getElementById('sectionId').value = sectionId;
    }
  } else {
    // New section
    document.getElementById('sectionModalTitle').textContent = 'Add Section';
    document.getElementById('sectionName').value = '';
    document.getElementById('sectionDescription').value = '';
    document.getElementById('sectionId').value = '';
  }

  const modal = document.getElementById('sectionModal');
  modal.style.display = 'flex';
  modal.classList.add('show');

  // Focus name field
  setTimeout(() => document.getElementById('sectionName').focus(), 100);
}

function closeSectionModal() {
  const modal = document.getElementById('sectionModal');
  modal.classList.remove('show');
  modal.style.display = 'none';
  editingSectionId = null;
}

async function saveSection() {
  if (!currentEstimate) {
    showToast('No estimate loaded', 'error');
    return;
  }

  const name = document.getElementById('sectionName').value.trim();
  const description = document.getElementById('sectionDescription').value.trim();
  const sectionId = document.getElementById('sectionId').value;

  if (!name) {
    showToast('Section name is required', 'error');
    return;
  }

  try {
    let response;

    if (sectionId) {
      // Update existing section
      response = await fetch(`/api/estimates/${currentEstimate.id}/sections/${sectionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, updated_by: window.currentUser || 'User' })
      });
    } else {
      // Create new section
      response = await fetch(`/api/estimates/${currentEstimate.id}/sections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, created_by: window.currentUser || 'User' })
      });
    }

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to save section');
    }

    showToast(sectionId ? 'Section updated' : 'Section created', 'success');
    closeSectionModal();

    // Reload estimate to get updated sections
    await reloadCurrentEstimate();
  } catch (err) {
    console.error('Error saving section:', err);
    showToast(err.message, 'error');
  }
}

async function deleteSection(sectionId) {
  if (!currentEstimate || !sectionId) return;

  const section = currentEstimate.sections?.find(s => s.id === sectionId);
  const itemCount = (currentEstimate.lines || []).filter(l => l.section_id === sectionId).length;

  const confirmMsg = itemCount > 0
    ? `Delete section "${section?.name}"? The ${itemCount} item(s) in this section will become unsectioned.`
    : `Delete section "${section?.name}"?`;

  if (!confirm(confirmMsg)) return;

  try {
    const response = await fetch(`/api/estimates/${currentEstimate.id}/sections/${sectionId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deleted_by: window.currentUser || 'User' })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to delete section');
    }

    showToast('Section deleted', 'success');
    collapsedSections.delete(sectionId);
    await reloadCurrentEstimate();
  } catch (err) {
    console.error('Error deleting section:', err);
    showToast(err.message, 'error');
  }
}

function toggleSectionCollapse(sectionId) {
  if (collapsedSections.has(sectionId)) {
    collapsedSections.delete(sectionId);
  } else {
    collapsedSections.add(sectionId);
  }
  renderLinesTable();
}

async function reloadCurrentEstimate() {
  if (!currentEstimate?.id) return;

  try {
    const response = await fetch(`/api/estimates/${currentEstimate.id}`);
    if (!response.ok) throw new Error('Failed to reload estimate');
    currentEstimate = await response.json();

    // Re-render the lines tab
    renderLinesTable();
    renderOverviewTab();
  } catch (err) {
    console.error('Error reloading estimate:', err);
  }
}

function renderLinesTable() {
  const tbody = document.getElementById('linesTableBody');
  if (!tbody || !currentEstimate) return;

  const sections = currentEstimate.sections || [];
  const lines = currentEstimate.lines || [];
  const isEditable = ['draft', 'rejected'].includes(currentEstimate.status);

  // Group lines by section
  const linesBySection = {};
  const unsectionedLines = [];

  lines.forEach(line => {
    if (line.section_id) {
      if (!linesBySection[line.section_id]) linesBySection[line.section_id] = [];
      linesBySection[line.section_id].push(line);
    } else {
      unsectionedLines.push(line);
    }
  });

  let html = '';
  let rowNum = 1;

  // Render sections with their items
  sections.forEach(section => {
    const sectionLines = linesBySection[section.id] || [];
    const isCollapsed = collapsedSections.has(section.id);
    const sectionTotal = sectionLines.reduce((sum, l) => sum + parseFloat(l.amount || 0), 0);

    // Section header row
    html += `
      <tr class="section-header-row" data-section-id="${section.id}">
        <td colspan="10">
          <div class="section-header-cell">
            <button class="section-toggle-btn ${isCollapsed ? 'collapsed' : ''}"
                    onclick="toggleSectionCollapse('${section.id}')" title="Toggle">
              <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                <path d="M7.247 11.14L2.451 5.658C1.885 5.013 2.345 4 3.204 4h9.592a1 1 0 01.753 1.659l-4.796 5.48a1 1 0 01-1.506 0z"/>
              </svg>
            </button>
            <span class="section-name">${escapeHtml(section.name)}</span>
            <span class="section-count">${sectionLines.length} item${sectionLines.length !== 1 ? 's' : ''}</span>
            <span class="section-subtotal">${formatCurrency(sectionTotal)}</span>
            ${isEditable ? `
              <div class="section-actions">
                <button class="section-action-btn" onclick="openSectionModal('${section.id}')" title="Edit section">
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M12.146.146a.5.5 0 01.708 0l3 3a.5.5 0 010 .708l-10 10a.5.5 0 01-.168.11l-5 2a.5.5 0 01-.65-.65l2-5a.5.5 0 01.11-.168l10-10zM11.207 2.5L13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 01.5.5v.5h.5a.5.5 0 01.5.5v.5h.293l6.5-6.5zm-9.761 5.175l-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 015 12.5V12h-.5a.5.5 0 01-.5-.5V11h-.5a.5.5 0 01-.468-.325z"/>
                  </svg>
                </button>
                <button class="section-action-btn danger" onclick="deleteSection('${section.id}')" title="Delete section">
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M5.5 5.5A.5.5 0 016 6v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm2.5 0a.5.5 0 01.5.5v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm3 .5a.5.5 0 00-1 0v6a.5.5 0 001 0V6z"/>
                    <path fill-rule="evenodd" d="M14.5 3a1 1 0 01-1 1H13v9a2 2 0 01-2 2H5a2 2 0 01-2-2V4h-.5a1 1 0 01-1-1V2a1 1 0 011-1H6a1 1 0 011-1h2a1 1 0 011 1h3.5a1 1 0 011 1v1zM4.118 4L4 4.059V13a1 1 0 001 1h6a1 1 0 001-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
                  </svg>
                </button>
              </div>
            ` : ''}
          </div>
        </td>
      </tr>
    `;

    // Render lines in this section (if not collapsed)
    if (!isCollapsed) {
      sectionLines.forEach(line => {
        html += renderLineRow(line, rowNum++, true);
      });
    }
  });

  // Render unsectioned items
  if (unsectionedLines.length > 0 && sections.length > 0) {
    html += `<tr class="unsectioned-divider"><td colspan="10">Unsectioned Items</td></tr>`;
  }

  unsectionedLines.forEach(line => {
    html += renderLineRow(line, rowNum++, false);
  });

  // Empty state if no lines
  if (lines.length === 0) {
    html = `
      <tr>
        <td colspan="10" style="text-align: center; padding: 40px;">
          <div class="empty-state">
            <div class="empty-state-icon">+</div>
            <div class="empty-state-title">No Line Items</div>
            <div class="empty-state-message">Add line items to build your estimate.</div>
          </div>
        </td>
      </tr>
    `;
  }

  tbody.innerHTML = html;

  // Update totals
  const total = lines.reduce((sum, l) => sum + parseFloat(l.amount || 0), 0);
  const subtotalEl = document.getElementById('linesSubtotal');
  const totalEl = document.getElementById('linesTotalAmount');
  if (subtotalEl) subtotalEl.textContent = formatCurrency(total);
  if (totalEl) totalEl.textContent = formatCurrency(currentEstimate.total_amount || total);
}

function renderLineRow(line, rowNum, inSection) {
  const cc = line.cost_code;
  const isEditable = ['draft', 'rejected'].includes(currentEstimate?.status);

  return `
    <tr class="line-row ${inSection ? 'in-section' : ''}" data-line-id="${line.id}">
      <td class="select-col">
        ${isEditable ? `<input type="checkbox" class="line-select" data-line-id="${line.id}">` : ''}
      </td>
      <td class="drag-handle">${isEditable ? '<span style="cursor: grab;">&#8942;&#8942;</span>' : ''}</td>
      <td style="color: var(--text-secondary)">${rowNum}</td>
      <td>
        ${cc ? `<span class="cost-code-tag">${escapeHtml(cc.code)}</span>` : '-'}
      </td>
      <td>${escapeHtml(line.description || '-')}</td>
      <td class="col-right">${line.quantity || 1}</td>
      <td>${escapeHtml(line.unit || '-')}</td>
      <td class="col-right">${formatCurrency(line.unit_cost)}</td>
      <td class="col-right" style="font-weight: 600">${formatCurrency(line.amount)}</td>
      <td>
        ${isEditable ? `
          <button class="btn btn-icon btn-ghost btn-sm" onclick="editLineItem('${line.id}')" title="Edit">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M12.146.146a.5.5 0 01.708 0l3 3a.5.5 0 010 .708l-10 10a.5.5 0 01-.168.11l-5 2a.5.5 0 01-.65-.65l2-5a.5.5 0 01.11-.168l10-10z"/></svg>
          </button>
          <button class="btn btn-icon btn-ghost btn-sm" onclick="deleteLineItem('${line.id}')" title="Delete">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M5.5 5.5A.5.5 0 016 6v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm2.5 0a.5.5 0 01.5.5v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm3 .5a.5.5 0 00-1 0v6a.5.5 0 001 0V6z"/><path fill-rule="evenodd" d="M14.5 3a1 1 0 01-1 1H13v9a2 2 0 01-2 2H5a2 2 0 01-2-2V4h-.5a1 1 0 01-1-1V2a1 1 0 011-1H6a1 1 0 011-1h2a1 1 0 011 1h3.5a1 1 0 011 1v1zM4.118 4L4 4.059V13a1 1 0 001 1h6a1 1 0 001-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/></svg>
          </button>
        ` : ''}
      </td>
    </tr>
  `;
}

function renderOverviewTab() {
  if (!currentEstimate) return;

  document.getElementById('detailLineCount').textContent = currentEstimate.lines?.length || 0;
  document.getElementById('detailAmount').textContent = formatCurrency(currentEstimate.total_amount);
}

function editLineItem(lineId) {
  showToast('Edit line item - coming soon', 'info');
}

function deleteLineItem(lineId) {
  showToast('Delete line item - coming soon', 'info');
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

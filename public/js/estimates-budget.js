/**
 * Estimates & Budgets - Unified Module
 * Combines estimate management with budget building
 */

// ============================================================
// STATE
// ============================================================

// Current mode: 'estimates' or 'budget'
let currentMode = localStorage.getItem('estimatesBudgetMode') || 'estimates';

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
            <div class="empty-state-icon">📋</div>
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
        <button class="btn btn-ghost btn-sm" onclick="openEstimateDetail('${est.id}')" title="Open">📂</button>
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
        <div class="empty-state-icon">📋</div>
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
function convertToBudget() { showToast('Convert to budget - coming soon', 'info'); }
function convertToAllowances() { showToast('Convert to allowances - coming soon', 'info'); }
function createNewVersion() { showToast('New version - coming soon', 'info'); }
function toggleCostLibrarySidebar() { showToast('Cost library - coming soon', 'info'); }
function regroupLines() { showToast('Regroup lines - coming soon', 'info'); }

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
        ${isLocked ? '🔒' : '🔓'}
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

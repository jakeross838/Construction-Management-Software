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

// Removed: View initialization - table view only

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

  // Dropdown toggle handler
  document.addEventListener('click', (e) => {
    const toggle = e.target.closest('.dropdown-toggle');
    if (toggle) {
      e.preventDefault();
      e.stopPropagation();
      const dropdown = toggle.closest('.dropdown');
      // Close all other dropdowns
      document.querySelectorAll('.dropdown.open').forEach(d => {
        if (d !== dropdown) d.classList.remove('open');
      });
      dropdown.classList.toggle('open');
    } else if (!e.target.closest('.dropdown-menu')) {
      // Close all dropdowns when clicking outside
      document.querySelectorAll('.dropdown.open').forEach(d => d.classList.remove('open'));
    }
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
  // Card view removed - always use table view
  renderEstimateTable();
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

// Removed: Card view rendering - simplified to table view only
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

// Removed: View switcher - table view only

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

// Removed placeholder functions - these features are not implemented

// ============================================================
// PROPOSAL GENERATION
// ============================================================

function openGenerateProposalModal() {
  if (!currentEstimate) {
    showToast('No estimate selected', 'error');
    return;
  }

  // Pre-fill proposal title
  document.getElementById('proposalTitle').value = `Proposal for ${currentEstimate.title || 'Project'}`;

  // Reset form to defaults
  document.getElementById('detailLevel').value = 'summary';
  document.getElementById('showAllowances').checked = true;
  document.getElementById('termsText').value = '';

  // Show modal
  const modal = document.getElementById('generateProposalModal');
  modal.style.display = 'flex';
  setTimeout(() => modal.classList.add('show'), 10);
}

function closeGenerateProposalModal() {
  const modal = document.getElementById('generateProposalModal');
  modal.classList.remove('show');
  setTimeout(() => modal.style.display = 'none', 200);
}

async function generateProposal() {
  if (!currentEstimate) {
    showToast('No estimate selected', 'error');
    return;
  }

  const btn = document.getElementById('generateBtnText');
  const originalText = btn.textContent;
  btn.textContent = 'Generating PDF...';
  document.querySelector('#generateProposalModal .btn-primary').disabled = true;

  try {
    // Step 1: Create proposal record
    const proposalData = {
      estimate_id: currentEstimate.id,
      title: document.getElementById('proposalTitle').value.trim() || `Proposal for ${currentEstimate.title}`,
      detail_level: document.getElementById('detailLevel').value,
      show_allowances: document.getElementById('showAllowances').checked,
      terms_text: document.getElementById('termsText').value.trim() || null,
      created_by: window.currentUser?.name || 'User'
    };

    const createRes = await fetch('/api/proposals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(proposalData)
    });

    if (!createRes.ok) {
      const err = await createRes.json();
      throw new Error(err.error || 'Failed to create proposal');
    }

    const proposal = await createRes.json();
    btn.textContent = 'Generating PDF...';

    // Step 2: Generate PDF
    const generateRes = await fetch(`/api/proposals/${proposal.id}/generate`, {
      method: 'POST'
    });

    if (!generateRes.ok) {
      const err = await generateRes.json();
      throw new Error(err.error || 'Failed to generate PDF');
    }

    const generateData = await generateRes.json();
    btn.textContent = 'Creating share link...';

    // Step 3: Create shareable link
    const shareRes = await fetch(`/api/proposals/${proposal.id}/share`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expires_in_days: 30 })
    });

    if (!shareRes.ok) {
      const err = await shareRes.json();
      throw new Error(err.error || 'Failed to create share link');
    }

    const shareData = await shareRes.json();

    // Success! Show share link modal
    closeGenerateProposalModal();
    showProposalShareModal(shareData.share_url, generateData.pdf_url);

    showToast('Proposal generated successfully!', 'success');

  } catch (err) {
    console.error('Error generating proposal:', err);
    showToast(err.message || 'Failed to generate proposal', 'error');
  } finally {
    btn.textContent = originalText;
    document.querySelector('#generateProposalModal .btn-primary').disabled = false;
  }
}

function showProposalShareModal(shareUrl, pdfUrl) {
  document.getElementById('shareLink').value = shareUrl;
  document.getElementById('pdfLink').value = pdfUrl;

  const modal = document.getElementById('proposalShareModal');
  modal.style.display = 'flex';
  setTimeout(() => modal.classList.add('show'), 10);
}

function closeProposalShareModal() {
  const modal = document.getElementById('proposalShareModal');
  modal.classList.remove('show');
  setTimeout(() => modal.style.display = 'none', 200);
}

async function copyShareLink() {
  const shareLink = document.getElementById('shareLink').value;

  try {
    await navigator.clipboard.writeText(shareLink);
    showToast('Link copied to clipboard!', 'success');
  } catch (err) {
    // Fallback for older browsers
    const input = document.getElementById('shareLink');
    input.select();
    document.execCommand('copy');
    showToast('Link copied to clipboard!', 'success');
  }
}
// Removed: Line item, Templates, Scope, Assembly, Markup modal functions - not implemented
function openAddLineModal() { showToast('Add line item - coming in Phase 110-02', 'info'); }
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
// Removed: Allowances, Versions, Cost Library, Regroup - not implemented

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

  // Initialize inline editing after render
  initInlineEditing();

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
    <tr class="line-row ${inSection ? 'in-section' : ''}" data-id="${line.id}">
      <td class="select-col">
        ${isEditable ? `<input type="checkbox" class="line-select" data-id="${line.id}">` : ''}
      </td>
      <td class="drag-handle" title="Drag to reorder">
        ${isEditable ? '<svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" opacity="0.5"><path d="M2 4a1 1 0 110-2h12a1 1 0 110 2H2zm0 5a1 1 0 110-2h12a1 1 0 110 2H2zm0 5a1 1 0 110-2h12a1 1 0 110 2H2z"/></svg>' : ''}
      </td>
      <td class="row-number">${rowNum}</td>
      <td class="cost-code-cell">
        ${cc ? `<span class="cost-code-badge">${escapeHtml(cc.code)}</span>` : '-'}
      </td>
      <td ${isEditable ? 'data-editable data-field="description" data-type="text"' : ''} class="${isEditable ? 'editable-cell' : ''}">
        ${escapeHtml(line.description || '')}
      </td>
      <td ${isEditable ? 'data-editable data-field="quantity" data-type="number"' : ''} class="${isEditable ? 'editable-cell col-right' : 'col-right'}">
        ${line.quantity || 1}
      </td>
      <td class="unit-cell">${escapeHtml(line.unit || 'LS')}</td>
      <td ${isEditable ? 'data-editable data-field="unit_cost" data-type="currency"' : ''} class="${isEditable ? 'editable-cell col-right' : 'col-right'}">
        ${formatCurrency(line.unit_cost || 0)}
      </td>
      <td data-field="amount" class="col-right amount-cell">
        ${formatCurrency(line.amount || 0)}
      </td>
      <td class="row-actions">
        ${isEditable ? `
          <button class="btn btn-icon btn-ghost btn-sm" onclick="deleteLineItem('${line.id}')" title="Delete">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M5.5 5.5A.5.5 0 016 6v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm2.5 0a.5.5 0 01.5.5v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm3 .5a.5.5 0 00-1 0v6a.5.5 0 001 0V6z"/>
              <path fill-rule="evenodd" d="M14.5 3a1 1 0 01-1 1H13v9a2 2 0 01-2 2H5a2 2 0 01-2-2V4h-.5a1 1 0 01-1-1V2a1 1 0 011-1H6a1 1 0 011-1h2a1 1 0 011 1h3.5a1 1 0 011 1v1zM4.118 4L4 4.059V13a1 1 0 001 1h6a1 1 0 001-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
            </svg>
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
  showToast('Edit line item - coming in Phase 110-02', 'info');
}

async function deleteLineItem(lineId) {
  if (!confirm('Delete this line item?')) return;

  try {
    const response = await fetch(`/api/estimate-lines/${lineId}`, {
      method: 'DELETE'
    });

    if (!response.ok) throw new Error('Failed to delete');

    // Remove row from table
    const row = document.querySelector(`tr[data-id="${lineId}"]`);
    if (row) {
      row.style.opacity = '0';
      setTimeout(() => {
        row.remove();
        recalculateTotals();
        // Renumber rows
        document.querySelectorAll('.line-item-row .row-number').forEach((cell, i) => {
          cell.textContent = i + 1;
        });
      }, 200);
    }

    showToast('Line item deleted', 'success');
  } catch (err) {
    console.error('Delete failed:', err);
    showToast('Failed to delete line item', 'error');
  }
}

// ============================================================
// INLINE EDITING
// ============================================================

class InlineEditableCell {
  constructor(element, options = {}) {
    this.el = element;
    this.field = element.dataset.field;
    this.rowId = element.closest('tr')?.dataset.id;
    this.type = options.type || 'text'; // text, number, currency
    this.onSave = options.onSave || (() => {});
    this.originalValue = null;
    this.init();
  }

  init() {
    this.el.classList.add('editable-cell');
    this.el.setAttribute('tabindex', '0');

    // Click to edit
    this.el.addEventListener('click', (e) => {
      if (!this.el.classList.contains('editing')) {
        this.startEdit();
      }
    });

    // Enter on focused cell starts edit
    this.el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !this.el.classList.contains('editing')) {
        e.preventDefault();
        this.startEdit();
      }
    });
  }

  startEdit() {
    if (this.el.contentEditable === 'true') return;

    // Store original for cancel
    this.originalValue = this.el.textContent.trim();

    // Enable editing
    this.el.contentEditable = true;
    this.el.classList.add('editing');
    this.el.focus();

    // Select all text
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(this.el);
    selection.removeAllRanges();
    selection.addRange(range);

    // Add keyboard handlers
    this.el.addEventListener('keydown', this.handleKeydown.bind(this));
    this.el.addEventListener('blur', this.handleBlur.bind(this), { once: true });
  }

  handleKeydown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      this.save();
      this.moveToNextRow();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      this.cancel();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      this.save();
      this.moveToNext(e.shiftKey);
    }
  }

  handleBlur() {
    // Small delay to allow click on other elements
    setTimeout(() => {
      if (this.el.classList.contains('editing')) {
        this.save();
      }
    }, 150);
  }

  save() {
    this.el.contentEditable = false;
    this.el.classList.remove('editing');

    let value = this.el.textContent.trim();

    // Parse based on type
    if (this.type === 'number') {
      value = parseFloat(value.replace(/[^0-9.-]/g, '')) || 0;
      this.el.textContent = value;
    } else if (this.type === 'currency') {
      value = parseFloat(value.replace(/[^0-9.-]/g, '')) || 0;
      this.el.textContent = formatCurrency(value);
    }

    // Only save if changed
    if (String(value) !== String(this.originalValue)) {
      this.onSave(this.rowId, this.field, value);
    }
  }

  cancel() {
    this.el.textContent = this.originalValue;
    this.el.contentEditable = false;
    this.el.classList.remove('editing');
  }

  moveToNext(reverse = false) {
    const cells = [...document.querySelectorAll('.editable-cell')];
    const currentIndex = cells.indexOf(this.el);
    const nextIndex = reverse ? currentIndex - 1 : currentIndex + 1;

    if (cells[nextIndex]) {
      cells[nextIndex].focus();
      // Trigger edit on next cell
      setTimeout(() => {
        const nextCell = cells[nextIndex];
        if (nextCell._inlineEdit) {
          nextCell._inlineEdit.startEdit();
        }
      }, 50);
    }
  }

  moveToNextRow() {
    const currentRow = this.el.closest('tr');
    const nextRow = currentRow?.nextElementSibling;
    if (nextRow) {
      const sameFieldCell = nextRow.querySelector(`[data-field="${this.field}"]`);
      if (sameFieldCell) {
        sameFieldCell.focus();
        setTimeout(() => {
          if (sameFieldCell._inlineEdit) {
            sameFieldCell._inlineEdit.startEdit();
          }
        }, 50);
      }
    }
  }
}

// Initialize inline editing on line items
function initInlineEditing() {
  const table = document.getElementById('estimateLinesTable');
  if (!table) return;

  const editableCells = table.querySelectorAll('[data-editable]');
  editableCells.forEach(cell => {
    const type = cell.dataset.type || 'text';
    const editor = new InlineEditableCell(cell, {
      type,
      onSave: handleCellSave
    });
    cell._inlineEdit = editor;
  });
}

// Handle cell save - debounced API call
let saveDebounce = {};
function handleCellSave(rowId, field, value) {
  // Clear existing debounce for this row
  if (saveDebounce[rowId]) {
    clearTimeout(saveDebounce[rowId]);
  }

  // Collect all pending changes for this row
  if (!window.pendingRowChanges) window.pendingRowChanges = {};
  if (!window.pendingRowChanges[rowId]) window.pendingRowChanges[rowId] = {};
  window.pendingRowChanges[rowId][field] = value;

  // Debounce save
  saveDebounce[rowId] = setTimeout(async () => {
    const changes = window.pendingRowChanges[rowId];
    delete window.pendingRowChanges[rowId];

    try {
      const response = await fetch(`/api/estimate-lines/${rowId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changes)
      });

      if (!response.ok) {
        throw new Error('Failed to save');
      }

      // Recalculate row amount if quantity or unit_cost changed
      if (changes.quantity !== undefined || changes.unit_cost !== undefined) {
        recalculateRowAmount(rowId);
      }

      // Update totals
      recalculateTotals();

      // Show subtle success indicator
      showInlineSaveIndicator(rowId, true);
    } catch (err) {
      console.error('Save failed:', err);
      showInlineSaveIndicator(rowId, false);
      showToast('Failed to save changes', 'error');
    }
  }, 500);
}

function recalculateRowAmount(rowId) {
  const row = document.querySelector(`tr[data-id="${rowId}"]`);
  if (!row) return;

  const qty = parseFloat(row.querySelector('[data-field="quantity"]')?.textContent) || 0;
  const unitCost = parseFloat(row.querySelector('[data-field="unit_cost"]')?.textContent?.replace(/[^0-9.-]/g, '')) || 0;
  const amount = qty * unitCost;

  const amountCell = row.querySelector('[data-field="amount"]');
  if (amountCell) {
    amountCell.textContent = formatCurrency(amount);
  }
}

function recalculateTotals() {
  const rows = document.querySelectorAll('#estimateLinesTable tbody tr[data-id]');
  let subtotal = 0;

  rows.forEach(row => {
    const amountText = row.querySelector('[data-field="amount"]')?.textContent || '0';
    const amount = parseFloat(amountText.replace(/[^0-9.-]/g, '')) || 0;
    subtotal += amount;
  });

  const subtotalEl = document.getElementById('linesSubtotal');
  const totalEl = document.getElementById('linesTotalAmount');

  if (subtotalEl) subtotalEl.textContent = formatCurrency(subtotal);
  if (totalEl) totalEl.textContent = formatCurrency(subtotal);
}

function showInlineSaveIndicator(rowId, success) {
  const row = document.querySelector(`tr[data-id="${rowId}"]`);
  if (!row) return;

  row.classList.add(success ? 'row-saved' : 'row-error');
  setTimeout(() => {
    row.classList.remove('row-saved', 'row-error');
  }, 1500);
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

// ============================================================
// ASSEMBLY PICKER
// ============================================================

let assemblyTemplates = [];
let selectedAssemblyTemplate = null;
let assemblyPickerView = 'grid';

async function openAssemblyPickerModal() {
  if (!currentEstimate) {
    showToast('Open an estimate first', 'error');
    return;
  }

  // Reset state
  selectedAssemblyTemplate = null;
  document.getElementById('addAssemblyBtn').disabled = true;
  document.getElementById('assemblyPreviewPanel').style.display = 'none';
  document.getElementById('assemblySearchInput').value = '';
  document.getElementById('assemblyMultiplier').value = '1';

  // Populate section dropdown
  populateAssemblySectionDropdown();

  // Load templates
  await loadAssemblyTemplates();

  // Show modal
  const modal = document.getElementById('assemblyPickerModal');
  modal.style.display = 'flex';
  modal.classList.add('show');
}

function closeAssemblyPickerModal() {
  const modal = document.getElementById('assemblyPickerModal');
  modal.classList.remove('show');
  modal.style.display = 'none';
  selectedAssemblyTemplate = null;
}

async function loadAssemblyTemplates() {
  try {
    const jobId = currentEstimate?.job_id;
    const params = jobId ? `?job_id=${jobId}` : '';
    const response = await fetch(`/api/assembly-templates${params}`);

    if (!response.ok) throw new Error('Failed to load assembly templates');

    assemblyTemplates = await response.json();
    renderAssemblyTemplateGrid();
    renderAssemblyCategories();
  } catch (err) {
    console.error('Error loading assembly templates:', err);
    showToast('Failed to load assembly templates', 'error');
    assemblyTemplates = [];
    renderAssemblyTemplateGrid();
  }
}

function renderAssemblyCategories() {
  const container = document.getElementById('assemblyCategoryList');
  if (!container) return;

  // Get unique categories
  const categories = {};
  assemblyTemplates.forEach(t => {
    const cat = t.category || 'Other';
    categories[cat] = (categories[cat] || 0) + 1;
  });

  // Build HTML
  let html = `
    <button class="assembly-category-btn active" data-category="all" onclick="filterByCategory('all')">
      All Assemblies
      <span class="category-count">${assemblyTemplates.length}</span>
    </button>
  `;

  Object.entries(categories).sort((a, b) => a[0].localeCompare(b[0])).forEach(([cat, count]) => {
    html += `
      <button class="assembly-category-btn" data-category="${escapeHtml(cat)}" onclick="filterByCategory('${escapeHtml(cat)}')">
        ${escapeHtml(cat)}
        <span class="category-count">${count}</span>
      </button>
    `;
  });

  container.innerHTML = html;
}

function filterByCategory(category) {
  // Update active state
  document.querySelectorAll('.assembly-category-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.category === category);
  });

  filterAssemblyTemplates();
}

function filterAssemblyTemplates() {
  const search = (document.getElementById('assemblySearchInput')?.value || '').toLowerCase();
  const activeCategory = document.querySelector('.assembly-category-btn.active')?.dataset.category || 'all';
  const showGlobal = document.getElementById('sourceGlobal')?.checked !== false;
  const showJob = document.getElementById('sourceJob')?.checked !== false;

  let filtered = assemblyTemplates.filter(t => {
    // Category filter
    if (activeCategory !== 'all' && t.category !== activeCategory) return false;

    // Search filter
    if (search) {
      const searchFields = [t.name, t.description, t.category].filter(Boolean).join(' ').toLowerCase();
      if (!searchFields.includes(search)) return false;
    }

    // Source filter
    if (!showGlobal && !t.job_id) return false;
    if (!showJob && t.job_id) return false;

    return true;
  });

  // Update count
  document.getElementById('assemblyResultCount').textContent = `${filtered.length} assembl${filtered.length === 1 ? 'y' : 'ies'}`;

  renderAssemblyTemplateGrid(filtered);
}

function renderAssemblyTemplateGrid(templates = assemblyTemplates) {
  const container = document.getElementById('assemblyTemplateGrid');
  const emptyState = document.getElementById('assemblyEmptyState');

  if (!container) return;

  if (templates.length === 0) {
    container.innerHTML = '';
    if (emptyState) emptyState.style.display = 'block';
    return;
  }

  if (emptyState) emptyState.style.display = 'none';

  if (assemblyPickerView === 'grid') {
    container.innerHTML = templates.map(t => `
      <div class="assembly-card ${selectedAssemblyTemplate?.id === t.id ? 'selected' : ''}"
           data-id="${t.id}"
           onclick="selectAssemblyTemplate('${t.id}')">
        <div class="assembly-card-header">
          <span class="assembly-card-icon">${t.icon || '&#128230;'}</span>
          <span class="assembly-card-category">${escapeHtml(t.category || 'Other')}</span>
        </div>
        <h4 class="assembly-card-name">${escapeHtml(t.name)}</h4>
        <p class="assembly-card-description">${escapeHtml(t.description || '')}</p>
        <div class="assembly-card-footer">
          <span class="assembly-card-count">${t.component_count || 0} items</span>
          <span class="assembly-card-total">${formatCurrency(t.total_cost)}</span>
        </div>
      </div>
    `).join('');
  } else {
    // List view
    container.innerHTML = `
      <table class="assembly-list-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Category</th>
            <th>Items</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          ${templates.map(t => `
            <tr class="${selectedAssemblyTemplate?.id === t.id ? 'selected' : ''}"
                onclick="selectAssemblyTemplate('${t.id}')">
              <td><strong>${escapeHtml(t.name)}</strong></td>
              <td>${escapeHtml(t.category || 'Other')}</td>
              <td>${t.component_count || 0}</td>
              <td>${formatCurrency(t.total_cost)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }
}

function setAssemblyView(view) {
  assemblyPickerView = view;

  document.querySelectorAll('#assemblyPickerModal .view-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });

  filterAssemblyTemplates();
}

async function selectAssemblyTemplate(templateId) {
  selectedAssemblyTemplate = assemblyTemplates.find(t => t.id === templateId);

  if (!selectedAssemblyTemplate) return;

  // Update card selection state
  document.querySelectorAll('.assembly-card, .assembly-list-table tr').forEach(el => {
    el.classList.toggle('selected', el.dataset.id === templateId);
  });

  // Load full template with components
  try {
    const response = await fetch(`/api/assembly-templates/${templateId}`);
    if (response.ok) {
      const fullTemplate = await response.json();
      selectedAssemblyTemplate = fullTemplate;
      renderAssemblyPreview(fullTemplate);
    }
  } catch (err) {
    console.error('Error loading template details:', err);
  }

  // Enable add button
  document.getElementById('addAssemblyBtn').disabled = false;
}

function renderAssemblyPreview(template) {
  const panel = document.getElementById('assemblyPreviewPanel');
  if (!panel) return;

  panel.style.display = 'block';

  document.getElementById('previewAssemblyName').textContent = template.name;
  document.getElementById('previewAssemblyCategory').textContent = template.category || 'Other';
  document.getElementById('previewAssemblyTotal').textContent = formatCurrency(template.total_cost);
  document.getElementById('previewAssemblyDescription').textContent = template.description || 'No description';

  const components = template.components || [];
  document.getElementById('previewComponentCount').textContent = components.length;

  const list = document.getElementById('previewComponentList');
  if (components.length === 0) {
    list.innerHTML = '<p class="text-muted">No components defined</p>';
  } else {
    list.innerHTML = components.map(c => `
      <div class="preview-component-row">
        <div class="component-info">
          <span class="component-code">${escapeHtml(c.cost_code?.code || '-')}</span>
          <span class="component-desc">${escapeHtml(c.description || c.cost_code?.name || 'Item')}</span>
        </div>
        <div class="component-amount">${formatCurrency(c.amount || (c.quantity * c.unit_cost))}</div>
      </div>
    `).join('');
  }
}

function closeAssemblyPreview() {
  document.getElementById('assemblyPreviewPanel').style.display = 'none';
  selectedAssemblyTemplate = null;
  document.getElementById('addAssemblyBtn').disabled = true;

  document.querySelectorAll('.assembly-card, .assembly-list-table tr').forEach(el => {
    el.classList.remove('selected');
  });
}

function populateAssemblySectionDropdown() {
  const select = document.getElementById('assemblySectionTarget');
  if (!select || !currentEstimate) return;

  select.innerHTML = '<option value="">No Section (End of List)</option>';

  const sections = currentEstimate.sections || [];
  sections.forEach(section => {
    const option = document.createElement('option');
    option.value = section.id;
    option.textContent = section.name;
    select.appendChild(option);
  });
}

async function addSelectedAssembly() {
  if (!selectedAssemblyTemplate || !currentEstimate) {
    showToast('Please select an assembly template', 'error');
    return;
  }

  const multiplier = parseFloat(document.getElementById('assemblyMultiplier')?.value) || 1;
  const sectionId = document.getElementById('assemblySectionTarget')?.value || null;

  try {
    const response = await fetch(`/api/estimates/${currentEstimate.id}/expand-assembly`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        template_id: selectedAssemblyTemplate.id,
        section_id: sectionId,
        quantity_multiplier: multiplier
      })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to add assembly');
    }

    const result = await response.json();
    showToast(`Added ${result.lines?.length || 0} items from assembly`, 'success');
    closeAssemblyPickerModal();

    // Reload estimate to show new lines
    await reloadCurrentEstimate();
  } catch (err) {
    console.error('Error adding assembly:', err);
    showToast(err.message, 'error');
  }
}

// ============================================================
// COPY ESTIMATE
// ============================================================

let copySourceEstimate = null;

function openCopyEstimateModal() {
  if (!currentEstimate) {
    showToast('Open an estimate first', 'error');
    return;
  }

  copySourceEstimate = currentEstimate;

  // Populate source info
  document.getElementById('copySourceTitle').textContent = currentEstimate.title;
  document.getElementById('copySourceLineCount').textContent = currentEstimate.lines?.length || 0;
  document.getElementById('copySourceTotal').textContent = formatCurrency(currentEstimate.total_amount);

  // Populate job dropdown
  const jobSelect = document.getElementById('copyTargetJob');
  jobSelect.innerHTML = '<option value="">Same Job (create new version)</option>';
  jobs.forEach(job => {
    if (job.id !== currentEstimate.job_id) {
      const option = document.createElement('option');
      option.value = job.id;
      option.textContent = job.name;
      jobSelect.appendChild(option);
    }
  });

  // Clear title
  document.getElementById('copyNewTitle').value = '';
  document.getElementById('copyTitleHint').textContent = `Leave empty for: "${currentEstimate.title} v2"`;

  // Update preview
  updateCopyPreview();

  // Show modal
  const modal = document.getElementById('copyEstimateModal');
  modal.style.display = 'flex';
  modal.classList.add('show');
}

function closeCopyEstimateModal() {
  const modal = document.getElementById('copyEstimateModal');
  modal.classList.remove('show');
  modal.style.display = 'none';
  copySourceEstimate = null;
}

function onCopyTargetJobChange() {
  const targetJobId = document.getElementById('copyTargetJob').value;
  const hintEl = document.getElementById('copyTargetHint');
  const titleHintEl = document.getElementById('copyTitleHint');

  if (targetJobId) {
    hintEl.textContent = 'Creates a copy of this estimate for another job';
    titleHintEl.textContent = `Leave empty for: "${copySourceEstimate?.title || 'Estimate'} (copy)"`;
  } else {
    hintEl.textContent = 'Creates a new version of this estimate';
    titleHintEl.textContent = `Leave empty for: "${copySourceEstimate?.title || 'Estimate'} v2"`;
  }
}

function updateCopyPreview() {
  if (!copySourceEstimate) return;

  const lines = copySourceEstimate.lines || [];
  const sections = copySourceEstimate.sections || [];
  const assemblies = lines.filter(l => l.is_assembly).length;

  document.getElementById('copyPreviewSections').textContent = sections.length;
  document.getElementById('copyPreviewLines').textContent = lines.length;
  document.getElementById('copyPreviewAssemblies').textContent = assemblies;
  document.getElementById('copyPreviewTotal').textContent = formatCurrency(copySourceEstimate.total_amount);
}

async function executeCopyEstimate() {
  if (!copySourceEstimate) {
    showToast('No estimate selected', 'error');
    return;
  }

  const targetJobId = document.getElementById('copyTargetJob').value || null;
  const newTitle = document.getElementById('copyNewTitle').value.trim() || null;

  try {
    const response = await fetch(`/api/estimates/${copySourceEstimate.id}/duplicate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        target_job_id: targetJobId,
        new_title: newTitle,
        created_by: window.currentUser || 'User'
      })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to duplicate estimate');
    }

    const result = await response.json();
    showToast(`Estimate copied (${result.lines_copied || 0} lines, ${result.sections_copied || 0} sections)`, 'success');
    closeCopyEstimateModal();
    closeDetailModal();

    // Refresh list and open the new estimate
    await loadEstimates();
    await loadStats();

    if (result.estimate?.id) {
      await openEstimateDetail(result.estimate.id);
    }
  } catch (err) {
    console.error('Error copying estimate:', err);
    showToast(err.message, 'error');
  }
}

// Update the placeholder function to use the new modal
function openDuplicateModal() {
  openCopyEstimateModal();
}


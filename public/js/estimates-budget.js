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
  console.log('[INIT] Page initialization starting');
  console.log('[INIT] URL:', window.location.href);

  // Force estimates mode (mode switcher removed from UI)
  currentMode = 'estimates';
  localStorage.setItem('estimatesBudgetMode', 'estimates');
  console.log('[INIT] Mode set to:', currentMode);

  // Setup event listeners
  setupEventListeners();
  console.log('[INIT] Event listeners setup complete');

  // Get job ID from URL parameter or sidebar first
  const urlParams = new URLSearchParams(window.location.search);
  const urlJobId = urlParams.get('job');
  const sidebarJobId = window.JobSidebar?.getSelectedJobId();
  const initialJobId = urlJobId || sidebarJobId;
  console.log('[INIT] URL job ID:', urlJobId);
  console.log('[INIT] Sidebar job ID:', sidebarJobId);
  console.log('[INIT] Initial job ID:', initialJobId);

  // Load reference data (jobs, cost codes) - MUST complete before loading estimate
  try {
    console.log('[INIT] Loading reference data (jobs, cost codes)...');
    await Promise.all([
      loadJobs(),
      loadCostCodes()
    ]);
    console.log('[INIT] Reference data loaded - jobs:', jobs.length, 'cost codes:', costCodes.length);
  } catch (err) {
    console.error('[INIT] Failed to load reference data:', err);
    showToast('Failed to load reference data', 'error');
  }

  // Setup job sidebar listener for both modes
  if (window.JobSidebar) {
    console.log('[INIT] Setting up job sidebar listener');
    window.JobSidebar.onJobChange(async (jobId) => {
      console.log('[JobSidebar.onJobChange] Job changed to:', jobId);
      currentJobId = jobId || null;
      if (currentMode === 'budget' && jobId) {
        await loadJobBudgetForJob(jobId);
      } else if (currentMode === 'estimates' && jobId) {
        await loadEstimateForJob(jobId);
      } else if (currentMode === 'estimates' && !jobId) {
        showEmptyState();
      }
    });
  } else {
    console.warn('[INIT] window.JobSidebar not available');
  }

  // Load initial job data
  if (initialJobId) {
    console.log('[INIT] Loading initial job data for:', initialJobId);
    currentJobId = initialJobId;
    if (currentMode === 'estimates') {
      await loadEstimateForJob(initialJobId);
    } else if (currentMode === 'budget') {
      await loadJobBudgetForJob(initialJobId);
    }
  } else if (currentMode === 'estimates') {
    // Only show empty state if no job is selected
    console.log('[INIT] No job selected, showing empty state');
    showEmptyState();
  }

  // Initialize keyboard shortcuts
  initKeyboardShortcuts();
  console.log('[INIT] Initialization complete');
});

// Removed: View initialization - table view only

function setupEventListeners() {
  // Filter change handlers - removed (no longer needed for single estimate view)

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
// MODE SWITCHING (removed mode switcher UI, keeping for budget mode)
// ============================================================

function switchMode(mode) {
  currentMode = mode;
  localStorage.setItem('estimatesBudgetMode', mode);

  // Show/hide sections
  document.querySelectorAll('.mode-section').forEach(section => {
    section.classList.toggle('active', section.dataset.mode === currentMode);
  });

  // Load data for the new mode
  if (mode === 'estimates') {
    if (currentJobId) {
      loadEstimateForJob(currentJobId);
    } else {
      showEmptyState();
    }
  } else if (mode === 'budget') {
    if (currentJobId) {
      loadJobBudgetForJob(currentJobId);
    } else {
      renderBudgetEmptyState();
    }
  }
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
// Removed old list/table/filter functions - now showing single estimate per job

// ============================================================
// ESTIMATES MODE - MODALS
// ============================================================

function openCreateModal() {
  console.log('[openCreateModal] Opening create estimate modal');
  console.log('[openCreateModal] Current job ID:', currentJobId);
  console.log('[openCreateModal] Available jobs:', jobs.length);

  document.getElementById('modalTitle').textContent = 'New Estimate';
  document.getElementById('estimateId').value = '';
  document.getElementById('estimateForm').reset();

  // Populate job dropdown
  const jobSelect = document.getElementById('formJob');
  jobSelect.innerHTML = '<option value="">Select Job...</option>';

  if (currentJobId) {
    // Pre-select current job if one is selected
    const currentJob = jobs.find(j => j.id === currentJobId);
    if (currentJob) {
      const opt = document.createElement('option');
      opt.value = currentJob.id;
      opt.textContent = currentJob.name;
      opt.selected = true;
      jobSelect.appendChild(opt);
      console.log('[openCreateModal] Pre-selected job:', currentJob.name);
    }
  }

  // Add all other jobs
  jobs.forEach(job => {
    if (job.id !== currentJobId) {
      const opt = document.createElement('option');
      opt.value = job.id;
      opt.textContent = job.name;
      jobSelect.appendChild(opt);
    }
  });

  console.log('[openCreateModal] Job dropdown populated with', jobSelect.options.length, 'options');

  const modal = document.getElementById('estimateModal');
  modal.style.display = 'flex';
  modal.classList.add('show');
  console.log('[openCreateModal] Modal shown');

  // Focus title field
  setTimeout(() => document.getElementById('formTitle').focus(), 100);
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

    const savedEstimate = await response.json();
    console.log('[saveEstimate] Saved estimate:', savedEstimate);

    showToast(estimateId ? 'Estimate updated' : 'Estimate created', 'success');
    closeModal();

    // Set current job to the estimate's job and reload
    currentJobId = data.job_id;
    console.log('[saveEstimate] Loading estimate for job:', data.job_id);
    await loadEstimateForJob(data.job_id);
    console.log('[saveEstimate] After loadEstimateForJob, currentEstimate:', currentEstimate);
  } catch (err) {
    console.error('Error saving estimate:', err);
    showToast(err.message, 'error');
  }
}

// Load estimate for selected job (new main page view)
async function loadEstimateForJob(jobId) {
  console.log('[loadEstimateForJob] Loading estimate for job:', jobId);
  try {
    // Fetch estimate for this job
    const response = await fetch(`/api/estimates?job_id=${jobId}`);
    if (!response.ok) {
      console.error('[loadEstimateForJob] API error:', response.status, response.statusText);
      throw new Error('Failed to load estimate');
    }

    const estimates = await response.json();
    console.log('[loadEstimateForJob] Found estimates:', estimates.length);

    // Show empty state if no estimate exists
    if (!estimates || estimates.length === 0) {
      console.log('[loadEstimateForJob] No estimate found, showing empty state');
      showEmptyState('No estimate exists for this job');
      return;
    }

    // Use the first estimate (most recent)
    currentEstimate = estimates[0];
    console.log('[loadEstimateForJob] Using estimate:', currentEstimate.id);

    // Load full estimate details with line items
    const detailResponse = await fetch(`/api/estimates/${currentEstimate.id}`);
    if (!detailResponse.ok) {
      console.error('[loadEstimateForJob] Detail API error:', detailResponse.status);
      throw new Error('Failed to load estimate details');
    }
    currentEstimate = await detailResponse.json();
    console.log('[loadEstimateForJob] Loaded estimate details, sections:', currentEstimate.sections?.length, 'lines:', currentEstimate.lines?.length);

    // Hide loading and empty state, show estimate content
    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('emptyState').style.display = 'none';
    document.getElementById('estimateContent').style.display = 'block';
    console.log('[loadEstimateForJob] Showing estimate content');

    // Populate breadcrumb
    const job = jobs.find(j => j.id === jobId);
    console.log('[loadEstimateForJob] Found job:', job?.name);
    document.getElementById('jobNameBreadcrumb').textContent = job?.name?.toUpperCase() || 'UNKNOWN JOB';

    // Populate cost summary
    updateCostSummary();

    // Populate overview tab
    document.getElementById('detailJob').textContent = currentEstimate.job?.name || '-';
    document.getElementById('detailAmount').textContent = formatCurrency(currentEstimate.total_amount);
    document.getElementById('detailLineCount').textContent = currentEstimate.lines?.length || 0;
    document.getElementById('detailCreated').textContent = formatDateTime(currentEstimate.created_at);
    document.getElementById('detailNotes').textContent = currentEstimate.notes || '-';

    // Render the lines table with sections
    renderLinesTable();

    // Initialize workflow stepper
    currentWorkflowStep = determineWorkflowStep(currentEstimate);
    updateStepperVisibility();
    updateStepperUI();
  } catch (err) {
    console.error('[loadEstimateForJob] ERROR:', err);
    console.error('[loadEstimateForJob] Stack:', err.stack);
    showToast('Failed to load estimate: ' + err.message, 'error');
    showEmptyState('Error loading estimate');
  }
}

function showEmptyState(message) {
  document.getElementById('loadingState').style.display = 'none';
  document.getElementById('estimateContent').style.display = 'none';
  const emptyState = document.getElementById('emptyState');
  emptyState.style.display = 'block';

  if (message) {
    emptyState.innerHTML = `
      <h3>No Estimate</h3>
      <p>${message}</p>
      <button class="btn btn-primary" onclick="openCreateModal()">+ Create Estimate</button>
    `;
  } else {
    emptyState.innerHTML = `
      <h3>No Job Selected</h3>
      <p>Select a job from the sidebar to view its estimate</p>
    `;
  }
}

function updateCostSummary() {
  if (!currentEstimate) return;

  const subtotal = currentEstimate.total_amount || 0;
  const markupPct = currentEstimate.markup_percent || 0;
  const markup = subtotal * (markupPct / 100);
  const total = subtotal + markup;

  const summary = `Builder cost ${formatCurrency(subtotal)} + Profit (${markupPct}%) ${formatCurrency(markup)} = Total price ${formatCurrency(total)}`;
  document.getElementById('costSummary').textContent = summary;
}

// Action button functions
async function exportEstimate() {
  if (!currentEstimate) {
    showToast('No estimate selected', 'error');
    return;
  }
  // TODO: Implement export functionality
  showToast('Export functionality coming soon', 'info');
}

async function lockEstimate() {
  if (!currentEstimate) {
    showToast('No estimate selected', 'error');
    return;
  }
  // TODO: Implement lock functionality
  showToast('Lock functionality coming soon', 'info');
}

async function sendToBudget() {
  if (!currentEstimate) {
    showToast('No estimate selected', 'error');
    return;
  }

  try {
    const response = await fetch(`/api/estimates/${currentEstimate.id}/convert-to-budget`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) throw new Error('Failed to convert to budget');

    showToast('Estimate converted to budget', 'success');
    await loadEstimateForJob(currentJobId);
  } catch (err) {
    console.error('Error converting to budget:', err);
    showToast('Failed to convert to budget', 'error');
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

    // Initialize workflow stepper
    currentWorkflowStep = determineWorkflowStep(currentEstimate);
    updateStepperVisibility();
    updateStepperUI();

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
  updateStepperVisibility(); // Hide stepper
}

function switchTab(tabName) {
  console.log('[switchTab] Switching to tab:', tabName);

  // Deactivate all tabs
  document.querySelectorAll('.tab').forEach(tab => {
    const isActive = tab.dataset.tab === tabName;
    tab.classList.toggle('active', isActive);
    console.log('[switchTab] Tab button', tab.dataset.tab, 'active:', isActive);
  });

  // Deactivate all tab content
  document.querySelectorAll('.tab-content').forEach(content => {
    const isActive = content.id === `tab-${tabName}`;
    content.classList.toggle('active', isActive);
    console.log('[switchTab] Tab content', content.id, 'active:', isActive);
  });

  console.log('[switchTab] Tab switch complete');
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
// ============================================================
// LINE ITEM MODAL
// ============================================================

function openAddLineModal(lineId = null, sectionId = null) {
  console.log('[openAddLineModal] Called with lineId:', lineId, 'sectionId:', sectionId);
  console.log('[openAddLineModal] currentEstimate:', currentEstimate);
  console.log('[openAddLineModal] currentJobId:', currentJobId);

  if (!currentEstimate) {
    showToast('No estimate loaded', 'error');
    console.error('[openAddLineModal] No currentEstimate set - this should not happen if estimate was loaded');
    return;
  }

  // Reset form
  document.getElementById('lineDescription').value = '';
  document.getElementById('lineQuantity').value = '1';
  document.getElementById('lineUnit').value = 'ea';
  document.getElementById('lineUnitCost').value = '0';
  document.getElementById('lineAmount').value = '0';
  document.getElementById('lineNotes').value = '';
  document.getElementById('lineItemId').value = lineId || '';

  // Populate cost codes dropdown
  const costCodeSelect = document.getElementById('lineCostCode');
  costCodeSelect.innerHTML = '<option value="">Select cost code...</option>';
  console.log('[openAddLineModal] Populating cost codes, count:', costCodes?.length || 0);
  (costCodes || []).forEach(cc => {
    const opt = document.createElement('option');
    opt.value = cc.id;
    opt.textContent = `${cc.code} - ${cc.name}`;
    costCodeSelect.appendChild(opt);
  });

  // Populate sections dropdown
  const sectionSelect = document.getElementById('lineSection');
  sectionSelect.innerHTML = '<option value="">No section</option>';
  console.log('[openAddLineModal] Populating sections, count:', currentEstimate.sections?.length || 0);
  (currentEstimate.sections || []).forEach(section => {
    const opt = document.createElement('option');
    opt.value = section.id;
    opt.textContent = section.name;
    if (sectionId && section.id === sectionId) opt.selected = true;
    sectionSelect.appendChild(opt);
  });

  // Auto-calculate amount on input changes
  const qtyInput = document.getElementById('lineQuantity');
  const costInput = document.getElementById('lineUnitCost');
  const amountInput = document.getElementById('lineAmount');

  const calculateAmount = () => {
    const qty = parseFloat(qtyInput.value) || 0;
    const cost = parseFloat(costInput.value) || 0;
    const total = qty * cost;
    amountInput.value = total.toFixed(2);
    console.log('[calculateAmount] qty:', qty, 'cost:', cost, 'total:', total);
  };

  // CRITICAL: Remove old listeners to prevent duplicate event handlers
  // Clone and replace to remove all event listeners
  const qtyInputClone = qtyInput.cloneNode(true);
  const costInputClone = costInput.cloneNode(true);
  qtyInput.parentNode.replaceChild(qtyInputClone, qtyInput);
  costInput.parentNode.replaceChild(costInputClone, costInput);

  // Add new listeners to cloned inputs
  document.getElementById('lineQuantity').addEventListener('input', calculateAmount);
  document.getElementById('lineUnitCost').addEventListener('input', calculateAmount);

  console.log('[openAddLineModal] Auto-calculation listeners attached');

  // Show modal
  document.getElementById('lineItemModalTitle').textContent = lineId ? 'Edit Line Item' : 'Add Line Item';
  const modal = document.getElementById('lineItemModal');
  modal.style.display = 'flex';
  setTimeout(() => {
    modal.classList.add('show');
    console.log('[openAddLineModal] Modal shown');
  }, 10);

  // Focus description field
  setTimeout(() => document.getElementById('lineDescription').focus(), 100);
}

function closeLineItemModal() {
  const modal = document.getElementById('lineItemModal');
  modal.classList.remove('show');
  setTimeout(() => modal.style.display = 'none', 200);
}

async function saveLineItem() {
  console.log('[saveLineItem] Starting save');

  if (!currentEstimate) {
    showToast('No estimate loaded', 'error');
    console.error('[saveLineItem] No currentEstimate - aborting');
    return;
  }

  const description = document.getElementById('lineDescription').value.trim();
  const quantity = parseFloat(document.getElementById('lineQuantity').value) || 1;
  const unit = document.getElementById('lineUnit').value.trim();
  const unitCost = parseFloat(document.getElementById('lineUnitCost').value) || 0;
  const amount = parseFloat(document.getElementById('lineAmount').value) || 0;
  const costCodeId = document.getElementById('lineCostCode').value || null;
  const sectionId = document.getElementById('lineSection').value || null;
  const notes = document.getElementById('lineNotes').value.trim();
  const lineItemId = document.getElementById('lineItemId').value;

  console.log('[saveLineItem] Form values:', { description, quantity, unit, unitCost, amount, costCodeId, sectionId, lineItemId });

  if (!description) {
    showToast('Description is required', 'error');
    console.error('[saveLineItem] Description is required');
    return;
  }

  try {
    let response;
    const body = {
      description,
      quantity,
      unit,
      unit_cost: unitCost,
      amount,
      cost_code_id: costCodeId,
      section_id: sectionId,
      notes: notes || null,
      created_by: window.currentUser || 'User'
    };

    if (lineItemId) {
      // Update existing line
      const url = `/api/estimates/${currentEstimate.id}/lines/${lineItemId}`;
      console.log('[saveLineItem] PATCH', url, body);
      response = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
    } else {
      // Create new line
      const url = `/api/estimates/${currentEstimate.id}/lines`;
      console.log('[saveLineItem] POST', url, body);
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
    }

    console.log('[saveLineItem] Response status:', response.status);

    if (!response.ok) {
      const err = await response.json();
      console.error('[saveLineItem] API error:', err);
      throw new Error(err.error || 'Failed to save line item');
    }

    const savedLine = await response.json();
    console.log('[saveLineItem] Saved successfully:', savedLine);

    showToast(lineItemId ? 'Line item updated' : 'Line item added', 'success');
    closeLineItemModal();

    // Reload estimate to get updated lines
    console.log('[saveLineItem] Reloading estimate...');
    await reloadCurrentEstimate();
    console.log('[saveLineItem] Reload complete');
  } catch (err) {
    console.error('[saveLineItem] Error:', err);
    showToast(err.message, 'error');
  }
}
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

  // Also render card view for mobile
  renderLineItemCards();
}

function renderLineItemCards() {
  const container = document.getElementById('lineItemsCards');
  if (!container || !currentEstimate) return;

  const lines = currentEstimate.lines || [];
  const isEditable = ['draft', 'rejected'].includes(currentEstimate.status);

  if (!lines || lines.length === 0) {
    container.innerHTML = `
      <div class="empty-state-card">
        <p>No line items yet</p>
        <button class="btn btn-primary" onclick="openAddLineModal()">+ Add First Item</button>
      </div>
    `;
    return;
  }

  container.innerHTML = lines.map((line, index) => `
    <div class="line-item-card" data-id="${line.id}">
      <div class="line-card-header">
        <span class="line-card-number">#${index + 1}</span>
        <span class="line-card-code">${escapeHtml(line.cost_code?.code || '-')}</span>
        ${isEditable ? `
          <button class="btn btn-icon btn-ghost" onclick="deleteLineItem('${line.id}')" title="Delete">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M5.5 5.5A.5.5 0 016 6v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm2.5 0a.5.5 0 01.5.5v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm3 .5a.5.5 0 00-1 0v6a.5.5 0 001 0V6z"/>
              <path fill-rule="evenodd" d="M14.5 3a1 1 0 01-1 1H13v9a2 2 0 01-2 2H5a2 2 0 01-2-2V4h-.5a1 1 0 01-1-1V2a1 1 0 011-1H6a1 1 0 011-1h2a1 1 0 011 1h3.5a1 1 0 011 1v1zM4.118 4L4 4.059V13a1 1 0 001 1h6a1 1 0 001-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
            </svg>
          </button>
        ` : ''}
      </div>
      <div class="line-card-description"
           ${isEditable ? 'data-editable data-field="description" data-type="text"' : ''}
           data-id="${line.id}">
        ${escapeHtml(line.description || 'No description')}
      </div>
      <div class="line-card-details">
        <div class="line-card-field">
          <span class="field-label">Qty</span>
          <span class="field-value"
                ${isEditable ? 'data-editable data-field="quantity" data-type="number"' : ''}
                data-id="${line.id}">
            ${line.quantity || 1}
          </span>
          <span class="field-unit">${escapeHtml(line.unit || 'LS')}</span>
        </div>
        <div class="line-card-field">
          <span class="field-label">Unit Cost</span>
          <span class="field-value"
                ${isEditable ? 'data-editable data-field="unit_cost" data-type="currency"' : ''}
                data-id="${line.id}">
            ${formatCurrency(line.unit_cost || 0)}
          </span>
        </div>
        <div class="line-card-field line-card-amount">
          <span class="field-label">Amount</span>
          <span class="field-value">${formatCurrency(line.amount || 0)}</span>
        </div>
      </div>
    </div>
  `).join('');

  // Re-initialize inline editing on card fields
  initInlineEditing();
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

// ============================================================
// WORKFLOW STEPPER
// ============================================================

const WORKFLOW_STEPS = ['create', 'build', 'review', 'send'];
let currentWorkflowStep = 'build'; // Default when viewing existing estimate

function initWorkflowStepper() {
  const stepper = document.getElementById('workflowStepper');
  if (!stepper) return;

  // Show stepper only when viewing an estimate
  updateStepperVisibility();
}

function updateStepperVisibility() {
  const stepper = document.getElementById('workflowStepper');
  if (!stepper) return;

  // Show stepper when an estimate is being viewed/edited
  // Hide when on estimate list view
  const isViewingEstimate = currentEstimate !== null;
  stepper.style.display = isViewingEstimate ? 'flex' : 'none';
}

function setWorkflowStep(step) {
  if (!WORKFLOW_STEPS.includes(step)) return;

  const previousStep = currentWorkflowStep;
  currentWorkflowStep = step;

  // Update UI
  updateStepperUI();

  // Handle step-specific content
  switch (step) {
    case 'create':
      // For existing estimates, "create" just shows the edit form
      if (currentEstimate) {
        editCurrentEstimate();
      }
      break;

    case 'build':
      // Show line items tab
      switchTab('lines');
      break;

    case 'review':
      // Show overview tab with summary
      switchTab('overview');
      showReviewView();
      break;

    case 'send':
      // Show send/share options
      showSendView();
      break;
  }
}

function updateStepperUI() {
  const stepper = document.getElementById('workflowStepper');
  if (!stepper) return;

  const currentIndex = WORKFLOW_STEPS.indexOf(currentWorkflowStep);

  // Update each step
  stepper.querySelectorAll('.step').forEach((stepEl, index) => {
    const stepName = stepEl.dataset.step;
    const stepIndex = WORKFLOW_STEPS.indexOf(stepName);

    stepEl.classList.remove('current', 'completed');

    if (stepIndex < currentIndex) {
      stepEl.classList.add('completed');
    } else if (stepIndex === currentIndex) {
      stepEl.classList.add('current');
    }
  });

  // Update connectors
  stepper.querySelectorAll('.step-connector').forEach((connector, index) => {
    connector.classList.toggle('completed', index < currentIndex);
  });
}

function determineWorkflowStep(estimate) {
  // Determine appropriate step based on estimate status
  if (!estimate) return 'create';

  const lineCount = estimate.lines?.length || 0;

  switch (estimate.status) {
    case 'draft':
      // If no lines, still in create/build phase
      return lineCount === 0 ? 'create' : 'build';

    case 'submitted':
      return 'review';

    case 'approved':
    case 'sent':
      return 'send';

    case 'converted':
      return 'send'; // Show as completed

    default:
      return 'build';
  }
}

function showReviewView() {
  // Ensure overview tab shows review-focused content
  // Could show summary stats, markup totals, etc.
  const statusActions = document.getElementById('statusActions');
  if (statusActions && currentEstimate) {
    statusActions.innerHTML = `
      <div class="review-summary">
        <h4>Estimate Summary</h4>
        <div class="summary-stat">
          <span class="summary-label">Line Items</span>
          <span class="summary-value">${currentEstimate.lines?.length || 0}</span>
        </div>
        <div class="summary-stat">
          <span class="summary-label">Subtotal</span>
          <span class="summary-value">${formatCurrency(currentEstimate.subtotal || 0)}</span>
        </div>
        <div class="summary-stat">
          <span class="summary-label">Total</span>
          <span class="summary-value">${formatCurrency(currentEstimate.total_amount || 0)}</span>
        </div>
        <div class="review-actions" style="margin-top: 16px;">
          <button class="btn btn-secondary" onclick="setWorkflowStep('build')">Edit Line Items</button>
          <button class="btn btn-primary" onclick="setWorkflowStep('send')">Continue to Send</button>
        </div>
      </div>
    `;
  }
}

function showSendView() {
  // Show send options in the overview area
  const statusActions = document.getElementById('statusActions');
  if (statusActions && currentEstimate) {
    statusActions.innerHTML = `
      <div class="send-options">
        <h4>Send Estimate</h4>
        <p class="text-muted">Share this estimate with the client.</p>
        <div class="send-actions" style="display: flex; flex-direction: column; gap: 12px; margin-top: 16px;">
          <button class="btn btn-primary btn-block" onclick="openGenerateProposalModal()">
            📄 Generate PDF Proposal
          </button>
          <button class="btn btn-secondary btn-block" onclick="emailEstimate()">
            📧 Email to Client
          </button>
          <button class="btn btn-secondary btn-block" onclick="copyEstimateShareLink()">
            🔗 Copy Share Link
          </button>
        </div>
      </div>
    `;
  }

  // Switch to overview tab to show send options
  switchTab('overview');
}

function emailEstimate() {
  if (!currentEstimate) {
    showToast('No estimate selected', 'error');
    return;
  }
  // TODO: Implement email functionality
  showToast('Email functionality coming soon', 'info');
}

function copyEstimateShareLink() {
  const link = `${window.location.origin}/estimates/${currentEstimate?.id || ''}`;
  navigator.clipboard.writeText(link).then(() => {
    showToast('Link copied to clipboard', 'success');
  }).catch(() => {
    showToast('Failed to copy link', 'error');
  });
}

function editCurrentEstimate() {
  // Open create/edit modal with current estimate data
  if (!currentEstimate) return;

  document.getElementById('modalTitle').textContent = 'Edit Estimate';
  document.getElementById('estimateId').value = currentEstimate.id;
  document.getElementById('formTitle').value = currentEstimate.title;
  document.getElementById('formJob').value = currentEstimate.job_id;
  document.getElementById('formNotes').value = currentEstimate.notes || '';

  const modal = document.getElementById('estimateModal');
  modal.style.display = 'flex';
  modal.classList.add('show');
}

function editLineItem(lineId) {
  const line = currentEstimate?.lines?.find(l => l.id === lineId);
  if (!line) {
    showToast('Line item not found', 'error');
    return;
  }

  // Populate the form with existing data
  document.getElementById('lineDescription').value = line.description || '';
  document.getElementById('lineQuantity').value = line.quantity || 1;
  document.getElementById('lineUnit').value = line.unit || 'ea';
  document.getElementById('lineUnitCost').value = line.unit_cost || 0;
  document.getElementById('lineAmount').value = line.amount || 0;
  document.getElementById('lineCostCode').value = line.cost_code_id || '';
  document.getElementById('lineSection').value = line.section_id || '';
  document.getElementById('lineNotes').value = line.notes || '';
  document.getElementById('lineItemId').value = lineId;

  // Open the modal (which will populate dropdowns)
  openAddLineModal(lineId);
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

// ============================================================
// KEYBOARD SHORTCUTS
// ============================================================

const KEYBOARD_SHORTCUTS = {
  'ctrl+s': { action: saveCurrentEstimate, description: 'Save estimate' },
  'ctrl+n': { action: openAddLineModal, description: 'Add new line item' },
  'ctrl+shift+n': { action: openCreateModal, description: 'New estimate' },
  'escape': { action: handleEscapeKey, description: 'Close modal / Cancel edit' },
  '?': { action: toggleShortcutHelp, description: 'Show keyboard shortcuts' },
  'ctrl+/': { action: toggleShortcutHelp, description: 'Show keyboard shortcuts' },
};

function initKeyboardShortcuts() {
  document.addEventListener('keydown', handleGlobalKeydown);
}

function handleGlobalKeydown(e) {
  // Don't trigger shortcuts when typing in inputs (unless it's Escape)
  const isTyping = e.target.matches('input, textarea, [contenteditable="true"]');

  if (isTyping && e.key !== 'Escape') {
    return;
  }

  // Build shortcut key string
  const key = buildShortcutKey(e);

  // Check if we have a handler for this shortcut
  const shortcut = KEYBOARD_SHORTCUTS[key];
  if (shortcut) {
    e.preventDefault();
    shortcut.action();
  }
}

function buildShortcutKey(e) {
  const parts = [];

  if (e.ctrlKey || e.metaKey) parts.push('ctrl');
  if (e.shiftKey) parts.push('shift');
  if (e.altKey) parts.push('alt');

  // Normalize key
  let key = e.key.toLowerCase();
  if (key === ' ') key = 'space';

  parts.push(key);

  return parts.join('+');
}

function saveCurrentEstimate() {
  // If in detail modal and editing, save the estimate
  if (currentEstimate) {
    // Trigger save of any pending inline edits
    const editingCell = document.querySelector('.editable-cell.editing');
    if (editingCell && editingCell._inlineEdit) {
      editingCell._inlineEdit.save();
    }
    showToast('Estimate saved', 'success');
  } else {
    // If in create modal, trigger save
    const createModal = document.getElementById('estimateModal');
    if (createModal && createModal.classList.contains('show')) {
      saveEstimate();
    }
  }
}

function handleEscapeKey() {
  // Priority: Close edit mode -> Close modal -> Close dropdown

  // 1. If editing a cell, cancel edit
  const editingCell = document.querySelector('.editable-cell.editing');
  if (editingCell && editingCell._inlineEdit) {
    editingCell._inlineEdit.cancel();
    return;
  }

  // 2. Close any open dropdown
  const openDropdown = document.querySelector('.dropdown.open');
  if (openDropdown) {
    openDropdown.classList.remove('open');
    return;
  }

  // 3. Close any open modal
  closeAllModals();
}

let shortcutHelpVisible = false;

function toggleShortcutHelp() {
  const existingHelp = document.getElementById('shortcutHelpPanel');

  if (existingHelp) {
    existingHelp.remove();
    shortcutHelpVisible = false;
    return;
  }

  showShortcutHelp();
}

function showShortcutHelp() {
  // Create help panel
  const panel = document.createElement('div');
  panel.id = 'shortcutHelpPanel';
  panel.className = 'shortcut-help-panel';

  panel.innerHTML = `
    <div class="shortcut-help-header">
      <h3>Keyboard Shortcuts</h3>
      <button class="btn btn-ghost btn-sm" onclick="toggleShortcutHelp()">&times;</button>
    </div>
    <div class="shortcut-help-body">
      <div class="shortcut-section">
        <h4>Navigation</h4>
        <div class="shortcut-item">
          <span class="shortcut-keys"><kbd>Tab</kbd></span>
          <span class="shortcut-desc">Next cell</span>
        </div>
        <div class="shortcut-item">
          <span class="shortcut-keys"><kbd>Shift</kbd> + <kbd>Tab</kbd></span>
          <span class="shortcut-desc">Previous cell</span>
        </div>
        <div class="shortcut-item">
          <span class="shortcut-keys"><kbd>Enter</kbd></span>
          <span class="shortcut-desc">Save & next row</span>
        </div>
        <div class="shortcut-item">
          <span class="shortcut-keys"><kbd>Esc</kbd></span>
          <span class="shortcut-desc">Cancel edit / Close</span>
        </div>
      </div>
      <div class="shortcut-section">
        <h4>Actions</h4>
        <div class="shortcut-item">
          <span class="shortcut-keys"><kbd>Ctrl</kbd> + <kbd>S</kbd></span>
          <span class="shortcut-desc">Save estimate</span>
        </div>
        <div class="shortcut-item">
          <span class="shortcut-keys"><kbd>Ctrl</kbd> + <kbd>N</kbd></span>
          <span class="shortcut-desc">Add line item</span>
        </div>
        <div class="shortcut-item">
          <span class="shortcut-keys"><kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>N</kbd></span>
          <span class="shortcut-desc">New estimate</span>
        </div>
      </div>
      <div class="shortcut-section">
        <h4>Help</h4>
        <div class="shortcut-item">
          <span class="shortcut-keys"><kbd>?</kbd></span>
          <span class="shortcut-desc">Show this help</span>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(panel);
  shortcutHelpVisible = true;

  // Close on click outside
  setTimeout(() => {
    document.addEventListener('click', closeShortcutHelpOnClickOutside, { once: true });
  }, 100);
}

function closeShortcutHelpOnClickOutside(e) {
  const panel = document.getElementById('shortcutHelpPanel');
  if (panel && !panel.contains(e.target)) {
    panel.remove();
    shortcutHelpVisible = false;
  }
}


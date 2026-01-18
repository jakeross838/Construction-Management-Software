/**
 * Estimates Management
 * Handles estimate listing, creation, line items, versioning, and budget conversion
 */

let estimates = [];
let jobs = [];
let costCodes = [];
let acceptedBids = [];
let currentEstimate = null;
let selectedBidId = null;
let debounceTimer;
let currentView = localStorage.getItem('estimatesView') || 'table';

// ============================================================
// INITIALIZATION
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
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

  await loadEstimates();
  await loadStats();
});

function initializeView() {
  // Set initial view from localStorage
  const tableView = document.getElementById('estimateTableView');
  const cardView = document.getElementById('estimateCardView');

  if (tableView) tableView.style.display = currentView === 'table' ? 'block' : 'none';
  if (cardView) cardView.style.display = currentView === 'cards' ? 'grid' : 'none';

  // Set active button
  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === currentView);
  });
}

function setView(view) {
  currentView = view;
  localStorage.setItem('estimatesView', view);

  // Update view toggle buttons
  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });

  // Show/hide containers
  const tableView = document.getElementById('estimateTableView');
  const cardView = document.getElementById('estimateCardView');

  if (tableView) tableView.style.display = view === 'table' ? 'block' : 'none';
  if (cardView) cardView.style.display = view === 'cards' ? 'grid' : 'none';

  renderEstimateList();
}

function openColumnSettings() {
  showToast('Column settings coming soon', 'info');
}

function regroupLines() {
  // Placeholder for line grouping functionality
  const groupBy = document.getElementById('lineGroupBy')?.value || 'none';
  showToast(`Grouped by: ${groupBy}`, 'info');
}

function setupEventListeners() {
  // Filter change handlers
  document.getElementById('jobFilter').addEventListener('change', applyFilters);
  document.getElementById('statusFilter').addEventListener('change', applyFilters);

  // Search with debounce
  document.getElementById('searchInput').addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    const clearBtn = document.getElementById('searchClear');
    clearBtn.style.display = e.target.value ? 'block' : 'none';
    debounceTimer = setTimeout(() => applyFilters(), 150);
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', handleKeyboardShortcuts);

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
// KEYBOARD SHORTCUTS
// ============================================================

let commandPaletteOpen = false;
let discoveryTooltipsShown = JSON.parse(localStorage.getItem('discoveryTooltipsShown') || '{}');

function handleKeyboardShortcuts(e) {
  // Don't trigger shortcuts when typing in inputs
  const activeEl = document.activeElement;
  const isTyping = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable);

  // Escape always works
  if (e.key === 'Escape') {
    if (commandPaletteOpen) {
      closeCommandPalette();
      return;
    }
    closeAllModals();
    return;
  }

  // Command palette: Ctrl/Cmd + K
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    toggleCommandPalette();
    return;
  }

  // Save: Ctrl/Cmd + S
  if ((e.metaKey || e.ctrlKey) && e.key === 's' && currentEstimate) {
    e.preventDefault();
    showToast('Estimate auto-saved', 'success');
    return;
  }

  // Duplicate: Ctrl/Cmd + D
  if ((e.metaKey || e.ctrlKey) && e.key === 'd' && currentEstimate) {
    e.preventDefault();
    openDuplicateModal();
    return;
  }

  // Group selected items: Ctrl/Cmd + G
  if ((e.metaKey || e.ctrlKey) && e.key === 'g' && selectedLineIds.size > 0) {
    e.preventDefault();
    openCreateAssemblyModal();
    return;
  }

  // Skip other shortcuts if typing
  if (isTyping) return;

  // Detail modal open shortcuts
  if (currentEstimate && document.getElementById('estimateDetailModal').classList.contains('show')) {
    switch (e.key.toLowerCase()) {
      case 'n': // New line item
        if (['draft', 'rejected'].includes(currentEstimate.status)) {
          e.preventDefault();
          openAddLineModal();
        }
        break;
      case 'a': // AI scope analysis
        if (['draft', 'rejected'].includes(currentEstimate.status)) {
          e.preventDefault();
          openScopeModal();
        }
        break;
      case 't': // Templates
        if (['draft', 'rejected'].includes(currentEstimate.status)) {
          e.preventDefault();
          openTemplatesModal();
        }
        break;
      case 'l': // Toggle cost library
        e.preventDefault();
        toggleCostLibrarySidebar();
        break;
      case 'delete':
      case 'backspace':
        if (selectedLineIds.size > 0) {
          e.preventDefault();
          deleteSelectedLines();
        }
        break;
    }
  }
}

function closeAllModals() {
  closeModal();
  closeDetailModal();
  closeImportBidModal();
  closeLineModal();
  closeScopeModal();
  closeTemplatesModal();
  closeAssemblyModal();
  closeDuplicateModal();
  closeCommandPalette();
}

async function deleteSelectedLines() {
  if (selectedLineIds.size === 0) return;

  const count = selectedLineIds.size;
  if (!confirm(`Delete ${count} selected line item${count > 1 ? 's' : ''}?`)) return;

  try {
    for (const lineId of selectedLineIds) {
      await fetch(`/api/estimates/${currentEstimate.id}/lines/${lineId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deleted_by: 'User' })
      });
    }

    showToast(`Deleted ${count} line item${count > 1 ? 's' : ''}`, 'success');
    selectedLineIds.clear();
    await openEstimateDetail(currentEstimate.id);
  } catch (err) {
    console.error('Error deleting lines:', err);
    showToast('Failed to delete some items', 'error');
  }
}

// ============================================================
// COMMAND PALETTE
// ============================================================

function toggleCommandPalette() {
  if (commandPaletteOpen) {
    closeCommandPalette();
  } else {
    openCommandPalette();
  }
}

function openCommandPalette() {
  // Remove existing if any
  closeCommandPalette();

  const palette = document.createElement('div');
  palette.id = 'commandPalette';
  palette.className = 'command-palette';
  palette.innerHTML = `
    <div class="command-palette-backdrop" onclick="closeCommandPalette()"></div>
    <div class="command-palette-modal">
      <div class="command-palette-header">
        <input type="text" id="commandPaletteSearch" class="command-palette-input" placeholder="Type a command..." autofocus>
      </div>
      <div class="command-palette-results" id="commandPaletteResults">
        ${renderCommandPaletteCommands('')}
      </div>
      <div class="command-palette-footer">
        <span><kbd>↑↓</kbd> Navigate</span>
        <span><kbd>Enter</kbd> Select</span>
        <span><kbd>Esc</kbd> Close</span>
      </div>
    </div>
  `;

  document.body.appendChild(palette);
  commandPaletteOpen = true;

  const input = document.getElementById('commandPaletteSearch');
  input.focus();

  // Filter on input
  input.addEventListener('input', (e) => {
    const results = document.getElementById('commandPaletteResults');
    results.innerHTML = renderCommandPaletteCommands(e.target.value);
    highlightFirstCommand();
  });

  // Keyboard navigation
  input.addEventListener('keydown', (e) => {
    const items = document.querySelectorAll('.command-item:not(.disabled)');
    const current = document.querySelector('.command-item.highlighted');
    const currentIndex = current ? Array.from(items).indexOf(current) : -1;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (current) current.classList.remove('highlighted');
      const next = items[Math.min(currentIndex + 1, items.length - 1)];
      if (next) next.classList.add('highlighted');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (current) current.classList.remove('highlighted');
      const prev = items[Math.max(currentIndex - 1, 0)];
      if (prev) prev.classList.add('highlighted');
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const highlighted = document.querySelector('.command-item.highlighted');
      if (highlighted) highlighted.click();
    }
  });

  highlightFirstCommand();
}

function closeCommandPalette() {
  const palette = document.getElementById('commandPalette');
  if (palette) {
    palette.remove();
  }
  commandPaletteOpen = false;
}

function highlightFirstCommand() {
  const items = document.querySelectorAll('.command-item:not(.disabled)');
  document.querySelectorAll('.command-item.highlighted').forEach(el => el.classList.remove('highlighted'));
  if (items[0]) items[0].classList.add('highlighted');
}

function renderCommandPaletteCommands(filter) {
  const lowerFilter = filter.toLowerCase();
  const inDetailModal = currentEstimate && document.getElementById('estimateDetailModal')?.classList.contains('show');
  const canEdit = currentEstimate && ['draft', 'rejected'].includes(currentEstimate.status);

  const commands = [
    { id: 'new-estimate', label: 'Create new estimate', icon: '+', action: 'openCreateModal()', shortcut: '', available: true },
    { id: 'import-bid', label: 'Import from bid', icon: '📥', action: 'openImportBidModal()', shortcut: '', available: true },
    { id: 'add-line', label: 'Add line item', icon: '+', action: 'openAddLineModal()', shortcut: 'N', available: inDetailModal && canEdit },
    { id: 'ai-scope', label: 'AI scope analysis', icon: '🤖', action: 'openScopeModal()', shortcut: 'A', available: inDetailModal && canEdit },
    { id: 'templates', label: 'Add from templates', icon: '📋', action: 'openTemplatesModal()', shortcut: 'T', available: inDetailModal && canEdit },
    { id: 'cost-library', label: 'Toggle cost library', icon: '📚', action: 'toggleCostLibrarySidebar()', shortcut: 'L', available: inDetailModal },
    { id: 'create-assembly', label: 'Create assembly from selection', icon: '📦', action: 'openCreateAssemblyModal()', shortcut: '⌘G', available: inDetailModal && canEdit && selectedLineIds.size > 0 },
    { id: 'duplicate', label: 'Duplicate estimate', icon: '📄', action: 'openDuplicateModal()', shortcut: '⌘D', available: inDetailModal },
    { id: 'submit', label: 'Submit for approval', icon: '📤', action: 'submitEstimate()', shortcut: '', available: inDetailModal && currentEstimate?.status === 'draft' },
    { id: 'approve', label: 'Approve estimate', icon: '✅', action: 'approveEstimate()', shortcut: '', available: inDetailModal && currentEstimate?.status === 'submitted' },
    { id: 'convert', label: 'Convert to budget', icon: '💰', action: 'convertToBudget()', shortcut: '', available: inDetailModal && currentEstimate?.status === 'approved' },
    { id: 'new-version', label: 'Create new version', icon: '🔄', action: 'createNewVersion()', shortcut: '', available: inDetailModal && ['approved', 'rejected'].includes(currentEstimate?.status) },
  ];

  const filtered = commands.filter(cmd => {
    if (!cmd.available) return false;
    if (!lowerFilter) return true;
    return cmd.label.toLowerCase().includes(lowerFilter) || cmd.id.includes(lowerFilter);
  });

  if (filtered.length === 0) {
    return '<div class="command-palette-empty">No commands found</div>';
  }

  return filtered.map(cmd => `
    <div class="command-item ${!cmd.available ? 'disabled' : ''}" onclick="${cmd.action}; closeCommandPalette()">
      <span class="command-icon">${cmd.icon}</span>
      <span class="command-label">${cmd.label}</span>
      ${cmd.shortcut ? `<span class="command-shortcut">${cmd.shortcut}</span>` : ''}
    </div>
  `).join('');
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
  populateCostCodeDropdown();
}

function populateJobDropdowns() {
  const selectors = ['jobFilter', 'formJob', 'importJobFilter'];
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

function populateCostCodeDropdown(filterCategory = '') {
  const select = document.getElementById('lineCostCode');
  if (!select) return;

  const currentValue = select.value;
  select.innerHTML = '<option value="">Select Cost Code...</option>';

  // Group by category
  const categories = {};
  costCodes.forEach(cc => {
    const cat = cc.category || 'Other';
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(cc);
  });

  // Populate category filter dropdown (only once)
  const categorySelect = document.getElementById('lineCategoryFilter');
  if (categorySelect && categorySelect.options.length <= 1) {
    Object.keys(categories).sort().forEach(cat => {
      const option = document.createElement('option');
      option.value = cat;
      option.textContent = cat;
      categorySelect.appendChild(option);
    });
  }

  // Filter and populate cost codes
  const categoriesToShow = filterCategory ? [filterCategory] : Object.keys(categories).sort();

  categoriesToShow.forEach(cat => {
    if (!categories[cat]) return;
    const optgroup = document.createElement('optgroup');
    optgroup.label = cat;
    categories[cat].forEach(cc => {
      const option = document.createElement('option');
      option.value = cc.id;
      option.textContent = `${cc.code} - ${cc.name}`;
      option.dataset.category = cat;
      optgroup.appendChild(option);
    });
    select.appendChild(optgroup);
  });

  // Restore selection if still valid
  if (currentValue) {
    const exists = Array.from(select.options).some(o => o.value === currentValue);
    if (exists) select.value = currentValue;
  }
}

function filterCostCodesByCategory() {
  const category = document.getElementById('lineCategoryFilter').value;
  populateCostCodeDropdown(category);
}

async function loadEstimates() {
  const params = new URLSearchParams();
  const jobId = document.getElementById('jobFilter').value;
  const status = document.getElementById('statusFilter').value;
  const search = document.getElementById('searchInput').value;

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
  const jobId = document.getElementById('jobFilter').value;
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
  document.getElementById('searchInput').value = '';
  document.getElementById('searchClear').style.display = 'none';
  applyFilters();
}

// ============================================================
// RENDERING
// ============================================================

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
      <td class="col-job">${escapeHtml(est.job?.name || '—')}</td>
      <td class="col-status">
        <span class="badge badge-${getStatusBadgeClass(est.status)}">${formatStatus(est.status)}</span>
      </td>
      <td style="text-align: center;">${est.line_count || 0}</td>
      <td class="col-amount">${formatCurrency(est.total_amount)}</td>
      <td class="col-date">${formatDate(est.created_at)}</td>
      <td class="col-actions" onclick="event.stopPropagation()">
        <button class="btn btn-ghost btn-sm" onclick="openEstimateDetail('${est.id}')" title="Open">📂</button>
        <button class="btn btn-ghost btn-sm" onclick="showCardActions(event, '${est.id}')" title="More">⋮</button>
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
        <div class="empty-state-message">
          Create your first estimate to start tracking project costs and generating proposals.
        </div>
        <button class="btn btn-primary btn-lg" onclick="openCreateModal()">+ Create First Estimate</button>
      </div>
    `;
    return;
  }

  container.innerHTML = estimates.map(est => {
    const statusIcon = getStatusIcon(est.status);
    const timeAgo = getTimeAgo(est.updated_at || est.created_at);

    return `
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
            <span class="status-pill-icon">${statusIcon}</span>
            ${formatStatus(est.status)}
          </span>
          ${est.source_bid_id ? '<span class="status-pill status-pill-info">From Bid</span>' : ''}
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

        <div class="estimate-card-footer">
          <div class="estimate-card-meta">
            Updated ${timeAgo}
          </div>
          <div class="estimate-card-actions" onclick="event.stopPropagation()">
            <button class="btn btn-sm btn-primary" onclick="openEstimateDetail('${est.id}')">Open</button>
            <button class="btn btn-sm btn-ghost" onclick="showCardActions(event, '${est.id}')" title="More actions">⋮</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
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

function getStatusIcon(status) {
  const icons = {
    draft: '○',
    submitted: '◐',
    approved: '●',
    rejected: '✕',
    converted: '◉'
  };
  return icons[status] || '○';
}

function getTimeAgo(dateStr) {
  if (!dateStr) return 'recently';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(dateStr);
}

function showCardActions(event, estimateId) {
  event.stopPropagation();
  const est = estimates.find(e => e.id === estimateId);
  if (!est) return;

  // Remove any existing popup
  const existing = document.querySelector('.card-actions-popup');
  if (existing) existing.remove();

  const popup = document.createElement('div');
  popup.className = 'card-actions-popup';
  popup.innerHTML = `
    ${est.status === 'draft' ? `<button onclick="openEditModal('${estimateId}'); closeCardActions()">Edit Details</button>` : ''}
    <button onclick="openEstimateDetail('${estimateId}'); setTimeout(() => switchTab('lines'), 100); closeCardActions()">View Line Items</button>
    <button onclick="closeDetailModal(); openDuplicateModalDirect('${estimateId}'); closeCardActions()">Duplicate</button>
    <hr>
    <button class="danger" onclick="deleteEstimate('${estimateId}'); closeCardActions()">Delete</button>
  `;

  // Position near the button
  const rect = event.target.getBoundingClientRect();
  popup.style.position = 'fixed';
  popup.style.top = `${rect.bottom + 5}px`;
  popup.style.right = `${window.innerWidth - rect.right}px`;

  document.body.appendChild(popup);

  // Close on click outside
  setTimeout(() => {
    document.addEventListener('click', closeCardActions, { once: true });
  }, 0);
}

function closeCardActions() {
  const popup = document.querySelector('.card-actions-popup');
  if (popup) popup.remove();
}

async function openDuplicateModalDirect(estimateId) {
  // Load estimate first if not current
  if (!currentEstimate || currentEstimate.id !== estimateId) {
    try {
      const response = await fetch(`/api/estimates/${estimateId}`);
      if (response.ok) {
        currentEstimate = await response.json();
      }
    } catch (err) {
      console.error('Error loading estimate:', err);
      return;
    }
  }
  openDuplicateModal();
}

function renderStats(stats) {
  document.getElementById('statTotal').textContent = stats.total || 0;
  document.getElementById('statDraft').textContent = stats.draft || 0;
  document.getElementById('statSubmitted').textContent = stats.submitted || 0;
  document.getElementById('statApproved').textContent = stats.approved || 0;
  document.getElementById('statTotalValue').textContent = formatCurrency(stats.total_value || 0);
}

// ============================================================
// CREATE/EDIT MODAL FUNCTIONS
// ============================================================

function openCreateModal() {
  document.getElementById('modalTitle').textContent = 'New Estimate';
  document.getElementById('estimateId').value = '';
  document.getElementById('estimateForm').reset();

  const modal = document.getElementById('estimateModal');
  modal.style.display = 'flex';
  modal.classList.add('show');
}

function openEditModal(estimateId) {
  const est = estimates.find(e => e.id === estimateId);
  if (!est) return;

  document.getElementById('modalTitle').textContent = 'Edit Estimate';
  document.getElementById('estimateId').value = est.id;
  document.getElementById('formTitle').value = est.title || '';
  document.getElementById('formJob').value = est.job_id || '';
  document.getElementById('formNotes').value = est.notes || '';

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
    created_by: 'User'
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

async function deleteEstimate(estimateId) {
  if (!confirm('Are you sure you want to delete this estimate?')) return;

  try {
    const response = await fetch(`/api/estimates/${estimateId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deleted_by: 'User' })
    });

    if (!response.ok) throw new Error('Failed to delete estimate');

    showToast('Estimate deleted', 'success');
    await loadEstimates();
    await loadStats();
  } catch (err) {
    console.error('Error deleting estimate:', err);
    showToast('Failed to delete estimate', 'error');
  }
}

// ============================================================
// IMPORT FROM BID MODAL
// ============================================================

function openImportBidModal() {
  selectedBidId = null;
  document.getElementById('importBidBtn').disabled = true;
  loadAcceptedBids();

  const modal = document.getElementById('importBidModal');
  modal.style.display = 'flex';
  modal.classList.add('show');
}

function closeImportBidModal() {
  const modal = document.getElementById('importBidModal');
  modal.classList.remove('show');
  modal.style.display = 'none';
}

async function loadAcceptedBids() {
  const jobId = document.getElementById('importJobFilter').value;
  const params = new URLSearchParams({ status: 'accepted' });
  if (jobId) params.append('job_id', jobId);

  try {
    const response = await fetch(`/api/bids?${params}`);
    acceptedBids = await response.json();
    renderBidSelectList();
  } catch (err) {
    console.error('Error loading bids:', err);
    document.getElementById('bidSelectList').innerHTML = '<p class="text-muted">Failed to load bids</p>';
  }
}

function renderBidSelectList() {
  const container = document.getElementById('bidSelectList');

  if (!acceptedBids.length) {
    container.innerHTML = '<p class="text-muted">No accepted bids available</p>';
    return;
  }

  container.innerHTML = acceptedBids.map(bid => `
    <div class="bid-select-item ${selectedBidId === bid.id ? 'selected' : ''}" onclick="selectBidForImport('${bid.id}')">
      <div class="bid-select-info">
        <strong>${escapeHtml(bid.title)}</strong>
        <span class="bid-select-meta">${bid.job?.name || 'No job'} - ${bid.vendor?.name || 'No vendor'}</span>
      </div>
      <div class="bid-select-amount">${formatCurrency(bid.bid_amount)}</div>
    </div>
  `).join('');
}

function selectBidForImport(bidId) {
  selectedBidId = bidId;
  document.getElementById('importBidBtn').disabled = false;
  renderBidSelectList();
}

async function importSelectedBid() {
  if (!selectedBidId) {
    showToast('Please select a bid', 'error');
    return;
  }

  try {
    const response = await fetch(`/api/estimates/import-from-bid/${selectedBidId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ created_by: 'User' })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to import bid');
    }

    const result = await response.json();
    showToast('Estimate created from bid', 'success');
    closeImportBidModal();
    await loadEstimates();
    await loadStats();

    // Open the new estimate
    openEstimateDetail(result.estimate.id);
  } catch (err) {
    console.error('Error importing bid:', err);
    showToast(err.message, 'error');
  }
}

// ============================================================
// DETAIL MODAL
// ============================================================

async function openEstimateDetail(estimateId) {
  try {
    const response = await fetch(`/api/estimates/${estimateId}`);
    if (!response.ok) throw new Error('Failed to load estimate');
    currentEstimate = await response.json();

    // Populate detail modal
    document.getElementById('detailTitle').textContent = currentEstimate.title;
    document.getElementById('detailStatus').textContent = formatStatus(currentEstimate.status);
    document.getElementById('detailStatus').className = `badge badge-${getStatusClass(currentEstimate.status)}`;
    document.getElementById('detailVersion').textContent = `v${currentEstimate.version || 1}`;
    document.getElementById('detailJob').textContent = currentEstimate.job?.name || '-';
    document.getElementById('detailAmount').textContent = formatCurrency(currentEstimate.total_amount);
    document.getElementById('detailLineCount').textContent = currentEstimate.lines?.length || 0;
    document.getElementById('detailCreated').textContent = `${formatDateTime(currentEstimate.created_at)} by ${currentEstimate.created_by || 'System'}`;
    document.getElementById('detailNotes').textContent = currentEstimate.notes || '-';

    // Submitted info
    if (currentEstimate.submitted_at) {
      document.getElementById('submittedRow').style.display = '';
      document.getElementById('detailSubmitted').textContent = `${formatDateTime(currentEstimate.submitted_at)} by ${currentEstimate.submitted_by || 'System'}`;
    } else {
      document.getElementById('submittedRow').style.display = 'none';
    }

    // Approved info
    if (currentEstimate.approved_at) {
      document.getElementById('approvedRow').style.display = '';
      document.getElementById('detailApproved').textContent = `${formatDateTime(currentEstimate.approved_at)} by ${currentEstimate.approved_by || 'System'}`;
    } else {
      document.getElementById('approvedRow').style.display = 'none';
    }

    // Source bid info
    if (currentEstimate.source_bid) {
      document.getElementById('sourceBidSection').style.display = '';
      document.getElementById('detailSourceBid').textContent = `${currentEstimate.source_bid.title} - ${formatCurrency(currentEstimate.source_bid.bid_amount)}`;
    } else {
      document.getElementById('sourceBidSection').style.display = 'none';
    }

    // Render status actions
    renderStatusActions();

    // Render line items
    renderLineItems();

    // Render versions
    renderVersions();

    // Render activity
    renderActivity();

    // Show/hide convert section
    const convertSection = document.getElementById('convertSection');
    const convertedInfo = document.getElementById('convertedInfo');

    if (currentEstimate.status === 'approved') {
      convertSection.style.display = 'block';
      if (currentEstimate.has_budget) {
        convertedInfo.style.display = 'block';
        document.querySelector('#convertSection .btn-primary').style.display = 'none';
      } else {
        convertedInfo.style.display = 'none';
        document.querySelector('#convertSection .btn-primary').style.display = 'inline-block';
      }
    } else {
      convertSection.style.display = 'none';
    }

    // Show/hide edit button based on status
    const editBtn = document.getElementById('editEstimateBtn');
    editBtn.style.display = ['draft', 'rejected'].includes(currentEstimate.status) ? '' : 'none';

    // Show/hide line item actions
    const lineActions = document.getElementById('lineItemsActions');
    lineActions.style.display = ['draft', 'rejected'].includes(currentEstimate.status) ? '' : 'none';

    // Show/hide new version button
    const newVersionBtn = document.getElementById('newVersionBtn');
    newVersionBtn.style.display = ['approved', 'rejected', 'converted'].includes(currentEstimate.status) ? '' : 'none';

    // Reset to overview tab
    switchTab('overview');

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

function editCurrentEstimate() {
  if (!currentEstimate) return;
  closeDetailModal();
  openEditModal(currentEstimate.id);
}

function renderStatusActions() {
  const container = document.getElementById('statusActions');
  if (!currentEstimate) return;

  const status = currentEstimate.status;
  let html = '';

  if (status === 'draft') {
    html = `
      <button class="btn btn-primary" onclick="submitEstimate()">Submit for Approval</button>
    `;
  } else if (status === 'submitted') {
    html = `
      <button class="btn btn-success" onclick="approveEstimate()">Approve</button>
      <button class="btn btn-danger" onclick="rejectEstimate()">Reject</button>
    `;
  } else if (status === 'rejected') {
    html = `
      <p class="text-warning">This estimate was rejected. Create a new version to revise.</p>
      <button class="btn btn-primary" onclick="createNewVersion()">Create New Version</button>
    `;
  } else if (status === 'approved') {
    html = `<p class="text-success">This estimate has been approved.</p>`;
  } else if (status === 'converted') {
    html = `<p class="text-success">This estimate has been converted to a budget.</p>`;
  }

  container.innerHTML = html;
}

let inlineEditDebounceTimer;
let pendingInlineSaves = new Map(); // Track cells being saved
let selectedLineIds = new Set(); // Track selected lines for assembly

function renderLineItems() {
  const tbody = document.getElementById('linesTableBody');
  const lines = currentEstimate?.lines || [];

  if (!lines.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="10">
          <div class="empty-state">
            <div class="empty-state-icon">📝</div>
            <div class="empty-state-title">No Line Items</div>
            <div class="empty-state-message">Click "Add Line Item" to begin building this estimate.</div>
          </div>
        </td>
      </tr>
    `;
    document.getElementById('linesTotalAmount').textContent = '$0.00';
    updateSelectAllHeader(false);
    return;
  }

  const canEdit = ['draft', 'rejected'].includes(currentEstimate.status);

  // Organize lines into assemblies and standalone
  const assemblies = lines.filter(l => l.is_assembly);
  const standaloneLines = lines.filter(l => !l.parent_line_id && !l.is_assembly);
  const childMap = {};

  // Group children by parent
  lines.forEach(l => {
    if (l.parent_line_id) {
      if (!childMap[l.parent_line_id]) childMap[l.parent_line_id] = [];
      childMap[l.parent_line_id].push(l);
    }
  });

  // Sort assemblies and their children by sort_order
  assemblies.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  Object.keys(childMap).forEach(parentId => {
    childMap[parentId].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  });
  standaloneLines.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

  // Build combined ordered list
  const orderedLines = [];
  let itemNumber = 0;

  // Interleave based on sort_order
  const allTopLevel = [...assemblies, ...standaloneLines].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

  allTopLevel.forEach(line => {
    itemNumber++;
    if (line.is_assembly) {
      orderedLines.push({ ...line, displayNumber: itemNumber, isAssemblyHeader: true });
      // Add children if not collapsed
      const children = childMap[line.id] || [];
      if (!line.collapsed) {
        children.forEach((child, childIdx) => {
          orderedLines.push({ ...child, displayNumber: `${itemNumber}.${childIdx + 1}`, isAssemblyChild: true, parentCollapsed: line.collapsed });
        });
      }
    } else {
      orderedLines.push({ ...line, displayNumber: itemNumber });
    }
  });

  tbody.innerHTML = orderedLines.map(line => {
    const isAssemblyHeader = line.isAssemblyHeader;
    const isAssemblyChild = line.isAssemblyChild;
    const canSelect = canEdit && !isAssemblyHeader && !isAssemblyChild;
    const childCount = childMap[line.id]?.length || 0;

    return `
    <tr data-line-id="${line.id}"
        class="${isAssemblyHeader ? 'assembly-row' : ''} ${isAssemblyChild ? 'assembly-child-row' : ''}"
        ${canEdit && !isAssemblyChild ? 'draggable="true"' : ''}>
      <td class="select-cell">
        ${canSelect ? `<input type="checkbox" class="line-select-checkbox" data-line-id="${line.id}" ${selectedLineIds.has(line.id) ? 'checked' : ''} onchange="toggleLineSelection('${line.id}')">` : ''}
      </td>
      <td class="drag-handle-cell">
        ${canEdit && !isAssemblyChild ? '<span class="drag-handle" title="Drag to reorder">⋮⋮</span>' : ''}
      </td>
      <td class="line-number ${isAssemblyChild ? 'child-number' : ''}">${line.displayNumber}</td>
      <td>
        ${isAssemblyHeader ? `
          <span class="assembly-toggle" onclick="toggleAssembly('${line.id}')" title="${line.collapsed ? 'Expand' : 'Collapse'}">
            ${line.collapsed ? '▶' : '▼'}
          </span>
          <span class="assembly-badge">Assembly (${childCount})</span>
        ` : (line.cost_code ? `${line.cost_code.code} ${line.cost_code.name}` : '-')}
      </td>
      <td class="${canEdit && !isAssemblyHeader ? 'editable-cell' : ''}"
          ${canEdit && !isAssemblyHeader ? `contenteditable="true" data-line-id="${line.id}" data-field="description" data-original="${escapeHtml(line.description) || ''}"` : ''}>
        ${escapeHtml(line.description) || '-'}
      </td>
      <td class="${canEdit && !isAssemblyHeader ? 'editable-cell editable-number' : ''}"
          ${canEdit && !isAssemblyHeader ? `contenteditable="true" data-line-id="${line.id}" data-field="quantity" data-original="${line.quantity || 1}"` : ''}>
        ${isAssemblyHeader ? '' : (line.quantity || 1)}
      </td>
      <td>${isAssemblyHeader ? 'LS' : (line.unit || '-')}</td>
      <td class="${canEdit && !isAssemblyHeader ? 'editable-cell editable-number' : ''}"
          ${canEdit && !isAssemblyHeader ? `contenteditable="true" data-line-id="${line.id}" data-field="unit_cost" data-original="${line.unit_cost || 0}"` : ''}>
        ${isAssemblyHeader ? '' : formatNumber(line.unit_cost)}
      </td>
      <td class="line-amount ${isAssemblyHeader ? 'assembly-total' : ''}">${formatCurrency(line.amount)}</td>
      <td>
        ${canEdit ? (isAssemblyHeader ? `
          <button class="btn btn-xs btn-secondary" onclick="ungroupAssembly('${line.id}')" title="Ungroup">Ungroup</button>
        ` : `
          <button class="btn btn-xs btn-secondary" onclick="openEditLineModal('${line.id}')" title="Edit">Edit</button>
          <button class="btn btn-xs btn-danger" onclick="deleteLineItem('${line.id}')" title="Delete">Del</button>
        `) : ''}
      </td>
    </tr>
  `}).join('');

  // Calculate total (only from top-level items and standalone to avoid double-counting)
  const total = allTopLevel.reduce((sum, line) => sum + parseFloat(line.amount || 0), 0);
  document.getElementById('linesTotalAmount').textContent = formatCurrency(total);

  // Update select all header
  updateSelectAllHeader(canEdit);

  // Set up inline editing and drag-drop event listeners
  if (canEdit) {
    setupInlineEditing();
    setupDragDrop();
    updateCreateAssemblyButton();
  }
}

function formatNumber(value) {
  if (value == null) return '0';
  return parseFloat(value).toFixed(2);
}

function setupInlineEditing() {
  const editableCells = document.querySelectorAll('.editable-cell');

  editableCells.forEach(cell => {
    // Focus event - select all text for easy replacement
    cell.addEventListener('focus', (e) => {
      cell.classList.add('editing');
      // Select all text on focus for number fields
      if (cell.classList.contains('editable-number')) {
        setTimeout(() => {
          const range = document.createRange();
          range.selectNodeContents(cell);
          const sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
        }, 0);
      }
    });

    // Blur event - save changes
    cell.addEventListener('blur', (e) => {
      cell.classList.remove('editing');
      handleInlineEditBlur(cell);
    });

    // Keydown for Tab navigation and Enter to save
    cell.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        cell.blur();
      } else if (e.key === 'Tab') {
        e.preventDefault();
        cell.blur();
        navigateToNextEditableCell(cell, e.shiftKey);
      } else if (e.key === 'Escape') {
        // Revert to original value
        cell.textContent = cell.dataset.original || '';
        cell.blur();
      }
    });

    // For number fields, only allow numeric input
    if (cell.classList.contains('editable-number')) {
      cell.addEventListener('keypress', (e) => {
        if (!/[\d.]/.test(e.key) && e.key !== 'Backspace' && e.key !== 'Delete') {
          e.preventDefault();
        }
      });
    }
  });
}

function navigateToNextEditableCell(currentCell, reverse = false) {
  const allCells = Array.from(document.querySelectorAll('.editable-cell'));
  const currentIndex = allCells.indexOf(currentCell);

  if (currentIndex === -1) return;

  let nextIndex = reverse ? currentIndex - 1 : currentIndex + 1;

  // Wrap around
  if (nextIndex >= allCells.length) nextIndex = 0;
  if (nextIndex < 0) nextIndex = allCells.length - 1;

  allCells[nextIndex]?.focus();
}

// ============================================================
// DRAG AND DROP REORDERING
// ============================================================

let draggedRow = null;

function setupDragDrop() {
  const tbody = document.getElementById('linesTableBody');
  const rows = tbody.querySelectorAll('tr[draggable="true"]');

  rows.forEach(row => {
    // Only allow drag from the drag handle
    const handle = row.querySelector('.drag-handle');
    if (handle) {
      handle.addEventListener('mousedown', () => {
        row.classList.add('drag-ready');
      });

      document.addEventListener('mouseup', () => {
        row.classList.remove('drag-ready');
      });
    }

    row.addEventListener('dragstart', handleDragStart);
    row.addEventListener('dragend', handleDragEnd);
    row.addEventListener('dragover', handleDragOver);
    row.addEventListener('dragenter', handleDragEnter);
    row.addEventListener('dragleave', handleDragLeave);
    row.addEventListener('drop', handleDrop);
  });
}

function handleDragStart(e) {
  // Only allow drag if initiated from drag handle
  if (!this.classList.contains('drag-ready')) {
    e.preventDefault();
    return;
  }

  draggedRow = this;
  this.classList.add('dragging');

  // Set drag data
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', this.dataset.lineId);

  // Make row semi-transparent during drag
  setTimeout(() => {
    this.style.opacity = '0.4';
  }, 0);
}

function handleDragEnd(e) {
  this.classList.remove('dragging', 'drag-ready');
  this.style.opacity = '';

  // Remove drag-over class from all rows
  document.querySelectorAll('.drag-over').forEach(el => {
    el.classList.remove('drag-over');
  });

  draggedRow = null;
}

function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
}

function handleDragEnter(e) {
  e.preventDefault();
  if (this !== draggedRow) {
    this.classList.add('drag-over');
  }
}

function handleDragLeave(e) {
  // Only remove if leaving the actual row (not just moving between child elements)
  if (!this.contains(e.relatedTarget)) {
    this.classList.remove('drag-over');
  }
}

async function handleDrop(e) {
  e.preventDefault();
  this.classList.remove('drag-over');

  if (!draggedRow || this === draggedRow) return;

  const tbody = document.getElementById('linesTableBody');
  const rows = Array.from(tbody.querySelectorAll('tr[data-line-id]'));
  const draggedIndex = rows.indexOf(draggedRow);
  const dropIndex = rows.indexOf(this);

  if (draggedIndex === -1 || dropIndex === -1) return;

  // Move the row in the DOM
  if (draggedIndex < dropIndex) {
    this.parentNode.insertBefore(draggedRow, this.nextSibling);
  } else {
    this.parentNode.insertBefore(draggedRow, this);
  }

  // Update row numbers
  updateRowNumbers();

  // Get new order of line IDs
  const newOrder = Array.from(tbody.querySelectorAll('tr[data-line-id]')).map(row => row.dataset.lineId);

  // Save the new order to the server
  await saveLineOrder(newOrder);
}

function updateRowNumbers() {
  const tbody = document.getElementById('linesTableBody');
  const rows = tbody.querySelectorAll('tr[data-line-id]');

  rows.forEach((row, idx) => {
    // The row number is in the second cell (after drag handle)
    const numberCell = row.children[1];
    if (numberCell) {
      numberCell.textContent = idx + 1;
    }
  });
}

async function saveLineOrder(lineIds) {
  if (!currentEstimate) return;

  try {
    const response = await fetch(`/api/estimates/${currentEstimate.id}/lines/reorder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        line_ids: lineIds,
        updated_by: 'User'
      })
    });

    if (!response.ok) {
      throw new Error('Failed to save order');
    }

    showToast('Order saved', 'success');

    // Update local data order
    const newLines = lineIds.map(id => currentEstimate.lines.find(l => l.id === id)).filter(Boolean);
    currentEstimate.lines = newLines;

  } catch (err) {
    console.error('Error saving line order:', err);
    showToast('Failed to save order', 'error');
    // Refresh to restore original order
    await openEstimateDetail(currentEstimate.id);
  }
}

async function handleInlineEditBlur(cell) {
  const lineId = cell.dataset.lineId;
  const field = cell.dataset.field;
  const originalValue = cell.dataset.original;
  let newValue = cell.textContent.trim();

  // For number fields, parse and format
  if (cell.classList.contains('editable-number')) {
    newValue = parseFloat(newValue) || 0;
    cell.textContent = formatNumber(newValue);
  }

  // Check if value actually changed
  if (String(newValue) === String(originalValue)) {
    return; // No change, skip save
  }

  // Show saving state
  cell.classList.add('saving');

  // Debounce to avoid rapid successive saves
  const saveKey = `${lineId}-${field}`;

  clearTimeout(pendingInlineSaves.get(saveKey));

  pendingInlineSaves.set(saveKey, setTimeout(async () => {
    try {
      const updateData = {
        [field]: newValue,
        updated_by: 'User'
      };

      const response = await fetch(`/api/estimates/${currentEstimate.id}/lines/${lineId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });

      if (!response.ok) {
        throw new Error('Failed to save');
      }

      const result = await response.json();

      // Update the original value to the new saved value
      cell.dataset.original = String(newValue);
      cell.classList.remove('saving');
      cell.classList.add('saved');

      // Update amount in the row if qty or unit_cost changed
      if (field === 'quantity' || field === 'unit_cost') {
        const row = cell.closest('tr');
        const amountCell = row.querySelector('.line-amount');
        if (amountCell && result.line) {
          amountCell.textContent = formatCurrency(result.line.amount);
        }
      }

      // Update total
      if (result.estimate_total !== undefined) {
        document.getElementById('linesTotalAmount').textContent = formatCurrency(result.estimate_total);
      }

      // Update currentEstimate line data
      const lineIndex = currentEstimate.lines.findIndex(l => l.id === lineId);
      if (lineIndex >= 0 && result.line) {
        currentEstimate.lines[lineIndex] = result.line;
      }

      // Remove saved indicator after brief delay
      setTimeout(() => cell.classList.remove('saved'), 1500);

    } catch (err) {
      console.error('Inline edit save error:', err);
      cell.classList.remove('saving');
      cell.classList.add('error');
      showToast('Failed to save change', 'error');

      // Revert to original value
      cell.textContent = cell.dataset.original || '';

      setTimeout(() => cell.classList.remove('error'), 2000);
    }

    pendingInlineSaves.delete(saveKey);
  }, 300));
}

function renderVersions() {
  const container = document.getElementById('versionsList');
  const versions = currentEstimate?.versions || [];

  if (!versions.length && currentEstimate) {
    // Show current as only version
    container.innerHTML = `
      <div class="version-item current">
        <div class="version-info">
          <strong>Version ${currentEstimate.version || 1}</strong>
          <span class="badge badge-${getStatusClass(currentEstimate.status)}">${formatStatus(currentEstimate.status)}</span>
        </div>
        <div class="version-meta">
          ${formatCurrency(currentEstimate.total_amount)} - ${formatDate(currentEstimate.created_at)}
        </div>
      </div>
    `;
    return;
  }

  // Include current estimate in versions list if not already there
  let allVersions = [...versions];
  if (!allVersions.find(v => v.id === currentEstimate.id)) {
    allVersions.push({
      id: currentEstimate.id,
      title: currentEstimate.title,
      version: currentEstimate.version,
      status: currentEstimate.status,
      total_amount: currentEstimate.total_amount,
      created_at: currentEstimate.created_at
    });
  }

  allVersions.sort((a, b) => (b.version || 1) - (a.version || 1));

  container.innerHTML = allVersions.map(v => `
    <div class="version-item ${v.id === currentEstimate.id ? 'current' : ''}" onclick="${v.id !== currentEstimate.id ? `openEstimateDetail('${v.id}')` : ''}">
      <div class="version-info">
        <strong>Version ${v.version || 1}</strong>
        <span class="badge badge-${getStatusClass(v.status)}">${formatStatus(v.status)}</span>
        ${v.id === currentEstimate.id ? '<span class="current-tag">Current</span>' : ''}
      </div>
      <div class="version-meta">
        ${formatCurrency(v.total_amount)} - ${formatDate(v.created_at)}
      </div>
    </div>
  `).join('');
}

function renderActivity() {
  const container = document.getElementById('activityTimeline');
  if (!currentEstimate || !currentEstimate.activity?.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📜</div>
        <div class="empty-state-title">No Activity</div>
        <div class="empty-state-message">Activity will appear here as changes are made.</div>
      </div>
    `;
    return;
  }

  container.innerHTML = currentEstimate.activity.map(act => `
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
}

// ============================================================
// STATUS ACTIONS
// ============================================================

async function submitEstimate() {
  if (!currentEstimate) return;

  if (!confirm('Submit this estimate for approval?')) return;

  try {
    const response = await fetch(`/api/estimates/${currentEstimate.id}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ submitted_by: 'User' })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to submit estimate');
    }

    showToast('Estimate submitted for approval', 'success');
    await openEstimateDetail(currentEstimate.id);
    await loadEstimates();
    await loadStats();
  } catch (err) {
    console.error('Error submitting estimate:', err);
    showToast(err.message, 'error');
  }
}

async function approveEstimate() {
  if (!currentEstimate) return;

  if (!confirm('Approve this estimate?')) return;

  try {
    const response = await fetch(`/api/estimates/${currentEstimate.id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approved_by: 'User' })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to approve estimate');
    }

    showToast('Estimate approved', 'success');
    await openEstimateDetail(currentEstimate.id);
    await loadEstimates();
    await loadStats();
  } catch (err) {
    console.error('Error approving estimate:', err);
    showToast(err.message, 'error');
  }
}

async function rejectEstimate() {
  if (!currentEstimate) return;

  const reason = prompt('Reason for rejection (optional):');
  if (reason === null) return; // User cancelled

  try {
    const response = await fetch(`/api/estimates/${currentEstimate.id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rejected_by: 'User', reason })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to reject estimate');
    }

    showToast('Estimate rejected', 'success');
    await openEstimateDetail(currentEstimate.id);
    await loadEstimates();
    await loadStats();
  } catch (err) {
    console.error('Error rejecting estimate:', err);
    showToast(err.message, 'error');
  }
}

async function createNewVersion() {
  if (!currentEstimate) return;

  if (!confirm('Create a new version of this estimate? All line items will be copied.')) return;

  try {
    const response = await fetch(`/api/estimates/${currentEstimate.id}/new-version`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ created_by: 'User' })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to create new version');
    }

    const result = await response.json();
    showToast(result.message, 'success');
    await loadEstimates();
    await loadStats();

    // Open the new version
    openEstimateDetail(result.estimate.id);
  } catch (err) {
    console.error('Error creating new version:', err);
    showToast(err.message, 'error');
  }
}

async function convertToBudget() {
  if (!currentEstimate) return;

  if (!confirm('Convert this estimate to budget lines? This will create or update budget entries for each cost code.')) return;

  try {
    const response = await fetch(`/api/estimates/${currentEstimate.id}/convert-to-budget`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ converted_by: 'User' })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to convert to budget');
    }

    const result = await response.json();
    showToast(`Budget updated with ${result.budget_lines} line(s)`, 'success');
    await openEstimateDetail(currentEstimate.id);
    await loadEstimates();
    await loadStats();
  } catch (err) {
    console.error('Error converting to budget:', err);
    showToast(err.message, 'error');
  }
}

// ============================================================
// LINE ITEM MODAL
// ============================================================

function openAddLineModal() {
  if (!currentEstimate) return;

  document.getElementById('lineModalTitle').textContent = 'Add Line Item';
  document.getElementById('lineItemId').value = '';
  document.getElementById('lineItemForm').reset();
  document.getElementById('lineQuantity').value = '1';

  const modal = document.getElementById('lineItemModal');
  modal.style.display = 'flex';
  modal.classList.add('show');
}

function openEditLineModal(lineId) {
  if (!currentEstimate) return;

  const line = currentEstimate.lines.find(l => l.id === lineId);
  if (!line) return;

  document.getElementById('lineModalTitle').textContent = 'Edit Line Item';
  document.getElementById('lineItemId').value = line.id;
  document.getElementById('lineCostCode').value = line.cost_code_id || '';
  document.getElementById('lineDescription').value = line.description || '';
  document.getElementById('lineQuantity').value = line.quantity || 1;
  document.getElementById('lineUnit').value = line.unit || '';
  document.getElementById('lineUnitCost').value = line.unit_cost || '';
  document.getElementById('lineAmount').value = line.amount || '';
  document.getElementById('lineNotes').value = line.notes || '';

  const modal = document.getElementById('lineItemModal');
  modal.style.display = 'flex';
  modal.classList.add('show');
}

function closeLineModal() {
  const modal = document.getElementById('lineItemModal');
  modal.classList.remove('show');
  modal.style.display = 'none';
}

function calculateLineAmount() {
  const qty = parseFloat(document.getElementById('lineQuantity').value) || 0;
  const unitCost = parseFloat(document.getElementById('lineUnitCost').value) || 0;
  document.getElementById('lineAmount').value = (qty * unitCost).toFixed(2);
}

async function saveLineItem() {
  if (!currentEstimate) return;

  const lineId = document.getElementById('lineItemId').value;
  const data = {
    cost_code_id: document.getElementById('lineCostCode').value || null,
    description: document.getElementById('lineDescription').value || null,
    quantity: parseFloat(document.getElementById('lineQuantity').value) || 1,
    unit: document.getElementById('lineUnit').value || null,
    unit_cost: parseFloat(document.getElementById('lineUnitCost').value) || 0,
    amount: parseFloat(document.getElementById('lineAmount').value) || 0,
    notes: document.getElementById('lineNotes').value || null,
    created_by: 'User',
    updated_by: 'User'
  };

  try {
    const url = lineId
      ? `/api/estimates/${currentEstimate.id}/lines/${lineId}`
      : `/api/estimates/${currentEstimate.id}/lines`;
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
    closeLineModal();
    await openEstimateDetail(currentEstimate.id);
  } catch (err) {
    console.error('Error saving line item:', err);
    showToast(err.message, 'error');
  }
}

async function deleteLineItem(lineId) {
  if (!currentEstimate) return;

  if (!confirm('Delete this line item?')) return;

  try {
    const response = await fetch(`/api/estimates/${currentEstimate.id}/lines/${lineId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deleted_by: 'User' })
    });

    if (!response.ok) throw new Error('Failed to delete line item');

    showToast('Line item deleted', 'success');
    await openEstimateDetail(currentEstimate.id);
  } catch (err) {
    console.error('Error deleting line item:', err);
    showToast('Failed to delete line item', 'error');
  }
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

function formatCurrency(amount) {
  if (amount == null) return '-';
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

function getStatusClass(status) {
  const classMap = {
    draft: 'warning',
    submitted: 'info',
    approved: 'success',
    rejected: 'danger',
    converted: 'secondary'
  };
  return classMap[status] || 'secondary';
}

function formatAction(action) {
  const actionMap = {
    created: 'Estimate created',
    updated: 'Estimate updated',
    deleted: 'Estimate deleted',
    submitted: 'Submitted for approval',
    approved: 'Estimate approved',
    rejected: 'Estimate rejected',
    line_added: 'Line item added',
    line_updated: 'Line item updated',
    line_deleted: 'Line item deleted',
    lines_reordered: 'Line items reordered',
    version_created: 'New version created',
    converted_to_budget: 'Converted to budget',
    imported_from_bid: 'Imported from bid'
  };
  return actionMap[action] || action;
}

function getActivityIcon(action) {
  const iconMap = {
    created: '+',
    updated: 'E',
    deleted: 'X',
    submitted: 'S',
    approved: 'A',
    rejected: 'R',
    line_added: '+',
    line_updated: 'E',
    line_deleted: '-',
    lines_reordered: 'O',
    version_created: 'V',
    converted_to_budget: 'B',
    imported_from_bid: 'I'
  };
  return iconMap[action] || '*';
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ============================================================
// ENHANCED COST CODE & AI FEATURES
// ============================================================

let templates = [];
let selectedScopeItems = new Set();
let selectedTemplate = null;
let descriptionDebounceTimer;

async function onCostCodeSelected() {
  const costCodeId = document.getElementById('lineCostCode').value;
  if (!costCodeId) {
    document.getElementById('historicalPricing').innerHTML = '<p class="text-muted">Select a cost code to see historical pricing.</p>';
    return;
  }

  await loadHistoricalPricing(costCodeId);

  // Auto-fill description from cost code name if empty
  const desc = document.getElementById('lineDescription');
  if (!desc.value) {
    const cc = costCodes.find(c => c.id === costCodeId);
    if (cc) desc.value = cc.name;
  }
}

async function loadHistoricalPricing(costCodeId) {
  const container = document.getElementById('historicalPricing');
  container.innerHTML = '<p class="text-muted">Loading historical data...</p>';

  try {
    const response = await fetch(`/api/estimates/historical-pricing/${costCodeId}`);
    const data = await response.json();

    if (data.stats.count === 0) {
      container.innerHTML = '<p class="text-muted">No historical pricing data available for this cost code.</p>';
      return;
    }

    let html = `
      <div class="pricing-stats">
        <div class="pricing-stat">
          <span class="pricing-label">Average</span>
          <span class="pricing-value">${formatCurrency(data.stats.avg)}</span>
        </div>
        <div class="pricing-stat">
          <span class="pricing-label">Range</span>
          <span class="pricing-value">${formatCurrency(data.stats.min)} - ${formatCurrency(data.stats.max)}</span>
        </div>
        <div class="pricing-stat">
          <span class="pricing-label">Based on</span>
          <span class="pricing-value">${data.stats.count} records</span>
        </div>
      </div>
    `;

    // Show recent history
    const allHistory = [...(data.po_history || []), ...(data.estimate_history || [])].slice(0, 5);
    if (allHistory.length > 0) {
      html += '<div class="pricing-history"><h5>Recent History</h5>';
      allHistory.forEach(h => {
        html += `
          <div class="pricing-history-item" onclick="applyHistoricalPrice(${h.amount}, ${h.unit_cost || h.amount})">
            <span class="history-amount">${formatCurrency(h.amount)}</span>
            <span class="history-meta">${h.job || h.vendor || 'Unknown'}</span>
          </div>
        `;
      });
      html += '</div>';
    }

    container.innerHTML = html;
  } catch (err) {
    console.error('Error loading historical pricing:', err);
    container.innerHTML = '<p class="text-muted">Failed to load historical data.</p>';
  }
}

function applyHistoricalPrice(amount, unitCost) {
  document.getElementById('lineUnitCost').value = unitCost || amount;
  calculateLineAmount();
  showToast('Price applied from history', 'success');
}

function onDescriptionInput() {
  clearTimeout(descriptionDebounceTimer);
  const description = document.getElementById('lineDescription').value;

  if (description.length < 5) {
    document.getElementById('aiSuggestions').innerHTML = '<p class="text-muted">Start typing a description to get AI-powered suggestions.</p>';
    return;
  }

  descriptionDebounceTimer = setTimeout(() => {
    suggestCostCodeFromDescription(description);
  }, 500);
}

function suggestCostCodeFromDescription(description) {
  const container = document.getElementById('aiSuggestions');
  const descLower = description.toLowerCase();

  // Simple keyword matching for quick suggestions (no API call)
  const suggestions = [];
  const keywords = {
    'framing': ['10101', '10102'],
    'lumber': ['10102'],
    'electrical': ['13101', '13102'],
    'wiring': ['13101'],
    'plumbing': ['12101', '12102'],
    'pipe': ['12101'],
    'hvac': ['14101', '14102'],
    'drywall': ['19101', '19102'],
    'paint': ['27101', '27102'],
    'roofing': ['17101', '17102'],
    'concrete': ['08101', '08102'],
    'flooring': ['23101', '23102'],
    'tile': ['24101'],
    'cabinet': ['21101', '21102'],
    'countertop': ['21201'],
    'window': ['11101'],
    'door': ['11102', '25101'],
    'insulation': ['18101']
  };

  for (const [keyword, codes] of Object.entries(keywords)) {
    if (descLower.includes(keyword)) {
      codes.forEach(code => {
        const cc = costCodes.find(c => c.code === code);
        if (cc && !suggestions.find(s => s.id === cc.id)) {
          suggestions.push(cc);
        }
      });
    }
  }

  if (suggestions.length === 0) {
    container.innerHTML = '<p class="text-muted">No suggestions for this description. Try different keywords.</p>';
    return;
  }

  container.innerHTML = `
    <p class="text-muted">Suggested cost codes:</p>
    ${suggestions.map(cc => `
      <div class="ai-suggestion-item" onclick="applySuggestedCostCode('${cc.id}')">
        <span class="suggestion-code">${cc.code}</span>
        <span class="suggestion-name">${cc.name}</span>
      </div>
    `).join('')}
  `;
}

function applySuggestedCostCode(costCodeId) {
  document.getElementById('lineCostCode').value = costCodeId;
  onCostCodeSelected();
  showToast('Cost code applied', 'success');
}

// ============================================================
// TEMPLATES MODAL
// ============================================================

async function openTemplatesModal() {
  if (!currentEstimate) return;

  // Load templates if not cached
  if (templates.length === 0) {
    try {
      const response = await fetch('/api/estimates/templates');
      templates = await response.json();
    } catch (err) {
      console.error('Error loading templates:', err);
      showToast('Failed to load templates', 'error');
      return;
    }
  }

  renderTemplatesGrid();

  const modal = document.getElementById('templatesModal');
  modal.style.display = 'flex';
  modal.classList.add('show');
}

function closeTemplatesModal() {
  const modal = document.getElementById('templatesModal');
  modal.classList.remove('show');
  modal.style.display = 'none';
  selectedTemplate = null;
  document.getElementById('templatePreview').style.display = 'none';
  document.getElementById('templatesGrid').style.display = '';
}

function renderTemplatesGrid() {
  const container = document.getElementById('templatesGrid');

  // Group templates by category
  const categories = {};
  templates.forEach(t => {
    const cat = t.category || 'Other';
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(t);
  });

  container.innerHTML = Object.entries(categories).map(([cat, temps]) => `
    <div class="template-category">
      <h4>${cat}</h4>
      <div class="template-cards">
        ${temps.map(t => `
          <div class="template-card" onclick="previewTemplate('${t.id}')">
            <span class="template-icon">${t.icon}</span>
            <span class="template-name">${t.name}</span>
            <span class="template-desc">${t.description}</span>
            <span class="template-count">${t.items.length} items</span>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');
}

function previewTemplate(templateId) {
  selectedTemplate = templates.find(t => t.id === templateId);
  if (!selectedTemplate) return;

  document.getElementById('templatesGrid').style.display = 'none';
  document.getElementById('templatePreview').style.display = 'block';
  document.getElementById('templatePreviewTitle').textContent = selectedTemplate.name;

  const container = document.getElementById('templatePreviewItems');
  container.innerHTML = selectedTemplate.items.map(item => `
    <div class="template-preview-item">
      <span class="preview-code">${item.code}</span>
      <span class="preview-name">${item.cost_code_name || item.name}</span>
      <span class="preview-unit">${item.unit}</span>
    </div>
  `).join('');
}

function hideTemplatePreview() {
  document.getElementById('templatePreview').style.display = 'none';
  document.getElementById('templatesGrid').style.display = '';
  selectedTemplate = null;
}

async function addTemplateItems() {
  if (!selectedTemplate || !currentEstimate) return;

  const itemsToAdd = selectedTemplate.items.filter(item => item.cost_code_id);

  if (itemsToAdd.length === 0) {
    showToast('No valid cost codes in template', 'error');
    return;
  }

  try {
    for (const item of itemsToAdd) {
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
          created_by: 'User'
        })
      });
    }

    showToast(`Added ${itemsToAdd.length} line items from template`, 'success');
    closeTemplatesModal();
    await openEstimateDetail(currentEstimate.id);
  } catch (err) {
    console.error('Error adding template items:', err);
    showToast('Failed to add some items', 'error');
  }
}

// ============================================================
// AI SCOPE ANALYSIS MODAL
// ============================================================

function openScopeModal() {
  if (!currentEstimate) return;

  document.getElementById('scopeText').value = '';
  document.getElementById('scopeResults').style.display = 'none';
  document.getElementById('analyzeScopeBtn').disabled = false;
  document.getElementById('analyzeScopeBtn').textContent = 'Analyze with AI';
  selectedScopeItems.clear();

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
  const scopeText = document.getElementById('scopeText').value.trim();
  if (!scopeText || scopeText.length < 10) {
    showToast('Please enter a scope description (at least 10 characters)', 'error');
    return;
  }

  const btn = document.getElementById('analyzeScopeBtn');
  btn.disabled = true;
  btn.textContent = 'Analyzing...';

  try {
    const response = await fetch('/api/estimates/analyze-scope', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scope_text: scopeText,
        job_id: currentEstimate?.job_id
      })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Analysis failed');
    }

    const result = await response.json();
    renderScopeResults(result);
  } catch (err) {
    console.error('Error analyzing scope:', err);
    showToast(err.message, 'error');
    btn.disabled = false;
    btn.textContent = 'Analyze with AI';
  }
}

function renderScopeResults(result) {
  document.getElementById('scopeResults').style.display = 'block';
  document.getElementById('analyzeScopeBtn').disabled = false;
  document.getElementById('analyzeScopeBtn').textContent = 'Re-analyze';

  const container = document.getElementById('scopeLineItems');
  const items = result.line_items || [];

  if (items.length === 0) {
    container.innerHTML = '<p class="text-muted">No line items could be extracted from the scope.</p>';
    return;
  }

  selectedScopeItems.clear();
  items.forEach((_, idx) => selectedScopeItems.add(idx));

  container.innerHTML = items.map((item, idx) => `
    <div class="scope-item ${selectedScopeItems.has(idx) ? 'selected' : ''}" onclick="toggleScopeItem(${idx})">
      <input type="checkbox" ${selectedScopeItems.has(idx) ? 'checked' : ''} onclick="event.stopPropagation(); toggleScopeItem(${idx})">
      <div class="scope-item-details">
        <div class="scope-item-main">
          <span class="scope-code">${item.cost_code || '-'}</span>
          <span class="scope-desc">${escapeHtml(item.description)}</span>
        </div>
        <div class="scope-item-meta">
          <span>${item.quantity} ${item.unit}</span>
          <span>@ ${formatCurrency(item.unit_cost)}</span>
          <span class="scope-amount">${formatCurrency(item.amount)}</span>
        </div>
        ${item.notes ? `<div class="scope-item-notes">${escapeHtml(item.notes)}</div>` : ''}
      </div>
    </div>
  `).join('');

  // Store items for later
  window._scopeItems = items;
}

function toggleScopeItem(idx) {
  if (selectedScopeItems.has(idx)) {
    selectedScopeItems.delete(idx);
  } else {
    selectedScopeItems.add(idx);
  }
  // Re-render checkboxes
  const items = document.querySelectorAll('.scope-item');
  items.forEach((el, i) => {
    el.classList.toggle('selected', selectedScopeItems.has(i));
    el.querySelector('input[type="checkbox"]').checked = selectedScopeItems.has(i);
  });
}

function selectAllScopeItems() {
  const items = window._scopeItems || [];
  selectedScopeItems.clear();
  items.forEach((_, idx) => selectedScopeItems.add(idx));
  // Re-render
  document.querySelectorAll('.scope-item').forEach((el, i) => {
    el.classList.add('selected');
    el.querySelector('input[type="checkbox"]').checked = true;
  });
}

async function addSelectedScopeItems() {
  if (!currentEstimate || selectedScopeItems.size === 0) {
    showToast('No items selected', 'error');
    return;
  }

  const items = window._scopeItems || [];
  const selectedItems = items.filter((_, idx) => selectedScopeItems.has(idx));

  try {
    for (const item of selectedItems) {
      await fetch(`/api/estimates/${currentEstimate.id}/lines`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cost_code_id: item.cost_code_id || null,
          description: item.description,
          quantity: item.quantity || 1,
          unit: item.unit,
          unit_cost: item.unit_cost || 0,
          amount: item.amount || 0,
          notes: item.notes || null,
          created_by: 'User'
        })
      });
    }

    showToast(`Added ${selectedItems.length} line items from AI analysis`, 'success');
    closeScopeModal();
    await openEstimateDetail(currentEstimate.id);
  } catch (err) {
    console.error('Error adding scope items:', err);
    showToast('Failed to add some items', 'error');
  }
}

// ============================================================
// DUPLICATE ESTIMATE MODAL
// ============================================================

function openDuplicateModal() {
  if (!currentEstimate) return;

  // Populate job dropdown
  const jobSelect = document.getElementById('duplicateJob');
  jobSelect.innerHTML = `<option value="">Same job (${currentEstimate.job?.name || 'Unknown'})</option>`;
  jobs.forEach(job => {
    if (job.id !== currentEstimate.job_id) {
      const option = document.createElement('option');
      option.value = job.id;
      option.textContent = job.name;
      jobSelect.appendChild(option);
    }
  });

  // Set default title
  document.getElementById('duplicateTitle').value = `${currentEstimate.title} (Copy)`;

  // Show summary
  const summaryEl = document.getElementById('duplicateSummary');
  summaryEl.innerHTML = `
    <div class="duplicate-info">
      <div class="duplicate-info-row">
        <span class="label">Original Estimate:</span>
        <span class="value">${escapeHtml(currentEstimate.title)}</span>
      </div>
      <div class="duplicate-info-row">
        <span class="label">Line Items:</span>
        <span class="value">${currentEstimate.lines?.length || 0}</span>
      </div>
      <div class="duplicate-info-row">
        <span class="label">Total Amount:</span>
        <span class="value">${formatCurrency(currentEstimate.total_amount)}</span>
      </div>
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

  const newTitle = document.getElementById('duplicateTitle').value.trim();
  const targetJobId = document.getElementById('duplicateJob').value;

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
        target_job_id: targetJobId || null,
        created_by: 'User'
      })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to duplicate estimate');
    }

    const result = await response.json();

    showToast('Estimate duplicated successfully', 'success');
    closeDuplicateModal();
    closeDetailModal();
    await loadEstimates();
    await loadStats();

    // Open the new estimate
    openEstimateDetail(result.estimate.id);
  } catch (err) {
    console.error('Error duplicating estimate:', err);
    showToast(err.message, 'error');
  }
}

// ============================================================
// ASSEMBLY FUNCTIONS
// ============================================================

function updateSelectAllHeader(canEdit) {
  const header = document.getElementById('selectAllHeader');
  if (!header) return;

  if (canEdit) {
    const selectableLines = (currentEstimate?.lines || []).filter(l => !l.is_assembly && !l.parent_line_id);
    const allSelected = selectableLines.length > 0 && selectableLines.every(l => selectedLineIds.has(l.id));

    header.innerHTML = `<input type="checkbox" id="selectAllCheckbox" ${allSelected ? 'checked' : ''} onchange="toggleSelectAll(this.checked)">`;
  } else {
    header.innerHTML = '';
  }
}

function toggleSelectAll(checked) {
  const selectableLines = (currentEstimate?.lines || []).filter(l => !l.is_assembly && !l.parent_line_id);

  if (checked) {
    selectableLines.forEach(l => selectedLineIds.add(l.id));
  } else {
    selectedLineIds.clear();
  }

  // Update checkboxes
  document.querySelectorAll('.line-select-checkbox').forEach(cb => {
    cb.checked = checked;
  });

  updateCreateAssemblyButton();
}

function toggleLineSelection(lineId) {
  if (selectedLineIds.has(lineId)) {
    selectedLineIds.delete(lineId);
  } else {
    selectedLineIds.add(lineId);
  }

  updateCreateAssemblyButton();
  updateSelectAllHeader(['draft', 'rejected'].includes(currentEstimate?.status));
  updateFloatingActionBar();
}

function updateCreateAssemblyButton() {
  const btn = document.getElementById('createAssemblyBtn');
  if (!btn) return;

  const count = selectedLineIds.size;
  if (count >= 1) {
    btn.style.display = '';
    btn.textContent = `Create Assembly (${count})`;
  } else {
    btn.style.display = 'none';
  }
}

async function toggleAssembly(assemblyId) {
  if (!currentEstimate) return;

  try {
    const response = await fetch(`/api/estimates/${currentEstimate.id}/assemblies/${assemblyId}/toggle`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      throw new Error('Failed to toggle assembly');
    }

    const result = await response.json();

    // Update local state
    const assembly = currentEstimate.lines.find(l => l.id === assemblyId);
    if (assembly) {
      assembly.collapsed = result.collapsed;
    }

    renderLineItems();
  } catch (err) {
    console.error('Error toggling assembly:', err);
    showToast('Failed to toggle assembly', 'error');
  }
}

async function ungroupAssembly(assemblyId) {
  if (!currentEstimate) return;

  if (!confirm('Ungroup this assembly? The line items will become standalone again.')) return;

  try {
    const response = await fetch(`/api/estimates/${currentEstimate.id}/assemblies/${assemblyId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deleted_by: 'User' })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to ungroup assembly');
    }

    showToast('Assembly ungrouped', 'success');
    await openEstimateDetail(currentEstimate.id);
  } catch (err) {
    console.error('Error ungrouping assembly:', err);
    showToast(err.message, 'error');
  }
}

function openCreateAssemblyModal() {
  if (!currentEstimate || selectedLineIds.size === 0) return;

  // Get selected lines info
  const selectedLines = currentEstimate.lines.filter(l => selectedLineIds.has(l.id));
  const total = selectedLines.reduce((sum, l) => sum + parseFloat(l.amount || 0), 0);

  document.getElementById('assemblyName').value = '';
  document.getElementById('hideComponentsFromClient').checked = false;

  // Show preview
  const previewEl = document.getElementById('assemblyPreview');
  previewEl.innerHTML = `
    <div class="assembly-preview-info">
      <div class="preview-row">
        <span class="label">Selected Items:</span>
        <span class="value">${selectedLines.length}</span>
      </div>
      <div class="preview-row">
        <span class="label">Total Amount:</span>
        <span class="value">${formatCurrency(total)}</span>
      </div>
      <div class="preview-items">
        ${selectedLines.map(l => `
          <div class="preview-item">
            <span class="preview-item-desc">${escapeHtml(l.description) || 'No description'}</span>
            <span class="preview-item-amount">${formatCurrency(l.amount)}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;

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
  if (!currentEstimate || selectedLineIds.size === 0) return;

  const name = document.getElementById('assemblyName').value.trim();
  const hideComponents = document.getElementById('hideComponentsFromClient').checked;

  if (!name) {
    showToast('Please enter an assembly name', 'error');
    return;
  }

  try {
    const response = await fetch(`/api/estimates/${currentEstimate.id}/assemblies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        line_ids: Array.from(selectedLineIds),
        name: name,
        hide_components_from_client: hideComponents,
        created_by: 'User'
      })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to create assembly');
    }

    const result = await response.json();

    showToast(`Assembly "${name}" created with ${result.child_count} items`, 'success');
    closeAssemblyModal();
    selectedLineIds.clear();
    await openEstimateDetail(currentEstimate.id);
  } catch (err) {
    console.error('Error creating assembly:', err);
    showToast(err.message, 'error');
  }
}

// ============================================================
// COST LIBRARY SIDEBAR
// ============================================================

let costLibrarySidebarVisible = false;
let allCostCodes = [];

function toggleCostLibrarySidebar() {
  const sidebar = document.getElementById('costLibrarySidebar');
  const toggleBtn = document.getElementById('toggleSidebarBtn');

  costLibrarySidebarVisible = !costLibrarySidebarVisible;

  if (costLibrarySidebarVisible) {
    sidebar.classList.add('visible');
    toggleBtn.textContent = '← Hide Library';
    loadCostLibrary();
  } else {
    sidebar.classList.remove('visible');
    toggleBtn.textContent = '📚 Library';
  }
}

async function loadCostLibrary() {
  try {
    const response = await fetch('/api/cost-codes');
    if (!response.ok) throw new Error('Failed to load cost codes');

    const data = await response.json();
    // Handle both { costCodes: [...] } and direct array responses
    allCostCodes = Array.isArray(data) ? data : (data.costCodes || []);
    renderCostLibrary();
    renderRecentCostCodes();
    renderFavoriteCostCodes();
  } catch (err) {
    console.error('Error loading cost library:', err);
  }
}

function renderCostLibrary(filter = '') {
  const container = document.getElementById('costLibraryCategories');
  const lowerFilter = filter.toLowerCase();

  // Group by category
  const categories = {};
  allCostCodes.forEach(cc => {
    const cat = cc.category || 'Uncategorized';
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(cc);
  });

  // Filter if search term present
  let html = '';
  const sortedCategories = Object.keys(categories).sort();

  sortedCategories.forEach((category, idx) => {
    let codes = categories[category];

    if (lowerFilter) {
      codes = codes.filter(cc =>
        cc.code.toLowerCase().includes(lowerFilter) ||
        cc.name.toLowerCase().includes(lowerFilter) ||
        (cc.category || '').toLowerCase().includes(lowerFilter)
      );
    }

    if (codes.length === 0) return;

    // Auto-expand when searching, or expand first 3 categories by default
    const shouldExpand = lowerFilter || idx < 3;

    html += `
      <div class="sidebar-category">
        <div class="sidebar-category-header" onclick="toggleCategory(this)">
          <span>${category}</span>
          <span class="category-count">${codes.length}</span>
          <span class="section-toggle">${shouldExpand ? '▼' : '▶'}</span>
        </div>
        <div class="sidebar-category-content ${shouldExpand ? 'open' : ''}">
          ${codes.map(cc => renderCostCodeItem(cc)).join('')}
        </div>
      </div>
    `;
  });

  container.innerHTML = html || '<p class="sidebar-empty">No cost codes found</p>';
}

function renderCostCodeItem(cc) {
  const isFavorite = getFavoriteCostCodes().includes(cc.id);
  return `
    <div class="sidebar-cost-code"
         draggable="true"
         data-cost-code-id="${cc.id}"
         ondragstart="handleCostCodeDragStart(event, '${cc.id}')"
         ondragend="handleCostCodeDragEnd(event)">
      <div class="cost-code-main">
        <span class="cost-code-code">${cc.code}</span>
        <span class="cost-code-name">${cc.name}</span>
      </div>
      <button class="btn btn-icon btn-ghost btn-xs favorite-btn ${isFavorite ? 'active' : ''}"
              onclick="event.stopPropagation(); toggleFavorite('${cc.id}')"
              title="${isFavorite ? 'Remove from favorites' : 'Add to favorites'}">
        ${isFavorite ? '★' : '☆'}
      </button>
    </div>
  `;
}

function filterCostLibrary() {
  const search = document.getElementById('costLibrarySearch').value;
  renderCostLibrary(search);
}

function toggleCategory(header) {
  const content = header.nextElementSibling;
  const toggle = header.querySelector('.section-toggle');
  const isOpen = content.classList.contains('open');

  content.classList.toggle('open');
  toggle.textContent = isOpen ? '▶' : '▼';
}

function toggleSidebarSection(sectionId) {
  const section = document.getElementById(sectionId);
  const content = section.querySelector('.sidebar-section-content');
  const toggle = section.querySelector('.section-toggle');
  const isOpen = content.classList.contains('open');

  content.classList.toggle('open');
  toggle.textContent = isOpen ? '▶' : '▼';
}

// Recent cost codes (localStorage)
function getRecentCostCodes() {
  try {
    return JSON.parse(localStorage.getItem('recentCostCodes') || '[]');
  } catch {
    return [];
  }
}

function addToRecentCostCodes(costCodeId) {
  let recent = getRecentCostCodes().filter(id => id !== costCodeId);
  recent.unshift(costCodeId);
  recent = recent.slice(0, 10); // Keep max 10
  localStorage.setItem('recentCostCodes', JSON.stringify(recent));
  renderRecentCostCodes();
}

function renderRecentCostCodes() {
  const container = document.getElementById('recentCostCodesList');
  const recentIds = getRecentCostCodes();

  if (recentIds.length === 0) {
    container.innerHTML = '<p class="sidebar-empty">No recent items</p>';
    return;
  }

  const recentCodes = recentIds.map(id => allCostCodes.find(cc => cc.id === id)).filter(Boolean);
  container.innerHTML = recentCodes.map(cc => renderCostCodeItem(cc)).join('');
}

// Favorite cost codes (localStorage)
function getFavoriteCostCodes() {
  try {
    return JSON.parse(localStorage.getItem('favoriteCostCodes') || '[]');
  } catch {
    return [];
  }
}

function toggleFavorite(costCodeId) {
  let favorites = getFavoriteCostCodes();

  if (favorites.includes(costCodeId)) {
    favorites = favorites.filter(id => id !== costCodeId);
  } else {
    favorites.push(costCodeId);
  }

  localStorage.setItem('favoriteCostCodes', JSON.stringify(favorites));
  renderFavoriteCostCodes();
  renderCostLibrary(document.getElementById('costLibrarySearch')?.value || '');
}

function renderFavoriteCostCodes() {
  const container = document.getElementById('favoriteCostCodesList');
  const favoriteIds = getFavoriteCostCodes();

  if (favoriteIds.length === 0) {
    container.innerHTML = '<p class="sidebar-empty">No favorites. Click ★ to add.</p>';
    return;
  }

  const favoriteCodes = favoriteIds.map(id => allCostCodes.find(cc => cc.id === id)).filter(Boolean);
  container.innerHTML = favoriteCodes.map(cc => renderCostCodeItem(cc)).join('');
}

// Drag from sidebar to add line
function handleCostCodeDragStart(event, costCodeId) {
  event.dataTransfer.setData('text/plain', costCodeId);
  event.dataTransfer.setData('application/cost-code', costCodeId);
  event.target.classList.add('dragging');

  // Show drop zone hint
  const dropZone = document.getElementById('linesTableDropZone');
  if (dropZone) dropZone.classList.add('drop-zone-active');
}

function handleCostCodeDragEnd(event) {
  event.target.classList.remove('dragging');

  const dropZone = document.getElementById('linesTableDropZone');
  if (dropZone) dropZone.classList.remove('drop-zone-active', 'drop-zone-hover');
}

// Set up drop zone on the table
function setupCostCodeDropZone() {
  const dropZone = document.getElementById('linesTableDropZone');
  if (!dropZone) return;

  dropZone.addEventListener('dragover', (e) => {
    if (e.dataTransfer.types.includes('application/cost-code')) {
      e.preventDefault();
      dropZone.classList.add('drop-zone-hover');
    }
  });

  dropZone.addEventListener('dragleave', (e) => {
    if (!dropZone.contains(e.relatedTarget)) {
      dropZone.classList.remove('drop-zone-hover');
    }
  });

  dropZone.addEventListener('drop', async (e) => {
    e.preventDefault();
    dropZone.classList.remove('drop-zone-hover', 'drop-zone-active');

    const costCodeId = e.dataTransfer.getData('application/cost-code');
    if (!costCodeId || !currentEstimate) return;

    const costCode = allCostCodes.find(cc => cc.id === costCodeId);
    if (!costCode) return;

    try {
      const response = await fetch(`/api/estimates/${currentEstimate.id}/lines`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cost_code_id: costCodeId,
          description: costCode.name,
          quantity: 1,
          unit: 'LS',
          unit_cost: 0,
          amount: 0,
          created_by: 'User'
        })
      });

      if (!response.ok) throw new Error('Failed to add line');

      // Track as recently used
      addToRecentCostCodes(costCodeId);

      showToast(`Added ${costCode.name}`, 'success');
      await openEstimateDetail(currentEstimate.id);
    } catch (err) {
      console.error('Error adding line from drag:', err);
      showToast('Failed to add line item', 'error');
    }
  });
}

// Initialize drop zone when tab switches
const originalSwitchTab = typeof switchTab === 'function' ? switchTab : null;
window.switchTabOriginal = originalSwitchTab;

function switchTab(tabName) {
  // Call original implementation if it exists
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

  document.querySelector(`.tab[data-tab="${tabName}"]`)?.classList.add('active');
  document.getElementById(`tab-${tabName}`)?.classList.add('active');

  // Initialize drop zone and quick-add row when switching to lines tab
  if (tabName === 'lines') {
    setTimeout(() => {
      setupCostCodeDropZone();
      setupQuickAddRow();
      showDiscoveryTooltip('inline-edit');
    }, 100);
  }

  // Update floating action bar visibility
  updateFloatingActionBar();
}

// ============================================================
// QUICK-ADD ROW
// ============================================================

function setupQuickAddRow() {
  const tbody = document.getElementById('linesTableBody');
  const canEdit = currentEstimate && ['draft', 'rejected'].includes(currentEstimate.status);

  if (!tbody || !canEdit) return;

  // Remove existing quick-add row if any
  const existing = tbody.querySelector('.quick-add-row');
  if (existing) existing.remove();

  // Add quick-add row at the bottom
  const row = document.createElement('tr');
  row.className = 'quick-add-row';
  row.innerHTML = `
    <td colspan="2"></td>
    <td class="quick-add-icon">+</td>
    <td colspan="2">
      <input type="text" class="quick-add-input" id="quickAddInput"
             placeholder="Type cost code or description to add..."
             onfocus="onQuickAddFocus()" onblur="onQuickAddBlur()" onkeydown="onQuickAddKeydown(event)" oninput="onQuickAddInput(event)">
      <div class="quick-add-suggestions" id="quickAddSuggestions" style="display:none"></div>
    </td>
    <td><input type="number" class="quick-add-qty" id="quickAddQty" placeholder="1" value="1" min="0" step="0.01"></td>
    <td>
      <select class="quick-add-unit" id="quickAddUnit">
        <option value="LS">LS</option>
        <option value="EA">EA</option>
        <option value="SF">SF</option>
        <option value="LF">LF</option>
        <option value="HR">HR</option>
      </select>
    </td>
    <td><input type="number" class="quick-add-rate" id="quickAddRate" placeholder="0.00" min="0" step="0.01"></td>
    <td></td>
    <td></td>
  `;

  tbody.appendChild(row);
}

let quickAddDebounce;
let quickAddSelectedIndex = -1;

function onQuickAddFocus() {
  showDiscoveryTooltip('quick-add');
}

function onQuickAddBlur() {
  // Delay to allow clicking on suggestions
  setTimeout(() => {
    const suggestions = document.getElementById('quickAddSuggestions');
    if (suggestions) suggestions.style.display = 'none';
  }, 200);
}

function onQuickAddInput(event) {
  clearTimeout(quickAddDebounce);
  const value = event.target.value.trim();

  if (value.length < 2) {
    document.getElementById('quickAddSuggestions').style.display = 'none';
    return;
  }

  quickAddDebounce = setTimeout(() => {
    showQuickAddSuggestions(value);
  }, 150);
}

function showQuickAddSuggestions(query) {
  const container = document.getElementById('quickAddSuggestions');
  const lowerQuery = query.toLowerCase();

  // Search cost codes
  const matches = allCostCodes.filter(cc =>
    cc.code.toLowerCase().includes(lowerQuery) ||
    cc.name.toLowerCase().includes(lowerQuery)
  ).slice(0, 8);

  if (matches.length === 0) {
    container.innerHTML = `
      <div class="quick-add-suggestion-item" onclick="addQuickLineCustom('${escapeHtml(query)}')">
        <span class="suggestion-icon">+</span>
        <span class="suggestion-text">Add as custom item: "${escapeHtml(query)}"</span>
      </div>
    `;
  } else {
    container.innerHTML = matches.map((cc, idx) => `
      <div class="quick-add-suggestion-item ${idx === quickAddSelectedIndex ? 'highlighted' : ''}"
           onclick="addQuickLineCostCode('${cc.id}')">
        <span class="suggestion-code">${cc.code}</span>
        <span class="suggestion-name">${cc.name}</span>
        <span class="suggestion-category">${cc.category || ''}</span>
      </div>
    `).join('');
  }

  container.style.display = 'block';
  quickAddSelectedIndex = -1;
}

function onQuickAddKeydown(event) {
  const suggestions = document.getElementById('quickAddSuggestions');
  const items = suggestions?.querySelectorAll('.quick-add-suggestion-item') || [];

  if (event.key === 'ArrowDown') {
    event.preventDefault();
    quickAddSelectedIndex = Math.min(quickAddSelectedIndex + 1, items.length - 1);
    updateQuickAddHighlight(items);
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    quickAddSelectedIndex = Math.max(quickAddSelectedIndex - 1, 0);
    updateQuickAddHighlight(items);
  } else if (event.key === 'Enter') {
    event.preventDefault();
    if (quickAddSelectedIndex >= 0 && items[quickAddSelectedIndex]) {
      items[quickAddSelectedIndex].click();
    } else if (items.length > 0) {
      items[0].click();
    }
  } else if (event.key === 'Tab') {
    // Tab to next quick-add field
    if (items.length > 0 && quickAddSelectedIndex === -1) {
      event.preventDefault();
      items[0].click();
    }
  } else if (event.key === 'Escape') {
    suggestions.style.display = 'none';
    quickAddSelectedIndex = -1;
  }
}

function updateQuickAddHighlight(items) {
  items.forEach((item, idx) => {
    item.classList.toggle('highlighted', idx === quickAddSelectedIndex);
  });
}

async function addQuickLineCostCode(costCodeId) {
  const costCode = allCostCodes.find(cc => cc.id === costCodeId);
  if (!costCode || !currentEstimate) return;

  const qty = parseFloat(document.getElementById('quickAddQty')?.value) || 1;
  const unit = document.getElementById('quickAddUnit')?.value || 'LS';
  const rate = parseFloat(document.getElementById('quickAddRate')?.value) || 0;

  try {
    const response = await fetch(`/api/estimates/${currentEstimate.id}/lines`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cost_code_id: costCodeId,
        description: costCode.name,
        quantity: qty,
        unit: unit,
        unit_cost: rate,
        amount: qty * rate,
        created_by: 'User'
      })
    });

    if (!response.ok) throw new Error('Failed to add line');

    addToRecentCostCodes(costCodeId);
    showToast(`Added ${costCode.name}`, 'success');

    // Clear inputs
    document.getElementById('quickAddInput').value = '';
    document.getElementById('quickAddQty').value = '1';
    document.getElementById('quickAddRate').value = '';
    document.getElementById('quickAddSuggestions').style.display = 'none';

    await openEstimateDetail(currentEstimate.id);
  } catch (err) {
    console.error('Error adding quick line:', err);
    showToast('Failed to add line item', 'error');
  }
}

async function addQuickLineCustom(description) {
  if (!currentEstimate) return;

  const qty = parseFloat(document.getElementById('quickAddQty')?.value) || 1;
  const unit = document.getElementById('quickAddUnit')?.value || 'LS';
  const rate = parseFloat(document.getElementById('quickAddRate')?.value) || 0;

  try {
    const response = await fetch(`/api/estimates/${currentEstimate.id}/lines`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: description,
        quantity: qty,
        unit: unit,
        unit_cost: rate,
        amount: qty * rate,
        created_by: 'User'
      })
    });

    if (!response.ok) throw new Error('Failed to add line');

    showToast(`Added custom item`, 'success');

    // Clear inputs
    document.getElementById('quickAddInput').value = '';
    document.getElementById('quickAddQty').value = '1';
    document.getElementById('quickAddRate').value = '';
    document.getElementById('quickAddSuggestions').style.display = 'none';

    await openEstimateDetail(currentEstimate.id);
  } catch (err) {
    console.error('Error adding quick line:', err);
    showToast('Failed to add line item', 'error');
  }
}

// ============================================================
// FLOATING ACTION BAR
// ============================================================

function updateFloatingActionBar() {
  const existingBar = document.getElementById('floatingActionBar');

  // Remove if not in detail modal or no selections
  if (!currentEstimate || !document.getElementById('estimateDetailModal')?.classList.contains('show')) {
    if (existingBar) existingBar.remove();
    return;
  }

  const canEdit = ['draft', 'rejected'].includes(currentEstimate.status);
  const count = selectedLineIds.size;

  if (count === 0 || !canEdit) {
    if (existingBar) existingBar.classList.remove('visible');
    return;
  }

  // Create if doesn't exist
  let bar = existingBar;
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'floatingActionBar';
    bar.className = 'floating-action-bar';
    document.body.appendChild(bar);
  }

  bar.innerHTML = `
    <span class="fab-count">${count} item${count > 1 ? 's' : ''} selected</span>
    <div class="fab-actions">
      <button class="btn btn-sm btn-secondary" onclick="openCreateAssemblyModal()">Create Assembly</button>
      <button class="btn btn-sm btn-secondary" onclick="duplicateSelectedLines()">Duplicate</button>
      <button class="btn btn-sm btn-danger" onclick="deleteSelectedLines()">Delete</button>
    </div>
    <button class="fab-close" onclick="clearLineSelection()">&times;</button>
  `;

  bar.classList.add('visible');
}

function clearLineSelection() {
  selectedLineIds.clear();
  document.querySelectorAll('.line-select-checkbox').forEach(cb => cb.checked = false);
  updateSelectAllHeader(['draft', 'rejected'].includes(currentEstimate?.status));
  updateCreateAssemblyButton();
  updateFloatingActionBar();
}

async function duplicateSelectedLines() {
  if (selectedLineIds.size === 0 || !currentEstimate) return;

  try {
    const linesToDuplicate = currentEstimate.lines.filter(l => selectedLineIds.has(l.id));

    for (const line of linesToDuplicate) {
      await fetch(`/api/estimates/${currentEstimate.id}/lines`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cost_code_id: line.cost_code_id,
          description: line.description,
          quantity: line.quantity,
          unit: line.unit,
          unit_cost: line.unit_cost,
          amount: line.amount,
          notes: line.notes,
          created_by: 'User'
        })
      });
    }

    showToast(`Duplicated ${linesToDuplicate.length} line item${linesToDuplicate.length > 1 ? 's' : ''}`, 'success');
    selectedLineIds.clear();
    await openEstimateDetail(currentEstimate.id);
  } catch (err) {
    console.error('Error duplicating lines:', err);
    showToast('Failed to duplicate some items', 'error');
  }
}

// ============================================================
// FEATURE DISCOVERY TOOLTIPS
// ============================================================

function showDiscoveryTooltip(tooltipId) {
  // Only show once per tooltip
  if (discoveryTooltipsShown[tooltipId]) return;

  const tooltips = {
    'inline-edit': {
      message: 'Click any cell to edit inline',
      target: '.editable-cell',
      position: 'top'
    },
    'drag-drop': {
      message: 'Drag the handle to reorder',
      target: '.drag-handle',
      position: 'left'
    },
    'quick-add': {
      message: 'Type to quickly add items',
      target: '.quick-add-input',
      position: 'top'
    },
    'keyboard': {
      message: 'Press Ctrl+K for quick commands',
      target: null,
      position: 'center'
    }
  };

  const tooltip = tooltips[tooltipId];
  if (!tooltip) return;

  const targetEl = tooltip.target ? document.querySelector(tooltip.target) : null;

  // Don't show if target doesn't exist
  if (tooltip.target && !targetEl) return;

  // Create tooltip element
  const el = document.createElement('div');
  el.className = `discovery-tooltip discovery-tooltip-${tooltip.position}`;
  el.innerHTML = `
    <span class="discovery-tooltip-icon">💡</span>
    <span class="discovery-tooltip-message">${tooltip.message}</span>
    <button class="discovery-tooltip-dismiss" onclick="dismissDiscoveryTooltip('${tooltipId}', this.parentElement)">Got it</button>
  `;

  // Position tooltip
  if (targetEl) {
    const rect = targetEl.getBoundingClientRect();
    el.style.position = 'fixed';

    if (tooltip.position === 'top') {
      el.style.top = `${rect.top - 50}px`;
      el.style.left = `${rect.left + rect.width / 2}px`;
      el.style.transform = 'translateX(-50%)';
    } else if (tooltip.position === 'left') {
      el.style.top = `${rect.top + rect.height / 2}px`;
      el.style.left = `${rect.right + 10}px`;
      el.style.transform = 'translateY(-50%)';
    }
  } else {
    // Center in modal
    el.style.position = 'fixed';
    el.style.top = '50%';
    el.style.left = '50%';
    el.style.transform = 'translate(-50%, -50%)';
  }

  document.body.appendChild(el);

  // Auto-dismiss after 5 seconds
  setTimeout(() => {
    if (el.parentElement) {
      dismissDiscoveryTooltip(tooltipId, el);
    }
  }, 5000);
}

function dismissDiscoveryTooltip(tooltipId, element) {
  discoveryTooltipsShown[tooltipId] = true;
  localStorage.setItem('discoveryTooltipsShown', JSON.stringify(discoveryTooltipsShown));

  if (element) {
    element.classList.add('dismissing');
    setTimeout(() => element.remove(), 300);
  }
}

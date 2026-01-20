/**
 * Budget Builder
 * Smart budget assembly from AI estimates, bids, and manual entries
 */

let currentJobId = null;
let comparisonData = null;
let aiEstimate = null;

// ============================================================
// INITIALIZATION
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
  // Listen for job selection changes from the sidebar
  if (window.JobSidebar) {
    window.JobSidebar.onJobChange(async (jobId) => {
      currentJobId = jobId || null;
      if (jobId) {
        await loadJobBudgetForJob(jobId);
      } else {
        comparisonData = null;
        renderEmptyState();
      }
    });
  }

  // Setup event listeners
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeSourceModal();
    }
  });
});

// ============================================================
// DATA LOADING
// ============================================================

// Job selection is handled by the sidebar (sidebar.js)

async function loadJobBudgetForJob(jobId) {
  if (!jobId) {
    currentJobId = null;
    comparisonData = null;
    renderEmptyState();
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

    renderStats();
    renderCoverageBar();
    renderComparisonTable();

    // Show/hide AI estimate banner
    const noAiEstimate = document.getElementById('noAiEstimate');
    if (!aiEstimate) {
      noAiEstimate.style.display = 'block';
    } else {
      noAiEstimate.style.display = 'none';
    }

    // URL is now managed by sidebar.js via ?job= parameter

  } catch (err) {
    console.error('Error loading job budget:', err);
    showToast('Failed to load budget data', 'error');
  }
}

// ============================================================
// RENDERING
// ============================================================

function renderEmptyState() {
  document.getElementById('comparisonBody').innerHTML = `
    <tr>
      <td colspan="7" style="text-align: center; padding: 40px;">
        Select a job to view budget comparison
      </td>
    </tr>
  `;
  document.getElementById('noAiEstimate').style.display = 'none';
}

function renderStats() {
  if (!comparisonData) return;

  const { totals, coverage } = comparisonData;

  document.getElementById('statTotal').textContent = formatCurrency(totals.budget);
  document.getElementById('statFromBids').textContent = `${coverage.from_bids_pct}%`;
  document.getElementById('statFromAI').textContent = `${coverage.from_ai_pct}%`;
  document.getElementById('statGaps').textContent = totals.gaps;
}

function renderCoverageBar() {
  if (!comparisonData) return;

  const { coverage } = comparisonData;

  document.getElementById('coverageBids').style.width = `${coverage.from_bids_pct}%`;
  document.getElementById('coverageBids').textContent = coverage.from_bids_pct > 10 ? `${coverage.from_bids_pct}%` : '';

  document.getElementById('coverageEstimates').style.width = `${coverage.from_estimates_pct}%`;
  document.getElementById('coverageEstimates').textContent = coverage.from_estimates_pct > 10 ? `${coverage.from_estimates_pct}%` : '';

  document.getElementById('coverageAI').style.width = `${coverage.from_ai_pct}%`;
  document.getElementById('coverageAI').textContent = coverage.from_ai_pct > 10 ? `${coverage.from_ai_pct}%` : '';

  document.getElementById('coverageManual').style.width = `${coverage.from_manual_pct}%`;
  document.getElementById('coverageManual').textContent = coverage.from_manual_pct > 10 ? `${coverage.from_manual_pct}%` : '';
}

function renderComparisonTable() {
  if (!comparisonData) return;

  const filter = document.getElementById('filterView').value;
  const search = document.getElementById('searchCostCode').value.toLowerCase();

  let rows = comparisonData.comparison;

  // Apply filters
  if (filter === 'with-budget') {
    rows = rows.filter(r => r.budget);
  } else if (filter === 'gaps') {
    rows = rows.filter(r => !r.budget && !r.ai_estimate && r.bids.length === 0);
  } else if (filter === 'from-bids') {
    rows = rows.filter(r => r.budget?.source_type === 'accepted_bid');
  } else if (filter === 'from-ai') {
    rows = rows.filter(r => r.budget?.source_type === 'ai_estimate');
  }

  // Apply search
  if (search) {
    rows = rows.filter(r =>
      r.cost_code.code.toLowerCase().includes(search) ||
      r.cost_code.name.toLowerCase().includes(search)
    );
  }

  const tbody = document.getElementById('comparisonBody');

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
    const bids = row.bids;
    const estimates = row.estimates;

    // AI estimate cell
    let aiCell = '<span class="amount-cell secondary">—</span>';
    if (ai) {
      const confidenceClass = ai.confidence >= 0.8 ? 'high' : ai.confidence >= 0.5 ? 'medium' : 'low';
      aiCell = `
        <span class="amount-cell secondary">${formatCurrency(ai.amount)}</span>
        <div class="confidence-bar" title="${(ai.confidence * 100).toFixed(0)}% confidence">
          <div class="confidence-bar-fill ${confidenceClass}" style="width: ${ai.confidence * 100}%"></div>
        </div>
      `;
    }

    // Bids cell
    let bidsCell = '<span class="amount-cell secondary">—</span>';
    if (bids.length > 0) {
      if (bids.length === 1) {
        bidsCell = `<span class="amount-cell ${budget?.source_type === 'accepted_bid' ? 'highlight' : 'secondary'}">${formatCurrency(bids[0].amount)}</span>`;
        if (bids[0].vendor_name) {
          bidsCell += `<br><small class="text-muted">${escapeHtml(bids[0].vendor_name)}</small>`;
        }
      } else {
        bidsCell = `<div class="bid-options">`;
        bids.forEach(bid => {
          bidsCell += `
            <div class="bid-option">
              <span class="bid-option-vendor">${escapeHtml(bid.vendor_name || 'Unknown')}</span>
              <span class="bid-option-amount">${formatCurrency(bid.amount)}</span>
            </div>
          `;
        });
        bidsCell += `</div>`;
      }
    }

    // Estimates cell
    let estimatesCell = '<span class="amount-cell secondary">—</span>';
    if (estimates.length > 0) {
      const total = estimates.reduce((sum, e) => sum + e.amount, 0);
      estimatesCell = `<span class="amount-cell secondary">${formatCurrency(total)}</span>`;
    }

    // Budget cell
    let budgetCell = '<span class="amount-cell secondary">—</span>';
    if (budget) {
      budgetCell = `<span class="amount-cell primary">${formatCurrency(budget.amount)}</span>`;
    }

    // Source badge
    let sourceBadge = '<span class="source-badge none">None</span>';
    if (budget) {
      const sourceType = budget.source_type || 'manual';
      const sourceClass = sourceType === 'accepted_bid' ? 'bid' :
                          sourceType === 'ai_estimate' ? 'ai' :
                          sourceType === 'estimate' ? 'estimate' : 'manual';
      const sourceLabel = sourceType === 'accepted_bid' ? 'Bid' :
                          sourceType === 'ai_estimate' ? 'AI' :
                          sourceType === 'estimate' ? 'Est' : 'Manual';
      sourceBadge = `<span class="source-badge ${sourceClass}" onclick="openSourceModal('${cc.id}')">${sourceLabel}</span>`;
    } else {
      sourceBadge = `<span class="source-badge none" onclick="openSourceModal('${cc.id}')">Set</span>`;
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
        <td>${estimatesCell}</td>
        <td>${budgetCell}</td>
        <td>${sourceBadge}</td>
        <td>${lockBtn}</td>
      </tr>
    `;
  }).join('');
}

function applyFilter() {
  renderComparisonTable();
}

// ============================================================
// ACTIONS
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
      body: JSON.stringify({ generated_by: 'User' })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to generate AI estimate');
    }

    const result = await response.json();
    showToast(`AI estimate generated with ${result.estimate.lines?.length || 0} line items`, 'success');

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
      body: JSON.stringify({ performed_by: 'User', include_ai: true })
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
    showToast(`Pricing updated for ${result.results.length} cost codes`, 'success');
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

  // Open the regular budget page with export
  window.open(`/budgets.html?job_id=${currentJobId}`, '_blank');
}

// ============================================================
// SOURCE MODAL
// ============================================================

let currentSourceCostCodeId = null;

function openSourceModal(costCodeId) {
  currentSourceCostCodeId = costCodeId;

  // Find the row data
  const row = comparisonData?.comparison.find(r => r.cost_code.id === costCodeId);
  if (!row) return;

  const cc = row.cost_code;
  document.getElementById('sourceModalCostCode').textContent = `${cc.code} - ${cc.name}`;

  // Build options
  const select = document.getElementById('sourceModalSelect');
  select.innerHTML = '<option value="manual">Manual Entry</option>';

  if (row.ai_estimate) {
    select.innerHTML += `<option value="ai_estimate" data-amount="${row.ai_estimate.amount}">AI Estimate (${formatCurrency(row.ai_estimate.amount)})</option>`;
  }

  row.bids.forEach((bid, i) => {
    select.innerHTML += `<option value="accepted_bid" data-amount="${bid.amount}" data-id="${bid.bid_id}">Bid: ${bid.vendor_name || 'Unknown'} (${formatCurrency(bid.amount)})</option>`;
  });

  row.estimates.forEach((est, i) => {
    select.innerHTML += `<option value="estimate" data-amount="${est.amount}" data-id="${est.estimate_id}">Estimate (${formatCurrency(est.amount)})</option>`;
  });

  // Set current values
  if (row.budget) {
    const sourceType = row.budget.source_type || 'manual';
    // Try to find matching option
    for (let i = 0; i < select.options.length; i++) {
      if (select.options[i].value === sourceType) {
        select.selectedIndex = i;
        break;
      }
    }
    document.getElementById('sourceModalAmount').value = row.budget.amount || '';
    document.getElementById('sourceModalLock').checked = row.budget.locked || false;
  } else {
    select.selectedIndex = 0;
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

function formatCurrency(amount) {
  if (amount == null) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

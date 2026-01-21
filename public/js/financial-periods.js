/**
 * Financial Periods Page
 * Period management with open/close/lock functionality
 */

// State
let periods = [];
let currentPeriod = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
  setupEventListeners();
  await loadPeriods();
});

// Event Listeners
function setupEventListeners() {
  // Filters
  document.getElementById('statusFilter').addEventListener('change', applyFilters);
  document.getElementById('yearFilter').addEventListener('change', applyFilters);

  // Search
  const searchInput = document.getElementById('searchInput');
  const searchClear = document.getElementById('searchClear');

  let debounceTimer;
  searchInput.addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      searchClear.style.display = e.target.value ? 'block' : 'none';
      renderPeriodList();
    }, 150);
  });

  // Period type auto-fill dates
  document.getElementById('periodType').addEventListener('change', autoFillDates);

  // Close modals on outside click
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal();
        closeDetailModal();
      }
    });
  });

  // Escape key closes modals
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal();
      closeDetailModal();
    }
  });
}

// Load periods from API
async function loadPeriods() {
  try {
    const params = new URLSearchParams();
    const status = document.getElementById('statusFilter').value;
    const year = document.getElementById('yearFilter').value;

    if (status) params.append('status', status);
    if (year) params.append('year', year);

    const response = await fetch(`/api/financial-periods?${params}`);
    if (!response.ok) throw new Error('Failed to load periods');

    periods = await response.json();
    updateStats();
    renderPeriodList();
  } catch (err) {
    console.error('Error loading periods:', err);
    showToast('Failed to load periods', 'error');
  }
}

// Update stats bar
function updateStats() {
  const total = periods.length;
  const open = periods.filter(p => p.status === 'open').length;
  const closed = periods.filter(p => p.status === 'closed').length;
  const totalExpenses = periods.reduce((sum, p) => sum + (parseFloat(p.total_expenses) || 0), 0);

  document.getElementById('statTotal').textContent = total;
  document.getElementById('statOpen').textContent = open;
  document.getElementById('statClosed').textContent = closed;
  document.getElementById('statTotalExpenses').textContent = formatCurrency(totalExpenses);
}

// Apply filters (triggers reload)
function applyFilters() {
  loadPeriods();
}

// Render period list
function renderPeriodList() {
  const container = document.getElementById('periodList');
  const searchTerm = document.getElementById('searchInput').value.toLowerCase();

  let filtered = periods;
  if (searchTerm) {
    filtered = periods.filter(p =>
      p.name.toLowerCase().includes(searchTerm)
    );
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📅</div>
        <h3>No periods found</h3>
        <p>Create a new financial period to get started.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(period => `
    <div class="period-card ${period.status}" onclick="openDetailModal('${period.id}')">
      <div class="period-header">
        <div class="period-name">${escapeHtml(period.name)}</div>
        <span class="status-badge status-${period.status}">${period.status}</span>
      </div>
      <div class="period-info">
        <span class="period-dates">
          ${formatDate(period.start_date)} - ${formatDate(period.end_date)}
        </span>
        <span class="period-type">${period.period_type}</span>
      </div>
      <div class="period-stats">
        <span class="expense-count">${period.expense_count || 0} expenses</span>
        <span class="expense-total">${formatCurrency(period.total_expenses || 0)}</span>
      </div>
      ${period.is_locked ? '<div class="lock-indicator">🔒 Locked</div>' : ''}
    </div>
  `).join('');
}

// Open create modal
function openCreateModal() {
  currentPeriod = null;
  document.getElementById('modalTitle').textContent = 'Create Financial Period';
  document.getElementById('periodForm').reset();
  document.getElementById('periodId').value = '';

  // Set default dates for current month
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  document.getElementById('startDate').value = formatDateInput(firstDay);
  document.getElementById('endDate').value = formatDateInput(lastDay);
  document.getElementById('periodName').value = formatMonthName(now);

  const modal = document.getElementById('periodModal');
  modal.style.display = 'flex';
  modal.classList.add('show');
}

// Close create/edit modal
function closeModal() {
  const modal = document.getElementById('periodModal');
  modal.classList.remove('show');
  modal.style.display = 'none';
}

// Open detail modal
async function openDetailModal(periodId) {
  try {
    const response = await fetch(`/api/financial-periods/${periodId}`);
    if (!response.ok) throw new Error('Failed to load period');

    currentPeriod = await response.json();

    document.getElementById('detailTitle').textContent = currentPeriod.name;
    document.getElementById('detailBadges').innerHTML = `
      <span class="status-badge status-${currentPeriod.status}">${currentPeriod.status}</span>
      ${currentPeriod.is_locked ? '<span class="status-badge status-locked">🔒 Locked</span>' : ''}
    `;

    document.getElementById('detailBody').innerHTML = `
      <div class="detail-section">
        <h3>Period Information</h3>
        <div class="detail-grid">
          <div class="detail-item">
            <label>Period Type</label>
            <span>${currentPeriod.period_type}</span>
          </div>
          <div class="detail-item">
            <label>Date Range</label>
            <span>${formatDate(currentPeriod.start_date)} - ${formatDate(currentPeriod.end_date)}</span>
          </div>
          <div class="detail-item">
            <label>Total Expenses</label>
            <span>${formatCurrency(currentPeriod.total_expenses || 0)}</span>
          </div>
          <div class="detail-item">
            <label>Expense Count</label>
            <span>${currentPeriod.expense_count || 0}</span>
          </div>
        </div>
      </div>

      <div class="detail-section">
        <h3>Audit Trail</h3>
        <div class="detail-grid">
          <div class="detail-item">
            <label>Created</label>
            <span>${formatDateTime(currentPeriod.created_at)} by ${currentPeriod.created_by || 'system'}</span>
          </div>
          ${currentPeriod.closed_at ? `
            <div class="detail-item">
              <label>Closed</label>
              <span>${formatDateTime(currentPeriod.closed_at)} by ${currentPeriod.closed_by || 'system'}</span>
            </div>
          ` : ''}
        </div>
      </div>

      ${currentPeriod.activity && currentPeriod.activity.length > 0 ? `
        <div class="detail-section">
          <h3>Activity History</h3>
          <div class="activity-list">
            ${currentPeriod.activity.slice(0, 10).map(a => `
              <div class="activity-item">
                <span class="activity-action">${a.action}</span>
                <span class="activity-by">${a.performed_by}</span>
                <span class="activity-date">${formatDateTime(a.created_at)}</span>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
    `;

    // Footer actions
    let actions = '';
    if (currentPeriod.status === 'open') {
      actions = `
        <button class="btn btn-secondary" onclick="editPeriod()">Edit</button>
        <button class="btn btn-warning" onclick="closePeriod()">Close & Lock Period</button>
      `;
    } else {
      actions = `
        <button class="btn btn-primary" onclick="reopenPeriod()">Reopen Period</button>
      `;
    }
    actions += `<button class="btn btn-link" onclick="viewExpenses()">View Expenses</button>`;
    document.getElementById('detailFooter').innerHTML = actions;

    const modal = document.getElementById('detailModal');
    modal.style.display = 'flex';
    modal.classList.add('show');
  } catch (err) {
    console.error('Error loading period:', err);
    showToast('Failed to load period details', 'error');
  }
}

// Close detail modal
function closeDetailModal() {
  const modal = document.getElementById('detailModal');
  modal.classList.remove('show');
  modal.style.display = 'none';
}

// Save period (create/update)
async function savePeriod() {
  const id = document.getElementById('periodId').value;
  const data = {
    name: document.getElementById('periodName').value,
    period_type: document.getElementById('periodType').value,
    start_date: document.getElementById('startDate').value,
    end_date: document.getElementById('endDate').value,
    created_by: 'Jake Ross'
  };

  if (!data.name || !data.start_date || !data.end_date) {
    showToast('Please fill in all required fields', 'error');
    return;
  }

  try {
    const url = id ? `/api/financial-periods/${id}` : '/api/financial-periods';
    const method = id ? 'PATCH' : 'POST';

    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to save period');
    }

    showToast(id ? 'Period updated' : 'Period created', 'success');
    closeModal();
    await loadPeriods();
  } catch (err) {
    console.error('Error saving period:', err);
    showToast(err.message, 'error');
  }
}

// Edit period
function editPeriod() {
  if (!currentPeriod) return;

  document.getElementById('modalTitle').textContent = 'Edit Period';
  document.getElementById('periodId').value = currentPeriod.id;
  document.getElementById('periodName').value = currentPeriod.name;
  document.getElementById('periodType').value = currentPeriod.period_type;
  document.getElementById('startDate').value = currentPeriod.start_date;
  document.getElementById('endDate').value = currentPeriod.end_date;

  closeDetailModal();

  const modal = document.getElementById('periodModal');
  modal.style.display = 'flex';
  modal.classList.add('show');
}

// Close period
async function closePeriod() {
  if (!currentPeriod) return;

  if (!confirm(`Close and lock "${currentPeriod.name}"?\n\nThis will prevent any expense modifications for this period.`)) {
    return;
  }

  try {
    const response = await fetch(`/api/financial-periods/${currentPeriod.id}/close`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ closed_by: 'Jake Ross' })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to close period');
    }

    showToast('Period closed and locked', 'success');
    closeDetailModal();
    await loadPeriods();
  } catch (err) {
    console.error('Error closing period:', err);
    showToast(err.message, 'error');
  }
}

// Reopen period
async function reopenPeriod() {
  if (!currentPeriod) return;

  if (!confirm(`Reopen "${currentPeriod.name}"?\n\nThis will allow expense modifications again.`)) {
    return;
  }

  try {
    const response = await fetch(`/api/financial-periods/${currentPeriod.id}/reopen`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reopened_by: 'Jake Ross' })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to reopen period');
    }

    showToast('Period reopened', 'success');
    closeDetailModal();
    await loadPeriods();
  } catch (err) {
    console.error('Error reopening period:', err);
    showToast(err.message, 'error');
  }
}

// View expenses for period
function viewExpenses() {
  if (!currentPeriod) return;
  window.location.href = `/expenses.html?period_id=${currentPeriod.id}`;
}

// Auto-fill dates based on period type
function autoFillDates() {
  const type = document.getElementById('periodType').value;
  const now = new Date();
  let start, end, name;

  switch (type) {
    case 'monthly':
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      name = formatMonthName(now);
      break;
    case 'quarterly':
      const quarter = Math.floor(now.getMonth() / 3);
      start = new Date(now.getFullYear(), quarter * 3, 1);
      end = new Date(now.getFullYear(), quarter * 3 + 3, 0);
      name = `Q${quarter + 1} ${now.getFullYear()}`;
      break;
    case 'annual':
      start = new Date(now.getFullYear(), 0, 1);
      end = new Date(now.getFullYear(), 11, 31);
      name = `Year ${now.getFullYear()}`;
      break;
    default:
      return; // Custom - don't auto-fill
  }

  document.getElementById('startDate').value = formatDateInput(start);
  document.getElementById('endDate').value = formatDateInput(end);
  document.getElementById('periodName').value = name;
}

// Clear search
function clearSearch() {
  document.getElementById('searchInput').value = '';
  document.getElementById('searchClear').style.display = 'none';
  renderPeriodList();
}

// Utility functions
function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit'
  });
}

function formatDateInput(date) {
  return date.toISOString().split('T')[0];
}

function formatMonthName(date) {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

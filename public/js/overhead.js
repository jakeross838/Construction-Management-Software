/**
 * Overhead Allocation Dashboard JavaScript
 * Cost pool configuration and overhead rate visualization
 */

// State
let dashboardData = {};
let costPools = [];
let expenseCategories = [];
let closedPeriods = [];
let rateTrendChart = null;

// ============================================================
// INITIALIZATION
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
  await Promise.all([
    loadDashboard(),
    loadExpenseCategories(),
    loadClosedPeriods()
  ]);
});

// ============================================================
// DATA LOADING
// ============================================================

async function loadDashboard() {
  try {
    const response = await fetch('/api/overhead/dashboard');
    if (!response.ok) throw new Error('Failed to load dashboard');
    dashboardData = await response.json();

    renderCurrentRate();
    renderRateHistory();
    renderTopJobs();
    renderRateTrendChart();
  } catch (err) {
    console.error('Error loading dashboard:', err);
    showToast('Failed to load dashboard data', 'error');
  }
}

async function loadCostPools() {
  try {
    const response = await fetch('/api/overhead/cost-pools');
    if (!response.ok) throw new Error('Failed to load cost pools');
    costPools = await response.json();
    renderCostPoolsTable();
  } catch (err) {
    console.error('Error loading cost pools:', err);
  }
}

async function loadExpenseCategories() {
  try {
    const response = await fetch('/api/expenses/categories');
    if (!response.ok) throw new Error('Failed to load categories');
    expenseCategories = await response.json();
  } catch (err) {
    console.error('Error loading categories:', err);
  }
}

async function loadClosedPeriods() {
  try {
    const response = await fetch('/api/financial-periods?status=closed');
    if (!response.ok) throw new Error('Failed to load periods');
    closedPeriods = await response.json();
    populatePeriodSelect();
  } catch (err) {
    console.error('Error loading periods:', err);
  }
}

async function loadSettings() {
  try {
    const response = await fetch('/api/overhead/settings');
    if (!response.ok) throw new Error('Failed to load settings');
    const settings = await response.json();

    document.getElementById('settingMethod').value = settings.overhead_allocation_method || 'labor_hours';
    document.getElementById('settingRolling').checked = settings.overhead_use_rolling_average !== false;
    document.getElementById('settingMonths').value = settings.overhead_rolling_months || 12;
    document.getElementById('settingIncludeOT').checked = settings.overhead_include_ot !== false;
    document.getElementById('settingAutoAllocate').checked = settings.overhead_auto_allocate !== false;
  } catch (err) {
    console.error('Error loading settings:', err);
  }
}

// ============================================================
// RENDERING
// ============================================================

function renderCurrentRate() {
  const rate = dashboardData.current_rate || {};

  document.getElementById('currentRatePerHour').textContent =
    formatCurrency(rate.current_rate_per_hour || 0) + '/hr';
  document.getElementById('currentRatePercent').textContent =
    formatPercent(rate.current_rate_percent || 0) + ' of labor';
  document.getElementById('currentPeriod').textContent =
    rate.period_name || 'No closed periods';

  document.getElementById('rollingRatePerHour').textContent =
    formatCurrency(rate.rolling_avg_rate_per_hour || 0) + '/hr';
  document.getElementById('rollingRatePercent').textContent =
    formatPercent(rate.rolling_avg_rate_percent || 0) + ' of labor';
  document.getElementById('rollingPeriods').textContent =
    (rate.rolling_periods_count || 0) + ' periods';

  document.getElementById('totalOverhead').textContent =
    formatCurrency(rate.current_overhead || 0);
  document.getElementById('totalLaborHours').textContent =
    (rate.current_labor_hours || 0).toFixed(1) + ' labor hours';

  document.getElementById('costPoolCount').textContent =
    (dashboardData.cost_pools || []).length;
}

function renderRateHistory() {
  const tbody = document.getElementById('rateHistoryTable');
  const history = dashboardData.rate_history || [];

  if (history.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="empty-cell">No rate history</td></tr>';
    return;
  }

  tbody.innerHTML = history.map(h => `
    <tr>
      <td>${h.period?.name || '-'}</td>
      <td>${formatCurrency(h.overhead_rate_per_hour)}/hr</td>
      <td>${formatPercent(h.overhead_rate_percent)}</td>
      <td>${formatCurrency(h.total_overhead)}</td>
    </tr>
  `).join('');
}

function renderTopJobs() {
  const tbody = document.getElementById('topJobsTable');
  const jobs = dashboardData.top_jobs || [];

  if (jobs.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" class="empty-cell">No allocations yet</td></tr>';
    return;
  }

  tbody.innerHTML = jobs.map(j => `
    <tr>
      <td>${j.job_name}</td>
      <td>${(j.total_labor_hours || 0).toFixed(1)}</td>
      <td>${formatCurrency(j.total_allocated_overhead)}</td>
    </tr>
  `).join('');
}

function renderRateTrendChart() {
  const history = (dashboardData.rate_history || []).slice().reverse();

  if (history.length === 0) return;

  const ctx = document.getElementById('rateTrendChart').getContext('2d');

  if (rateTrendChart) {
    rateTrendChart.destroy();
  }

  rateTrendChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: history.map(h => h.period?.name || 'Unknown'),
      datasets: [{
        label: 'Overhead Rate ($/hr)',
        data: history.map(h => h.overhead_rate_per_hour),
        borderColor: 'rgba(59, 130, 246, 1)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: value => '$' + value.toFixed(2)
          },
          grid: {
            color: 'rgba(255, 255, 255, 0.1)'
          }
        },
        x: {
          grid: {
            color: 'rgba(255, 255, 255, 0.1)'
          }
        }
      }
    }
  });
}

function renderCostPoolsTable() {
  const tbody = document.getElementById('costPoolsTable');

  if (costPools.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-cell">No cost pools configured</td></tr>';
    return;
  }

  tbody.innerHTML = costPools.map(p => {
    const categoryNames = (p.categories || [])
      .map(c => c.expense_category?.name)
      .filter(Boolean)
      .join(', ');

    return `
      <tr>
        <td><strong>${p.name}</strong></td>
        <td>${p.allocation_method === 'labor_hours' ? '% of Labor Hours' : p.allocation_method}</td>
        <td>${categoryNames || '<em>No categories</em>'}</td>
        <td><span class="status-badge ${p.is_active ? 'status-active' : 'status-inactive'}">${p.is_active ? 'Active' : 'Inactive'}</span></td>
        <td class="actions-cell">
          <button class="btn btn-sm btn-secondary" onclick="editPool('${p.id}')">Edit</button>
          <button class="btn btn-sm btn-danger" onclick="deletePool('${p.id}')">Delete</button>
        </td>
      </tr>
    `;
  }).join('');
}

function populatePeriodSelect() {
  const select = document.getElementById('allocationPeriod');
  select.innerHTML = '<option value="">-- Select Period --</option>' +
    closedPeriods.map(p =>
      `<option value="${p.id}">${p.name}</option>`
    ).join('');
}

// ============================================================
// COST POOLS MODAL
// ============================================================

function openCostPoolsModal() {
  loadCostPools();
  openModal('costPoolsModal');
}

function closeCostPoolsModal() {
  closeModal('costPoolsModal');
}

function openCreatePoolModal() {
  document.getElementById('poolModalTitle').textContent = 'Add Cost Pool';
  document.getElementById('poolForm').reset();
  document.getElementById('poolId').value = '';
  renderCategoryCheckboxes([]);
  openModal('poolModal');
}

function editPool(id) {
  const pool = costPools.find(p => p.id === id);
  if (!pool) return;

  document.getElementById('poolModalTitle').textContent = 'Edit Cost Pool';
  document.getElementById('poolId').value = pool.id;
  document.getElementById('poolName').value = pool.name;
  document.getElementById('poolDescription').value = pool.description || '';
  document.getElementById('poolMethod').value = pool.allocation_method;

  const selectedIds = (pool.categories || []).map(c => c.expense_category?.id).filter(Boolean);
  renderCategoryCheckboxes(selectedIds);

  openModal('poolModal');
}

function renderCategoryCheckboxes(selectedIds = []) {
  const container = document.getElementById('categoryCheckboxes');
  container.innerHTML = expenseCategories.map(cat =>
    `<label class="checkbox-label">
      <input type="checkbox" name="category" value="${cat.id}" ${selectedIds.includes(cat.id) ? 'checked' : ''}>
      ${cat.name}
    </label>`
  ).join('');
}

async function savePool(event) {
  event.preventDefault();

  const id = document.getElementById('poolId').value;
  const categoryCheckboxes = document.querySelectorAll('input[name="category"]:checked');
  const categoryIds = Array.from(categoryCheckboxes).map(cb => cb.value);

  const data = {
    name: document.getElementById('poolName').value,
    description: document.getElementById('poolDescription').value || null,
    allocation_method: document.getElementById('poolMethod').value,
    category_ids: categoryIds
  };

  try {
    const url = id ? `/api/overhead/cost-pools/${id}` : '/api/overhead/cost-pools';
    const method = id ? 'PATCH' : 'POST';

    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to save pool');
    }

    showToast(`Cost pool ${id ? 'updated' : 'created'}`, 'success');
    closePoolModal();
    await loadCostPools();
    await loadDashboard();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deletePool(id) {
  if (!confirm('Delete this cost pool?')) return;

  try {
    const response = await fetch(`/api/overhead/cost-pools/${id}`, {
      method: 'DELETE'
    });

    if (!response.ok) throw new Error('Failed to delete pool');

    showToast('Cost pool deleted', 'success');
    await loadCostPools();
    await loadDashboard();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function closePoolModal() {
  closeModal('poolModal');
}

// ============================================================
// RUN ALLOCATION MODAL
// ============================================================

function openRunAllocationModal() {
  document.getElementById('allocationPeriod').value = '';
  document.getElementById('allocationPreview').style.display = 'none';
  document.getElementById('runAllocationBtn').disabled = true;
  openModal('runAllocationModal');
}

function closeRunAllocationModal() {
  closeModal('runAllocationModal');
}

async function previewAllocation() {
  const periodId = document.getElementById('allocationPeriod').value;
  const preview = document.getElementById('allocationPreview');
  const runBtn = document.getElementById('runAllocationBtn');

  if (!periodId) {
    preview.style.display = 'none';
    runBtn.disabled = true;
    return;
  }

  try {
    const response = await fetch('/api/overhead/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ period_id: periodId })
    });

    if (!response.ok) throw new Error('Failed to calculate');

    const data = await response.json();

    document.getElementById('previewOverhead').textContent = formatCurrency(data.total_overhead);
    document.getElementById('previewHours').textContent = (data.total_labor_hours || 0).toFixed(1);
    document.getElementById('previewRate').textContent = formatCurrency(data.rate_per_hour) + '/hr';

    preview.style.display = 'block';
    runBtn.disabled = false;
  } catch (err) {
    showToast(err.message, 'error');
    preview.style.display = 'none';
    runBtn.disabled = true;
  }
}

async function runAllocation() {
  const periodId = document.getElementById('allocationPeriod').value;
  if (!periodId) return;

  try {
    const response = await fetch('/api/overhead/run-allocation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ period_id: periodId })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to run allocation');
    }

    const result = await response.json();
    showToast(`Allocated overhead to ${result.jobs_allocated} jobs`, 'success');
    closeRunAllocationModal();
    await loadDashboard();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ============================================================
// SETTINGS MODAL
// ============================================================

function openSettingsModal() {
  loadSettings();
  openModal('settingsModal');
}

function closeSettingsModal() {
  closeModal('settingsModal');
}

async function saveSettings(event) {
  event.preventDefault();

  const settings = {
    overhead_allocation_method: document.getElementById('settingMethod').value,
    overhead_use_rolling_average: document.getElementById('settingRolling').checked,
    overhead_rolling_months: parseInt(document.getElementById('settingMonths').value),
    overhead_include_ot: document.getElementById('settingIncludeOT').checked,
    overhead_auto_allocate: document.getElementById('settingAutoAllocate').checked
  };

  try {
    for (const [key, value] of Object.entries(settings)) {
      await fetch(`/api/overhead/settings/${key}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value })
      });
    }

    showToast('Settings saved', 'success');
    closeSettingsModal();
  } catch (err) {
    showToast('Failed to save settings', 'error');
  }
}

// ============================================================
// MODAL HELPERS
// ============================================================

function openModal(id) {
  const modal = document.getElementById(id);
  modal.style.display = 'flex';
  modal.classList.add('show');
}

function closeModal(id) {
  const modal = document.getElementById(id);
  modal.classList.remove('show');
  modal.style.display = 'none';
}

// ============================================================
// FORMATTING HELPERS
// ============================================================

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount || 0);
}

function formatPercent(value) {
  return ((value || 0) * 100).toFixed(2) + '%';
}

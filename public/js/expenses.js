/**
 * Expenses Page
 * Non-invoice expense tracking with filtering
 */

// State
let expenses = [];
let categories = [];
let vendors = [];
let periods = [];
let currentExpense = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
  setupEventListeners();

  // Parse URL params for initial filter
  const urlParams = new URLSearchParams(window.location.search);
  const periodId = urlParams.get('period_id');
  if (periodId) {
    document.getElementById('periodFilter').value = periodId;
  }

  // Load reference data in parallel
  await Promise.all([
    loadCategories().catch(err => console.error('Categories failed:', err)),
    loadVendors().catch(err => console.error('Vendors failed:', err)),
    loadPeriods().catch(err => console.error('Periods failed:', err))
  ]);

  // Load expenses
  await loadExpenses();
});

// Event Listeners
function setupEventListeners() {
  // Filters
  document.getElementById('periodFilter').addEventListener('change', applyFilters);
  document.getElementById('categoryFilter').addEventListener('change', applyFilters);
  document.getElementById('overheadTypeFilter').addEventListener('change', applyFilters);
  document.getElementById('vendorFilter').addEventListener('change', applyFilters);

  // Search
  const searchInput = document.getElementById('searchInput');
  const searchClear = document.getElementById('searchClear');

  let debounceTimer;
  searchInput.addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      searchClear.style.display = e.target.value ? 'block' : 'none';
      renderExpenseList();
    }, 150);
  });

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

// Load categories
async function loadCategories() {
  try {
    const response = await fetch('/api/expenses/categories');
    if (!response.ok) throw new Error('Failed to load categories');

    categories = await response.json();
    populateCategoryDropdowns();
  } catch (err) {
    console.error('Error loading categories:', err);
  }
}

// Load vendors
async function loadVendors() {
  try {
    const response = await fetch('/api/vendors');
    if (!response.ok) throw new Error('Failed to load vendors');

    vendors = await response.json();
    populateVendorDropdowns();
  } catch (err) {
    console.error('Error loading vendors:', err);
  }
}

// Load periods
async function loadPeriods() {
  try {
    const response = await fetch('/api/financial-periods');
    if (!response.ok) throw new Error('Failed to load periods');

    periods = await response.json();
    populatePeriodDropdowns();
  } catch (err) {
    console.error('Error loading periods:', err);
  }
}

// Populate category dropdowns
function populateCategoryDropdowns() {
  const filterSelect = document.getElementById('categoryFilter');
  const formSelect = document.getElementById('expenseCategory');

  // Group by overhead type
  const grouped = categories.reduce((acc, cat) => {
    const type = cat.overhead_type || 'other';
    if (!acc[type]) acc[type] = [];
    acc[type].push(cat);
    return acc;
  }, {});

  // Filter dropdown - flat list
  filterSelect.innerHTML = '<option value="">All Categories</option>' +
    categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

  // Form dropdown - grouped by overhead type
  const typeLabels = { office: 'Office', fleet: 'Fleet', equipment: 'Equipment', admin: 'Admin', other: 'Other' };
  let formOptions = '<option value="">Select category...</option>';

  for (const type of Object.keys(typeLabels)) {
    if (grouped[type] && grouped[type].length > 0) {
      formOptions += `<optgroup label="${typeLabels[type]}">`;
      formOptions += grouped[type].map(c =>
        `<option value="${c.id}">${c.name}</option>`
      ).join('');
      formOptions += '</optgroup>';
    }
  }
  formSelect.innerHTML = formOptions;
}

// Populate vendor dropdowns
function populateVendorDropdowns() {
  const filterSelect = document.getElementById('vendorFilter');
  const formSelect = document.getElementById('expenseVendor');

  const options = vendors.map(v => `<option value="${v.id}">${v.name}</option>`).join('');

  filterSelect.innerHTML = '<option value="">All Vendors</option>' + options;
  formSelect.innerHTML = '<option value="">No vendor</option>' + options;
}

// Populate period dropdowns
function populatePeriodDropdowns() {
  const filterSelect = document.getElementById('periodFilter');
  const formSelect = document.getElementById('expensePeriod');

  const openPeriods = periods.filter(p => p.status === 'open');
  const closedPeriods = periods.filter(p => p.status === 'closed');

  // Filter dropdown - all periods
  filterSelect.innerHTML = '<option value="">All Periods</option>' +
    periods.map(p => `<option value="${p.id}">${p.name} (${p.status})</option>`).join('');

  // Form dropdown - only open periods
  let formOptions = '<option value="">Auto-assign by date</option>';
  if (openPeriods.length > 0) {
    formOptions += '<optgroup label="Open Periods">';
    formOptions += openPeriods.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    formOptions += '</optgroup>';
  }
  formSelect.innerHTML = formOptions;

  // Restore URL param selection
  const urlParams = new URLSearchParams(window.location.search);
  const periodId = urlParams.get('period_id');
  if (periodId) {
    filterSelect.value = periodId;
  }
}

// Load expenses
async function loadExpenses() {
  try {
    const params = new URLSearchParams();
    const periodId = document.getElementById('periodFilter').value;
    const categoryId = document.getElementById('categoryFilter').value;
    const overheadType = document.getElementById('overheadTypeFilter').value;
    const vendorId = document.getElementById('vendorFilter').value;

    if (periodId) params.append('period_id', periodId);
    if (categoryId) params.append('category_id', categoryId);
    if (overheadType) params.append('overhead_type', overheadType);
    if (vendorId) params.append('vendor_id', vendorId);

    const response = await fetch(`/api/expenses?${params}`);
    if (!response.ok) throw new Error('Failed to load expenses');

    expenses = await response.json();
    updateStats();
    renderExpenseList();
  } catch (err) {
    console.error('Error loading expenses:', err);
    showToast('Failed to load expenses', 'error');
  }
}

// Update stats bar
function updateStats() {
  const total = expenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);

  const byType = expenses.reduce((acc, e) => {
    const type = e.category?.overhead_type || 'other';
    acc[type] = (acc[type] || 0) + parseFloat(e.amount);
    return acc;
  }, {});

  document.getElementById('statTotal').textContent = formatCurrency(total);
  document.getElementById('statOffice').textContent = formatCurrency(byType.office || 0);
  document.getElementById('statFleet').textContent = formatCurrency(byType.fleet || 0);
  document.getElementById('statEquipment').textContent = formatCurrency(byType.equipment || 0);
  document.getElementById('statAdmin').textContent = formatCurrency(byType.admin || 0);
}

// Apply filters
function applyFilters() {
  loadExpenses();
}

// Render expense list
function renderExpenseList() {
  const container = document.getElementById('expenseList');
  const searchTerm = document.getElementById('searchInput').value.toLowerCase();

  let filtered = expenses;
  if (searchTerm) {
    filtered = expenses.filter(e =>
      (e.description && e.description.toLowerCase().includes(searchTerm)) ||
      (e.category?.name && e.category.name.toLowerCase().includes(searchTerm)) ||
      (e.vendor?.name && e.vendor.name.toLowerCase().includes(searchTerm))
    );
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">💰</div>
        <h3>No expenses found</h3>
        <p>Add a new expense to get started tracking overhead costs.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(expense => `
    <div class="expense-card" onclick="openDetailModal('${expense.id}')">
      <div class="expense-header">
        <div class="expense-amount">${formatCurrency(expense.amount)}</div>
        <span class="overhead-badge overhead-${expense.category?.overhead_type || 'other'}">
          ${expense.category?.overhead_type || 'other'}
        </span>
      </div>
      <div class="expense-info">
        <span class="expense-category">${escapeHtml(expense.category?.name || 'Uncategorized')}</span>
        <span class="expense-date">${formatDate(expense.expense_date)}</span>
      </div>
      ${expense.description ? `<div class="expense-description">${escapeHtml(expense.description)}</div>` : ''}
      <div class="expense-meta">
        ${expense.vendor ? `<span class="expense-vendor">${escapeHtml(expense.vendor.name)}</span>` : ''}
        ${expense.period ? `<span class="expense-period">${escapeHtml(expense.period.name)}</span>` : ''}
      </div>
      ${expense.period?.status === 'closed' ? '<div class="lock-indicator">🔒 Period Locked</div>' : ''}
    </div>
  `).join('');
}

// Open create modal
function openCreateModal() {
  currentExpense = null;
  document.getElementById('modalTitle').textContent = 'Add Expense';
  document.getElementById('expenseForm').reset();
  document.getElementById('expenseId').value = '';

  // Set default date to today
  document.getElementById('expenseDate').value = new Date().toISOString().split('T')[0];

  const modal = document.getElementById('expenseModal');
  modal.style.display = 'flex';
  modal.classList.add('show');
}

// Close create/edit modal
function closeModal() {
  const modal = document.getElementById('expenseModal');
  modal.classList.remove('show');
  modal.style.display = 'none';
}

// Open detail modal
async function openDetailModal(expenseId) {
  try {
    const response = await fetch(`/api/expenses/${expenseId}`);
    if (!response.ok) throw new Error('Failed to load expense');

    currentExpense = await response.json();
    const isLocked = currentExpense.period?.is_locked;

    document.getElementById('detailTitle').textContent = formatCurrency(currentExpense.amount);
    document.getElementById('detailBadges').innerHTML = `
      <span class="overhead-badge overhead-${currentExpense.category?.overhead_type || 'other'}">
        ${currentExpense.category?.overhead_type || 'other'}
      </span>
      ${isLocked ? '<span class="status-badge status-locked">🔒 Locked</span>' : ''}
    `;

    document.getElementById('detailBody').innerHTML = `
      <div class="detail-section">
        <h3>Expense Details</h3>
        <div class="detail-grid">
          <div class="detail-item">
            <label>Amount</label>
            <span class="expense-amount-large">${formatCurrency(currentExpense.amount)}</span>
          </div>
          <div class="detail-item">
            <label>Date</label>
            <span>${formatDate(currentExpense.expense_date)}</span>
          </div>
          <div class="detail-item">
            <label>Category</label>
            <span>${escapeHtml(currentExpense.category?.name || 'Uncategorized')}</span>
          </div>
          <div class="detail-item">
            <label>Overhead Type</label>
            <span class="overhead-badge overhead-${currentExpense.category?.overhead_type || 'other'}">
              ${currentExpense.category?.overhead_type || 'other'}
            </span>
          </div>
          ${currentExpense.vendor ? `
            <div class="detail-item">
              <label>Vendor</label>
              <span>${escapeHtml(currentExpense.vendor.name)}</span>
            </div>
          ` : ''}
          ${currentExpense.period ? `
            <div class="detail-item">
              <label>Financial Period</label>
              <span>${escapeHtml(currentExpense.period.name)} (${currentExpense.period.status})</span>
            </div>
          ` : ''}
        </div>
      </div>

      ${currentExpense.description ? `
        <div class="detail-section">
          <h3>Description</h3>
          <p>${escapeHtml(currentExpense.description)}</p>
        </div>
      ` : ''}

      ${currentExpense.notes ? `
        <div class="detail-section">
          <h3>Notes</h3>
          <p>${escapeHtml(currentExpense.notes)}</p>
        </div>
      ` : ''}

      ${currentExpense.receipt_url ? `
        <div class="detail-section">
          <h3>Receipt</h3>
          <a href="${currentExpense.receipt_url}" target="_blank" class="btn btn-link">View Receipt</a>
        </div>
      ` : ''}

      <div class="detail-section">
        <h3>Audit Trail</h3>
        <div class="detail-grid">
          <div class="detail-item">
            <label>Created</label>
            <span>${formatDateTime(currentExpense.created_at)} by ${currentExpense.created_by || 'system'}</span>
          </div>
          ${currentExpense.updated_at !== currentExpense.created_at ? `
            <div class="detail-item">
              <label>Last Updated</label>
              <span>${formatDateTime(currentExpense.updated_at)} by ${currentExpense.updated_by || 'system'}</span>
            </div>
          ` : ''}
        </div>
      </div>
    `;

    // Footer actions
    if (isLocked) {
      document.getElementById('detailFooter').innerHTML = `
        <p class="text-muted">This expense is in a locked period and cannot be modified.</p>
      `;
    } else {
      document.getElementById('detailFooter').innerHTML = `
        <button class="btn btn-secondary" onclick="editExpense()">Edit</button>
        <button class="btn btn-danger" onclick="deleteExpense()">Delete</button>
      `;
    }

    const modal = document.getElementById('detailModal');
    modal.style.display = 'flex';
    modal.classList.add('show');
  } catch (err) {
    console.error('Error loading expense:', err);
    showToast('Failed to load expense details', 'error');
  }
}

// Close detail modal
function closeDetailModal() {
  const modal = document.getElementById('detailModal');
  modal.classList.remove('show');
  modal.style.display = 'none';
}

// Save expense
async function saveExpense() {
  const id = document.getElementById('expenseId').value;
  const data = {
    amount: parseFloat(document.getElementById('expenseAmount').value),
    expense_date: document.getElementById('expenseDate').value,
    category_id: document.getElementById('expenseCategory').value || null,
    vendor_id: document.getElementById('expenseVendor').value || null,
    period_id: document.getElementById('expensePeriod').value || null,
    description: document.getElementById('expenseDescription').value || null,
    receipt_url: document.getElementById('expenseReceipt').value || null,
    notes: document.getElementById('expenseNotes').value || null,
    created_by: 'Jake Ross'
  };

  if (!data.amount || !data.expense_date) {
    showToast('Please fill in amount and date', 'error');
    return;
  }

  try {
    const url = id ? `/api/expenses/${id}` : '/api/expenses';
    const method = id ? 'PATCH' : 'POST';

    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to save expense');
    }

    showToast(id ? 'Expense updated' : 'Expense added', 'success');
    closeModal();
    await loadExpenses();
  } catch (err) {
    console.error('Error saving expense:', err);
    showToast(err.message, 'error');
  }
}

// Edit expense
function editExpense() {
  if (!currentExpense) return;

  document.getElementById('modalTitle').textContent = 'Edit Expense';
  document.getElementById('expenseId').value = currentExpense.id;
  document.getElementById('expenseAmount').value = currentExpense.amount;
  document.getElementById('expenseDate').value = currentExpense.expense_date;
  document.getElementById('expenseCategory').value = currentExpense.category_id || '';
  document.getElementById('expenseVendor').value = currentExpense.vendor_id || '';
  document.getElementById('expensePeriod').value = currentExpense.period_id || '';
  document.getElementById('expenseDescription').value = currentExpense.description || '';
  document.getElementById('expenseReceipt').value = currentExpense.receipt_url || '';
  document.getElementById('expenseNotes').value = currentExpense.notes || '';

  closeDetailModal();

  const modal = document.getElementById('expenseModal');
  modal.style.display = 'flex';
  modal.classList.add('show');
}

// Delete expense
async function deleteExpense() {
  if (!currentExpense) return;

  if (!confirm('Delete this expense? This action cannot be undone.')) {
    return;
  }

  try {
    const response = await fetch(`/api/expenses/${currentExpense.id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deleted_by: 'Jake Ross' })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to delete expense');
    }

    showToast('Expense deleted', 'success');
    closeDetailModal();
    await loadExpenses();
  } catch (err) {
    console.error('Error deleting expense:', err);
    showToast(err.message, 'error');
  }
}

// Clear search
function clearSearch() {
  document.getElementById('searchInput').value = '';
  document.getElementById('searchClear').style.display = 'none';
  renderExpenseList();
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

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ============================================================
// RECURRING EXPENSES
// ============================================================

let recurringExpenses = [];

// Open recurring modal
async function openRecurringModal() {
  await loadRecurringExpenses();

  const modal = document.getElementById('recurringModal');
  modal.style.display = 'flex';
  modal.classList.add('show');
}

// Close recurring modal
function closeRecurringModal() {
  const modal = document.getElementById('recurringModal');
  modal.classList.remove('show');
  modal.style.display = 'none';
}

// Load recurring expenses
async function loadRecurringExpenses() {
  try {
    const response = await fetch('/api/expenses/recurring/list');
    if (!response.ok) throw new Error('Failed to load recurring expenses');

    recurringExpenses = await response.json();
    renderRecurringList();
  } catch (err) {
    console.error('Error loading recurring expenses:', err);
    showToast('Failed to load recurring expenses', 'error');
  }
}

// Render recurring list
function renderRecurringList() {
  const container = document.getElementById('recurringList');

  if (recurringExpenses.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>No recurring expenses configured.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = recurringExpenses.map(rec => `
    <div class="expense-card">
      <div class="expense-header">
        <div class="expense-amount">${formatCurrency(rec.amount)}</div>
        <span class="status-badge ${rec.is_active ? 'status-open' : 'status-closed'}">
          ${rec.is_active ? 'Active' : 'Paused'}
        </span>
      </div>
      <div class="expense-info">
        <span class="expense-category">${escapeHtml(rec.category?.name || 'Uncategorized')}</span>
        <span>${rec.frequency} on day ${rec.day_of_month}</span>
      </div>
      ${rec.description ? `<div class="expense-description">${escapeHtml(rec.description)}</div>` : ''}
      <div class="expense-meta">
        ${rec.vendor ? `<span>${escapeHtml(rec.vendor.name)}</span>` : ''}
        ${rec.next_occurrence ? `<span>Next: ${formatDate(rec.next_occurrence)}</span>` : ''}
      </div>
      <div style="margin-top: 0.5rem;">
        <button class="btn btn-sm btn-secondary" onclick="toggleRecurring('${rec.id}', ${!rec.is_active})">
          ${rec.is_active ? 'Pause' : 'Resume'}
        </button>
        <button class="btn btn-sm btn-danger" onclick="deleteRecurring('${rec.id}')">Delete</button>
      </div>
    </div>
  `).join('');
}

// Open create recurring modal
function openCreateRecurringModal() {
  document.getElementById('recurringForm').reset();

  // Populate dropdowns
  const categorySelect = document.getElementById('recurringCategory');
  const vendorSelect = document.getElementById('recurringVendor');

  categorySelect.innerHTML = '<option value="">Select category...</option>' +
    categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

  vendorSelect.innerHTML = '<option value="">No vendor</option>' +
    vendors.map(v => `<option value="${v.id}">${v.name}</option>`).join('');

  const modal = document.getElementById('createRecurringModal');
  modal.style.display = 'flex';
  modal.classList.add('show');
}

// Close create recurring modal
function closeCreateRecurringModal() {
  const modal = document.getElementById('createRecurringModal');
  modal.classList.remove('show');
  modal.style.display = 'none';
}

// Save recurring expense
async function saveRecurring() {
  const data = {
    amount: parseFloat(document.getElementById('recurringAmount').value),
    description: document.getElementById('recurringDescription').value || null,
    category_id: document.getElementById('recurringCategory').value || null,
    vendor_id: document.getElementById('recurringVendor').value || null,
    frequency: document.getElementById('recurringFrequency').value,
    day_of_month: parseInt(document.getElementById('recurringDayOfMonth').value) || 1,
    created_by: 'Jake Ross'
  };

  if (!data.amount) {
    showToast('Please enter an amount', 'error');
    return;
  }

  try {
    const response = await fetch('/api/expenses/recurring', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to create recurring expense');
    }

    showToast('Recurring expense created', 'success');
    closeCreateRecurringModal();
    await loadRecurringExpenses();
  } catch (err) {
    console.error('Error saving recurring:', err);
    showToast(err.message, 'error');
  }
}

// Toggle recurring expense active status
async function toggleRecurring(id, isActive) {
  try {
    const response = await fetch(`/api/expenses/recurring/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: isActive })
    });

    if (!response.ok) throw new Error('Failed to update');

    showToast(isActive ? 'Recurring expense resumed' : 'Recurring expense paused', 'success');
    await loadRecurringExpenses();
  } catch (err) {
    console.error('Error toggling recurring:', err);
    showToast(err.message, 'error');
  }
}

// Delete recurring expense
async function deleteRecurring(id) {
  if (!confirm('Delete this recurring expense?')) return;

  try {
    const response = await fetch(`/api/expenses/recurring/${id}`, {
      method: 'DELETE'
    });

    if (!response.ok) throw new Error('Failed to delete');

    showToast('Recurring expense deleted', 'success');
    await loadRecurringExpenses();
  } catch (err) {
    console.error('Error deleting recurring:', err);
    showToast(err.message, 'error');
  }
}

// Process due recurring expenses
async function processRecurring() {
  try {
    const response = await fetch('/api/expenses/recurring/process', {
      method: 'POST'
    });

    if (!response.ok) throw new Error('Failed to process');

    const result = await response.json();
    showToast(`Created ${result.created_count} expense(s) from recurring templates`, 'success');
    await loadRecurringExpenses();
    await loadExpenses();
  } catch (err) {
    console.error('Error processing recurring:', err);
    showToast(err.message, 'error');
  }
}

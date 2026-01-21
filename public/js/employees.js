/**
 * Employees Management JavaScript
 * Handles employee CRUD, burden classes, and company settings
 */

// State
let employees = [];
let burdenClasses = [];
let companySettings = {};
let pendingReviews = [];
let departments = new Set();
let searchDebounceTimer = null;

// ============================================================
// INITIALIZATION
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
  setupEventListeners();
  await Promise.all([
    loadBurdenClasses(),
    loadCompanySettings(),
    loadPendingReviews()
  ]);
  await loadEmployees();
});

function setupEventListeners() {
  // Burden class rate inputs - auto-calculate total
  const rateInputs = ['ficaRate', 'futaRate', 'sutaRate', 'workersCompRate',
    'healthInsuranceRate', 'retirementRate', 'ptoRate', 'otherRate'];
  rateInputs.forEach(id => {
    const input = document.getElementById(id);
    if (input) {
      input.addEventListener('input', updateCalculatedTotal);
    }
  });

  // Burden class selection - update effective rate preview
  const burdenClassSelect = document.getElementById('burdenClassId');
  if (burdenClassSelect) {
    burdenClassSelect.addEventListener('change', updateEffectiveBurdenRate);
  }

  const customRateInput = document.getElementById('customBurdenRate');
  if (customRateInput) {
    customRateInput.addEventListener('input', updateEffectiveBurdenRate);
  }
}

function debounceSearch() {
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    loadEmployees();
  }, 150);
}

// ============================================================
// DATA LOADING
// ============================================================

async function loadEmployees() {
  const status = document.getElementById('statusFilter').value;
  const burdenClassId = document.getElementById('burdenClassFilter').value;
  const department = document.getElementById('departmentFilter').value;
  const search = document.getElementById('searchInput').value.toLowerCase();

  let url = '/api/employees?';
  const params = [];
  if (status) params.push(`status=${status}`);
  if (burdenClassId) params.push(`burden_class_id=${burdenClassId}`);
  if (department) params.push(`department=${encodeURIComponent(department)}`);
  url += params.join('&');

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to load employees');
    employees = await response.json();

    // Client-side search filtering
    if (search) {
      employees = employees.filter(emp =>
        `${emp.first_name} ${emp.last_name}`.toLowerCase().includes(search) ||
        (emp.employee_number && emp.employee_number.toLowerCase().includes(search)) ||
        (emp.email && emp.email.toLowerCase().includes(search))
      );
    }

    // Collect departments for filter
    employees.forEach(emp => {
      if (emp.department) departments.add(emp.department);
    });
    updateDepartmentFilter();

    renderEmployeeTable();
    updateStats();
  } catch (err) {
    console.error('Error loading employees:', err);
    showToast('Failed to load employees', 'error');
  }
}

async function loadBurdenClasses() {
  try {
    const response = await fetch('/api/employees/burden-classes');
    if (!response.ok) throw new Error('Failed to load burden classes');
    burdenClasses = await response.json();
    updateBurdenClassFilters();
  } catch (err) {
    console.error('Error loading burden classes:', err);
  }
}

async function loadCompanySettings() {
  try {
    const response = await fetch('/api/employees/settings/all');
    if (!response.ok) throw new Error('Failed to load settings');
    companySettings = await response.json();
  } catch (err) {
    console.error('Error loading settings:', err);
  }
}

async function loadPendingReviews() {
  try {
    const response = await fetch('/api/employees/burden-reviews?status=pending');
    if (!response.ok) throw new Error('Failed to load reviews');
    pendingReviews = await response.json();
    updateReviewAlert();
  } catch (err) {
    console.error('Error loading reviews:', err);
  }
}

// ============================================================
// RENDERING
// ============================================================

function renderEmployeeTable() {
  const tbody = document.getElementById('employeeTableBody');

  if (employees.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="empty-cell">No employees found</td></tr>`;
    return;
  }

  tbody.innerHTML = employees.map(emp => `
    <tr>
      <td>
        <strong>${emp.first_name} ${emp.last_name}</strong>
        ${emp.email ? `<br><small class="text-muted">${emp.email}</small>` : ''}
      </td>
      <td>${emp.employee_number || '-'}</td>
      <td>${emp.role || '-'}</td>
      <td>${emp.department || '-'}</td>
      <td>${emp.burden_class?.name || '-'}</td>
      <td>${formatPayRate(emp)}</td>
      <td>${formatPercent(emp.effective_burden_rate)}</td>
      <td><span class="status-badge status-${emp.status}">${emp.status}</span></td>
      <td class="actions-cell">
        <button class="btn btn-sm btn-secondary" onclick="editEmployee('${emp.id}')">Edit</button>
        ${emp.status !== 'terminated' ?
          `<button class="btn btn-sm btn-danger" onclick="terminateEmployee('${emp.id}')">Terminate</button>` : ''}
      </td>
    </tr>
  `).join('');
}

function updateStats() {
  const total = employees.length;
  const active = employees.filter(e => e.status === 'active').length;
  const avgBurden = employees.length > 0
    ? employees.reduce((sum, e) => sum + (e.effective_burden_rate || 0), 0) / employees.length
    : 0;

  document.getElementById('totalEmployees').textContent = total;
  document.getElementById('activeEmployees').textContent = active;
  document.getElementById('avgBurdenRate').textContent = formatPercent(avgBurden);
  document.getElementById('burdenClassCount').textContent = burdenClasses.length;
}

function updateBurdenClassFilters() {
  const filterSelect = document.getElementById('burdenClassFilter');
  const formSelect = document.getElementById('burdenClassId');
  const calcSelect = document.getElementById('calcEmployeeId');

  const options = burdenClasses.map(bc =>
    `<option value="${bc.id}">${bc.name} (${formatPercent(bc.total_burden_rate)})</option>`
  ).join('');

  if (filterSelect) {
    filterSelect.innerHTML = `<option value="">All Classes</option>${options}`;
  }
  if (formSelect) {
    formSelect.innerHTML = `<option value="">-- Select Burden Class --</option>${options}`;
  }
}

function updateDepartmentFilter() {
  const select = document.getElementById('departmentFilter');
  const currentValue = select.value;

  select.innerHTML = '<option value="">All Departments</option>' +
    Array.from(departments).sort().map(d =>
      `<option value="${d}"${d === currentValue ? ' selected' : ''}>${d}</option>`
    ).join('');
}

function updateReviewAlert() {
  const alert = document.getElementById('burdenReviewAlert');
  const dueDateSpan = document.getElementById('reviewDueDate');

  if (pendingReviews.length > 0) {
    const nextReview = pendingReviews[0];
    dueDateSpan.textContent = `- Due: ${formatDate(nextReview.due_date)}`;
    alert.style.display = 'flex';
  } else {
    alert.style.display = 'none';
  }
}

// ============================================================
// EMPLOYEE MODAL
// ============================================================

function openCreateEmployeeModal() {
  document.getElementById('employeeModalTitle').textContent = 'Add Employee';
  document.getElementById('employeeForm').reset();
  document.getElementById('employeeId').value = '';
  document.getElementById('employeeStatus').value = 'active';
  updateEffectiveBurdenRate();
  openModal('employeeModal');
}

async function editEmployee(id) {
  const emp = employees.find(e => e.id === id);
  if (!emp) return;

  document.getElementById('employeeModalTitle').textContent = 'Edit Employee';
  document.getElementById('employeeId').value = emp.id;
  document.getElementById('firstName').value = emp.first_name;
  document.getElementById('lastName').value = emp.last_name;
  document.getElementById('email').value = emp.email || '';
  document.getElementById('phone').value = emp.phone || '';
  document.getElementById('employeeNumber').value = emp.employee_number || '';
  document.getElementById('employeeStatus').value = emp.status;
  document.getElementById('role').value = emp.role || '';
  document.getElementById('department').value = emp.department || '';
  document.getElementById('hireDate').value = emp.hire_date || '';
  document.getElementById('terminationDate').value = emp.termination_date || '';
  document.getElementById('payType').value = emp.pay_type || 'hourly';
  document.getElementById('payRate').value = emp.pay_rate || '';
  document.getElementById('burdenClassId').value = emp.burden_class_id || '';
  document.getElementById('customBurdenRate').value = emp.custom_burden_rate || '';
  document.getElementById('emergencyContactName').value = emp.emergency_contact_name || '';
  document.getElementById('emergencyContactPhone').value = emp.emergency_contact_phone || '';

  updateEffectiveBurdenRate();
  openModal('employeeModal');
}

async function saveEmployee(event) {
  event.preventDefault();

  const id = document.getElementById('employeeId').value;
  const data = {
    first_name: document.getElementById('firstName').value,
    last_name: document.getElementById('lastName').value,
    email: document.getElementById('email').value || null,
    phone: document.getElementById('phone').value || null,
    employee_number: document.getElementById('employeeNumber').value || null,
    status: document.getElementById('employeeStatus').value,
    role: document.getElementById('role').value || null,
    department: document.getElementById('department').value || null,
    hire_date: document.getElementById('hireDate').value || null,
    termination_date: document.getElementById('terminationDate').value || null,
    pay_type: document.getElementById('payType').value,
    pay_rate: parseFloat(document.getElementById('payRate').value) || null,
    burden_class_id: document.getElementById('burdenClassId').value || null,
    custom_burden_rate: parseFloat(document.getElementById('customBurdenRate').value) || null,
    emergency_contact_name: document.getElementById('emergencyContactName').value || null,
    emergency_contact_phone: document.getElementById('emergencyContactPhone').value || null
  };

  try {
    const url = id ? `/api/employees/${id}` : '/api/employees';
    const method = id ? 'PATCH' : 'POST';

    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to save employee');
    }

    showToast(`Employee ${id ? 'updated' : 'created'} successfully`, 'success');
    closeEmployeeModal();
    await loadEmployees();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function terminateEmployee(id) {
  if (!confirm('Are you sure you want to terminate this employee?')) return;

  try {
    const response = await fetch(`/api/employees/${id}`, {
      method: 'DELETE'
    });

    if (!response.ok) throw new Error('Failed to terminate employee');

    showToast('Employee terminated', 'success');
    await loadEmployees();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function closeEmployeeModal() {
  closeModal('employeeModal');
}

function updateEffectiveBurdenRate() {
  const customRate = parseFloat(document.getElementById('customBurdenRate').value);
  const burdenClassId = document.getElementById('burdenClassId').value;
  const burdenClass = burdenClasses.find(bc => bc.id === burdenClassId);

  let effectiveRate = companySettings.default_burden_rate || 0.40;
  if (burdenClass) effectiveRate = burdenClass.total_burden_rate;
  if (!isNaN(customRate) && customRate > 0) effectiveRate = customRate;

  document.getElementById('effectiveBurdenRate').textContent = formatPercent(effectiveRate);
}

// ============================================================
// BURDEN CLASSES MODAL
// ============================================================

function openBurdenClassesModal() {
  renderBurdenClassTable();
  openModal('burdenClassesModal');
}

function closeBurdenClassesModal() {
  closeModal('burdenClassesModal');
}

function renderBurdenClassTable() {
  const tbody = document.getElementById('burdenClassTableBody');

  if (burdenClasses.length === 0) {
    tbody.innerHTML = `<tr><td colspan="12" class="empty-cell">No burden classes defined</td></tr>`;
    return;
  }

  tbody.innerHTML = burdenClasses.map(bc => `
    <tr>
      <td><strong>${bc.name}</strong></td>
      <td>${formatPercent(bc.fica_rate)}</td>
      <td>${formatPercent(bc.futa_rate)}</td>
      <td>${formatPercent(bc.suta_rate)}</td>
      <td>${formatPercent(bc.workers_comp_rate)}</td>
      <td>${formatPercent(bc.health_insurance_rate)}</td>
      <td>${formatPercent(bc.retirement_rate)}</td>
      <td>${formatPercent(bc.pto_rate)}</td>
      <td>${formatPercent(bc.other_rate)}</td>
      <td><strong>${formatPercent(bc.total_burden_rate)}</strong></td>
      <td>${bc.is_default ? '<span class="badge badge-success">Default</span>' : ''}</td>
      <td class="actions-cell">
        <button class="btn btn-sm btn-secondary" onclick="editBurdenClass('${bc.id}')">Edit</button>
      </td>
    </tr>
  `).join('');
}

function openCreateBurdenClassModal() {
  document.getElementById('burdenClassModalTitle').textContent = 'Add Burden Class';
  document.getElementById('burdenClassForm').reset();
  document.getElementById('burdenClassId').value = '';

  // Set defaults
  document.getElementById('ficaRate').value = '0.0765';
  document.getElementById('futaRate').value = '0.006';
  document.getElementById('sutaRate').value = '0.027';
  document.getElementById('workersCompRate').value = '0.08';
  document.getElementById('healthInsuranceRate').value = '0.15';
  document.getElementById('retirementRate').value = '0.03';
  document.getElementById('ptoRate').value = '0.05';
  document.getElementById('otherRate').value = '0';

  updateCalculatedTotal();
  openModal('burdenClassModal');
}

function editBurdenClass(id) {
  const bc = burdenClasses.find(b => b.id === id);
  if (!bc) return;

  document.getElementById('burdenClassModalTitle').textContent = 'Edit Burden Class';
  document.getElementById('burdenClassId').value = bc.id;
  document.getElementById('burdenClassName').value = bc.name;
  document.getElementById('burdenClassDescription').value = bc.description || '';
  document.getElementById('burdenClassDefault').checked = bc.is_default;
  document.getElementById('ficaRate').value = bc.fica_rate;
  document.getElementById('futaRate').value = bc.futa_rate;
  document.getElementById('sutaRate').value = bc.suta_rate;
  document.getElementById('workersCompRate').value = bc.workers_comp_rate;
  document.getElementById('healthInsuranceRate').value = bc.health_insurance_rate;
  document.getElementById('retirementRate').value = bc.retirement_rate;
  document.getElementById('ptoRate').value = bc.pto_rate;
  document.getElementById('otherRate').value = bc.other_rate;

  updateCalculatedTotal();
  openModal('burdenClassModal');
}

async function saveBurdenClass(event) {
  event.preventDefault();

  const id = document.getElementById('burdenClassId').value;
  const data = {
    name: document.getElementById('burdenClassName').value,
    description: document.getElementById('burdenClassDescription').value || null,
    is_default: document.getElementById('burdenClassDefault').checked,
    fica_rate: parseFloat(document.getElementById('ficaRate').value) || 0,
    futa_rate: parseFloat(document.getElementById('futaRate').value) || 0,
    suta_rate: parseFloat(document.getElementById('sutaRate').value) || 0,
    workers_comp_rate: parseFloat(document.getElementById('workersCompRate').value) || 0,
    health_insurance_rate: parseFloat(document.getElementById('healthInsuranceRate').value) || 0,
    retirement_rate: parseFloat(document.getElementById('retirementRate').value) || 0,
    pto_rate: parseFloat(document.getElementById('ptoRate').value) || 0,
    other_rate: parseFloat(document.getElementById('otherRate').value) || 0
  };

  try {
    const url = id ? `/api/employees/burden-classes/${id}` : '/api/employees/burden-classes';
    const method = id ? 'PATCH' : 'POST';

    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to save burden class');
    }

    showToast(`Burden class ${id ? 'updated' : 'created'} successfully`, 'success');
    closeBurdenClassModal();
    await loadBurdenClasses();
    renderBurdenClassTable();
    updateStats();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function closeBurdenClassModal() {
  closeModal('burdenClassModal');
}

function updateCalculatedTotal() {
  const rates = [
    parseFloat(document.getElementById('ficaRate').value) || 0,
    parseFloat(document.getElementById('futaRate').value) || 0,
    parseFloat(document.getElementById('sutaRate').value) || 0,
    parseFloat(document.getElementById('workersCompRate').value) || 0,
    parseFloat(document.getElementById('healthInsuranceRate').value) || 0,
    parseFloat(document.getElementById('retirementRate').value) || 0,
    parseFloat(document.getElementById('ptoRate').value) || 0,
    parseFloat(document.getElementById('otherRate').value) || 0
  ];

  const total = rates.reduce((sum, r) => sum + r, 0);
  document.getElementById('calculatedTotalRate').textContent = formatPercent(total);
}

// ============================================================
// COMPANY SETTINGS MODAL
// ============================================================

function openCompanySettingsModal() {
  document.getElementById('defaultBurdenRate').value = companySettings.default_burden_rate || 0.40;
  document.getElementById('burdenReviewFrequency').value = companySettings.burden_review_frequency || 'quarterly';
  document.getElementById('lastBurdenReview').value = companySettings.last_burden_review || '';
  openModal('companySettingsModal');
}

function closeCompanySettingsModal() {
  closeModal('companySettingsModal');
}

async function saveCompanySettings(event) {
  event.preventDefault();

  const settings = {
    default_burden_rate: document.getElementById('defaultBurdenRate').value,
    burden_review_frequency: document.getElementById('burdenReviewFrequency').value,
    last_burden_review: document.getElementById('lastBurdenReview').value || null
  };

  try {
    for (const [key, value] of Object.entries(settings)) {
      if (value !== null) {
        await fetch(`/api/employees/settings/${key}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value })
        });
      }
    }

    showToast('Settings saved successfully', 'success');
    closeCompanySettingsModal();
    await loadCompanySettings();
  } catch (err) {
    showToast('Failed to save settings', 'error');
  }
}

// ============================================================
// BURDEN REVIEW MODAL
// ============================================================

function openBurdenReviewModal() {
  if (pendingReviews.length === 0) {
    showToast('No pending reviews', 'info');
    return;
  }

  document.getElementById('reviewId').value = pendingReviews[0].id;
  document.getElementById('reviewNotes').value = '';
  openModal('burdenReviewModal');
}

function closeBurdenReviewModal() {
  closeModal('burdenReviewModal');
}

async function completeBurdenReview(event) {
  event.preventDefault();

  const id = document.getElementById('reviewId').value;
  const notes = document.getElementById('reviewNotes').value;

  try {
    const response = await fetch(`/api/employees/burden-reviews/${id}/complete`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes })
    });

    if (!response.ok) throw new Error('Failed to complete review');

    showToast('Burden review completed', 'success');
    closeBurdenReviewModal();
    await loadPendingReviews();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ============================================================
// BURDEN CALCULATOR MODAL
// ============================================================

function openBurdenCalculatorModal() {
  // Populate employee dropdown
  const select = document.getElementById('calcEmployeeId');
  select.innerHTML = '<option value="">-- Use default rate --</option>' +
    employees.filter(e => e.status === 'active').map(e =>
      `<option value="${e.id}">${e.first_name} ${e.last_name} (${formatPercent(e.effective_burden_rate)})</option>`
    ).join('');

  document.getElementById('burdenCalculatorForm').reset();
  document.getElementById('calculationResult').style.display = 'none';
  openModal('burdenCalculatorModal');
}

function closeBurdenCalculatorModal() {
  closeModal('burdenCalculatorModal');
}

async function calculateBurden(event) {
  event.preventDefault();

  const employeeId = document.getElementById('calcEmployeeId').value || null;
  const baseWage = parseFloat(document.getElementById('calcBaseWage').value);
  const hours = parseFloat(document.getElementById('calcHours').value) || 1;

  try {
    const response = await fetch('/api/employees/calculate-burden', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employee_id: employeeId, base_wage: baseWage, hours })
    });

    if (!response.ok) throw new Error('Calculation failed');

    const result = await response.json();

    document.getElementById('resultBaseWage').textContent = formatCurrency(result.base_wage);
    document.getElementById('resultHours').textContent = result.hours;
    document.getElementById('resultTotalBase').textContent = formatCurrency(result.total_base);
    document.getElementById('resultBurdenRate').textContent = formatPercent(result.burden_rate);
    document.getElementById('resultBurdenAmount').textContent = formatCurrency(result.burden_amount);
    document.getElementById('resultBurdenedCost').textContent = formatCurrency(result.burdened_cost);
    document.getElementById('calculationResult').style.display = 'block';
  } catch (err) {
    showToast(err.message, 'error');
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

function formatPayRate(emp) {
  if (!emp.pay_rate) return '-';
  const formatted = formatCurrency(emp.pay_rate);
  return emp.pay_type === 'hourly' ? `${formatted}/hr` : `${formatted}/yr`;
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString();
}

/**
 * Timesheets Management JavaScript
 * Digital time entry, submission, and approval
 */

// State
let timesheets = [];
let employees = [];
let jobs = [];
let costCodes = [];
let selectedIds = new Set();
let currentView = 'entries';
let currentWeekStart = getWeekStart(new Date());
let currentReportTab = 'byJob';

// ============================================================
// INITIALIZATION
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
  setupEventListeners();
  setDefaultDates();
  await Promise.all([
    loadEmployees(),
    loadJobs(),
    loadCostCodes()
  ]);
  await loadTimesheets();
  loadPendingCount();
});

function setupEventListeners() {
  // Cost preview calculation on input change
  ['tsEmployeeId', 'tsHours', 'tsOvertimeHours'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', updateCostPreview);
  });
}

function setDefaultDates() {
  const today = new Date();
  const weekStart = getWeekStart(today);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  document.getElementById('startDate').value = weekStart.toISOString().split('T')[0];
  document.getElementById('endDate').value = weekEnd.toISOString().split('T')[0];
  document.getElementById('tsWorkDate').value = today.toISOString().split('T')[0];
}

function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday start
  return new Date(d.setDate(diff));
}

// ============================================================
// DATA LOADING
// ============================================================

async function loadTimesheets() {
  const employee_id = document.getElementById('employeeFilter').value;
  const job_id = document.getElementById('jobFilter').value;
  const status = document.getElementById('statusFilter').value;
  const start_date = document.getElementById('startDate').value;
  const end_date = document.getElementById('endDate').value;

  let url = '/api/timesheets?';
  const params = [];
  if (employee_id) params.push(`employee_id=${employee_id}`);
  if (job_id) params.push(`job_id=${job_id}`);
  if (status) params.push(`status=${status}`);
  if (start_date) params.push(`start_date=${start_date}`);
  if (end_date) params.push(`end_date=${end_date}`);
  url += params.join('&');

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to load timesheets');
    timesheets = await response.json();

    renderTimesheetTable();
    renderApprovalTable();
    renderWeeklyView();
    updateStats();
  } catch (err) {
    console.error('Error loading timesheets:', err);
    showToast('Failed to load timesheets', 'error');
  }
}

async function loadEmployees() {
  try {
    const response = await fetch('/api/employees?status=active');
    if (!response.ok) throw new Error('Failed to load employees');
    employees = await response.json();

    const filterSelect = document.getElementById('employeeFilter');
    const formSelect = document.getElementById('tsEmployeeId');

    const options = employees.map(e =>
      `<option value="${e.id}">${e.first_name} ${e.last_name}</option>`
    ).join('');

    filterSelect.innerHTML = '<option value="">All Employees</option>' + options;
    formSelect.innerHTML = '<option value="">-- Select Employee --</option>' + options;
  } catch (err) {
    console.error('Error loading employees:', err);
  }
}

async function loadJobs() {
  try {
    const response = await fetch('/api/jobs?status=active');
    if (!response.ok) throw new Error('Failed to load jobs');
    jobs = await response.json();

    const filterSelect = document.getElementById('jobFilter');
    const formSelect = document.getElementById('tsJobId');

    const options = jobs.map(j =>
      `<option value="${j.id}">${j.name}</option>`
    ).join('');

    filterSelect.innerHTML = '<option value="">All Jobs</option>' + options;
    formSelect.innerHTML = '<option value="">-- Select Job --</option>' + options;
  } catch (err) {
    console.error('Error loading jobs:', err);
  }
}

async function loadCostCodes() {
  try {
    const response = await fetch('/api/cost-codes');
    if (!response.ok) throw new Error('Failed to load cost codes');
    costCodes = await response.json();

    const select = document.getElementById('tsCostCodeId');
    select.innerHTML = '<option value="">-- Optional --</option>' +
      costCodes.map(cc =>
        `<option value="${cc.id}">${cc.code} - ${cc.name}</option>`
      ).join('');
  } catch (err) {
    console.error('Error loading cost codes:', err);
  }
}

async function loadPendingCount() {
  try {
    const response = await fetch('/api/timesheets?status=submitted');
    if (!response.ok) return;
    const pending = await response.json();
    document.getElementById('pendingCount').textContent = pending.length;
  } catch (err) {
    console.error('Error loading pending count:', err);
  }
}

// ============================================================
// VIEW SWITCHING
// ============================================================

function switchView(view) {
  currentView = view;

  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });

  document.getElementById('entriesView').style.display = view === 'entries' ? 'block' : 'none';
  document.getElementById('approvalView').style.display = view === 'approval' ? 'block' : 'none';
  document.getElementById('weeklyView').style.display = view === 'weekly' ? 'block' : 'none';

  if (view === 'approval') {
    document.getElementById('statusFilter').value = 'submitted';
    loadTimesheets();
  } else if (view === 'entries') {
    document.getElementById('statusFilter').value = '';
    loadTimesheets();
  }
}

function updateDateRange() {
  const range = document.getElementById('dateRangeFilter').value;
  const customInputs = document.getElementById('customDateInputs');
  const today = new Date();
  let start, end;

  if (range === 'custom') {
    customInputs.style.display = 'flex';
    return;
  }

  customInputs.style.display = 'none';

  switch (range) {
    case 'week':
      start = getWeekStart(today);
      end = new Date(start);
      end.setDate(end.getDate() + 6);
      break;
    case 'last-week':
      start = getWeekStart(today);
      start.setDate(start.getDate() - 7);
      end = new Date(start);
      end.setDate(end.getDate() + 6);
      break;
    case 'month':
      start = new Date(today.getFullYear(), today.getMonth(), 1);
      end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      break;
  }

  document.getElementById('startDate').value = start.toISOString().split('T')[0];
  document.getElementById('endDate').value = end.toISOString().split('T')[0];
  loadTimesheets();
}

// ============================================================
// RENDERING
// ============================================================

function renderTimesheetTable() {
  const tbody = document.getElementById('timesheetTableBody');

  if (timesheets.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="empty-cell">No time entries found</td></tr>';
    return;
  }

  tbody.innerHTML = timesheets.map(t => `
    <tr>
      <td><input type="checkbox" class="ts-checkbox" data-id="${t.id}" onchange="updateSelection()" ${selectedIds.has(t.id) ? 'checked' : ''}></td>
      <td>${formatDate(t.work_date)}</td>
      <td>${t.employee ? `${t.employee.first_name} ${t.employee.last_name}` : '-'}</td>
      <td>${t.job?.name || '-'}</td>
      <td>${t.hours}</td>
      <td>${t.overtime_hours || 0}</td>
      <td>${formatCurrency(t.total_cost)}</td>
      <td><span class="status-badge status-${t.status}">${t.status}</span></td>
      <td class="actions-cell">
        ${t.status === 'draft' ? `
          <button class="btn btn-sm btn-secondary" onclick="editTimesheet('${t.id}')">Edit</button>
          <button class="btn btn-sm btn-primary" onclick="submitTimesheet('${t.id}')">Submit</button>
        ` : ''}
        ${t.status === 'submitted' ? `
          <button class="btn btn-sm btn-success" onclick="approveTimesheet('${t.id}')">Approve</button>
          <button class="btn btn-sm btn-danger" onclick="openRejectModal('${t.id}')">Reject</button>
        ` : ''}
        ${t.status === 'rejected' ? `
          <button class="btn btn-sm btn-secondary" onclick="editTimesheet('${t.id}')">Edit</button>
        ` : ''}
      </td>
    </tr>
  `).join('');
}

function renderApprovalTable() {
  const pending = timesheets.filter(t => t.status === 'submitted');
  const tbody = document.getElementById('approvalTableBody');

  if (pending.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="empty-cell">No entries pending approval</td></tr>';
    return;
  }

  tbody.innerHTML = pending.map(t => `
    <tr>
      <td><input type="checkbox" class="approval-checkbox" data-id="${t.id}" onchange="updateApprovalSelection()"></td>
      <td>${formatDate(t.work_date)}</td>
      <td>${t.employee ? `${t.employee.first_name} ${t.employee.last_name}` : '-'}</td>
      <td>${t.job?.name || '-'}</td>
      <td>${t.hours}</td>
      <td>${t.overtime_hours || 0}</td>
      <td>${formatCurrency(t.total_cost)}</td>
      <td>${formatDateTime(t.submitted_at)}</td>
      <td class="actions-cell">
        <button class="btn btn-sm btn-success" onclick="approveTimesheet('${t.id}')">Approve</button>
        <button class="btn btn-sm btn-danger" onclick="openRejectModal('${t.id}')">Reject</button>
      </td>
    </tr>
  `).join('');
}

function renderWeeklyView() {
  const grid = document.getElementById('weeklyGrid');
  const weekEnd = new Date(currentWeekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  document.getElementById('weekLabel').textContent =
    `Week of ${formatDate(currentWeekStart.toISOString())}`;

  // Group timesheets by employee and day
  const weekData = {};
  const weekDays = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(currentWeekStart);
    d.setDate(d.getDate() + i);
    weekDays.push(d.toISOString().split('T')[0]);
  }

  timesheets.forEach(t => {
    const empKey = t.employee_id;
    if (!weekData[empKey]) {
      weekData[empKey] = {
        employee: t.employee,
        days: {}
      };
    }
    if (!weekData[empKey].days[t.work_date]) {
      weekData[empKey].days[t.work_date] = { hours: 0, entries: [] };
    }
    weekData[empKey].days[t.work_date].hours += parseFloat(t.hours) + parseFloat(t.overtime_hours || 0);
    weekData[empKey].days[t.work_date].entries.push(t);
  });

  if (Object.keys(weekData).length === 0) {
    grid.innerHTML = '<div class="empty-state"><p>No time entries for this week</p></div>';
    return;
  }

  const dayHeaders = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  grid.innerHTML = `
    <table class="weekly-grid-table">
      <thead>
        <tr>
          <th>Employee</th>
          ${dayHeaders.map((d, i) => `<th>${d}<br><small>${formatShortDate(weekDays[i])}</small></th>`).join('')}
          <th>Total</th>
        </tr>
      </thead>
      <tbody>
        ${Object.values(weekData).map(emp => {
          const empName = emp.employee ? `${emp.employee.first_name} ${emp.employee.last_name}` : 'Unknown';
          const weekTotal = weekDays.reduce((sum, day) => sum + (emp.days[day]?.hours || 0), 0);

          return `
            <tr>
              <td><strong>${empName}</strong></td>
              ${weekDays.map(day => {
                const dayData = emp.days[day];
                if (!dayData) return '<td class="weekly-cell empty">-</td>';
                return `<td class="weekly-cell has-hours">${dayData.hours}</td>`;
              }).join('')}
              <td class="weekly-total"><strong>${weekTotal}</strong></td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
}

function updateStats() {
  const total = timesheets.length;
  const hours = timesheets.reduce((sum, t) => sum + parseFloat(t.hours) + parseFloat(t.overtime_hours || 0), 0);
  const cost = timesheets.reduce((sum, t) => sum + parseFloat(t.total_cost || 0), 0);

  document.getElementById('totalEntries').textContent = total;
  document.getElementById('totalHours').textContent = hours.toFixed(1);
  document.getElementById('totalCost').textContent = formatCurrency(cost);
}

// ============================================================
// SELECTION
// ============================================================

function toggleSelectAll() {
  const checked = document.getElementById('selectAll').checked;
  document.querySelectorAll('.ts-checkbox').forEach(cb => {
    cb.checked = checked;
    if (checked) {
      selectedIds.add(cb.dataset.id);
    } else {
      selectedIds.delete(cb.dataset.id);
    }
  });
  updateBulkActionsVisibility();
}

function updateSelection() {
  selectedIds.clear();
  document.querySelectorAll('.ts-checkbox:checked').forEach(cb => {
    selectedIds.add(cb.dataset.id);
  });
  updateBulkActionsVisibility();
}

function updateBulkActionsVisibility() {
  const bulkActions = document.getElementById('bulkActions');
  const count = selectedIds.size;
  document.getElementById('selectedCount').textContent = `${count} selected`;
  bulkActions.style.display = count > 0 ? 'flex' : 'none';
}

function clearSelection() {
  selectedIds.clear();
  document.querySelectorAll('.ts-checkbox, .approval-checkbox').forEach(cb => cb.checked = false);
  document.getElementById('selectAll').checked = false;
  updateBulkActionsVisibility();
}

// ============================================================
// TIMESHEET MODAL
// ============================================================

function openCreateTimesheetModal() {
  document.getElementById('timesheetModalTitle').textContent = 'New Time Entry';
  document.getElementById('timesheetForm').reset();
  document.getElementById('timesheetId').value = '';
  document.getElementById('tsWorkDate').value = new Date().toISOString().split('T')[0];
  clearCostPreview();
  openModal('timesheetModal');
}

async function editTimesheet(id) {
  const t = timesheets.find(ts => ts.id === id);
  if (!t) return;

  document.getElementById('timesheetModalTitle').textContent = 'Edit Time Entry';
  document.getElementById('timesheetId').value = t.id;
  document.getElementById('tsEmployeeId').value = t.employee_id;
  document.getElementById('tsWorkDate').value = t.work_date;
  document.getElementById('tsJobId').value = t.job_id;
  document.getElementById('tsCostCodeId').value = t.cost_code_id || '';
  document.getElementById('tsHours').value = t.hours;
  document.getElementById('tsOvertimeHours').value = t.overtime_hours || 0;
  document.getElementById('tsWorkType').value = t.work_type || 'regular';
  document.getElementById('tsDescription').value = t.description || '';
  document.getElementById('tsNotes').value = t.notes || '';

  updateCostPreview();
  openModal('timesheetModal');
}

async function saveTimesheet(event) {
  event.preventDefault();

  const id = document.getElementById('timesheetId').value;
  const data = {
    employee_id: document.getElementById('tsEmployeeId').value,
    job_id: document.getElementById('tsJobId').value,
    work_date: document.getElementById('tsWorkDate').value,
    hours: parseFloat(document.getElementById('tsHours').value),
    overtime_hours: parseFloat(document.getElementById('tsOvertimeHours').value) || 0,
    work_type: document.getElementById('tsWorkType').value,
    cost_code_id: document.getElementById('tsCostCodeId').value || null,
    description: document.getElementById('tsDescription').value || null,
    notes: document.getElementById('tsNotes').value || null
  };

  try {
    const url = id ? `/api/timesheets/${id}` : '/api/timesheets';
    const method = id ? 'PATCH' : 'POST';

    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to save timesheet');
    }

    showToast(`Time entry ${id ? 'updated' : 'created'} successfully`, 'success');
    closeTimesheetModal();
    await loadTimesheets();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function closeTimesheetModal() {
  closeModal('timesheetModal');
}

function updateCostPreview() {
  const empId = document.getElementById('tsEmployeeId').value;
  const hours = parseFloat(document.getElementById('tsHours').value) || 0;
  const overtime = parseFloat(document.getElementById('tsOvertimeHours').value) || 0;

  const emp = employees.find(e => e.id === empId);
  if (!emp || !emp.pay_rate) {
    clearCostPreview();
    return;
  }

  const baseCost = emp.pay_rate * (hours + overtime * 1.5);
  const burdenRate = emp.effective_burden_rate || 0.40;
  const burden = baseCost * burdenRate;
  const total = baseCost + burden;

  document.getElementById('previewBaseCost').textContent = formatCurrency(baseCost);
  document.getElementById('previewBurden').textContent = formatCurrency(burden);
  document.getElementById('previewTotal').textContent = formatCurrency(total);
  document.getElementById('costPreview').style.display = 'block';
}

function clearCostPreview() {
  document.getElementById('previewBaseCost').textContent = '$0.00';
  document.getElementById('previewBurden').textContent = '$0.00';
  document.getElementById('previewTotal').textContent = '$0.00';
}

// ============================================================
// SUBMIT/APPROVE/REJECT
// ============================================================

async function submitTimesheet(id) {
  try {
    const response = await fetch(`/api/timesheets/${id}/submit`, {
      method: 'POST'
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to submit');
    }

    showToast('Timesheet submitted for approval', 'success');
    await loadTimesheets();
    loadPendingCount();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function approveTimesheet(id) {
  try {
    const response = await fetch(`/api/timesheets/${id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approved_by: 'admin' })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to approve');
    }

    showToast('Timesheet approved', 'success');
    await loadTimesheets();
    loadPendingCount();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function openRejectModal(id) {
  document.getElementById('rejectTimesheetId').value = id;
  document.getElementById('rejectReason').value = '';
  openModal('rejectModal');
}

function closeRejectModal() {
  closeModal('rejectModal');
}

async function confirmReject(event) {
  event.preventDefault();

  const id = document.getElementById('rejectTimesheetId').value;
  const reason = document.getElementById('rejectReason').value;

  try {
    const response = await fetch(`/api/timesheets/${id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rejected_by: 'admin', reason })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to reject');
    }

    showToast('Timesheet rejected', 'success');
    closeRejectModal();
    await loadTimesheets();
    loadPendingCount();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function bulkSubmit() {
  if (selectedIds.size === 0) return;

  try {
    const response = await fetch('/api/timesheets/bulk-submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ timesheet_ids: Array.from(selectedIds) })
    });

    if (!response.ok) throw new Error('Failed to submit');

    const result = await response.json();
    showToast(`${result.submitted} timesheets submitted`, 'success');
    clearSelection();
    await loadTimesheets();
    loadPendingCount();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function bulkApprove() {
  if (selectedIds.size === 0) return;

  try {
    const response = await fetch('/api/timesheets/bulk-approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ timesheet_ids: Array.from(selectedIds), approved_by: 'admin' })
    });

    if (!response.ok) throw new Error('Failed to approve');

    const result = await response.json();
    showToast(`${result.approved} timesheets approved`, 'success');
    clearSelection();
    await loadTimesheets();
    loadPendingCount();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function approveAllVisible() {
  const pending = timesheets.filter(t => t.status === 'submitted');
  if (pending.length === 0) return;

  if (!confirm(`Approve all ${pending.length} pending timesheets?`)) return;

  try {
    const response = await fetch('/api/timesheets/bulk-approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        timesheet_ids: pending.map(t => t.id),
        approved_by: 'admin'
      })
    });

    if (!response.ok) throw new Error('Failed to approve');

    const result = await response.json();
    showToast(`${result.approved} timesheets approved`, 'success');
    await loadTimesheets();
    loadPendingCount();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ============================================================
// WEEKLY NAVIGATION
// ============================================================

function prevWeek() {
  currentWeekStart.setDate(currentWeekStart.getDate() - 7);
  updateWeekDates();
  loadTimesheets();
}

function nextWeek() {
  currentWeekStart.setDate(currentWeekStart.getDate() + 7);
  updateWeekDates();
  loadTimesheets();
}

function updateWeekDates() {
  const weekEnd = new Date(currentWeekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  document.getElementById('startDate').value = currentWeekStart.toISOString().split('T')[0];
  document.getElementById('endDate').value = weekEnd.toISOString().split('T')[0];
}

// ============================================================
// REPORTS
// ============================================================

function openReportsModal() {
  // Set default dates
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  document.getElementById('reportStartDate').value = monthStart.toISOString().split('T')[0];
  document.getElementById('reportEndDate').value = today.toISOString().split('T')[0];

  loadReport();
  openModal('reportsModal');
}

function closeReportsModal() {
  closeModal('reportsModal');
}

function switchReportTab(tab) {
  currentReportTab = tab;
  document.querySelectorAll('#reportsModal .tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === tab);
  });
  loadReport();
}

async function loadReport() {
  const status = document.getElementById('reportStatus').value;
  const startDate = document.getElementById('reportStartDate').value;
  const endDate = document.getElementById('reportEndDate').value;
  const content = document.getElementById('reportContent');

  let url = `/api/timesheets/reports/by-${currentReportTab === 'byJob' ? 'job' : currentReportTab === 'byEmployee' ? 'employee' : 'period'}?`;
  const params = [];
  if (status) params.push(`status=${status}`);
  if (startDate) params.push(`start_date=${startDate}`);
  if (endDate) params.push(`end_date=${endDate}`);
  url += params.join('&');

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to load report');
    const data = await response.json();

    if (data.length === 0) {
      content.innerHTML = '<div class="empty-state"><p>No data for this period</p></div>';
      return;
    }

    const headers = currentReportTab === 'byJob'
      ? ['Job', 'Hours', 'OT', 'Base Cost', 'Burden', 'Total']
      : currentReportTab === 'byEmployee'
        ? ['Employee', 'Hours', 'OT', 'Base Cost', 'Burden', 'Total']
        : ['Period', 'Hours', 'OT', 'Base Cost', 'Burden', 'Total'];

    const rows = data.map(d => {
      const name = d.job_name || d.employee_name || d.period_name;
      return `
        <tr>
          <td>${name}</td>
          <td>${(d.total_hours || 0).toFixed(1)}</td>
          <td>${(d.overtime_hours || 0).toFixed(1)}</td>
          <td>${formatCurrency(d.base_cost)}</td>
          <td>${formatCurrency(d.burden_amount)}</td>
          <td><strong>${formatCurrency(d.total_cost)}</strong></td>
        </tr>
      `;
    }).join('');

    const totals = data.reduce((acc, d) => ({
      hours: acc.hours + (d.total_hours || 0),
      ot: acc.ot + (d.overtime_hours || 0),
      base: acc.base + (d.base_cost || 0),
      burden: acc.burden + (d.burden_amount || 0),
      total: acc.total + (d.total_cost || 0)
    }), { hours: 0, ot: 0, base: 0, burden: 0, total: 0 });

    content.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
        </thead>
        <tbody>
          ${rows}
          <tr class="totals-row">
            <td><strong>TOTAL</strong></td>
            <td><strong>${totals.hours.toFixed(1)}</strong></td>
            <td><strong>${totals.ot.toFixed(1)}</strong></td>
            <td><strong>${formatCurrency(totals.base)}</strong></td>
            <td><strong>${formatCurrency(totals.burden)}</strong></td>
            <td><strong>${formatCurrency(totals.total)}</strong></td>
          </tr>
        </tbody>
      </table>
    `;
  } catch (err) {
    content.innerHTML = `<div class="error-state"><p>Error: ${err.message}</p></div>`;
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

function formatDate(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString();
}

function formatShortDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function formatDateTime(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString();
}

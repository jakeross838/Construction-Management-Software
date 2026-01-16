// ============================================================
// SCHEDULE APP - Ross Built CMS
// ============================================================

let state = {
  schedule: null,
  tasks: [],
  jobs: [],
  vendors: [],
  currentJobId: null,
  filters: {
    phase: '',
    trade: '',
    status: ''
  },
  currentView: 'list'  // 'list' or 'gantt'
};

// Construction trades (shared with daily logs)
const trades = [
  { id: 'framing', name: 'Framing' },
  { id: 'electrical', name: 'Electrical' },
  { id: 'plumbing', name: 'Plumbing' },
  { id: 'hvac', name: 'HVAC' },
  { id: 'roofing', name: 'Roofing' },
  { id: 'drywall', name: 'Drywall' },
  { id: 'painting', name: 'Painting' },
  { id: 'flooring', name: 'Flooring' },
  { id: 'tile', name: 'Tile' },
  { id: 'concrete', name: 'Concrete' },
  { id: 'masonry', name: 'Masonry' },
  { id: 'carpentry', name: 'Carpentry' },
  { id: 'finish-carpentry', name: 'Finish Carpentry' },
  { id: 'cabinetry', name: 'Cabinetry' },
  { id: 'countertops', name: 'Countertops' },
  { id: 'insulation', name: 'Insulation' },
  { id: 'windows-doors', name: 'Windows & Doors' },
  { id: 'siding', name: 'Siding' },
  { id: 'stucco', name: 'Stucco' },
  { id: 'landscaping', name: 'Landscaping' },
  { id: 'irrigation', name: 'Irrigation' },
  { id: 'pool', name: 'Pool' },
  { id: 'fencing', name: 'Fencing' },
  { id: 'garage-doors', name: 'Garage Doors' },
  { id: 'appliances', name: 'Appliances' },
  { id: 'fire-sprinkler', name: 'Fire Sprinkler' },
  { id: 'low-voltage', name: 'Low Voltage' },
  { id: 'security', name: 'Security' },
  { id: 'cleaning', name: 'Cleaning' },
  { id: 'general-labor', name: 'General Labor' },
  { id: 'excavation', name: 'Excavation' },
  { id: 'grading', name: 'Grading' },
  { id: 'foundation', name: 'Foundation' },
  { id: 'steel', name: 'Steel/Iron' },
  { id: 'waterproofing', name: 'Waterproofing' },
  { id: 'demolition', name: 'Demolition' },
  { id: 'other', name: 'Other' }
];

// Construction phases (high-level project stages)
const constructionPhases = [
  { id: 'preconstruction', name: 'Preconstruction' },
  { id: 'sitework', name: 'Site Work' },
  { id: 'foundation', name: 'Foundation' },
  { id: 'framing', name: 'Framing' },
  { id: 'roofing', name: 'Roofing' },
  { id: 'rough-ins', name: 'Rough-Ins (MEP)' },
  { id: 'insulation', name: 'Insulation' },
  { id: 'drywall', name: 'Drywall' },
  { id: 'exterior', name: 'Exterior Finishes' },
  { id: 'interior-finishes', name: 'Interior Finishes' },
  { id: 'cabinetry', name: 'Cabinetry & Counters' },
  { id: 'paint', name: 'Paint' },
  { id: 'flooring', name: 'Flooring' },
  { id: 'trim', name: 'Trim & Finish Carpentry' },
  { id: 'mep-finals', name: 'MEP Finals' },
  { id: 'fixtures', name: 'Fixtures & Appliances' },
  { id: 'landscaping', name: 'Landscaping' },
  { id: 'punch-cleanup', name: 'Punch & Cleanup' },
  { id: 'closeout', name: 'Closeout' }
];

// ============================================================
// INITIALIZATION
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
  await Promise.all([
    loadJobs(),
    loadVendors()
  ]);

  // Sidebar integration - listen for job selection changes
  if (window.JobSidebar) {
    window.JobSidebar.onJobChange((jobId) => {
      state.currentJobId = jobId;
      loadSchedule();
    });

    // Get initial job selection
    state.currentJobId = window.JobSidebar.getSelectedJobId();
  }

  // Setup date calculation listeners in modal
  setupDateCalculations();

  // Load schedule if job is selected
  if (state.currentJobId) {
    await loadSchedule();
  } else {
    showNoJobSelected();
  }
});

// ============================================================
// DATA LOADING
// ============================================================

async function loadJobs() {
  try {
    const res = await fetch('/api/jobs');
    state.jobs = await res.json();
  } catch (err) {
    console.error('Failed to load jobs:', err);
  }
}

async function loadVendors() {
  try {
    const res = await fetch('/api/vendors');
    state.vendors = await res.json();
  } catch (err) {
    console.error('Failed to load vendors:', err);
  }
}

async function loadSchedule() {
  if (!state.currentJobId) {
    showNoJobSelected();
    return;
  }

  hideAllStates();
  showLoading();

  try {
    const res = await fetch(`/api/schedules/by-job/${state.currentJobId}`);

    if (res.status === 404) {
      // No schedule exists yet
      state.schedule = null;
      state.tasks = [];
      showNoSchedule();
      return;
    }

    if (!res.ok) throw new Error('Failed to load schedule');

    state.schedule = await res.json();
    state.tasks = state.schedule.tasks || [];

    showSchedule();
    renderSchedule();
    updateStats();
    populateFilters();
  } catch (err) {
    console.error('Failed to load schedule:', err);
    showToast('Failed to load schedule', 'error');
    showNoSchedule();
  }
}

// ============================================================
// UI STATE MANAGEMENT
// ============================================================

function hideAllStates() {
  document.getElementById('noJobSelected').style.display = 'none';
  document.getElementById('noSchedule').style.display = 'none';
  document.getElementById('scheduleHeader').style.display = 'none';
  document.getElementById('scheduleStats').style.display = 'none';
  document.getElementById('listView').style.display = 'none';
  document.getElementById('ganttView').style.display = 'none';
  document.getElementById('addTaskBtn').style.display = 'none';
}

function showLoading() {
  const listView = document.getElementById('listView');
  listView.style.display = 'block';
  document.getElementById('taskTableBody').innerHTML = '<tr><td colspan="8" class="loading">Loading schedule...</td></tr>';
}

function showNoJobSelected() {
  hideAllStates();
  document.getElementById('noJobSelected').style.display = 'flex';
}

function showNoSchedule() {
  hideAllStates();
  document.getElementById('noSchedule').style.display = 'flex';
}

function showSchedule() {
  hideAllStates();
  document.getElementById('scheduleHeader').style.display = 'flex';
  document.getElementById('scheduleStats').style.display = 'grid';
  document.getElementById('addTaskBtn').style.display = '';

  // Update schedule info
  document.getElementById('scheduleName').textContent = state.schedule.name || 'Master Schedule';

  const statusEl = document.getElementById('scheduleStatus');
  statusEl.textContent = formatStatus(state.schedule.status);
  statusEl.className = 'schedule-status status-' + state.schedule.status;

  const dates = [];
  if (state.schedule.start_date) {
    dates.push('Start: ' + formatDate(state.schedule.start_date));
  }
  if (state.schedule.target_end_date) {
    dates.push('Target End: ' + formatDate(state.schedule.target_end_date));
  }
  document.getElementById('scheduleDates').textContent = dates.join(' | ');

  // Show correct view
  setView(state.currentView);
}

// ============================================================
// VIEW TOGGLE
// ============================================================

function setView(view) {
  state.currentView = view;

  // Update button states
  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });

  // Show/hide views
  document.getElementById('listView').style.display = view === 'list' ? 'block' : 'none';
  document.getElementById('ganttView').style.display = view === 'gantt' ? 'block' : 'none';

  // Render the appropriate view
  if (view === 'gantt') {
    renderGantt();
  } else {
    renderTaskList();
  }
}

// ============================================================
// FILTERS
// ============================================================

function populateFilters() {
  // Get unique phases and trades from tasks
  const phases = [...new Set(state.tasks.map(t => t.construction_phase).filter(Boolean))];
  const taskTrades = [...new Set(state.tasks.map(t => t.trade).filter(Boolean))];

  // Populate phase filter
  const phaseSelect = document.getElementById('phaseFilter');
  phaseSelect.innerHTML = '<option value="">All Phases</option>';
  phases.forEach(phase => {
    const phaseInfo = constructionPhases.find(p => p.id === phase);
    phaseSelect.innerHTML += `<option value="${phase}">${phaseInfo?.name || phase}</option>`;
  });

  // Populate trade filter
  const tradeSelect = document.getElementById('tradeFilter');
  tradeSelect.innerHTML = '<option value="">All Trades</option>';
  taskTrades.forEach(trade => {
    const tradeInfo = trades.find(t => t.id === trade);
    tradeSelect.innerHTML += `<option value="${trade}">${tradeInfo?.name || trade}</option>`;
  });
}

function applyFilters() {
  state.filters.phase = document.getElementById('phaseFilter').value;
  state.filters.trade = document.getElementById('tradeFilter').value;
  state.filters.status = document.getElementById('statusFilter').value;

  renderSchedule();
}

function getFilteredTasks() {
  return state.tasks.filter(task => {
    if (state.filters.phase && task.construction_phase !== state.filters.phase) return false;
    if (state.filters.trade && task.trade !== state.filters.trade) return false;
    if (state.filters.status && task.status !== state.filters.status) return false;
    return true;
  });
}

// ============================================================
// LIST VIEW RENDERING
// ============================================================

function renderSchedule() {
  if (state.currentView === 'gantt') {
    renderGantt();
  } else {
    renderTaskList();
  }
}

function renderTaskList() {
  const tbody = document.getElementById('taskTableBody');
  const tasks = getFilteredTasks();

  if (tasks.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="empty-cell">
          <div class="empty-state-inline">
            <p>${state.tasks.length === 0 ? 'No tasks yet. Add your first task to get started.' : 'No tasks match your filters.'}</p>
            ${state.tasks.length === 0 ? '<button class="btn btn-primary btn-sm" onclick="openTaskModal()">+ Add Task</button>' : ''}
          </div>
        </td>
      </tr>
    `;
    return;
  }

  // Sort by sort_order, then by planned_start
  tasks.sort((a, b) => {
    if (a.sort_order !== b.sort_order) return (a.sort_order || 999) - (b.sort_order || 999);
    if (a.planned_start && b.planned_start) return new Date(a.planned_start) - new Date(b.planned_start);
    return 0;
  });

  tbody.innerHTML = tasks.map(task => renderTaskRow(task)).join('');
}

function renderTaskRow(task) {
  const tradeName = trades.find(t => t.id === task.trade)?.name || task.trade || '-';
  const phaseName = constructionPhases.find(p => p.id === task.construction_phase)?.name || task.construction_phase || '-';

  const plannedRange = formatDateRange(task.planned_start, task.planned_end);
  const actualRange = formatDateRange(task.actual_start, task.actual_end);

  const progressClass = getProgressClass(task.completion_percent);
  const statusClass = getStatusClass(task.status);

  return `
    <tr class="task-row" onclick="openTaskModal('${task.id}')">
      <td class="col-task">
        <div class="task-name">${escapeHtml(task.name)}</div>
        ${task.description ? `<div class="task-desc">${escapeHtml(truncate(task.description, 60))}</div>` : ''}
      </td>
      <td class="col-trade">${escapeHtml(tradeName)}</td>
      <td class="col-phase">${escapeHtml(phaseName)}</td>
      <td class="col-dates">${plannedRange}</td>
      <td class="col-dates">${actualRange}</td>
      <td class="col-progress">
        <div class="progress-bar-mini ${progressClass}">
          <div class="progress-fill" style="width: ${task.completion_percent || 0}%"></div>
        </div>
        <span class="progress-text">${task.completion_percent || 0}%</span>
      </td>
      <td class="col-status">
        <span class="status-badge ${statusClass}">${formatStatus(task.status)}</span>
      </td>
      <td class="col-actions">
        <button class="btn btn-icon" onclick="event.stopPropagation(); openTaskModal('${task.id}')" title="Edit">
          <span>✏️</span>
        </button>
      </td>
    </tr>
  `;
}

// ============================================================
// GANTT VIEW RENDERING
// ============================================================

function renderGantt() {
  const tasks = getFilteredTasks();

  if (tasks.length === 0) {
    document.getElementById('ganttHeader').innerHTML = '';
    document.getElementById('ganttBody').innerHTML = `
      <div class="gantt-empty">
        <p>${state.tasks.length === 0 ? 'No tasks yet. Add your first task to get started.' : 'No tasks match your filters.'}</p>
        ${state.tasks.length === 0 ? '<button class="btn btn-primary btn-sm" onclick="openTaskModal()">+ Add Task</button>' : ''}
      </div>
    `;
    return;
  }

  // Calculate date range
  const { minDate, maxDate } = getDateRange(tasks);
  const days = getDaysBetween(minDate, maxDate);

  // Render header with dates
  renderGanttHeader(minDate, days);

  // Render task bars
  renderGanttRows(tasks, minDate, days);
}

function getDateRange(tasks) {
  let minDate = null;
  let maxDate = null;

  tasks.forEach(task => {
    const start = task.planned_start ? new Date(task.planned_start) : null;
    const end = task.planned_end ? new Date(task.planned_end) : null;
    const actualStart = task.actual_start ? new Date(task.actual_start) : null;
    const actualEnd = task.actual_end ? new Date(task.actual_end) : null;

    [start, end, actualStart, actualEnd].forEach(date => {
      if (date) {
        if (!minDate || date < minDate) minDate = new Date(date);
        if (!maxDate || date > maxDate) maxDate = new Date(date);
      }
    });
  });

  // Default to current month if no dates
  if (!minDate) minDate = new Date();
  if (!maxDate) maxDate = new Date(minDate.getTime() + 30 * 24 * 60 * 60 * 1000);

  // Add padding
  minDate.setDate(minDate.getDate() - 3);
  maxDate.setDate(maxDate.getDate() + 7);

  return { minDate, maxDate };
}

function getDaysBetween(start, end) {
  const days = [];
  const current = new Date(start);
  while (current <= end) {
    days.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return days;
}

function renderGanttHeader(minDate, days) {
  const header = document.getElementById('ganttHeader');

  // Group by week
  const weeks = {};
  days.forEach(day => {
    const weekStart = getWeekStart(day);
    const key = weekStart.toISOString();
    if (!weeks[key]) {
      weeks[key] = { start: weekStart, days: [] };
    }
    weeks[key].days.push(day);
  });

  let headerHTML = '<div class="gantt-label-col">Task</div>';
  headerHTML += '<div class="gantt-timeline">';

  // Week row
  headerHTML += '<div class="gantt-weeks">';
  Object.values(weeks).forEach(week => {
    const label = week.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    headerHTML += `<div class="gantt-week" style="width: ${week.days.length * 30}px">${label}</div>`;
  });
  headerHTML += '</div>';

  // Day row
  headerHTML += '<div class="gantt-days">';
  days.forEach(day => {
    const isWeekend = day.getDay() === 0 || day.getDay() === 6;
    const isToday = isSameDay(day, new Date());
    const dayNum = day.getDate();
    headerHTML += `<div class="gantt-day ${isWeekend ? 'weekend' : ''} ${isToday ? 'today' : ''}">${dayNum}</div>`;
  });
  headerHTML += '</div>';

  headerHTML += '</div>';
  header.innerHTML = headerHTML;
}

function renderGanttRows(tasks, minDate, days) {
  const body = document.getElementById('ganttBody');

  // Sort tasks
  tasks.sort((a, b) => {
    if (a.sort_order !== b.sort_order) return (a.sort_order || 999) - (b.sort_order || 999);
    if (a.planned_start && b.planned_start) return new Date(a.planned_start) - new Date(b.planned_start);
    return 0;
  });

  let bodyHTML = '';
  tasks.forEach(task => {
    bodyHTML += renderGanttRow(task, minDate, days);
  });

  body.innerHTML = bodyHTML;
}

function renderGanttRow(task, minDate, days) {
  const totalDays = days.length;
  const dayWidth = 30; // pixels per day

  // Calculate bar position and width
  let barLeft = 0;
  let barWidth = dayWidth;
  let barClass = 'gantt-bar-' + task.status;

  if (task.planned_start) {
    const start = new Date(task.planned_start);
    barLeft = Math.max(0, dateDiffDays(minDate, start)) * dayWidth;
  }

  if (task.planned_start && task.planned_end) {
    const start = new Date(task.planned_start);
    const end = new Date(task.planned_end);
    barWidth = Math.max(1, dateDiffDays(start, end) + 1) * dayWidth;
  } else if (task.planned_duration_days) {
    barWidth = task.planned_duration_days * dayWidth;
  }

  // Progress fill
  const progressWidth = (task.completion_percent || 0) / 100 * barWidth;

  // Create grid cells for background
  let gridHTML = '';
  days.forEach(day => {
    const isWeekend = day.getDay() === 0 || day.getDay() === 6;
    const isToday = isSameDay(day, new Date());
    gridHTML += `<div class="gantt-cell ${isWeekend ? 'weekend' : ''} ${isToday ? 'today' : ''}"></div>`;
  });

  return `
    <div class="gantt-row" onclick="openTaskModal('${task.id}')">
      <div class="gantt-label-col">
        <span class="gantt-task-name">${escapeHtml(truncate(task.name, 25))}</span>
      </div>
      <div class="gantt-timeline">
        <div class="gantt-grid">${gridHTML}</div>
        <div class="gantt-bar ${barClass}" style="left: ${barLeft}px; width: ${barWidth}px;">
          <div class="gantt-progress" style="width: ${progressWidth}px;"></div>
          <span class="gantt-bar-label">${task.completion_percent || 0}%</span>
        </div>
      </div>
    </div>
  `;
}

// ============================================================
// STATS
// ============================================================

function updateStats() {
  const total = state.tasks.length;
  const pending = state.tasks.filter(t => t.status === 'pending').length;
  const inProgress = state.tasks.filter(t => t.status === 'in_progress').length;
  const completed = state.tasks.filter(t => t.status === 'completed').length;

  // Calculate overall progress
  let overallProgress = 0;
  if (total > 0) {
    const totalPercent = state.tasks.reduce((sum, t) => sum + (t.completion_percent || 0), 0);
    overallProgress = Math.round(totalPercent / total);
  }

  document.getElementById('statTotalTasks').textContent = total;
  document.getElementById('statPending').textContent = pending;
  document.getElementById('statInProgress').textContent = inProgress;
  document.getElementById('statCompleted').textContent = completed;
  document.getElementById('statOverall').textContent = overallProgress + '%';
}

// ============================================================
// CREATE SCHEDULE
// ============================================================

async function createSchedule() {
  if (!state.currentJobId) {
    showToast('Please select a job first', 'error');
    return;
  }

  try {
    const res = await fetch('/api/schedules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        job_id: state.currentJobId,
        name: 'Master Schedule',
        status: 'draft'
      })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to create schedule');
    }

    state.schedule = await res.json();
    state.tasks = [];
    showSchedule();
    renderSchedule();
    updateStats();
    showToast('Schedule created', 'success');
  } catch (err) {
    console.error('Failed to create schedule:', err);
    showToast(err.message, 'error');
  }
}

// ============================================================
// TASK MODAL
// ============================================================

function openTaskModal(taskId = null) {
  const modal = document.getElementById('taskModal');
  const title = document.getElementById('taskModalTitle');
  const deleteBtn = document.getElementById('deleteTaskBtn');

  // Reset form
  document.getElementById('editTaskId').value = taskId || '';
  document.getElementById('taskName').value = '';
  document.getElementById('taskDescription').value = '';
  document.getElementById('taskPlannedStart').value = '';
  document.getElementById('taskPlannedEnd').value = '';
  document.getElementById('taskDuration').value = '';
  document.getElementById('taskActualStart').value = '';
  document.getElementById('taskActualEnd').value = '';
  document.getElementById('taskCompletion').value = '0';
  document.getElementById('taskStatus').value = 'pending';

  // Initialize pickers
  initTaskPickers();

  if (taskId) {
    // Edit mode
    title.textContent = 'Edit Task';
    deleteBtn.style.display = '';
    loadTaskIntoModal(taskId);
  } else {
    // Create mode
    title.textContent = 'Add Task';
    deleteBtn.style.display = 'none';
  }

  modal.style.display = 'flex';
}

function closeTaskModal() {
  document.getElementById('taskModal').style.display = 'none';
}

function initTaskPickers() {
  // Trade picker
  const tradeContainer = document.getElementById('taskTradeContainer');
  if (window.SearchablePicker) {
    window.SearchablePicker.init(tradeContainer, {
      type: 'custom',
      items: trades,
      placeholder: 'Select trade...',
      onChange: () => {}
    });
  }

  // Phase picker
  const phaseContainer = document.getElementById('taskPhaseContainer');
  if (window.SearchablePicker) {
    window.SearchablePicker.init(phaseContainer, {
      type: 'custom',
      items: constructionPhases,
      placeholder: 'Select phase...',
      onChange: () => {}
    });
  }

  // Vendor picker
  const vendorContainer = document.getElementById('taskVendorContainer');
  if (window.SearchablePicker) {
    window.SearchablePicker.init(vendorContainer, {
      type: 'vendors',
      placeholder: 'Assign vendor...',
      onChange: () => {}
    });
  }

  // Dependencies picker (multi-select would be nice but use single for now)
  const depContainer = document.getElementById('taskDependenciesContainer');
  if (window.SearchablePicker) {
    const otherTasks = state.tasks.map(t => ({ id: t.id, name: t.name }));
    window.SearchablePicker.init(depContainer, {
      type: 'custom',
      items: otherTasks,
      placeholder: 'Select dependency...',
      onChange: () => {}
    });
  }
}

function loadTaskIntoModal(taskId) {
  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return;

  document.getElementById('taskName').value = task.name || '';
  document.getElementById('taskDescription').value = task.description || '';
  document.getElementById('taskPlannedStart').value = task.planned_start || '';
  document.getElementById('taskPlannedEnd').value = task.planned_end || '';
  document.getElementById('taskDuration').value = task.planned_duration_days || '';
  document.getElementById('taskActualStart').value = task.actual_start || '';
  document.getElementById('taskActualEnd').value = task.actual_end || '';
  document.getElementById('taskCompletion').value = task.completion_percent || 0;
  document.getElementById('taskStatus').value = task.status || 'pending';

  // Set picker values
  setTimeout(() => {
    if (task.trade) {
      const tradePicker = document.querySelector('#taskTradeContainer .search-picker');
      if (tradePicker && window.SearchablePicker) {
        window.SearchablePicker.setValue(tradePicker, task.trade);
      }
    }
    if (task.construction_phase) {
      const phasePicker = document.querySelector('#taskPhaseContainer .search-picker');
      if (phasePicker && window.SearchablePicker) {
        window.SearchablePicker.setValue(phasePicker, task.construction_phase);
      }
    }
    if (task.vendor_id) {
      const vendorPicker = document.querySelector('#taskVendorContainer .search-picker');
      if (vendorPicker && window.SearchablePicker) {
        window.SearchablePicker.setValue(vendorPicker, task.vendor_id);
      }
    }
    if (task.depends_on && task.depends_on.length > 0) {
      const depPicker = document.querySelector('#taskDependenciesContainer .search-picker');
      if (depPicker && window.SearchablePicker) {
        window.SearchablePicker.setValue(depPicker, task.depends_on[0]);
      }
    }
  }, 100);
}

function setupDateCalculations() {
  const startInput = document.getElementById('taskPlannedStart');
  const endInput = document.getElementById('taskPlannedEnd');
  const durationInput = document.getElementById('taskDuration');

  // Calculate duration when dates change
  startInput.addEventListener('change', () => {
    if (startInput.value && endInput.value) {
      const days = dateDiffDays(new Date(startInput.value), new Date(endInput.value)) + 1;
      durationInput.value = days;
    }
  });

  endInput.addEventListener('change', () => {
    if (startInput.value && endInput.value) {
      const days = dateDiffDays(new Date(startInput.value), new Date(endInput.value)) + 1;
      durationInput.value = days;
    }
  });

  // Calculate end date when duration changes
  durationInput.addEventListener('change', () => {
    if (startInput.value && durationInput.value) {
      const start = new Date(startInput.value);
      const end = new Date(start);
      end.setDate(end.getDate() + parseInt(durationInput.value) - 1);
      endInput.value = end.toISOString().split('T')[0];
    }
  });
}

async function saveTask() {
  const taskId = document.getElementById('editTaskId').value;
  const name = document.getElementById('taskName').value.trim();

  if (!name) {
    showToast('Task name is required', 'error');
    return;
  }

  // Get picker values
  const tradePicker = document.querySelector('#taskTradeContainer .search-picker-value');
  const phasePicker = document.querySelector('#taskPhaseContainer .search-picker-value');
  const vendorPicker = document.querySelector('#taskVendorContainer .search-picker-value');
  const depPicker = document.querySelector('#taskDependenciesContainer .search-picker-value');

  const taskData = {
    name,
    description: document.getElementById('taskDescription').value.trim() || null,
    trade: tradePicker?.value || null,
    construction_phase: phasePicker?.value || null,
    planned_start: document.getElementById('taskPlannedStart').value || null,
    planned_end: document.getElementById('taskPlannedEnd').value || null,
    planned_duration_days: parseInt(document.getElementById('taskDuration').value) || null,
    actual_start: document.getElementById('taskActualStart').value || null,
    actual_end: document.getElementById('taskActualEnd').value || null,
    completion_percent: parseInt(document.getElementById('taskCompletion').value) || 0,
    status: document.getElementById('taskStatus').value,
    vendor_id: vendorPicker?.value || null,
    depends_on: depPicker?.value ? [depPicker.value] : []
  };

  try {
    let res;
    if (taskId) {
      // Update existing task
      res = await fetch(`/api/schedules/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData)
      });
    } else {
      // Create new task
      res = await fetch(`/api/schedules/${state.schedule.id}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData)
      });
    }

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to save task');
    }

    closeTaskModal();
    await loadSchedule();
    showToast(taskId ? 'Task updated' : 'Task created', 'success');
  } catch (err) {
    console.error('Failed to save task:', err);
    showToast(err.message, 'error');
  }
}

async function deleteTask() {
  const taskId = document.getElementById('editTaskId').value;
  if (!taskId) return;

  if (!confirm('Are you sure you want to delete this task?')) return;

  try {
    const res = await fetch(`/api/schedules/tasks/${taskId}`, {
      method: 'DELETE'
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to delete task');
    }

    closeTaskModal();
    await loadSchedule();
    showToast('Task deleted', 'success');
  } catch (err) {
    console.error('Failed to delete task:', err);
    showToast(err.message, 'error');
  }
}

// ============================================================
// HELPERS
// ============================================================

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDateRange(start, end) {
  if (!start && !end) return '-';
  if (!end) return formatDate(start);
  if (!start) return '- to ' + formatDate(end);
  return formatDate(start) + ' - ' + formatDate(end);
}

function formatStatus(status) {
  const statusMap = {
    draft: 'Draft',
    active: 'Active',
    completed: 'Completed',
    pending: 'Pending',
    in_progress: 'In Progress',
    blocked: 'Blocked'
  };
  return statusMap[status] || status;
}

function getStatusClass(status) {
  const classMap = {
    pending: 'status-pending',
    in_progress: 'status-progress',
    completed: 'status-complete',
    blocked: 'status-blocked'
  };
  return classMap[status] || 'status-pending';
}

function getProgressClass(percent) {
  if (percent >= 100) return 'progress-complete';
  if (percent >= 50) return 'progress-half';
  if (percent > 0) return 'progress-started';
  return 'progress-none';
}

function truncate(str, len) {
  if (!str) return '';
  return str.length > len ? str.substring(0, len) + '...' : str;
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function dateDiffDays(date1, date2) {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffTime = d2.getTime() - d1.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function isSameDay(d1, d2) {
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate();
}

function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day;
  return new Date(d.setDate(diff));
}

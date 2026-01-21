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
  currentView: "list",  // "list", "gantt", "calendar", or "agenda"
  showCriticalPath: true,  // Toggle for critical path highlighting
  criticalPath: new Set(),  // Set of critical task IDs
  taskMetrics: {},  // ES, EF, LS, LF, slack per task
  // Calendar view state
  calendarDate: new Date(),
  // Agenda view state
  agendaVendorId: "",
  agendaDateFilter: "all"
};

// ============================================================
// DRAG-AND-DROP STATE
// ============================================================

let dragState = {
  isDragging: false,
  taskId: null,
  startX: 0,
  originalLeft: 0,
  barElement: null,
  dayWidth: 30,
  minDate: null
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
  // Setup date calculation listeners in modal FIRST - so UI is responsive
  setupDateCalculations();

  // Load reference data with error handling
  try {
    await Promise.all([
      loadJobs().catch(err => console.error('Jobs load failed:', err)),
      loadVendors().catch(err => console.error('Vendors load failed:', err))
    ]);
  } catch (err) {
    console.error('Initial data load failed:', err);
  }

  // Sidebar integration - listen for job selection changes
  if (window.JobSidebar) {
    window.JobSidebar.onJobChange((jobId) => {
      state.currentJobId = jobId;
      loadSchedule();
    });

    // Get initial job selection
    state.currentJobId = window.JobSidebar.getSelectedJobId();
  }

  // Load schedule if job is selected
  if (state.currentJobId) {
    try {
      await loadSchedule();
    } catch (err) {
      console.error('Schedule load failed:', err);
    }
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

    // Handle case where API returns null (no schedule exists)
    if (!state.schedule) {
      state.tasks = [];
      showNoSchedule();
      return;
    }

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

  // Hide critical path toggle when no schedule
  const criticalPathToggle = document.getElementById('criticalPathToggle');
  if (criticalPathToggle) {
    criticalPathToggle.style.display = 'none';
  }
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

  // Show critical path toggle
  const criticalPathToggle = document.getElementById('criticalPathToggle');
  if (criticalPathToggle) {
    criticalPathToggle.style.display = 'flex';
  }

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
  localStorage.setItem("scheduleView", view);

  document.querySelectorAll(".view-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.view === view);
  });

  document.getElementById("listView").style.display = view === "list" ? "block" : "none";
  document.getElementById("ganttView").style.display = view === "gantt" ? "block" : "none";
  document.getElementById("calendarView").style.display = view === "calendar" ? "block" : "none";
  document.getElementById("agendaView").style.display = view === "agenda" ? "block" : "none";

  switch (view) {
    case "gantt":
      renderGantt();
      initDragHandlers();
      break;
    case "calendar":
      renderCalendar();
      break;
    case "agenda":
      populateAgendaVendors();
      renderAgenda();
      break;
    default:
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

  // Calculate critical path (use all tasks to get accurate path, not just filtered)
  const { criticalTaskIds, taskMetrics } = calculateCriticalPath(state.tasks);
  state.criticalPath = criticalTaskIds;
  state.taskMetrics = taskMetrics;

  // Sort by sort_order, then by planned_start
  tasks.sort((a, b) => {
    if (a.sort_order !== b.sort_order) return (a.sort_order || 999) - (b.sort_order || 999);
    if (a.planned_start && b.planned_start) return new Date(a.planned_start) - new Date(b.planned_start);
    return 0;
  });

  tbody.innerHTML = tasks.map(task => {
    const isCritical = state.showCriticalPath && criticalTaskIds.has(task.id);
    return renderTaskRow(task, isCritical);
  }).join('');
}

function renderTaskRow(task, isCritical = false) {
  const tradeName = trades.find(t => t.id === task.trade)?.name || task.trade || '-';
  const phaseName = constructionPhases.find(p => p.id === task.construction_phase)?.name || task.construction_phase || '-';

  const plannedRange = formatDateRange(task.planned_start, task.planned_end);
  const actualRange = formatDateRange(task.actual_start, task.actual_end);

  const progressClass = getProgressClass(task.completion_percent);
  const statusClass = getStatusClass(task.status);
  const criticalClass = isCritical ? ' critical-path' : '';

  return `
    <tr class="task-row${criticalClass}" onclick="openTaskModal('${task.id}')">
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

  // Calculate critical path (use all tasks to get accurate path, not just filtered)
  const { criticalTaskIds, taskMetrics } = calculateCriticalPath(state.tasks);
  state.criticalPath = criticalTaskIds;
  state.taskMetrics = taskMetrics;

  // Calculate date range
  const { minDate, maxDate } = getDateRange(tasks);
  const days = getDaysBetween(minDate, maxDate);

  // Render header with dates
  renderGanttHeader(minDate, days);

  // Render task bars with critical path info
  renderGanttRows(tasks, minDate, days, criticalTaskIds);
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
    const dateStr = day.toISOString().split('T')[0];
    headerHTML += `<div class="gantt-day gantt-header-day ${isWeekend ? 'weekend' : ''} ${isToday ? 'today' : ''}" data-date="${dateStr}">${dayNum}</div>`;
  });
  headerHTML += '</div>';

  headerHTML += '</div>';
  header.innerHTML = headerHTML;
}

function renderGanttRows(tasks, minDate, days, criticalTaskIds = new Set()) {
  const body = document.getElementById('ganttBody');

  // Sort tasks
  tasks.sort((a, b) => {
    if (a.sort_order !== b.sort_order) return (a.sort_order || 999) - (b.sort_order || 999);
    if (a.planned_start && b.planned_start) return new Date(a.planned_start) - new Date(b.planned_start);
    return 0;
  });

  let bodyHTML = '';
  tasks.forEach(task => {
    const isCritical = state.showCriticalPath && criticalTaskIds.has(task.id);
    bodyHTML += renderGanttRow(task, minDate, days, isCritical);
  });

  body.innerHTML = bodyHTML;
}

function renderGanttRow(task, minDate, days, isCritical = false) {
  const totalDays = days.length;
  const dayWidth = 30; // pixels per day

  // Calculate bar position and width
  let barLeft = 0;
  let barWidth = dayWidth;
  let barClass = 'gantt-bar-' + task.status;

  // Add critical path class if task is on critical path
  if (isCritical) {
    barClass += ' critical-path';
  }

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

  // Build tooltip with critical path info
  const criticalInfo = isCritical ? '\nCRITICAL PATH - Zero slack' : '';
  const tooltipText = `${escapeHtml(task.name)}\n${formatDate(task.planned_start)} - ${formatDate(task.planned_end)}${criticalInfo}`;

  // Build critical badge for task label
  const criticalBadge = isCritical ? '<span class="critical-badge">Critical</span>' : '';

  return `
    <div class="gantt-row${isCritical ? ' critical-path' : ''}">
      <div class="gantt-label-col" onclick="openTaskModal('${task.id}')">
        <span class="gantt-task-name">${escapeHtml(truncate(task.name, 25))}</span>
        ${criticalBadge}
      </div>
      <div class="gantt-timeline">
        <div class="gantt-grid">${gridHTML}</div>
        <div class="gantt-bar ${barClass}" data-task-id="${task.id}" style="left: ${barLeft}px; width: ${barWidth}px;" title="${tooltipText}">
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
  modal.classList.add('show');
}

function closeTaskModal() {
  const modal = document.getElementById('taskModal');
  modal.classList.remove('show');
  modal.style.display = 'none';
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

// ============================================================
// DRAG-AND-DROP FUNCTIONALITY
// ============================================================

function initDragHandlers() {
  const ganttBody = document.getElementById('ganttBody');
  if (!ganttBody) return;

  // Delegate mouse events to gantt body container
  ganttBody.addEventListener('mousedown', handleDragStart);
  document.addEventListener('mousemove', handleDragMove);
  document.addEventListener('mouseup', handleDragEnd);
}

function handleDragStart(e) {
  // Find the gantt bar element (check multiple class patterns)
  const bar = e.target.closest('.gantt-bar-pending, .gantt-bar-in_progress, .gantt-bar-completed, .gantt-bar-blocked');
  if (!bar) return;

  const taskId = bar.dataset.taskId;
  if (!taskId) return;

  e.preventDefault();
  e.stopPropagation();

  // Calculate day width from gantt header
  const headerDays = document.querySelectorAll('.gantt-header-day');
  let dayWidth = 30; // default fallback
  if (headerDays.length > 1) {
    dayWidth = headerDays[1].offsetLeft - headerDays[0].offsetLeft;
  } else if (headerDays.length === 1) {
    dayWidth = headerDays[0].offsetWidth;
  }

  // Get min date from first header cell
  const firstCell = document.querySelector('.gantt-header-day');
  const minDate = firstCell && firstCell.dataset.date ? new Date(firstCell.dataset.date) : new Date();

  dragState = {
    isDragging: true,
    taskId: taskId,
    startX: e.clientX,
    originalLeft: bar.offsetLeft,
    barElement: bar,
    dayWidth: dayWidth,
    minDate: minDate
  };

  bar.classList.add('dragging');
  document.body.style.cursor = 'grabbing';
  document.body.style.userSelect = 'none';
}

function handleDragMove(e) {
  if (!dragState.isDragging || !dragState.barElement) return;

  const deltaX = e.clientX - dragState.startX;
  const newLeft = Math.max(0, dragState.originalLeft + deltaX);

  dragState.barElement.style.left = `${newLeft}px`;

  // Show date preview tooltip
  const dayOffset = Math.round(newLeft / dragState.dayWidth);
  const newDate = new Date(dragState.minDate);
  newDate.setDate(newDate.getDate() + dayOffset);
  showDragTooltip(e, newDate);
}

function handleDragEnd(e) {
  if (!dragState.isDragging) return;

  const bar = dragState.barElement;
  if (bar) {
    bar.classList.remove('dragging');

    // Calculate new start date from final position
    const newLeft = bar.offsetLeft;
    const dayOffset = Math.round(newLeft / dragState.dayWidth);
    const newStartDate = new Date(dragState.minDate);
    newStartDate.setDate(newStartDate.getDate() + dayOffset);

    // Get task to calculate duration
    const task = state.tasks.find(t => t.id === dragState.taskId);
    if (task) {
      const duration = task.planned_duration_days || 1;
      const newEndDate = new Date(newStartDate);
      newEndDate.setDate(newEndDate.getDate() + duration - 1);

      // Update task via API
      updateTaskDates(dragState.taskId, newStartDate, newEndDate);
    }
  }

  hideDragTooltip();
  document.body.style.cursor = '';
  document.body.style.userSelect = '';

  dragState = {
    isDragging: false,
    taskId: null,
    startX: 0,
    originalLeft: 0,
    barElement: null,
    dayWidth: 30,
    minDate: null
  };
}

async function updateTaskDates(taskId, startDate, endDate) {
  try {
    const res = await fetch(`/api/schedules/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        planned_start: startDate.toISOString().split('T')[0],
        planned_end: endDate.toISOString().split('T')[0]
      })
    });

    if (!res.ok) {
      const err = await res.json();
      showToast(err.message || 'Failed to update task', 'error');
      await loadSchedule(); // Revert to server state
      return;
    }

    showToast('Task rescheduled', 'success');
    await loadSchedule(); // Refresh to show updated state
  } catch (err) {
    console.error('Failed to update task dates:', err);
    showToast('Failed to update task', 'error');
    await loadSchedule();
  }
}

function showDragTooltip(e, date) {
  let tooltip = document.getElementById('dragTooltip');
  if (!tooltip) {
    tooltip = document.createElement('div');
    tooltip.id = 'dragTooltip';
    tooltip.className = 'drag-tooltip';
    document.body.appendChild(tooltip);
  }

  const formatted = date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });

  tooltip.textContent = formatted;
  tooltip.style.display = 'block';
  tooltip.style.left = `${e.clientX + 15}px`;
  tooltip.style.top = `${e.clientY - 35}px`;
}

function hideDragTooltip() {
  const tooltip = document.getElementById('dragTooltip');
  if (tooltip) {
    tooltip.style.display = 'none';
  }
}

// ============================================================
// CRITICAL PATH CALCULATION
// ============================================================

/**
 * Calculate critical path using forward/backward pass algorithm.
 * Critical path = tasks with zero slack (any delay impacts project end date).
 *
 * Algorithm:
 * 1. Build task dependency graph from depends_on array
 * 2. Forward pass: Calculate ES (Earliest Start) and EF (Earliest Finish)
 * 3. Backward pass: Calculate LS (Latest Start) and LF (Latest Finish)
 * 4. Slack = LS - ES
 * 5. Critical path = all tasks with Slack = 0
 */
function calculateCriticalPath(tasks) {
  if (!tasks || tasks.length === 0) {
    return { criticalTaskIds: new Set(), taskMetrics: {} };
  }

  // Build lookup maps
  const taskMap = new Map();
  const dependents = new Map(); // taskId -> array of tasks that depend on it

  tasks.forEach(task => {
    taskMap.set(task.id, task);
    dependents.set(task.id, []);
  });

  // Build dependents map (reverse of depends_on)
  tasks.forEach(task => {
    const deps = task.depends_on || [];
    deps.forEach(depId => {
      if (dependents.has(depId)) {
        dependents.get(depId).push(task.id);
      }
    });
  });

  // Calculate duration in days for each task
  function getDuration(task) {
    if (task.planned_duration_days) return task.planned_duration_days;
    if (task.planned_start && task.planned_end) {
      const start = new Date(task.planned_start);
      const end = new Date(task.planned_end);
      return Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1);
    }
    return 1;
  }

  // Initialize metrics object
  const metrics = {};

  // Forward pass: Calculate ES (Earliest Start) and EF (Earliest Finish)
  function calculateES(taskId, visited = new Set()) {
    if (visited.has(taskId)) return 0; // Circular dependency protection
    if (metrics[taskId]?.es !== undefined) return metrics[taskId].es;

    visited.add(taskId);
    const task = taskMap.get(taskId);
    if (!task) return 0;

    const deps = task.depends_on || [];
    let es = 0;

    if (deps.length === 0) {
      // No dependencies - can start at project start (day 0)
      es = 0;
    } else {
      // ES = max(EF of all dependencies)
      deps.forEach(depId => {
        const depEF = calculateEF(depId, new Set(visited));
        es = Math.max(es, depEF);
      });
    }

    const duration = getDuration(task);
    const ef = es + duration;

    if (!metrics[taskId]) metrics[taskId] = {};
    metrics[taskId].es = es;
    metrics[taskId].ef = ef;
    metrics[taskId].duration = duration;

    return es;
  }

  function calculateEF(taskId, visited = new Set()) {
    calculateES(taskId, visited);
    return metrics[taskId]?.ef || 0;
  }

  // Calculate ES/EF for all tasks
  tasks.forEach(task => calculateES(task.id, new Set()));

  // Find project end (max EF)
  const projectEnd = Math.max(...Object.values(metrics).map(m => m.ef || 0));

  // Backward pass: Calculate LF (Latest Finish) and LS (Latest Start)
  function calculateLF(taskId, visited = new Set()) {
    if (visited.has(taskId)) return projectEnd;
    if (metrics[taskId]?.lf !== undefined) return metrics[taskId].lf;

    visited.add(taskId);
    const taskDependents = dependents.get(taskId) || [];
    let lf = projectEnd;

    if (taskDependents.length === 0) {
      // No dependents - can finish at project end
      lf = projectEnd;
    } else {
      // LF = min(LS of all dependents)
      taskDependents.forEach(depId => {
        const depLS = calculateLS(depId, new Set(visited));
        lf = Math.min(lf, depLS);
      });
    }

    const duration = metrics[taskId]?.duration || 1;
    const ls = lf - duration;

    metrics[taskId].lf = lf;
    metrics[taskId].ls = ls;
    metrics[taskId].slack = ls - metrics[taskId].es;

    return lf;
  }

  function calculateLS(taskId, visited = new Set()) {
    calculateLF(taskId, visited);
    return metrics[taskId]?.ls || 0;
  }

  // Calculate LF/LS for all tasks
  tasks.forEach(task => calculateLF(task.id, new Set()));

  // Identify critical path (tasks with slack = 0)
  const criticalTaskIds = new Set();
  Object.entries(metrics).forEach(([taskId, m]) => {
    if (Math.abs(m.slack) < 0.001) { // Float comparison tolerance
      criticalTaskIds.add(taskId);
    }
  });

  return { criticalTaskIds, taskMetrics: metrics };
}

/**
 * Toggle critical path highlighting on/off
 */
function toggleCriticalPath() {
  const checkbox = document.getElementById('showCriticalPath');
  state.showCriticalPath = checkbox ? checkbox.checked : true;

  // Re-render current view
  if (state.currentView === 'gantt') {
    renderGantt();
  } else {
    renderTaskList();
  }
}


// ============================================================
// BASELINE FUNCTIONALITY (102-03)
// ============================================================

async function loadBaselineInfo() {
  if (!state.schedule) return;

  try {
    const res = await fetch('/api/schedules/' + state.schedule.id + '/baseline');
    if (res.ok) {
      const data = await res.json();
      if (data && data.baseline_set_at) {
        state.hasBaseline = true;
        state.baselineData = data;

        const baselineInfo = document.getElementById('baselineInfo');
        const baselineDate = document.getElementById('baselineDate');
        if (baselineInfo && baselineDate) {
          baselineDate.textContent = new Date(data.baseline_set_at).toLocaleDateString();
          baselineInfo.style.display = 'flex';
        }

        const setBtn = document.getElementById('setBaselineBtn');
        if (setBtn) setBtn.textContent = 'Update Baseline';
      }
    }
  } catch (err) {
    console.error('Failed to load baseline:', err);
  }
}

function setBaseline() {
  const modal = document.getElementById('baselineModal');
  const warning = document.getElementById('baselineWarning');

  if (warning) {
    warning.style.display = state.hasBaseline ? 'block' : 'none';
  }

  if (modal) {
    modal.style.display = 'flex';
    modal.classList.add('show');
  }
}

function closeBaselineModal() {
  const modal = document.getElementById('baselineModal');
  if (modal) {
    modal.classList.remove('show');
    modal.style.display = 'none';
  }
}

async function confirmSetBaseline() {
  if (!state.schedule) return;

  try {
    const res = await fetch('/api/schedules/' + state.schedule.id + '/set-baseline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to set baseline');
    }

    closeBaselineModal();
    await loadBaselineInfo();
    showToast('Baseline set successfully', 'success');
  } catch (err) {
    console.error('Failed to set baseline:', err);
    showToast(err.message, 'error');
  }
}

function toggleBaselineView() {
  state.showBaseline = !state.showBaseline;

  const toggleBtn = document.getElementById('toggleBaselineBtn');
  if (toggleBtn) {
    toggleBtn.textContent = state.showBaseline ? 'Hide Baseline' : 'Show Baseline';
    toggleBtn.classList.toggle('active', state.showBaseline);
  }

  renderSchedule();
}

function calculateVariance(task) {
  if (!state.baselineData || !state.showBaseline) return null;

  const baseline = state.baselineData.tasks ? state.baselineData.tasks.find(t => t.id === task.id) : null;
  if (!baseline || !baseline.planned_start || !task.planned_start) return null;

  const baseStart = new Date(baseline.planned_start);
  const actualStart = new Date(task.actual_start || task.planned_start);
  const diffDays = Math.round((actualStart - baseStart) / (1000 * 60 * 60 * 24));

  return {
    days: diffDays,
    ahead: diffDays < 0,
    behind: diffDays > 0,
    onTrack: diffDays === 0
  };
}

function renderVarianceBadge(variance) {
  if (!variance) return '';

  if (variance.onTrack) {
    return '<span class="variance-badge variance-on-track">On Track</span>';
  } else if (variance.ahead) {
    return '<span class="variance-badge variance-ahead">' + Math.abs(variance.days) + 'd ahead</span>';
  } else {
    return '<span class="variance-badge variance-behind">' + variance.days + 'd behind</span>';
  }
}

// ============================================================
// TEMPLATE FUNCTIONALITY (102-03)
// ============================================================

function openSaveTemplateModal() {
  const modal = document.getElementById('saveTemplateModal');
  const taskCountEl = document.getElementById('templateTaskCount');

  document.getElementById('templateName').value = '';
  document.getElementById('templateDescription').value = '';
  document.getElementById('templateProjectType').value = 'residential';

  if (taskCountEl) {
    taskCountEl.textContent = 'This will save ' + state.tasks.length + ' tasks with their relative timing and dependencies.';
  }

  if (modal) {
    modal.style.display = 'flex';
    modal.classList.add('show');
  }
}

function closeSaveTemplateModal() {
  const modal = document.getElementById('saveTemplateModal');
  if (modal) {
    modal.classList.remove('show');
    modal.style.display = 'none';
  }
}

async function saveAsTemplate() {
  const name = document.getElementById('templateName').value.trim();
  if (!name) {
    showToast('Template name is required', 'error');
    return;
  }

  const description = document.getElementById('templateDescription').value.trim();
  const projectType = document.getElementById('templateProjectType').value;

  try {
    const res = await fetch('/api/schedules/templates/from-schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        schedule_id: state.schedule.id,
        name: name,
        description: description,
        project_type: projectType
      })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to save template');
    }

    closeSaveTemplateModal();
    showToast('Template saved successfully', 'success');
  } catch (err) {
    console.error('Failed to save template:', err);
    showToast(err.message, 'error');
  }
}

async function openApplyTemplateModal() {
  const modal = document.getElementById('applyTemplateModal');
  const templateSelect = document.getElementById('templateSelect');
  const startDateInput = document.getElementById('scheduleStartDate');

  const today = new Date().toISOString().split('T')[0];
  if (startDateInput) startDateInput.value = today;

  try {
    const res = await fetch('/api/schedules/templates');
    if (res.ok) {
      state.templates = await res.json();

      if (templateSelect) {
        templateSelect.innerHTML = '<option value="">Choose a template...</option>';
        state.templates.forEach(t => {
          templateSelect.innerHTML += '<option value="' + t.id + '">' + escapeHtml(t.name) + '</option>';
        });
      }
    }
  } catch (err) {
    console.error('Failed to load templates:', err);
  }

  const preview = document.getElementById('templatePreview');
  if (preview) preview.style.display = 'none';

  if (modal) {
    modal.style.display = 'flex';
    modal.classList.add('show');
  }
}

function closeApplyTemplateModal() {
  const modal = document.getElementById('applyTemplateModal');
  if (modal) {
    modal.classList.remove('show');
    modal.style.display = 'none';
  }
}

function previewTemplate() {
  const templateId = document.getElementById('templateSelect').value;
  const startDate = document.getElementById('scheduleStartDate').value;
  const preview = document.getElementById('templatePreview');

  if (!templateId || !preview) {
    if (preview) preview.style.display = 'none';
    return;
  }

  const template = state.templates.find(t => t.id === templateId);
  if (!template) return;

  preview.style.display = 'block';
  document.getElementById('previewTaskCount').textContent = template.task_count || 0;
  document.getElementById('previewDuration').textContent = template.duration_days || 0;

  if (startDate && template.duration_days) {
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + template.duration_days);
    document.getElementById('previewEndDate').textContent = endDate.toLocaleDateString();
  } else {
    document.getElementById('previewEndDate').textContent = '-';
  }
}

async function applyTemplate() {
  const templateId = document.getElementById('templateSelect').value;
  const startDate = document.getElementById('scheduleStartDate').value;

  if (!templateId) {
    showToast('Please select a template', 'error');
    return;
  }

  if (!startDate) {
    showToast('Please select a start date', 'error');
    return;
  }

  try {
    const res = await fetch('/api/schedules/templates/' + templateId + '/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        job_id: state.currentJobId,
        start_date: startDate
      })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to apply template');
    }

    closeApplyTemplateModal();
    await loadSchedule();
    showToast('Schedule created from template', 'success');
  } catch (err) {
    console.error('Failed to apply template:', err);
    showToast(err.message, 'error');
  }
}

// ============================================================
// BULK OPERATIONS (102-04)
// ============================================================

function toggleSelectAll(checked) {
  const checkboxes = document.querySelectorAll('.task-checkbox');
  checkboxes.forEach(cb => {
    cb.checked = checked;
    const taskId = cb.dataset.taskId;
    if (checked) {
      state.selectedTasks.add(taskId);
    } else {
      state.selectedTasks.delete(taskId);
    }
  });
  updateBulkActionsBar();
}

function toggleTaskSelection(taskId, checked) {
  if (checked) {
    state.selectedTasks.add(taskId);
  } else {
    state.selectedTasks.delete(taskId);
  }

  const selectAll = document.getElementById('selectAllTasks');
  const allCheckboxes = document.querySelectorAll('.task-checkbox');
  if (selectAll && allCheckboxes.length > 0) {
    selectAll.checked = state.selectedTasks.size === allCheckboxes.length;
    selectAll.indeterminate = state.selectedTasks.size > 0 && state.selectedTasks.size < allCheckboxes.length;
  }

  updateBulkActionsBar();
}

function updateBulkActionsBar() {
  const bar = document.getElementById('bulkActionsBar');
  const count = document.getElementById('selectedCount');

  if (bar) {
    bar.style.display = state.selectedTasks.size > 0 ? 'flex' : 'none';
  }
  if (count) {
    count.textContent = state.selectedTasks.size;
  }
}

function clearSelection() {
  state.selectedTasks.clear();
  document.querySelectorAll('.task-checkbox').forEach(cb => cb.checked = false);
  const selectAll = document.getElementById('selectAllTasks');
  if (selectAll) {
    selectAll.checked = false;
    selectAll.indeterminate = false;
  }
  updateBulkActionsBar();
}

async function quickUpdateTask(taskId, updates) {
  const res = await fetch('/api/schedules/tasks/' + taskId, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to update task');
  }

  return await res.json();
}

async function quickChangeStatus(taskId, newStatus) {
  try {
    await quickUpdateTask(taskId, { status: newStatus });

    const task = state.tasks.find(t => t.id === taskId);
    if (task) task.status = newStatus;

    updateStats();
    showToast('Status updated', 'success');
  } catch (err) {
    console.error('Failed to change status:', err);
    showToast('Failed to update status', 'error');
    renderSchedule();
  }
}

async function bulkSetStatus(status) {
  if (state.selectedTasks.size === 0) return;

  const taskIds = Array.from(state.selectedTasks);
  const failed = [];

  for (const taskId of taskIds) {
    try {
      await quickUpdateTask(taskId, { status });
      const task = state.tasks.find(t => t.id === taskId);
      if (task) task.status = status;
    } catch (err) {
      failed.push(taskId);
    }
  }

  if (failed.length > 0) {
    showToast('Failed to update ' + failed.length + ' tasks', 'error');
  } else {
    showToast('Updated ' + taskIds.length + ' tasks', 'success');
  }

  clearSelection();
  updateStats();
  renderSchedule();
}

async function bulkDelete() {
  if (state.selectedTasks.size === 0) return;

  if (!confirm('Are you sure you want to delete ' + state.selectedTasks.size + ' tasks?')) return;

  const taskIds = Array.from(state.selectedTasks);
  const failed = [];

  for (const taskId of taskIds) {
    try {
      const res = await fetch('/api/schedules/tasks/' + taskId, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
    } catch (err) {
      failed.push(taskId);
    }
  }

  if (failed.length > 0) {
    showToast('Failed to delete ' + failed.length + ' tasks', 'error');
  } else {
    showToast('Deleted ' + taskIds.length + ' tasks', 'success');
  }

  clearSelection();
  await loadSchedule();
}


// ============================================================
// CALENDAR VIEW (102-05)
// ============================================================

function renderCalendar() {
  const grid = document.getElementById("calendarGrid");
  if (!grid) return;

  const tasks = getFilteredTasks();
  const year = state.calendarDate.getFullYear();
  const month = state.calendarDate.getMonth();

  const monthNames = ["January", "February", "March", "April", "May", "June",
                      "July", "August", "September", "October", "November", "December"];
  document.getElementById("calendarMonthYear").textContent = monthNames[month] + " " + year;

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDay = firstDay.getDay();
  const totalDays = lastDay.getDate();

  let html = "<div class=\"calendar-day-headers\">";
  ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].forEach(d => html += "<div class=\"calendar-day-header\">" + d + "</div>");
  html += "</div><div class=\"calendar-cells\">";

  for (let i = 0; i < startDay; i++) html += "<div class=\"calendar-cell empty\"></div>";

  const today = new Date();
  for (let day = 1; day <= totalDays; day++) {
    const cellDate = new Date(year, month, day);
    const dateStr = cellDate.toISOString().split("T")[0];
    const isToday = isSameDay(cellDate, today);
    const isWeekend = cellDate.getDay() === 0 || cellDate.getDay() === 6;

    const dayTasks = tasks.filter(t => {
      if (!t.planned_start) return false;
      const taskEnd = t.planned_end || t.planned_start;
      return dateStr >= t.planned_start && dateStr <= taskEnd;
    });

    html += "<div class=\"calendar-cell" + (isToday ? " today" : "") + (isWeekend ? " weekend" : "") + "\">";
    html += "<div class=\"calendar-date\">" + day + "</div>";

    if (dayTasks.length > 0) {
      html += "<div class=\"calendar-tasks\">";
      dayTasks.slice(0, 3).forEach(task => {
        html += "<div class=\"calendar-task " + getStatusClass(task.status) + "\" onclick=\"openTaskModal('" + task.id + "')\" title=\"" + escapeHtml(task.name) + "\">" + escapeHtml(truncate(task.name, 15)) + "</div>";
      });
      if (dayTasks.length > 3) html += "<div class=\"calendar-more\">+" + (dayTasks.length - 3) + " more</div>";
      html += "</div>";
    }
    html += "</div>";
  }

  const endDay = lastDay.getDay();
  for (let i = endDay; i < 6; i++) html += "<div class=\"calendar-cell empty\"></div>";

  html += "</div>";
  grid.innerHTML = html;
}

function calendarPrevMonth() {
  state.calendarDate.setMonth(state.calendarDate.getMonth() - 1);
  renderCalendar();
}

function calendarNextMonth() {
  state.calendarDate.setMonth(state.calendarDate.getMonth() + 1);
  renderCalendar();
}

function calendarToday() {
  state.calendarDate = new Date();
  renderCalendar();
}

// ============================================================
// AGENDA VIEW (102-05)
// ============================================================

function populateAgendaVendors() {
  const select = document.getElementById("agendaVendorFilter");
  if (!select) return;
  const assignedVendorIds = new Set(state.tasks.map(t => t.vendor_id).filter(Boolean));
  select.innerHTML = "<option value=\"\">All Vendors</option><option value=\"unassigned\">Unassigned</option>";
  state.vendors.filter(v => assignedVendorIds.has(v.id)).forEach(vendor => {
    select.innerHTML += "<option value=\"" + vendor.id + "\">" + escapeHtml(vendor.name) + "</option>";
  });
  if (state.agendaVendorId) select.value = state.agendaVendorId;
}

function renderAgenda() {
  const container = document.getElementById("agendaContent");
  if (!container) return;
  let tasks = getFilteredTasks();

  if (state.agendaVendorId === "unassigned") tasks = tasks.filter(t => !t.vendor_id);
  else if (state.agendaVendorId) tasks = tasks.filter(t => t.vendor_id === state.agendaVendorId);

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split("T")[0];

  if (state.agendaDateFilter === "today") {
    tasks = tasks.filter(t => t.planned_start && (t.planned_start === todayStr || (t.planned_start <= todayStr && t.planned_end >= todayStr)));
  } else if (state.agendaDateFilter === "week") {
    const weekEnd = new Date(today); weekEnd.setDate(weekEnd.getDate() + 7);
    const weekEndStr = weekEnd.toISOString().split("T")[0];
    tasks = tasks.filter(t => t.planned_start && t.planned_start <= weekEndStr && (t.planned_end >= todayStr || t.planned_start >= todayStr));
  }

  if (tasks.length === 0) { container.innerHTML = "<div class=\"agenda-empty\"><p>No tasks match your filters.</p></div>"; return; }

  const grouped = {};
  tasks.forEach(task => {
    const key = task.vendor_id || "__unassigned__";
    if (!grouped[key]) grouped[key] = { vendor: task.vendor_id ? state.vendors.find(v => v.id === task.vendor_id) : null, tasks: [] };
    grouped[key].tasks.push(task);
  });

  const sortedKeys = Object.keys(grouped).sort((a, b) => {
    if (a === "__unassigned__") return -1;
    if (b === "__unassigned__") return 1;
    return (grouped[a].vendor?.name || "").localeCompare(grouped[b].vendor?.name || "");
  });

  let html = "";
  sortedKeys.forEach(key => {
    const group = grouped[key];
    const vendorName = key === "__unassigned__" ? "Unassigned" : (group.vendor?.name || "Unknown");
    group.tasks.sort((a, b) => (a.planned_start || "").localeCompare(b.planned_start || ""));

    html += "<div class=\"agenda-group\"><div class=\"agenda-group-header\"><span class=\"agenda-vendor-name\">" + escapeHtml(vendorName) + "</span><span class=\"agenda-task-count\">" + group.tasks.length + " task" + (group.tasks.length !== 1 ? "s" : "") + "</span></div><div class=\"agenda-group-tasks\">";
    group.tasks.forEach(task => {
      html += "<div class=\"agenda-task\" onclick=\"openTaskModal('" + task.id + "')\"><div class=\"agenda-task-info\"><span class=\"agenda-task-name\">" + escapeHtml(task.name) + "</span><span class=\"agenda-task-dates\">" + formatDateRange(task.planned_start, task.planned_end) + "</span></div><div class=\"agenda-task-meta\"><span class=\"status-badge " + getStatusClass(task.status) + "\">" + formatStatus(task.status) + "</span><span class=\"agenda-task-progress\">" + (task.completion_percent || 0) + "%</span></div></div>";
    });
    html += "</div></div>";
  });
  container.innerHTML = html;
}

function filterAgenda() { state.agendaVendorId = document.getElementById("agendaVendorFilter")?.value || ""; renderAgenda(); }
function agendaToday() { state.agendaDateFilter = "today"; updateAgendaDateButtons(); renderAgenda(); }
function agendaThisWeek() { state.agendaDateFilter = "week"; updateAgendaDateButtons(); renderAgenda(); }
function agendaAll() { state.agendaDateFilter = "all"; updateAgendaDateButtons(); renderAgenda(); }

function updateAgendaDateButtons() {
  document.querySelectorAll(".agenda-date-nav .btn").forEach(btn => {
    btn.classList.toggle("active", (btn.textContent === "Today" && state.agendaDateFilter === "today") || (btn.textContent === "This Week" && state.agendaDateFilter === "week") || (btn.textContent === "All" && state.agendaDateFilter === "all"));
  });
}

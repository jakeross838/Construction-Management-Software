// ============================================================
// DAILY LOGS APP - Ross Built CMS
// ============================================================

let state = {
  logs: [],
  jobs: [],
  vendors: [],
  scheduleTasks: [],  // Schedule tasks for current job
  currentJobId: null,
  filters: {
    status: '',
    dateFrom: '',
    dateTo: '',
    search: ''
  }
};

let currentLog = null;
let crewEntryIndex = 0;
let deliveryEntryIndex = 0;

// Weather icons mapping
const weatherIcons = {
  sunny: { icon: '☀️', label: 'Sunny' },
  partly_cloudy: { icon: '⛅', label: 'Partly Cloudy' },
  cloudy: { icon: '☁️', label: 'Cloudy' },
  rainy: { icon: '🌧️', label: 'Rainy' },
  stormy: { icon: '⛈️', label: 'Stormy' },
  windy: { icon: '💨', label: 'Windy' },
  snow: { icon: '❄️', label: 'Snow' }
};

// Common construction trades for searchable dropdown
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

// Work areas for tracking location within a building
const workAreas = [
  { id: 'entire-site', name: 'Entire Site' },
  { id: 'exterior', name: 'Exterior' },
  { id: 'interior', name: 'Interior' },
  { id: 'garage', name: 'Garage' },
  { id: 'kitchen', name: 'Kitchen' },
  { id: 'living-room', name: 'Living Room' },
  { id: 'dining-room', name: 'Dining Room' },
  { id: 'master-bed', name: 'Master Bedroom' },
  { id: 'master-bath', name: 'Master Bath' },
  { id: 'bedroom-2', name: 'Bedroom 2' },
  { id: 'bedroom-3', name: 'Bedroom 3' },
  { id: 'bedroom-4', name: 'Bedroom 4' },
  { id: 'bathroom-2', name: 'Bathroom 2' },
  { id: 'bathroom-3', name: 'Bathroom 3' },
  { id: 'powder-room', name: 'Powder Room' },
  { id: 'laundry', name: 'Laundry' },
  { id: 'office', name: 'Office/Study' },
  { id: 'bonus-room', name: 'Bonus Room' },
  { id: 'media-room', name: 'Media Room' },
  { id: 'pool-area', name: 'Pool Area' },
  { id: 'patio', name: 'Patio/Lanai' },
  { id: 'driveway', name: 'Driveway' },
  { id: 'roof', name: 'Roof' },
  { id: 'attic', name: 'Attic' },
  { id: '1st-floor', name: '1st Floor' },
  { id: '2nd-floor', name: '2nd Floor' },
  { id: '3rd-floor', name: '3rd Floor' },
  { id: 'basement', name: 'Basement' },
  { id: 'other', name: 'Other' }
];

// Inspection types
const inspectionTypes = [
  { id: 'footing', name: 'Footing' },
  { id: 'foundation', name: 'Foundation' },
  { id: 'slab', name: 'Slab' },
  { id: 'framing', name: 'Framing' },
  { id: 'sheathing', name: 'Sheathing/Nailing' },
  { id: 'roofing', name: 'Roofing' },
  { id: 'electrical-rough', name: 'Electrical Rough' },
  { id: 'electrical-final', name: 'Electrical Final' },
  { id: 'plumbing-rough', name: 'Plumbing Rough' },
  { id: 'plumbing-final', name: 'Plumbing Final' },
  { id: 'mechanical-rough', name: 'Mechanical/HVAC Rough' },
  { id: 'mechanical-final', name: 'Mechanical/HVAC Final' },
  { id: 'insulation', name: 'Insulation' },
  { id: 'drywall', name: 'Drywall' },
  { id: 'fire', name: 'Fire/Sprinkler' },
  { id: 'stucco', name: 'Stucco Lath' },
  { id: 'gas', name: 'Gas Line' },
  { id: 'pool', name: 'Pool' },
  { id: 'final', name: 'Final/CO' },
  { id: 'other', name: 'Other' }
];

// No-show reasons for predictive scheduling
const noShowReasons = [
  { id: 'weather', name: 'Weather' },
  { id: 'scheduling-conflict', name: 'Scheduling Conflict' },
  { id: 'crew-shortage', name: 'Crew Shortage' },
  { id: 'materials-not-ready', name: 'Materials Not Ready' },
  { id: 'previous-trade-incomplete', name: 'Previous Trade Not Complete' },
  { id: 'equipment-issue', name: 'Equipment Issue' },
  { id: 'permit-delay', name: 'Permit/Inspection Delay' },
  { id: 'illness', name: 'Illness/Injury' },
  { id: 'vehicle-issue', name: 'Vehicle/Transportation' },
  { id: 'communication-error', name: 'Communication Error' },
  { id: 'job-priority', name: 'Sent to Another Job' },
  { id: 'no-call-no-show', name: 'No Call/No Show' },
  { id: 'vacation', name: 'Vacation/Holiday' },
  { id: 'other', name: 'Other' }
];

let inspectionEntryIndex = 0;

// ============================================================
// INITIALIZATION
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
  await Promise.all([
    loadJobs(),
    loadVendors()
  ]);

  setupFilters();

  // Sidebar integration - listen for job selection changes
  if (window.JobSidebar) {
    window.JobSidebar.onJobChange((jobId) => {
      state.currentJobId = jobId;
      loadDailyLogs();
      loadStats();
      loadScheduleTasks();  // Load schedule tasks for the new job
    });

    // Get initial job selection
    state.currentJobId = window.JobSidebar.getSelectedJobId();
  }

  // Load logs if job is selected
  if (state.currentJobId) {
    await Promise.all([
      loadDailyLogs(),
      loadStats(),
      loadScheduleTasks()  // Load schedule tasks
    ]);
  } else {
    showNoJobSelected();
  }

  // Set default date to today
  document.getElementById('logDate').value = new Date().toISOString().split('T')[0];
});

// ============================================================
// DATA LOADING
// ============================================================

async function loadJobs() {
  try {
    const res = await fetch('/api/jobs');
    state.jobs = await res.json();
    populateJobDropdown();
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

async function loadScheduleTasks() {
  if (!state.currentJobId) {
    state.scheduleTasks = [];
    return;
  }

  try {
    const res = await fetch(`/api/schedules/tasks/by-job/${state.currentJobId}`);
    if (res.ok) {
      state.scheduleTasks = await res.json();
    } else {
      state.scheduleTasks = [];
    }
  } catch (err) {
    console.error('Failed to load schedule tasks:', err);
    state.scheduleTasks = [];
  }
}

async function loadDailyLogs() {
  if (!state.currentJobId) {
    showNoJobSelected();
    return;
  }

  const container = document.getElementById('logList');
  const noJobDiv = document.getElementById('noJobSelected');
  noJobDiv.style.display = 'none';
  container.innerHTML = '<div class="loading">Loading daily logs...</div>';

  try {
    let url = `/api/daily-logs?job_id=${state.currentJobId}`;

    if (state.filters.status) {
      url += `&status=${state.filters.status}`;
    }
    if (state.filters.dateFrom) {
      url += `&date_from=${state.filters.dateFrom}`;
    }
    if (state.filters.dateTo) {
      url += `&date_to=${state.filters.dateTo}`;
    }

    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to load daily logs');

    state.logs = await res.json();
    renderLogList();
  } catch (err) {
    console.error('Failed to load daily logs:', err);
    container.innerHTML = '<div class="error-state">Failed to load daily logs</div>';
    showToast('Failed to load daily logs', 'error');
  }
}

async function loadStats() {
  try {
    let url = '/api/daily-logs/stats/summary';
    if (state.currentJobId) {
      url += `?job_id=${state.currentJobId}`;
    }

    const res = await fetch(url);
    const stats = await res.json();

    document.getElementById('statTotal').textContent = stats.total || 0;
    document.getElementById('statDraft').textContent = stats.draft || 0;
    document.getElementById('statCompleted').textContent = stats.completed || 0;
    document.getElementById('statThisWeek').textContent = stats.this_week || 0;
  } catch (err) {
    console.error('Failed to load stats:', err);
  }
}

// ============================================================
// RENDERING
// ============================================================

function showNoJobSelected() {
  document.getElementById('logList').innerHTML = '';
  document.getElementById('noJobSelected').style.display = 'flex';
  document.getElementById('statsContainer').style.display = 'none';
}

function renderLogList() {
  const container = document.getElementById('logList');
  document.getElementById('statsContainer').style.display = 'grid';

  // Apply search filter
  let filtered = state.logs;
  if (state.filters.search) {
    const q = state.filters.search.toLowerCase();
    filtered = filtered.filter(log =>
      log.work_completed?.toLowerCase().includes(q) ||
      log.delays_issues?.toLowerCase().includes(q) ||
      log.job?.name?.toLowerCase().includes(q)
    );
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📋</div>
        <h3>No Daily Logs</h3>
        <p>${state.filters.search ? 'No results match your search' : 'Create a daily log to get started'}</p>
        ${!state.filters.search ? '<button class="btn btn-primary" onclick="openCreateModal()">+ New Daily Log</button>' : ''}
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(log => renderLogCard(log)).join('');
}

function renderLogCard(log) {
  const weather = weatherIcons[log.weather_conditions] || { icon: '🌤️', label: 'Unknown' };
  const tempDisplay = log.temperature_high ? `${log.temperature_high}°F` : '';
  const date = new Date(log.log_date + 'T00:00:00');
  const dateStr = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

  const statusClass = log.status === 'completed' ? 'status-approved' : 'status-draft';
  const statusLabel = log.status === 'completed' ? 'Completed' : 'Draft';

  const crewCount = log.crew_count || 0;
  const totalWorkers = log.total_workers || 0;
  const deliveryCount = log.delivery_count || 0;

  return `
    <div class="daily-log-card" onclick="viewLog('${log.id}')">
      <div class="log-card-header">
        <div class="log-card-date">${dateStr}</div>
        <div class="log-card-weather">
          <span class="weather-icon">${weather.icon}</span>
          <span class="weather-temp">${tempDisplay}</span>
        </div>
      </div>
      <div class="log-card-job">${log.job?.name || 'Unknown Job'}</div>
      <div class="log-card-summary">
        <span class="summary-item" title="Crews on site">
          <span class="summary-icon">👷</span>
          ${crewCount} crew${crewCount !== 1 ? 's' : ''} (${totalWorkers} workers)
        </span>
        <span class="summary-item" title="Deliveries">
          <span class="summary-icon">📦</span>
          ${deliveryCount} deliver${deliveryCount !== 1 ? 'ies' : 'y'}
        </span>
        <span class="status-badge ${statusClass}">${statusLabel}</span>
      </div>
      ${log.work_completed ? `<div class="log-card-work">${truncateText(log.work_completed, 150)}</div>` : ''}
    </div>
  `;
}

function truncateText(text, maxLength) {
  if (!text || text.length <= maxLength) return text || '';
  return text.substring(0, maxLength) + '...';
}

function populateJobDropdown() {
  const select = document.getElementById('logJobId');
  select.innerHTML = '<option value="">Select Job...</option>';

  state.jobs.forEach(job => {
    const option = document.createElement('option');
    option.value = job.id;
    option.textContent = job.name;
    select.appendChild(option);
  });
}

function populateVendorDropdown(selectElement, selectedId = null) {
  selectElement.innerHTML = '<option value="">Select Vendor...</option>';

  state.vendors.forEach(vendor => {
    const option = document.createElement('option');
    option.value = vendor.id;
    option.textContent = vendor.name;
    if (selectedId && vendor.id === selectedId) {
      option.selected = true;
    }
    selectElement.appendChild(option);
  });
}

// ============================================================
// FILTERS
// ============================================================

function setupFilters() {
  // Filters are set up via onchange in HTML
}

function applyFilters() {
  state.filters.status = document.getElementById('statusFilter').value;
  state.filters.dateFrom = document.getElementById('dateFrom').value;
  state.filters.dateTo = document.getElementById('dateTo').value;
  state.filters.search = document.getElementById('searchInput').value;

  loadDailyLogs();
}

// ============================================================
// WEATHER AUTO-FETCH
// ============================================================

async function fetchWeatherForJob(jobId) {
  if (!jobId) return null;

  try {
    const res = await fetch(`/api/daily-logs/weather/${jobId}`);
    if (!res.ok) {
      console.warn('Could not fetch weather:', await res.text());
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error('Weather fetch error:', err);
    return null;
  }
}

function applyWeatherToForm(weatherData) {
  const display = document.getElementById('weatherDisplay');

  if (!weatherData || !weatherData.weather) {
    display.innerHTML = '<div class="weather-loading">Could not load weather</div>';
    document.getElementById('weatherConditions').value = '';
    document.getElementById('tempHigh').value = '';
    document.getElementById('tempLow').value = '';
    return;
  }

  const weather = weatherData.weather;
  const icon = weatherIcons[weather.conditions] || { icon: '🌤️', label: 'Unknown' };

  // Set hidden field values
  document.getElementById('weatherConditions').value = weather.conditions || '';
  document.getElementById('tempHigh').value = weather.temperature_high || '';
  document.getElementById('tempLow').value = weather.temperature_low || '';

  // Render display
  display.innerHTML = `
    <div class="weather-card">
      <div class="weather-main">
        <span class="weather-icon-xl">${icon.icon}</span>
        <span class="weather-condition">${icon.label}</span>
      </div>
      <div class="weather-temps">
        <div class="temp-item">
          <span class="temp-label">High</span>
          <span class="temp-value">${weather.temperature_high}°F</span>
        </div>
        <div class="temp-item">
          <span class="temp-label">Low</span>
          <span class="temp-value">${weather.temperature_low}°F</span>
        </div>
      </div>
    </div>
  `;
}

function showWeatherLoading() {
  document.getElementById('weatherDisplay').innerHTML = '<div class="weather-loading">Loading weather...</div>';
}

// Called when job dropdown changes in modal
async function onJobChange() {
  const jobId = document.getElementById('logJobId').value;
  if (jobId) {
    showWeatherLoading();
    const weatherData = await fetchWeatherForJob(jobId);
    applyWeatherToForm(weatherData);
  } else {
    document.getElementById('weatherDisplay').innerHTML = '<div class="weather-loading">Select a job to load weather...</div>';
  }
}

// ============================================================
// MODAL - CREATE/EDIT
// ============================================================

async function openCreateModal() {
  currentLog = null;
  crewEntryIndex = 0;
  deliveryEntryIndex = 0;
  absentEntryIndex = 0;
  inspectionEntryIndex = 0;

  document.getElementById('modalTitle').textContent = 'New Daily Log';
  document.getElementById('editLogId').value = '';
  document.getElementById('deleteLogBtn').style.display = 'none';

  // Reset form
  document.getElementById('logJobId').value = state.currentJobId || '';
  document.getElementById('logDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('constructionPhase').value = '';
  document.getElementById('planCompleted').value = '';
  document.getElementById('planVarianceNotes').value = '';
  document.getElementById('weatherConditions').value = '';
  document.getElementById('tempHigh').value = '';
  document.getElementById('tempLow').value = '';
  document.getElementById('weatherNotes').value = '';
  document.getElementById('workCompleted').value = '';
  document.getElementById('workPlanned').value = '';
  document.getElementById('delaysIssues').value = '';
  document.getElementById('siteVisitors').value = '';
  document.getElementById('dumpsterExchange').checked = false;

  // Clear all entry lists
  document.getElementById('crewList').innerHTML = '';
  document.getElementById('absentList').innerHTML = '';
  document.getElementById('deliveryList').innerHTML = '';
  document.getElementById('inspectionList').innerHTML = '';
  document.getElementById('photoGallery').innerHTML = '';
  currentPhotos = [];

  // Add one empty crew entry
  addCrewEntry();

  const modal = document.getElementById('dailyLogModal');
  modal.style.display = 'flex';
  // Use setTimeout to trigger CSS transition
  setTimeout(() => modal.classList.add('show'), 10);

  // Auto-fetch weather if job is selected
  if (state.currentJobId) {
    showWeatherLoading();
    const weatherData = await fetchWeatherForJob(state.currentJobId);
    applyWeatherToForm(weatherData);
  } else {
    document.getElementById('weatherDisplay').innerHTML = '<div class="weather-loading">Select a job to load weather...</div>';
  }
}

async function openEditModal(logId) {
  try {
    const res = await fetch(`/api/daily-logs/${logId}`);
    if (!res.ok) throw new Error('Failed to load daily log');

    currentLog = await res.json();

    // Ensure schedule tasks are loaded for this job
    if (currentLog.job_id && (!state.scheduleTasks.length || state.currentJobId !== currentLog.job_id)) {
      state.currentJobId = currentLog.job_id;
      await loadScheduleTasks();
    }

    crewEntryIndex = 0;
    deliveryEntryIndex = 0;
    absentEntryIndex = 0;
    inspectionEntryIndex = 0;

    document.getElementById('modalTitle').textContent = 'Edit Daily Log';
    document.getElementById('editLogId').value = currentLog.id;
    document.getElementById('deleteLogBtn').style.display = 'block';

    // Clear all lists first
    document.getElementById('crewList').innerHTML = '';
    document.getElementById('absentList').innerHTML = '';
    document.getElementById('deliveryList').innerHTML = '';
    document.getElementById('inspectionList').innerHTML = '';

    // Populate form - basic info
    document.getElementById('logJobId').value = currentLog.job_id;
    document.getElementById('logDate').value = currentLog.log_date;
    document.getElementById('constructionPhase').value = currentLog.construction_phase || '';
    document.getElementById('planCompleted').value = currentLog.plan_completed || '';
    document.getElementById('planVarianceNotes').value = currentLog.plan_variance_notes || '';
    document.getElementById('workCompleted').value = currentLog.work_completed || '';
    document.getElementById('workPlanned').value = currentLog.work_planned || '';
    document.getElementById('dumpsterExchange').checked = currentLog.dumpster_exchange || false;

    // Show saved weather as display
    if (currentLog.weather_conditions) {
      const weatherData = {
        weather: {
          conditions: currentLog.weather_conditions,
          temperature_high: currentLog.temperature_high,
          temperature_low: currentLog.temperature_low
        }
      };
      applyWeatherToForm(weatherData);
    } else {
      // Fetch fresh weather
      showWeatherLoading();
      const weatherData = await fetchWeatherForJob(currentLog.job_id);
      applyWeatherToForm(weatherData);
    }
    document.getElementById('weatherNotes').value = currentLog.weather_notes || '';
    document.getElementById('delaysIssues').value = currentLog.delays_issues || '';
    document.getElementById('siteVisitors').value = currentLog.site_visitors || '';

    // Populate crew list
    if (currentLog.crew && currentLog.crew.length > 0) {
      currentLog.crew.forEach(crew => addCrewEntry(crew));
    }

    // Populate delivery list
    if (currentLog.deliveries && currentLog.deliveries.length > 0) {
      currentLog.deliveries.forEach(delivery => addDeliveryEntry(delivery));
    }

    // Populate absent list
    if (currentLog.absent_crews && currentLog.absent_crews.length > 0) {
      currentLog.absent_crews.forEach(absent => addAbsentEntry(absent));
    }

    // Populate inspection list
    if (currentLog.inspections && currentLog.inspections.length > 0) {
      currentLog.inspections.forEach(insp => addInspectionEntry(insp));
    }

    // Load photos
    await loadPhotos(currentLog.id);

    const modal = document.getElementById('dailyLogModal');
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('show'), 10);
  } catch (err) {
    console.error('Failed to load daily log:', err);
    showToast('Failed to load daily log', 'error');
  }
}

function closeModal() {
  const modal = document.getElementById('dailyLogModal');
  modal.classList.remove('show');
  setTimeout(() => {
    modal.style.display = 'none';
  }, 200);
  currentLog = null;
}

// ============================================================
// CREW MANAGEMENT
// ============================================================

let absentEntryIndex = 0;

function addCrewEntry(data = null) {
  const container = document.getElementById('crewList');
  const index = crewEntryIndex++;

  const entry = document.createElement('div');
  entry.className = 'crew-entry';
  entry.id = `crew-entry-${index}`;

  entry.innerHTML = `
    <div class="crew-entry-header">
      <span class="crew-entry-number">#${index + 1}</span>
      <button type="button" class="btn btn-icon btn-danger btn-sm" onclick="removeCrewEntry(${index})" title="Remove">
        <span>&times;</span>
      </button>
    </div>
    <div class="entry-row">
      <div class="form-group flex-1">
        <label>Vendor/Subcontractor</label>
        <div id="crew-vendor-picker-${index}"></div>
      </div>
      <div class="form-group flex-1">
        <label>Trade</label>
        <div id="crew-trade-picker-${index}"></div>
      </div>
      <div class="form-group flex-1">
        <label>Work Area</label>
        <div id="crew-area-picker-${index}"></div>
      </div>
    </div>
    <div class="entry-row">
      <div class="form-group flex-2">
        <label>Schedule Task <span class="label-hint">(auto-suggested by trade)</span></label>
        <div id="crew-task-picker-${index}"></div>
      </div>
    </div>
    <div class="entry-row">
      <div class="form-group" style="width: 100px;">
        <label>Headcount</label>
        <input type="number" id="crew-workers-${index}" class="form-control" placeholder="#" min="1" value="${data?.worker_count || ''}">
      </div>
      <div class="form-group" style="width: 100px;">
        <label>Hours</label>
        <input type="number" id="crew-hours-${index}" class="form-control" placeholder="hrs" step="0.5" value="${data?.hours_worked || ''}">
      </div>
      <div class="form-group" style="width: 120px;">
        <label>Completion %</label>
        <input type="number" id="crew-completion-${index}" class="form-control" placeholder="0-100" min="0" max="100" value="${data?.completion_percent || ''}">
      </div>
      <div class="form-group flex-1">
        <label>Work Performed</label>
        <input type="text" id="crew-work-${index}" class="form-control" placeholder="What did they do today?" value="${data?.work_performed || data?.notes || ''}">
      </div>
    </div>
  `;

  container.appendChild(entry);

  // Initialize searchable vendor picker
  const vendorContainer = document.getElementById(`crew-vendor-picker-${index}`);
  SearchablePicker.init(vendorContainer, {
    type: 'vendors',
    value: data?.vendor_id || null,
    placeholder: 'Search vendors...'
  });

  // Initialize searchable trade picker with auto-suggest for task
  const tradeContainer = document.getElementById(`crew-trade-picker-${index}`);
  SearchablePicker.init(tradeContainer, {
    type: 'custom',
    items: trades,
    value: data?.trade ? trades.find(t => t.name === data.trade)?.id : null,
    placeholder: 'Search trades...',
    onChange: (tradeId) => autoSuggestTask(index, tradeId)
  });

  // Initialize searchable work area picker
  const areaContainer = document.getElementById(`crew-area-picker-${index}`);
  SearchablePicker.init(areaContainer, {
    type: 'custom',
    items: workAreas,
    value: data?.work_area ? workAreas.find(a => a.name === data.work_area)?.id : null,
    placeholder: 'Search areas...'
  });

  // Initialize schedule task picker
  const taskContainer = document.getElementById(`crew-task-picker-${index}`);

  // Show non-completed tasks, plus include the currently linked task even if completed
  const currentTaskId = data?.schedule_task_id;
  const taskItems = state.scheduleTasks
    .filter(t => t.status !== 'completed' || t.id === currentTaskId)
    .map(t => ({
      id: t.id,
      name: `${t.name} (${t.completion_percent || 0}%)${t.status === 'completed' ? ' ✓' : ''}`
    }));

  SearchablePicker.init(taskContainer, {
    type: 'custom',
    items: taskItems,
    value: currentTaskId || null,
    placeholder: 'Link to schedule task...'
  });
}

// Auto-suggest a schedule task based on selected trade
function autoSuggestTask(crewIndex, tradeId) {
  if (!tradeId || state.scheduleTasks.length === 0) return;

  // Find an active/pending task that matches this trade
  const matchingTask = state.scheduleTasks.find(task =>
    task.trade === tradeId &&
    (task.status === 'pending' || task.status === 'in_progress')
  );

  if (matchingTask) {
    // Set the task picker value
    const taskPicker = document.querySelector(`#crew-task-picker-${crewIndex} .search-picker`);
    if (taskPicker && window.SearchablePicker) {
      window.SearchablePicker.setValue(taskPicker, matchingTask.id);
    }
  }
}

function removeCrewEntry(index) {
  const entry = document.getElementById(`crew-entry-${index}`);
  if (entry) {
    entry.remove();
  }
  // Renumber remaining entries
  renumberCrewEntries();
}

function renumberCrewEntries() {
  const entries = document.querySelectorAll('.crew-entry');
  entries.forEach((entry, i) => {
    const numberSpan = entry.querySelector('.crew-entry-number');
    if (numberSpan) {
      numberSpan.textContent = `#${i + 1}`;
    }
  });
}

function getCrewEntries() {
  const entries = [];
  const crewEntries = document.querySelectorAll('.crew-entry');

  crewEntries.forEach(entry => {
    const index = entry.id.replace('crew-entry-', '');

    // Get vendor from searchable picker
    const vendorPicker = document.getElementById(`crew-vendor-picker-${index}`);
    const vendorId = vendorPicker?.querySelector('.search-picker-value')?.value || null;

    // Get trade from searchable picker (stored as ID, need to get the name)
    const tradePicker = document.getElementById(`crew-trade-picker-${index}`);
    const tradeId = tradePicker?.querySelector('.search-picker-value')?.value;
    const tradeName = tradeId ? (trades.find(t => t.id === tradeId)?.name || tradeId) : null;

    // Get work area from searchable picker
    const areaPicker = document.getElementById(`crew-area-picker-${index}`);
    const areaId = areaPicker?.querySelector('.search-picker-value')?.value;
    const areaName = areaId ? (workAreas.find(a => a.id === areaId)?.name || areaId) : null;

    // Get schedule task from searchable picker
    const taskPicker = document.getElementById(`crew-task-picker-${index}`);
    const taskId = taskPicker?.querySelector('.search-picker-value')?.value || null;

    const workers = document.getElementById(`crew-workers-${index}`)?.value;
    const hours = document.getElementById(`crew-hours-${index}`)?.value;
    const completion = document.getElementById(`crew-completion-${index}`)?.value;
    const workPerformed = document.getElementById(`crew-work-${index}`)?.value;

    if (vendorId || tradeName || workers) {
      entries.push({
        vendor_id: vendorId || null,
        trade: tradeName || null,
        work_area: areaName || null,
        schedule_task_id: taskId || null,
        worker_count: parseInt(workers) || 1,
        hours_worked: hours ? parseFloat(hours) : null,
        completion_percent: completion ? parseInt(completion) : null,
        notes: workPerformed || null
      });
    }
  });

  return entries;
}

// ============================================================
// ABSENT/NO-SHOW MANAGEMENT
// ============================================================

function addAbsentEntry(data = null) {
  const container = document.getElementById('absentList');
  const index = absentEntryIndex++;

  const entry = document.createElement('div');
  entry.className = 'absent-entry';
  entry.id = `absent-entry-${index}`;

  entry.innerHTML = `
    <div class="entry-row">
      <div class="form-group flex-1">
        <div id="absent-vendor-picker-${index}"></div>
      </div>
      <div class="form-group flex-1">
        <div id="absent-trade-picker-${index}"></div>
      </div>
      <div class="form-group flex-1">
        <div id="absent-reason-picker-${index}"></div>
      </div>
      <button type="button" class="btn btn-icon btn-danger" onclick="removeAbsentEntry(${index})" title="Remove">
        <span>&times;</span>
      </button>
    </div>
  `;

  container.appendChild(entry);

  // Initialize searchable vendor picker
  const vendorContainer = document.getElementById(`absent-vendor-picker-${index}`);
  SearchablePicker.init(vendorContainer, {
    type: 'vendors',
    value: data?.vendor_id || null,
    placeholder: 'Search vendors...'
  });

  // Initialize searchable trade picker
  const tradeContainer = document.getElementById(`absent-trade-picker-${index}`);
  SearchablePicker.init(tradeContainer, {
    type: 'custom',
    items: trades,
    value: data?.trade ? trades.find(t => t.name === data.trade)?.id : null,
    placeholder: 'Search trades...'
  });

  // Initialize searchable reason picker
  const reasonContainer = document.getElementById(`absent-reason-picker-${index}`);
  SearchablePicker.init(reasonContainer, {
    type: 'custom',
    items: noShowReasons,
    value: data?.reason ? noShowReasons.find(r => r.name === data.reason)?.id : null,
    placeholder: 'Select reason...'
  });
}

function removeAbsentEntry(index) {
  const entry = document.getElementById(`absent-entry-${index}`);
  if (entry) {
    entry.remove();
  }
}

function getAbsentEntries() {
  const entries = [];
  const absentEntries = document.querySelectorAll('.absent-entry');

  absentEntries.forEach(entry => {
    const index = entry.id.replace('absent-entry-', '');

    // Get vendor from searchable picker
    const vendorPicker = document.getElementById(`absent-vendor-picker-${index}`);
    const vendorId = vendorPicker?.querySelector('.search-picker-value')?.value || null;

    // Get trade from searchable picker
    const tradePicker = document.getElementById(`absent-trade-picker-${index}`);
    const tradeId = tradePicker?.querySelector('.search-picker-value')?.value;
    const tradeName = tradeId ? (trades.find(t => t.id === tradeId)?.name || tradeId) : null;

    // Get reason from searchable picker
    const reasonPicker = document.getElementById(`absent-reason-picker-${index}`);
    const reasonId = reasonPicker?.querySelector('.search-picker-value')?.value;
    const reasonName = reasonId ? (noShowReasons.find(r => r.id === reasonId)?.name || reasonId) : null;

    if (vendorId || tradeName) {
      entries.push({
        vendor_id: vendorId || null,
        trade: tradeName || null,
        reason: reasonName || null
      });
    }
  });

  return entries;
}

// ============================================================
// DELIVERY MANAGEMENT
// ============================================================

function addDeliveryEntry(data = null) {
  const container = document.getElementById('deliveryList');
  const index = deliveryEntryIndex++;

  const entry = document.createElement('div');
  entry.className = 'delivery-entry';
  entry.id = `delivery-entry-${index}`;

  entry.innerHTML = `
    <div class="entry-row">
      <div class="form-group flex-1">
        <div id="delivery-vendor-picker-${index}"></div>
      </div>
      <div class="form-group flex-2">
        <input type="text" id="delivery-desc-${index}" class="form-control" placeholder="Description *" value="${data?.description || ''}">
      </div>
      <div class="form-group" style="width: 80px;">
        <input type="number" id="delivery-qty-${index}" class="form-control" placeholder="Qty" value="${data?.quantity || ''}">
      </div>
      <div class="form-group" style="width: 80px;">
        <input type="text" id="delivery-unit-${index}" class="form-control" placeholder="Unit" value="${data?.unit || ''}">
      </div>
      <button type="button" class="btn btn-icon btn-danger" onclick="removeDeliveryEntry(${index})" title="Remove">
        <span>&times;</span>
      </button>
    </div>
    <div class="entry-row">
      <div class="form-group flex-1">
        <input type="text" id="delivery-received-${index}" class="form-control" placeholder="Received by" value="${data?.received_by || ''}">
      </div>
      <div class="form-group flex-2">
        <input type="text" id="delivery-notes-${index}" class="form-control" placeholder="Notes (optional)" value="${data?.notes || ''}">
      </div>
    </div>
  `;

  container.appendChild(entry);

  // Initialize searchable vendor picker
  const vendorContainer = document.getElementById(`delivery-vendor-picker-${index}`);
  SearchablePicker.init(vendorContainer, {
    type: 'vendors',
    value: data?.vendor_id || null,
    placeholder: 'Search vendors...'
  });
}

function removeDeliveryEntry(index) {
  const entry = document.getElementById(`delivery-entry-${index}`);
  if (entry) {
    entry.remove();
  }
}

function getDeliveryEntries() {
  const entries = [];
  const deliveryEntries = document.querySelectorAll('.delivery-entry');

  deliveryEntries.forEach(entry => {
    const index = entry.id.replace('delivery-entry-', '');

    // Get vendor from searchable picker
    const vendorPicker = document.getElementById(`delivery-vendor-picker-${index}`);
    const vendorId = vendorPicker?.querySelector('.search-picker-value')?.value || null;

    const description = document.getElementById(`delivery-desc-${index}`)?.value;
    const quantity = document.getElementById(`delivery-qty-${index}`)?.value;
    const unit = document.getElementById(`delivery-unit-${index}`)?.value;
    const receivedBy = document.getElementById(`delivery-received-${index}`)?.value;
    const notes = document.getElementById(`delivery-notes-${index}`)?.value;

    if (description) {
      entries.push({
        vendor_id: vendorId || null,
        description,
        quantity: quantity ? parseFloat(quantity) : null,
        unit: unit || null,
        received_by: receivedBy || null,
        notes: notes || null
      });
    }
  });

  return entries;
}


// ============================================================
// INSPECTION MANAGEMENT
// ============================================================

function addInspectionEntry(data = null) {
  const container = document.getElementById('inspectionList');
  const index = inspectionEntryIndex++;

  const entry = document.createElement('div');
  entry.className = 'inspection-entry';
  entry.id = `inspection-entry-${index}`;

  entry.innerHTML = `
    <div class="entry-row">
      <div class="form-group flex-1">
        <div id="inspection-type-picker-${index}"></div>
      </div>
      <div class="form-group" style="width: 140px;">
        <select id="inspection-result-${index}" class="form-control">
          <option value="scheduled" ${data?.result === 'scheduled' ? 'selected' : ''}>Scheduled</option>
          <option value="passed" ${data?.result === 'passed' ? 'selected' : ''}>Passed</option>
          <option value="failed" ${data?.result === 'failed' ? 'selected' : ''}>Failed</option>
          <option value="partial" ${data?.result === 'partial' ? 'selected' : ''}>Partial Pass</option>
          <option value="cancelled" ${data?.result === 'cancelled' ? 'selected' : ''}>Cancelled</option>
        </select>
      </div>
      <div class="form-group flex-1">
        <input type="text" id="inspection-inspector-${index}" class="form-control" placeholder="Inspector name" value="${data?.inspector || ''}">
      </div>
      <div class="form-group flex-2">
        <input type="text" id="inspection-notes-${index}" class="form-control" placeholder="Notes, corrections needed, etc." value="${data?.notes || ''}">
      </div>
      <button type="button" class="btn btn-icon btn-danger" onclick="removeInspectionEntry(${index})" title="Remove">
        <span>&times;</span>
      </button>
    </div>
  `;

  container.appendChild(entry);

  // Initialize searchable inspection type picker
  const typeContainer = document.getElementById(`inspection-type-picker-${index}`);
  SearchablePicker.init(typeContainer, {
    type: 'custom',
    items: inspectionTypes,
    value: data?.inspection_type ? inspectionTypes.find(i => i.name === data.inspection_type)?.id : null,
    placeholder: 'Search inspection type...'
  });
}

function removeInspectionEntry(index) {
  const entry = document.getElementById(`inspection-entry-${index}`);
  if (entry) entry.remove();
}

function getInspectionEntries() {
  const entries = [];
  const inspectionEntries = document.querySelectorAll('.inspection-entry');

  inspectionEntries.forEach(entry => {
    const index = entry.id.replace('inspection-entry-', '');

    const typePicker = document.getElementById(`inspection-type-picker-${index}`);
    const typeId = typePicker?.querySelector('.search-picker-value')?.value;
    const typeName = typeId ? (inspectionTypes.find(i => i.id === typeId)?.name || typeId) : null;

    const result = document.getElementById(`inspection-result-${index}`)?.value;
    const inspector = document.getElementById(`inspection-inspector-${index}`)?.value;
    const notes = document.getElementById(`inspection-notes-${index}`)?.value;

    if (typeName) {
      entries.push({
        inspection_type: typeName,
        result: result || 'scheduled',
        inspector: inspector || null,
        notes: notes || null
      });
    }
  });

  return entries;
}

// ============================================================
// SAVE/UPDATE
// ============================================================

async function saveLog(status) {
  const jobId = document.getElementById('logJobId').value;
  const logDate = document.getElementById('logDate').value;

  if (!jobId || !logDate) {
    showToast('Job and Date are required', 'error');
    return;
  }

  const logId = document.getElementById('editLogId').value;
  const isEdit = !!logId;

  const payload = {
    job_id: jobId,
    log_date: logDate,
    construction_phase: document.getElementById('constructionPhase').value || null,
    plan_completed: document.getElementById('planCompleted').value || null,
    plan_variance_notes: document.getElementById('planVarianceNotes').value || null,
    weather_conditions: document.getElementById('weatherConditions').value || null,
    temperature_high: document.getElementById('tempHigh').value ? parseInt(document.getElementById('tempHigh').value) : null,
    temperature_low: document.getElementById('tempLow').value ? parseInt(document.getElementById('tempLow').value) : null,
    weather_notes: document.getElementById('weatherNotes').value || null,
    work_completed: document.getElementById('workCompleted').value || null,
    work_planned: document.getElementById('workPlanned').value || null,
    delays_issues: document.getElementById('delaysIssues').value || null,
    site_visitors: document.getElementById('siteVisitors').value || null,
    crew: getCrewEntries(),
    deliveries: getDeliveryEntries(),
    absent_crews: getAbsentEntries(),
    dumpster_exchange: document.getElementById('dumpsterExchange').checked,
    inspections: getInspectionEntries(),
    created_by: 'Jake Ross',
    updated_by: 'Jake Ross'
  };

  try {
    let res;
    if (isEdit) {
      res = await fetch(`/api/daily-logs/${logId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } else {
      res = await fetch('/api/daily-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to save daily log');
    }

    const savedLog = await res.json();

    // If marking as completed, call the complete endpoint
    if (status === 'completed' && savedLog.status !== 'completed') {
      await fetch(`/api/daily-logs/${savedLog.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed_by: 'Jake Ross' })
      });
    }

    showToast(isEdit ? 'Daily log updated' : 'Daily log created', 'success');
    closeModal();
    await loadDailyLogs();
    await loadStats();
  } catch (err) {
    console.error('Failed to save daily log:', err);
    showToast(err.message || 'Failed to save daily log', 'error');
  }
}

async function deleteLog() {
  const logId = document.getElementById('editLogId').value;
  if (!logId) return;

  if (!confirm('Are you sure you want to delete this daily log?')) {
    return;
  }

  try {
    const res = await fetch(`/api/daily-logs/${logId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deleted_by: 'Jake Ross' })
    });

    if (!res.ok) throw new Error('Failed to delete daily log');

    showToast('Daily log deleted', 'success');
    closeModal();
    closeViewModal();
    await loadDailyLogs();
    await loadStats();
  } catch (err) {
    console.error('Failed to delete daily log:', err);
    showToast('Failed to delete daily log', 'error');
  }
}

// ============================================================
// VIEW MODAL
// ============================================================

async function viewLog(logId) {
  try {
    const res = await fetch(`/api/daily-logs/${logId}`);
    if (!res.ok) throw new Error('Failed to load daily log');

    currentLog = await res.json();

    const weather = weatherIcons[currentLog.weather_conditions] || { icon: '🌤️', label: 'Unknown' };
    const date = new Date(currentLog.log_date + 'T00:00:00');
    const dateStr = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

    document.getElementById('viewModalTitle').textContent = dateStr;

    // Show/hide edit and reopen buttons based on status
    document.getElementById('editViewBtn').style.display = currentLog.status === 'completed' ? 'none' : 'inline-flex';
    document.getElementById('reopenBtn').style.display = currentLog.status === 'completed' ? 'inline-flex' : 'none';

    // Construction phase labels
    const phaseLabels = {
      'pre-construction': 'Pre-Construction',
      'site-work': 'Site Work',
      'foundation': 'Foundation',
      'framing': 'Framing',
      'roofing': 'Roofing',
      'mep-rough': 'MEP Rough-In',
      'insulation': 'Insulation',
      'drywall': 'Drywall',
      'interior-trim': 'Interior Trim',
      'paint': 'Paint',
      'flooring': 'Flooring',
      'cabinetry': 'Cabinetry',
      'mep-finish': 'MEP Finish',
      'exterior-finish': 'Exterior Finish',
      'landscaping': 'Landscaping',
      'punch-list': 'Punch List',
      'final-inspection': 'Final Inspection'
    };

    const planStatusLabels = {
      'yes': '✅ Yes - Fully Completed',
      'partial': '⚠️ Partial - Some Done',
      'no': '❌ No - Not Completed'
    };

    let content = `
      <div class="view-log-content">
        <div class="view-section">
          <div class="view-header">
            <div class="view-job">${currentLog.job?.name || 'Unknown Job'}</div>
            <span class="status-badge ${currentLog.status === 'completed' ? 'status-approved' : 'status-draft'}">
              ${currentLog.status === 'completed' ? 'Completed' : 'Draft'}
            </span>
          </div>
          ${currentLog.construction_phase ? `
            <div class="view-phase">
              <span class="phase-label">Phase:</span>
              <span class="phase-value">${phaseLabels[currentLog.construction_phase] || currentLog.construction_phase}</span>
            </div>
          ` : ''}
        </div>

        ${currentLog.plan_completed ? `
        <div class="view-section">
          <h4>Yesterday's Plan Status</h4>
          <div class="view-plan-status">
            <span class="plan-status-value">${planStatusLabels[currentLog.plan_completed] || currentLog.plan_completed}</span>
            ${currentLog.plan_variance_notes ? `<p class="plan-variance-notes">${currentLog.plan_variance_notes}</p>` : ''}
          </div>
        </div>
        ` : ''}

        <div class="view-section">
          <h4>Weather</h4>
          <div class="view-weather">
            <span class="weather-icon-large">${weather.icon}</span>
            <span class="weather-label">${weather.label}</span>
            ${currentLog.temperature_high ? `<span class="weather-temp">High: ${currentLog.temperature_high}°F</span>` : ''}
            ${currentLog.temperature_low ? `<span class="weather-temp">Low: ${currentLog.temperature_low}°F</span>` : ''}
          </div>
          ${currentLog.weather_notes ? `<p class="weather-notes">${currentLog.weather_notes}</p>` : ''}
        </div>
    `;

    // Crew section
    if (currentLog.crew && currentLog.crew.length > 0) {
      content += `
        <div class="view-section">
          <h4>Crew On Site (${currentLog.crew.length})</h4>
          <div class="view-crew-list">
            ${currentLog.crew.map(c => {
              // Look up schedule task name if linked
              const linkedTask = c.schedule_task_id ? state.scheduleTasks.find(t => t.id === c.schedule_task_id) : null;
              return `
              <div class="view-crew-item">
                <div class="crew-vendor">${c.vendor?.name || c.trade || 'Unknown'}</div>
                <div class="crew-details">
                  ${c.worker_count} worker${c.worker_count !== 1 ? 's' : ''}
                  ${c.hours_worked ? ` | ${c.hours_worked} hrs` : ''}
                  ${c.trade && c.vendor ? ` | ${c.trade}` : ''}
                  ${c.work_area ? ` | 📍 ${c.work_area}` : ''}
                  ${c.completion_percent ? ` | ${c.completion_percent}% complete` : ''}
                </div>
                ${linkedTask ? `<div class="crew-task-link">📅 ${linkedTask.name}</div>` : ''}
                ${c.notes ? `<div class="crew-notes">${c.notes}</div>` : ''}
              </div>
            `}).join('')}
          </div>
        </div>
      `;
    }

    // Absent/No-Show section
    if (currentLog.absent_crews && currentLog.absent_crews.length > 0) {
      content += `
        <div class="view-section view-section-warning">
          <h4>Scheduled But Did Not Show (${currentLog.absent_crews.length})</h4>
          <div class="view-absent-list">
            ${currentLog.absent_crews.map(a => {
              // Look up vendor name if vendor_id exists
              const vendorName = a.vendor_id ? state.vendors.find(v => v.id === a.vendor_id)?.name : null;
              return `
                <div class="view-absent-item">
                  <div class="absent-info">
                    <span class="absent-vendor">${vendorName || a.trade || 'Unknown'}</span>
                    ${a.trade && vendorName ? `<span class="absent-trade">${a.trade}</span>` : ''}
                  </div>
                  ${a.reason ? `<div class="absent-reason">${a.reason}</div>` : ''}
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }

    // Deliveries section
    if (currentLog.deliveries && currentLog.deliveries.length > 0) {
      content += `
        <div class="view-section">
          <h4>Deliveries (${currentLog.deliveries.length})</h4>
          <div class="view-delivery-list">
            ${currentLog.deliveries.map(d => `
              <div class="view-delivery-item">
                <div class="delivery-vendor">${d.vendor?.name || 'Unknown Vendor'}</div>
                <div class="delivery-desc">${d.description}${d.quantity ? ` (${d.quantity}${d.unit ? ' ' + d.unit : ''})` : ''}</div>
                ${d.received_by ? `<div class="delivery-received">Received by: ${d.received_by}</div>` : ''}
                ${d.notes ? `<div class="delivery-notes">${d.notes}</div>` : ''}
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    // Dumpster exchange
    if (currentLog.dumpster_exchange) {
      content += `
        <div class="view-section view-dumpster">
          <span class="dumpster-icon">🗑️</span>
          <span class="dumpster-text">Dumpster Exchange Today</span>
        </div>
      `;
    }

    // Inspections section
    if (currentLog.inspections && currentLog.inspections.length > 0) {
      const inspectionResultIcons = {
        'scheduled': '📅',
        'passed': '✅',
        'failed': '❌',
        'partial': '⚠️'
      };
      content += `
        <div class="view-section">
          <h4>Inspections (${currentLog.inspections.length})</h4>
          <div class="view-inspection-list">
            ${currentLog.inspections.map(i => `
              <div class="view-inspection-item">
                <div class="inspection-type">
                  <span class="inspection-icon">${inspectionResultIcons[i.result] || '📋'}</span>
                  <span class="inspection-name">${i.inspection_type}</span>
                  <span class="inspection-result status-badge ${i.result === 'passed' ? 'status-approved' : i.result === 'failed' ? 'status-denied' : 'status-draft'}">${i.result || 'scheduled'}</span>
                </div>
                ${i.inspector ? `<div class="inspection-inspector">Inspector: ${i.inspector}</div>` : ''}
                ${i.notes ? `<div class="inspection-notes">${i.notes}</div>` : ''}
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    // Work summary section
    content += `
      <div class="view-section">
        <h4>Work Summary</h4>
        ${currentLog.work_completed ? `
          <div class="view-field">
            <label>Work Completed</label>
            <p>${currentLog.work_completed}</p>
          </div>
        ` : ''}
        ${currentLog.work_planned ? `
          <div class="view-field">
            <label>Tomorrow's Plan</label>
            <p>${currentLog.work_planned}</p>
          </div>
        ` : ''}
        ${currentLog.delays_issues ? `
          <div class="view-field">
            <label>Delays / Issues</label>
            <p>${currentLog.delays_issues}</p>
          </div>
        ` : ''}
        ${currentLog.site_visitors ? `
          <div class="view-field">
            <label>Site Visitors</label>
            <p>${currentLog.site_visitors}</p>
          </div>
        ` : ''}
      </div>
    `;

    // Photos section
    if (currentLog.attachments && currentLog.attachments.length > 0) {
      // Set currentPhotos for lightbox navigation
      currentPhotos = currentLog.attachments;
      content += `
        <div class="view-section">
          <h4>Photos (${currentLog.attachments.length})</h4>
          <div class="view-photo-grid">
            ${currentLog.attachments.map((photo, index) => {
              const cat = photoCategories.find(c => c.value === photo.category) || photoCategories[4];
              return `
                <div class="view-photo-item" onclick="openLightbox(${index})">
                  <div class="view-photo-image" style="background-image: url('${photo.file_url}')"></div>
                  <div class="view-photo-info">
                    <span class="view-photo-category">${cat.icon} ${cat.label}</span>
                    ${photo.caption ? `<span class="view-photo-caption">${photo.caption}</span>` : ''}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }

    content += '</div>';

    document.getElementById('viewLogContent').innerHTML = content;
    const modal = document.getElementById('viewLogModal');
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('show'), 10);
  } catch (err) {
    console.error('Failed to load daily log:', err);
    showToast('Failed to load daily log', 'error');
  }
}

function closeViewModal() {
  const modal = document.getElementById('viewLogModal');
  modal.classList.remove('show');
  setTimeout(() => {
    modal.style.display = 'none';
  }, 200);
}

function editFromView() {
  if (currentLog) {
    closeViewModal();
    openEditModal(currentLog.id);
  }
}

async function reopenLog() {
  if (!currentLog) return;

  try {
    const res = await fetch(`/api/daily-logs/${currentLog.id}/reopen`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reopened_by: 'Jake Ross' })
    });

    if (!res.ok) throw new Error('Failed to reopen daily log');

    showToast('Daily log reopened', 'success');
    closeViewModal();
    await loadDailyLogs();
    await loadStats();
  } catch (err) {
    console.error('Failed to reopen daily log:', err);
    showToast('Failed to reopen daily log', 'error');
  }
}

// ============================================================
// UTILITY
// ============================================================

function loadJobVendors() {
  // Could load job-specific vendors if needed
  // For now vendors are global
}

// ============================================================
// PHOTO MANAGEMENT
// ============================================================

const photoCategories = [
  { value: 'progress', label: 'Progress', icon: '🏗️' },
  { value: 'delivery', label: 'Delivery', icon: '📦' },
  { value: 'safety', label: 'Safety', icon: '⚠️' },
  { value: 'inspection', label: 'Inspection', icon: '📋' },
  { value: 'other', label: 'Other', icon: '📸' }
];

let currentPhotos = [];
let pendingUploads = [];

// Initialize photo upload area
function initPhotoUpload() {
  const uploadArea = document.getElementById('photoUploadArea');
  const photoInput = document.getElementById('photoInput');

  if (!uploadArea || !photoInput) return;

  // Click to browse
  uploadArea.addEventListener('click', () => {
    photoInput.click();
  });

  // File input change
  photoInput.addEventListener('change', (e) => {
    handlePhotoFiles(e.target.files);
    photoInput.value = ''; // Reset input
  });

  // Drag and drop
  uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('drag-over');
  });

  uploadArea.addEventListener('dragleave', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('drag-over');
  });

  uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('drag-over');
    handlePhotoFiles(e.dataTransfer.files);
  });
}

// Handle selected/dropped files
async function handlePhotoFiles(files) {
  const logId = document.getElementById('editLogId').value;

  // If we don't have a log ID yet, we need to save the log first
  if (!logId) {
    showToast('Please save the daily log first before adding photos', 'warning');
    return;
  }

  const validFiles = Array.from(files).filter(file => {
    if (!file.type.startsWith('image/')) {
      showToast(`${file.name} is not an image`, 'error');
      return false;
    }
    if (file.size > 20 * 1024 * 1024) {
      showToast(`${file.name} is too large (max 20MB)`, 'error');
      return false;
    }
    return true;
  });

  if (validFiles.length === 0) return;

  // Upload each file
  for (const file of validFiles) {
    await uploadPhoto(file, logId);
  }
}

// Upload a single photo
async function uploadPhoto(file, logId, category = 'progress') {
  const gallery = document.getElementById('photoGallery');

  // Create placeholder with loading state
  const placeholderId = `upload-${Date.now()}`;
  const placeholder = document.createElement('div');
  placeholder.className = 'photo-card photo-uploading';
  placeholder.id = placeholderId;
  placeholder.innerHTML = `
    <div class="photo-loading">
      <div class="spinner"></div>
      <span>Uploading...</span>
    </div>
    <div class="photo-name">${file.name}</div>
  `;
  gallery.appendChild(placeholder);

  try {
    const formData = new FormData();
    formData.append('photo', file);
    formData.append('category', category);
    formData.append('uploaded_by', 'Jake Ross');

    const res = await fetch(`/api/daily-logs/${logId}/photos`, {
      method: 'POST',
      body: formData
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Upload failed');
    }

    const photo = await res.json();
    currentPhotos.push(photo);

    // Replace placeholder with actual photo
    placeholder.remove();
    renderPhoto(photo);

    showToast('Photo uploaded', 'success');
  } catch (err) {
    console.error('Photo upload failed:', err);
    placeholder.remove();
    showToast(`Failed to upload ${file.name}`, 'error');
  }
}

// Render a single photo in the gallery
function renderPhoto(photo) {
  const gallery = document.getElementById('photoGallery');
  const category = photoCategories.find(c => c.value === photo.category) || photoCategories[4];

  const card = document.createElement('div');
  card.className = 'photo-card';
  card.id = `photo-${photo.id}`;
  card.innerHTML = `
    <div class="photo-image" style="background-image: url('${photo.file_url}')" onclick="viewPhotoFull('${photo.file_url}', '${photo.id}')">
      <div class="photo-overlay">
        <button class="photo-action-btn" onclick="event.stopPropagation(); viewPhotoFull('${photo.file_url}', '${photo.id}')" title="View full size">
          <span>🔍</span>
        </button>
        <button class="photo-action-btn photo-delete-btn" onclick="event.stopPropagation(); deletePhoto('${photo.id}')" title="Delete">
          <span>🗑️</span>
        </button>
      </div>
    </div>
    <div class="photo-info">
      <div class="photo-category-badge" data-category="${photo.category}">
        ${category.icon} ${category.label}
      </div>
      <input type="text" class="photo-caption-input" placeholder="Add caption..."
             value="${photo.caption || ''}"
             onchange="updatePhotoCaption('${photo.id}', this.value)">
      <select class="photo-category-select" onchange="updatePhotoCategory('${photo.id}', this.value)">
        ${photoCategories.map(c => `
          <option value="${c.value}" ${c.value === photo.category ? 'selected' : ''}>
            ${c.icon} ${c.label}
          </option>
        `).join('')}
      </select>
    </div>
  `;

  gallery.appendChild(card);
}

// Render all photos in the gallery
function renderPhotoGallery() {
  const gallery = document.getElementById('photoGallery');
  gallery.innerHTML = '';

  if (currentPhotos.length === 0) {
    return;
  }

  currentPhotos.forEach(photo => renderPhoto(photo));
}

// Load photos for a daily log
async function loadPhotos(logId) {
  currentPhotos = [];

  if (!logId) {
    renderPhotoGallery();
    return;
  }

  try {
    const res = await fetch(`/api/daily-logs/${logId}/photos`);
    if (res.ok) {
      currentPhotos = await res.json();
    }
  } catch (err) {
    console.error('Failed to load photos:', err);
  }

  renderPhotoGallery();
}

// Update photo caption
async function updatePhotoCaption(photoId, caption) {
  const logId = document.getElementById('editLogId').value;
  if (!logId) return;

  try {
    await fetch(`/api/daily-logs/${logId}/photos/${photoId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caption })
    });
  } catch (err) {
    console.error('Failed to update caption:', err);
    showToast('Failed to update caption', 'error');
  }
}

// Update photo category
async function updatePhotoCategory(photoId, category) {
  const logId = document.getElementById('editLogId').value;
  if (!logId) return;

  try {
    await fetch(`/api/daily-logs/${logId}/photos/${photoId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category })
    });

    // Update the badge
    const card = document.getElementById(`photo-${photoId}`);
    if (card) {
      const cat = photoCategories.find(c => c.value === category) || photoCategories[4];
      const badge = card.querySelector('.photo-category-badge');
      if (badge) {
        badge.dataset.category = category;
        badge.innerHTML = `${cat.icon} ${cat.label}`;
      }
    }

    // Update local state
    const photo = currentPhotos.find(p => p.id === photoId);
    if (photo) photo.category = category;
  } catch (err) {
    console.error('Failed to update category:', err);
    showToast('Failed to update category', 'error');
  }
}

// Delete a photo
async function deletePhoto(photoId) {
  if (!confirm('Delete this photo?')) return;

  const logId = document.getElementById('editLogId').value;
  if (!logId) return;

  try {
    const res = await fetch(`/api/daily-logs/${logId}/photos/${photoId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deleted_by: 'Jake Ross' })
    });

    if (!res.ok) throw new Error('Delete failed');

    // Remove from DOM and state
    const card = document.getElementById(`photo-${photoId}`);
    if (card) card.remove();

    currentPhotos = currentPhotos.filter(p => p.id !== photoId);
    showToast('Photo deleted', 'success');
  } catch (err) {
    console.error('Failed to delete photo:', err);
    showToast('Failed to delete photo', 'error');
  }
}

// ============================================================
// PHOTO LIGHTBOX VIEWER
// ============================================================

let currentLightboxIndex = 0;

// Open lightbox with specific photo
function viewPhotoFull(url, photoId) {
  // Find photo index in currentPhotos array
  const index = currentPhotos.findIndex(p => p.file_url === url || p.id === photoId);
  if (index >= 0) {
    openLightbox(index);
  } else {
    // Fallback: show single image
    openLightboxSingle(url);
  }
}

function openLightbox(index) {
  if (currentPhotos.length === 0) return;

  currentLightboxIndex = index;
  updateLightboxDisplay();

  const lightbox = document.getElementById('photoLightbox');
  lightbox.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function openLightboxSingle(url) {
  const lightbox = document.getElementById('photoLightbox');
  const image = document.getElementById('lightboxImage');
  const caption = document.getElementById('lightboxCaption');
  const meta = document.getElementById('lightboxMeta');
  const counter = document.getElementById('lightboxCounter');

  image.src = url;
  caption.textContent = '';
  meta.textContent = '';
  counter.textContent = '';

  // Hide nav buttons for single image
  document.querySelector('.lightbox-prev').style.display = 'none';
  document.querySelector('.lightbox-next').style.display = 'none';

  lightbox.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function updateLightboxDisplay() {
  const photo = currentPhotos[currentLightboxIndex];
  if (!photo) return;

  const image = document.getElementById('lightboxImage');
  const caption = document.getElementById('lightboxCaption');
  const meta = document.getElementById('lightboxMeta');
  const counter = document.getElementById('lightboxCounter');
  const prevBtn = document.querySelector('.lightbox-prev');
  const nextBtn = document.querySelector('.lightbox-next');

  // Update image
  image.src = photo.file_url;

  // Update caption
  caption.textContent = photo.caption || '';

  // Update meta (category + uploader)
  const cat = photoCategories.find(c => c.value === photo.category);
  const categoryText = cat ? `${cat.icon} ${cat.label}` : '';
  const uploaderText = photo.uploaded_by ? `by ${photo.uploaded_by}` : '';
  meta.textContent = [categoryText, uploaderText].filter(Boolean).join(' • ');

  // Update counter
  counter.textContent = `${currentLightboxIndex + 1} of ${currentPhotos.length}`;

  // Show/hide and enable/disable nav buttons
  prevBtn.style.display = currentPhotos.length > 1 ? 'flex' : 'none';
  nextBtn.style.display = currentPhotos.length > 1 ? 'flex' : 'none';
  prevBtn.disabled = currentLightboxIndex === 0;
  nextBtn.disabled = currentLightboxIndex === currentPhotos.length - 1;
}

function closeLightbox() {
  const lightbox = document.getElementById('photoLightbox');
  lightbox.classList.remove('active');
  document.body.style.overflow = '';
}

function closeLightboxOnOverlay(event) {
  // Only close if clicking the overlay itself, not the content
  if (event.target.id === 'photoLightbox') {
    closeLightbox();
  }
}

function navigateLightbox(direction) {
  const newIndex = currentLightboxIndex + direction;
  if (newIndex >= 0 && newIndex < currentPhotos.length) {
    currentLightboxIndex = newIndex;
    updateLightboxDisplay();
  }
}

// Keyboard navigation for lightbox
document.addEventListener('keydown', (e) => {
  const lightbox = document.getElementById('photoLightbox');
  if (!lightbox || !lightbox.classList.contains('active')) return;

  switch (e.key) {
    case 'Escape':
      closeLightbox();
      break;
    case 'ArrowLeft':
      navigateLightbox(-1);
      break;
    case 'ArrowRight':
      navigateLightbox(1);
      break;
  }
});

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
  initPhotoUpload();
  initOfflineMode();
});

// ============================================================
// VOICE NOTES (Speech-to-Text)
// ============================================================

let recognition = null;
let activeVoiceField = null;

function initVoiceRecognition() {
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    console.warn('Speech recognition not supported');
    return null;
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-US';

  recognition.onresult = (event) => {
    if (!activeVoiceField) return;

    let finalTranscript = '';
    let interimTranscript = '';

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        finalTranscript += transcript;
      } else {
        interimTranscript += transcript;
      }
    }

    const field = document.getElementById(activeVoiceField);
    if (field) {
      // Append final transcript to existing text
      if (finalTranscript) {
        const existing = field.value;
        field.value = existing + (existing ? ' ' : '') + finalTranscript;
      }
    }
  };

  recognition.onerror = (event) => {
    console.error('Speech recognition error:', event.error);
    stopVoiceInput();
    if (event.error === 'not-allowed') {
      showToast('Microphone access denied', 'error');
    } else {
      showToast('Voice input error: ' + event.error, 'error');
    }
  };

  recognition.onend = () => {
    // Clear active state
    const activeBtn = document.querySelector('.btn-voice.recording');
    if (activeBtn) {
      activeBtn.classList.remove('recording');
    }
    activeVoiceField = null;
  };

  return recognition;
}

function startVoiceInput(fieldId) {
  // Check if already recording
  if (activeVoiceField) {
    stopVoiceInput();
    return;
  }

  // Initialize if needed
  if (!recognition) {
    recognition = initVoiceRecognition();
    if (!recognition) {
      showToast('Voice input not supported in this browser', 'warning');
      return;
    }
  }

  activeVoiceField = fieldId;

  // Find and highlight the button
  const field = document.getElementById(fieldId);
  if (field) {
    const label = field.previousElementSibling || field.parentElement.querySelector('label');
    const btn = label?.querySelector('.btn-voice');
    if (btn) {
      btn.classList.add('recording');
    }
  }

  try {
    recognition.start();
    showToast('Listening... Speak now', 'info');
  } catch (err) {
    console.error('Failed to start voice recognition:', err);
    stopVoiceInput();
  }
}

function stopVoiceInput() {
  if (recognition) {
    recognition.stop();
  }
  activeVoiceField = null;

  // Clear all recording states
  document.querySelectorAll('.btn-voice.recording').forEach(btn => {
    btn.classList.remove('recording');
  });
}

// ============================================================
// WEEKLY SUMMARY REPORT
// ============================================================

let currentReportWeek = null;

function openWeeklyReport() {
  if (!state.currentJobId) {
    showToast('Please select a job first', 'warning');
    return;
  }

  // Set to current week (Sunday start)
  const now = new Date();
  const sunday = new Date(now);
  sunday.setDate(sunday.getDate() - sunday.getDay());
  currentReportWeek = sunday.toISOString().split('T')[0];

  document.getElementById('reportWeekStart').value = currentReportWeek;

  const modal = document.getElementById('weeklyReportModal');
  modal.style.display = 'flex';
  setTimeout(() => modal.classList.add('show'), 10);

  loadWeeklyReport();
}

function closeWeeklyReport() {
  const modal = document.getElementById('weeklyReportModal');
  modal.classList.remove('show');
  setTimeout(() => {
    modal.style.display = 'none';
  }, 200);
}

function navigateWeek(direction) {
  const current = new Date(document.getElementById('reportWeekStart').value);
  current.setDate(current.getDate() + (direction * 7));
  document.getElementById('reportWeekStart').value = current.toISOString().split('T')[0];
  loadWeeklyReport();
}

async function loadWeeklyReport() {
  const weekStart = document.getElementById('reportWeekStart').value;
  const content = document.getElementById('weeklyReportContent');

  content.innerHTML = '<div class="loading">Loading report...</div>';

  try {
    const res = await fetch(`/api/daily-logs/report/weekly?job_id=${state.currentJobId}&week_start=${weekStart}`);
    if (!res.ok) throw new Error('Failed to load report');

    const report = await res.json();
    renderWeeklyReport(report);
  } catch (err) {
    console.error('Failed to load weekly report:', err);
    content.innerHTML = '<div class="error-state">Failed to load report</div>';
  }
}

function renderWeeklyReport(report) {
  const content = document.getElementById('weeklyReportContent');
  const weekEnd = new Date(report.week_start);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const formatDate = (dateStr) => new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  content.innerHTML = `
    <div class="weekly-report">
      <div class="report-header">
        <h3>${report.job?.name || 'Unknown Job'}</h3>
        <p class="report-period">${formatDate(report.week_start)} - ${formatDate(report.week_end)}</p>
      </div>

      <div class="report-summary-grid">
        <div class="report-stat">
          <div class="stat-value">${report.total_days_logged}</div>
          <div class="stat-label">Days Logged</div>
        </div>
        <div class="report-stat">
          <div class="stat-value">${report.total_workers}</div>
          <div class="stat-label">Total Workers</div>
        </div>
        <div class="report-stat">
          <div class="stat-value">${report.total_hours.toFixed(1)}</div>
          <div class="stat-label">Total Hours</div>
        </div>
        <div class="report-stat">
          <div class="stat-value">${report.total_deliveries}</div>
          <div class="stat-label">Deliveries</div>
        </div>
        <div class="report-stat">
          <div class="stat-value">${report.total_photos}</div>
          <div class="stat-label">Photos</div>
        </div>
        <div class="report-stat">
          <div class="stat-value">${report.total_absent}</div>
          <div class="stat-label">No-Shows</div>
        </div>
      </div>

      ${report.unique_vendors.length > 0 ? `
        <div class="report-section">
          <h4>Vendors On Site This Week</h4>
          <div class="vendor-tags">
            ${report.unique_vendors.map(v => `<span class="vendor-tag">${v}</span>`).join('')}
          </div>
        </div>
      ` : ''}

      <div class="report-section">
        <h4>Daily Breakdown</h4>
        <table class="report-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Weather</th>
              <th>Crews</th>
              <th>Workers</th>
              <th>Hours</th>
              <th>Deliveries</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${report.daily_logs.length > 0 ? report.daily_logs.map(day => {
              const weatherIcon = weatherIcons[day.weather]?.icon || '🌤️';
              return `
                <tr>
                  <td>${formatDate(day.date)}</td>
                  <td>${weatherIcon} ${day.temp_high ? day.temp_high + '°F' : '-'}</td>
                  <td>${day.crew_count}</td>
                  <td>${day.worker_count}</td>
                  <td>${day.hours.toFixed(1)}</td>
                  <td>${day.delivery_count}</td>
                  <td><span class="status-badge ${day.status === 'completed' ? 'status-approved' : 'status-draft'}">${day.status}</span></td>
                </tr>
              `;
            }).join('') : '<tr><td colspan="7" class="no-data">No logs for this week</td></tr>'}
          </tbody>
        </table>
      </div>

      ${report.work_completed.length > 0 ? `
        <div class="report-section">
          <h4>Work Completed</h4>
          <ul class="report-list">
            ${report.work_completed.map(w => `
              <li><strong>${formatDate(w.date)}:</strong> ${w.work}</li>
            `).join('')}
          </ul>
        </div>
      ` : ''}

      ${report.delays_issues.length > 0 ? `
        <div class="report-section report-section-warning">
          <h4>Delays & Issues</h4>
          <ul class="report-list">
            ${report.delays_issues.map(d => `
              <li><strong>${formatDate(d.date)}:</strong> ${d.issue}</li>
            `).join('')}
          </ul>
        </div>
      ` : ''}
    </div>
  `;
}

function printWeeklyReport() {
  const content = document.getElementById('weeklyReportContent').innerHTML;
  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Weekly Report - Ross Built</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; }
        h3 { margin: 0 0 5px; }
        .report-period { color: #666; margin: 0 0 20px; }
        .report-summary-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px; margin-bottom: 20px; }
        .report-stat { text-align: center; padding: 10px; background: #f5f5f5; border-radius: 8px; }
        .stat-value { font-size: 24px; font-weight: bold; }
        .stat-label { font-size: 12px; color: #666; }
        .report-section { margin-bottom: 20px; }
        .report-section h4 { border-bottom: 1px solid #ddd; padding-bottom: 5px; }
        .report-table { width: 100%; border-collapse: collapse; }
        .report-table th, .report-table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        .report-table th { background: #f5f5f5; }
        .vendor-tag { display: inline-block; background: #e0e0e0; padding: 2px 8px; border-radius: 4px; margin: 2px; font-size: 12px; }
        .report-list { margin: 0; padding-left: 20px; }
        .report-list li { margin-bottom: 5px; }
        .status-badge { padding: 2px 6px; border-radius: 4px; font-size: 11px; }
        .status-approved { background: #d4edda; color: #155724; }
        .status-draft { background: #fff3cd; color: #856404; }
        .report-section-warning { background: #fff3cd; padding: 10px; border-radius: 8px; }
        @media print { body { padding: 0; } }
      </style>
    </head>
    <body>
      ${content}
    </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.print();
}

// ============================================================
// OFFLINE MODE
// ============================================================

let isOnline = navigator.onLine;
let pendingSync = [];

function initOfflineMode() {
  // Monitor online/offline status
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  // Load any pending sync items from localStorage
  const saved = localStorage.getItem('dailyLogs_pendingSync');
  if (saved) {
    pendingSync = JSON.parse(saved);
    updateOfflineBanner();
  }

  // Initial status check
  if (!navigator.onLine) {
    handleOffline();
  }
}

function handleOnline() {
  isOnline = true;
  document.getElementById('offlineBanner').style.display = 'none';
  showToast('Back online', 'success');

  // Sync pending changes
  if (pendingSync.length > 0) {
    syncPendingChanges();
  }
}

function handleOffline() {
  isOnline = false;
  updateOfflineBanner();
  showToast('You are offline', 'warning');
}

function updateOfflineBanner() {
  const banner = document.getElementById('offlineBanner');
  const countSpan = document.getElementById('pendingSyncCount');

  if (!isOnline || pendingSync.length > 0) {
    banner.style.display = 'flex';
    if (pendingSync.length > 0) {
      countSpan.textContent = `(${pendingSync.length} pending)`;
    } else {
      countSpan.textContent = '';
    }
  } else {
    banner.style.display = 'none';
  }
}

function savePendingSync() {
  localStorage.setItem('dailyLogs_pendingSync', JSON.stringify(pendingSync));
  updateOfflineBanner();
}

async function syncPendingChanges() {
  if (pendingSync.length === 0) return;

  showToast(`Syncing ${pendingSync.length} changes...`, 'info');

  const toSync = [...pendingSync];
  pendingSync = [];

  for (const item of toSync) {
    try {
      const res = await fetch(item.url, {
        method: item.method,
        headers: item.headers,
        body: item.body
      });

      if (!res.ok) {
        throw new Error('Sync failed');
      }
    } catch (err) {
      console.error('Failed to sync item:', err);
      pendingSync.push(item);
    }
  }

  savePendingSync();

  if (pendingSync.length === 0) {
    showToast('All changes synced', 'success');
    await loadDailyLogs();
  } else {
    showToast(`${pendingSync.length} changes failed to sync`, 'warning');
  }
}

// Queue a request for offline sync
function queueOfflineRequest(url, method, headers, body) {
  pendingSync.push({ url, method, headers, body, timestamp: Date.now() });
  savePendingSync();
}

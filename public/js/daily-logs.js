// ============================================================
// DAILY LOGS APP - Ross Built CMS
// ============================================================

let state = {
  logs: [],
  jobs: [],
  vendors: [],
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
    });

    // Get initial job selection
    state.currentJobId = window.JobSidebar.getSelectedJobId();
  }

  // Load logs if job is selected
  if (state.currentJobId) {
    await loadDailyLogs();
    await loadStats();
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

  document.getElementById('modalTitle').textContent = 'New Daily Log';
  document.getElementById('editLogId').value = '';
  document.getElementById('deleteLogBtn').style.display = 'none';

  // Reset form
  document.getElementById('logJobId').value = state.currentJobId || '';
  document.getElementById('logDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('weatherConditions').value = '';
  document.getElementById('tempHigh').value = '';
  document.getElementById('tempLow').value = '';
  document.getElementById('weatherNotes').value = '';
  document.getElementById('workCompleted').value = '';
  document.getElementById('delaysIssues').value = '';
  document.getElementById('siteVisitors').value = '';
  document.getElementById('safetyNotes').value = '';

  // Clear crew, absent, delivery, and photo lists
  document.getElementById('crewList').innerHTML = '';
  document.getElementById('absentList').innerHTML = '';
  document.getElementById('deliveryList').innerHTML = '';
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
    crewEntryIndex = 0;
    deliveryEntryIndex = 0;
    absentEntryIndex = 0;

    document.getElementById('modalTitle').textContent = 'Edit Daily Log';
    document.getElementById('editLogId').value = currentLog.id;
    document.getElementById('deleteLogBtn').style.display = 'block';

    // Clear lists first
    document.getElementById('absentList').innerHTML = '';

    // Populate form
    document.getElementById('logJobId').value = currentLog.job_id;
    document.getElementById('logDate').value = currentLog.log_date;
    document.getElementById('workCompleted').value = currentLog.work_completed || '';

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
    document.getElementById('safetyNotes').value = currentLog.safety_notes || '';

    // Populate crew list
    document.getElementById('crewList').innerHTML = '';
    if (currentLog.crew && currentLog.crew.length > 0) {
      currentLog.crew.forEach(crew => addCrewEntry(crew));
    }

    // Populate delivery list
    document.getElementById('deliveryList').innerHTML = '';
    if (currentLog.deliveries && currentLog.deliveries.length > 0) {
      currentLog.deliveries.forEach(delivery => addDeliveryEntry(delivery));
    }

    // Populate absent list
    if (currentLog.absent_crews && currentLog.absent_crews.length > 0) {
      currentLog.absent_crews.forEach(absent => addAbsentEntry(absent));
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
        <select id="crew-vendor-${index}" class="form-control">
          <option value="">Select Vendor...</option>
        </select>
      </div>
      <div class="form-group flex-1">
        <label>Trade</label>
        <input type="text" id="crew-trade-${index}" class="form-control" placeholder="e.g., Framing, Electrical, Plumbing" value="${data?.trade || ''}">
      </div>
    </div>
    <div class="entry-row">
      <div class="form-group" style="width: 120px;">
        <label>Headcount</label>
        <input type="number" id="crew-workers-${index}" class="form-control" placeholder="# workers" min="1" value="${data?.worker_count || ''}">
      </div>
      <div class="form-group" style="width: 120px;">
        <label>Hours</label>
        <input type="number" id="crew-hours-${index}" class="form-control" placeholder="hrs worked" step="0.5" value="${data?.hours_worked || ''}">
      </div>
      <div class="form-group flex-1">
        <label>Work Performed</label>
        <input type="text" id="crew-work-${index}" class="form-control" placeholder="What did they do today?" value="${data?.work_performed || data?.notes || ''}">
      </div>
    </div>
  `;

  container.appendChild(entry);

  // Populate vendor dropdown
  const vendorSelect = document.getElementById(`crew-vendor-${index}`);
  populateVendorDropdown(vendorSelect, data?.vendor_id);
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
    const vendorId = document.getElementById(`crew-vendor-${index}`)?.value;
    const trade = document.getElementById(`crew-trade-${index}`)?.value;
    const workers = document.getElementById(`crew-workers-${index}`)?.value;
    const hours = document.getElementById(`crew-hours-${index}`)?.value;
    const workPerformed = document.getElementById(`crew-work-${index}`)?.value;

    if (vendorId || trade || workers) {
      entries.push({
        vendor_id: vendorId || null,
        trade: trade || null,
        worker_count: parseInt(workers) || 1,
        hours_worked: hours ? parseFloat(hours) : null,
        notes: workPerformed || null  // Store work performed in notes field
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
        <select id="absent-vendor-${index}" class="form-control">
          <option value="">Select Vendor...</option>
        </select>
      </div>
      <div class="form-group flex-1">
        <input type="text" id="absent-trade-${index}" class="form-control" placeholder="Trade" value="${data?.trade || ''}">
      </div>
      <div class="form-group flex-2">
        <input type="text" id="absent-reason-${index}" class="form-control" placeholder="Reason (e.g., Weather, No call/no show, Rescheduled)" value="${data?.reason || ''}">
      </div>
      <button type="button" class="btn btn-icon btn-danger" onclick="removeAbsentEntry(${index})" title="Remove">
        <span>&times;</span>
      </button>
    </div>
  `;

  container.appendChild(entry);

  // Populate vendor dropdown
  const vendorSelect = document.getElementById(`absent-vendor-${index}`);
  populateVendorDropdown(vendorSelect, data?.vendor_id);
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
    const vendorId = document.getElementById(`absent-vendor-${index}`)?.value;
    const trade = document.getElementById(`absent-trade-${index}`)?.value;
    const reason = document.getElementById(`absent-reason-${index}`)?.value;

    if (vendorId || trade) {
      entries.push({
        vendor_id: vendorId || null,
        trade: trade || null,
        reason: reason || null
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
        <select id="delivery-vendor-${index}" class="form-control">
          <option value="">Select Vendor...</option>
        </select>
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

  // Populate vendor dropdown
  const vendorSelect = document.getElementById(`delivery-vendor-${index}`);
  populateVendorDropdown(vendorSelect, data?.vendor_id);
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
    const vendorId = document.getElementById(`delivery-vendor-${index}`)?.value;
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
    weather_conditions: document.getElementById('weatherConditions').value || null,
    temperature_high: document.getElementById('tempHigh').value ? parseInt(document.getElementById('tempHigh').value) : null,
    temperature_low: document.getElementById('tempLow').value ? parseInt(document.getElementById('tempLow').value) : null,
    weather_notes: document.getElementById('weatherNotes').value || null,
    work_completed: document.getElementById('workCompleted').value || null,
    delays_issues: document.getElementById('delaysIssues').value || null,
    site_visitors: document.getElementById('siteVisitors').value || null,
    safety_notes: document.getElementById('safetyNotes').value || null,
    crew: getCrewEntries(),
    deliveries: getDeliveryEntries(),
    absent_crews: getAbsentEntries(),
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

    let content = `
      <div class="view-log-content">
        <div class="view-section">
          <div class="view-header">
            <div class="view-job">${currentLog.job?.name || 'Unknown Job'}</div>
            <span class="status-badge ${currentLog.status === 'completed' ? 'status-approved' : 'status-draft'}">
              ${currentLog.status === 'completed' ? 'Completed' : 'Draft'}
            </span>
          </div>
        </div>

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
            ${currentLog.crew.map(c => `
              <div class="view-crew-item">
                <div class="crew-vendor">${c.vendor?.name || c.trade || 'Unknown'}</div>
                <div class="crew-details">
                  ${c.worker_count} worker${c.worker_count !== 1 ? 's' : ''}
                  ${c.hours_worked ? ` | ${c.hours_worked} hrs` : ''}
                  ${c.trade && c.vendor ? ` | ${c.trade}` : ''}
                </div>
                ${c.notes ? `<div class="crew-notes">${c.notes}</div>` : ''}
              </div>
            `).join('')}
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
        ${currentLog.safety_notes ? `
          <div class="view-field">
            <label>Safety Notes</label>
            <p>${currentLog.safety_notes}</p>
          </div>
        ` : ''}
      </div>
    `;

    // Photos section
    if (currentLog.attachments && currentLog.attachments.length > 0) {
      content += `
        <div class="view-section">
          <h4>Photos (${currentLog.attachments.length})</h4>
          <div class="view-photo-grid">
            ${currentLog.attachments.map(photo => {
              const cat = photoCategories.find(c => c.value === photo.category) || photoCategories[4];
              return `
                <div class="view-photo-item" onclick="viewPhotoFull('${photo.file_url}')">
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
    <div class="photo-image" style="background-image: url('${photo.file_url}')">
      <div class="photo-overlay">
        <button class="photo-action-btn" onclick="viewPhotoFull('${photo.file_url}')" title="View full size">
          <span>🔍</span>
        </button>
        <button class="photo-action-btn photo-delete-btn" onclick="deletePhoto('${photo.id}')" title="Delete">
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

// View photo in full size (opens in new tab or lightbox)
function viewPhotoFull(url) {
  window.open(url, '_blank');
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
  initPhotoUpload();
});

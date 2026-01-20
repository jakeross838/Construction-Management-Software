/**
 * Crew Scheduling Frontend
 * Calendar view, work requests, and task queue management
 */

(function() {
  'use strict';

  let crewMembers = [];
  let jobs = [];
  let contacts = [];
  let schedules = [];
  let pendingRequests = [];
  let selectedCrewId = null;
  let currentDate = new Date();

  // Format currency
  function formatCurrency(amount) {
    const num = parseFloat(amount) || 0;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(num);
  }

  // Format date
  function formatDate(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  // Format time
  function formatTime(timeStr) {
    if (!timeStr) return '';
    const [hours, minutes] = timeStr.split(':');
    const h = parseInt(hours);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${minutes} ${ampm}`;
  }

  // Get initials
  function getInitials(name) {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }

  // ============ DATA LOADING ============

  async function loadCrewMembers() {
    try {
      const response = await fetch('/api/crew/members?active=true');
      if (!response.ok) throw new Error('Failed to load crew');
      crewMembers = await response.json();
      renderCrewList();
    } catch (err) {
      console.error('Error loading crew:', err);
    }
  }

  async function loadJobs() {
    try {
      const response = await fetch('/api/jobs');
      if (!response.ok) throw new Error('Failed to load jobs');
      jobs = await response.json();
      populateJobDropdowns();
    } catch (err) {
      console.error('Error loading jobs:', err);
    }
  }

  async function loadContacts() {
    try {
      const response = await fetch('/api/contacts');
      if (!response.ok) throw new Error('Failed to load contacts');
      contacts = await response.json();
      populateContactDropdown();
    } catch (err) {
      console.error('Error loading contacts:', err);
    }
  }

  async function loadStats() {
    try {
      const response = await fetch('/api/crew/requests/stats');
      if (!response.ok) throw new Error('Failed to load stats');
      const stats = await response.json();

      document.getElementById('statPending').textContent = stats.pending || 0;
      document.getElementById('statScheduled').textContent = stats.scheduled || 0;
      document.getElementById('statInProgress').textContent = stats.in_progress || 0;
    } catch (err) {
      console.error('Error loading stats:', err);
    }
  }

  async function loadSchedules() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const startDate = new Date(year, month, 1).toISOString().split('T')[0];
    const endDate = new Date(year, month + 1, 0).toISOString().split('T')[0];

    try {
      let url = `/api/crew/schedules?start_date=${startDate}&end_date=${endDate}`;
      if (selectedCrewId) {
        url += `&crew_id=${selectedCrewId}`;
      }
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to load schedules');
      schedules = await response.json();
      renderCalendar();
    } catch (err) {
      console.error('Error loading schedules:', err);
    }
  }

  async function loadPendingRequests() {
    try {
      const response = await fetch('/api/crew/requests?status=pending');
      if (!response.ok) throw new Error('Failed to load requests');
      pendingRequests = await response.json();
      renderPendingRequests();
    } catch (err) {
      console.error('Error loading requests:', err);
    }
  }

  async function loadCrewTasks(crewId) {
    const today = new Date().toISOString().split('T')[0];
    try {
      const response = await fetch(`/api/crew/members/${crewId}/tasks?date=${today}`);
      if (!response.ok) throw new Error('Failed to load tasks');
      const tasks = await response.json();
      renderTaskQueue(tasks);
    } catch (err) {
      console.error('Error loading tasks:', err);
    }
  }

  // ============ RENDERING ============

  function renderCrewList() {
    const list = document.getElementById('crewList');

    if (crewMembers.length === 0) {
      list.innerHTML = '<li style="color: var(--text-secondary); font-size: 0.875rem;">No crew members yet</li>';
      return;
    }

    list.innerHTML = crewMembers.map(crew => `
      <li class="crew-item ${selectedCrewId === crew.id ? 'selected' : ''}" onclick="selectCrew('${crew.id}')">
        <div class="crew-avatar">${getInitials(crew.name)}</div>
        <div class="crew-info">
          <div class="crew-name">${crew.name}</div>
          <div class="crew-role">${crew.role || 'Crew'}</div>
        </div>
      </li>
    `).join('');

    // Populate schedule modal dropdown
    const scheduleCrew = document.getElementById('scheduleCrew');
    scheduleCrew.innerHTML = '<option value="">-- Select Crew --</option>' +
      crewMembers.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  }

  function renderCalendar() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    // Update title
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];
    document.getElementById('calendarTitle').textContent = `${monthNames[month]} ${year}`;

    // Build calendar grid
    const grid = document.getElementById('calendarGrid');
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    let html = dayNames.map(d => `<div class="calendar-day-header">${d}</div>`).join('');

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPadding = firstDay.getDay();
    const today = new Date().toISOString().split('T')[0];

    // Previous month padding
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startPadding - 1; i >= 0; i--) {
      const day = prevMonthLastDay - i;
      html += `<div class="calendar-day other-month"><div class="calendar-date">${day}</div></div>`;
    }

    // Current month days
    for (let day = 1; day <= lastDay.getDate(); day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const isToday = dateStr === today;
      const daySchedules = schedules.filter(s => s.date === dateStr);

      html += `
        <div class="calendar-day ${isToday ? 'today' : ''}" onclick="openDayModal('${dateStr}')">
          <div class="calendar-date">${day}</div>
          ${daySchedules.slice(0, 3).map(s => `
            <div class="calendar-event ${s.status}" title="${s.title}">${s.title}</div>
          `).join('')}
          ${daySchedules.length > 3 ? `<div style="font-size: 0.65rem; color: var(--text-secondary);">+${daySchedules.length - 3} more</div>` : ''}
        </div>
      `;
    }

    // Next month padding
    const endPadding = 42 - (startPadding + lastDay.getDate());
    for (let i = 1; i <= endPadding; i++) {
      html += `<div class="calendar-day other-month"><div class="calendar-date">${i}</div></div>`;
    }

    grid.innerHTML = html;
  }

  function renderPendingRequests() {
    const container = document.getElementById('pendingRequests');

    if (pendingRequests.length === 0) {
      container.innerHTML = '<p style="color: var(--text-secondary);">No pending requests</p>';
      return;
    }

    container.innerHTML = pendingRequests.map(req => `
      <div class="request-card" onclick="openScheduleModal('${req.id}')">
        <div class="request-card-header">
          <span class="request-title">${req.title}</span>
          <span class="request-priority ${req.priority}">${req.priority}</span>
        </div>
        <div class="request-meta">
          <span>${req.job?.name || 'No Job'}</span>
          ${req.estimated_hours ? `<span>${req.estimated_hours}h est.</span>` : ''}
          ${req.due_date ? `<span>Due: ${formatDate(req.due_date)}</span>` : ''}
        </div>
      </div>
    `).join('');
  }

  function renderTaskQueue(tasks) {
    const container = document.getElementById('taskList');
    const queueEl = document.getElementById('taskQueue');

    if (!selectedCrewId) {
      queueEl.style.display = 'none';
      return;
    }

    queueEl.style.display = 'block';

    if (tasks.length === 0) {
      container.innerHTML = '<p style="color: var(--text-secondary); font-size: 0.875rem;">No tasks for today</p>';
      return;
    }

    container.innerHTML = tasks.map(task => `
      <div class="task-item">
        <div class="task-checkbox ${task.status === 'completed' ? 'checked' : ''}" onclick="toggleTask('${task.id}', '${task.status}')">
          ${task.status === 'completed' ? '✓' : ''}
        </div>
        <div class="task-content">
          <div class="task-title">${task.title}</div>
          <div class="task-time">${formatTime(task.start_time)} - ${formatTime(task.end_time)}</div>
        </div>
      </div>
    `).join('');
  }

  function populateJobDropdowns() {
    const requestJob = document.getElementById('requestJob');
    const options = '<option value="">-- No Job --</option>' +
      jobs.map(j => `<option value="${j.id}">${j.name}</option>`).join('');
    requestJob.innerHTML = options;
  }

  function populateContactDropdown() {
    const crewContact = document.getElementById('crewContact');
    crewContact.innerHTML = '<option value="">-- No Contact --</option>' +
      contacts.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  }

  // ============ CREW SELECTION ============

  window.selectCrew = function(crewId) {
    selectedCrewId = crewId === selectedCrewId ? null : crewId;
    renderCrewList();
    loadSchedules();
    if (selectedCrewId) {
      loadCrewTasks(selectedCrewId);
    } else {
      document.getElementById('taskQueue').style.display = 'none';
    }
  };

  // ============ CALENDAR NAVIGATION ============

  window.previousMonth = function() {
    currentDate.setMonth(currentDate.getMonth() - 1);
    loadSchedules();
  };

  window.nextMonth = function() {
    currentDate.setMonth(currentDate.getMonth() + 1);
    loadSchedules();
  };

  window.goToToday = function() {
    currentDate = new Date();
    loadSchedules();
  };

  window.openDayModal = function(dateStr) {
    // Could open a day detail modal - for now just log
    console.log('Open day:', dateStr);
  };

  // ============ WORK REQUEST MODAL ============

  window.openRequestModal = function(requestId = null) {
    const modal = document.getElementById('requestModal');
    const title = document.getElementById('requestModalTitle');

    // Reset form
    document.getElementById('requestForm').reset();
    document.getElementById('requestId').value = '';

    if (requestId) {
      title.textContent = 'Edit Work Request';
      // Load request data
      fetch(`/api/crew/requests/${requestId}`)
        .then(r => r.json())
        .then(req => {
          document.getElementById('requestId').value = req.id;
          document.getElementById('requestTitle').value = req.title || '';
          document.getElementById('requestJob').value = req.job_id || '';
          document.getElementById('requestPriority').value = req.priority || 'normal';
          document.getElementById('requestDescription').value = req.description || '';
          document.getElementById('requestEstHours').value = req.estimated_hours || '';
          document.getElementById('requestPreferredDate').value = req.preferred_date || '';
          document.getElementById('requestDueDate').value = req.due_date || '';
          document.getElementById('requestNotes').value = req.notes || '';
        });
    } else {
      title.textContent = 'New Work Request';
    }

    modal.style.display = 'flex';
    modal.classList.add('show');
  };

  window.closeRequestModal = function() {
    const modal = document.getElementById('requestModal');
    modal.classList.remove('show');
    modal.style.display = 'none';
  };

  window.saveRequest = async function() {
    const id = document.getElementById('requestId').value;
    const data = {
      title: document.getElementById('requestTitle').value,
      job_id: document.getElementById('requestJob').value || null,
      priority: document.getElementById('requestPriority').value,
      description: document.getElementById('requestDescription').value,
      estimated_hours: parseFloat(document.getElementById('requestEstHours').value) || null,
      preferred_date: document.getElementById('requestPreferredDate').value || null,
      due_date: document.getElementById('requestDueDate').value || null,
      notes: document.getElementById('requestNotes').value
    };

    if (!data.title) {
      showToast('Title is required', 'error');
      return;
    }

    try {
      const url = id ? `/api/crew/requests/${id}` : '/api/crew/requests';
      const method = id ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (!response.ok) throw new Error('Failed to save request');

      showToast(id ? 'Request updated' : 'Request created', 'success');
      closeRequestModal();
      loadPendingRequests();
      loadStats();
    } catch (err) {
      console.error('Error saving request:', err);
      showToast('Failed to save request', 'error');
    }
  };

  // ============ SCHEDULE MODAL ============

  window.openScheduleModal = function(requestId) {
    const request = pendingRequests.find(r => r.id === requestId);
    if (!request) return;

    document.getElementById('scheduleRequestId').value = requestId;
    document.getElementById('scheduleRequestTitle').textContent = request.title;
    document.getElementById('scheduleDate').value = request.preferred_date || '';
    document.getElementById('scheduleCrew').value = '';
    document.getElementById('scheduleStartTime').value = '08:00';
    document.getElementById('scheduleEndTime').value = '17:00';

    const modal = document.getElementById('scheduleModal');
    modal.style.display = 'flex';
    modal.classList.add('show');
  };

  window.closeScheduleModal = function() {
    const modal = document.getElementById('scheduleModal');
    modal.classList.remove('show');
    modal.style.display = 'none';
  };

  window.scheduleRequest = async function() {
    const requestId = document.getElementById('scheduleRequestId').value;
    const data = {
      crew_id: document.getElementById('scheduleCrew').value,
      date: document.getElementById('scheduleDate').value,
      start_time: document.getElementById('scheduleStartTime').value,
      end_time: document.getElementById('scheduleEndTime').value
    };

    if (!data.crew_id || !data.date) {
      showToast('Crew and date are required', 'error');
      return;
    }

    try {
      const response = await fetch(`/api/crew/requests/${requestId}/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (!response.ok) throw new Error('Failed to schedule');

      showToast('Work scheduled', 'success');
      closeScheduleModal();
      loadPendingRequests();
      loadSchedules();
      loadStats();
    } catch (err) {
      console.error('Error scheduling:', err);
      showToast('Failed to schedule', 'error');
    }
  };

  // ============ CREW MEMBER MODAL ============

  window.openCrewModal = function(crewId = null) {
    const modal = document.getElementById('crewModal');
    const title = document.getElementById('crewModalTitle');

    // Reset form
    document.getElementById('crewForm').reset();
    document.getElementById('crewId').value = '';

    if (crewId) {
      title.textContent = 'Edit Crew Member';
      const crew = crewMembers.find(c => c.id === crewId);
      if (crew) {
        document.getElementById('crewId').value = crew.id;
        document.getElementById('crewName').value = crew.name || '';
        document.getElementById('crewRole').value = crew.role || '';
        document.getElementById('crewRate').value = crew.hourly_rate || '';
        document.getElementById('crewContact').value = crew.contact_id || '';
        document.getElementById('crewNotes').value = crew.notes || '';
      }
    } else {
      title.textContent = 'Add Crew Member';
    }

    modal.style.display = 'flex';
    modal.classList.add('show');
  };

  window.closeCrewModal = function() {
    const modal = document.getElementById('crewModal');
    modal.classList.remove('show');
    modal.style.display = 'none';
  };

  window.saveCrew = async function() {
    const id = document.getElementById('crewId').value;
    const data = {
      name: document.getElementById('crewName').value,
      role: document.getElementById('crewRole').value || null,
      hourly_rate: parseFloat(document.getElementById('crewRate').value) || null,
      contact_id: document.getElementById('crewContact').value || null,
      notes: document.getElementById('crewNotes').value
    };

    if (!data.name) {
      showToast('Name is required', 'error');
      return;
    }

    try {
      const url = id ? `/api/crew/members/${id}` : '/api/crew/members';
      const method = id ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (!response.ok) throw new Error('Failed to save crew');

      showToast(id ? 'Crew member updated' : 'Crew member added', 'success');
      closeCrewModal();
      loadCrewMembers();
    } catch (err) {
      console.error('Error saving crew:', err);
      showToast('Failed to save crew member', 'error');
    }
  };

  // ============ AUTO-SCHEDULE MODAL ============

  window.openAutoScheduleModal = function() {
    const today = new Date().toISOString().split('T')[0];
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    document.getElementById('autoStartDate').value = today;
    document.getElementById('autoEndDate').value = nextWeek;

    const modal = document.getElementById('autoScheduleModal');
    modal.style.display = 'flex';
    modal.classList.add('show');
  };

  window.closeAutoScheduleModal = function() {
    const modal = document.getElementById('autoScheduleModal');
    modal.classList.remove('show');
    modal.style.display = 'none';
  };

  window.runAutoSchedule = async function() {
    const data = {
      start_date: document.getElementById('autoStartDate').value,
      end_date: document.getElementById('autoEndDate').value
    };

    if (!data.start_date) {
      showToast('Start date is required', 'error');
      return;
    }

    try {
      const response = await fetch('/api/crew/auto-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (!response.ok) throw new Error('Failed to auto-schedule');

      const result = await response.json();
      showToast(`Scheduled ${result.scheduled} requests, ${result.skipped} skipped`, 'success');
      closeAutoScheduleModal();
      loadPendingRequests();
      loadSchedules();
      loadStats();
    } catch (err) {
      console.error('Error auto-scheduling:', err);
      showToast('Failed to auto-schedule', 'error');
    }
  };

  // ============ TASK QUEUE ============

  window.toggleTask = async function(taskId, currentStatus) {
    try {
      const endpoint = currentStatus === 'completed' ? 'start' : 'complete';
      const response = await fetch(`/api/crew/schedules/${taskId}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) throw new Error('Failed to update task');

      if (selectedCrewId) {
        loadCrewTasks(selectedCrewId);
      }
      loadSchedules();
      loadStats();
    } catch (err) {
      console.error('Error updating task:', err);
      showToast('Failed to update task', 'error');
    }
  };

  // ============ INITIALIZATION ============

  async function init() {
    await Promise.all([
      loadCrewMembers(),
      loadJobs(),
      loadContacts(),
      loadStats()
    ]);

    await loadSchedules();
    await loadPendingRequests();
  }

  // Auto-init when DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

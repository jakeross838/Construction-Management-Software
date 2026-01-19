/**
 * Tasks Page JavaScript
 * Handles task CRUD, filtering, and board/list views
 */

// State
let tasks = [];
let jobs = [];
let currentTask = null;
let currentView = 'list';

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  setupEventListeners();

  try {
    await loadJobs().catch(err => console.error('Jobs failed:', err));
  } catch (err) {
    console.error('Failed to load reference data:', err);
  }

  await loadTasks();
  loadStats();
});

// Event Listeners
function setupEventListeners() {
  document.getElementById('jobFilter').addEventListener('change', applyFilters);
  document.getElementById('statusFilter').addEventListener('change', applyFilters);
  document.getElementById('priorityFilter').addEventListener('change', applyFilters);
  document.getElementById('assigneeFilter').addEventListener('change', applyFilters);

  let debounceTimer;
  document.getElementById('searchInput').addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => applyFilters(), 150);
  });

  // Enter key for checklist
  document.getElementById('newChecklistItem')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addChecklistItem();
    }
  });
}

// Load Jobs for filters and dropdowns
async function loadJobs() {
  const res = await fetch('/api/jobs');
  if (!res.ok) throw new Error('Failed to load jobs');
  jobs = await res.json();

  const jobFilter = document.getElementById('jobFilter');
  const taskJob = document.getElementById('taskJob');

  jobs.forEach(job => {
    jobFilter.innerHTML += `<option value="${job.id}">${job.name}</option>`;
    taskJob.innerHTML += `<option value="${job.id}">${job.name}</option>`;
  });
}

// Load Tasks
async function loadTasks() {
  try {
    const res = await fetch('/api/tasks?parent_task_id=null');
    if (!res.ok) throw new Error('Failed to load tasks');
    tasks = await res.json();
    renderTasks(tasks);
  } catch (err) {
    console.error('Error loading tasks:', err);
    showToast('Failed to load tasks', 'error');
  }
}

// Load Stats
async function loadStats() {
  try {
    const res = await fetch('/api/tasks/stats');
    if (!res.ok) throw new Error('Failed to load stats');
    const stats = await res.json();

    document.getElementById('statTotal').textContent = stats.total;
    document.getElementById('statTodo').textContent = stats.todo;
    document.getElementById('statInProgress').textContent = stats.in_progress;
    document.getElementById('statCompleted').textContent = stats.completed;
    document.getElementById('statOverdue').textContent = stats.overdue;
  } catch (err) {
    console.error('Error loading stats:', err);
  }
}

// Set View (list or board)
function setView(view) {
  currentView = view;

  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });

  document.getElementById('taskListView').style.display = view === 'list' ? 'block' : 'none';
  document.getElementById('taskBoardView').style.display = view === 'board' ? 'flex' : 'none';

  applyFilters();
}

// Render Tasks
function renderTasks(data) {
  if (currentView === 'list') {
    renderListView(data);
  } else {
    renderBoardView(data);
  }
}

// Render List View
function renderListView(data) {
  const container = document.getElementById('taskListView');
  const emptyState = document.getElementById('emptyState');

  if (!data || data.length === 0) {
    container.innerHTML = '';
    emptyState.style.display = 'block';
    return;
  }

  emptyState.style.display = 'none';

  container.innerHTML = data.map(task => `
    <div class="task-card ${isOverdue(task) ? 'task-overdue' : ''}" onclick="openTaskDetail('${task.id}')">
      <div class="task-card-checkbox">
        <input type="checkbox" ${task.status === 'completed' ? 'checked' : ''}
          onclick="event.stopPropagation(); toggleTaskComplete('${task.id}', this.checked)">
      </div>
      <div class="task-card-content">
        <div class="task-card-header">
          <span class="task-title ${task.status === 'completed' ? 'task-completed' : ''}">${task.title}</span>
          ${getPriorityBadge(task.priority)}
          ${getStatusBadge(task.status)}
        </div>
        <div class="task-card-meta">
          ${task.job?.name ? `<span class="task-job">${task.job.name}</span>` : ''}
          ${task.assigned_to ? `<span class="task-assignee">${task.assigned_to}</span>` : ''}
          ${task.due_date ? `<span class="task-due ${isOverdue(task) ? 'overdue' : ''}">${formatDate(task.due_date)}</span>` : ''}
        </div>
      </div>
    </div>
  `).join('');
}

// Render Board View
function renderBoardView(data) {
  const statuses = ['todo', 'in_progress', 'on_hold', 'completed'];
  const emptyState = document.getElementById('emptyState');

  if (!data || data.length === 0) {
    statuses.forEach(status => {
      document.getElementById(`board${formatStatusId(status)}`).innerHTML = '';
      document.getElementById(`board${formatStatusId(status)}Count`).textContent = '0';
    });
    emptyState.style.display = 'block';
    return;
  }

  emptyState.style.display = 'none';

  statuses.forEach(status => {
    const statusTasks = data.filter(t => t.status === status);
    const container = document.getElementById(`board${formatStatusId(status)}`);
    document.getElementById(`board${formatStatusId(status)}Count`).textContent = statusTasks.length;

    container.innerHTML = statusTasks.map(task => `
      <div class="board-card ${isOverdue(task) ? 'task-overdue' : ''}" onclick="openTaskDetail('${task.id}')">
        <div class="board-card-title">${task.title}</div>
        <div class="board-card-meta">
          ${getPriorityBadge(task.priority)}
          ${task.due_date ? `<span class="task-due ${isOverdue(task) ? 'overdue' : ''}">${formatDate(task.due_date)}</span>` : ''}
        </div>
        ${task.assigned_to ? `<div class="board-card-assignee">${task.assigned_to}</div>` : ''}
      </div>
    `).join('') || '<p class="text-muted">No tasks</p>';
  });
}

// Format status ID for element IDs
function formatStatusId(status) {
  return status.split('_').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('');
}

// Check if task is overdue
function isOverdue(task) {
  if (!task.due_date || ['completed', 'cancelled'].includes(task.status)) return false;
  return new Date(task.due_date) < new Date();
}

// Get Status Badge HTML
function getStatusBadge(status) {
  const statusMap = {
    'todo': { label: 'To Do', class: 'badge-info' },
    'in_progress': { label: 'In Progress', class: 'badge-warning' },
    'on_hold': { label: 'On Hold', class: 'badge-secondary' },
    'completed': { label: 'Completed', class: 'badge-success' },
    'cancelled': { label: 'Cancelled', class: 'badge-danger' }
  };
  const info = statusMap[status] || { label: status, class: '' };
  return `<span class="badge ${info.class}">${info.label}</span>`;
}

// Get Priority Badge HTML
function getPriorityBadge(priority) {
  const map = {
    'urgent': { label: 'Urgent', class: 'badge-danger' },
    'high': { label: 'High', class: 'badge-warning' },
    'normal': { label: 'Normal', class: 'badge-outline' },
    'low': { label: 'Low', class: 'badge-secondary' }
  };
  const info = map[priority] || { label: priority, class: 'badge-outline' };
  return `<span class="badge ${info.class}">${info.label}</span>`;
}

// Apply Filters
function applyFilters() {
  const jobId = document.getElementById('jobFilter').value;
  const status = document.getElementById('statusFilter').value;
  const priority = document.getElementById('priorityFilter').value;
  const assignee = document.getElementById('assigneeFilter').value;
  const search = document.getElementById('searchInput').value.toLowerCase();

  let filtered = tasks;

  if (jobId) {
    filtered = filtered.filter(t => t.job_id === jobId);
  }
  if (status) {
    filtered = filtered.filter(t => t.status === status);
  }
  if (priority) {
    filtered = filtered.filter(t => t.priority === priority);
  }
  if (assignee) {
    if (assignee === 'Unassigned') {
      filtered = filtered.filter(t => !t.assigned_to);
    } else {
      filtered = filtered.filter(t => t.assigned_to === assignee);
    }
  }
  if (search) {
    filtered = filtered.filter(t =>
      (t.title && t.title.toLowerCase().includes(search)) ||
      (t.description && t.description.toLowerCase().includes(search)) ||
      (t.task_number && t.task_number.toLowerCase().includes(search))
    );
  }

  renderTasks(filtered);
}

// Format Date
function formatDate(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString();
}

// Format Type
function formatType(type) {
  const map = {
    'task': 'Task',
    'milestone': 'Milestone',
    'checklist': 'Checklist',
    'reminder': 'Reminder'
  };
  return map[type] || type;
}

// Toggle Task Complete
async function toggleTaskComplete(id, completed) {
  try {
    const endpoint = completed ? `/api/tasks/${id}/complete` : `/api/tasks/${id}/reopen`;
    const res = await fetch(endpoint, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to update task');

    await loadTasks();
    loadStats();
  } catch (err) {
    console.error('Error toggling task:', err);
    showToast(err.message, 'error');
  }
}

// ============================================================
// MODAL FUNCTIONS
// ============================================================

// Open Create Modal
function openCreateModal() {
  document.getElementById('taskId').value = '';
  document.getElementById('taskModalTitle').textContent = 'New Task';
  document.getElementById('taskForm').reset();
  document.getElementById('taskCreatedBy').value = 'Jake Ross';

  const modal = document.getElementById('taskModal');
  modal.style.display = 'flex';
  modal.classList.add('show');
}

// Close Create/Edit Modal
function closeTaskModal() {
  const modal = document.getElementById('taskModal');
  modal.classList.remove('show');
  modal.style.display = 'none';
}

// Open Task Detail
async function openTaskDetail(id) {
  try {
    const res = await fetch(`/api/tasks/${id}`);
    if (!res.ok) throw new Error('Failed to load task');
    currentTask = await res.json();

    populateDetailModal(currentTask);

    const modal = document.getElementById('taskDetailModal');
    modal.style.display = 'flex';
    modal.classList.add('show');
  } catch (err) {
    console.error('Error loading task:', err);
    showToast('Failed to load task details', 'error');
  }
}

// Populate Detail Modal
function populateDetailModal(task) {
  document.getElementById('detailTaskNumber').textContent = task.task_number || 'TASK-????';
  document.getElementById('detailStatus').textContent = formatStatus(task.status);
  document.getElementById('detailStatus').className = `badge ${getStatusClass(task.status)}`;
  document.getElementById('detailPriority').textContent = task.priority?.charAt(0).toUpperCase() + task.priority?.slice(1) || 'Normal';
  document.getElementById('detailPriority').className = `badge ${getPriorityClass(task.priority)}`;

  document.getElementById('detailTitle').textContent = task.title || '-';
  document.getElementById('detailDescription').textContent = task.description || '-';

  // Details
  document.getElementById('detailJob').textContent = task.job?.name || 'General';
  document.getElementById('detailType').textContent = formatType(task.type);
  document.getElementById('detailCategory').textContent = task.category || '-';
  document.getElementById('detailAssignedTo').textContent = task.assigned_to || '-';
  document.getElementById('detailCreatedBy').textContent = task.created_by || '-';

  // Dates
  document.getElementById('detailStartDate').textContent = formatDate(task.start_date);
  document.getElementById('detailDueDate').textContent = formatDate(task.due_date);
  document.getElementById('detailCompletedAt').textContent = formatDate(task.completed_at);
  document.getElementById('detailCreatedAt').textContent = formatDate(task.created_at);

  // Progress
  const progress = task.progress || 0;
  document.getElementById('detailProgress').textContent = progress;
  document.getElementById('detailProgressBar').style.width = `${progress}%`;
  document.getElementById('progressSlider').value = progress;

  // Status select
  document.getElementById('statusSelect').value = task.status;

  // Checklists
  renderChecklists(task.checklists || []);

  // Comments
  renderComments(task.comments || []);

  // Subtasks
  renderSubtasks(task.subtasks || []);

  // Button visibility
  const completeBtn = document.getElementById('completeBtn');
  const reopenBtn = document.getElementById('reopenBtn');
  completeBtn.style.display = task.status !== 'completed' ? 'inline-block' : 'none';
  reopenBtn.style.display = task.status === 'completed' ? 'inline-block' : 'none';
}

// Format Status
function formatStatus(status) {
  const map = {
    'todo': 'To Do',
    'in_progress': 'In Progress',
    'on_hold': 'On Hold',
    'completed': 'Completed',
    'cancelled': 'Cancelled'
  };
  return map[status] || status;
}

// Get Status Class
function getStatusClass(status) {
  const map = {
    'todo': 'badge-info',
    'in_progress': 'badge-warning',
    'on_hold': 'badge-secondary',
    'completed': 'badge-success',
    'cancelled': 'badge-danger'
  };
  return map[status] || '';
}

// Get Priority Class
function getPriorityClass(priority) {
  const map = {
    'urgent': 'badge-danger',
    'high': 'badge-warning',
    'normal': 'badge-outline',
    'low': 'badge-secondary'
  };
  return map[priority] || 'badge-outline';
}

// Render Checklists
function renderChecklists(items) {
  const container = document.getElementById('checklistItems');

  if (!items || items.length === 0) {
    container.innerHTML = '<p class="text-muted">No checklist items</p>';
    return;
  }

  container.innerHTML = items.map(item => `
    <div class="checklist-item">
      <input type="checkbox" ${item.is_completed ? 'checked' : ''}
        onchange="toggleChecklistItem('${item.id}', this.checked)">
      <span class="${item.is_completed ? 'completed' : ''}">${item.description}</span>
      <button class="btn btn-sm btn-danger" onclick="deleteChecklistItem('${item.id}')">x</button>
    </div>
  `).join('');
}

// Render Comments
function renderComments(comments) {
  const container = document.getElementById('commentsList');

  if (!comments || comments.length === 0) {
    container.innerHTML = '<p class="text-muted">No comments</p>';
    return;
  }

  container.innerHTML = comments.map(comment => `
    <div class="comment-item">
      <div class="comment-header">
        <span class="comment-author">${comment.author || 'Anonymous'}</span>
        <span class="comment-date">${formatDate(comment.created_at)}</span>
      </div>
      <div class="comment-content">${comment.content}</div>
    </div>
  `).join('');
}

// Render Subtasks
function renderSubtasks(subtasks) {
  const container = document.getElementById('subtasksList');

  if (!subtasks || subtasks.length === 0) {
    container.innerHTML = '<p class="text-muted">No subtasks</p>';
    return;
  }

  container.innerHTML = subtasks.map(sub => `
    <div class="subtask-item" onclick="openTaskDetail('${sub.id}')">
      <input type="checkbox" ${sub.status === 'completed' ? 'checked' : ''}
        onclick="event.stopPropagation(); toggleTaskComplete('${sub.id}', this.checked)">
      <span class="${sub.status === 'completed' ? 'completed' : ''}">${sub.title}</span>
      ${getStatusBadge(sub.status)}
    </div>
  `).join('');
}

// Close Detail Modal
function closeDetailModal() {
  const modal = document.getElementById('taskDetailModal');
  modal.classList.remove('show');
  modal.style.display = 'none';
  currentTask = null;
}

// Edit Current Task
function editCurrentTask() {
  if (!currentTask) return;

  document.getElementById('taskId').value = currentTask.id;
  document.getElementById('taskModalTitle').textContent = 'Edit Task';
  document.getElementById('taskTitle').value = currentTask.title || '';
  document.getElementById('taskJob').value = currentTask.job_id || '';
  document.getElementById('taskType').value = currentTask.type || 'task';
  document.getElementById('taskDescription').value = currentTask.description || '';
  document.getElementById('taskPriority').value = currentTask.priority || 'normal';
  document.getElementById('taskCategory').value = currentTask.category || '';
  document.getElementById('taskAssignedTo').value = currentTask.assigned_to || '';
  document.getElementById('taskDueDate').value = currentTask.due_date || '';
  document.getElementById('taskStartDate').value = currentTask.start_date || '';
  document.getElementById('taskCreatedBy').value = currentTask.created_by || 'Jake Ross';
  document.getElementById('taskNotes').value = currentTask.notes || '';

  closeDetailModal();

  const modal = document.getElementById('taskModal');
  modal.style.display = 'flex';
  modal.classList.add('show');
}

// Save Task
async function saveTask() {
  const id = document.getElementById('taskId').value;
  const data = {
    job_id: document.getElementById('taskJob').value || null,
    title: document.getElementById('taskTitle').value,
    type: document.getElementById('taskType').value,
    description: document.getElementById('taskDescription').value || null,
    priority: document.getElementById('taskPriority').value,
    category: document.getElementById('taskCategory').value || null,
    assigned_to: document.getElementById('taskAssignedTo').value || null,
    due_date: document.getElementById('taskDueDate').value || null,
    start_date: document.getElementById('taskStartDate').value || null,
    created_by: document.getElementById('taskCreatedBy').value,
    notes: document.getElementById('taskNotes').value || null
  };

  if (!data.title) {
    showToast('Title is required', 'error');
    return;
  }

  try {
    const url = id ? `/api/tasks/${id}` : '/api/tasks';
    const method = id ? 'PATCH' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to save task');
    }

    showToast(id ? 'Task updated' : 'Task created', 'success');
    closeTaskModal();
    await loadTasks();
    loadStats();
  } catch (err) {
    console.error('Error saving task:', err);
    showToast(err.message, 'error');
  }
}

// Complete Task
async function completeTask() {
  if (!currentTask) return;

  try {
    const res = await fetch(`/api/tasks/${currentTask.id}/complete`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to complete task');

    showToast('Task completed', 'success');
    closeDetailModal();
    await loadTasks();
    loadStats();
  } catch (err) {
    console.error('Error completing task:', err);
    showToast(err.message, 'error');
  }
}

// Reopen Task
async function reopenTask() {
  if (!currentTask) return;

  try {
    const res = await fetch(`/api/tasks/${currentTask.id}/reopen`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to reopen task');

    showToast('Task reopened', 'success');
    closeDetailModal();
    await loadTasks();
    loadStats();
  } catch (err) {
    console.error('Error reopening task:', err);
    showToast(err.message, 'error');
  }
}

// Update Status
async function updateStatus(status) {
  if (!currentTask) return;

  try {
    const res = await fetch(`/api/tasks/${currentTask.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });

    if (!res.ok) throw new Error('Failed to update status');

    showToast('Status updated', 'success');
    openTaskDetail(currentTask.id);
    await loadTasks();
    loadStats();
  } catch (err) {
    console.error('Error updating status:', err);
    showToast(err.message, 'error');
  }
}

// Update Progress
async function updateProgress(progress) {
  if (!currentTask) return;

  try {
    const res = await fetch(`/api/tasks/${currentTask.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ progress: parseInt(progress) })
    });

    if (!res.ok) throw new Error('Failed to update progress');

    document.getElementById('detailProgress').textContent = progress;
    document.getElementById('detailProgressBar').style.width = `${progress}%`;
  } catch (err) {
    console.error('Error updating progress:', err);
    showToast(err.message, 'error');
  }
}

// Delete Task
async function deleteTask() {
  if (!currentTask) return;

  if (!confirm('Are you sure you want to delete this task?')) return;

  try {
    const res = await fetch(`/api/tasks/${currentTask.id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete task');

    showToast('Task deleted', 'success');
    closeDetailModal();
    await loadTasks();
    loadStats();
  } catch (err) {
    console.error('Error deleting task:', err);
    showToast(err.message, 'error');
  }
}

// ============================================================
// CHECKLISTS
// ============================================================

// Add Checklist Item
async function addChecklistItem() {
  if (!currentTask) return;

  const input = document.getElementById('newChecklistItem');
  const description = input.value.trim();

  if (!description) return;

  try {
    const res = await fetch(`/api/tasks/${currentTask.id}/checklists`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description })
    });

    if (!res.ok) throw new Error('Failed to add checklist item');

    input.value = '';
    openTaskDetail(currentTask.id);
  } catch (err) {
    console.error('Error adding checklist item:', err);
    showToast(err.message, 'error');
  }
}

// Toggle Checklist Item
async function toggleChecklistItem(itemId, completed) {
  if (!currentTask) return;

  try {
    const res = await fetch(`/api/tasks/${currentTask.id}/checklists/${itemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_completed: completed })
    });

    if (!res.ok) throw new Error('Failed to update checklist item');
  } catch (err) {
    console.error('Error toggling checklist item:', err);
    showToast(err.message, 'error');
  }
}

// Delete Checklist Item
async function deleteChecklistItem(itemId) {
  if (!currentTask) return;

  try {
    const res = await fetch(`/api/tasks/${currentTask.id}/checklists/${itemId}`, {
      method: 'DELETE'
    });

    if (!res.ok) throw new Error('Failed to delete checklist item');

    openTaskDetail(currentTask.id);
  } catch (err) {
    console.error('Error deleting checklist item:', err);
    showToast(err.message, 'error');
  }
}

// ============================================================
// COMMENTS
// ============================================================

// Add Comment
async function addComment() {
  if (!currentTask) return;

  const textarea = document.getElementById('newComment');
  const content = textarea.value.trim();

  if (!content) return;

  try {
    const res = await fetch(`/api/tasks/${currentTask.id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, author: 'Jake Ross' })
    });

    if (!res.ok) throw new Error('Failed to add comment');

    textarea.value = '';
    openTaskDetail(currentTask.id);
  } catch (err) {
    console.error('Error adding comment:', err);
    showToast(err.message, 'error');
  }
}

// ============================================================
// SUBTASKS
// ============================================================

// Open Subtask Modal (reuse task modal)
function openSubtaskModal() {
  if (!currentTask) return;

  document.getElementById('taskId').value = '';
  document.getElementById('taskModalTitle').textContent = 'New Subtask';
  document.getElementById('taskForm').reset();
  document.getElementById('taskJob').value = currentTask.job_id || '';
  document.getElementById('taskCreatedBy').value = 'Jake Ross';

  // Store parent task ID
  document.getElementById('taskId').dataset.parentId = currentTask.id;

  closeDetailModal();

  const modal = document.getElementById('taskModal');
  modal.style.display = 'flex';
  modal.classList.add('show');
}

// Override saveTask for subtasks
const originalSaveTask = saveTask;
saveTask = async function() {
  const parentId = document.getElementById('taskId').dataset.parentId;

  if (parentId) {
    const id = document.getElementById('taskId').value;
    const data = {
      job_id: document.getElementById('taskJob').value || null,
      title: document.getElementById('taskTitle').value,
      type: document.getElementById('taskType').value,
      description: document.getElementById('taskDescription').value || null,
      priority: document.getElementById('taskPriority').value,
      category: document.getElementById('taskCategory').value || null,
      assigned_to: document.getElementById('taskAssignedTo').value || null,
      due_date: document.getElementById('taskDueDate').value || null,
      start_date: document.getElementById('taskStartDate').value || null,
      created_by: document.getElementById('taskCreatedBy').value,
      notes: document.getElementById('taskNotes').value || null,
      parent_task_id: parentId
    };

    if (!data.title) {
      showToast('Title is required', 'error');
      return;
    }

    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create subtask');
      }

      showToast('Subtask created', 'success');
      closeTaskModal();
      delete document.getElementById('taskId').dataset.parentId;
      openTaskDetail(parentId);
    } catch (err) {
      console.error('Error creating subtask:', err);
      showToast(err.message, 'error');
    }
  } else {
    await originalSaveTask();
  }
};

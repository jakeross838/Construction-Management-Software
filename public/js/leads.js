/**
 * Leads/CRM Management
 * Handles lead listing, pipeline view, activities, tasks, and job conversion
 */

let leads = [];
let sources = [];
let currentLead = null;
let debounceTimer;
let currentView = localStorage.getItem('leadsView') || 'table';

const PIPELINE_STAGES = [
  { id: 'inquiry', name: 'Inquiry', color: 'var(--accent-blue)' },
  { id: 'qualification', name: 'Qualification', color: 'var(--accent-orange)' },
  { id: 'consultation', name: 'Consultation', color: 'var(--accent-purple, #a855f7)' },
  { id: 'design_agreement', name: 'Design Agreement', color: 'var(--accent-cyan, #06b6d4)' },
  { id: 'proposal', name: 'Proposal', color: 'var(--accent-yellow, #eab308)' },
  { id: 'contract', name: 'Contract', color: 'var(--accent-green)' }
];

const BUDGET_LABELS = {
  'under_500k': 'Under $500K',
  '500k_1m': '$500K - $1M',
  '1m_2m': '$1M - $2M',
  '2m_5m': '$2M - $5M',
  'over_5m': 'Over $5M'
};

const TIMELINE_LABELS = {
  'immediate': 'Immediate',
  '3_6_months': '3-6 Months',
  '6_12_months': '6-12 Months',
  '12_plus_months': '12+ Months'
};

const PROJECT_TYPE_LABELS = {
  'new_construction': 'New Construction',
  'major_renovation': 'Major Renovation',
  'addition': 'Addition',
  'remodel': 'Remodel'
};

// ============================================================
// INITIALIZATION
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
  setupEventListeners();
  initializeView();

  try {
    await loadSources();
  } catch (err) {
    console.error('Sources failed:', err);
  }

  await loadLeads();
  await loadStats();
});

function initializeView() {
  const tableView = document.getElementById('leadTableView');
  const pipelineView = document.getElementById('pipelineView');

  if (tableView) tableView.style.display = currentView === 'table' ? 'block' : 'none';
  if (pipelineView) pipelineView.style.display = currentView === 'pipeline' ? 'flex' : 'none';

  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === currentView);
  });
}

function setupEventListeners() {
  document.getElementById('stageFilter')?.addEventListener('change', applyFilters);
  document.getElementById('sourceFilter')?.addEventListener('change', applyFilters);

  document.getElementById('searchInput')?.addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    const clearBtn = document.getElementById('searchClear');
    if (clearBtn) clearBtn.style.display = e.target.value ? 'block' : 'none';
    debounceTimer = setTimeout(() => applyFilters(), 150);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal();
      closeDetailModal();
      closeActivityModal();
      closeTaskModal();
      closeLostModal();
    }
  });

  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal();
        closeDetailModal();
        closeActivityModal();
        closeTaskModal();
        closeLostModal();
      }
    });
  });
}

// ============================================================
// DATA LOADING
// ============================================================

async function loadSources() {
  const response = await fetch('/api/leads/sources');
  sources = await response.json();
  populateSourceDropdowns();
}

function populateSourceDropdowns() {
  const selectors = ['sourceFilter', 'formSource'];
  selectors.forEach(id => {
    const select = document.getElementById(id);
    if (!select) return;

    const currentValue = select.value;
    const isFilter = id === 'sourceFilter';

    select.innerHTML = `<option value="">${isFilter ? 'All Sources' : 'Select Source...'}</option>`;
    sources.forEach(src => {
      const option = document.createElement('option');
      option.value = src.id;
      option.textContent = src.name;
      select.appendChild(option);
    });

    if (currentValue) select.value = currentValue;
  });
}

async function loadLeads() {
  const params = new URLSearchParams();
  const stage = document.getElementById('stageFilter')?.value;
  const sourceId = document.getElementById('sourceFilter')?.value;
  const search = document.getElementById('searchInput')?.value;

  if (stage) params.append('stage', stage);
  if (sourceId) params.append('source_id', sourceId);
  if (search) params.append('search', search);

  try {
    const response = await fetch(`/api/leads?${params}`);
    leads = await response.json();
    renderLeads();
  } catch (err) {
    console.error('Failed to load leads:', err);
    showToast('Failed to load leads', 'error');
  }
}

async function loadStats() {
  try {
    const response = await fetch('/api/leads/stats');
    const stats = await response.json();

    document.getElementById('statTotal').textContent = stats.total || 0;
    document.getElementById('statActive').textContent = stats.by_outcome?.active || 0;
    document.getElementById('statWon').textContent = stats.by_outcome?.won || 0;
    document.getElementById('statLost').textContent = stats.by_outcome?.lost || 0;
    document.getElementById('statHot').textContent = stats.hot_leads || 0;
  } catch (err) {
    console.error('Failed to load stats:', err);
  }
}

function applyFilters() {
  loadLeads();
}

function clearSearch() {
  document.getElementById('searchInput').value = '';
  document.getElementById('searchClear').style.display = 'none';
  applyFilters();
}

// ============================================================
// RENDERING
// ============================================================

function renderLeads() {
  if (currentView === 'table') {
    renderTableView();
  } else {
    renderPipelineView();
  }
}

function renderTableView() {
  const tbody = document.getElementById('leadTableBody');
  if (!tbody) return;

  if (leads.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="empty-state">
          <p>No leads found</p>
          <button class="btn btn-primary btn-sm" onclick="openCreateModal()">+ Create First Lead</button>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = leads.map(lead => `
    <tr onclick="openDetailModal('${lead.id}')" style="cursor: pointer;">
      <td class="col-name">
        <strong>${lead.first_name} ${lead.last_name}</strong>
      </td>
      <td class="col-contact">
        ${lead.email ? `<div class="text-small">${lead.email}</div>` : ''}
        ${lead.phone ? `<div class="text-small text-muted">${lead.phone}</div>` : ''}
      </td>
      <td class="col-source">
        ${lead.source?.name || '-'}
      </td>
      <td class="col-stage">
        <span class="badge ${getStageClass(lead.stage)}">${formatStage(lead.stage)}</span>
      </td>
      <td class="col-score">
        ${renderScoreBadge(lead.qualification_score)}
      </td>
      <td class="col-budget">
        ${BUDGET_LABELS[lead.budget_range] || '-'}
      </td>
      <td class="col-tasks">
        ${renderTaskBadge(lead.task_counts)}
      </td>
      <td class="col-date">
        ${formatDate(lead.created_at)}
      </td>
    </tr>
  `).join('');
}

function renderPipelineView() {
  const container = document.getElementById('pipelineColumns');
  if (!container) return;

  // Group leads by stage (excluding won/lost)
  const stageLeads = {};
  PIPELINE_STAGES.forEach(stage => {
    stageLeads[stage.id] = leads.filter(l => l.stage === stage.id);
  });

  container.innerHTML = PIPELINE_STAGES.map(stage => `
    <div class="pipeline-column" data-stage="${stage.id}">
      <div class="pipeline-column-header" style="border-top-color: ${stage.color}">
        <span class="pipeline-column-title">${stage.name}</span>
        <span class="pipeline-column-count">${stageLeads[stage.id].length}</span>
      </div>
      <div class="pipeline-column-body" ondragover="allowDrop(event)" ondrop="dropLead(event, '${stage.id}')">
        ${stageLeads[stage.id].length === 0 ? '<div class="pipeline-empty">No leads</div>' : ''}
        ${stageLeads[stage.id].map(lead => `
          <div class="pipeline-card" draggable="true" ondragstart="dragLead(event, '${lead.id}')" onclick="openDetailModal('${lead.id}')">
            <div class="pipeline-card-header">
              <strong>${lead.first_name} ${lead.last_name}</strong>
              ${renderScoreBadge(lead.qualification_score)}
            </div>
            <div class="pipeline-card-body">
              ${lead.budget_range ? `<div class="text-small">${BUDGET_LABELS[lead.budget_range]}</div>` : ''}
              ${lead.source?.name ? `<div class="text-small text-muted">${lead.source.name}</div>` : ''}
            </div>
            ${lead.task_counts?.pending > 0 ? `
              <div class="pipeline-card-footer">
                <span class="text-small text-warning">${lead.task_counts.pending} pending task${lead.task_counts.pending > 1 ? 's' : ''}</span>
              </div>
            ` : ''}
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');
}

// ============================================================
// DRAG AND DROP (Pipeline View)
// ============================================================

function dragLead(event, leadId) {
  event.dataTransfer.setData('leadId', leadId);
}

function allowDrop(event) {
  event.preventDefault();
}

async function dropLead(event, newStage) {
  event.preventDefault();
  const leadId = event.dataTransfer.getData('leadId');

  try {
    const response = await fetch(`/api/leads/${leadId}/stage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: newStage })
    });

    if (!response.ok) throw new Error('Failed to update stage');

    showToast('Stage updated', 'success');
    await loadLeads();
    await loadStats();
  } catch (err) {
    console.error('Stage update failed:', err);
    showToast('Failed to update stage', 'error');
  }
}

// ============================================================
// VIEW TOGGLE
// ============================================================

function setView(view) {
  currentView = view;
  localStorage.setItem('leadsView', view);

  const tableView = document.getElementById('leadTableView');
  const pipelineView = document.getElementById('pipelineView');

  if (tableView) tableView.style.display = view === 'table' ? 'block' : 'none';
  if (pipelineView) pipelineView.style.display = view === 'pipeline' ? 'flex' : 'none';

  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });

  renderLeads();
}

// ============================================================
// HELPERS
// ============================================================

function getStageClass(stage) {
  const classes = {
    'inquiry': 'badge-info',
    'qualification': 'badge-warning',
    'consultation': 'badge-purple',
    'design_agreement': 'badge-cyan',
    'proposal': 'badge-yellow',
    'contract': 'badge-success',
    'won': 'badge-success',
    'lost': 'badge-danger'
  };
  return classes[stage] || 'badge-secondary';
}

function formatStage(stage) {
  return stage.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function renderScoreBadge(score) {
  if (score === null || score === undefined) return '<span class="badge badge-secondary">-</span>';

  let className = 'badge-secondary';
  let label = 'Cold';

  if (score >= 12) {
    className = 'badge-success';
    label = 'Hot';
  } else if (score >= 8) {
    className = 'badge-warning';
    label = 'Warm';
  } else if (score >= 4) {
    className = 'badge-info';
    label = 'Cool';
  }

  return `<span class="badge ${className}" title="Score: ${score}/15">${label}</span>`;
}

function renderTaskBadge(counts) {
  if (!counts || (counts.pending === 0 && counts.completed === 0)) return '-';

  if (counts.pending > 0) {
    return `<span class="badge badge-warning">${counts.pending} pending</span>`;
  }
  return `<span class="badge badge-success">${counts.completed} done</span>`;
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

// ============================================================
// CREATE/EDIT MODAL
// ============================================================

function openCreateModal() {
  currentLead = null;
  document.getElementById('modalTitle').textContent = 'New Lead';
  document.getElementById('leadForm').reset();
  document.getElementById('leadId').value = '';

  const modal = document.getElementById('leadModal');
  modal.style.display = 'flex';
  modal.classList.add('show');
}

function closeModal() {
  const modal = document.getElementById('leadModal');
  modal.classList.remove('show');
  modal.style.display = 'none';
}

async function saveLead() {
  const id = document.getElementById('leadId').value;
  const data = {
    first_name: document.getElementById('formFirstName').value.trim(),
    last_name: document.getElementById('formLastName').value.trim(),
    email: document.getElementById('formEmail').value.trim() || null,
    phone: document.getElementById('formPhone').value.trim() || null,
    lead_source_id: document.getElementById('formSource').value || null,
    referral_source: document.getElementById('formReferralSource').value.trim() || null,
    project_type: document.getElementById('formProjectType').value || null,
    budget_range: document.getElementById('formBudgetRange').value || null,
    project_address: document.getElementById('formProjectAddress').value.trim() || null,
    timeline: document.getElementById('formTimeline').value || null,
    square_footage: parseInt(document.getElementById('formSquareFootage').value) || null,
    architectural_style: document.getElementById('formStyle').value.trim() || null,
    is_decision_maker: document.getElementById('formIsDecisionMaker').checked,
    has_lot: document.getElementById('formHasLot').checked,
    has_architect: document.getElementById('formHasArchitect').checked,
    has_plans: document.getElementById('formHasPlans').checked,
    financing_status: document.getElementById('formFinancingStatus').value || null,
    notes: document.getElementById('formNotes').value.trim() || null
  };

  if (!data.first_name || !data.last_name) {
    showToast('First name and last name are required', 'error');
    return;
  }

  try {
    const url = id ? `/api/leads/${id}` : '/api/leads';
    const method = id ? 'PATCH' : 'POST';

    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.message || 'Failed to save lead');
    }

    showToast(id ? 'Lead updated' : 'Lead created', 'success');
    closeModal();
    await loadLeads();
    await loadStats();
  } catch (err) {
    console.error('Save failed:', err);
    showToast(err.message || 'Failed to save lead', 'error');
  }
}

// ============================================================
// DETAIL MODAL
// ============================================================

async function openDetailModal(leadId) {
  try {
    const response = await fetch(`/api/leads/${leadId}`);
    if (!response.ok) throw new Error('Lead not found');

    currentLead = await response.json();
    populateDetailModal();

    const modal = document.getElementById('leadDetailModal');
    modal.style.display = 'flex';
    modal.classList.add('show');
  } catch (err) {
    console.error('Failed to load lead:', err);
    showToast('Failed to load lead details', 'error');
  }
}

function closeDetailModal() {
  const modal = document.getElementById('leadDetailModal');
  modal.classList.remove('show');
  modal.style.display = 'none';
  currentLead = null;
}

function populateDetailModal() {
  if (!currentLead) return;

  document.getElementById('detailTitle').textContent = `${currentLead.first_name} ${currentLead.last_name}`;

  // Badges
  const badgesHtml = `
    <span class="badge ${getStageClass(currentLead.stage)}">${formatStage(currentLead.stage)}</span>
    ${renderScoreBadge(currentLead.qualification_score)}
  `;
  document.getElementById('detailBadges').innerHTML = badgesHtml;

  // Overview
  document.getElementById('detailName').textContent = `${currentLead.first_name} ${currentLead.last_name}`;
  document.getElementById('detailEmail').innerHTML = currentLead.email ? `<a href="mailto:${currentLead.email}">${currentLead.email}</a>` : '-';
  document.getElementById('detailPhone').innerHTML = currentLead.phone ? `<a href="tel:${currentLead.phone}">${currentLead.phone}</a>` : '-';
  document.getElementById('detailSource').textContent = currentLead.source?.name || '-';

  document.getElementById('detailProjectType').textContent = PROJECT_TYPE_LABELS[currentLead.project_type] || '-';
  document.getElementById('detailBudget').textContent = BUDGET_LABELS[currentLead.budget_range] || '-';
  document.getElementById('detailTimeline').textContent = TIMELINE_LABELS[currentLead.timeline] || '-';
  document.getElementById('detailAddress').textContent = currentLead.project_address || '-';

  document.getElementById('detailScore').textContent = currentLead.qualification_score !== null ? `${currentLead.qualification_score}/15` : '-';
  document.getElementById('detailDecisionMaker').textContent = currentLead.is_decision_maker ? 'Yes' : 'No';
  document.getElementById('detailFinancing').textContent = currentLead.financing_status ? formatStage(currentLead.financing_status) : '-';
  document.getElementById('detailHasPlans').textContent = currentLead.has_plans ? 'Yes' : 'No';

  document.getElementById('detailStage').innerHTML = `<span class="badge ${getStageClass(currentLead.stage)}">${formatStage(currentLead.stage)}</span>`;
  document.getElementById('detailStageSince').textContent = formatDateTime(currentLead.stage_entered_at);
  document.getElementById('detailCreated').textContent = formatDateTime(currentLead.created_at);

  document.getElementById('detailNotes').textContent = currentLead.notes || 'No notes';

  // Stage selector
  const stageSelect = document.getElementById('stageSelect');
  if (stageSelect && !['won', 'lost'].includes(currentLead.stage)) {
    stageSelect.value = currentLead.stage;
    document.getElementById('stageActions').style.display = 'block';
  } else {
    document.getElementById('stageActions').style.display = 'none';
  }

  // Conversion buttons
  const conversionButtons = document.getElementById('conversionButtons');
  if (['won', 'lost'].includes(currentLead.stage)) {
    conversionButtons.style.display = 'none';
  } else {
    conversionButtons.style.display = 'flex';
  }

  // Job link
  const jobLinkSection = document.getElementById('detailJobLink');
  if (currentLead.job_id && currentLead.job) {
    jobLinkSection.style.display = 'block';
    document.getElementById('detailJobLinkAnchor').href = `jobs.html?id=${currentLead.job_id}`;
    document.getElementById('detailJobLinkAnchor').textContent = currentLead.job.name;
  } else {
    jobLinkSection.style.display = 'none';
  }

  // Render tabs
  renderActivities();
  renderTasks();
  renderDocuments();
  renderHistory();

  // Switch to overview tab
  switchDetailTab('overview');
}

function switchDetailTab(tabName) {
  document.querySelectorAll('#leadDetailModal .tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.tab === tabName);
  });
  document.querySelectorAll('#leadDetailModal .tab-content').forEach(content => {
    content.classList.toggle('active', content.id === `tab-${tabName}`);
  });
}

async function changeStage() {
  const newStage = document.getElementById('stageSelect').value;
  if (!currentLead || newStage === currentLead.stage) return;

  try {
    const response = await fetch(`/api/leads/${currentLead.id}/stage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: newStage })
    });

    if (!response.ok) throw new Error('Failed to update stage');

    showToast('Stage updated', 'success');
    await openDetailModal(currentLead.id);
    await loadLeads();
    await loadStats();
  } catch (err) {
    console.error('Stage update failed:', err);
    showToast('Failed to update stage', 'error');
  }
}

function editLead() {
  if (!currentLead) return;

  document.getElementById('modalTitle').textContent = 'Edit Lead';
  document.getElementById('leadId').value = currentLead.id;
  document.getElementById('formFirstName').value = currentLead.first_name || '';
  document.getElementById('formLastName').value = currentLead.last_name || '';
  document.getElementById('formEmail').value = currentLead.email || '';
  document.getElementById('formPhone').value = currentLead.phone || '';
  document.getElementById('formSource').value = currentLead.lead_source_id || '';
  document.getElementById('formReferralSource').value = currentLead.referral_source || '';
  document.getElementById('formProjectType').value = currentLead.project_type || '';
  document.getElementById('formBudgetRange').value = currentLead.budget_range || '';
  document.getElementById('formProjectAddress').value = currentLead.project_address || '';
  document.getElementById('formTimeline').value = currentLead.timeline || '';
  document.getElementById('formSquareFootage').value = currentLead.square_footage || '';
  document.getElementById('formStyle').value = currentLead.architectural_style || '';
  document.getElementById('formIsDecisionMaker').checked = currentLead.is_decision_maker || false;
  document.getElementById('formHasLot').checked = currentLead.has_lot || false;
  document.getElementById('formHasArchitect').checked = currentLead.has_architect || false;
  document.getElementById('formHasPlans').checked = currentLead.has_plans || false;
  document.getElementById('formFinancingStatus').value = currentLead.financing_status || '';
  document.getElementById('formNotes').value = currentLead.notes || '';

  closeDetailModal();

  const modal = document.getElementById('leadModal');
  modal.style.display = 'flex';
  modal.classList.add('show');
}

async function deleteLead() {
  if (!currentLead) return;

  if (!confirm(`Are you sure you want to delete ${currentLead.first_name} ${currentLead.last_name}?`)) {
    return;
  }

  try {
    const response = await fetch(`/api/leads/${currentLead.id}`, { method: 'DELETE' });
    if (!response.ok) throw new Error('Failed to delete lead');

    showToast('Lead deleted', 'success');
    closeDetailModal();
    await loadLeads();
    await loadStats();
  } catch (err) {
    console.error('Delete failed:', err);
    showToast('Failed to delete lead', 'error');
  }
}

// ============================================================
// ACTIVITIES
// ============================================================

function renderActivities() {
  const container = document.getElementById('activityList');
  if (!container || !currentLead) return;

  const activities = currentLead.activities || [];

  if (activities.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>No activities logged yet</p></div>';
    return;
  }

  container.innerHTML = activities.map(act => `
    <div class="activity-item">
      <div class="activity-icon">${getActivityIcon(act.activity_type)}</div>
      <div class="activity-content">
        <div class="activity-header">
          <strong>${formatActivityType(act.activity_type)}</strong>
          ${act.direction ? `<span class="badge badge-secondary">${act.direction}</span>` : ''}
          ${act.outcome ? `<span class="badge badge-info">${act.outcome}</span>` : ''}
        </div>
        ${act.subject ? `<div class="activity-subject">${act.subject}</div>` : ''}
        ${act.description ? `<div class="activity-description">${act.description}</div>` : ''}
        <div class="activity-meta">
          ${formatDateTime(act.performed_at)}
          ${act.performed_by ? ` by ${act.performed_by}` : ''}
        </div>
      </div>
    </div>
  `).join('');
}

function getActivityIcon(type) {
  const icons = {
    'call': '📞',
    'email': '📧',
    'meeting': '👥',
    'site_visit': '🏠',
    'text': '💬',
    'note': '📝'
  };
  return icons[type] || '📋';
}

function formatActivityType(type) {
  return type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function openActivityModal() {
  document.getElementById('activityType').value = '';
  document.getElementById('activityDirection').value = '';
  document.getElementById('activitySubject').value = '';
  document.getElementById('activityDescription').value = '';
  document.getElementById('activityOutcome').value = '';

  const modal = document.getElementById('activityModal');
  modal.style.display = 'flex';
  modal.classList.add('show');
}

function closeActivityModal() {
  const modal = document.getElementById('activityModal');
  modal.classList.remove('show');
  modal.style.display = 'none';
}

async function saveActivity() {
  if (!currentLead) return;

  const data = {
    activity_type: document.getElementById('activityType').value,
    direction: document.getElementById('activityDirection').value || null,
    subject: document.getElementById('activitySubject').value.trim() || null,
    description: document.getElementById('activityDescription').value.trim() || null,
    outcome: document.getElementById('activityOutcome').value || null,
    performed_by: 'User'
  };

  if (!data.activity_type) {
    showToast('Activity type is required', 'error');
    return;
  }

  try {
    const response = await fetch(`/api/leads/${currentLead.id}/activities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!response.ok) throw new Error('Failed to log activity');

    showToast('Activity logged', 'success');
    closeActivityModal();
    await openDetailModal(currentLead.id);
  } catch (err) {
    console.error('Save activity failed:', err);
    showToast('Failed to log activity', 'error');
  }
}

// ============================================================
// TASKS
// ============================================================

function renderTasks() {
  const container = document.getElementById('taskList');
  if (!container || !currentLead) return;

  const tasks = currentLead.tasks || [];

  if (tasks.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>No tasks created yet</p></div>';
    return;
  }

  const pendingTasks = tasks.filter(t => t.status === 'pending');
  const completedTasks = tasks.filter(t => t.status === 'completed');

  container.innerHTML = `
    ${pendingTasks.length > 0 ? `
      <h5>Pending</h5>
      ${pendingTasks.map(task => renderTaskItem(task)).join('')}
    ` : ''}
    ${completedTasks.length > 0 ? `
      <h5 style="margin-top: 1rem;">Completed</h5>
      ${completedTasks.map(task => renderTaskItem(task)).join('')}
    ` : ''}
  `;
}

function renderTaskItem(task) {
  const isOverdue = task.status === 'pending' && new Date(task.due_date) < new Date();

  return `
    <div class="task-item ${task.status === 'completed' ? 'task-completed' : ''} ${isOverdue ? 'task-overdue' : ''}">
      <div class="task-checkbox">
        ${task.status === 'pending' ? `
          <input type="checkbox" onchange="completeTask('${task.id}')" title="Mark complete">
        ` : `
          <span class="task-done">✓</span>
        `}
      </div>
      <div class="task-content">
        <div class="task-title">${task.title}</div>
        <div class="task-meta">
          <span class="badge ${getPriorityClass(task.priority)}">${task.priority}</span>
          <span>${formatDate(task.due_date)}</span>
          ${isOverdue ? '<span class="text-danger">Overdue</span>' : ''}
        </div>
      </div>
      <div class="task-actions">
        <button class="btn btn-sm btn-ghost" onclick="deleteTask('${task.id}')" title="Delete">🗑️</button>
      </div>
    </div>
  `;
}

function getPriorityClass(priority) {
  const classes = {
    'urgent': 'badge-danger',
    'high': 'badge-warning',
    'normal': 'badge-info',
    'low': 'badge-secondary'
  };
  return classes[priority] || 'badge-secondary';
}

function openTaskModal() {
  document.getElementById('taskModalTitle').textContent = 'Add Task';
  document.getElementById('taskId').value = '';
  document.getElementById('taskType').value = '';
  document.getElementById('taskTitle').value = '';
  document.getElementById('taskDueDate').value = '';
  document.getElementById('taskPriority').value = 'normal';
  document.getElementById('taskDescription').value = '';

  const modal = document.getElementById('taskModal');
  modal.style.display = 'flex';
  modal.classList.add('show');
}

function closeTaskModal() {
  const modal = document.getElementById('taskModal');
  modal.classList.remove('show');
  modal.style.display = 'none';
}

async function saveTask() {
  if (!currentLead) return;

  const data = {
    task_type: document.getElementById('taskType').value,
    title: document.getElementById('taskTitle').value.trim(),
    due_date: document.getElementById('taskDueDate').value,
    priority: document.getElementById('taskPriority').value || 'normal',
    description: document.getElementById('taskDescription').value.trim() || null
  };

  if (!data.task_type || !data.title || !data.due_date) {
    showToast('Task type, title, and due date are required', 'error');
    return;
  }

  try {
    const response = await fetch(`/api/leads/${currentLead.id}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!response.ok) throw new Error('Failed to create task');

    showToast('Task created', 'success');
    closeTaskModal();
    await openDetailModal(currentLead.id);
  } catch (err) {
    console.error('Save task failed:', err);
    showToast('Failed to create task', 'error');
  }
}

async function completeTask(taskId) {
  if (!currentLead) return;

  try {
    const response = await fetch(`/api/leads/${currentLead.id}/tasks/${taskId}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed_by: 'User' })
    });

    if (!response.ok) throw new Error('Failed to complete task');

    showToast('Task completed', 'success');
    await openDetailModal(currentLead.id);
  } catch (err) {
    console.error('Complete task failed:', err);
    showToast('Failed to complete task', 'error');
  }
}

async function deleteTask(taskId) {
  if (!currentLead || !confirm('Delete this task?')) return;

  try {
    const response = await fetch(`/api/leads/${currentLead.id}/tasks/${taskId}`, { method: 'DELETE' });
    if (!response.ok) throw new Error('Failed to delete task');

    showToast('Task deleted', 'success');
    await openDetailModal(currentLead.id);
  } catch (err) {
    console.error('Delete task failed:', err);
    showToast('Failed to delete task', 'error');
  }
}

// ============================================================
// DOCUMENTS
// ============================================================

function renderDocuments() {
  const container = document.getElementById('documentList');
  if (!container || !currentLead) return;

  const docs = currentLead.documents || [];

  if (docs.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>No documents uploaded yet</p></div>';
    return;
  }

  container.innerHTML = docs.map(doc => `
    <div class="document-item">
      <div class="document-icon">${getDocIcon(doc.file_type)}</div>
      <div class="document-content">
        <a href="${doc.file_url}" target="_blank" class="document-name">${doc.name}</a>
        <div class="document-meta">
          ${doc.category ? `<span class="badge badge-secondary">${doc.category}</span>` : ''}
          ${formatDate(doc.created_at)}
        </div>
      </div>
      <div class="document-actions">
        <button class="btn btn-sm btn-ghost" onclick="deleteDocument('${doc.id}')" title="Delete">🗑️</button>
      </div>
    </div>
  `).join('');
}

function getDocIcon(mimeType) {
  if (mimeType?.includes('pdf')) return '📄';
  if (mimeType?.includes('image')) return '🖼️';
  return '📎';
}

function triggerDocumentUpload() {
  document.getElementById('documentUploadInput').click();
}

async function uploadDocument() {
  if (!currentLead) return;

  const input = document.getElementById('documentUploadInput');
  const file = input.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('file', file);
  formData.append('uploaded_by', 'User');

  try {
    const response = await fetch(`/api/leads/${currentLead.id}/documents`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) throw new Error('Failed to upload document');

    showToast('Document uploaded', 'success');
    input.value = '';
    await openDetailModal(currentLead.id);
  } catch (err) {
    console.error('Upload failed:', err);
    showToast('Failed to upload document', 'error');
  }
}

async function deleteDocument(docId) {
  if (!currentLead || !confirm('Delete this document?')) return;

  try {
    const response = await fetch(`/api/leads/${currentLead.id}/documents/${docId}`, { method: 'DELETE' });
    if (!response.ok) throw new Error('Failed to delete document');

    showToast('Document deleted', 'success');
    await openDetailModal(currentLead.id);
  } catch (err) {
    console.error('Delete document failed:', err);
    showToast('Failed to delete document', 'error');
  }
}

// ============================================================
// HISTORY
// ============================================================

function renderHistory() {
  const container = document.getElementById('historyList');
  if (!container || !currentLead) return;

  const history = currentLead.stage_history || [];

  if (history.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>No stage changes recorded yet</p></div>';
    return;
  }

  container.innerHTML = history.map(h => `
    <div class="history-item">
      <div class="history-content">
        <span class="badge ${getStageClass(h.from_stage || 'new')}">${h.from_stage ? formatStage(h.from_stage) : 'New'}</span>
        <span class="history-arrow">→</span>
        <span class="badge ${getStageClass(h.to_stage)}">${formatStage(h.to_stage)}</span>
      </div>
      <div class="history-meta">
        ${formatDateTime(h.changed_at)}
        ${h.changed_by ? ` by ${h.changed_by}` : ''}
      </div>
    </div>
  `).join('');
}

// ============================================================
// CONVERSION
// ============================================================

async function convertToJob() {
  if (!currentLead) return;

  if (!confirm(`Convert "${currentLead.first_name} ${currentLead.last_name}" to a Job?\n\nThis will create a new job and mark the lead as Won.`)) {
    return;
  }

  try {
    const response = await fetch(`/api/leads/${currentLead.id}/convert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ converted_by: 'User' })
    });

    if (!response.ok) throw new Error('Failed to convert lead');

    const result = await response.json();
    showToast(`Lead converted! Job "${result.job.name}" created.`, 'success');

    closeDetailModal();
    await loadLeads();
    await loadStats();

    // Offer to view the new job
    if (confirm('View the new job?')) {
      window.location.href = `jobs.html?id=${result.job.id}`;
    }
  } catch (err) {
    console.error('Conversion failed:', err);
    showToast('Failed to convert lead', 'error');
  }
}

function openLostModal() {
  document.getElementById('lostReason').value = '';
  document.getElementById('lostCompetitor').value = '';

  const modal = document.getElementById('lostModal');
  modal.style.display = 'flex';
  modal.classList.add('show');
}

function closeLostModal() {
  const modal = document.getElementById('lostModal');
  modal.classList.remove('show');
  modal.style.display = 'none';
}

async function markAsLost() {
  if (!currentLead) return;

  const reason = document.getElementById('lostReason').value;
  if (!reason) {
    showToast('Please select a reason', 'error');
    return;
  }

  const competitor = document.getElementById('lostCompetitor').value.trim() || null;

  try {
    const response = await fetch(`/api/leads/${currentLead.id}/lost`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lost_reason: reason, lost_competitor: competitor })
    });

    if (!response.ok) throw new Error('Failed to mark as lost');

    showToast('Lead marked as lost', 'success');
    closeLostModal();
    closeDetailModal();
    await loadLeads();
    await loadStats();
  } catch (err) {
    console.error('Mark lost failed:', err);
    showToast('Failed to mark as lost', 'error');
  }
}

/**
 * Business Planning JavaScript
 * Annual/quarterly planning, targets, and performance tracking
 */

let revenueChart = null;
let dashboardData = null;

// ============================================================
// INITIALIZATION
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  loadDashboard();
  initYearSelect();
});

function initYearSelect() {
  const select = document.getElementById('planYear');
  const currentYear = new Date().getFullYear();

  for (let y = currentYear; y <= currentYear + 2; y++) {
    const option = document.createElement('option');
    option.value = y;
    option.textContent = y;
    select.appendChild(option);
  }

  updatePlanDates();
}

async function loadDashboard() {
  try {
    const response = await fetch('/api/business-planning/dashboard');
    if (!response.ok) throw new Error('Failed to load dashboard');

    dashboardData = await response.json();

    if (dashboardData.active_plan) {
      document.getElementById('activePlanSection').style.display = 'block';
      document.getElementById('noActivePlan').style.display = 'none';
      renderActivePlan(dashboardData);
    } else {
      document.getElementById('activePlanSection').style.display = 'none';
      document.getElementById('noActivePlan').style.display = 'block';
    }

    renderMilestones(dashboardData.upcoming_milestones);
    renderKPIs(dashboardData.kpis);
  } catch (err) {
    console.error('Error loading dashboard:', err);
    showToast('Failed to load dashboard', 'error');
  }
}

// ============================================================
// RENDERING
// ============================================================

function renderActivePlan(data) {
  const plan = data.active_plan;
  const perf = data.performance || {};

  document.getElementById('activePlanTitle').textContent = plan.plan_name;

  // Revenue
  document.getElementById('revenueTarget').textContent = formatCurrency(plan.revenue_target);
  document.getElementById('revenueActual').textContent = `${formatCurrency(perf.revenue_actual)} actual`;
  const revPercent = plan.revenue_target > 0 ? (perf.revenue_actual / plan.revenue_target) * 100 : 0;
  document.getElementById('revenueProgress').style.width = `${Math.min(revPercent, 100)}%`;

  // Margin
  document.getElementById('marginTarget').textContent = `${(plan.gross_margin_target * 100).toFixed(1)}%`;
  document.getElementById('marginActual').textContent = `${((perf.gross_margin_actual || 0) * 100).toFixed(1)}% actual`;

  // Jobs
  document.getElementById('jobsTarget').textContent = plan.jobs_target || 0;
  document.getElementById('jobsActual').textContent = `${perf.jobs_actual || 0} completed`;

  // Milestones
  const achieved = perf.achieved_milestones || 0;
  const total = achieved + (perf.on_track_milestones || 0) + (perf.at_risk_milestones || 0);
  document.getElementById('milestonesAchieved').textContent = `${achieved}/${total}`;
  document.getElementById('onTrack').textContent = perf.on_track_milestones || 0;
  document.getElementById('atRisk').textContent = perf.at_risk_milestones || 0;

  // Render chart
  renderRevenueChart(plan, perf);
}

function renderRevenueChart(plan, perf) {
  const ctx = document.getElementById('revenueChart')?.getContext('2d');
  if (!ctx) return;

  if (revenueChart) revenueChart.destroy();

  const target = parseFloat(plan.revenue_target) || 0;
  const actual = parseFloat(perf.revenue_actual) || 0;
  const remaining = Math.max(target - actual, 0);

  revenueChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Actual Revenue', 'Remaining to Target'],
      datasets: [{
        data: [actual, remaining],
        backgroundColor: ['#3fb950', '#30363d']
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '70%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#e6edf3' }
        },
        tooltip: {
          callbacks: {
            label: ctx => formatCurrency(ctx.raw)
          }
        }
      }
    },
    plugins: [{
      id: 'centerText',
      beforeDraw: (chart) => {
        const { width, height, ctx } = chart;
        ctx.restore();

        const percent = target > 0 ? ((actual / target) * 100).toFixed(0) : 0;
        ctx.font = 'bold 28px sans-serif';
        ctx.fillStyle = '#e6edf3';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${percent}%`, width / 2, height / 2);

        ctx.save();
      }
    }]
  });
}

function renderMilestones(milestones) {
  const container = document.getElementById('milestonesList');

  if (!milestones || milestones.length === 0) {
    container.innerHTML = '<div class="empty-state">No upcoming milestones</div>';
    return;
  }

  container.innerHTML = milestones.map(m => `
    <div class="milestone-item ${m.status}">
      <div class="milestone-status-indicator ${m.status}"></div>
      <div class="milestone-info">
        <div class="milestone-name">${m.milestone_name}</div>
        <div class="milestone-date">${formatDate(m.target_date)}</div>
      </div>
      <div class="milestone-target">
        ${m.target_value ? formatValue(m.target_value, m.target_metric) : ''}
      </div>
      <div class="milestone-actions">
        <select onchange="updateMilestoneStatus('${m.id}', this.value)">
          <option value="pending" ${m.status === 'pending' ? 'selected' : ''}>Pending</option>
          <option value="on_track" ${m.status === 'on_track' ? 'selected' : ''}>On Track</option>
          <option value="at_risk" ${m.status === 'at_risk' ? 'selected' : ''}>At Risk</option>
          <option value="achieved" ${m.status === 'achieved' ? 'selected' : ''}>Achieved</option>
          <option value="missed" ${m.status === 'missed' ? 'selected' : ''}>Missed</option>
        </select>
      </div>
    </div>
  `).join('');
}

function renderKPIs(kpis) {
  const container = document.getElementById('kpiGrid');

  if (!kpis || kpis.length === 0) {
    container.innerHTML = '<div class="empty-state">No KPIs defined</div>';
    return;
  }

  container.innerHTML = kpis.map(kpi => `
    <div class="kpi-card">
      <div class="kpi-name">${kpi.kpi_name}</div>
      <div class="kpi-value">-</div>
      <div class="kpi-target">${kpi.default_target ? `Target: ${formatKPIValue(kpi.default_target, kpi.format)}` : ''}</div>
    </div>
  `).join('');
}

// ============================================================
// CREATE PLAN
// ============================================================

function openCreatePlanModal() {
  document.getElementById('planForm').reset();
  updatePlanDates();
  openModal('createPlanModal');
}

function closeCreatePlanModal() {
  closeModal('createPlanModal');
}

function updatePlanDates() {
  const type = document.getElementById('planType').value;
  const year = parseInt(document.getElementById('planYear').value);
  const quarterGroup = document.getElementById('quarterGroup');

  if (type === 'quarterly') {
    quarterGroup.style.display = 'block';
    const quarter = parseInt(document.getElementById('planQuarter').value);
    const startMonth = (quarter - 1) * 3;
    const endMonth = startMonth + 2;

    const start = new Date(year, startMonth, 1);
    const end = new Date(year, endMonth + 1, 0);

    document.getElementById('startDate').value = formatDateInput(start);
    document.getElementById('endDate').value = formatDateInput(end);
  } else {
    quarterGroup.style.display = 'none';
    document.getElementById('startDate').value = `${year}-01-01`;
    document.getElementById('endDate').value = `${year}-12-31`;
  }
}

async function savePlan() {
  const data = {
    plan_name: document.getElementById('planName').value,
    plan_type: document.getElementById('planType').value,
    year: parseInt(document.getElementById('planYear').value),
    quarter: document.getElementById('planType').value === 'quarterly'
      ? parseInt(document.getElementById('planQuarter').value)
      : null,
    start_date: document.getElementById('startDate').value,
    end_date: document.getElementById('endDate').value,
    revenue_target: parseFloat(document.getElementById('revenueTargetInput').value) || 0,
    gross_margin_target: (parseFloat(document.getElementById('grossMarginTarget').value) || 0) / 100,
    net_margin_target: (parseFloat(document.getElementById('netMarginTarget').value) || 0) / 100,
    jobs_target: parseInt(document.getElementById('jobsTargetInput').value) || 0,
    avg_job_size_target: parseFloat(document.getElementById('avgJobSize').value) || 0,
    notes: document.getElementById('planNotes').value
  };

  if (!data.plan_name || !data.start_date || !data.end_date) {
    showToast('Please fill in required fields', 'error');
    return;
  }

  try {
    const response = await fetch('/api/business-planning/plans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!response.ok) throw new Error('Failed to create plan');

    showToast('Plan created successfully', 'success');
    closeCreatePlanModal();
    loadDashboard();
  } catch (err) {
    console.error('Error creating plan:', err);
    showToast('Failed to create plan', 'error');
  }
}

// ============================================================
// PLANS LIST
// ============================================================

async function openPlansList() {
  openModal('plansListModal');
  await loadPlansList();
}

function closePlansList() {
  closeModal('plansListModal');
}

async function loadPlansList() {
  const container = document.getElementById('plansTable');

  try {
    const response = await fetch('/api/business-planning/plans');
    const plans = await response.json();

    if (!plans || plans.length === 0) {
      container.innerHTML = '<div class="empty-state">No business plans created yet</div>';
      return;
    }

    container.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Plan Name</th>
            <th>Type</th>
            <th>Year</th>
            <th class="text-right">Revenue Target</th>
            <th class="text-right">YTD Revenue</th>
            <th>Milestones</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${plans.map(p => `
            <tr>
              <td>${p.plan_name}</td>
              <td>${p.plan_type}${p.quarter ? ` Q${p.quarter}` : ''}</td>
              <td>${p.year}</td>
              <td class="text-right">${formatCurrency(p.revenue_target)}</td>
              <td class="text-right">${formatCurrency(p.ytd_revenue)}</td>
              <td>${p.achieved_milestones}/${p.total_milestones}</td>
              <td><span class="badge badge-${p.status === 'active' ? 'success' : p.status === 'draft' ? 'warning' : 'secondary'}">${p.status}</span></td>
              <td>
                ${p.status === 'draft' ? `<button class="btn btn-sm btn-primary" onclick="activatePlan('${p.id}')">Activate</button>` : ''}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } catch (err) {
    console.error('Error loading plans:', err);
    container.innerHTML = '<div class="empty-state">Failed to load plans</div>';
  }
}

async function activatePlan(planId) {
  try {
    const response = await fetch(`/api/business-planning/plans/${planId}/activate`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) throw new Error('Failed to activate plan');

    showToast('Plan activated', 'success');
    loadPlansList();
    loadDashboard();
  } catch (err) {
    console.error('Error activating plan:', err);
    showToast('Failed to activate plan', 'error');
  }
}

// ============================================================
// MILESTONES
// ============================================================

async function updateMilestoneStatus(milestoneId, status) {
  try {
    const response = await fetch(`/api/business-planning/milestones/${milestoneId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });

    if (!response.ok) throw new Error('Failed to update milestone');

    showToast('Milestone updated', 'success');
    loadDashboard();
  } catch (err) {
    console.error('Error updating milestone:', err);
    showToast('Failed to update milestone', 'error');
  }
}

// ============================================================
// UTILITIES
// ============================================================

function formatCurrency(value) {
  const num = parseFloat(value) || 0;
  return num.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateInput(date) {
  return date.toISOString().split('T')[0];
}

function formatValue(value, metric) {
  if (metric === 'revenue' || metric === 'currency') return formatCurrency(value);
  if (metric === 'percent' || metric === 'margin') return `${(value * 100).toFixed(1)}%`;
  return value;
}

function formatKPIValue(value, format) {
  if (format === 'currency') return formatCurrency(value);
  if (format === 'percent') return `${value}%`;
  return value;
}

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.style.display = 'flex';
    modal.classList.add('show');
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('show');
    modal.style.display = 'none';
  }
}

function showToast(message, type = 'info') {
  if (window.showToast) {
    window.showToast(message, type);
  } else {
    console.log(`[${type}] ${message}`);
  }
}

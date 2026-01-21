/**
 * WIP Schedule JavaScript
 * Work-in-Progress tracking and revenue recognition
 */

let allJobs = [];
let billingChart = null;
let completionChart = null;
let currentJobId = null;

// ============================================================
// INITIALIZATION
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  loadDashboard();
  loadPeriods();
  setupEstimateForm();
});

async function loadDashboard() {
  try {
    const response = await fetch('/api/wip/dashboard');
    if (!response.ok) throw new Error('Failed to load WIP data');

    const data = await response.json();
    allJobs = data.jobs;

    renderSummary(data.summary);
    renderTable(data.jobs);
    renderCharts(data);

    // Show at-risk alert if needed
    if (data.summary.at_risk_jobs?.length > 0) {
      document.getElementById('atRiskAlert').style.display = 'block';
      document.getElementById('atRiskCount').textContent = data.summary.at_risk_jobs.length;
    } else {
      document.getElementById('atRiskAlert').style.display = 'none';
    }
  } catch (err) {
    console.error('Error loading dashboard:', err);
    showToast('Failed to load WIP data', 'error');
  }
}

// ============================================================
// RENDERING
// ============================================================

function renderSummary(summary) {
  document.getElementById('jobCount').textContent = summary.job_count || 0;
  document.getElementById('totalContract').textContent = formatCurrency(summary.total_revised_contract);
  document.getElementById('earnedRevenue').textContent = formatCurrency(summary.total_earned_revenue);
  document.getElementById('totalOverbilling').textContent = formatCurrency(summary.total_overbilling);
  document.getElementById('overbilledCount').textContent = `${summary.overbilled_jobs?.length || 0} jobs`;
  document.getElementById('totalUnderbilling').textContent = formatCurrency(summary.total_underbilling);
  document.getElementById('underbilledCount').textContent = `${summary.underbilled_jobs?.length || 0} jobs`;
  document.getElementById('projectedProfit').textContent = formatCurrency(summary.total_projected_profit);
  document.getElementById('avgMargin').textContent = `${(summary.avg_projected_margin * 100).toFixed(1)}% avg margin`;
}

function renderTable(jobs) {
  const tbody = document.getElementById('wipTable');
  const tfoot = document.getElementById('wipTotals');

  if (!jobs || jobs.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10" class="empty-cell">No active jobs found</td></tr>';
    tfoot.innerHTML = '';
    return;
  }

  // Calculate totals
  const totals = {
    revised_contract: 0,
    estimated_cost: 0,
    cost_to_date: 0,
    earned_revenue: 0,
    billed_to_date: 0,
    overbilling: 0,
    underbilling: 0,
    projected_final_profit: 0
  };

  tbody.innerHTML = jobs.map(job => {
    const pctComplete = parseFloat(job.percent_complete || 0);
    const over = parseFloat(job.overbilling || 0);
    const under = parseFloat(job.underbilling || 0);
    const billingPosition = over > 0 ? over : -under;
    const projMargin = parseFloat(job.projected_margin || 0);

    // Accumulate totals
    totals.revised_contract += parseFloat(job.revised_contract || 0);
    totals.estimated_cost += parseFloat(job.revised_estimated_cost || job.estimated_cost || 0);
    totals.cost_to_date += parseFloat(job.cost_to_date || 0);
    totals.earned_revenue += parseFloat(job.earned_revenue || 0);
    totals.billed_to_date += parseFloat(job.billed_to_date || 0);
    totals.overbilling += over;
    totals.underbilling += under;
    totals.projected_final_profit += parseFloat(job.projected_final_profit || 0);

    return `
      <tr>
        <td>
          <div class="job-name">${job.job_name || 'Unknown'}</div>
          ${job.client_name ? `<div class="job-client">${job.client_name}</div>` : ''}
        </td>
        <td class="text-right">${formatCurrency(job.revised_contract)}</td>
        <td class="text-right">${formatCurrency(job.revised_estimated_cost || job.estimated_cost)}</td>
        <td class="text-right">${formatCurrency(job.cost_to_date)}</td>
        <td class="text-center">
          <div class="progress-cell">
            <div class="progress-bar-mini">
              <div class="progress-fill" style="width: ${Math.min(pctComplete, 100)}%"></div>
            </div>
            <span class="progress-label">${pctComplete.toFixed(0)}%</span>
          </div>
        </td>
        <td class="text-right">${formatCurrency(job.earned_revenue)}</td>
        <td class="text-right">${formatCurrency(job.billed_to_date)}</td>
        <td class="text-right ${over > 0 ? 'overbilled' : under > 0 ? 'underbilled' : ''}">
          ${over > 0 ? formatCurrency(over) : under > 0 ? `(${formatCurrency(under)})` : '-'}
        </td>
        <td class="text-right">
          <span class="${projMargin < 0.05 ? 'text-danger' : projMargin > 0.15 ? 'text-success' : ''}">${formatCurrency(job.projected_final_profit)}</span>
          <div class="margin-sub">${(projMargin * 100).toFixed(1)}%</div>
        </td>
        <td>
          <button class="btn btn-sm btn-secondary" onclick="viewJobDetail('${job.job_id}')">Details</button>
        </td>
      </tr>
    `;
  }).join('');

  // Render totals row
  const netBilling = totals.overbilling - totals.underbilling;
  tfoot.innerHTML = `
    <tr class="totals-row">
      <td><strong>TOTALS</strong></td>
      <td class="text-right"><strong>${formatCurrency(totals.revised_contract)}</strong></td>
      <td class="text-right"><strong>${formatCurrency(totals.estimated_cost)}</strong></td>
      <td class="text-right"><strong>${formatCurrency(totals.cost_to_date)}</strong></td>
      <td class="text-center">-</td>
      <td class="text-right"><strong>${formatCurrency(totals.earned_revenue)}</strong></td>
      <td class="text-right"><strong>${formatCurrency(totals.billed_to_date)}</strong></td>
      <td class="text-right ${netBilling > 0 ? 'overbilled' : netBilling < 0 ? 'underbilled' : ''}">
        <strong>${netBilling >= 0 ? formatCurrency(netBilling) : `(${formatCurrency(Math.abs(netBilling))})`}</strong>
      </td>
      <td class="text-right"><strong>${formatCurrency(totals.projected_final_profit)}</strong></td>
      <td></td>
    </tr>
  `;
}

function renderCharts(data) {
  renderBillingChart(data.summary);
  renderCompletionChart(data.jobs);
}

function renderBillingChart(summary) {
  const ctx = document.getElementById('billingChart')?.getContext('2d');
  if (!ctx) return;

  if (billingChart) billingChart.destroy();

  billingChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Overbilled (Liability)', 'Underbilled (Asset)', 'Balanced'],
      datasets: [{
        data: [
          summary.overbilled_jobs?.length || 0,
          summary.underbilled_jobs?.length || 0,
          (summary.job_count || 0) - (summary.overbilled_jobs?.length || 0) - (summary.underbilled_jobs?.length || 0)
        ],
        backgroundColor: ['#f85149', '#58a6ff', '#30363d']
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#e6edf3' }
        }
      }
    }
  });
}

function renderCompletionChart(jobs) {
  const ctx = document.getElementById('completionChart')?.getContext('2d');
  if (!ctx) return;

  if (completionChart) completionChart.destroy();

  // Take top 10 jobs by contract value
  const topJobs = [...jobs]
    .sort((a, b) => parseFloat(b.revised_contract || 0) - parseFloat(a.revised_contract || 0))
    .slice(0, 10);

  completionChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: topJobs.map(j => truncate(j.job_name, 20)),
      datasets: [{
        label: '% Complete',
        data: topJobs.map(j => parseFloat(j.percent_complete || 0)),
        backgroundColor: '#58a6ff'
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          max: 100,
          grid: { color: '#30363d' },
          ticks: { color: '#8b949e' }
        },
        y: {
          grid: { display: false },
          ticks: { color: '#e6edf3' }
        }
      },
      plugins: {
        legend: { display: false }
      }
    }
  });
}

// ============================================================
// SORTING
// ============================================================

function sortTable() {
  const sortBy = document.getElementById('sortBy').value;

  const sorted = [...allJobs].sort((a, b) => {
    switch (sortBy) {
      case 'percent':
        return parseFloat(b.percent_complete || 0) - parseFloat(a.percent_complete || 0);
      case 'contract':
        return parseFloat(b.revised_contract || 0) - parseFloat(a.revised_contract || 0);
      case 'billing':
        const aBilling = parseFloat(a.overbilling || 0) - parseFloat(a.underbilling || 0);
        const bBilling = parseFloat(b.overbilling || 0) - parseFloat(b.underbilling || 0);
        return bBilling - aBilling;
      default:
        return (a.job_name || '').localeCompare(b.job_name || '');
    }
  });

  renderTable(sorted);
}

// ============================================================
// JOB DETAIL MODAL
// ============================================================

async function viewJobDetail(jobId) {
  currentJobId = jobId;

  try {
    const response = await fetch(`/api/wip/job/${jobId}`);
    if (!response.ok) throw new Error('Failed to load job WIP');

    const data = await response.json();

    document.getElementById('jobDetailTitle').textContent = `${data.job?.name || 'Job'} - WIP Detail`;
    renderJobWip(data);

    // Load estimates
    loadJobEstimates(jobId);

    // Load history
    loadJobHistory(jobId);

    openModal('jobDetailModal');
  } catch (err) {
    console.error('Error loading job detail:', err);
    showToast('Failed to load job detail', 'error');
  }
}

function renderJobWip(data) {
  const wip = data.wip || {};
  const job = data.job || {};

  const content = `
    <div class="wip-detail-grid">
      <div class="detail-section">
        <h4>Contract</h4>
        <div class="detail-row">
          <span class="label">Original Contract</span>
          <span class="value">${formatCurrency(wip.original_contract)}</span>
        </div>
        <div class="detail-row">
          <span class="label">Approved Changes</span>
          <span class="value">${formatCurrency(wip.approved_changes)}</span>
        </div>
        <div class="detail-row total">
          <span class="label">Revised Contract</span>
          <span class="value">${formatCurrency(wip.revised_contract)}</span>
        </div>
      </div>

      <div class="detail-section">
        <h4>Costs</h4>
        <div class="detail-row">
          <span class="label">Estimated Cost</span>
          <span class="value">${formatCurrency(wip.estimated_cost)}</span>
        </div>
        <div class="detail-row">
          <span class="label">Cost to Date</span>
          <span class="value">${formatCurrency(wip.cost_to_date)}</span>
        </div>
        <div class="detail-row">
          <span class="label">Est. Cost to Complete</span>
          <span class="value">${formatCurrency(wip.estimated_cost_to_complete)}</span>
        </div>
        <div class="detail-row total">
          <span class="label">Revised Est. Cost</span>
          <span class="value">${formatCurrency(wip.revised_estimated_cost)}</span>
        </div>
      </div>

      <div class="detail-section">
        <h4>Progress</h4>
        <div class="detail-row">
          <span class="label">% Complete</span>
          <span class="value">${parseFloat(wip.percent_complete || 0).toFixed(1)}%</span>
        </div>
        <div class="progress-bar-large">
          <div class="progress-fill" style="width: ${Math.min(parseFloat(wip.percent_complete || 0), 100)}%"></div>
        </div>
      </div>

      <div class="detail-section">
        <h4>Billings</h4>
        <div class="detail-row">
          <span class="label">Earned Revenue</span>
          <span class="value">${formatCurrency(wip.earned_revenue)}</span>
        </div>
        <div class="detail-row">
          <span class="label">Billed to Date</span>
          <span class="value">${formatCurrency(wip.billed_to_date)}</span>
        </div>
        ${parseFloat(wip.overbilling || 0) > 0 ? `
          <div class="detail-row overbilling">
            <span class="label">Overbilling (Liability)</span>
            <span class="value text-danger">${formatCurrency(wip.overbilling)}</span>
          </div>
        ` : parseFloat(wip.underbilling || 0) > 0 ? `
          <div class="detail-row underbilling">
            <span class="label">Underbilling (Asset)</span>
            <span class="value text-info">${formatCurrency(wip.underbilling)}</span>
          </div>
        ` : `
          <div class="detail-row">
            <span class="label">Billing Position</span>
            <span class="value">Balanced</span>
          </div>
        `}
      </div>

      <div class="detail-section">
        <h4>Projected Final</h4>
        <div class="detail-row">
          <span class="label">Projected Final Cost</span>
          <span class="value">${formatCurrency(wip.projected_final_cost)}</span>
        </div>
        <div class="detail-row">
          <span class="label">Projected Final Profit</span>
          <span class="value ${parseFloat(wip.projected_final_profit || 0) < 0 ? 'text-danger' : 'text-success'}">${formatCurrency(wip.projected_final_profit)}</span>
        </div>
        <div class="detail-row">
          <span class="label">Projected Margin</span>
          <span class="value">${(parseFloat(wip.projected_margin || 0) * 100).toFixed(1)}%</span>
        </div>
      </div>

      <div class="detail-section">
        <h4>Gross Profit</h4>
        <div class="detail-row">
          <span class="label">Estimated Gross Profit</span>
          <span class="value">${formatCurrency(wip.estimated_gross_profit)}</span>
        </div>
        <div class="detail-row">
          <span class="label">Gross Profit to Date</span>
          <span class="value">${formatCurrency(wip.gross_profit_to_date)}</span>
        </div>
      </div>
    </div>
  `;

  document.getElementById('jobWipContent').innerHTML = content;
}

async function loadJobEstimates(jobId) {
  try {
    const response = await fetch(`/api/wip/job/${jobId}/estimates`);
    const estimates = await response.json();

    if (!estimates || estimates.length === 0) {
      document.getElementById('jobEstimatesContent').innerHTML = `
        <div class="empty-state">
          <p>No estimates recorded for this job.</p>
          <button class="btn btn-primary" onclick="openEstimateForm()">Add First Estimate</button>
        </div>
      `;
      return;
    }

    const content = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Type</th>
            <th class="text-right">Labor</th>
            <th class="text-right">Material</th>
            <th class="text-right">Sub</th>
            <th class="text-right">Equipment</th>
            <th class="text-right">Overhead</th>
            <th class="text-right">Other</th>
            <th class="text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          ${estimates.map(e => `
            <tr>
              <td>${formatDate(e.effective_date)}</td>
              <td><span class="badge badge-${e.estimate_type === 'original' ? 'info' : 'secondary'}">${e.estimate_type}</span></td>
              <td class="text-right">${formatCurrency(e.labor_cost)}</td>
              <td class="text-right">${formatCurrency(e.material_cost)}</td>
              <td class="text-right">${formatCurrency(e.subcontractor_cost)}</td>
              <td class="text-right">${formatCurrency(e.equipment_cost)}</td>
              <td class="text-right">${formatCurrency(e.overhead_cost)}</td>
              <td class="text-right">${formatCurrency(e.other_cost)}</td>
              <td class="text-right"><strong>${formatCurrency(e.total_estimated_cost)}</strong></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    document.getElementById('jobEstimatesContent').innerHTML = content;
  } catch (err) {
    console.error('Error loading estimates:', err);
  }
}

async function loadJobHistory(jobId) {
  try {
    const response = await fetch(`/api/wip/job/${jobId}/history`);
    const history = await response.json();

    if (!history || history.length === 0) {
      document.getElementById('jobHistoryContent').innerHTML = `
        <div class="empty-state">
          <p>No WIP snapshots recorded for this job.</p>
        </div>
      `;
      return;
    }

    const content = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Period</th>
            <th class="text-right">Contract</th>
            <th class="text-right">Cost to Date</th>
            <th class="text-center">% Complete</th>
            <th class="text-right">Earned</th>
            <th class="text-right">Billed</th>
            <th class="text-right">Over/(Under)</th>
            <th class="text-right">Proj. Profit</th>
          </tr>
        </thead>
        <tbody>
          ${history.map(h => {
            const over = parseFloat(h.overbilling || 0);
            const under = parseFloat(h.underbilling || 0);
            return `
              <tr>
                <td>${h.period?.name || formatDate(h.snapshot_date)}</td>
                <td class="text-right">${formatCurrency(h.revised_contract)}</td>
                <td class="text-right">${formatCurrency(h.cost_to_date)}</td>
                <td class="text-center">${parseFloat(h.percent_complete || 0).toFixed(0)}%</td>
                <td class="text-right">${formatCurrency(h.earned_revenue)}</td>
                <td class="text-right">${formatCurrency(h.billed_to_date)}</td>
                <td class="text-right ${over > 0 ? 'overbilled' : under > 0 ? 'underbilled' : ''}">
                  ${over > 0 ? formatCurrency(over) : under > 0 ? `(${formatCurrency(under)})` : '-'}
                </td>
                <td class="text-right">${formatCurrency(h.projected_final_profit)}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;

    document.getElementById('jobHistoryContent').innerHTML = content;
  } catch (err) {
    console.error('Error loading history:', err);
  }
}

function closeJobDetailModal() {
  closeModal('jobDetailModal');
  currentJobId = null;
}

function switchDetailTab(tabName) {
  document.querySelectorAll('#jobDetailModal .tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('#jobDetailModal .tab-content').forEach(c => c.classList.remove('active'));
  document.querySelector(`#jobDetailModal .tab[data-tab="${tabName}"]`).classList.add('active');
  document.getElementById(`tab-${tabName}`).classList.add('active');
}

// ============================================================
// ESTIMATE FORM
// ============================================================

function setupEstimateForm() {
  // Auto-calculate total
  const fields = ['laborCost', 'materialCost', 'subCost', 'equipmentCost', 'overheadCost', 'otherCost'];
  fields.forEach(id => {
    document.getElementById(id)?.addEventListener('input', calculateEstimateTotal);
  });

  // Set default date
  document.getElementById('estimateDate').value = new Date().toISOString().split('T')[0];
}

function calculateEstimateTotal() {
  const labor = parseFloat(document.getElementById('laborCost').value) || 0;
  const material = parseFloat(document.getElementById('materialCost').value) || 0;
  const sub = parseFloat(document.getElementById('subCost').value) || 0;
  const equipment = parseFloat(document.getElementById('equipmentCost').value) || 0;
  const overhead = parseFloat(document.getElementById('overheadCost').value) || 0;
  const other = parseFloat(document.getElementById('otherCost').value) || 0;

  document.getElementById('totalEstimate').value = (labor + material + sub + equipment + overhead + other).toFixed(2);
}

function openEstimateForm() {
  if (!currentJobId) {
    showToast('No job selected', 'error');
    return;
  }

  document.getElementById('estimateJobId').value = currentJobId;
  document.getElementById('estimateForm').reset();
  document.getElementById('estimateDate').value = new Date().toISOString().split('T')[0];

  openModal('estimateModal');
}

async function saveEstimate() {
  const jobId = document.getElementById('estimateJobId').value;
  if (!jobId) return;

  const data = {
    estimate_type: document.getElementById('estimateType').value,
    effective_date: document.getElementById('estimateDate').value,
    labor_cost: parseFloat(document.getElementById('laborCost').value) || 0,
    material_cost: parseFloat(document.getElementById('materialCost').value) || 0,
    subcontractor_cost: parseFloat(document.getElementById('subCost').value) || 0,
    equipment_cost: parseFloat(document.getElementById('equipmentCost').value) || 0,
    overhead_cost: parseFloat(document.getElementById('overheadCost').value) || 0,
    other_cost: parseFloat(document.getElementById('otherCost').value) || 0,
    total_estimated_cost: parseFloat(document.getElementById('totalEstimate').value) || 0,
    notes: document.getElementById('estimateNotes').value
  };

  try {
    const response = await fetch(`/api/wip/job/${jobId}/estimate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!response.ok) throw new Error('Failed to save estimate');

    showToast('Estimate saved', 'success');
    closeEstimateModal();
    loadJobEstimates(jobId);
    loadDashboard();
  } catch (err) {
    console.error('Error saving estimate:', err);
    showToast('Failed to save estimate', 'error');
  }
}

function closeEstimateModal() {
  closeModal('estimateModal');
}

// ============================================================
// SNAPSHOTS
// ============================================================

async function loadPeriods() {
  try {
    const response = await fetch('/api/financial-periods');
    const periods = await response.json();

    const select = document.getElementById('snapshotPeriod');
    select.innerHTML = '<option value="">-- Select Period --</option>' +
      (periods || [])
        .filter(p => p.status === 'closed')
        .map(p => `<option value="${p.id}">${p.name}</option>`)
        .join('');
  } catch (err) {
    console.error('Error loading periods:', err);
  }
}

function openSnapshotModal() {
  openModal('snapshotModal');
}

function closeSnapshotModal() {
  closeModal('snapshotModal');
}

async function createSnapshots() {
  const periodId = document.getElementById('snapshotPeriod').value;
  if (!periodId) {
    showToast('Please select a period', 'error');
    return;
  }

  try {
    const response = await fetch('/api/wip/snapshots/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ period_id: periodId })
    });

    if (!response.ok) throw new Error('Failed to create snapshots');

    const result = await response.json();
    showToast(`Created ${result.created} of ${result.total} snapshots`, 'success');
    closeSnapshotModal();
  } catch (err) {
    console.error('Error creating snapshots:', err);
    showToast('Failed to create snapshots', 'error');
  }
}

// ============================================================
// REPORTS
// ============================================================

function openReportsModal() {
  loadAgingReport();
  openModal('reportsModal');
}

function closeReportsModal() {
  closeModal('reportsModal');
}

function switchReportTab(tabName) {
  document.querySelectorAll('#reportsModal .tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('#reportsModal .tab-content').forEach(c => c.classList.remove('active'));
  document.querySelector(`#reportsModal .tab[data-tab="${tabName}"]`).classList.add('active');
  document.getElementById(`report-${tabName}`).classList.add('active');

  if (tabName === 'aging') loadAgingReport();
  else if (tabName === 'billing') loadBillingReport();
  else if (tabName === 'fade') loadFadeReport();
}

async function loadAgingReport() {
  try {
    const response = await fetch('/api/wip/reports/aging');
    const buckets = await response.json();

    const content = `
      <table class="data-table">
        <thead>
          <tr>
            <th>% Complete</th>
            <th class="text-center">Jobs</th>
            <th class="text-right">Total Contract</th>
            <th class="text-right">Cost to Date</th>
          </tr>
        </thead>
        <tbody>
          ${Object.entries(buckets).map(([range, data]) => `
            <tr>
              <td><strong>${range}</strong></td>
              <td class="text-center">${data.jobs.length}</td>
              <td class="text-right">${formatCurrency(data.total_contract)}</td>
              <td class="text-right">${formatCurrency(data.total_cost)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    document.getElementById('agingReportContent').innerHTML = content;
  } catch (err) {
    console.error('Error loading aging report:', err);
  }
}

async function loadBillingReport() {
  try {
    const response = await fetch('/api/wip/reports/billing');
    const data = await response.json();

    const content = `
      <div class="report-summary">
        <div class="summary-card overbilling">
          <div class="summary-label">Total Overbilling</div>
          <div class="summary-value">${formatCurrency(data.summary.total_overbilling)}</div>
          <div class="summary-sub">${data.summary.overbilled_count} jobs</div>
        </div>
        <div class="summary-card underbilling">
          <div class="summary-label">Total Underbilling</div>
          <div class="summary-value">${formatCurrency(data.summary.total_underbilling)}</div>
          <div class="summary-sub">${data.summary.underbilled_count} jobs</div>
        </div>
      </div>

      <h4>Overbilled Jobs (Liability)</h4>
      ${data.overbilled.length > 0 ? `
        <table class="data-table">
          <thead>
            <tr><th>Job</th><th class="text-right">Earned</th><th class="text-right">Billed</th><th class="text-right">Overbilling</th></tr>
          </thead>
          <tbody>
            ${data.overbilled.map(j => `
              <tr>
                <td>${j.job_name}</td>
                <td class="text-right">${formatCurrency(j.earned_revenue)}</td>
                <td class="text-right">${formatCurrency(j.billed_to_date)}</td>
                <td class="text-right text-danger">${formatCurrency(j.overbilling)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : '<p>No overbilled jobs</p>'}

      <h4 style="margin-top: 2rem;">Underbilled Jobs (Asset)</h4>
      ${data.underbilled.length > 0 ? `
        <table class="data-table">
          <thead>
            <tr><th>Job</th><th class="text-right">Earned</th><th class="text-right">Billed</th><th class="text-right">Underbilling</th></tr>
          </thead>
          <tbody>
            ${data.underbilled.map(j => `
              <tr>
                <td>${j.job_name}</td>
                <td class="text-right">${formatCurrency(j.earned_revenue)}</td>
                <td class="text-right">${formatCurrency(j.billed_to_date)}</td>
                <td class="text-right text-info">${formatCurrency(j.underbilling)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : '<p>No underbilled jobs</p>'}
    `;

    document.getElementById('billingReportContent').innerHTML = content;
  } catch (err) {
    console.error('Error loading billing report:', err);
  }
}

async function loadFadeReport() {
  try {
    const response = await fetch('/api/wip/reports/profit-fade');
    const data = await response.json();

    const content = `
      <div class="report-summary">
        <div class="summary-card">
          <div class="summary-label">Total Profit Fade</div>
          <div class="summary-value text-danger">${formatCurrency(data.summary.total_profit_fade)}</div>
          <div class="summary-sub">${data.summary.fading_count} jobs</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">Total Profit Gain</div>
          <div class="summary-value text-success">${formatCurrency(data.summary.total_profit_gain)}</div>
          <div class="summary-sub">${data.summary.improving_count} jobs</div>
        </div>
      </div>

      <h4>Jobs with Profit Fade</h4>
      ${data.fading_jobs.length > 0 ? `
        <table class="data-table">
          <thead>
            <tr><th>Job</th><th class="text-right">Original Profit</th><th class="text-right">Projected Profit</th><th class="text-right">Fade</th><th class="text-center">Fade %</th></tr>
          </thead>
          <tbody>
            ${data.fading_jobs.slice(0, 10).map(j => `
              <tr>
                <td>${j.job_name}</td>
                <td class="text-right">${formatCurrency(j.original_profit)}</td>
                <td class="text-right">${formatCurrency(j.projected_final_profit)}</td>
                <td class="text-right text-danger">${formatCurrency(j.profit_fade)}</td>
                <td class="text-center">${(j.fade_percent * 100).toFixed(1)}%</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : '<p>No jobs with profit fade</p>'}
    `;

    document.getElementById('fadeReportContent').innerHTML = content;
  } catch (err) {
    console.error('Error loading fade report:', err);
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

function truncate(str, len) {
  if (!str) return '';
  return str.length > len ? str.substring(0, len) + '...' : str;
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

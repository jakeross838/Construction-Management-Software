/**
 * Job Profitability Dashboard JavaScript
 */

// State
let dashboardData = {};
let currentJobId = null;
let topChart = null;
let bottomChart = null;
let closedPeriods = [];

// ============================================================
// INITIALIZATION
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
  await Promise.all([
    loadDashboard(),
    loadClosedPeriods()
  ]);
});

// ============================================================
// DATA LOADING
// ============================================================

async function loadDashboard() {
  try {
    const response = await fetch('/api/profitability/dashboard');
    if (!response.ok) throw new Error('Failed to load dashboard');
    dashboardData = await response.json();

    renderSummary();
    renderJobRanking();
    renderCharts();
    renderCompareCheckboxes();
  } catch (err) {
    console.error('Error loading dashboard:', err);
    showToast('Failed to load profitability data', 'error');
  }
}

async function loadClosedPeriods() {
  try {
    const response = await fetch('/api/financial-periods?status=closed');
    if (!response.ok) throw new Error('Failed to load periods');
    closedPeriods = await response.json();
    populatePeriodSelect();
  } catch (err) {
    console.error('Error loading periods:', err);
  }
}

// ============================================================
// RENDERING
// ============================================================

function renderSummary() {
  const summary = dashboardData.summary || {};

  document.getElementById('jobCount').textContent = summary.job_count || 0;
  document.getElementById('totalContract').textContent = formatCurrency(summary.total_contract);
  document.getElementById('totalCost').textContent = formatCurrency(summary.total_cost);
  document.getElementById('grossProfit').textContent = formatCurrency(summary.gross_profit);
  document.getElementById('grossMargin').textContent = formatPercent(summary.avg_gross_margin) + ' margin';
  document.getElementById('netProfit').textContent = formatCurrency(summary.net_profit);
  document.getElementById('netMargin').textContent = formatPercent(summary.avg_net_margin) + ' margin';

  // Update profit color
  const netProfitEl = document.getElementById('netProfit');
  netProfitEl.classList.toggle('negative', summary.net_profit < 0);

  // Show unprofitable alert
  const unprofitable = dashboardData.unprofitable_jobs || [];
  const alert = document.getElementById('unprofitableAlert');
  if (unprofitable.length > 0) {
    document.getElementById('unprofitableCount').textContent = unprofitable.length;
    alert.style.display = 'flex';
  } else {
    alert.style.display = 'none';
  }
}

function renderJobRanking() {
  const tbody = document.getElementById('jobRankingTable');
  const jobs = dashboardData.all_jobs || [];

  if (jobs.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10" class="empty-cell">No jobs found</td></tr>';
    return;
  }

  tbody.innerHTML = jobs.map((job, index) => {
    const netMargin = parseFloat(job.net_margin || 0);
    const marginClass = netMargin < 0 ? 'negative' : netMargin > 0.15 ? 'positive' : '';

    return `
      <tr>
        <td><span class="rank-badge">#${index + 1}</span></td>
        <td><strong>${job.job_name}</strong></td>
        <td>${formatCurrency(job.total_contract)}</td>
        <td>${formatCurrency(job.total_cost - (job.total_overhead || 0))}</td>
        <td>${formatCurrency(job.total_overhead || 0)}</td>
        <td>${formatCurrency(job.total_cost)}</td>
        <td>${formatCurrency(job.gross_profit)}</td>
        <td class="${netMargin < 0 ? 'text-danger' : ''}">${formatCurrency(job.net_profit)}</td>
        <td><span class="margin-badge ${marginClass}">${formatPercent(job.net_margin)}</span></td>
        <td class="actions-cell">
          <button class="btn btn-sm btn-secondary" onclick="viewJobDetail('${job.job_id}')">Details</button>
        </td>
      </tr>
    `;
  }).join('');
}

function renderCharts() {
  const topPerformers = dashboardData.top_performers || [];
  const bottomPerformers = dashboardData.bottom_performers || [];

  // Top performers chart
  if (topChart) topChart.destroy();
  const topCtx = document.getElementById('topPerformersChart').getContext('2d');
  topChart = new Chart(topCtx, {
    type: 'bar',
    data: {
      labels: topPerformers.map(j => j.job_name?.substring(0, 15) + '...'),
      datasets: [{
        label: 'Net Margin %',
        data: topPerformers.map(j => (j.net_margin || 0) * 100),
        backgroundColor: 'rgba(34, 197, 94, 0.7)',
        borderColor: 'rgba(34, 197, 94, 1)',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: {
          ticks: { callback: v => v + '%' },
          grid: { color: 'rgba(255,255,255,0.1)' }
        },
        y: {
          grid: { display: false }
        }
      }
    }
  });

  // Bottom performers chart
  if (bottomChart) bottomChart.destroy();
  const bottomCtx = document.getElementById('bottomPerformersChart').getContext('2d');
  bottomChart = new Chart(bottomCtx, {
    type: 'bar',
    data: {
      labels: bottomPerformers.map(j => j.job_name?.substring(0, 15) + '...'),
      datasets: [{
        label: 'Net Margin %',
        data: bottomPerformers.map(j => (j.net_margin || 0) * 100),
        backgroundColor: bottomPerformers.map(j =>
          j.net_margin < 0 ? 'rgba(239, 68, 68, 0.7)' : 'rgba(234, 179, 8, 0.7)'
        ),
        borderColor: bottomPerformers.map(j =>
          j.net_margin < 0 ? 'rgba(239, 68, 68, 1)' : 'rgba(234, 179, 8, 1)'
        ),
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: {
          ticks: { callback: v => v + '%' },
          grid: { color: 'rgba(255,255,255,0.1)' }
        },
        y: {
          grid: { display: false }
        }
      }
    }
  });
}

function renderCompareCheckboxes() {
  const container = document.getElementById('compareJobCheckboxes');
  const jobs = dashboardData.all_jobs || [];

  container.innerHTML = jobs.map(j =>
    `<label class="checkbox-label">
      <input type="checkbox" name="compare-job" value="${j.job_id}">
      ${j.job_name}
    </label>`
  ).join('');
}

function populatePeriodSelect() {
  const select = document.getElementById('snapshotPeriod');
  select.innerHTML = '<option value="">-- Select Period --</option>' +
    closedPeriods.map(p =>
      `<option value="${p.id}">${p.name}</option>`
    ).join('');
}

// ============================================================
// JOB DETAIL MODAL
// ============================================================

async function viewJobDetail(jobId) {
  currentJobId = jobId;
  document.getElementById('jobDetailTitle').textContent = 'Loading...';

  openModal('jobDetailModal');
  switchDetailTab('summary');

  try {
    const response = await fetch(`/api/profitability/job/${jobId}`);
    if (!response.ok) throw new Error('Failed to load job details');
    const data = await response.json();

    document.getElementById('jobDetailTitle').textContent = data.job?.name || 'Job Profitability';
    renderJobSummary(data);
    await loadJobCosts(jobId);
    await loadBudgetVsActual(jobId);
    await loadJobHistory(jobId);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderJobSummary(data) {
  const prof = data.profitability || {};
  const costs = data.direct_costs || {};

  const content = document.getElementById('jobSummaryContent');
  content.innerHTML = `
    <div class="detail-grid">
      <div class="detail-section">
        <h3>Revenue</h3>
        <div class="detail-row"><span>Contract Amount:</span><span>${formatCurrency(prof.contract_amount)}</span></div>
        <div class="detail-row"><span>Change Orders:</span><span>${formatCurrency(prof.change_order_total)}</span></div>
        <div class="detail-row total"><span>Total Contract:</span><span>${formatCurrency(prof.total_contract)}</span></div>
        <div class="detail-row"><span>Billed to Date:</span><span>${formatCurrency(prof.billed_amount)}</span></div>
        <div class="detail-row"><span>% Complete:</span><span>${prof.percent_complete || 0}%</span></div>
      </div>

      <div class="detail-section">
        <h3>Direct Costs</h3>
        <div class="detail-row"><span>Materials:</span><span>${formatCurrency(costs.material_cost)}</span></div>
        <div class="detail-row"><span>Labor (Base):</span><span>${formatCurrency(costs.labor_base)}</span></div>
        <div class="detail-row"><span>Labor (Burden):</span><span>${formatCurrency(costs.labor_burden)}</span></div>
        <div class="detail-row"><span>Subcontractors:</span><span>${formatCurrency(costs.subcontractor_cost)}</span></div>
        <div class="detail-row"><span>Equipment:</span><span>${formatCurrency(costs.equipment_cost)}</span></div>
        <div class="detail-row"><span>Other:</span><span>${formatCurrency(costs.other_cost)}</span></div>
        <div class="detail-row total"><span>Total Direct:</span><span>${formatCurrency(prof.total_direct)}</span></div>
      </div>

      <div class="detail-section">
        <h3>Indirect Costs</h3>
        <div class="detail-row"><span>Allocated Overhead:</span><span>${formatCurrency(prof.total_overhead)}</span></div>
        <div class="detail-row total"><span>Total Cost:</span><span>${formatCurrency(prof.total_cost)}</span></div>
      </div>

      <div class="detail-section">
        <h3>Profitability</h3>
        <div class="detail-row"><span>Gross Profit:</span><span>${formatCurrency(prof.gross_profit)}</span></div>
        <div class="detail-row"><span>Gross Margin:</span><span>${formatPercent(prof.gross_margin)}</span></div>
        <div class="detail-row total"><span>Net Profit:</span><span class="${parseFloat(prof.net_profit) < 0 ? 'text-danger' : ''}">${formatCurrency(prof.net_profit)}</span></div>
        <div class="detail-row total"><span>Net Margin:</span><span class="${parseFloat(prof.net_margin) < 0 ? 'text-danger' : ''}">${formatPercent(prof.net_margin)}</span></div>
      </div>
    </div>
  `;
}

async function loadJobCosts(jobId) {
  try {
    const response = await fetch(`/api/profitability/job/${jobId}/costs`);
    if (!response.ok) throw new Error('Failed to load costs');
    const data = await response.json();

    const content = document.getElementById('jobCostsContent');

    // Group costs by category
    const invoicesByCode = {};
    (data.invoices || []).forEach(inv => {
      const code = inv.cost_code?.code || 'Unassigned';
      if (!invoicesByCode[code]) invoicesByCode[code] = { name: inv.cost_code?.name || 'Unassigned', total: 0, items: [] };
      invoicesByCode[code].total += parseFloat(inv.amount) || 0;
      invoicesByCode[code].items.push(inv);
    });

    content.innerHTML = `
      <h4>Invoices by Cost Code</h4>
      <table class="data-table">
        <thead>
          <tr><th>Cost Code</th><th>Amount</th></tr>
        </thead>
        <tbody>
          ${Object.entries(invoicesByCode).map(([code, data]) =>
            `<tr><td>${code} - ${data.name}</td><td>${formatCurrency(data.total)}</td></tr>`
          ).join('') || '<tr><td colspan="2">No invoices</td></tr>'}
        </tbody>
      </table>

      <h4>Labor</h4>
      <p>Total Labor Entries: ${(data.labor || []).length}</p>
      <p>Total Labor Cost: ${formatCurrency((data.labor || []).reduce((s, l) => s + parseFloat(l.total_cost || 0), 0))}</p>
    `;
  } catch (err) {
    document.getElementById('jobCostsContent').innerHTML = `<p class="error">Error: ${err.message}</p>`;
  }
}

async function loadBudgetVsActual(jobId) {
  try {
    const response = await fetch(`/api/profitability/job/${jobId}/budget-vs-actual`);
    if (!response.ok) throw new Error('Failed to load budget data');
    const data = await response.json();

    const content = document.getElementById('jobBudgetContent');
    const rows = data.cost_codes || [];
    const totals = data.totals || {};

    content.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Cost Code</th>
            <th>Budget</th>
            <th>Actual</th>
            <th>Variance</th>
            <th>% Used</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(r => {
            const variance = parseFloat(r.variance) || 0;
            return `
              <tr>
                <td>${r.cost_code} - ${r.cost_code_name}</td>
                <td>${formatCurrency(r.budget)}</td>
                <td>${formatCurrency(r.actual)}</td>
                <td class="${variance < 0 ? 'text-danger' : ''}">${formatCurrency(r.variance)}</td>
                <td>${r.percent_used}%</td>
              </tr>
            `;
          }).join('') || '<tr><td colspan="5">No budget data</td></tr>'}
          <tr class="totals-row">
            <td><strong>TOTAL</strong></td>
            <td><strong>${formatCurrency(totals.budget)}</strong></td>
            <td><strong>${formatCurrency(totals.actual)}</strong></td>
            <td class="${totals.variance < 0 ? 'text-danger' : ''}"><strong>${formatCurrency(totals.variance)}</strong></td>
            <td></td>
          </tr>
        </tbody>
      </table>
    `;
  } catch (err) {
    document.getElementById('jobBudgetContent').innerHTML = `<p class="error">Error: ${err.message}</p>`;
  }
}

async function loadJobHistory(jobId) {
  try {
    const response = await fetch(`/api/profitability/job/${jobId}/history`);
    if (!response.ok) throw new Error('Failed to load history');
    const data = await response.json();

    const content = document.getElementById('jobHistoryContent');

    if (data.length === 0) {
      content.innerHTML = '<p>No profitability snapshots yet.</p>';
      return;
    }

    content.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Period</th>
            <th>Total Contract</th>
            <th>Total Cost</th>
            <th>Net Profit</th>
            <th>Net Margin</th>
          </tr>
        </thead>
        <tbody>
          ${data.map(s => `
            <tr>
              <td>${s.period?.name || formatDate(s.snapshot_date)}</td>
              <td>${formatCurrency(s.total_contract)}</td>
              <td>${formatCurrency(s.total_cost)}</td>
              <td class="${parseFloat(s.net_profit) < 0 ? 'text-danger' : ''}">${formatCurrency(s.net_profit)}</td>
              <td>${formatPercent(s.net_margin_percent)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } catch (err) {
    document.getElementById('jobHistoryContent').innerHTML = `<p class="error">Error: ${err.message}</p>`;
  }
}

function switchDetailTab(tabId) {
  document.querySelectorAll('#jobDetailModal .tab').forEach(t =>
    t.classList.toggle('active', t.dataset.tab === tabId)
  );
  document.querySelectorAll('#jobDetailModal .tab-content').forEach(c =>
    c.classList.toggle('active', c.id === `tab-${tabId}`)
  );
}

function closeJobDetailModal() {
  closeModal('jobDetailModal');
}

// ============================================================
// COMPARE MODAL
// ============================================================

function openCompareModal() {
  document.getElementById('comparisonResult').style.display = 'none';
  openModal('compareModal');
}

function closeCompareModal() {
  closeModal('compareModal');
}

async function runComparison() {
  const checkboxes = document.querySelectorAll('input[name="compare-job"]:checked');
  const jobIds = Array.from(checkboxes).map(cb => cb.value);

  if (jobIds.length < 2) {
    showToast('Select at least 2 jobs to compare', 'warning');
    return;
  }

  if (jobIds.length > 5) {
    showToast('Maximum 5 jobs can be compared', 'warning');
    return;
  }

  try {
    const response = await fetch('/api/profitability/compare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ job_ids: jobIds })
    });

    if (!response.ok) throw new Error('Failed to compare');
    const data = await response.json();

    const result = document.getElementById('comparisonResult');
    result.innerHTML = `
      <h4>Comparison Results</h4>
      <table class="data-table">
        <thead>
          <tr>
            <th>Job</th>
            <th>Contract</th>
            <th>Total Cost</th>
            <th>Net Profit</th>
            <th>Net Margin</th>
          </tr>
        </thead>
        <tbody>
          ${data.map(d => `
            <tr>
              <td>${d.job?.name}</td>
              <td>${formatCurrency(d.profitability?.total_contract)}</td>
              <td>${formatCurrency(d.profitability?.total_cost)}</td>
              <td class="${parseFloat(d.profitability?.net_profit) < 0 ? 'text-danger' : ''}">${formatCurrency(d.profitability?.net_profit)}</td>
              <td>${formatPercent(d.profitability?.net_margin)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
    result.style.display = 'block';
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ============================================================
// SNAPSHOTS MODAL
// ============================================================

function openSnapshotsModal() {
  document.getElementById('snapshotPeriod').value = '';
  openModal('snapshotsModal');
}

function closeSnapshotsModal() {
  closeModal('snapshotsModal');
}

async function createSnapshots() {
  const periodId = document.getElementById('snapshotPeriod').value;
  if (!periodId) {
    showToast('Please select a period', 'warning');
    return;
  }

  try {
    const response = await fetch('/api/profitability/snapshots/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ period_id: periodId })
    });

    if (!response.ok) throw new Error('Failed to create snapshots');
    const result = await response.json();

    showToast(`Created ${result.created} snapshots`, 'success');
    closeSnapshotsModal();
  } catch (err) {
    showToast(err.message, 'error');
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
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount || 0);
}

function formatPercent(value) {
  return ((value || 0) * 100).toFixed(1) + '%';
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString();
}

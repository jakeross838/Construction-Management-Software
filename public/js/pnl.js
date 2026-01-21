/**
 * Company P&L JavaScript
 * Profit and Loss Dashboard
 */

let trendChart = null;
let costChart = null;
let marginChart = null;
let dashboardData = null;

// ============================================================
// INITIALIZATION
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  initYearSelect();
  loadDashboard();
  loadPeriods();
});

function initYearSelect() {
  const select = document.getElementById('yearSelect');
  const currentYear = new Date().getFullYear();

  for (let y = currentYear; y >= currentYear - 5; y--) {
    const option = document.createElement('option');
    option.value = y;
    option.textContent = y;
    select.appendChild(option);
  }
}

async function loadDashboard() {
  const year = document.getElementById('yearSelect').value;

  try {
    const response = await fetch(`/api/pnl/dashboard?year=${year}`);
    if (!response.ok) throw new Error('Failed to load P&L data');

    dashboardData = await response.json();

    renderYTDSummary(dashboardData.ytd);
    renderStatement(dashboardData.ytd);
    renderTopJobs(dashboardData.top_jobs);
    renderTrendChart(dashboardData.monthly_trend);
    loadCostBreakdown();
    loadMarginChart();
  } catch (err) {
    console.error('Error loading dashboard:', err);
    showToast('Failed to load P&L data', 'error');
  }
}

// ============================================================
// RENDERING
// ============================================================

function renderYTDSummary(ytd) {
  const setValueAndClass = (id, value, isProfit = false) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = formatCurrency(value);
    if (isProfit) {
      el.classList.toggle('profit', value >= 0);
      el.classList.toggle('loss', value < 0);
    }
  };

  setValueAndClass('ytdRevenue', ytd.total_revenue);
  setValueAndClass('ytdCogs', ytd.total_cogs);
  setValueAndClass('ytdGrossProfit', ytd.gross_profit, true);
  document.getElementById('ytdGrossMargin').textContent = `${(ytd.gross_margin * 100).toFixed(1)}% margin`;

  setValueAndClass('ytdOpIncome', ytd.operating_income, true);
  document.getElementById('ytdOpMargin').textContent = `${(ytd.operating_margin * 100).toFixed(1)}% margin`;

  setValueAndClass('ytdNetIncome', ytd.net_income, true);
  document.getElementById('ytdNetMargin').textContent = `${(ytd.net_margin * 100).toFixed(1)}% margin`;
}

function renderStatement(data) {
  const statement = document.getElementById('pnlStatement');

  statement.innerHTML = `
    <div class="pnl-section">
      <div class="pnl-header">REVENUE</div>
      <div class="pnl-row">
        <span>Contract Revenue</span>
        <span>${formatCurrency(data.contract_revenue || data.total_revenue)}</span>
      </div>
      <div class="pnl-row">
        <span>Change Order Revenue</span>
        <span>${formatCurrency(data.change_order_revenue || 0)}</span>
      </div>
      <div class="pnl-row total">
        <span>Total Revenue</span>
        <span>${formatCurrency(data.total_revenue)}</span>
      </div>
    </div>

    <div class="pnl-section">
      <div class="pnl-header">COST OF GOODS SOLD</div>
      <div class="pnl-row">
        <span>Materials</span>
        <span>${formatCurrency(data.material_cost || 0)}</span>
      </div>
      <div class="pnl-row">
        <span>Labor</span>
        <span>${formatCurrency(data.labor_cost || 0)}</span>
      </div>
      <div class="pnl-row">
        <span>Subcontractors</span>
        <span>${formatCurrency(data.subcontractor_cost || 0)}</span>
      </div>
      <div class="pnl-row">
        <span>Equipment</span>
        <span>${formatCurrency(data.equipment_cost || 0)}</span>
      </div>
      <div class="pnl-row">
        <span>Other Direct</span>
        <span>${formatCurrency(data.other_direct_cost || 0)}</span>
      </div>
      <div class="pnl-row total">
        <span>Total COGS</span>
        <span>${formatCurrency(data.total_cogs)}</span>
      </div>
    </div>

    <div class="pnl-section">
      <div class="pnl-row gross-profit ${parseFloat(data.gross_profit) >= 0 ? 'positive' : 'negative'}">
        <span>GROSS PROFIT</span>
        <span>${formatCurrency(data.gross_profit)} <small>(${(data.gross_margin * 100).toFixed(1)}%)</small></span>
      </div>
    </div>

    <div class="pnl-section">
      <div class="pnl-header">OPERATING EXPENSES</div>
      <div class="pnl-row">
        <span>Overhead</span>
        <span>${formatCurrency(data.overhead_expense || data.total_opex || 0)}</span>
      </div>
      <div class="pnl-row total">
        <span>Total Operating Expenses</span>
        <span>${formatCurrency(data.total_opex || data.overhead_expense || 0)}</span>
      </div>
    </div>

    <div class="pnl-section">
      <div class="pnl-row operating-income ${parseFloat(data.operating_income) >= 0 ? 'positive' : 'negative'}">
        <span>OPERATING INCOME</span>
        <span>${formatCurrency(data.operating_income)} <small>(${(data.operating_margin * 100).toFixed(1)}%)</small></span>
      </div>
    </div>

    <div class="pnl-section">
      <div class="pnl-row net-income ${parseFloat(data.net_income) >= 0 ? 'positive' : 'negative'}">
        <span>NET INCOME</span>
        <span>${formatCurrency(data.net_income)} <small>(${(data.net_margin * 100).toFixed(1)}%)</small></span>
      </div>
    </div>
  `;
}

function renderTopJobs(jobs) {
  const container = document.getElementById('topJobsList');

  if (!jobs || jobs.length === 0) {
    container.innerHTML = '<div class="empty-state">No job data available</div>';
    return;
  }

  container.innerHTML = jobs.map((job, i) => `
    <div class="top-job-item">
      <div class="job-rank">${i + 1}</div>
      <div class="job-info">
        <div class="job-name">${job.job_name}</div>
        <div class="job-profit ${parseFloat(job.net_profit) >= 0 ? 'positive' : 'negative'}">
          ${formatCurrency(job.net_profit)} <span class="margin">(${(parseFloat(job.net_margin) * 100).toFixed(1)}%)</span>
        </div>
      </div>
      <div class="job-contract">${formatCurrency(job.total_contract)}</div>
    </div>
  `).join('');
}

function renderTrendChart(trend) {
  const ctx = document.getElementById('trendChart')?.getContext('2d');
  if (!ctx) return;

  if (trendChart) trendChart.destroy();

  const labels = trend.map(t => t.period_name || formatMonth(t.start_date));
  const revenueData = trend.map(t => parseFloat(t.total_revenue || 0));
  const profitData = trend.map(t => parseFloat(t.net_income || 0));

  trendChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Revenue',
          data: revenueData,
          borderColor: '#58a6ff',
          backgroundColor: 'rgba(88, 166, 255, 0.1)',
          fill: true,
          tension: 0.4
        },
        {
          label: 'Net Income',
          data: profitData,
          borderColor: '#3fb950',
          backgroundColor: 'rgba(63, 185, 80, 0.1)',
          fill: true,
          tension: 0.4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          grid: { color: '#30363d' },
          ticks: {
            color: '#8b949e',
            callback: v => formatCurrencyShort(v)
          }
        },
        x: {
          grid: { display: false },
          ticks: { color: '#e6edf3' }
        }
      },
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#e6edf3' }
        }
      }
    }
  });
}

async function loadCostBreakdown() {
  try {
    const year = document.getElementById('yearSelect').value;
    const response = await fetch(`/api/pnl/costs/by-category?start_date=${year}-01-01&end_date=${year}-12-31`);
    const data = await response.json();

    renderCostChart(data);
  } catch (err) {
    console.error('Error loading cost breakdown:', err);
  }
}

function renderCostChart(data) {
  const ctx = document.getElementById('costBreakdownChart')?.getContext('2d');
  if (!ctx) return;

  if (costChart) costChart.destroy();

  costChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: data.map(d => d.category),
      datasets: [{
        data: data.map(d => d.amount),
        backgroundColor: ['#58a6ff', '#3fb950', '#d29922', '#f85149', '#8b949e', '#a371f7']
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: { color: '#e6edf3' }
        },
        tooltip: {
          callbacks: {
            label: ctx => `${ctx.label}: ${formatCurrency(ctx.raw)} (${(ctx.parsed / ctx.dataset.data.reduce((a, b) => a + b, 0) * 100).toFixed(1)}%)`
          }
        }
      }
    }
  });
}

async function loadMarginChart() {
  try {
    const response = await fetch('/api/pnl/margins/by-job');
    const data = await response.json();

    renderMarginChart(data.jobs);
  } catch (err) {
    console.error('Error loading margins:', err);
  }
}

function renderMarginChart(jobs) {
  const ctx = document.getElementById('marginChart')?.getContext('2d');
  if (!ctx) return;

  if (marginChart) marginChart.destroy();

  // Take top 15 jobs by contract value
  const topJobs = jobs.slice(0, 15);

  marginChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: topJobs.map(j => truncate(j.job_name, 15)),
      datasets: [
        {
          label: 'Gross Margin',
          data: topJobs.map(j => (parseFloat(j.gross_margin) * 100).toFixed(1)),
          backgroundColor: '#58a6ff'
        },
        {
          label: 'Net Margin',
          data: topJobs.map(j => (parseFloat(j.net_margin) * 100).toFixed(1)),
          backgroundColor: topJobs.map(j => parseFloat(j.net_margin) >= 0 ? '#3fb950' : '#f85149')
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          grid: { color: '#30363d' },
          ticks: {
            color: '#8b949e',
            callback: v => v + '%'
          }
        },
        x: {
          grid: { display: false },
          ticks: { color: '#e6edf3' }
        }
      },
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#e6edf3' }
        }
      }
    }
  });
}

// ============================================================
// STATEMENT PERIOD SWITCH
// ============================================================

async function loadStatementPeriod() {
  const period = document.getElementById('statementPeriod').value;

  if (period === 'ytd' && dashboardData?.ytd) {
    renderStatement(dashboardData.ytd);
  } else if (period === 'current' && dashboardData?.current_pnl) {
    renderStatement(dashboardData.current_pnl);
  }
}

// ============================================================
// SNAPSHOTS
// ============================================================

async function loadPeriods() {
  try {
    const response = await fetch('/api/financial-periods');
    const periods = await response.json();

    const closedPeriods = (periods || []).filter(p => p.status === 'closed');

    // Snapshot modal
    const snapshotSelect = document.getElementById('snapshotPeriod');
    snapshotSelect.innerHTML = '<option value="">-- Select Period --</option>' +
      closedPeriods.map(p => `<option value="${p.id}">${p.name}</option>`).join('');

    // Compare modal
    const period1 = document.getElementById('period1');
    const period2 = document.getElementById('period2');
    const options = '<option value="">-- Select Period --</option>' +
      closedPeriods.map(p => `<option value="${p.id}">${p.name}</option>`).join('');

    period1.innerHTML = options;
    period2.innerHTML = options;
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

async function createSnapshot() {
  const periodId = document.getElementById('snapshotPeriod').value;
  if (!periodId) {
    showToast('Please select a period', 'error');
    return;
  }

  try {
    const response = await fetch('/api/pnl/snapshot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ period_id: periodId })
    });

    if (!response.ok) throw new Error('Failed to create snapshot');

    showToast('P&L snapshot created', 'success');
    closeSnapshotModal();
    loadDashboard();
  } catch (err) {
    console.error('Error creating snapshot:', err);
    showToast('Failed to create snapshot', 'error');
  }
}

// ============================================================
// COMPARE
// ============================================================

function openCompareModal() {
  document.getElementById('comparisonResult').style.display = 'none';
  openModal('compareModal');
}

function closeCompareModal() {
  closeModal('compareModal');
}

async function runComparison() {
  const period1 = document.getElementById('period1').value;
  const period2 = document.getElementById('period2').value;

  if (!period1 || !period2) {
    showToast('Please select both periods', 'error');
    return;
  }

  try {
    const response = await fetch(`/api/pnl/compare?period1_id=${period1}&period2_id=${period2}`);
    if (!response.ok) throw new Error('Failed to compare periods');

    const data = await response.json();
    renderComparison(data);
  } catch (err) {
    console.error('Error comparing periods:', err);
    showToast('Failed to compare periods', 'error');
  }
}

function renderComparison(data) {
  const container = document.getElementById('comparisonResult');
  const p1 = data.period1 || {};
  const p2 = data.period2 || {};
  const v = data.variances || {};

  container.innerHTML = `
    <h4 style="margin-top: 1.5rem;">Comparison Results</h4>
    <table class="data-table comparison-table">
      <thead>
        <tr>
          <th>Metric</th>
          <th class="text-right">${p1.period?.name || 'Period 1'}</th>
          <th class="text-right">${p2.period?.name || 'Period 2'}</th>
          <th class="text-right">Variance</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Revenue</td>
          <td class="text-right">${formatCurrency(p1.total_revenue)}</td>
          <td class="text-right">${formatCurrency(p2.total_revenue)}</td>
          <td class="text-right ${v.revenue >= 0 ? 'positive' : 'negative'}">${formatCurrency(v.revenue)}</td>
        </tr>
        <tr>
          <td>COGS</td>
          <td class="text-right">${formatCurrency(p1.total_cogs)}</td>
          <td class="text-right">${formatCurrency(p2.total_cogs)}</td>
          <td class="text-right ${v.cogs <= 0 ? 'positive' : 'negative'}">${formatCurrency(v.cogs)}</td>
        </tr>
        <tr>
          <td>Gross Profit</td>
          <td class="text-right">${formatCurrency(p1.gross_profit)}</td>
          <td class="text-right">${formatCurrency(p2.gross_profit)}</td>
          <td class="text-right ${v.gross_profit >= 0 ? 'positive' : 'negative'}">${formatCurrency(v.gross_profit)}</td>
        </tr>
        <tr>
          <td>Operating Income</td>
          <td class="text-right">${formatCurrency(p1.operating_income)}</td>
          <td class="text-right">${formatCurrency(p2.operating_income)}</td>
          <td class="text-right ${v.operating_income >= 0 ? 'positive' : 'negative'}">${formatCurrency(v.operating_income)}</td>
        </tr>
        <tr class="total-row">
          <td><strong>Net Income</strong></td>
          <td class="text-right"><strong>${formatCurrency(p1.net_income)}</strong></td>
          <td class="text-right"><strong>${formatCurrency(p2.net_income)}</strong></td>
          <td class="text-right ${v.net_income >= 0 ? 'positive' : 'negative'}"><strong>${formatCurrency(v.net_income)}</strong></td>
        </tr>
      </tbody>
    </table>
  `;

  container.style.display = 'block';
}

// ============================================================
// UTILITIES
// ============================================================

function formatCurrency(value) {
  const num = parseFloat(value) || 0;
  return num.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function formatCurrencyShort(value) {
  const num = parseFloat(value) || 0;
  if (Math.abs(num) >= 1000000) return '$' + (num / 1000000).toFixed(1) + 'M';
  if (Math.abs(num) >= 1000) return '$' + (num / 1000).toFixed(0) + 'K';
  return '$' + num.toFixed(0);
}

function formatMonth(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
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

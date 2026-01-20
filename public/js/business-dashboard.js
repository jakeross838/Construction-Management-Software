/**
 * Business Dashboard Frontend
 * Company-wide metrics, burn rate analysis, and profit projections
 */

(function() {
  'use strict';

  let trendsChart = null;
  let statusChart = null;
  let burnRateChart = null;

  // Format currency
  function formatCurrency(amount, short = false) {
    const num = parseFloat(amount) || 0;
    if (short && Math.abs(num) >= 1000000) {
      return '$' + (num / 1000000).toFixed(1) + 'M';
    }
    if (short && Math.abs(num) >= 1000) {
      return '$' + (num / 1000).toFixed(0) + 'K';
    }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(num);
  }

  // Get chart colors from CSS variables
  function getChartColors() {
    const style = getComputedStyle(document.documentElement);
    return {
      blue: style.getPropertyValue('--accent-blue').trim() || '#58a6ff',
      green: style.getPropertyValue('--accent-green').trim() || '#3fb950',
      orange: style.getPropertyValue('--accent-orange').trim() || '#d29922',
      red: style.getPropertyValue('--accent-red').trim() || '#f85149',
      textSecondary: style.getPropertyValue('--text-secondary').trim() || '#8b949e',
      border: style.getPropertyValue('--border').trim() || '#30363d'
    };
  }

  // ============ DATA LOADING ============

  async function loadMetrics() {
    try {
      const response = await fetch('/api/business/metrics');
      if (!response.ok) throw new Error('Failed to load metrics');
      const data = await response.json();

      // Jobs
      document.getElementById('activeJobsCount').textContent = data.jobs.active;
      document.getElementById('activeJobsValue').textContent = `${formatCurrency(data.jobs.active_contract_value, true)} contract value`;

      // Pipeline
      document.getElementById('pipelineValue').textContent = formatCurrency(data.pipeline.pipeline_value, true);
      document.getElementById('pipelineCount').textContent = `${data.pipeline.lead_count} open leads`;

      // Pending Invoices
      document.getElementById('pendingInvoiceValue').textContent = formatCurrency(data.financials.pending_approval_value, true);
      document.getElementById('pendingInvoiceCount').textContent = `${data.financials.pending_approval_count} awaiting approval`;

      // Pending Draws
      document.getElementById('pendingDrawValue').textContent = formatCurrency(data.draws.pending_value, true);
      document.getElementById('pendingDrawCount').textContent = `${data.draws.pending_count} awaiting funding`;

      // Update status chart
      updateStatusChart(data.jobs);
    } catch (err) {
      console.error('Error loading metrics:', err);
    }
  }

  async function loadTrends() {
    try {
      const months = Math.ceil(parseInt(document.getElementById('periodSelect').value) / 30);
      const response = await fetch(`/api/business/trends?months=${months}`);
      if (!response.ok) throw new Error('Failed to load trends');
      const data = await response.json();

      updateTrendsChart(data);
    } catch (err) {
      console.error('Error loading trends:', err);
    }
  }

  async function loadBurnRate() {
    try {
      const period = document.getElementById('burnPeriodSelect').value;
      const response = await fetch(`/api/business/burn-rate?period=${period}`);
      if (!response.ok) throw new Error('Failed to load burn rate');
      const data = await response.json();

      updateBurnRateChart(data);
    } catch (err) {
      console.error('Error loading burn rate:', err);
    }
  }

  async function loadProfitProjections() {
    try {
      const response = await fetch('/api/business/profit');
      if (!response.ok) throw new Error('Failed to load profit');
      const data = await response.json();

      renderProfitTable(data);
    } catch (err) {
      console.error('Error loading profit projections:', err);
    }
  }

  // ============ CHART UPDATES ============

  function updateTrendsChart(data) {
    const colors = getChartColors();
    const ctx = document.getElementById('trendsChart').getContext('2d');

    const labels = data.map(d => {
      const [year, month] = d.month.split('-');
      return new Date(year, month - 1).toLocaleDateString('en-US', { month: 'short' });
    });

    if (trendsChart) trendsChart.destroy();

    trendsChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Invoices',
            data: data.map(d => d.invoices_amount),
            borderColor: colors.blue,
            backgroundColor: colors.blue + '20',
            fill: true,
            tension: 0.3
          },
          {
            label: 'Draws Funded',
            data: data.map(d => d.funded_amount),
            borderColor: colors.green,
            backgroundColor: colors.green + '20',
            fill: true,
            tension: 0.3
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          intersect: false,
          mode: 'index'
        },
        plugins: {
          legend: {
            position: 'top',
            labels: { color: colors.textSecondary }
          },
          tooltip: {
            callbacks: {
              label: ctx => `${ctx.dataset.label}: ${formatCurrency(ctx.raw)}`
            }
          }
        },
        scales: {
          x: {
            grid: { color: colors.border },
            ticks: { color: colors.textSecondary }
          },
          y: {
            grid: { color: colors.border },
            ticks: {
              color: colors.textSecondary,
              callback: value => formatCurrency(value, true)
            }
          }
        }
      }
    });
  }

  function updateStatusChart(jobs) {
    const colors = getChartColors();
    const ctx = document.getElementById('statusChart').getContext('2d');

    if (statusChart) statusChart.destroy();

    statusChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Active', 'Completed', 'On Hold'],
        datasets: [{
          data: [jobs.active, jobs.completed, jobs.on_hold],
          backgroundColor: [colors.blue, colors.green, colors.orange],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: colors.textSecondary }
          }
        },
        cutout: '60%'
      }
    });
  }

  function updateBurnRateChart(data) {
    const colors = getChartColors();
    const ctx = document.getElementById('burnRateChart').getContext('2d');

    const jobs = data.jobs.slice(0, 10); // Top 10 jobs

    if (burnRateChart) burnRateChart.destroy();

    burnRateChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: jobs.map(j => j.job_name.length > 20 ? j.job_name.substring(0, 20) + '...' : j.job_name),
        datasets: [
          {
            label: 'Spent',
            data: jobs.map(j => j.total_spent),
            backgroundColor: colors.blue + '80'
          },
          {
            label: 'Remaining',
            data: jobs.map(j => j.remaining),
            backgroundColor: colors.green + '80'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: {
          legend: {
            position: 'top',
            labels: { color: colors.textSecondary }
          },
          tooltip: {
            callbacks: {
              label: ctx => `${ctx.dataset.label}: ${formatCurrency(ctx.raw)}`
            }
          }
        },
        scales: {
          x: {
            stacked: true,
            grid: { color: colors.border },
            ticks: {
              color: colors.textSecondary,
              callback: value => formatCurrency(value, true)
            }
          },
          y: {
            stacked: true,
            grid: { display: false },
            ticks: { color: colors.textSecondary }
          }
        }
      }
    });
  }

  // ============ PROFIT TABLE ============

  function renderProfitTable(data) {
    const tbody = document.getElementById('profitTableBody');

    if (!data.jobs || data.jobs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-secondary);">No jobs found</td></tr>';
      return;
    }

    tbody.innerHTML = data.jobs.map(job => {
      const marginClass = job.profit_margin >= 20 ? 'positive' : job.profit_margin >= 10 ? 'warning' : 'negative';

      return `
        <tr>
          <td><strong>${job.job_name}</strong></td>
          <td><span class="badge ${job.status === 'active' ? 'badge-info' : 'badge-success'}">${job.status}</span></td>
          <td>${formatCurrency(job.revised_contract)}</td>
          <td>${formatCurrency(job.total_paid)}</td>
          <td>
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span class="${marginClass}">${formatCurrency(job.projected_profit)}</span>
              <div class="profit-bar">
                <div class="profit-bar-fill ${marginClass}" style="width: ${Math.min(Math.max(job.profit_margin, 0), 100)}%;"></div>
              </div>
            </div>
          </td>
          <td><span class="${marginClass}">${job.profit_margin.toFixed(1)}%</span></td>
        </tr>
      `;
    }).join('');

    // Update totals
    document.getElementById('totalProjectedProfit').textContent = formatCurrency(data.company_totals.total_projected_profit);
    document.getElementById('totalProjectedProfit').className = data.company_totals.total_projected_profit >= 0 ? 'positive' : 'negative';

    document.getElementById('overallMargin').textContent = `${data.company_totals.overall_margin.toFixed(1)}%`;
    document.getElementById('overallMargin').className = data.company_totals.overall_margin >= 15 ? 'positive' : data.company_totals.overall_margin >= 10 ? '' : 'negative';
  }

  // ============ EVENT HANDLERS ============

  window.changePeriod = function() {
    loadTrends();
  };

  // ============ INITIALIZATION ============

  async function init() {
    // Load all data in parallel
    await Promise.all([
      loadMetrics(),
      loadTrends(),
      loadBurnRate(),
      loadProfitProjections()
    ]);
  }

  // Auto-init when DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

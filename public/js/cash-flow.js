/**
 * Cash Flow JavaScript
 * Track inflows, outflows, and forecast cash position
 */

let forecastChart = null;
let dashboardData = null;

// ============================================================
// INITIALIZATION
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  loadDashboard();
  loadJobs();
  setDefaultDate();
});

function setDefaultDate() {
  document.getElementById('entryDate').value = new Date().toISOString().split('T')[0];

  // Set forecast start to next Monday
  const today = new Date();
  const dayOfWeek = today.getDay();
  const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
  const nextMonday = new Date(today);
  nextMonday.setDate(today.getDate() + daysUntilMonday);
  document.getElementById('forecastStart').value = nextMonday.toISOString().split('T')[0];
}

async function loadDashboard() {
  try {
    const response = await fetch('/api/cash-flow/dashboard');
    if (!response.ok) throw new Error('Failed to load cash flow data');

    dashboardData = await response.json();

    renderSummary(dashboardData.summary);
    renderForecastChart(dashboardData.weekly_forecast);
    renderPayments(dashboardData.upcoming_payments);
    renderReceipts(dashboardData.expected_receipts);
    renderForecastTable(dashboardData.weekly_forecast);

    // Show overdue alert if needed
    if (dashboardData.summary.payments_overdue > 0) {
      document.getElementById('overdueAlert').style.display = 'block';
      document.getElementById('overdueAmount').textContent = formatCurrency(dashboardData.summary.payments_overdue);
    }
  } catch (err) {
    console.error('Error loading dashboard:', err);
    showToast('Failed to load cash flow data', 'error');
  }
}

async function loadJobs() {
  try {
    const response = await fetch('/api/jobs?status=active');
    const jobs = await response.json();

    const select = document.getElementById('entryJob');
    select.innerHTML = '<option value="">-- Select Job --</option>' +
      (jobs || []).map(j => `<option value="${j.id}">${j.name}</option>`).join('');
  } catch (err) {
    console.error('Error loading jobs:', err);
  }
}

// ============================================================
// RENDERING
// ============================================================

function renderSummary(summary) {
  document.getElementById('totalReceivables').textContent = formatCurrency(summary.total_receivables);
  document.getElementById('overdueReceivables').textContent = `${formatCurrency(summary.overdue_receivables)} overdue`;

  document.getElementById('totalPayables').textContent = formatCurrency(summary.total_payables);
  document.getElementById('overduePayables').textContent = `${formatCurrency(summary.overdue_payables)} overdue`;

  const netEl = document.getElementById('netPosition');
  netEl.textContent = formatCurrency(summary.net_position);
  netEl.classList.toggle('positive', summary.net_position >= 0);
  netEl.classList.toggle('negative', summary.net_position < 0);

  document.getElementById('due7Days').textContent = formatCurrency(summary.payments_due_7_days);
}

function renderForecastChart(forecast) {
  const ctx = document.getElementById('forecastChart')?.getContext('2d');
  if (!ctx) return;

  if (forecastChart) forecastChart.destroy();

  const labels = forecast.map(f => formatWeek(f.period_start, f.period_end));
  const inflows = forecast.map(f => parseFloat(f.total_projected_inflows || 0));
  const outflows = forecast.map(f => parseFloat(f.total_projected_outflows || 0));
  const balance = forecast.map(f => parseFloat(f.closing_balance || 0));

  forecastChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Inflows',
          data: inflows,
          backgroundColor: 'rgba(63, 185, 80, 0.7)',
          stack: 'flow'
        },
        {
          label: 'Outflows',
          data: outflows.map(v => -v),
          backgroundColor: 'rgba(248, 81, 73, 0.7)',
          stack: 'flow'
        },
        {
          label: 'Closing Balance',
          data: balance,
          type: 'line',
          borderColor: '#58a6ff',
          backgroundColor: 'rgba(88, 166, 255, 0.1)',
          fill: false,
          tension: 0.4,
          yAxisID: 'y1'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          stacked: true,
          grid: { color: '#30363d' },
          ticks: {
            color: '#8b949e',
            callback: v => formatCurrencyShort(v)
          }
        },
        y1: {
          position: 'right',
          grid: { display: false },
          ticks: {
            color: '#58a6ff',
            callback: v => formatCurrencyShort(v)
          }
        },
        x: {
          stacked: true,
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

function renderPayments(payments) {
  const container = document.getElementById('upcomingPayments');

  if (!payments || payments.length === 0) {
    container.innerHTML = '<div class="empty-state">No upcoming payments</div>';
    return;
  }

  container.innerHTML = payments.map(p => `
    <div class="payment-item ${p.urgency}">
      <div class="payment-urgency ${p.urgency}"></div>
      <div class="payment-info">
        <div class="payment-vendor">${p.vendor_name}</div>
        <div class="payment-job">${p.job_name || 'No job'}</div>
        <div class="payment-invoice">${p.invoice_number}</div>
      </div>
      <div class="payment-details">
        <div class="payment-amount">${formatCurrency(p.amount)}</div>
        <div class="payment-due ${p.urgency}">${formatDate(p.due_date)}</div>
      </div>
    </div>
  `).join('');
}

function renderReceipts(receipts) {
  const container = document.getElementById('expectedReceipts');

  if (!receipts || receipts.length === 0) {
    container.innerHTML = '<div class="empty-state">No expected receipts</div>';
    return;
  }

  container.innerHTML = receipts.map(r => `
    <div class="receipt-item">
      <div class="receipt-info">
        <div class="receipt-job">${r.job_name}</div>
        <div class="receipt-client">${r.client_name || ''}</div>
        <div class="receipt-draw">Draw #${r.draw_number}</div>
      </div>
      <div class="receipt-details">
        <div class="receipt-amount">${formatCurrency(r.total_amount)}</div>
        <div class="receipt-expected">Expected ${formatDate(r.expected_date)}</div>
      </div>
    </div>
  `).join('');
}

function renderForecastTable(forecast) {
  const tbody = document.getElementById('forecastTable');

  if (!forecast || forecast.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-cell">No forecast data. Click "Generate Forecast" to create projections.</td></tr>';
    return;
  }

  tbody.innerHTML = forecast.map(f => {
    const net = parseFloat(f.net_cash_flow || 0);
    return `
      <tr>
        <td>${formatWeek(f.period_start, f.period_end)}</td>
        <td class="text-right">${formatCurrency(f.opening_balance)}</td>
        <td class="text-right inflow">${formatCurrency(f.total_projected_inflows)}</td>
        <td class="text-right outflow">${formatCurrency(f.total_projected_outflows)}</td>
        <td class="text-right ${net >= 0 ? 'positive' : 'negative'}">${formatCurrency(net)}</td>
        <td class="text-right">${formatCurrency(f.closing_balance)}</td>
      </tr>
    `;
  }).join('');
}

// ============================================================
// ENTRY MODAL
// ============================================================

function openEntryModal() {
  document.getElementById('entryForm').reset();
  setDefaultDate();
  openModal('entryModal');
}

function closeEntryModal() {
  closeModal('entryModal');
}

async function saveEntry() {
  const data = {
    entry_date: document.getElementById('entryDate').value,
    entry_type: document.getElementById('entryType').value,
    category: document.getElementById('entryCategory').value,
    amount: parseFloat(document.getElementById('entryAmount').value),
    job_id: document.getElementById('entryJob').value || null,
    description: document.getElementById('entryDescription').value,
    reference_number: document.getElementById('entryReference').value,
    status: document.getElementById('entryStatus').value,
    is_projected: document.getElementById('entryProjected').checked
  };

  if (!data.entry_date || !data.amount) {
    showToast('Please fill in required fields', 'error');
    return;
  }

  try {
    const response = await fetch('/api/cash-flow/entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!response.ok) throw new Error('Failed to save entry');

    showToast('Entry saved', 'success');
    closeEntryModal();
    loadDashboard();
  } catch (err) {
    console.error('Error saving entry:', err);
    showToast('Failed to save entry', 'error');
  }
}

// ============================================================
// FORECAST
// ============================================================

function generateForecast() {
  openModal('forecastModal');
}

function closeForecastModal() {
  closeModal('forecastModal');
}

async function runForecast() {
  const data = {
    start_date: document.getElementById('forecastStart').value,
    weeks: parseInt(document.getElementById('forecastWeeks').value),
    opening_balance: parseFloat(document.getElementById('openingBalance').value) || 0
  };

  try {
    const response = await fetch('/api/cash-flow/forecast/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!response.ok) throw new Error('Failed to generate forecast');

    const result = await response.json();
    showToast(`Generated ${result.count} week forecast`, 'success');
    closeForecastModal();
    loadDashboard();
  } catch (err) {
    console.error('Error generating forecast:', err);
    showToast('Failed to generate forecast', 'error');
  }
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

function formatDate(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatWeek(start, end) {
  const s = new Date(start);
  const e = new Date(end);
  return `${s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${e.toLocaleDateString('en-US', { day: 'numeric' })}`;
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

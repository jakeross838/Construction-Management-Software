/**
 * Job Hub - Unified Job Dashboard
 * Single-page view of all job-related data
 */

(function() {
  'use strict';

  let currentJobId = null;

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
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  // Format relative time
  function formatRelativeTime(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDate(dateStr);
  }

  // Load jobs for selector
  async function loadJobs() {
    try {
      const response = await fetch('/api/jobs');
      if (!response.ok) throw new Error('Failed to load jobs');
      const jobs = await response.json();

      const select = document.getElementById('jobSelect');
      jobs.forEach(job => {
        const option = document.createElement('option');
        option.value = job.id;
        option.textContent = job.name;
        select.appendChild(option);
      });

      // Check for job_id in URL
      const urlParams = new URLSearchParams(window.location.search);
      const jobId = urlParams.get('job_id');
      if (jobId) {
        select.value = jobId;
        loadJobHub(jobId);
      }
    } catch (err) {
      console.error('Error loading jobs:', err);
      showToast('Failed to load jobs', 'error');
    }
  }

  // Load job hub data
  async function loadJobHub(jobId) {
    if (!jobId) {
      document.getElementById('jobHeader').style.display = 'none';
      document.getElementById('hubGrid').style.display = 'none';
      document.getElementById('emptyState').style.display = 'block';
      return;
    }

    currentJobId = jobId;

    try {
      const response = await fetch(`/api/jobs/${jobId}/hub`);
      if (!response.ok) throw new Error('Failed to load job hub');
      const data = await response.json();

      renderJobHub(data);

      // Update URL
      const url = new URL(window.location);
      url.searchParams.set('job_id', jobId);
      window.history.replaceState({}, '', url);

    } catch (err) {
      console.error('Error loading job hub:', err);
      showToast('Failed to load job data', 'error');
    }
  }

  // Render job hub data
  function renderJobHub(data) {
    document.getElementById('emptyState').style.display = 'none';
    document.getElementById('jobHeader').style.display = 'block';
    document.getElementById('hubGrid').style.display = 'grid';

    // Job Header
    const job = data.job;
    document.getElementById('jobName').textContent = job.name || '-';
    document.getElementById('jobAddress').textContent = job.address || '-';
    document.getElementById('jobClient').textContent = job.client_name ? `Client: ${job.client_name}` : '';
    document.getElementById('jobStatus').textContent = job.status ? `Status: ${job.status}` : '';
    document.getElementById('contractAmount').textContent = formatCurrency(job.contract_amount);

    // Calculate totals from invoices
    const totalBilled = data.invoices?.total_amount || 0;
    const totalPaid = data.invoices?.by_status?.paid || 0;
    document.getElementById('totalBilled').textContent = formatCurrency(totalBilled);
    document.getElementById('totalPaid').textContent = formatCurrency(totalPaid);

    // Budget Card
    const budget = data.budget || {};
    const budgetTotal = parseFloat(budget.total_budget) || 0;
    const budgetCommitted = parseFloat(budget.total_committed) || 0;
    const budgetRemaining = budgetTotal - budgetCommitted;
    const budgetPercent = budgetTotal > 0 ? Math.round((budgetCommitted / budgetTotal) * 100) : 0;

    document.getElementById('budgetTotal').textContent = formatCurrency(budgetTotal);
    document.getElementById('budgetCommitted').textContent = formatCurrency(budgetCommitted);
    document.getElementById('budgetRemaining').textContent = formatCurrency(budgetRemaining);
    document.getElementById('budgetRemaining').className = `hub-stat-value ${budgetRemaining < 0 ? 'negative' : ''}`;
    document.getElementById('budgetProgress').style.width = `${Math.min(budgetPercent, 100)}%`;
    document.getElementById('budgetProgress').style.background = budgetPercent > 100 ? 'var(--accent-red)' : 'var(--accent-blue)';
    document.getElementById('budgetPercent').textContent = `${budgetPercent}%`;

    // Invoices Card
    const invoices = data.invoices || {};
    document.getElementById('invoiceCount').textContent = invoices.count || 0;
    document.getElementById('invoiceTotal').textContent = formatCurrency(invoices.total_amount);
    document.getElementById('invoiceNeedsApproval').textContent = invoices.by_status?.needs_approval || 0;
    document.getElementById('invoiceInDraw').textContent = invoices.by_status?.in_draw || 0;

    // Purchase Orders Card
    const pos = data.purchase_orders || {};
    document.getElementById('poCount').textContent = pos.count || 0;
    document.getElementById('poTotal').textContent = formatCurrency(pos.total_amount);
    document.getElementById('poOpen').textContent = pos.open || 0;
    document.getElementById('poBilled').textContent = formatCurrency(pos.billed_amount);

    // Draws Card
    const draws = data.draws || {};
    document.getElementById('drawCount').textContent = draws.count || 0;
    document.getElementById('drawTotal').textContent = formatCurrency(draws.total_amount);
    document.getElementById('drawFunded').textContent = formatCurrency(draws.funded_amount);
    document.getElementById('drawDraft').textContent = draws.draft || 0;

    // Milestones Card
    const milestones = data.milestones || {};
    const milestoneTotal = milestones.count || 0;
    const milestoneCompleted = milestones.completed || 0;
    const milestonePercent = milestoneTotal > 0 ? Math.round((milestoneCompleted / milestoneTotal) * 100) : 0;

    document.getElementById('milestoneCount').textContent = milestoneTotal;
    document.getElementById('milestoneCompleted').textContent = milestoneCompleted;
    document.getElementById('milestoneInProgress').textContent = milestones.in_progress || 0;
    document.getElementById('milestoneOverdue').textContent = milestones.overdue || 0;
    document.getElementById('milestoneProgress').style.width = `${milestonePercent}%`;
    document.getElementById('milestonePercent').textContent = `${milestonePercent}%`;

    // Contracts Card
    const contracts = data.contracts || {};
    document.getElementById('contractCount').textContent = contracts.count || 0;
    document.getElementById('contractTotal').textContent = formatCurrency(contracts.total_value);
    document.getElementById('contractPending').textContent = contracts.pending_signature || 0;
    document.getElementById('contractActive').textContent = contracts.active || 0;

    // Punch List Card
    const punch = data.punch_list || {};
    const punchTotal = punch.count || 0;
    const punchCompleted = punch.completed || 0;
    const punchOpen = punchTotal - punchCompleted;
    const punchPercent = punchTotal > 0 ? Math.round((punchCompleted / punchTotal) * 100) : 0;

    document.getElementById('punchCount').textContent = punchTotal;
    document.getElementById('punchCompleted').textContent = punchCompleted;
    document.getElementById('punchOpen').textContent = punchOpen;
    document.getElementById('punchProgress').style.width = `${punchPercent}%`;
    document.getElementById('punchPercent').textContent = `${punchPercent}%`;

    // Warranties Card
    const warranties = data.warranties || {};
    document.getElementById('warrantyCount').textContent = warranties.count || 0;
    document.getElementById('warrantyActive').textContent = warranties.active || 0;
    document.getElementById('warrantyExpiring').textContent = warranties.expiring_soon || 0;

    // Contacts Card
    const contacts = data.contacts || [];
    const contactList = document.getElementById('contactList');
    if (contacts.length > 0) {
      contactList.innerHTML = contacts.slice(0, 5).map(contact => `
        <li class="hub-list-item">
          <span class="hub-list-item-name">${contact.name || 'Unknown'}</span>
          <span class="hub-list-item-status">${contact.role || contact.type || ''}</span>
        </li>
      `).join('');
      if (contacts.length > 5) {
        contactList.innerHTML += `<li class="hub-list-item"><span class="hub-stat-label">+${contacts.length - 5} more</span></li>`;
      }
    } else {
      contactList.innerHTML = '<li class="hub-empty">No contacts linked</li>';
    }

    // Activity Card
    const activity = data.activity || [];
    const activityList = document.getElementById('activityList');
    if (activity.length > 0) {
      activityList.innerHTML = activity.slice(0, 5).map(item => `
        <div class="hub-activity-item">
          <div class="hub-activity-text">${item.description || item.action || 'Activity'}</div>
          <div class="hub-activity-time">${formatRelativeTime(item.created_at)}</div>
        </div>
      `).join('');
    } else {
      activityList.innerHTML = '<div class="hub-empty">No recent activity</div>';
    }
  }

  // Initialize
  function init() {
    loadJobs();

    // Job selector change
    document.getElementById('jobSelect').addEventListener('change', (e) => {
      loadJobHub(e.target.value);
    });
  }

  // Auto-init when DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

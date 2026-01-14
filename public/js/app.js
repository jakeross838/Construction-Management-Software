// ============================================================
// STATE
// ============================================================

let state = {
  jobs: [],
  invoices: [],
  vendors: [],
  costCodes: [],
  currentInvoiceId: null,
  currentJobFilter: '',
  currentStatusFilter: 'approval', // Default to needs approval
  searchQuery: ''
};

// ============================================================
// INITIALIZATION
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  loadJobs();
  loadVendors();
  loadCostCodes();
  loadInvoices();
  setupFilterButtons();
  setupFileUpload();
  setupInvoiceSearch();

  // Old upload modal element - removed (now using universal upload)
  // document.getElementById('uploadInvoiceDate').value = new Date().toISOString().split('T')[0];

  // Sidebar integration - listen for job selection changes
  if (window.JobSidebar) {
    window.JobSidebar.onJobChange((jobId) => {
      state.currentJobFilter = jobId;
      renderInvoiceList();
    });
  }
});

// ============================================================
// DATA LOADING
// ============================================================

async function loadJobs() {
  try {
    const res = await fetch('/api/jobs');
    state.jobs = await res.json();

    // Initialize upload modal job picker
    const uploadJobContainer = document.getElementById('upload-job-picker-container');
    if (uploadJobContainer && window.SearchablePicker) {
      window.SearchablePicker.init(uploadJobContainer, {
        type: 'jobs',
        placeholder: 'Search jobs...',
        onChange: (jobId) => {
          document.getElementById('uploadJobId').value = jobId || '';
        }
      });
    }
  } catch (err) {
    console.error('Failed to load jobs:', err);
  }
}

async function loadVendors() {
  try {
    const res = await fetch('/api/vendors');
    state.vendors = await res.json();

    // Initialize upload modal vendor picker
    const uploadVendorContainer = document.getElementById('upload-vendor-picker-container');
    if (uploadVendorContainer && window.SearchablePicker) {
      window.SearchablePicker.init(uploadVendorContainer, {
        type: 'vendors',
        placeholder: 'Search vendors...',
        onChange: (vendorId) => {
          document.getElementById('uploadVendorId').value = vendorId || '';
        }
      });
    }
  } catch (err) {
    console.error('Failed to load vendors:', err);
  }
}

async function loadCostCodes() {
  try {
    const res = await fetch('/api/cost-codes');
    state.costCodes = await res.json();
  } catch (err) {
    console.error('Failed to load cost codes:', err);
  }
}

async function loadInvoices() {
  try {
    const res = await fetch('/api/invoices');
    const invoices = await res.json();
    // Transform draw_invoices to draw for easier access
    state.invoices = invoices.map(inv => ({
      ...inv,
      draw: inv.draw_invoices?.[0]?.draw || null
    }));
    renderInvoiceList();

    // Check for openInvoice query parameter (from PO modal linking)
    const urlParams = new URLSearchParams(window.location.search);
    const openInvoiceId = urlParams.get('openInvoice');
    if (openInvoiceId) {
      // Clear the URL parameter without reloading
      window.history.replaceState({}, '', window.location.pathname);
      // Open the invoice modal after DOM is ready
      setTimeout(async () => {
        try {
          const success = await openEditModal(openInvoiceId);
          if (!success) {
            window.toasts?.error('Could not open invoice', { details: 'Invoice may not exist or is locked' });
          }
        } catch (err) {
          console.error('Failed to open linked invoice:', err);
          window.toasts?.error('Failed to open invoice');
        }
      }, 300);
    }
  } catch (err) {
    console.error('Failed to load invoices:', err);
  }
}

// ============================================================
// INVOICE LIST
// ============================================================

function renderInvoiceList() {
  const container = document.getElementById('invoiceList');

  let filtered = state.invoices;

  // Status filter
  if (state.currentStatusFilter === 'archive') {
    // Archive = paid only
    filtered = filtered.filter(inv => inv.status === 'paid');
  } else if (state.currentStatusFilter === 'approval') {
    // "Invoicing" tab includes received, needs_approval, approved, and denied
    // Sort: needs_approval first, then denied, then received, then approved
    filtered = filtered.filter(inv =>
      inv.status === 'received' || inv.status === 'needs_approval' || inv.status === 'approved' || inv.status === 'denied'
    );
    const statusOrder = { 'needs_approval': 0, 'denied': 1, 'received': 2, 'approved': 3 };
    filtered.sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);
  } else {
    // Specific status
    filtered = filtered.filter(inv => inv.status === state.currentStatusFilter);
  }

  // Job filter
  if (state.currentJobFilter) {
    filtered = filtered.filter(inv => inv.job_id === state.currentJobFilter);
  }

  // Search filter
  if (state.searchQuery) {
    const q = state.searchQuery.toLowerCase();
    filtered = filtered.filter(inv =>
      (inv.invoice_number || '').toLowerCase().includes(q) ||
      (inv.vendor?.name || '').toLowerCase().includes(q) ||
      (inv.job?.name || '').toLowerCase().includes(q) ||
      (inv.po?.po_number || '').toLowerCase().includes(q) ||
      (inv.amount?.toString() || '').includes(q) ||
      (inv.notes || '').toLowerCase().includes(q)
    );
  }

  if (filtered.length === 0) {
    const msg = state.currentStatusFilter === 'archive'
      ? 'No archived invoices'
      : 'No invoices found';
    container.innerHTML = `<div class="empty-state">${msg}</div>`;
    return;
  }

  // For the Invoicing tab, render with group headers
  if (state.currentStatusFilter === 'approval') {
    const groups = {
      needs_approval: filtered.filter(inv => inv.status === 'needs_approval'),
      denied: filtered.filter(inv => inv.status === 'denied'),
      received: filtered.filter(inv => inv.status === 'received'),
      approved: filtered.filter(inv => inv.status === 'approved')
    };

    let html = '';

    // Handle "received" status invoices
    if (groups.received.length > 0) {
      // Split into matched (has job_id) and unmatched (no job_id)
      const unmatchedInvoices = groups.received.filter(inv => !inv.job_id);
      const matchedInvoices = groups.received.filter(inv => inv.job_id);

      // Unassigned: Invoices with no job (only in All Jobs view)
      if (!state.currentJobFilter && unmatchedInvoices.length > 0) {
        html += `<div class="invoice-group-header unassigned-header">
          <span>Unassigned</span>
        </div>`;
        html += unmatchedInvoices.map(inv => renderInvoiceCard(inv)).join('');
      }

      // Needs Review: AI-matched invoices needing verification (shows in both views)
      if (matchedInvoices.length > 0) {
        html += `<div class="invoice-group-header needs-review-header">
          <span>Needs Review</span>
        </div>`;
        html += matchedInvoices.map(inv => renderInvoiceCard(inv)).join('');
      }
    }

    if (groups.needs_approval.length > 0) {
      html += '<div class="invoice-group-header">Ready for Approval</div>';
      html += groups.needs_approval.map(inv => renderInvoiceCard(inv)).join('');
    }

    if (groups.denied.length > 0) {
      html += '<div class="invoice-group-header denied-header">Denied - Needs Correction</div>';
      html += groups.denied.map(inv => renderInvoiceCard(inv)).join('');
    }

    if (groups.approved.length > 0) {
      html += `<div class="invoice-group-header approved-header"><span>Approved - Ready for Draw</span></div>`;
      html += groups.approved.map(inv => renderInvoiceCard(inv)).join('');
    }

    container.innerHTML = html;
    return;
  }

  container.innerHTML = filtered.map(inv => renderInvoiceCard(inv)).join('');
}

function renderInvoiceCard(inv) {
    // Draw badge for invoices in a draw
    let drawBadge = '';
    if (inv.status === 'in_draw' && inv.draw) {
      drawBadge = `<span class="draw-badge" title="In Draw #${inv.draw.draw_number}">Draw #${inv.draw.draw_number}</span>`;
    } else if (inv.status === 'in_draw') {
      drawBadge = `<span class="draw-badge">In Draw</span>`;
    }

    // Build PO info - show linked PO or "No PO" warning
    let poInfo = '';
    if (inv.po) {
      poInfo = `<span class="po-badge" title="PO #${inv.po.po_number}">${inv.po.po_number}</span>`;
    } else {
      poInfo = `<span class="po-badge no-po" title="No Purchase Order linked">No PO</span>`;
    }

    // Calculate allocation info
    const totalAllocated = (inv.allocations || []).reduce((sum, a) => sum + parseFloat(a.amount || 0), 0);
    const invoiceAmount = parseFloat(inv.amount || 0);
    const allocationPct = invoiceAmount > 0 ? Math.round((totalAllocated / invoiceAmount) * 100) : 0;
    const isPartialAlloc = totalAllocated > 0 && totalAllocated < invoiceAmount - 0.01;

    // Calculate payment info
    const paidAmount = parseFloat(inv.paid_amount || 0);
    const remainingAmount = invoiceAmount - paidAmount;
    const hasPartialPayment = paidAmount > 0 && remainingAmount > 0.01;
    const isClosedOut = !!inv.closed_out_at;

    // Calculate billing info (for partial billing cycle)
    const billedAmount = parseFloat(inv.billed_amount || 0);
    const remainingToBill = invoiceAmount - billedAmount;
    const hasPartialBilling = billedAmount > 0 && remainingToBill > 0.01;
    const billedPct = invoiceAmount > 0 ? Math.round((billedAmount / invoiceAmount) * 100) : 0;

    // Build status badges
    let allocationInfo = '';
    let displayAmount = invoiceAmount;
    let amountSubtext = '';

    // Priority 1: Show payment status for partially paid invoices
    if (hasPartialPayment && !isClosedOut) {
      const paidPct = invoiceAmount > 0 ? Math.round((paidAmount / invoiceAmount) * 100) : 0;
      allocationInfo = `<span class="payment-badge partial" title="Partially paid - ${formatMoney(remainingAmount)} remaining">Paid: ${formatMoney(paidAmount)} / ${formatMoney(invoiceAmount)} (${paidPct}%) - ${formatMoney(remainingAmount)} remaining</span>`;
    }
    // Priority 2: Show closed-out status
    else if (isClosedOut) {
      allocationInfo = `<span class="payment-badge closed-out" title="Closed out: ${inv.closed_out_reason || 'N/A'}">Closed Out - ${formatMoney(inv.write_off_amount || 0)} written off</span>`;
    }
    // Priority 3: Show partially billed invoices that cycled back for remaining
    else if (hasPartialBilling && inv.status === 'needs_approval') {
      displayAmount = remainingToBill;
      amountSubtext = `<div class="amount-subtext">remaining of ${formatMoney(invoiceAmount)}</div>`;
      allocationInfo = `<span class="billing-badge partial" title="${formatMoney(billedAmount)} already billed (${billedPct}%)">${formatMoney(remainingToBill)} to bill</span>`;
    }
    // Priority 4: For approved/in_draw with partial allocation - show allocated amount prominently
    else if (['approved', 'in_draw'].includes(inv.status) && isPartialAlloc) {
      displayAmount = totalAllocated;
      amountSubtext = `<div class="amount-subtext">of ${formatMoney(invoiceAmount)}</div>`;
      allocationInfo = `<span class="allocation-badge partial" title="${formatMoney(invoiceAmount - totalAllocated)} remaining">${formatMoney(totalAllocated)} / ${formatMoney(invoiceAmount)} (${allocationPct}%)</span>`;
    }
    // Priority 5: Show allocation info for needs_approval status or full allocations
    else if (['needs_approval', 'approved', 'in_draw'].includes(inv.status) && totalAllocated > 0) {
      const allocClass = isPartialAlloc ? 'partial' : 'full';
      allocationInfo = `<span class="allocation-badge ${allocClass}" title="Allocated: ${formatMoney(totalAllocated)} of ${formatMoney(invoiceAmount)}">${formatMoney(totalAllocated)} / ${formatMoney(invoiceAmount)} (${allocationPct}%)</span>`;
    }

    // Paid to Vendor badge
    let paidToVendorBadge = '';
    if (inv.paid_to_vendor) {
      const paidDate = inv.paid_to_vendor_date ? formatDate(inv.paid_to_vendor_date) : '';
      const paidRef = inv.paid_to_vendor_ref ? ` - ${inv.paid_to_vendor_ref}` : '';
      paidToVendorBadge = `<span class="paid-vendor-badge" title="Paid to vendor${paidDate ? ' on ' + paidDate : ''}${paidRef}">✓ Paid to Vendor</span>`;
    }

    return `
    <div class="invoice-card status-${inv.status}" onclick="openEditModal('${inv.id}')">
      <div class="invoice-main">
        <div class="invoice-vendor">${inv.vendor?.name || 'Unknown Vendor'}</div>
        <div class="invoice-meta">
          <span>${inv.job?.name || 'No Job'}</span>
          <span>#${inv.invoice_number || 'N/A'}</span>
          <span>${formatDate(inv.invoice_date)}</span>
          ${poInfo}
          ${allocationInfo}
          ${drawBadge}
          ${paidToVendorBadge}
        </div>
      </div>
      <div class="invoice-amount">${formatMoney(displayAmount)}${amountSubtext}</div>
      <div class="invoice-status">
        <span class="status-pill ${inv.status}">${formatStatus(inv.status, inv)}</span>
      </div>
    </div>
    `;
}

// ============================================================
// FILTERS
// ============================================================

function setupInvoiceSearch() {
  const input = document.getElementById('invoiceSearchInput');
  const clearBtn = document.getElementById('invoiceSearchClear');
  let debounceTimer;

  if (!input) return;

  input.addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      state.searchQuery = e.target.value;
      clearBtn.style.display = state.searchQuery ? 'block' : 'none';
      renderInvoiceList();
    }, 300);
  });
}

function clearInvoiceSearch() {
  const input = document.getElementById('invoiceSearchInput');
  const clearBtn = document.getElementById('invoiceSearchClear');
  if (input) input.value = '';
  state.searchQuery = '';
  clearBtn.style.display = 'none';
  renderInvoiceList();
}

function setupFilterButtons() {
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.currentStatusFilter = btn.dataset.status;
      renderInvoiceList();
    });
  });
}

// ============================================================
// INVOICE DETAIL MODAL
// ============================================================

async function showInvoiceDetail(invoiceId) {
  state.currentInvoiceId = invoiceId;

  try {
    const [invoiceRes, activityRes, contextRes] = await Promise.all([
      fetch(`/api/invoices/${invoiceId}`),
      fetch(`/api/invoices/${invoiceId}/activity`),
      fetch(`/api/invoices/${invoiceId}/approval-context`)
    ]);

    const invoice = await invoiceRes.json();
    const activity = await activityRes.json();
    const approvalContext = await contextRes.json();

    renderInvoiceModal(invoice, activity, approvalContext);
    showModal('invoiceModal');
  } catch (err) {
    console.error('Failed to load invoice:', err);
  }
}

function renderInvoiceModal(invoice, activity, approvalContext = {}) {
  const pdfContainer = document.getElementById('pdfViewerContainer');
  const infoPanel = document.getElementById('invoiceInfoPanel');
  const footer = document.getElementById('invoiceModalFooter');

  // PDF Viewer - show original for needs_approval/received, stamped for approved+
  if (invoice.pdf_url || invoice.pdf_stamped_url) {
    const showOriginal = ['needs_approval', 'received'].includes(invoice.status);
    const pdfUrl = showOriginal ? invoice.pdf_url : (invoice.pdf_stamped_url || invoice.pdf_url);
    pdfContainer.innerHTML = `<iframe src="${pdfUrl}"></iframe>`;
  } else {
    pdfContainer.innerHTML = `
      <div class="pdf-placeholder">
        <div class="pdf-icon">PDF</div>
        <p>No PDF attached</p>
      </div>
    `;
  }

  // Build Budget Impact section - Before/After approval view
  let budgetSection = '';
  if (approvalContext.budget?.length > 0) {
    const hasOverBudget = approvalContext.budget.some(b => b.over_budget);
    budgetSection = `
    <div class="detail-section approval-impact-section">
      <h4>Budget Impact ${hasOverBudget ? '<span class="warning-badge">OVER BUDGET</span>' : ''}</h4>
      ${approvalContext.budget.map(b => {
        const beforePercent = b.budgeted > 0 ? Math.round((b.previously_billed / b.budgeted) * 100) : 0;
        const afterPercent = b.budgeted > 0 ? Math.round((b.after_approval / b.budgeted) * 100) : 0;
        return `
        <div class="impact-card ${b.over_budget ? 'over-budget' : ''}">
          <div class="impact-header">
            <span class="impact-code">${b.cost_code?.code || ''}</span>
            <span class="impact-name">${b.cost_code?.name || 'Unknown'}</span>
          </div>
          <div class="impact-comparison">
            <div class="impact-before">
              <div class="impact-label">Before Approval</div>
              <div class="impact-amount">${formatMoney(b.previously_billed)}</div>
              <div class="impact-bar">
                <div class="impact-bar-fill" style="width: ${Math.min(beforePercent, 100)}%"></div>
              </div>
              <div class="impact-percent">${beforePercent}% of ${b.budgeted > 0 ? formatMoney(b.budgeted) : 'no budget'}</div>
            </div>
            <div class="impact-arrow">
              <span class="arrow-add">+${formatMoney(b.this_invoice)}</span>
              →
            </div>
            <div class="impact-after ${b.over_budget ? 'warning' : ''}">
              <div class="impact-label">After Approval</div>
              <div class="impact-amount">${formatMoney(b.after_approval)}</div>
              <div class="impact-bar">
                <div class="impact-bar-fill ${afterPercent > 100 ? 'over' : ''}" style="width: ${Math.min(afterPercent, 100)}%"></div>
              </div>
              <div class="impact-percent ${b.over_budget ? 'warning-text' : ''}">${afterPercent}% ${b.remaining >= 0 ? `(${formatMoney(b.remaining)} left)` : `(${formatMoney(Math.abs(b.remaining))} over!)`}</div>
            </div>
          </div>
        </div>
      `}).join('')}
    </div>
    `;
  }

  // Build PO Impact section - Before/After approval view
  let poSection = '';
  if (approvalContext.po) {
    const po = approvalContext.po;
    const beforePercent = po.total_amount > 0 ? Math.round((po.previously_billed / po.total_amount) * 100) : 0;
    poSection = `
    <div class="detail-section approval-impact-section">
      <h4>PO Impact ${po.over_po ? '<span class="warning-badge">OVER PO</span>' : ''}</h4>
      <div class="impact-card ${po.over_po ? 'over-budget' : ''}">
        <div class="impact-header">
          <span class="impact-code">${po.po_number}</span>
          <span class="impact-status">${po.po_status}</span>
        </div>
        <div class="impact-comparison">
          <div class="impact-before">
            <div class="impact-label">Before Approval</div>
            <div class="impact-amount">${formatMoney(po.previously_billed)}</div>
            <div class="impact-bar">
              <div class="impact-bar-fill" style="width: ${Math.min(beforePercent, 100)}%"></div>
            </div>
            <div class="impact-percent">${beforePercent}% of ${formatMoney(po.total_amount)}</div>
          </div>
          <div class="impact-arrow">
            <span class="arrow-add">+${formatMoney(po.this_invoice)}</span>
            →
          </div>
          <div class="impact-after ${po.over_po ? 'warning' : ''}">
            <div class="impact-label">After Approval</div>
            <div class="impact-amount">${formatMoney(po.after_approval)}</div>
            <div class="impact-bar">
              <div class="impact-bar-fill ${po.percent_used > 100 ? 'over' : ''}" style="width: ${Math.min(po.percent_used, 100)}%"></div>
            </div>
            <div class="impact-percent ${po.over_po ? 'warning-text' : ''}">${po.percent_used}% ${po.remaining >= 0 ? `(${formatMoney(po.remaining)} left)` : `(${formatMoney(Math.abs(po.remaining))} over!)`}</div>
          </div>
        </div>
      </div>
    </div>
    `;
  }

  // Info Panel
  infoPanel.innerHTML = `
    <div class="detail-section">
      <h4>Vendor</h4>
      <div class="detail-value">${invoice.vendor?.name || 'Unknown'}</div>
    </div>

    <div class="detail-section">
      <h4>Amount</h4>
      <div class="detail-value large">${formatMoney(invoice.amount)}</div>
    </div>

    <div class="detail-section">
      <div class="detail-row">
        <span class="detail-label">Invoice #</span>
        <span>${invoice.invoice_number || 'N/A'}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Date</span>
        <span>${formatDate(invoice.invoice_date)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Job</span>
        <span>${invoice.job?.name || 'Unknown'}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Status</span>
        <span class="status-pill ${invoice.status}">${formatStatus(invoice.status, invoice)}</span>
      </div>
    </div>

    ${budgetSection}

    ${poSection}

    ${invoice.allocations?.length > 0 && !approvalContext.budget?.length ? `
    <div class="detail-section">
      <h4>Cost Codes</h4>
      ${invoice.allocations.map(a => `
        <div class="detail-row">
          <span class="detail-label">${a.cost_code?.code} ${a.cost_code?.name}</span>
          <span>${formatMoney(a.amount)}</span>
        </div>
      `).join('')}
    </div>
    ` : ''}

    ${activity?.length > 0 ? `
    <div class="detail-section">
      <h4>Activity</h4>
      <div class="activity-list">
        ${activity.slice(0, 5).map(a => `
          <div class="activity-item">
            <div class="activity-dot"></div>
            <div>
              <div class="activity-text">${formatAction(a.action)}${a.performed_by ? ` by ${a.performed_by}` : ''}</div>
              <div class="activity-time">${formatDateTime(a.created_at)}</div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
    ` : ''}
  `;

  // Footer buttons - based on status
  const canEdit = ['received', 'needs_approval', 'approved'].includes(invoice.status);
  const canApprove = invoice.status === 'needs_approval';
  const canDelete = ['received', 'needs_approval'].includes(invoice.status);
  const canMarkPaid = ['approved', 'in_draw'].includes(invoice.status) && !invoice.paid_to_vendor;
  const canUnmarkPaid = invoice.paid_to_vendor;

  let buttons = [`<button class="btn btn-secondary" onclick="closeModal('invoiceModal')">Close</button>`];

  if (canEdit) {
    buttons.push(`<button class="btn btn-primary" onclick="openEditModal('${invoice.id}')">Edit</button>`);
  }

  if (canDelete) {
    buttons.push(`<button class="btn btn-danger" onclick="quickDelete('${invoice.id}')">Delete</button>`);
  }

  if (canApprove) {
    buttons.push(`<button class="btn btn-success" onclick="approveInvoice('${invoice.id}')">Approve</button>`);
  }

  if (canMarkPaid) {
    buttons.push(`<button class="btn btn-success" onclick="showPaymentModal('${invoice.id}', ${invoice.amount || 0})">Mark Paid to Vendor</button>`);
  }

  if (canUnmarkPaid) {
    buttons.push(`<button class="btn btn-outline-warning" onclick="unmarkPaid('${invoice.id}')">Unmark Paid</button>`);
  }

  footer.innerHTML = buttons.join('');

  document.getElementById('invoiceModalTitle').textContent = invoice.vendor?.name || 'Invoice';
}

// ============================================================
// EDIT MODAL
// ============================================================

async function openEditModal(invoiceId) {
  // Close the view modal if it's open
  const viewModal = document.getElementById('invoiceModal');
  if (viewModal?.classList.contains('show')) {
    closeModal('invoiceModal');
  }

  // Open the edit modal from Modals module
  const success = await Modals.showEditModal(invoiceId, {
    onSave: () => {
      loadInvoices(); // Refresh list after save
    },
    onClose: () => {
      // Stay on list view
    }
  });

  if (!success) {
    // If edit modal failed to open (e.g., locked), show error
    window.toasts?.error('Cannot edit invoice', { details: 'Invoice may be locked by another user' });
  }
}

// ============================================================
// APPROVAL
// ============================================================

async function approveInvoice(invoiceId) {
  if (!confirm('Approve this invoice?')) return;

  try {
    const res = await fetch(`/api/invoices/${invoiceId}/approve`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approved_by: 'Jake Ross' })
    });

    if (!res.ok) throw new Error('Approval failed');

    closeModal('invoiceModal');
    loadInvoices();
  } catch (err) {
    console.error('Failed to approve:', err);
    alert('Failed to approve invoice');
  }
}

// ============================================================
// PAYMENT TRACKING
// ============================================================

function showPaymentModal(invoiceId, amount) {
  document.getElementById('paymentInvoiceId').value = invoiceId;
  document.getElementById('paymentMethod').value = '';
  document.getElementById('paymentReference').value = '';
  document.getElementById('paymentDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('paymentAmount').value = '';
  document.getElementById('paymentAmount').placeholder = `Leave blank for full amount (${formatMoney(amount)})`;

  showModal('paymentModal');
}

async function confirmMarkPaid() {
  const invoiceId = document.getElementById('paymentInvoiceId').value;
  const paymentMethod = document.getElementById('paymentMethod').value;
  const paymentReference = document.getElementById('paymentReference').value;
  const paymentDate = document.getElementById('paymentDate').value;
  const paymentAmount = document.getElementById('paymentAmount').value;

  if (!paymentMethod) {
    alert('Please select a payment method');
    return;
  }

  try {
    const body = {
      payment_method: paymentMethod,
      payment_reference: paymentReference || null,
      payment_date: paymentDate || null
    };

    if (paymentAmount) {
      body.payment_amount = parseFloat(paymentAmount);
    }

    const res = await fetch(`/api/invoices/${invoiceId}/pay`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to mark as paid');
    }

    closeModal('paymentModal');
    closeModal('invoiceModal');
    loadInvoices();
    window.toasts?.success('Invoice marked as paid to vendor');
  } catch (err) {
    console.error('Failed to mark as paid:', err);
    alert(err.message || 'Failed to mark invoice as paid');
  }
}

async function unmarkPaid(invoiceId) {
  if (!confirm('Remove payment status from this invoice?')) return;

  try {
    const res = await fetch(`/api/invoices/${invoiceId}/unpay`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to unmark as paid');
    }

    closeModal('invoiceModal');
    loadInvoices();
    window.toasts?.success('Payment status removed');
  } catch (err) {
    console.error('Failed to unmark as paid:', err);
    alert(err.message || 'Failed to unmark invoice as paid');
  }
}

// ============================================================
// AI PROCESSING OVERLAY
// ============================================================

const AIProcessingUI = {
  overlay: null,
  steps: ['extract', 'analyze', 'match', 'save'],
  currentStep: 0,

  show() {
    this.overlay = document.getElementById('aiProcessingOverlay');
    if (!this.overlay) return;

    this.currentStep = 0;
    this.resetSteps();
    this.updateProgress(0, 'Starting...');
    this.overlay.classList.add('show');

    // Auto-advance through initial step
    setTimeout(() => this.setStep('extract', 'active'), 300);
  },

  hide() {
    if (this.overlay) {
      this.overlay.classList.remove('show');
    }
  },

  resetSteps() {
    this.steps.forEach(step => {
      const el = this.overlay.querySelector(`[data-step="${step}"]`);
      if (el) {
        el.classList.remove('active', 'completed');
        const status = el.querySelector('.ai-step-status');
        if (status) status.textContent = this.getDefaultStatus(step);
      }
    });
  },

  getDefaultStatus(step) {
    const defaults = {
      extract: 'Reading PDF content...',
      analyze: 'Claude is reading the invoice...',
      match: 'Finding vendor & job matches...',
      save: 'Creating invoice record...'
    };
    return defaults[step] || '';
  },

  setStep(stepName, state, statusText) {
    const el = this.overlay?.querySelector(`[data-step="${stepName}"]`);
    if (!el) return;

    if (state === 'active') {
      el.classList.add('active');
      el.classList.remove('completed');
      this.currentStep = this.steps.indexOf(stepName);

      // Update progress based on step
      const progress = ((this.currentStep + 0.5) / this.steps.length) * 100;
      this.updateProgress(progress, statusText || this.getDefaultStatus(stepName));
    } else if (state === 'completed') {
      el.classList.remove('active');
      el.classList.add('completed');

      const status = el.querySelector('.ai-step-status');
      if (status) status.textContent = statusText || 'Complete';

      // Update progress
      const progress = ((this.currentStep + 1) / this.steps.length) * 100;
      this.updateProgress(progress);
    }
  },

  updateProgress(percent, text) {
    const fill = this.overlay?.querySelector('.ai-progress-fill');
    const textEl = this.overlay?.querySelector('.ai-progress-text');

    if (fill) fill.style.width = `${percent}%`;
    if (textEl && text) textEl.textContent = text;
  },

  // Simulate the AI processing steps with realistic timing
  async simulateProcessing() {
    // Step 1: Extract text
    this.setStep('extract', 'active', 'Extracting text from PDF...');
    await this.delay(800);
    this.setStep('extract', 'completed', 'Text extracted');

    // Step 2: AI Analysis
    this.setStep('analyze', 'active', 'Claude is analyzing invoice data...');
    // This step takes longer - AI processing
    await this.delay(2000);
    this.setStep('analyze', 'completed', 'Analysis complete');

    // Step 3: Match data
    this.setStep('match', 'active', 'Matching vendor and job...');
    await this.delay(1000);
    this.setStep('match', 'completed', 'Matches found');

    // Step 4: Save
    this.setStep('save', 'active', 'Saving invoice record...');
    await this.delay(600);
    this.setStep('save', 'completed', 'Saved successfully');

    this.updateProgress(100, 'Processing complete!');
  },

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  // Show error state
  showError(message) {
    const currentStepEl = this.overlay?.querySelector('.ai-step.active');
    if (currentStepEl) {
      currentStepEl.classList.remove('active');
      currentStepEl.classList.add('error');
      const status = currentStepEl.querySelector('.ai-step-status');
      if (status) status.textContent = message || 'Error occurred';
      const check = currentStepEl.querySelector('.ai-step-check');
      if (check) check.textContent = '✕';
    }
    this.updateProgress(this.currentStep * 25, 'Processing failed');
  }
};

// ============================================================
// UPLOAD (Legacy - now handled by inline script in HTML)
// ============================================================

function setupFileUpload() {
  // Old upload modal removed - upload is now handled by universal upload in HTML
  // This function is kept for compatibility but does nothing
}

function showUploadInvoiceModal() {
  // Legacy function - now use the universal upload modal via uploadBtn click
  const uploadBtn = document.getElementById('uploadBtn');
  if (uploadBtn) uploadBtn.click();
}

function toggleAIMode(useAI) {
  // Legacy function - AI mode is always on with universal upload
}

async function submitUploadInvoice() {
  // Legacy function - upload is now handled by universal upload modal
  // Redirect to new upload
  const uploadBtn = document.getElementById('uploadBtn');
  if (uploadBtn) uploadBtn.click();
  return;

  // === OLD CODE BELOW (kept for reference) ===
  const fileInput = document.getElementById('invoicePdfFile');
  if (!fileInput) return;
  const useAI = document.getElementById('useAIProcessing')?.checked !== false;

  if (!fileInput.files.length) {
    alert('Please select a PDF');
    return;
  }

  const formData = new FormData();
  formData.append('pdf', fileInput.files[0]);

  // Show processing state
  const uploadBtnOld = document.querySelector('#uploadInvoiceModal .btn-primary');
  if (!uploadBtnOld) return;
  const originalText = uploadBtnOld.textContent;
  uploadBtnOld.textContent = useAI ? 'Processing with AI...' : 'Uploading...';
  uploadBtnOld.disabled = true;

  try {
    if (useAI) {
      // Close upload modal and show AI processing overlay
      closeModal('uploadInvoiceModal');
      AIProcessingUI.show();

      // Start the API call and the animation concurrently
      const apiPromise = fetch('/api/invoices/process', {
        method: 'POST',
        body: formData
      });

      // Run animation while waiting for API
      const animationPromise = AIProcessingUI.simulateProcessing();

      // Wait for API response
      const res = await apiPromise;
      const result = await res.json();

      // Wait for animation to complete (if API was faster)
      await animationPromise;

      if (!res.ok) {
        // Handle duplicate invoice error specifically
        if (res.status === 409 && result.duplicate) {
          const dupe = result.duplicate;
          AIProcessingUI.showError('Duplicate detected');
          await AIProcessingUI.delay(1500);
          AIProcessingUI.hide();
          window.toasts?.error('Duplicate Invoice Detected', {
            details: `This appears to be a duplicate of Invoice #${dupe.invoice_number} ($${parseFloat(dupe.amount).toLocaleString()}) - Status: ${dupe.status}`,
            duration: 8000
          });
          uploadBtn.textContent = originalText;
          uploadBtn.disabled = false;
          return;
        }
        AIProcessingUI.showError('Processing failed');
        await AIProcessingUI.delay(1500);
        AIProcessingUI.hide();
        throw new Error(result.error || 'Processing failed');
      }

      // Show success state briefly
      await AIProcessingUI.delay(800);
      AIProcessingUI.hide();

      // Show success with AI results
      const processing = result.processing;
      window.toasts?.success('Invoice Processed Successfully', {
        details: processing ? `${processing.vendor?.name || 'Unknown Vendor'} - ${formatMoney(processing.extracted?.totalAmount || 0)}` : null,
        duration: 5000
      });

    } else {
      // Use basic upload - requires job selection
      const jobId = document.getElementById('uploadJobId').value;
      if (!jobId) {
        alert('Please select a job (or enable AI processing)');
        uploadBtn.textContent = originalText;
        uploadBtn.disabled = false;
        return;
      }

      formData.append('job_id', jobId);

      const vendorId = document.getElementById('uploadVendorId').value;
      const amount = document.getElementById('uploadAmount').value;
      const invoiceNumber = document.getElementById('uploadInvoiceNumber').value;
      const invoiceDate = document.getElementById('uploadInvoiceDate').value;

      if (vendorId) formData.append('vendor_id', vendorId);
      if (amount) formData.append('amount', amount);
      if (invoiceNumber) formData.append('invoice_number', invoiceNumber);
      if (invoiceDate) formData.append('invoice_date', invoiceDate);

      const res = await fetch('/api/invoices/upload', {
        method: 'POST',
        body: formData
      });

      if (!res.ok) throw new Error('Upload failed');

      closeModal('uploadInvoiceModal');
      window.toasts?.success('Invoice uploaded');
    }

    loadInvoices();
    loadVendors(); // Reload in case new vendor was created

  } catch (err) {
    console.error('Failed to upload:', err);
    AIProcessingUI.hide(); // Ensure overlay is hidden on error
    window.toasts?.error('Failed to process invoice', { details: err.message });
  } finally {
    uploadBtn.textContent = originalText;
    uploadBtn.disabled = false;
  }
}

// ============================================================
// MODAL HELPERS
// ============================================================

function showModal(id) {
  document.getElementById(id).classList.add('show');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('show');
}

// ============================================================
// FORMATTING
// ============================================================

function formatMoney(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(parseFloat(amount) || 0);
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDateTime(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
  });
}

function formatStatus(status, invoice = null) {
  // For 'received' status, label depends on whether invoice has a job
  if (status === 'received') {
    if (invoice && invoice.job_id) {
      return 'Review';  // AI-matched, needs review
    }
    return 'Unassigned';  // No job assigned
  }

  const labels = {
    needs_approval: 'Ready',
    approved: 'Approved',
    in_draw: 'In Draw',
    paid: 'Paid'
  };
  return labels[status] || status;
}

function formatAction(action) {
  const labels = {
    uploaded: 'Uploaded',
    needs_approval: 'Needs Approval',
    approved: 'Approved',
    added_to_draw: 'Added to draw',
    paid: 'Paid'
  };
  return labels[action] || action;
}

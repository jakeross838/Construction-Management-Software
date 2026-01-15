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
    // "Invoicing" tab includes needs_review, ready_for_approval, approved, and denied
    // Also support legacy statuses: received → needs_review, needs_approval → ready_for_approval
    filtered = filtered.filter(inv =>
      inv.status === 'needs_review' || inv.status === 'ready_for_approval' ||
      inv.status === 'approved' || inv.status === 'denied' ||
      inv.status === 'received' || inv.status === 'needs_approval'
    );
    // Map legacy statuses for sorting
    const statusOrder = {
      'needs_review': 0, 'received': 0,  // Legacy received = needs_review
      'ready_for_approval': 1, 'needs_approval': 1,  // Legacy needs_approval = ready_for_approval
      'denied': 2,
      'approved': 3
    };
    filtered.sort((a, b) => (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99));
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
    // Group invoices - include legacy statuses in their modern equivalents
    const groups = {
      needs_review: filtered.filter(inv => inv.status === 'needs_review' || inv.status === 'received'),
      ready_for_approval: filtered.filter(inv => inv.status === 'ready_for_approval' || inv.status === 'needs_approval'),
      denied: filtered.filter(inv => inv.status === 'denied'),
      approved: filtered.filter(inv => inv.status === 'approved')
    };

    let html = '';

    // Needs Review: Only show in "All Jobs" view - this is the accountant's queue
    if (!state.currentJobFilter && groups.needs_review.length > 0) {
      html += `<div class="invoice-group-header needs-review-header">
        <span>Needs Review</span>
      </div>`;
      html += groups.needs_review.map(inv => renderInvoiceCard(inv)).join('');
    }

    // Denied: Show in both views - needs correction
    if (groups.denied.length > 0) {
      html += '<div class="invoice-group-header denied-header">Denied - Needs Correction</div>';
      html += groups.denied.map(inv => renderInvoiceCard(inv)).join('');
    }

    // Ready for Approval: PM reviews (shows in job view)
    if (groups.ready_for_approval.length > 0) {
      html += '<div class="invoice-group-header ready-for-approval-header">Ready for Approval</div>';
      html += groups.ready_for_approval.map(inv => renderInvoiceCard(inv)).join('');
    }

    // Approved: Ready to be added to draws
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
    const invoiceAmount = parseFloat(inv.amount || 0);
    const paidAmount = parseFloat(inv.paid_amount || 0);
    const billedAmount = parseFloat(inv.billed_amount || 0);
    const isClosedOut = !!inv.closed_out_at;
    const isCredit = invoiceAmount < 0;

    // Determine display amount and any subtext for special cases
    let displayAmount = invoiceAmount;
    let amountSubtext = '';
    let amountClass = isCredit ? 'credit-amount' : '';

    // Calculate allocation total for partial approvals
    const allocations = inv.allocations || [];
    const allocatedAmount = allocations.reduce((sum, a) => sum + parseFloat(a.amount || 0), 0);
    const isPartialApproval = inv.review_flags?.includes('partial_approval');

    // For partial billing cycle - show remaining amount (after some has been billed to draws)
    const remainingToBill = invoiceAmount - billedAmount;
    const hasPartialBilling = billedAmount > 0 && remainingToBill > 0.01;
    if (hasPartialBilling && ['needs_review', 'ready_for_approval'].includes(inv.status)) {
      displayAmount = remainingToBill;
      amountSubtext = `<div class="amount-subtext">of ${formatMoney(invoiceAmount)}</div>`;
    }
    // For partial approval awaiting draw - show allocated amount
    else if (isPartialApproval && inv.status === 'approved' && allocatedAmount < invoiceAmount - 0.01) {
      displayAmount = allocatedAmount;
      amountSubtext = `<div class="amount-subtext">of ${formatMoney(invoiceAmount)} approved</div>`;
    }

    // For partial payment - show remaining
    const remainingAmount = invoiceAmount - paidAmount;
    const hasPartialPayment = paidAmount > 0 && remainingAmount > 0.01;
    if (hasPartialPayment && !isClosedOut) {
      amountSubtext = `<div class="amount-subtext">${formatMoney(paidAmount)} paid</div>`;
    }

    // Build metadata line (job, invoice#, date)
    const metaItems = [];
    metaItems.push(`<span class="meta-job">${inv.job?.name || 'No Job'}</span>`);
    metaItems.push(`<span class="meta-number">#${inv.invoice_number || 'N/A'}</span>`);
    metaItems.push(`<span class="meta-date">${formatDate(inv.invoice_date)}</span>`);

    // Draw badge - only for in_draw status
    if (inv.status === 'in_draw' && inv.draw) {
      metaItems.push(`<span class="meta-draw">Draw #${inv.draw.draw_number}</span>`);
    }

    // Closed out indicator
    if (isClosedOut) {
      metaItems.push(`<span class="meta-closed" title="Closed out: ${inv.closed_out_reason || 'N/A'}">Closed Out</span>`);
    }

    // Paid to vendor indicator
    if (inv.paid_to_vendor) {
      metaItems.push(`<span class="meta-paid-vendor" title="Paid to vendor">Paid</span>`);
    }

    // Build badges line (PO + Cost Codes)
    const badges = [];

    // PO badge
    if (inv.po) {
      badges.push(`<span class="badge badge-po" title="Linked to ${inv.po.po_number}">${inv.po.po_number}</span>`);
    } else {
      badges.push(`<span class="badge badge-no-po">No PO</span>`);
    }

    // Cost code badges
    const allocations = inv.allocations || [];
    if (allocations.length > 0) {
      const seenCodes = new Set();
      const costCodes = allocations
        .filter(a => a.cost_code && !seenCodes.has(a.cost_code.code) && seenCodes.add(a.cost_code.code))
        .map(a => ({ code: a.cost_code.code, name: a.cost_code.name }));

      if (costCodes.length > 0) {
        costCodes.forEach(cc => {
          badges.push(`<span class="badge badge-cost-code" title="${cc.code} - ${cc.name}">${cc.code} ${cc.name}</span>`);
        });
      } else {
        badges.push(`<span class="badge badge-no-cost-code">No Cost Codes</span>`);
      }
    } else {
      badges.push(`<span class="badge badge-no-cost-code">No Cost Codes</span>`);
    }

    // Split badge - clear indicator
    let splitBadge = '';
    if (inv.is_split_parent) {
      splitBadge = `<span class="badge badge-split-parent" title="This invoice was split into multiple parts">Split Parent</span>`;
    } else if (inv.parent_invoice_id) {
      splitBadge = `<span class="badge badge-split-child" title="Split from parent invoice">Split</span>`;
    }

    // Credit badge for negative amounts
    const creditBadge = isCredit ? `<span class="badge badge-credit" title="Credit memo / refund">CREDIT</span>` : '';

    // Partial approval badge
    const isPartialApproval = inv.review_flags?.includes('partial_approval');
    const partialBadge = isPartialApproval ? `<span class="badge badge-partial" title="Partially allocated approval">Partial</span>` : '';

    return `
    <div class="invoice-card status-${inv.status}${isCredit ? ' is-credit' : ''}" onclick="openEditModal('${inv.id}')">
      <div class="invoice-main">
        <div class="invoice-header">
          <span class="invoice-vendor">${inv.vendor?.name || 'Unknown Vendor'}</span>
          ${creditBadge}
          ${partialBadge}
          ${splitBadge}
        </div>
        <div class="invoice-meta">${metaItems.join('<span class="meta-sep">•</span>')}</div>
        <div class="invoice-badges">${badges.join('')}</div>
      </div>
      <div class="invoice-amount ${amountClass}">${formatMoney(displayAmount)}${amountSubtext}</div>
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

  // PDF Viewer - show original for needs_review/ready_for_approval, stamped for approved+
  if (invoice.pdf_url || invoice.pdf_stamped_url) {
    const showOriginal = ['needs_review', 'ready_for_approval'].includes(invoice.status);
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
  // Locked statuses require "Unlock to Edit" button
  const lockedStatuses = ['ready_for_approval', 'approved', 'in_draw', 'paid'];
  const isLocked = lockedStatuses.includes(invoice.status);
  const canEdit = ['needs_review', 'ready_for_approval', 'approved'].includes(invoice.status);
  const canApprove = invoice.status === 'ready_for_approval';
  const canSubmitForApproval = invoice.status === 'needs_review' && invoice.job_id && invoice.vendor_id;
  const canDelete = ['needs_review', 'ready_for_approval'].includes(invoice.status);
  const canMarkPaid = ['approved', 'in_draw'].includes(invoice.status) && !invoice.paid_to_vendor;
  const canUnmarkPaid = invoice.paid_to_vendor;

  let buttons = [`<button class="btn btn-secondary" onclick="closeModal('invoiceModal')">Close</button>`];

  if (canEdit) {
    if (isLocked) {
      buttons.push(`<button class="btn btn-outline-primary" onclick="openEditModal('${invoice.id}')">🔓 Unlock to Edit</button>`);
    } else {
      buttons.push(`<button class="btn btn-primary" onclick="openEditModal('${invoice.id}')">Edit</button>`);
    }
  }

  if (canDelete) {
    buttons.push(`<button class="btn btn-danger" onclick="quickDelete('${invoice.id}')">Delete</button>`);
  }

  if (canSubmitForApproval) {
    buttons.push(`<button class="btn btn-primary" onclick="submitForApproval('${invoice.id}')">Submit for Approval</button>`);
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
  try {
    // Fetch invoice with allocations to check for CO cost codes
    const res = await fetch(`/api/invoices/${invoiceId}`);
    if (!res.ok) throw new Error('Failed to fetch invoice');
    const invoice = await res.json();

    // Check for CO cost code allocations without CO link
    const isCOCostCode = (code) => code && /C$/i.test(code.trim());
    const allocations = invoice.allocations || [];
    const unlinkedCOAllocations = allocations.filter(a => {
      const code = a.cost_code?.code;
      return code && isCOCostCode(code) && !a.change_order_id;
    });

    if (unlinkedCOAllocations.length > 0) {
      // Close view modal and open edit modal for CO linking
      closeModal('invoiceModal');
      window.toasts?.info('CO cost codes detected - please link to a Change Order');
      // Open edit modal which has full CO link functionality
      const success = await Modals.showEditModal(invoiceId, {
        onSave: () => loadInvoices(),
        onClose: () => {}
      });
      if (success) {
        // Trigger the approve flow in the edit modal
        setTimeout(() => {
          if (window.Modals?.approveInvoice) {
            window.Modals.approveInvoice();
          }
        }, 500);
      }
      return;
    }

    // Check for partial allocation - must use modal flow for note
    const totalAllocated = allocations.reduce((sum, a) => sum + parseFloat(a.amount || 0), 0);
    const invoiceAmount = parseFloat(invoice.amount || 0);
    const isPartial = totalAllocated < invoiceAmount - 0.01;

    if (isPartial) {
      // Partial approval requires a note - must use modal flow
      closeModal('invoiceModal');
      window.toasts?.info('Partial allocation detected - a note is required');
      const success = await Modals.showEditModal(invoiceId, {
        onSave: () => loadInvoices(),
        onClose: () => {}
      });
      if (success) {
        // Trigger the approve flow in the edit modal (which handles partial)
        setTimeout(() => {
          if (window.Modals?.approveInvoice) {
            window.Modals.approveInvoice();
          }
        }, 500);
      }
      return;
    }

    // Full allocation, no CO issues - proceed with simple approval
    if (!confirm('Approve this invoice?')) return;

    const approveRes = await fetch(`/api/invoices/${invoiceId}/approve`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approved_by: 'Jake Ross' })
    });

    if (!approveRes.ok) throw new Error('Approval failed');

    closeModal('invoiceModal');
    loadInvoices();
    window.toasts?.success('Invoice approved');
  } catch (err) {
    console.error('Failed to approve:', err);
    alert('Failed to approve invoice');
  }
}

// Submit invoice for PM approval (needs_review -> ready_for_approval)
async function submitForApproval(invoiceId) {
  if (!confirm('Submit this invoice for PM approval?')) return;

  try {
    const res = await fetch(`/api/invoices/${invoiceId}/transition`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        new_status: 'ready_for_approval',
        performed_by: 'Accountant'
      })
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.message || 'Submit failed');
    }

    closeModal('invoiceModal');
    loadInvoices();
    window.toasts?.success('Invoice submitted for approval');
  } catch (err) {
    console.error('Failed to submit for approval:', err);
    alert('Failed to submit invoice: ' + err.message);
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
  // Legacy function - upload is now handled by universal upload modal in index.html
  // Just redirect to new upload button
  const uploadBtn = document.getElementById('uploadBtn');
  if (uploadBtn) uploadBtn.click();
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
  // For 'needs_review' or legacy 'received' status, label depends on whether invoice has a job
  if (status === 'needs_review' || status === 'received') {
    if (invoice && invoice.job_id) {
      return 'Needs Review';  // AI-matched, needs accountant review
    }
    return 'Unassigned';  // No job assigned
  }

  const labels = {
    ready_for_approval: 'Ready for Approval',
    needs_approval: 'Ready for Approval',  // Legacy
    approved: 'Approved',
    in_draw: 'In Draw',
    paid: 'Paid',
    denied: 'Denied',
    split: 'Split'  // Parent invoice that was split
  };
  return labels[status] || status;
}

function formatAction(action) {
  const labels = {
    uploaded: 'Uploaded',
    needs_review: 'Needs Review',
    ready_for_approval: 'Ready for Approval',
    needs_approval: 'Ready for Approval', // Legacy
    approved: 'Approved',
    added_to_draw: 'Added to draw',
    removed_from_draw: 'Removed from draw',
    denied: 'Denied',
    paid: 'Paid'
  };
  return labels[action] || action;
}

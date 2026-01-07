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
  currentStatusFilter: 'coded' // Default to needs approval
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

  document.getElementById('uploadInvoiceDate').value = new Date().toISOString().split('T')[0];
});

// ============================================================
// DATA LOADING
// ============================================================

async function loadJobs() {
  try {
    const res = await fetch('/api/jobs');
    state.jobs = await res.json();

    const select = document.getElementById('jobFilter');
    select.innerHTML = '<option value="">All Jobs</option>';
    state.jobs.forEach(job => {
      select.innerHTML += `<option value="${job.id}">${job.name}</option>`;
    });

    select.addEventListener('change', (e) => {
      state.currentJobFilter = e.target.value;
      renderInvoiceList();
    });

    // Also populate upload modal
    const uploadSelect = document.getElementById('uploadJobId');
    uploadSelect.innerHTML = '<option value="">Select job...</option>';
    state.jobs.forEach(job => {
      uploadSelect.innerHTML += `<option value="${job.id}">${job.name}</option>`;
    });
  } catch (err) {
    console.error('Failed to load jobs:', err);
  }
}

async function loadVendors() {
  try {
    const res = await fetch('/api/vendors');
    state.vendors = await res.json();

    const select = document.getElementById('uploadVendorId');
    select.innerHTML = '<option value="">Select vendor...</option>';
    state.vendors.forEach(v => {
      select.innerHTML += `<option value="${v.id}">${v.name}</option>`;
    });
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
    state.invoices = await res.json();
    renderInvoiceList();
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
  } else if (state.currentStatusFilter === 'coded') {
    // "Needs Approval" includes both new (received) and coded invoices
    filtered = filtered.filter(inv => inv.status === 'received' || inv.status === 'coded');
  } else {
    // Specific status
    filtered = filtered.filter(inv => inv.status === state.currentStatusFilter);
  }

  // Job filter
  if (state.currentJobFilter) {
    filtered = filtered.filter(inv => inv.job_id === state.currentJobFilter);
  }

  if (filtered.length === 0) {
    const msg = state.currentStatusFilter === 'archive'
      ? 'No archived invoices'
      : 'No invoices found';
    container.innerHTML = `<div class="empty-state">${msg}</div>`;
    return;
  }

  container.innerHTML = filtered.map(inv => {
    // Build PO info if linked
    let poInfo = '';
    if (inv.po) {
      const poRemaining = inv.po.remaining ?? inv.po.total_amount;
      const poClass = poRemaining < inv.amount ? 'po-low' : '';
      poInfo = `<span class="po-badge ${poClass}" title="PO #${inv.po.po_number} - Remaining: ${formatMoney(poRemaining)}">PO: ${formatMoney(poRemaining)} left</span>`;
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
        </div>
      </div>
      <div class="invoice-amount">${formatMoney(inv.amount)}</div>
      <div class="invoice-status">
        <span class="status-pill ${inv.status}">${formatStatus(inv.status)}</span>
      </div>
      ${buildQuickActions(inv)}
    </div>
    `;
  }).join('');
}

// ============================================================
// QUICK ACTIONS
// ============================================================

function buildQuickActions(inv) {
  const actions = [];

  switch (inv.status) {
    case 'received':
      actions.push(`<button class="quick-btn quick-approve" onclick="event.stopPropagation(); quickCode('${inv.id}')" title="Code">Code</button>`);
      actions.push(`<button class="quick-btn quick-delete" onclick="event.stopPropagation(); quickDelete('${inv.id}')" title="Delete">Delete</button>`);
      break;
    case 'coded':
      actions.push(`<button class="quick-btn quick-approve" onclick="event.stopPropagation(); quickApprove('${inv.id}')" title="Approve">Approve</button>`);
      actions.push(`<button class="quick-btn quick-delete" onclick="event.stopPropagation(); quickDelete('${inv.id}')" title="Delete">Delete</button>`);
      break;
    case 'approved':
      actions.push(`<button class="quick-btn quick-approve" onclick="event.stopPropagation(); quickAddToDraw('${inv.id}')" title="Add to Draw">Add to Draw</button>`);
      break;
  }

  if (actions.length === 0) return '';

  return `<div class="quick-actions">${actions.join('')}</div>`;
}

async function quickCode(invoiceId) {
  // For quick code, open the edit modal - user needs to add cost codes
  openEditModal(invoiceId);
}

async function quickApprove(invoiceId) {
  if (!confirm('Approve this invoice?')) return;

  try {
    const res = await fetch(`/api/invoices/${invoiceId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'approved' })
    });

    if (!res.ok) throw new Error('Approval failed');

    window.toasts?.success('Invoice approved');
    loadInvoices();
  } catch (err) {
    console.error('Quick approve failed:', err);
    window.toasts?.error('Failed to approve invoice');
  }
}

async function quickAddToDraw(invoiceId) {
  if (!confirm('Add this invoice to the current draw?')) return;

  try {
    const res = await fetch(`/api/invoices/${invoiceId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'in_draw' })
    });

    if (!res.ok) throw new Error('Failed to add to draw');

    window.toasts?.success('Invoice added to draw');
    loadInvoices();
  } catch (err) {
    console.error('Quick add to draw failed:', err);
    window.toasts?.error('Failed to add to draw');
  }
}

async function quickDelete(invoiceId) {
  if (!confirm('Are you sure you want to delete this invoice? This cannot be undone.')) return;

  try {
    const res = await fetch(`/api/invoices/${invoiceId}`, {
      method: 'DELETE'
    });

    if (!res.ok) throw new Error('Delete failed');

    window.toasts?.success('Invoice deleted');
    loadInvoices();
  } catch (err) {
    console.error('Quick delete failed:', err);
    window.toasts?.error('Failed to delete invoice');
  }
}

// ============================================================
// FILTERS
// ============================================================

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
    const [invoiceRes, activityRes] = await Promise.all([
      fetch(`/api/invoices/${invoiceId}`),
      fetch(`/api/invoices/${invoiceId}/activity`)
    ]);

    const invoice = await invoiceRes.json();
    const activity = await activityRes.json();

    renderInvoiceModal(invoice, activity);
    showModal('invoiceModal');
  } catch (err) {
    console.error('Failed to load invoice:', err);
  }
}

function renderInvoiceModal(invoice, activity) {
  const pdfContainer = document.getElementById('pdfViewerContainer');
  const infoPanel = document.getElementById('invoiceInfoPanel');
  const footer = document.getElementById('invoiceModalFooter');

  // PDF Viewer - show original for coded/received, stamped for approved+
  if (invoice.pdf_url || invoice.pdf_stamped_url) {
    const showOriginal = ['coded', 'received'].includes(invoice.status);
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
        <span class="status-pill ${invoice.status}">${formatStatus(invoice.status)}</span>
      </div>
    </div>

    ${invoice.allocations?.length > 0 ? `
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
  const canEdit = ['received', 'coded'].includes(invoice.status);
  const canApprove = invoice.status === 'coded';
  const canDelete = ['received', 'coded'].includes(invoice.status);

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
// UPLOAD
// ============================================================

function setupFileUpload() {
  const fileInput = document.getElementById('invoicePdfFile');
  const uploadArea = document.getElementById('fileUploadArea');
  const fileName = document.getElementById('uploadFileName');

  fileInput?.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      fileName.textContent = e.target.files[0].name;
      uploadArea.classList.add('has-file');
    } else {
      fileName.textContent = '';
      uploadArea.classList.remove('has-file');
    }
  });
}

function showUploadInvoiceModal() {
  document.getElementById('uploadInvoiceForm').reset();
  document.getElementById('uploadFileName').textContent = '';
  document.getElementById('fileUploadArea').classList.remove('has-file');
  document.getElementById('uploadInvoiceDate').value = new Date().toISOString().split('T')[0];

  // Reset AI mode (default: on)
  const aiCheckbox = document.getElementById('useAIProcessing');
  if (aiCheckbox) {
    aiCheckbox.checked = true;
    toggleAIMode(true);
  }

  showModal('uploadInvoiceModal');
}

function toggleAIMode(useAI) {
  const manualFields = document.getElementById('manualFields');
  const uploadBtn = document.querySelector('#uploadInvoiceModal .btn-primary');

  if (useAI) {
    manualFields.style.display = 'none';
    uploadBtn.textContent = 'Process with AI';
  } else {
    manualFields.style.display = 'block';
    uploadBtn.textContent = 'Upload';
  }
}

async function submitUploadInvoice() {
  const fileInput = document.getElementById('invoicePdfFile');
  const useAI = document.getElementById('useAIProcessing')?.checked !== false;

  if (!fileInput.files.length) {
    alert('Please select a PDF');
    return;
  }

  const formData = new FormData();
  formData.append('pdf', fileInput.files[0]);

  // Show processing state
  const uploadBtn = document.querySelector('#uploadInvoiceModal .btn-primary');
  const originalText = uploadBtn.textContent;
  uploadBtn.textContent = useAI ? 'Processing with AI...' : 'Uploading...';
  uploadBtn.disabled = true;

  try {
    if (useAI) {
      // Use AI processing endpoint
      const res = await fetch('/api/invoices/process', {
        method: 'POST',
        body: formData
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || 'Processing failed');
      }

      // Show success with AI results
      const processing = result.processing;
      let message = 'Invoice processed successfully!\n\n';

      if (processing) {
        message += `Vendor: ${processing.vendor?.name || processing.extracted?.vendor?.companyName || 'Unknown'}\n`;
        message += `Amount: $${processing.extracted?.totalAmount || 0}\n`;
        message += `Job: ${processing.matchedJob?.name || 'Not matched'}\n`;
        message += `PO: ${processing.po?.po_number || 'Not matched'}\n`;
        message += `\nRenamed to: ${processing.standardizedFilename}\n`;

        if (processing.messages) {
          message += '\n--- Processing Log ---\n';
          message += processing.messages.join('\n');
        }
      }

      alert(message);

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
    }

    closeModal('uploadInvoiceModal');
    loadInvoices();
    loadVendors(); // Reload in case new vendor was created

  } catch (err) {
    console.error('Failed to upload:', err);
    alert(`Failed to process invoice: ${err.message}`);
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
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
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

function formatStatus(status) {
  const labels = {
    received: 'New',
    coded: 'Needs Approval',
    approved: 'Approved',
    in_draw: 'In Draw',
    paid: 'Paid'
  };
  return labels[status] || status;
}

function formatAction(action) {
  const labels = {
    uploaded: 'Uploaded',
    coded: 'Coded',
    approved: 'Approved',
    added_to_draw: 'Added to draw',
    paid: 'Paid'
  };
  return labels[action] || action;
}

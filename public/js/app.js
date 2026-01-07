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
    // Priority 3: For approved/in_draw with partial allocation - show allocated amount prominently
    else if (['approved', 'in_draw'].includes(inv.status) && isPartialAlloc) {
      displayAmount = totalAllocated;
      amountSubtext = `<div class="amount-subtext">of ${formatMoney(invoiceAmount)}</div>`;
      allocationInfo = `<span class="allocation-badge partial" title="${formatMoney(invoiceAmount - totalAllocated)} remaining">${allocationPct}% of invoice</span>`;
    }
    // Priority 4: Show allocation info for coded status or full allocations
    else if (['coded', 'approved', 'in_draw'].includes(inv.status) && totalAllocated > 0) {
      const allocClass = isPartialAlloc ? 'partial' : 'full';
      allocationInfo = `<span class="allocation-badge ${allocClass}" title="Allocated: ${formatMoney(totalAllocated)} of ${formatMoney(invoiceAmount)}">${formatMoney(totalAllocated)} / ${formatMoney(invoiceAmount)} (${allocationPct}%)</span>`;
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
        </div>
      </div>
      <div class="invoice-amount">${formatMoney(displayAmount)}${amountSubtext}</div>
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

  // Clear searchable pickers
  const jobPicker = document.querySelector('#upload-job-picker-container .search-picker');
  const vendorPicker = document.querySelector('#upload-vendor-picker-container .search-picker');
  if (jobPicker) {
    jobPicker.querySelector('.search-picker-input').value = '';
    jobPicker.querySelector('.search-picker-value').value = '';
    jobPicker.classList.remove('has-value');
  }
  if (vendorPicker) {
    vendorPicker.querySelector('.search-picker-input').value = '';
    vendorPicker.querySelector('.search-picker-value').value = '';
    vendorPicker.classList.remove('has-value');
  }

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

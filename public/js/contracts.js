/**
 * Contracts Management
 * Contract, proposal, and subcontract management
 */

let contracts = [];
let jobs = [];
let companies = [];
let currentContract = null;
let debounceTimer;

// ============================================================
// INITIALIZATION
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
  setupEventListeners();

  try {
    await Promise.all([
      loadJobs(),
      loadCompanies(),
      loadContracts(),
      loadStats()
    ]);
  } catch (err) {
    console.error('Init error:', err);
    showToast('Error loading data', 'error');
  }
});

function setupEventListeners() {
  document.getElementById('typeFilter')?.addEventListener('change', applyFilters);
  document.getElementById('statusFilter')?.addEventListener('change', applyFilters);
  document.getElementById('signatureFilter')?.addEventListener('change', applyFilters);
  document.getElementById('searchInput')?.addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => applyFilters(), 150);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal();
      closeDetailModal();
    }
  });

  document.getElementById('contractModal')?.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) closeModal();
  });
  document.getElementById('detailModal')?.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) closeDetailModal();
  });
}

// ============================================================
// DATA LOADING
// ============================================================

async function loadContracts() {
  const params = new URLSearchParams();

  const type = document.getElementById('typeFilter')?.value;
  const status = document.getElementById('statusFilter')?.value;
  const signature = document.getElementById('signatureFilter')?.value;
  const search = document.getElementById('searchInput')?.value;

  if (type) params.append('type', type);
  if (status) params.append('status', status);
  if (signature) params.append('signature_status', signature);
  if (search) params.append('search', search);

  try {
    const response = await fetch(`/api/contracts?${params}`);
    const data = await response.json();
    contracts = data.contracts || [];
    renderTable();
  } catch (err) {
    console.error('Failed to load contracts:', err);
    showToast('Failed to load contracts', 'error');
  }
}

async function loadJobs() {
  try {
    const response = await fetch('/api/jobs');
    jobs = await response.json() || [];
    populateJobDropdown();
  } catch (err) {
    console.error('Failed to load jobs:', err);
  }
}

async function loadCompanies() {
  try {
    const response = await fetch('/api/companies');
    const data = await response.json();
    companies = data.companies || [];
    populateCompanyDropdown();
  } catch (err) {
    console.error('Failed to load companies:', err);
  }
}

async function loadStats() {
  try {
    const response = await fetch('/api/contracts/stats');
    const stats = await response.json();

    document.getElementById('statTotal').textContent = stats.total || 0;
    document.getElementById('statPending').textContent = stats.pending_signature || 0;
    document.getElementById('statExpiring').textContent = stats.expiring_soon || 0;
  } catch (err) {
    console.error('Stats failed:', err);
  }
}

// ============================================================
// RENDERING
// ============================================================

function renderTable() {
  const tbody = document.getElementById('tableBody');

  if (!contracts.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No contracts found</td></tr>';
    return;
  }

  tbody.innerHTML = contracts.map(contract => {
    const party = contract.company?.name || contract.vendor?.name || '-';
    return `
    <tr onclick="openDetailModal('${contract.id}')" style="cursor: pointer;">
      <td><strong>${escapeHtml(contract.contract_number || '-')}</strong></td>
      <td>${escapeHtml(contract.name)}</td>
      <td><span class="badge badge-${getTypeColor(contract.contract_type)}">${formatType(contract.contract_type)}</span></td>
      <td>${escapeHtml(party)}</td>
      <td>${contract.contract_amount ? formatCurrency(contract.contract_amount) : '-'}</td>
      <td><span class="badge badge-${getSignatureColor(contract.signature_status)}">${formatSignature(contract.signature_status)}</span></td>
      <td><span class="badge badge-${getStatusColor(contract.status)}">${formatStatus(contract.status)}</span></td>
    </tr>
  `}).join('');
}

function populateJobDropdown() {
  const select = document.getElementById('jobId');
  if (!select) return;

  const currentValue = select.value;
  select.innerHTML = '<option value="">-- No Job --</option>' +
    jobs.map(j => `<option value="${j.id}">${escapeHtml(j.name)}</option>`).join('');

  if (currentValue) select.value = currentValue;
}

function populateCompanyDropdown() {
  const select = document.getElementById('companyId');
  if (!select) return;

  const currentValue = select.value;
  select.innerHTML = '<option value="">-- No Company --</option>' +
    companies.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');

  if (currentValue) select.value = currentValue;
}

// ============================================================
// CRUD OPERATIONS
// ============================================================

async function saveContract() {
  const id = document.getElementById('contractId').value;

  const data = {
    name: document.getElementById('contractName').value.trim(),
    contract_type: document.getElementById('contractType').value,
    description: document.getElementById('contractDescription').value.trim() || null,
    job_id: document.getElementById('jobId').value || null,
    company_id: document.getElementById('companyId').value || null,
    contract_amount: document.getElementById('contractAmount').value ? parseFloat(document.getElementById('contractAmount').value) : null,
    payment_terms: document.getElementById('paymentTerms').value || null,
    start_date: document.getElementById('startDate').value || null,
    end_date: document.getElementById('endDate').value || null,
    expiration_date: document.getElementById('expirationDate').value || null,
    scope_of_work: document.getElementById('scopeOfWork').value.trim() || null,
    notes: document.getElementById('notes').value.trim() || null
  };

  if (!data.name || !data.contract_type) {
    showToast('Name and type are required', 'error');
    return;
  }

  try {
    const method = id ? 'PATCH' : 'POST';
    const endpoint = id ? `/api/contracts/${id}` : '/api/contracts';

    const response = await fetch(endpoint, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.message || 'Save failed');
    }

    showToast(id ? 'Contract updated' : 'Contract created', 'success');
    closeModal();
    await Promise.all([loadContracts(), loadStats()]);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteContract(id) {
  if (!confirm('Are you sure you want to delete this contract?')) return;

  try {
    const response = await fetch(`/api/contracts/${id}`, { method: 'DELETE' });
    if (!response.ok) throw new Error('Delete failed');

    showToast('Contract deleted', 'success');
    closeDetailModal();
    await Promise.all([loadContracts(), loadStats()]);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function deleteCurrentContract() {
  if (currentContract?.id) {
    deleteContract(currentContract.id);
  }
}

// ============================================================
// MODALS
// ============================================================

function openCreateModal() {
  currentContract = null;
  document.getElementById('modalTitle').textContent = 'New Contract';
  document.getElementById('contractForm').reset();
  document.getElementById('contractId').value = '';
  populateJobDropdown();
  populateCompanyDropdown();

  const modal = document.getElementById('contractModal');
  modal.style.display = 'flex';
  modal.classList.add('show');
  document.getElementById('contractName').focus();
}

function openEditModal(id) {
  const contract = contracts.find(c => c.id === id) || currentContract;
  if (!contract) return;

  currentContract = contract;
  document.getElementById('modalTitle').textContent = 'Edit Contract';
  document.getElementById('contractId').value = contract.id;
  document.getElementById('contractName').value = contract.name || '';
  document.getElementById('contractType').value = contract.contract_type || '';
  document.getElementById('contractDescription').value = contract.description || '';
  document.getElementById('jobId').value = contract.job_id || '';
  document.getElementById('companyId').value = contract.company_id || '';
  document.getElementById('contractAmount').value = contract.contract_amount || '';
  document.getElementById('paymentTerms').value = contract.payment_terms || '';
  document.getElementById('startDate').value = contract.start_date || '';
  document.getElementById('endDate').value = contract.end_date || '';
  document.getElementById('expirationDate').value = contract.expiration_date || '';
  document.getElementById('scopeOfWork').value = contract.scope_of_work || '';
  document.getElementById('notes').value = contract.notes || '';

  populateJobDropdown();
  populateCompanyDropdown();

  const modal = document.getElementById('contractModal');
  modal.style.display = 'flex';
  modal.classList.add('show');
}

function closeModal() {
  const modal = document.getElementById('contractModal');
  modal.classList.remove('show');
  modal.style.display = 'none';
}

async function openDetailModal(id) {
  try {
    const response = await fetch(`/api/contracts/${id}`);
    const data = await response.json();
    currentContract = data.contract;

    document.getElementById('detailTitle').textContent = currentContract.contract_number || currentContract.name;

    const party = currentContract.company?.name || currentContract.vendor?.name;

    const body = document.getElementById('detailBody');
    body.innerHTML = `
      <div class="detail-grid">
        <div class="detail-section">
          <h4>Contract Information</h4>
          <div class="detail-row">
            <span class="detail-label">Contract #:</span>
            <span>${escapeHtml(currentContract.contract_number || '-')}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Name:</span>
            <span>${escapeHtml(currentContract.name)}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Type:</span>
            <span class="badge badge-${getTypeColor(currentContract.contract_type)}">${formatType(currentContract.contract_type)}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Status:</span>
            <span class="badge badge-${getStatusColor(currentContract.status)}">${formatStatus(currentContract.status)}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Signature:</span>
            <span class="badge badge-${getSignatureColor(currentContract.signature_status)}">${formatSignature(currentContract.signature_status)}</span>
          </div>
        </div>

        <div class="detail-section">
          <h4>Parties</h4>
          ${currentContract.job ? `
          <div class="detail-row">
            <span class="detail-label">Job:</span>
            <a href="job-profile.html?id=${currentContract.job.id}">${escapeHtml(currentContract.job.name)}</a>
          </div>` : ''}
          ${party ? `
          <div class="detail-row">
            <span class="detail-label">Party:</span>
            <span>${escapeHtml(party)}</span>
          </div>` : ''}
          ${currentContract.contact ? `
          <div class="detail-row">
            <span class="detail-label">Contact:</span>
            <span>${escapeHtml(currentContract.contact.first_name)} ${escapeHtml(currentContract.contact.last_name)}</span>
          </div>` : ''}
        </div>

        <div class="detail-section">
          <h4>Financial Terms</h4>
          ${currentContract.contract_amount ? `
          <div class="detail-row">
            <span class="detail-label">Amount:</span>
            <span><strong>${formatCurrency(currentContract.contract_amount)}</strong></span>
          </div>` : ''}
          ${currentContract.retainage_percent ? `
          <div class="detail-row">
            <span class="detail-label">Retainage:</span>
            <span>${currentContract.retainage_percent}%</span>
          </div>` : ''}
          ${currentContract.payment_terms ? `
          <div class="detail-row">
            <span class="detail-label">Payment Terms:</span>
            <span>${escapeHtml(currentContract.payment_terms)}</span>
          </div>` : ''}
        </div>

        <div class="detail-section">
          <h4>Dates</h4>
          ${currentContract.start_date ? `
          <div class="detail-row">
            <span class="detail-label">Start:</span>
            <span>${formatDate(currentContract.start_date)}</span>
          </div>` : ''}
          ${currentContract.end_date ? `
          <div class="detail-row">
            <span class="detail-label">End:</span>
            <span>${formatDate(currentContract.end_date)}</span>
          </div>` : ''}
          ${currentContract.expiration_date ? `
          <div class="detail-row">
            <span class="detail-label">Expires:</span>
            <span>${formatDate(currentContract.expiration_date)}</span>
          </div>` : ''}
          ${currentContract.execution_date ? `
          <div class="detail-row">
            <span class="detail-label">Executed:</span>
            <span>${formatDate(currentContract.execution_date)}</span>
          </div>` : ''}
        </div>

        ${currentContract.scope_of_work ? `
        <div class="detail-section">
          <h4>Scope of Work</h4>
          <p>${escapeHtml(currentContract.scope_of_work)}</p>
        </div>` : ''}

        ${currentContract.signers?.length ? `
        <div class="detail-section">
          <h4>Signers</h4>
          ${currentContract.signers.map(s => `
            <div class="detail-row">
              <span>${escapeHtml(s.signer_name)} ${s.signer_title ? `(${escapeHtml(s.signer_title)})` : ''}</span>
              <span class="badge badge-${s.status === 'signed' ? 'success' : 'warning'}">${s.status}</span>
            </div>
          `).join('')}
        </div>` : ''}

        ${currentContract.notes ? `
        <div class="detail-section">
          <h4>Notes</h4>
          <p>${escapeHtml(currentContract.notes)}</p>
        </div>` : ''}
      </div>
    `;

    const modal = document.getElementById('detailModal');
    modal.style.display = 'flex';
    modal.classList.add('show');
  } catch (err) {
    showToast('Failed to load contract details', 'error');
  }
}

function closeDetailModal() {
  const modal = document.getElementById('detailModal');
  modal.classList.remove('show');
  modal.style.display = 'none';
  currentContract = null;
}

function editCurrentContract() {
  if (currentContract) {
    closeDetailModal();
    openEditModal(currentContract.id);
  }
}

// ============================================================
// UTILITIES
// ============================================================

function applyFilters() {
  loadContracts();
}

function getTypeColor(type) {
  const colors = {
    prime: 'primary',
    subcontract: 'info',
    proposal: 'warning',
    change_order: 'secondary',
    amendment: 'secondary',
    nda: 'danger',
    purchase_agreement: 'success',
    other: 'secondary'
  };
  return colors[type] || 'secondary';
}

function formatType(type) {
  const labels = {
    prime: 'Prime',
    subcontract: 'Subcontract',
    proposal: 'Proposal',
    change_order: 'Change Order',
    amendment: 'Amendment',
    nda: 'NDA',
    purchase_agreement: 'Purchase',
    other: 'Other'
  };
  return labels[type] || type;
}

function getSignatureColor(status) {
  const colors = {
    draft: 'secondary',
    pending_internal: 'warning',
    sent: 'info',
    pending_signature: 'warning',
    partially_signed: 'info',
    fully_executed: 'success',
    declined: 'danger',
    expired: 'danger'
  };
  return colors[status] || 'secondary';
}

function formatSignature(status) {
  const labels = {
    draft: 'Draft',
    pending_internal: 'Internal Review',
    sent: 'Sent',
    pending_signature: 'Awaiting',
    partially_signed: 'Partial',
    fully_executed: 'Executed',
    declined: 'Declined',
    expired: 'Expired'
  };
  return labels[status] || status;
}

function getStatusColor(status) {
  const colors = {
    draft: 'secondary',
    active: 'success',
    completed: 'info',
    terminated: 'danger',
    expired: 'warning',
    cancelled: 'danger'
  };
  return colors[status] || 'secondary';
}

function formatStatus(status) {
  if (!status) return 'Draft';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

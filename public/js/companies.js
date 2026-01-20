/**
 * Companies Management
 * CRM company/organization management frontend
 */

let companies = [];
let currentCompany = null;
let debounceTimer;

// ============================================================
// INITIALIZATION
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
  setupEventListeners();

  try {
    await Promise.all([
      loadCompanies(),
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
  document.getElementById('searchInput')?.addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => applyFilters(), 150);
  });

  // Escape key closes modals
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal();
      closeDetailModal();
    }
  });

  // Click outside modal closes it
  document.getElementById('companyModal')?.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) closeModal();
  });
  document.getElementById('detailModal')?.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) closeDetailModal();
  });
}

// ============================================================
// DATA LOADING
// ============================================================

async function loadCompanies() {
  const params = new URLSearchParams();

  const type = document.getElementById('typeFilter')?.value;
  const status = document.getElementById('statusFilter')?.value;
  const search = document.getElementById('searchInput')?.value;

  if (type) params.append('type', type);
  if (status) params.append('status', status);
  if (search) params.append('search', search);

  try {
    const response = await fetch(`/api/companies?${params}`);
    const data = await response.json();
    companies = data.companies || [];
    renderTable();
  } catch (err) {
    console.error('Failed to load companies:', err);
    showToast('Failed to load companies', 'error');
  }
}

async function loadStats() {
  try {
    const response = await fetch('/api/companies/stats');
    const stats = await response.json();

    document.getElementById('statTotal').textContent = stats.total || 0;
    document.getElementById('statActive').textContent = stats.by_status?.active || 0;
  } catch (err) {
    console.error('Stats failed:', err);
  }
}

// ============================================================
// RENDERING
// ============================================================

function renderTable() {
  const tbody = document.getElementById('tableBody');

  if (!companies.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No companies found</td></tr>';
    return;
  }

  tbody.innerHTML = companies.map(company => `
    <tr onclick="openDetailModal('${company.id}')" style="cursor: pointer;">
      <td><strong>${escapeHtml(company.name)}</strong></td>
      <td><span class="badge badge-${getTypeColor(company.company_type)}">${formatType(company.company_type)}</span></td>
      <td>${company.phone || '-'}</td>
      <td>${company.email ? `<a href="mailto:${escapeHtml(company.email)}" onclick="event.stopPropagation()">${escapeHtml(company.email)}</a>` : '-'}</td>
      <td><span class="badge badge-${company.status === 'active' ? 'success' : 'secondary'}">${company.status}</span></td>
    </tr>
  `).join('');
}

// ============================================================
// CRUD OPERATIONS
// ============================================================

async function saveCompany() {
  const id = document.getElementById('companyId').value;

  const data = {
    name: document.getElementById('companyName').value.trim(),
    company_type: document.getElementById('companyType').value || null,
    phone: document.getElementById('companyPhone').value.trim() || null,
    email: document.getElementById('companyEmail').value.trim() || null,
    website: document.getElementById('companyWebsite').value.trim() || null,
    address: document.getElementById('companyAddress').value.trim() || null,
    city: document.getElementById('companyCity').value.trim() || null,
    state: document.getElementById('companyState').value.trim() || null,
    zip: document.getElementById('companyZip').value.trim() || null,
    notes: document.getElementById('companyNotes').value.trim() || null
  };

  if (!data.name) {
    showToast('Company name is required', 'error');
    return;
  }

  try {
    const method = id ? 'PATCH' : 'POST';
    const endpoint = id ? `/api/companies/${id}` : '/api/companies';

    const response = await fetch(endpoint, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.message || 'Save failed');
    }

    showToast(id ? 'Company updated' : 'Company created', 'success');
    closeModal();
    await Promise.all([loadCompanies(), loadStats()]);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteCompany(id) {
  if (!confirm('Are you sure you want to delete this company?')) return;

  try {
    const response = await fetch(`/api/companies/${id}`, { method: 'DELETE' });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.message || 'Delete failed');
    }

    showToast('Company deleted', 'success');
    closeDetailModal();
    await Promise.all([loadCompanies(), loadStats()]);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function deleteCurrentCompany() {
  if (currentCompany?.id) {
    deleteCompany(currentCompany.id);
  }
}

// ============================================================
// MODALS
// ============================================================

function openCreateModal() {
  currentCompany = null;
  document.getElementById('modalTitle').textContent = 'New Company';
  document.getElementById('companyForm').reset();
  document.getElementById('companyId').value = '';

  const modal = document.getElementById('companyModal');
  modal.style.display = 'flex';
  modal.classList.add('show');
  document.getElementById('companyName').focus();
}

function openEditModal(id) {
  const company = companies.find(c => c.id === id);
  if (!company) return;

  currentCompany = company;
  document.getElementById('modalTitle').textContent = 'Edit Company';
  document.getElementById('companyId').value = company.id;
  document.getElementById('companyName').value = company.name || '';
  document.getElementById('companyType').value = company.company_type || '';
  document.getElementById('companyPhone').value = company.phone || '';
  document.getElementById('companyEmail').value = company.email || '';
  document.getElementById('companyWebsite').value = company.website || '';
  document.getElementById('companyAddress').value = company.address || '';
  document.getElementById('companyCity').value = company.city || '';
  document.getElementById('companyState').value = company.state || '';
  document.getElementById('companyZip').value = company.zip || '';
  document.getElementById('companyNotes').value = company.notes || '';

  const modal = document.getElementById('companyModal');
  modal.style.display = 'flex';
  modal.classList.add('show');
}

function closeModal() {
  const modal = document.getElementById('companyModal');
  modal.classList.remove('show');
  modal.style.display = 'none';
}

async function openDetailModal(id) {
  try {
    const response = await fetch(`/api/companies/${id}`);
    const data = await response.json();
    currentCompany = data.company;

    document.getElementById('detailTitle').textContent = currentCompany.name;

    const body = document.getElementById('detailBody');
    body.innerHTML = `
      <div class="detail-grid">
        <div class="detail-section">
          <h4>Company Information</h4>
          <div class="detail-row">
            <span class="detail-label">Name:</span>
            <span>${escapeHtml(currentCompany.name)}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Type:</span>
            <span class="badge badge-${getTypeColor(currentCompany.company_type)}">${formatType(currentCompany.company_type)}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Status:</span>
            <span class="badge badge-${currentCompany.status === 'active' ? 'success' : 'secondary'}">${currentCompany.status}</span>
          </div>
        </div>

        <div class="detail-section">
          <h4>Contact Details</h4>
          ${currentCompany.email ? `
          <div class="detail-row">
            <span class="detail-label">Email:</span>
            <a href="mailto:${escapeHtml(currentCompany.email)}">${escapeHtml(currentCompany.email)}</a>
          </div>` : ''}
          ${currentCompany.phone ? `
          <div class="detail-row">
            <span class="detail-label">Phone:</span>
            <a href="tel:${escapeHtml(currentCompany.phone)}">${escapeHtml(currentCompany.phone)}</a>
          </div>` : ''}
          ${currentCompany.website ? `
          <div class="detail-row">
            <span class="detail-label">Website:</span>
            <a href="${escapeHtml(currentCompany.website)}" target="_blank">${escapeHtml(currentCompany.website)}</a>
          </div>` : ''}
        </div>

        ${currentCompany.address || currentCompany.city ? `
        <div class="detail-section">
          <h4>Address</h4>
          <div class="detail-row">
            <span>${[currentCompany.address, currentCompany.city, currentCompany.state, currentCompany.zip].filter(Boolean).join(', ')}</span>
          </div>
        </div>` : ''}

        ${currentCompany.contacts?.length ? `
        <div class="detail-section">
          <h4>Contacts (${currentCompany.contacts.length})</h4>
          ${currentCompany.contacts.map(contact => `
            <div class="detail-row">
              <span>
                <strong>${escapeHtml(contact.first_name)} ${escapeHtml(contact.last_name)}</strong>
                ${contact.title ? `<small class="text-muted"> - ${escapeHtml(contact.title)}</small>` : ''}
                ${contact.is_primary ? '<span class="badge badge-info">Primary</span>' : ''}
              </span>
              <span class="text-muted">
                ${contact.email || contact.phone || ''}
              </span>
            </div>
          `).join('')}
        </div>` : ''}

        ${currentCompany.notes ? `
        <div class="detail-section">
          <h4>Notes</h4>
          <p>${escapeHtml(currentCompany.notes)}</p>
        </div>` : ''}
      </div>
    `;

    const modal = document.getElementById('detailModal');
    modal.style.display = 'flex';
    modal.classList.add('show');
  } catch (err) {
    showToast('Failed to load company details', 'error');
  }
}

function closeDetailModal() {
  const modal = document.getElementById('detailModal');
  modal.classList.remove('show');
  modal.style.display = 'none';
  currentCompany = null;
}

function editCurrentCompany() {
  if (currentCompany) {
    closeDetailModal();
    openEditModal(currentCompany.id);
  }
}

// ============================================================
// UTILITIES
// ============================================================

function applyFilters() {
  loadCompanies();
}

function getTypeColor(type) {
  const colors = {
    client: 'info',
    subcontractor: 'warning',
    supplier: 'primary',
    architect: 'success',
    engineer: 'success',
    inspector: 'danger',
    lender: 'secondary',
    government: 'secondary',
    other: 'secondary'
  };
  return colors[type] || 'secondary';
}

function formatType(type) {
  if (!type) return 'Other';
  const labels = {
    client: 'Client',
    subcontractor: 'Subcontractor',
    supplier: 'Supplier',
    architect: 'Architect',
    engineer: 'Engineer',
    inspector: 'Inspector',
    lender: 'Lender',
    government: 'Government',
    other: 'Other'
  };
  return labels[type] || type.charAt(0).toUpperCase() + type.slice(1);
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

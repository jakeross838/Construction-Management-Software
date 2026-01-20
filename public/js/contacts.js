/**
 * Contacts Management
 * CRM contact management frontend
 */

let contacts = [];
let companies = [];
let currentContact = null;
let debounceTimer;

// ============================================================
// INITIALIZATION
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
  setupEventListeners();

  try {
    await Promise.all([
      loadCompanies(),
      loadContacts(),
      loadStats()
    ]);
  } catch (err) {
    console.error('Init error:', err);
    showToast('Error loading data', 'error');
  }
});

function setupEventListeners() {
  document.getElementById('roleFilter')?.addEventListener('change', applyFilters);
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
  document.getElementById('contactModal')?.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) closeModal();
  });
  document.getElementById('detailModal')?.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) closeDetailModal();
  });
}

// ============================================================
// DATA LOADING
// ============================================================

async function loadContacts() {
  const params = new URLSearchParams();

  const role = document.getElementById('roleFilter')?.value;
  const status = document.getElementById('statusFilter')?.value;
  const search = document.getElementById('searchInput')?.value;

  if (role) params.append('role', role);
  if (status) params.append('status', status);
  if (search) params.append('search', search);

  try {
    const response = await fetch(`/api/contacts?${params}`);
    const data = await response.json();
    contacts = data.contacts || [];
    renderTable();
  } catch (err) {
    console.error('Failed to load contacts:', err);
    showToast('Failed to load contacts', 'error');
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
    const response = await fetch('/api/contacts/stats');
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

  if (!contacts.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No contacts found</td></tr>';
    return;
  }

  tbody.innerHTML = contacts.map(contact => `
    <tr onclick="openDetailModal('${contact.id}')" style="cursor: pointer;">
      <td>
        <strong>${escapeHtml(contact.first_name)} ${escapeHtml(contact.last_name)}</strong>
        ${contact.title ? `<br><small class="text-muted">${escapeHtml(contact.title)}</small>` : ''}
      </td>
      <td>${contact.company?.name ? escapeHtml(contact.company.name) : '<span class="text-muted">-</span>'}</td>
      <td><span class="badge badge-${getRoleColor(contact.contact_role)}">${formatRole(contact.contact_role)}</span></td>
      <td>${contact.email ? `<a href="mailto:${escapeHtml(contact.email)}" onclick="event.stopPropagation()">${escapeHtml(contact.email)}</a>` : '-'}</td>
      <td>${contact.phone || contact.mobile || '-'}</td>
      <td><span class="badge badge-${contact.status === 'active' ? 'success' : 'secondary'}">${contact.status}</span></td>
    </tr>
  `).join('');
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

async function saveContact() {
  const form = document.getElementById('contactForm');
  const id = document.getElementById('contactId').value;

  const data = {
    first_name: document.getElementById('firstName').value.trim(),
    last_name: document.getElementById('lastName').value.trim(),
    email: document.getElementById('email').value.trim() || null,
    phone: document.getElementById('phone').value.trim() || null,
    mobile: document.getElementById('mobile').value.trim() || null,
    title: document.getElementById('title').value.trim() || null,
    company_id: document.getElementById('companyId').value || null,
    contact_role: document.getElementById('contactRole').value,
    preferred_contact: document.getElementById('preferredContact').value,
    is_primary: document.getElementById('isPrimary').checked,
    address: document.getElementById('address').value.trim() || null,
    city: document.getElementById('city').value.trim() || null,
    state: document.getElementById('state').value.trim() || null,
    zip: document.getElementById('zip').value.trim() || null,
    notes: document.getElementById('notes').value.trim() || null
  };

  if (!data.first_name || !data.last_name) {
    showToast('First name and last name are required', 'error');
    return;
  }

  try {
    const method = id ? 'PATCH' : 'POST';
    const endpoint = id ? `/api/contacts/${id}` : '/api/contacts';

    const response = await fetch(endpoint, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.message || 'Save failed');
    }

    showToast(id ? 'Contact updated' : 'Contact created', 'success');
    closeModal();
    await Promise.all([loadContacts(), loadStats()]);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteContact(id) {
  if (!confirm('Are you sure you want to delete this contact?')) return;

  try {
    const response = await fetch(`/api/contacts/${id}`, { method: 'DELETE' });
    if (!response.ok) throw new Error('Delete failed');

    showToast('Contact deleted', 'success');
    closeDetailModal();
    await Promise.all([loadContacts(), loadStats()]);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function deleteCurrentContact() {
  if (currentContact?.id) {
    deleteContact(currentContact.id);
  }
}

// ============================================================
// MODALS
// ============================================================

function openCreateModal() {
  currentContact = null;
  document.getElementById('modalTitle').textContent = 'New Contact';
  document.getElementById('contactForm').reset();
  document.getElementById('contactId').value = '';
  populateCompanyDropdown();

  const modal = document.getElementById('contactModal');
  modal.style.display = 'flex';
  modal.classList.add('show');
  document.getElementById('firstName').focus();
}

function openEditModal(id) {
  const contact = contacts.find(c => c.id === id);
  if (!contact) return;

  currentContact = contact;
  document.getElementById('modalTitle').textContent = 'Edit Contact';
  document.getElementById('contactId').value = contact.id;
  document.getElementById('firstName').value = contact.first_name || '';
  document.getElementById('lastName').value = contact.last_name || '';
  document.getElementById('email').value = contact.email || '';
  document.getElementById('phone').value = contact.phone || '';
  document.getElementById('mobile').value = contact.mobile || '';
  document.getElementById('title').value = contact.title || '';
  document.getElementById('companyId').value = contact.company_id || '';
  document.getElementById('contactRole').value = contact.contact_role || 'other';
  document.getElementById('preferredContact').value = contact.preferred_contact || 'email';
  document.getElementById('isPrimary').checked = contact.is_primary || false;
  document.getElementById('address').value = contact.address || '';
  document.getElementById('city').value = contact.city || '';
  document.getElementById('state').value = contact.state || '';
  document.getElementById('zip').value = contact.zip || '';
  document.getElementById('notes').value = contact.notes || '';

  populateCompanyDropdown();

  const modal = document.getElementById('contactModal');
  modal.style.display = 'flex';
  modal.classList.add('show');
}

function closeModal() {
  const modal = document.getElementById('contactModal');
  modal.classList.remove('show');
  modal.style.display = 'none';
}

async function openDetailModal(id) {
  try {
    const response = await fetch(`/api/contacts/${id}`);
    const data = await response.json();
    currentContact = data.contact;

    document.getElementById('detailTitle').textContent =
      `${currentContact.first_name} ${currentContact.last_name}`;

    const body = document.getElementById('detailBody');
    body.innerHTML = `
      <div class="detail-grid">
        <div class="detail-section">
          <h4>Contact Information</h4>
          <div class="detail-row">
            <span class="detail-label">Name:</span>
            <span>${escapeHtml(currentContact.first_name)} ${escapeHtml(currentContact.last_name)}</span>
          </div>
          ${currentContact.title ? `
          <div class="detail-row">
            <span class="detail-label">Title:</span>
            <span>${escapeHtml(currentContact.title)}</span>
          </div>` : ''}
          <div class="detail-row">
            <span class="detail-label">Role:</span>
            <span class="badge badge-${getRoleColor(currentContact.contact_role)}">${formatRole(currentContact.contact_role)}</span>
          </div>
          ${currentContact.company ? `
          <div class="detail-row">
            <span class="detail-label">Company:</span>
            <a href="companies.html#${currentContact.company.id}">${escapeHtml(currentContact.company.name)}</a>
            ${currentContact.is_primary ? '<span class="badge badge-info">Primary</span>' : ''}
          </div>` : ''}
        </div>

        <div class="detail-section">
          <h4>Contact Details</h4>
          ${currentContact.email ? `
          <div class="detail-row">
            <span class="detail-label">Email:</span>
            <a href="mailto:${escapeHtml(currentContact.email)}">${escapeHtml(currentContact.email)}</a>
          </div>` : ''}
          ${currentContact.phone ? `
          <div class="detail-row">
            <span class="detail-label">Phone:</span>
            <a href="tel:${escapeHtml(currentContact.phone)}">${escapeHtml(currentContact.phone)}</a>
          </div>` : ''}
          ${currentContact.mobile ? `
          <div class="detail-row">
            <span class="detail-label">Mobile:</span>
            <a href="tel:${escapeHtml(currentContact.mobile)}">${escapeHtml(currentContact.mobile)}</a>
          </div>` : ''}
          <div class="detail-row">
            <span class="detail-label">Preferred:</span>
            <span>${currentContact.preferred_contact || 'Email'}</span>
          </div>
        </div>

        ${currentContact.address || currentContact.city ? `
        <div class="detail-section">
          <h4>Address</h4>
          <div class="detail-row">
            <span>${[currentContact.address, currentContact.city, currentContact.state, currentContact.zip].filter(Boolean).join(', ')}</span>
          </div>
        </div>` : ''}

        ${currentContact.jobs?.length ? `
        <div class="detail-section">
          <h4>Linked Jobs</h4>
          ${currentContact.jobs.map(job => `
            <div class="detail-row">
              <a href="job-profile.html?id=${job.id}">${escapeHtml(job.name)}</a>
              ${job.role ? `<span class="badge badge-secondary">${escapeHtml(job.role)}</span>` : ''}
            </div>
          `).join('')}
        </div>` : ''}

        ${currentContact.notes ? `
        <div class="detail-section">
          <h4>Notes</h4>
          <p>${escapeHtml(currentContact.notes)}</p>
        </div>` : ''}
      </div>
    `;

    const modal = document.getElementById('detailModal');
    modal.style.display = 'flex';
    modal.classList.add('show');
  } catch (err) {
    showToast('Failed to load contact details', 'error');
  }
}

function closeDetailModal() {
  const modal = document.getElementById('detailModal');
  modal.classList.remove('show');
  modal.style.display = 'none';
  currentContact = null;
}

function editCurrentContact() {
  if (currentContact) {
    closeDetailModal();
    openEditModal(currentContact.id);
  }
}

// ============================================================
// UTILITIES
// ============================================================

function applyFilters() {
  loadContacts();
}

function getRoleColor(role) {
  const colors = {
    client: 'info',
    vendor: 'primary',
    subcontractor: 'warning',
    architect: 'success',
    engineer: 'success',
    inspector: 'danger',
    other: 'secondary'
  };
  return colors[role] || 'secondary';
}

function formatRole(role) {
  if (!role) return 'Other';
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

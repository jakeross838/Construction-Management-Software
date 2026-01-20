/**
 * Permits Management Frontend
 * Permit applications, inspections, and document tracking
 */

(function() {
  'use strict';

  let permits = [];
  let jobs = [];
  let contacts = [];
  let currentPermit = null;
  let selectedJobId = ''; // From sidebar

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
    const date = new Date(dateStr + 'T00:00:00');
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
    return formatDate(dateStr.split('T')[0]);
  }

  // Get status badge class
  function getStatusClass(status) {
    const classes = {
      draft: 'badge-secondary',
      submitted: 'badge-info',
      under_review: 'badge-warning',
      approved: 'badge-success',
      denied: 'badge-danger',
      expired: 'badge-secondary',
      closed: 'badge-secondary'
    };
    return classes[status] || 'badge-secondary';
  }

  // Format permit type
  function formatType(type) {
    const types = {
      building: 'Building',
      electrical: 'Electrical',
      plumbing: 'Plumbing',
      mechanical: 'Mechanical',
      roofing: 'Roofing',
      demo: 'Demolition',
      other: 'Other'
    };
    return types[type] || type;
  }

  // ============ DATA LOADING ============

  async function loadPermits() {
    try {
      const type = document.getElementById('typeFilter').value;
      const status = document.getElementById('statusFilter').value;

      let url = '/api/permits?';
      // Job filter comes from sidebar
      if (selectedJobId) url += `job_id=${selectedJobId}&`;
      if (type) url += `type=${type}&`;
      if (status) url += `status=${status}&`;

      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to load permits');
      permits = await response.json();

      renderTable();
    } catch (err) {
      console.error('Error loading permits:', err);
      showToast('Failed to load permits', 'error');
    }
  }

  async function loadStats() {
    try {
      const response = await fetch('/api/permits/stats');
      if (!response.ok) throw new Error('Failed to load stats');
      const stats = await response.json();

      document.getElementById('statTotal').textContent = stats.total || 0;
      document.getElementById('statSubmitted').textContent = stats.submitted || 0;
      document.getElementById('statApproved').textContent = stats.approved || 0;
    } catch (err) {
      console.error('Error loading stats:', err);
    }
  }

  async function loadJobs() {
    try {
      const response = await fetch('/api/jobs');
      if (!response.ok) throw new Error('Failed to load jobs');
      jobs = await response.json();

      // Populate job dropdown in create/edit modal (not the filter - sidebar handles that)
      const jobOptions = '<option value="">-- No Job --</option>' +
        jobs.map(j => `<option value="${j.id}">${j.name}</option>`).join('');

      document.getElementById('jobId').innerHTML = jobOptions;
    } catch (err) {
      console.error('Error loading jobs:', err);
    }
  }

  async function loadContacts() {
    try {
      const response = await fetch('/api/contacts?type=inspector');
      if (!response.ok) throw new Error('Failed to load contacts');
      contacts = await response.json();

      // Also load all contacts for broader selection
      const allResponse = await fetch('/api/contacts');
      if (allResponse.ok) {
        const allContacts = await allResponse.json();
        contacts = allContacts;
      }

      const contactOptions = '<option value="">-- Select Contact --</option>' +
        contacts.map(c => `<option value="${c.id}">${c.name}${c.type ? ` (${c.type})` : ''}</option>`).join('');

      document.getElementById('inspectorContact').innerHTML = contactOptions;
    } catch (err) {
      console.error('Error loading contacts:', err);
    }
  }

  // ============ RENDERING ============

  function renderTable() {
    const tbody = document.getElementById('tableBody');
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();

    const filtered = permits.filter(p => {
      if (!searchTerm) return true;
      return (
        (p.permit_number || '').toLowerCase().includes(searchTerm) ||
        (p.permit_type || '').toLowerCase().includes(searchTerm) ||
        (p.description || '').toLowerCase().includes(searchTerm) ||
        (p.job?.name || '').toLowerCase().includes(searchTerm)
      );
    });

    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No permits found</td></tr>';
      return;
    }

    tbody.innerHTML = filtered.map(p => `
      <tr onclick="openDetailModal('${p.id}')" style="cursor: pointer;">
        <td>${p.permit_number || '-'}</td>
        <td>${formatType(p.permit_type)}</td>
        <td>${p.job?.name || '-'}</td>
        <td><span class="badge ${getStatusClass(p.status)}">${p.status}</span></td>
        <td>${formatDate(p.submission_date)}</td>
        <td>${formatDate(p.expiration_date)}</td>
        <td>${p.fee_amount ? formatCurrency(p.fee_amount) : '-'}</td>
      </tr>
    `).join('');
  }

  function renderOverview(permit) {
    const container = document.getElementById('overviewContent');

    container.innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem;">
        <div>
          <h4 style="color: var(--text-secondary); font-size: 0.75rem; text-transform: uppercase; margin: 0 0 0.5rem 0;">Permit Number</h4>
          <p style="margin: 0; font-size: 1rem;">${permit.permit_number || 'Not assigned'}</p>
        </div>
        <div>
          <h4 style="color: var(--text-secondary); font-size: 0.75rem; text-transform: uppercase; margin: 0 0 0.5rem 0;">Type</h4>
          <p style="margin: 0; font-size: 1rem;">${formatType(permit.permit_type)}</p>
        </div>
        <div>
          <h4 style="color: var(--text-secondary); font-size: 0.75rem; text-transform: uppercase; margin: 0 0 0.5rem 0;">Status</h4>
          <p style="margin: 0;"><span class="badge ${getStatusClass(permit.status)}">${permit.status}</span></p>
        </div>
        <div>
          <h4 style="color: var(--text-secondary); font-size: 0.75rem; text-transform: uppercase; margin: 0 0 0.5rem 0;">Job</h4>
          <p style="margin: 0; font-size: 1rem;">${permit.job?.name || 'No job linked'}</p>
        </div>
        <div>
          <h4 style="color: var(--text-secondary); font-size: 0.75rem; text-transform: uppercase; margin: 0 0 0.5rem 0;">Issued By</h4>
          <p style="margin: 0; font-size: 1rem;">${permit.issued_by || '-'}</p>
        </div>
        <div>
          <h4 style="color: var(--text-secondary); font-size: 0.75rem; text-transform: uppercase; margin: 0 0 0.5rem 0;">Fee</h4>
          <p style="margin: 0; font-size: 1rem;">${permit.fee_amount ? formatCurrency(permit.fee_amount) : '-'} ${permit.fee_paid ? '(Paid)' : ''}</p>
        </div>
        <div>
          <h4 style="color: var(--text-secondary); font-size: 0.75rem; text-transform: uppercase; margin: 0 0 0.5rem 0;">Submitted</h4>
          <p style="margin: 0; font-size: 1rem;">${formatDate(permit.submission_date)}</p>
        </div>
        <div>
          <h4 style="color: var(--text-secondary); font-size: 0.75rem; text-transform: uppercase; margin: 0 0 0.5rem 0;">Approved</h4>
          <p style="margin: 0; font-size: 1rem;">${formatDate(permit.approval_date)}</p>
        </div>
        <div>
          <h4 style="color: var(--text-secondary); font-size: 0.75rem; text-transform: uppercase; margin: 0 0 0.5rem 0;">Expires</h4>
          <p style="margin: 0; font-size: 1rem;">${formatDate(permit.expiration_date)}</p>
        </div>
      </div>
      ${permit.description ? `
        <div style="margin-top: 1.5rem;">
          <h4 style="color: var(--text-secondary); font-size: 0.75rem; text-transform: uppercase; margin: 0 0 0.5rem 0;">Description</h4>
          <p style="margin: 0;">${permit.description}</p>
        </div>
      ` : ''}
      ${permit.notes ? `
        <div style="margin-top: 1rem;">
          <h4 style="color: var(--text-secondary); font-size: 0.75rem; text-transform: uppercase; margin: 0 0 0.5rem 0;">Notes</h4>
          <p style="margin: 0;">${permit.notes}</p>
        </div>
      ` : ''}
    `;
  }

  function renderInspections(inspections) {
    const container = document.getElementById('inspectionsList');

    if (!inspections || inspections.length === 0) {
      container.innerHTML = '<p style="color: var(--text-secondary);">No inspections scheduled</p>';
      return;
    }

    container.innerHTML = inspections.map(i => `
      <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 1rem; margin-bottom: 0.75rem;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div>
            <strong>${i.inspection_type}</strong>
            <p style="margin: 0.25rem 0 0 0; color: var(--text-secondary); font-size: 0.875rem;">
              ${formatDate(i.scheduled_date)}${i.scheduled_time ? ` at ${i.scheduled_time}` : ''}
            </p>
            ${i.inspector?.name || i.inspector_name ? `
              <p style="margin: 0.25rem 0 0 0; font-size: 0.875rem;">
                Inspector: ${i.inspector?.name || i.inspector_name}
                ${i.inspector?.phone || i.inspector_phone ? ` - ${i.inspector?.phone || i.inspector_phone}` : ''}
              </p>
            ` : ''}
          </div>
          <span class="badge ${i.status === 'passed' ? 'badge-success' : i.status === 'failed' ? 'badge-danger' : 'badge-info'}">${i.status}</span>
        </div>
        ${i.result_notes ? `<p style="margin: 0.5rem 0 0 0; font-size: 0.875rem;">${i.result_notes}</p>` : ''}
        ${i.status === 'scheduled' ? `
          <div style="margin-top: 0.75rem; display: flex; gap: 0.5rem;">
            <button class="btn btn-success btn-sm" onclick="completeInspection('${i.id}', 'passed')">Pass</button>
            <button class="btn btn-danger btn-sm" onclick="completeInspection('${i.id}', 'failed')">Fail</button>
            <button class="btn btn-secondary btn-sm" onclick="cancelInspection('${i.id}')">Cancel</button>
          </div>
        ` : ''}
      </div>
    `).join('');
  }

  function renderDocuments(documents) {
    const container = document.getElementById('documentsList');

    if (!documents || documents.length === 0) {
      container.innerHTML = '<p style="color: var(--text-secondary);">No documents uploaded</p>';
      return;
    }

    container.innerHTML = documents.map(d => `
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: var(--bg-card); border: 1px solid var(--border); border-radius: 6px; margin-bottom: 0.5rem;">
        <div>
          <strong>${d.name}</strong>
          <span style="margin-left: 0.5rem; color: var(--text-secondary); font-size: 0.75rem;">${d.document_type}</span>
          ${d.description ? `<p style="margin: 0.25rem 0 0 0; color: var(--text-secondary); font-size: 0.875rem;">${d.description}</p>` : ''}
        </div>
        <div style="display: flex; gap: 0.5rem;">
          ${d.file_url ? `<a href="${d.file_url}" target="_blank" class="btn btn-secondary btn-sm">View</a>` : ''}
          <button class="btn btn-danger btn-sm" onclick="deleteDocument('${d.id}')">Delete</button>
        </div>
      </div>
    `).join('');
  }

  function renderActivity(activity) {
    const container = document.getElementById('activityList');

    if (!activity || activity.length === 0) {
      container.innerHTML = '<p style="color: var(--text-secondary);">No activity recorded</p>';
      return;
    }

    container.innerHTML = activity.map(a => `
      <div style="padding: 0.75rem 0; border-bottom: 1px solid var(--border);">
        <div style="display: flex; justify-content: space-between;">
          <span>${a.description}</span>
          <span style="color: var(--text-secondary); font-size: 0.75rem;">${formatRelativeTime(a.created_at)}</span>
        </div>
      </div>
    `).join('');
  }

  // ============ CREATE/EDIT MODAL ============

  window.openCreateModal = function() {
    document.getElementById('permitForm').reset();
    document.getElementById('permitId').value = '';
    document.getElementById('modalTitle').textContent = 'New Permit';

    const modal = document.getElementById('permitModal');
    modal.style.display = 'flex';
    modal.classList.add('show');
  };

  window.closeModal = function() {
    const modal = document.getElementById('permitModal');
    modal.classList.remove('show');
    modal.style.display = 'none';
  };

  window.savePermit = async function() {
    const id = document.getElementById('permitId').value;
    const data = {
      permit_type: document.getElementById('permitType').value,
      permit_number: document.getElementById('permitNumber').value || null,
      job_id: document.getElementById('jobId').value || null,
      issued_by: document.getElementById('issuedBy').value || null,
      description: document.getElementById('description').value || null,
      submission_date: document.getElementById('submissionDate').value || null,
      expiration_date: document.getElementById('expirationDate').value || null,
      fee_amount: parseFloat(document.getElementById('feeAmount').value) || null,
      fee_paid: document.getElementById('feePaid').value === 'true',
      notes: document.getElementById('notes').value || null
    };

    if (!data.permit_type) {
      showToast('Permit type is required', 'error');
      return;
    }

    try {
      const url = id ? `/api/permits/${id}` : '/api/permits';
      const method = id ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (!response.ok) throw new Error('Failed to save permit');

      showToast(id ? 'Permit updated' : 'Permit created', 'success');
      closeModal();
      loadPermits();
      loadStats();
    } catch (err) {
      console.error('Error saving permit:', err);
      showToast('Failed to save permit', 'error');
    }
  };

  // ============ DETAIL MODAL ============

  window.openDetailModal = async function(id) {
    try {
      const response = await fetch(`/api/permits/${id}`);
      if (!response.ok) throw new Error('Failed to load permit');
      currentPermit = await response.json();

      document.getElementById('detailTitle').textContent = currentPermit.permit_number || `${formatType(currentPermit.permit_type)} Permit`;

      // Update button visibility based on status
      document.getElementById('submitBtn').style.display = currentPermit.status === 'draft' ? 'inline-block' : 'none';
      document.getElementById('approveBtn').style.display = ['submitted', 'under_review'].includes(currentPermit.status) ? 'inline-block' : 'none';

      renderOverview(currentPermit);
      renderInspections(currentPermit.inspections);
      renderDocuments(currentPermit.documents);
      renderActivity(currentPermit.activity);

      // Reset to overview tab
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(t => t.style.display = 'none');
      document.querySelector('.tab[data-tab="overview"]').classList.add('active');
      document.getElementById('tab-overview').style.display = 'block';

      const modal = document.getElementById('detailModal');
      modal.style.display = 'flex';
      modal.classList.add('show');
    } catch (err) {
      console.error('Error loading permit:', err);
      showToast('Failed to load permit details', 'error');
    }
  };

  window.closeDetailModal = function() {
    const modal = document.getElementById('detailModal');
    modal.classList.remove('show');
    modal.style.display = 'none';
    currentPermit = null;
  };

  window.editCurrentPermit = function() {
    if (!currentPermit) return;

    document.getElementById('permitId').value = currentPermit.id;
    document.getElementById('permitType').value = currentPermit.permit_type || '';
    document.getElementById('permitNumber').value = currentPermit.permit_number || '';
    document.getElementById('jobId').value = currentPermit.job_id || '';
    document.getElementById('issuedBy').value = currentPermit.issued_by || '';
    document.getElementById('description').value = currentPermit.description || '';
    document.getElementById('submissionDate').value = currentPermit.submission_date || '';
    document.getElementById('expirationDate').value = currentPermit.expiration_date || '';
    document.getElementById('feeAmount').value = currentPermit.fee_amount || '';
    document.getElementById('feePaid').value = currentPermit.fee_paid ? 'true' : 'false';
    document.getElementById('notes').value = currentPermit.notes || '';

    document.getElementById('modalTitle').textContent = 'Edit Permit';
    closeDetailModal();

    const modal = document.getElementById('permitModal');
    modal.style.display = 'flex';
    modal.classList.add('show');
  };

  window.deleteCurrentPermit = async function() {
    if (!currentPermit || !confirm('Delete this permit?')) return;

    try {
      const response = await fetch(`/api/permits/${currentPermit.id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete');

      showToast('Permit deleted', 'success');
      closeDetailModal();
      loadPermits();
      loadStats();
    } catch (err) {
      console.error('Error deleting permit:', err);
      showToast('Failed to delete permit', 'error');
    }
  };

  window.submitPermit = async function() {
    if (!currentPermit) return;

    try {
      const response = await fetch(`/api/permits/${currentPermit.id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) throw new Error('Failed to submit');

      showToast('Permit submitted', 'success');
      closeDetailModal();
      loadPermits();
      loadStats();
    } catch (err) {
      console.error('Error submitting permit:', err);
      showToast('Failed to submit permit', 'error');
    }
  };

  window.approvePermit = async function() {
    if (!currentPermit) return;

    const permitNumber = prompt('Enter permit number (optional):');

    try {
      const response = await fetch(`/api/permits/${currentPermit.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permit_number: permitNumber })
      });

      if (!response.ok) throw new Error('Failed to approve');

      showToast('Permit approved', 'success');
      closeDetailModal();
      loadPermits();
      loadStats();
    } catch (err) {
      console.error('Error approving permit:', err);
      showToast('Failed to approve permit', 'error');
    }
  };

  // ============ INSPECTION MODAL ============

  window.openInspectionModal = function() {
    document.getElementById('inspectionForm').reset();

    const modal = document.getElementById('inspectionModal');
    modal.style.display = 'flex';
    modal.classList.add('show');
  };

  window.closeInspectionModal = function() {
    const modal = document.getElementById('inspectionModal');
    modal.classList.remove('show');
    modal.style.display = 'none';
  };

  window.saveInspection = async function() {
    if (!currentPermit) return;

    const data = {
      inspection_type: document.getElementById('inspectionType').value,
      scheduled_date: document.getElementById('inspectionDate').value,
      scheduled_time: document.getElementById('inspectionTime').value || null,
      inspector_contact_id: document.getElementById('inspectorContact').value || null,
      inspector_name: document.getElementById('inspectorName').value || null,
      inspector_phone: document.getElementById('inspectorPhone').value || null,
      description: document.getElementById('inspectionDescription').value || null
    };

    if (!data.inspection_type || !data.scheduled_date) {
      showToast('Type and date are required', 'error');
      return;
    }

    try {
      const response = await fetch(`/api/permits/${currentPermit.id}/inspections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (!response.ok) throw new Error('Failed to schedule inspection');

      showToast('Inspection scheduled', 'success');
      closeInspectionModal();
      openDetailModal(currentPermit.id);
    } catch (err) {
      console.error('Error scheduling inspection:', err);
      showToast('Failed to schedule inspection', 'error');
    }
  };

  window.completeInspection = async function(inspectionId, status) {
    const notes = prompt('Enter result notes (optional):');

    try {
      const response = await fetch(`/api/permits/inspections/${inspectionId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, result_notes: notes })
      });

      if (!response.ok) throw new Error('Failed to complete inspection');

      showToast(`Inspection marked as ${status}`, 'success');
      if (currentPermit) openDetailModal(currentPermit.id);
    } catch (err) {
      console.error('Error completing inspection:', err);
      showToast('Failed to complete inspection', 'error');
    }
  };

  window.cancelInspection = async function(inspectionId) {
    if (!confirm('Cancel this inspection?')) return;

    try {
      const response = await fetch(`/api/permits/inspections/${inspectionId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) throw new Error('Failed to cancel');

      showToast('Inspection cancelled', 'success');
      if (currentPermit) openDetailModal(currentPermit.id);
    } catch (err) {
      console.error('Error cancelling inspection:', err);
      showToast('Failed to cancel inspection', 'error');
    }
  };

  // ============ DOCUMENT MODAL ============

  window.openDocumentModal = function() {
    document.getElementById('documentForm').reset();

    const modal = document.getElementById('documentModal');
    modal.style.display = 'flex';
    modal.classList.add('show');
  };

  window.closeDocumentModal = function() {
    const modal = document.getElementById('documentModal');
    modal.classList.remove('show');
    modal.style.display = 'none';
  };

  window.saveDocument = async function() {
    if (!currentPermit) return;

    const data = {
      document_type: document.getElementById('documentType').value,
      name: document.getElementById('documentName').value,
      file_url: document.getElementById('documentUrl').value || null,
      description: document.getElementById('documentDescription').value || null
    };

    if (!data.document_type || !data.name) {
      showToast('Type and name are required', 'error');
      return;
    }

    try {
      const response = await fetch(`/api/permits/${currentPermit.id}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (!response.ok) throw new Error('Failed to add document');

      showToast('Document added', 'success');
      closeDocumentModal();
      openDetailModal(currentPermit.id);
    } catch (err) {
      console.error('Error adding document:', err);
      showToast('Failed to add document', 'error');
    }
  };

  window.deleteDocument = async function(documentId) {
    if (!confirm('Delete this document?')) return;

    try {
      const response = await fetch(`/api/permits/documents/${documentId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete');

      showToast('Document deleted', 'success');
      if (currentPermit) openDetailModal(currentPermit.id);
    } catch (err) {
      console.error('Error deleting document:', err);
      showToast('Failed to delete document', 'error');
    }
  };

  // ============ TABS ============

  function setupTabs() {
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const tabName = tab.dataset.tab;

        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(t => t.style.display = 'none');

        tab.classList.add('active');
        document.getElementById(`tab-${tabName}`).style.display = 'block';
      });
    });
  }

  // ============ FILTERS ============

  function setupFilters() {
    // Job filter is handled by sidebar - see init()
    document.getElementById('typeFilter').addEventListener('change', loadPermits);
    document.getElementById('statusFilter').addEventListener('change', loadPermits);

    let debounceTimer;
    document.getElementById('searchInput').addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(renderTable, 150);
    });
  }

  // ============ INITIALIZATION ============

  async function init() {
    setupTabs();
    setupFilters();

    // Listen for job selection changes from the sidebar
    if (window.JobSidebar) {
      window.JobSidebar.onJobChange((jobId) => {
        selectedJobId = jobId || '';
        loadPermits();
      });
    }

    await Promise.all([
      loadJobs(),
      loadContacts(),
      loadStats()
    ]);

    // Initial load (sidebar will trigger loadPermits via onJobChange)
  }

  // Auto-init when DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

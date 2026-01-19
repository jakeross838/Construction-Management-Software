/**
 * Closeout Page JavaScript
 * Manages project closeout: punch lists, inspections, documents, lien waivers, packages
 */

// ============================================================
// STATE
// ============================================================
let jobs = [];
let vendors = [];
let punchItems = [];
let inspections = [];
let documents = [];
let lienWaivers = [];
let packages = [];
let currentPunch = null;
let currentInspection = null;
let currentDocument = null;
let currentWaiver = null;
let currentPackage = null;
let activeTab = 'punch-list';

// ============================================================
// INITIALIZATION
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
  setupTabs();
  setupFilters();
  setupSearch();

  try {
    await Promise.all([
      loadJobs().catch(err => console.error('Jobs failed:', err)),
      loadVendors().catch(err => console.error('Vendors failed:', err))
    ]);
  } catch (err) {
    console.error('Error loading reference data:', err);
  }

  await loadDashboardStats();
  await loadTabData();
});

// ============================================================
// TAB MANAGEMENT
// ============================================================
function setupTabs() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

      tab.classList.add('active');
      const tabId = tab.dataset.tab;
      activeTab = tabId;
      document.getElementById(`tab-${tabId}`).classList.add('active');

      updateFilterOptions();
      loadTabData();
    });
  });
}

function updateFilterOptions() {
  const statusFilter = document.getElementById('statusFilter');
  const categoryFilter = document.getElementById('categoryFilter');

  // Clear existing options
  statusFilter.innerHTML = '<option value="">All Statuses</option>';
  categoryFilter.innerHTML = '<option value="">All Categories</option>';

  switch (activeTab) {
    case 'punch-list':
      statusFilter.innerHTML += `
        <option value="open">Open</option>
        <option value="in_progress">In Progress</option>
        <option value="completed">Completed</option>
        <option value="verified">Verified</option>
      `;
      categoryFilter.style.display = '';
      categoryFilter.innerHTML += `
        <option value="electrical">Electrical</option>
        <option value="plumbing">Plumbing</option>
        <option value="hvac">HVAC</option>
        <option value="finish">Finish</option>
        <option value="structural">Structural</option>
        <option value="other">Other</option>
      `;
      break;
    case 'inspections':
      statusFilter.innerHTML += `
        <option value="scheduled">Scheduled</option>
        <option value="passed">Passed</option>
        <option value="failed">Failed</option>
        <option value="conditional">Conditional</option>
      `;
      categoryFilter.style.display = 'none';
      break;
    case 'documents':
      statusFilter.innerHTML += `
        <option value="required">Required</option>
        <option value="pending">Pending</option>
        <option value="submitted">Submitted</option>
        <option value="approved">Approved</option>
        <option value="rejected">Rejected</option>
      `;
      categoryFilter.style.display = '';
      categoryFilter.innerHTML += `
        <option value="architectural">Architectural</option>
        <option value="structural">Structural</option>
        <option value="mechanical">Mechanical</option>
        <option value="electrical">Electrical</option>
        <option value="plumbing">Plumbing</option>
        <option value="civil">Civil</option>
        <option value="general">General</option>
      `;
      break;
    case 'lien-waivers':
      statusFilter.innerHTML += `
        <option value="requested">Requested</option>
        <option value="received">Received</option>
        <option value="approved">Approved</option>
      `;
      categoryFilter.style.display = 'none';
      break;
    case 'packages':
      statusFilter.innerHTML += `
        <option value="draft">Draft</option>
        <option value="in_progress">In Progress</option>
        <option value="pending_review">Pending Review</option>
        <option value="completed">Completed</option>
      `;
      categoryFilter.style.display = 'none';
      break;
  }
}

async function loadTabData() {
  switch (activeTab) {
    case 'punch-list':
      await loadPunchList();
      break;
    case 'inspections':
      await loadInspections();
      break;
    case 'documents':
      await loadDocuments();
      break;
    case 'lien-waivers':
      await loadLienWaivers();
      break;
    case 'packages':
      await loadPackages();
      break;
  }
}

// ============================================================
// FILTER & SEARCH
// ============================================================
function setupFilters() {
  document.getElementById('jobFilter').addEventListener('change', () => loadTabData());
  document.getElementById('statusFilter').addEventListener('change', () => loadTabData());
  document.getElementById('categoryFilter').addEventListener('change', () => loadTabData());
  updateFilterOptions();
}

function setupSearch() {
  let debounceTimer;
  document.getElementById('searchInput').addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      loadTabData();
    }, 150);
  });
}

function getFilters() {
  return {
    job_id: document.getElementById('jobFilter').value,
    status: document.getElementById('statusFilter').value,
    category: document.getElementById('categoryFilter').value,
    search: document.getElementById('searchInput').value.toLowerCase()
  };
}

// ============================================================
// REFERENCE DATA
// ============================================================
async function loadJobs() {
  const res = await fetch('/api/jobs');
  jobs = await res.json();
  populateJobDropdowns();
}

async function loadVendors() {
  const res = await fetch('/api/vendors');
  vendors = await res.json();
  populateVendorDropdowns();
}

function populateJobDropdowns() {
  const selectors = ['jobFilter', 'punchJob', 'inspectionJob', 'documentJob', 'waiverJob', 'packageJob'];
  selectors.forEach(id => {
    const select = document.getElementById(id);
    if (select) {
      const currentValue = select.value;
      const firstOption = select.querySelector('option');
      select.innerHTML = '';
      if (firstOption) select.appendChild(firstOption);
      jobs.forEach(job => {
        const opt = document.createElement('option');
        opt.value = job.id;
        opt.textContent = job.name;
        select.appendChild(opt);
      });
      if (currentValue) select.value = currentValue;
    }
  });
}

function populateVendorDropdowns() {
  const selectors = ['punchVendor', 'documentVendor', 'waiverVendor'];
  selectors.forEach(id => {
    const select = document.getElementById(id);
    if (select) {
      const currentValue = select.value;
      const firstOption = select.querySelector('option');
      select.innerHTML = '';
      if (firstOption) select.appendChild(firstOption);
      vendors.forEach(vendor => {
        const opt = document.createElement('option');
        opt.value = vendor.id;
        opt.textContent = vendor.name;
        select.appendChild(opt);
      });
      if (currentValue) select.value = currentValue;
    }
  });
}

// ============================================================
// DASHBOARD STATS
// ============================================================
async function loadDashboardStats() {
  try {
    const jobId = document.getElementById('jobFilter').value;
    const params = jobId ? `?job_id=${jobId}` : '';
    const res = await fetch(`/api/closeout/dashboard${params}`);
    const stats = await res.json();

    document.getElementById('statPunchOpen').textContent = stats.punch_list?.open || 0;
    document.getElementById('statPunchCompleted').textContent = stats.punch_list?.completed || 0;
    document.getElementById('statInspScheduled').textContent = stats.inspections?.scheduled || 0;
    document.getElementById('statDocsPending').textContent = stats.documents?.pending || 0;
    document.getElementById('statWaiversPending').textContent = stats.lien_waivers?.requested || 0;
  } catch (err) {
    console.error('Error loading dashboard stats:', err);
  }
}

// ============================================================
// PUNCH LIST
// ============================================================
async function loadPunchList() {
  const container = document.getElementById('punchList');
  const filters = getFilters();

  let url = '/api/closeout/punch-list?';
  if (filters.job_id) url += `job_id=${filters.job_id}&`;
  if (filters.status) url += `status=${filters.status}&`;
  if (filters.category) url += `category=${filters.category}&`;

  try {
    const res = await fetch(url);
    punchItems = await res.json();

    // Apply search filter
    let filtered = punchItems;
    if (filters.search) {
      filtered = punchItems.filter(item =>
        item.title?.toLowerCase().includes(filters.search) ||
        item.item_number?.toLowerCase().includes(filters.search) ||
        item.location?.toLowerCase().includes(filters.search)
      );
    }

    renderPunchList(filtered);
  } catch (err) {
    console.error('Error loading punch list:', err);
    container.innerHTML = '<div class="error-state">Error loading punch list items</div>';
  }
}

function renderPunchList(items) {
  const container = document.getElementById('punchList');
  const emptyState = document.getElementById('emptyState');

  if (items.length === 0) {
    container.innerHTML = '';
    emptyState.style.display = 'block';
    return;
  }

  emptyState.style.display = 'none';

  container.innerHTML = items.map(item => `
    <div class="list-card" onclick="openPunchDetail('${item.id}')">
      <div class="list-card-header">
        <span class="list-card-number">${item.item_number || 'PLI-????'}</span>
        <span class="badge badge-${getPriorityClass(item.priority)}">${item.priority || 'medium'}</span>
        <span class="badge badge-${getStatusClass(item.status)}">${formatStatus(item.status)}</span>
      </div>
      <div class="list-card-title">${item.title}</div>
      <div class="list-card-meta">
        <span>${item.job?.name || 'No Job'}</span>
        ${item.location ? `<span>${item.location}</span>` : ''}
        ${item.category ? `<span>${formatCategory(item.category)}</span>` : ''}
      </div>
      ${item.due_date ? `<div class="list-card-date">Due: ${formatDate(item.due_date)}</div>` : ''}
    </div>
  `).join('');
}

async function openPunchDetail(id) {
  try {
    const res = await fetch(`/api/closeout/punch-list/${id}`);
    currentPunch = await res.json();

    document.getElementById('detailPunchNumber').textContent = currentPunch.item_number || 'PLI-????';
    document.getElementById('detailPunchStatus').textContent = formatStatus(currentPunch.status);
    document.getElementById('detailPunchStatus').className = `badge badge-${getStatusClass(currentPunch.status)}`;
    document.getElementById('detailPunchPriority').textContent = currentPunch.priority || 'medium';
    document.getElementById('detailPunchPriority').className = `badge badge-${getPriorityClass(currentPunch.priority)}`;
    document.getElementById('detailPunchTitle').textContent = currentPunch.title;
    document.getElementById('detailPunchDescription').textContent = currentPunch.description || '-';
    document.getElementById('detailPunchJob').textContent = currentPunch.job?.name || '-';
    document.getElementById('detailPunchCategory').textContent = formatCategory(currentPunch.category);
    document.getElementById('detailPunchTrade').textContent = currentPunch.trade || '-';
    document.getElementById('detailPunchLocation').textContent = currentPunch.location || '-';
    document.getElementById('detailPunchRoom').textContent = currentPunch.room || '-';
    document.getElementById('detailPunchVendor').textContent = currentPunch.vendor?.name || '-';
    document.getElementById('detailPunchDueDate').textContent = currentPunch.due_date ? formatDate(currentPunch.due_date) : '-';
    document.getElementById('detailPunchEstCost').textContent = currentPunch.estimated_cost ? formatCurrency(currentPunch.estimated_cost) : '-';
    document.getElementById('detailPunchBackCharge').textContent = currentPunch.back_charge ? 'Yes' : 'No';

    // Update button visibility
    const completeBtn = document.getElementById('completePunchBtn');
    const verifyBtn = document.getElementById('verifyPunchBtn');
    if (currentPunch.status === 'completed') {
      completeBtn.style.display = 'none';
      verifyBtn.style.display = '';
    } else if (currentPunch.status === 'verified') {
      completeBtn.style.display = 'none';
      verifyBtn.style.display = 'none';
    } else {
      completeBtn.style.display = '';
      verifyBtn.style.display = 'none';
    }

    // Render photos
    renderPunchPhotos(currentPunch.photos || []);

    const modal = document.getElementById('punchDetailModal');
    modal.style.display = 'flex';
    modal.classList.add('show');
  } catch (err) {
    console.error('Error loading punch item:', err);
    showToast('Error loading punch item', 'error');
  }
}

function renderPunchPhotos(photos) {
  const container = document.getElementById('punchPhotos');
  if (photos.length === 0) {
    container.innerHTML = '<p class="text-muted">No photos attached</p>';
    return;
  }
  container.innerHTML = photos.map(photo => `
    <div class="photo-item">
      <img src="${photo.file_url}" alt="${photo.caption || 'Photo'}">
      <span class="photo-type">${photo.photo_type}</span>
    </div>
  `).join('');
}

function closePunchDetailModal() {
  const modal = document.getElementById('punchDetailModal');
  modal.classList.remove('show');
  modal.style.display = 'none';
  currentPunch = null;
}

function editCurrentPunch() {
  if (!currentPunch) return;
  closePunchDetailModal();
  openPunchModal(currentPunch);
}

function openPunchModal(punch = null) {
  const modal = document.getElementById('punchModal');
  const title = document.getElementById('punchModalTitle');

  if (punch) {
    title.textContent = 'Edit Punch List Item';
    document.getElementById('punchId').value = punch.id;
    document.getElementById('punchJob').value = punch.job_id || '';
    document.getElementById('punchPriority').value = punch.priority || 'medium';
    document.getElementById('punchTitle').value = punch.title || '';
    document.getElementById('punchCategory').value = punch.category || '';
    document.getElementById('punchTrade').value = punch.trade || '';
    document.getElementById('punchLocation').value = punch.location || '';
    document.getElementById('punchRoom').value = punch.room || '';
    document.getElementById('punchVendor').value = punch.assigned_vendor_id || '';
    document.getElementById('punchDueDate').value = punch.due_date || '';
    document.getElementById('punchDescription').value = punch.description || '';
    document.getElementById('punchEstCost').value = punch.estimated_cost || '';
    document.getElementById('punchBackCharge').checked = punch.back_charge || false;
    document.getElementById('punchNotes').value = punch.notes || '';
  } else {
    title.textContent = 'New Punch List Item';
    document.getElementById('punchForm').reset();
    document.getElementById('punchId').value = '';
  }

  modal.style.display = 'flex';
  modal.classList.add('show');
}

function closePunchModal() {
  const modal = document.getElementById('punchModal');
  modal.classList.remove('show');
  modal.style.display = 'none';
}

async function savePunchItem() {
  const id = document.getElementById('punchId').value;
  const data = {
    job_id: document.getElementById('punchJob').value,
    priority: document.getElementById('punchPriority').value,
    title: document.getElementById('punchTitle').value,
    category: document.getElementById('punchCategory').value || null,
    trade: document.getElementById('punchTrade').value || null,
    location: document.getElementById('punchLocation').value || null,
    room: document.getElementById('punchRoom').value || null,
    assigned_vendor_id: document.getElementById('punchVendor').value || null,
    due_date: document.getElementById('punchDueDate').value || null,
    description: document.getElementById('punchDescription').value || null,
    estimated_cost: document.getElementById('punchEstCost').value || null,
    back_charge: document.getElementById('punchBackCharge').checked,
    notes: document.getElementById('punchNotes').value || null
  };

  if (!data.job_id || !data.title) {
    showToast('Job and title are required', 'error');
    return;
  }

  try {
    const url = id ? `/api/closeout/punch-list/${id}` : '/api/closeout/punch-list';
    const method = id ? 'PATCH' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!res.ok) throw new Error('Failed to save');

    showToast(id ? 'Punch item updated' : 'Punch item created', 'success');
    closePunchModal();
    await loadPunchList();
    await loadDashboardStats();
  } catch (err) {
    console.error('Error saving punch item:', err);
    showToast('Error saving punch item', 'error');
  }
}

async function completePunchItem() {
  if (!currentPunch) return;

  try {
    const res = await fetch(`/api/closeout/punch-list/${currentPunch.id}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });

    if (!res.ok) throw new Error('Failed to complete');

    showToast('Punch item marked complete', 'success');
    closePunchDetailModal();
    await loadPunchList();
    await loadDashboardStats();
  } catch (err) {
    console.error('Error completing punch item:', err);
    showToast('Error completing punch item', 'error');
  }
}

async function verifyPunchItem() {
  if (!currentPunch) return;

  try {
    const res = await fetch(`/api/closeout/punch-list/${currentPunch.id}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });

    if (!res.ok) throw new Error('Failed to verify');

    showToast('Punch item verified', 'success');
    closePunchDetailModal();
    await loadPunchList();
    await loadDashboardStats();
  } catch (err) {
    console.error('Error verifying punch item:', err);
    showToast('Error verifying punch item', 'error');
  }
}

async function deletePunchItem() {
  if (!currentPunch) return;
  if (!confirm('Are you sure you want to delete this punch list item?')) return;

  try {
    const res = await fetch(`/api/closeout/punch-list/${currentPunch.id}`, {
      method: 'DELETE'
    });

    if (!res.ok) throw new Error('Failed to delete');

    showToast('Punch item deleted', 'success');
    closePunchDetailModal();
    await loadPunchList();
    await loadDashboardStats();
  } catch (err) {
    console.error('Error deleting punch item:', err);
    showToast('Error deleting punch item', 'error');
  }
}

// ============================================================
// INSPECTIONS
// ============================================================
async function loadInspections() {
  const container = document.getElementById('inspectionList');
  const filters = getFilters();

  let url = '/api/closeout/inspections?';
  if (filters.job_id) url += `job_id=${filters.job_id}&`;
  if (filters.status) url += `status=${filters.status}&`;

  try {
    const res = await fetch(url);
    inspections = await res.json();

    // Apply search filter
    let filtered = inspections;
    if (filters.search) {
      filtered = inspections.filter(insp =>
        insp.name?.toLowerCase().includes(filters.search) ||
        insp.inspection_number?.toLowerCase().includes(filters.search) ||
        insp.inspection_type?.toLowerCase().includes(filters.search)
      );
    }

    renderInspections(filtered);
  } catch (err) {
    console.error('Error loading inspections:', err);
    container.innerHTML = '<div class="error-state">Error loading inspections</div>';
  }
}

function renderInspections(items) {
  const container = document.getElementById('inspectionList');
  const emptyState = document.getElementById('emptyState');

  if (items.length === 0) {
    container.innerHTML = '';
    emptyState.style.display = 'block';
    return;
  }

  emptyState.style.display = 'none';

  container.innerHTML = items.map(insp => `
    <div class="list-card" onclick="openInspectionDetail('${insp.id}')">
      <div class="list-card-header">
        <span class="list-card-number">${insp.inspection_number || 'INS-????'}</span>
        <span class="badge badge-${getInspectionTypeClass(insp.inspection_type)}">${insp.inspection_type}</span>
        <span class="badge badge-${getInspectionStatusClass(insp.status)}">${formatStatus(insp.status)}</span>
      </div>
      <div class="list-card-title">${insp.name}</div>
      <div class="list-card-meta">
        <span>${insp.job?.name || 'No Job'}</span>
        ${insp.inspector_agency ? `<span>${insp.inspector_agency}</span>` : ''}
      </div>
      ${insp.scheduled_date ? `<div class="list-card-date">Scheduled: ${formatDate(insp.scheduled_date)}</div>` : ''}
    </div>
  `).join('');
}

async function openInspectionDetail(id) {
  try {
    const res = await fetch(`/api/closeout/inspections/${id}`);
    currentInspection = await res.json();
    // Could open a detail modal - for now just open edit
    openInspectionModal(currentInspection);
  } catch (err) {
    console.error('Error loading inspection:', err);
    showToast('Error loading inspection', 'error');
  }
}

function openInspectionModal(inspection = null) {
  const modal = document.getElementById('inspectionModal');
  const title = document.getElementById('inspectionModalTitle');

  if (inspection) {
    title.textContent = 'Edit Inspection';
    document.getElementById('inspectionId').value = inspection.id;
    document.getElementById('inspectionJob').value = inspection.job_id || '';
    document.getElementById('inspectionType').value = inspection.inspection_type || '';
    document.getElementById('inspectionName').value = inspection.name || '';
    document.getElementById('inspectionDate').value = inspection.scheduled_date || '';
    document.getElementById('inspectionPermit').value = inspection.permit_number || '';
    document.getElementById('inspectorName').value = inspection.inspector_name || '';
    document.getElementById('inspectorAgency').value = inspection.inspector_agency || '';
    document.getElementById('inspectorPhone').value = inspection.inspector_phone || '';
    document.getElementById('inspectorEmail').value = inspection.inspector_email || '';
    document.getElementById('inspectionDescription').value = inspection.description || '';
    document.getElementById('inspectionNotes').value = inspection.notes || '';
  } else {
    title.textContent = 'Schedule Inspection';
    document.getElementById('inspectionForm').reset();
    document.getElementById('inspectionId').value = '';
  }

  modal.style.display = 'flex';
  modal.classList.add('show');
}

function closeInspectionModal() {
  const modal = document.getElementById('inspectionModal');
  modal.classList.remove('show');
  modal.style.display = 'none';
}

async function saveInspection() {
  const id = document.getElementById('inspectionId').value;
  const data = {
    job_id: document.getElementById('inspectionJob').value,
    inspection_type: document.getElementById('inspectionType').value,
    name: document.getElementById('inspectionName').value,
    scheduled_date: document.getElementById('inspectionDate').value || null,
    permit_number: document.getElementById('inspectionPermit').value || null,
    inspector_name: document.getElementById('inspectorName').value || null,
    inspector_agency: document.getElementById('inspectorAgency').value || null,
    inspector_phone: document.getElementById('inspectorPhone').value || null,
    inspector_email: document.getElementById('inspectorEmail').value || null,
    description: document.getElementById('inspectionDescription').value || null,
    notes: document.getElementById('inspectionNotes').value || null
  };

  if (!data.job_id || !data.name || !data.inspection_type) {
    showToast('Job, name, and type are required', 'error');
    return;
  }

  try {
    const url = id ? `/api/closeout/inspections/${id}` : '/api/closeout/inspections';
    const method = id ? 'PATCH' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!res.ok) throw new Error('Failed to save');

    showToast(id ? 'Inspection updated' : 'Inspection scheduled', 'success');
    closeInspectionModal();
    await loadInspections();
    await loadDashboardStats();
  } catch (err) {
    console.error('Error saving inspection:', err);
    showToast('Error saving inspection', 'error');
  }
}

function openInspectionResultModal(inspectionId) {
  document.getElementById('resultInspectionId').value = inspectionId;
  document.getElementById('inspectionResultForm').reset();
  document.getElementById('resultDate').value = new Date().toISOString().split('T')[0];

  const modal = document.getElementById('inspectionResultModal');
  modal.style.display = 'flex';
  modal.classList.add('show');
}

function closeInspectionResultModal() {
  const modal = document.getElementById('inspectionResultModal');
  modal.classList.remove('show');
  modal.style.display = 'none';
}

async function saveInspectionResult() {
  const id = document.getElementById('resultInspectionId').value;
  const data = {
    status: document.getElementById('resultStatus').value,
    inspection_date: document.getElementById('resultDate').value,
    result_notes: document.getElementById('resultNotes').value || null,
    conditions: document.getElementById('resultConditions').value || null,
    reinspection_required: document.getElementById('resultReinspection').checked,
    reinspection_date: document.getElementById('resultReinspectionDate').value || null,
    certificate_number: document.getElementById('resultCertNumber').value || null
  };

  if (!data.status || !data.inspection_date) {
    showToast('Result and date are required', 'error');
    return;
  }

  try {
    const res = await fetch(`/api/closeout/inspections/${id}/record-result`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!res.ok) throw new Error('Failed to save');

    showToast('Inspection result recorded', 'success');
    closeInspectionResultModal();
    await loadInspections();
    await loadDashboardStats();
  } catch (err) {
    console.error('Error saving inspection result:', err);
    showToast('Error saving result', 'error');
  }
}

// ============================================================
// DOCUMENTS
// ============================================================
async function loadDocuments() {
  const container = document.getElementById('documentList');
  const filters = getFilters();

  let url = '/api/closeout/documents?';
  if (filters.job_id) url += `job_id=${filters.job_id}&`;
  if (filters.status) url += `status=${filters.status}&`;
  if (filters.category) url += `category=${filters.category}&`;

  try {
    const res = await fetch(url);
    documents = await res.json();

    // Apply search filter
    let filtered = documents;
    if (filters.search) {
      filtered = documents.filter(doc =>
        doc.name?.toLowerCase().includes(filters.search) ||
        doc.document_type?.toLowerCase().includes(filters.search)
      );
    }

    renderDocuments(filtered);
  } catch (err) {
    console.error('Error loading documents:', err);
    container.innerHTML = '<div class="error-state">Error loading documents</div>';
  }
}

function renderDocuments(items) {
  const container = document.getElementById('documentList');
  const emptyState = document.getElementById('emptyState');

  if (items.length === 0) {
    container.innerHTML = '';
    emptyState.style.display = 'block';
    return;
  }

  emptyState.style.display = 'none';

  container.innerHTML = items.map(doc => `
    <div class="list-card" onclick="openDocumentDetail('${doc.id}')">
      <div class="list-card-header">
        <span class="badge badge-${getDocTypeClass(doc.document_type)}">${formatDocType(doc.document_type)}</span>
        <span class="badge badge-${getDocStatusClass(doc.status)}">${formatStatus(doc.status)}</span>
      </div>
      <div class="list-card-title">${doc.name}</div>
      <div class="list-card-meta">
        <span>${doc.job?.name || 'No Job'}</span>
        ${doc.vendor?.name ? `<span>From: ${doc.vendor.name}</span>` : ''}
        ${doc.category ? `<span>${formatCategory(doc.category)}</span>` : ''}
      </div>
      ${doc.due_date ? `<div class="list-card-date">Due: ${formatDate(doc.due_date)}</div>` : ''}
    </div>
  `).join('');
}

async function openDocumentDetail(id) {
  try {
    const res = await fetch(`/api/closeout/documents/${id}`);
    currentDocument = await res.json();
    openDocumentModal(currentDocument);
  } catch (err) {
    console.error('Error loading document:', err);
    showToast('Error loading document', 'error');
  }
}

function openDocumentModal(doc = null) {
  const modal = document.getElementById('documentModal');
  const title = document.getElementById('documentModalTitle');

  if (doc) {
    title.textContent = 'Edit Document';
    document.getElementById('documentId').value = doc.id;
    document.getElementById('documentJob').value = doc.job_id || '';
    document.getElementById('documentType').value = doc.document_type || '';
    document.getElementById('documentName').value = doc.name || '';
    document.getElementById('documentCategory').value = doc.category || '';
    document.getElementById('documentVendor').value = doc.vendor_id || '';
    document.getElementById('documentDueDate').value = doc.due_date || '';
    document.getElementById('documentExpDate').value = doc.expiration_date || '';
    document.getElementById('documentDescription').value = doc.description || '';
    document.getElementById('documentNotes').value = doc.notes || '';
  } else {
    title.textContent = 'Add Document Requirement';
    document.getElementById('documentForm').reset();
    document.getElementById('documentId').value = '';
  }

  modal.style.display = 'flex';
  modal.classList.add('show');
}

function closeDocumentModal() {
  const modal = document.getElementById('documentModal');
  modal.classList.remove('show');
  modal.style.display = 'none';
}

async function saveDocument() {
  const id = document.getElementById('documentId').value;
  const data = {
    job_id: document.getElementById('documentJob').value,
    document_type: document.getElementById('documentType').value,
    name: document.getElementById('documentName').value,
    category: document.getElementById('documentCategory').value || null,
    vendor_id: document.getElementById('documentVendor').value || null,
    due_date: document.getElementById('documentDueDate').value || null,
    expiration_date: document.getElementById('documentExpDate').value || null,
    description: document.getElementById('documentDescription').value || null,
    notes: document.getElementById('documentNotes').value || null
  };

  if (!data.job_id || !data.name || !data.document_type) {
    showToast('Job, name, and type are required', 'error');
    return;
  }

  try {
    const url = id ? `/api/closeout/documents/${id}` : '/api/closeout/documents';
    const method = id ? 'PATCH' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!res.ok) throw new Error('Failed to save');

    showToast(id ? 'Document updated' : 'Document requirement added', 'success');
    closeDocumentModal();
    await loadDocuments();
    await loadDashboardStats();
  } catch (err) {
    console.error('Error saving document:', err);
    showToast('Error saving document', 'error');
  }
}

// ============================================================
// LIEN WAIVERS
// ============================================================
async function loadLienWaivers() {
  const container = document.getElementById('waiverList');
  const filters = getFilters();

  let url = '/api/closeout/lien-waivers?';
  if (filters.job_id) url += `job_id=${filters.job_id}&`;
  if (filters.status) url += `status=${filters.status}&`;

  try {
    const res = await fetch(url);
    lienWaivers = await res.json();

    // Apply search filter
    let filtered = lienWaivers;
    if (filters.search) {
      filtered = lienWaivers.filter(waiver =>
        waiver.vendor_name?.toLowerCase().includes(filters.search) ||
        waiver.waiver_number?.toLowerCase().includes(filters.search)
      );
    }

    renderLienWaivers(filtered);
  } catch (err) {
    console.error('Error loading lien waivers:', err);
    container.innerHTML = '<div class="error-state">Error loading lien waivers</div>';
  }
}

function renderLienWaivers(items) {
  const container = document.getElementById('waiverList');
  const emptyState = document.getElementById('emptyState');

  if (items.length === 0) {
    container.innerHTML = '';
    emptyState.style.display = 'block';
    return;
  }

  emptyState.style.display = 'none';

  container.innerHTML = items.map(waiver => `
    <div class="list-card" onclick="openWaiverDetail('${waiver.id}')">
      <div class="list-card-header">
        <span class="list-card-number">${waiver.waiver_number || 'LW-????'}</span>
        <span class="badge">${waiver.waiver_type}</span>
        <span class="badge">${waiver.scope}</span>
        <span class="badge badge-${getWaiverStatusClass(waiver.status)}">${formatStatus(waiver.status)}</span>
      </div>
      <div class="list-card-title">${waiver.vendor_name}</div>
      <div class="list-card-meta">
        <span>${waiver.job?.name || 'No Job'}</span>
        ${waiver.amount ? `<span>${formatCurrency(waiver.amount)}</span>` : ''}
      </div>
      ${waiver.through_date ? `<div class="list-card-date">Through: ${formatDate(waiver.through_date)}</div>` : ''}
    </div>
  `).join('');
}

async function openWaiverDetail(id) {
  try {
    const res = await fetch(`/api/closeout/lien-waivers/${id}`);
    currentWaiver = await res.json();
    openWaiverModal(currentWaiver);
  } catch (err) {
    console.error('Error loading waiver:', err);
    showToast('Error loading lien waiver', 'error');
  }
}

function openWaiverModal(waiver = null) {
  const modal = document.getElementById('waiverModal');
  const title = document.getElementById('waiverModalTitle');

  if (waiver) {
    title.textContent = 'Edit Lien Waiver';
    document.getElementById('waiverId').value = waiver.id;
    document.getElementById('waiverJob').value = waiver.job_id || '';
    document.getElementById('waiverVendor').value = waiver.vendor_id || '';
    document.getElementById('waiverVendorName').value = waiver.vendor_name || '';
    document.getElementById('waiverType').value = waiver.waiver_type || 'conditional';
    document.getElementById('waiverScope').value = waiver.scope || 'progress';
    document.getElementById('waiverThroughDate').value = waiver.through_date || '';
    document.getElementById('waiverAmount').value = waiver.amount || '';
    document.getElementById('waiverExceptions').value = waiver.exceptions || '';
    document.getElementById('waiverNotes').value = waiver.notes || '';
  } else {
    title.textContent = 'Request Lien Waiver';
    document.getElementById('waiverForm').reset();
    document.getElementById('waiverId').value = '';
  }

  modal.style.display = 'flex';
  modal.classList.add('show');
}

function closeWaiverModal() {
  const modal = document.getElementById('waiverModal');
  modal.classList.remove('show');
  modal.style.display = 'none';
}

async function saveWaiver() {
  const id = document.getElementById('waiverId').value;
  const data = {
    job_id: document.getElementById('waiverJob').value,
    vendor_id: document.getElementById('waiverVendor').value || null,
    vendor_name: document.getElementById('waiverVendorName').value,
    waiver_type: document.getElementById('waiverType').value,
    scope: document.getElementById('waiverScope').value,
    through_date: document.getElementById('waiverThroughDate').value || null,
    amount: document.getElementById('waiverAmount').value || null,
    exceptions: document.getElementById('waiverExceptions').value || null,
    notes: document.getElementById('waiverNotes').value || null
  };

  if (!data.job_id || !data.vendor_name) {
    showToast('Job and vendor name are required', 'error');
    return;
  }

  try {
    const url = id ? `/api/closeout/lien-waivers/${id}` : '/api/closeout/lien-waivers';
    const method = id ? 'PATCH' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!res.ok) throw new Error('Failed to save');

    showToast(id ? 'Lien waiver updated' : 'Lien waiver requested', 'success');
    closeWaiverModal();
    await loadLienWaivers();
    await loadDashboardStats();
  } catch (err) {
    console.error('Error saving waiver:', err);
    showToast('Error saving lien waiver', 'error');
  }
}

// ============================================================
// PACKAGES
// ============================================================
async function loadPackages() {
  const container = document.getElementById('packageList');
  const filters = getFilters();

  let url = '/api/closeout/packages?';
  if (filters.job_id) url += `job_id=${filters.job_id}&`;
  if (filters.status) url += `status=${filters.status}&`;

  try {
    const res = await fetch(url);
    packages = await res.json();

    // Apply search filter
    let filtered = packages;
    if (filters.search) {
      filtered = packages.filter(pkg =>
        pkg.name?.toLowerCase().includes(filters.search) ||
        pkg.package_number?.toLowerCase().includes(filters.search)
      );
    }

    renderPackages(filtered);
  } catch (err) {
    console.error('Error loading packages:', err);
    container.innerHTML = '<div class="error-state">Error loading packages</div>';
  }
}

function renderPackages(items) {
  const container = document.getElementById('packageList');
  const emptyState = document.getElementById('emptyState');

  if (items.length === 0) {
    container.innerHTML = '';
    emptyState.style.display = 'block';
    return;
  }

  emptyState.style.display = 'none';

  container.innerHTML = items.map(pkg => {
    const progress = pkg.total_items > 0 ? Math.round((pkg.completed_items / pkg.total_items) * 100) : 0;
    return `
      <div class="list-card" onclick="openPackageDetail('${pkg.id}')">
        <div class="list-card-header">
          <span class="list-card-number">${pkg.package_number || 'CLO-????'}</span>
          <span class="badge badge-${getPackageStatusClass(pkg.status)}">${formatStatus(pkg.status)}</span>
        </div>
        <div class="list-card-title">${pkg.name}</div>
        <div class="list-card-meta">
          <span>${pkg.job?.name || 'No Job'}</span>
          <span>${pkg.completed_items}/${pkg.total_items} items (${progress}%)</span>
        </div>
        ${pkg.target_completion_date ? `<div class="list-card-date">Target: ${formatDate(pkg.target_completion_date)}</div>` : ''}
        <div class="progress-bar" style="margin-top: 8px;">
          <div class="progress-fill" style="width: ${progress}%"></div>
        </div>
      </div>
    `;
  }).join('');
}

async function openPackageDetail(id) {
  try {
    const res = await fetch(`/api/closeout/packages/${id}`);
    currentPackage = await res.json();
    openPackageModal(currentPackage);
  } catch (err) {
    console.error('Error loading package:', err);
    showToast('Error loading package', 'error');
  }
}

function openPackageModal(pkg = null) {
  const modal = document.getElementById('packageModal');
  const title = document.getElementById('packageModalTitle');

  if (pkg) {
    title.textContent = 'Edit Closeout Package';
    document.getElementById('packageId').value = pkg.id;
    document.getElementById('packageJob').value = pkg.job_id || '';
    document.getElementById('packageName').value = pkg.name || '';
    document.getElementById('packageTargetDate').value = pkg.target_completion_date || '';
    document.getElementById('packageDescription').value = pkg.description || '';
    document.getElementById('packageNotes').value = pkg.notes || '';
  } else {
    title.textContent = 'New Closeout Package';
    document.getElementById('packageForm').reset();
    document.getElementById('packageId').value = '';
  }

  modal.style.display = 'flex';
  modal.classList.add('show');
}

function closePackageModal() {
  const modal = document.getElementById('packageModal');
  modal.classList.remove('show');
  modal.style.display = 'none';
}

async function savePackage() {
  const id = document.getElementById('packageId').value;
  const data = {
    job_id: document.getElementById('packageJob').value,
    name: document.getElementById('packageName').value,
    target_completion_date: document.getElementById('packageTargetDate').value || null,
    description: document.getElementById('packageDescription').value || null,
    notes: document.getElementById('packageNotes').value || null
  };

  if (!data.job_id || !data.name) {
    showToast('Job and name are required', 'error');
    return;
  }

  try {
    const url = id ? `/api/closeout/packages/${id}` : '/api/closeout/packages';
    const method = id ? 'PATCH' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!res.ok) throw new Error('Failed to save');

    showToast(id ? 'Package updated' : 'Package created', 'success');
    closePackageModal();
    await loadPackages();
  } catch (err) {
    console.error('Error saving package:', err);
    showToast('Error saving package', 'error');
  }
}

// ============================================================
// GLOBAL CREATE MODAL
// ============================================================
function openCreateModal() {
  switch (activeTab) {
    case 'punch-list':
      openPunchModal();
      break;
    case 'inspections':
      openInspectionModal();
      break;
    case 'documents':
      openDocumentModal();
      break;
    case 'lien-waivers':
      openWaiverModal();
      break;
    case 'packages':
      openPackageModal();
      break;
  }
}

// ============================================================
// UTILITIES
// ============================================================
function formatDate(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

function formatStatus(status) {
  if (!status) return '-';
  return status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function formatCategory(category) {
  if (!category) return '-';
  return category.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function formatDocType(type) {
  const types = {
    'as_built': 'As-Built',
    'o_and_m': 'O&M Manual',
    'warranty': 'Warranty',
    'certificate': 'Certificate',
    'lien_waiver': 'Lien Waiver',
    'training': 'Training',
    'permit': 'Permit',
    'other': 'Other'
  };
  return types[type] || type || '-';
}

function getStatusClass(status) {
  const classes = {
    'open': 'warning',
    'in_progress': 'info',
    'completed': 'success',
    'verified': 'success',
    'rejected': 'danger'
  };
  return classes[status] || 'secondary';
}

function getPriorityClass(priority) {
  const classes = {
    'low': 'secondary',
    'medium': 'info',
    'high': 'warning',
    'critical': 'danger'
  };
  return classes[priority] || 'secondary';
}

function getInspectionTypeClass(type) {
  return 'info';
}

function getInspectionStatusClass(status) {
  const classes = {
    'scheduled': 'info',
    'passed': 'success',
    'failed': 'danger',
    'conditional': 'warning',
    'cancelled': 'secondary'
  };
  return classes[status] || 'secondary';
}

function getDocTypeClass(type) {
  return 'info';
}

function getDocStatusClass(status) {
  const classes = {
    'required': 'warning',
    'pending': 'info',
    'submitted': 'info',
    'approved': 'success',
    'rejected': 'danger'
  };
  return classes[status] || 'secondary';
}

function getWaiverStatusClass(status) {
  const classes = {
    'requested': 'warning',
    'received': 'info',
    'approved': 'success'
  };
  return classes[status] || 'secondary';
}

function getPackageStatusClass(status) {
  const classes = {
    'draft': 'secondary',
    'in_progress': 'info',
    'pending_review': 'warning',
    'completed': 'success'
  };
  return classes[status] || 'secondary';
}

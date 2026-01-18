// ============================================================
// DOCUMENTS APP - Ross Built CMS
// ============================================================

let state = {
  documents: [],
  vendors: [],
  currentJobId: null,
  currentCategory: '',
  searchQuery: '',
  stats: null,
  selectedFile: null,
  currentDocVersions: [],
  selectedVersionFile: null,
  compareVersions: []
};

// Category icons
const categoryIcons = {
  contracts: '📝',
  plans: '📐',
  permits: '📋',
  insurance: '🛡️',
  proposals: '💼',
  specs: '📑',
  invoices: '🧾',
  warranties: '✅',
  correspondence: '✉️',
  photos: '📷',
  other: '📄'
};

// File type icons
const fileTypeIcons = {
  'application/pdf': '📕',
  'image/jpeg': '🖼️',
  'image/png': '🖼️',
  'image/webp': '🖼️',
  'application/msword': '📘',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '📘',
  'application/vnd.ms-excel': '📗',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '📗',
  'text/plain': '📄',
  'text/csv': '📊'
};

// ============================================================
// INITIALIZATION
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
  await loadVendors();

  // Sidebar integration
  if (window.JobSidebar) {
    window.JobSidebar.onJobChange((jobId) => {
      state.currentJobId = jobId;
      state.currentCategory = '';
      loadDocuments();
    });

    state.currentJobId = window.JobSidebar.getSelectedJobId();
  }

  // Setup drag and drop
  setupDragAndDrop();

  // Load documents if job selected
  if (state.currentJobId) {
    await loadDocuments();
  } else {
    showNoJobSelected();
  }
});

// ============================================================
// DATA LOADING
// ============================================================

async function loadVendors() {
  try {
    const res = await fetch('/api/vendors');
    state.vendors = await res.json();
  } catch (err) {
    console.error('Failed to load vendors:', err);
  }
}

async function loadDocuments() {
  if (!state.currentJobId) {
    showNoJobSelected();
    return;
  }

  try {
    let url = `/api/documents?job_id=${state.currentJobId}`;
    if (state.currentCategory) {
      url += `&category=${state.currentCategory}`;
    }

    const [docsRes, statsRes] = await Promise.all([
      fetch(url),
      fetch(`/api/documents/stats/${state.currentJobId}`)
    ]);

    state.documents = await docsRes.json();
    state.stats = await statsRes.json();

    renderDocuments();
    updateStats();
    checkExpiringDocs();
  } catch (err) {
    console.error('Failed to load documents:', err);
    showToast('Failed to load documents', 'error');
  }
}

// ============================================================
// RENDERING
// ============================================================

function showNoJobSelected() {
  document.getElementById('noJobSelected').style.display = 'flex';
  document.getElementById('emptyState').style.display = 'none';
  document.getElementById('docGrid').style.display = 'none';
  document.getElementById('categoryTabs').style.display = 'none';
  document.getElementById('docToolbar').style.display = 'none';
  document.getElementById('uploadBtn').style.display = 'none';
  document.getElementById('expiringAlert').style.display = 'none';
}

function renderDocuments() {
  document.getElementById('noJobSelected').style.display = 'none';
  document.getElementById('categoryTabs').style.display = 'flex';
  document.getElementById('docToolbar').style.display = 'flex';
  document.getElementById('uploadBtn').style.display = '';

  // Update active category tab
  document.querySelectorAll('.category-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.category === state.currentCategory);
  });

  // Filter by search
  let filtered = state.documents;
  if (state.searchQuery) {
    const q = state.searchQuery.toLowerCase();
    filtered = filtered.filter(doc =>
      doc.name?.toLowerCase().includes(q) ||
      doc.description?.toLowerCase().includes(q) ||
      doc.file_name?.toLowerCase().includes(q)
    );
  }

  if (filtered.length === 0) {
    document.getElementById('emptyState').style.display = 'flex';
    document.getElementById('docGrid').style.display = 'none';
    return;
  }

  document.getElementById('emptyState').style.display = 'none';
  document.getElementById('docGrid').style.display = 'grid';

  const grid = document.getElementById('docGrid');
  grid.innerHTML = filtered.map(doc => renderDocCard(doc)).join('');
}

function renderDocCard(doc) {
  const icon = categoryIcons[doc.category] || '📄';
  const fileIcon = fileTypeIcons[doc.mime_type] || '📄';
  const dateStr = doc.document_date ? formatDate(doc.document_date) : '';
  const isExpiring = doc.expiration_date && isExpiringSoon(doc.expiration_date);
  const isImage = doc.mime_type?.startsWith('image/');

  return `
    <div class="doc-card ${isExpiring ? 'doc-expiring' : ''}" onclick="openDetailModal('${doc.id}')">
      <div class="doc-card-preview">
        ${isImage ? `<img src="${doc.file_url}" alt="${doc.name}" class="doc-thumbnail">` : `<span class="doc-icon">${fileIcon}</span>`}
      </div>
      <div class="doc-card-body">
        <div class="doc-card-category">
          <span class="category-icon">${icon}</span>
          <span class="category-name">${formatCategory(doc.category)}</span>
        </div>
        <div class="doc-card-name">${escapeHtml(doc.name)}</div>
        ${doc.vendor?.name ? `<div class="doc-card-vendor">${escapeHtml(doc.vendor.name)}</div>` : ''}
        <div class="doc-card-meta">
          ${dateStr ? `<span>${dateStr}</span>` : ''}
          ${doc.expiration_date ? `<span class="${isExpiring ? 'text-warning' : ''}">Exp: ${formatDate(doc.expiration_date)}</span>` : ''}
        </div>
      </div>
      ${isExpiring ? '<div class="doc-expiring-badge">Expiring Soon</div>' : ''}
    </div>
  `;
}

function updateStats() {
  const count = state.documents.length;
  document.getElementById('docCount').textContent = `${count} document${count !== 1 ? 's' : ''}`;
}

function checkExpiringDocs() {
  if (state.stats?.expiring_soon?.length > 0) {
    document.getElementById('expiringAlert').style.display = 'flex';
    document.getElementById('expiringText').textContent =
      `${state.stats.expiring_soon.length} document${state.stats.expiring_soon.length !== 1 ? 's' : ''} expiring soon`;
  } else {
    document.getElementById('expiringAlert').style.display = 'none';
  }
}

// ============================================================
// FILTERS
// ============================================================

function filterByCategory(category) {
  state.currentCategory = category;
  loadDocuments();
}

function applySearch() {
  state.searchQuery = document.getElementById('searchInput').value;
  renderDocuments();
}

function showExpiringDocs() {
  // Filter to show only expiring documents
  state.currentCategory = '';
  document.getElementById('searchInput').value = '';
  state.searchQuery = '';

  // Temporarily filter to expiring docs
  const expiringIds = state.stats.expiring_soon.map(d => d.id);
  const original = state.documents;
  state.documents = original.filter(d => expiringIds.includes(d.id));
  renderDocuments();
  state.documents = original;
}

// ============================================================
// DRAG AND DROP
// ============================================================

function setupDragAndDrop() {
  const dropZone = document.getElementById('dropZone');

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFile(files[0]);
    }
  });
}

function handleFileSelect(event) {
  const file = event.target.files[0];
  if (file) {
    handleFile(file);
  }
}

function handleFile(file) {
  state.selectedFile = file;

  // Show preview
  const icon = fileTypeIcons[file.type] || '📄';
  document.getElementById('previewIcon').textContent = icon;
  document.getElementById('previewName').textContent = file.name;
  document.getElementById('previewSize').textContent = formatFileSize(file.size);

  document.getElementById('dropZone').style.display = 'none';
  document.getElementById('filePreview').style.display = 'flex';
  document.getElementById('uploadForm').style.display = 'block';
  document.getElementById('uploadSubmitBtn').disabled = false;

  // Pre-fill name from filename
  const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
  document.getElementById('docName').value = nameWithoutExt;
}

function clearFile() {
  state.selectedFile = null;
  document.getElementById('fileInput').value = '';
  document.getElementById('dropZone').style.display = 'flex';
  document.getElementById('filePreview').style.display = 'none';
  document.getElementById('uploadForm').style.display = 'none';
  document.getElementById('uploadSubmitBtn').disabled = true;
}

// ============================================================
// UPLOAD MODAL
// ============================================================

function openUploadModal() {
  if (!state.currentJobId) {
    showToast('Please select a job first', 'error');
    return;
  }

  // Reset form
  clearFile();
  document.getElementById('docName').value = '';
  document.getElementById('docCategory').value = '';
  document.getElementById('docDate').value = '';
  document.getElementById('docExpiration').value = '';
  document.getElementById('docDescription').value = '';

  // Init vendor picker
  const vendorContainer = document.getElementById('docVendorContainer');
  if (window.SearchablePicker) {
    window.SearchablePicker.init(vendorContainer, {
      type: 'vendors',
      placeholder: 'Select vendor...'
    });
  }

  const modal = document.getElementById('uploadModal');
  modal.style.display = 'flex';
  modal.classList.add('show');
}

function closeUploadModal() {
  const modal = document.getElementById('uploadModal');
  modal.classList.remove('show');
  modal.style.display = 'none';
  clearFile();
}

async function uploadDocument() {
  if (!state.selectedFile) {
    showToast('Please select a file', 'error');
    return;
  }

  const name = document.getElementById('docName').value.trim();
  const category = document.getElementById('docCategory').value;

  if (!name) {
    showToast('Document name is required', 'error');
    return;
  }

  if (!category) {
    showToast('Category is required', 'error');
    return;
  }

  const vendorPicker = document.querySelector('#docVendorContainer .search-picker-value');
  const vendorId = vendorPicker?.value || null;

  const formData = new FormData();
  formData.append('file', state.selectedFile);
  formData.append('job_id', state.currentJobId);
  formData.append('name', name);
  formData.append('category', category);
  formData.append('description', document.getElementById('docDescription').value.trim() || '');
  formData.append('document_date', document.getElementById('docDate').value || '');
  formData.append('expiration_date', document.getElementById('docExpiration').value || '');
  if (vendorId) formData.append('vendor_id', vendorId);
  formData.append('uploaded_by', 'User');

  try {
    document.getElementById('uploadSubmitBtn').disabled = true;
    document.getElementById('uploadSubmitBtn').textContent = 'Uploading...';

    const res = await fetch('/api/documents/upload', {
      method: 'POST',
      body: formData
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Upload failed');
    }

    closeUploadModal();
    await loadDocuments();
    showToast('Document uploaded', 'success');
  } catch (err) {
    console.error('Upload error:', err);
    showToast(err.message, 'error');
  } finally {
    document.getElementById('uploadSubmitBtn').disabled = false;
    document.getElementById('uploadSubmitBtn').textContent = 'Upload';
  }
}

// ============================================================
// DETAIL MODAL
// ============================================================

async function openDetailModal(docId) {
  try {
    const res = await fetch(`/api/documents/${docId}`);
    if (!res.ok) throw new Error('Failed to load document');

    const doc = await res.json();

    document.getElementById('detailDocId').value = doc.id;
    document.getElementById('detailModalTitle').textContent = doc.name;
    document.getElementById('detailName').value = doc.name;
    document.getElementById('detailCategory').value = doc.category;
    document.getElementById('detailDate').value = doc.document_date || '';
    document.getElementById('detailExpiration').value = doc.expiration_date || '';
    document.getElementById('detailDescription').value = doc.description || '';
    document.getElementById('detailDownloadBtn').href = doc.file_url;

    // Preview
    const previewEl = document.getElementById('detailPreview');
    if (doc.mime_type?.startsWith('image/')) {
      previewEl.innerHTML = `<img src="${doc.file_url}" alt="${doc.name}" class="detail-image">`;
    } else if (doc.mime_type === 'application/pdf') {
      previewEl.innerHTML = `<a href="${doc.file_url}" target="_blank" class="pdf-preview-link">📕 View PDF</a>`;
    } else {
      const icon = fileTypeIcons[doc.mime_type] || '📄';
      previewEl.innerHTML = `<span class="detail-icon">${icon}</span>`;
    }

    // Meta info
    const meta = [];
    if (doc.file_name) meta.push(doc.file_name);
    if (doc.file_size) meta.push(formatFileSize(doc.file_size));
    if (doc.uploaded_by) meta.push(`Uploaded by ${doc.uploaded_by}`);
    if (doc.created_at) meta.push(formatDateTime(doc.created_at));
    document.getElementById('detailMeta').textContent = meta.join(' • ');

    // Vendor picker
    const vendorContainer = document.getElementById('detailVendorContainer');
    if (window.SearchablePicker) {
      window.SearchablePicker.init(vendorContainer, {
        type: 'vendors',
        value: doc.vendor_id,
        placeholder: 'Select vendor...'
      });
    }

    const modal = document.getElementById('docDetailModal');
    modal.style.display = 'flex';
    modal.classList.add('show');
  } catch (err) {
    console.error('Failed to load document:', err);
    showToast('Failed to load document', 'error');
  }
}

function closeDetailModal() {
  const modal = document.getElementById('docDetailModal');
  modal.classList.remove('show');
  modal.style.display = 'none';
}

async function saveDocumentDetails() {
  const docId = document.getElementById('detailDocId').value;
  const vendorPicker = document.querySelector('#detailVendorContainer .search-picker-value');

  const updates = {
    name: document.getElementById('detailName').value.trim(),
    category: document.getElementById('detailCategory').value,
    document_date: document.getElementById('detailDate').value || null,
    expiration_date: document.getElementById('detailExpiration').value || null,
    description: document.getElementById('detailDescription').value.trim() || null,
    vendor_id: vendorPicker?.value || null
  };

  if (!updates.name) {
    showToast('Document name is required', 'error');
    return;
  }

  try {
    const res = await fetch(`/api/documents/${docId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to save');
    }

    closeDetailModal();
    await loadDocuments();
    showToast('Document updated', 'success');
  } catch (err) {
    console.error('Save error:', err);
    showToast(err.message, 'error');
  }
}

async function deleteDocument() {
  const docId = document.getElementById('detailDocId').value;

  if (!confirm('Are you sure you want to delete this document?')) return;

  try {
    const res = await fetch(`/api/documents/${docId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deleted_by: 'User' })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to delete');
    }

    closeDetailModal();
    await loadDocuments();
    showToast('Document deleted', 'success');
  } catch (err) {
    console.error('Delete error:', err);
    showToast(err.message, 'error');
  }
}

// ============================================================
// HELPERS
// ============================================================

function formatCategory(cat) {
  const labels = {
    contracts: 'Contract',
    plans: 'Plans',
    permits: 'Permit',
    insurance: 'Insurance',
    proposals: 'Proposal',
    specs: 'Specs',
    invoices: 'Invoice',
    warranties: 'Warranty',
    correspondence: 'Correspondence',
    photos: 'Photo',
    other: 'Other'
  };
  return labels[cat] || cat;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function formatFileSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function isExpiringSoon(dateStr) {
  if (!dateStr) return false;
  const expDate = new Date(dateStr);
  const now = new Date();
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;
  return expDate > now && expDate - now < thirtyDays;
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ============================================================
// VERSION MANAGEMENT
// ============================================================

function switchDetailTab(tabId) {
  // Update tab buttons
  document.querySelectorAll('#docDetailModal .tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.tab === tabId);
  });

  // Update tab content
  document.querySelectorAll('#docDetailModal .tab-content').forEach(content => {
    content.classList.toggle('active', content.id === `tab-${tabId}`);
  });

  // Load versions when switching to versions tab
  if (tabId === 'versions') {
    loadVersionHistory();
  }
}

async function loadVersionHistory() {
  const docId = document.getElementById('detailDocId').value;
  if (!docId) return;

  try {
    const res = await fetch(`/api/documents/${docId}/versions`);
    if (!res.ok) throw new Error('Failed to load versions');

    state.currentDocVersions = await res.json();
    renderVersionList();
  } catch (err) {
    console.error('Failed to load versions:', err);
    document.getElementById('versionList').innerHTML = `
      <div class="empty-state">
        <p>Failed to load version history</p>
      </div>
    `;
  }
}

function renderVersionList() {
  const list = document.getElementById('versionList');

  if (state.currentDocVersions.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <p>No version history available</p>
      </div>
    `;
    return;
  }

  list.innerHTML = state.currentDocVersions.map(version => {
    const isCurrent = version.is_current;
    const icon = fileTypeIcons[version.mime_type] || '📄';

    return `
      <div class="version-item ${isCurrent ? 'version-current' : ''}" data-version-id="${version.id}">
        <div class="version-icon">${icon}</div>
        <div class="version-info">
          <div class="version-title">
            <span class="version-number">Version ${version.version_number}</span>
            ${isCurrent ? '<span class="version-badge">Current</span>' : ''}
          </div>
          <div class="version-meta">
            ${formatDateTime(version.created_at)} • ${formatFileSize(version.file_size)} • ${escapeHtml(version.uploaded_by || 'Unknown')}
          </div>
        </div>
        <div class="version-actions">
          <a href="${version.file_url}" target="_blank" class="btn btn-sm btn-secondary" title="View">View</a>
          <button class="btn btn-sm btn-secondary" onclick="toggleVersionCompare('${version.id}')" title="Compare">Compare</button>
          ${!isCurrent ? `<button class="btn btn-sm btn-primary" onclick="rollbackToVersion('${version.id}', ${version.version_number})">Rollback</button>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function toggleVersionCompare(versionId) {
  const index = state.compareVersions.indexOf(versionId);

  if (index >= 0) {
    // Remove from comparison
    state.compareVersions.splice(index, 1);
    document.querySelector(`[data-version-id="${versionId}"]`)?.classList.remove('version-selected');
  } else if (state.compareVersions.length < 2) {
    // Add to comparison
    state.compareVersions.push(versionId);
    document.querySelector(`[data-version-id="${versionId}"]`)?.classList.add('version-selected');
  } else {
    showToast('Select at most 2 versions to compare', 'error');
    return;
  }

  // Open comparison modal when 2 versions selected
  if (state.compareVersions.length === 2) {
    openVersionCompareModal();
  }
}

function openVersionCompareModal() {
  const [leftId, rightId] = state.compareVersions;
  const leftVersion = state.currentDocVersions.find(v => v.id === leftId);
  const rightVersion = state.currentDocVersions.find(v => v.id === rightId);

  if (!leftVersion || !rightVersion) {
    showToast('Could not find selected versions', 'error');
    return;
  }

  // Set titles
  document.getElementById('compareLeftTitle').textContent = `Version ${leftVersion.version_number}`;
  document.getElementById('compareRightTitle').textContent = `Version ${rightVersion.version_number}`;

  // Set previews
  document.getElementById('compareLeftPreview').innerHTML = getVersionPreviewHtml(leftVersion);
  document.getElementById('compareRightPreview').innerHTML = getVersionPreviewHtml(rightVersion);

  // Set metadata
  document.getElementById('compareLeftMeta').innerHTML = getVersionMetaHtml(leftVersion);
  document.getElementById('compareRightMeta').innerHTML = getVersionMetaHtml(rightVersion);

  const modal = document.getElementById('versionCompareModal');
  modal.style.display = 'flex';
  modal.classList.add('show');
}

function getVersionPreviewHtml(version) {
  if (version.mime_type?.startsWith('image/')) {
    return `<img src="${version.file_url}" alt="Version ${version.version_number}" class="compare-image">`;
  } else if (version.mime_type === 'application/pdf') {
    return `<a href="${version.file_url}" target="_blank" class="pdf-preview-link">📕 View PDF</a>`;
  } else {
    const icon = fileTypeIcons[version.mime_type] || '📄';
    return `<span class="compare-icon">${icon}</span><a href="${version.file_url}" target="_blank">Open File</a>`;
  }
}

function getVersionMetaHtml(version) {
  return `
    <div class="meta-row"><strong>File:</strong> ${escapeHtml(version.file_name)}</div>
    <div class="meta-row"><strong>Size:</strong> ${formatFileSize(version.file_size)}</div>
    <div class="meta-row"><strong>Uploaded:</strong> ${formatDateTime(version.created_at)}</div>
    <div class="meta-row"><strong>By:</strong> ${escapeHtml(version.uploaded_by || 'Unknown')}</div>
    ${version.is_current ? '<div class="meta-row"><strong>Status:</strong> <span class="version-badge">Current</span></div>' : ''}
  `;
}

function closeVersionCompareModal() {
  const modal = document.getElementById('versionCompareModal');
  modal.classList.remove('show');
  modal.style.display = 'none';

  // Clear selection
  state.compareVersions = [];
  document.querySelectorAll('.version-selected').forEach(el => el.classList.remove('version-selected'));
}

async function rollbackToVersion(versionId, versionNumber) {
  if (!confirm(`Rollback to Version ${versionNumber}? This will make it the current version.`)) return;

  try {
    const res = await fetch(`/api/documents/${versionId}/rollback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rolled_back_by: 'User' })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Rollback failed');
    }

    showToast(`Rolled back to Version ${versionNumber}`, 'success');
    await loadVersionHistory();
    await loadDocuments();
  } catch (err) {
    console.error('Rollback error:', err);
    showToast(err.message, 'error');
  }
}

// ============================================================
// UPLOAD NEW VERSION
// ============================================================

function openUploadVersionModal() {
  clearVersionFile();

  const modal = document.getElementById('uploadVersionModal');
  modal.style.display = 'flex';
  modal.classList.add('show');

  // Setup drag and drop for version upload
  setupVersionDragAndDrop();
}

function closeUploadVersionModal() {
  const modal = document.getElementById('uploadVersionModal');
  modal.classList.remove('show');
  modal.style.display = 'none';
  clearVersionFile();
}

function setupVersionDragAndDrop() {
  const dropZone = document.getElementById('versionDropZone');

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleVersionFile(files[0]);
    }
  });
}

function handleVersionFileSelect(event) {
  const file = event.target.files[0];
  if (file) {
    handleVersionFile(file);
  }
}

function handleVersionFile(file) {
  state.selectedVersionFile = file;

  const icon = fileTypeIcons[file.type] || '📄';
  document.getElementById('versionPreviewIcon').textContent = icon;
  document.getElementById('versionPreviewName').textContent = file.name;
  document.getElementById('versionPreviewSize').textContent = formatFileSize(file.size);

  document.getElementById('versionDropZone').style.display = 'none';
  document.getElementById('versionFilePreview').style.display = 'flex';
  document.getElementById('uploadVersionBtn').disabled = false;
}

function clearVersionFile() {
  state.selectedVersionFile = null;
  document.getElementById('versionFileInput').value = '';
  document.getElementById('versionDropZone').style.display = 'flex';
  document.getElementById('versionFilePreview').style.display = 'none';
  document.getElementById('uploadVersionBtn').disabled = true;
}

async function uploadNewVersion() {
  if (!state.selectedVersionFile) {
    showToast('Please select a file', 'error');
    return;
  }

  const docId = document.getElementById('detailDocId').value;
  if (!docId) {
    showToast('No document selected', 'error');
    return;
  }

  const formData = new FormData();
  formData.append('file', state.selectedVersionFile);
  formData.append('uploaded_by', 'User');

  try {
    document.getElementById('uploadVersionBtn').disabled = true;
    document.getElementById('uploadVersionBtn').textContent = 'Uploading...';

    const res = await fetch(`/api/documents/${docId}/versions`, {
      method: 'POST',
      body: formData
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Upload failed');
    }

    closeUploadVersionModal();
    await loadVersionHistory();
    await loadDocuments();
    showToast('New version uploaded', 'success');
  } catch (err) {
    console.error('Version upload error:', err);
    showToast(err.message, 'error');
  } finally {
    document.getElementById('uploadVersionBtn').disabled = false;
    document.getElementById('uploadVersionBtn').textContent = 'Upload Version';
  }
}

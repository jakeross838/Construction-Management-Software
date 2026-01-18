/**
 * Photos Management
 * Handles photo gallery, upload, editing, and lightbox viewing
 */

let photos = [];
let jobs = [];
let currentFilters = { job_id: null, category: 'all', search: '', start_date: null, end_date: null };
let lightboxIndex = 0;
let uploadQueue = [];
let currentPhoto = null;
let debounceTimer;

// ============================================================
// INITIALIZATION
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
  setupEventListeners();
  setupDragAndDrop();

  try {
    await Promise.all([
      loadJobs().catch(err => console.error('Jobs failed:', err))
    ]);
  } catch (err) {
    showToast('Some data failed to load', 'error');
  }

  await loadPhotos();
  await loadStats();
});

function setupEventListeners() {
  // Filter change handlers
  document.getElementById('jobFilter').addEventListener('change', applyFilters);
  document.getElementById('categoryFilter').addEventListener('change', applyFilters);
  document.getElementById('startDate').addEventListener('change', applyFilters);
  document.getElementById('endDate').addEventListener('change', applyFilters);

  // Search with debounce
  document.getElementById('searchInput').addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    const clearBtn = document.getElementById('searchClear');
    clearBtn.style.display = e.target.value ? 'block' : 'none';
    debounceTimer = setTimeout(() => applyFilters(), 150);
  });

  // Close modals on escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeUploadModal();
      closeEditModal();
      closeLightbox();
    }
    // Lightbox navigation
    if (document.getElementById('lightbox').classList.contains('show')) {
      if (e.key === 'ArrowLeft') navigateLightbox(-1);
      if (e.key === 'ArrowRight') navigateLightbox(1);
    }
  });

  // Close modals on backdrop click
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeUploadModal();
        closeEditModal();
      }
    });
  });

  // Close lightbox on backdrop click
  document.getElementById('lightbox').addEventListener('click', (e) => {
    if (e.target.classList.contains('lightbox-image-container')) {
      closeLightbox();
    }
  });
}

function setupDragAndDrop() {
  const dropZone = document.getElementById('dropZone');
  if (!dropZone) return;

  dropZone.addEventListener('dragenter', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });

  dropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    if (files.length > 0) {
      addFilesToQueue(files);
    }
  });
}

// ============================================================
// DATA LOADING
// ============================================================

async function loadJobs() {
  const response = await fetch('/api/jobs');
  jobs = await response.json();
  populateJobDropdowns();
}

function populateJobDropdowns() {
  const selectors = ['jobFilter', 'uploadJob'];
  selectors.forEach(id => {
    const select = document.getElementById(id);
    if (!select) return;

    const currentValue = select.value;
    const isFilter = id === 'jobFilter';

    select.innerHTML = `<option value="">${isFilter ? 'All Jobs' : 'Select Job...'}</option>`;
    jobs.forEach(job => {
      const option = document.createElement('option');
      option.value = job.id;
      option.textContent = job.name;
      select.appendChild(option);
    });

    if (currentValue) select.value = currentValue;
  });
}

async function loadPhotos() {
  const params = new URLSearchParams();
  const jobId = document.getElementById('jobFilter').value;
  const category = document.getElementById('categoryFilter').value;
  const search = document.getElementById('searchInput').value;
  const startDate = document.getElementById('startDate').value;
  const endDate = document.getElementById('endDate').value;

  if (jobId) params.append('job_id', jobId);
  if (category && category !== 'all') params.append('category', category);
  if (search) params.append('search', search);
  if (startDate) params.append('start_date', startDate);
  if (endDate) params.append('end_date', endDate);

  try {
    const response = await fetch(`/api/photos?${params}`);
    photos = await response.json();
    renderGallery();
  } catch (err) {
    console.error('Error loading photos:', err);
    showToast('Failed to load photos', 'error');
  }
}

async function loadStats() {
  const jobId = document.getElementById('jobFilter').value;
  const params = jobId ? `?job_id=${jobId}` : '';

  try {
    const response = await fetch(`/api/photos/stats${params}`);
    const stats = await response.json();
    renderStats(stats);
  } catch (err) {
    console.error('Error loading stats:', err);
  }
}

function applyFilters() {
  loadPhotos();
  loadStats();
}

function clearFilters() {
  document.getElementById('jobFilter').value = '';
  document.getElementById('categoryFilter').value = 'all';
  document.getElementById('searchInput').value = '';
  document.getElementById('startDate').value = '';
  document.getElementById('endDate').value = '';
  document.getElementById('searchClear').style.display = 'none';
  applyFilters();
}

function clearSearch() {
  document.getElementById('searchInput').value = '';
  document.getElementById('searchClear').style.display = 'none';
  applyFilters();
}

// ============================================================
// RENDERING
// ============================================================

function renderGallery() {
  const gallery = document.getElementById('photoGallery');
  const emptyState = document.getElementById('emptyState');

  if (photos.length === 0) {
    gallery.innerHTML = '';
    emptyState.style.display = 'block';
    return;
  }

  emptyState.style.display = 'none';
  gallery.innerHTML = photos.map((photo, index) => `
    <div class="photo-card" onclick="openLightbox(${index})">
      <img src="${photo.thumbnail_url || photo.file_url}" alt="${escapeHtml(photo.caption || '')}" loading="lazy">
      ${photo.category ? `<span class="category-badge ${photo.category}">${formatCategory(photo.category)}</span>` : ''}
      <div class="photo-overlay">
        <div class="caption">${escapeHtml(photo.caption || 'No caption')}</div>
        ${photo.location ? `<div class="location">${escapeHtml(photo.location)}</div>` : ''}
      </div>
    </div>
  `).join('');
}

function renderStats(stats) {
  document.getElementById('totalPhotos').textContent = stats.total || 0;
  document.getElementById('thisMonth').textContent = stats.this_month || 0;
  document.getElementById('linkedPhotos').textContent = stats.linked || 0;
}

// ============================================================
// UPLOAD MODAL
// ============================================================

function openUploadModal() {
  uploadQueue = [];
  document.getElementById('uploadJob').value = document.getElementById('jobFilter').value || '';
  document.getElementById('uploadCategory').value = 'progress';
  document.getElementById('uploadLocation').value = '';
  document.getElementById('uploadCaption').value = '';
  document.getElementById('filePreviewGrid').innerHTML = '';
  document.getElementById('uploadProgress').style.display = 'none';
  document.getElementById('uploadProgress').innerHTML = '';
  document.getElementById('uploadBtn').disabled = true;

  const modal = document.getElementById('uploadModal');
  modal.style.display = 'flex';
  modal.classList.add('show');
}

function closeUploadModal() {
  const modal = document.getElementById('uploadModal');
  modal.classList.remove('show');
  modal.style.display = 'none';
  uploadQueue = [];
}

function handleFileSelect(event) {
  const files = Array.from(event.target.files).filter(f => f.type.startsWith('image/'));
  if (files.length > 0) {
    addFilesToQueue(files);
  }
  event.target.value = '';
}

function addFilesToQueue(files) {
  files.forEach(file => {
    if (!uploadQueue.find(f => f.name === file.name && f.size === file.size)) {
      uploadQueue.push(file);
    }
  });
  renderFilePreview();
  document.getElementById('uploadBtn').disabled = uploadQueue.length === 0;
}

function removeFromQueue(index) {
  uploadQueue.splice(index, 1);
  renderFilePreview();
  document.getElementById('uploadBtn').disabled = uploadQueue.length === 0;
}

function renderFilePreview() {
  const grid = document.getElementById('filePreviewGrid');
  grid.innerHTML = uploadQueue.map((file, index) => {
    const url = URL.createObjectURL(file);
    return `
      <div class="file-preview-item">
        <img src="${url}" alt="${escapeHtml(file.name)}">
        <button class="remove-btn" onclick="removeFromQueue(${index})">&times;</button>
        <div class="file-name">${escapeHtml(file.name)}</div>
      </div>
    `;
  }).join('');
}

async function startUpload() {
  const jobId = document.getElementById('uploadJob').value;
  if (!jobId) {
    showToast('Please select a job', 'error');
    return;
  }

  if (uploadQueue.length === 0) {
    showToast('No files to upload', 'error');
    return;
  }

  const category = document.getElementById('uploadCategory').value;
  const location = document.getElementById('uploadLocation').value;
  const caption = document.getElementById('uploadCaption').value;

  document.getElementById('uploadBtn').disabled = true;
  document.getElementById('uploadProgress').style.display = 'block';
  document.getElementById('uploadProgress').innerHTML = uploadQueue.map((file, i) => `
    <div class="upload-item" id="upload-item-${i}">
      <span class="upload-item-name">${escapeHtml(file.name)}</span>
      <div class="upload-item-progress">
        <div class="upload-item-progress-bar" style="width: 0%"></div>
      </div>
      <span class="upload-item-status">Waiting</span>
    </div>
  `).join('');

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < uploadQueue.length; i++) {
    const file = uploadQueue[i];
    const itemEl = document.getElementById(`upload-item-${i}`);
    const progressBar = itemEl.querySelector('.upload-item-progress-bar');
    const statusEl = itemEl.querySelector('.upload-item-status');

    statusEl.textContent = 'Uploading';
    progressBar.style.width = '50%';

    try {
      const formData = new FormData();
      formData.append('photo', file);
      formData.append('job_id', jobId);
      formData.append('category', category);
      if (location) formData.append('location', location);
      if (caption) formData.append('caption', caption);
      formData.append('uploaded_by', 'User');

      const response = await fetch('/api/photos', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Upload failed');
      }

      progressBar.style.width = '100%';
      statusEl.textContent = 'Done';
      statusEl.classList.add('success');
      successCount++;
    } catch (err) {
      console.error('Upload error:', err);
      progressBar.style.width = '100%';
      progressBar.style.background = 'var(--danger)';
      statusEl.textContent = 'Failed';
      statusEl.classList.add('error');
      errorCount++;
    }
  }

  if (successCount > 0) {
    showToast(`${successCount} photo${successCount > 1 ? 's' : ''} uploaded`, 'success');
    await loadPhotos();
    await loadStats();
  }

  if (errorCount > 0) {
    showToast(`${errorCount} upload${errorCount > 1 ? 's' : ''} failed`, 'error');
  }

  setTimeout(() => {
    closeUploadModal();
  }, 1500);
}

// ============================================================
// EDIT MODAL
// ============================================================

async function openEditModal(photoId) {
  try {
    const response = await fetch(`/api/photos/${photoId}`);
    if (!response.ok) throw new Error('Failed to load photo');
    currentPhoto = await response.json();

    document.getElementById('editPhotoId').value = currentPhoto.id;
    document.getElementById('editCaption').value = currentPhoto.caption || '';
    document.getElementById('editCategory').value = currentPhoto.category || 'progress';
    document.getElementById('editLocation').value = currentPhoto.location || '';

    if (currentPhoto.taken_at) {
      const date = new Date(currentPhoto.taken_at);
      document.getElementById('editTakenAt').value = date.toISOString().slice(0, 16);
    } else {
      document.getElementById('editTakenAt').value = '';
    }

    // Render linked entities
    renderEditLinks();

    const modal = document.getElementById('editModal');
    modal.style.display = 'flex';
    modal.classList.add('show');
  } catch (err) {
    console.error('Error loading photo:', err);
    showToast('Failed to load photo details', 'error');
  }
}

function closeEditModal() {
  const modal = document.getElementById('editModal');
  modal.classList.remove('show');
  modal.style.display = 'none';
  currentPhoto = null;
}

function renderEditLinks() {
  const container = document.getElementById('editLinks');
  if (!currentPhoto || !currentPhoto.links || currentPhoto.links.length === 0) {
    container.innerHTML = '<p class="text-muted">No linked entities</p>';
    return;
  }

  container.innerHTML = currentPhoto.links.map(link => `
    <div class="lightbox-link-item">
      <span class="lightbox-link-icon">${getLinkIcon(link.entity_type)}</span>
      <span>${formatLinkType(link.entity_type)}</span>
      <button class="btn btn-sm btn-danger" onclick="unlinkEntity('${link.id}')" style="margin-left: auto;">Unlink</button>
    </div>
  `).join('');
}

async function savePhotoEdit() {
  if (!currentPhoto) return;

  const data = {
    caption: document.getElementById('editCaption').value || null,
    category: document.getElementById('editCategory').value,
    location: document.getElementById('editLocation').value || null,
    taken_at: document.getElementById('editTakenAt').value || null
  };

  try {
    const response = await fetch(`/api/photos/${currentPhoto.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to update photo');
    }

    showToast('Photo updated', 'success');
    closeEditModal();
    await loadPhotos();
  } catch (err) {
    console.error('Error updating photo:', err);
    showToast(err.message, 'error');
  }
}

async function deleteCurrentPhoto() {
  if (!currentPhoto) return;
  if (!confirm('Are you sure you want to delete this photo?')) return;

  try {
    const response = await fetch(`/api/photos/${currentPhoto.id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deleted_by: 'User' })
    });

    if (!response.ok) throw new Error('Failed to delete photo');

    showToast('Photo deleted', 'success');
    closeEditModal();
    await loadPhotos();
    await loadStats();
  } catch (err) {
    console.error('Error deleting photo:', err);
    showToast('Failed to delete photo', 'error');
  }
}

async function unlinkEntity(linkId) {
  if (!currentPhoto) return;

  try {
    const response = await fetch(`/api/photos/${currentPhoto.id}/links/${linkId}`, {
      method: 'DELETE'
    });

    if (!response.ok) throw new Error('Failed to unlink');

    showToast('Entity unlinked', 'success');
    await openEditModal(currentPhoto.id);
  } catch (err) {
    console.error('Error unlinking:', err);
    showToast('Failed to unlink entity', 'error');
  }
}

// ============================================================
// LIGHTBOX
// ============================================================

function openLightbox(index) {
  lightboxIndex = index;
  updateLightboxContent();

  const lightbox = document.getElementById('lightbox');
  lightbox.style.display = 'flex';
  // Trigger reflow for animation
  lightbox.offsetHeight;
  lightbox.classList.add('show');
}

function closeLightbox() {
  const lightbox = document.getElementById('lightbox');
  lightbox.classList.remove('show');
  setTimeout(() => {
    lightbox.style.display = 'none';
  }, 200);
}

function navigateLightbox(direction) {
  lightboxIndex = (lightboxIndex + direction + photos.length) % photos.length;
  updateLightboxContent();
}

function updateLightboxContent() {
  const photo = photos[lightboxIndex];
  if (!photo) return;

  document.getElementById('lightboxImage').src = photo.file_url;
  document.getElementById('lightboxCaption').textContent = photo.caption || '-';
  document.getElementById('lightboxLocation').textContent = photo.location || '-';
  document.getElementById('lightboxCategory').textContent = formatCategory(photo.category) || '-';
  document.getElementById('lightboxDate').textContent = photo.taken_at ? formatDate(photo.taken_at) : '-';
  document.getElementById('lightboxJob').textContent = photo.job?.name || '-';

  // Render links
  const linksContainer = document.getElementById('lightboxLinks');
  if (photo.links && photo.links.length > 0) {
    linksContainer.innerHTML = photo.links.map(link => `
      <div class="lightbox-link-item">
        <span class="lightbox-link-icon">${getLinkIcon(link.entity_type)}</span>
        <span>${formatLinkType(link.entity_type)}</span>
      </div>
    `).join('');
  } else {
    linksContainer.innerHTML = '<p class="text-muted" style="font-size: 13px;">No linked entities</p>';
  }
}

function openEditFromLightbox() {
  const photo = photos[lightboxIndex];
  if (photo) {
    closeLightbox();
    openEditModal(photo.id);
  }
}

async function deleteFromLightbox() {
  const photo = photos[lightboxIndex];
  if (!photo) return;
  if (!confirm('Are you sure you want to delete this photo?')) return;

  try {
    const response = await fetch(`/api/photos/${photo.id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deleted_by: 'User' })
    });

    if (!response.ok) throw new Error('Failed to delete photo');

    showToast('Photo deleted', 'success');
    closeLightbox();
    await loadPhotos();
    await loadStats();
  } catch (err) {
    console.error('Error deleting photo:', err);
    showToast('Failed to delete photo', 'error');
  }
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatCategory(category) {
  if (!category) return '';
  const categoryMap = {
    progress: 'Progress',
    exterior: 'Exterior',
    interior: 'Interior',
    detail: 'Detail',
    issue: 'Issue',
    completion: 'Completion'
  };
  return categoryMap[category] || category;
}

function getLinkIcon(entityType) {
  const iconMap = {
    inspection: '🔍',
    punch_item: '📌',
    daily_log: '📋'
  };
  return iconMap[entityType] || '🔗';
}

function formatLinkType(entityType) {
  const typeMap = {
    inspection: 'Inspection',
    punch_item: 'Punch Item',
    daily_log: 'Daily Log'
  };
  return typeMap[entityType] || entityType;
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function debounce(fn, delay) {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), delay);
  };
}

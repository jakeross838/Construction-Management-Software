/**
 * Visual Product Catalog JavaScript
 * Implements photo-driven browsing with category hierarchy, search, and filters
 */

// ============================================================
// STATE
// ============================================================

let allCategories = [];
let allVendors = [];
let allProducts = [];
let allJobs = [];
let currentCategoryId = null;
let currentProduct = null;
let viewMode = 'grid'; // 'grid' or 'list'

// ============================================================
// INITIALIZATION
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
  setupEventListeners();

  // Load reference data in parallel
  await Promise.all([
    loadCategories(),
    loadVendors(),
    loadJobs()
  ]);

  // Load products
  await loadProducts();
});

function setupEventListeners() {
  // Search with debounce
  let searchTimer;
  document.getElementById('searchInput').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => loadProducts(), 200);
  });

  // Filters
  document.getElementById('vendorFilter').addEventListener('change', loadProducts);
  document.getElementById('roomFilter').addEventListener('change', loadProducts);

  // Price range with debounce
  let priceTimer;
  ['minPrice', 'maxPrice'].forEach(id => {
    document.getElementById(id).addEventListener('input', () => {
      clearTimeout(priceTimer);
      priceTimer = setTimeout(() => loadProducts(), 300);
    });
  });

  // Clear filters
  document.getElementById('btnClearFilters').addEventListener('click', clearFilters);

  // View toggle
  document.getElementById('viewGrid').addEventListener('click', () => setViewMode('grid'));
  document.getElementById('viewList').addEventListener('click', () => setViewMode('list'));

  // Sidebar toggle
  document.getElementById('toggleSidebar').addEventListener('click', toggleSidebar);

  // Add to selection
  document.getElementById('btnAddToSelection').addEventListener('click', openAddSelectionModal);

  // Job selection changes allowances
  document.getElementById('selectionJob').addEventListener('change', loadJobAllowances);

  // Quantity changes total
  document.getElementById('selectionQty').addEventListener('input', updateSelectionTotal);

  // Close modals on outside click
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('show');
        modal.style.display = 'none';
      }
    });
  });

  // Product management buttons
  document.getElementById('btnAddProduct').addEventListener('click', openAddProductModal);
  document.getElementById('btnEditProduct').addEventListener('click', openEditProductModal);
  document.getElementById('btnArchiveProduct').addEventListener('click', archiveProduct);

  // Category management
  document.getElementById('btnManageCategories').addEventListener('click', openCategoryModal);

  // Image upload
  document.getElementById('imageInput').addEventListener('change', handleImageUpload);
}

// ============================================================
// DATA LOADING
// ============================================================

async function loadCategories() {
  try {
    const res = await fetch('/api/selections/categories');
    if (!res.ok) throw new Error('Failed to load categories');
    allCategories = await res.json();
    renderCategoryTree();
  } catch (err) {
    console.error('Failed to load categories:', err);
    showToast('Failed to load categories', 'error');
  }
}

async function loadVendors() {
  try {
    const res = await fetch('/api/vendors');
    if (!res.ok) throw new Error('Failed to load vendors');
    allVendors = await res.json();

    const vendorFilter = document.getElementById('vendorFilter');
    allVendors.forEach(v => {
      vendorFilter.innerHTML += `<option value="${v.id}">${escapeHtml(v.name)}</option>`;
    });
  } catch (err) {
    console.error('Failed to load vendors:', err);
  }
}

async function loadJobs() {
  try {
    const res = await fetch('/api/jobs');
    if (!res.ok) throw new Error('Failed to load jobs');
    allJobs = await res.json();

    const jobSelect = document.getElementById('selectionJob');
    allJobs.forEach(j => {
      jobSelect.innerHTML += `<option value="${j.id}">${escapeHtml(j.name)}</option>`;
    });
  } catch (err) {
    console.error('Failed to load jobs:', err);
  }
}

async function loadProducts() {
  const grid = document.getElementById('productGrid');
  const emptyState = document.getElementById('emptyState');

  // Show loading
  grid.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Loading products...</p></div>';
  emptyState.style.display = 'none';

  try {
    // Build query params
    const params = new URLSearchParams();

    if (currentCategoryId) params.append('category_id', currentCategoryId);

    const search = document.getElementById('searchInput').value.trim();
    if (search) params.append('search', search);

    const vendor = document.getElementById('vendorFilter').value;
    if (vendor) params.append('vendor_id', vendor);

    const room = document.getElementById('roomFilter').value;
    if (room) params.append('room', room);

    const minPrice = document.getElementById('minPrice').value;
    if (minPrice) params.append('min_price', minPrice);

    const maxPrice = document.getElementById('maxPrice').value;
    if (maxPrice) params.append('max_price', maxPrice);

    const res = await fetch(`/api/selections/catalog?${params.toString()}`);
    if (!res.ok) throw new Error('Failed to load products');
    allProducts = await res.json();

    renderProducts();
    updateResultCount();
  } catch (err) {
    console.error('Failed to load products:', err);
    showToast('Failed to load products', 'error');
    grid.innerHTML = '<div class="error-state"><p>Failed to load products</p></div>';
  }
}

async function loadJobAllowances() {
  const jobId = document.getElementById('selectionJob').value;
  const allowanceSelect = document.getElementById('selectionAllowance');

  allowanceSelect.innerHTML = '<option value="">Select an allowance</option>';

  if (!jobId) return;

  try {
    const res = await fetch(`/api/selections/allowances?job_id=${jobId}`);
    if (!res.ok) throw new Error('Failed to load allowances');
    const allowances = await res.json();

    allowances.forEach(a => {
      const variance = parseFloat(a.variance) || 0;
      const varianceText = variance > 0 ? ` (+$${Math.abs(variance).toFixed(0)} over)` :
                          variance < 0 ? ` ($${Math.abs(variance).toFixed(0)} remaining)` : '';
      allowanceSelect.innerHTML += `<option value="${a.id}">${escapeHtml(a.name)}${varianceText}</option>`;
    });
  } catch (err) {
    console.error('Failed to load allowances:', err);
    showToast('Failed to load allowances', 'error');
  }
}

// ============================================================
// RENDERING
// ============================================================

function renderCategoryTree() {
  const tree = document.getElementById('categoryTree');

  // All Products option
  let html = `
    <div class="category-item ${!currentCategoryId ? 'active' : ''}" data-category="" onclick="selectCategory('')">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="3" width="7" height="7"></rect>
        <rect x="14" y="3" width="7" height="7"></rect>
        <rect x="14" y="14" width="7" height="7"></rect>
        <rect x="3" y="14" width="7" height="7"></rect>
      </svg>
      <span>All Products</span>
    </div>
  `;

  // Build hierarchical categories
  allCategories.forEach(cat => {
    const hasChildren = cat.children && cat.children.length > 0;
    const isActive = currentCategoryId === cat.id;

    html += `
      <div class="category-parent ${hasChildren ? 'has-children' : ''} ${isActive ? 'active' : ''}">
        <div class="category-item" data-category="${cat.id}" onclick="selectCategory('${cat.id}')">
          <span class="category-icon">${getCategoryIcon(cat.name)}</span>
          <span>${escapeHtml(cat.name)}</span>
          ${hasChildren ? `
            <svg class="expand-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          ` : ''}
        </div>
        ${hasChildren ? `
          <div class="category-children">
            ${cat.children.map(child => `
              <div class="category-item child ${currentCategoryId === child.id ? 'active' : ''}"
                   data-category="${child.id}"
                   onclick="event.stopPropagation(); selectCategory('${child.id}')">
                <span>${escapeHtml(child.name)}</span>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `;
  });

  tree.innerHTML = html;
}

function renderProducts() {
  const grid = document.getElementById('productGrid');
  const emptyState = document.getElementById('emptyState');

  if (allProducts.length === 0) {
    grid.innerHTML = '';
    emptyState.style.display = 'flex';
    return;
  }

  emptyState.style.display = 'none';
  grid.className = `product-grid ${viewMode}`;

  grid.innerHTML = allProducts.map(product => {
    const primaryImage = product.images?.find(img => img.is_primary) || product.images?.[0];
    const imageUrl = primaryImage?.thumbnail_path || primaryImage?.storage_path || product.image_url;
    const thumbHash = primaryImage?.thumb_hash || product.thumb_hash;

    const price = parseFloat(product.unit_price) || 0;
    const unit = product.unit || 'each';

    return `
      <div class="product-card" onclick="openProductDetail('${product.id}')">
        <div class="product-image">
          ${imageUrl ? `
            <img src="${imageUrl}" alt="${escapeHtml(product.name)}"
                 onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
            <div class="image-placeholder" style="display: none;">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <circle cx="8.5" cy="8.5" r="1.5"></circle>
                <polyline points="21 15 16 10 5 21"></polyline>
              </svg>
            </div>
          ` : `
            <div class="image-placeholder">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <circle cx="8.5" cy="8.5" r="1.5"></circle>
                <polyline points="21 15 16 10 5 21"></polyline>
              </svg>
            </div>
          `}
          ${product.images?.length > 1 ? `
            <span class="image-count">${product.images.length} photos</span>
          ` : ''}
        </div>
        <div class="product-content">
          <div class="product-category">${escapeHtml(product.category?.name || 'Uncategorized')}</div>
          <h4 class="product-title">${escapeHtml(product.name)}</h4>
          ${product.vendor?.name ? `
            <div class="product-vendor">${escapeHtml(product.vendor.name)}</div>
          ` : ''}
          <div class="product-price">
            <span class="price">${formatCurrency(price)}</span>
            <span class="unit">/${unit}</span>
          </div>
          ${product.room ? `
            <div class="product-room">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
              </svg>
              ${escapeHtml(product.room)}
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function updateResultCount() {
  document.getElementById('resultCount').textContent =
    `${allProducts.length} product${allProducts.length !== 1 ? 's' : ''}`;

  // Update category name
  const categoryNameEl = document.getElementById('currentCategoryName');
  if (currentCategoryId) {
    const category = findCategoryById(currentCategoryId);
    categoryNameEl.textContent = category ? `in ${category.name}` : '';
  } else {
    categoryNameEl.textContent = '';
  }
}

function updateBreadcrumb() {
  const breadcrumb = document.getElementById('breadcrumb');
  let html = '<a href="#" class="breadcrumb-item" data-category="" onclick="selectCategory(\'\'); return false;">All Products</a>';

  if (currentCategoryId) {
    const category = findCategoryById(currentCategoryId);
    if (category) {
      // Check if it's a child category
      if (category.parent_id) {
        const parent = findCategoryById(category.parent_id);
        if (parent) {
          html += `
            <span class="breadcrumb-separator">/</span>
            <a href="#" class="breadcrumb-item" data-category="${parent.id}" onclick="selectCategory('${parent.id}'); return false;">${escapeHtml(parent.name)}</a>
          `;
        }
      }
      html += `
        <span class="breadcrumb-separator">/</span>
        <span class="breadcrumb-item active">${escapeHtml(category.name)}</span>
      `;
    }
  }

  breadcrumb.innerHTML = html;
}

// ============================================================
// CATEGORY NAVIGATION
// ============================================================

function selectCategory(categoryId) {
  currentCategoryId = categoryId || null;
  renderCategoryTree();
  updateBreadcrumb();
  loadProducts();
}

function findCategoryById(id) {
  for (const cat of allCategories) {
    if (cat.id === id) return cat;
    if (cat.children) {
      const child = cat.children.find(c => c.id === id);
      if (child) return { ...child, parent_id: cat.id };
    }
  }
  return null;
}

// ============================================================
// PRODUCT DETAIL MODAL
// ============================================================

async function openProductDetail(productId) {
  try {
    const res = await fetch(`/api/selections/catalog/${productId}`);
    if (!res.ok) throw new Error('Failed to load product');
    currentProduct = await res.json();

    renderProductDetail();

    const modal = document.getElementById('productModal');
    modal.style.display = 'flex';
    modal.classList.add('show');
  } catch (err) {
    console.error('Failed to load product:', err);
    showToast('Failed to load product details', 'error');
  }
}

function renderProductDetail() {
  const p = currentProduct;

  // Header
  document.getElementById('productName').textContent = p.name;
  document.getElementById('productCategory').textContent = p.category?.name || 'Uncategorized';
  document.getElementById('productVendor').textContent = p.vendor?.name || 'No vendor';
  document.getElementById('productVendor').style.display = p.vendor?.name ? 'inline-block' : 'none';

  // Pricing
  const price = parseFloat(p.unit_price) || 0;
  document.getElementById('productPrice').textContent = formatCurrency(price);
  document.getElementById('productUnit').textContent = `/${p.unit || 'each'}`;

  // Price meta
  let priceMeta = [];
  if (p.square_footage) priceMeta.push(`${p.square_footage} sq ft default`);
  if (p.quantity_default && p.quantity_default !== 1) priceMeta.push(`${p.quantity_default} ${p.unit || 'units'} default`);
  document.getElementById('priceMeta').textContent = priceMeta.join(' | ');

  // Details
  const detailsHtml = [
    { label: 'Model/SKU', value: p.model_number || p.sku },
    { label: 'Room', value: p.room },
    { label: 'Category', value: p.category?.name }
  ].filter(d => d.value).map(d => `
    <div class="detail-item">
      <span class="detail-label">${d.label}</span>
      <span class="detail-value">${escapeHtml(d.value)}</span>
    </div>
  `).join('');
  document.getElementById('productDetails').innerHTML = detailsHtml || '<p class="no-data">No details available</p>';

  // Specs
  const specsSection = document.getElementById('specsSection');
  if (p.specs && Object.keys(p.specs).length > 0) {
    specsSection.style.display = 'block';
    document.getElementById('productSpecs').innerHTML = Object.entries(p.specs).map(([key, value]) => `
      <div class="spec-item">
        <span class="spec-label">${escapeHtml(key.replace(/_/g, ' '))}</span>
        <span class="spec-value">${escapeHtml(String(value))}</span>
      </div>
    `).join('');
  } else {
    specsSection.style.display = 'none';
  }

  // Dimensions
  const dimensionsSection = document.getElementById('dimensionsSection');
  if (p.dimensions && Object.keys(p.dimensions).length > 0) {
    dimensionsSection.style.display = 'block';
    const d = p.dimensions;
    const unit = d.unit || 'in';
    let dimText = [];
    if (d.width) dimText.push(`W: ${d.width}${unit}`);
    if (d.height) dimText.push(`H: ${d.height}${unit}`);
    if (d.depth) dimText.push(`D: ${d.depth}${unit}`);
    document.getElementById('productDimensions').textContent = dimText.join(' x ') || 'Not specified';
  } else {
    dimensionsSection.style.display = 'none';
  }

  // Description
  const descriptionSection = document.getElementById('descriptionSection');
  if (p.description) {
    descriptionSection.style.display = 'block';
    document.getElementById('productDescription').textContent = p.description;
  } else {
    descriptionSection.style.display = 'none';
  }

  // Tags
  const tagsSection = document.getElementById('tagsSection');
  if (p.tags && p.tags.length > 0) {
    tagsSection.style.display = 'block';
    document.getElementById('productTags').innerHTML = p.tags.map(tag => `
      <span class="tag">${escapeHtml(tag)}</span>
    `).join('');
  } else {
    tagsSection.style.display = 'none';
  }

  // Gallery
  renderGallery();
}

function renderGallery() {
  const mainImage = document.getElementById('mainImage');
  const placeholder = document.getElementById('galleryPlaceholder');
  const thumbnails = document.getElementById('galleryThumbnails');

  const images = currentProduct.images || [];

  if (images.length === 0 && !currentProduct.image_url) {
    mainImage.style.display = 'none';
    placeholder.style.display = 'flex';
    thumbnails.innerHTML = '';
    return;
  }

  // Use images array or fallback to single image_url
  const allImages = images.length > 0 ? images : [{ storage_path: currentProduct.image_url, is_primary: true }];
  const primary = allImages.find(img => img.is_primary) || allImages[0];

  mainImage.src = primary.storage_path;
  mainImage.style.display = 'block';
  placeholder.style.display = 'none';

  // Thumbnails
  if (allImages.length > 1) {
    thumbnails.innerHTML = allImages.map((img, idx) => `
      <div class="gallery-thumb ${img.is_primary ? 'active' : ''}" onclick="selectGalleryImage(${idx})">
        <img src="${img.thumbnail_path || img.storage_path}" alt="Thumbnail ${idx + 1}">
      </div>
    `).join('');
  } else {
    thumbnails.innerHTML = '';
  }
}

function selectGalleryImage(index) {
  const images = currentProduct.images || [];
  if (index >= images.length) return;

  const img = images[index];
  document.getElementById('mainImage').src = img.storage_path;

  // Update active thumbnail
  document.querySelectorAll('.gallery-thumb').forEach((thumb, i) => {
    thumb.classList.toggle('active', i === index);
  });
}

function closeProductModal() {
  const modal = document.getElementById('productModal');
  modal.classList.remove('show');
  modal.style.display = 'none';
  currentProduct = null;
}

// ============================================================
// ADD TO SELECTION
// ============================================================

function openAddSelectionModal() {
  if (!currentProduct) return;

  document.getElementById('catalogItemId').value = currentProduct.id;
  document.getElementById('selectionQty').value = currentProduct.quantity_default || 1;
  document.getElementById('selectionUnit').value = currentProduct.unit || 'each';
  document.getElementById('selectionNotes').value = '';
  document.getElementById('selectionJob').value = '';
  document.getElementById('selectionAllowance').innerHTML = '<option value="">Select an allowance</option>';

  updateSelectionTotal();

  const modal = document.getElementById('addSelectionModal');
  modal.style.display = 'flex';
  modal.classList.add('show');
}

function closeAddSelectionModal() {
  const modal = document.getElementById('addSelectionModal');
  modal.classList.remove('show');
  modal.style.display = 'none';
}

function updateSelectionTotal() {
  if (!currentProduct) return;

  const qty = parseFloat(document.getElementById('selectionQty').value) || 0;
  const price = parseFloat(currentProduct.unit_price) || 0;
  const total = qty * price;

  document.getElementById('summaryUnitPrice').textContent = formatCurrency(price);
  document.getElementById('summaryTotal').textContent = formatCurrency(total);
}

async function saveSelection() {
  const catalogItemId = document.getElementById('catalogItemId').value;
  const allowanceId = document.getElementById('selectionAllowance').value;
  const quantity = parseFloat(document.getElementById('selectionQty').value) || 1;
  const notes = document.getElementById('selectionNotes').value.trim();

  if (!allowanceId) {
    showToast('Please select an allowance', 'error');
    return;
  }

  if (!currentProduct) {
    showToast('No product selected', 'error');
    return;
  }

  try {
    const res = await fetch('/api/selections/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        allowance_id: allowanceId,
        catalog_item_id: catalogItemId,
        name: currentProduct.name,
        description: currentProduct.description,
        model_number: currentProduct.model_number,
        vendor_name: currentProduct.vendor?.name,
        quantity,
        unit: currentProduct.unit || 'each',
        unit_price: parseFloat(currentProduct.unit_price) || 0,
        markup_percent: 0,
        image_url: currentProduct.image_url || currentProduct.images?.[0]?.storage_path,
        client_notes: notes
      })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to save selection');
    }

    showToast('Selection added successfully', 'success');
    closeAddSelectionModal();
    closeProductModal();
  } catch (err) {
    console.error('Failed to save selection:', err);
    showToast(err.message, 'error');
  }
}

// ============================================================
// UI CONTROLS
// ============================================================

function clearFilters() {
  document.getElementById('searchInput').value = '';
  document.getElementById('vendorFilter').value = '';
  document.getElementById('roomFilter').value = '';
  document.getElementById('minPrice').value = '';
  document.getElementById('maxPrice').value = '';
  currentCategoryId = null;
  renderCategoryTree();
  updateBreadcrumb();
  loadProducts();
}

function setViewMode(mode) {
  viewMode = mode;
  document.getElementById('viewGrid').classList.toggle('active', mode === 'grid');
  document.getElementById('viewList').classList.toggle('active', mode === 'list');
  renderProducts();
}

function toggleSidebar() {
  const sidebar = document.getElementById('categorySidebar');
  sidebar.classList.toggle('collapsed');
}

// ============================================================
// UTILITIES
// ============================================================

function getCategoryIcon(categoryName) {
  const icons = {
    Flooring: '🪵',
    Cabinets: '🗄️',
    Countertops: '🔲',
    Appliances: '🍳',
    'Plumbing Fixtures': '🚿',
    Lighting: '💡',
    Hardware: '🔩',
    'Paint Colors': '🎨',
    Tile: '🔳',
    Doors: '🚪',
    Windows: '🪟',
    Landscaping: '🌿',
    Other: '📦'
  };
  return icons[categoryName] || '📦';
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(amount || 0);
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function showToast(message, type = 'info') {
  if (typeof window.showToast === 'function') {
    window.showToast(message, type);
  } else {
    console.log(`[${type}] ${message}`);
  }
}

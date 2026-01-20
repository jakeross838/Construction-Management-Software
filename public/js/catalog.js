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
let allJobAllowances = []; // Store full allowance data for variance calculations
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

  // Quantity changes total and variance
  document.getElementById('selectionQty').addEventListener('input', () => {
    updateSelectionTotal();
    showAllowanceVariance();
  });

  // Allowance selection changes variance display
  document.getElementById('selectionAllowance').addEventListener('change', showAllowanceVariance);

  // CO checkbox toggle
  document.getElementById('createCOCheckbox').addEventListener('change', (e) => {
    document.getElementById('coMarkupSection').style.display = e.target.checked ? 'block' : 'none';
    if (e.target.checked) calculateCOPreview();
  });

  // CO markup input changes preview
  document.getElementById('coMarkupInput').addEventListener('input', calculateCOPreview);

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

  // Image URL preview with debounce
  let imageUrlTimer;
  document.getElementById('productFormImageUrl').addEventListener('input', (e) => {
    clearTimeout(imageUrlTimer);
    imageUrlTimer = setTimeout(() => previewImageUrl(e.target.value), 500);
  });

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
  allJobAllowances = []; // Reset stored allowances

  // Hide variance indicator when job changes
  document.getElementById('allowanceVariance').style.display = 'none';
  document.getElementById('coPrompt').style.display = 'none';

  if (!jobId) return;

  try {
    const res = await fetch(`/api/selections/allowances?job_id=${jobId}`);
    if (!res.ok) throw new Error('Failed to load allowances');
    const allowances = await res.json();

    // Store full allowance data for variance calculations
    allJobAllowances = allowances;

    allowances.forEach(a => {
      const budget = parseFloat(a.budgeted_amount) || 0;
      const selected = parseFloat(a.selected_amount) || 0;
      const remaining = budget - selected;

      // Color-code the option text based on budget status
      let varianceText = '';
      let optionClass = '';
      if (remaining < 0) {
        varianceText = ` ($${Math.abs(remaining).toFixed(0)} over)`;
        optionClass = 'over-budget';
      } else if (remaining > 0) {
        varianceText = ` ($${remaining.toFixed(0)} remaining)`;
        optionClass = 'under-budget';
      } else {
        varianceText = ' (at budget)';
      }

      const option = document.createElement('option');
      option.value = a.id;
      option.textContent = `${a.name}${varianceText}`;
      option.dataset.budgeted = budget;
      option.dataset.selected = selected;
      option.dataset.remaining = remaining;
      allowanceSelect.appendChild(option);
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

  // Reset variance indicator and CO prompt
  document.getElementById('allowanceVariance').style.display = 'none';
  document.getElementById('coPrompt').style.display = 'none';
  document.getElementById('createCOCheckbox').checked = false;
  document.getElementById('coMarkupSection').style.display = 'none';
  allJobAllowances = [];

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

/**
 * Show allowance variance indicator when an allowance is selected
 * Updates to show budget impact of current selection
 */
function showAllowanceVariance() {
  const allowanceSelect = document.getElementById('selectionAllowance');
  const varianceDiv = document.getElementById('allowanceVariance');
  const coPrompt = document.getElementById('coPrompt');

  const selectedOption = allowanceSelect.options[allowanceSelect.selectedIndex];

  // Hide if no allowance selected
  if (!selectedOption || !selectedOption.value) {
    varianceDiv.style.display = 'none';
    coPrompt.style.display = 'none';
    return;
  }

  // Get allowance data from stored array
  const allowance = allJobAllowances.find(a => a.id === selectedOption.value);
  if (!allowance) {
    varianceDiv.style.display = 'none';
    coPrompt.style.display = 'none';
    return;
  }

  const budget = parseFloat(allowance.budgeted_amount) || 0;
  const alreadySelected = parseFloat(allowance.selected_amount) || 0;
  const remaining = budget - alreadySelected;

  // Calculate this selection's total
  const qty = parseFloat(document.getElementById('selectionQty').value) || 0;
  const price = parseFloat(currentProduct?.unit_price) || 0;
  const thisSelectionTotal = qty * price;

  // Calculate projected amount after this selection
  const projectedTotal = alreadySelected + thisSelectionTotal;
  const afterRemaining = budget - projectedTotal;

  // Update variance display
  document.getElementById('varianceBudget').textContent = formatCurrency(budget);
  document.getElementById('varianceSelected').textContent = formatCurrency(alreadySelected);
  document.getElementById('varianceRemaining').textContent = formatCurrency(remaining);
  document.getElementById('varianceAfter').textContent = formatCurrency(afterRemaining);

  // Toggle over/under classes
  varianceDiv.classList.remove('variance-over', 'variance-under');
  if (afterRemaining < 0) {
    varianceDiv.classList.add('variance-over');
  } else {
    varianceDiv.classList.add('variance-under');
  }

  varianceDiv.style.display = 'block';

  // Show CO prompt if selection exceeds budget
  if (afterRemaining < 0) {
    const overage = Math.abs(afterRemaining);
    document.getElementById('coPromptOverage').textContent = formatCurrency(overage);
    coPrompt.style.display = 'block';

    // Reset checkbox state
    document.getElementById('createCOCheckbox').checked = false;
    document.getElementById('coMarkupSection').style.display = 'none';

    // Calculate preview
    calculateCOPreview();
  } else {
    coPrompt.style.display = 'none';
  }
}

/**
 * Calculate and display CO total preview based on overage and markup
 */
function calculateCOPreview() {
  const allowanceSelect = document.getElementById('selectionAllowance');
  const selectedOption = allowanceSelect.options[allowanceSelect.selectedIndex];

  if (!selectedOption || !selectedOption.value) return;

  const allowance = allJobAllowances.find(a => a.id === selectedOption.value);
  if (!allowance) return;

  const budget = parseFloat(allowance.budgeted_amount) || 0;
  const alreadySelected = parseFloat(allowance.selected_amount) || 0;

  // Calculate this selection's total
  const qty = parseFloat(document.getElementById('selectionQty').value) || 0;
  const price = parseFloat(currentProduct?.unit_price) || 0;
  const thisSelectionTotal = qty * price;

  // Calculate overage
  const projectedTotal = alreadySelected + thisSelectionTotal;
  const overage = projectedTotal - budget;

  if (overage <= 0) return;

  // Apply markup
  const markupPercent = parseFloat(document.getElementById('coMarkupInput').value) || 0;
  const coTotal = overage * (1 + markupPercent / 100);

  document.getElementById('coTotalPreview').textContent = formatCurrency(coTotal);
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

    const result = await res.json();

    // After successful selection save, check for CO creation
    const createCOCheckbox = document.getElementById('createCOCheckbox');
    if (createCOCheckbox && createCOCheckbox.checked) {
      const markup = parseFloat(document.getElementById('coMarkupInput').value) || 0;
      await createCOFromSelection(result.id, markup);
    }

    showToast('Selection added successfully', 'success');
    closeAddSelectionModal();
    closeProductModal();
  } catch (err) {
    console.error('Failed to save selection:', err);
    showToast(err.message, 'error');
  }
}

/**
 * Create a Change Order from a selection that exceeds allowance budget
 * @param {string} selectionId - The selection item ID
 * @param {number} markupPercent - Markup percentage to apply
 */
async function createCOFromSelection(selectionId, markupPercent) {
  try {
    const res = await fetch(`/api/selections/items/${selectionId}/create-co`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        markup_percent: markupPercent,
        description: `Upgrade selection from catalog: ${currentProduct?.name || 'Product'}`,
        created_by: 'Jake Ross'
      })
    });

    if (!res.ok) {
      const err = await res.json();
      // Don't throw - just warn. Selection was saved successfully.
      console.warn('CO creation failed:', err.error);
      showToast('Selection saved, but CO creation failed: ' + err.error, 'warning');
      return;
    }

    const result = await res.json();
    showToast(`Change order created: ${formatCurrency(result.final_amount || result.amount)}`, 'success');
  } catch (err) {
    console.error('CO creation error:', err);
    showToast('Selection saved, but CO creation failed', 'warning');
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

// ============================================================
// PRODUCT FORM MODAL (ADD/EDIT)
// ============================================================

/**
 * Preview image from URL
 */
function previewImageUrl(url) {
  const container = document.getElementById('imagePreviewContainer');
  const preview = document.getElementById('imagePreview');

  if (!url || !url.trim()) {
    container.style.display = 'none';
    return;
  }

  // Validate it looks like a URL
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    container.style.display = 'none';
    return;
  }

  // Try to load the image
  preview.onload = () => {
    container.style.display = 'flex';
  };
  preview.onerror = () => {
    container.style.display = 'none';
    showToast('Could not load image from URL', 'error');
  };
  preview.src = url;
}

/**
 * Clear image preview
 */
function clearImagePreview() {
  document.getElementById('productFormImageUrl').value = '';
  document.getElementById('imagePreviewContainer').style.display = 'none';
}

function openAddProductModal() {
  // Reset form
  document.getElementById('productForm').reset();
  document.getElementById('editProductId').value = '';
  document.getElementById('productFormTitle').textContent = 'Add Product';

  // Clear image preview
  document.getElementById('imagePreviewContainer').style.display = 'none';

  // Reset existing images display
  const existingImages = document.getElementById('existingImages');
  if (existingImages) existingImages.style.display = 'none';

  // Populate category dropdown
  const categorySelect = document.getElementById('productFormCategory');
  categorySelect.innerHTML = '<option value="">Select category</option>';
  allCategories.forEach(cat => {
    categorySelect.innerHTML += `<option value="${cat.id}">${escapeHtml(cat.name)}</option>`;
    if (cat.children) {
      cat.children.forEach(child => {
        categorySelect.innerHTML += `<option value="${child.id}">&nbsp;&nbsp;${escapeHtml(child.name)}</option>`;
      });
    }
  });

  // Populate vendor dropdown
  const vendorSelect = document.getElementById('productFormVendor');
  vendorSelect.innerHTML = '<option value="">No vendor</option>';
  allVendors.forEach(v => {
    vendorSelect.innerHTML += `<option value="${v.id}">${escapeHtml(v.name)}</option>`;
  });

  // Show modal
  const modal = document.getElementById('productFormModal');
  modal.style.display = 'flex';
  modal.classList.add('show');

  // Focus first field
  document.getElementById('productFormName').focus();
}

function openEditProductModal() {
  if (!currentProduct) {
    showToast('No product selected', 'error');
    return;
  }

  // First open modal to set up dropdowns
  openAddProductModal();

  // Change title
  document.getElementById('productFormTitle').textContent = 'Edit Product';

  const p = currentProduct;

  // Fill in current product data
  document.getElementById('editProductId').value = p.id;
  document.getElementById('productFormName').value = p.name || '';
  document.getElementById('productFormCategory').value = p.category_id || '';
  document.getElementById('productFormVendor').value = p.vendor_id || '';
  document.getElementById('productFormModel').value = p.model_number || p.sku || '';
  document.getElementById('productFormRoom').value = p.room || '';
  document.getElementById('productFormPrice').value = p.unit_price || '';
  document.getElementById('productFormUnit').value = p.unit || 'each';
  document.getElementById('productFormQtyDefault').value = p.quantity_default || 1;
  document.getElementById('productFormSqFt').value = p.square_footage || '';
  document.getElementById('productFormDescription').value = p.description || '';
  document.getElementById('productFormTags').value = (p.tags || []).join(', ');

  // Fill image URLs
  document.getElementById('productFormImageUrl').value = p.image_url || '';
  document.getElementById('productFormSpecSheetUrl').value = p.spec_sheet_url || '';

  // Show image preview if URL exists
  if (p.image_url) {
    previewImageUrl(p.image_url);
  }

  // Fill specs if available
  if (p.specs) {
    document.getElementById('specColor').value = p.specs.color || '';
    document.getElementById('specFinish').value = p.specs.finish || '';
    document.getElementById('specStyle').value = p.specs.style || '';
  }

  // Fill dimensions if available
  if (p.dimensions) {
    document.getElementById('dimWidth').value = p.dimensions.width || '';
    document.getElementById('dimHeight').value = p.dimensions.height || '';
    document.getElementById('dimDepth').value = p.dimensions.depth || '';
    document.getElementById('dimUnit').value = p.dimensions.unit || 'in';
  }

  // Load existing images in the image gallery
  loadExistingImages(currentProduct.id);
}

function closeProductFormModal() {
  const modal = document.getElementById('productFormModal');
  modal.classList.remove('show');
  modal.style.display = 'none';
}

async function saveProduct() {
  const id = document.getElementById('editProductId').value;
  const isEdit = !!id;

  // Gather form data
  const name = document.getElementById('productFormName').value.trim();
  const category_id = document.getElementById('productFormCategory').value;
  const vendor_id = document.getElementById('productFormVendor').value || null;
  const model_number = document.getElementById('productFormModel').value.trim();
  const room = document.getElementById('productFormRoom').value || null;
  const unit_price = parseFloat(document.getElementById('productFormPrice').value) || 0;
  const unit = document.getElementById('productFormUnit').value;
  const quantity_default = parseFloat(document.getElementById('productFormQtyDefault').value) || 1;
  const square_footage = parseFloat(document.getElementById('productFormSqFt').value) || null;
  const description = document.getElementById('productFormDescription').value.trim();
  const tagsInput = document.getElementById('productFormTags').value.trim();
  const tags = tagsInput ? tagsInput.split(',').map(t => t.trim()).filter(t => t) : [];
  const image_url = document.getElementById('productFormImageUrl').value.trim() || null;
  const spec_sheet_url = document.getElementById('productFormSpecSheetUrl').value.trim() || null;

  // Gather specs
  const specs = {};
  const specColor = document.getElementById('specColor').value.trim();
  const specFinish = document.getElementById('specFinish').value.trim();
  const specStyle = document.getElementById('specStyle').value.trim();
  if (specColor) specs.color = specColor;
  if (specFinish) specs.finish = specFinish;
  if (specStyle) specs.style = specStyle;

  // Gather dimensions
  const dimensions = {};
  const dimWidth = parseFloat(document.getElementById('dimWidth').value);
  const dimHeight = parseFloat(document.getElementById('dimHeight').value);
  const dimDepth = parseFloat(document.getElementById('dimDepth').value);
  const dimUnit = document.getElementById('dimUnit').value;
  if (dimWidth) dimensions.width = dimWidth;
  if (dimHeight) dimensions.height = dimHeight;
  if (dimDepth) dimensions.depth = dimDepth;
  if (Object.keys(dimensions).length > 0) dimensions.unit = dimUnit;

  // Validation
  if (!name) {
    showToast('Product name is required', 'error');
    document.getElementById('productFormName').focus();
    return;
  }
  if (!category_id) {
    showToast('Category is required', 'error');
    document.getElementById('productFormCategory').focus();
    return;
  }
  if (!unit_price || unit_price <= 0) {
    showToast('Please enter a valid price', 'error');
    document.getElementById('productFormPrice').focus();
    return;
  }

  const productData = {
    name,
    category_id,
    vendor_id,
    model_number,
    sku: model_number, // Use model_number as SKU too
    description,
    unit_price,
    unit,
    room,
    quantity_default,
    square_footage,
    tags,
    specs: Object.keys(specs).length > 0 ? specs : null,
    dimensions: Object.keys(dimensions).length > 0 ? dimensions : null,
    image_url,
    spec_sheet_url
  };

  try {
    const url = isEdit ? `/api/selections/catalog/${id}` : '/api/selections/catalog';
    const method = isEdit ? 'PATCH' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(productData)
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to save product');
    }

    const savedProduct = await res.json();

    showToast(isEdit ? 'Product updated' : 'Product created', 'success');
    closeProductFormModal();

    // Refresh products list
    await loadProducts();

    // If we were editing from detail view, close that too and reopen with updated data
    if (isEdit && currentProduct) {
      closeProductModal();
      await openProductDetail(savedProduct.id);
    }
  } catch (err) {
    console.error('Failed to save product:', err);
    showToast(err.message, 'error');
  }
}

// ============================================================
// PRODUCT ARCHIVE
// ============================================================

async function archiveProduct() {
  if (!currentProduct) {
    showToast('No product selected', 'error');
    return;
  }

  if (!confirm(`Are you sure you want to archive "${currentProduct.name}"? It will no longer appear in the catalog.`)) {
    return;
  }

  try {
    const res = await fetch(`/api/selections/catalog/${currentProduct.id}`, {
      method: 'DELETE'
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to archive product');
    }

    showToast('Product archived', 'success');
    closeProductModal();
    await loadProducts();
  } catch (err) {
    console.error('Failed to archive product:', err);
    showToast(err.message, 'error');
  }
}

// ============================================================
// CATEGORY MANAGEMENT
// ============================================================

function openCategoryModal() {
  renderCategoryList();
  document.getElementById('newCategoryName').value = '';

  const modal = document.getElementById('categoryModal');
  modal.style.display = 'flex';
  modal.classList.add('show');
}

function closeCategoryModal() {
  const modal = document.getElementById('categoryModal');
  modal.classList.remove('show');
  modal.style.display = 'none';
}

function renderCategoryList() {
  const list = document.getElementById('categoryList');

  if (allCategories.length === 0) {
    list.innerHTML = '<p class="no-data">No categories yet. Add one above.</p>';
    return;
  }

  let html = '';

  // Flatten for display with order controls
  allCategories.forEach((cat, catIndex) => {
    html += `
      <div class="category-list-item" data-id="${cat.id}">
        <div class="order-buttons">
          <button class="btn btn-sm" onclick="moveCategoryUp('${cat.id}')" ${catIndex === 0 ? 'disabled' : ''}>&#9650;</button>
          <button class="btn btn-sm" onclick="moveCategoryDown('${cat.id}')" ${catIndex === allCategories.length - 1 ? 'disabled' : ''}>&#9660;</button>
        </div>
        <span class="category-name">${escapeHtml(cat.name)}</span>
        <div class="category-actions">
          <button class="btn btn-sm" onclick="openEditCategory('${cat.id}')">Edit</button>
        </div>
      </div>
    `;

    // Render children
    if (cat.children && cat.children.length > 0) {
      cat.children.forEach((child, childIndex) => {
        html += `
          <div class="category-list-item child" data-id="${child.id}">
            <div class="order-buttons">
              <button class="btn btn-sm" onclick="moveCategoryUp('${child.id}', '${cat.id}')" ${childIndex === 0 ? 'disabled' : ''}>&#9650;</button>
              <button class="btn btn-sm" onclick="moveCategoryDown('${child.id}', '${cat.id}')" ${childIndex === cat.children.length - 1 ? 'disabled' : ''}>&#9660;</button>
            </div>
            <span class="category-name">${escapeHtml(child.name)}</span>
            <div class="category-actions">
              <button class="btn btn-sm" onclick="openEditCategory('${child.id}')">Edit</button>
            </div>
          </div>
        `;
      });
    }
  });

  list.innerHTML = html;
}

async function addCategory() {
  const nameInput = document.getElementById('newCategoryName');
  const name = nameInput.value.trim();

  if (!name) {
    showToast('Category name is required', 'error');
    nameInput.focus();
    return;
  }

  try {
    // Get max display_order
    const maxOrder = allCategories.reduce((max, c) => Math.max(max, c.display_order || 0), 0);

    const res = await fetch('/api/selections/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        display_order: maxOrder + 10
      })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to create category');
    }

    showToast('Category created', 'success');
    nameInput.value = '';

    // Reload categories
    await loadCategories();
    renderCategoryList();
  } catch (err) {
    console.error('Failed to create category:', err);
    showToast(err.message, 'error');
  }
}

function openEditCategory(categoryId) {
  // Find category in hierarchy
  let category = null;
  for (const cat of allCategories) {
    if (cat.id === categoryId) {
      category = cat;
      break;
    }
    if (cat.children) {
      const child = cat.children.find(c => c.id === categoryId);
      if (child) {
        category = { ...child, parent_id: cat.id };
        break;
      }
    }
  }

  if (!category) {
    showToast('Category not found', 'error');
    return;
  }

  document.getElementById('editCategoryId').value = category.id;
  document.getElementById('editCategoryName').value = category.name;
  document.getElementById('editCategoryDescription').value = category.description || '';

  // Populate parent dropdown (exclude self and children)
  const parentSelect = document.getElementById('editCategoryParent');
  parentSelect.innerHTML = '<option value="">None (Top Level)</option>';
  allCategories.forEach(cat => {
    if (cat.id !== categoryId) {
      parentSelect.innerHTML += `<option value="${cat.id}" ${category.parent_id === cat.id ? 'selected' : ''}>${escapeHtml(cat.name)}</option>`;
    }
  });

  const modal = document.getElementById('editCategoryModal');
  modal.style.display = 'flex';
  modal.classList.add('show');
}

function closeEditCategoryModal() {
  const modal = document.getElementById('editCategoryModal');
  modal.classList.remove('show');
  modal.style.display = 'none';
}

async function updateCategory() {
  const id = document.getElementById('editCategoryId').value;
  const name = document.getElementById('editCategoryName').value.trim();
  const description = document.getElementById('editCategoryDescription').value.trim();
  const parent_id = document.getElementById('editCategoryParent').value || null;

  if (!name) {
    showToast('Category name is required', 'error');
    return;
  }

  try {
    const res = await fetch(`/api/selections/categories/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description, parent_id })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to update category');
    }

    showToast('Category updated', 'success');
    closeEditCategoryModal();

    await loadCategories();
    renderCategoryList();
  } catch (err) {
    console.error('Failed to update category:', err);
    showToast(err.message, 'error');
  }
}

async function moveCategoryUp(categoryId, parentId = null) {
  await reorderCategory(categoryId, parentId, -1);
}

async function moveCategoryDown(categoryId, parentId = null) {
  await reorderCategory(categoryId, parentId, 1);
}

async function reorderCategory(categoryId, parentId, direction) {
  // Find the category and its siblings
  let siblings;
  if (parentId) {
    const parent = allCategories.find(c => c.id === parentId);
    siblings = parent?.children || [];
  } else {
    siblings = allCategories;
  }

  const index = siblings.findIndex(c => c.id === categoryId);
  if (index === -1) return;

  const newIndex = index + direction;
  if (newIndex < 0 || newIndex >= siblings.length) return;

  // Swap display_order values
  const current = siblings[index];
  const swap = siblings[newIndex];

  try {
    // Update both categories
    await Promise.all([
      fetch(`/api/selections/categories/${current.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_order: swap.display_order })
      }),
      fetch(`/api/selections/categories/${swap.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_order: current.display_order })
      })
    ]);

    // Reload categories
    await loadCategories();
    renderCategoryList();
  } catch (err) {
    console.error('Failed to reorder:', err);
    showToast('Failed to reorder categories', 'error');
  }
}

// ============================================================
// IMAGE UPLOAD
// ============================================================

/**
 * Compress image client-side before upload
 * @param {File} file - Original image file
 * @param {number} maxWidth - Max width in pixels (default 1200)
 * @param {number} quality - JPEG quality 0-1 (default 0.8)
 * @returns {Promise<Blob>} Compressed image blob
 */
async function compressImage(file, maxWidth = 1200, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Scale down if needed
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(resolve, 'image/jpeg', quality);
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Generate thumbnail from image
 * @param {File|Blob} file - Image file
 * @param {number} size - Thumbnail size (default 200)
 * @returns {Promise<Blob>} Thumbnail blob
 */
async function generateThumbnail(file, size = 200) {
  return compressImage(file, size, 0.7);
}

/**
 * Handle image file selection
 */
async function handleImageUpload(event) {
  const files = event.target.files;
  if (!files || files.length === 0) return;

  const productId = document.getElementById('editProductId').value;
  if (!productId) {
    showToast('Please save the product first before adding images', 'info');
    return;
  }

  const progressDiv = document.getElementById('uploadProgress');
  const progressBar = document.getElementById('uploadProgressBar');
  const statusText = document.getElementById('uploadStatus');

  progressDiv.style.display = 'block';

  let uploaded = 0;
  const total = files.length;

  for (const file of files) {
    try {
      // Validate file
      if (!file.type.startsWith('image/')) {
        showToast(`${file.name} is not an image`, 'error');
        continue;
      }

      if (file.size > 5 * 1024 * 1024) {
        showToast(`${file.name} is too large (max 5MB)`, 'error');
        continue;
      }

      statusText.textContent = `Compressing ${file.name}...`;

      // Compress image
      const compressed = await compressImage(file);
      const thumbnail = await generateThumbnail(file);

      statusText.textContent = `Uploading ${file.name}...`;

      // Upload to Supabase storage via our API
      const formData = new FormData();
      formData.append('image', compressed, file.name);
      formData.append('thumbnail', thumbnail, `thumb_${file.name}`);

      const res = await fetch(`/api/selections/catalog/${productId}/upload-image`, {
        method: 'POST',
        body: formData
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Upload failed');
      }

      uploaded++;
      progressBar.style.width = `${(uploaded / total) * 100}%`;
    } catch (err) {
      console.error(`Failed to upload ${file.name}:`, err);
      showToast(`Failed to upload ${file.name}: ${err.message}`, 'error');
    }
  }

  progressDiv.style.display = 'none';
  progressBar.style.width = '0%';

  if (uploaded > 0) {
    showToast(`Uploaded ${uploaded} image(s)`, 'success');
    // Refresh product to show new images
    if (currentProduct) {
      await openProductDetail(currentProduct.id);
    }
    await loadExistingImages(productId);
  }

  // Reset file input
  event.target.value = '';
}

/**
 * Load existing images for a product in edit mode
 */
async function loadExistingImages(productId) {
  const container = document.getElementById('existingImages');

  if (!productId) {
    container.style.display = 'none';
    return;
  }

  try {
    const res = await fetch(`/api/selections/catalog/${productId}/images`);
    if (!res.ok) throw new Error('Failed to load images');
    const images = await res.json();

    if (images.length === 0) {
      container.style.display = 'none';
      return;
    }

    container.style.display = 'grid';
    container.innerHTML = images.map(img => `
      <div class="image-thumb">
        <img src="${img.thumbnail_path || img.storage_path}" alt="">
        <button class="remove-btn" onclick="removeProductImage('${productId}', '${img.id}')">&times;</button>
      </div>
    `).join('');
  } catch (err) {
    console.error('Failed to load images:', err);
    container.style.display = 'none';
  }
}

/**
 * Remove an image from a product
 */
async function removeProductImage(productId, imageId) {
  if (!confirm('Remove this image?')) return;

  try {
    const res = await fetch(`/api/selections/catalog/${productId}/images/${imageId}`, {
      method: 'DELETE'
    });

    if (!res.ok) throw new Error('Failed to remove image');

    showToast('Image removed', 'success');
    await loadExistingImages(productId);
  } catch (err) {
    console.error('Failed to remove image:', err);
    showToast('Failed to remove image', 'error');
  }
}

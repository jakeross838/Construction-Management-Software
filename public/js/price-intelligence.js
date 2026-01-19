/**
 * Price Intelligence Frontend
 * Handles all 4 tabs: Price Database, Order Optimizer, Savings Tracker, Spend Analytics
 */

// ============================================================
// STATE
// ============================================================

let state = {
  stats: null,
  currentTab: 'price-database',
  priceUnit: 'each',
  categories: [],
  vendors: [],
  jobs: [],
  matrixData: null,
  currentItemId: null,
  optimizationResult: null,
  searchDebounce: null,
  selectedCategory: '',  // Currently selected category
  collapsedSubcategories: new Set(),  // Track collapsed subcategory groups
  namingConventions: [],  // Naming conventions data
  reviewQueue: [],  // Review queue items
  reviewQueueFilter: 'pending',  // Current filter
  reviewQueuePagination: { total: 0, limit: 50, offset: 0, hasMore: false },
  selectedReviewItems: new Set()  // Selected items for bulk actions
};

// Ensure global normalizeStatusClass exists
if (!window.normalizeStatusClass) {
  window.normalizeStatusClass = function(status) {
    if (!status) return '';
    return status.toString().toLowerCase().replace(/_/g, '-');
  };
}
// Use window.normalizeStatusClass directly throughout this file

// ============================================================
// INITIALIZATION
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
  setupEventListeners();

  // Load reference data in parallel
  try {
    await Promise.all([
      loadStats().catch(err => console.error('Stats failed:', err)),
      loadCategories().catch(err => console.error('Categories failed:', err)),
      loadVendors().catch(err => console.error('Vendors failed:', err)),
      loadJobs().catch(err => console.error('Jobs failed:', err)),
      loadReviewQueueStats().catch(err => console.error('Review stats failed:', err))
    ]);
  } catch (err) {
    console.error('Initial data load failed:', err);
  }

  // Load initial tab data
  loadPriceMatrix();
});

function setupEventListeners() {
  // Search debouncing
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      clearTimeout(state.searchDebounce);
      state.searchDebounce = setTimeout(() => {
        applyFilters();
      }, 150);
    });
  }
}

// ============================================================
// DATA LOADING
// ============================================================

async function loadStats() {
  try {
    const res = await fetch('/api/price-intelligence/stats');
    if (!res.ok) throw new Error('Failed to load stats');
    state.stats = await res.json();
    renderStats();
  } catch (err) {
    console.error('Error loading stats:', err);
  }
}

async function loadCategories() {
  try {
    const res = await fetch('/api/price-intelligence/categories');
    if (!res.ok) return;
    state.categories = await res.json();
    renderCategorySidebar();
  } catch (err) {
    console.error('Error loading categories:', err);
  }
}

async function loadVendors() {
  try {
    const res = await fetch('/api/vendors');
    if (!res.ok) return;
    state.vendors = await res.json();
    populateVendorSelects();
  } catch (err) {
    console.error('Error loading vendors:', err);
  }
}

async function loadJobs() {
  try {
    const res = await fetch('/api/jobs');
    if (!res.ok) return;
    state.jobs = await res.json();
    populateJobSelects();
  } catch (err) {
    console.error('Error loading jobs:', err);
  }
}

// ============================================================
// STATS RENDERING
// ============================================================

function renderStats() {
  if (!state.stats) return;

  document.getElementById('statTotalItems').textContent = state.stats.total_items?.toLocaleString() || '0';
  document.getElementById('statActiveVendors').textContent = state.stats.active_vendors?.toLocaleString() || '0';
  document.getElementById('statTotalSavings').textContent = formatMoney(state.stats.total_savings_ytd || 0);
  document.getElementById('statAvgConfidence').textContent = state.stats.avg_confidence
    ? `${(state.stats.avg_confidence * 100).toFixed(0)}%`
    : '-';
}

// ============================================================
// TAB SWITCHING
// ============================================================

function switchTab(tabId) {
  state.currentTab = tabId;

  // Update tab buttons
  document.querySelectorAll('.tabs .tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.tab === tabId);
  });

  // Update tab content
  document.querySelectorAll('.tab-content').forEach(content => {
    content.style.display = content.id === `tab-${tabId}` ? 'block' : 'none';
  });

  // Load tab-specific data
  switch (tabId) {
    case 'price-database':
      if (!state.matrixData) loadPriceMatrix();
      break;
    case 'order-optimizer':
      // Already loaded
      break;
    case 'savings-tracker':
      loadSavingsData();
      break;
    case 'spend-analytics':
      loadSpendAnalytics();
      break;
    case 'naming-conventions':
      loadNamingConventions();
      break;
    case 'review-queue':
      loadReviewQueue();
      loadReviewQueueStats();
      break;
  }
}

// ============================================================
// TAB 1: PRICE DATABASE
// ============================================================

/**
 * Render the category sidebar with item counts
 */
function renderCategorySidebar() {
  const container = document.getElementById('categoryList');
  if (!container) return;

  // Calculate total items across all categories
  const totalItems = state.categories.reduce((sum, cat) => sum + cat.item_count, 0);
  document.getElementById('allItemsCount').textContent = totalItems;

  // Build category list HTML
  const categoriesHtml = state.categories.map(cat => `
    <div class="category-item${state.selectedCategory === cat.category ? ' active' : ''}"
         data-category="${cat.category}"
         onclick="selectCategory('${cat.category}')">
      <span class="category-name">${cat.category}</span>
      <span class="category-count">${cat.item_count}</span>
    </div>
  `).join('');

  // Update only the category items (keep the All Items row)
  const allItemsRow = container.querySelector('.category-item[data-category=""]');
  container.innerHTML = '';
  if (allItemsRow) {
    allItemsRow.classList.toggle('active', state.selectedCategory === '');
    container.appendChild(allItemsRow);
  }
  container.insertAdjacentHTML('beforeend', categoriesHtml);
}

/**
 * Select a category from the sidebar
 */
function selectCategory(category) {
  state.selectedCategory = category;

  // Update sidebar active state
  document.querySelectorAll('.category-item').forEach(item => {
    item.classList.toggle('active', item.dataset.category === category);
  });

  // Update title
  document.getElementById('categoryTitle').textContent = category || 'All Items';

  // Reload data for selected category
  loadPriceMatrix();
}

async function loadPriceMatrix() {
  const container = document.getElementById('priceMatrixContainer');
  container.innerHTML = '<div class="loading-state">Loading price data...</div>';

  try {
    const category = state.selectedCategory;
    const url = category
      ? `/api/price-intelligence/matrix?category=${encodeURIComponent(category)}&limit=200`
      : '/api/price-intelligence/matrix?limit=200';

    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to load price matrix');

    state.matrixData = await res.json();
    renderPriceMatrix();
  } catch (err) {
    console.error('Error loading price matrix:', err);
    container.innerHTML = '<div class="empty-category">Failed to load price data</div>';
  }
}

function renderPriceMatrix() {
  const container = document.getElementById('priceMatrixContainer');
  const search = document.getElementById('searchInput')?.value?.toLowerCase() || '';

  if (!state.matrixData || !state.matrixData.items || state.matrixData.items.length === 0) {
    container.innerHTML = '<div class="empty-category">No items found. Add items to start tracking prices.</div>';
    return;
  }

  let items = state.matrixData.items;

  // Apply search filter
  if (search) {
    items = items.filter(item =>
      item.standard_name?.toLowerCase().includes(search) ||
      item.category?.toLowerCase().includes(search) ||
      item.subcategory?.toLowerCase().includes(search)
    );
  }

  if (items.length === 0) {
    container.innerHTML = '<div class="empty-category">No items match your search</div>';
    return;
  }

  // Group items by subcategory (or "General" if no subcategory)
  const groups = {};
  for (const item of items) {
    const subcat = item.subcategory || 'General';
    if (!groups[subcat]) {
      groups[subcat] = [];
    }
    groups[subcat].push(item);
  }

  // Sort subcategories: "General" last, others alphabetically
  const sortedSubcats = Object.keys(groups).sort((a, b) => {
    if (a === 'General') return 1;
    if (b === 'General') return -1;
    return a.localeCompare(b);
  });

  // Render grouped items
  container.innerHTML = sortedSubcats.map(subcat => {
    const subcatItems = groups[subcat];
    const isCollapsed = state.collapsedSubcategories.has(subcat);

    return `
      <div class="subcategory-group${isCollapsed ? ' collapsed' : ''}" data-subcategory="${subcat}">
        <div class="subcategory-header" onclick="toggleSubcategory('${subcat}')">
          <span class="subcategory-toggle">▼</span>
          <span class="subcategory-name">${subcat}</span>
          <span class="subcategory-item-count">${subcatItems.length} item${subcatItems.length !== 1 ? 's' : ''}</span>
        </div>
        <div class="subcategory-items">
          ${subcatItems.map(item => renderItemRow(item)).join('')}
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Render a single item row within a subcategory
 */
function renderItemRow(item) {
  const bestPrice = item.best_price;
  const vendorCount = item.vendor_count || 0;

  return `
    <div class="price-item-row" onclick="showItemDetail('${item.id}')">
      <div>
        <div class="item-name">${item.standard_name}</div>
        <div class="item-unit">${item.standard_unit || 'ea'}</div>
      </div>
      <div class="item-price${bestPrice ? ' best' : ''}">
        ${bestPrice ? formatMoney(bestPrice) : '-'}
      </div>
      <div class="item-vendors">
        ${vendorCount} vendor${vendorCount !== 1 ? 's' : ''}
      </div>
      <div>
        ${renderConfidenceBar(vendorCount)}
      </div>
    </div>
  `;
}

/**
 * Render a confidence bar based on vendor count
 */
function renderConfidenceBar(vendorCount) {
  const confidence = vendorCount > 2 ? 'high' : vendorCount > 0 ? 'medium' : 'low';
  const percent = vendorCount > 2 ? 90 : vendorCount > 0 ? 50 : 0;

  return `
    <span class="confidence-bar">
      <span class="confidence-fill ${confidence}" style="width: ${percent}%"></span>
    </span>
  `;
}

/**
 * Toggle subcategory collapse state
 */
function toggleSubcategory(subcat) {
  const group = document.querySelector(`.subcategory-group[data-subcategory="${subcat}"]`);
  if (!group) return;

  if (state.collapsedSubcategories.has(subcat)) {
    state.collapsedSubcategories.delete(subcat);
    group.classList.remove('collapsed');
  } else {
    state.collapsedSubcategories.add(subcat);
    group.classList.add('collapsed');
  }
}

function populateVendorSelects() {
  const selects = document.querySelectorAll('#priceVendor');
  selects.forEach(select => {
    select.innerHTML = '<option value="">Select vendor...</option>';
    state.vendors.forEach(v => {
      select.innerHTML += `<option value="${v.id}">${v.name}</option>`;
    });
  });
}

function populateJobSelects() {
  const select = document.getElementById('optimizerJob');
  if (!select) return;

  select.innerHTML = '<option value="">No Job</option>';
  state.jobs.forEach(job => {
    select.innerHTML += `<option value="${job.id}">${job.name}</option>`;
  });
}

function applyFilters() {
  renderPriceMatrix();
}

function setUnit(unit) {
  state.priceUnit = unit;

  // Update toggle buttons
  document.querySelectorAll('.view-toggle button').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.unit === unit);
  });

  renderPriceMatrix();
}

// ============================================================
// ITEM DETAIL
// ============================================================

async function showItemDetail(itemId) {
  state.currentItemId = itemId;

  // Show modal with loading state
  document.getElementById('itemDetailTitle').textContent = 'Loading...';
  document.getElementById('itemDetailSubtitle').textContent = '';
  document.getElementById('itemPricesTable').querySelector('tbody').innerHTML =
    '<tr><td colspan="7" class="loading">Loading...</td></tr>';
  document.getElementById('itemDetailModal').classList.add('show');

  try {
    const res = await fetch(`/api/price-intelligence/master-items/${itemId}`);
    if (!res.ok) throw new Error('Failed to load item');

    const item = await res.json();

    // Update header
    document.getElementById('itemDetailTitle').textContent = item.standard_name;
    document.getElementById('itemDetailSubtitle').textContent = `${item.category}${item.subcategory ? ' > ' + item.subcategory : ''} | ${item.standard_unit}`;

    // Render prices
    renderItemPrices(item.current_prices || []);

    // Render history
    renderItemHistory(item.price_history || []);

    // Render aliases
    renderItemAliases(item.aliases || []);

    // Reset to first tab
    switchItemTab('item-prices');

  } catch (err) {
    console.error('Error loading item:', err);
    showToast('Failed to load item details', 'error');
  }
}

function renderItemPrices(prices) {
  const tbody = document.getElementById('itemPricesTable').querySelector('tbody');

  if (!prices || prices.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No vendor prices yet</td></tr>';
    return;
  }

  // Sort by unit price
  prices.sort((a, b) => (a.unit_price || 0) - (b.unit_price || 0));

  tbody.innerHTML = prices.map((p, idx) => {
    const isBest = idx === 0;
    const isWorst = idx === prices.length - 1 && prices.length > 1;

    return `
      <tr class="${isBest ? 'best-price' : isWorst ? 'worst-price' : ''}">
        <td>${p.vendor_name || 'Unknown'}</td>
        <td class="amount">${formatMoney(p.unit_price)}</td>
        <td class="amount">${p.price_per_each ? formatMoney(p.price_per_each) : '-'}</td>
        <td class="amount">${p.price_per_lf ? formatMoney(p.price_per_lf) : '-'}</td>
        <td class="amount">${p.price_per_sf ? formatMoney(p.price_per_sf) : '-'}</td>
        <td>${p.lead_days ?? '-'}</td>
        <td>${p.price_date ? formatDate(p.price_date) : '-'}</td>
      </tr>
    `;
  }).join('');
}

function renderItemHistory(history) {
  const tbody = document.getElementById('itemHistoryTable').querySelector('tbody');

  if (!history || history.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No price history</td></tr>';
    return;
  }

  tbody.innerHTML = history.map(h => {
    const hasSource = h.source_id && h.source_type !== 'manual';
    const sourceClass = h.source_type === 'invoice' ? 'approved' : 'pending';
    const sourceLink = hasSource
      ? `<a href="#" onclick="viewPriceSource('${h.id}'); return false;" class="status-badge status-${window.normalizeStatusClass(sourceClass)}" style="cursor: pointer;">${h.source_type}</a>`
      : `<span class="status-badge status-${window.normalizeStatusClass(sourceClass)}">${h.source_type}</span>`;

    return `
      <tr>
        <td>${formatDate(h.price_date)}</td>
        <td>${h.vendor?.name || 'Unknown'}</td>
        <td>${sourceLink}</td>
        <td class="amount">${formatMoney(h.unit_price)}</td>
        <td>${h.unit}</td>
        <td>${h.quantity || '-'}</td>
      </tr>
    `;
  }).join('');
}

/**
 * View the source document for a price entry
 */
async function viewPriceSource(priceId) {
  try {
    const res = await fetch(`/api/price-intelligence/price-history/${priceId}/source`);
    if (!res.ok) throw new Error('Failed to load source');

    const source = await res.json();

    if (source.url) {
      // Open the document in a new tab
      window.open(source.url, '_blank');
    } else if (source.document) {
      // Show info about the source
      showToast(`Source: ${source.label || source.type}`, 'info');
    } else {
      showToast('No source document available', 'info');
    }
  } catch (err) {
    console.error('Error loading source:', err);
    showToast('Could not load source document', 'error');
  }
}

function renderItemAliases(aliases) {
  const tbody = document.getElementById('itemAliasesTable').querySelector('tbody');

  if (!aliases || aliases.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No vendor aliases</td></tr>';
    return;
  }

  tbody.innerHTML = aliases.map(a => `
    <tr>
      <td>${a.vendor?.name || 'Unknown'}</td>
      <td>${a.vendor_description}</td>
      <td>${a.vendor_sku || '-'}</td>
      <td>${a.match_method}</td>
      <td>${a.times_matched || 0}</td>
    </tr>
  `).join('');
}

function switchItemTab(tabId) {
  // Update tab buttons
  document.querySelectorAll('#itemDetailModal .tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.tab === tabId);
  });

  // Update tab content
  document.getElementById('tab-item-prices').style.display = tabId === 'item-prices' ? 'block' : 'none';
  document.getElementById('tab-item-history').style.display = tabId === 'item-history' ? 'block' : 'none';
  document.getElementById('tab-item-aliases').style.display = tabId === 'item-aliases' ? 'block' : 'none';
}

// ============================================================
// ADD ITEM
// ============================================================

function showAddItemModal() {
  document.getElementById('itemCategory').value = '';
  document.getElementById('itemSubcategory').value = '';
  document.getElementById('itemName').value = '';
  document.getElementById('itemUnit').value = 'ea';
  document.getElementById('itemKeywords').value = '';
  document.getElementById('addItemModal').classList.add('show');
}

async function saveNewItem() {
  const category = document.getElementById('itemCategory').value;
  const subcategory = document.getElementById('itemSubcategory').value;
  const name = document.getElementById('itemName').value;
  const unit = document.getElementById('itemUnit').value;
  const keywordsStr = document.getElementById('itemKeywords').value;

  if (!category || !name || !unit) {
    showToast('Please fill in required fields', 'error');
    return;
  }

  const keywords = keywordsStr
    ? keywordsStr.split(',').map(k => k.trim().toLowerCase()).filter(k => k)
    : null;

  try {
    const res = await fetch('/api/price-intelligence/master-items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category,
        subcategory: subcategory || null,
        standard_name: name,
        standard_unit: unit,
        keywords
      })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to create item');
    }

    showToast('Item created successfully', 'success');
    closeModal('addItemModal');
    loadStats();
    loadPriceMatrix();
  } catch (err) {
    console.error('Error creating item:', err);
    showToast(err.message || 'Failed to create item', 'error');
  }
}

// ============================================================
// ADD PRICE
// ============================================================

function addPriceToItem() {
  if (!state.currentItemId) {
    showToast('No item selected', 'error');
    return;
  }

  // Populate vendor select
  populateVendorSelects();

  // Set default date to today
  document.getElementById('priceDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('priceAmount').value = '';
  document.getElementById('priceUnit').value = 'ea';
  document.getElementById('priceQty').value = '';
  document.getElementById('priceLeadDays').value = '';
  document.getElementById('priceInStock').checked = false;

  document.getElementById('addPriceModal').classList.add('show');
}

async function savePrice() {
  const vendorId = document.getElementById('priceVendor').value;
  const unitPrice = parseFloat(document.getElementById('priceAmount').value);
  const unit = document.getElementById('priceUnit').value;
  const quantity = document.getElementById('priceQty').value;
  const leadDays = document.getElementById('priceLeadDays').value;
  const priceDate = document.getElementById('priceDate').value;
  const inStock = document.getElementById('priceInStock').checked;

  if (!vendorId || isNaN(unitPrice) || !unit) {
    showToast('Please fill in required fields', 'error');
    return;
  }

  try {
    const res = await fetch('/api/price-intelligence/price-history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        master_item_id: state.currentItemId,
        vendor_id: vendorId,
        unit_price: unitPrice,
        unit,
        quantity: quantity ? parseFloat(quantity) : null,
        lead_days: leadDays ? parseInt(leadDays) : null,
        price_date: priceDate || null,
        in_stock: inStock
      })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to save price');
    }

    showToast('Price saved successfully', 'success');
    closeModal('addPriceModal');

    // Refresh item detail
    showItemDetail(state.currentItemId);

    // Refresh matrix
    loadPriceMatrix();
  } catch (err) {
    console.error('Error saving price:', err);
    showToast(err.message || 'Failed to save price', 'error');
  }
}

// ============================================================
// TAB 2: ORDER OPTIMIZER
// ============================================================

async function optimizeMaterials() {
  const materialList = document.getElementById('materialList').value.trim();
  if (!materialList) {
    showToast('Please enter a material list', 'error');
    return;
  }

  const jobId = document.getElementById('optimizerJob').value || null;
  const budgetLimit = document.getElementById('budgetLimit').value;
  const maxLeadDays = document.getElementById('maxLeadDays').value;
  const includeWaste = document.getElementById('applyWaste').checked;

  // Parse the list first
  try {
    const parseRes = await fetch('/api/order-optimizer/parse-list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: materialList })
    });

    if (!parseRes.ok) throw new Error('Failed to parse material list');
    const parsed = await parseRes.json();

    // Now optimize
    const optimizeRes = await fetch('/api/order-optimizer/optimize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: parsed.items,
        job_id: jobId,
        include_waste: includeWaste,
        max_lead_days: maxLeadDays ? parseInt(maxLeadDays) : null,
        budget_limit: budgetLimit ? parseFloat(budgetLimit) : null
      })
    });

    if (!optimizeRes.ok) throw new Error('Failed to optimize order');
    state.optimizationResult = await optimizeRes.json();

    renderOptimizationResults();

  } catch (err) {
    console.error('Error optimizing:', err);
    showToast(err.message || 'Failed to optimize order', 'error');
  }
}

function renderOptimizationResults() {
  const result = state.optimizationResult;
  if (!result) return;

  document.getElementById('optimizerResults').style.display = 'block';

  // Summary
  const summary = result.summary;
  document.getElementById('optimizerSummary').innerHTML = `
    <div class="pi-stat-card">
      <div class="pi-stat-label">Items Matched</div>
      <div class="pi-stat-value">${summary.matched_items}/${summary.total_items}</div>
    </div>
    <div class="pi-stat-card">
      <div class="pi-stat-label">Optimized Total</div>
      <div class="pi-stat-value">${formatMoney(summary.optimized_total)}</div>
    </div>
    <div class="pi-stat-card">
      <div class="pi-stat-label">Baseline Total</div>
      <div class="pi-stat-value">${formatMoney(summary.baseline_total)}</div>
    </div>
    <div class="pi-stat-card">
      <div class="pi-stat-label">Savings</div>
      <div class="pi-stat-value savings">${formatMoney(summary.savings_amount)} (${summary.savings_percent}%)</div>
    </div>
  `;

  // Vendor splits
  const splitsContainer = document.getElementById('vendorSplits');
  if (!result.vendor_splits || result.vendor_splits.length === 0) {
    splitsContainer.innerHTML = '<div class="empty-state">No vendor recommendations available</div>';
    return;
  }

  splitsContainer.innerHTML = result.vendor_splits.map(split => {
    const items = result.items.filter(i => i.recommended_vendor_id === split.vendor_id);

    return `
      <div class="vendor-split">
        <div class="vendor-split-header">
          <h4>${split.vendor_name}</h4>
          <div>
            <span style="margin-right: 1rem;">Subtotal: ${formatMoney(split.subtotal)}</span>
            <span>Delivery: ${split.actual_delivery_fee > 0 ? formatMoney(split.actual_delivery_fee) : 'Free'}</span>
          </div>
        </div>
        <div class="vendor-split-body">
          ${items.map(item => `
            <div class="vendor-split-item">
              <span>${item.input_description} x ${item.quantity_with_waste.toFixed(1)}</span>
              <span>${formatMoney(item.extended_price)}</span>
            </div>
          `).join('')}
          <div class="vendor-split-item" style="font-weight: 600; border-top: 2px solid var(--border); margin-top: 0.5rem; padding-top: 0.75rem;">
            <span>Total with Delivery</span>
            <span>${formatMoney(split.total_with_delivery)}</span>
          </div>
        </div>
        ${split.warning ? `<div style="padding: 0.5rem 1rem; background: rgba(248, 81, 73, 0.1); color: var(--accent-red); font-size: 0.9rem;">${split.warning}</div>` : ''}
      </div>
    `;
  }).join('');
}

async function saveOptimization() {
  if (!state.optimizationResult) {
    showToast('No optimization to save', 'error');
    return;
  }

  const jobId = document.getElementById('optimizerJob').value || null;

  try {
    const res = await fetch('/api/order-optimizer/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        job_id: jobId,
        items: state.optimizationResult.items,
        summary: state.optimizationResult.summary,
        include_waste: document.getElementById('applyWaste').checked,
        max_lead_days: document.getElementById('maxLeadDays').value || null,
        budget_limit: document.getElementById('budgetLimit').value || null
      })
    });

    if (!res.ok) throw new Error('Failed to save order');

    const order = await res.json();
    showToast(`Order saved: ${order.name}`, 'success');

  } catch (err) {
    console.error('Error saving order:', err);
    showToast(err.message || 'Failed to save order', 'error');
  }
}

async function createPOsFromOptimization() {
  showToast('PO creation from optimization coming soon', 'info');
}

// ============================================================
// TAB 3: SAVINGS TRACKER
// ============================================================

async function loadSavingsData() {
  try {
    // Load summary
    const summaryRes = await fetch('/api/savings/summary');
    if (summaryRes.ok) {
      const summary = await summaryRes.json();
      renderSavingsSummary(summary);
    }

    // Load by period
    const periodRes = await fetch('/api/savings/by-period');
    if (periodRes.ok) {
      const periodData = await periodRes.json();
      renderSavingsByMonth(periodData);
    }

    // Load by category
    const categoryRes = await fetch('/api/savings/by-category');
    if (categoryRes.ok) {
      const categoryData = await categoryRes.json();
      renderSavingsByCategory(categoryData);
    }

    // Load recent
    const recentRes = await fetch('/api/savings/recent?limit=10');
    if (recentRes.ok) {
      const recentData = await recentRes.json();
      renderRecentSavings(recentData);
    }

  } catch (err) {
    console.error('Error loading savings data:', err);
  }
}

function renderSavingsSummary(summary) {
  document.getElementById('savingsYTD').textContent = formatMoney(summary.ytd?.savings_amount || 0);
  document.getElementById('savingsRate').textContent = `${summary.ytd?.savings_percent || 0}%`;
  document.getElementById('ordersOptimized').textContent = summary.ytd?.order_count || 0;
  document.getElementById('savingsLast30').textContent = formatMoney(summary.last_30_days?.savings_amount || 0);
}

function renderSavingsByMonth(data) {
  const tbody = document.getElementById('savingsByMonth').querySelector('tbody');

  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No savings data</td></tr>';
    return;
  }

  tbody.innerHTML = data.map(row => `
    <tr>
      <td>${row.period}</td>
      <td class="amount">${formatMoney(row.total_spent)}</td>
      <td class="amount">${formatMoney(row.baseline_cost)}</td>
      <td class="amount" style="color: var(--accent-green);">${formatMoney(row.savings_amount)}</td>
      <td>${row.savings_percent}%</td>
    </tr>
  `).join('');
}

function renderSavingsByCategory(data) {
  const tbody = document.getElementById('savingsByCategory').querySelector('tbody');

  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="empty-state">No category data</td></tr>';
    return;
  }

  tbody.innerHTML = data.map(row => `
    <tr>
      <td>${row.category}</td>
      <td class="amount">${formatMoney(row.total_spent)}</td>
      <td class="amount" style="color: var(--accent-green);">${formatMoney(row.savings_amount)}</td>
      <td>${row.savings_percent}%</td>
    </tr>
  `).join('');
}

function renderRecentSavings(data) {
  const tbody = document.getElementById('recentSavings').querySelector('tbody');

  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No savings recorded yet</td></tr>';
    return;
  }

  tbody.innerHTML = data.map(row => `
    <tr>
      <td>${formatDate(row.order_date)}</td>
      <td>${row.job?.name || '-'}</td>
      <td class="amount">${formatMoney(row.total_spent)}</td>
      <td class="amount">${formatMoney(row.baseline_cost)}</td>
      <td class="amount" style="color: var(--accent-green);">${formatMoney(row.savings_amount)}</td>
      <td>${row.savings_percent}%</td>
    </tr>
  `).join('');
}

// ============================================================
// TAB 4: SPEND ANALYTICS
// ============================================================

async function loadSpendAnalytics() {
  try {
    // Load vendor spend
    const vendorRes = await fetch('/api/spend/by-vendor?limit=10');
    if (vendorRes.ok) {
      const data = await vendorRes.json();
      renderTopVendors(data);
    }

    // Load category spend
    const categoryRes = await fetch('/api/spend/by-category');
    if (categoryRes.ok) {
      const data = await categoryRes.json();
      renderSpendByCategory(data);
    }

    // Load negotiation targets
    const targetsRes = await fetch('/api/spend/negotiation-targets?min_spend=5000');
    if (targetsRes.ok) {
      const data = await targetsRes.json();
      renderNegotiationTargets(data);
    }

  } catch (err) {
    console.error('Error loading spend analytics:', err);
  }
}

function renderTopVendors(data) {
  const tbody = document.getElementById('topVendors').querySelector('tbody');

  if (!data.vendors || data.vendors.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="empty-state">No vendor data</td></tr>';
    return;
  }

  tbody.innerHTML = data.vendors.map(v => `
    <tr>
      <td><strong>${v.vendor_name}</strong></td>
      <td class="amount">${formatMoney(v.total_spend)}</td>
      <td>${v.invoice_count}</td>
      <td>${v.spend_percent}%</td>
    </tr>
  `).join('');
}

function renderSpendByCategory(data) {
  const tbody = document.getElementById('spendByCategory').querySelector('tbody');

  if (!data.categories || data.categories.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" class="empty-state">No category data</td></tr>';
    return;
  }

  tbody.innerHTML = data.categories.map(c => `
    <tr>
      <td><strong>${c.category}</strong></td>
      <td class="amount">${formatMoney(c.total_spend)}</td>
      <td>${c.spend_percent}%</td>
    </tr>
  `).join('');
}

function renderNegotiationTargets(data) {
  const container = document.getElementById('negotiationTargets');

  if (!data.targets || data.targets.length === 0) {
    container.innerHTML = '<div class="empty-state">No high-spend vendors identified. Keep tracking spend to identify negotiation opportunities.</div>';
    return;
  }

  container.innerHTML = data.targets.slice(0, 5).map(target => `
    <div class="negotiation-card">
      <div class="negotiation-header">
        <div class="negotiation-vendor">${target.vendor_name}</div>
        <div class="negotiation-score">Score: ${target.negotiation_score}</div>
      </div>
      <div class="negotiation-metrics">
        <div>
          <div style="color: var(--text-secondary); font-size: 0.85rem;">Total Spend</div>
          <div style="font-weight: 600;">${formatMoney(target.total_spend)}</div>
        </div>
        <div>
          <div style="color: var(--text-secondary); font-size: 0.85rem;">Suggested Discount</div>
          <div style="font-weight: 600;">${target.suggested_discount}</div>
        </div>
        <div>
          <div style="color: var(--text-secondary); font-size: 0.85rem;">Potential Savings</div>
          <div style="font-weight: 600; color: var(--accent-green);">${formatMoney(target.potential_savings)}</div>
        </div>
      </div>
      ${target.insights?.map(insight => `<div class="negotiation-insight">${insight}</div>`).join('') || ''}
    </div>
  `).join('');
}

// ============================================================
// UTILITIES
// ============================================================

function formatMoney(amount) {
  const num = parseFloat(amount) || 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num);
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.remove('show');
}

function showToast(message, type = 'info') {
  if (window.Toast) {
    Toast.show(message, type);
  } else {
    console.log(`[${type}] ${message}`);
  }
}

// ============================================================
// TAB 5: NAMING CONVENTIONS
// ============================================================

async function loadNamingConventions() {
  try {
    const res = await fetch('/api/price-intelligence/naming-conventions');
    if (!res.ok) throw new Error('Failed to load naming conventions');
    state.namingConventions = await res.json();
    renderNamingConventions();
  } catch (err) {
    console.error('Error loading naming conventions:', err);
    showToast('Failed to load naming conventions', 'error');
  }
}

function renderNamingConventions() {
  const tbody = document.querySelector('#conventionsTable tbody');
  if (!tbody) return;

  if (!state.namingConventions || state.namingConventions.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty-state">No naming conventions found</td></tr>';
    return;
  }

  tbody.innerHTML = state.namingConventions.map(conv => `
    <tr>
      <td>${conv.category}</td>
      <td>${conv.subcategory || '-'}</td>
      <td style="font-family: monospace; font-size: 0.8125rem;">${escapeHtml(conv.name_pattern)}</td>
      <td>${escapeHtml(conv.example || '-')}</td>
      <td style="font-size: 0.75rem;">${(conv.trigger_keywords || []).join(', ')}</td>
      <td>${conv.default_unit}</td>
      <td>${conv.priority}</td>
      <td>
        <button class="btn btn-sm btn-secondary" onclick="editConvention('${conv.id}')" style="margin-right: 0.25rem;">Edit</button>
        <button class="btn btn-sm btn-secondary" onclick="deleteConvention('${conv.id}')" style="color: var(--accent-red);">Delete</button>
      </td>
    </tr>
  `).join('');
}

function showAddConventionModal() {
  // Reset form
  document.getElementById('conventionId').value = '';
  document.getElementById('conventionCategory').value = '';
  document.getElementById('conventionSubcategory').value = '';
  document.getElementById('conventionPattern').value = '';
  document.getElementById('conventionExample').value = '';
  document.getElementById('conventionKeywords').value = '';
  document.getElementById('conventionUnit').value = 'ea';
  document.getElementById('conventionPriority').value = '50';
  document.getElementById('conventionModalTitle').textContent = 'Add Naming Convention';

  // Show modal
  const modal = document.getElementById('conventionModal');
  modal.style.display = 'flex';
  modal.classList.add('show');
}

function editConvention(id) {
  const conv = state.namingConventions.find(c => c.id === id);
  if (!conv) return;

  document.getElementById('conventionId').value = conv.id;
  document.getElementById('conventionCategory').value = conv.category;
  document.getElementById('conventionSubcategory').value = conv.subcategory || '';
  document.getElementById('conventionPattern').value = conv.name_pattern;
  document.getElementById('conventionExample').value = conv.example || '';
  document.getElementById('conventionKeywords').value = (conv.trigger_keywords || []).join(', ');
  document.getElementById('conventionUnit').value = conv.default_unit || 'ea';
  document.getElementById('conventionPriority').value = conv.priority || 50;
  document.getElementById('conventionModalTitle').textContent = 'Edit Naming Convention';

  const modal = document.getElementById('conventionModal');
  modal.style.display = 'flex';
  modal.classList.add('show');
}

async function saveConvention() {
  const id = document.getElementById('conventionId').value;
  const category = document.getElementById('conventionCategory').value;
  const subcategory = document.getElementById('conventionSubcategory').value || null;
  const name_pattern = document.getElementById('conventionPattern').value;
  const example = document.getElementById('conventionExample').value || null;
  const keywordsStr = document.getElementById('conventionKeywords').value;
  const trigger_keywords = keywordsStr.split(',').map(k => k.trim().toLowerCase()).filter(k => k);
  const default_unit = document.getElementById('conventionUnit').value;
  const priority = parseInt(document.getElementById('conventionPriority').value) || 50;

  if (!category || !name_pattern || trigger_keywords.length === 0) {
    showToast('Category, name pattern, and keywords are required', 'error');
    return;
  }

  try {
    const url = id
      ? `/api/price-intelligence/naming-conventions/${id}`
      : '/api/price-intelligence/naming-conventions';

    const res = await fetch(url, {
      method: id ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, subcategory, name_pattern, example, trigger_keywords, default_unit, priority })
    });

    if (!res.ok) throw new Error('Failed to save convention');

    showToast(id ? 'Convention updated' : 'Convention created', 'success');
    closeModal('conventionModal');
    loadNamingConventions();
  } catch (err) {
    console.error('Error saving convention:', err);
    showToast('Failed to save convention', 'error');
  }
}

async function deleteConvention(id) {
  if (!confirm('Delete this naming convention?')) return;

  try {
    const res = await fetch(`/api/price-intelligence/naming-conventions/${id}`, {
      method: 'DELETE'
    });

    if (!res.ok) throw new Error('Failed to delete convention');

    showToast('Convention deleted', 'success');
    loadNamingConventions();
  } catch (err) {
    console.error('Error deleting convention:', err);
    showToast('Failed to delete convention', 'error');
  }
}

async function testNamingConvention() {
  const description = document.getElementById('testDescription').value;
  if (!description) {
    showToast('Enter a description to test', 'error');
    return;
  }

  try {
    const res = await fetch('/api/price-intelligence/naming-conventions/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description })
    });

    if (!res.ok) throw new Error('Failed to test convention');
    const result = await res.json();

    // Display results
    document.getElementById('testResultName').textContent = result.standardized_name;
    document.getElementById('testResultCategory').textContent = `${result.category}${result.subcategory ? ' / ' + result.subcategory : ''} (${result.unit})`;
    document.getElementById('testResultPattern').textContent = result.matched_convention
      ? result.matched_convention.pattern
      : 'No matching convention (fallback used)';
    document.getElementById('testResultAttributes').textContent = Object.keys(result.extracted_attributes).length > 0
      ? JSON.stringify(result.extracted_attributes)
      : 'None extracted';
    document.getElementById('namingTestResult').style.display = 'block';
  } catch (err) {
    console.error('Error testing convention:', err);
    showToast('Failed to test naming convention', 'error');
  }
}

// ============================================================
// TAB 6: REVIEW QUEUE
// ============================================================

async function loadReviewQueueStats() {
  try {
    const res = await fetch('/api/price-intelligence/review-queue/stats');
    if (!res.ok) throw new Error('Failed to load review stats');
    const stats = await res.json();

    // Update stats display
    const pending = document.getElementById('reviewPending');
    const approved = document.getElementById('reviewApproved');
    const rejected = document.getElementById('reviewRejected');

    if (pending) pending.textContent = stats.pending;
    if (approved) approved.textContent = stats.approved;
    if (rejected) rejected.textContent = stats.rejected;

    // Update badge on tab
    const badge = document.getElementById('reviewQueueBadge');
    if (badge) {
      if (stats.pending > 0) {
        badge.textContent = stats.pending;
        badge.style.display = 'inline-flex';
      } else {
        badge.style.display = 'none';
      }
    }
  } catch (err) {
    console.error('Error loading review stats:', err);
  }
}

async function loadReviewQueue(resetOffset = true) {
  try {
    if (resetOffset) {
      state.reviewQueuePagination.offset = 0;
    }
    const { offset, limit } = state.reviewQueuePagination;
    const res = await fetch(`/api/price-intelligence/review-queue?status=${state.reviewQueueFilter}&limit=${limit}&offset=${offset}`);
    if (!res.ok) throw new Error('Failed to load review queue');
    const result = await res.json();
    state.reviewQueue = result.items || [];
    state.reviewQueuePagination = result.pagination || { total: 0, limit: 50, offset: 0, hasMore: false };
    state.selectedReviewItems.clear();
    renderReviewQueue();
    renderReviewQueuePagination();
    updateBulkApproveButton();
  } catch (err) {
    console.error('Error loading review queue:', err);
    showToast('Failed to load review queue', 'error');
  }
}

function renderReviewQueue() {
  const tbody = document.querySelector('#reviewQueueTable tbody');
  if (!tbody) return;

  if (!state.reviewQueue || state.reviewQueue.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="empty-state">
      <div class="empty-state-icon">✓</div>
      <div class="empty-state-title">No items to review</div>
      <div class="empty-state-message">${state.reviewQueueFilter === 'pending' ? 'All items have been reviewed' : 'No items match this filter'}</div>
    </td></tr>`;
    return;
  }

  tbody.innerHTML = state.reviewQueue.map(item => `
    <tr>
      <td><input type="checkbox" class="review-checkbox" data-id="${item.id}" onchange="toggleReviewItem('${item.id}')" ${state.selectedReviewItems.has(item.id) ? 'checked' : ''}></td>
      <td style="font-weight: 500;">${escapeHtml(item.standard_name)}</td>
      <td style="font-size: 0.8125rem; color: var(--text-secondary);">${escapeHtml(item.original_description || '-')}</td>
      <td>${item.category}${item.subcategory ? '/' + item.subcategory : ''}</td>
      <td>${item.standard_unit}</td>
      <td>${item.source_vendor?.name || '-'}</td>
      <td>${formatDate(item.created_at)}</td>
      <td>
        ${item.review_status === 'pending' ? `
          <button class="btn btn-sm btn-primary" onclick="approveItem('${item.id}')" style="margin-right: 0.25rem;">Approve</button>
          <button class="btn btn-sm btn-secondary" onclick="rejectItem('${item.id}')" style="color: var(--accent-red);">Reject</button>
        ` : `
          <span class="badge badge-${item.review_status === 'approved' ? 'success' : 'secondary'}">${item.review_status}</span>
        `}
      </td>
    </tr>
  `).join('');
}

function filterReviewQueue(status) {
  state.reviewQueueFilter = status;

  // Update button states
  document.querySelectorAll('#tab-review-queue .view-toggle button').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.status === status);
  });

  loadReviewQueue();
}

function toggleReviewItem(id) {
  if (state.selectedReviewItems.has(id)) {
    state.selectedReviewItems.delete(id);
  } else {
    state.selectedReviewItems.add(id);
  }
  updateBulkApproveButton();
}

function toggleSelectAllReview() {
  const selectAll = document.getElementById('selectAllReview');
  const checkboxes = document.querySelectorAll('.review-checkbox');

  if (selectAll.checked) {
    checkboxes.forEach(cb => {
      state.selectedReviewItems.add(cb.dataset.id);
      cb.checked = true;
    });
  } else {
    state.selectedReviewItems.clear();
    checkboxes.forEach(cb => cb.checked = false);
  }
  updateBulkApproveButton();
}

function updateBulkApproveButton() {
  const btn = document.getElementById('bulkApproveBtn');
  if (btn) {
    btn.disabled = state.selectedReviewItems.size === 0;
    btn.textContent = state.selectedReviewItems.size > 0
      ? `Approve Selected (${state.selectedReviewItems.size})`
      : 'Approve Selected';
  }
}

async function approveItem(id) {
  try {
    const res = await fetch(`/api/price-intelligence/review-queue/${id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });

    if (!res.ok) throw new Error('Failed to approve item');

    showToast('Item approved', 'success');
    loadReviewQueue();
    loadReviewQueueStats();
  } catch (err) {
    console.error('Error approving item:', err);
    showToast('Failed to approve item', 'error');
  }
}

async function rejectItem(id) {
  if (!confirm('Reject and deactivate this item?')) return;

  try {
    const res = await fetch(`/api/price-intelligence/review-queue/${id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });

    if (!res.ok) throw new Error('Failed to reject item');

    showToast('Item rejected', 'success');
    loadReviewQueue();
    loadReviewQueueStats();
  } catch (err) {
    console.error('Error rejecting item:', err);
    showToast('Failed to reject item', 'error');
  }
}

async function bulkApproveSelected() {
  if (state.selectedReviewItems.size === 0) return;

  const item_ids = Array.from(state.selectedReviewItems);

  try {
    const res = await fetch('/api/price-intelligence/review-queue/bulk-approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item_ids })
    });

    if (!res.ok) throw new Error('Failed to bulk approve');
    const result = await res.json();

    showToast(result.message, 'success');
    state.selectedReviewItems.clear();
    loadReviewQueue();
    loadReviewQueueStats();
  } catch (err) {
    console.error('Error bulk approving:', err);
    showToast('Failed to bulk approve items', 'error');
  }
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function renderReviewQueuePagination() {
  const container = document.getElementById('reviewQueuePagination');
  if (!container) return;

  const { total, limit, offset, hasMore } = state.reviewQueuePagination;
  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(total / limit);

  if (total === 0) {
    container.innerHTML = '';
    return;
  }

  const start = offset + 1;
  const end = Math.min(offset + limit, total);

  container.innerHTML = `
    <div class="pagination-info">
      Showing ${start}-${end} of ${total} items
    </div>
    <div class="pagination-controls">
      <button class="btn btn-sm btn-secondary" onclick="reviewQueuePrevPage()" ${offset === 0 ? 'disabled' : ''}>
        Previous
      </button>
      <span class="pagination-page">Page ${currentPage} of ${totalPages}</span>
      <button class="btn btn-sm btn-secondary" onclick="reviewQueueNextPage()" ${!hasMore ? 'disabled' : ''}>
        Next
      </button>
    </div>
  `;
}

function reviewQueuePrevPage() {
  if (state.reviewQueuePagination.offset > 0) {
    state.reviewQueuePagination.offset -= state.reviewQueuePagination.limit;
    if (state.reviewQueuePagination.offset < 0) state.reviewQueuePagination.offset = 0;
    loadReviewQueue(false);
  }
}

function reviewQueueNextPage() {
  if (state.reviewQueuePagination.hasMore) {
    state.reviewQueuePagination.offset += state.reviewQueuePagination.limit;
    loadReviewQueue(false);
  }
}

// ============================================================
// TAB 7: LABOR BIDS
// ============================================================

// Add labor bids state
state.laborCategories = [];
state.laborBids = [];
state.laborBidsFilter = { category: '', job: '', status: '' };
state.laborBidsPagination = { total: 0, limit: 50, offset: 0, hasMore: false };
state.currentBid = null;
state.categorySpecs = {};  // Cache specs by category

async function loadLaborBidsData() {
  await Promise.all([
    loadLaborCategories(),
    loadLaborBidsStats(),
    loadLaborBids()
  ]);
  populateLaborJobFilter();
}

async function loadLaborBidsStats() {
  try {
    const res = await fetch('/api/labor-bids/stats');
    if (!res.ok) return;
    const stats = await res.json();

    document.getElementById('laborBidCount').textContent = stats.total_bids?.toLocaleString() || '0';
    document.getElementById('laborActiveReviews').textContent = stats.active_bids?.toLocaleString() || '0';
    document.getElementById('laborCategories').textContent = stats.trade_categories?.toLocaleString() || '18';
    document.getElementById('laborTrackedSubs').textContent = stats.tracked_vendors?.toLocaleString() || '0';
  } catch (err) {
    console.error('Error loading labor stats:', err);
  }
}

async function loadLaborCategories() {
  try {
    const res = await fetch('/api/labor-bids/categories');
    if (!res.ok) return;
    state.laborCategories = await res.json();
    renderLaborCategorySidebar();
    populateCategorySelects();
  } catch (err) {
    console.error('Error loading labor categories:', err);
  }
}

function renderLaborCategorySidebar() {
  const container = document.getElementById('laborCategoryList');
  if (!container) return;

  const allItem = container.querySelector('[data-category=""]');
  if (allItem) {
    const countSpan = allItem.querySelector('.category-count');
    if (countSpan) countSpan.textContent = state.laborBidsPagination.total || '-';
  }

  const categoriesHtml = state.laborCategories.map(cat => `
    <div class="category-item${state.laborBidsFilter.category === cat.id ? ' active' : ''}"
         data-category="${cat.id}"
         onclick="selectLaborCategory('${cat.id}')">
      <span class="category-name">${cat.name}</span>
      <span class="category-count" title="${cat.code}">${cat.code}</span>
    </div>
  `).join('');

  container.innerHTML = `
    <div class="category-item${!state.laborBidsFilter.category ? ' active' : ''}"
         data-category=""
         onclick="selectLaborCategory('')">
      <span class="category-name">All Trades</span>
      <span class="category-count" id="laborAllBidsCount">${state.laborBidsPagination.total || '-'}</span>
    </div>
    ${categoriesHtml}
  `;
}

function selectLaborCategory(categoryId) {
  state.laborBidsFilter.category = categoryId;

  // Update active state
  document.querySelectorAll('#laborCategoryList .category-item').forEach(item => {
    item.classList.toggle('active', item.dataset.category === categoryId);
  });

  // Update title
  const category = state.laborCategories.find(c => c.id === categoryId);
  document.getElementById('laborCategoryTitle').textContent = category ? category.name : 'All Labor Bids';

  loadLaborBids();
}

function populateLaborJobFilter() {
  const select = document.getElementById('laborJobFilter');
  if (!select) return;

  select.innerHTML = '<option value="">All Jobs</option>' +
    state.jobs.map(j => `<option value="${j.id}">${escapeHtml(j.name)}</option>`).join('');
}

function filterLaborBids() {
  state.laborBidsFilter.job = document.getElementById('laborJobFilter')?.value || '';
  state.laborBidsFilter.status = document.getElementById('laborStatusFilter')?.value || '';
  loadLaborBids();
}

async function loadLaborBids(resetOffset = true) {
  try {
    if (resetOffset) {
      state.laborBidsPagination.offset = 0;
    }

    const { offset, limit } = state.laborBidsPagination;
    const params = new URLSearchParams();
    params.set('limit', limit);
    params.set('offset', offset);
    if (state.laborBidsFilter.category) params.set('category_id', state.laborBidsFilter.category);
    if (state.laborBidsFilter.job) params.set('job_id', state.laborBidsFilter.job);
    if (state.laborBidsFilter.status) params.set('status', state.laborBidsFilter.status);

    const res = await fetch(`/api/labor-bids/bids?${params}`);
    if (!res.ok) throw new Error('Failed to load labor bids');

    const result = await res.json();
    state.laborBids = result.bids || [];
    state.laborBidsPagination = result.pagination || { total: 0, limit: 50, offset: 0, hasMore: false };

    renderLaborBids();
    renderLaborBidsPagination();

    // Update sidebar count
    const countEl = document.getElementById('laborAllBidsCount');
    if (countEl && !state.laborBidsFilter.category) {
      countEl.textContent = state.laborBidsPagination.total;
    }
  } catch (err) {
    console.error('Error loading labor bids:', err);
    showToast('Failed to load labor bids', 'error');
  }
}

function renderLaborBids() {
  const tbody = document.querySelector('#laborBidsTable tbody');
  if (!tbody) return;

  if (!state.laborBids || state.laborBids.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="empty-state">
      <div class="empty-state-icon">📋</div>
      <div class="empty-state-title">No labor bids found</div>
      <div class="empty-state-message">Add a bid to start tracking subcontractor proposals</div>
    </td></tr>`;
    return;
  }

  tbody.innerHTML = state.laborBids.map(bid => {
    const statusClass = getStatusClass(bid.status);
    return `
      <tr class="clickable-row" onclick="openBidDetail('${bid.id}')">
        <td>${bid.category?.name || '-'}</td>
        <td>${escapeHtml(bid.job?.name || '-')}</td>
        <td>${escapeHtml(bid.vendor?.name || '-')}</td>
        <td style="text-align: right; font-family: monospace;">${formatMoney(bid.total_amount)}</td>
        <td style="text-align: right; font-family: monospace; ${bid.price_per_sf ? '' : 'color: var(--text-secondary);'}">${bid.price_per_sf ? '$' + bid.price_per_sf.toFixed(2) : '-'}</td>
        <td style="font-size: 0.75rem;">${bid.spec_multiplier && bid.spec_multiplier !== 1 ? `${bid.spec_multiplier.toFixed(2)}x` : '-'}</td>
        <td><span class="badge badge-${statusClass}">${bid.status}</span></td>
        <td style="font-size: 0.8125rem;">${bid.bid_date ? formatDate(bid.bid_date) : '-'}</td>
        <td onclick="event.stopPropagation();">
          <button class="btn btn-sm btn-secondary" onclick="editBid('${bid.id}')" style="margin-right: 0.25rem;">Edit</button>
          <button class="btn btn-sm btn-secondary" onclick="deleteBid('${bid.id}')" style="color: var(--accent-red);">Delete</button>
        </td>
      </tr>
    `;
  }).join('');
}

function getStatusClass(status) {
  const map = {
    received: 'info',
    reviewing: 'warning',
    accepted: 'success',
    rejected: 'secondary',
    expired: 'secondary',
    countered: 'info'
  };
  return map[status] || 'secondary';
}

function renderLaborBidsPagination() {
  const container = document.getElementById('laborBidsPagination');
  if (!container) return;

  const { total, limit, offset, hasMore } = state.laborBidsPagination;
  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(total / limit);

  if (total === 0) {
    container.innerHTML = '';
    return;
  }

  const start = offset + 1;
  const end = Math.min(offset + limit, total);

  container.innerHTML = `
    <div class="pagination-info">
      Showing ${start}-${end} of ${total} bids
    </div>
    <div class="pagination-controls">
      <button class="btn btn-sm btn-secondary" onclick="laborBidsPrevPage()" ${offset === 0 ? 'disabled' : ''}>Previous</button>
      <span class="pagination-page">Page ${currentPage} of ${totalPages}</span>
      <button class="btn btn-sm btn-secondary" onclick="laborBidsNextPage()" ${!hasMore ? 'disabled' : ''}>Next</button>
    </div>
  `;
}

function laborBidsPrevPage() {
  if (state.laborBidsPagination.offset > 0) {
    state.laborBidsPagination.offset -= state.laborBidsPagination.limit;
    loadLaborBids(false);
  }
}

function laborBidsNextPage() {
  if (state.laborBidsPagination.hasMore) {
    state.laborBidsPagination.offset += state.laborBidsPagination.limit;
    loadLaborBids(false);
  }
}

// ============================================================
// ADD/EDIT BID MODAL
// ============================================================

function populateCategorySelects() {
  const selects = [document.getElementById('bidCategory'), document.getElementById('specsTradeFilter')];

  selects.forEach(select => {
    if (!select) return;
    select.innerHTML = '<option value="">Select trade...</option>' +
      state.laborCategories.map(c => `<option value="${c.id}">${c.name} (${c.code})</option>`).join('');
  });
}

function showAddBidModal() {
  // Reset form
  document.getElementById('bidId').value = '';
  document.getElementById('bidJob').value = '';
  document.getElementById('bidCategory').value = '';
  document.getElementById('bidVendor').value = '';
  document.getElementById('bidNumber').value = '';
  document.getElementById('bidBaseAmount').value = '';
  document.getElementById('bidAlternates').value = '';
  document.getElementById('bidJobSF').value = '';
  document.getElementById('bidDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('bidValidUntil').value = '';
  document.getElementById('bidLeadTime').value = '';
  document.getElementById('bidDuration').value = '';
  document.getElementById('bidScopeNotes').value = '';
  document.getElementById('bidPaymentTerms').value = '';
  document.getElementById('bidWarranty').value = '';
  document.getElementById('bidSpecsContainer').innerHTML = '<p style="color: var(--text-secondary); grid-column: span 2;">Select a trade category to see available specifications</p>';

  // Populate dropdowns
  const jobSelect = document.getElementById('bidJob');
  jobSelect.innerHTML = '<option value="">Select job...</option>' +
    state.jobs.map(j => `<option value="${j.id}">${escapeHtml(j.name)}</option>`).join('');

  const vendorSelect = document.getElementById('bidVendor');
  vendorSelect.innerHTML = '<option value="">Select vendor...</option>' +
    state.vendors.map(v => `<option value="${v.id}">${escapeHtml(v.name)}</option>`).join('');

  document.getElementById('addBidModalTitle').textContent = 'Add Labor Bid';

  const modal = document.getElementById('addBidModal');
  modal.style.display = 'flex';
  modal.classList.add('show');
}

async function editBid(id) {
  try {
    const res = await fetch(`/api/labor-bids/bids/${id}`);
    if (!res.ok) throw new Error('Failed to load bid');
    const bid = await res.json();

    showAddBidModal();

    document.getElementById('bidId').value = bid.id;
    document.getElementById('bidJob').value = bid.job_id || '';
    document.getElementById('bidCategory').value = bid.category_id || '';
    document.getElementById('bidVendor').value = bid.vendor_id || '';
    document.getElementById('bidNumber').value = bid.bid_number || '';
    document.getElementById('bidBaseAmount').value = bid.base_amount || '';
    document.getElementById('bidAlternates').value = bid.alternates_amount || '';
    document.getElementById('bidJobSF').value = bid.job?.conditioned_sf || '';
    document.getElementById('bidDate').value = bid.bid_date || '';
    document.getElementById('bidValidUntil').value = bid.valid_until || '';
    document.getElementById('bidLeadTime').value = bid.lead_time_days || '';
    document.getElementById('bidDuration').value = bid.duration_days || '';
    document.getElementById('bidScopeNotes').value = bid.scope_notes || '';
    document.getElementById('bidPaymentTerms').value = bid.payment_terms || '';
    document.getElementById('bidWarranty').value = bid.warranty_terms || '';

    document.getElementById('addBidModalTitle').textContent = 'Edit Labor Bid';

    // Load specs for category
    if (bid.category_id) {
      await loadCategorySpecs();
      // Check the specs that are already selected
      if (bid.specs) {
        bid.specs.forEach(spec => {
          const checkbox = document.querySelector(`#bidSpecsContainer input[value="${spec.spec_id || spec.spec?.id}"]`);
          if (checkbox) checkbox.checked = true;
        });
      }
    }
  } catch (err) {
    console.error('Error loading bid:', err);
    showToast('Failed to load bid', 'error');
  }
}

async function loadJobMetrics() {
  const jobId = document.getElementById('bidJob').value;
  if (!jobId) {
    document.getElementById('bidJobSF').value = '';
    return;
  }

  try {
    const res = await fetch(`/api/labor-bids/jobs/${jobId}/metrics`);
    if (!res.ok) return;
    const metrics = await res.json();
    document.getElementById('bidJobSF').value = metrics.conditioned_sf || '';
  } catch (err) {
    console.error('Error loading job metrics:', err);
  }
}

async function loadCategorySpecs() {
  const categoryId = document.getElementById('bidCategory').value;
  const container = document.getElementById('bidSpecsContainer');

  if (!categoryId) {
    container.innerHTML = '<p style="color: var(--text-secondary); grid-column: span 2;">Select a trade category to see available specifications</p>';
    return;
  }

  // Check cache
  if (state.categorySpecs[categoryId]) {
    renderBidSpecs(state.categorySpecs[categoryId]);
    return;
  }

  try {
    const res = await fetch(`/api/labor-bids/specifications?category_id=${categoryId}`);
    if (!res.ok) throw new Error('Failed to load specs');
    const specs = await res.json();

    state.categorySpecs[categoryId] = specs;
    renderBidSpecs(specs);
  } catch (err) {
    console.error('Error loading specs:', err);
    container.innerHTML = '<p style="color: var(--accent-red);">Failed to load specifications</p>';
  }
}

function renderBidSpecs(specs) {
  const container = document.getElementById('bidSpecsContainer');
  if (!container || !specs || specs.length === 0) {
    container.innerHTML = '<p style="color: var(--text-secondary); grid-column: span 2;">No specifications available for this trade</p>';
    return;
  }

  // Group by spec_type
  const grouped = {};
  specs.forEach(spec => {
    if (!grouped[spec.spec_type]) grouped[spec.spec_type] = [];
    grouped[spec.spec_type].push(spec);
  });

  container.innerHTML = Object.entries(grouped).map(([type, typeSpecs]) => `
    <div class="form-group">
      <label style="text-transform: capitalize;">${type.replace(/_/g, ' ')}</label>
      <select class="form-control bid-spec-select" data-type="${type}">
        <option value="">Not specified</option>
        ${typeSpecs.map(s => `<option value="${s.id}" data-multiplier="${s.price_multiplier}" ${s.is_default ? 'selected' : ''}>${s.spec_name} (${s.price_multiplier}x)</option>`).join('')}
      </select>
    </div>
  `).join('');
}

async function saveLaborBid() {
  const id = document.getElementById('bidId').value;
  const job_id = document.getElementById('bidJob').value;
  const category_id = document.getElementById('bidCategory').value;
  const vendor_id = document.getElementById('bidVendor').value;
  const bid_number = document.getElementById('bidNumber').value || null;
  const base_amount = parseFloat(document.getElementById('bidBaseAmount').value);
  const alternates_amount = parseFloat(document.getElementById('bidAlternates').value) || 0;
  const bid_date = document.getElementById('bidDate').value || null;
  const valid_until = document.getElementById('bidValidUntil').value || null;
  const lead_time_days = parseInt(document.getElementById('bidLeadTime').value) || null;
  const duration_days = parseInt(document.getElementById('bidDuration').value) || null;
  const scope_notes = document.getElementById('bidScopeNotes').value || null;
  const payment_terms = document.getElementById('bidPaymentTerms').value || null;
  const warranty_terms = document.getElementById('bidWarranty').value || null;

  // Collect selected specs
  const spec_ids = [];
  document.querySelectorAll('.bid-spec-select').forEach(select => {
    if (select.value) spec_ids.push(select.value);
  });

  if (!job_id || !category_id || !vendor_id || isNaN(base_amount)) {
    showToast('Job, trade, vendor, and base amount are required', 'error');
    return;
  }

  try {
    const url = id ? `/api/labor-bids/bids/${id}` : '/api/labor-bids/bids';
    const res = await fetch(url, {
      method: id ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        job_id, category_id, vendor_id, bid_number, base_amount, alternates_amount,
        bid_date, valid_until, lead_time_days, duration_days, scope_notes,
        payment_terms, warranty_terms, spec_ids
      })
    });

    if (!res.ok) throw new Error('Failed to save bid');

    showToast(id ? 'Bid updated' : 'Bid created', 'success');
    closeModal('addBidModal');
    loadLaborBids();
    loadLaborBidsStats();
  } catch (err) {
    console.error('Error saving bid:', err);
    showToast('Failed to save bid', 'error');
  }
}

async function deleteBid(id) {
  if (!confirm('Delete this bid?')) return;

  try {
    const res = await fetch(`/api/labor-bids/bids/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete bid');

    showToast('Bid deleted', 'success');
    loadLaborBids();
    loadLaborBidsStats();
  } catch (err) {
    console.error('Error deleting bid:', err);
    showToast('Failed to delete bid', 'error');
  }
}

// ============================================================
// BID DETAIL MODAL
// ============================================================

async function openBidDetail(id) {
  try {
    const res = await fetch(`/api/labor-bids/bids/${id}`);
    if (!res.ok) throw new Error('Failed to load bid');
    state.currentBid = await res.json();

    renderBidDetail();

    const modal = document.getElementById('bidDetailModal');
    modal.style.display = 'flex';
    modal.classList.add('show');
  } catch (err) {
    console.error('Error loading bid detail:', err);
    showToast('Failed to load bid details', 'error');
  }
}

function renderBidDetail() {
  const bid = state.currentBid;
  if (!bid) return;

  document.getElementById('bidDetailTitle').textContent = `${bid.category?.name || 'Bid'} - ${bid.vendor?.name || 'Unknown'}`;
  document.getElementById('bidDetailSubtitle').textContent = bid.job?.name || '';

  // Stats bar
  document.getElementById('bidDetailStats').innerHTML = `
    <div class="pi-stat-card">
      <div class="pi-stat-label">Total Amount</div>
      <div class="pi-stat-value">${formatMoney(bid.total_amount)}</div>
    </div>
    <div class="pi-stat-card">
      <div class="pi-stat-label">$/SF</div>
      <div class="pi-stat-value">${bid.price_per_sf ? '$' + bid.price_per_sf.toFixed(2) : '-'}</div>
    </div>
    <div class="pi-stat-card">
      <div class="pi-stat-label">Normalized $/SF</div>
      <div class="pi-stat-value">${bid.normalized_per_sf ? '$' + bid.normalized_per_sf.toFixed(2) : '-'}</div>
    </div>
    <div class="pi-stat-card">
      <div class="pi-stat-label">Spec Multiplier</div>
      <div class="pi-stat-value">${bid.spec_multiplier?.toFixed(2) || '1.00'}x</div>
    </div>
    <div class="pi-stat-card">
      <div class="pi-stat-label">Status</div>
      <div class="pi-stat-value"><span class="badge badge-${getStatusClass(bid.status)}">${bid.status}</span></div>
    </div>
  `;

  // Specifications
  const specsEl = document.getElementById('bidDetailSpecs');
  if (bid.specs && bid.specs.length > 0) {
    specsEl.innerHTML = bid.specs.map(s => `
      <div style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid var(--border);">
        <span style="text-transform: capitalize;">${(s.spec?.spec_type || '').replace(/_/g, ' ')}</span>
        <span style="font-weight: 500;">${s.spec?.spec_name || 'N/A'} <span style="color: var(--text-secondary);">(${s.spec?.price_multiplier || 1}x)</span></span>
      </div>
    `).join('');
  } else {
    specsEl.innerHTML = '<p style="color: var(--text-secondary);">No specifications selected</p>';
  }

  // Scope
  const scopeEl = document.getElementById('bidDetailScope');
  scopeEl.innerHTML = bid.scope_notes
    ? `<p>${escapeHtml(bid.scope_notes)}</p>`
    : '<p style="color: var(--text-secondary);">No scope notes</p>';

  // Terms
  const termsEl = document.getElementById('bidDetailTerms');
  termsEl.innerHTML = `
    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem;">
      <div>
        <div class="form-label" style="margin-bottom: 0.25rem;">Bid Date</div>
        <div>${bid.bid_date ? formatDate(bid.bid_date) : '-'}</div>
      </div>
      <div>
        <div class="form-label" style="margin-bottom: 0.25rem;">Valid Until</div>
        <div>${bid.valid_until ? formatDate(bid.valid_until) : '-'}</div>
      </div>
      <div>
        <div class="form-label" style="margin-bottom: 0.25rem;">Lead Time</div>
        <div>${bid.lead_time_days ? bid.lead_time_days + ' days' : '-'}</div>
      </div>
      <div>
        <div class="form-label" style="margin-bottom: 0.25rem;">Duration</div>
        <div>${bid.duration_days ? bid.duration_days + ' days' : '-'}</div>
      </div>
      <div>
        <div class="form-label" style="margin-bottom: 0.25rem;">Payment Terms</div>
        <div>${escapeHtml(bid.payment_terms) || '-'}</div>
      </div>
      <div>
        <div class="form-label" style="margin-bottom: 0.25rem;">Warranty</div>
        <div>${escapeHtml(bid.warranty_terms) || '-'}</div>
      </div>
    </div>
  `;

  // Comparison bids
  renderBidComparison();

  // Update action buttons
  const acceptBtn = document.getElementById('acceptBidBtn');
  const rejectBtn = document.getElementById('rejectBidBtn');
  if (bid.status === 'accepted') {
    acceptBtn.disabled = true;
    acceptBtn.textContent = 'Accepted';
    rejectBtn.style.display = 'none';
  } else if (bid.status === 'rejected') {
    acceptBtn.style.display = 'none';
    rejectBtn.disabled = true;
    rejectBtn.textContent = 'Rejected';
  } else {
    acceptBtn.disabled = false;
    acceptBtn.textContent = 'Accept Bid';
    acceptBtn.style.display = 'inline-block';
    rejectBtn.disabled = false;
    rejectBtn.textContent = 'Reject';
    rejectBtn.style.display = 'inline-block';
  }
}

function renderBidComparison() {
  const bid = state.currentBid;
  const tbody = document.querySelector('#bidComparisonTable tbody');
  if (!tbody || !bid) return;

  const allBids = [bid, ...(bid.comparison_bids || [])];

  if (allBids.length <= 1) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-secondary);">No other bids for comparison</td></tr>';
    return;
  }

  tbody.innerHTML = allBids.map(b => `
    <tr class="${b.id === bid.id ? 'active-row' : ''}" style="${b.id === bid.id ? 'background: var(--accent);' : ''}">
      <td style="font-weight: ${b.id === bid.id ? '600' : '400'};">${b.vendor?.name || 'Unknown'} ${b.id === bid.id ? '(current)' : ''}</td>
      <td style="text-align: right; font-family: monospace;">${formatMoney(b.total_amount)}</td>
      <td style="text-align: right; font-family: monospace;">${b.price_per_sf ? '$' + b.price_per_sf.toFixed(2) : '-'}</td>
      <td style="text-align: right; font-family: monospace;">${b.normalized_amount ? '$' + (b.normalized_amount / (bid.job?.conditioned_sf || 1)).toFixed(2) : '-'}</td>
      <td><span class="badge badge-${getStatusClass(b.status)}">${b.status}</span></td>
      <td>${b.is_lowest ? '<span style="color: var(--accent-green); font-weight: 500;">Lowest</span>' : '-'}</td>
    </tr>
  `).join('');
}

function switchBidTab(tabId) {
  document.querySelectorAll('#bidDetailModal .tabs .tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.tab === tabId);
  });

  document.querySelectorAll('#bidDetailModal .tab-content').forEach(content => {
    content.style.display = content.id === `tab-${tabId}` ? 'block' : 'none';
  });
}

async function acceptCurrentBid() {
  if (!state.currentBid) return;

  try {
    const res = await fetch(`/api/labor-bids/bids/${state.currentBid.id}/accept`, {
      method: 'POST'
    });

    if (!res.ok) throw new Error('Failed to accept bid');

    showToast('Bid accepted', 'success');
    closeModal('bidDetailModal');
    loadLaborBids();
    loadLaborBidsStats();
  } catch (err) {
    console.error('Error accepting bid:', err);
    showToast('Failed to accept bid', 'error');
  }
}

async function rejectCurrentBid() {
  if (!state.currentBid) return;

  const reason = prompt('Reason for rejection (optional):');

  try {
    const res = await fetch(`/api/labor-bids/bids/${state.currentBid.id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason })
    });

    if (!res.ok) throw new Error('Failed to reject bid');

    showToast('Bid rejected', 'success');
    closeModal('bidDetailModal');
    loadLaborBids();
    loadLaborBidsStats();
  } catch (err) {
    console.error('Error rejecting bid:', err);
    showToast('Failed to reject bid', 'error');
  }
}

// ============================================================
// SPECIFICATIONS MODAL
// ============================================================

function showSpecsModal() {
  const modal = document.getElementById('specsModal');
  modal.style.display = 'flex';
  modal.classList.add('show');

  document.getElementById('specsContent').innerHTML = '<p style="color: var(--text-secondary);">Select a trade to view specifications</p>';
}

async function loadSpecsForTrade() {
  const categoryId = document.getElementById('specsTradeFilter').value;
  const container = document.getElementById('specsContent');

  if (!categoryId) {
    container.innerHTML = '<p style="color: var(--text-secondary);">Select a trade to view specifications</p>';
    return;
  }

  try {
    const res = await fetch(`/api/labor-bids/categories/${categoryId}`);
    if (!res.ok) throw new Error('Failed to load category');
    const data = await res.json();

    renderSpecsContent(data);
  } catch (err) {
    console.error('Error loading specs:', err);
    container.innerHTML = '<p style="color: var(--accent-red);">Failed to load specifications</p>';
  }
}

function renderSpecsContent(data) {
  const container = document.getElementById('specsContent');
  if (!container) return;

  // Group specs by type
  const grouped = {};
  (data.specifications || []).forEach(spec => {
    if (!grouped[spec.spec_type]) grouped[spec.spec_type] = [];
    grouped[spec.spec_type].push(spec);
  });

  let html = `
    <div style="margin-bottom: 1.5rem;">
      <h4 style="margin: 0 0 0.5rem 0;">${data.name}</h4>
      <p style="color: var(--text-secondary); margin: 0;">
        Typical price range: <strong>$${data.typical_low} - $${data.typical_high}</strong> ${data.metric_label}
      </p>
    </div>
  `;

  if (Object.keys(grouped).length === 0) {
    html += '<p style="color: var(--text-secondary);">No specifications defined for this trade</p>';
  } else {
    html += Object.entries(grouped).map(([type, specs]) => `
      <div class="spend-chart-card" style="margin-bottom: 1rem;">
        <h4 style="margin: 0 0 0.75rem 0; text-transform: capitalize;">${type.replace(/_/g, ' ')}</h4>
        <table class="data-table" style="margin: 0;">
          <thead>
            <tr>
              <th>Name</th>
              <th>Description</th>
              <th style="text-align: right;">Multiplier</th>
              <th style="text-align: center;">Default</th>
            </tr>
          </thead>
          <tbody>
            ${specs.map(s => `
              <tr>
                <td style="font-weight: 500;">${s.spec_name}</td>
                <td style="font-size: 0.8125rem; color: var(--text-secondary);">${s.spec_description || '-'}</td>
                <td style="text-align: right; font-family: monospace;">${s.price_multiplier.toFixed(2)}x</td>
                <td style="text-align: center;">${s.is_default ? '✓' : ''}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `).join('');
  }

  container.innerHTML = html;
}

// Update switchTab to handle labor-bids
const originalSwitchTab = switchTab;
window.switchTab = function(tabId) {
  state.currentTab = tabId;

  document.querySelectorAll('.tabs .tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.tab === tabId);
  });

  document.querySelectorAll('.tab-content').forEach(content => {
    content.style.display = content.id === `tab-${tabId}` ? 'block' : 'none';
  });

  switch (tabId) {
    case 'price-database':
      if (!state.matrixData) loadPriceMatrix();
      break;
    case 'order-optimizer':
      break;
    case 'savings-tracker':
      loadSavingsData();
      break;
    case 'spend-analytics':
      loadSpendAnalytics();
      break;
    case 'naming-conventions':
      loadNamingConventions();
      break;
    case 'review-queue':
      loadReviewQueue();
      loadReviewQueueStats();
      break;
    case 'labor-bids':
      loadLaborBidsData();
      break;
  }
};

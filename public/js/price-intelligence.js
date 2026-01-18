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
  searchDebounce: null
};

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
      loadJobs().catch(err => console.error('Jobs failed:', err))
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
    populateCategoryFilter();
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
  }
}

// ============================================================
// TAB 1: PRICE DATABASE
// ============================================================

async function loadPriceMatrix() {
  const tbody = document.getElementById('priceMatrixBody');
  tbody.innerHTML = '<tr><td colspan="7" class="loading">Loading price data...</td></tr>';

  try {
    const category = document.getElementById('categoryFilter')?.value || '';
    const url = category
      ? `/api/price-intelligence/matrix?category=${encodeURIComponent(category)}&limit=100`
      : '/api/price-intelligence/matrix?limit=100';

    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to load price matrix');

    state.matrixData = await res.json();
    renderPriceMatrix();
  } catch (err) {
    console.error('Error loading price matrix:', err);
    tbody.innerHTML = '<tr><td colspan="7" class="empty-state">Failed to load price data</td></tr>';
  }
}

function renderPriceMatrix() {
  const tbody = document.getElementById('priceMatrixBody');
  const search = document.getElementById('searchInput')?.value?.toLowerCase() || '';

  if (!state.matrixData || !state.matrixData.items || state.matrixData.items.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No items found. Add items to start tracking prices.</td></tr>';
    return;
  }

  let items = state.matrixData.items;

  // Apply search filter
  if (search) {
    items = items.filter(item =>
      item.standard_name?.toLowerCase().includes(search) ||
      item.category?.toLowerCase().includes(search)
    );
  }

  if (items.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No items match your search</td></tr>';
    return;
  }

  const priceField = `price_per_${state.priceUnit}`;

  tbody.innerHTML = items.map(item => {
    const bestPrice = item.best_price || '-';
    const spread = item.price_spread || 0;
    const spreadPercent = item.best_price && item.worst_price && item.best_price > 0
      ? ((item.worst_price - item.best_price) / item.best_price * 100).toFixed(0)
      : 0;

    // Calculate confidence (simplified)
    const confidence = item.vendor_count > 2 ? 'high' : item.vendor_count > 0 ? 'medium' : 'low';
    const confidencePercent = item.vendor_count > 2 ? 90 : item.vendor_count > 0 ? 50 : 0;

    return `
      <tr onclick="showItemDetail('${item.id}')" style="cursor: pointer;">
        <td>
          <div class="cell-title">${item.standard_name}</div>
          ${item.subcategory ? `<div class="cell-subtitle">${item.subcategory}</div>` : ''}
        </td>
        <td>${item.category || '-'}</td>
        <td>${item.standard_unit || 'ea'}</td>
        <td style="text-align: center;">${item.vendor_count || 0}</td>
        <td class="col-amount">${bestPrice !== '-' ? formatMoney(bestPrice) : '-'}</td>
        <td class="col-amount">${spread > 0 ? `${formatMoney(spread)} <span style="color: var(--muted-foreground); font-size: 0.75rem;">(${spreadPercent}%)</span>` : '-'}</td>
        <td>
          <span class="confidence-bar">
            <span class="confidence-fill ${confidence}" style="width: ${confidencePercent}%"></span>
          </span>
        </td>
      </tr>
    `;
  }).join('');
}

function populateCategoryFilter() {
  const select = document.getElementById('categoryFilter');
  if (!select) return;

  select.innerHTML = '<option value="">All Categories</option>';
  state.categories.forEach(cat => {
    select.innerHTML += `<option value="${cat.category}">${cat.category}</option>`;
  });
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
  document.querySelectorAll('.unit-toggle button').forEach(btn => {
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

  tbody.innerHTML = history.map(h => `
    <tr>
      <td>${formatDate(h.price_date)}</td>
      <td>${h.vendor?.name || 'Unknown'}</td>
      <td><span class="status-badge status-${h.source_type === 'invoice' ? 'approved' : 'pending'}">${h.source_type}</span></td>
      <td class="amount">${formatMoney(h.unit_price)}</td>
      <td>${h.unit}</td>
      <td>${h.quantity || '-'}</td>
    </tr>
  `).join('');
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

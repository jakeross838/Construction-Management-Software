/**
 * Assembly Library JavaScript
 * Manages assembly templates and their line items
 */

// ============================================================
// STATE
// ============================================================

let templates = [];
let categories = [];
let currentTemplateId = null;
let currentTemplate = null;
let costCodes = [];

// ============================================================
// INITIALIZATION
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
  setupEventListeners();

  // Load reference data in parallel
  await Promise.all([
    loadCategories().catch(err => console.error('Categories failed:', err)),
    loadCostCodes().catch(err => console.error('Cost codes failed:', err))
  ]);

  // Load templates
  await loadTemplates();
});

function setupEventListeners() {
  // Search with debounce
  let searchTimer;
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => loadTemplates(), 200);
    });
  }

  // Close modal on outside click
  const modal = document.getElementById('templateEditorModal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeTemplateEditor();
      }
    });
  }

  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && currentTemplateId) {
      closeTemplateEditor();
    }
  });
}

// Debounce helper for search
function handleSearch() {
  // Already handled by input event listener with debounce
}

// ============================================================
// DATA LOADING
// ============================================================

async function loadTemplates() {
  const grid = document.getElementById('templatesGrid');
  const emptyState = document.getElementById('emptyState');

  try {
    const params = new URLSearchParams();

    // Category filter
    const categoryFilter = document.getElementById('categoryFilter');
    if (categoryFilter && categoryFilter.value) {
      params.append('category', categoryFilter.value);
    }

    // Search filter
    const searchInput = document.getElementById('searchInput');
    if (searchInput && searchInput.value.trim()) {
      params.append('search', searchInput.value.trim());
    }

    // Active filter - show only active unless checkbox checked
    const showInactive = document.getElementById('showInactive');
    if (!showInactive || !showInactive.checked) {
      params.append('is_active', 'true');
    }

    const res = await fetch(`/api/assembly-templates?${params}`);
    if (!res.ok) throw new Error('Failed to load templates');
    templates = await res.json();

    renderTemplateList();
    updateStats();
  } catch (err) {
    console.error('Failed to load templates:', err);
    if (typeof showToast === 'function') {
      showToast('Failed to load templates', 'error');
    }
    grid.innerHTML = '<div class="error-state">Failed to load templates</div>';
  }
}

async function loadCategories() {
  try {
    const res = await fetch('/api/assembly-templates/categories');
    if (!res.ok) throw new Error('Failed to load categories');
    categories = await res.json();
    populateCategoryDropdown();
  } catch (err) {
    console.error('Failed to load categories:', err);
  }
}

async function loadCostCodes() {
  try {
    const res = await fetch('/api/cost-codes');
    if (!res.ok) throw new Error('Failed to load cost codes');
    costCodes = await res.json();
  } catch (err) {
    console.error('Failed to load cost codes:', err);
  }
}

function populateCategoryDropdown() {
  const filter = document.getElementById('categoryFilter');
  if (!filter) return;

  // Keep the "All Categories" option
  filter.innerHTML = '<option value="">All Categories</option>';

  categories.forEach(cat => {
    filter.innerHTML += `<option value="${escapeHtml(cat)}">${escapeHtml(cat)}</option>`;
  });
}

// ============================================================
// RENDER FUNCTIONS
// ============================================================

function renderTemplateList() {
  const grid = document.getElementById('templatesGrid');
  const emptyState = document.getElementById('emptyState');

  if (templates.length === 0) {
    grid.innerHTML = '';
    emptyState.style.display = 'flex';
    return;
  }

  emptyState.style.display = 'none';

  grid.innerHTML = templates.map(t => {
    const statusBadge = t.is_active
      ? '<span class="badge badge-success">Active</span>'
      : '<span class="badge badge-secondary">Inactive</span>';

    const description = t.description || 'No description';
    const itemCount = t.item_count || 0;
    const total = formatCurrency(t.total_amount || 0);

    return `
      <div class="template-card" onclick="openTemplateEditor('${t.id}')">
        <div class="template-card-header">
          <h4>${escapeHtml(t.name)}</h4>
          ${statusBadge}
        </div>
        <div class="template-card-body">
          <p>${escapeHtml(description)}</p>
          <div class="template-meta">
            <span><strong>${itemCount}</strong> items</span>
            <span><strong>${total}</strong> total</span>
          </div>
        </div>
        <div class="template-card-footer">
          <span class="badge">${escapeHtml(t.category || 'Uncategorized')}</span>
        </div>
      </div>
    `;
  }).join('');
}

function renderItemsTable() {
  const tbody = document.getElementById('itemsTableBody');
  if (!tbody || !currentTemplate) return;

  const items = currentTemplate.items || [];

  if (items.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="text-secondary" style="text-align: center; padding: 2rem;">
          No items yet. Click "Add Item" below to add line items.
        </td>
      </tr>
    `;
    updateTemplateTotal();
    return;
  }

  tbody.innerHTML = items.map((item, index) => {
    const costCodeOptions = buildCostCodeOptions(item.cost_code_id);
    const total = (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_cost) || 0);

    return `
      <tr data-item-id="${item.id}">
        <td class="col-num">${index + 1}</td>
        <td class="col-code">
          <select onchange="updateTemplateItem('${item.id}', 'cost_code_id', this.value)">
            <option value="">-- None --</option>
            ${costCodeOptions}
          </select>
        </td>
        <td class="col-desc">
          <input type="text" value="${escapeHtml(item.description || '')}"
                 onblur="updateTemplateItem('${item.id}', 'description', this.value)"
                 onkeydown="if(event.key==='Enter'){this.blur()}">
        </td>
        <td class="col-qty">
          <input type="number" value="${item.quantity || 1}" step="0.01" min="0"
                 onblur="updateTemplateItem('${item.id}', 'quantity', this.value)"
                 onkeydown="if(event.key==='Enter'){this.blur()}">
        </td>
        <td class="col-unit">
          <select onchange="updateTemplateItem('${item.id}', 'unit', this.value)">
            ${buildUnitOptions(item.unit)}
          </select>
        </td>
        <td class="col-cost">
          <input type="number" value="${item.unit_cost || 0}" step="0.01" min="0"
                 onblur="updateTemplateItem('${item.id}', 'unit_cost', this.value)"
                 onkeydown="if(event.key==='Enter'){this.blur()}">
        </td>
        <td class="col-total" style="font-weight: 600;">${formatCurrency(total)}</td>
        <td class="col-actions">
          <button class="btn btn-sm btn-danger" onclick="deleteTemplateItem('${item.id}')" title="Remove">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </td>
      </tr>
    `;
  }).join('');

  updateTemplateTotal();
}

function buildCostCodeOptions(selectedId) {
  return costCodes.map(cc => {
    const selected = cc.id === selectedId ? 'selected' : '';
    return `<option value="${cc.id}" ${selected}>${escapeHtml(cc.code)} - ${escapeHtml(cc.name)}</option>`;
  }).join('');
}

function buildUnitOptions(selectedUnit) {
  const units = ['ea', 'sf', 'lf', 'sy', 'cy', 'hr', 'day', 'wk', 'mo', 'ls', 'set', 'pair', 'gal', 'lb'];
  return units.map(u => {
    const selected = u === selectedUnit ? 'selected' : '';
    return `<option value="${u}" ${selected}>${u}</option>`;
  }).join('');
}

function updateTemplateTotal() {
  const totalEl = document.getElementById('templateTotal');
  if (!totalEl || !currentTemplate) return;

  const items = currentTemplate.items || [];
  const total = items.reduce((sum, item) => {
    return sum + (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_cost) || 0);
  }, 0);

  totalEl.textContent = formatCurrency(total);
}

function updateStats() {
  const countEl = document.getElementById('templateCount');
  if (countEl) {
    const activeCount = templates.filter(t => t.is_active).length;
    const totalCount = templates.length;
    countEl.textContent = `${activeCount} active template${activeCount !== 1 ? 's' : ''}`;
  }
}

// ============================================================
// TEMPLATE CRUD
// ============================================================

async function createTemplate() {
  try {
    const res = await fetch('/api/assembly-templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'New Assembly Template',
        category: 'Uncategorized',
        is_active: true,
        created_by: window.currentUser || 'User'
      })
    });

    if (!res.ok) throw new Error('Failed to create template');

    const template = await res.json();
    await loadTemplates();
    openTemplateEditor(template.id);

    if (typeof showToast === 'function') {
      showToast('Template created', 'success');
    }
  } catch (err) {
    console.error('Failed to create template:', err);
    if (typeof showToast === 'function') {
      showToast('Failed to create template', 'error');
    }
  }
}

async function saveTemplate() {
  if (!currentTemplateId) return;

  try {
    const template = {
      name: document.getElementById('templateName').value.trim() || 'Untitled Template',
      description: document.getElementById('templateDescription').value.trim(),
      category: document.getElementById('templateCategory').value.trim() || null,
      is_active: document.getElementById('templateActive').checked
    };

    const res = await fetch(`/api/assembly-templates/${currentTemplateId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(template)
    });

    if (!res.ok) throw new Error('Failed to save template');

    await loadTemplates();
    closeTemplateEditor();

    if (typeof showToast === 'function') {
      showToast('Template saved', 'success');
    }
  } catch (err) {
    console.error('Failed to save template:', err);
    if (typeof showToast === 'function') {
      showToast('Failed to save template', 'error');
    }
  }
}

async function deleteTemplate() {
  if (!currentTemplateId) return;

  if (!confirm('Deactivate this template? It will no longer appear in the assembly picker.')) {
    return;
  }

  try {
    const res = await fetch(`/api/assembly-templates/${currentTemplateId}`, {
      method: 'DELETE'
    });

    if (!res.ok) throw new Error('Failed to deactivate template');

    await loadTemplates();
    closeTemplateEditor();

    if (typeof showToast === 'function') {
      showToast('Template deactivated', 'success');
    }
  } catch (err) {
    console.error('Failed to deactivate template:', err);
    if (typeof showToast === 'function') {
      showToast('Failed to deactivate template', 'error');
    }
  }
}

// ============================================================
// ITEM CRUD
// ============================================================

async function addTemplateItem() {
  if (!currentTemplateId) return;

  try {
    const item = {
      description: 'New Item',
      quantity: 1,
      unit: 'ea',
      unit_cost: 0
    };

    const res = await fetch(`/api/assembly-templates/${currentTemplateId}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item)
    });

    if (!res.ok) throw new Error('Failed to add item');

    await reloadCurrentTemplate();
  } catch (err) {
    console.error('Failed to add item:', err);
    if (typeof showToast === 'function') {
      showToast('Failed to add item', 'error');
    }
  }
}

async function updateTemplateItem(itemId, field, value) {
  if (!currentTemplateId) return;

  try {
    const res = await fetch(`/api/assembly-templates/${currentTemplateId}/items/${itemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value })
    });

    if (!res.ok) throw new Error('Failed to update item');

    await reloadCurrentTemplate();
  } catch (err) {
    console.error('Failed to update item:', err);
    if (typeof showToast === 'function') {
      showToast('Failed to update item', 'error');
    }
  }
}

async function deleteTemplateItem(itemId) {
  if (!currentTemplateId) return;

  try {
    const res = await fetch(`/api/assembly-templates/${currentTemplateId}/items/${itemId}`, {
      method: 'DELETE'
    });

    if (!res.ok) throw new Error('Failed to remove item');

    await reloadCurrentTemplate();

    if (typeof showToast === 'function') {
      showToast('Item removed', 'success');
    }
  } catch (err) {
    console.error('Failed to remove item:', err);
    if (typeof showToast === 'function') {
      showToast('Failed to remove item', 'error');
    }
  }
}

// ============================================================
// MODAL MANAGEMENT
// ============================================================

async function openTemplateEditor(templateId) {
  currentTemplateId = templateId;

  try {
    await reloadCurrentTemplate();

    // Populate form fields
    document.getElementById('templateName').value = currentTemplate.name || '';
    document.getElementById('templateDescription').value = currentTemplate.description || '';
    document.getElementById('templateCategory').value = currentTemplate.category || '';
    document.getElementById('templateActive').checked = currentTemplate.is_active !== false;

    // Render items table
    renderItemsTable();

    // Show modal
    const modal = document.getElementById('templateEditorModal');
    modal.style.display = 'flex';
    modal.classList.add('show');

    // Focus name field
    document.getElementById('templateName').focus();
    document.getElementById('templateName').select();
  } catch (err) {
    console.error('Failed to open template editor:', err);
    if (typeof showToast === 'function') {
      showToast('Failed to load template', 'error');
    }
  }
}

function closeTemplateEditor() {
  const modal = document.getElementById('templateEditorModal');
  modal.classList.remove('show');
  modal.style.display = 'none';
  currentTemplateId = null;
  currentTemplate = null;
}

async function reloadCurrentTemplate() {
  if (!currentTemplateId) return;

  const res = await fetch(`/api/assembly-templates/${currentTemplateId}`);
  if (!res.ok) throw new Error('Failed to reload template');
  currentTemplate = await res.json();

  // Re-render items table if modal is open
  if (document.getElementById('templateEditorModal').classList.contains('show')) {
    renderItemsTable();
  }
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

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

function debounce(fn, delay) {
  let timer;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

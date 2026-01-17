/**
 * Searchable Picker Component
 * A generic searchable dropdown for jobs, vendors, POs, etc.
 */

window.SearchablePicker = {
  // Cache for loaded data
  cache: {
    jobs: null,
    vendors: null,
    pos: null
  },

  // Debounce timer for input
  inputDebounceTimer: null,

  /**
   * Initialize a searchable picker
   * @param {HTMLElement} container - Container element
   * @param {Object} options - Configuration
   *        - type: 'jobs', 'vendors', 'pos', 'costCodes', 'custom'
   *        - value: initial selected ID
   *        - onChange: callback(id) when selection changes
   *        - disabled: whether picker is disabled
   *        - placeholder: input placeholder text
   *        - jobId: for PO filtering by job
   *        - items: for 'custom' type, array of items
   *        - filter: function(item) returning true to include in list
   */
  init(container, options = {}) {
    const { type, value, onChange, disabled, placeholder, jobId, items, filter } = options;

    container.innerHTML = `
      <div class="search-picker ${disabled ? 'disabled' : ''}" data-type="${type}">
        <input type="text" class="search-picker-input" placeholder="${placeholder || 'Search...'}"
               autocomplete="off" ${disabled ? 'readonly' : ''}>
        <input type="hidden" class="search-picker-value">
        <span class="search-picker-clear">&times;</span>
        <div class="search-picker-dropdown"></div>
      </div>
    `;

    const picker = container.querySelector('.search-picker');
    const input = picker.querySelector('.search-picker-input');
    const clear = picker.querySelector('.search-picker-clear');
    const dropdown = picker.querySelector('.search-picker-dropdown');

    picker._type = type;
    picker._onChange = onChange;
    picker._jobId = jobId; // For PO filtering
    picker._customItems = items; // For custom type with provided items
    picker._filter = filter; // Optional filter function

    // Set initial value
    if (value) {
      this.setValue(picker, value);
    }

    // Event handlers
    input.addEventListener('focus', () => this.handleFocus(picker));
    input.addEventListener('blur', () => this.handleBlur(picker));
    input.addEventListener('input', (e) => {
      // Debounce input to prevent excessive DOM updates
      clearTimeout(this.inputDebounceTimer);
      this.inputDebounceTimer = setTimeout(() => {
        this.handleInput(picker, e.target.value);
      }, 150);
    });
    input.addEventListener('keydown', (e) => this.handleKeydown(picker, e));

    clear.addEventListener('mousedown', (e) => {
      e.preventDefault();
      this.clearValue(picker);
      if (onChange) onChange(null);
    });

    dropdown.addEventListener('mousedown', (e) => {
      e.preventDefault();
      const item = e.target.closest('.search-picker-item');
      if (item) {
        const id = item.dataset.id;
        this.selectItem(picker, id);
        // For "No PO" option, pass null to onChange instead of 'none'
        if (onChange) onChange(id === 'none' ? null : id);
      }
    });
  },

  /**
   * Load data based on type
   */
  async loadData(type, jobId = null, customItems = null) {
    // For custom type, return the provided items
    if (type === 'custom' && customItems) {
      return customItems;
    }

    // For POs, don't cache as it depends on jobId
    if (type === 'pos') {
      if (!jobId) return [];
      const response = await fetch(`/api/jobs/${jobId}/purchase-orders`);
      return response.ok ? await response.json() : [];
    }

    // For cost codes
    if (type === 'costCodes') {
      if (this.cache.costCodes) return this.cache.costCodes;
      const response = await fetch('/api/cost-codes');
      if (response.ok) {
        const data = await response.json();
        // API returns {costCodes: [...]} - extract the array
        this.cache.costCodes = data.costCodes || data;
        return this.cache.costCodes;
      }
      return [];
    }

    if (this.cache[type]) return this.cache[type];

    try {
      let url;
      switch (type) {
        case 'jobs':
          url = '/api/jobs?status=active';
          break;
        case 'vendors':
          url = '/api/vendors';
          break;
        default:
          return [];
      }

      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to load ${type}`);

      this.cache[type] = await response.json();
      return this.cache[type];
    } catch (err) {
      console.error(`Failed to load ${type}:`, err);
      return [];
    }
  },

  /**
   * Set picker value
   */
  async setValue(picker, id) {
    if (!id) {
      this.clearValue(picker);
      return;
    }

    const type = picker._type;
    const data = await this.loadData(type, picker._jobId, picker._customItems);
    const item = data.find(d => d.id === id);

    if (item) {
      const input = picker.querySelector('.search-picker-input');
      const hidden = picker.querySelector('.search-picker-value');
      input.value = this.getDisplayText(type, item);
      hidden.value = item.id;
      picker.classList.add('has-value');
    }
  },

  /**
   * Get display text for an item
   */
  getDisplayText(type, item) {
    switch (type) {
      case 'jobs':
        return item.name;
      case 'vendors':
        return item.name;
      case 'pos':
        return item.po_number + (item.vendor_name ? ` - ${item.vendor_name}` : '');
      case 'costCodes':
        return `${item.code} - ${item.name}`;
      case 'custom':
        return item.label || item.name || item.id;
      default:
        return item.label || item.name || item.id;
    }
  },

  /**
   * Clear picker value
   */
  clearValue(picker) {
    const input = picker.querySelector('.search-picker-input');
    const hidden = picker.querySelector('.search-picker-value');
    input.value = '';
    hidden.value = '';
    picker.classList.remove('has-value');
  },

  /**
   * Handle input focus
   */
  async handleFocus(picker) {
    picker.classList.add('focused');
    await this.showDropdown(picker, '');
  },

  /**
   * Handle input blur
   */
  handleBlur(picker) {
    setTimeout(() => {
      picker.classList.remove('focused');
      this.hideDropdown(picker);
    }, 200);
  },

  /**
   * Handle input changes
   */
  handleInput(picker, query) {
    this.showDropdown(picker, query);
  },

  /**
   * Handle keyboard navigation
   */
  handleKeydown(picker, e) {
    const dropdown = picker.querySelector('.search-picker-dropdown');
    const items = dropdown.querySelectorAll('.search-picker-item');

    if (!picker._selectedIndex) picker._selectedIndex = -1;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        picker._selectedIndex = Math.min(picker._selectedIndex + 1, items.length - 1);
        this.updateSelection(picker, items);
        break;

      case 'ArrowUp':
        e.preventDefault();
        picker._selectedIndex = Math.max(picker._selectedIndex - 1, 0);
        this.updateSelection(picker, items);
        break;

      case 'Enter':
        e.preventDefault();
        if (picker._selectedIndex >= 0 && items[picker._selectedIndex]) {
          const id = items[picker._selectedIndex].dataset.id;
          this.selectItem(picker, id);
          // For "No PO" option, pass null to onChange instead of 'none'
          if (picker._onChange) picker._onChange(id === 'none' ? null : id);
        }
        break;

      case 'Escape':
        e.preventDefault();
        picker.querySelector('.search-picker-input').blur();
        break;
    }
  },

  /**
   * Update selection highlight
   */
  updateSelection(picker, items) {
    items.forEach((item, i) => {
      item.classList.toggle('selected', i === picker._selectedIndex);
    });
    if (items[picker._selectedIndex]) {
      items[picker._selectedIndex].scrollIntoView({ block: 'nearest' });
    }
  },

  /**
   * Select an item
   */
  async selectItem(picker, id) {
    const type = picker._type;
    const input = picker.querySelector('.search-picker-input');
    const hidden = picker.querySelector('.search-picker-value');

    // Handle "No PO" selection
    if (id === 'none' && type === 'pos') {
      input.value = 'No PO';
      hidden.value = '';
      picker.classList.add('has-value');
      input.blur();
      return;
    }

    const data = await this.loadData(type, picker._jobId);
    const item = data.find(d => d.id === id);

    if (!item) return;

    input.value = this.getDisplayText(type, item);
    hidden.value = item.id;
    picker.classList.add('has-value');
    input.blur();
  },

  /**
   * Show dropdown with filtered results
   */
  async showDropdown(picker, query) {
    const dropdown = picker.querySelector('.search-picker-dropdown');
    const type = picker._type;
    picker._selectedIndex = -1;

    let data = await this.loadData(type, picker._jobId, picker._customItems);

    // Apply custom filter if provided
    if (picker._filter && typeof picker._filter === 'function') {
      data = data.filter(picker._filter);
    }

    // Filter by search query
    const q = query.toLowerCase().trim();
    let filtered = q
      ? data.filter(item => {
          const text = this.getDisplayText(type, item).toLowerCase();
          return text.includes(q);
        })
      : data;

    // Sort - cost codes by code number, others alphabetically
    if (type === 'costCodes') {
      filtered.sort((a, b) => a.code.localeCompare(b.code));
    } else {
      filtered.sort((a, b) => {
        const textA = this.getDisplayText(type, a);
        const textB = this.getDisplayText(type, b);
        return textA.localeCompare(textB);
      });
    }

    // Build HTML
    let html = '';

    // Add "No PO" option at the top for PO pickers
    if (type === 'pos') {
      const noPOText = 'No PO';
      const showNoPO = !q || noPOText.toLowerCase().includes(q);
      if (showNoPO) {
        html += `
          <div class="search-picker-item no-po-option" data-id="none">
            <span class="no-po-label">No PO</span>
            <span class="no-po-hint">Invoice not linked to a Purchase Order</span>
          </div>
        `;
      }
    }

    if (filtered.length === 0 && !html) {
      html = `<div class="search-picker-empty">No results found</div>`;
    } else {
      for (const item of filtered) {
        // Special rendering for cost codes
        if (type === 'costCodes') {
          html += `
            <div class="search-picker-item" data-id="${item.id}">
              <span class="picker-code">${item.code}</span>
              <span class="picker-name">${this.highlightMatch(item.name, q)}</span>
            </div>
          `;
        } else {
          const displayText = this.getDisplayText(type, item);
          html += `
            <div class="search-picker-item" data-id="${item.id}">
              ${this.highlightMatch(displayText, q)}
            </div>
          `;
        }
      }
    }

    dropdown.innerHTML = html;
    dropdown.classList.add('visible');
  },

  /**
   * Hide dropdown
   */
  hideDropdown(picker) {
    const dropdown = picker.querySelector('.search-picker-dropdown');
    dropdown.classList.remove('visible');
  },

  /**
   * Highlight matching text
   */
  highlightMatch(text, query) {
    if (!query) return text;
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
  },

  /**
   * Update job ID for PO picker (when job changes)
   */
  updateJobId(container, jobId) {
    const picker = container.querySelector('.search-picker');
    if (picker) {
      picker._jobId = jobId;
      this.clearValue(picker);
    }
  }
};

/**
 * Cost Code Picker Component
 *
 * A searchable typeahead component for selecting cost codes.
 * Groups codes by category and supports keyboard navigation.
 */

window.CostCodePicker = {
  // Cached cost codes (loaded once)
  costCodes: null,
  codesByCategory: null,

  // Active picker state
  activeInput: null,
  selectedIndex: -1,
  filteredCodes: [],
  onSelect: null,

  /**
   * Load cost codes from server (cached)
   */
  async loadCostCodes() {
    if (this.costCodes) return this.costCodes;

    try {
      const response = await fetch('/api/cost-codes');
      if (!response.ok) throw new Error('Failed to load cost codes');

      this.costCodes = await response.json();

      // Group by category
      this.codesByCategory = {};
      for (const cc of this.costCodes) {
        const cat = cc.category || 'Uncategorized';
        if (!this.codesByCategory[cat]) {
          this.codesByCategory[cat] = [];
        }
        this.codesByCategory[cat].push(cc);
      }

      return this.costCodes;
    } catch (err) {
      console.error('Failed to load cost codes:', err);
      return [];
    }
  },

  /**
   * Initialize a cost code picker on an element
   * @param {HTMLElement} container - Container element
   * @param {Object} options - Configuration options
   */
  init(container, options = {}) {
    const { value, onChange, disabled } = options;

    // Build picker HTML
    container.innerHTML = `
      <div class="cc-picker ${disabled ? 'disabled' : ''}">
        <input type="text" class="cc-picker-input" placeholder="Search cost codes..."
               autocomplete="off" ${disabled ? 'readonly' : ''}>
        <input type="hidden" class="cc-picker-value">
        <span class="cc-picker-clear" title="Clear selection">&times;</span>
        <div class="cc-picker-dropdown"></div>
      </div>
    `;

    const picker = container.querySelector('.cc-picker');
    const input = container.querySelector('.cc-picker-input');
    const hidden = container.querySelector('.cc-picker-value');
    const clear = container.querySelector('.cc-picker-clear');
    const dropdown = container.querySelector('.cc-picker-dropdown');

    // Set initial value
    if (value) {
      this.setValue(picker, value);
    }

    // Event handlers
    input.addEventListener('focus', () => this.handleFocus(picker));
    input.addEventListener('blur', () => this.handleBlur(picker));
    input.addEventListener('input', (e) => this.handleInput(picker, e.target.value));
    input.addEventListener('keydown', (e) => this.handleKeydown(picker, e));
    clear.addEventListener('mousedown', (e) => {
      e.preventDefault();
      this.clearValue(picker);
      if (onChange) onChange(null);
    });

    dropdown.addEventListener('mousedown', (e) => {
      e.preventDefault();
      const item = e.target.closest('.cc-picker-item');
      if (item && !item.classList.contains('cc-picker-header')) {
        const codeId = item.dataset.id;
        this.selectCode(picker, codeId);
        if (onChange) onChange(codeId);
      }
    });

    // Store callback
    picker._onChange = onChange;
  },

  /**
   * Set picker value by cost code ID
   */
  async setValue(picker, codeId) {
    if (!codeId) {
      this.clearValue(picker);
      return;
    }

    await this.loadCostCodes();
    const cc = this.costCodes.find(c => c.id === codeId);

    if (cc) {
      const input = picker.querySelector('.cc-picker-input');
      const hidden = picker.querySelector('.cc-picker-value');
      input.value = `${cc.code} - ${cc.name}`;
      hidden.value = cc.id;
      picker.classList.add('has-value');
    }
  },

  /**
   * Clear picker value
   */
  clearValue(picker) {
    const input = picker.querySelector('.cc-picker-input');
    const hidden = picker.querySelector('.cc-picker-value');
    input.value = '';
    hidden.value = '';
    picker.classList.remove('has-value');
  },

  /**
   * Handle input focus
   */
  async handleFocus(picker) {
    await this.loadCostCodes();
    picker.classList.add('focused');
    this.showDropdown(picker, '');
  },

  /**
   * Handle input blur
   */
  handleBlur(picker) {
    // Delay to allow click events on dropdown
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
    const dropdown = picker.querySelector('.cc-picker-dropdown');
    const items = dropdown.querySelectorAll('.cc-picker-item:not(.cc-picker-header)');

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this.selectedIndex = Math.min(this.selectedIndex + 1, items.length - 1);
        this.updateSelection(dropdown);
        break;

      case 'ArrowUp':
        e.preventDefault();
        this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
        this.updateSelection(dropdown);
        break;

      case 'Enter':
        e.preventDefault();
        if (this.selectedIndex >= 0 && items[this.selectedIndex]) {
          const codeId = items[this.selectedIndex].dataset.id;
          this.selectCode(picker, codeId);
          if (picker._onChange) picker._onChange(codeId);
        }
        break;

      case 'Escape':
        e.preventDefault();
        picker.querySelector('.cc-picker-input').blur();
        break;
    }
  },

  /**
   * Update selection highlight
   */
  updateSelection(dropdown) {
    const items = dropdown.querySelectorAll('.cc-picker-item:not(.cc-picker-header)');
    items.forEach((item, i) => {
      item.classList.toggle('selected', i === this.selectedIndex);
    });

    // Scroll into view
    if (items[this.selectedIndex]) {
      items[this.selectedIndex].scrollIntoView({ block: 'nearest' });
    }
  },

  /**
   * Select a cost code
   */
  selectCode(picker, codeId) {
    const cc = this.costCodes.find(c => c.id === codeId);
    if (!cc) return;

    const input = picker.querySelector('.cc-picker-input');
    const hidden = picker.querySelector('.cc-picker-value');

    input.value = `${cc.code} - ${cc.name}`;
    hidden.value = cc.id;
    picker.classList.add('has-value');
    input.blur();
  },

  /**
   * Show dropdown with filtered results (flat list, sorted by code)
   */
  showDropdown(picker, query) {
    const dropdown = picker.querySelector('.cc-picker-dropdown');
    this.selectedIndex = -1;

    // Filter codes
    const q = query.toLowerCase().trim();
    this.filteredCodes = q
      ? this.costCodes.filter(cc =>
          cc.code.toLowerCase().includes(q) ||
          cc.name.toLowerCase().includes(q)
        )
      : [...this.costCodes];

    // Sort by code number
    this.filteredCodes.sort((a, b) => a.code.localeCompare(b.code));

    // Build HTML - flat list without category headers
    let html = '';
    if (this.filteredCodes.length === 0) {
      html = '<div class="cc-picker-empty">No matching cost codes</div>';
    } else {
      for (const cc of this.filteredCodes) {
        html += `
          <div class="cc-picker-item" data-id="${cc.id}">
            <span class="cc-code">${cc.code}</span>
            <span class="cc-name">${this.highlightMatch(cc.name, q)}</span>
          </div>
        `;
      }
    }

    dropdown.innerHTML = html;
    dropdown.classList.add('visible');
  },

  /**
   * Hide dropdown
   */
  hideDropdown(picker) {
    const dropdown = picker.querySelector('.cc-picker-dropdown');
    dropdown.classList.remove('visible');
  },

  /**
   * Highlight matching text
   */
  highlightMatch(text, query) {
    if (!query) return text;
    const regex = new RegExp(`(${this.escapeRegex(query)})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
  },

  /**
   * Escape regex special characters
   */
  escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
};

// Auto-initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
  window.CostCodePicker.loadCostCodes();
});

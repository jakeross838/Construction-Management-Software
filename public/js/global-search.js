/**
 * Global Search Component
 * Cmd/Ctrl+K to open, searches across all entities
 */

(function() {
  'use strict';

  // Use global normalizeStatusClass if available (from app.js), otherwise define locally
  const normalizeStatusClass = window.normalizeStatusClass || function(status) {
    if (!status) return '';
    return status.toString().toLowerCase().replace(/_/g, '-');
  };

  let searchModal = null;
  let searchInput = null;
  let resultsContainer = null;
  let debounceTimer = null;

  function createModal() {
    // Create modal HTML
    const modal = document.createElement('div');
    modal.id = 'globalSearchModal';
    modal.className = 'search-modal';
    modal.innerHTML = `
      <div class="search-modal-backdrop" onclick="GlobalSearch.close()"></div>
      <div class="search-modal-content">
        <div class="search-input-wrapper">
          <svg class="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"></circle>
            <path d="m21 21-4.35-4.35"></path>
          </svg>
          <input type="text" id="globalSearchInput" placeholder="Search jobs, vendors, invoices, POs..." autocomplete="off">
          <kbd class="search-shortcut">ESC</kbd>
        </div>
        <div class="search-results" id="searchResults">
          <div class="search-hint">Type to search across the entire system</div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    searchModal = modal;
    searchInput = document.getElementById('globalSearchInput');
    resultsContainer = document.getElementById('searchResults');

    // Add input listener with debounce
    searchInput.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        performSearch(e.target.value);
      }, 200);
    });

    // Keyboard navigation
    searchInput.addEventListener('keydown', handleKeydown);
  }

  function handleKeydown(e) {
    const items = resultsContainer.querySelectorAll('.search-result-item');
    const active = resultsContainer.querySelector('.search-result-item.active');
    let index = Array.from(items).indexOf(active);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (index < items.length - 1) {
        items[index]?.classList.remove('active');
        items[index + 1]?.classList.add('active');
        items[index + 1]?.scrollIntoView({ block: 'nearest' });
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (index > 0) {
        items[index]?.classList.remove('active');
        items[index - 1]?.classList.add('active');
        items[index - 1]?.scrollIntoView({ block: 'nearest' });
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const activeItem = resultsContainer.querySelector('.search-result-item.active');
      if (activeItem) {
        window.location.href = activeItem.dataset.url;
      }
    } else if (e.key === 'Escape') {
      close();
    }
  }

  async function performSearch(query) {
    if (!query || query.length < 2) {
      resultsContainer.innerHTML = '<div class="search-hint">Type at least 2 characters to search</div>';
      return;
    }

    resultsContainer.innerHTML = '<div class="search-loading">Searching...</div>';

    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=15`);
      const data = await res.json();

      if (data.results.length === 0) {
        resultsContainer.innerHTML = '<div class="search-empty">No results found</div>';
        return;
      }

      // Group results by type
      const grouped = {};
      data.results.forEach(r => {
        if (!grouped[r.type]) grouped[r.type] = [];
        grouped[r.type].push(r);
      });

      const typeLabels = {
        job: 'Jobs',
        vendor: 'Vendors',
        invoice: 'Invoices',
        po: 'Purchase Orders'
      };

      const typeIcons = {
        job: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path></svg>',
        vendor: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>',
        invoice: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>',
        po: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"></path><rect x="9" y="3" width="6" height="4" rx="1"></rect></svg>'
      };

      let html = '';
      let firstItem = true;
      Object.keys(grouped).forEach(type => {
        html += `<div class="search-group">
          <div class="search-group-label">${typeIcons[type]} ${typeLabels[type]}</div>
          ${grouped[type].map(r => {
            const activeClass = firstItem ? 'active' : '';
            firstItem = false;
            return `<a href="${r.url}" class="search-result-item ${activeClass}" data-url="${r.url}">
              <div class="search-result-title">${escapeHtml(r.title)}</div>
              <div class="search-result-subtitle">${escapeHtml(r.subtitle)}</div>
              ${r.status ? `<span class="search-result-status status-${normalizeStatusClass(r.status)}">${r.status}</span>` : ''}
            </a>`;
          }).join('')}
        </div>`;
      });

      resultsContainer.innerHTML = html;
    } catch (err) {
      resultsContainer.innerHTML = '<div class="search-error">Search failed</div>';
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, m => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[m]));
  }

  function open() {
    if (!searchModal) createModal();
    searchModal.classList.add('open');
    searchInput.value = '';
    resultsContainer.innerHTML = '<div class="search-hint">Type to search across the entire system</div>';
    searchInput.focus();
  }

  function close() {
    if (searchModal) {
      searchModal.classList.remove('open');
    }
  }

  // Global keyboard shortcut
  document.addEventListener('keydown', (e) => {
    // Cmd+K or Ctrl+K
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      open();
    }
  });

  // Export API
  window.GlobalSearch = { open, close };
})();

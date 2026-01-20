/**
 * Dropdown Navigation Component
 * Compact header with dropdown menus organized by construction workflow
 * Flow: Dashboard → Pre-Construction → Active Projects → Finance → Closeout → Admin
 */

(function() {
  'use strict';

  // Navigation structure - organized by construction workflow
  const navGroups = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      href: 'dashboard.html',
      items: [] // Direct link, no dropdown
    },
    {
      id: 'precon',
      label: 'Pre-Construction',
      items: [
        { id: 'leads', label: 'Leads', href: 'leads.html' },
        { id: 'job-profile', label: 'Job Profile', href: 'job-profile.html' },
        { id: 'bids', label: 'Bids', href: 'bids.html' },
        { id: 'estimates', label: 'Estimates', href: 'estimates.html' },
        { id: 'budget-builder', label: 'Budget Builder', href: 'budget-builder.html' },
        { id: 'contracts', label: 'Contracts', href: 'contracts.html' },
        { id: 'selections', label: 'Selections', href: 'selections.html' }
      ]
    },
    {
      id: 'active',
      label: 'Active Projects',
      items: [
        { id: 'schedule', label: 'Schedule', href: 'schedule.html' },
        { id: 'daily-logs', label: 'Daily Logs', href: 'daily-logs.html' },
        { id: 'photos', label: 'Photos', href: 'photos.html' },
        { id: 'documents', label: 'Documents', href: 'documents.html' },
        { id: 'rfis', label: 'RFIs', href: 'rfis.html' },
        { id: 'submittals', label: 'Submittals', href: 'submittals.html' },
        { id: 'inspections', label: 'Inspections', href: 'inspections.html' },
        { id: 'punch-lists', label: 'Punch Lists', href: 'punch-lists.html' }
      ]
    },
    {
      id: 'finance',
      label: 'Finance',
      items: [
        { id: 'invoices', label: 'Invoices', href: 'index.html' },
        { id: 'pos', label: 'Purchase Orders', href: 'pos.html' },
        { id: 'cos', label: 'Change Orders', href: 'change-orders.html' },
        { id: 'draws', label: 'Draws', href: 'draws.html' },
        { id: 'budget', label: 'Budgets', href: 'budgets.html' },
        { id: 'lien', label: 'Lien Releases', href: 'lien-releases.html' },
        { id: 'price-intel', label: 'Price Intelligence', href: 'price-intelligence.html' }
      ]
    },
    {
      id: 'closeout',
      label: 'Closeout',
      items: [
        { id: 'warranties', label: 'Warranties', href: 'warranties.html' },
        { id: 'closeout-page', label: 'Project Closeout', href: 'closeout.html' },
        { id: 'recon', label: 'Reconciliation', href: 'reconciliation.html' }
      ]
    },
    {
      id: 'admin',
      label: 'Admin',
      items: [
        { id: 'companies', label: 'Companies', href: 'companies.html' },
        { id: 'contacts', label: 'Contacts', href: 'contacts.html' },
        { id: 'vendors', label: 'Vendors', href: 'vendors.html' },
        { id: 'cost-codes', label: 'Cost Codes', href: 'cost-codes.html' }
      ]
    }
  ];

  // Get current page info from URL
  function getCurrentPage() {
    const path = window.location.pathname;
    const filename = path.split('/').pop() || 'index.html';

    for (const group of navGroups) {
      // Check if it's a direct link group (like Dashboard)
      if (group.href === filename) {
        return { groupId: group.id, itemId: group.id };
      }
      // Check sub-items
      for (const item of group.items) {
        if (item.href === filename) {
          return { groupId: group.id, itemId: item.id };
        }
      }
    }
    return { groupId: 'dashboard', itemId: 'dashboard' };
  }

  // Create the navigation HTML with dropdowns
  function createNavHTML() {
    const current = getCurrentPage();

    const navHTML = navGroups.map(group => {
      const isActive = group.id === current.groupId;

      if (group.href) {
        // Direct link (like Dashboard)
        return `<a href="${group.href}" class="nav-dropdown-item ${isActive ? 'active' : ''}">${group.label}</a>`;
      } else {
        // Group with dropdown
        const dropdownItems = group.items.map(item => {
          const itemActive = item.id === current.itemId;
          return `<a href="${item.href}" class="dropdown-menu-item ${itemActive ? 'active' : ''}">${item.label}</a>`;
        }).join('');

        return `
          <div class="nav-dropdown ${isActive ? 'active' : ''}">
            <button class="nav-dropdown-trigger" aria-expanded="false" aria-haspopup="true">
              ${group.label}
              <svg class="dropdown-chevron" width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
            <div class="dropdown-menu">
              ${dropdownItems}
            </div>
          </div>
        `;
      }
    }).join('');

    return navHTML;
  }

  // Handle dropdown interactions
  function setupDropdownInteractions() {
    const dropdowns = document.querySelectorAll('.nav-dropdown');
    let activeDropdown = null;
    let hoverTimeout = null;

    dropdowns.forEach(dropdown => {
      const trigger = dropdown.querySelector('.nav-dropdown-trigger');
      const menu = dropdown.querySelector('.dropdown-menu');

      // Mouse enter - open dropdown
      dropdown.addEventListener('mouseenter', () => {
        clearTimeout(hoverTimeout);
        if (activeDropdown && activeDropdown !== dropdown) {
          closeDropdown(activeDropdown);
        }
        openDropdown(dropdown);
        activeDropdown = dropdown;
      });

      // Mouse leave - close with delay
      dropdown.addEventListener('mouseleave', () => {
        hoverTimeout = setTimeout(() => {
          closeDropdown(dropdown);
          if (activeDropdown === dropdown) {
            activeDropdown = null;
          }
        }, 150);
      });

      // Click trigger for mobile/accessibility
      trigger.addEventListener('click', (e) => {
        e.preventDefault();
        const isOpen = dropdown.classList.contains('open');

        // Close all other dropdowns
        dropdowns.forEach(d => closeDropdown(d));

        if (!isOpen) {
          openDropdown(dropdown);
          activeDropdown = dropdown;
        } else {
          activeDropdown = null;
        }
      });

      // Keyboard navigation
      trigger.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          trigger.click();
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          openDropdown(dropdown);
          const firstItem = menu.querySelector('.dropdown-menu-item');
          if (firstItem) firstItem.focus();
        } else if (e.key === 'Escape') {
          closeDropdown(dropdown);
          trigger.focus();
        }
      });

      // Menu item keyboard navigation
      menu.querySelectorAll('.dropdown-menu-item').forEach((item, index, items) => {
        item.addEventListener('keydown', (e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            const next = items[index + 1] || items[0];
            next.focus();
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            const prev = items[index - 1] || items[items.length - 1];
            prev.focus();
          } else if (e.key === 'Escape') {
            closeDropdown(dropdown);
            trigger.focus();
          }
        });
      });
    });

    // Close dropdowns when clicking outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.nav-dropdown')) {
        dropdowns.forEach(d => closeDropdown(d));
        activeDropdown = null;
      }
    });
  }

  function openDropdown(dropdown) {
    dropdown.classList.add('open');
    const trigger = dropdown.querySelector('.nav-dropdown-trigger');
    if (trigger) trigger.setAttribute('aria-expanded', 'true');
  }

  function closeDropdown(dropdown) {
    dropdown.classList.remove('open');
    const trigger = dropdown.querySelector('.nav-dropdown-trigger');
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
  }

  // Initialize navigation
  function init() {
    const header = document.querySelector('.header');
    if (!header) return;

    // Hide the sub-nav (we're moving to single-row dropdowns)
    const headerSub = header.querySelector('.header-sub');
    if (headerSub) {
      headerSub.style.display = 'none';
    }

    // Update main nav with dropdown structure
    let mainNav = header.querySelector('.main-nav');
    if (mainNav) {
      mainNav.innerHTML = createNavHTML();
      mainNav.classList.add('nav-dropdown-container');
    }

    // Setup dropdown interactions
    setupDropdownInteractions();

    // Add mobile hamburger if not exists
    if (!document.querySelector('.mobile-menu-btn')) {
      const headerTop = document.querySelector('.header-top');
      const brand = headerTop?.querySelector('.header-brand');
      if (brand && headerTop) {
        const hamburger = document.createElement('button');
        hamburger.className = 'mobile-menu-btn';
        hamburger.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12h18M3 6h18M3 18h18"/></svg>';
        hamburger.setAttribute('aria-label', 'Toggle menu');
        hamburger.onclick = window.NavSidebar.toggleMobile;
        headerTop.insertBefore(hamburger, brand.nextSibling);
      }
    }

    // Add search button to header actions
    const headerActions = document.querySelector('.header-actions');
    if (headerActions && !document.querySelector('.search-trigger-btn')) {
      const searchBtn = document.createElement('button');
      searchBtn.className = 'search-trigger-btn';
      searchBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.35-4.35"></path></svg>';
      searchBtn.setAttribute('aria-label', 'Search (Cmd+K)');
      searchBtn.setAttribute('title', 'Search (Cmd+K)');
      searchBtn.onclick = () => window.GlobalSearch?.open();
      headerActions.insertBefore(searchBtn, headerActions.firstChild);
    }
  }

  // Export API
  window.NavSidebar = {
    init,
    toggle: () => {},
    toggleMobile: () => {
      const mainNav = document.querySelector('.main-nav');
      const isOpen = mainNav?.classList.contains('mobile-open');

      if (mainNav) {
        mainNav.classList.toggle('mobile-open', !isOpen);
      }
      document.body.classList.toggle('mobile-menu-open', !isOpen);
    },
    closeMobile: () => {
      document.querySelector('.main-nav')?.classList.remove('mobile-open');
      document.body.classList.remove('mobile-menu-open');
    },
    isCollapsed: () => false
  };

  // Auto-init when DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

/**
 * Group Navigation Component
 * Creates a two-level navigation: groups (top) and sub-items (below)
 * Reorganized for v1.6: Sales → Pre-Con → Execution → Field → Finance → Closeout → Admin → Comms
 */

(function() {
  'use strict';

  // Navigation structure - groups with sub-items
  // Flow: Dashboard → Sales → Pre-Con → Execution → Field → Finance → Closeout → Admin → Comms
  // Organized to follow construction project lifecycle
  const navGroups = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      href: 'dashboard.html',
      items: [] // No sub-items, direct link
    },
    {
      id: 'sales',
      label: 'Sales',
      items: [
        { id: 'leads', label: 'Leads', href: 'leads.html' },
        { id: 'job-profile', label: 'Job Profile', href: 'job-profile.html' }
      ]
    },
    {
      id: 'precon',
      label: 'Pre-Con',
      items: [
        { id: 'bids', label: 'Bids', href: 'bids.html' },
        { id: 'estimates', label: 'Estimates', href: 'estimates.html' },
        { id: 'budget-builder', label: 'Budget Builder', href: 'budget-builder.html' }
      ]
    },
    {
      id: 'execution',
      label: 'Execution',
      items: [
        { id: 'selections', label: 'Selections', href: 'selections.html' },
        { id: 'schedule', label: 'Schedule', href: 'schedule.html' },
        { id: 'documents', label: 'Documents', href: 'documents.html' }
      ]
    },
    {
      id: 'field',
      label: 'Field',
      items: [
        { id: 'daily-logs', label: 'Daily Logs', href: 'daily-logs.html' },
        { id: 'inspections', label: 'Inspections', href: 'inspections.html' },
        { id: 'punch-lists', label: 'Punch Lists', href: 'punch-lists.html' },
        { id: 'photos', label: 'Photos', href: 'photos.html' },
        { id: 'rfis', label: 'RFIs', href: 'rfis.html' },
        { id: 'submittals', label: 'Submittals', href: 'submittals.html' }
      ]
    },
    {
      id: 'finance',
      label: 'Finance',
      items: [
        { id: 'budget', label: 'Budget', href: 'budgets.html' },
        { id: 'pos', label: 'Purchase Orders', href: 'pos.html' },
        { id: 'cos', label: 'Change Orders', href: 'change-orders.html' },
        { id: 'invoices', label: 'Invoices', href: 'index.html' },
        { id: 'draws', label: 'Draws', href: 'draws.html' },
        { id: 'lien', label: 'Lien Releases', href: 'lien-releases.html' },
        { id: 'price-intel', label: 'Price Intelligence', href: 'price-intelligence.html' }
      ]
    },
    {
      id: 'closeout',
      label: 'Closeout',
      items: [
        { id: 'warranties', label: 'Warranties', href: 'warranties.html' },
        { id: 'closeout', label: 'Project Closeout', href: 'closeout.html' }
      ]
    },
    {
      id: 'admin',
      label: 'Admin',
      items: [
        { id: 'vendors', label: 'Vendors', href: 'vendors.html' },
        { id: 'cost-codes', label: 'Cost Codes', href: 'cost-codes.html' },
        { id: 'recon', label: 'Reconciliation', href: 'reconciliation.html' }
      ]
    },
    {
      id: 'comms',
      label: 'Comms',
      items: [
        { id: 'messaging', label: 'Messaging', href: 'messaging.html' },
        { id: 'notifications', label: 'Notifications', href: 'notifications.html' },
        { id: 'tasks', label: 'Tasks', href: 'tasks.html' }
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
    return { groupId: 'dashboard', itemId: 'dashboard' }; // Default to Dashboard
  }

  // Create the navigation HTML
  function createNavHTML() {
    const current = getCurrentPage();

    // Main nav (groups)
    const mainNavHTML = navGroups.map(group => {
      const isActive = group.id === current.groupId;
      if (group.href) {
        // Direct link (like Dashboard)
        return `<a href="${group.href}" class="main-nav-link ${isActive ? 'active' : ''}">${group.label}</a>`;
      } else {
        // Group with sub-items - link to first item
        const firstItem = group.items[0];
        return `<a href="${firstItem?.href || '#'}" class="main-nav-link ${isActive ? 'active' : ''}">${group.label}</a>`;
      }
    }).join('');

    // Find current group for sub-nav
    const currentGroup = navGroups.find(g => g.id === current.groupId);

    // Sub nav (items within current group)
    let subNavHTML = '';
    if (currentGroup && currentGroup.items.length > 0) {
      subNavHTML = currentGroup.items.map(item => {
        const isActive = item.id === current.itemId;
        const badgeHTML = item.badge ? `<span class="nav-badge">${item.badge}</span>` : '';
        return `<a href="${item.href}" class="sub-nav-link ${isActive ? 'active' : ''}">${item.label}${badgeHTML}</a>`;
      }).join('');
    }

    return { mainNavHTML, subNavHTML, hasSubNav: subNavHTML.length > 0 };
  }

  // Initialize navigation
  function init() {
    const header = document.querySelector('.header');
    if (!header) return;

    const { mainNavHTML, subNavHTML, hasSubNav } = createNavHTML();

    // Check if header already has the structure we need
    let mainNav = header.querySelector('.main-nav');
    let subNav = header.querySelector('.sub-nav');

    // If main-nav exists, update it
    if (mainNav) {
      mainNav.innerHTML = mainNavHTML;
    }

    // If sub-nav exists, update it
    if (subNav) {
      if (hasSubNav) {
        subNav.innerHTML = subNavHTML;
        subNav.parentElement.style.display = '';
      } else {
        subNav.parentElement.style.display = 'none';
      }
    }

    // Add mobile hamburger if not exists
    if (!document.querySelector('.mobile-menu-btn')) {
      const headerTop = document.querySelector('.header-top');
      const brand = headerTop?.querySelector('.header-brand');
      if (brand && headerTop) {
        const hamburger = document.createElement('button');
        hamburger.className = 'mobile-menu-btn';
        hamburger.innerHTML = '☰';
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
      const headerSub = document.querySelector('.header-sub');
      const isOpen = mainNav?.classList.contains('mobile-open');

      if (mainNav) {
        mainNav.classList.toggle('mobile-open', !isOpen);
      }
      if (headerSub) {
        headerSub.classList.toggle('mobile-open', !isOpen);
      }
      document.body.classList.toggle('mobile-menu-open', !isOpen);
    },
    closeMobile: () => {
      document.querySelector('.main-nav')?.classList.remove('mobile-open');
      document.querySelector('.header-sub')?.classList.remove('mobile-open');
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

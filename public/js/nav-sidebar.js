/**
 * Group Navigation Component
 * Creates a two-level navigation: groups (top) and sub-items (below)
 * Works alongside the job sidebar
 */

(function() {
  'use strict';

  // Navigation structure - groups with sub-items
  // Flow: Dashboard → Job Profile → Preconstruction → Commitments → Operations → Billing → Admin
  const navGroups = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      href: 'dashboard.html',
      items: [] // No sub-items, direct link
    },
    {
      id: 'job-profile',
      label: 'Job Profile',
      href: 'job-profile.html',
      items: [] // No sub-items, direct link
    },
    {
      id: 'preconstruction',
      label: 'Preconstruction',
      items: [
        { id: 'bids', label: 'Bids', href: 'bids.html', badge: 'Soon' },
        { id: 'estimates', label: 'Estimates', href: 'estimates.html', badge: 'Soon' }
      ]
    },
    {
      id: 'commitments',
      label: 'Commitments',
      items: [
        { id: 'pos', label: 'Purchase Orders', href: 'pos.html' },
        { id: 'cos', label: 'Change Orders', href: 'change-orders.html' },
        { id: 'budget', label: 'Budget', href: 'budgets.html' }
      ]
    },
    {
      id: 'operations',
      label: 'Operations',
      items: [
        { id: 'schedule', label: 'Schedule', href: 'schedule.html' },
        { id: 'daily-logs', label: 'Daily Logs', href: 'daily-logs.html' },
        { id: 'documents', label: 'Documents', href: 'documents.html' },
        { id: 'punch-lists', label: 'Punch Lists', href: 'punch-lists.html' },
        { id: 'photos', label: 'Photos', href: 'photos.html' },
        { id: 'inspections', label: 'Inspections', href: 'inspections.html' }
      ]
    },
    {
      id: 'billing',
      label: 'Billing',
      items: [
        { id: 'invoices', label: 'Invoices', href: 'index.html' },
        { id: 'draws', label: 'Draws', href: 'draws.html' },
        { id: 'lien', label: 'Lien Releases', href: 'lien-releases.html' }
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
    return { groupId: 'financial', itemId: 'invoices' }; // Default
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
  }

  // Export API
  window.NavSidebar = {
    init,
    toggle: () => {},
    toggleMobile: () => {},
    closeMobile: () => {},
    isCollapsed: () => false
  };

  // Auto-init when DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

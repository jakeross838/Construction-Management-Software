/**
 * Dropdown Navigation Component
 * Compact header with dropdown menus organized by construction workflow
 * Dual-context navigation: Job View vs Company View
 */

(function() {
  "use strict";

  // Company-context pages (no job sidebar)
  const COMPANY_CONTEXT_PAGES = [
    'dashboard.html',
    'business-dashboard.html',
    'catalog.html',
    'vendors.html',
    'cost-codes.html',
    'employees.html',
    'crew-schedule.html',
    'timesheets.html',
    'companies.html',
    'contacts.html',
    'price-intelligence.html',
    'expenses.html',
    'financial-periods.html',
    'overhead.html',
    'profitability.html',
    'wip.html',
    'pnl.html',
    'cash-flow.html',
    'business-planning.html'
  ];

  // Navigation structure organized by context (Job View vs Company View)
  const navContexts = {
    job: {
      label: 'Job View',
      groups: [
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
            { id: 'job-hub', label: 'Job Hub', href: 'job-hub.html' },
            { id: 'schedule', label: 'Schedule', href: 'schedule.html' },
            { id: 'daily-logs', label: 'Daily Logs', href: 'daily-logs.html' },
            { id: 'photos', label: 'Photos', href: 'photos.html' },
            { id: 'documents', label: 'Documents', href: 'documents.html' },
            { id: 'rfis', label: 'RFIs', href: 'rfis.html' },
            { id: 'submittals', label: 'Submittals', href: 'submittals.html' },
            { id: 'inspections', label: 'Inspections', href: 'inspections.html' },
            { id: 'permits', label: 'Permits', href: 'permits.html' },
            { id: 'punch-lists', label: 'Punch Lists', href: 'punch-lists.html' },
            { id: 'correspondence', label: 'Correspondence', href: 'correspondence.html' },
            { id: 'meetings', label: 'Meetings', href: 'meetings.html' },
            { id: 'compliance', label: 'Compliance', href: 'compliance.html' }
          ]
        },
        {
          id: 'job-finance',
          label: 'Job Finance',
          items: [
            { id: 'invoices', label: 'Invoices', href: 'index.html' },
            { id: 'pos', label: 'Purchase Orders', href: 'pos.html' },
            { id: 'cos', label: 'Change Orders', href: 'change-orders.html' },
            { id: 'draws', label: 'Draws', href: 'draws.html' },
            { id: 'budget', label: 'Budgets', href: 'budgets.html' },
            { id: 'lien', label: 'Lien Releases', href: 'lien-releases.html' }
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
        }
      ]
    },
    company: {
      label: 'Company',
      groups: [
        {
          id: 'overview',
          label: 'Overview',
          items: [
            { id: 'dashboard', label: 'Dashboard', href: 'dashboard.html' },
            { id: 'business', label: 'Business Dashboard', href: 'business-dashboard.html' }
          ]
        },
        {
          id: 'company-finance',
          label: 'Finance',
          items: [
            { id: 'expenses', label: 'Expenses', href: 'expenses.html' },
            { id: 'periods', label: 'Financial Periods', href: 'financial-periods.html' },
            { id: 'overhead', label: 'Overhead Allocation', href: 'overhead.html' },
            { id: 'profitability', label: 'Job Profitability', href: 'profitability.html' },
            { id: 'wip', label: 'WIP Schedule', href: 'wip.html' },
            { id: 'pnl', label: 'Company P&L', href: 'pnl.html' },
            { id: 'cash-flow', label: 'Cash Flow', href: 'cash-flow.html' },
            { id: 'planning', label: 'Business Planning', href: 'business-planning.html' }
          ]
        },
        {
          id: 'resources',
          label: 'Resources',
          items: [
            { id: 'catalog', label: 'Product Catalog', href: 'catalog.html' },
            { id: 'vendors', label: 'Vendors', href: 'vendors.html' },
            { id: 'cost-codes', label: 'Cost Codes', href: 'cost-codes.html' },
            { id: 'price-intel', label: 'Price Intelligence', href: 'price-intelligence.html' }
          ]
        },
        {
          id: 'team',
          label: 'Team',
          items: [
            { id: 'companies', label: 'Companies', href: 'companies.html' },
            { id: 'contacts', label: 'Contacts', href: 'contacts.html' },
            { id: 'employees', label: 'Employees', href: 'employees.html' },
            { id: 'crew-schedule', label: 'Crew Scheduling', href: 'crew-schedule.html' },
            { id: 'timesheets', label: 'Timesheets', href: 'timesheets.html' }
          ]
        }
      ]
    }
  };

  const navGroups = [
    ...navContexts.job.groups,
    ...navContexts.company.groups
  ];

  function detectPageContext() {
    const bodyContext = document.body.dataset.pageContext;
    if (bodyContext === 'job' || bodyContext === 'company') {
      return bodyContext;
    }
    const path = window.location.pathname;
    const filename = path.split('/').pop() || 'index.html';
    return COMPANY_CONTEXT_PAGES.includes(filename) ? 'company' : 'job';
  }

  function getCurrentPage() {
    const path = window.location.pathname;
    const filename = path.split('/').pop() || 'index.html';
    for (const group of navGroups) {
      if (group.href === filename) {
        return { groupId: group.id, itemId: group.id };
      }
      for (const item of group.items) {
        if (item.href === filename) {
          return { groupId: group.id, itemId: item.id };
        }
      }
    }
    return { groupId: 'dashboard', itemId: 'dashboard' };
  }

  function createNavHTML() {
    const current = getCurrentPage();
    const navHTML = navGroups.map(group => {
      const isActive = group.id === current.groupId;
      if (group.href) {
        return '<a href="' + group.href + '" class="nav-dropdown-item ' + (isActive ? 'active' : '') + '">' + group.label + '</a>';
      } else {
        const dropdownItems = group.items.map(item => {
          const itemActive = item.id === current.itemId;
          return '<a href="' + item.href + '" class="dropdown-menu-item ' + (itemActive ? 'active' : '') + '">' + item.label + '</a>';
        }).join('');
        return '<div class="nav-dropdown ' + (isActive ? 'active' : '') + '">' +
          '<button class="nav-dropdown-trigger" aria-expanded="false" aria-haspopup="true">' +
          group.label +
          '<svg class="dropdown-chevron" width="12" height="12" viewBox="0 0 12 12" fill="none">' +
          '<path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>' +
          '</svg>' +
          '</button>' +
          '<div class="dropdown-menu">' +
          dropdownItems +
          '</div>' +
          '</div>';
      }
    }).join('');
    return navHTML;
  }

  function setupDropdownInteractions() {
    const dropdowns = document.querySelectorAll('.nav-dropdown');
    let activeDropdown = null;
    let hoverTimeout = null;

    dropdowns.forEach(dropdown => {
      const trigger = dropdown.querySelector('.nav-dropdown-trigger');
      const menu = dropdown.querySelector('.dropdown-menu');

      dropdown.addEventListener('mouseenter', () => {
        clearTimeout(hoverTimeout);
        if (activeDropdown && activeDropdown !== dropdown) {
          closeDropdown(activeDropdown);
        }
        openDropdown(dropdown);
        activeDropdown = dropdown;
      });

      dropdown.addEventListener('mouseleave', () => {
        hoverTimeout = setTimeout(() => {
          closeDropdown(dropdown);
          if (activeDropdown === dropdown) {
            activeDropdown = null;
          }
        }, 150);
      });

      trigger.addEventListener('click', (e) => {
        e.preventDefault();
        const isOpen = dropdown.classList.contains('open');
        dropdowns.forEach(d => closeDropdown(d));
        if (!isOpen) {
          openDropdown(dropdown);
          activeDropdown = dropdown;
        } else {
          activeDropdown = null;
        }
      });

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

  // Create context indicator element
  function createContextIndicator() {
    const context = detectPageContext();
    const isJobContext = context === 'job';

    const indicator = document.createElement('div');
    indicator.className = 'context-indicator';
    indicator.id = 'contextIndicator';

    // Icon for job context (building) vs company context (office)
    const jobIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4M9 9v.01M9 12v.01M9 15v.01M9 18v.01"/></svg>';
    const companyIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18M9 21V10H3v11M21 21V10h-6v11M12 21V3l-3 3M12 3l3 3M9 7h6"/></svg>';

    // Switch icon (arrows)
    const switchIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 16V4M7 4L3 8M7 4l4 4M17 8v12M17 20l4-4M17 20l-4-4"/></svg>';

    indicator.innerHTML = 
      '<span class="context-badge ' + (isJobContext ? 'job-context' : 'company-context') + '">' +
        (isJobContext ? jobIcon : companyIcon) +
        (isJobContext ? 'Job View' : 'Company View') +
      '</span>' +
      '<button class="context-switch" onclick="NavSidebar.switchContext()" title="Switch to ' + (isJobContext ? 'Company' : 'Job') + ' View">' +
        switchIcon +
        (isJobContext ? 'Company' : 'Jobs') +
      '</button>';

    return indicator;
  }

  // Switch between job and company context
  function switchContext() {
    const currentContext = detectPageContext();

    if (currentContext === 'job') {
      // Go to company dashboard
      window.location.href = 'dashboard.html';
    } else {
      // Go to job hub (main job view)
      window.location.href = 'job-hub.html';
    }
  }

  function init() {
    const header = document.querySelector('.header');
    if (!header) return;

    const headerSub = header.querySelector('.header-sub');
    if (headerSub) {
      headerSub.style.display = 'none';
    }

    let mainNav = header.querySelector('.main-nav');
    if (mainNav) {
      mainNav.innerHTML = createNavHTML();
      mainNav.classList.add('nav-dropdown-container');
    }

    setupDropdownInteractions();

    // Add context indicator to header
    const headerTop = document.querySelector('.header-top');
    const headerActions = headerTop?.querySelector('.header-actions');
    if (headerTop && headerActions) {
      const existingIndicator = document.getElementById('contextIndicator');
      if (!existingIndicator) {
        const indicator = createContextIndicator();
        headerTop.insertBefore(indicator, headerActions);
      }
    }

    if (!document.querySelector('.mobile-menu-btn')) {
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
    isCollapsed: () => false,
    detectPageContext,
    navContexts,
    switchContext
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
// ============================================================
// SIDEBAR MODULE - Shared Job Selection Across Pages
// ============================================================

(function() {
  'use strict';

  const STORAGE_KEYS = {
    SELECTED_JOB: 'cms_selected_job_id',
    SIDEBAR_COLLAPSED: 'cms_sidebar_collapsed'
  };

  // Sidebar State
  const SidebarState = {
    jobs: [],
    selectedJobId: '',
    isCollapsed: false,
    isInitialized: false,
    listeners: []
  };

  // ============================================================
  // INITIALIZATION
  // ============================================================

  function init() {
    if (SidebarState.isInitialized) return;

    // Load persisted state
    loadPersistedState();

    // Inject sidebar HTML
    injectSidebar();

    // Load jobs
    loadJobs();

    // Setup event listeners
    setupEventListeners();

    // Apply initial collapsed state
    applyCollapsedState();

    SidebarState.isInitialized = true;
  }

  // ============================================================
  // PERSISTENCE
  // ============================================================

  function loadPersistedState() {
    try {
      const savedJobId = localStorage.getItem(STORAGE_KEYS.SELECTED_JOB);
      const savedCollapsed = localStorage.getItem(STORAGE_KEYS.SIDEBAR_COLLAPSED);

      SidebarState.selectedJobId = savedJobId || '';
      SidebarState.isCollapsed = savedCollapsed === 'true';
    } catch (e) {
      console.warn('Sidebar: Failed to load state from localStorage:', e);
    }
  }

  function savePersistedState() {
    try {
      localStorage.setItem(STORAGE_KEYS.SELECTED_JOB, SidebarState.selectedJobId);
      localStorage.setItem(STORAGE_KEYS.SIDEBAR_COLLAPSED, String(SidebarState.isCollapsed));
    } catch (e) {
      console.warn('Sidebar: Failed to save state to localStorage:', e);
    }
  }

  // ============================================================
  // SIDEBAR INJECTION
  // ============================================================

  function injectSidebar() {
    const app = document.querySelector('.app');
    if (!app) return;

    // Add sidebar class
    app.classList.add('app-with-sidebar');

    // Get existing elements
    const header = app.querySelector('.header');
    const main = app.querySelector('.main');

    if (!header || !main) return;

    // Create app-body wrapper
    const appBody = document.createElement('div');
    appBody.className = 'app-body';

    // Create sidebar
    const sidebar = createSidebarElement();

    // Restructure DOM
    appBody.appendChild(sidebar);
    appBody.appendChild(main);

    // Insert after header
    header.after(appBody);

    // Add mobile toggle to header
    addMobileToggle(header);
  }

  function createSidebarElement() {
    const sidebar = document.createElement('aside');
    sidebar.className = 'job-sidebar';
    sidebar.id = 'jobSidebar';
    sidebar.innerHTML = `
      <div class="sidebar-header">
        <h3 class="sidebar-title">Jobs</h3>
        <button class="sidebar-toggle" id="sidebarToggle" title="Toggle sidebar (Ctrl+B)">
          <svg class="sidebar-toggle-icon" viewBox="0 0 24 24" width="20" height="20">
            <path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
      <div class="sidebar-content">
        <div class="sidebar-search">
          <input type="text" id="jobSearchInput" placeholder="Search jobs..." class="sidebar-search-input">
        </div>
        <div class="job-list" id="jobList">
          <div class="job-item all-jobs" data-job-id="">
            <span class="job-item-icon">
              <svg viewBox="0 0 24 24" width="16" height="16">
                <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" fill="currentColor"/>
              </svg>
            </span>
            <span class="job-item-name">All Jobs</span>
            <span class="job-item-count" id="allJobsCount">-</span>
          </div>
          <div class="job-list-items" id="jobListItems">
            <div class="sidebar-loading">Loading jobs...</div>
          </div>
        </div>
      </div>
      <div class="sidebar-collapsed-indicator">
        <span class="collapsed-job-icon">
          <svg viewBox="0 0 24 24" width="20" height="20">
            <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14l-5-5 1.41-1.41L12 14.17l7.59-7.59L21 8l-9 9z" fill="currentColor"/>
          </svg>
        </span>
        <span class="collapsed-job-name" id="collapsedJobName">All</span>
      </div>
    `;
    return sidebar;
  }

  function addMobileToggle(header) {
    const headerLeft = header.querySelector('.header-left');
    if (!headerLeft) return;

    const toggle = document.createElement('button');
    toggle.className = 'mobile-sidebar-toggle';
    toggle.id = 'mobileSidebarToggle';
    toggle.title = 'Toggle job sidebar';
    toggle.innerHTML = `
      <svg viewBox="0 0 24 24" width="20" height="20">
        <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" fill="currentColor"/>
      </svg>
    `;
    headerLeft.prepend(toggle);

    // Add overlay for mobile
    const overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay';
    overlay.id = 'sidebarOverlay';
    document.body.appendChild(overlay);
  }

  // ============================================================
  // JOBS DATA
  // ============================================================

  async function loadJobs() {
    try {
      const res = await fetch('/api/jobs');
      if (!res.ok) throw new Error('Failed to fetch jobs');
      SidebarState.jobs = await res.json();
      renderJobList();
      // Notify listeners after jobs load
      notifyListeners();
    } catch (err) {
      console.error('Sidebar: Failed to load jobs:', err);
      const container = document.getElementById('jobListItems');
      if (container) {
        container.innerHTML = '<div class="sidebar-error">Failed to load jobs</div>';
      }
    }
  }

  function renderJobList() {
    const container = document.getElementById('jobListItems');
    if (!container) return;

    if (SidebarState.jobs.length === 0) {
      container.innerHTML = '<div class="sidebar-empty">No jobs found</div>';
      return;
    }

    // Update all jobs count
    const allJobsCount = document.getElementById('allJobsCount');
    if (allJobsCount) {
      allJobsCount.textContent = SidebarState.jobs.length;
    }

    // Sort jobs: active first, then by name
    const sortedJobs = [...SidebarState.jobs].sort((a, b) => {
      if (a.status === 'active' && b.status !== 'active') return -1;
      if (b.status === 'active' && a.status !== 'active') return 1;
      return a.name.localeCompare(b.name);
    });

    container.innerHTML = sortedJobs.map(job => `
      <div class="job-item ${job.id === SidebarState.selectedJobId ? 'active' : ''}"
           data-job-id="${job.id}" title="${job.name}">
        <span class="job-item-status ${job.status || 'active'}"></span>
        <span class="job-item-name">${escapeHtml(job.name)}</span>
      </div>
    `).join('');

    // Update "All Jobs" active state
    updateAllJobsState();
    updateCollapsedIndicator();
  }

  function updateAllJobsState() {
    const allJobsItem = document.querySelector('.job-item.all-jobs');
    if (allJobsItem) {
      allJobsItem.classList.toggle('active', SidebarState.selectedJobId === '');
    }
  }

  // ============================================================
  // JOB SELECTION
  // ============================================================

  function selectJob(jobId) {
    const previousJobId = SidebarState.selectedJobId;
    SidebarState.selectedJobId = jobId;

    // Update UI
    document.querySelectorAll('.job-item').forEach(item => {
      item.classList.toggle('active', item.dataset.jobId === jobId);
    });

    // Update collapsed indicator
    updateCollapsedIndicator();

    // Persist
    savePersistedState();

    // Notify page-specific listeners
    if (previousJobId !== jobId) {
      notifyListeners();
    }
  }

  function updateCollapsedIndicator() {
    const indicator = document.getElementById('collapsedJobName');
    if (!indicator) return;

    if (SidebarState.selectedJobId === '') {
      indicator.textContent = 'All';
    } else {
      const job = SidebarState.jobs.find(j => j.id === SidebarState.selectedJobId);
      indicator.textContent = job ? job.name.substring(0, 15) + (job.name.length > 15 ? '...' : '') : 'Selected';
    }
  }

  // ============================================================
  // COLLAPSE/EXPAND
  // ============================================================

  function toggleSidebar() {
    SidebarState.isCollapsed = !SidebarState.isCollapsed;
    applyCollapsedState();
    savePersistedState();
  }

  function applyCollapsedState() {
    const app = document.querySelector('.app-with-sidebar');
    if (app) {
      app.classList.toggle('sidebar-collapsed', SidebarState.isCollapsed);
    }
    updateCollapsedIndicator();
  }

  function toggleMobileSidebar(forceState) {
    const sidebar = document.getElementById('jobSidebar');
    const overlay = document.getElementById('sidebarOverlay');

    const shouldOpen = typeof forceState === 'boolean'
      ? forceState
      : !sidebar?.classList.contains('mobile-open');

    sidebar?.classList.toggle('mobile-open', shouldOpen);
    overlay?.classList.toggle('show', shouldOpen);
    document.body.classList.toggle('sidebar-open', shouldOpen);
  }

  // ============================================================
  // SEARCH FILTER
  // ============================================================

  function handleSearch(searchTerm) {
    const items = document.querySelectorAll('.job-list-items .job-item');
    const term = searchTerm.toLowerCase().trim();

    items.forEach(item => {
      const name = item.querySelector('.job-item-name')?.textContent?.toLowerCase() || '';
      item.style.display = term === '' || name.includes(term) ? '' : 'none';
    });
  }

  // ============================================================
  // EVENT LISTENERS
  // ============================================================

  function setupEventListeners() {
    // Toggle button
    document.getElementById('sidebarToggle')?.addEventListener('click', toggleSidebar);

    // Mobile toggle
    document.getElementById('mobileSidebarToggle')?.addEventListener('click', () => toggleMobileSidebar());

    // Overlay click to close
    document.getElementById('sidebarOverlay')?.addEventListener('click', () => toggleMobileSidebar(false));

    // Job selection
    document.getElementById('jobList')?.addEventListener('click', (e) => {
      const jobItem = e.target.closest('.job-item');
      if (jobItem) {
        selectJob(jobItem.dataset.jobId);

        // Close mobile sidebar
        if (window.innerWidth <= 768) {
          toggleMobileSidebar(false);
        }
      }
    });

    // Search
    document.getElementById('jobSearchInput')?.addEventListener('input', (e) => {
      handleSearch(e.target.value);
    });

    // Keyboard shortcut (Ctrl/Cmd + B to toggle)
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        if (window.innerWidth <= 768) {
          toggleMobileSidebar();
        } else {
          toggleSidebar();
        }
      }
    });
  }

  // ============================================================
  // LISTENER PATTERN (for page integration)
  // ============================================================

  function onJobChange(callback) {
    SidebarState.listeners.push(callback);

    // Call immediately with current state if jobs are loaded
    if (SidebarState.jobs.length > 0 || SidebarState.selectedJobId === '') {
      callback(SidebarState.selectedJobId, getSelectedJob());
    }

    // Return unsubscribe function
    return () => {
      const idx = SidebarState.listeners.indexOf(callback);
      if (idx > -1) SidebarState.listeners.splice(idx, 1);
    };
  }

  function notifyListeners() {
    const selectedJob = getSelectedJob();
    SidebarState.listeners.forEach(cb => {
      try {
        cb(SidebarState.selectedJobId, selectedJob);
      } catch (e) {
        console.error('Sidebar listener error:', e);
      }
    });
  }

  function getSelectedJob() {
    if (!SidebarState.selectedJobId) return null;
    return SidebarState.jobs.find(j => j.id === SidebarState.selectedJobId) || null;
  }

  function getSelectedJobId() {
    return SidebarState.selectedJobId;
  }

  function getJobs() {
    return [...SidebarState.jobs];
  }

  // ============================================================
  // UTILITY
  // ============================================================

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ============================================================
  // PUBLIC API
  // ============================================================

  window.JobSidebar = {
    init,
    onJobChange,
    getSelectedJobId,
    getSelectedJob,
    getJobs,
    selectJob,
    toggleSidebar
  };

  // Auto-initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

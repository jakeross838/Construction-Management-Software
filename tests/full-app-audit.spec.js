// @ts-check
const { test, expect } = require('@playwright/test');

const BASE_URL = 'http://localhost:3001';

// Track all issues found
const issues = [];

function logIssue(page, severity, description) {
  issues.push({ page, severity, description });
  console.log(`[${severity}] ${page}: ${description}`);
}

test.describe('Full Application Audit', () => {

  test.afterAll(async () => {
    console.log('\n========== AUDIT SUMMARY ==========');
    console.log(`Total issues found: ${issues.length}`);
    issues.forEach((issue, i) => {
      console.log(`${i + 1}. [${issue.severity}] ${issue.page}: ${issue.description}`);
    });
    console.log('====================================\n');
  });

  test('1. Dashboard (index.html) - Load and Console Errors', async ({ page }) => {
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', err => errors.push(err.message));

    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Check page loaded
    await expect(page.locator('body')).toBeVisible();

    // Check for console errors
    if (errors.length > 0) {
      errors.forEach(err => logIssue('Dashboard', 'ERROR', err));
    }

    // Screenshot
    await page.screenshot({ path: 'tests/screenshots/audit-1-dashboard.png', fullPage: true });
  });

  test('2. Dashboard - Job Selector Works', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Try clicking job selector
    const jobSelect = page.locator('#jobSelect, .job-selector, select').first();
    if (await jobSelect.isVisible()) {
      await jobSelect.click();
      await page.waitForTimeout(500);
    } else {
      logIssue('Dashboard', 'WARN', 'No job selector found');
    }
  });

  test('3. Purchase Orders Page - Load', async ({ page }) => {
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', err => errors.push(err.message));

    await page.goto(`${BASE_URL}/pos.html`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (errors.length > 0) {
      errors.forEach(err => logIssue('POs', 'ERROR', err));
    }

    await page.screenshot({ path: 'tests/screenshots/audit-2-pos.png', fullPage: true });
  });

  test('4. Purchase Orders - Create PO Modal', async ({ page }) => {
    await page.goto(`${BASE_URL}/pos.html`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Select a job first
    const jobSelect = page.locator('#jobSelect');
    if (await jobSelect.isVisible()) {
      await jobSelect.selectOption({ index: 1 }).catch(() => {});
      await page.waitForTimeout(1000);
    }

    // Try to open create PO modal
    const createBtn = page.locator('button:has-text("Create"), button:has-text("New PO"), .create-btn').first();
    if (await createBtn.isVisible()) {
      await createBtn.click();
      await page.waitForTimeout(500);

      // Check modal is visible
      const modal = page.locator('.modal[style*="flex"], .modal.show').first();
      const isVisible = await modal.isVisible().catch(() => false);
      if (!isVisible) {
        logIssue('POs', 'CRITICAL', 'Create PO modal did not open');
      }
      await page.screenshot({ path: 'tests/screenshots/audit-3-po-modal.png', fullPage: true });
    }
  });

  test('5. Daily Logs Page - Load', async ({ page }) => {
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', err => errors.push(err.message));

    await page.goto(`${BASE_URL}/daily-logs.html`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (errors.length > 0) {
      errors.forEach(err => logIssue('Daily Logs', 'ERROR', err));
    }

    await page.screenshot({ path: 'tests/screenshots/audit-4-daily-logs.png', fullPage: true });
  });

  test('6. Daily Logs - Create Log Modal', async ({ page }) => {
    await page.goto(`${BASE_URL}/daily-logs.html`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Select a job first
    const jobSelect = page.locator('#jobSelect');
    if (await jobSelect.isVisible()) {
      await jobSelect.selectOption({ index: 1 }).catch(() => {});
      await page.waitForTimeout(1000);
    }

    // Try to open create modal
    const createBtn = page.locator('button:has-text("New"), button:has-text("Create"), button:has-text("Add")').first();
    if (await createBtn.isVisible()) {
      await createBtn.click();
      await page.waitForTimeout(500);

      const modal = page.locator('.modal[style*="flex"], .modal.show').first();
      const isVisible = await modal.isVisible().catch(() => false);
      if (!isVisible) {
        logIssue('Daily Logs', 'CRITICAL', 'Create modal did not open');
      }
    }
  });

  test('7. Inspections Page - Load', async ({ page }) => {
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', err => errors.push(err.message));

    await page.goto(`${BASE_URL}/inspections.html`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (errors.length > 0) {
      errors.forEach(err => logIssue('Inspections', 'ERROR', err));
    }

    await page.screenshot({ path: 'tests/screenshots/audit-5-inspections.png', fullPage: true });
  });

  test('8. Inspections - Create Inspection Modal', async ({ page }) => {
    await page.goto(`${BASE_URL}/inspections.html`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Select a job first
    const jobSelect = page.locator('#jobSelect');
    if (await jobSelect.isVisible()) {
      await jobSelect.selectOption({ index: 1 }).catch(() => {});
      await page.waitForTimeout(1000);
    }

    // Try to open create modal
    const createBtn = page.locator('button:has-text("Schedule"), button:has-text("New"), button:has-text("Add")').first();
    if (await createBtn.isVisible()) {
      await createBtn.click();
      await page.waitForTimeout(500);

      const modal = page.locator('.modal[style*="flex"], .modal.show').first();
      const isVisible = await modal.isVisible().catch(() => false);
      if (!isVisible) {
        logIssue('Inspections', 'CRITICAL', 'Create modal did not open');
      }
      await page.screenshot({ path: 'tests/screenshots/audit-6-inspection-modal.png', fullPage: true });
    }
  });

  test('9. Schedule Page - Load', async ({ page }) => {
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', err => errors.push(err.message));

    await page.goto(`${BASE_URL}/schedule.html`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (errors.length > 0) {
      errors.forEach(err => logIssue('Schedule', 'ERROR', err));
    }

    await page.screenshot({ path: 'tests/screenshots/audit-7-schedule.png', fullPage: true });
  });

  test('10. Documents Page - Load', async ({ page }) => {
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', err => errors.push(err.message));

    await page.goto(`${BASE_URL}/documents.html`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (errors.length > 0) {
      errors.forEach(err => logIssue('Documents', 'ERROR', err));
    }

    await page.screenshot({ path: 'tests/screenshots/audit-8-documents.png', fullPage: true });
  });

  test('11. Change Orders Page - Load', async ({ page }) => {
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', err => errors.push(err.message));

    await page.goto(`${BASE_URL}/change-orders.html`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (errors.length > 0) {
      errors.forEach(err => logIssue('Change Orders', 'ERROR', err));
    }

    await page.screenshot({ path: 'tests/screenshots/audit-9-change-orders.png', fullPage: true });
  });

  test('12. Change Orders - Create CO Modal', async ({ page }) => {
    await page.goto(`${BASE_URL}/change-orders.html`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Select a job first
    const jobSelect = page.locator('#jobSelect');
    if (await jobSelect.isVisible()) {
      await jobSelect.selectOption({ index: 1 }).catch(() => {});
      await page.waitForTimeout(1000);
    }

    // Try to open create modal
    const createBtn = page.locator('button:has-text("Create"), button:has-text("New"), button:has-text("Add")').first();
    if (await createBtn.isVisible()) {
      await createBtn.click();
      await page.waitForTimeout(500);

      const modal = page.locator('.modal[style*="flex"], .modal.show').first();
      const isVisible = await modal.isVisible().catch(() => false);
      if (!isVisible) {
        logIssue('Change Orders', 'CRITICAL', 'Create modal did not open');
      }
      await page.screenshot({ path: 'tests/screenshots/audit-10-co-modal.png', fullPage: true });
    }
  });

  test('13. Draws Page - Load', async ({ page }) => {
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', err => errors.push(err.message));

    await page.goto(`${BASE_URL}/draws.html`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (errors.length > 0) {
      errors.forEach(err => logIssue('Draws', 'ERROR', err));
    }

    await page.screenshot({ path: 'tests/screenshots/audit-11-draws.png', fullPage: true });
  });

  test('14. Budgets Page - Load', async ({ page }) => {
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', err => errors.push(err.message));

    await page.goto(`${BASE_URL}/budgets.html`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (errors.length > 0) {
      errors.forEach(err => logIssue('Budgets', 'ERROR', err));
    }

    await page.screenshot({ path: 'tests/screenshots/audit-12-budgets.png', fullPage: true });
  });

  test('15. Vendors Page - Load', async ({ page }) => {
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', err => errors.push(err.message));

    await page.goto(`${BASE_URL}/vendors.html`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (errors.length > 0) {
      errors.forEach(err => logIssue('Vendors', 'ERROR', err));
    }

    await page.screenshot({ path: 'tests/screenshots/audit-13-vendors.png', fullPage: true });
  });

  test('16. Vendors - Create Vendor Modal', async ({ page }) => {
    await page.goto(`${BASE_URL}/vendors.html`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Try to open create modal
    const createBtn = page.locator('button:has-text("Add"), button:has-text("Create"), button:has-text("New")').first();
    if (await createBtn.isVisible()) {
      await createBtn.click();
      await page.waitForTimeout(500);

      const modal = page.locator('.modal[style*="flex"], .modal.show').first();
      const isVisible = await modal.isVisible().catch(() => false);
      if (!isVisible) {
        logIssue('Vendors', 'CRITICAL', 'Create vendor modal did not open');
      }
      await page.screenshot({ path: 'tests/screenshots/audit-14-vendor-modal.png', fullPage: true });
    }
  });

  test('17. Lien Releases Page - Load', async ({ page }) => {
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', err => errors.push(err.message));

    await page.goto(`${BASE_URL}/lien-releases.html`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (errors.length > 0) {
      errors.forEach(err => logIssue('Lien Releases', 'ERROR', err));
    }

    await page.screenshot({ path: 'tests/screenshots/audit-15-lien-releases.png', fullPage: true });
  });

  test('18. Reconciliation Page - Load', async ({ page }) => {
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', err => errors.push(err.message));

    await page.goto(`${BASE_URL}/reconciliation.html`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (errors.length > 0) {
      errors.forEach(err => logIssue('Reconciliation', 'ERROR', err));
    }

    await page.screenshot({ path: 'tests/screenshots/audit-16-reconciliation.png', fullPage: true });
  });

  test('19. Cost Codes Page - Load', async ({ page }) => {
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', err => errors.push(err.message));

    await page.goto(`${BASE_URL}/cost-codes.html`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (errors.length > 0) {
      errors.forEach(err => logIssue('Cost Codes', 'ERROR', err));
    }

    await page.screenshot({ path: 'tests/screenshots/audit-17-cost-codes.png', fullPage: true });
  });

  test('20. Job Profile Page - Load', async ({ page }) => {
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', err => errors.push(err.message));

    await page.goto(`${BASE_URL}/job-profile.html`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (errors.length > 0) {
      errors.forEach(err => logIssue('Job Profile', 'ERROR', err));
    }

    await page.screenshot({ path: 'tests/screenshots/audit-18-job-profile.png', fullPage: true });
  });

  test('21. API Health Check - Core Endpoints', async ({ request }) => {
    const endpoints = [
      { url: '/api/jobs', name: 'Jobs' },
      { url: '/api/vendors', name: 'Vendors' },
      { url: '/api/cost-codes', name: 'Cost Codes' },
      { url: '/api/invoices', name: 'Invoices' },
      { url: '/api/inspections/types', name: 'Inspection Types' },
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await request.get(`${BASE_URL}${endpoint.url}`);
        if (!response.ok()) {
          logIssue('API', 'ERROR', `${endpoint.name} (${endpoint.url}) returned ${response.status()}`);
        }
      } catch (err) {
        logIssue('API', 'ERROR', `${endpoint.name} (${endpoint.url}) failed: ${err.message}`);
      }
    }
  });

  test('22. Navigation - All Sidebar Links Work', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    // Get all sidebar links
    const links = page.locator('nav a, .sidebar a, .nav-link');
    const count = await links.count();

    for (let i = 0; i < count; i++) {
      const link = links.nth(i);
      const href = await link.getAttribute('href');
      if (href && href.endsWith('.html')) {
        try {
          const response = await page.goto(`${BASE_URL}/${href}`);
          if (!response || response.status() >= 400) {
            logIssue('Navigation', 'ERROR', `Link ${href} returned error`);
          }
        } catch (err) {
          logIssue('Navigation', 'ERROR', `Link ${href} failed: ${err.message}`);
        }
      }
    }
  });

  test('23. Empty State Handling - No Job Selected', async ({ page }) => {
    const pages = [
      { url: '/pos.html', name: 'POs' },
      { url: '/daily-logs.html', name: 'Daily Logs' },
      { url: '/inspections.html', name: 'Inspections' },
      { url: '/schedule.html', name: 'Schedule' },
      { url: '/documents.html', name: 'Documents' },
      { url: '/change-orders.html', name: 'Change Orders' },
    ];

    for (const p of pages) {
      await page.goto(`${BASE_URL}${p.url}`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);

      // Check for empty state or "select job" message
      const noJobMsg = page.locator('#noJobSelected, .no-job-selected, .empty-state');
      const jobSelect = page.locator('#jobSelect');

      // If no job is selected, should show message
      const jobValue = await jobSelect.inputValue().catch(() => '');
      if (!jobValue) {
        const hasEmptyState = await noJobMsg.isVisible().catch(() => false);
        if (!hasEmptyState) {
          logIssue(p.name, 'WARN', 'No empty state shown when no job selected');
        }
      }
    }
  });

  test('24. Form Validation - Required Fields', async ({ page }) => {
    // Test PO form validation
    await page.goto(`${BASE_URL}/pos.html`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const jobSelect = page.locator('#jobSelect');
    if (await jobSelect.isVisible()) {
      await jobSelect.selectOption({ index: 1 }).catch(() => {});
      await page.waitForTimeout(1000);
    }

    // Open create modal and try to submit empty
    const createBtn = page.locator('button:has-text("Create"), button:has-text("New PO")').first();
    if (await createBtn.isVisible()) {
      await createBtn.click();
      await page.waitForTimeout(500);

      // Try to submit without filling required fields
      const submitBtn = page.locator('button:has-text("Save"), button:has-text("Create"), button[type="submit"]').last();
      if (await submitBtn.isVisible()) {
        await submitBtn.click();
        await page.waitForTimeout(500);

        // Check if form was prevented from submitting or shows validation error
        const stillOpen = await page.locator('.modal[style*="flex"]').isVisible();
        if (!stillOpen) {
          logIssue('PO Form', 'WARN', 'Form submitted with empty required fields');
        }
      }
    }
  });

  test('25. Modal Close - Escape Key and Backdrop Click', async ({ page }) => {
    await page.goto(`${BASE_URL}/vendors.html`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Open modal
    const createBtn = page.locator('button:has-text("Add"), button:has-text("Create")').first();
    if (await createBtn.isVisible()) {
      await createBtn.click();
      await page.waitForTimeout(500);

      // Try escape key
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);

      const modalAfterEsc = await page.locator('.modal[style*="flex"], .modal.show').isVisible();
      if (modalAfterEsc) {
        logIssue('Vendors', 'WARN', 'Modal did not close on Escape key');
      }

      // Reopen and try backdrop click
      await createBtn.click();
      await page.waitForTimeout(500);

      // Click on modal backdrop (outside content)
      const modal = page.locator('.modal[style*="flex"]').first();
      if (await modal.isVisible()) {
        await modal.click({ position: { x: 10, y: 10 } });
        await page.waitForTimeout(300);

        const modalAfterClick = await page.locator('.modal[style*="flex"], .modal.show').isVisible();
        // Note: Some modals intentionally don't close on backdrop click
      }
    }
  });

});

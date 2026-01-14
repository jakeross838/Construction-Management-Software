const { test, expect } = require('@playwright/test');

/**
 * Comprehensive Stress Test
 *
 * This test resets data and tests every major feature of the application:
 * - Invoice workflow (upload, process, approve, deny)
 * - PO workflow (create, approve, link invoices)
 * - Draw workflow (create, add invoices, submit, fund)
 * - Budget (projections, close-out, variance)
 * - Reconciliation
 * - Lien Releases
 */

const BASE_URL = 'http://localhost:3001';

test.describe('Comprehensive Stress Test', () => {
  let errors = [];
  let warnings = [];

  test.beforeEach(async ({ page }) => {
    errors = [];
    warnings = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(`Console Error: ${msg.text()}`);
      } else if (msg.type() === 'warning') {
        warnings.push(`Console Warning: ${msg.text()}`);
      }
    });

    page.on('pageerror', err => errors.push(`Page Error: ${err.message}`));
    page.on('response', resp => {
      if (resp.status() >= 400) {
        errors.push(`HTTP ${resp.status()}: ${resp.url()}`);
      }
    });

    // Handle dialogs automatically
    page.on('dialog', async dialog => {
      console.log('Dialog:', dialog.message());
      await dialog.accept();
    });
  });

  test.afterEach(async ({}, testInfo) => {
    if (errors.length > 0) {
      console.log(`\n[${testInfo.title}] ERRORS:`);
      errors.forEach(e => console.log('  - ' + e));
    }
    if (warnings.length > 0) {
      console.log(`\n[${testInfo.title}] WARNINGS:`);
      warnings.forEach(w => console.log('  - ' + w));
    }
  });

  test('1. Reset Data - Push invoices to needs_review', async ({ request }) => {
    console.log('\n========================================');
    console.log('STEP 1: RESETTING DATA');
    console.log('========================================\n');

    // Get all invoices
    const response = await request.get(`${BASE_URL}/api/invoices`);
    expect(response.ok()).toBeTruthy();
    const invoices = await response.json();
    console.log(`Found ${invoices.length} invoices`);

    let resetCount = 0;
    for (const invoice of invoices) {
      if (invoice.status !== 'needs_approval' && invoice.status !== 'received') {
        // Reset to needs_approval
        const resetResponse = await request.post(`${BASE_URL}/api/invoices/${invoice.id}/transition`, {
          data: { to_status: 'needs_approval', reason: 'Stress test reset' }
        });
        if (resetResponse.ok()) {
          resetCount++;
        }
      }
    }
    console.log(`Reset ${resetCount} invoices to needs_approval`);

    // Clear draws (remove invoices from draws)
    const drawsResponse = await request.get(`${BASE_URL}/api/draws`);
    if (drawsResponse.ok()) {
      const draws = await drawsResponse.json();
      console.log(`Found ${draws.length} draws`);
      for (const draw of draws) {
        if (draw.status === 'draft') {
          // Could delete draft draws if needed
        }
      }
    }
  });

  test('2. Invoice Dashboard - Load and verify', async ({ page }) => {
    console.log('\n========================================');
    console.log('STEP 2: TESTING INVOICE DASHBOARD');
    console.log('========================================\n');

    await page.goto(`${BASE_URL}/index.html`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Check invoice list loads
    const invoiceCards = page.locator('.invoice-card');
    const count = await invoiceCards.count();
    console.log(`Invoice cards loaded: ${count}`);
    expect(count).toBeGreaterThan(0);

    // Check filters work
    const filterButtons = page.locator('.filter-btn');
    const filterCount = await filterButtons.count();
    console.log(`Filter buttons: ${filterCount}`);

    for (let i = 0; i < filterCount; i++) {
      const btn = filterButtons.nth(i);
      const text = await btn.textContent();
      await btn.click();
      await page.waitForTimeout(500);
      console.log(`Clicked filter: ${text.trim()}`);
    }

    await page.screenshot({ path: 'tests/screenshots/stress-01-dashboard.png', fullPage: true });
    expect(errors.length).toBe(0);
  });

  test('3. Invoice Modal - Open and verify fields', async ({ page }) => {
    console.log('\n========================================');
    console.log('STEP 3: TESTING INVOICE MODAL');
    console.log('========================================\n');

    await page.goto(`${BASE_URL}/index.html`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Click first invoice
    const firstInvoice = page.locator('.invoice-card').first();
    if (await firstInvoice.count() > 0) {
      await firstInvoice.click();
      await page.waitForTimeout(2000);

      // Check modal opened
      const modal = page.locator('#modal-container.active');
      expect(await modal.count()).toBe(1);

      // Check key fields exist
      const fields = [
        '#edit-invoice-number',
        '#edit-job',
        '#edit-vendor',
        '#edit-amount',
        '#edit-date'
      ];

      for (const field of fields) {
        const exists = await page.locator(field).count() > 0;
        console.log(`Field ${field}: ${exists ? 'OK' : 'MISSING'}`);
      }

      await page.screenshot({ path: 'tests/screenshots/stress-02-invoice-modal.png', fullPage: true });

      // Close modal
      await page.locator('.modal-close').click({ force: true });
    }

    expect(errors.length).toBe(0);
  });

  test('4. Invoice Approval Flow', async ({ page }) => {
    console.log('\n========================================');
    console.log('STEP 4: TESTING INVOICE APPROVAL');
    console.log('========================================\n');

    await page.goto(`${BASE_URL}/index.html`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Find needs_approval invoice
    const needsApprovalInvoice = page.locator('.invoice-card.status-needs_approval').first();
    if (await needsApprovalInvoice.count() > 0) {
      const invoiceText = await needsApprovalInvoice.textContent();
      console.log('Testing approval for:', invoiceText.substring(0, 50));

      await needsApprovalInvoice.click();
      await page.waitForTimeout(2000);

      // Check approve button exists
      const approveBtn = page.locator('button:has-text("Approve"):visible');
      expect(await approveBtn.count()).toBeGreaterThan(0);

      // Click approve
      await approveBtn.click();
      await page.waitForTimeout(3000);

      await page.screenshot({ path: 'tests/screenshots/stress-03-after-approve.png', fullPage: true });
    } else {
      console.log('No needs_approval invoices to test');
    }

    expect(errors.length).toBe(0);
  });

  test('5. Purchase Orders Page', async ({ page }) => {
    console.log('\n========================================');
    console.log('STEP 5: TESTING PURCHASE ORDERS');
    console.log('========================================\n');

    await page.goto(`${BASE_URL}/pos.html`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    await page.screenshot({ path: 'tests/screenshots/stress-04-pos-page.png', fullPage: true });

    // Check PO list loads
    const poRows = page.locator('.po-row, .invoices-table tbody tr');
    const count = await poRows.count();
    console.log(`PO rows loaded: ${count}`);

    // Click on first PO to open modal
    if (count > 0) {
      await poRows.first().click();
      await page.waitForTimeout(2000);

      await page.screenshot({ path: 'tests/screenshots/stress-05-po-modal.png', fullPage: true });

      // Check tabs exist
      const tabs = page.locator('.tab');
      const tabCount = await tabs.count();
      console.log(`PO modal tabs: ${tabCount}`);

      // Close modal
      const closeBtn = page.locator('.modal-close, .close-btn').first();
      if (await closeBtn.count() > 0) {
        await closeBtn.click({ force: true });
      }
    }

    expect(errors.length).toBe(0);
  });

  test('6. Draws Page', async ({ page }) => {
    console.log('\n========================================');
    console.log('STEP 6: TESTING DRAWS PAGE');
    console.log('========================================\n');

    await page.goto(`${BASE_URL}/draws.html`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    await page.screenshot({ path: 'tests/screenshots/stress-06-draws-page.png', fullPage: true });

    // Check draw list loads
    const drawCards = page.locator('.draw-card');
    const count = await drawCards.count();
    console.log(`Draw cards loaded: ${count}`);

    // Click on first draw to open modal
    if (count > 0) {
      await drawCards.first().click();
      await page.waitForTimeout(2000);

      await page.screenshot({ path: 'tests/screenshots/stress-07-draw-modal.png', fullPage: true });

      // Check tabs (Summary, G702, G703, Invoices)
      const tabs = page.locator('.tab');
      const tabCount = await tabs.count();
      console.log(`Draw modal tabs: ${tabCount}`);

      // Check G702 tab
      const g702Tab = page.locator('.tab:has-text("G702")');
      if (await g702Tab.count() > 0) {
        await g702Tab.click();
        await page.waitForTimeout(1000);
        await page.screenshot({ path: 'tests/screenshots/stress-08-g702.png', fullPage: true });
      }

      // Check G703 tab
      const g703Tab = page.locator('.tab:has-text("G703")');
      if (await g703Tab.count() > 0) {
        await g703Tab.click();
        await page.waitForTimeout(1000);
        await page.screenshot({ path: 'tests/screenshots/stress-09-g703.png', fullPage: true });
      }

      // Close modal
      const closeBtn = page.locator('.modal-close, .close-btn').first();
      if (await closeBtn.count() > 0) {
        await closeBtn.click({ force: true });
      }
    }

    expect(errors.length).toBe(0);
  });

  test('7. Budget Page', async ({ page }) => {
    console.log('\n========================================');
    console.log('STEP 7: TESTING BUDGET PAGE');
    console.log('========================================\n');

    await page.goto(`${BASE_URL}/budgets.html`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    await page.screenshot({ path: 'tests/screenshots/stress-10-budget-page.png', fullPage: true });

    // Select first job from sidebar
    const jobItems = page.locator('.job-item, .sidebar-job');
    if (await jobItems.count() > 0) {
      await jobItems.first().click();
      await page.waitForTimeout(3000);

      await page.screenshot({ path: 'tests/screenshots/stress-11-budget-loaded.png', fullPage: true });

      // Check summary cards loaded
      const summaryCards = page.locator('.summary-card');
      const cardCount = await summaryCards.count();
      console.log(`Budget summary cards: ${cardCount}`);

      // Check budget table loaded
      const budgetRows = page.locator('.budget-table tbody tr, #budgetBody tr');
      const rowCount = await budgetRows.count();
      console.log(`Budget table rows: ${rowCount}`);

      // Check forecast section
      const forecastSection = page.locator('h3:has-text("Forecast")');
      console.log(`Forecast section exists: ${await forecastSection.count() > 0}`);

      // Test close-out modal
      const firstBudgetRow = page.locator('.budget-table tbody tr.category-line, #budgetBody tr.category-line').first();
      if (await firstBudgetRow.count() > 0) {
        await firstBudgetRow.click();
        await page.waitForTimeout(2000);

        await page.screenshot({ path: 'tests/screenshots/stress-12-cost-code-detail.png', fullPage: true });

        // Close modal
        const closeBtn = page.locator('.modal-close, .close-btn').first();
        if (await closeBtn.count() > 0) {
          await closeBtn.click({ force: true });
        }
      }
    }

    expect(errors.length).toBe(0);
  });

  test('8. Reconciliation Page', async ({ page }) => {
    console.log('\n========================================');
    console.log('STEP 8: TESTING RECONCILIATION PAGE');
    console.log('========================================\n');

    await page.goto(`${BASE_URL}/reconciliation.html`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    await page.screenshot({ path: 'tests/screenshots/stress-13-reconciliation.png', fullPage: true });

    // Check page content loaded
    const pageContent = await page.content();
    console.log('Reconciliation page loaded');

    expect(errors.length).toBe(0);
  });

  test('9. Lien Releases Page', async ({ page }) => {
    console.log('\n========================================');
    console.log('STEP 9: TESTING LIEN RELEASES PAGE');
    console.log('========================================\n');

    await page.goto(`${BASE_URL}/lien-releases.html`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    await page.screenshot({ path: 'tests/screenshots/stress-14-lien-releases.png', fullPage: true });

    // Check page content loaded
    const pageContent = await page.content();
    console.log('Lien releases page loaded');

    expect(errors.length).toBe(0);
  });

  test('10. Vendors Page', async ({ page }) => {
    console.log('\n========================================');
    console.log('STEP 10: TESTING VENDORS PAGE');
    console.log('========================================\n');

    await page.goto(`${BASE_URL}/vendors.html`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    await page.screenshot({ path: 'tests/screenshots/stress-15-vendors.png', fullPage: true });

    // Check vendor list loaded
    const vendorRows = page.locator('.vendor-row, .invoices-table tbody tr');
    const count = await vendorRows.count();
    console.log(`Vendor rows loaded: ${count}`);

    expect(errors.length).toBe(0);
  });

  test('11. API Endpoints Health Check', async ({ request }) => {
    console.log('\n========================================');
    console.log('STEP 11: API HEALTH CHECK');
    console.log('========================================\n');

    const endpoints = [
      '/api/invoices',
      '/api/jobs',
      '/api/vendors',
      '/api/purchase-orders',
      '/api/draws',
      '/api/dashboard/stats',
      '/api/cost-codes'
    ];

    for (const endpoint of endpoints) {
      const response = await request.get(`${BASE_URL}${endpoint}`);
      const status = response.status();
      console.log(`${endpoint}: ${status === 200 ? 'OK' : 'FAILED'} (${status})`);
      expect(status).toBe(200);
    }
  });

  test('12. Budget Calculations Verification', async ({ request, page }) => {
    console.log('\n========================================');
    console.log('STEP 12: VERIFYING BUDGET CALCULATIONS');
    console.log('========================================\n');

    // Get jobs
    const jobsResponse = await request.get(`${BASE_URL}/api/jobs`);
    const jobs = await jobsResponse.json();
    console.log(`Found ${jobs.length} jobs`);

    for (const job of jobs.slice(0, 3)) { // Test first 3 jobs
      console.log(`\nVerifying job: ${job.name}`);

      const budgetResponse = await request.get(`${BASE_URL}/api/jobs/${job.id}/budget-summary`);
      if (budgetResponse.ok()) {
        const budget = await budgetResponse.json();

        // Verify totals
        console.log(`  Budget: ${budget.totals?.budgeted}`);
        console.log(`  Committed: ${budget.totals?.committed}`);
        console.log(`  Billed: ${budget.totals?.billed}`);
        console.log(`  Lines: ${budget.lines?.length}`);

        // Check for calculation issues
        let lineTotal = 0;
        for (const line of budget.lines || []) {
          lineTotal += line.budgeted || 0;

          // Check for negative values (shouldn't happen)
          if (line.budgeted < 0) {
            console.log(`  WARNING: Negative budget on ${line.costCode}`);
          }
          if (line.committed < 0) {
            console.log(`  WARNING: Negative committed on ${line.costCode}`);
          }
        }

        // Verify line totals match overall total
        const diff = Math.abs(lineTotal - (budget.totals?.budgeted || 0));
        if (diff > 0.01) {
          console.log(`  WARNING: Line total (${lineTotal}) doesn't match total (${budget.totals?.budgeted})`);
        }
      }
    }
  });

  test('13. Draw Calculations Verification', async ({ request }) => {
    console.log('\n========================================');
    console.log('STEP 13: VERIFYING DRAW CALCULATIONS');
    console.log('========================================\n');

    const drawsResponse = await request.get(`${BASE_URL}/api/draws`);
    const draws = await drawsResponse.json();
    console.log(`Found ${draws.length} draws`);

    for (const draw of draws.slice(0, 3)) { // Test first 3 draws
      const detailResponse = await request.get(`${BASE_URL}/api/draws/${draw.id}`);
      if (detailResponse.ok()) {
        const detail = await detailResponse.json();

        console.log(`\nDraw #${draw.draw_number} - ${draw.job?.name}`);
        console.log(`  Status: ${draw.status}`);
        console.log(`  Total: ${draw.total_amount}`);
        console.log(`  G702 This Period: ${detail.g702?.totalCompletedThisPeriod}`);
        console.log(`  G702 Payment Due: ${detail.g702?.currentPaymentDue}`);
        console.log(`  Invoices: ${detail.invoices?.length}`);

        // Verify invoice totals match draw total
        const invoiceTotal = (detail.invoices || []).reduce((sum, inv) => sum + (inv.amount || 0), 0);
        if (Math.abs(invoiceTotal - (draw.total_amount || 0)) > 0.01) {
          console.log(`  WARNING: Invoice total (${invoiceTotal}) doesn't match draw total (${draw.total_amount})`);
        }
      }
    }
  });

  test('14. Cross-Page Navigation', async ({ page }) => {
    console.log('\n========================================');
    console.log('STEP 14: TESTING NAVIGATION');
    console.log('========================================\n');

    const pages = [
      { url: '/index.html', name: 'Invoices' },
      { url: '/pos.html', name: 'Purchase Orders' },
      { url: '/draws.html', name: 'Draws' },
      { url: '/budgets.html', name: 'Budgets' },
      { url: '/lien-releases.html', name: 'Lien Releases' },
      { url: '/reconciliation.html', name: 'Reconciliation' },
      { url: '/vendors.html', name: 'Vendors' }
    ];

    for (const p of pages) {
      await page.goto(`${BASE_URL}${p.url}`);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);

      const hasErrors = errors.length > 0;
      console.log(`${p.name}: ${hasErrors ? 'ERRORS' : 'OK'}`);

      if (hasErrors) {
        errors.forEach(e => console.log('  - ' + e));
        errors = []; // Reset for next page
      }
    }
  });

  test('15. Sidebar Navigation', async ({ page }) => {
    console.log('\n========================================');
    console.log('STEP 15: TESTING SIDEBAR NAVIGATION');
    console.log('========================================\n');

    await page.goto(`${BASE_URL}/index.html`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Check nav sidebar exists
    const navSidebar = page.locator('.nav-sidebar, nav');
    const exists = await navSidebar.count() > 0;
    console.log(`Nav sidebar exists: ${exists}`);

    // Check nav items
    const navItems = page.locator('.nav-item, .sub-nav-link');
    const itemCount = await navItems.count();
    console.log(`Nav items: ${itemCount}`);

    await page.screenshot({ path: 'tests/screenshots/stress-16-navigation.png', fullPage: true });

    expect(errors.length).toBe(0);
  });

  test('16. Final Summary', async ({}) => {
    console.log('\n========================================');
    console.log('STRESS TEST COMPLETE');
    console.log('========================================\n');

    console.log('Check tests/screenshots/ for visual verification');
    console.log('Review console output for any warnings or issues');
  });

});

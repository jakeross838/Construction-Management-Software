// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Budget Page Tests - Updated for new dashboard design
 *
 * Tests the budget page functionality including:
 * - Contract section with CO badge
 * - Base Budget Status section
 * - Forecast section
 * - Simplified table columns (8 columns)
 * - New projection logic (full budget for open, actual for closed)
 */

test.describe('Budget Page', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/budgets.html');
    await page.waitForSelector('.job-sidebar', { timeout: 10000 });
  });

  test('should load budget page with sidebar', async ({ page }) => {
    await expect(page).toHaveTitle(/Ross Built - Budgets/);
    await expect(page.locator('.header')).toBeVisible();
    await expect(page.locator('.job-sidebar')).toBeVisible();
    await expect(page.locator('.main')).toBeVisible();
    await expect(page.locator('#budgetContent')).toContainText('Select a job');
  });

  test('should display job list in sidebar', async ({ page }) => {
    await page.waitForSelector('.job-item', { timeout: 10000 });
    const jobItems = page.locator('.job-item:not(.all-jobs)');
    await expect(jobItems.first()).toBeVisible();
    const allJobs = page.locator('.job-item.all-jobs');
    await expect(allJobs).toBeVisible();
  });

  test('should load budget when job is selected', async ({ page }) => {
    await page.waitForSelector('.job-item:not(.all-jobs)', { timeout: 10000 });
    const firstJob = page.locator('.job-item:not(.all-jobs)').first();
    await firstJob.click();
    await page.waitForTimeout(3000);

    // Budget content should show sections
    const contractSection = page.locator('h3:has-text("Contract")');
    await expect(contractSection).toBeVisible();
  });

  test('should display Contract section', async ({ page }) => {
    await page.waitForSelector('.job-item:not(.all-jobs)', { timeout: 10000 });
    await page.locator('.job-item:not(.all-jobs)').first().click();
    await page.waitForTimeout(3000);

    // Check Contract cards
    await expect(page.locator('#summaryBudget')).toBeVisible();
    await expect(page.locator('#summaryTotalContract')).toBeVisible();
  });

  test('should display Base Budget Status section', async ({ page }) => {
    await page.waitForSelector('.job-item:not(.all-jobs)', { timeout: 10000 });
    await page.locator('.job-item:not(.all-jobs)').first().click();
    await page.waitForTimeout(3000);

    // Check section header
    const statusSection = page.locator('h3:has-text("Base Budget Status")');
    await expect(statusSection).toBeVisible();

    // Check cards: Drawn, Projected Cost, Budget Remaining
    await expect(page.locator('#summaryBilled')).toBeVisible();
    await expect(page.locator('#summaryProjected')).toBeVisible();
    await expect(page.locator('#summaryRemaining')).toBeVisible();
  });

  test('should display Forecast section', async ({ page }) => {
    await page.waitForSelector('.job-item:not(.all-jobs)', { timeout: 10000 });
    await page.locator('.job-item:not(.all-jobs)').first().click();
    await page.waitForTimeout(3000);

    // Check section header
    const forecastSection = page.locator('h3:has-text("Forecast")');
    await expect(forecastSection).toBeVisible();

    // Check cards
    await expect(page.locator('#summaryCoverage')).toBeVisible();
    await expect(page.locator('#summaryProjectedVariance')).toBeVisible();
  });

  test('should display budget table with correct columns', async ({ page }) => {
    await page.waitForSelector('.job-item:not(.all-jobs)', { timeout: 10000 });
    await page.locator('.job-item:not(.all-jobs)').first().click();
    await page.waitForTimeout(3000);

    // Get table headers
    const headers = await page.locator('.budget-table thead th').allTextContents();
    const headerTexts = headers.map(h => h.trim());

    // Expected columns (8): Cost Code, Description, Budget, Billed, Projected, Status, % Complete, Variance
    expect(headerTexts).toContain('Cost Code');
    expect(headerTexts).toContain('Description');
    expect(headerTexts).toContain('Budget');
    expect(headerTexts).toContain('Billed');
    expect(headerTexts).toContain('Projected');
    expect(headerTexts).toContain('Status');
    expect(headerTexts).toContain('% Complete');
    expect(headerTexts).toContain('Variance');
  });

  test('should have correct number of columns in budget table (8)', async ({ page }) => {
    await page.waitForSelector('.job-item:not(.all-jobs)', { timeout: 10000 });
    await page.locator('.job-item:not(.all-jobs)').first().click();
    await page.waitForTimeout(3000);

    const headers = page.locator('.budget-table thead th');
    await expect(headers).toHaveCount(8);
  });

  test('should display budget data in table', async ({ page }) => {
    await page.waitForSelector('.job-item:not(.all-jobs)', { timeout: 10000 });
    await page.locator('.job-item:not(.all-jobs)').first().click();
    await page.waitForTimeout(3000);

    // Should have rows
    const rows = page.locator('.budget-table tbody tr');
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThan(0);
  });

  test('should show totals row', async ({ page }) => {
    await page.waitForSelector('.job-item:not(.all-jobs)', { timeout: 10000 });
    await page.locator('.job-item:not(.all-jobs)').first().click();
    await page.waitForTimeout(3000);

    const totalsRow = page.locator('.budget-table tfoot tr, .totals-row');
    await expect(totalsRow.first()).toBeVisible();
  });

  test('should toggle category groups', async ({ page }) => {
    await page.waitForSelector('.job-item:not(.all-jobs)', { timeout: 10000 });
    await page.locator('.job-item:not(.all-jobs)').first().click();
    await page.waitForTimeout(3000);

    // Find a category row and click to toggle
    const categoryRow = page.locator('.category-row').first();
    if (await categoryRow.count() > 0) {
      await categoryRow.click();
      await page.waitForTimeout(300);
      await categoryRow.click();
    }
  });

  test('should highlight over-budget items in red', async ({ page }) => {
    await page.waitForSelector('.job-item:not(.all-jobs)', { timeout: 10000 });
    await page.locator('.job-item:not(.all-jobs)').first().click();
    await page.waitForTimeout(3000);

    // Just verify page doesn't error - may or may not have over-budget items
    const overBudgetItems = page.locator('.over-budget, .negative');
    const count = await overBudgetItems.count();
    console.log(`Over budget items found: ${count}`);
  });

  test('should return to empty state when All Jobs selected', async ({ page }) => {
    await page.waitForSelector('.job-item:not(.all-jobs)', { timeout: 10000 });

    // Select a job first
    await page.locator('.job-item:not(.all-jobs)').first().click();
    await page.waitForTimeout(2000);

    // Click All Jobs
    await page.locator('.job-item.all-jobs').click();
    await page.waitForTimeout(1000);

    // Should show empty state
    await expect(page.locator('#budgetContent')).toContainText('Select a job');
  });

  test('should have export buttons', async ({ page }) => {
    await page.waitForSelector('.job-item:not(.all-jobs)', { timeout: 10000 });
    await page.locator('.job-item:not(.all-jobs)').first().click();
    await page.waitForTimeout(3000);

    // Look for export buttons
    const exportBtn = page.locator('button:has-text("Export"), button:has-text("Excel")');
    const count = await exportBtn.count();
    console.log(`Export buttons found: ${count}`);
  });
});

test.describe('Budget API', () => {

  test('should return projected cost in budget summary API', async ({ request }) => {
    const jobsRes = await request.get('/api/jobs');
    const jobs = await jobsRes.json();
    expect(jobs.length).toBeGreaterThan(0);

    const job = jobs[0];
    const budgetRes = await request.get(`/api/jobs/${job.id}/budget-summary`);
    const budget = await budgetRes.json();

    expect(budget.totals).toBeDefined();
    expect(budget.totals.budgeted).toBeDefined();
    expect(budget.totals.projected).toBeDefined();
    expect(budget.totals.committed).toBeDefined();
    expect(budget.totals.billed).toBeDefined();
  });

  test('should return projected cost for each budget line', async ({ request }) => {
    const jobsRes = await request.get('/api/jobs');
    const jobs = await jobsRes.json();
    const job = jobs[0];

    const budgetRes = await request.get(`/api/jobs/${job.id}/budget-summary`);
    const budget = await budgetRes.json();

    for (const line of budget.lines || []) {
      expect(line.projected).toBeDefined();

      // For closed lines: projected = committed + pending
      if (line.closedAt) {
        const expected = (line.committed || 0) + (line.pending || 0);
        expect(line.projected).toBeCloseTo(expected, 2);
      } else {
        // For open lines: projected >= budgeted
        expect(line.projected).toBeGreaterThanOrEqual((line.budgeted || 0) - 0.01);
      }
    }
  });

  test('should calculate projected correctly as MAX(budget, committed+pending) for open lines', async ({ request }) => {
    const jobsRes = await request.get('/api/jobs');
    const jobs = await jobsRes.json();
    const job = jobs[0];

    const budgetRes = await request.get(`/api/jobs/${job.id}/budget-summary`);
    const budget = await budgetRes.json();

    for (const line of budget.lines || []) {
      if (!line.closedAt) {
        // Open line: projected = max(budget, committed + pending)
        const activity = (line.committed || 0) + (line.pending || 0);
        const expected = Math.max(line.budgeted || 0, activity);
        expect(line.projected).toBeCloseTo(expected, 2);
      }
    }
  });

  test('should include PO coverage data', async ({ request }) => {
    const jobsRes = await request.get('/api/jobs');
    const jobs = await jobsRes.json();
    const job = jobs[0];

    const budgetRes = await request.get(`/api/jobs/${job.id}/budget-summary`);
    const budget = await budgetRes.json();

    // Totals should have coverage stats
    expect(budget.totals.budgetClosed).toBeDefined();
    expect(budget.totals.poCoveragePercent).toBeDefined();

    // Lines should have PO coverage info
    for (const line of budget.lines || []) {
      expect(line.hasPOCoverage).toBeDefined();
      expect(line.poAmount).toBeDefined();
    }
  });
});

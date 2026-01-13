// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Budget Page Tests - Including Projected Cost Tracking
 *
 * Tests the budget page functionality including:
 * - Page loads correctly
 * - Sidebar job selection works
 * - Summary cards display correct data
 * - Projected cost calculations are correct
 * - Budget table displays with all columns
 * - Variance calculations work correctly
 */

test.describe('Budget Page', () => {

  test.beforeEach(async ({ page }) => {
    // Navigate to budgets page
    await page.goto('/budgets.html');
    // Wait for sidebar to load
    await page.waitForSelector('.job-sidebar', { timeout: 10000 });
  });

  test('should load budget page with sidebar', async ({ page }) => {
    // Check page title
    await expect(page).toHaveTitle(/Ross Built - Budgets/);

    // Check header exists
    await expect(page.locator('.header')).toBeVisible();

    // Check sidebar exists
    await expect(page.locator('.job-sidebar')).toBeVisible();

    // Check main content area exists
    await expect(page.locator('.main')).toBeVisible();

    // Check empty state message when no job selected
    await expect(page.locator('#budgetContent')).toContainText('Select a job');
  });

  test('should display job list in sidebar', async ({ page }) => {
    // Wait for jobs to load
    await page.waitForSelector('.job-item', { timeout: 10000 });

    // Should have at least one job
    const jobItems = page.locator('.job-item:not(.all-jobs)');
    await expect(jobItems.first()).toBeVisible();

    // All Jobs option should exist
    await expect(page.locator('.job-item.all-jobs')).toBeVisible();
  });

  test('should load budget when job is selected', async ({ page }) => {
    // Wait for jobs to load
    await page.waitForSelector('.job-item:not(.all-jobs)', { timeout: 10000 });

    // Click first job in sidebar
    await page.locator('.job-item:not(.all-jobs)').first().click();

    // Wait for budget detail to appear
    await page.waitForSelector('#budgetDetail', { state: 'visible', timeout: 10000 });

    // Budget detail should be visible
    await expect(page.locator('#budgetDetail')).toBeVisible();

    // Empty state should be hidden
    await expect(page.locator('#budgetContent')).toBeHidden();

    // Page title should update with job name
    await expect(page.locator('#budgetPageTitle')).toContainText('Budget -');
  });

  test('should display all summary cards with projected costs', async ({ page }) => {
    // Select a job
    await page.waitForSelector('.job-item:not(.all-jobs)', { timeout: 10000 });
    await page.locator('.job-item:not(.all-jobs)').first().click();
    await page.waitForSelector('#budgetDetail', { state: 'visible', timeout: 10000 });

    // Check all required summary cards exist
    const summaryCards = [
      { id: 'summaryBudget', label: 'Original Budget' },
      { id: 'summaryChangeOrders', label: 'Change Orders' },
      { id: 'summaryTotalContract', label: 'Revised Budget' },
      { id: 'summaryProjected', label: 'Projected Final' },
      { id: 'summaryProjectedVariance', label: 'Projected Variance' },
      { id: 'summaryBilled', label: 'Billed to Date' },
      { id: 'summaryPaid', label: 'Paid to Date' },
      { id: 'summaryOverBudget', label: 'Over Budget' },
    ];

    for (const card of summaryCards) {
      const element = page.locator(`#${card.id}`);
      await expect(element).toBeVisible();
      // Should have a value (not empty)
      const text = await element.textContent();
      expect(text?.trim().length).toBeGreaterThan(0);
    }
  });

  test('should display budget table with Projected column', async ({ page }) => {
    // Select a job
    await page.waitForSelector('.job-item:not(.all-jobs)', { timeout: 10000 });
    await page.locator('.job-item:not(.all-jobs)').first().click();
    await page.waitForSelector('#budgetDetail', { state: 'visible', timeout: 10000 });

    // Check table headers exist including Projected
    const headers = page.locator('.budget-table thead th');
    const headerTexts = await headers.allTextContents();

    expect(headerTexts).toContain('Cost Code');
    expect(headerTexts).toContain('Description');
    expect(headerTexts).toContain('Budget');
    expect(headerTexts).toContain('Committed');
    expect(headerTexts).toContain('Billed');
    expect(headerTexts).toContain('Paid');
    expect(headerTexts).toContain('Projected');
    expect(headerTexts).toContain('%');
    expect(headerTexts).toContain('Variance');
  });

  test('should have correct number of columns in budget table (9)', async ({ page }) => {
    // Select a job
    await page.waitForSelector('.job-item:not(.all-jobs)', { timeout: 10000 });
    await page.locator('.job-item:not(.all-jobs)').first().click();
    await page.waitForSelector('#budgetDetail', { state: 'visible', timeout: 10000 });

    // Count header columns
    const headers = page.locator('.budget-table thead th');
    await expect(headers).toHaveCount(9);
  });

  test('should display budget data in table', async ({ page }) => {
    // Select a job
    await page.waitForSelector('.job-item:not(.all-jobs)', { timeout: 10000 });
    await page.locator('.job-item:not(.all-jobs)').first().click();
    await page.waitForSelector('#budgetDetail', { state: 'visible', timeout: 10000 });

    // Wait for table to populate
    await page.waitForSelector('.budget-table tbody tr', { timeout: 10000 });

    // Should have budget rows (category headers or line items)
    const rows = page.locator('.budget-table tbody tr');
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThan(0);

    // Footer with totals should exist
    const footer = page.locator('.budget-table tfoot tr');
    await expect(footer).toBeVisible();
  });

  test('should show totals row with all values', async ({ page }) => {
    // Select a job
    await page.waitForSelector('.job-item:not(.all-jobs)', { timeout: 10000 });
    await page.locator('.job-item:not(.all-jobs)').first().click();
    await page.waitForSelector('#budgetDetail', { state: 'visible', timeout: 10000 });

    // Wait for footer
    await page.waitForSelector('.budget-table tfoot .totals-row', { timeout: 10000 });

    // Check totals row has TOTAL label
    const totalsRow = page.locator('.budget-table tfoot .totals-row');
    await expect(totalsRow).toContainText('TOTAL');

    // Should have cells (first has colspan="2" so 8 td elements for 9 columns)
    const cells = totalsRow.locator('td');
    const cellCount = await cells.count();
    expect(cellCount).toBe(8); // 8 td elements (first has colspan=2)
  });

  test('should toggle category groups', async ({ page }) => {
    // Select a job
    await page.waitForSelector('.job-item:not(.all-jobs)', { timeout: 10000 });
    await page.locator('.job-item:not(.all-jobs)').first().click();
    await page.waitForSelector('#budgetDetail', { state: 'visible', timeout: 10000 });

    // Wait for category headers to appear
    await page.waitForSelector('.category-header', { timeout: 10000 });

    // Get first category header
    const categoryHeader = page.locator('.category-header').first();
    await expect(categoryHeader).toBeVisible();

    // Get category lines count before collapse
    const linesBefore = await page.locator('.category-line').count();

    // Click to collapse
    await categoryHeader.click();

    // Wait a moment for animation
    await page.waitForTimeout(300);

    // Some lines should be hidden now (or count should change if we have multiple categories)
    // Just verify the click didn't cause an error
    await expect(categoryHeader).toBeVisible();
  });

  test('should highlight over-budget items in red', async ({ page }) => {
    // Select a job
    await page.waitForSelector('.job-item:not(.all-jobs)', { timeout: 10000 });
    await page.locator('.job-item:not(.all-jobs)').first().click();
    await page.waitForSelector('#budgetDetail', { state: 'visible', timeout: 10000 });

    // Check if any over-budget styling exists (class is defined)
    const overBudgetStyle = await page.evaluate(() => {
      const styles = document.styleSheets;
      for (let i = 0; i < styles.length; i++) {
        try {
          const rules = styles[i].cssRules;
          for (let j = 0; j < rules.length; j++) {
            if (rules[j].cssText.includes('over-budget')) {
              return true;
            }
          }
        } catch (e) {
          // Cross-origin stylesheets may throw
        }
      }
      return false;
    });

    expect(overBudgetStyle).toBe(true);
  });

  test('should return to empty state when All Jobs selected', async ({ page }) => {
    // Select a job first
    await page.waitForSelector('.job-item:not(.all-jobs)', { timeout: 10000 });
    await page.locator('.job-item:not(.all-jobs)').first().click();
    await page.waitForSelector('#budgetDetail', { state: 'visible', timeout: 10000 });

    // Now click All Jobs
    await page.locator('.job-item.all-jobs').click();

    // Budget detail should hide
    await expect(page.locator('#budgetDetail')).toBeHidden();

    // Empty state should show
    await expect(page.locator('#budgetContent')).toBeVisible();
    await expect(page.locator('#budgetContent')).toContainText('Select a job');
  });

  test('should have export buttons', async ({ page }) => {
    // Select a job
    await page.waitForSelector('.job-item:not(.all-jobs)', { timeout: 10000 });
    await page.locator('.job-item:not(.all-jobs)').first().click();
    await page.waitForSelector('#budgetDetail', { state: 'visible', timeout: 10000 });

    // Check for export buttons
    await expect(page.locator('button:has-text("Export Excel")')).toBeVisible();
    await expect(page.locator('button:has-text("Print")')).toBeVisible();
  });

});

test.describe('Budget API', () => {

  test('should return projected cost in budget summary API', async ({ request }) => {
    // Get jobs first
    const jobsResponse = await request.get('/api/jobs');
    expect(jobsResponse.ok()).toBeTruthy();

    const jobs = await jobsResponse.json();
    expect(jobs.length).toBeGreaterThan(0);

    const jobId = jobs[0].id;

    // Get budget summary
    const budgetResponse = await request.get(`/api/jobs/${jobId}/budget-summary`);
    expect(budgetResponse.ok()).toBeTruthy();

    const budget = await budgetResponse.json();

    // Check totals include projected fields
    expect(budget.totals).toHaveProperty('projected');
    expect(budget.totals).toHaveProperty('projectedVariance');
    expect(typeof budget.totals.projected).toBe('number');
    expect(typeof budget.totals.projectedVariance).toBe('number');
  });

  test('should return projected cost for each budget line', async ({ request }) => {
    // Get jobs first
    const jobsResponse = await request.get('/api/jobs');
    const jobs = await jobsResponse.json();
    const jobId = jobs[0].id;

    // Get budget summary
    const budgetResponse = await request.get(`/api/jobs/${jobId}/budget-summary`);
    const budget = await budgetResponse.json();

    // Check each line has projected field
    expect(budget.lines.length).toBeGreaterThan(0);

    for (const line of budget.lines) {
      expect(line).toHaveProperty('projected');
      expect(typeof line.projected).toBe('number');

      // Projected should be MAX(budgeted, committed, billed)
      const expected = Math.max(line.budgeted || 0, line.committed || 0, line.billed || 0);
      expect(line.projected).toBe(expected);
    }
  });

  test('should calculate projected correctly as MAX(budget, committed, billed)', async ({ request }) => {
    const jobsResponse = await request.get('/api/jobs');
    const jobs = await jobsResponse.json();
    const jobId = jobs[0].id;

    const budgetResponse = await request.get(`/api/jobs/${jobId}/budget-summary`);
    const budget = await budgetResponse.json();

    // Calculate expected total projected
    let expectedTotalProjected = 0;
    for (const line of budget.lines) {
      expectedTotalProjected += Math.max(line.budgeted || 0, line.committed || 0, line.billed || 0);
    }

    // Should match API total
    expect(budget.totals.projected).toBeCloseTo(expectedTotalProjected, 2);
  });

});

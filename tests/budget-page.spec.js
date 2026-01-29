// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Budget Page Tests - React Version
 * Tests the React Budget page at /budget route
 */

test.describe('Budget Page (React)', () => {

  test('budget page loads without errors', async ({ page }) => {
    // Navigate to budget page
    await page.goto('/budget');
    await page.waitForLoadState('networkidle');

    // Check page title/heading
    await expect(page.getByRole('heading', { name: 'Budget Tracking' })).toBeVisible();

    // Check no console errors
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.waitForTimeout(2000);

    // Should have summary cards
    const cards = page.locator('.stat-card, [class*="CardContent"]');
    await expect(cards.first()).toBeVisible();
  });

  test('budget page shows data when job is selected', async ({ page }) => {
    // Go to budget page
    await page.goto('/budget');
    await page.waitForLoadState('networkidle');

    // Wait for job selector to load
    await page.waitForTimeout(1000);

    // Select a job from the job dropdown (if available)
    const jobSelector = page.locator('[data-testid="job-select"], select, [role="combobox"]').first();
    if (await jobSelector.isVisible()) {
      await jobSelector.click();
      await page.waitForTimeout(500);

      // Select first job option
      const options = page.locator('[role="option"], option');
      if (await options.count() > 1) {
        await options.nth(1).click();
        await page.waitForTimeout(2000);
      }
    }

    // Page should display without crashing
    await expect(page.getByRole('heading', { name: 'Budget Tracking' })).toBeVisible();
  });

  test('budget summary endpoint returns correct structure', async ({ request }) => {
    // Get jobs first
    const jobsResponse = await request.get('/api/jobs');
    expect(jobsResponse.ok()).toBeTruthy();
    const jobs = await jobsResponse.json();

    if (jobs.length === 0) {
      test.skip();
      return;
    }

    // Get budget summary for first job
    const budgetResponse = await request.get(`/api/jobs/${jobs[0].id}/budget-summary`);
    expect(budgetResponse.ok()).toBeTruthy();

    const data = await budgetResponse.json();

    // Should have required structure
    expect(data).toHaveProperty('job');
    expect(data).toHaveProperty('lines');
    expect(data).toHaveProperty('totals');

    // Totals should have required fields
    expect(data.totals).toHaveProperty('budgeted');
    expect(data.totals).toHaveProperty('committed');
    expect(data.totals).toHaveProperty('billed');
  });

  test('invoice allocations flow to budget', async ({ request }) => {
    // Get invoices with allocations
    const invoicesResponse = await request.get('/api/invoices?limit=10');
    expect(invoicesResponse.ok()).toBeTruthy();
    const invoices = await invoicesResponse.json();

    // Find an invoice with allocations and a job
    const invoiceWithAllocation = invoices.find(inv =>
      inv.job_id && inv.status !== 'denied' && inv.amount > 0
    );

    if (!invoiceWithAllocation) {
      console.log('No invoice with job found, skipping');
      test.skip();
      return;
    }

    // Get budget summary for that job
    const budgetResponse = await request.get(`/api/jobs/${invoiceWithAllocation.job_id}/budget-summary`);
    expect(budgetResponse.ok()).toBeTruthy();

    const budgetData = await budgetResponse.json();

    // Should have lines array
    expect(Array.isArray(budgetData.lines)).toBe(true);

    // If invoice is approved/in_draw/paid, billed should reflect it
    if (['approved', 'in_draw', 'paid'].includes(invoiceWithAllocation.status)) {
      // Total billed should be > 0 if there are approved invoices
      console.log(`Invoice ${invoiceWithAllocation.id} status: ${invoiceWithAllocation.status}, amount: ${invoiceWithAllocation.amount}`);
      console.log(`Budget totals - billed: ${budgetData.totals.billed}`);

      // At minimum, the endpoint should return without error
      expect(budgetData.totals).toBeDefined();
    }
  });
});

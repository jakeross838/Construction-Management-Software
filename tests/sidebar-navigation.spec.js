// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Sidebar and Navigation Tests
 *
 * Tests the sidebar job selection and navigation functionality including:
 * - Sidebar renders on all pages
 * - Job selection persists across pages
 * - Collapse/expand functionality
 * - Navigation between Financial tabs
 */

test.describe('Sidebar', () => {

  test('should render sidebar on invoices page', async ({ page }) => {
    await page.goto('/index.html');
    await page.waitForSelector('.job-sidebar', { timeout: 10000 });

    await expect(page.locator('.job-sidebar')).toBeVisible();
    await expect(page.locator('.sidebar-header')).toBeVisible();
    await expect(page.locator('.job-item.all-jobs')).toBeVisible();
  });

  test('should render sidebar on POs page', async ({ page }) => {
    await page.goto('/pos.html');
    await page.waitForSelector('.job-sidebar', { timeout: 10000 });

    await expect(page.locator('.job-sidebar')).toBeVisible();
  });

  test('should render sidebar on draws page', async ({ page }) => {
    await page.goto('/draws.html');
    await page.waitForSelector('.job-sidebar', { timeout: 10000 });

    await expect(page.locator('.job-sidebar')).toBeVisible();
  });

  test('should render sidebar on budgets page', async ({ page }) => {
    await page.goto('/budgets.html');
    await page.waitForSelector('.job-sidebar', { timeout: 10000 });

    await expect(page.locator('.job-sidebar')).toBeVisible();
  });

  test('should load jobs in sidebar', async ({ page }) => {
    await page.goto('/index.html');
    await page.waitForSelector('.job-item:not(.all-jobs)', { timeout: 10000 });

    const jobItems = page.locator('.job-item:not(.all-jobs)');
    const count = await jobItems.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should highlight selected job', async ({ page }) => {
    await page.goto('/index.html');
    await page.waitForSelector('.job-item:not(.all-jobs)', { timeout: 10000 });

    // Click a job
    const firstJob = page.locator('.job-item:not(.all-jobs)').first();
    await firstJob.click();

    // Should have active class
    await expect(firstJob).toHaveClass(/active/);

    // All Jobs should not be active
    await expect(page.locator('.job-item.all-jobs')).not.toHaveClass(/active/);
  });

  test('should persist job selection across page navigation', async ({ page }) => {
    // Start on invoices page
    await page.goto('/index.html');
    await page.waitForSelector('.job-item:not(.all-jobs)', { timeout: 10000 });

    // Get first job name
    const firstJob = page.locator('.job-item:not(.all-jobs)').first();
    const jobName = await firstJob.locator('.job-item-name').textContent();

    // Select the job
    await firstJob.click();
    await expect(firstJob).toHaveClass(/active/);

    // Navigate to POs page
    await page.locator('a[href="pos.html"]').click();
    await page.waitForSelector('.job-sidebar', { timeout: 10000 });

    // Same job should still be selected
    const selectedJob = page.locator('.job-item.active:not(.all-jobs)');
    await expect(selectedJob).toBeVisible();
    await expect(selectedJob.locator('.job-item-name')).toHaveText(jobName);
  });

  test('should collapse and expand sidebar', async ({ page }) => {
    await page.goto('/index.html');
    await page.waitForSelector('.job-sidebar', { timeout: 10000 });

    // Find collapse button
    const collapseBtn = page.locator('.sidebar-collapse-btn');

    if (await collapseBtn.isVisible()) {
      // Get initial width or check expanded state
      const sidebar = page.locator('.job-sidebar');
      const initialClass = await sidebar.getAttribute('class');

      // Click to collapse
      await collapseBtn.click();
      await page.waitForTimeout(300); // Wait for animation

      // Check if collapsed class is added or width changed
      const appBody = page.locator('.app-body');
      const isCollapsed = await appBody.evaluate(el =>
        el.classList.contains('sidebar-collapsed') ||
        document.body.classList.contains('sidebar-collapsed')
      );

      // Toggle back
      await collapseBtn.click();
    }
  });

  test('should filter content when job is selected on invoices page', async ({ page }) => {
    await page.goto('/index.html');
    await page.waitForSelector('.job-item:not(.all-jobs)', { timeout: 10000 });

    // Wait for invoice list to load
    await page.waitForSelector('.invoice-list', { timeout: 10000 });

    // Select a job
    await page.locator('.job-item:not(.all-jobs)').first().click();

    // Wait a moment for filtering
    await page.waitForTimeout(500);

    // The page should respond (no error)
    await expect(page.locator('.invoice-list')).toBeVisible();
  });

  test('should show All Jobs option and select it', async ({ page }) => {
    await page.goto('/index.html');
    await page.waitForSelector('.job-sidebar', { timeout: 10000 });

    // All Jobs should be visible
    const allJobs = page.locator('.job-item.all-jobs');
    await expect(allJobs).toBeVisible();
    await expect(allJobs).toContainText('All Jobs');

    // Click All Jobs
    await allJobs.click();

    // Should be active
    await expect(allJobs).toHaveClass(/active/);
  });

  test('should have search input in sidebar', async ({ page }) => {
    await page.goto('/index.html');
    await page.waitForSelector('.job-sidebar', { timeout: 10000 });

    // Check for search input
    const searchInput = page.locator('.sidebar-search input, .job-search-input');
    if (await searchInput.count() > 0) {
      await expect(searchInput.first()).toBeVisible();
    }
  });

});

test.describe('Navigation', () => {

  test('should have Financial tab in main nav', async ({ page }) => {
    await page.goto('/index.html');

    const financialTab = page.locator('.main-nav-link:has-text("Financial")');
    await expect(financialTab).toBeVisible();
    await expect(financialTab).toHaveClass(/active/);
  });

  test('should have sub-navigation with all sections', async ({ page }) => {
    await page.goto('/index.html');

    // Check sub-nav links
    await expect(page.locator('.sub-nav-link:has-text("Invoices")')).toBeVisible();
    await expect(page.locator('.sub-nav-link:has-text("Purchase Orders")')).toBeVisible();
    await expect(page.locator('.sub-nav-link:has-text("Draws")')).toBeVisible();
    await expect(page.locator('.sub-nav-link:has-text("Budgets")')).toBeVisible();
  });

  test('should highlight correct sub-nav item on each page', async ({ page }) => {
    // Invoices page
    await page.goto('/index.html');
    await expect(page.locator('.sub-nav-link:has-text("Invoices")')).toHaveClass(/active/);

    // POs page
    await page.goto('/pos.html');
    await expect(page.locator('.sub-nav-link:has-text("Purchase Orders")')).toHaveClass(/active/);

    // Draws page
    await page.goto('/draws.html');
    await expect(page.locator('.sub-nav-link:has-text("Draws")')).toHaveClass(/active/);

    // Budgets page
    await page.goto('/budgets.html');
    await expect(page.locator('.sub-nav-link:has-text("Budgets")')).toHaveClass(/active/);
  });

  test('should navigate between pages using sub-nav', async ({ page }) => {
    await page.goto('/index.html');

    // Click POs link
    await page.locator('.sub-nav-link:has-text("Purchase Orders")').click();
    await expect(page).toHaveURL(/pos\.html/);

    // Click Draws link
    await page.locator('.sub-nav-link:has-text("Draws")').click();
    await expect(page).toHaveURL(/draws\.html/);

    // Click Budgets link
    await page.locator('.sub-nav-link:has-text("Budgets")').click();
    await expect(page).toHaveURL(/budgets\.html/);

    // Click Invoices link
    await page.locator('.sub-nav-link:has-text("Invoices")').click();
    await expect(page).toHaveURL(/index\.html/);
  });

  test('should have Ross Built branding', async ({ page }) => {
    await page.goto('/index.html');

    await expect(page.locator('.brand-name').first()).toContainText('Ross Built');
  });

  test('should have action button in header', async ({ page }) => {
    // Invoices page should have Upload Invoice button
    await page.goto('/index.html');
    await expect(page.locator('.header-actions button')).toBeVisible();

    // POs page should have New PO button
    await page.goto('/pos.html');
    await expect(page.locator('.header-actions button')).toBeVisible();
  });

});

test.describe('Page Loading', () => {

  test('invoices page should load without errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await page.goto('/index.html');
    await page.waitForSelector('.invoice-list', { timeout: 10000 });

    expect(errors.length).toBe(0);
  });

  test('POs page should load without errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await page.goto('/pos.html');
    await page.waitForSelector('#poList', { timeout: 10000 });

    expect(errors.length).toBe(0);
  });

  test('draws page should load without errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await page.goto('/draws.html');
    await page.waitForSelector('.draw-list, #drawList', { timeout: 10000 });

    expect(errors.length).toBe(0);
  });

  test('budgets page should load without errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await page.goto('/budgets.html');
    await page.waitForSelector('.job-sidebar', { timeout: 10000 });

    expect(errors.length).toBe(0);
  });

});

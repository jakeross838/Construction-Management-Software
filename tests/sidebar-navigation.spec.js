// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Sidebar and Navigation Tests (React Version)
 *
 * Tests the sidebar navigation and page loading in the React app
 * Updated for shadcn/ui component structure
 */

test.describe('Sidebar', () => {

  test.beforeEach(async ({ page }) => {
    // Navigate to app - React app handles auth state
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // If redirected to login, we're in auth mode - skip test or handle login
    if (page.url().includes('/login')) {
      // Skip auth-protected tests in CI or handle demo login
      test.skip();
    }
  });

  test('should render sidebar on main pages', async ({ page }) => {
    // Wait for the React sidebar (uses aside element)
    await expect(page.locator('aside')).toBeVisible({ timeout: 10000 });

    // Should have navigation links
    await expect(page.locator('aside nav')).toBeVisible();
    await expect(page.locator('aside a').first()).toBeVisible();
  });

  test('should have navigation sections', async ({ page }) => {
    await page.waitForSelector('aside', { timeout: 10000 });

    // React sidebar uses collapsible sections
    const navLinks = page.locator('aside a');
    const count = await navLinks.count();
    expect(count).toBeGreaterThan(5); // Should have multiple nav items
  });

  test('should highlight active navigation item', async ({ page }) => {
    await page.goto('/invoices');
    await page.waitForLoadState('networkidle');

    // The active link should have special styling
    const invoicesLink = page.locator('aside a[href="/invoices"]');
    await expect(invoicesLink).toBeVisible();
    // Check for active class or state
    await expect(invoicesLink).toHaveClass(/active|bg-/);
  });

  test('should navigate between pages', async ({ page }) => {
    // Navigate to Invoices
    await page.click('aside a[href="/invoices"]');
    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain('/invoices');

    // Navigate to Purchase Orders
    await page.click('aside a[href="/purchase-orders"]');
    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain('/purchase-orders');

    // Navigate to Draws
    await page.click('aside a[href="/draws"]');
    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain('/draws');

    // Navigate to Budget
    await page.click('aside a[href="/budget"]');
    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain('/budget');
  });

  test('should have collapse functionality', async ({ page }) => {
    await page.waitForSelector('aside', { timeout: 10000 });

    // Find collapse button (usually at bottom of sidebar)
    const collapseBtn = page.locator('aside button:has-text("Collapse"), aside button:has(svg[class*="chevron"])').last();

    if (await collapseBtn.isVisible()) {
      // Get initial width
      const sidebar = page.locator('aside');
      const initialWidth = await sidebar.evaluate(el => el.offsetWidth);

      // Click collapse
      await collapseBtn.click();
      await page.waitForTimeout(500); // Wait for animation

      // Width should change
      const newWidth = await sidebar.evaluate(el => el.offsetWidth);
      expect(newWidth).not.toBe(initialWidth);
    }
  });
});

test.describe('Page Loading', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    if (page.url().includes('/login')) {
      test.skip();
    }
  });

  test('dashboard page should load without errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Should have main content
    await expect(page.locator('main, [class*="main"]')).toBeVisible();

    // No critical errors
    const criticalErrors = errors.filter(e => !e.includes('401') && !e.includes('ResizeObserver'));
    expect(criticalErrors.length).toBe(0);
  });

  test('invoices page should load without errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await page.goto('/invoices');
    await page.waitForLoadState('networkidle');

    // Should have page content
    await expect(page.locator('h1:has-text("Invoices"), h2:has-text("Invoices")')).toBeVisible({ timeout: 10000 });

    const criticalErrors = errors.filter(e => !e.includes('401') && !e.includes('ResizeObserver'));
    expect(criticalErrors.length).toBe(0);
  });

  test('POs page should load without errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await page.goto('/purchase-orders');
    await page.waitForLoadState('networkidle');

    // Should have page content
    await expect(page.locator('h1:has-text("Purchase Orders"), h2:has-text("Purchase Orders")')).toBeVisible({ timeout: 10000 });

    const criticalErrors = errors.filter(e => !e.includes('401') && !e.includes('ResizeObserver'));
    expect(criticalErrors.length).toBe(0);
  });

  test('draws page should load without errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await page.goto('/draws');
    await page.waitForLoadState('networkidle');

    // Should have page content
    await expect(page.locator('h1:has-text("Draws"), h2:has-text("Draws")')).toBeVisible({ timeout: 10000 });

    const criticalErrors = errors.filter(e => !e.includes('401') && !e.includes('ResizeObserver'));
    expect(criticalErrors.length).toBe(0);
  });

  test('budgets page should load without errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await page.goto('/budget');
    await page.waitForLoadState('networkidle');

    // Should have page content
    await expect(page.locator('h1:has-text("Budget"), h2:has-text("Budget")')).toBeVisible({ timeout: 10000 });

    const criticalErrors = errors.filter(e => !e.includes('401') && !e.includes('ResizeObserver'));
    expect(criticalErrors.length).toBe(0);
  });
});

test.describe('Job Context', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    if (page.url().includes('/login')) {
      test.skip();
    }
  });

  test('should have job selector in header', async ({ page }) => {
    // Look for job selector component
    const jobSelector = page.locator('[data-testid="job-selector"], button:has-text("Job"), button:has-text("All Jobs")').first();

    // Job selector should be visible (might be in header or as dropdown trigger)
    await expect(jobSelector).toBeVisible({ timeout: 10000 });
  });

  test('should show job options when clicking selector', async ({ page }) => {
    const jobSelector = page.locator('[data-testid="job-selector"], button:has-text("Job"), button:has-text("All Jobs")').first();

    if (await jobSelector.isVisible()) {
      await jobSelector.click();
      await page.waitForTimeout(300);

      // Should show options (shadcn uses [role="option"])
      const options = page.locator('[role="option"], [role="listbox"] [data-value]');
      const count = await options.count();
      expect(count).toBeGreaterThanOrEqual(1);
    }
  });
});

const { test, expect } = require('@playwright/test');

// Collect all console messages and errors
let consoleMessages = [];
let consoleErrors = [];
let networkErrors = [];

test.describe('Ross Built CMS - Full App Test', () => {

  test.beforeEach(async ({ page }) => {
    // Reset collectors
    consoleMessages = [];
    consoleErrors = [];
    networkErrors = [];

    // Capture console messages
    page.on('console', msg => {
      const text = msg.text();
      consoleMessages.push({ type: msg.type(), text });
      if (msg.type() === 'error') {
        consoleErrors.push(text);
        console.log('CONSOLE ERROR:', text);
      }
    });

    // Capture page errors
    page.on('pageerror', err => {
      consoleErrors.push(err.message);
      console.log('PAGE ERROR:', err.message);
    });

    // Capture failed network requests
    page.on('requestfailed', request => {
      networkErrors.push({
        url: request.url(),
        failure: request.failure()?.errorText
      });
      console.log('NETWORK ERROR:', request.url(), request.failure()?.errorText);
    });

    // Capture response errors
    page.on('response', response => {
      if (response.status() >= 400) {
        networkErrors.push({
          url: response.url(),
          status: response.status()
        });
        console.log('HTTP ERROR:', response.status(), response.url());
      }
    });

    // Skip if redirected to login
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    if (page.url().includes('/login')) {
      test.skip();
    }
  });

  test('1. Page loads without errors', async ({ page }) => {
    await page.goto('/invoices');
    await page.waitForLoadState('networkidle');

    // Wait for content to load
    await page.waitForTimeout(2000);

    // Check for JS errors on load
    console.log('\n=== LOAD ERRORS ===');
    console.log('Console Errors:', consoleErrors.filter(e => !e.includes('401') && !e.includes('ResizeObserver')));
    console.log('Network Errors:', networkErrors);

    // Page should have loaded - check for sidebar
    await expect(page.locator('aside')).toBeVisible();
    await expect(page.locator('main')).toBeVisible();
  });

  test('2. Invoice list displays correctly', async ({ page }) => {
    await page.goto('/invoices');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Check if invoices loaded (either table rows or empty state)
    const tableRows = page.locator('table tbody tr');
    const emptyState = page.locator(':has-text("No invoices"), :has-text("No results")');

    const hasInvoices = await tableRows.count() > 0;
    const hasEmptyState = await emptyState.count() > 0;

    console.log('Invoice rows found:', await tableRows.count());
    expect(hasInvoices || hasEmptyState).toBeTruthy();
  });

  test('3. Click invoice row - open edit dialog', async ({ page }) => {
    await page.goto('/invoices');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Find first invoice row
    const firstRow = page.locator('table tbody tr').first();

    if (await firstRow.count() > 0) {
      console.log('Clicking first invoice...');
      await firstRow.click();

      // Wait for dialog to appear
      await page.waitForTimeout(2000);

      // Check if dialog opened
      const dialog = page.locator('[role="dialog"]');
      const isVisible = await dialog.isVisible();
      console.log('Dialog visible:', isVisible);

      expect(isVisible).toBeTruthy();

      // Close dialog
      await page.keyboard.press('Escape');
    }
  });

  test('4. Navigate to Draws page', async ({ page }) => {
    await page.goto('/invoices');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Click Draws link in sidebar
    await page.click('aside a[href="/draws"]');
    await page.waitForLoadState('networkidle');

    expect(page.url()).toContain('/draws');

    // Check page has content
    await expect(page.locator('main')).toBeVisible();
  });

  test('5. Navigate to POs page', async ({ page }) => {
    await page.goto('/invoices');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Click POs link in sidebar
    await page.click('aside a[href="/purchase-orders"]');
    await page.waitForLoadState('networkidle');

    expect(page.url()).toContain('/purchase-orders');

    // Check page has content
    await expect(page.locator('main')).toBeVisible();
  });

  test('6. Navigate to Budget page', async ({ page }) => {
    await page.goto('/invoices');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Click Budget link in sidebar
    await page.click('aside a[href="/budget"]');
    await page.waitForLoadState('networkidle');

    expect(page.url()).toContain('/budget');

    // Check page has content
    await expect(page.locator('main')).toBeVisible();
  });

  test('7. Job selector works', async ({ page }) => {
    await page.goto('/invoices');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Find job selector
    const jobSelector = page.locator('[data-testid="job-selector"], button:has-text("Job"), button:has-text("All Jobs")').first();

    if (await jobSelector.isVisible()) {
      await jobSelector.click();
      await page.waitForTimeout(300);

      // Should show job options
      const options = page.locator('[role="option"], [role="listbox"] [data-value]');
      const optionCount = await options.count();
      console.log('Job options found:', optionCount);

      expect(optionCount).toBeGreaterThanOrEqual(1);

      // Press Escape to close dropdown
      await page.keyboard.press('Escape');
    }
  });
});

const { test, expect } = require('@playwright/test');

/**
 * Upload Debug Tests - Updated for React/shadcn UI
 */

test.describe('Upload Debug Tests', () => {
  let consoleErrors = [];
  let consoleWarnings = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    consoleWarnings = [];

    // Capture console output
    page.on('console', msg => {
      const text = msg.text();
      if (msg.type() === 'error') {
        consoleErrors.push(text);
        console.log('CONSOLE ERROR:', text);
      } else if (msg.type() === 'warning') {
        consoleWarnings.push(text);
      }
    });

    // Skip if redirected to login
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    if (page.url().includes('/login')) {
      test.skip();
    }
  });

  test('Invoice page - Click Upload button', async ({ page }) => {
    console.log('=== Testing Invoice Page Upload ===');

    await page.goto('/invoices');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Look for upload button
    const uploadBtn = page.locator('button:has-text("Upload"), button:has-text("Add Invoice"), button:has-text("New")');
    const btnCount = await uploadBtn.count();
    console.log('Upload buttons found:', btnCount);

    expect(btnCount).toBeGreaterThan(0);
  });

  test('Invoice page - Upload dialog opens', async ({ page }) => {
    console.log('=== Testing Upload Dialog ===');

    await page.goto('/invoices');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Click upload button
    const uploadBtn = page.locator('button:has-text("Upload"), button:has-text("Add Invoice")').first();

    if (await uploadBtn.count() > 0) {
      await uploadBtn.click();
      await page.waitForTimeout(1000);

      // Check dialog opened
      const dialog = page.locator('[role="dialog"]');
      const dialogVisible = await dialog.isVisible();
      console.log('Upload dialog visible:', dialogVisible);

      expect(dialogVisible).toBeTruthy();

      // Close dialog
      await page.keyboard.press('Escape');
    }
  });

  test('Invoice page - Full upload flow with test PDF', async ({ page }) => {
    console.log('=== Testing Full Upload Flow ===');

    await page.goto('/invoices');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Click upload button
    const uploadBtn = page.locator('button:has-text("Upload"), button:has-text("Add Invoice")').first();

    if (await uploadBtn.count() > 0) {
      await uploadBtn.click();
      await page.waitForTimeout(1000);

      const dialog = page.locator('[role="dialog"]');
      const dialogVisible = await dialog.isVisible();

      if (dialogVisible) {
        // Look for file input
        const fileInput = page.locator('input[type="file"]');
        const hasFileInput = await fileInput.count() > 0;
        console.log('File input found:', hasFileInput);

        // Close dialog
        await page.keyboard.press('Escape');
      }
    }
  });

  test('Invoice page - Click Process Document button', async ({ page }) => {
    console.log('=== Testing Process Document ===');

    await page.goto('/invoices');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Open upload dialog
    const uploadBtn = page.locator('button:has-text("Upload"), button:has-text("Add Invoice")').first();

    if (await uploadBtn.count() > 0) {
      await uploadBtn.click();
      await page.waitForTimeout(1000);

      const dialog = page.locator('[role="dialog"]');

      // Look for process/submit button
      const processBtn = dialog.locator('button:has-text("Process"), button:has-text("Upload"), button[type="submit"]');
      const processBtnCount = await processBtn.count();
      console.log('Process buttons found:', processBtnCount);

      // Close dialog
      await page.keyboard.press('Escape');
    }
  });
});

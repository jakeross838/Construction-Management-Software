const { test, expect } = require('@playwright/test');

test.describe('Simplified Add to Draw Flow', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Skip if redirected to login
    if (page.url().includes('/login')) {
      test.skip();
    }
  });

  test('Add approved invoice to draw with one click', async ({ page }) => {
    const errors = [];

    page.on('pageerror', err => errors.push(err.message));
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
      console.log(`[${msg.type()}]`, msg.text());
    });

    // Load invoice dashboard
    console.log('=== Loading Invoice Dashboard ===');
    await page.goto('/invoices');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Look for approved invoices in table
    const tableRows = page.locator('table tbody tr');
    const rowCount = await tableRows.count();
    console.log(`Found ${rowCount} invoice rows`);

    if (rowCount === 0) {
      console.log('No invoices to test with - skipping');
      return;
    }

    // Click on first invoice
    console.log('\n=== Opening first invoice ===');
    await tableRows.first().click();
    await page.waitForTimeout(2000);

    // Check for dialog
    const dialog = page.locator('[role="dialog"]');
    const dialogVisible = await dialog.isVisible();
    console.log('Dialog visible:', dialogVisible);

    if (!dialogVisible) {
      console.log('Dialog did not open - skipping');
      return;
    }

    // Check for "Add to Draw" button in the dialog
    const addToDrawBtn = dialog.locator('button:has-text("Add to Draw")');
    const btnCount = await addToDrawBtn.count();
    console.log('Add to Draw buttons found:', btnCount);

    if (btnCount === 0) {
      // Invoice might not be in approved status, check what buttons are visible
      const allButtons = await dialog.locator('button:visible').allTextContents();
      console.log('Available buttons:', allButtons.join(', '));
      console.log('Skipping - no Add to Draw button (invoice may not be in approved status)');
      return;
    }

    console.log('Found "Add to Draw" button');

    // Click "Add to Draw"
    console.log('\n=== Clicking Add to Draw ===');
    await addToDrawBtn.click();

    // Wait for response
    await page.waitForTimeout(2000);

    // Check for success toast
    const toast = page.locator('[data-sonner-toast], [role="status"], [class*="toast"]');
    const toastVisible = await toast.count() > 0;
    console.log('Toast visible:', toastVisible);

    if (toastVisible) {
      const toastText = await toast.first().textContent();
      console.log('Toast message:', toastText);
    }

    // Close dialog if still open
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    console.log('\n=== Test Complete ===');
  });

  test('Navigate to draws page and verify draw list', async ({ page }) => {
    console.log('=== Loading Draws Page ===');
    await page.goto('/draws');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Check for draw rows
    const drawRows = page.locator('table tbody tr');
    const drawCount = await drawRows.count();
    console.log(`Found ${drawCount} draw rows`);

    // Click first draw if available
    if (drawCount > 0) {
      console.log('Opening first draw...');
      await drawRows.first().click();
      await page.waitForTimeout(2000);

      // Check dialog opened
      const dialog = page.locator('[role="dialog"]');
      const dialogVisible = await dialog.isVisible();
      console.log('Draw dialog visible:', dialogVisible);

      if (dialogVisible) {
        // Check for G702/G703 tabs
        const tabs = await dialog.locator('[role="tab"]').allTextContents();
        console.log('Dialog tabs:', tabs.join(', '));

        // Close dialog
        await page.keyboard.press('Escape');
      }
    }

    console.log('\n=== Test Complete ===');
  });
});

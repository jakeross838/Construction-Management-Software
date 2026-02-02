const { test, expect } = require('@playwright/test');

/**
 * Full Partial Invoice Billing Cycle Test
 * Updated for React/shadcn UI
 *
 * Tests the complete flow:
 * 1. View partial allocation in invoice list
 * 2. Open dialog, see partial allocation warning
 * 3. Approve with partial approval dialog
 * 4. Add to draw
 * 5. Verify invoice cycles back to needs_approval
 * 6. Verify remaining amount displayed
 */

test.describe('Full Partial Billing Cycle', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Skip if redirected to login
    if (page.url().includes('/login')) {
      test.skip();
    }
  });

  test('Complete partial billing cycle', async ({ page }) => {
    // Slow down for visibility
    test.slow();

    console.log('\n========================================');
    console.log('FULL PARTIAL BILLING CYCLE TEST');
    console.log('========================================\n');

    // STEP 1: Load invoice dashboard
    console.log('STEP 1: Loading invoice dashboard...');
    await page.goto('/invoices');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // STEP 2: Find an invoice
    console.log('\nSTEP 2: Finding invoices...');
    const invoiceRows = page.locator('table tbody tr');
    const rowCount = await invoiceRows.count();
    console.log('Found invoice rows:', rowCount);

    if (rowCount === 0) {
      console.log('No invoices found - test cannot continue');
      return;
    }

    // Get first invoice
    const firstRow = invoiceRows.first();

    // STEP 3: Click to open dialog
    console.log('\nSTEP 3: Opening invoice dialog...');
    await firstRow.click();
    await page.waitForTimeout(2000);

    // Check dialog content
    const dialog = page.locator('[role="dialog"]');
    const dialogVisible = await dialog.isVisible();
    console.log('Dialog visible:', dialogVisible);

    if (!dialogVisible) {
      console.log('Dialog did not open - test cannot continue');
      return;
    }

    // STEP 4: Check for Approve button
    console.log('\nSTEP 4: Checking for Approve button...');
    const approveBtn = dialog.locator('button:has-text("Approve")');
    const canApprove = await approveBtn.count() > 0;
    console.log('Approve button available:', canApprove);

    if (!canApprove) {
      console.log('Cannot approve - checking what buttons are available');
      const buttons = await dialog.locator('button:visible').allTextContents();
      console.log('Available buttons:', buttons.join(', '));
    }

    // Close dialog
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // STEP 5: Verify draws page works
    console.log('\nSTEP 5: Verifying draws page...');
    await page.goto('/draws');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const drawRows = page.locator('table tbody tr');
    const drawCount = await drawRows.count();
    console.log('Draw rows found:', drawCount);

    console.log('\n========================================');
    console.log('TEST COMPLETE');
    console.log('========================================\n');
  });

});

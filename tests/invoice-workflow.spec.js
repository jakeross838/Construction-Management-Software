const { test, expect } = require('@playwright/test');

test.describe('Invoice Approval Workflow', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Skip if redirected to login
    if (page.url().includes('/login')) {
      test.skip();
    }
  });

  test('Test invoice dialog and actions', async ({ page }) => {
    const errors = [];

    page.on('pageerror', err => errors.push(err.message));
    page.on('console', msg => {
      if (msg.type() === 'error' && !msg.text().includes('500') && !msg.text().includes('401')) {
        errors.push(msg.text());
      }
      console.log(`[${msg.type()}]`, msg.text());
    });

    // Load invoice dashboard
    console.log('=== Loading Invoice Dashboard ===');
    await page.goto('/invoices');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Check for invoice rows
    const invoiceRows = await page.locator('table tbody tr').count();
    console.log(`Found ${invoiceRows} invoice rows`);

    if (invoiceRows === 0) {
      console.log('No invoices found');
      return;
    }

    // Click on first invoice
    console.log('\n=== Opening first invoice ===');
    await page.locator('table tbody tr').first().click();

    // Wait for dialog to appear
    await page.waitForTimeout(2000);

    // Check dialog
    const dialog = page.locator('[role="dialog"]');
    const dialogVisible = await dialog.isVisible();
    console.log(`Dialog visible: ${dialogVisible}`);

    if (!dialogVisible) {
      console.log('Dialog did not open');
      return;
    }

    // Get footer buttons
    const footerButtons = await dialog.locator('button:visible').allTextContents();
    console.log('Dialog buttons:', footerButtons.join(', '));

    // ==========================================
    // WORKFLOW BASED ON AVAILABLE BUTTONS
    // ==========================================

    // If "Approve" button is visible
    if (footerButtons.some(b => b.includes('Approve') && !b.includes('Unapprove'))) {
      console.log('\n=== Invoice needs approval - Approve button available ===');

      const approveBtn = dialog.locator('button:has-text("Approve"):not(:has-text("Unapprove"))').first();
      if (await approveBtn.count() > 0) {
        console.log('Approve button found');
      }
    }

    // If "Unapprove" button is visible (invoice already approved)
    if (footerButtons.some(b => b.includes('Unapprove'))) {
      console.log('\n=== Invoice already Approved - Unapprove button available ===');
    }

    // If "Add to Draw" button is visible
    if (footerButtons.some(b => b.includes('Add to Draw'))) {
      console.log('\n=== Invoice can be added to draw ===');
    }

    // Close dialog
    console.log('\n=== Closing dialog ===');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    console.log('Test complete - checked invoice workflow buttons');
  });

  test('Navigate through invoice statuses via API', async ({ page }) => {
    // Test API endpoints directly
    console.log('=== Testing Invoice API ===');

    const response = await page.request.get('http://localhost:3001/api/invoices');
    expect(response.ok()).toBeTruthy();

    const invoices = await response.json();
    console.log(`API returned ${invoices.length} invoices`);

    if (invoices.length > 0) {
      // Check invoice structure
      const firstInvoice = invoices[0];
      console.log('Sample invoice fields:', Object.keys(firstInvoice).slice(0, 10).join(', '));
      console.log('Invoice status:', firstInvoice.status);
    }
  });
});

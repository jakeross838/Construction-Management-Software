const { test, expect } = require('@playwright/test');

test.describe('PO Dialog Visual Test', () => {
  test('Capture confirm dialog screenshots', async ({ page }) => {
    const errors = [];

    page.on('pageerror', err => errors.push(err.message));
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    console.log('=== Loading PO page ===');
    await page.goto('http://localhost:3001/pos.html?cachebust=' + Date.now());
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const poRows = await page.locator('.po-row').count();
    console.log(`Found ${poRows} POs`);

    if (poRows === 0) {
      console.log('No POs found');
      return;
    }

    // Open PO modal
    console.log('Opening PO modal...');
    await page.locator('.po-row').first().click();
    await page.waitForTimeout(1500);

    // Get current status
    const statusBadge = await page.locator('#poModal .status-badge').first().textContent();
    console.log(`PO Status: ${statusBadge}`);

    // Check available buttons
    const buttons = await page.locator('#poModalFooter button').allTextContents();
    console.log('Available buttons:', buttons.join(', '));

    // Test Send to Vendor if available
    if (buttons.includes('Send to Vendor')) {
      console.log('\n=== Testing Send to Vendor Dialog ===');
      await page.locator('button:has-text("Send to Vendor")').click();

      // Wait for dialog to appear
      await page.waitForSelector('#confirmDialog[style*="flex"]', { timeout: 3000 });
      await page.waitForTimeout(300);

      console.log('Dialog appeared - taking screenshot');
      await page.screenshot({ path: 'tests/screenshots/confirm-dialog-send.png', fullPage: true });

      // Check dialog content
      const title = await page.locator('#confirmTitle').textContent();
      const message = await page.locator('#confirmMessage').textContent();
      const btnText = await page.locator('#confirmBtn').textContent();
      console.log(`Title: "${title}"`);
      console.log(`Message: "${message}"`);
      console.log(`Button: "${btnText}"`);

      // Cancel
      await page.locator('#confirmDialog button:has-text("Cancel")').click();
      await page.waitForTimeout(500);
    }

    // Test Delete if available
    if (buttons.includes('Delete')) {
      console.log('\n=== Testing Delete Dialog ===');
      await page.locator('button:has-text("Delete")').click();

      await page.waitForSelector('#confirmDialog[style*="flex"]', { timeout: 3000 });
      await page.waitForTimeout(300);

      await page.screenshot({ path: 'tests/screenshots/confirm-dialog-delete.png', fullPage: true });

      await page.locator('#confirmDialog button:has-text("Cancel")').click();
      await page.waitForTimeout(500);
    }

    // Test Void if available
    if (buttons.includes('Void')) {
      console.log('\n=== Testing Void Dialog (with input) ===');
      await page.locator('button:has-text("Void")').click();

      await page.waitForSelector('#confirmDialog[style*="flex"]', { timeout: 3000 });
      await page.waitForTimeout(300);

      // Check if input field is visible
      const inputVisible = await page.locator('#confirmInput').isVisible();
      console.log(`Input field visible: ${inputVisible}`);

      await page.screenshot({ path: 'tests/screenshots/confirm-dialog-void.png', fullPage: true });

      await page.locator('#confirmDialog button:has-text("Cancel")').click();
      await page.waitForTimeout(500);
    }

    // Test Approve if available
    if (buttons.includes('Approve')) {
      console.log('\n=== Testing Approve Dialog ===');
      await page.locator('button:has-text("Approve")').click();

      await page.waitForSelector('#confirmDialog[style*="flex"]', { timeout: 3000 });
      await page.waitForTimeout(300);

      await page.screenshot({ path: 'tests/screenshots/confirm-dialog-approve.png', fullPage: true });

      await page.locator('#confirmDialog button:has-text("Cancel")').click();
      await page.waitForTimeout(500);
    }

    console.log('\n=== Summary ===');
    if (errors.length > 0) {
      console.log('Errors found:');
      errors.forEach(e => console.log('  -', e));
    } else {
      console.log('No errors');
    }

    expect(errors).toHaveLength(0);
  });
});

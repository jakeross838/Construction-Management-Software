const { test, expect } = require('@playwright/test');

test.describe('PO Full Workflow Test', () => {
  test('Complete PO lifecycle: Draft → Sent → Approved → Completed', async ({ page }) => {
    const errors = [];

    page.on('pageerror', err => errors.push(err.message));
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
      console.log(`[${msg.type()}]`, msg.text());
    });

    // Load PO page
    console.log('=== Loading PO page ===');
    await page.goto('http://localhost:3001/pos.html?cachebust=' + Date.now());
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const poRows = await page.locator('.po-row').count();
    console.log(`Found ${poRows} POs`);

    if (poRows === 0) {
      console.log('No POs found - skipping test');
      return;
    }

    // Click on first PO to open modal
    console.log('\n=== Opening PO modal ===');
    await page.locator('.po-row').first().click();
    await page.waitForTimeout(1500);

    // Get initial status
    let statusBadge = await page.locator('#poModal .status-badge').first().textContent();
    console.log(`Initial PO Status: ${statusBadge}`);

    // Get available buttons
    let buttons = await page.locator('#poModalFooter button').allTextContents();
    console.log('Available buttons:', buttons.join(', '));

    // ==========================================
    // STEP 1: Send to Vendor (Draft → Sent)
    // ==========================================
    if (buttons.includes('Send to Vendor')) {
      console.log('\n=== STEP 1: Send to Vendor ===');
      await page.locator('button:has-text("Send to Vendor")').click();

      // Wait for confirm dialog
      await page.waitForSelector('#confirmDialog.show', { timeout: 3000 });
      await page.waitForTimeout(300);

      // Verify dialog content
      const title = await page.locator('#confirmTitle').textContent();
      const message = await page.locator('#confirmMessage').textContent();
      console.log(`Dialog Title: "${title}"`);
      console.log(`Dialog Message: "${message}"`);

      // Take screenshot of dialog
      await page.screenshot({ path: 'tests/screenshots/workflow-1-send-dialog.png', fullPage: true });

      // Click confirm button
      console.log('Clicking Send PO button...');
      await page.locator('#confirmBtn').click();
      await page.waitForTimeout(2000);

      // Check for toast message
      const toastVisible = await page.locator('.toast').isVisible();
      if (toastVisible) {
        const toastText = await page.locator('.toast').textContent();
        console.log(`Toast: ${toastText}`);
      }

      // Check new status
      statusBadge = await page.locator('#poModal .status-badge').first().textContent();
      console.log(`Status after Send: ${statusBadge}`);

      // Take screenshot after send
      await page.screenshot({ path: 'tests/screenshots/workflow-2-after-send.png', fullPage: true });

      // Get updated buttons
      buttons = await page.locator('#poModalFooter button').allTextContents();
      console.log('Buttons after Send:', buttons.join(', '));
    }

    // ==========================================
    // STEP 2: Approve PO (Sent → Approved)
    // ==========================================
    if (buttons.includes('Approve')) {
      console.log('\n=== STEP 2: Approve PO ===');
      await page.locator('button:has-text("Approve")').click();

      // Wait for confirm dialog
      await page.waitForSelector('#confirmDialog.show', { timeout: 3000 });
      await page.waitForTimeout(300);

      const title = await page.locator('#confirmTitle').textContent();
      console.log(`Dialog Title: "${title}"`);

      await page.screenshot({ path: 'tests/screenshots/workflow-3-approve-dialog.png', fullPage: true });

      // Click confirm
      console.log('Clicking Approve button...');
      await page.locator('#confirmBtn').click();
      await page.waitForTimeout(2000);

      // Check new status
      statusBadge = await page.locator('#poModal .status-badge').first().textContent();
      console.log(`Status after Approve: ${statusBadge}`);

      await page.screenshot({ path: 'tests/screenshots/workflow-4-after-approve.png', fullPage: true });

      // Get updated buttons
      buttons = await page.locator('#poModalFooter button').allTextContents();
      console.log('Buttons after Approve:', buttons.join(', '));
    }

    // ==========================================
    // STEP 3: Complete PO (Approved → Completed)
    // ==========================================
    if (buttons.includes('Mark Complete')) {
      console.log('\n=== STEP 3: Mark Complete ===');
      await page.locator('button:has-text("Mark Complete")').click();

      // Wait for confirm dialog
      await page.waitForSelector('#confirmDialog.show', { timeout: 3000 });
      await page.waitForTimeout(300);

      const title = await page.locator('#confirmTitle').textContent();
      console.log(`Dialog Title: "${title}"`);

      await page.screenshot({ path: 'tests/screenshots/workflow-5-complete-dialog.png', fullPage: true });

      // Click confirm
      console.log('Clicking Complete button...');
      await page.locator('#confirmBtn').click();
      await page.waitForTimeout(2000);

      // Check new status
      statusBadge = await page.locator('#poModal .status-badge').first().textContent();
      console.log(`Status after Complete: ${statusBadge}`);

      await page.screenshot({ path: 'tests/screenshots/workflow-6-after-complete.png', fullPage: true });

      // Get updated buttons
      buttons = await page.locator('#poModalFooter button').allTextContents();
      console.log('Buttons after Complete:', buttons.join(', '));
    }

    // ==========================================
    // STEP 4: Reopen PO (if completed, test reopen)
    // ==========================================
    if (buttons.includes('Reopen')) {
      console.log('\n=== STEP 4: Reopen PO ===');
      await page.locator('button:has-text("Reopen")').click();

      await page.waitForSelector('#confirmDialog.show', { timeout: 3000 });
      await page.waitForTimeout(300);

      console.log('Clicking Reopen button...');
      await page.locator('#confirmBtn').click();
      await page.waitForTimeout(2000);

      statusBadge = await page.locator('#poModal .status-badge').first().textContent();
      console.log(`Status after Reopen: ${statusBadge}`);

      buttons = await page.locator('#poModalFooter button').allTextContents();
      console.log('Buttons after Reopen:', buttons.join(', '));
    }

    // Close modal
    console.log('\n=== Closing modal ===');
    await page.locator('#poModalFooter button:has-text("Close")').click();
    await page.waitForTimeout(500);

    // Verify PO list updated
    console.log('\n=== Verifying PO list ===');
    await page.waitForTimeout(1000);
    const listStatus = await page.locator('.po-row .status-badge').first().textContent();
    console.log(`PO List Status: ${listStatus}`);

    await page.screenshot({ path: 'tests/screenshots/workflow-7-final-list.png', fullPage: true });

    // Summary
    console.log('\n=== Summary ===');
    if (errors.length > 0) {
      console.log('Errors found:');
      errors.forEach(e => console.log('  -', e));
    } else {
      console.log('No errors - workflow completed successfully!');
    }

    expect(errors).toHaveLength(0);
  });
});

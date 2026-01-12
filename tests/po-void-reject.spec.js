const { test, expect } = require('@playwright/test');

test.describe('PO Void and Reject Tests', () => {
  test('Test Void PO workflow', async ({ page }) => {
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

    // Find a PO that's in Sent or Approved status (has Void button)
    const poRows = await page.locator('.po-row').count();
    console.log(`Found ${poRows} POs`);

    if (poRows === 0) {
      console.log('No POs found - skipping test');
      return;
    }

    // Click on first PO
    console.log('\n=== Opening PO modal ===');
    await page.locator('.po-row').first().click();
    await page.waitForTimeout(1500);

    let statusBadge = await page.locator('#poModal .status-badge').first().textContent();
    let buttons = await page.locator('#poModalFooter button').allTextContents();
    console.log(`Status: ${statusBadge}`);
    console.log('Buttons:', buttons.join(', '));

    // If PO is in Draft, send it first so we can test Void
    if (buttons.includes('Send to Vendor')) {
      console.log('\n=== Sending PO to Vendor first ===');
      await page.locator('button:has-text("Send to Vendor")').click();
      await page.waitForSelector('#confirmDialog.show', { timeout: 3000 });
      await page.locator('#confirmBtn').click();
      await page.waitForTimeout(2000);

      statusBadge = await page.locator('#poModal .status-badge').first().textContent();
      buttons = await page.locator('#poModalFooter button').allTextContents();
      console.log(`Status after send: ${statusBadge}`);
      console.log('Buttons after send:', buttons.join(', '));
    }

    // ==========================================
    // TEST VOID PO
    // ==========================================
    if (buttons.includes('Void')) {
      console.log('\n=== Testing Void PO ===');
      await page.locator('button:has-text("Void")').click();

      // Wait for confirm dialog with input field
      await page.waitForSelector('#confirmDialog.show', { timeout: 3000 });
      await page.waitForTimeout(300);

      // Check dialog content
      const title = await page.locator('#confirmTitle').textContent();
      const message = await page.locator('#confirmMessage').textContent();
      console.log(`Dialog Title: "${title}"`);
      console.log(`Dialog Message: "${message}"`);

      // Check if input field is visible (void requires reason)
      const inputVisible = await page.locator('#confirmInput').isVisible();
      console.log(`Input field visible: ${inputVisible}`);

      // Take screenshot
      await page.screenshot({ path: 'tests/screenshots/void-dialog.png', fullPage: true });

      // Try to submit without reason (should fail validation)
      console.log('Testing validation - clicking without reason...');
      await page.locator('#confirmBtn').click();
      await page.waitForTimeout(500);

      // Dialog should still be open
      const dialogStillOpen = await page.locator('#confirmDialog.show').isVisible();
      console.log(`Dialog still open (expected): ${dialogStillOpen}`);

      // Now enter a reason and submit
      console.log('Entering reason and submitting...');
      await page.locator('#confirmInputField').fill('Testing void functionality');
      await page.locator('#confirmBtn').click();
      await page.waitForTimeout(2000);

      // Check new status
      statusBadge = await page.locator('#poModal .status-badge').first().textContent();
      console.log(`Status after Void: ${statusBadge}`);

      await page.screenshot({ path: 'tests/screenshots/after-void.png', fullPage: true });

      buttons = await page.locator('#poModalFooter button').allTextContents();
      console.log('Buttons after Void:', buttons.join(', '));

      // Voided PO should show "Voided" status
      expect(statusBadge).toBe('Voided');
    } else {
      console.log('Void button not available - PO may already be voided or completed');
    }

    // Close modal
    await page.locator('#poModalFooter button:has-text("Close")').click();
    await page.waitForTimeout(500);

    console.log('\n=== Summary ===');
    if (errors.length > 0) {
      console.log('Errors found:');
      errors.forEach(e => console.log('  -', e));
    } else {
      console.log('No errors');
    }

    expect(errors).toHaveLength(0);
  });

  test('Test Reject PO workflow', async ({ page }) => {
    const errors = [];

    page.on('pageerror', err => errors.push(err.message));
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
      console.log(`[${msg.type()}]`, msg.text());
    });

    // First create a new PO in draft status via API
    console.log('=== Creating new PO for reject test ===');
    const createRes = await fetch('http://localhost:3001/api/purchase-orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        job_id: 'd8a914c9-b861-4a4f-b888-75887b1570c4',
        vendor_id: 'c2af2cbb-78ed-4d76-9bd7-b9b14ed0dae2',
        po_number: 'PO-Reject-Test-' + Date.now(),
        description: 'Test PO for rejection',
        total_amount: 1000,
        line_items: [{
          description: 'Test item',
          amount: 1000,
          cost_code_id: '85dcae86-c484-4cc5-b9dd-cf860818b961'
        }]
      })
    });
    const newPO = await createRes.json();
    console.log(`Created PO: ${newPO.id}`);

    // Send the PO so it can be rejected
    console.log('=== Sending PO to vendor ===');
    await fetch(`http://localhost:3001/api/purchase-orders/${newPO.id}/send`, {
      method: 'POST'
    });

    // Load PO page
    console.log('\n=== Loading PO page ===');
    await page.goto('http://localhost:3001/pos.html?cachebust=' + Date.now());
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Find our test PO
    const testPORow = page.locator(`.po-row:has-text("PO-Reject-Test")`).first();
    const exists = await testPORow.count() > 0;

    if (!exists) {
      console.log('Test PO not found in list');
      return;
    }

    console.log('\n=== Opening test PO modal ===');
    await testPORow.click();
    await page.waitForTimeout(1500);

    let statusBadge = await page.locator('#poModal .status-badge').first().textContent();
    let buttons = await page.locator('#poModalFooter button').allTextContents();
    console.log(`Status: ${statusBadge}`);
    console.log('Buttons:', buttons.join(', '));

    // ==========================================
    // TEST REJECT PO
    // ==========================================
    // Note: Reject might be shown as part of approval workflow
    // Check if there's a Reject button or if we need to look elsewhere

    if (buttons.some(b => b.toLowerCase().includes('reject'))) {
      console.log('\n=== Testing Reject PO ===');
      await page.locator('button:has-text("Reject")').click();

      // Wait for confirm dialog with input field
      await page.waitForSelector('#confirmDialog.show', { timeout: 3000 });
      await page.waitForTimeout(300);

      const title = await page.locator('#confirmTitle').textContent();
      console.log(`Dialog Title: "${title}"`);

      // Check if input field is visible (reject requires reason)
      const inputVisible = await page.locator('#confirmInput').isVisible();
      console.log(`Input field visible: ${inputVisible}`);

      await page.screenshot({ path: 'tests/screenshots/reject-dialog.png', fullPage: true });

      // Enter reason and submit
      console.log('Entering rejection reason...');
      await page.locator('#confirmInputField').fill('Testing reject functionality');
      await page.locator('#confirmBtn').click();
      await page.waitForTimeout(2000);

      // Check new status
      statusBadge = await page.locator('#poModal .status-badge').first().textContent();
      console.log(`Status after Reject: ${statusBadge}`);

      await page.screenshot({ path: 'tests/screenshots/after-reject.png', fullPage: true });

      expect(statusBadge).toBe('Rejected');
    } else {
      console.log('Reject button not available');
      console.log('Available buttons:', buttons.join(', '));
    }

    // Clean up - delete the test PO
    console.log('\n=== Cleaning up test PO ===');
    await page.locator('#poModalFooter button:has-text("Close")').click();

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

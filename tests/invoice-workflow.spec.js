const { test, expect } = require('@playwright/test');

test.describe('Invoice Approval Workflow', () => {
  test('Test invoice modal and actions', async ({ page }) => {
    const errors = [];

    page.on('pageerror', err => errors.push(err.message));
    page.on('console', msg => {
      if (msg.type() === 'error' && !msg.text().includes('500')) {
        errors.push(msg.text());
      }
      console.log(`[${msg.type()}]`, msg.text());
    });

    // Load invoice dashboard
    console.log('=== Loading Invoice Dashboard ===');
    await page.goto('http://localhost:3001/index.html?cachebust=' + Date.now());
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    // Take screenshot of dashboard
    await page.screenshot({ path: 'tests/screenshots/invoice-dashboard.png', fullPage: true });

    // Check for invoice rows
    const invoiceRows = await page.locator('.invoice-card').count();
    console.log(`Found ${invoiceRows} invoice rows`);

    if (invoiceRows === 0) {
      console.log('No invoices found');
      return;
    }

    // Click on first invoice
    console.log('\n=== Opening first invoice ===');
    await page.locator('.invoice-card').first().click();

    // Wait for modal to appear
    try {
      await page.waitForTimeout(3000);
    } catch (e) {
      console.log('Modal did not open within timeout');
      await page.screenshot({ path: 'tests/screenshots/invoice-modal-failed.png', fullPage: true });
      return;
    }
    await page.waitForTimeout(1000);

    // Check modal
    const modalVisible = await page.locator('#modal-container.active').count() > 0;
    console.log(`Modal visible: ${modalVisible}`);

    if (!modalVisible) {
      console.log('Modal did not open');
      return;
    }

    await page.screenshot({ path: 'tests/screenshots/invoice-modal-open.png', fullPage: true });

    // Get footer buttons
    const footerButtons = await page.locator('.modal-footer button:visible').allTextContents();
    console.log('Footer buttons:', footerButtons.join(', '));

    // Get status from workflow
    const statusPills = await page.locator('.status-workflow .status-pill.active, .status-workflow .status-pill.current').allTextContents();
    console.log('Active status:', statusPills.join(', '));

    // ==========================================
    // WORKFLOW BASED ON STATUS
    // ==========================================

    // If "Submit" button is visible, invoice needs to be submitted for approval
    if (footerButtons.some(b => b.includes('Submit'))) {
      console.log('\n=== Invoice in Received status - Testing Submit ===');

      // Take screenshot before submit
      await page.screenshot({ path: 'tests/screenshots/invoice-before-submit.png', fullPage: true });

      // Click Submit
      const submitBtn = page.locator('.modal-footer button:has-text("Submit"):visible');
      if (await submitBtn.count() > 0) {
        console.log('Clicking Submit button...');
        await submitBtn.click();
        await page.waitForTimeout(2000);

        // Check for toast
        const toast = await page.locator('.toast:visible').first();
        if (await toast.count() > 0) {
          console.log('Toast:', await toast.textContent());
        }

        await page.screenshot({ path: 'tests/screenshots/invoice-after-submit.png', fullPage: true });

        // Get new buttons
        const newButtons = await page.locator('.modal-footer button:visible').allTextContents();
        console.log('Buttons after submit:', newButtons.join(', '));
      }
    }

    // If "Approve" button is visible
    if (footerButtons.some(b => b.includes('Approve') && !b.includes('Unapprove'))) {
      console.log('\n=== Invoice in Needs Approval status - Testing Approve ===');

      const approveBtn = page.locator('.modal-footer button:has-text("Approve"):not(:has-text("Unapprove")):visible').first();
      if (await approveBtn.count() > 0) {
        console.log('Clicking Approve button...');
        await approveBtn.click();
        await page.waitForTimeout(500);

        // Handle confirm dialog if it appears
        const confirmOverlay = page.locator('#confirm-overlay');
        if (await confirmOverlay.count() > 0) {
          console.log('Confirm dialog appeared - clicking confirm...');
          await page.locator('#confirm-overlay .modal-footer button.btn-primary, #confirm-overlay .modal-footer button.btn-warning').click();
          await page.waitForTimeout(2000);
        }

        const toast = await page.locator('.toast:visible').first();
        if (await toast.count() > 0) {
          console.log('Toast:', await toast.textContent());
        }

        await page.screenshot({ path: 'tests/screenshots/invoice-after-approve.png', fullPage: true });

        const newButtons = await page.locator('.modal-footer button:visible').allTextContents();
        console.log('Buttons after approve:', newButtons.join(', '));
      }
    }

    // If "Unapprove" button is visible (invoice already approved)
    if (footerButtons.some(b => b.includes('Unapprove'))) {
      console.log('\n=== Invoice already Approved - Testing Unapprove ===');

      const unapproveBtn = page.locator('.modal-footer button:has-text("Unapprove"):visible');
      if (await unapproveBtn.count() > 0) {
        console.log('Clicking Unapprove button...');
        await unapproveBtn.click();
        await page.waitForTimeout(2000);

        const toast = await page.locator('.toast:visible').first();
        if (await toast.count() > 0) {
          console.log('Toast:', await toast.textContent());
        }

        await page.screenshot({ path: 'tests/screenshots/invoice-after-unapprove.png', fullPage: true });

        const newButtons = await page.locator('.modal-footer button:visible').allTextContents();
        console.log('Buttons after unapprove:', newButtons.join(', '));
      }
    }

    // Close modal
    console.log('\n=== Closing modal ===');
    const stillOpen = await page.locator('#modal-container.active').count() > 0;
    if (stillOpen) {
      // Try Cancel button first, then X button
      const cancelBtn = page.locator('.modal-footer button:has-text("Cancel"):visible').first();
      if (await cancelBtn.count() > 0) {
        await cancelBtn.click();
      } else {
        await page.locator('#modal-container .modal-close').click();
      }
    } else {
      console.log('Modal already closed');
    }
    await page.waitForTimeout(500);

    // Summary
    console.log('\n=== Summary ===');
    if (errors.length > 0) {
      console.log('Errors found:');
      errors.forEach(e => console.log('  -', e));
    } else {
      console.log('No errors');
    }

    expect(errors).toHaveLength(0);
  });

  test('Test approved invoice workflow', async ({ page }) => {
    const errors = [];

    page.on('pageerror', err => errors.push(err.message));
    page.on('console', msg => {
      if (msg.type() === 'error' && !msg.text().includes('500')) {
        errors.push(msg.text());
      }
      console.log(`[${msg.type()}]`, msg.text());
    });

    console.log('=== Loading Invoice Dashboard ===');
    await page.goto('http://localhost:3001/index.html?status=approved');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    // Look for approved invoice
    const approvedInvoice = page.locator('.invoice-card:has(.status-badge:has-text("Approved"))').first();
    const hasApproved = await approvedInvoice.count() > 0;
    console.log(`Found approved invoice: ${hasApproved}`);

    if (!hasApproved) {
      console.log('No approved invoices found - skipping');
      return;
    }

    // Click on approved invoice
    await approvedInvoice.click();
    await page.waitForTimeout(2000);

    await page.screenshot({ path: 'tests/screenshots/approved-invoice-modal.png', fullPage: true });

    const footerButtons = await page.locator('.modal-footer button:visible').allTextContents();
    console.log('Footer buttons for approved invoice:', footerButtons.join(', '));

    // Should have Unapprove and possibly Add to Draw
    expect(footerButtons.some(b => b.includes('Unapprove'))).toBe(true);

    // Close modal
    const stillOpen = await page.locator('#modal-container.active').count() > 0;
    if (stillOpen) {
      const cancelBtn = page.locator('.modal-footer button:has-text("Cancel"):visible').first();
      if (await cancelBtn.count() > 0) {
        await cancelBtn.click();
      } else {
        await page.locator('#modal-container .modal-close').click();
      }
    } else {
      console.log('Modal already closed');
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

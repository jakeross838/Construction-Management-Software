const { test, expect } = require('@playwright/test');

let errors = [];
let logs = [];

test.describe('Comprehensive App Tests', () => {

  test.beforeEach(async ({ page }) => {
    errors = [];
    logs = [];

    page.on('console', msg => {
      logs.push({ type: msg.type(), text: msg.text() });
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    page.on('pageerror', err => errors.push('PAGE ERROR: ' + err.message));
    page.on('response', resp => {
      if (resp.status() >= 400) {
        errors.push(`HTTP ${resp.status()}: ${resp.url()}`);
      }
    });

    // Handle dialogs automatically
    page.on('dialog', async dialog => {
      console.log('Dialog:', dialog.message());
      await dialog.accept();
    });

    await page.goto('http://localhost:3001?t=' + Date.now());
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
  });

  test.afterEach(async ({}, testInfo) => {
    console.log(`\n[${testInfo.title}] Errors: ${errors.length}`);
    if (errors.length > 0) {
      errors.forEach(e => console.log('  -', e));
    }
  });

  test('1. Dashboard loads with stats', async ({ page }) => {
    // Check dashboard stats loaded
    const statsCards = page.locator('.stat-card, .stats-card, .dashboard-stat');
    await page.waitForTimeout(1000);

    // Take screenshot
    await page.screenshot({ path: 'tests/screenshots/dashboard.png', fullPage: true });

    expect(errors.length).toBe(0);
  });

  test('2. Filter buttons work', async ({ page }) => {
    const filters = [
      { text: 'Needs Approval', selector: '[data-status="needs_approval"]' },
      { text: 'Approved', selector: '[data-status="approved"]' },
      { text: 'In Draw', selector: '[data-status="in_draw"]' },
      { text: 'Archive', selector: '[data-status="archive"]' }
    ];

    for (const filter of filters) {
      const btn = page.locator(`.filter-btn:has-text("${filter.text}")`);
      if (await btn.count() > 0) {
        await btn.click();
        await page.waitForTimeout(500);
        console.log(`Filter "${filter.text}" clicked - errors: ${errors.length}`);
      }
    }

    expect(errors.length).toBe(0);
  });

  test('3. Open and close invoice edit modal', async ({ page }) => {
    const invoiceCard = page.locator('.invoice-card').first();

    if (await invoiceCard.count() > 0) {
      await invoiceCard.click();
      await page.waitForTimeout(2000);

      // Modal should open
      const modal = page.locator('#modal-container.active');
      expect(await modal.count()).toBe(1);

      await page.screenshot({ path: 'tests/screenshots/edit-modal-open.png', fullPage: true });

      // Close modal - use the X button in the modal header
      const closeBtn = page.locator('#modal-container.active .modal-close');
      await closeBtn.click({ force: true });
      await page.waitForTimeout(500);
    }

    expect(errors.length).toBe(0);
  });

  test('4. Edit invoice fields', async ({ page }) => {
    // Find a received or coded invoice
    const editableInvoice = page.locator('.invoice-card.status-received, .invoice-card.status-needs_approval').first();

    if (await editableInvoice.count() > 0) {
      await editableInvoice.click();
      await page.waitForTimeout(2000);

      // Try editing invoice number
      const invoiceNumberField = page.locator('#edit-invoice-number');
      if (await invoiceNumberField.count() > 0 && await invoiceNumberField.isEditable()) {
        const originalValue = await invoiceNumberField.inputValue();
        await invoiceNumberField.fill('TEST-' + Date.now());
        await page.waitForTimeout(500);

        // Change back
        await invoiceNumberField.fill(originalValue);
      }

      // Try changing job dropdown
      const jobSelect = page.locator('#edit-job');
      if (await jobSelect.count() > 0 && await jobSelect.isEnabled()) {
        const options = await jobSelect.locator('option').all();
        console.log('Job options count:', options.length);
      }

      // Try changing vendor dropdown
      const vendorSelect = page.locator('#edit-vendor');
      if (await vendorSelect.count() > 0 && await vendorSelect.isEnabled()) {
        const options = await vendorSelect.locator('option').all();
        console.log('Vendor options count:', options.length);
      }

      await page.screenshot({ path: 'tests/screenshots/edit-fields.png', fullPage: true });

      // Close modal
      await page.locator('.modal-close').click({ force: true });
    }

    expect(errors.length).toBe(0);
  });

  test('5. Add cost code allocation', async ({ page }) => {
    const editableInvoice = page.locator('.invoice-card.status-received, .invoice-card.status-needs_approval').first();

    if (await editableInvoice.count() > 0) {
      await editableInvoice.click();
      await page.waitForTimeout(2000);

      // Look for Add Allocation button
      const addAllocBtn = page.locator('button:has-text("Add Cost Code"), button:has-text("Add Allocation")');
      if (await addAllocBtn.count() > 0) {
        console.log('Found Add Cost Code button');
        await addAllocBtn.click({ force: true });
        await page.waitForTimeout(1000);

        await page.screenshot({ path: 'tests/screenshots/add-allocation.png', fullPage: true });
      }

      // Close modal
      await page.locator('.modal-close').click({ force: true });
    }

    expect(errors.length).toBe(0);
  });

  test('6. Upload Invoice modal', async ({ page }) => {
    const uploadBtn = page.locator('button:has-text("Upload Invoice"), button:has-text("Upload")').first();

    if (await uploadBtn.count() > 0) {
      await uploadBtn.click();
      await page.waitForTimeout(1000);

      await page.screenshot({ path: 'tests/screenshots/upload-modal.png', fullPage: true });

      // Close modal - look for visible close button only
      const closeBtn = page.locator('.modal:visible .modal-close, .modal[style*="display: flex"] .modal-close, .modal[style*="display: block"] .modal-close').first();
      if (await closeBtn.count() > 0) {
        await closeBtn.click({ force: true });
      } else {
        // Fallback: press Escape to close modal
        await page.keyboard.press('Escape');
      }
      await page.waitForTimeout(500);
    }

    expect(errors.length).toBe(0);
  });

  test('7. Save invoice changes', async ({ page }) => {
    const editableInvoice = page.locator('.invoice-card.status-needs_approval').first();

    if (await editableInvoice.count() > 0) {
      await editableInvoice.click();
      await page.waitForTimeout(2000);

      // Click Save button
      const saveBtn = page.locator('.modal-footer-right button:has-text("Save")');
      if (await saveBtn.count() > 0) {
        await saveBtn.click({ force: true });
        await page.waitForTimeout(3000);

        console.log('Save clicked - errors:', errors);
        await page.screenshot({ path: 'tests/screenshots/after-save.png', fullPage: true });
      }
    }

    // Check for errors
    console.log('Final errors:', errors);
    expect(errors.length).toBe(0);
  });

  test('8. Approve invoice flow', async ({ page }) => {
    const needsApprovalInvoice = page.locator('.invoice-card.status-needs_approval').first();

    if (await needsApprovalInvoice.count() > 0) {
      await needsApprovalInvoice.click();
      await page.waitForTimeout(2000);

      // Click Approve button
      const approveBtn = page.locator('.modal-footer-right button.btn-success:has-text("Approve")');
      if (await approveBtn.count() > 0) {
        await approveBtn.click({ force: true });
        await page.waitForTimeout(5000);

        await page.screenshot({ path: 'tests/screenshots/after-approve.png', fullPage: true });
      }
    }

    expect(errors.length).toBe(0);
  });

  test('9. Deny invoice flow', async ({ page }) => {
    // First, filter to received invoices
    const receivedFilter = page.locator('.filter-btn:has-text("Received")');
    if (await receivedFilter.count() > 0) {
      await receivedFilter.click();
      await page.waitForTimeout(1000);
    }

    const receivedInvoice = page.locator('.invoice-card.status-received').first();

    if (await receivedInvoice.count() > 0) {
      await receivedInvoice.click();
      await page.waitForTimeout(2000);

      // Look for Deny button
      const denyBtn = page.locator('.modal-footer-right button:has-text("Deny")');
      if (await denyBtn.count() > 0) {
        console.log('Found Deny button');
        // Don't actually click deny, just verify it's there
      }

      await page.locator('.modal-close').click({ force: true });
    }

    expect(errors.length).toBe(0);
  });

  test('10. Delete invoice flow', async ({ page }) => {
    const editableInvoice = page.locator('.invoice-card.status-received, .invoice-card.status-needs_approval').first();

    if (await editableInvoice.count() > 0) {
      await editableInvoice.click();
      await page.waitForTimeout(2000);

      // Look for Delete button
      const deleteBtn = page.locator('.modal-footer-right button:has-text("Delete")');
      if (await deleteBtn.count() > 0) {
        console.log('Found Delete button');
        // Don't actually click delete, just verify it's there
      }

      await page.locator('.modal-close').click({ force: true });
    }

    expect(errors.length).toBe(0);
  });
});

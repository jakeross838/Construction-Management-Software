const { test, expect } = require('@playwright/test');

test('PO line item picker in invoice modal', async ({ page }) => {
  await page.goto('http://localhost:3001/index.html?cachebust=' + Date.now());
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);

  // Click the invoice that has a PO (INV-105472 which is needs_approval)
  const invoiceWithPO = page.locator('.invoice-row:has-text("INV-105472"), .invoice-card:has-text("INV-105472"), .invoice-item:has-text("105472")');
  const foundCount = await invoiceWithPO.count();
  console.log('Invoice with PO found:', foundCount > 0);

  if (foundCount > 0) {
    await invoiceWithPO.first().click();
    await page.waitForTimeout(1500);

    // Check PO line item picker
    const poLineSelect = page.locator('.po-line-select');
    const selectExists = await poLineSelect.count() > 0;
    console.log('PO line select exists:', selectExists);

    if (selectExists) {
      // Get options
      const options = await poLineSelect.locator('option').allTextContents();
      console.log('PO line item options:');
      options.forEach((opt, i) => console.log('  ' + i + ':', opt.trim().substring(0, 70)));

      // Check disabled state
      const isDisabled = await poLineSelect.isDisabled();
      console.log('Select is disabled:', isDisabled);

      // For needs_approval status, should NOT be disabled
      expect(isDisabled).toBe(false);
      console.log('✓ PO line picker is editable for needs_approval invoice');

      // Verify we have options
      expect(options.length).toBeGreaterThan(1);
      console.log('✓ PO line picker has ' + (options.length - 1) + ' PO line items');
    }

    await page.screenshot({ path: 'tests/screenshots/po-line-picker-modal.png' });
    await page.locator('.modal-close').first().click();
  } else {
    // Click first invoice to check if it might have a PO
    await page.locator('.invoice-row, .invoice-card, .invoice-item').first().click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'tests/screenshots/invoice-modal-debug.png' });
    await page.locator('.modal-close').first().click();
  }
});

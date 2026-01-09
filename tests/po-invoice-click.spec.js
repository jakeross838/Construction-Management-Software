const { test, expect } = require('@playwright/test');

test('Clicking linked invoice opens PDF viewer', async ({ page }) => {
  // Listen for console messages
  page.on('console', msg => {
    const text = msg.text();
    if (msg.type() === 'error') {
      console.log('Browser Error:', text);
    }
  });

  // Navigate to POs page
  await page.goto('http://localhost:3001/pos.html?cachebust=' + Date.now());
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);

  // Click first PO row
  await page.locator('.po-row').first().click();
  await page.waitForTimeout(1500);

  console.log('PO modal opened');

  // Check if there are linked invoices
  const invoiceItems = page.locator('.invoice-item');
  const invoiceCount = await invoiceItems.count();
  console.log('Linked invoices found:', invoiceCount);

  if (invoiceCount > 0) {
    // Get the invoice number before clicking
    const invoiceNumber = await page.locator('.inv-number').first().textContent();
    console.log('Invoice number to open:', invoiceNumber);

    // Click on the first linked invoice
    await invoiceItems.first().click();

    // Wait for PDF viewer to appear (should NOT navigate away)
    await page.waitForTimeout(2000);

    // Should still be on the POs page
    expect(page.url()).toContain('pos.html');
    console.log('Still on POs page:', page.url());

    // Check if the attachment viewer opened
    const attachmentViewer = page.locator('#attachmentViewer');
    const viewerVisible = await attachmentViewer.count() > 0;
    console.log('PDF viewer visible:', viewerVisible);

    if (viewerVisible) {
      // Check it has a PDF iframe
      const pdfFrame = page.locator('#attachmentViewer iframe');
      const hasFrame = await pdfFrame.count() > 0;
      console.log('PDF iframe present:', hasFrame);

      // Take screenshot
      await page.screenshot({
        path: 'tests/screenshots/style-check/16-invoice-pdf-viewer.png',
        fullPage: false
      });
      console.log('Screenshot saved');

      // Close the viewer
      await page.locator('.btn-close-viewer').click();
      await page.waitForTimeout(500);

      console.log('✓ Invoice PDF viewer opened successfully');
    } else {
      console.log('✗ PDF viewer did not open');
      // Take debug screenshot
      await page.screenshot({
        path: 'tests/screenshots/style-check/16-pdf-viewer-debug.png',
        fullPage: false
      });
    }

    expect(viewerVisible).toBe(true);
  } else {
    console.log('No linked invoices to test');
  }
});

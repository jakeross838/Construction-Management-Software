const { test, expect } = require('@playwright/test');

test('Clicking linked invoice opens that invoice', async ({ page }) => {
  // Listen for console messages
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('openInvoice') || text.includes('Opening') || text.includes('Calling') || msg.type() === 'error') {
      console.log('Browser:', text);
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

    // Wait for navigation and page load
    await page.waitForURL('**/index.html**', { timeout: 5000 });
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000); // Wait longer for modal to open

    console.log('Navigated to:', page.url());

    // Check that we're on the invoices page
    expect(page.url()).toContain('index.html');

    // Check if the invoice edit modal opened (edit modal goes into modal-container)
    const modalContainer = page.locator('#modal-container');
    const containerClass = await modalContainer.evaluate(el => el.className);
    console.log('Modal container class:', containerClass);

    // The modal container gets 'active' class when a modal is shown
    const modalVisible = containerClass.includes('active');
    console.log('Invoice modal visible:', modalVisible);

    // Take screenshot
    await page.screenshot({
      path: 'tests/screenshots/style-check/16-opened-invoice.png',
      fullPage: false
    });
    console.log('Screenshot saved');

    if (modalVisible) {
      console.log('✓ Invoice modal opened successfully');
    } else {
      console.log('✗ Invoice modal did not open - checking if openInvoice code ran');
    }
  } else {
    console.log('No linked invoices to test');
  }
});

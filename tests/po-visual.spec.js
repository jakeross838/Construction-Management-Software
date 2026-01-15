const { test } = require('@playwright/test');

test('PO Modal Visual Test', async ({ page }) => {
  test.setTimeout(60000);

  page.on('console', msg => console.log('CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  console.log('\n=== PO VISUAL TEST ===\n');

  await page.goto('http://localhost:3001/pos.html');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);

  await page.screenshot({ path: 'tests/screenshots/po-1-list.png', fullPage: true });
  console.log('Screenshot 1: PO List page');

  // Click first PO (has linked invoices)
  const poRows = await page.$$('.po-row');
  const poRow = poRows[0]; // First PO has linked invoice
  if (poRow) {
    console.log('Clicking PO row...');
    await poRow.click();
    await page.waitForTimeout(1500);

    await page.screenshot({ path: 'tests/screenshots/po-2-modal.png', fullPage: true });
    console.log('Screenshot 2: PO Modal open');

    // Scroll down to see line items
    const modalBody = await page.$('.po-modal-body');
    if (modalBody) {
      await modalBody.evaluate(el => el.scrollTop = 600);
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'tests/screenshots/po-3-lineitems.png', fullPage: true });
      console.log('Screenshot 3: Line items section');

      // Scroll to bottom to see linked invoices
      await modalBody.evaluate(el => el.scrollTop = el.scrollHeight);
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'tests/screenshots/po-4-invoices.png', fullPage: true });
      console.log('Screenshot 4: Linked invoices section');
    }
  } else {
    // Try clicking on the PO number link
    const poLink = await page.$('a[href*="po"], .po-number, td:first-child');
    if (poLink) {
      console.log('Clicking PO link...');
      await poLink.click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: 'tests/screenshots/po-2-modal.png', fullPage: true });
      console.log('Screenshot 2: PO Modal open');
    } else {
      console.log('No PO rows or links found');
    }
  }

  console.log('\n=== PO VISUAL TEST COMPLETE ===\n');
});

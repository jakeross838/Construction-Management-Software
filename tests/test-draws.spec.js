const { test, expect } = require('@playwright/test');

test('Draws page - stress test', async ({ page }) => {
  // Go to draws page
  await page.goto('http://localhost:3001/draws.html');
  await page.waitForTimeout(2000);

  // Screenshot initial state
  await page.screenshot({ path: 'tests/screenshots/draws-list.png', fullPage: true });

  // Check if draws are loaded
  const drawRows = await page.locator('.draw-row').count();
  console.log('Draw rows found:', drawRows);

  // Click on Draw #2 (Drummond, draft status, should have partial approval)
  const draw2Row = page.locator('.draw-row:has-text("Draw #2")');
  if (await draw2Row.count() > 0) {
    await draw2Row.click();
    await page.waitForTimeout(1500);

    // Screenshot the draw modal
    await page.screenshot({ path: 'tests/screenshots/draw-modal-summary.png', fullPage: true });

    // Check for partial approval display
    const partialBadge = await page.locator('.partial-badge').count();
    console.log('Partial badges found:', partialBadge);

    // Check G702 values
    const g702Payment = await page.locator('#g702Line6').textContent();
    console.log('G702 Current Payment Due:', g702Payment);

    // Scroll to see G703 and invoices
    await page.locator('.draw-single-page').evaluate(el => el.scrollTop = 800);
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'tests/screenshots/draw-modal-g703.png', fullPage: true });

    // Scroll to invoices section
    await page.locator('.draw-single-page').evaluate(el => el.scrollTop = el.scrollHeight);
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'tests/screenshots/draw-modal-invoices.png', fullPage: true });

    // Check invoice table total
    const invoiceTotal = await page.locator('#invoicesFooter .amount strong').textContent();
    console.log('Invoice total in table:', invoiceTotal);

    // Check if amounts match G702
    const g702ThisPeriod = await page.locator('#summaryThisPeriod').textContent();
    console.log('Summary This Period:', g702ThisPeriod);
  }

  console.log('Test complete');
});

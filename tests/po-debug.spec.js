const { test, expect } = require('@playwright/test');

test('Debug PO page', async ({ page }) => {
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
    console.log(`[${msg.type()}]`, msg.text());
  });
  page.on('pageerror', err => errors.push(err.message));

  console.log('=== Loading page ===');
  await page.goto('http://localhost:3001/pos.html?cachebust=' + Date.now());
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);

  // Take screenshot
  await page.screenshot({ path: 'tests/screenshots/po-debug.png', fullPage: true });

  // Check what's in the PO list
  const poList = page.locator('#poList');
  const listHtml = await poList.innerHTML();
  console.log('PO List HTML:', listHtml.substring(0, 1000));

  // Check for po-row elements
  const poRows = await page.locator('.po-row').count();
  console.log('PO rows found:', poRows);

  // Check state
  const stateInfo = await page.evaluate(() => {
    return {
      purchaseOrdersCount: window.state?.purchaseOrders?.length || 0,
      pos: window.state?.purchaseOrders?.map(po => ({ id: po.id, po_number: po.po_number })) || []
    };
  });
  console.log('State:', JSON.stringify(stateInfo, null, 2));

  console.log('Errors:', errors);

  expect(poRows).toBeGreaterThan(0);
});

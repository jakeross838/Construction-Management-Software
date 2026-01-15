const { test } = require('@playwright/test');

// Quick visual verification test - run after every CSS/UI change
test('Visual Check - All Key UI States', async ({ page }) => {
  console.log('\n=== VISUAL CHECK ===\n');

  // 1. Invoice Dashboard
  console.log('1. Capturing Invoice Dashboard...');
  await page.goto('http://localhost:3001');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'tests/screenshots/check-1-dashboard.png', fullPage: true });
  console.log('   ✓ Dashboard captured');

  // 2. Invoice Edit Modal
  console.log('2. Capturing Invoice Edit Modal...');
  const invoiceCard = await page.$('.invoice-card');
  if (invoiceCard) {
    await invoiceCard.click();
    await page.waitForSelector('.modal-backdrop', { timeout: 5000 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'tests/screenshots/check-2-invoice-modal.png' });
    console.log('   ✓ Invoice modal captured');

    // Close modal
    const closeBtn = await page.$('.modal-close');
    if (closeBtn) await closeBtn.click();
    await page.waitForTimeout(300);
  }

  // 3. Upload Modal
  console.log('3. Capturing Upload Modal...');
  const uploadBtn = await page.$('button:has-text("Upload Invoice")');
  if (uploadBtn) {
    await uploadBtn.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'tests/screenshots/check-3-upload-modal.png' });
    console.log('   ✓ Upload modal captured');

    const cancelBtn = await page.$('button:has-text("Cancel")');
    if (cancelBtn) await cancelBtn.click();
    await page.waitForTimeout(300);
  }

  // 4. Purchase Orders Page
  console.log('4. Capturing Purchase Orders Page...');
  await page.goto('http://localhost:3001/pos.html');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'tests/screenshots/check-4-pos-page.png', fullPage: true });
  console.log('   ✓ POs page captured');

  // 5. PO Modal
  console.log('5. Capturing PO Modal...');
  const poRow = await page.$('.po-row');
  if (poRow) {
    await poRow.click();
    await page.waitForSelector('#poModal.show', { timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'tests/screenshots/check-5-po-modal.png', fullPage: true });
    console.log('   ✓ PO modal captured');

    const closeBtn = await page.$('.close-btn');
    if (closeBtn) await closeBtn.click();
    await page.waitForTimeout(300);
  }

  // 6. Draws Page
  console.log('6. Capturing Draws Page...');
  await page.goto('http://localhost:3001/draws.html');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'tests/screenshots/check-6-draws-page.png', fullPage: true });
  console.log('   ✓ Draws page captured');

  console.log('\n=== ALL SCREENSHOTS CAPTURED ===');
  console.log('Check tests/screenshots/check-*.png\n');
});

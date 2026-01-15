const { test } = require('@playwright/test');

test('Capture PO page and modal', async ({ page }) => {
  await page.goto('http://localhost:3001/pos.html');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(3000);

  // Full page screenshot
  await page.screenshot({ path: 'tests/screenshots/po-page-full.png', fullPage: true });

  // Click on first PO row to open modal
  const poRow = await page.$('.po-row');
  if (poRow) {
    console.log('Clicking PO row...');
    await poRow.click();

    // Wait for modal to appear
    await page.waitForSelector('#poModal.show, .modal.show', { timeout: 5000 }).catch(() => {
      console.log('Modal selector not found, waiting longer...');
    });
    await page.waitForTimeout(2000);

    // Screenshot the modal
    await page.screenshot({ path: 'tests/screenshots/po-modal.png', fullPage: true });

    // Also capture just the modal element if possible
    const modal = await page.$('.modal-content, #poModal .modal-content');
    if (modal) {
      await modal.screenshot({ path: 'tests/screenshots/po-modal-only.png' });
    }

    // Log modal state
    const modalState = await page.evaluate(() => {
      const modal = document.getElementById('poModal');
      return {
        exists: !!modal,
        classList: modal?.classList?.toString(),
        display: modal ? window.getComputedStyle(modal).display : 'none'
      };
    });
    console.log('Modal state:', modalState);
  } else {
    console.log('No PO row found');
  }
});

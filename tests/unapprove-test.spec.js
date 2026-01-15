const { test } = require('@playwright/test');

test('Unapprove Test', async ({ page }) => {
  test.setTimeout(60000);

  page.on('console', msg => console.log('CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  console.log('\n=== UNAPPROVE TEST ===\n');

  await page.goto('http://localhost:3001');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);

  // Click first invoice card
  const card = await page.$('.invoice-card');
  if (!card) {
    console.log('ERROR: No invoice cards found');
    return;
  }

  console.log('Clicking invoice card...');
  await card.click();
  await page.waitForTimeout(1500);

  await page.screenshot({ path: 'tests/screenshots/unapprove-1-modal.png', fullPage: true });

  // Check current status
  const status = await page.evaluate(() => window.Modals?.currentInvoice?.status);
  console.log('Current invoice status:', status);

  if (status !== 'approved') {
    console.log('Invoice is not approved, cannot test unapprove');
    return;
  }

  // Find unapprove button
  const unapproveBtn = await page.$('button:has-text("Unapprove")');
  console.log('Unapprove button found:', !!unapproveBtn);

  if (!unapproveBtn) {
    console.log('ERROR: No Unapprove button found');
    // List all buttons
    const buttons = await page.$$eval('.modal-footer button', btns => btns.map(b => b.textContent.trim()));
    console.log('Available buttons:', buttons);
    return;
  }

  console.log('Clicking Unapprove button...');
  await unapproveBtn.click();
  await page.waitForTimeout(1000);

  await page.screenshot({ path: 'tests/screenshots/unapprove-2-confirm.png', fullPage: true });

  // Check if confirm dialog appeared
  const overlay = await page.$('#confirm-overlay');
  console.log('Confirm overlay exists:', !!overlay);

  if (overlay) {
    const overlayVisible = await overlay.isVisible();
    console.log('Confirm overlay visible:', overlayVisible);

    // Get computed styles
    const styles = await page.evaluate(() => {
      const el = document.getElementById('confirm-overlay');
      if (!el) return null;
      const style = window.getComputedStyle(el);
      return {
        display: style.display,
        opacity: style.opacity,
        visibility: style.visibility,
        zIndex: style.zIndex
      };
    });
    console.log('Overlay styles:', JSON.stringify(styles));
  }

  // Find confirm button (should be btn-primary for warning type)
  const confirmBtn = await page.$('.confirm-modal .btn-primary');
  console.log('Confirm button found:', !!confirmBtn);

  if (confirmBtn) {
    const confirmVisible = await confirmBtn.isVisible();
    console.log('Confirm button visible:', confirmVisible);

    console.log('Clicking confirm button...');
    await confirmBtn.click();
    await page.waitForTimeout(2000);
  } else {
    // List all buttons in confirm modal
    const buttons = await page.$$eval('.confirm-modal button', btns => btns.map(b => ({ text: b.textContent.trim(), class: b.className })));
    console.log('Confirm modal buttons:', JSON.stringify(buttons));
  }

  await page.screenshot({ path: 'tests/screenshots/unapprove-3-result.png', fullPage: true });

  // Check final status
  const finalStatus = await page.evaluate(() => {
    const card = document.querySelector('.invoice-card');
    return card?.className;
  });
  console.log('Final card class:', finalStatus);

  console.log('\n=== UNAPPROVE TEST COMPLETE ===\n');
});

const { test, expect } = require('@playwright/test');

test('Approval Debug', async ({ page }) => {
  test.setTimeout(60000);
  const errors = [];
  const logs = [];

  page.on('console', msg => {
    logs.push(`[${msg.type()}] ${msg.text()}`);
    console.log('CONSOLE:', msg.type(), msg.text());
  });

  page.on('pageerror', err => {
    errors.push(err.message);
    console.log('PAGE ERROR:', err.message);
  });

  console.log('\n=== APPROVAL DEBUG TEST ===\n');

  // Force reload without cache
  await page.goto('http://localhost:3001');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(3000);

  // Check if Modals is available
  const modalsExists = await page.evaluate(() => !!window.Modals);
  console.log('window.Modals exists:', modalsExists);

  // Click first invoice card
  const card = await page.$('.invoice-card');
  if (!card) {
    console.log('ERROR: No invoice cards found');
    return;
  }
  await card.click();
  await page.waitForTimeout(1500);

  // Check current status
  const status = await page.evaluate(() => window.Modals?.currentInvoice?.status);
  console.log('Current invoice status:', status);

  // If already approved, unapprove first
  if (status === 'approved') {
    console.log('Invoice is approved, unapproving first...');
    const unapproveBtn = await page.$('button:has-text("Unapprove")');
    if (unapproveBtn) {
      await unapproveBtn.click();
      await page.waitForTimeout(500);

      // Click confirm in the dialog
      const confirmBtn = await page.$('.confirm-modal .btn-primary');
      if (confirmBtn) {
        await confirmBtn.click();
        await page.waitForTimeout(2000);
      }

      // Reopen modal
      const card2 = await page.$('.invoice-card');
      if (card2) await card2.click();
      await page.waitForTimeout(1500);
    }
  }

  // Take screenshot of modal
  await page.screenshot({ path: 'tests/screenshots/approval-1-modal.png', fullPage: true });

  // Click Approve button
  const approveBtn = await page.$('button:has-text("Approve")');
  if (!approveBtn) {
    console.log('ERROR: No Approve button found');
    return;
  }

  console.log('Clicking Approve button...');
  await approveBtn.click();
  await page.waitForTimeout(1000);

  // Screenshot after clicking approve
  await page.screenshot({ path: 'tests/screenshots/approval-2-after-click.png', fullPage: true });

  // Check if partial approval dialog appeared
  const overlay = await page.$('#confirm-overlay');
  const overlayVisible = overlay ? await overlay.isVisible() : false;
  console.log('Confirm overlay visible:', overlayVisible);

  // Check the overlay's computed style
  if (overlay) {
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
    console.log('Overlay computed styles:', JSON.stringify(styles));
  }

  // Check for partial approval modal inside overlay
  const partialModal = await page.$('.partial-approval-modal');
  const partialModalVisible = partialModal ? await partialModal.isVisible() : false;
  console.log('Partial modal visible:', partialModalVisible);

  if (partialModal) {
    const modalStyles = await page.evaluate(() => {
      const el = document.querySelector('.partial-approval-modal');
      if (!el) return null;
      const style = window.getComputedStyle(el);
      return {
        display: style.display,
        opacity: style.opacity,
        visibility: style.visibility
      };
    });
    console.log('Partial modal computed styles:', JSON.stringify(modalStyles));
  }

  // Try to find and fill textarea
  const textarea = await page.$('#partialApprovalNote');
  if (textarea) {
    console.log('Found textarea, filling...');
    await textarea.fill('Test partial approval note');
    await page.waitForTimeout(300);
  } else {
    console.log('ERROR: Textarea not found');
  }

  await page.screenshot({ path: 'tests/screenshots/approval-3-filled.png', fullPage: true });

  // Click Approve Partial
  const approvePartialBtn = await page.$('button:has-text("Approve Partial")');
  if (approvePartialBtn) {
    console.log('Clicking Approve Partial...');
    await approvePartialBtn.click();
    await page.waitForTimeout(3000);
  } else {
    console.log('ERROR: Approve Partial button not found');
  }

  await page.screenshot({ path: 'tests/screenshots/approval-4-final.png', fullPage: true });

  // Check final status
  const finalCard = await page.$('.invoice-card');
  if (finalCard) {
    const cardClass = await finalCard.getAttribute('class');
    console.log('Final card classes:', cardClass);
  }

  console.log('\n=== ERRORS ===');
  errors.forEach(e => console.log('ERROR:', e));

  console.log('\n=== TEST COMPLETE ===\n');
});

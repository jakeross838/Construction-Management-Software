const { test } = require('@playwright/test');

test('Full Debug', async ({ page }) => {
  page.on('console', msg => console.log('CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  console.log('\n=== FULL DEBUG ===\n');

  await page.goto('http://localhost:3001');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);

  // Click first invoice
  const card = await page.$('.invoice-card');
  if (card) {
    await card.click();
    await page.waitForTimeout(1500);
  }

  // First unapprove if already approved
  const unapproveBtn = await page.$('button:has-text("Unapprove")');
  if (unapproveBtn) {
    console.log('Invoice already approved, unapproving first...');
    await unapproveBtn.click();
    await page.waitForTimeout(1000);
    const confirmBtn = await page.$('.confirm-modal .btn-primary');
    if (confirmBtn) await confirmBtn.click();
    await page.waitForTimeout(2000);

    // Reopen the modal
    const card2 = await page.$('.invoice-card');
    if (card2) await card2.click();
    await page.waitForTimeout(1500);
  }

  await page.screenshot({ path: 'tests/screenshots/debug-1.png', fullPage: true });
  console.log('Screenshot 1: Modal open');

  // Click Approve
  const approveBtn = await page.$('button:has-text("Approve")');
  if (approveBtn) {
    console.log('Found Approve button, clicking...');
    await approveBtn.click();
    await page.waitForTimeout(1500);
  }

  await page.screenshot({ path: 'tests/screenshots/debug-2.png', fullPage: true });
  console.log('Screenshot 2: After clicking Approve');

  // Check what dialogs exist
  const confirmOverlay = await page.$('#confirm-overlay');
  console.log('Confirm overlay exists:', !!confirmOverlay);

  const partialModal = await page.$('.partial-approval-modal');
  console.log('Partial modal exists:', !!partialModal);

  // Check if textarea exists and try to type
  const textarea = await page.$('#partialApprovalNote');
  console.log('Textarea exists:', !!textarea);

  if (textarea) {
    console.log('Typing in textarea...');
    await textarea.fill('Test note for partial approval');
    await page.waitForTimeout(500);
  }

  await page.screenshot({ path: 'tests/screenshots/debug-3.png', fullPage: true });
  console.log('Screenshot 3: After typing note');

  // Click Approve Partial button
  const approvePartialBtn = await page.$('button:has-text("Approve Partial")');
  console.log('Approve Partial button exists:', !!approvePartialBtn);

  if (approvePartialBtn) {
    console.log('Clicking Approve Partial...');
    await approvePartialBtn.click();
    await page.waitForTimeout(3000);
  }

  await page.screenshot({ path: 'tests/screenshots/debug-4.png', fullPage: true });
  console.log('Screenshot 4: Final state');

  console.log('\n=== DEBUG COMPLETE ===\n');
});

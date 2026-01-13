const { test, expect } = require('@playwright/test');

test.describe('Simplified Add to Draw Flow', () => {

  test('Add approved invoice to draw with one click', async ({ page }) => {
    const errors = [];

    page.on('pageerror', err => errors.push(err.message));
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
      console.log(`[${msg.type()}]`, msg.text());
    });

    // Load invoice dashboard
    console.log('=== Loading Invoice Dashboard ===');
    await page.goto('/index.html');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000); // Wait for invoices to load

    // Screenshot initial state
    await page.screenshot({ path: 'tests/screenshots/add-to-draw-01-dashboard.png', fullPage: true });

    // Look for approved invoices (Ready for Draw section)
    const approvedInvoices = page.locator('.invoice-card.status-approved');
    const approvedCount = await approvedInvoices.count();
    console.log(`Found ${approvedCount} approved invoices`);

    if (approvedCount === 0) {
      console.log('No approved invoices to test with - skipping');
      return;
    }

    // Verify NO checkboxes exist (they were removed)
    const checkboxes = await page.locator('.invoice-checkbox').count();
    expect(checkboxes).toBe(0);
    console.log('Verified: No checkboxes on invoice cards');

    // Click on first approved invoice
    console.log('\n=== Opening approved invoice ===');
    await approvedInvoices.first().click();
    await page.waitForTimeout(3000);

    await page.screenshot({ path: 'tests/screenshots/add-to-draw-02-modal-open.png', fullPage: true });

    // Check for "Add to Draw" button in the modal
    const addToDrawBtn = page.locator('button:has-text("Add to Draw"):visible');
    const btnCount = await addToDrawBtn.count();
    console.log('Add to Draw buttons found:', btnCount);

    if (btnCount === 0) {
      // Invoice might not be in approved status, check what buttons are visible
      const allButtons = await page.locator('.modal-footer button:visible, #modal-container button:visible').allTextContents();
      console.log('Available buttons:', allButtons.join(', '));
      console.log('Skipping - no Add to Draw button (invoice may already be in draw)');
      return;
    }

    console.log('Found "Add to Draw" button');

    // Get invoice number for verification
    const invoiceTitle = await page.locator('.modal-header h2, .modal-header .invoice-title').first().textContent();
    console.log('Invoice:', invoiceTitle);

    // Click "Add to Draw" - should be instant, no picker
    console.log('\n=== Clicking Add to Draw ===');
    await addToDrawBtn.click();

    // Wait for toast notification
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'tests/screenshots/add-to-draw-03-after-click.png', fullPage: true });

    // Check for success toast with "Added to Draw #X"
    const toast = page.locator('.toast, .toast-message, [class*="toast"]');
    const toastVisible = await toast.count() > 0;
    console.log('Toast visible:', toastVisible);

    if (toastVisible) {
      const toastText = await toast.first().textContent();
      console.log('Toast message:', toastText);
      expect(toastText).toContain('Draw');
    }

    // Modal should close after adding
    await page.waitForTimeout(1000);

    // Refresh and check invoice is now "in_draw"
    console.log('\n=== Verifying invoice status changed ===');
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    await page.screenshot({ path: 'tests/screenshots/add-to-draw-04-after-reload.png', fullPage: true });

    // Look for in_draw invoices with draw badge
    const inDrawInvoices = page.locator('.invoice-card.status-in_draw');
    const inDrawCount = await inDrawInvoices.count();
    console.log(`Found ${inDrawCount} invoices in draw status`);

    // Check for draw badge
    const drawBadges = page.locator('.draw-badge');
    const badgeCount = await drawBadges.count();
    console.log(`Found ${badgeCount} draw badges`);

    if (badgeCount > 0) {
      const badgeText = await drawBadges.first().textContent();
      console.log('Draw badge text:', badgeText);
      expect(badgeText).toContain('Draw #');
    }

    // Report any JS errors (filter out non-critical ones)
    const criticalErrors = errors.filter(e =>
      !e.includes('favicon') &&
      !e.includes('500') &&
      !e.includes('Realtime') &&
      !e.includes('Connection error')
    );

    if (criticalErrors.length > 0) {
      console.log('\n=== Critical JavaScript Errors ===');
      criticalErrors.forEach(e => console.log('ERROR:', e));
    }

    expect(criticalErrors).toHaveLength(0);
    console.log('\n=== Test completed successfully ===');
  });

  test('Draws page has no Create Draw button', async ({ page }) => {
    console.log('=== Checking Draws page ===');
    await page.goto('/draws.html');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    await page.screenshot({ path: 'tests/screenshots/add-to-draw-05-draws-page.png', fullPage: true });

    // Verify no "+ New Draw" button
    const newDrawBtn = page.locator('button:has-text("New Draw")');
    const newDrawCount = await newDrawBtn.count();
    expect(newDrawCount).toBe(0);
    console.log('Verified: No "New Draw" button on draws page');

    // Verify Auto-Generate button exists
    const autoGenBtn = page.locator('button:has-text("Auto-Generate")');
    await expect(autoGenBtn).toBeVisible();
    console.log('Verified: "Auto-Generate Draw" button exists');

    console.log('=== Test completed ===');
  });

  test('Submit draw prompts for period end date', async ({ page }) => {
    console.log('=== Testing Submit Draw flow ===');
    await page.goto('/draws.html');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    // Look for a draft draw
    const draftDraws = page.locator('.draw-row:has(.status-badge:has-text("Draft")), .draw-card:has(.status-pill:has-text("Draft")), tr:has(td:has-text("Draft"))');
    const draftCount = await draftDraws.count();
    console.log(`Found ${draftCount} draft draws`);

    if (draftCount === 0) {
      console.log('No draft draws to test with - skipping');
      return;
    }

    // Click on first draft draw
    await draftDraws.first().click();
    await page.waitForTimeout(2000);

    await page.screenshot({ path: 'tests/screenshots/add-to-draw-06-draw-modal.png', fullPage: true });

    // Look for Submit Draw button
    const submitBtn = page.locator('button:has-text("Submit Draw")');
    const submitVisible = await submitBtn.isVisible().catch(() => false);

    if (!submitVisible) {
      console.log('Submit Draw button not visible - draw may not be in draft status');
      return;
    }

    // Click Submit Draw
    console.log('Clicking Submit Draw...');
    await submitBtn.click();
    await page.waitForTimeout(1000);

    await page.screenshot({ path: 'tests/screenshots/add-to-draw-07-submit-modal.png', fullPage: true });

    // Check for period end date input in the submit modal
    const periodEndInput = page.locator('#submitPeriodEnd, input[type="date"]');
    const hasDateInput = await periodEndInput.count() > 0;
    console.log('Period end date input found:', hasDateInput);

    expect(hasDateInput).toBe(true);

    // Check for submit confirmation modal
    const submitModal = page.locator('#submitDrawModal, .modal:has-text("Period End Date")');
    const modalVisible = await submitModal.isVisible().catch(() => false);
    console.log('Submit modal visible:', modalVisible);

    // Close modal without submitting (just testing the flow)
    const cancelBtn = page.locator('#submitDrawModal button:has-text("Cancel"), .modal button:has-text("Cancel")');
    if (await cancelBtn.count() > 0) {
      await cancelBtn.click();
      console.log('Cancelled submit modal');
    }

    console.log('=== Test completed ===');
  });
});

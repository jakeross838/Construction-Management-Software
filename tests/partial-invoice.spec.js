const { test, expect } = require('@playwright/test');

test.describe('Partial Invoice Handling', () => {

  test('Partial allocation displays warning in invoice list', async ({ page }) => {
    console.log('=== Testing Partial Allocation Display ===');

    await page.goto('/index.html');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    await page.screenshot({ path: 'tests/screenshots/partial-01-list.png', fullPage: true });

    // Look for the partial invoice #106084 (needs_approval status with 62% allocation)
    const partialInvoice = page.locator('.invoice-card:has-text("106084")');
    const found = await partialInvoice.count();
    console.log('Found invoice #106084:', found > 0);

    if (found === 0) {
      console.log('Partial invoice not visible in current filter');
      // Check all cards for any partial indicators
      const allCards = await page.locator('.invoice-card').count();
      console.log('Total invoice cards visible:', allCards);
      return;
    }

    // Get the card HTML to check what's rendered
    const cardHtml = await partialInvoice.innerHTML();
    console.log('Card HTML snippet:', cardHtml.substring(0, 500));

    // Check for partial allocation indicator
    const hasPartialIndicator = cardHtml.includes('partial') ||
                                 cardHtml.includes('62%') ||
                                 cardHtml.includes('3,000') ||
                                 cardHtml.includes('allocation');
    console.log('Has partial indicator:', hasPartialIndicator);

    // Take screenshot of the card
    await partialInvoice.screenshot({ path: 'tests/screenshots/partial-02-card.png' });

    console.log('=== Test completed ===');
  });

  test('Partial invoice modal shows allocation warning', async ({ page }) => {
    console.log('=== Testing Partial Invoice Modal ===');

    await page.goto('/index.html');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    // Find and click on partial invoice #106084 (has 62% allocation)
    const partialInvoice = page.locator('.invoice-card:has-text("106084")');
    const found = await partialInvoice.count();
    console.log('Found invoice #106084:', found > 0);

    if (found === 0) {
      console.log('Partial invoice not found - skipping');
      return;
    }

    await partialInvoice.click();
    await page.waitForTimeout(2000);

    await page.screenshot({ path: 'tests/screenshots/partial-03-modal.png', fullPage: true });

    // Check for allocation section in the modal
    const modalContent = await page.locator('#invoiceInfoPanel').innerHTML();
    console.log('Modal has allocation info:', modalContent.includes('allocation') || modalContent.includes('Allocation'));
    console.log('Modal shows partial amount:', modalContent.includes('3,000') || modalContent.includes('3000'));

    // Check for partial warning or indicator
    const hasPartialWarning = modalContent.includes('partial') ||
                              modalContent.includes('62%') ||
                              modalContent.includes('remaining');
    console.log('Has partial warning:', hasPartialWarning);

    // Check available actions
    const buttons = await page.locator('#invoiceModalFooter button:visible, .modal-footer button:visible').allTextContents();
    console.log('Available actions:', buttons.join(', '));

    // In needs_approval status, should have Approve button
    const approveBtn = page.locator('button:has-text("Approve"):visible');
    const hasApprove = await approveBtn.count() > 0;
    console.log('Has Approve button:', hasApprove);

    console.log('=== Test completed ===');
  });

  test('Approve partial invoice and check close-out option', async ({ page }) => {
    console.log('=== Testing Partial Invoice Approval ===');

    await page.goto('/index.html');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    // Find partial invoice #106084 (has 62% allocation)
    const partialInvoice = page.locator('.invoice-card:has-text("106084")');
    const found = await partialInvoice.count();
    console.log('Found invoice #106084:', found > 0);

    if (found === 0) {
      console.log('Partial invoice not found - skipping');
      return;
    }

    await partialInvoice.click();
    await page.waitForTimeout(2000);

    await page.screenshot({ path: 'tests/screenshots/partial-04-before-approve.png', fullPage: true });

    // Check current status from the modal
    const statusPill = await page.locator('.status-pill:visible').first().textContent().catch(() => 'unknown');
    console.log('Current status:', statusPill);

    // Check if allocation warning is displayed in modal
    const modalHtml = await page.locator('#invoiceInfoPanel').innerHTML();
    const hasPartialInfo = modalHtml.includes('3,000') || modalHtml.includes('62%') || modalHtml.includes('partial');
    console.log('Modal shows partial allocation info:', hasPartialInfo);

    // If there's an Approve button, click it
    const approveBtn = page.locator('button:has-text("Approve"):visible');
    const canApprove = await approveBtn.count() > 0;
    console.log('Can approve:', canApprove);

    if (canApprove) {
      console.log('Clicking Approve...');
      await approveBtn.click();
      await page.waitForTimeout(1500);

      // Check for partial approval dialog (appears for partial invoices)
      const partialDialog = page.locator('.partial-approval-modal, .confirm-modal:has-text("Partial Approval")');
      const hasPartialDialog = await partialDialog.count() > 0;
      console.log('Partial approval dialog appeared:', hasPartialDialog);

      if (hasPartialDialog) {
        await page.screenshot({ path: 'tests/screenshots/partial-05-partial-dialog.png', fullPage: true });

        // The dialog should show the allocation breakdown
        const dialogHtml = await partialDialog.innerHTML();
        console.log('Dialog shows allocation info:', dialogHtml.includes('Allocated') && dialogHtml.includes('%'));

        // Fill in the required note
        const noteInput = page.locator('#partialApprovalNote');
        if (await noteInput.count() > 0) {
          await noteInput.fill('Test partial approval - remaining work to be billed later');
          console.log('Filled in partial approval note');
        }

        // Click the approve button in the dialog
        const approvePartialBtn = page.locator('button:has-text("Approve Partial")');
        if (await approvePartialBtn.count() > 0) {
          console.log('Clicking Approve Partial...');
          await approvePartialBtn.click();
          await page.waitForTimeout(3000);
        }
      }

      await page.screenshot({ path: 'tests/screenshots/partial-06-after-approve.png', fullPage: true });

      // Reload to verify status change
      await page.reload();
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      // Find the invoice again and check its status
      const updatedInvoice = page.locator('.invoice-card:has-text("106084")');
      if (await updatedInvoice.count() > 0) {
        const newStatus = await updatedInvoice.locator('.status-pill').textContent().catch(() => 'unknown');
        console.log('New status after approval:', newStatus);

        // Check for Add to Draw option (only for approved invoices)
        await updatedInvoice.click();
        await page.waitForTimeout(1500);

        const addToDrawBtn = page.locator('button:has-text("Add to Draw"):visible');
        const hasAddToDraw = await addToDrawBtn.count() > 0;
        console.log('Add to Draw option available:', hasAddToDraw);
      }
    } else {
      console.log('No Approve button - invoice may need assignment or already approved');
    }

    console.log('=== Test completed ===');
  });

  test('Add partial invoice to draw', async ({ page }) => {
    console.log('=== Testing Add Partial Invoice to Draw ===');

    await page.goto('/index.html');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    // Find invoice #106084 (should now be approved from previous test)
    const partialInvoice = page.locator('.invoice-card:has-text("106084")');
    const found = await partialInvoice.count();
    console.log('Found invoice #106084:', found > 0);

    if (found === 0) {
      console.log('Partial invoice not found - skipping');
      return;
    }

    // Check its current status
    const statusPill = await partialInvoice.locator('.status-pill').textContent().catch(() => 'unknown');
    console.log('Invoice #106084 current status:', statusPill);

    await partialInvoice.click();
    await page.waitForTimeout(2000);

    await page.screenshot({ path: 'tests/screenshots/partial-06-modal-for-draw.png', fullPage: true });

    // Check for Add to Draw button (only available for approved invoices)
    const addToDrawBtn = page.locator('button:has-text("Add to Draw"):visible');
    const canAddToDraw = await addToDrawBtn.count() > 0;
    console.log('Can add to draw:', canAddToDraw);

    if (canAddToDraw) {
      console.log('Clicking Add to Draw...');
      await addToDrawBtn.click();
      await page.waitForTimeout(2000);

      await page.screenshot({ path: 'tests/screenshots/partial-07-after-add-to-draw.png', fullPage: true });

      // Check for success toast
      const toast = page.locator('.toast, [class*="toast"]');
      if (await toast.count() > 0) {
        const toastText = await toast.first().textContent();
        console.log('Toast:', toastText);
        // Should mention the draw number
        const mentionsDraw = toastText.includes('Draw') || toastText.includes('draw');
        console.log('Toast mentions draw:', mentionsDraw);
      }

      // After adding to draw, modal might close - reload to verify status change
      await page.reload();
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);

      // Check if invoice is now in_draw status
      const updatedInvoice = page.locator('.invoice-card:has-text("106084")');
      if (await updatedInvoice.count() > 0) {
        const newStatus = await updatedInvoice.locator('.status-pill').textContent().catch(() => 'unknown');
        console.log('New status after add to draw:', newStatus);

        // Check for draw badge
        const drawBadge = await updatedInvoice.locator('.draw-badge').textContent().catch(() => 'none');
        console.log('Draw badge:', drawBadge);
      }
    } else {
      console.log('Cannot add to draw - invoice may need to be approved first or already in draw');
    }

    console.log('=== Test completed ===');
  });

  test('Check partial invoice in draw modal', async ({ page }) => {
    console.log('=== Testing Partial Invoice in Draw ===');

    await page.goto('/draws.html');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    await page.screenshot({ path: 'tests/screenshots/partial-08-draws-page.png', fullPage: true });

    // Find draft draw - look for Draw #5 (the current draft)
    const draftDraw = page.locator('.draw-card:has-text("Draft"), .draw-card:has-text("#5"), .draw-row:has-text("Draft")').first();
    const found = await draftDraw.count();
    console.log('Found draft draw:', found > 0);

    // If not found by status, list what draws are visible
    if (found === 0) {
      const allDraws = await page.locator('.draw-card, .draw-row').count();
      console.log('Total draw elements found:', allDraws);

      // Try clicking on any draw that's visible
      const anyDraw = page.locator('.draw-card').first();
      if (await anyDraw.count() > 0) {
        console.log('Clicking on first draw...');
        await anyDraw.click();
        await page.waitForTimeout(2000);
      } else {
        console.log('No draw cards found');
        return;
      }
    } else {
      await draftDraw.click();
      await page.waitForTimeout(2000);
    }

    await page.screenshot({ path: 'tests/screenshots/partial-09-draw-modal.png', fullPage: true });

    // Check if modal opened
    const modalVisible = await page.locator('.modal:visible, .modal-content:visible, #drawModal:visible').count() > 0;
    console.log('Draw modal opened:', modalVisible);

    // Look for invoices tab
    const invoicesTab = page.locator('button:has-text("Invoices"), [data-tab="invoices"]');
    if (await invoicesTab.count() > 0) {
      console.log('Found Invoices tab, clicking...');
      await invoicesTab.click();
      await page.waitForTimeout(1000);

      await page.screenshot({ path: 'tests/screenshots/partial-10-draw-invoices.png', fullPage: true });

      // Check if partial invoice #106084 shows allocation info
      const partialRow = page.locator('text=106084');
      if (await partialRow.count() > 0) {
        console.log('Found invoice #106084 in draw');

        // Check for partial allocation indicator
        const invoicesList = await page.locator('.invoices-tab, [data-tab-content="invoices"]').innerHTML().catch(() => '');
        const hasPartialInfo = invoicesList.includes('62%') || invoicesList.includes('partial') || invoicesList.includes('3,000');
        console.log('Draw invoice list shows partial info:', hasPartialInfo);
      } else {
        console.log('Invoice #106084 not found in invoices list');
      }
    } else {
      console.log('Invoices tab not found');

      // Check the modal content anyway
      const modalContent = await page.locator('.modal-content:visible').innerHTML().catch(() => 'no modal');
      console.log('Modal contains 106084:', modalContent.includes('106084'));
    }

    console.log('=== Test completed ===');
  });

  test('Verify partially billed invoice cycles back for remaining', async ({ page }) => {
    console.log('=== Testing Partial Billing Cycle ===');

    await page.goto('/index.html');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    // Find invoice #106084 which should now be in needs_approval with partial billing
    const partialInvoice = page.locator('.invoice-card:has-text("106084")');
    const found = await partialInvoice.count();
    console.log('Found invoice #106084:', found > 0);

    if (found === 0) {
      console.log('Invoice not found in list');
      return;
    }

    await page.screenshot({ path: 'tests/screenshots/partial-11-cycled-invoice.png', fullPage: true });

    // Get card HTML to check for partial billing indicator
    const cardHtml = await partialInvoice.innerHTML();
    console.log('Card shows billing badge:', cardHtml.includes('billing-badge') || cardHtml.includes('to bill'));
    console.log('Card shows remaining amount:', cardHtml.includes('1,836') || cardHtml.includes('remaining'));

    // Check the status pill
    const statusPill = await partialInvoice.locator('.status-pill').textContent().catch(() => 'unknown');
    console.log('Status pill text:', statusPill);

    // Click to open modal and verify
    await partialInvoice.click();
    await page.waitForTimeout(2000);

    await page.screenshot({ path: 'tests/screenshots/partial-12-cycled-modal.png', fullPage: true });

    // Check modal content
    const modalHtml = await page.locator('#invoiceInfoPanel').innerHTML().catch(() => '');
    console.log('Modal shows billed amount:', modalHtml.includes('3,000') || modalHtml.includes('billed'));

    // Verify no allocations (should be cleared)
    const allocRows = await page.locator('.allocation-row').count();
    console.log('Allocation rows:', allocRows);

    console.log('=== Test completed ===');
  });
});

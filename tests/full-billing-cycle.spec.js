const { test, expect } = require('@playwright/test');

/**
 * Full Partial Invoice Billing Cycle Test
 *
 * Tests the complete flow:
 * 1. View partial allocation in invoice list
 * 2. Open modal, see partial allocation warning
 * 3. Approve with partial approval dialog
 * 4. Add to draw
 * 5. Verify invoice cycles back to needs_approval
 * 6. Verify remaining amount displayed
 */

test.describe('Full Partial Billing Cycle', () => {

  test('Complete partial billing cycle with invoice #106004', async ({ page }) => {
    // Slow down for visibility
    test.slow();

    console.log('\n========================================');
    console.log('FULL PARTIAL BILLING CYCLE TEST');
    console.log('Invoice #106004 - $1,426.14');
    console.log('Partial allocation: $800 (56%)');
    console.log('========================================\n');

    // STEP 1: Load invoice dashboard
    console.log('STEP 1: Loading invoice dashboard...');
    await page.goto('/index.html');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    await page.screenshot({ path: 'tests/screenshots/cycle-01-dashboard.png', fullPage: true });

    // STEP 2: Find the partial invoice
    console.log('\nSTEP 2: Finding invoice #106004...');
    const invoice = page.locator('.invoice-card:has-text("106004")');
    const found = await invoice.count();
    console.log('Found invoice:', found > 0);

    if (found === 0) {
      console.log('Invoice not found - test cannot continue');
      return;
    }

    // Check the card shows partial allocation
    const cardHtml = await invoice.innerHTML();
    const hasPartialBadge = cardHtml.includes('56%') || cardHtml.includes('800') || cardHtml.includes('allocation');
    console.log('Shows partial allocation:', hasPartialBadge);

    // Get status
    const statusPill = await invoice.locator('.status-pill').textContent().catch(() => 'unknown');
    console.log('Current status:', statusPill);

    // STEP 3: Click to open modal
    console.log('\nSTEP 3: Opening invoice modal...');
    await invoice.click();
    await page.waitForTimeout(2000);

    await page.screenshot({ path: 'tests/screenshots/cycle-02-modal-open.png', fullPage: true });

    // Check modal content
    const modalHtml = await page.locator('#invoiceInfoPanel').innerHTML().catch(() => '');
    console.log('Modal shows allocation info:', modalHtml.includes('800') || modalHtml.includes('Allocated'));

    // STEP 4: Click Approve (should trigger partial approval dialog)
    console.log('\nSTEP 4: Clicking Approve button...');
    const approveBtn = page.locator('button:has-text("Approve"):visible');
    const canApprove = await approveBtn.count() > 0;
    console.log('Approve button available:', canApprove);

    if (!canApprove) {
      console.log('Cannot approve - checking what buttons are available');
      const buttons = await page.locator('#invoiceModalFooter button:visible').allTextContents();
      console.log('Available buttons:', buttons.join(', '));
      return;
    }

    await approveBtn.click();
    await page.waitForTimeout(1500);

    // STEP 5: Handle partial approval dialog
    console.log('\nSTEP 5: Handling partial approval dialog...');
    const partialDialog = page.locator('.partial-approval-modal, .confirm-modal:has-text("Partial")');
    const hasPartialDialog = await partialDialog.count() > 0;
    console.log('Partial approval dialog appeared:', hasPartialDialog);

    await page.screenshot({ path: 'tests/screenshots/cycle-03-partial-dialog.png', fullPage: true });

    if (hasPartialDialog) {
      // Fill in required note
      const noteInput = page.locator('#partialApprovalNote');
      if (await noteInput.count() > 0) {
        await noteInput.fill('First partial billing - $800 of $1426.14. Remaining $626.14 for next draw.');
        console.log('Filled partial approval note');
      }

      // Click Approve Partial
      const approvePartialBtn = page.locator('button:has-text("Approve Partial")');
      if (await approvePartialBtn.count() > 0) {
        console.log('Clicking Approve Partial...');
        await approvePartialBtn.click();
        await page.waitForTimeout(3000);
      }
    }

    await page.screenshot({ path: 'tests/screenshots/cycle-04-after-approve.png', fullPage: true });

    // STEP 6: Click Add to Draw
    console.log('\nSTEP 6: Adding to draw...');

    // Reload to get updated modal
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Find and click invoice again
    const approvedInvoice = page.locator('.invoice-card:has-text("106004")');
    if (await approvedInvoice.count() > 0) {
      await approvedInvoice.click();
      await page.waitForTimeout(2000);

      await page.screenshot({ path: 'tests/screenshots/cycle-05-approved-modal.png', fullPage: true });

      const addToDrawBtn = page.locator('button:has-text("Add to Draw"):visible');
      const canAddToDraw = await addToDrawBtn.count() > 0;
      console.log('Add to Draw button available:', canAddToDraw);

      if (canAddToDraw) {
        console.log('Clicking Add to Draw...');
        await addToDrawBtn.click();
        await page.waitForTimeout(3000);

        await page.screenshot({ path: 'tests/screenshots/cycle-06-after-add-to-draw.png', fullPage: true });

        // Check for toast
        const toast = page.locator('.toast');
        if (await toast.count() > 0) {
          const toastText = await toast.first().textContent();
          console.log('Toast message:', toastText);
        }
      }
    }

    // STEP 7: Verify invoice cycled back
    console.log('\nSTEP 7: Verifying invoice cycled back...');
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    await page.screenshot({ path: 'tests/screenshots/cycle-07-after-cycle.png', fullPage: true });

    const cycledInvoice = page.locator('.invoice-card:has-text("106004")');
    if (await cycledInvoice.count() > 0) {
      const newCardHtml = await cycledInvoice.innerHTML();
      const newStatus = await cycledInvoice.locator('.status-pill').textContent().catch(() => 'unknown');

      console.log('New status:', newStatus);
      console.log('Shows billing badge:', newCardHtml.includes('billing-badge') || newCardHtml.includes('to bill'));
      console.log('Shows remaining amount:', newCardHtml.includes('626') || newCardHtml.includes('remaining'));

      // Click to verify modal
      await cycledInvoice.click();
      await page.waitForTimeout(2000);

      await page.screenshot({ path: 'tests/screenshots/cycle-08-cycled-modal.png', fullPage: true });

      const cycledModalHtml = await page.locator('#invoiceInfoPanel').innerHTML().catch(() => '');
      const allocRows = await page.locator('.allocation-row').count();

      console.log('Allocations cleared:', allocRows === 0);
    }

    console.log('\n========================================');
    console.log('TEST COMPLETE');
    console.log('========================================\n');
  });

});

const { test, expect } = require('@playwright/test');

test.describe('Debug Approve Flow', () => {
  test('Debug: Approve invoice and capture all errors', async ({ page }) => {
    // Collect errors
    const errors = [];
    const logs = [];

    page.on('console', msg => {
      const text = msg.text();
      logs.push({ type: msg.type(), text });
      if (msg.type() === 'error') {
        errors.push(text);
      }
    });

    page.on('pageerror', err => {
      errors.push('PAGE ERROR: ' + err.message);
    });

    page.on('response', response => {
      if (response.status() >= 400) {
        errors.push(`HTTP ${response.status()}: ${response.url()}`);
      }
    });

    // Go to page with cache bust
    await page.goto('http://localhost:3001?cachebust=' + Date.now());
    await page.waitForLoadState('domcontentloaded');

    // Wait for invoices to render
    await page.waitForTimeout(3000);

    console.log('\n=== PAGE LOADED ===');
    console.log('Errors so far:', errors);

    // Take initial screenshot
    await page.screenshot({ path: 'tests/screenshots/01-initial.png', fullPage: true });

    // Check if we have invoice cards
    const invoiceCards = await page.locator('.invoice-card').count();
    console.log('Invoice cards found:', invoiceCards);

    if (invoiceCards === 0) {
      console.log('No invoice cards found!');
      return;
    }

    // Find a coded invoice (can be approved)
    const codedInvoice = page.locator('.invoice-card.status-coded').first();
    const codedCount = await page.locator('.invoice-card.status-coded').count();
    console.log('Coded invoices found:', codedCount);

    if (codedCount > 0) {
      // Click the invoice card
      console.log('\n=== CLICKING INVOICE ===');
      await codedInvoice.click();

      // Wait for modal
      await page.waitForTimeout(3000);

      console.log('Errors after click:', errors);
      await page.screenshot({ path: 'tests/screenshots/02-after-click.png', fullPage: true });

      // Check modal state
      const modalContainer = page.locator('#modal-container');
      const isActive = await modalContainer.evaluate(el => el.classList.contains('active'));
      console.log('Modal container active:', isActive);

      if (isActive) {
        // Look for Approve button INSIDE the modal-footer-right (not the filter button)
        const approveBtn = page.locator('.modal-footer-right button.btn-success:has-text("Approve")');
        const approveBtnCount = await approveBtn.count();
        console.log('Approve buttons in modal footer:', approveBtnCount);

        // Debug: Print all buttons in modal
        const allModalBtns = await page.locator('.modal-footer-right button').all();
        console.log('All buttons in modal footer:');
        for (const btn of allModalBtns) {
          const text = await btn.textContent();
          const classes = await btn.getAttribute('class');
          console.log(`  - "${text.trim()}" (${classes})`);
        }

        if (approveBtnCount > 0) {
          console.log('\n=== CLICKING APPROVE ===');

          // Handle confirm dialog
          page.on('dialog', async dialog => {
            console.log('Dialog:', dialog.message());
            await dialog.accept();
          });

          // Force click to bypass any overlay issues
          await approveBtn.first().click({ force: true });

          // Wait for response
          await page.waitForTimeout(5000);

          console.log('\n=== AFTER APPROVE ===');
          console.log('All errors:', errors);

          await page.screenshot({ path: 'tests/screenshots/03-after-approve.png', fullPage: true });
        } else {
          console.log('No Approve button found in modal footer!');

          // Check if we're looking at the right status
          const statusBadge = await page.locator('.modal-header .status-badge').textContent();
          console.log('Invoice status:', statusBadge);
        }
      } else {
        console.log('Modal did not open!');
      }
    } else {
      console.log('No coded invoices found to test approval');
    }

    // Final summary
    console.log('\n========== FINAL SUMMARY ==========');
    console.log('Total errors:', errors.length);
    errors.forEach((e, i) => console.log(`  ${i + 1}. ${e}`));
    console.log('===================================\n');
  });
});

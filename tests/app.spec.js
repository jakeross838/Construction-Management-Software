const { test, expect } = require('@playwright/test');

// Collect all console messages and errors
let consoleMessages = [];
let consoleErrors = [];
let networkErrors = [];

test.describe('Ross Built CMS - Full App Test', () => {

  test.beforeEach(async ({ page }) => {
    // Reset collectors
    consoleMessages = [];
    consoleErrors = [];
    networkErrors = [];

    // Capture console messages
    page.on('console', msg => {
      const text = msg.text();
      consoleMessages.push({ type: msg.type(), text });
      if (msg.type() === 'error') {
        consoleErrors.push(text);
        console.log('CONSOLE ERROR:', text);
      }
    });

    // Capture page errors
    page.on('pageerror', err => {
      consoleErrors.push(err.message);
      console.log('PAGE ERROR:', err.message);
    });

    // Capture failed network requests
    page.on('requestfailed', request => {
      networkErrors.push({
        url: request.url(),
        failure: request.failure()?.errorText
      });
      console.log('NETWORK ERROR:', request.url(), request.failure()?.errorText);
    });

    // Capture response errors
    page.on('response', response => {
      if (response.status() >= 400) {
        networkErrors.push({
          url: response.url(),
          status: response.status()
        });
        console.log('HTTP ERROR:', response.status(), response.url());
      }
    });
  });

  test('1. Page loads without errors', async ({ page }) => {
    await page.goto('http://localhost:3001');
    await page.waitForLoadState('networkidle');

    // Wait for invoices to load
    await page.waitForTimeout(2000);

    // Check for JS errors on load
    console.log('\n=== LOAD ERRORS ===');
    console.log('Console Errors:', consoleErrors);
    console.log('Network Errors:', networkErrors);

    // Page should have loaded
    await expect(page.locator('h1')).toContainText('Invoice');
  });

  test('2. Invoice list displays correctly', async ({ page }) => {
    await page.goto('http://localhost:3001');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Check if invoices loaded (either cards or empty state)
    const invoiceCards = page.locator('.invoice-card');
    const emptyState = page.locator('.empty-state');

    const hasInvoices = await invoiceCards.count() > 0;
    const hasEmptyState = await emptyState.count() > 0;

    console.log('Invoice cards found:', await invoiceCards.count());
    expect(hasInvoices || hasEmptyState).toBeTruthy();
  });

  test('3. Click invoice card - open edit modal', async ({ page }) => {
    await page.goto('http://localhost:3001');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Find first invoice card
    const firstInvoice = page.locator('.invoice-card').first();

    if (await firstInvoice.count() > 0) {
      console.log('Clicking first invoice...');
      await firstInvoice.click();

      // Wait for modal to appear
      await page.waitForTimeout(3000);

      // Check if modal opened
      const modal = page.locator('.modal-container.active, .modal.show, #modal-container.active');
      const modalVisible = await modal.count() > 0;

      console.log('Modal visible:', modalVisible);
      console.log('Console Errors after click:', consoleErrors);
      console.log('Network Errors after click:', networkErrors);

      // Take screenshot
      await page.screenshot({ path: 'tests/screenshots/edit-modal.png', fullPage: true });
    } else {
      console.log('No invoices to click');
    }
  });

  test('4. Test Approve button flow', async ({ page }) => {
    await page.goto('http://localhost:3001');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Look for a "needs_approval" invoice that can be approved
    const needsApprovalInvoice = page.locator('.invoice-card.status-needs_approval').first();

    if (await needsApprovalInvoice.count() > 0) {
      console.log('Found coded invoice, clicking...');
      await needsApprovalInvoice.click();

      // Wait for modal
      await page.waitForTimeout(3000);

      // Look for Approve button
      const approveBtn = page.locator('button:has-text("Approve")').first();

      if (await approveBtn.count() > 0) {
        console.log('Found Approve button, clicking...');

        // Set up dialog handler for confirm
        page.on('dialog', async dialog => {
          console.log('Dialog appeared:', dialog.message());
          await dialog.accept();
        });

        await approveBtn.click();

        // Wait for response
        await page.waitForTimeout(5000);

        console.log('\n=== AFTER APPROVE CLICK ===');
        console.log('Console Errors:', consoleErrors);
        console.log('Network Errors:', networkErrors);

        await page.screenshot({ path: 'tests/screenshots/after-approve.png', fullPage: true });
      } else {
        console.log('No Approve button found in modal');
        await page.screenshot({ path: 'tests/screenshots/no-approve-btn.png', fullPage: true });
      }
    } else {
      console.log('No coded invoices found');

      // Try quick approve button
      const quickApprove = page.locator('.quick-approve, button:has-text("Approve")').first();
      if (await quickApprove.count() > 0) {
        console.log('Found quick approve button');
      }
    }
  });

  test('5. Test all filter buttons', async ({ page }) => {
    await page.goto('http://localhost:3001');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const filters = ['Needs Approval', 'Approved', 'In Draw', 'Archive'];

    for (const filterText of filters) {
      const filterBtn = page.locator(`.filter-btn:has-text("${filterText}")`);
      if (await filterBtn.count() > 0) {
        console.log(`Clicking filter: ${filterText}`);
        await filterBtn.click();
        await page.waitForTimeout(1000);

        if (consoleErrors.length > 0) {
          console.log(`Errors after ${filterText}:`, consoleErrors);
        }
      }
    }
  });

  test('6. Test Upload Invoice modal', async ({ page }) => {
    await page.goto('http://localhost:3001');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Click upload button
    const uploadBtn = page.locator('button:has-text("Upload Invoice")');
    if (await uploadBtn.count() > 0) {
      await uploadBtn.click();
      await page.waitForTimeout(1000);

      // Check if modal opened
      const modal = page.locator('#uploadInvoiceModal.show, #uploadInvoiceModal:visible');
      console.log('Upload modal visible:', await modal.count() > 0);

      await page.screenshot({ path: 'tests/screenshots/upload-modal.png', fullPage: true });

      // Close it
      const closeBtn = page.locator('#uploadInvoiceModal .close-btn, #uploadInvoiceModal button:has-text("Cancel")').first();
      if (await closeBtn.count() > 0) {
        await closeBtn.click();
      }
    }
  });

  test('7. Debug: Check what happens on invoice click', async ({ page }) => {
    await page.goto('http://localhost:3001');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Inject debug logging
    await page.evaluate(() => {
      window.debugLog = [];
      const origFetch = window.fetch;
      window.fetch = async (...args) => {
        window.debugLog.push({ type: 'fetch', url: args[0], time: Date.now() });
        console.log('[DEBUG FETCH]', args[0]);
        try {
          const result = await origFetch(...args);
          window.debugLog.push({ type: 'fetch-done', url: args[0], status: result.status });
          return result;
        } catch (e) {
          window.debugLog.push({ type: 'fetch-error', url: args[0], error: e.message });
          throw e;
        }
      };
    });

    const firstInvoice = page.locator('.invoice-card').first();
    if (await firstInvoice.count() > 0) {
      // Get invoice ID
      const onclick = await firstInvoice.getAttribute('onclick');
      console.log('Invoice onclick:', onclick);

      await firstInvoice.click();

      // Wait and capture
      await page.waitForTimeout(5000);

      // Get debug log
      const debugLog = await page.evaluate(() => window.debugLog);
      console.log('\n=== FETCH LOG ===');
      debugLog.forEach(entry => console.log(entry));

      console.log('\n=== CONSOLE ERRORS ===');
      consoleErrors.forEach(err => console.log(err));

      console.log('\n=== NETWORK ERRORS ===');
      networkErrors.forEach(err => console.log(err));

      // Check modal state
      const modalContainer = page.locator('#modal-container');
      const hasActive = await modalContainer.evaluate(el => el?.classList.contains('active'));
      const innerHTML = await modalContainer.innerHTML();
      console.log('\n=== MODAL STATE ===');
      console.log('Has active class:', hasActive);
      console.log('Modal HTML length:', innerHTML.length);

      await page.screenshot({ path: 'tests/screenshots/debug-after-click.png', fullPage: true });
    }
  });

  test.afterEach(async ({}, testInfo) => {
    console.log('\n========================================');
    console.log(`Test: ${testInfo.title}`);
    console.log('Status:', testInfo.status);
    console.log('Total Console Errors:', consoleErrors.length);
    console.log('Total Network Errors:', networkErrors.length);
    console.log('========================================\n');
  });
});

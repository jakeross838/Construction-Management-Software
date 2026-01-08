const { test, expect } = require('@playwright/test');

test.describe('Debug Invoice Modal - Budget Impact', () => {
  test('Debug: Check if Budget Impact section shows in invoice modal', async ({ page }) => {
    // Collect errors
    const errors = [];
    const logs = [];
    const networkRequests = [];

    page.on('console', msg => {
      const text = msg.text();
      logs.push({ type: msg.type(), text });
      if (msg.type() === 'error') {
        errors.push('CONSOLE ERROR: ' + text);
      }
    });

    page.on('pageerror', err => {
      errors.push('PAGE ERROR: ' + err.message);
    });

    page.on('response', async response => {
      const url = response.url();
      if (url.includes('/api/')) {
        networkRequests.push({
          url: url,
          status: response.status(),
          ok: response.ok()
        });
        if (!response.ok()) {
          errors.push(`HTTP ${response.status()}: ${url}`);
        }
      }
    });

    // Go to page with cache bust
    console.log('\n=== NAVIGATING TO PAGE ===');
    await page.goto('http://localhost:3001?cachebust=' + Date.now());
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    console.log('Page loaded');
    console.log('Errors so far:', errors);

    // Check if we have invoice cards
    const invoiceCards = await page.locator('.invoice-card').count();
    console.log('Invoice cards found:', invoiceCards);

    if (invoiceCards === 0) {
      console.log('ERROR: No invoice cards found!');
      console.log('Network requests:', networkRequests);
      return;
    }

    // Click the first invoice
    console.log('\n=== CLICKING FIRST INVOICE ===');
    await page.locator('.invoice-card').first().click();
    await page.waitForTimeout(3000);

    // Check what API calls were made
    console.log('\n=== NETWORK REQUESTS ===');
    networkRequests.forEach(req => {
      console.log(`  ${req.ok ? '✓' : '✗'} ${req.status} ${req.url}`);
    });

    // Check if approval-context endpoint was called
    const approvalContextCall = networkRequests.find(r => r.url.includes('approval-context'));
    if (approvalContextCall) {
      console.log('\n✓ approval-context API was called');
    } else {
      console.log('\n✗ approval-context API was NOT called!');
    }

    // Take screenshot
    await page.screenshot({ path: 'tests/screenshots/budget-impact-test.png', fullPage: true });

    // Check if edit modal is open (modal container with active class or visible modal)
    const modalContainer = page.locator('#modal-container');
    const isActive = await modalContainer.evaluate(el => el.classList.contains('active'));
    console.log('\n=== MODAL STATE ===');
    console.log('Modal container active:', isActive);

    if (!isActive) {
      console.log('ERROR: Modal did not open!');
      console.log('All errors:', errors);
      return;
    }

    // Check for Budget Standing section (in edit modal form)
    console.log('\n=== CHECKING FOR BUDGET STANDING SECTION ===');

    const budgetStanding = page.locator('.budget-standing-section');
    const budgetStandingCount = await budgetStanding.count();
    console.log('Budget Standing sections found:', budgetStandingCount);

    if (budgetStandingCount > 0) {
      console.log('✓ Budget Standing section IS showing!');
      const budgetHtml = await budgetStanding.first().innerHTML();
      console.log('Budget Standing HTML preview:', budgetHtml.substring(0, 800));
    } else {
      console.log('✗ Budget Impact section NOT found!');

      // Debug: Check form panel content
      const formPanel = page.locator('.form-panel');
      const formPanelCount = await formPanel.count();
      console.log('\nForm panel found:', formPanelCount);

      if (formPanelCount > 0) {
        const formHtml = await formPanel.first().innerHTML();
        console.log('Form panel HTML preview:', formHtml.substring(0, 2000));
      }

      // Check if there's any approval-context class
      const anyContext = await page.locator('[class*="impact"], [class*="budget"], [class*="context"]').count();
      console.log('\nElements with impact/budget/context class:', anyContext);
    }

    // Check for JS errors
    console.log('\n=== ERRORS SUMMARY ===');
    if (errors.length === 0) {
      console.log('✓ No errors detected');
    } else {
      console.log('✗ Errors found:');
      errors.forEach((e, i) => console.log(`  ${i + 1}. ${e}`));
    }

    // Fetch approval context directly to see what it returns
    console.log('\n=== TESTING API DIRECTLY ===');
    const invoiceId = await page.evaluate(() => {
      return window.state?.currentInvoiceId;
    });
    console.log('Current invoice ID from state:', invoiceId);

    if (invoiceId) {
      const response = await page.evaluate(async (id) => {
        const res = await fetch(`/api/invoices/${id}/approval-context`);
        return { status: res.status, data: await res.json() };
      }, invoiceId);
      console.log('Direct API response:', JSON.stringify(response, null, 2));
    }
  });
});

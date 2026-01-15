const { test, expect } = require('@playwright/test');

test.describe('Debug Modal Issues', () => {
  test('Debug edit modal opening', async ({ page }) => {
    // Collect console logs
    const logs = [];
    page.on('console', msg => {
      logs.push(`[${msg.type()}] ${msg.text()}`);
    });

    await page.goto('http://localhost:3001');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    // Screenshot 1: Initial dashboard
    await page.screenshot({ path: 'tests/screenshots/debug-1-dashboard.png', fullPage: true });

    // Get invoice cards
    const invoiceCards = await page.$$('.invoice-card');
    console.log('Invoice cards found:', invoiceCards.length);

    if (invoiceCards.length > 0) {
      // Click first invoice card
      console.log('Clicking first invoice card...');
      await invoiceCards[0].click();

      // Wait for modal backdrop to appear
      await page.waitForSelector('.modal-backdrop', { timeout: 10000 });
      console.log('Modal backdrop appeared');

      // Wait for animation to complete
      await page.waitForTimeout(500);

      // Screenshot 2: After click - full page
      await page.screenshot({ path: 'tests/screenshots/debug-2-after-click.png', fullPage: true });

      // Screenshot 3: Just the modal element
      const modal = await page.$('.modal-fullscreen');
      if (modal) {
        await modal.screenshot({ path: 'tests/screenshots/debug-3-modal-only.png' });
        console.log('Modal element screenshot captured');
      }

      // Get modal computed styles
      const modalStyles = await page.evaluate(() => {
        const modal = document.querySelector('.modal-fullscreen');
        if (!modal) return null;
        const styles = window.getComputedStyle(modal);
        return {
          display: styles.display,
          visibility: styles.visibility,
          opacity: styles.opacity,
          position: styles.position,
          right: styles.right,
          width: styles.width,
          zIndex: styles.zIndex,
          transform: styles.transform
        };
      });
      console.log('Modal computed styles:', JSON.stringify(modalStyles, null, 2));

      // Check backdrop styles
      const backdropStyles = await page.evaluate(() => {
        const backdrop = document.querySelector('.modal-backdrop');
        if (!backdrop) return null;
        const styles = window.getComputedStyle(backdrop);
        return {
          display: styles.display,
          position: styles.position,
          zIndex: styles.zIndex,
          background: styles.background
        };
      });
      console.log('Backdrop computed styles:', JSON.stringify(backdropStyles, null, 2));
    }

    // Print relevant console logs
    console.log('\n=== Console Logs ===');
    logs.filter(l => l.includes('MODAL') || l.includes('Error') || l.includes('error')).forEach(l => console.log(l));
  });

  test('Test Upload Modal (known working)', async ({ page }) => {
    await page.goto('http://localhost:3001');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    // Click upload button
    const uploadBtn = await page.$('button:has-text("Upload Invoice")');
    if (uploadBtn) {
      await uploadBtn.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'tests/screenshots/debug-4-upload-modal.png', fullPage: true });
    }
  });

  test('Capture all UI states', async ({ page }) => {
    await page.goto('http://localhost:3001');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    // 1. Dashboard
    await page.screenshot({ path: 'tests/screenshots/ui-1-dashboard.png', fullPage: true });

    // 2. Click invoice to open edit modal
    const invoice = await page.$('.invoice-card');
    if (invoice) {
      await invoice.click();
      await page.waitForSelector('.modal-backdrop', { timeout: 10000 });
      await page.waitForTimeout(500);

      // Capture the viewport (not fullPage) to see actual render
      await page.screenshot({ path: 'tests/screenshots/ui-2-edit-modal.png' });

      // Close modal
      const closeBtn = await page.$('.modal-close');
      if (closeBtn) await closeBtn.click();
      await page.waitForTimeout(500);
    }

    // 3. Upload modal
    const uploadBtn = await page.$('button:has-text("Upload Invoice")');
    if (uploadBtn) {
      await uploadBtn.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'tests/screenshots/ui-3-upload-modal.png' });

      // Close
      const cancelBtn = await page.$('button:has-text("Cancel")');
      if (cancelBtn) await cancelBtn.click();
      await page.waitForTimeout(500);
    }

    // 4. PO page
    await page.goto('http://localhost:3001/pos.html');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'tests/screenshots/ui-4-pos-page.png', fullPage: true });

    // 5. Draws page
    await page.goto('http://localhost:3001/draws.html');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'tests/screenshots/ui-5-draws-page.png', fullPage: true });
  });
});

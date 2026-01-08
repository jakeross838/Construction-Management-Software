const { test, expect } = require('@playwright/test');

test.describe('Full Modal Style Check', () => {
  test('Capture full invoice modal with scroll', async ({ page }) => {
    await page.goto('http://localhost:3001?cachebust=' + Date.now());
    await page.waitForTimeout(2000);

    // Click first invoice
    await page.locator('.invoice-card').first().click();
    await page.waitForTimeout(2000);

    // Take full modal screenshot
    await page.screenshot({ path: 'tests/screenshots/modal-full.png', fullPage: true });

    // Get the form panel and scroll it
    const formPanel = page.locator('.form-panel');

    // Scroll to top
    await formPanel.evaluate(el => el.scrollTop = 0);
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'tests/screenshots/modal-top.png', fullPage: true });

    // Scroll to show Line Items section header
    await formPanel.evaluate(el => el.scrollTop = 280);
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'tests/screenshots/modal-line-items.png', fullPage: true });

    // Scroll to middle
    await formPanel.evaluate(el => el.scrollTop = el.scrollHeight / 2);
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'tests/screenshots/modal-middle.png', fullPage: true });

    // Scroll to bottom
    await formPanel.evaluate(el => el.scrollTop = el.scrollHeight);
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'tests/screenshots/modal-bottom.png', fullPage: true });

    // Click View history to expand activity
    const viewHistoryBtn = page.locator('button:has-text("View history"), .btn-link:has-text("View history")');
    if (await viewHistoryBtn.count() > 0) {
      await viewHistoryBtn.click();
      await page.waitForTimeout(500);

      // Scroll form panel to show the full status pipeline
      await formPanel.evaluate(el => el.scrollTop = el.scrollHeight);
      await page.waitForTimeout(300);
      await page.screenshot({ path: 'tests/screenshots/modal-activity-expanded.png', fullPage: true });
    }

    console.log('Screenshots saved to tests/screenshots/');
  });
});

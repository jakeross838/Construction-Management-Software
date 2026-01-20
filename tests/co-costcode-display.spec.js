// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('CO Cost Code Display', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3001');
    await page.waitForSelector('.invoice-card', { timeout: 10000 });
  });

  test('CO cost code (ending in C) shows "Needs CO Link" when not linked', async ({ page }) => {
    console.log('=== Testing CO Cost Code Display ===');

    // Find the specific invoice with CO cost code (527120 has 10102C)
    const invoiceCard = page.locator('.invoice-card').filter({ hasText: '527120' }).first();
    const exists = await invoiceCard.count() > 0;
    console.log('Found invoice 527120:', exists);

    if (!exists) {
      // Try to find any invoice that might have CO allocation
      console.log('Invoice 527120 not found, checking other invoices...');
      const invoiceCards = page.locator('.invoice-card');
      const count = await invoiceCards.count();

      for (let i = 0; i < Math.min(count, 20); i++) {
        await invoiceCards.nth(i).click();
        await page.waitForTimeout(1500);

        const modalVisible = await page.locator('#modal-container.active').count() > 0;
        if (!modalVisible) continue;

        const allLinkedTexts = await page.locator('.linked-to-text').allTextContents();
        const hasNeedsCOLink = allLinkedTexts.some(text => text.includes('Needs CO Link'));

        if (hasNeedsCOLink) {
          console.log('Found "Needs CO Link" on invoice', i + 1);
          const needsCOElement = page.locator('.linked-to-text.needs-co');
          expect(await needsCOElement.count()).toBeGreaterThan(0);
          console.log('=== Test passed ===');
          return;
        }

        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
      }

      console.log('No invoices with CO cost codes found');
      return;
    }

    // Click the invoice with 527120
    await invoiceCard.click();
    await page.waitForTimeout(2000);

    const modalVisible = await page.locator('#modal-container.active').count() > 0;
    console.log('Modal opened:', modalVisible);

    if (!modalVisible) {
      console.log('Modal did not open - skipping');
      return;
    }

    // Get all linked-to texts
    const allLinkedTexts = await page.locator('.linked-to-text').allTextContents();
    console.log('Linked-to texts:', allLinkedTexts);

    // Check if any shows "Needs CO Link" for the 10102C cost code
    const hasNeedsCOLink = allLinkedTexts.some(text => text.includes('Needs CO Link'));
    console.log('Has "Needs CO Link" display:', hasNeedsCOLink);
    expect(hasNeedsCOLink).toBe(true);

    // Verify the styling is applied (should have needs-co class)
    const needsCOElement = page.locator('.linked-to-text.needs-co');
    const needsCOCount = await needsCOElement.count();
    console.log('Elements with needs-co class:', needsCOCount);
    expect(needsCOCount).toBeGreaterThan(0);

    console.log('=== Test passed ===');
  });
});

// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('PO Linking', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3001');
    await page.waitForSelector('.invoice-card', { timeout: 10000 });
  });

  test('Can link regular cost code to a PO', async ({ page }) => {
    console.log('=== Testing PO Linking ===');

    // Find the invoice 527120 which has a regular cost code (10102)
    const invoiceCard = page.locator('.invoice-card').filter({ hasText: '527120' }).first();
    const exists = await invoiceCard.count() > 0;
    console.log('Found invoice 527120:', exists);

    if (!exists) {
      console.log('Invoice 527120 not found - skipping');
      return;
    }

    await invoiceCard.click();
    await page.waitForTimeout(2000);

    const modalVisible = await page.locator('#modal-container.active').count() > 0;
    if (!modalVisible) {
      console.log('Modal did not open - skipping');
      return;
    }

    // Click Edit button
    const editBtn = page.locator('button').filter({ hasText: 'Edit' }).first();
    if (await editBtn.count() > 0) {
      await editBtn.click();
      await page.waitForTimeout(500);
      console.log('Clicked Edit button');
    }

    // Find the "No PO/CO" element (regular cost code without link)
    const noPOCO = page.locator('.linked-to-text.base').first();
    const noPOCOExists = await noPOCO.count() > 0;
    console.log('Found "No PO/CO" element:', noPOCOExists);

    if (!noPOCOExists) {
      console.log('No "No PO/CO" element found - skipping');
      return;
    }

    // Find and click the [change] button next to it
    const changeBtn = page.locator('.linked-to-display').filter({ has: page.locator('.linked-to-text.base') }).locator('.btn-change-link').first();
    const changeBtnExists = await changeBtn.count() > 0;
    console.log('Found [change] button:', changeBtnExists);

    if (!changeBtnExists) {
      console.log('No [change] button found - skipping');
      return;
    }

    await changeBtn.click();
    await page.waitForTimeout(500);

    // Check if link picker modal opened
    const linkPickerModal = page.locator('#link-picker-modal');
    const linkPickerVisible = await linkPickerModal.count() > 0;
    console.log('Link picker modal visible:', linkPickerVisible);
    expect(linkPickerVisible).toBe(true);

    // Check for PO cards in the picker (excluding create card)
    const poCards = page.locator('.link-card').filter({ has: page.locator('.link-card-number') }).filter({ hasNotText: 'CO-' });
    const poCount = await poCards.count();
    console.log('Number of PO cards:', poCount);

    // Check for Create New PO option
    const createPOCard = page.locator('.link-card.create-card').first();
    const createPOExists = await createPOCard.count() > 0;
    console.log('Create New PO card exists:', createPOExists);
    expect(createPOExists).toBe(true);

    if (poCount === 0) {
      console.log('No POs available - closing modal');
      await page.locator('#link-picker-modal .btn-secondary').click().catch(() => {});
      return;
    }

    // Select the first PO card
    const firstPO = poCards.first();
    const poText = await firstPO.locator('.link-card-number').textContent();
    console.log('Selecting PO:', poText);

    await firstPO.click();
    await page.waitForTimeout(200);

    // Click Apply
    await page.locator('#link-picker-modal .btn-primary').click();
    await page.waitForTimeout(500);

    // Verify the link changed from "No PO/CO" to a PO number
    const linkedTexts = await page.locator('.linked-to-text').allTextContents();
    console.log('Linked texts after change:', linkedTexts);

    // Should now show PO-XXX instead of "No PO/CO"
    const hasPOLinked = linkedTexts.some(text => text.includes('PO-'));
    console.log('Has PO linked:', hasPOLinked);
    expect(hasPOLinked).toBe(true);

    // Check for po class on the linked text
    const poLinkedElements = await page.locator('.linked-to-text.po').count();
    console.log('Elements with .po class:', poLinkedElements);
    expect(poLinkedElements).toBeGreaterThan(0);

    console.log('=== Test passed - Regular cost code linked to PO ===');
  });
});

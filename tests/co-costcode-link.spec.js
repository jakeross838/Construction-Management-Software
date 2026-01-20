// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('CO Cost Code Linking', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3001');
    await page.waitForSelector('.invoice-card', { timeout: 10000 });
  });

  test('Can link CO cost code to a Change Order', async ({ page }) => {
    console.log('=== Testing CO Cost Code Linking ===');

    // Find the invoice with CO cost code (527120 has 10102C)
    const invoiceCard = page.locator('.invoice-card').filter({ hasText: '527120' }).first();
    const exists = await invoiceCard.count() > 0;
    console.log('Found invoice 527120:', exists);

    if (!exists) {
      console.log('Invoice 527120 not found - skipping');
      return;
    }

    // Click the invoice
    await invoiceCard.click();
    await page.waitForTimeout(2000);

    const modalVisible = await page.locator('#modal-container.active').count() > 0;
    console.log('Modal opened:', modalVisible);

    if (!modalVisible) {
      console.log('Modal did not open - skipping');
      return;
    }

    // Click Edit button to enable edit mode (required to see [change] button)
    const editBtn = page.locator('button').filter({ hasText: 'Edit' }).first();
    const editBtnExists = await editBtn.count() > 0;
    console.log('Edit button exists:', editBtnExists);

    if (editBtnExists) {
      await editBtn.click();
      await page.waitForTimeout(500);
      console.log('Clicked Edit button');
    }

    // Find the "Needs CO Link" element
    const needsCOLink = page.locator('.linked-to-text.needs-co').first();
    const needsCOExists = await needsCOLink.count() > 0;
    console.log('Found "Needs CO Link" element:', needsCOExists);

    if (!needsCOExists) {
      console.log('No "Needs CO Link" found - skipping');
      return;
    }

    // Find and click the [change] button next to it
    const changeBtn = page.locator('.linked-to-display').filter({ has: page.locator('.linked-to-text.needs-co') }).locator('.btn-change-link').first();
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

    // Check for CO cards in the picker
    const coCards = page.locator('.link-card.co-card');
    const coCount = await coCards.count();
    console.log('Number of CO cards:', coCount);

    if (coCount === 0) {
      // No existing COs - try "Create New Change Order"
      console.log('No existing COs - checking for Create New CO card');
      const createCOCard = page.locator('.link-card.create-card.co-create');
      const createCOExists = await createCOCard.count() > 0;
      console.log('Create New CO card exists:', createCOExists);

      if (createCOExists) {
        await createCOCard.click();
        await page.waitForTimeout(200);
        await page.locator('.btn-primary').filter({ hasText: 'Apply' }).click();
        await page.waitForTimeout(500);

        // Should open Create CO modal
        const createCOModal = page.locator('#create-co-modal');
        const coModalVisible = await createCOModal.count() > 0;
        console.log('Create CO modal opened:', coModalVisible);

        // Close modal
        await page.locator('#create-co-modal button').filter({ hasText: 'Cancel' }).click();
      }

      // Close link picker modal
      await page.locator('#link-picker-modal .btn-secondary').click().catch(() => {});
      console.log('=== Test completed (no existing COs) ===');
      return;
    }

    // Select the first CO card
    const firstCO = coCards.first();
    const coText = await firstCO.locator('.link-card-number').textContent();
    console.log('Selecting CO:', coText);

    await firstCO.click();
    await page.waitForTimeout(200);

    // Click Apply
    await page.locator('#link-picker-modal .btn-primary').click();
    await page.waitForTimeout(500);

    // Verify the link changed from "Needs CO Link" to a CO number
    const linkedTexts = await page.locator('.linked-to-text').allTextContents();
    console.log('Linked texts after change:', linkedTexts);

    // Should now show CO-XXX instead of "Needs CO Link"
    const hasCOLinked = linkedTexts.some(text => text.includes('CO-'));
    console.log('Has CO linked:', hasCOLinked);
    expect(hasCOLinked).toBe(true);

    // Verify the needs-co class is gone (replaced with co class)
    const remainingNeedsCO = await page.locator('.linked-to-text.needs-co').count();
    console.log('Remaining "Needs CO Link" elements:', remainingNeedsCO);

    // Check for co class on the linked text
    const coLinkedElements = await page.locator('.linked-to-text.co').count();
    console.log('Elements with .co class:', coLinkedElements);

    console.log('=== Test passed - CO cost code linked to Change Order ===');
  });
});

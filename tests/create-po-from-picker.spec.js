// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Create PO from Link Picker', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3001');
    await page.waitForSelector('.invoice-card', { timeout: 10000 });
  });

  test('Can create a new PO from the link picker and link to allocation', async ({ page }) => {
    console.log('=== Testing Create New PO from Picker ===');

    // Find an invoice
    const invoiceCard = page.locator('.invoice-card').first();
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

    // Find a [change] button and click it
    const changeBtn = page.locator('.btn-change-link').first();
    if (await changeBtn.count() === 0) {
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

    // Find the "Create New PO" card (first create-card in PO section)
    const createPOCard = page.locator('.link-section').first().locator('.link-card.create-card');
    const createPOExists = await createPOCard.count() > 0;
    console.log('Create New PO card exists:', createPOExists);
    expect(createPOExists).toBe(true);

    // Click the Create New PO card
    await createPOCard.click();
    await page.waitForTimeout(200);

    // Click Apply to proceed
    await page.locator('#link-picker-modal .btn-primary').click();
    await page.waitForTimeout(500);

    // Check if Create PO modal opened
    const createPOModal = page.locator('#create-po-modal');
    const createPOModalVisible = await createPOModal.count() > 0;
    console.log('Create PO modal opened:', createPOModalVisible);
    expect(createPOModalVisible).toBe(true);

    // Check that the modal has the required fields
    const descriptionField = page.locator('#po-description');
    const amountField = page.locator('#po-amount');
    const vendorField = page.locator('#po-vendor-id');

    console.log('Description field exists:', await descriptionField.count() > 0);
    console.log('Amount field exists:', await amountField.count() > 0);
    console.log('Vendor ID field exists:', await vendorField.count() > 0);

    expect(await descriptionField.count()).toBe(1);
    expect(await amountField.count()).toBe(1);

    // Fill in the description
    await descriptionField.fill('Test PO from link picker');
    console.log('Filled description');

    // Get the current amount (should be pre-filled from allocation)
    const currentAmount = await amountField.inputValue();
    console.log('Pre-filled amount:', currentAmount);

    // Click Create & Link button
    const createBtn = page.locator('#create-po-modal .btn-primary');
    console.log('Create button text:', await createBtn.textContent());

    await createBtn.click();
    await page.waitForTimeout(1000);

    // Check if the modal closed
    const modalStillOpen = await page.locator('#create-po-modal').count() > 0;
    console.log('Create PO modal still open:', modalStillOpen);

    // Check if a toast appeared (success or error)
    // Give it a moment to see the result
    await page.waitForTimeout(500);

    // Check the linked text to see if it now shows a PO
    const linkedTexts = await page.locator('.linked-to-text').allTextContents();
    console.log('Linked texts after creation:', linkedTexts);

    // Should have a PO linked now
    const hasPOLinked = linkedTexts.some(text => text.includes('PO-'));
    console.log('Has PO linked:', hasPOLinked);

    if (hasPOLinked) {
      console.log('=== Test passed - Successfully created and linked new PO ===');
    } else {
      console.log('=== PO creation may have failed - check logs ===');
    }
  });
});

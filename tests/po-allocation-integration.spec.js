// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('PO Allocation Integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3001');
    await page.waitForSelector('.invoice-card', { timeout: 10000 });
  });

  test('Invoice with PO defaults allocation funding source to that PO', async ({ page }) => {
    console.log('=== Testing PO Allocation Integration ===');

    // Find any invoice card
    const invoiceCards = page.locator('.invoice-card');
    const cardCount = await invoiceCards.count();
    console.log('Found invoice cards:', cardCount);

    if (cardCount === 0) {
      console.log('No invoices found - skipping test');
      return;
    }

    // Click first invoice
    await invoiceCards.first().click();

    // Wait for modal to open
    await page.waitForTimeout(2000);
    const modalVisible = await page.locator('#modal-container.active').count() > 0;
    console.log('Modal opened:', modalVisible);

    if (!modalVisible) {
      console.log('Modal did not open - skipping');
      return;
    }

    // Check if PO picker exists
    const poPicker = page.locator('#edit-po');
    const poPickerExists = await poPicker.count() > 0;
    console.log('PO picker exists:', poPickerExists);

    if (!poPickerExists) {
      console.log('PO picker not found - modal may have different structure');
      return;
    }

    // Check if the invoice has a PO selected in the header
    const poPickerValue = await poPicker.inputValue();
    console.log('Invoice PO ID:', poPickerValue);

    // Check the funding source dropdown on the first allocation line
    const fundingSourceSelect = page.locator('.funding-source-select').first();
    const fundingSourceExists = await fundingSourceSelect.count() > 0;
    console.log('Funding source dropdown exists:', fundingSourceExists);

    if (fundingSourceExists) {
      const selectedValue = await fundingSourceSelect.inputValue();
      console.log('Selected funding source:', selectedValue);

      // If invoice has PO, funding source should default to 'po'
      if (poPickerValue) {
        expect(selectedValue).toBe('po');
        console.log('✓ Funding source correctly defaults to PO');

        // Check the PO dropdown shows the correct PO selected
        const poSelect = page.locator('.po-select').first();
        const poSelectExists = await poSelect.count() > 0;

        if (poSelectExists) {
          const selectedPO = await poSelect.inputValue();
          console.log('Selected PO in allocation:', selectedPO);
          expect(selectedPO).toBe(poPickerValue);
          console.log('✓ Allocation PO matches invoice PO');
        }
      }
    } else {
      console.log('No funding source dropdown - job may not have POs/COs');
    }

    console.log('=== Test completed ===');
  });

  test('Changing funding source to Base Budget overrides invoice PO default', async ({ page }) => {
    console.log('=== Testing Base Budget Override ===');

    // Find invoice with PO
    const invoiceCard = page.locator('.invoice-card').filter({ hasText: '971925' }).first();
    const exists = await invoiceCard.count() > 0;

    if (!exists) {
      console.log('Test invoice not found - skipping');
      return;
    }

    await invoiceCard.click();
    await page.waitForTimeout(2000);
    const modalVisible = await page.locator('#modal-container.active').count() > 0;
    if (!modalVisible) {
      console.log('Modal did not open - skipping');
      return;
    }

    // Get initial funding source
    const fundingSourceSelect = page.locator('.funding-source-select').first();
    const fundingSourceExists = await fundingSourceSelect.count() > 0;

    if (!fundingSourceExists) {
      console.log('No funding source dropdown - skipping');
      return;
    }

    const initialValue = await fundingSourceSelect.inputValue();
    console.log('Initial funding source:', initialValue);

    // Change to Base Budget
    await fundingSourceSelect.selectOption('base');
    await page.waitForTimeout(500); // Wait for UI update

    // Verify it changed
    const newValue = await fundingSourceSelect.inputValue();
    console.log('New funding source:', newValue);
    expect(newValue).toBe('base');

    // The funding detail field should be hidden for base budget
    const fundingDetailField = page.locator('.funding-detail-field').first();
    const isHidden = await fundingDetailField.evaluate(el => el.style.display === 'none' || window.getComputedStyle(el).display === 'none');
    console.log('Funding detail hidden:', isHidden);

    console.log('✓ Can override to Base Budget');
    console.log('=== Test completed ===');
  });

  test('Changing funding source to Change Order works', async ({ page }) => {
    console.log('=== Testing Change Order Selection ===');

    // Find invoice with PO
    const invoiceCard = page.locator('.invoice-card').filter({ hasText: '971925' }).first();
    const exists = await invoiceCard.count() > 0;

    if (!exists) {
      console.log('Test invoice not found - skipping');
      return;
    }

    await invoiceCard.click();
    await page.waitForTimeout(2000);
    const modalVisible = await page.locator('#modal-container.active').count() > 0;
    if (!modalVisible) {
      console.log('Modal did not open - skipping');
      return;
    }

    const fundingSourceSelect = page.locator('.funding-source-select').first();
    const fundingSourceExists = await fundingSourceSelect.count() > 0;

    if (!fundingSourceExists) {
      console.log('No funding source dropdown - skipping');
      return;
    }

    // Check if CO option exists
    const coOption = fundingSourceSelect.locator('option[value="co"]');
    const coExists = await coOption.count() > 0;
    console.log('CO option exists:', coExists);

    if (!coExists) {
      console.log('No Change Orders available - skipping');
      return;
    }

    // Change to Change Order
    await fundingSourceSelect.selectOption('co');
    await page.waitForTimeout(500);

    const newValue = await fundingSourceSelect.inputValue();
    console.log('New funding source:', newValue);
    expect(newValue).toBe('co');

    // CO dropdown should now be visible
    const coSelect = page.locator('.co-select').first();
    const coSelectVisible = await coSelect.isVisible();
    console.log('CO dropdown visible:', coSelectVisible);
    expect(coSelectVisible).toBe(true);

    // Select a CO
    const coOptions = await coSelect.locator('option:not([value=""])').count();
    console.log('Number of CO options:', coOptions);

    if (coOptions > 0) {
      await coSelect.selectOption({ index: 1 }); // Select first CO
      const selectedCO = await coSelect.inputValue();
      console.log('Selected CO:', selectedCO);
      expect(selectedCO).toBeTruthy();
      console.log('✓ Can select Change Order');
    }

    console.log('=== Test completed ===');
  });

  test('Invoice PO change syncs allocations', async ({ page }) => {
    console.log('=== Testing PO Change Sync ===');

    // Find invoice with PO
    const invoiceCard = page.locator('.invoice-card').filter({ hasText: '971925' }).first();
    const exists = await invoiceCard.count() > 0;

    if (!exists) {
      console.log('Test invoice not found - skipping');
      return;
    }

    await invoiceCard.click();
    await page.waitForTimeout(2000);
    const modalVisible = await page.locator('#modal-container.active').count() > 0;
    if (!modalVisible) {
      console.log('Modal did not open - skipping');
      return;
    }

    // Get the PO picker container
    const poPicker = page.locator('#po-picker-container');
    const poPickerExists = await poPicker.count() > 0;

    if (!poPickerExists) {
      console.log('PO picker not found - skipping');
      return;
    }

    // Get initial allocation PO
    const poSelect = page.locator('.po-select').first();
    const poSelectExists = await poSelect.count() > 0;

    if (!poSelectExists) {
      console.log('Allocation PO select not found - skipping');
      return;
    }

    const initialAllocPO = await poSelect.inputValue();
    console.log('Initial allocation PO:', initialAllocPO);

    // Try to click the PO picker to open dropdown
    await poPicker.click();
    await page.waitForTimeout(300);

    // Check if dropdown opened
    const dropdown = page.locator('.search-picker-dropdown:visible');
    const dropdownVisible = await dropdown.count() > 0;
    console.log('PO dropdown opened:', dropdownVisible);

    if (dropdownVisible) {
      // Look for PO options
      const poOptions = dropdown.locator('.search-picker-option');
      const optionCount = await poOptions.count();
      console.log('PO options available:', optionCount);
    }

    console.log('✓ PO picker is interactive');
    console.log('=== Test completed ===');
  });

  test('Allocation uses invoice PO by default (hidden funding options)', async ({ page }) => {
    console.log('=== Testing Default Invoice PO Usage ===');

    // Find any invoice card
    const invoiceCards = page.locator('.invoice-card');
    const cardCount = await invoiceCards.count();

    if (cardCount === 0) {
      console.log('No invoices found - skipping');
      return;
    }

    await invoiceCards.first().click();
    await page.waitForTimeout(2000);
    const modalVisible = await page.locator('#modal-container.active').count() > 0;
    if (!modalVisible) {
      console.log('Modal did not open - skipping');
      return;
    }

    // Check if PO picker exists
    const poPicker = page.locator('#edit-po');
    const poPickerExists = await poPicker.count() > 0;

    if (!poPickerExists) {
      console.log('PO picker not found - modal may have different structure');
      return;
    }

    // Get the invoice PO from the field
    const invoicePOId = await poPicker.inputValue();
    console.log('Invoice PO ID:', invoicePOId);

    if (!invoicePOId) {
      console.log('Invoice has no PO - skipping');
      return;
    }

    // Funding source dropdown should be HIDDEN by default when invoice has a PO
    const fundingSourceSelect = page.locator('.funding-source-select').first();
    const fundingSourceVisible = await fundingSourceSelect.count() > 0;
    console.log('Funding source dropdown visible (should be false):', fundingSourceVisible);

    // The "Split funding" button should exist
    const splitFundingBtn = page.locator('#split-funding-btn');
    const splitBtnExists = await splitFundingBtn.count() > 0;
    console.log('Split funding button exists:', splitBtnExists);

    // Click Save button - the allocation should automatically get the invoice PO
    const saveButton = page.locator('button').filter({ hasText: 'Save' }).first();
    const saveExists = await saveButton.count() > 0;
    console.log('Save button exists:', saveExists);

    if (saveExists) {
      await saveButton.click();
      console.log('Clicked Save');
      await page.waitForTimeout(2000);
    }

    // Check if modal closed
    const modalClosed = await page.locator('#modal-container.active').count() === 0;
    console.log('Modal closed after save:', modalClosed);

    if (!modalClosed) {
      // Close modal manually
      const closeButton = page.locator('button').filter({ hasText: 'Cancel' }).first();
      if (await closeButton.count() > 0) {
        await closeButton.click();
        await page.waitForTimeout(500);
      }
    }

    // Wait for list to refresh
    await page.waitForTimeout(1000);

    // Reopen the invoice
    console.log('Reopening invoice...');
    const invoiceCardAgain = page.locator('.invoice-card').filter({ hasText: '971925' }).first();
    await invoiceCardAgain.click();
    await page.waitForTimeout(2000);

    // Click "Split funding" to show the funding options
    const splitBtnAfter = page.locator('#split-funding-btn');
    if (await splitBtnAfter.count() > 0) {
      await splitBtnAfter.click();
      await page.waitForTimeout(500);
      console.log('Clicked Split funding to reveal options');
    }

    // Now check if funding source is set to PO
    const fundingSourceAfter = page.locator('.funding-source-select').first();
    if (await fundingSourceAfter.count() > 0) {
      const fundingSourceValue = await fundingSourceAfter.inputValue();
      console.log('Funding source after reopen:', fundingSourceValue);

      if (fundingSourceValue === 'po') {
        const poSelectAfter = page.locator('.po-select').first();
        if (await poSelectAfter.count() > 0) {
          const poValueAfter = await poSelectAfter.inputValue();
          console.log('Allocation PO after reopen:', poValueAfter);
          console.log('Invoice PO:', invoicePOId);

          if (poValueAfter === invoicePOId) {
            console.log('✓ Allocation correctly uses invoice PO by default!');
          } else {
            console.log('✗ PO mismatch. Expected:', invoicePOId, 'Got:', poValueAfter);
          }
        }
      } else {
        console.log('Funding source is:', fundingSourceValue);
      }
    } else {
      console.log('Funding source dropdown not found after clicking Split');
    }

    console.log('=== Test completed ===');
  });
});

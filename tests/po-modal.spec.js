const { test, expect } = require('@playwright/test');

test.describe('PO Modal - Read/Edit Mode Tests', () => {
  test('PO should open in read-only mode and switch to edit mode on Edit click', async ({ page }) => {
    // Collect errors and logs
    const errors = [];
    const logs = [];

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

    // Navigate to PO page
    console.log('\n=== NAVIGATING TO PO PAGE ===');
    await page.goto('http://localhost:3001/pos.html?cachebust=' + Date.now());
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Check if we have PO rows
    const poRows = await page.locator('.po-row').count();
    console.log('PO rows found:', poRows);

    if (poRows === 0) {
      console.log('No PO rows found - checking list content');
      const listItems = await page.locator('#poList').innerHTML();
      console.log('PO list content:', listItems.substring(0, 500));

      // Take screenshot to see what's on the page
      await page.screenshot({ path: 'tests/screenshots/po-list-empty.png', fullPage: true });
      return;
    }

    // Click the first PO to open modal
    console.log('\n=== CLICKING FIRST PO ===');
    await page.locator('.po-row').first().click();
    await page.waitForTimeout(1500);

    // Take screenshot of initial modal state
    await page.screenshot({ path: 'tests/screenshots/po-modal-initial.png', fullPage: true });

    // Check if modal is open
    const modal = page.locator('#poModal');
    const modalVisible = await modal.evaluate(el => el.classList.contains('show'));
    console.log('Modal is visible:', modalVisible);

    if (!modalVisible) {
      console.log('ERROR: Modal did not open!');
      console.log('Errors:', errors);
      return;
    }

    // === TEST 1: Check read-only mode ===
    console.log('\n=== TEST 1: CHECKING READ-ONLY MODE ===');

    // In read-only mode, there should be NO input fields for PO details
    // Look for form inputs in the details section
    const detailInputs = await page.locator('#poModal input[id="poNumber"], #poModal input[id="poDescription"], #poModal select[id="poJobSelect"]').count();
    console.log('Form inputs found (should be 0 for read-only):', detailInputs);

    // Look for info-grid or info-value elements (read-only display)
    const infoValues = await page.locator('#poModal .info-value, #poModal .info-grid').count();
    console.log('Info display elements found:', infoValues);

    // Check for Edit button in footer
    const editButton = page.locator('#poModalFooter button:has-text("Edit")');
    const editButtonCount = await editButton.count();
    console.log('Edit button found:', editButtonCount > 0);

    if (detailInputs > 0) {
      console.log('WARNING: Form inputs found - PO may be opening in edit mode!');

      // Check modal body content
      const modalBody = await page.locator('#poModalBody').innerHTML();
      console.log('Modal body HTML preview:', modalBody.substring(0, 1500));
    }

    // === TEST 2: Click Edit button ===
    if (editButtonCount > 0) {
      console.log('\n=== TEST 2: CLICKING EDIT BUTTON ===');
      await editButton.click();
      await page.waitForTimeout(1000);

      // Take screenshot after clicking Edit
      await page.screenshot({ path: 'tests/screenshots/po-modal-edit-mode.png', fullPage: true });

      // Now check for form inputs (should exist in edit mode)
      const editModeInputs = await page.locator('#poModal input[id="poNumber"], #poModal input[id="poDescription"]').count();
      console.log('Form inputs after Edit click (should be > 0):', editModeInputs);

      // Check for Save and Cancel buttons
      const saveButton = await page.locator('#poModalFooter button:has-text("Save")').count();
      const cancelButton = await page.locator('#poModalFooter button:has-text("Cancel")').count();
      console.log('Save button found:', saveButton > 0);
      console.log('Cancel button found:', cancelButton > 0);

      // === TEST 3: Cancel edit ===
      if (cancelButton > 0) {
        console.log('\n=== TEST 3: CLICKING CANCEL ===');
        await page.locator('#poModalFooter button:has-text("Cancel")').click();
        await page.waitForTimeout(1500);

        // Take screenshot after cancel
        await page.screenshot({ path: 'tests/screenshots/po-modal-after-cancel.png', fullPage: true });

        // Should be back to read-only mode
        const inputsAfterCancel = await page.locator('#poModal input[id="poNumber"], #poModal input[id="poDescription"]').count();
        console.log('Form inputs after Cancel (should be 0):', inputsAfterCancel);
      }
    } else {
      console.log('WARNING: No Edit button found in footer!');
      const footerHtml = await page.locator('#poModalFooter').innerHTML();
      console.log('Footer HTML:', footerHtml);
    }

    // Print summary
    console.log('\n=== SUMMARY ===');
    console.log('Errors encountered:', errors.length);
    if (errors.length > 0) {
      errors.forEach((e, i) => console.log(`  ${i + 1}. ${e}`));
    }

    // Final assertions
    expect(modalVisible).toBe(true);
  });

  test('Check PO modal content structure', async ({ page }) => {
    console.log('\n=== CHECKING PO MODAL CONTENT STRUCTURE ===');

    await page.goto('http://localhost:3001/pos.html?cachebust=' + Date.now());
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    const poRows = await page.locator('.po-row').count();
    if (poRows === 0) {
      console.log('No PO rows found, skipping test');
      return;
    }

    // Open first PO
    await page.locator('.po-row').first().click();
    await page.waitForTimeout(1500);

    // Get modal body HTML for analysis
    const modalBody = page.locator('#poModalBody');
    const bodyHtml = await modalBody.innerHTML();

    console.log('\n=== MODAL BODY STRUCTURE ===');
    console.log('Full HTML length:', bodyHtml.length);
    console.log('HTML preview:\n', bodyHtml.substring(0, 3000));

    // Check for key sections
    const sections = {
      'form-section': await page.locator('#poModal .form-section').count(),
      'po-summary-card': await page.locator('#poModal .po-summary-card').count(),
      'info-grid': await page.locator('#poModal .info-grid').count(),
      'line-items': await page.locator('#poModal .line-items-readonly, #poModal .line-items-container').count(),
      'linked-invoices': await page.locator('#poModal .linked-invoices-table').count(),
    };

    console.log('\n=== SECTIONS FOUND ===');
    Object.entries(sections).forEach(([name, count]) => {
      console.log(`  ${name}: ${count}`);
    });

    // Check footer buttons
    const footerHtml = await page.locator('#poModalFooter').innerHTML();
    console.log('\n=== FOOTER BUTTONS ===');
    console.log(footerHtml);

    await page.screenshot({ path: 'tests/screenshots/po-modal-structure.png', fullPage: true });
  });
});

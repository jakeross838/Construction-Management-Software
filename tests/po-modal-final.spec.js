const { test, expect } = require('@playwright/test');

test.describe('PO Modal - Final Verification', () => {
  test('Complete PO modal workflow test', async ({ page }) => {
    const errors = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push('CONSOLE: ' + msg.text());
      }
    });

    page.on('pageerror', err => {
      errors.push('PAGE ERROR: ' + err.message);
    });

    // Navigate to PO page
    await page.goto('http://localhost:3001/pos.html?cachebust=' + Date.now());
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    const poRows = await page.locator('.po-row').count();
    console.log('PO rows found:', poRows);
    expect(poRows).toBeGreaterThan(0);

    // === TEST 1: Open PO in read-only mode ===
    console.log('\n=== TEST 1: Open PO - should be READ-ONLY ===');
    await page.locator('.po-row').first().click();
    await page.waitForTimeout(1500);

    // Modal should be visible
    const modalVisible = await page.locator('#poModal').evaluate(el => el.classList.contains('show'));
    expect(modalVisible).toBe(true);
    console.log('✓ Modal opened');

    // Should NOT have form inputs in details section (read-only)
    const formInputs = await page.locator('#poModal input[id="poNumber"], #poModal input[id="poDescription"]').count();
    expect(formInputs).toBe(0);
    console.log('✓ No form inputs (read-only mode)');

    // Should have two-panel layout with summary panel
    const summaryPanel = await page.locator('#poModal .po-summary-panel').count();
    expect(summaryPanel).toBe(1);
    console.log('✓ Two-panel layout present');

    // Should have Edit button
    const editBtn = page.locator('#poModalFooter button:has-text("Edit")');
    expect(await editBtn.count()).toBe(1);
    console.log('✓ Edit button present');

    // === TEST 2: Click Edit - should switch to edit mode ===
    console.log('\n=== TEST 2: Click Edit - should be EDIT MODE ===');
    await editBtn.click();
    await page.waitForTimeout(1000);

    // Should now have form inputs
    const editInputs = await page.locator('#poModal input[id="poNumber"]').count();
    expect(editInputs).toBe(1);
    console.log('✓ Form inputs present (edit mode)');

    // Should have Save and Cancel buttons
    const saveBtn = await page.locator('#poModalFooter button:has-text("Save")').count();
    const cancelBtn = await page.locator('#poModalFooter button:has-text("Cancel")').count();
    expect(saveBtn).toBe(1);
    expect(cancelBtn).toBe(1);
    console.log('✓ Save and Cancel buttons present');

    // === TEST 3: Click Cancel - should return to read-only ===
    console.log('\n=== TEST 3: Click Cancel - should return to READ-ONLY ===');
    await page.locator('#poModalFooter button:has-text("Cancel")').click();
    await page.waitForTimeout(1500);

    // Should be back to read-only (no form inputs)
    const inputsAfterCancel = await page.locator('#poModal input[id="poNumber"]').count();
    expect(inputsAfterCancel).toBe(0);
    console.log('✓ No form inputs (back to read-only)');

    // Edit button should be back
    const editBtnAfter = await page.locator('#poModalFooter button:has-text("Edit")').count();
    expect(editBtnAfter).toBe(1);
    console.log('✓ Edit button back');

    // === TEST 4: Check for JS errors ===
    console.log('\n=== TEST 4: Check for errors ===');
    if (errors.length === 0) {
      console.log('✓ No JavaScript errors');
    } else {
      console.log('✗ Errors found:');
      errors.forEach(e => console.log('  ' + e));
    }
    expect(errors.length).toBe(0);

    // === TEST 5: Close modal ===
    console.log('\n=== TEST 5: Close modal ===');
    await page.locator('#poModalFooter button:has-text("Close")').click();
    await page.waitForTimeout(500);

    const modalVisibleAfterClose = await page.locator('#poModal').evaluate(el => el.classList.contains('show'));
    expect(modalVisibleAfterClose).toBe(false);
    console.log('✓ Modal closed');

    console.log('\n=== ALL TESTS PASSED ===');
  });
});

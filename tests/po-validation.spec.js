const { test, expect } = require('@playwright/test');

test('PO form validation prevents empty submission', async ({ page }) => {
  await page.goto('http://localhost:3001/pos.html');
  await page.waitForTimeout(2000);

  // Click New PO button
  await page.click('button:has-text("New PO")');
  await page.waitForTimeout(500);

  // Verify modal is open
  const modalVisible = await page.locator('#poModal').isVisible();
  console.log('Modal visible after open:', modalVisible);

  // Take screenshot
  await page.screenshot({ path: 'tests/screenshots/po-validation-1-modal-open.png' });

  // Click Save Draft without filling anything
  await page.click('button:has-text("Save Draft")');
  await page.waitForTimeout(1000);

  // Take screenshot after save attempt
  await page.screenshot({ path: 'tests/screenshots/po-validation-2-after-save.png' });

  // Modal should still be visible (validation prevented close)
  const modalStillVisible = await page.locator('#poModal').isVisible();
  console.log('Modal visible after save attempt:', modalStillVisible);

  // Check for error toast
  const errorToast = await page.locator('.toast-error, .toast.error').isVisible();
  console.log('Error toast visible:', errorToast);

  expect(modalStillVisible).toBe(true);
});

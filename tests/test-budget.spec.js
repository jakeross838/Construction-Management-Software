const { test } = require('@playwright/test');

test('Budget page test', async ({ page }) => {
  await page.goto('http://localhost:3001/budgets.html');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  // Screenshot initial state
  await page.screenshot({ path: 'tests/screenshots/budget-initial.png', fullPage: true });

  // Select Drummond job
  await page.selectOption('#jobFilter', { label: 'Drummond-501 74th St' });
  await page.waitForTimeout(2000);

  // Screenshot after selection
  await page.screenshot({ path: 'tests/screenshots/budget-selected.png', fullPage: true });

  // Check if modal opened
  const modalVisible = await page.locator('#budgetModal').isVisible();
  console.log('Modal visible:', modalVisible);

  // Screenshot modal if visible
  if (modalVisible) {
    await page.screenshot({ path: 'tests/screenshots/budget-modal.png', fullPage: true });

    // Scroll to see budget lines
    await page.locator('.draw-single-page').evaluate(el => el.scrollTop = 500);
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'tests/screenshots/budget-modal-scroll.png', fullPage: true });

    // Scroll to bottom to see Change Orders
    await page.locator('.draw-single-page').evaluate(el => el.scrollTop = el.scrollHeight);
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'tests/screenshots/budget-modal-bottom.png', fullPage: true });
  }

  console.log('Test complete');
});

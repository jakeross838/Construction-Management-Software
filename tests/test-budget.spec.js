const { test, expect } = require('@playwright/test');

test('Budget page test', async ({ page }) => {
  await page.goto('http://localhost:3001/budgets.html');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  // Screenshot initial state
  await page.screenshot({ path: 'tests/screenshots/budget-initial.png', fullPage: true });

  // Wait for sidebar to load and find the job item
  const jobItem = page.locator('.job-item[data-job-id]:not(.all-jobs)').first();
  await expect(jobItem).toBeVisible({ timeout: 10000 });

  // Click on the job to select it
  await jobItem.click();
  await page.waitForTimeout(2000);

  // Screenshot after selection
  await page.screenshot({ path: 'tests/screenshots/budget-selected.png', fullPage: true });

  // Wait for budget detail section to be visible
  const budgetDetail = page.locator('#budgetDetail');
  await expect(budgetDetail).toBeVisible({ timeout: 10000 });

  // Check that budget title has content
  const budgetTitle = page.locator('#budgetPageTitle');
  await expect(budgetTitle).toBeVisible();

  // Screenshot the budget detail
  await page.screenshot({ path: 'tests/screenshots/budget-detail.png', fullPage: true });

  console.log('Test complete');
});

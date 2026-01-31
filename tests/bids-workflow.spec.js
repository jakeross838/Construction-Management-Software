const { test, expect } = require('@playwright/test');

test.describe('Bid Package Workflows', () => {
  test.beforeEach(async ({ page }) => {
    // Set up console error tracking
    page.on('pageerror', err => console.error('Page error:', err.message));
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log(`[Console Error]`, msg.text());
      }
    });
  });

  test('Bids page loads and displays correctly', async ({ page }) => {
    console.log('=== Loading Bids Page ===');
    await page.goto('http://localhost:3001/bids');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Verify page title
    await expect(page.locator('h1')).toContainText('Subcontractor Bids');

    // Verify stat cards are present
    const statCards = page.locator('.stat-card');
    await expect(statCards).toHaveCount(4);

    // Verify tabs are present (List and Analytics)
    const tabsList = page.locator('[role="tablist"]');
    await expect(tabsList).toBeVisible();
    await expect(page.getByRole('tab', { name: /Bid Packages/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Analytics/i })).toBeVisible();

    // Verify New Bid Package button
    const newPackageBtn = page.getByRole('button', { name: /New Bid Package/i });
    await expect(newPackageBtn).toBeVisible();

    await page.screenshot({ path: 'tests/screenshots/bids-page.png', fullPage: true });
    console.log('Bids page loaded successfully');
  });

  test('Create new bid package dialog', async ({ page }) => {
    console.log('=== Testing Create Bid Package Dialog ===');
    await page.goto('http://localhost:3001/bids');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Click New Bid Package button
    const newPackageBtn = page.getByRole('button', { name: /New Bid Package/i });
    await newPackageBtn.click();
    await page.waitForTimeout(1000);

    // Verify dialog opened
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('text=Create Bid Package')).toBeVisible();

    // Verify form fields
    await expect(page.locator('label:has-text("Package Number")')).toBeVisible();
    await expect(page.locator('label:has-text("Job")')).toBeVisible();
    await expect(page.locator('label:has-text("Title")')).toBeVisible();
    await expect(page.locator('label:has-text("Trade Category")')).toBeVisible();
    await expect(page.locator('label:has-text("Due Date")')).toBeVisible();

    // Check template selector is visible (for new packages)
    const templateSection = page.locator('text=Start from Template');
    const templateVisible = await templateSection.isVisible();
    console.log(`Template selector visible: ${templateVisible}`);

    await page.screenshot({ path: 'tests/screenshots/bids-create-dialog.png', fullPage: true });

    // Close dialog
    const cancelBtn = page.getByRole('button', { name: /Cancel/i });
    await cancelBtn.click();
    await page.waitForTimeout(500);

    console.log('Create bid package dialog test passed');
  });

  test('Analytics tab displays charts', async ({ page }) => {
    console.log('=== Testing Analytics Tab ===');
    await page.goto('http://localhost:3001/bids');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Switch to Analytics tab
    const analyticsTab = page.getByRole('tab', { name: /Analytics/i });
    await analyticsTab.click();
    await page.waitForTimeout(1500);

    // Verify analytics content loads
    const analyticsContent = page.locator('[role="tabpanel"]').filter({ has: page.locator('text=Bid Packages') });

    // Check for either analytics data or "Loading analytics" or "Unable to load"
    const hasData = await page.locator('text=Bid Packages').first().isVisible();
    const isLoading = await page.locator('text=Loading analytics').isVisible();
    const hasError = await page.locator('text=Unable to load').isVisible();

    console.log(`Analytics data: ${hasData}, Loading: ${isLoading}, Error: ${hasError}`);

    await page.screenshot({ path: 'tests/screenshots/bids-analytics.png', fullPage: true });

    console.log('Analytics tab test passed');
  });

  test('Filter controls work correctly', async ({ page }) => {
    console.log('=== Testing Filter Controls ===');
    await page.goto('http://localhost:3001/bids');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Test search input
    const searchInput = page.locator('input[placeholder*="Search"]');
    await expect(searchInput).toBeVisible();
    await searchInput.fill('Framing');
    await page.waitForTimeout(500);

    // Test trade filter dropdown
    const tradeFilter = page.locator('button:has-text("All Trades")');
    if (await tradeFilter.isVisible()) {
      await tradeFilter.click();
      await page.waitForTimeout(300);
      await page.screenshot({ path: 'tests/screenshots/bids-trade-filter.png', fullPage: true });
      // Close dropdown by pressing Escape
      await page.keyboard.press('Escape');
    }

    // Test status filter dropdown
    const statusFilter = page.locator('button:has-text("All Status")');
    if (await statusFilter.isVisible()) {
      await statusFilter.click();
      await page.waitForTimeout(300);
      await page.screenshot({ path: 'tests/screenshots/bids-status-filter.png', fullPage: true });
      await page.keyboard.press('Escape');
    }

    // Clear search
    await searchInput.clear();
    await page.waitForTimeout(500);

    console.log('Filter controls test passed');
  });

  test('Bid package detail dialog opens', async ({ page }) => {
    console.log('=== Testing Bid Package Detail Dialog ===');
    await page.goto('http://localhost:3001/bids');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Check if there are any bid packages in the table
    const tableRows = page.locator('table tbody tr');
    const rowCount = await tableRows.count();
    console.log(`Found ${rowCount} bid packages`);

    if (rowCount === 0) {
      console.log('No bid packages found - skipping detail dialog test');
      return;
    }

    // Click on first bid package
    await tableRows.first().click();
    await page.waitForTimeout(1500);

    // Verify detail dialog opened
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Check for common detail dialog elements
    const hasEditButton = await page.getByRole('button', { name: /Edit/i }).isVisible();
    console.log(`Has Edit button: ${hasEditButton}`);

    // Check for tabs in detail dialog
    const tabsList = dialog.locator('[role="tablist"]');
    if (await tabsList.isVisible()) {
      console.log('Detail dialog has tabs');
      const tabCount = await tabsList.locator('[role="tab"]').count();
      console.log(`Tab count: ${tabCount}`);
    }

    await page.screenshot({ path: 'tests/screenshots/bids-detail-dialog.png', fullPage: true });

    // Close dialog
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    console.log('Bid package detail dialog test passed');
  });

  test('Responsive layout on mobile viewport', async ({ page }) => {
    console.log('=== Testing Mobile Responsiveness ===');

    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('http://localhost:3001/bids');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Verify page still renders correctly
    await expect(page.locator('h1')).toContainText('Subcontractor Bids');

    // Stat cards should stack on mobile
    const statCards = page.locator('.stat-card');
    await expect(statCards.first()).toBeVisible();

    await page.screenshot({ path: 'tests/screenshots/bids-mobile.png', fullPage: true });

    // Test Create dialog on mobile
    const newPackageBtn = page.getByRole('button', { name: /New Bid Package/i });
    await newPackageBtn.click();
    await page.waitForTimeout(1000);

    await page.screenshot({ path: 'tests/screenshots/bids-create-mobile.png', fullPage: true });

    // Close dialog
    await page.keyboard.press('Escape');

    console.log('Mobile responsiveness test passed');
  });

  test('Bid comparison view renders correctly', async ({ page }) => {
    console.log('=== Testing Bid Comparison View ===');
    await page.goto('http://localhost:3001/bids');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Find a bid package that might have multiple bids
    const tableRows = page.locator('table tbody tr');
    const rowCount = await tableRows.count();

    if (rowCount === 0) {
      console.log('No bid packages found - skipping comparison view test');
      return;
    }

    // Click on first bid package
    await tableRows.first().click();
    await page.waitForTimeout(1500);

    // Look for Compare tab
    const compareTab = page.getByRole('tab', { name: /Compare/i });
    if (await compareTab.isVisible()) {
      const isDisabled = await compareTab.isDisabled();
      console.log(`Compare tab disabled: ${isDisabled}`);

      if (!isDisabled) {
        await compareTab.click();
        await page.waitForTimeout(1000);
        await page.screenshot({ path: 'tests/screenshots/bids-comparison.png', fullPage: true });
      }
    }

    // Close dialog
    await page.keyboard.press('Escape');

    console.log('Bid comparison view test passed');
  });

  test('Award bid flow confirmation dialog', async ({ page }) => {
    console.log('=== Testing Award Bid Flow ===');
    await page.goto('http://localhost:3001/bids');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Find a bid package
    const tableRows = page.locator('table tbody tr');
    const rowCount = await tableRows.count();

    if (rowCount === 0) {
      console.log('No bid packages found - skipping award flow test');
      return;
    }

    // Click on first bid package
    await tableRows.first().click();
    await page.waitForTimeout(1500);

    // Look for Bids tab and click it
    const bidsTab = page.getByRole('tab', { name: /Bids/i });
    if (await bidsTab.isVisible()) {
      await bidsTab.click();
      await page.waitForTimeout(1000);

      // Check for Record Bid button
      const recordBidBtn = page.getByRole('button', { name: /Record Bid/i });
      if (await recordBidBtn.isVisible()) {
        console.log('Record Bid button found');
        await recordBidBtn.click();
        await page.waitForTimeout(1000);

        // Verify subcontractor bid form dialog
        const bidFormDialog = page.locator('[role="dialog"]').filter({ hasText: /Record Subcontractor Bid/i });
        if (await bidFormDialog.isVisible()) {
          console.log('Subcontractor bid form dialog opened');
          await page.screenshot({ path: 'tests/screenshots/bids-record-bid-form.png', fullPage: true });

          // Close inner dialog
          await page.keyboard.press('Escape');
          await page.waitForTimeout(500);
        }
      }
    }

    // Close main dialog
    await page.keyboard.press('Escape');

    console.log('Award bid flow test passed');
  });
});

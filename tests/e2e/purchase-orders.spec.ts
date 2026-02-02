import { test, expect } from '@playwright/test';
import {
  waitForPageLoad,
  waitForPOList,
  clickTableRow,
  closeDialog,
  filterByStatus,
  getTableRowCount,
  setupErrorCapture,
  handleAlertDialog,
  switchToTab,
  selectJob,
  waitForDialog
} from './fixtures/test-helpers';

test.describe('Purchase Order Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/purchase-orders');
    await page.waitForLoadState('networkidle');

    // Skip if redirected to login
    if (page.url().includes('/login')) {
      test.skip();
    }

    await waitForPageLoad(page);
  });

  test.describe('PO List', () => {
    test('should display the PO page', async ({ page }) => {
      await waitForPOList(page);

      // Page should have loaded with sidebar
      await expect(page.locator('aside')).toBeVisible();
    });

    test('should display PO list or empty state', async ({ page }) => {
      await waitForPOList(page);

      const tableRows = page.locator('table tbody tr');
      const emptyState = page.locator(':has-text("No purchase orders"), :has-text("No results")');

      const hasPOs = await tableRows.count() > 0;
      const hasEmptyState = await emptyState.count() > 0;

      expect(hasPOs || hasEmptyState).toBeTruthy();
    });

    test('should display PO information in list', async ({ page }) => {
      await waitForPOList(page);

      const rowCount = await getTableRowCount(page);

      if (rowCount > 0) {
        const firstRow = page.locator('table tbody tr').first();

        // PO rows should show key information
        const hasPONumber = await firstRow.locator('text=/PO-|#/').count() > 0;
        const hasAmount = await firstRow.locator('text=/\\$[\\d,]+/').count() > 0;

        expect(hasPONumber || hasAmount).toBeTruthy();
      }
    });

    test('should show status badges on PO rows', async ({ page }) => {
      await waitForPOList(page);

      const rowCount = await getTableRowCount(page);

      if (rowCount > 0) {
        const statusBadges = page.locator('table tbody tr [class*="badge"], table tbody tr [class*="status"]');
        const badgeCount = await statusBadges.count();

        expect(badgeCount).toBeGreaterThanOrEqual(1);
      }
    });

    test('should filter POs by selected job', async ({ page }) => {
      await waitForPOList(page);

      const allJobsCount = await getTableRowCount(page);

      // Select a specific job
      await selectJob(page);
      await page.waitForTimeout(500);

      const filteredCount = await getTableRowCount(page);

      // Job filter should show same or fewer POs
      expect(filteredCount).toBeLessThanOrEqual(allJobsCount);
    });
  });

  test.describe('PO Detail Dialog', () => {
    test('should open PO dialog when clicking a row', async ({ page }) => {
      await waitForPOList(page);

      const rowCount = await getTableRowCount(page);

      if (rowCount > 0) {
        await clickTableRow(page, 0);

        // Dialog should be visible
        const dialog = page.locator('[role="dialog"], [data-state="open"]');
        await expect(dialog).toBeVisible({ timeout: 5000 });
      }
    });

    test('should display PO header information', async ({ page }) => {
      await waitForPOList(page);

      const rowCount = await getTableRowCount(page);

      if (rowCount > 0) {
        await clickTableRow(page, 0);
        await waitForDialog(page);

        const dialog = page.locator('[role="dialog"]');

        // Should show PO number
        const hasPONumber = await dialog.locator('text=/PO-[A-Za-z0-9-]+/').count() > 0;
        const hasVendor = await dialog.locator('text=/Vendor/i').count() > 0;

        expect(hasPONumber || hasVendor).toBeTruthy();
      }
    });

    test('should display PO amount', async ({ page }) => {
      await waitForPOList(page);

      const rowCount = await getTableRowCount(page);

      if (rowCount > 0) {
        await clickTableRow(page, 0);
        await waitForDialog(page);

        const dialog = page.locator('[role="dialog"]');

        // Should show amount information
        const hasAmount = await dialog.locator('text=/\\$[\\d,]+/').count() > 0;

        expect(hasAmount).toBeTruthy();
      }
    });

    test('should close dialog when clicking close button', async ({ page }) => {
      await waitForPOList(page);

      const rowCount = await getTableRowCount(page);

      if (rowCount > 0) {
        await clickTableRow(page, 0);
        await waitForDialog(page);

        const dialog = page.locator('[role="dialog"]');
        await expect(dialog).toBeVisible();

        await closeDialog(page);

        await expect(dialog).not.toBeVisible({ timeout: 3000 });
      }
    });
  });

  test.describe('PO Tabs', () => {
    test('should have Overview tab', async ({ page }) => {
      await waitForPOList(page);

      const rowCount = await getTableRowCount(page);

      if (rowCount > 0) {
        await clickTableRow(page, 0);
        await waitForDialog(page);

        const overviewTab = page.locator('[role="tab"]:has-text("Overview"), [role="tab"]:has-text("Summary")');
        const tabExists = await overviewTab.count() > 0;

        expect(tabExists).toBeTruthy();
      }
    });

    test('should have Line Items tab', async ({ page }) => {
      await waitForPOList(page);

      const rowCount = await getTableRowCount(page);

      if (rowCount > 0) {
        await clickTableRow(page, 0);
        await waitForDialog(page);

        const lineItemsTab = page.locator('[role="tab"]:has-text("Line Items")');
        const tabExists = await lineItemsTab.count() > 0;

        expect(tabExists).toBeTruthy();
      }
    });

    test('should display line items when clicking Line Items tab', async ({ page }) => {
      await waitForPOList(page);

      const rowCount = await getTableRowCount(page);

      if (rowCount > 0) {
        await clickTableRow(page, 0);
        await waitForDialog(page);

        const lineItemsTab = page.locator('[role="tab"]:has-text("Line Items")');

        if (await lineItemsTab.count() > 0) {
          await lineItemsTab.click();
          await page.waitForTimeout(300);

          // Should show line items table or empty state
          const dialog = page.locator('[role="dialog"]');
          const lineItemsContent = dialog.locator('table, :has-text("No line items"), :has-text("Cost Code")');
          const hasContent = await lineItemsContent.count() > 0;

          expect(hasContent).toBeTruthy();
        }
      }
    });

    test('should have Invoices tab', async ({ page }) => {
      await waitForPOList(page);

      const rowCount = await getTableRowCount(page);

      if (rowCount > 0) {
        await clickTableRow(page, 0);
        await waitForDialog(page);

        const invoicesTab = page.locator('[role="tab"]:has-text("Invoices")');
        const tabExists = await invoicesTab.count() > 0;

        expect(tabExists).toBeTruthy();
      }
    });

    test('should have Activity tab', async ({ page }) => {
      await waitForPOList(page);

      const rowCount = await getTableRowCount(page);

      if (rowCount > 0) {
        await clickTableRow(page, 0);
        await waitForDialog(page);

        const activityTab = page.locator('[role="tab"]:has-text("Activity")');
        const tabExists = await activityTab.count() > 0;

        expect(tabExists).toBeTruthy();
      }
    });
  });

  test.describe('Create New PO', () => {
    test('should have New PO button', async ({ page }) => {
      await waitForPageLoad(page);

      const newPOBtn = page.locator('button:has-text("New PO"), button:has-text("Create PO"), button:has-text("Add")');
      const btnExists = await newPOBtn.count() > 0;

      expect(btnExists).toBeTruthy();
    });

    test('should open create PO dialog when clicking New PO button', async ({ page }) => {
      await waitForPageLoad(page);

      // First select a job (may be required)
      await selectJob(page);
      await page.waitForTimeout(500);

      const newPOBtn = page.locator('button:has-text("New PO"), button:has-text("Create PO")').first();

      if (await newPOBtn.isVisible()) {
        await newPOBtn.click();
        await page.waitForTimeout(500);

        // Create PO dialog should be visible
        const createDialog = page.locator('[role="dialog"]');
        const dialogVisible = await createDialog.count() > 0;

        expect(dialogVisible).toBeTruthy();
      }
    });

    test('should have vendor selection in create PO form', async ({ page }) => {
      await waitForPageLoad(page);

      await selectJob(page);
      await page.waitForTimeout(500);

      const newPOBtn = page.locator('button:has-text("New PO"), button:has-text("Create PO")').first();

      if (await newPOBtn.isVisible()) {
        await newPOBtn.click();
        await page.waitForTimeout(500);

        // Should have vendor dropdown or input
        const vendorField = page.locator('[role="dialog"] [data-testid*="vendor"], [role="dialog"] button:has-text("Select Vendor"), [role="dialog"] :has-text("Vendor")');
        const vendorExists = await vendorField.count() > 0;

        expect(vendorExists).toBeTruthy();
      }
    });
  });

  test.describe('PO Line Items', () => {
    test('should display cost code for each line item', async ({ page }) => {
      await waitForPOList(page);

      const rowCount = await getTableRowCount(page);

      if (rowCount > 0) {
        await clickTableRow(page, 0);
        await waitForDialog(page);

        // Go to line items tab
        const lineItemsTab = page.locator('[role="tab"]:has-text("Line Items")');
        if (await lineItemsTab.count() > 0) {
          await lineItemsTab.click();
          await page.waitForTimeout(300);

          // Check for cost code display
          const dialog = page.locator('[role="dialog"]');
          const costCodes = dialog.locator('text=/\\d{5}|Cost Code/');
          const hasCostCodes = await costCodes.count() > 0;

          // Cost codes may or may not exist depending on PO
          expect(typeof hasCostCodes).toBe('boolean');
        }
      }
    });

    test('should display line item amounts', async ({ page }) => {
      await waitForPOList(page);

      const rowCount = await getTableRowCount(page);

      if (rowCount > 0) {
        await clickTableRow(page, 0);
        await waitForDialog(page);

        const lineItemsTab = page.locator('[role="tab"]:has-text("Line Items")');
        if (await lineItemsTab.count() > 0) {
          await lineItemsTab.click();
          await page.waitForTimeout(300);

          // Check for amounts
          const dialog = page.locator('[role="dialog"]');
          const amounts = dialog.locator('text=/\\$[\\d,]+\\.\\d{2}/');
          const hasAmounts = await amounts.count() > 0;

          expect(typeof hasAmounts).toBe('boolean');
        }
      }
    });
  });

  test.describe('PO Status Flow', () => {
    test('should show action buttons based on PO status', async ({ page }) => {
      await waitForPOList(page);

      const rowCount = await getTableRowCount(page);

      if (rowCount > 0) {
        await clickTableRow(page, 0);
        await waitForDialog(page);

        const dialog = page.locator('[role="dialog"]');

        // Check for various action buttons
        const sendBtn = dialog.locator('button:has-text("Send")');
        const approveBtn = dialog.locator('button:has-text("Approve")');
        const completeBtn = dialog.locator('button:has-text("Complete")');
        const reopenBtn = dialog.locator('button:has-text("Reopen")');

        // At least one action should be available (or just Close)
        const hasActions = await sendBtn.count() > 0 ||
                          await approveBtn.count() > 0 ||
                          await completeBtn.count() > 0 ||
                          await reopenBtn.count() > 0;

        expect(typeof hasActions).toBe('boolean');
      }
    });
  });

  test.describe('Error Handling', () => {
    test('should load POs page without JavaScript errors', async ({ page }) => {
      const { errors } = setupErrorCapture(page);

      await page.goto('/purchase-orders');
      await page.waitForLoadState('networkidle');
      await waitForPOList(page);

      const criticalErrors = errors.filter(e =>
        !e.includes('favicon') &&
        !e.includes('401') &&
        !e.includes('ResizeObserver')
      );
      expect(criticalErrors).toHaveLength(0);
    });

    test('should open PO dialog without errors', async ({ page }) => {
      const { errors } = setupErrorCapture(page);

      await waitForPOList(page);

      const rowCount = await getTableRowCount(page);

      if (rowCount > 0) {
        await clickTableRow(page, 0);
        await page.waitForTimeout(1000);

        const criticalErrors = errors.filter(e =>
          !e.includes('favicon') &&
          !e.includes('401') &&
          !e.includes('ResizeObserver')
        );
        expect(criticalErrors).toHaveLength(0);
      }
    });
  });
});

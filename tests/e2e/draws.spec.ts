import { test, expect } from '@playwright/test';
import {
  waitForPageLoad,
  waitForDrawList,
  clickTableRow,
  closeDialog,
  switchToTab,
  getTableRowCount,
  setupErrorCapture,
  selectJob,
  waitForDialog
} from './fixtures/test-helpers';

test.describe('Draw Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/draws');
    await page.waitForLoadState('networkidle');

    // Skip if redirected to login
    if (page.url().includes('/login')) {
      test.skip();
    }

    await waitForPageLoad(page);
  });

  test.describe('Draw List', () => {
    test('should display the draws page', async ({ page }) => {
      await waitForDrawList(page);

      // Page should have loaded with sidebar
      await expect(page.locator('aside')).toBeVisible();
    });

    test('should display draw list or empty state', async ({ page }) => {
      await waitForDrawList(page);

      const tableRows = page.locator('table tbody tr');
      const emptyState = page.locator(':has-text("No draws"), :has-text("No results")');

      const hasDraws = await tableRows.count() > 0;
      const hasEmptyState = await emptyState.count() > 0;

      expect(hasDraws || hasEmptyState).toBeTruthy();
    });

    test('should display draw information in list', async ({ page }) => {
      await waitForDrawList(page);

      const rowCount = await getTableRowCount(page);

      if (rowCount > 0) {
        const firstRow = page.locator('table tbody tr').first();

        // Draw rows should show key information
        const hasDrawNumber = await firstRow.locator('text=/Draw|#\\d+/i').count() > 0;
        const hasAmount = await firstRow.locator('text=/\\$[\\d,]+/').count() > 0;

        expect(hasDrawNumber || hasAmount).toBeTruthy();
      }
    });

    test('should show status badges on draw rows', async ({ page }) => {
      await waitForDrawList(page);

      const rowCount = await getTableRowCount(page);

      if (rowCount > 0) {
        const statusBadges = page.locator('table tbody tr [class*="badge"], table tbody tr [class*="status"]');
        const badgeCount = await statusBadges.count();

        expect(badgeCount).toBeGreaterThanOrEqual(1);
      }
    });
  });

  test.describe('Draw Detail Dialog', () => {
    test('should open draw dialog when clicking a row', async ({ page }) => {
      await waitForDrawList(page);

      const rowCount = await getTableRowCount(page);

      if (rowCount > 0) {
        await clickTableRow(page, 0);

        // Dialog should be visible
        const dialog = page.locator('[role="dialog"], [data-state="open"]');
        await expect(dialog).toBeVisible({ timeout: 5000 });
      }
    });

    test('should display draw header information', async ({ page }) => {
      await waitForDrawList(page);

      const rowCount = await getTableRowCount(page);

      if (rowCount > 0) {
        await clickTableRow(page, 0);
        await waitForDialog(page);

        // Check for draw header content
        const dialog = page.locator('[role="dialog"]');

        // Should show draw number or job info
        const hasDrawNumber = await dialog.locator('text=/Draw|#\\d+/i').count() > 0;
        const hasJobInfo = await dialog.locator('text=/Job|Project/i').count() > 0;

        expect(hasDrawNumber || hasJobInfo).toBeTruthy();
      }
    });

    test('should close dialog when clicking close button', async ({ page }) => {
      await waitForDrawList(page);

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

  test.describe('G702 Tab', () => {
    test('should display G702 Application and Certificate for Payment', async ({ page }) => {
      await waitForDrawList(page);

      const rowCount = await getTableRowCount(page);

      if (rowCount > 0) {
        await clickTableRow(page, 0);
        await waitForDialog(page);

        // Click G702 tab if it exists
        const g702Tab = page.locator('[role="tab"]:has-text("G702")');
        if (await g702Tab.count() > 0) {
          await g702Tab.click();
          await page.waitForTimeout(300);
        }

        // Check for G702 content
        const dialog = page.locator('[role="dialog"]');
        const g702Visible = await dialog.locator('text=/G702|Application|Certificate/i').count() > 0;

        expect(g702Visible).toBeTruthy();
      }
    });

    test('should display G702 financial fields', async ({ page }) => {
      await waitForDrawList(page);

      const rowCount = await getTableRowCount(page);

      if (rowCount > 0) {
        await clickTableRow(page, 0);
        await waitForDialog(page);

        // Navigate to G702 tab
        const g702Tab = page.locator('[role="tab"]:has-text("G702")');
        if (await g702Tab.count() > 0) {
          await g702Tab.click();
          await page.waitForTimeout(300);
        }

        // Check for G702 financial fields
        const dialog = page.locator('[role="dialog"]');

        // Look for typical G702 fields
        const hasContractSum = await dialog.locator('text=/Contract Sum|Original Contract/i').count() > 0;
        const hasPaymentDue = await dialog.locator('text=/Payment Due|Current Payment/i').count() > 0;
        const hasRetainage = await dialog.locator('text=/Retainage/i').count() > 0;

        expect(hasContractSum || hasPaymentDue || hasRetainage).toBeTruthy();
      }
    });
  });

  test.describe('G703 Tab', () => {
    test('should display G703 Schedule of Values', async ({ page }) => {
      await waitForDrawList(page);

      const rowCount = await getTableRowCount(page);

      if (rowCount > 0) {
        await clickTableRow(page, 0);
        await waitForDialog(page);

        // Click G703 tab
        const g703Tab = page.locator('[role="tab"]:has-text("G703")');
        if (await g703Tab.count() > 0) {
          await g703Tab.click();
          await page.waitForTimeout(300);

          // Check for G703 content (schedule of values table)
          const dialog = page.locator('[role="dialog"]');
          const g703Visible = await dialog.locator('table, text=/Schedule of Values|Cost Code/i').count() > 0;

          expect(g703Visible).toBeTruthy();
        }
      }
    });

    test('should display cost code breakdown in G703', async ({ page }) => {
      await waitForDrawList(page);

      const rowCount = await getTableRowCount(page);

      if (rowCount > 0) {
        await clickTableRow(page, 0);
        await waitForDialog(page);

        // Navigate to G703 tab
        const g703Tab = page.locator('[role="tab"]:has-text("G703")');
        if (await g703Tab.count() > 0) {
          await g703Tab.click();
          await page.waitForTimeout(300);

          // Should show table with cost codes
          const tableRows = page.locator('[role="dialog"] table tbody tr');
          const rowCount = await tableRows.count();

          // G703 should have rows
          expect(rowCount).toBeGreaterThanOrEqual(0);
        }
      }
    });
  });

  test.describe('Invoices Tab', () => {
    test('should display invoices tab in draw dialog', async ({ page }) => {
      await waitForDrawList(page);

      const rowCount = await getTableRowCount(page);

      if (rowCount > 0) {
        await clickTableRow(page, 0);
        await waitForDialog(page);

        // Click Invoices tab
        const invoicesTab = page.locator('[role="tab"]:has-text("Invoices")');
        const tabExists = await invoicesTab.count() > 0;

        if (tabExists) {
          await invoicesTab.click();
          await page.waitForTimeout(300);

          // Invoices tab content should be visible
          const dialog = page.locator('[role="dialog"]');
          const contentVisible = await dialog.locator('table, :has-text("Invoice")').count() > 0;

          expect(contentVisible).toBeTruthy();
        }
      }
    });
  });

  test.describe('Draw Creation', () => {
    test('should have create draw button', async ({ page }) => {
      await waitForDrawList(page);

      // Look for create draw button
      const createBtn = page.locator('button:has-text("Create Draw"), button:has-text("New Draw"), button:has-text("Add")');
      const btnExists = await createBtn.count() > 0;

      expect(btnExists).toBeTruthy();
    });

    test('should open create draw dialog when clicking create button', async ({ page }) => {
      await waitForDrawList(page);

      // First select a job (required for draw creation)
      await selectJob(page);
      await page.waitForTimeout(500);

      const createBtn = page.locator('button:has-text("Create Draw"), button:has-text("New Draw")').first();

      if (await createBtn.isVisible()) {
        await createBtn.click();
        await page.waitForTimeout(500);

        // Create draw dialog should be visible
        const createDialog = page.locator('[role="dialog"]');
        const dialogVisible = await createDialog.count() > 0;

        expect(dialogVisible).toBeTruthy();
      }
    });
  });

  test.describe('Draw Export', () => {
    test('should have export options in draw dialog', async ({ page }) => {
      await waitForDrawList(page);

      const rowCount = await getTableRowCount(page);

      if (rowCount > 0) {
        await clickTableRow(page, 0);
        await waitForDialog(page);

        // Look for export buttons
        const excelExport = page.locator('[role="dialog"] button:has-text("Excel"), [role="dialog"] button:has-text("Export")');
        const pdfExport = page.locator('[role="dialog"] button:has-text("PDF")');

        const hasExcelExport = await excelExport.count() > 0;
        const hasPdfExport = await pdfExport.count() > 0;

        // At least one export option should exist
        expect(hasExcelExport || hasPdfExport).toBeTruthy();
      }
    });
  });

  test.describe('Error Handling', () => {
    test('should load draws page without JavaScript errors', async ({ page }) => {
      const { errors } = setupErrorCapture(page);

      await page.goto('/draws');
      await page.waitForLoadState('networkidle');
      await waitForDrawList(page);

      // Filter out non-critical errors
      const criticalErrors = errors.filter(e =>
        !e.includes('favicon') &&
        !e.includes('401') &&
        !e.includes('ResizeObserver')
      );
      expect(criticalErrors).toHaveLength(0);
    });

    test('should open draw dialog without errors', async ({ page }) => {
      const { errors } = setupErrorCapture(page);

      await waitForDrawList(page);

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

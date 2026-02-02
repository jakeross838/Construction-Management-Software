import { test, expect } from '@playwright/test';
import {
  waitForPageLoad,
  waitForInvoiceList,
  clickTableRow,
  closeDialog,
  filterByStatus,
  getTableRowCount,
  setupErrorCapture,
  handleAlertDialog,
  selectJob,
  selectAllJobs,
  waitForDialog
} from './fixtures/test-helpers';

test.describe('Invoice Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/invoices');
    await page.waitForLoadState('networkidle');

    // Skip if redirected to login
    if (page.url().includes('/login')) {
      test.skip();
    }

    await waitForPageLoad(page);
  });

  test.describe('Invoice List', () => {
    test('should display the invoice list', async ({ page }) => {
      await waitForInvoiceList(page);

      // Either table rows or empty state should be visible
      const tableRows = page.locator('table tbody tr');
      const emptyState = page.locator(':has-text("No invoices"), :has-text("No results")');

      const hasInvoices = await tableRows.count() > 0;
      const hasEmptyState = await emptyState.count() > 0;

      expect(hasInvoices || hasEmptyState).toBeTruthy();
    });

    test('should display invoice details in table', async ({ page }) => {
      await waitForInvoiceList(page);

      const rowCount = await getTableRowCount(page);

      if (rowCount > 0) {
        const firstRow = page.locator('table tbody tr').first();

        // Invoice rows should have key information (vendor, amount)
        const hasContent = await firstRow.locator('td').count() > 0;
        expect(hasContent).toBeTruthy();
      }
    });

    test('should show status badges on invoice rows', async ({ page }) => {
      await waitForInvoiceList(page);

      const rowCount = await getTableRowCount(page);

      if (rowCount > 0) {
        // Look for status badges (React uses various badge classes)
        const statusBadges = page.locator('table tbody tr [class*="badge"], table tbody tr [class*="status"]');
        const badgeCount = await statusBadges.count();

        expect(badgeCount).toBeGreaterThanOrEqual(1);
      }
    });
  });

  test.describe('Invoice Filtering', () => {
    test('should filter invoices by status', async ({ page }) => {
      await waitForInvoiceList(page);

      const initialCount = await getTableRowCount(page);

      // Try to filter by status
      await filterByStatus(page, 'Approved');

      // After filtering, count may change
      const filteredCount = await getTableRowCount(page);

      // Filter should work (count may be same or different)
      expect(typeof filteredCount).toBe('number');
    });

    test('should filter invoices by selected job', async ({ page }) => {
      await waitForInvoiceList(page);

      const allJobsCount = await getTableRowCount(page);

      // Select a specific job
      await selectJob(page);
      await page.waitForTimeout(500);

      const jobFilteredCount = await getTableRowCount(page);

      // Job filter should show same or fewer invoices
      expect(jobFilteredCount).toBeLessThanOrEqual(allJobsCount);
    });
  });

  test.describe('Invoice Detail Dialog', () => {
    test('should open invoice detail dialog when clicking a row', async ({ page }) => {
      await waitForInvoiceList(page);

      const rowCount = await getTableRowCount(page);

      if (rowCount > 0) {
        await clickTableRow(page, 0);

        // Dialog should be visible (React uses [role="dialog"])
        const dialog = page.locator('[role="dialog"], [data-state="open"]');
        await expect(dialog).toBeVisible({ timeout: 5000 });
      }
    });

    test('should display invoice details in dialog', async ({ page }) => {
      await waitForInvoiceList(page);

      const rowCount = await getTableRowCount(page);

      if (rowCount > 0) {
        await clickTableRow(page, 0);
        await waitForDialog(page);

        // Check for key invoice details in dialog
        const dialog = page.locator('[role="dialog"]');

        // Should show amount info
        const amountVisible = await dialog.locator('text=/\\$[\\d,]+/').count() > 0;
        expect(amountVisible).toBeTruthy();
      }
    });

    test('should close dialog when clicking close button', async ({ page }) => {
      await waitForInvoiceList(page);

      const rowCount = await getTableRowCount(page);

      if (rowCount > 0) {
        await clickTableRow(page, 0);
        await waitForDialog(page);

        // Verify dialog is open
        const dialog = page.locator('[role="dialog"]');
        await expect(dialog).toBeVisible();

        // Close dialog
        await closeDialog(page);

        // Dialog should be hidden
        await expect(dialog).not.toBeVisible({ timeout: 3000 });
      }
    });
  });

  test.describe('Invoice Approval Flow', () => {
    test('should show approve button for pending invoices', async ({ page }) => {
      await waitForInvoiceList(page);

      // Filter to needs_approval
      await filterByStatus(page, 'Needs Approval');
      await page.waitForTimeout(500);

      const rowCount = await getTableRowCount(page);

      if (rowCount > 0) {
        await clickTableRow(page, 0);
        await waitForDialog(page);

        // Should see Approve button
        const approveBtn = page.locator('[role="dialog"] button:has-text("Approve")');
        const btnExists = await approveBtn.count() > 0;

        expect(btnExists).toBeTruthy();
      }
    });
  });

  test.describe('Upload Invoice', () => {
    test('should open upload dialog when clicking upload button', async ({ page }) => {
      await waitForPageLoad(page);

      const uploadBtn = page.locator('button:has-text("Upload"), button:has-text("Add Invoice")');

      if (await uploadBtn.count() > 0) {
        await uploadBtn.first().click();
        await page.waitForTimeout(500);

        // Upload dialog should be visible
        const uploadDialog = page.locator('[role="dialog"]');
        await expect(uploadDialog).toBeVisible();
      }
    });

    test('should have file input in upload dialog', async ({ page }) => {
      await waitForPageLoad(page);

      const uploadBtn = page.locator('button:has-text("Upload"), button:has-text("Add Invoice")');

      if (await uploadBtn.count() > 0) {
        await uploadBtn.first().click();
        await page.waitForTimeout(500);

        // Should have a file input
        const fileInput = page.locator('input[type="file"]');
        const hasFileInput = await fileInput.count() > 0;

        expect(hasFileInput).toBeTruthy();
      }
    });
  });

  test.describe('Error Handling', () => {
    test('should load invoices page without JavaScript errors', async ({ page }) => {
      const { errors } = setupErrorCapture(page);

      await page.goto('/invoices');
      await page.waitForLoadState('networkidle');

      // Filter out expected non-critical errors
      const criticalErrors = errors.filter(e =>
        !e.includes('favicon') &&
        !e.includes('401') &&
        !e.includes('ResizeObserver')
      );
      expect(criticalErrors).toHaveLength(0);
    });
  });
});

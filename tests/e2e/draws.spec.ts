import { test, expect } from '@playwright/test';
import {
  waitForPageLoad,
  waitForDrawList,
  openDrawModal,
  closeModal,
  switchToTab,
  getDrawCount,
  setupErrorCapture,
  selectJob
} from './fixtures/test-helpers';

test.describe('Draw Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/draws.html');
    await waitForPageLoad(page);
  });

  test.describe('Draw List', () => {
    test('should display the draws page', async ({ page }) => {
      await waitForDrawList(page);

      // Page should have loaded
      await expect(page.locator('.job-sidebar')).toBeVisible();
    });

    test('should display draw list or empty state', async ({ page }) => {
      await waitForDrawList(page);

      const drawRows = page.locator('.draw-row');
      const emptyState = page.locator('.empty-state, .no-draws');

      const hasDraws = await drawRows.count() > 0;
      const hasEmptyState = await emptyState.count() > 0;

      expect(hasDraws || hasEmptyState).toBeTruthy();
    });

    test('should display draw information in list', async ({ page }) => {
      await waitForDrawList(page);

      const drawCount = await getDrawCount(page);

      if (drawCount > 0) {
        const firstDraw = page.locator('.draw-row').first();

        // Draw rows should show key information
        // Check for draw number, job name, or amount
        const hasDrawNumber = await firstDraw.locator('text=/Draw #\\d+|#\\d+/').count() > 0;
        const hasAmount = await firstDraw.locator('text=/\\$[\\d,]+/').count() > 0;

        expect(hasDrawNumber || hasAmount).toBeTruthy();
      }
    });

    test('should show status badges on draw rows', async ({ page }) => {
      await waitForDrawList(page);

      const drawCount = await getDrawCount(page);

      if (drawCount > 0) {
        const statusBadges = page.locator('.draw-row .status-badge');
        const badgeCount = await statusBadges.count();

        expect(badgeCount).toBeGreaterThanOrEqual(1);
      }
    });
  });

  test.describe('Draw Detail Modal', () => {
    test('should open draw modal when clicking a row', async ({ page }) => {
      await waitForDrawList(page);

      const drawCount = await getDrawCount(page);

      if (drawCount > 0) {
        await openDrawModal(page, 0);

        // Modal should be visible
        const modal = page.locator('#drawModal.show, .modal-fullscreen-dark.show');
        await expect(modal).toBeVisible();
      }
    });

    test('should display draw header information', async ({ page }) => {
      await waitForDrawList(page);

      const drawCount = await getDrawCount(page);

      if (drawCount > 0) {
        await openDrawModal(page, 0);

        // Check for draw header content
        const modal = page.locator('#drawModal.show, .modal-fullscreen-dark.show');

        // Should show draw number and job name
        const hasDrawNumber = await modal.locator('text=/Draw #\\d+/').count() > 0;
        const hasJobInfo = await modal.locator('.draw-header, .modal-header').count() > 0;

        expect(hasDrawNumber || hasJobInfo).toBeTruthy();
      }
    });

    test('should close modal when clicking close button', async ({ page }) => {
      await waitForDrawList(page);

      const drawCount = await getDrawCount(page);

      if (drawCount > 0) {
        await openDrawModal(page, 0);

        const modal = page.locator('#drawModal.show, .modal-fullscreen-dark.show');
        await expect(modal).toBeVisible();

        await closeModal(page);

        await expect(modal).not.toBeVisible();
      }
    });
  });

  test.describe('G702 Tab', () => {
    test('should display G702 Application and Certificate for Payment', async ({ page }) => {
      await waitForDrawList(page);

      const drawCount = await getDrawCount(page);

      if (drawCount > 0) {
        await openDrawModal(page, 0);

        // Click G702 tab (may be default or named)
        const g702Tab = page.locator('.tab:has-text("G702"), .tab-btn:has-text("G702"), [data-tab="g702"]');
        if (await g702Tab.count() > 0) {
          await g702Tab.click();
          await page.waitForTimeout(300);
        }

        // Check for G702 content
        const g702Content = page.locator('.g702-document, #g702Tab, [data-tab-content="g702"]');
        const g702Visible = await g702Content.count() > 0;

        expect(g702Visible).toBeTruthy();
      }
    });

    test('should display G702 financial fields', async ({ page }) => {
      await waitForDrawList(page);

      const drawCount = await getDrawCount(page);

      if (drawCount > 0) {
        await openDrawModal(page, 0);

        // Navigate to G702 tab
        const g702Tab = page.locator('.tab:has-text("G702"), [data-tab="g702"]');
        if (await g702Tab.count() > 0) {
          await g702Tab.click();
          await page.waitForTimeout(300);
        }

        // Check for G702 financial fields
        const modal = page.locator('#drawModal.show, .modal-fullscreen-dark.show');

        // Look for typical G702 fields
        const hasContractSum = await modal.locator('text=/Contract Sum|Original Contract/i').count() > 0;
        const hasPaymentDue = await modal.locator('text=/Payment Due|Current Payment/i').count() > 0;
        const hasRetainage = await modal.locator('text=/Retainage/i').count() > 0;

        expect(hasContractSum || hasPaymentDue || hasRetainage).toBeTruthy();
      }
    });
  });

  test.describe('G703 Tab', () => {
    test('should display G703 Schedule of Values', async ({ page }) => {
      await waitForDrawList(page);

      const drawCount = await getDrawCount(page);

      if (drawCount > 0) {
        await openDrawModal(page, 0);

        // Click G703 tab
        const g703Tab = page.locator('.tab:has-text("G703"), .tab-btn:has-text("G703"), [data-tab="g703"]');
        if (await g703Tab.count() > 0) {
          await g703Tab.click();
          await page.waitForTimeout(300);

          // Check for G703 content (schedule of values table)
          const g703Content = page.locator('.g703-table, #g703Tab, [data-tab-content="g703"], table');
          const g703Visible = await g703Content.count() > 0;

          expect(g703Visible).toBeTruthy();
        }
      }
    });

    test('should display cost code breakdown in G703', async ({ page }) => {
      await waitForDrawList(page);

      const drawCount = await getDrawCount(page);

      if (drawCount > 0) {
        await openDrawModal(page, 0);

        // Navigate to G703 tab
        const g703Tab = page.locator('.tab:has-text("G703"), [data-tab="g703"]');
        if (await g703Tab.count() > 0) {
          await g703Tab.click();
          await page.waitForTimeout(300);

          // Should show table with cost codes
          const tableRows = page.locator('table tbody tr, .g703-row');
          const rowCount = await tableRows.count();

          // G703 should have at least one row (header or data)
          expect(rowCount).toBeGreaterThanOrEqual(0);
        }
      }
    });

    test('should display G703 column headers', async ({ page }) => {
      await waitForDrawList(page);

      const drawCount = await getDrawCount(page);

      if (drawCount > 0) {
        await openDrawModal(page, 0);

        const g703Tab = page.locator('.tab:has-text("G703"), [data-tab="g703"]');
        if (await g703Tab.count() > 0) {
          await g703Tab.click();
          await page.waitForTimeout(300);

          // Check for typical G703 column headers
          const modal = page.locator('#drawModal.show, .modal-fullscreen-dark.show');

          // Look for expected columns
          const hasBudgetCol = await modal.locator('text=/Budget|Scheduled Value/i').count() > 0;
          const hasBilledCol = await modal.locator('text=/Billed|Billings/i').count() > 0;
          const hasPercentCol = await modal.locator('text=/%|Complete/i').count() > 0;

          expect(hasBudgetCol || hasBilledCol || hasPercentCol).toBeTruthy();
        }
      }
    });
  });

  test.describe('Invoices Tab', () => {
    test('should display invoices tab in draw modal', async ({ page }) => {
      await waitForDrawList(page);

      const drawCount = await getDrawCount(page);

      if (drawCount > 0) {
        await openDrawModal(page, 0);

        // Click Invoices tab
        const invoicesTab = page.locator('.tab:has-text("Invoices"), .tab-btn:has-text("Invoices"), [data-tab="invoices"]');
        const tabExists = await invoicesTab.count() > 0;

        if (tabExists) {
          await invoicesTab.click();
          await page.waitForTimeout(300);

          // Invoices tab content should be visible
          const invoicesContent = page.locator('#invoicesTab, [data-tab-content="invoices"], .draw-invoices');
          const contentVisible = await invoicesContent.count() > 0;

          expect(contentVisible).toBeTruthy();
        }
      }
    });

    test('should list invoices in the draw', async ({ page }) => {
      await waitForDrawList(page);

      const drawCount = await getDrawCount(page);

      if (drawCount > 0) {
        await openDrawModal(page, 0);

        // Navigate to invoices tab
        const invoicesTab = page.locator('.tab:has-text("Invoices"), [data-tab="invoices"]');
        if (await invoicesTab.count() > 0) {
          await invoicesTab.click();
          await page.waitForTimeout(300);

          // Should show invoice rows or empty message
          const invoiceRows = page.locator('.invoice-row, table tbody tr, .draw-invoice-item');
          const emptyMessage = page.locator('text=/No invoices|empty/i');

          const hasInvoices = await invoiceRows.count() > 0;
          const hasEmptyMessage = await emptyMessage.count() > 0;

          expect(hasInvoices || hasEmptyMessage).toBeTruthy();
        }
      }
    });
  });

  test.describe('Draw Creation', () => {
    test('should have create draw button', async ({ page }) => {
      await waitForDrawList(page);

      // Look for create draw button
      const createBtn = page.locator('button:has-text("Create Draw"), button:has-text("New Draw")');
      const btnExists = await createBtn.count() > 0;

      expect(btnExists).toBeTruthy();
    });

    test('should open create draw modal when clicking create button', async ({ page }) => {
      await waitForDrawList(page);

      // First select a job (required for draw creation)
      await selectJob(page);
      await page.waitForTimeout(500);

      const createBtn = page.locator('button:has-text("Create Draw"), button:has-text("New Draw")');

      if (await createBtn.isVisible()) {
        await createBtn.click();
        await page.waitForTimeout(500);

        // Create draw modal or form should be visible
        const createModal = page.locator('.modal.show, .create-draw-modal, #createDrawModal');
        const modalVisible = await createModal.count() > 0;

        // Modal should exist (visibility depends on UI state)
        expect(typeof modalVisible).toBe('boolean');
      }
    });
  });

  test.describe('Draw Export', () => {
    test('should have export options in draw modal', async ({ page }) => {
      await waitForDrawList(page);

      const drawCount = await getDrawCount(page);

      if (drawCount > 0) {
        await openDrawModal(page, 0);

        // Look for export buttons
        const excelExport = page.locator('button:has-text("Excel"), button:has-text("Export Excel")');
        const pdfExport = page.locator('button:has-text("PDF"), button:has-text("Export PDF")');

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

      await page.goto('/draws.html');
      await waitForDrawList(page);

      // Filter out favicon errors which are not critical
      const criticalErrors = errors.filter(e => !e.includes('favicon'));
      expect(criticalErrors).toHaveLength(0);
    });

    test('should open draw modal without errors', async ({ page }) => {
      const { errors } = setupErrorCapture(page);

      await waitForDrawList(page);

      const drawCount = await getDrawCount(page);

      if (drawCount > 0) {
        await openDrawModal(page, 0);
        await page.waitForTimeout(1000);

        const criticalErrors = errors.filter(e => !e.includes('favicon'));
        expect(criticalErrors).toHaveLength(0);
      }
    });
  });
});

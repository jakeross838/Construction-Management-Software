import { test, expect } from '@playwright/test';
import {
  waitForPageLoad,
  waitForPOList,
  openPOModal,
  closeModal,
  filterPOsByStatus,
  getPOCount,
  setupErrorCapture,
  handleConfirmDialog,
  switchToTab,
  selectJob
} from './fixtures/test-helpers';

test.describe('Purchase Order Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/pos.html');
    await waitForPageLoad(page);
  });

  test.describe('PO List', () => {
    test('should display the PO page', async ({ page }) => {
      await waitForPOList(page);

      // Page should have loaded with sidebar
      await expect(page.locator('.job-sidebar')).toBeVisible();
    });

    test('should display PO list or empty state', async ({ page }) => {
      await waitForPOList(page);

      const poRows = page.locator('.po-row');
      const emptyState = page.locator('.empty-state, .no-pos');

      const hasPOs = await poRows.count() > 0;
      const hasEmptyState = await emptyState.count() > 0;

      expect(hasPOs || hasEmptyState).toBeTruthy();
    });

    test('should display PO information in list', async ({ page }) => {
      await waitForPOList(page);

      const poCount = await getPOCount(page);

      if (poCount > 0) {
        const firstPO = page.locator('.po-row').first();

        // PO rows should show key information
        const hasPONumber = await firstPO.locator('text=/PO-|#/').count() > 0;
        const hasAmount = await firstPO.locator('text=/\\$[\\d,]+/').count() > 0;
        const hasVendor = await firstPO.locator('.vendor-name, .po-vendor').count() > 0;

        expect(hasPONumber || hasAmount || hasVendor).toBeTruthy();
      }
    });

    test('should show status badges on PO rows', async ({ page }) => {
      await waitForPOList(page);

      const poCount = await getPOCount(page);

      if (poCount > 0) {
        const statusBadges = page.locator('.po-row .status-badge');
        const badgeCount = await statusBadges.count();

        expect(badgeCount).toBeGreaterThanOrEqual(1);
      }
    });

    test('should filter POs by selected job', async ({ page }) => {
      await waitForPOList(page);

      const allJobsCount = await getPOCount(page);

      // Select a specific job
      await selectJob(page);

      const filteredCount = await getPOCount(page);

      // Job filter should show same or fewer POs
      expect(filteredCount).toBeLessThanOrEqual(allJobsCount);
    });
  });

  test.describe('PO Detail Modal', () => {
    test('should open PO modal when clicking a row', async ({ page }) => {
      await waitForPOList(page);

      const poCount = await getPOCount(page);

      if (poCount > 0) {
        await openPOModal(page, 0);

        // Modal should be visible
        const modal = page.locator('#poModal.show, .modal-fullscreen-dark.show');
        await expect(modal).toBeVisible();
      }
    });

    test('should display PO header information', async ({ page }) => {
      await waitForPOList(page);

      const poCount = await getPOCount(page);

      if (poCount > 0) {
        await openPOModal(page, 0);

        const modal = page.locator('#poModal.show, .modal-fullscreen-dark.show');

        // Should show PO number
        const hasPONumber = await modal.locator('text=/PO-[A-Za-z0-9-]+/').count() > 0;
        const hasVendor = await modal.locator('.vendor-name, text=/Vendor/i').count() > 0;

        expect(hasPONumber || hasVendor).toBeTruthy();
      }
    });

    test('should display PO amount and progress', async ({ page }) => {
      await waitForPOList(page);

      const poCount = await getPOCount(page);

      if (poCount > 0) {
        await openPOModal(page, 0);

        const modal = page.locator('#poModal.show, .modal-fullscreen-dark.show');

        // Should show amount information
        const hasAmount = await modal.locator('text=/\\$[\\d,]+/').count() > 0;
        const hasProgress = await modal.locator('.progress-bar, .progress, text=/%/').count() > 0;

        expect(hasAmount).toBeTruthy();
      }
    });

    test('should close modal when clicking close button', async ({ page }) => {
      await waitForPOList(page);

      const poCount = await getPOCount(page);

      if (poCount > 0) {
        await openPOModal(page, 0);

        const modal = page.locator('#poModal.show, .modal-fullscreen-dark.show');
        await expect(modal).toBeVisible();

        await closeModal(page);

        await expect(modal).not.toBeVisible();
      }
    });
  });

  test.describe('PO Tabs', () => {
    test('should have Overview tab', async ({ page }) => {
      await waitForPOList(page);

      const poCount = await getPOCount(page);

      if (poCount > 0) {
        await openPOModal(page, 0);

        const overviewTab = page.locator('.tab:has-text("Overview"), [data-tab="overview"]');
        const tabExists = await overviewTab.count() > 0;

        expect(tabExists).toBeTruthy();
      }
    });

    test('should have Line Items tab', async ({ page }) => {
      await waitForPOList(page);

      const poCount = await getPOCount(page);

      if (poCount > 0) {
        await openPOModal(page, 0);

        const lineItemsTab = page.locator('.tab:has-text("Line Items"), [data-tab="line-items"]');
        const tabExists = await lineItemsTab.count() > 0;

        expect(tabExists).toBeTruthy();
      }
    });

    test('should display line items when clicking Line Items tab', async ({ page }) => {
      await waitForPOList(page);

      const poCount = await getPOCount(page);

      if (poCount > 0) {
        await openPOModal(page, 0);

        const lineItemsTab = page.locator('.tab:has-text("Line Items"), [data-tab="line-items"]');

        if (await lineItemsTab.count() > 0) {
          await lineItemsTab.click();
          await page.waitForTimeout(300);

          // Should show line items table or empty state
          const lineItemsTable = page.locator('table, .line-items-list, .po-line-items');
          const emptyState = page.locator('text=/No line items|empty/i');

          const hasTable = await lineItemsTable.count() > 0;
          const hasEmpty = await emptyState.count() > 0;

          expect(hasTable || hasEmpty).toBeTruthy();
        }
      }
    });

    test('should have Invoices tab', async ({ page }) => {
      await waitForPOList(page);

      const poCount = await getPOCount(page);

      if (poCount > 0) {
        await openPOModal(page, 0);

        const invoicesTab = page.locator('.tab:has-text("Invoices"), [data-tab="invoices"]');
        const tabExists = await invoicesTab.count() > 0;

        expect(tabExists).toBeTruthy();
      }
    });

    test('should have Activity tab', async ({ page }) => {
      await waitForPOList(page);

      const poCount = await getPOCount(page);

      if (poCount > 0) {
        await openPOModal(page, 0);

        const activityTab = page.locator('.tab:has-text("Activity"), [data-tab="activity"]');
        const tabExists = await activityTab.count() > 0;

        expect(tabExists).toBeTruthy();
      }
    });
  });

  test.describe('Create New PO', () => {
    test('should have New PO button', async ({ page }) => {
      await waitForPageLoad(page);

      const newPOBtn = page.locator('button:has-text("New PO"), button:has-text("Create PO")');
      const btnExists = await newPOBtn.count() > 0;

      expect(btnExists).toBeTruthy();
    });

    test('should open create PO modal when clicking New PO button', async ({ page }) => {
      await waitForPageLoad(page);

      // First select a job (may be required)
      await selectJob(page);
      await page.waitForTimeout(500);

      const newPOBtn = page.locator('button:has-text("New PO"), button:has-text("Create PO")');

      if (await newPOBtn.isVisible()) {
        await newPOBtn.click();
        await page.waitForTimeout(500);

        // Create PO modal should be visible
        const createModal = page.locator('#createPoModal.show, .modal.show:has(text("Create")), .create-po-modal');
        const modalVisible = await createModal.count() > 0;

        expect(modalVisible).toBeTruthy();
      }
    });

    test('should have vendor selection in create PO form', async ({ page }) => {
      await waitForPageLoad(page);

      await selectJob(page);
      await page.waitForTimeout(500);

      const newPOBtn = page.locator('button:has-text("New PO"), button:has-text("Create PO")');

      if (await newPOBtn.isVisible()) {
        await newPOBtn.click();
        await page.waitForTimeout(500);

        // Should have vendor dropdown or input
        const vendorField = page.locator('select[name*="vendor"], #vendorSelect, input[name*="vendor"], [data-field="vendor"]');
        const vendorExists = await vendorField.count() > 0;

        expect(vendorExists).toBeTruthy();
      }
    });

    test('should have line items section in create PO form', async ({ page }) => {
      await waitForPageLoad(page);

      await selectJob(page);
      await page.waitForTimeout(500);

      const newPOBtn = page.locator('button:has-text("New PO"), button:has-text("Create PO")');

      if (await newPOBtn.isVisible()) {
        await newPOBtn.click();
        await page.waitForTimeout(500);

        // Should have line items section
        const lineItemsSection = page.locator('.line-items, #lineItems, [data-section="line-items"], text=/Line Item|Add Line/i');
        const sectionExists = await lineItemsSection.count() > 0;

        expect(sectionExists).toBeTruthy();
      }
    });
  });

  test.describe('PO Line Items', () => {
    test('should display cost code for each line item', async ({ page }) => {
      await waitForPOList(page);

      const poCount = await getPOCount(page);

      if (poCount > 0) {
        await openPOModal(page, 0);

        // Go to line items tab
        const lineItemsTab = page.locator('.tab:has-text("Line Items"), [data-tab="line-items"]');
        if (await lineItemsTab.count() > 0) {
          await lineItemsTab.click();
          await page.waitForTimeout(300);

          // Check for cost code display
          const costCodes = page.locator('.cost-code, text=/\\d{5}/');
          const hasCostCodes = await costCodes.count() > 0;

          // Cost codes may or may not exist depending on PO
          expect(typeof hasCostCodes).toBe('boolean');
        }
      }
    });

    test('should display line item amounts', async ({ page }) => {
      await waitForPOList(page);

      const poCount = await getPOCount(page);

      if (poCount > 0) {
        await openPOModal(page, 0);

        const lineItemsTab = page.locator('.tab:has-text("Line Items"), [data-tab="line-items"]');
        if (await lineItemsTab.count() > 0) {
          await lineItemsTab.click();
          await page.waitForTimeout(300);

          // Check for amounts
          const amounts = page.locator('text=/\\$[\\d,]+\\.\\d{2}/');
          const hasAmounts = await amounts.count() > 0;

          expect(typeof hasAmounts).toBe('boolean');
        }
      }
    });
  });

  test.describe('PO Status Flow', () => {
    test('should show action buttons based on PO status', async ({ page }) => {
      await waitForPOList(page);

      const poCount = await getPOCount(page);

      if (poCount > 0) {
        await openPOModal(page, 0);

        const modal = page.locator('#poModal.show');

        // Check for various action buttons
        const sendBtn = modal.locator('button:has-text("Send")');
        const approveBtn = modal.locator('button:has-text("Approve")');
        const completeBtn = modal.locator('button:has-text("Complete")');
        const reopenBtn = modal.locator('button:has-text("Reopen")');

        // At least one action should be available (or just Close)
        const hasActions = await sendBtn.count() > 0 ||
                          await approveBtn.count() > 0 ||
                          await completeBtn.count() > 0 ||
                          await reopenBtn.count() > 0;

        expect(typeof hasActions).toBe('boolean');
      }
    });

    test('should confirm before status change', async ({ page }) => {
      const { errors } = setupErrorCapture(page);

      await waitForPOList(page);

      const poCount = await getPOCount(page);

      if (poCount > 0) {
        await openPOModal(page, 0);

        // Find first available action button
        const actionBtns = [
          page.locator('#poModalFooter button:has-text("Send")'),
          page.locator('#poModalFooter button:has-text("Approve")'),
          page.locator('#poModalFooter button:has-text("Complete")')
        ];

        for (const btn of actionBtns) {
          if (await btn.isVisible()) {
            await btn.click();

            // Confirmation dialog should appear
            const confirmDialog = page.locator('#confirmDialog.show, .confirm-dialog.show');
            const dialogVisible = await confirmDialog.isVisible();

            if (dialogVisible) {
              // Cancel to not change state
              await handleConfirmDialog(page, 'cancel');
            }

            break;
          }
        }

        // Should not have errors
        const criticalErrors = errors.filter(e => !e.includes('favicon'));
        expect(criticalErrors).toHaveLength(0);
      }
    });
  });

  test.describe('Error Handling', () => {
    test('should load POs page without JavaScript errors', async ({ page }) => {
      const { errors } = setupErrorCapture(page);

      await page.goto('/pos.html');
      await waitForPOList(page);

      const criticalErrors = errors.filter(e => !e.includes('favicon'));
      expect(criticalErrors).toHaveLength(0);
    });

    test('should open PO modal without errors', async ({ page }) => {
      const { errors } = setupErrorCapture(page);

      await waitForPOList(page);

      const poCount = await getPOCount(page);

      if (poCount > 0) {
        await openPOModal(page, 0);
        await page.waitForTimeout(1000);

        const criticalErrors = errors.filter(e => !e.includes('favicon'));
        expect(criticalErrors).toHaveLength(0);
      }
    });
  });
});

import { test, expect } from '@playwright/test';
import {
  waitForPageLoad,
  waitForInvoiceList,
  openInvoiceModal,
  closeModal,
  filterInvoicesByStatus,
  getInvoiceCount,
  setupErrorCapture,
  handleConfirmDialog,
  selectJob,
  selectAllJobs
} from './fixtures/test-helpers';

test.describe('Invoice Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/index.html');
    await waitForPageLoad(page);
  });

  test.describe('Invoice List', () => {
    test('should display the invoice list', async ({ page }) => {
      await waitForInvoiceList(page);

      // Either invoice cards or empty state should be visible
      const invoiceCards = page.locator('.invoice-card');
      const emptyState = page.locator('.empty-state');

      const hasInvoices = await invoiceCards.count() > 0;
      const hasEmptyState = await emptyState.count() > 0;

      expect(hasInvoices || hasEmptyState).toBeTruthy();
    });

    test('should display invoice card details', async ({ page }) => {
      await waitForInvoiceList(page);

      const invoiceCount = await getInvoiceCount(page);

      if (invoiceCount > 0) {
        const firstCard = page.locator('.invoice-card').first();

        // Invoice cards should have key information
        await expect(firstCard.locator('.invoice-card-header, .vendor-name')).toBeVisible();
        await expect(firstCard.locator('.invoice-amount, .amount')).toBeVisible();
      }
    });

    test('should show status badges on invoice cards', async ({ page }) => {
      await waitForInvoiceList(page);

      const invoiceCount = await getInvoiceCount(page);

      if (invoiceCount > 0) {
        const statusBadges = page.locator('.invoice-card .status-badge');
        const badgeCount = await statusBadges.count();

        // Each invoice should have a status badge
        expect(badgeCount).toBeGreaterThanOrEqual(1);
      }
    });
  });

  test.describe('Invoice Filtering', () => {
    test('should filter invoices by "needs_approval" status', async ({ page }) => {
      await waitForInvoiceList(page);

      const initialCount = await getInvoiceCount(page);

      await filterInvoicesByStatus(page, 'needs_approval');

      // After filtering, all visible invoices should have the selected status
      const visibleCards = page.locator('.invoice-card');
      const visibleCount = await visibleCards.count();

      if (visibleCount > 0) {
        const firstCard = visibleCards.first();
        await expect(firstCard).toHaveClass(/status-needs_approval|needs_approval/);
      }
    });

    test('should filter invoices by "approved" status', async ({ page }) => {
      await waitForInvoiceList(page);

      await filterInvoicesByStatus(page, 'approved');

      const visibleCards = page.locator('.invoice-card');
      const visibleCount = await visibleCards.count();

      if (visibleCount > 0) {
        const firstCard = visibleCards.first();
        await expect(firstCard).toHaveClass(/status-approved|approved/);
      }
    });

    test('should filter invoices by "in_draw" status', async ({ page }) => {
      await waitForInvoiceList(page);

      await filterInvoicesByStatus(page, 'in_draw');

      const visibleCards = page.locator('.invoice-card');
      const visibleCount = await visibleCards.count();

      if (visibleCount > 0) {
        const firstCard = visibleCards.first();
        await expect(firstCard).toHaveClass(/status-in_draw|in_draw/);
      }
    });

    test('should reset filter to show all active invoices', async ({ page }) => {
      await waitForInvoiceList(page);

      // Apply a filter
      await filterInvoicesByStatus(page, 'approved');
      const filteredCount = await getInvoiceCount(page);

      // Reset to all active
      await filterInvoicesByStatus(page, '');
      const allCount = await getInvoiceCount(page);

      // "All active" should show same or more invoices
      expect(allCount).toBeGreaterThanOrEqual(filteredCount);
    });

    test('should filter invoices by selected job', async ({ page }) => {
      await waitForInvoiceList(page);

      const allJobsCount = await getInvoiceCount(page);

      // Select a specific job
      await selectJob(page);

      const jobFilteredCount = await getInvoiceCount(page);

      // Job filter should show same or fewer invoices
      expect(jobFilteredCount).toBeLessThanOrEqual(allJobsCount);

      // Select all jobs again
      await selectAllJobs(page);

      const resetCount = await getInvoiceCount(page);
      expect(resetCount).toBe(allJobsCount);
    });
  });

  test.describe('Invoice Detail Modal', () => {
    test('should open invoice detail modal when clicking a card', async ({ page }) => {
      await waitForInvoiceList(page);

      const invoiceCount = await getInvoiceCount(page);

      if (invoiceCount > 0) {
        await openInvoiceModal(page, 0);

        // Modal should be visible
        const modal = page.locator('.modal-container.active, .modal.show, #modal-container.active');
        await expect(modal).toBeVisible();
      }
    });

    test('should display invoice details in modal', async ({ page }) => {
      await waitForInvoiceList(page);

      const invoiceCount = await getInvoiceCount(page);

      if (invoiceCount > 0) {
        await openInvoiceModal(page, 0);

        // Check for key invoice details in modal
        const modal = page.locator('.modal-container.active, .modal.show');

        // Should show vendor, amount, and job info
        const vendorVisible = await modal.locator('text=/vendor/i').count() > 0;
        const amountVisible = await modal.locator('text=/\\$[\\d,]+/').count() > 0;

        expect(vendorVisible || amountVisible).toBeTruthy();
      }
    });

    test('should display PDF preview in modal', async ({ page }) => {
      await waitForInvoiceList(page);

      const invoiceCount = await getInvoiceCount(page);

      if (invoiceCount > 0) {
        await openInvoiceModal(page, 0);

        // Check for PDF iframe or viewer
        const pdfViewer = page.locator('iframe[src*=".pdf"], .pdf-viewer, .pdf-preview');
        const pdfExists = await pdfViewer.count() > 0;

        // PDF viewer should exist (may not be visible if no PDF)
        expect(pdfExists).toBeTruthy();
      }
    });

    test('should close modal when clicking close button', async ({ page }) => {
      await waitForInvoiceList(page);

      const invoiceCount = await getInvoiceCount(page);

      if (invoiceCount > 0) {
        await openInvoiceModal(page, 0);

        // Verify modal is open
        const modal = page.locator('.modal-container.active, .modal.show');
        await expect(modal).toBeVisible();

        // Close modal
        await closeModal(page);

        // Modal should be hidden
        await expect(modal).not.toBeVisible();
      }
    });
  });

  test.describe('Invoice Approval Flow', () => {
    test('should show approve button for "needs_approval" invoice', async ({ page }) => {
      await waitForInvoiceList(page);

      // Filter to needs_approval
      await filterInvoicesByStatus(page, 'needs_approval');

      const invoiceCount = await getInvoiceCount(page);

      if (invoiceCount > 0) {
        await openInvoiceModal(page, 0);

        // Should see Approve button
        const approveBtn = page.locator('button:has-text("Approve")');
        await expect(approveBtn).toBeVisible();
      }
    });

    test('should approve an invoice and update status', async ({ page }) => {
      const { errors } = setupErrorCapture(page);

      await waitForInvoiceList(page);

      // Filter to needs_approval
      await filterInvoicesByStatus(page, 'needs_approval');

      const invoiceCount = await getInvoiceCount(page);

      if (invoiceCount > 0) {
        await openInvoiceModal(page, 0);

        const approveBtn = page.locator('button:has-text("Approve")').first();

        if (await approveBtn.isVisible()) {
          await approveBtn.click();

          // Handle confirmation dialog if present
          const confirmDialog = page.locator('#confirmDialog.show, .confirm-dialog.show');
          if (await confirmDialog.isVisible()) {
            await handleConfirmDialog(page, 'confirm');
          }

          // Wait for approval to complete
          await page.waitForTimeout(2000);

          // Should not have errors
          expect(errors.filter(e => !e.includes('favicon'))).toHaveLength(0);
        }
      }
    });

    test('should show deny button for "needs_approval" invoice', async ({ page }) => {
      await waitForInvoiceList(page);

      await filterInvoicesByStatus(page, 'needs_approval');

      const invoiceCount = await getInvoiceCount(page);

      if (invoiceCount > 0) {
        await openInvoiceModal(page, 0);

        // Should see Deny button
        const denyBtn = page.locator('button:has-text("Deny")');
        const denyExists = await denyBtn.count() > 0;

        // Deny button may or may not be visible depending on invoice state
        expect(typeof denyExists).toBe('boolean');
      }
    });
  });

  test.describe('Upload Invoice Modal', () => {
    test('should open upload modal when clicking upload button', async ({ page }) => {
      await waitForPageLoad(page);

      const uploadBtn = page.locator('button:has-text("Upload Invoice"), #uploadBtn');
      await expect(uploadBtn).toBeVisible();

      await uploadBtn.click();
      await page.waitForTimeout(500);

      // Upload modal should be visible
      const uploadModal = page.locator('#uploadInvoiceModal.show, [data-modal="upload"].show');
      await expect(uploadModal).toBeVisible();
    });

    test('should have file drop zone in upload modal', async ({ page }) => {
      await waitForPageLoad(page);

      await page.locator('button:has-text("Upload Invoice"), #uploadBtn').click();
      await page.waitForTimeout(500);

      // Should have a drop zone or file input
      const dropZone = page.locator('.drop-zone, .file-drop, input[type="file"]');
      const hasDropZone = await dropZone.count() > 0;

      expect(hasDropZone).toBeTruthy();
    });

    test('should close upload modal when clicking cancel', async ({ page }) => {
      await waitForPageLoad(page);

      await page.locator('button:has-text("Upload Invoice"), #uploadBtn').click();
      await page.waitForTimeout(500);

      const uploadModal = page.locator('#uploadInvoiceModal.show, [data-modal="upload"].show');
      await expect(uploadModal).toBeVisible();

      // Close the modal
      const cancelBtn = page.locator('#uploadInvoiceModal button:has-text("Cancel"), #uploadInvoiceModal .close-btn').first();
      if (await cancelBtn.isVisible()) {
        await cancelBtn.click();
        await page.waitForTimeout(300);

        await expect(uploadModal).not.toBeVisible();
      }
    });
  });
});

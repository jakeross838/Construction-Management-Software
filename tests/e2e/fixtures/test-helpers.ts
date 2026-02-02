import { Page, expect } from '@playwright/test';

/**
 * Test Helper Utilities for Ross Built CMS E2E Tests
 */

/**
 * Wait for the page to fully load (sidebar, main content)
 */
export async function waitForPageLoad(page: Page, options: { timeout?: number } = {}): Promise<void> {
  const timeout = options.timeout || 10000;
  await page.waitForSelector('.job-sidebar', { timeout });
  await page.waitForLoadState('networkidle');
}

/**
 * Wait for invoice list to load
 */
export async function waitForInvoiceList(page: Page): Promise<void> {
  await page.waitForSelector('.invoice-list', { timeout: 10000 });
}

/**
 * Wait for PO list to load
 */
export async function waitForPOList(page: Page): Promise<void> {
  await page.waitForSelector('#poList', { timeout: 10000 });
}

/**
 * Wait for draw list to load
 */
export async function waitForDrawList(page: Page): Promise<void> {
  await page.waitForSelector('.draw-list, #drawList', { timeout: 10000 });
}

/**
 * Select a job from the sidebar
 */
export async function selectJob(page: Page, jobName?: string): Promise<void> {
  await page.waitForSelector('.job-item:not(.all-jobs)', { timeout: 10000 });

  if (jobName) {
    await page.locator(`.job-item:has-text("${jobName}")`).click();
  } else {
    // Select first job if no name specified
    await page.locator('.job-item:not(.all-jobs)').first().click();
  }
  await page.waitForTimeout(300); // Wait for filtering
}

/**
 * Select "All Jobs" in the sidebar
 */
export async function selectAllJobs(page: Page): Promise<void> {
  await page.locator('.job-item.all-jobs').click();
  await page.waitForTimeout(300);
}

/**
 * Open an invoice by clicking on its card
 * Returns the modal element
 */
export async function openInvoiceModal(page: Page, index: number = 0): Promise<void> {
  const invoiceCards = page.locator('.invoice-card');
  const count = await invoiceCards.count();

  if (count === 0) {
    throw new Error('No invoice cards found');
  }

  if (index >= count) {
    throw new Error(`Invoice index ${index} out of range (${count} invoices available)`);
  }

  await invoiceCards.nth(index).click();
  await page.waitForSelector('.modal-container.active, .modal.show, #modal-container.active', { timeout: 5000 });
}

/**
 * Open a PO by clicking on its row
 */
export async function openPOModal(page: Page, index: number = 0): Promise<void> {
  const poRows = page.locator('.po-row');
  const count = await poRows.count();

  if (count === 0) {
    throw new Error('No PO rows found');
  }

  if (index >= count) {
    throw new Error(`PO index ${index} out of range (${count} POs available)`);
  }

  await poRows.nth(index).click();
  await page.waitForSelector('#poModal.show', { timeout: 5000 });
}

/**
 * Open a draw by clicking on its row
 */
export async function openDrawModal(page: Page, index: number = 0): Promise<void> {
  const drawRows = page.locator('.draw-row');
  const count = await drawRows.count();

  if (count === 0) {
    throw new Error('No draw rows found');
  }

  if (index >= count) {
    throw new Error(`Draw index ${index} out of range (${count} draws available)`);
  }

  await drawRows.nth(index).click();
  await page.waitForSelector('#drawModal.show', { timeout: 5000 });
}

/**
 * Close the currently open modal
 */
export async function closeModal(page: Page): Promise<void> {
  // Try different close button selectors
  const closeButton = page.locator('.modal.show .close-btn, .modal.show button:has-text("Close"), .modal-fullscreen-dark.show .close-btn').first();

  if (await closeButton.isVisible()) {
    await closeButton.click();
    await page.waitForTimeout(300);
  }
}

/**
 * Apply a status filter to the invoice list
 */
export async function filterInvoicesByStatus(page: Page, status: string): Promise<void> {
  const statusFilter = page.locator('#statusFilter');
  await statusFilter.selectOption(status);
  await page.waitForTimeout(500); // Wait for filtering
}

/**
 * Apply a status filter to the PO list
 */
export async function filterPOsByStatus(page: Page, status: string): Promise<void> {
  const statusFilter = page.locator('#poStatusFilter, select[id*="status"]').first();
  if (await statusFilter.isVisible()) {
    await statusFilter.selectOption(status);
    await page.waitForTimeout(500);
  }
}

/**
 * Get the count of invoice cards
 */
export async function getInvoiceCount(page: Page): Promise<number> {
  return await page.locator('.invoice-card').count();
}

/**
 * Get the count of PO rows
 */
export async function getPOCount(page: Page): Promise<number> {
  return await page.locator('.po-row').count();
}

/**
 * Get the count of draw rows
 */
export async function getDrawCount(page: Page): Promise<number> {
  return await page.locator('.draw-row').count();
}

/**
 * Navigate to a page using the sub-navigation
 */
export async function navigateToPage(page: Page, pageName: 'Invoices' | 'Purchase Orders' | 'Draws' | 'Budget'): Promise<void> {
  await page.locator(`.sub-nav-link:has-text("${pageName}")`).click();
  await page.waitForLoadState('networkidle');
}

/**
 * Check if a toast message is visible with specific text
 */
export async function expectToast(page: Page, text: string, type?: 'success' | 'error'): Promise<void> {
  const toast = page.locator('.toast');
  await expect(toast).toBeVisible({ timeout: 5000 });
  await expect(toast).toContainText(text);

  if (type === 'success') {
    await expect(toast).toHaveClass(/success/);
  } else if (type === 'error') {
    await expect(toast).toHaveClass(/error/);
  }
}

/**
 * Wait for a confirmation dialog and click confirm/cancel
 */
export async function handleConfirmDialog(page: Page, action: 'confirm' | 'cancel'): Promise<void> {
  await page.waitForSelector('#confirmDialog.show', { timeout: 3000 });

  if (action === 'confirm') {
    await page.locator('#confirmBtn').click();
  } else {
    await page.locator('#cancelBtn, #confirmDialog button:has-text("Cancel")').click();
  }

  await page.waitForTimeout(500);
}

/**
 * Switch to a specific tab in a modal
 */
export async function switchToTab(page: Page, tabName: string): Promise<void> {
  await page.locator(`.tab:has-text("${tabName}"), .tab-btn:has-text("${tabName}")`).click();
  await page.waitForTimeout(300);
}

/**
 * Get all console errors captured during test
 */
export function setupErrorCapture(page: Page): { errors: string[]; networkErrors: string[] } {
  const errors: string[] = [];
  const networkErrors: string[] = [];

  page.on('pageerror', err => {
    errors.push(err.message);
  });

  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });

  page.on('requestfailed', request => {
    networkErrors.push(`${request.url()} - ${request.failure()?.errorText}`);
  });

  page.on('response', response => {
    if (response.status() >= 400) {
      networkErrors.push(`${response.status()} - ${response.url()}`);
    }
  });

  return { errors, networkErrors };
}

/**
 * Take a screenshot with a descriptive name in the e2e screenshots folder
 */
export async function takeScreenshot(page: Page, name: string): Promise<void> {
  await page.screenshot({
    path: `tests/e2e/screenshots/${name}.png`,
    fullPage: true
  });
}

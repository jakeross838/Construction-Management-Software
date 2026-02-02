import { Page, expect } from '@playwright/test';

/**
 * Test Helper Utilities for Ross Built CMS E2E Tests
 * Updated for React/shadcn UI structure
 */

// ============================================================
// AUTHENTICATION HELPERS
// ============================================================

/**
 * Log in with test credentials
 * Handles the React app's auth flow
 */
export async function login(page: Page, email: string = 'test@rossbuilt.com', password: string = 'testpassword123'): Promise<void> {
  // If already logged in, skip
  if (await page.url().includes('/login') === false && await page.locator('aside').isVisible().catch(() => false)) {
    return;
  }

  await page.goto('/login');
  await page.waitForLoadState('networkidle');

  // Fill login form
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');

  // Wait for redirect to dashboard
  await page.waitForURL(/\/$|\/dashboard/, { timeout: 10000 });
  await page.waitForLoadState('networkidle');
}

/**
 * Skip auth for development/testing by setting mock auth state
 * Use this when auth is disabled in test environment
 */
export async function skipAuth(page: Page): Promise<void> {
  // The React app checks for auth state - in test mode it may auto-login
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // If redirected to login, try demo/test login
  if (page.url().includes('/login')) {
    await login(page);
  }
}

// ============================================================
// PAGE NAVIGATION HELPERS
// ============================================================

/**
 * Wait for the React app to fully load (sidebar, main content)
 */
export async function waitForPageLoad(page: Page, options: { timeout?: number } = {}): Promise<void> {
  const timeout = options.timeout || 15000;

  // Wait for the main sidebar (React uses aside element)
  await page.waitForSelector('aside', { timeout });

  // Wait for network to settle
  await page.waitForLoadState('networkidle');
}

/**
 * Navigate to a page in the React app
 */
export async function navigateTo(page: Page, route: string): Promise<void> {
  await page.goto(route);
  await page.waitForLoadState('networkidle');
  await waitForPageLoad(page);
}

/**
 * Navigate using the sidebar links
 */
export async function navigateViaSidebar(page: Page, linkText: string): Promise<void> {
  // Find the nav link in sidebar
  const link = page.locator(`aside a:has-text("${linkText}")`).first();
  await link.click();
  await page.waitForLoadState('networkidle');
}

// ============================================================
// JOB SELECTION HELPERS
// ============================================================

/**
 * Select a job from the job selector dropdown in header
 * React app uses a Select component in the header/job context
 */
export async function selectJob(page: Page, jobName?: string): Promise<void> {
  // Look for job selector trigger - could be a button or select
  const jobSelector = page.locator('[data-testid="job-selector"], [role="combobox"]:has-text("Job"), button:has-text("Select Job"), button:has-text("All Jobs")').first();

  if (await jobSelector.isVisible()) {
    await jobSelector.click();
    await page.waitForTimeout(200);

    if (jobName) {
      // Select specific job
      await page.locator(`[role="option"]:has-text("${jobName}"), [data-value]:has-text("${jobName}")`).click();
    } else {
      // Select first available job
      await page.locator('[role="option"], [data-value]').first().click();
    }
    await page.waitForTimeout(300);
  }
}

/**
 * Select "All Jobs" option
 */
export async function selectAllJobs(page: Page): Promise<void> {
  const jobSelector = page.locator('[data-testid="job-selector"], button:has-text("Job")').first();
  if (await jobSelector.isVisible()) {
    await jobSelector.click();
    await page.waitForTimeout(200);
    await page.locator('[role="option"]:has-text("All Jobs")').click();
    await page.waitForTimeout(300);
  }
}

// ============================================================
// LIST WAIT HELPERS
// ============================================================

/**
 * Wait for a table or list to load data
 */
export async function waitForDataList(page: Page, type: 'table' | 'cards' = 'table'): Promise<void> {
  if (type === 'table') {
    await page.waitForSelector('table tbody tr, [role="table"] [role="row"]', { timeout: 10000 }).catch(() => {
      // Empty state is also valid
      return page.waitForSelector(':has-text("No data"), :has-text("No results")', { timeout: 2000 }).catch(() => {});
    });
  } else {
    await page.waitForSelector('[class*="card"], [class*="Card"]', { timeout: 10000 }).catch(() => {});
  }
}

/**
 * Wait for invoice list to load (React uses table/cards)
 */
export async function waitForInvoiceList(page: Page): Promise<void> {
  await page.waitForSelector('table tbody tr, [data-testid="invoice-row"], [class*="invoice"]', { timeout: 10000 }).catch(() => {
    // Empty state
    return page.waitForSelector(':has-text("No invoices")', { timeout: 2000 }).catch(() => {});
  });
}

/**
 * Wait for PO list to load
 */
export async function waitForPOList(page: Page): Promise<void> {
  await page.waitForSelector('table tbody tr, [data-testid="po-row"]', { timeout: 10000 }).catch(() => {
    return page.waitForSelector(':has-text("No purchase orders")', { timeout: 2000 }).catch(() => {});
  });
}

/**
 * Wait for draw list to load
 */
export async function waitForDrawList(page: Page): Promise<void> {
  await page.waitForSelector('table tbody tr, [data-testid="draw-row"]', { timeout: 10000 }).catch(() => {
    return page.waitForSelector(':has-text("No draws")', { timeout: 2000 }).catch(() => {});
  });
}

// ============================================================
// MODAL/DIALOG HELPERS
// ============================================================

/**
 * Wait for a dialog/modal to open (shadcn uses [role="dialog"])
 */
export async function waitForDialog(page: Page): Promise<void> {
  await page.waitForSelector('[role="dialog"], [data-state="open"]', { timeout: 5000 });
}

/**
 * Close the currently open dialog
 */
export async function closeDialog(page: Page): Promise<void> {
  // Try different close methods for shadcn dialogs
  const closeButton = page.locator('[role="dialog"] button:has-text("Close"), [role="dialog"] button[aria-label="Close"], [role="dialog"] [class*="close"]').first();

  if (await closeButton.isVisible()) {
    await closeButton.click();
  } else {
    // Try pressing Escape
    await page.keyboard.press('Escape');
  }
  await page.waitForTimeout(300);
}

/**
 * Click a row in a table to open details
 */
export async function clickTableRow(page: Page, index: number = 0): Promise<void> {
  const rows = page.locator('table tbody tr');
  const count = await rows.count();

  if (count === 0) {
    throw new Error('No rows found in table');
  }

  if (index >= count) {
    throw new Error(`Row index ${index} out of range (${count} rows available)`);
  }

  await rows.nth(index).click();
  await page.waitForTimeout(300);
}

// ============================================================
// FORM HELPERS
// ============================================================

/**
 * Fill a shadcn Select component
 */
export async function selectOption(page: Page, triggerSelector: string, optionText: string): Promise<void> {
  await page.locator(triggerSelector).click();
  await page.waitForTimeout(200);
  await page.locator(`[role="option"]:has-text("${optionText}")`).click();
  await page.waitForTimeout(200);
}

/**
 * Fill a form field by label
 */
export async function fillFormField(page: Page, label: string, value: string): Promise<void> {
  const field = page.locator(`label:has-text("${label}") + input, label:has-text("${label}") ~ input, [aria-label="${label}"]`).first();
  await field.fill(value);
}

// ============================================================
// COUNT HELPERS
// ============================================================

/**
 * Get count of table rows
 */
export async function getTableRowCount(page: Page): Promise<number> {
  return await page.locator('table tbody tr').count();
}

/**
 * Get the count of invoice rows
 */
export async function getInvoiceCount(page: Page): Promise<number> {
  return await page.locator('table tbody tr, [data-testid="invoice-row"]').count();
}

/**
 * Get the count of PO rows
 */
export async function getPOCount(page: Page): Promise<number> {
  return await page.locator('table tbody tr, [data-testid="po-row"]').count();
}

/**
 * Get the count of draw rows
 */
export async function getDrawCount(page: Page): Promise<number> {
  return await page.locator('table tbody tr, [data-testid="draw-row"]').count();
}

// ============================================================
// FILTER HELPERS
// ============================================================

/**
 * Apply a status filter via Select component
 */
export async function filterByStatus(page: Page, status: string): Promise<void> {
  const statusFilter = page.locator('button:has-text("Status"), [data-testid="status-filter"]').first();
  if (await statusFilter.isVisible()) {
    await statusFilter.click();
    await page.waitForTimeout(200);
    await page.locator(`[role="option"]:has-text("${status}")`).click();
    await page.waitForTimeout(500);
  }
}

/**
 * Search using the search input
 */
export async function search(page: Page, query: string): Promise<void> {
  const searchInput = page.locator('input[placeholder*="Search"], input[type="search"], [data-testid="search-input"]').first();
  await searchInput.fill(query);
  await page.waitForTimeout(500); // Debounce
}

// ============================================================
// TOAST/NOTIFICATION HELPERS
// ============================================================

/**
 * Check if a toast notification is visible with specific text
 */
export async function expectToast(page: Page, text: string, type?: 'success' | 'error'): Promise<void> {
  // shadcn/sonner uses different toast structure
  const toast = page.locator('[data-sonner-toast], [role="status"], [class*="toast"]');
  await expect(toast).toBeVisible({ timeout: 5000 });
  await expect(toast).toContainText(text);
}

/**
 * Wait for toast to disappear
 */
export async function waitForToastDismiss(page: Page): Promise<void> {
  await page.waitForSelector('[data-sonner-toast], [class*="toast"]', { state: 'hidden', timeout: 10000 }).catch(() => {});
}

// ============================================================
// CONFIRMATION DIALOG HELPERS
// ============================================================

/**
 * Handle an alert dialog (shadcn AlertDialog)
 */
export async function handleAlertDialog(page: Page, action: 'confirm' | 'cancel'): Promise<void> {
  await page.waitForSelector('[role="alertdialog"]', { timeout: 3000 });

  if (action === 'confirm') {
    await page.locator('[role="alertdialog"] button:has-text("Confirm"), [role="alertdialog"] button:has-text("Yes"), [role="alertdialog"] button:has-text("Delete")').click();
  } else {
    await page.locator('[role="alertdialog"] button:has-text("Cancel"), [role="alertdialog"] button:has-text("No")').click();
  }

  await page.waitForTimeout(500);
}

// ============================================================
// TAB HELPERS
// ============================================================

/**
 * Switch to a specific tab (shadcn Tabs)
 */
export async function switchToTab(page: Page, tabName: string): Promise<void> {
  await page.locator(`[role="tab"]:has-text("${tabName}")`).click();
  await page.waitForTimeout(300);
}

// ============================================================
// ERROR CAPTURE HELPERS
// ============================================================

/**
 * Setup error capture for the page
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
    if (response.status() >= 400 && !response.url().includes('/api/')) {
      // Ignore expected 401s for auth
      if (response.status() !== 401) {
        networkErrors.push(`${response.status()} - ${response.url()}`);
      }
    }
  });

  return { errors, networkErrors };
}

/**
 * Take a screenshot with a descriptive name
 */
export async function takeScreenshot(page: Page, name: string): Promise<void> {
  await page.screenshot({
    path: `tests/e2e/screenshots/${name}.png`,
    fullPage: true
  });
}

// ============================================================
// LEGACY COMPATIBILITY (for gradual migration)
// ============================================================

/**
 * Legacy: Open an invoice modal (updated for React)
 */
export async function openInvoiceModal(page: Page, index: number = 0): Promise<void> {
  const rows = page.locator('table tbody tr');
  const count = await rows.count();

  if (count === 0) {
    throw new Error('No invoice rows found');
  }

  await rows.nth(index).click();
  await waitForDialog(page);
}

/**
 * Legacy: Open a PO modal (updated for React)
 */
export async function openPOModal(page: Page, index: number = 0): Promise<void> {
  const rows = page.locator('table tbody tr');
  const count = await rows.count();

  if (count === 0) {
    throw new Error('No PO rows found');
  }

  await rows.nth(index).click();
  await waitForDialog(page);
}

/**
 * Legacy: Open a draw modal (updated for React)
 */
export async function openDrawModal(page: Page, index: number = 0): Promise<void> {
  const rows = page.locator('table tbody tr');
  const count = await rows.count();

  if (count === 0) {
    throw new Error('No draw rows found');
  }

  await rows.nth(index).click();
  await waitForDialog(page);
}

/**
 * Legacy: Close modal (updated for React)
 */
export async function closeModal(page: Page): Promise<void> {
  await closeDialog(page);
}

/**
 * Legacy: Navigate to page by name
 */
export async function navigateToPage(page: Page, pageName: 'Invoices' | 'Purchase Orders' | 'Draws' | 'Budget'): Promise<void> {
  const routes: Record<string, string> = {
    'Invoices': '/invoices',
    'Purchase Orders': '/purchase-orders',
    'Draws': '/draws',
    'Budget': '/budget',
  };

  await navigateTo(page, routes[pageName] || '/');
}

/**
 * Legacy: Filter invoices by status
 */
export async function filterInvoicesByStatus(page: Page, status: string): Promise<void> {
  await filterByStatus(page, status);
}

/**
 * Legacy: Filter POs by status
 */
export async function filterPOsByStatus(page: Page, status: string): Promise<void> {
  await filterByStatus(page, status);
}

/**
 * Legacy: Handle confirm dialog
 */
export async function handleConfirmDialog(page: Page, action: 'confirm' | 'cancel'): Promise<void> {
  await handleAlertDialog(page, action);
}

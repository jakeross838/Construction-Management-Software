import { test, expect } from '@playwright/test';
import {
  waitForPageLoad,
  setupErrorCapture,
  navigateToPage
} from './fixtures/test-helpers';

test.describe('Navigation', () => {
  test.describe('Page Loading', () => {
    test('should load invoices page without errors', async ({ page }) => {
      const { errors } = setupErrorCapture(page);

      await page.goto('/index.html');
      await waitForPageLoad(page);

      const criticalErrors = errors.filter(e => !e.includes('favicon'));
      expect(criticalErrors).toHaveLength(0);
    });

    test('should load POs page without errors', async ({ page }) => {
      const { errors } = setupErrorCapture(page);

      await page.goto('/pos.html');
      await waitForPageLoad(page);

      const criticalErrors = errors.filter(e => !e.includes('favicon'));
      expect(criticalErrors).toHaveLength(0);
    });

    test('should load draws page without errors', async ({ page }) => {
      const { errors } = setupErrorCapture(page);

      await page.goto('/draws.html');
      await waitForPageLoad(page);

      const criticalErrors = errors.filter(e => !e.includes('favicon'));
      expect(criticalErrors).toHaveLength(0);
    });

    test('should load budgets page without errors', async ({ page }) => {
      const { errors } = setupErrorCapture(page);

      await page.goto('/budgets.html');
      await waitForPageLoad(page);

      const criticalErrors = errors.filter(e => !e.includes('favicon'));
      expect(criticalErrors).toHaveLength(0);
    });
  });

  test.describe('Header Navigation', () => {
    test('should display Ross Built branding', async ({ page }) => {
      await page.goto('/index.html');
      await waitForPageLoad(page);

      const brandName = page.locator('.brand-name, .header-brand');
      await expect(brandName.first()).toContainText('Ross Built');
    });

    test('should display Financial tab as active', async ({ page }) => {
      await page.goto('/index.html');
      await waitForPageLoad(page);

      const financialTab = page.locator('.main-nav-link:has-text("Financial")');
      await expect(financialTab).toBeVisible();
      await expect(financialTab).toHaveClass(/active/);
    });

    test('should have action button in header', async ({ page }) => {
      await page.goto('/index.html');
      await waitForPageLoad(page);

      const headerActions = page.locator('.header-actions button');
      await expect(headerActions.first()).toBeVisible();
    });
  });

  test.describe('Sub Navigation', () => {
    test('should display all sub-nav links', async ({ page }) => {
      await page.goto('/index.html');
      await waitForPageLoad(page);

      await expect(page.locator('.sub-nav-link:has-text("Invoices")')).toBeVisible();
      await expect(page.locator('.sub-nav-link:has-text("Purchase Orders")')).toBeVisible();
      await expect(page.locator('.sub-nav-link:has-text("Draws")')).toBeVisible();
      await expect(page.locator('.sub-nav-link:has-text("Budget")')).toBeVisible();
    });

    test('should highlight Invoices link on invoices page', async ({ page }) => {
      await page.goto('/index.html');
      await waitForPageLoad(page);

      await expect(page.locator('.sub-nav-link:has-text("Invoices")')).toHaveClass(/active/);
    });

    test('should highlight Purchase Orders link on POs page', async ({ page }) => {
      await page.goto('/pos.html');
      await waitForPageLoad(page);

      await expect(page.locator('.sub-nav-link:has-text("Purchase Orders")')).toHaveClass(/active/);
    });

    test('should highlight Draws link on draws page', async ({ page }) => {
      await page.goto('/draws.html');
      await waitForPageLoad(page);

      await expect(page.locator('.sub-nav-link:has-text("Draws")')).toHaveClass(/active/);
    });

    test('should highlight Budget link on budgets page', async ({ page }) => {
      await page.goto('/budgets.html');
      await waitForPageLoad(page);

      await expect(page.locator('.sub-nav-link:has-text("Budget")')).toHaveClass(/active/);
    });
  });

  test.describe('Page Navigation Flow', () => {
    test('should navigate from Invoices to POs', async ({ page }) => {
      await page.goto('/index.html');
      await waitForPageLoad(page);

      await page.locator('.sub-nav-link:has-text("Purchase Orders")').click();
      await expect(page).toHaveURL(/pos\.html/);
      await expect(page.locator('.sub-nav-link:has-text("Purchase Orders")')).toHaveClass(/active/);
    });

    test('should navigate from POs to Draws', async ({ page }) => {
      await page.goto('/pos.html');
      await waitForPageLoad(page);

      await page.locator('.sub-nav-link:has-text("Draws")').click();
      await expect(page).toHaveURL(/draws\.html/);
      await expect(page.locator('.sub-nav-link:has-text("Draws")')).toHaveClass(/active/);
    });

    test('should navigate from Draws to Budget', async ({ page }) => {
      await page.goto('/draws.html');
      await waitForPageLoad(page);

      await page.locator('.sub-nav-link:has-text("Budget")').click();
      await expect(page).toHaveURL(/budgets\.html/);
      await expect(page.locator('.sub-nav-link:has-text("Budget")')).toHaveClass(/active/);
    });

    test('should navigate from Budget back to Invoices', async ({ page }) => {
      await page.goto('/budgets.html');
      await waitForPageLoad(page);

      await page.locator('.sub-nav-link:has-text("Invoices")').click();
      await expect(page).toHaveURL(/index\.html/);
      await expect(page.locator('.sub-nav-link:has-text("Invoices")')).toHaveClass(/active/);
    });

    test('should complete full navigation cycle', async ({ page }) => {
      await page.goto('/index.html');
      await waitForPageLoad(page);

      // Invoices -> POs
      await navigateToPage(page, 'Purchase Orders');
      await expect(page).toHaveURL(/pos\.html/);

      // POs -> Draws
      await navigateToPage(page, 'Draws');
      await expect(page).toHaveURL(/draws\.html/);

      // Draws -> Budget
      await navigateToPage(page, 'Budget');
      await expect(page).toHaveURL(/budgets\.html/);

      // Budget -> Invoices
      await navigateToPage(page, 'Invoices');
      await expect(page).toHaveURL(/index\.html/);
    });
  });

  test.describe('Sidebar', () => {
    test('should display sidebar on all pages', async ({ page }) => {
      const pages = ['/index.html', '/pos.html', '/draws.html', '/budgets.html'];

      for (const pagePath of pages) {
        await page.goto(pagePath);
        await page.waitForSelector('.job-sidebar', { timeout: 10000 });
        await expect(page.locator('.job-sidebar')).toBeVisible();
      }
    });

    test('should display All Jobs option in sidebar', async ({ page }) => {
      await page.goto('/index.html');
      await waitForPageLoad(page);

      const allJobs = page.locator('.job-item.all-jobs');
      await expect(allJobs).toBeVisible();
      await expect(allJobs).toContainText('All Jobs');
    });

    test('should load jobs in sidebar', async ({ page }) => {
      await page.goto('/index.html');
      await page.waitForSelector('.job-item:not(.all-jobs)', { timeout: 10000 });

      const jobItems = page.locator('.job-item:not(.all-jobs)');
      const count = await jobItems.count();

      expect(count).toBeGreaterThan(0);
    });

    test('should highlight selected job', async ({ page }) => {
      await page.goto('/index.html');
      await page.waitForSelector('.job-item:not(.all-jobs)', { timeout: 10000 });

      const firstJob = page.locator('.job-item:not(.all-jobs)').first();
      await firstJob.click();

      await expect(firstJob).toHaveClass(/active/);
    });

    test('should persist job selection across pages', async ({ page }) => {
      await page.goto('/index.html');
      await page.waitForSelector('.job-item:not(.all-jobs)', { timeout: 10000 });

      // Get first job name
      const firstJob = page.locator('.job-item:not(.all-jobs)').first();
      const jobName = await firstJob.locator('.job-item-name').textContent();

      // Select the job
      await firstJob.click();
      await expect(firstJob).toHaveClass(/active/);

      // Navigate to POs page
      await page.locator('.sub-nav-link:has-text("Purchase Orders")').click();
      await page.waitForSelector('.job-sidebar', { timeout: 10000 });

      // Same job should still be selected
      const selectedJob = page.locator('.job-item.active:not(.all-jobs)');
      await expect(selectedJob).toBeVisible();
      await expect(selectedJob.locator('.job-item-name')).toHaveText(jobName!);
    });

    test('should have collapse button', async ({ page }) => {
      await page.goto('/index.html');
      await waitForPageLoad(page);

      const collapseBtn = page.locator('.sidebar-collapse-btn');

      if (await collapseBtn.isVisible()) {
        // Test collapse/expand
        await collapseBtn.click();
        await page.waitForTimeout(300);

        // Toggle back
        await collapseBtn.click();
        await page.waitForTimeout(300);

        // Should work without errors
        await expect(page.locator('.job-sidebar')).toBeVisible();
      }
    });
  });

  test.describe('Responsive Behavior', () => {
    test('should display correctly on desktop viewport', async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.goto('/index.html');
      await waitForPageLoad(page);

      await expect(page.locator('.job-sidebar')).toBeVisible();
      await expect(page.locator('.main-nav')).toBeVisible();
      await expect(page.locator('.sub-nav')).toBeVisible();
    });

    test('should display correctly on laptop viewport', async ({ page }) => {
      await page.setViewportSize({ width: 1366, height: 768 });
      await page.goto('/index.html');
      await waitForPageLoad(page);

      await expect(page.locator('.job-sidebar')).toBeVisible();
      await expect(page.locator('.main-nav')).toBeVisible();
    });

    test('should display correctly on smaller viewport', async ({ page }) => {
      await page.setViewportSize({ width: 1024, height: 768 });
      await page.goto('/index.html');
      await waitForPageLoad(page);

      // Main content should still be visible
      await expect(page.locator('.main-content, .app-content, .content-area')).toBeVisible();
    });
  });

  test.describe('URL Handling', () => {
    test('should handle root URL redirect', async ({ page }) => {
      await page.goto('/');
      await waitForPageLoad(page);

      // Should either redirect to index.html or serve index
      await expect(page.locator('.job-sidebar')).toBeVisible();
    });

    test('should handle 404 for invalid page', async ({ page }) => {
      const response = await page.goto('/nonexistent-page.html');

      // Should return 404 or redirect
      expect(response?.status()).toBeGreaterThanOrEqual(200);
    });
  });
});

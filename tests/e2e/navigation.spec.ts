import { test, expect } from '@playwright/test';
import {
  waitForPageLoad,
  setupErrorCapture,
  navigateTo
} from './fixtures/test-helpers';

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Skip if redirected to login
    if (page.url().includes('/login')) {
      test.skip();
    }
  });

  test.describe('Page Loading', () => {
    test('should load invoices page without errors', async ({ page }) => {
      const { errors } = setupErrorCapture(page);

      await page.goto('/invoices');
      await page.waitForLoadState('networkidle');
      await waitForPageLoad(page);

      const criticalErrors = errors.filter(e =>
        !e.includes('favicon') &&
        !e.includes('401') &&
        !e.includes('ResizeObserver')
      );
      expect(criticalErrors).toHaveLength(0);
    });

    test('should load POs page without errors', async ({ page }) => {
      const { errors } = setupErrorCapture(page);

      await page.goto('/purchase-orders');
      await page.waitForLoadState('networkidle');
      await waitForPageLoad(page);

      const criticalErrors = errors.filter(e =>
        !e.includes('favicon') &&
        !e.includes('401') &&
        !e.includes('ResizeObserver')
      );
      expect(criticalErrors).toHaveLength(0);
    });

    test('should load draws page without errors', async ({ page }) => {
      const { errors } = setupErrorCapture(page);

      await page.goto('/draws');
      await page.waitForLoadState('networkidle');
      await waitForPageLoad(page);

      const criticalErrors = errors.filter(e =>
        !e.includes('favicon') &&
        !e.includes('401') &&
        !e.includes('ResizeObserver')
      );
      expect(criticalErrors).toHaveLength(0);
    });

    test('should load budget page without errors', async ({ page }) => {
      const { errors } = setupErrorCapture(page);

      await page.goto('/budget');
      await page.waitForLoadState('networkidle');
      await waitForPageLoad(page);

      const criticalErrors = errors.filter(e =>
        !e.includes('favicon') &&
        !e.includes('401') &&
        !e.includes('ResizeObserver')
      );
      expect(criticalErrors).toHaveLength(0);
    });
  });

  test.describe('Sidebar Navigation', () => {
    test('should display sidebar on all pages', async ({ page }) => {
      const pages = ['/invoices', '/purchase-orders', '/draws', '/budget'];

      for (const pagePath of pages) {
        await page.goto(pagePath);
        await page.waitForLoadState('networkidle');

        if (!page.url().includes('/login')) {
          await page.waitForSelector('aside', { timeout: 10000 });
          await expect(page.locator('aside')).toBeVisible();
        }
      }
    });

    test('should have navigation links in sidebar', async ({ page }) => {
      await page.goto('/invoices');
      await page.waitForLoadState('networkidle');

      if (!page.url().includes('/login')) {
        await waitForPageLoad(page);

        const navLinks = page.locator('aside a');
        const count = await navLinks.count();

        expect(count).toBeGreaterThan(3);
      }
    });

    test('should highlight active navigation item', async ({ page }) => {
      await page.goto('/invoices');
      await page.waitForLoadState('networkidle');

      if (!page.url().includes('/login')) {
        await waitForPageLoad(page);

        // The active link should have special styling
        const invoicesLink = page.locator('aside a[href="/invoices"]');
        await expect(invoicesLink).toBeVisible();
        await expect(invoicesLink).toHaveClass(/active|bg-/);
      }
    });
  });

  test.describe('Page Navigation Flow', () => {
    test('should navigate from Invoices to POs', async ({ page }) => {
      await page.goto('/invoices');
      await page.waitForLoadState('networkidle');

      if (!page.url().includes('/login')) {
        await waitForPageLoad(page);

        await page.click('aside a[href="/purchase-orders"]');
        await page.waitForLoadState('networkidle');

        expect(page.url()).toContain('/purchase-orders');
      }
    });

    test('should navigate from POs to Draws', async ({ page }) => {
      await page.goto('/purchase-orders');
      await page.waitForLoadState('networkidle');

      if (!page.url().includes('/login')) {
        await waitForPageLoad(page);

        await page.click('aside a[href="/draws"]');
        await page.waitForLoadState('networkidle');

        expect(page.url()).toContain('/draws');
      }
    });

    test('should navigate from Draws to Budget', async ({ page }) => {
      await page.goto('/draws');
      await page.waitForLoadState('networkidle');

      if (!page.url().includes('/login')) {
        await waitForPageLoad(page);

        await page.click('aside a[href="/budget"]');
        await page.waitForLoadState('networkidle');

        expect(page.url()).toContain('/budget');
      }
    });

    test('should navigate from Budget back to Invoices', async ({ page }) => {
      await page.goto('/budget');
      await page.waitForLoadState('networkidle');

      if (!page.url().includes('/login')) {
        await waitForPageLoad(page);

        await page.click('aside a[href="/invoices"]');
        await page.waitForLoadState('networkidle');

        expect(page.url()).toContain('/invoices');
      }
    });

    test('should complete full navigation cycle', async ({ page }) => {
      await page.goto('/invoices');
      await page.waitForLoadState('networkidle');

      if (!page.url().includes('/login')) {
        await waitForPageLoad(page);

        // Invoices -> POs
        await page.click('aside a[href="/purchase-orders"]');
        await page.waitForLoadState('networkidle');
        expect(page.url()).toContain('/purchase-orders');

        // POs -> Draws
        await page.click('aside a[href="/draws"]');
        await page.waitForLoadState('networkidle');
        expect(page.url()).toContain('/draws');

        // Draws -> Budget
        await page.click('aside a[href="/budget"]');
        await page.waitForLoadState('networkidle');
        expect(page.url()).toContain('/budget');

        // Budget -> Invoices
        await page.click('aside a[href="/invoices"]');
        await page.waitForLoadState('networkidle');
        expect(page.url()).toContain('/invoices');
      }
    });
  });

  test.describe('Job Selector', () => {
    test('should have job selector in header or sidebar', async ({ page }) => {
      await page.goto('/invoices');
      await page.waitForLoadState('networkidle');

      if (!page.url().includes('/login')) {
        await waitForPageLoad(page);

        const jobSelector = page.locator('[data-testid="job-selector"], button:has-text("Job"), button:has-text("All Jobs")').first();
        await expect(jobSelector).toBeVisible({ timeout: 10000 });
      }
    });

    test('should show job options when clicking selector', async ({ page }) => {
      await page.goto('/invoices');
      await page.waitForLoadState('networkidle');

      if (!page.url().includes('/login')) {
        await waitForPageLoad(page);

        const jobSelector = page.locator('[data-testid="job-selector"], button:has-text("Job"), button:has-text("All Jobs")').first();

        if (await jobSelector.isVisible()) {
          await jobSelector.click();
          await page.waitForTimeout(300);

          // Should show options
          const options = page.locator('[role="option"], [role="listbox"] [data-value]');
          const count = await options.count();
          expect(count).toBeGreaterThanOrEqual(1);
        }
      }
    });
  });

  test.describe('Responsive Behavior', () => {
    test('should display correctly on desktop viewport', async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.goto('/invoices');
      await page.waitForLoadState('networkidle');

      if (!page.url().includes('/login')) {
        await waitForPageLoad(page);

        await expect(page.locator('aside')).toBeVisible();
        await expect(page.locator('main')).toBeVisible();
      }
    });

    test('should display correctly on laptop viewport', async ({ page }) => {
      await page.setViewportSize({ width: 1366, height: 768 });
      await page.goto('/invoices');
      await page.waitForLoadState('networkidle');

      if (!page.url().includes('/login')) {
        await waitForPageLoad(page);

        await expect(page.locator('aside')).toBeVisible();
      }
    });

    test('should display correctly on smaller viewport', async ({ page }) => {
      await page.setViewportSize({ width: 1024, height: 768 });
      await page.goto('/invoices');
      await page.waitForLoadState('networkidle');

      if (!page.url().includes('/login')) {
        // Main content should still be visible
        await expect(page.locator('main')).toBeVisible();
      }
    });
  });

  test.describe('URL Handling', () => {
    test('should handle root URL', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Should either show dashboard or redirect to login
      const hasContent = await page.locator('aside, [class*="login"]').count() > 0;
      expect(hasContent).toBeTruthy();
    });
  });
});

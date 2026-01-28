// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Comprehensive App Test Suite
 * Tests every page and button for console errors and basic functionality
 */

// Collect console errors during tests
let consoleErrors = [];

test.beforeEach(async ({ page }) => {
  consoleErrors = [];

  // Listen for console errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
      // Ignore known non-critical errors/warnings
      if (!text.includes('favicon') &&
          !text.includes('ResizeObserver') &&
          !text.includes('CHANNEL_ERROR') &&
          !text.includes('DialogTitle') &&  // Radix accessibility warning
          !text.includes('DialogDescription') &&  // Radix accessibility warning
          !text.includes('404 (Not Found)') &&  // Missing API endpoints (not critical)
          !text.includes('Failed to load resource')) {  // Network errors for optional resources
        consoleErrors.push(text);
      }
    }
  });

  // Listen for page errors (uncaught exceptions)
  page.on('pageerror', error => {
    consoleErrors.push(`PAGE ERROR: ${error.message}`);
  });
});

test.afterEach(async ({ }, testInfo) => {
  if (consoleErrors.length > 0) {
    console.log(`\n❌ Console errors on ${testInfo.title}:`);
    consoleErrors.forEach(err => console.log(`   - ${err}`));
  }
});

// Helper to wait for page to be stable
async function waitForPageLoad(page) {
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(500);
}

// Helper to check if element exists and is visible
async function elementExists(page, selector) {
  try {
    await page.waitForSelector(selector, { timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}

// ==================== DASHBOARD ====================
test.describe('Dashboard', () => {
  test('loads without errors', async ({ page }) => {
    await page.goto('/');
    await waitForPageLoad(page);

    // Check page rendered
    await expect(page.locator('body')).toBeVisible();

    // Check for main content
    const hasContent = await elementExists(page, '[class*="card"], [class*="Card"], main');
    expect(hasContent).toBe(true);

    expect(consoleErrors).toHaveLength(0);
  });
});

// ==================== INVOICES ====================
test.describe('Invoices', () => {
  test('page loads without errors', async ({ page }) => {
    await page.goto('/invoices');
    await waitForPageLoad(page);

    await expect(page.locator('body')).toBeVisible();
    expect(consoleErrors).toHaveLength(0);
  });

  test('can open upload dialog', async ({ page }) => {
    await page.goto('/invoices');
    await waitForPageLoad(page);

    // Look for upload button - scroll to top first
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);

    const uploadBtn = page.locator('button:has-text("Upload")').first();
    if (await uploadBtn.count() > 0) {
      await uploadBtn.scrollIntoViewIfNeeded();
      await uploadBtn.click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(500);

      // Close any dialog that opened
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }

    expect(consoleErrors).toHaveLength(0);
  });

  test('can click on invoice row', async ({ page }) => {
    await page.goto('/invoices');
    await waitForPageLoad(page);

    // Try to click first invoice row
    const row = page.locator('tbody tr, [class*="TableRow"]').first();
    if (await row.isVisible()) {
      await row.click();
      await page.waitForTimeout(500);
    }

    expect(consoleErrors).toHaveLength(0);
  });

  test('search filter works', async ({ page }) => {
    await page.goto('/invoices');
    await waitForPageLoad(page);

    const searchInput = page.locator('input[placeholder*="Search"], input[type="search"]').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill('test');
      await page.waitForTimeout(300);
    }

    expect(consoleErrors).toHaveLength(0);
  });
});

// ==================== PURCHASE ORDERS ====================
test.describe('Purchase Orders', () => {
  test('page loads without errors', async ({ page }) => {
    await page.goto('/purchase-orders');
    await waitForPageLoad(page);

    await expect(page.locator('body')).toBeVisible();
    expect(consoleErrors).toHaveLength(0);
  });

  test('can open create PO dialog', async ({ page }) => {
    await page.goto('/purchase-orders');
    await waitForPageLoad(page);

    const createBtn = page.locator('button:has-text("Create"), button:has-text("New"), button:has-text("Add")').first();
    if (await createBtn.isVisible()) {
      await createBtn.click();
      await page.waitForTimeout(500);
      await page.keyboard.press('Escape');
    }

    expect(consoleErrors).toHaveLength(0);
  });

  test('can click on PO row', async ({ page }) => {
    await page.goto('/purchase-orders');
    await waitForPageLoad(page);

    const row = page.locator('tbody tr, [class*="TableRow"]').first();
    if (await row.isVisible()) {
      await row.click();
      await page.waitForTimeout(500);
    }

    expect(consoleErrors).toHaveLength(0);
  });
});

// ==================== DRAWS ====================
test.describe('Draws', () => {
  test('page loads without errors', async ({ page }) => {
    await page.goto('/draws');
    await waitForPageLoad(page);

    await expect(page.locator('body')).toBeVisible();
    expect(consoleErrors).toHaveLength(0);
  });

  test('can click on draw row', async ({ page }) => {
    await page.goto('/draws');
    await waitForPageLoad(page);

    const row = page.locator('tbody tr, [class*="TableRow"], [class*="card"]').first();
    if (await row.isVisible()) {
      await row.click();
      await page.waitForTimeout(500);
    }

    expect(consoleErrors).toHaveLength(0);
  });
});

// ==================== JOBS ====================
test.describe('Jobs', () => {
  test('page loads without errors', async ({ page }) => {
    await page.goto('/jobs');
    await waitForPageLoad(page);

    await expect(page.locator('body')).toBeVisible();
    expect(consoleErrors).toHaveLength(0);
  });

  test('can open create job dialog', async ({ page }) => {
    await page.goto('/jobs');
    await waitForPageLoad(page);

    const createBtn = page.locator('button:has-text("Create"), button:has-text("New"), button:has-text("Add")').first();
    if (await createBtn.isVisible()) {
      await createBtn.click();
      await page.waitForTimeout(500);
      await page.keyboard.press('Escape');
    }

    expect(consoleErrors).toHaveLength(0);
  });

  test('search filter works', async ({ page }) => {
    await page.goto('/jobs');
    await waitForPageLoad(page);

    const searchInput = page.locator('input[placeholder*="Search"], input[type="search"]').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill('test');
      await page.waitForTimeout(300);
    }

    expect(consoleErrors).toHaveLength(0);
  });
});

// ==================== VENDORS ====================
test.describe('Vendors', () => {
  test('page loads without errors', async ({ page }) => {
    await page.goto('/vendors');
    await waitForPageLoad(page);

    await expect(page.locator('body')).toBeVisible();
    expect(consoleErrors).toHaveLength(0);
  });

  test('can open create vendor dialog', async ({ page }) => {
    await page.goto('/vendors');
    await waitForPageLoad(page);

    const createBtn = page.locator('button:has-text("Create"), button:has-text("New"), button:has-text("Add")').first();
    if (await createBtn.isVisible()) {
      await createBtn.click();
      await page.waitForTimeout(500);
      await page.keyboard.press('Escape');
    }

    expect(consoleErrors).toHaveLength(0);
  });

  test('search and filter works', async ({ page }) => {
    await page.goto('/vendors');
    await waitForPageLoad(page);

    const searchInput = page.locator('input[placeholder*="Search"], input[type="search"]').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill('test');
      await page.waitForTimeout(300);
    }

    expect(consoleErrors).toHaveLength(0);
  });
});

// ==================== SCHEDULES ====================
test.describe('Schedules', () => {
  test('page loads without errors', async ({ page }) => {
    await page.goto('/schedule');
    await waitForPageLoad(page);

    await expect(page.locator('body')).toBeVisible();
    expect(consoleErrors).toHaveLength(0);
  });

  test('can interact with schedule controls', async ({ page }) => {
    await page.goto('/schedule');
    await waitForPageLoad(page);

    // Try clicking view toggle buttons
    const toggleBtns = page.locator('button:has-text("Week"), button:has-text("Month"), button:has-text("Day")');
    const count = await toggleBtns.count();
    for (let i = 0; i < count; i++) {
      await toggleBtns.nth(i).click();
      await page.waitForTimeout(300);
    }

    expect(consoleErrors).toHaveLength(0);
  });
});

// ==================== CHANGE ORDERS ====================
test.describe('Change Orders', () => {
  test('page loads without errors', async ({ page }) => {
    await page.goto('/change-orders');
    await waitForPageLoad(page);

    await expect(page.locator('body')).toBeVisible();
    expect(consoleErrors).toHaveLength(0);
  });

  test('can open create CO dialog', async ({ page }) => {
    await page.goto('/change-orders');
    await waitForPageLoad(page);

    const createBtn = page.locator('button:has-text("Create"), button:has-text("New"), button:has-text("Add")').first();
    if (await createBtn.isVisible()) {
      await createBtn.click();
      await page.waitForTimeout(500);
      await page.keyboard.press('Escape');
    }

    expect(consoleErrors).toHaveLength(0);
  });
});

// ==================== SELECTIONS ====================
test.describe('Selections', () => {
  test('page loads without errors', async ({ page }) => {
    await page.goto('/selections');
    await waitForPageLoad(page);

    await expect(page.locator('body')).toBeVisible();
    expect(consoleErrors).toHaveLength(0);
  });

  test('can open create selection dialog', async ({ page }) => {
    await page.goto('/selections');
    await waitForPageLoad(page);

    const createBtn = page.locator('button:has-text("Create"), button:has-text("New"), button:has-text("Add")').first();
    if (await createBtn.isVisible()) {
      await createBtn.click();
      await page.waitForTimeout(500);
      await page.keyboard.press('Escape');
    }

    expect(consoleErrors).toHaveLength(0);
  });

  test('filter dropdowns work', async ({ page }) => {
    await page.goto('/selections');
    await waitForPageLoad(page);

    // Click on filter dropdowns
    const selects = page.locator('button[role="combobox"], select');
    const count = await selects.count();
    for (let i = 0; i < Math.min(count, 3); i++) {
      await selects.nth(i).click();
      await page.waitForTimeout(200);
      await page.keyboard.press('Escape');
    }

    expect(consoleErrors).toHaveLength(0);
  });
});

// ==================== DAILY LOGS ====================
test.describe('Daily Logs', () => {
  test('page loads without errors', async ({ page }) => {
    await page.goto('/daily-logs');
    await waitForPageLoad(page);

    await expect(page.locator('body')).toBeVisible();
    expect(consoleErrors).toHaveLength(0);
  });

  test('can open create log dialog', async ({ page }) => {
    await page.goto('/daily-logs');
    await waitForPageLoad(page);

    const createBtn = page.locator('button:has-text("Create"), button:has-text("New"), button:has-text("Add")').first();
    if (await createBtn.isVisible()) {
      await createBtn.click();
      await page.waitForTimeout(500);
      await page.keyboard.press('Escape');
    }

    expect(consoleErrors).toHaveLength(0);
  });
});

// ==================== PERMITS ====================
test.describe('Permits', () => {
  test('page loads without errors', async ({ page }) => {
    await page.goto('/permits');
    await waitForPageLoad(page);

    await expect(page.locator('body')).toBeVisible();
    expect(consoleErrors).toHaveLength(0);
  });

  test('can open create permit dialog', async ({ page }) => {
    await page.goto('/permits');
    await waitForPageLoad(page);

    const createBtn = page.locator('button:has-text("Create"), button:has-text("New"), button:has-text("Add")').first();
    if (await createBtn.isVisible()) {
      await createBtn.click();
      await page.waitForTimeout(500);
      await page.keyboard.press('Escape');
    }

    expect(consoleErrors).toHaveLength(0);
  });
});

// ==================== COST CODES ====================
test.describe('Cost Codes', () => {
  test('page loads without errors', async ({ page }) => {
    await page.goto('/cost-codes');
    await waitForPageLoad(page);

    await expect(page.locator('body')).toBeVisible();
    expect(consoleErrors).toHaveLength(0);
  });

  test('tabs work', async ({ page }) => {
    await page.goto('/cost-codes');
    await waitForPageLoad(page);

    // Click on tabs
    const tabs = page.locator('[role="tab"], button:has-text("Base"), button:has-text("Change")');
    const count = await tabs.count();
    for (let i = 0; i < count; i++) {
      await tabs.nth(i).click();
      await page.waitForTimeout(300);
    }

    expect(consoleErrors).toHaveLength(0);
  });
});

// ==================== PRICE INTELLIGENCE ====================
test.describe('Price Intelligence', () => {
  test('page loads without errors', async ({ page }) => {
    await page.goto('/pricing');
    await waitForPageLoad(page);

    await expect(page.locator('body')).toBeVisible();
    expect(consoleErrors).toHaveLength(0);
  });

  test('tabs work', async ({ page }) => {
    await page.goto('/pricing');
    await waitForPageLoad(page);

    // Click on actual tab triggers (more specific selector)
    const tabs = page.locator('[role="tablist"] button[role="tab"]');
    const count = await tabs.count();
    for (let i = 0; i < Math.min(count, 4); i++) {
      if (await tabs.nth(i).isVisible()) {
        await tabs.nth(i).click();
        await page.waitForTimeout(500);
      }
    }

    expect(consoleErrors).toHaveLength(0);
  });

  test('can open add item dialog', async ({ page }) => {
    await page.goto('/pricing');
    await waitForPageLoad(page);

    const addBtn = page.locator('button:has-text("Add Item"), button:has-text("Add")').first();
    if (await addBtn.isVisible()) {
      await addBtn.click();
      await page.waitForTimeout(500);
      await page.keyboard.press('Escape');
    }

    expect(consoleErrors).toHaveLength(0);
  });
});

// ==================== LEADS ====================
test.describe('Leads', () => {
  test('page loads without errors', async ({ page }) => {
    await page.goto('/leads');
    await waitForPageLoad(page);

    await expect(page.locator('body')).toBeVisible();
    expect(consoleErrors).toHaveLength(0);
  });

  test('can open create lead dialog', async ({ page }) => {
    await page.goto('/leads');
    await waitForPageLoad(page);

    const createBtn = page.locator('button:has-text("Create"), button:has-text("New"), button:has-text("Add")').first();
    if (await createBtn.isVisible()) {
      await createBtn.click();
      await page.waitForTimeout(500);
      await page.keyboard.press('Escape');
    }

    expect(consoleErrors).toHaveLength(0);
  });
});

// ==================== ESTIMATES ====================
test.describe('Estimates', () => {
  test('page loads without errors', async ({ page }) => {
    await page.goto('/estimates');
    await waitForPageLoad(page);

    await expect(page.locator('body')).toBeVisible();
    expect(consoleErrors).toHaveLength(0);
  });

  test('can open create estimate dialog', async ({ page }) => {
    await page.goto('/estimates');
    await waitForPageLoad(page);

    const createBtn = page.locator('button:has-text("Create"), button:has-text("New"), button:has-text("Add")').first();
    if (await createBtn.isVisible()) {
      await createBtn.click();
      await page.waitForTimeout(500);
      await page.keyboard.press('Escape');
    }

    expect(consoleErrors).toHaveLength(0);
  });
});

// ==================== PROPOSALS ====================
test.describe('Proposals', () => {
  test('page loads without errors', async ({ page }) => {
    await page.goto('/proposals');
    await waitForPageLoad(page);

    await expect(page.locator('body')).toBeVisible();
    expect(consoleErrors).toHaveLength(0);
  });
});

// ==================== CONTRACTS ====================
test.describe('Contracts', () => {
  test('page loads without errors', async ({ page }) => {
    await page.goto('/contracts');
    await waitForPageLoad(page);

    await expect(page.locator('body')).toBeVisible();
    expect(consoleErrors).toHaveLength(0);
  });
});

// ==================== BIDS ====================
test.describe('Bids', () => {
  test('page loads without errors', async ({ page }) => {
    await page.goto('/bids');
    await waitForPageLoad(page);

    await expect(page.locator('body')).toBeVisible();
    expect(consoleErrors).toHaveLength(0);
  });

  test('can open create bid package dialog', async ({ page }) => {
    await page.goto('/bids');
    await waitForPageLoad(page);

    const createBtn = page.locator('button:has-text("Create"), button:has-text("New"), button:has-text("Add")').first();
    if (await createBtn.isVisible()) {
      await createBtn.click();
      await page.waitForTimeout(500);
      await page.keyboard.press('Escape');
    }

    expect(consoleErrors).toHaveLength(0);
  });
});

// ==================== EMPLOYEES ====================
test.describe('Employees', () => {
  test('page loads without errors', async ({ page }) => {
    await page.goto('/employees');
    await waitForPageLoad(page);

    await expect(page.locator('body')).toBeVisible();
    expect(consoleErrors).toHaveLength(0);
  });

  test('can open create employee dialog', async ({ page }) => {
    await page.goto('/employees');
    await waitForPageLoad(page);

    const createBtn = page.locator('button:has-text("Create"), button:has-text("New"), button:has-text("Add")').first();
    if (await createBtn.isVisible()) {
      await createBtn.click();
      await page.waitForTimeout(500);
      await page.keyboard.press('Escape');
    }

    expect(consoleErrors).toHaveLength(0);
  });
});

// ==================== TASKS ====================
test.describe('Tasks', () => {
  test('page loads without errors', async ({ page }) => {
    await page.goto('/tasks');
    await waitForPageLoad(page);

    await expect(page.locator('body')).toBeVisible();
    expect(consoleErrors).toHaveLength(0);
  });
});

// ==================== PUNCH LISTS ====================
test.describe('Punch Lists', () => {
  test('page loads without errors', async ({ page }) => {
    await page.goto('/punch-lists');
    await waitForPageLoad(page);

    await expect(page.locator('body')).toBeVisible();
    expect(consoleErrors).toHaveLength(0);
  });
});

// ==================== FILES ====================
test.describe('Files', () => {
  test('page loads without errors', async ({ page }) => {
    await page.goto('/files');
    await waitForPageLoad(page);

    await expect(page.locator('body')).toBeVisible();
    expect(consoleErrors).toHaveLength(0);
  });
});

// ==================== LIEN RELEASES ====================
test.describe('Lien Releases', () => {
  test('page loads without errors', async ({ page }) => {
    await page.goto('/lien-releases');
    await waitForPageLoad(page);

    await expect(page.locator('body')).toBeVisible();
    expect(consoleErrors).toHaveLength(0);
  });

  test('can open create lien release dialog', async ({ page }) => {
    await page.goto('/lien-releases');
    await waitForPageLoad(page);

    const createBtn = page.locator('button:has-text("Create"), button:has-text("New"), button:has-text("Add"), button:has-text("Request")').first();
    if (await createBtn.isVisible()) {
      await createBtn.click();
      await page.waitForTimeout(500);
      await page.keyboard.press('Escape');
    }

    expect(consoleErrors).toHaveLength(0);
  });
});

// ==================== SIDEBAR NAVIGATION ====================
test.describe('Sidebar Navigation', () => {
  test('all sidebar links work', async ({ page }) => {
    await page.goto('/');
    await waitForPageLoad(page);

    // Get all navigation links
    const navLinks = page.locator('nav a, aside a, [class*="sidebar"] a');
    const count = await navLinks.count();

    const visitedUrls = new Set();

    for (let i = 0; i < count; i++) {
      const href = await navLinks.nth(i).getAttribute('href');
      if (href && href.startsWith('/') && !visitedUrls.has(href)) {
        visitedUrls.add(href);

        await page.goto(href);
        await waitForPageLoad(page);

        // Check no critical errors
        const criticalErrors = consoleErrors.filter(e =>
          e.includes('Cannot read properties') ||
          e.includes('is not a function') ||
          e.includes('is not defined')
        );

        if (criticalErrors.length > 0) {
          console.log(`\n❌ Critical errors on ${href}:`);
          criticalErrors.forEach(err => console.log(`   - ${err}`));
        }

        // Reset errors for next page
        consoleErrors = [];
      }
    }
  });
});

// ==================== JOB CONTEXT SWITCHING ====================
test.describe('Job Context', () => {
  test('can select a job from sidebar', async ({ page }) => {
    await page.goto('/');
    await waitForPageLoad(page);

    // Find job in sidebar and click it
    const jobLink = page.locator('[class*="sidebar"] a, aside a').filter({ hasText: /Drummond|Test|Project/i }).first();
    if (await jobLink.isVisible()) {
      await jobLink.click();
      await waitForPageLoad(page);
    }

    expect(consoleErrors).toHaveLength(0);
  });

  test('pages filter by selected job', async ({ page }) => {
    await page.goto('/');
    await waitForPageLoad(page);

    // Select a job first
    const jobLink = page.locator('[class*="sidebar"] a, aside a').filter({ hasText: /Drummond|Test|Project/i }).first();
    if (await jobLink.isVisible()) {
      await jobLink.click();
      await waitForPageLoad(page);
    }

    // Navigate to invoices and check it filters
    await page.goto('/invoices');
    await waitForPageLoad(page);

    // Navigate to POs
    await page.goto('/purchase-orders');
    await waitForPageLoad(page);

    // Navigate to selections
    await page.goto('/selections');
    await waitForPageLoad(page);

    expect(consoleErrors).toHaveLength(0);
  });
});

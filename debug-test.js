/**
 * Comprehensive Debug Testing System
 * Tests all pages, buttons, and functionality
 * Captures screenshots and console errors
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3001';
const SCREENSHOT_DIR = './debug-screenshots';
const REPORT_FILE = './debug-report.json';

// Test results storage
const results = {
  timestamp: new Date().toISOString(),
  pages: [],
  consoleErrors: [],
  networkErrors: [],
  issues: [],
  summary: {
    totalPages: 0,
    totalButtons: 0,
    totalErrors: 0,
    totalWarnings: 0,
    passedTests: 0,
    failedTests: 0
  }
};

// Pages to test
const PAGES = [
  { name: 'Dashboard', url: '/dashboard.html', waitFor: '.dashboard, .stat-card, h1' },
  { name: 'Invoices', url: '/index.html', waitFor: '.invoice-list, .sidebar, h1' },
  { name: 'Draws', url: '/draws.html', waitFor: '.draw-row, .sidebar, h1' },
  { name: 'PurchaseOrders', url: '/pos.html', waitFor: '.po-row, .sidebar, h1' },
  { name: 'ChangeOrders', url: '/change-orders.html', waitFor: '.co-row, .sidebar, h1' },
  { name: 'Budget', url: '/budgets.html', waitFor: '.budget, .sidebar, h1' },
  { name: 'DailyLogs', url: '/daily-logs.html', waitFor: '.log-entry, .sidebar, h1' },
  { name: 'LienReleases', url: '/lien-releases.html', waitFor: '.lien-row, .sidebar, h1' },
  { name: 'Inspections', url: '/inspections.html', waitFor: '.inspection, .sidebar, h1' },
  { name: 'Schedule', url: '/schedule.html', waitFor: '.schedule, .sidebar, h1' },
];

async function ensureScreenshotDir() {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }
}

async function screenshot(page, name) {
  const filename = `${SCREENSHOT_DIR}/${name}.png`;
  await page.screenshot({ path: filename, fullPage: false });
  return filename;
}

async function closeAnyOpenModal(page) {
  // Try multiple methods to close any open modal
  for (let attempt = 0; attempt < 3; attempt++) {
    // Check if any modal is visible
    const modal = await page.locator('.modal[style*="flex"], .modal[style*="block"], .modal.show').first();
    const isVisible = await modal.isVisible().catch(() => false);

    if (!isVisible) break; // No modal open, done

    // Try clicking close button (various selectors)
    const closeSelectors = [
      '.modal.show .close-btn',
      '.modal.show button.close-btn',
      '.modal.show [class*="close"]',
      '.modal[style*="flex"] .close-btn',
      '.modal[style*="flex"] button:has-text("Cancel")',
      '.modal[style*="flex"] button:has-text("Close")'
    ];

    let closed = false;
    for (const selector of closeSelectors) {
      try {
        const btn = await page.locator(selector).first();
        if (await btn.isVisible().catch(() => false)) {
          await btn.click({ timeout: 1000 });
          await page.waitForTimeout(300);
          closed = true;
          break;
        }
      } catch { /* try next */ }
    }

    if (!closed) {
      // Fallback: press Escape
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }
  }

  await page.waitForTimeout(500); // Final settle time
}

async function testPage(browser, pageConfig) {
  const pageResult = {
    name: pageConfig.name,
    url: pageConfig.url,
    status: 'pending',
    loadTime: 0,
    consoleErrors: [],
    consoleWarnings: [],
    networkErrors: [],
    buttons: [],
    modals: [],
    issues: [],
    screenshots: []
  };

  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 }
  });
  const page = await context.newPage();

  // Capture console messages
  page.on('console', msg => {
    if (msg.type() === 'error') {
      pageResult.consoleErrors.push({
        text: msg.text(),
        location: msg.location()
      });
      results.consoleErrors.push({
        page: pageConfig.name,
        text: msg.text(),
        location: msg.location()
      });
    } else if (msg.type() === 'warning') {
      pageResult.consoleWarnings.push(msg.text());
    }
  });

  // Capture page errors
  page.on('pageerror', error => {
    pageResult.consoleErrors.push({
      text: error.message,
      stack: error.stack
    });
    results.consoleErrors.push({
      page: pageConfig.name,
      text: error.message,
      stack: error.stack
    });
  });

  // Capture failed requests
  page.on('requestfailed', request => {
    pageResult.networkErrors.push({
      url: request.url(),
      failure: request.failure()?.errorText
    });
    results.networkErrors.push({
      page: pageConfig.name,
      url: request.url(),
      failure: request.failure()?.errorText
    });
  });

  try {
    console.log(`\n========== Testing: ${pageConfig.name} ==========`);

    // Load page - use 'load' instead of 'networkidle' since SSE connections never idle
    const startTime = Date.now();
    await page.goto(`${BASE_URL}${pageConfig.url}`, { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(3000); // Wait for dynamic content and API calls
    pageResult.loadTime = Date.now() - startTime;

    // Initial screenshot
    const initialScreenshot = await screenshot(page, `${pageConfig.name}-01-initial`);
    pageResult.screenshots.push(initialScreenshot);
    console.log(`  [OK] Page loaded in ${pageResult.loadTime}ms`);

    // Find all clickable elements
    const buttons = await page.locator('button:visible, .btn:visible, [onclick]:visible').all();
    const links = await page.locator('a:visible').all();
    const selects = await page.locator('select:visible').all();
    const inputs = await page.locator('input:visible').all();

    console.log(`  Found: ${buttons.length} buttons, ${links.length} links, ${selects.length} selects, ${inputs.length} inputs`);

    // Test sidebar job selection if exists
    const sidebarJobs = await page.locator('.sidebar .job-item, .sidebar [data-job-id]').all();
    if (sidebarJobs.length > 0) {
      console.log(`  Testing sidebar: ${sidebarJobs.length} jobs found`);
      // Click first job
      try {
        await sidebarJobs[0].click();
        await page.waitForTimeout(1000);
        const sidebarScreenshot = await screenshot(page, `${pageConfig.name}-02-sidebar-click`);
        pageResult.screenshots.push(sidebarScreenshot);
        console.log(`  [OK] Sidebar job selection works`);
      } catch (e) {
        console.log(`  [WARN] Sidebar click failed: ${e.message}`);
      }
    }

    // Test each button
    let buttonIndex = 0;
    for (const button of buttons) {
      buttonIndex++;
      try {
        // Close any open modal first
        await closeAnyOpenModal(page);

        const buttonText = await button.textContent() || await button.getAttribute('title') || `Button ${buttonIndex}`;
        const buttonClass = await button.getAttribute('class') || '';

        // Skip certain buttons that might cause issues
        if (buttonText.includes('Delete') || buttonText.includes('Remove') ||
            buttonClass.includes('danger') || buttonClass.includes('delete')) {
          console.log(`  [SKIP] Skipping destructive button: ${buttonText.trim()}`);
          continue;
        }

        // Check if button is in viewport and clickable
        const isVisible = await button.isVisible();
        if (!isVisible) continue;

        console.log(`  Testing button: "${buttonText.trim().substring(0, 30)}..."`);

        // Click button
        await button.click({ timeout: 5000 });
        await page.waitForTimeout(1000);

        // Check if modal opened
        const modal = await page.locator('.modal[style*="flex"], .modal[style*="block"], .modal.show').first();
        const modalVisible = await modal.isVisible().catch(() => false);

        if (modalVisible) {
          const modalScreenshot = await screenshot(page, `${pageConfig.name}-modal-${buttonIndex}`);
          pageResult.screenshots.push(modalScreenshot);
          pageResult.modals.push({
            trigger: buttonText.trim(),
            screenshot: modalScreenshot
          });
          console.log(`    [OK] Modal opened`);

          // Close modal - try multiple methods
          await closeAnyOpenModal(page);
        }

        pageResult.buttons.push({
          text: buttonText.trim(),
          class: buttonClass,
          status: 'passed'
        });

      } catch (e) {
        pageResult.buttons.push({
          text: `Button ${buttonIndex}`,
          status: 'failed',
          error: e.message
        });
        console.log(`    [FAIL] Button error: ${e.message}`);
      }
    }

    // Test select dropdowns
    for (const select of selects) {
      try {
        const selectId = await select.getAttribute('id') || 'unknown';
        const options = await select.locator('option').all();
        if (options.length > 1) {
          // Select second option
          await select.selectOption({ index: 1 });
          await page.waitForTimeout(500);
          console.log(`  [OK] Select "${selectId}" changed`);
        }
      } catch (e) {
        console.log(`  [WARN] Select test failed: ${e.message}`);
      }
    }

    // Test clicking on list items (invoices, draws, POs, etc.)
    const listItems = await page.locator('.invoice-row, .draw-row, .po-row, .co-row, tr[data-id], [data-invoice-id]').all();
    if (listItems.length > 0) {
      console.log(`  Testing list items: ${listItems.length} found`);
      try {
        await listItems[0].click();
        await page.waitForTimeout(1500);

        // Check if modal/detail view opened
        const detailModal = await page.locator('.modal[style*="flex"], .modal[style*="block"]').first();
        if (await detailModal.isVisible().catch(() => false)) {
          const detailScreenshot = await screenshot(page, `${pageConfig.name}-detail-view`);
          pageResult.screenshots.push(detailScreenshot);
          console.log(`  [OK] Detail view opened`);

          // Close it
          await closeAnyOpenModal(page);
        }
      } catch (e) {
        console.log(`  [WARN] List item click failed: ${e.message}`);
      }
    }

    // Final screenshot
    const finalScreenshot = await screenshot(page, `${pageConfig.name}-final`);
    pageResult.screenshots.push(finalScreenshot);

    // Determine status
    if (pageResult.consoleErrors.length > 0) {
      pageResult.status = 'warnings';
      results.summary.totalWarnings += pageResult.consoleErrors.length;
    } else {
      pageResult.status = 'passed';
      results.summary.passedTests++;
    }

    console.log(`  Console errors: ${pageResult.consoleErrors.length}`);
    console.log(`  Network errors: ${pageResult.networkErrors.length}`);

  } catch (e) {
    pageResult.status = 'failed';
    pageResult.issues.push({
      type: 'page_error',
      message: e.message
    });
    results.summary.failedTests++;
    console.log(`  [FAIL] Page error: ${e.message}`);
  }

  await context.close();
  results.pages.push(pageResult);
  results.summary.totalPages++;
  results.summary.totalButtons += pageResult.buttons.length;
  results.summary.totalErrors += pageResult.consoleErrors.length;

  return pageResult;
}

async function analyzeIssues() {
  console.log('\n========== Analyzing Issues ==========');

  // Check for common issues
  for (const page of results.pages) {
    // Check for slow load times
    if (page.loadTime > 5000) {
      results.issues.push({
        page: page.name,
        type: 'performance',
        severity: 'warning',
        message: `Slow page load: ${page.loadTime}ms`
      });
    }

    // Check for console errors
    for (const error of page.consoleErrors) {
      results.issues.push({
        page: page.name,
        type: 'console_error',
        severity: 'error',
        message: error.text
      });
    }

    // Check for network errors
    for (const error of page.networkErrors) {
      results.issues.push({
        page: page.name,
        type: 'network_error',
        severity: 'error',
        message: `Failed request: ${error.url} - ${error.failure}`
      });
    }
  }

  // Print summary
  console.log(`\nTotal Issues Found: ${results.issues.length}`);
  results.issues.forEach((issue, i) => {
    console.log(`  ${i + 1}. [${issue.severity.toUpperCase()}] ${issue.page}: ${issue.message}`);
  });
}

async function generateReport() {
  // Save JSON report
  fs.writeFileSync(REPORT_FILE, JSON.stringify(results, null, 2));
  console.log(`\nReport saved to: ${REPORT_FILE}`);

  // Print summary
  console.log('\n========== TEST SUMMARY ==========');
  console.log(`Total Pages Tested: ${results.summary.totalPages}`);
  console.log(`Total Buttons Tested: ${results.summary.totalButtons}`);
  console.log(`Passed: ${results.summary.passedTests}`);
  console.log(`Failed: ${results.summary.failedTests}`);
  console.log(`Total Errors: ${results.summary.totalErrors}`);
  console.log(`Total Warnings: ${results.summary.totalWarnings}`);
  console.log(`Screenshots: ${SCREENSHOT_DIR}/`);
}

async function main() {
  console.log('Starting Comprehensive Debug Testing...\n');

  await ensureScreenshotDir();

  const browser = await chromium.launch({ headless: true });

  try {
    for (const pageConfig of PAGES) {
      await testPage(browser, pageConfig);
    }

    await analyzeIssues();
    await generateReport();

  } finally {
    await browser.close();
  }

  // Return exit code based on results
  if (results.summary.failedTests > 0 || results.issues.filter(i => i.severity === 'error').length > 0) {
    console.log('\n[FAIL] Tests completed with errors');
    process.exit(1);
  } else {
    console.log('\n[PASS] All tests completed successfully');
    process.exit(0);
  }
}

main().catch(e => {
  console.error('Test runner failed:', e);
  process.exit(1);
});

/**
 * Full Application Audit Test
 * Clicks through every page, button, and modal to find issues
 * Generates a report of errors, warnings, and improvement suggestions
 */

const { test, expect } = require('@playwright/test');

// Audit results collector
const auditResults = {
  errors: [],
  warnings: [],
  improvements: [],
  passedChecks: [],
  pageStats: {}
};

function logError(page, category, message, details = {}) {
  auditResults.errors.push({ page, category, message, details, timestamp: new Date().toISOString() });
  console.log(`❌ ERROR [${page}] ${category}: ${message}`);
}

function logWarning(page, category, message, details = {}) {
  auditResults.warnings.push({ page, category, message, details, timestamp: new Date().toISOString() });
  console.log(`⚠️ WARNING [${page}] ${category}: ${message}`);
}

function logImprovement(page, category, message, details = {}) {
  auditResults.improvements.push({ page, category, message, details, timestamp: new Date().toISOString() });
  console.log(`💡 IMPROVEMENT [${page}] ${category}: ${message}`);
}

function logPass(page, check) {
  auditResults.passedChecks.push({ page, check, timestamp: new Date().toISOString() });
  console.log(`✅ PASS [${page}] ${check}`);
}

test.describe('Full Application Audit', () => {
  let consoleErrors = [];
  let networkErrors = [];
  let jsErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    networkErrors = [];
    jsErrors = [];

    // Capture console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (!text.includes('favicon') && !text.includes('Realtime')) {
          consoleErrors.push(text);
        }
      }
    });

    // Capture JS errors
    page.on('pageerror', err => {
      jsErrors.push(err.message);
    });

    // Capture network errors
    page.on('response', resp => {
      if (resp.status() >= 400 && !resp.url().includes('favicon')) {
        networkErrors.push({ url: resp.url(), status: resp.status() });
      }
    });
  });

  // ============================================================
  // INVOICE DASHBOARD AUDIT
  // ============================================================
  test('1. Invoice Dashboard Audit', async ({ page }) => {
    console.log('\n' + '='.repeat(60));
    console.log('AUDITING: Invoice Dashboard (index.html)');
    console.log('='.repeat(60));

    await page.goto('http://localhost:3001/index.html');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    const pageName = 'Invoices';
    auditResults.pageStats[pageName] = {};

    // Check 1: Page loads without JS errors
    if (jsErrors.length > 0) {
      logError(pageName, 'JavaScript', `${jsErrors.length} JS errors on load`, { errors: jsErrors });
    } else {
      logPass(pageName, 'No JavaScript errors on page load');
    }

    // Check 2: Header elements
    const headerBrand = await page.locator('.header-brand').count();
    if (headerBrand === 0) {
      logError(pageName, 'UI', 'Missing header brand/logo');
    } else {
      logPass(pageName, 'Header brand present');
    }

    // Check 3: Upload button
    const uploadBtn = await page.locator('#uploadBtn').count();
    if (uploadBtn === 0) {
      logError(pageName, 'UI', 'Missing upload button');
    } else {
      logPass(pageName, 'Upload button present');
    }

    // Check 4: Job sidebar
    const sidebar = await page.locator('#jobSidebar, .job-sidebar').count();
    if (sidebar === 0) {
      logWarning(pageName, 'UI', 'Job sidebar not found');
    } else {
      logPass(pageName, 'Job sidebar present');

      // Check job items
      const jobItems = await page.locator('.job-item[data-job-id]').count();
      auditResults.pageStats[pageName].jobCount = jobItems;
      if (jobItems === 0) {
        logWarning(pageName, 'Data', 'No jobs in sidebar');
      } else {
        logPass(pageName, `${jobItems} jobs in sidebar`);
      }
    }

    // Check 5: Invoice list
    const invoiceList = await page.locator('#invoiceList').count();
    if (invoiceList === 0) {
      logError(pageName, 'UI', 'Invoice list container missing');
    } else {
      const invoiceCards = await page.locator('.invoice-card').count();
      auditResults.pageStats[pageName].invoiceCount = invoiceCards;
      logPass(pageName, `Invoice list present with ${invoiceCards} invoices`);

      if (invoiceCards === 0) {
        logWarning(pageName, 'Data', 'No invoices to display');
      }
    }

    // Check 6: Navigation links
    const mainNavLinks = await page.locator('.main-nav-link').count();
    const subNavLinks = await page.locator('.sub-nav-link').count();
    if (mainNavLinks < 3) {
      logWarning(pageName, 'Navigation', `Only ${mainNavLinks} main nav links (expected 4+)`);
    } else {
      logPass(pageName, `Navigation: ${mainNavLinks} main links, ${subNavLinks} sub links`);
    }

    // Check 7: Test upload modal
    if (uploadBtn > 0) {
      await page.locator('#uploadBtn').click();
      await page.waitForTimeout(1000);

      const uploadModal = await page.locator('#universalUploadModal').isVisible();
      if (!uploadModal) {
        logError(pageName, 'Modal', 'Upload modal did not open');
      } else {
        logPass(pageName, 'Upload modal opens correctly');

        // Check file input
        const fileInput = await page.locator('#universalUploadModal input[type="file"], #pdfFileInput').count();
        if (fileInput === 0) {
          logError(pageName, 'Modal', 'Upload modal missing file input');
        }

        // Close modal
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
      }
    }

    // Check 8: Test invoice modal (if invoices exist)
    const invoiceCards = await page.locator('.invoice-card').count();
    if (invoiceCards > 0) {
      await page.locator('.invoice-card').first().click();
      await page.waitForTimeout(2000);

      const modalActive = await page.locator('#modal-container.active').count();
      if (modalActive === 0) {
        logError(pageName, 'Modal', 'Invoice detail modal did not open');
      } else {
        logPass(pageName, 'Invoice detail modal opens');

        // Check modal elements
        const modalTitle = await page.locator('#invoiceModalTitle, .modal-header h2').count();
        if (modalTitle === 0) {
          logWarning(pageName, 'Modal', 'Invoice modal missing title');
        }

        // Check for key fields
        const vendorField = await page.locator('#edit-vendor').count();
        const jobField = await page.locator('#edit-job').count();
        const amountField = await page.locator('#edit-amount').count();

        if (vendorField === 0) logWarning(pageName, 'Modal', 'Missing vendor field');
        if (jobField === 0) logWarning(pageName, 'Modal', 'Missing job field');
        if (amountField === 0) logWarning(pageName, 'Modal', 'Missing amount field');

        // Check action buttons
        const saveBtn = await page.locator('button:has-text("Save")').count();
        const closeBtn = await page.locator('.modal-close').count();

        if (saveBtn === 0) logWarning(pageName, 'Modal', 'Missing save button');
        if (closeBtn === 0) logWarning(pageName, 'Modal', 'Missing close button');

        // Close modal
        if (closeBtn > 0) {
          await page.locator('.modal-close').first().click({ force: true });
          await page.waitForTimeout(500);
        }
      }
    }

    // Check 9: Console errors after interactions
    if (consoleErrors.length > 0) {
      logWarning(pageName, 'Console', `${consoleErrors.length} console errors`, { errors: consoleErrors });
    }

    // Check 10: Network errors
    if (networkErrors.length > 0) {
      logError(pageName, 'Network', `${networkErrors.length} failed requests`, { errors: networkErrors });
    }

    await page.screenshot({ path: 'tests/screenshots/audit-invoices.png', fullPage: true });
  });

  // ============================================================
  // PURCHASE ORDERS PAGE AUDIT
  // ============================================================
  test('2. Purchase Orders Page Audit', async ({ page }) => {
    console.log('\n' + '='.repeat(60));
    console.log('AUDITING: Purchase Orders (pos.html)');
    console.log('='.repeat(60));

    await page.goto('http://localhost:3001/pos.html');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    const pageName = 'PurchaseOrders';
    auditResults.pageStats[pageName] = {};

    // Check JS errors
    if (jsErrors.length > 0) {
      logError(pageName, 'JavaScript', `${jsErrors.length} JS errors`, { errors: jsErrors });
    } else {
      logPass(pageName, 'No JavaScript errors');
    }

    // Check PO list
    const poRows = await page.locator('.po-row').count();
    auditResults.pageStats[pageName].poCount = poRows;
    logPass(pageName, `${poRows} purchase orders displayed`);

    // Check Create PO button (actual text is "+ New PO")
    const createBtn = await page.locator('button:has-text("New PO"), button:has-text("Create PO"), #createPOBtn').count();
    if (createBtn === 0) {
      logWarning(pageName, 'UI', 'Missing Create PO button');
    } else {
      logPass(pageName, 'Create PO button present');

      // Test create modal
      await page.locator('button:has-text("New PO"), button:has-text("Create PO"), #createPOBtn').first().click();
      await page.waitForTimeout(1000);

      const createModal = await page.locator('#poModal, .po-modal').isVisible();
      if (!createModal) {
        logError(pageName, 'Modal', 'Create PO modal did not open');
      } else {
        logPass(pageName, 'Create PO modal opens');

        // Check required fields (uses searchable picker containers)
        const jobPicker = await page.locator('#po-job-picker-container').count();
        const vendorPicker = await page.locator('#po-vendor-picker-container').count();

        if (jobPicker === 0) logWarning(pageName, 'Modal', 'Missing job picker in PO form');
        else logPass(pageName, 'Job picker present in PO form');

        if (vendorPicker === 0) logWarning(pageName, 'Modal', 'Missing vendor picker in PO form');
        else logPass(pageName, 'Vendor picker present in PO form');

        // Close modal - use close button for reliability
        const closeBtn = page.locator('#poModal .close-btn, #poModal button:has-text("Cancel")');
        if (await closeBtn.count() > 0) {
          await closeBtn.first().click();
        } else {
          await page.keyboard.press('Escape');
        }
        await page.waitForTimeout(1000);

        // Verify modal closed
        const modalStillOpen = await page.locator('#poModal.show').count();
        if (modalStillOpen > 0) {
          logWarning(pageName, 'Modal', 'Create PO modal did not close properly');
          // Force close by clicking outside
          await page.locator('body').click({ position: { x: 10, y: 10 } });
          await page.waitForTimeout(500);
        }
      }
    }

    // Test PO detail modal (if POs exist)
    if (poRows > 0) {
      await page.locator('.po-row').first().click();
      await page.waitForTimeout(2000);

      const poModal = await page.locator('.modal-fullscreen-dark:visible, #poDetailModal:visible').count();
      if (poModal === 0) {
        logError(pageName, 'Modal', 'PO detail modal did not open');
      } else {
        logPass(pageName, 'PO detail modal opens');

        // Check sections (PO modal uses card-based layout, not tabs)
        const poCards = await page.locator('.po-card').count();
        const sectionHeaders = await page.locator('.po-card h4, .card-title-row h4').count();
        if (poCards < 2) {
          logWarning(pageName, 'Modal', `Only ${poCards} content cards in PO modal (expected 3+)`);
        } else {
          logPass(pageName, `PO modal has ${poCards} content cards with ${sectionHeaders} sections`);
        }

        // Check for key sections
        const lineItemsSection = await page.locator('h4:has-text("Line Items")').count();
        const invoicesSection = await page.locator('h4:has-text("Invoices"), h4:has-text("Linked Invoices")').count();
        if (lineItemsSection === 0) logWarning(pageName, 'Modal', 'Missing Line Items section');
        if (invoicesSection === 0) logWarning(pageName, 'Modal', 'Missing Invoices section');

        // Check action buttons
        const actionBtns = await page.locator('.modal-footer button, .modal-actions button').count();
        logPass(pageName, `PO modal has ${actionBtns} action buttons`);

        // Close modal
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
      }
    }

    if (networkErrors.length > 0) {
      logError(pageName, 'Network', `${networkErrors.length} failed requests`, { errors: networkErrors });
    }

    await page.screenshot({ path: 'tests/screenshots/audit-pos.png', fullPage: true });
  });

  // ============================================================
  // DRAWS PAGE AUDIT
  // ============================================================
  test('3. Draws Page Audit', async ({ page }) => {
    console.log('\n' + '='.repeat(60));
    console.log('AUDITING: Draws (draws.html)');
    console.log('='.repeat(60));

    await page.goto('http://localhost:3001/draws.html');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    const pageName = 'Draws';
    auditResults.pageStats[pageName] = {};

    if (jsErrors.length > 0) {
      logError(pageName, 'JavaScript', `${jsErrors.length} JS errors`, { errors: jsErrors });
    } else {
      logPass(pageName, 'No JavaScript errors');
    }

    // Check draw list
    const drawRows = await page.locator('.draw-row, .draw-card, tr[onclick]').count();
    auditResults.pageStats[pageName].drawCount = drawRows;
    logPass(pageName, `${drawRows} draws displayed`);

    // Check Auto-Generate button
    const autoGenBtn = await page.locator('button:has-text("Auto-Generate")').count();
    if (autoGenBtn === 0) {
      logWarning(pageName, 'UI', 'Missing Auto-Generate Draw button');
    } else {
      logPass(pageName, 'Auto-Generate Draw button present');
    }

    // Test draw detail modal (if draws exist)
    if (drawRows > 0) {
      await page.locator('.draw-row, .draw-card, tr[onclick]').first().click();
      await page.waitForTimeout(2000);

      const drawModal = await page.locator('.modal-fullscreen-dark:visible, .draw-modal:visible').count();
      if (drawModal === 0) {
        logError(pageName, 'Modal', 'Draw detail modal did not open');
      } else {
        logPass(pageName, 'Draw detail modal opens');

        // Check for G702/G703 sections (Draw modal uses section headers, not tabs)
        const g702Section = await page.locator('h3:has-text("G702"), .section-header:has-text("G702")').count();
        const g703Section = await page.locator('h3:has-text("G703"), .section-header:has-text("G703")').count();

        if (g702Section === 0) logWarning(pageName, 'Modal', 'Missing G702 section');
        else logPass(pageName, 'G702 section present');

        if (g703Section === 0) logWarning(pageName, 'Modal', 'Missing G703 section');
        else logPass(pageName, 'G703 section present');

        // Check G703 table
        const g703Table = await page.locator('#g703Body, .g703-table').count();
        if (g703Table > 0) logPass(pageName, 'G703 Schedule of Values table present');

        // Check export buttons
        const excelBtn = await page.locator('button:has-text("Excel")').count();
        const pdfBtn = await page.locator('button:has-text("PDF")').count();

        if (excelBtn === 0) logWarning(pageName, 'Modal', 'Missing Excel export button');
        if (pdfBtn === 0) logWarning(pageName, 'Modal', 'Missing PDF export button');

        // Close modal
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
      }
    }

    await page.screenshot({ path: 'tests/screenshots/audit-draws.png', fullPage: true });
  });

  // ============================================================
  // BUDGET PAGE AUDIT
  // ============================================================
  test('4. Budget Page Audit', async ({ page }) => {
    console.log('\n' + '='.repeat(60));
    console.log('AUDITING: Budget (budgets.html)');
    console.log('='.repeat(60));

    await page.goto('http://localhost:3001/budgets.html');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    const pageName = 'Budget';
    auditResults.pageStats[pageName] = {};

    if (jsErrors.length > 0) {
      logError(pageName, 'JavaScript', `${jsErrors.length} JS errors`, { errors: jsErrors });
    } else {
      logPass(pageName, 'No JavaScript errors');
    }

    // Check for empty state or budget content
    const emptyState = await page.locator('.empty-state').count();
    const budgetDetail = await page.locator('#budgetDetail').count();

    if (emptyState > 0) {
      logPass(pageName, 'Shows empty state when no job selected');
    }

    // Select a job from sidebar
    const jobItems = await page.locator('.job-item[data-job-id]:not(.all-jobs)').count();
    if (jobItems > 0) {
      await page.locator('.job-item[data-job-id]:not(.all-jobs)').first().click();
      await page.waitForTimeout(2000);

      const budgetVisible = await page.locator('#budgetDetail').isVisible();
      if (!budgetVisible) {
        logError(pageName, 'UI', 'Budget detail did not load after job selection');
      } else {
        logPass(pageName, 'Budget loads when job selected');

        // Check budget sections
        const costCodeRows = await page.locator('.budget-row, .cost-code-row, tr[data-cost-code]').count();
        auditResults.pageStats[pageName].costCodeRows = costCodeRows;
        logPass(pageName, `${costCodeRows} cost code rows displayed`);

        // Check totals
        const totalsSection = await page.locator('.budget-totals, .totals-row, .summary-section').count();
        if (totalsSection === 0) {
          logWarning(pageName, 'UI', 'Missing budget totals section');
        }
      }
    }

    await page.screenshot({ path: 'tests/screenshots/audit-budget.png', fullPage: true });
  });

  // ============================================================
  // VENDORS PAGE AUDIT
  // ============================================================
  test('5. Vendors Page Audit', async ({ page }) => {
    console.log('\n' + '='.repeat(60));
    console.log('AUDITING: Vendors (vendors.html)');
    console.log('='.repeat(60));

    await page.goto('http://localhost:3001/vendors.html');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    const pageName = 'Vendors';
    auditResults.pageStats[pageName] = {};

    if (jsErrors.length > 0) {
      logError(pageName, 'JavaScript', `${jsErrors.length} JS errors`, { errors: jsErrors });
    } else {
      logPass(pageName, 'No JavaScript errors');
    }

    // Check vendor list
    const vendorRows = await page.locator('.vendor-row, .vendor-card, tr[data-vendor-id]').count();
    auditResults.pageStats[pageName].vendorCount = vendorRows;
    logPass(pageName, `${vendorRows} vendors displayed`);

    // Check Add Vendor button
    const addBtn = await page.locator('button:has-text("Add Vendor"), button:has-text("New Vendor")').count();
    if (addBtn === 0) {
      logWarning(pageName, 'UI', 'Missing Add Vendor button');
    } else {
      logPass(pageName, 'Add Vendor button present');
    }

    await page.screenshot({ path: 'tests/screenshots/audit-vendors.png', fullPage: true });
  });

  // ============================================================
  // CHANGE ORDERS PAGE AUDIT
  // ============================================================
  test('6. Change Orders Page Audit', async ({ page }) => {
    console.log('\n' + '='.repeat(60));
    console.log('AUDITING: Change Orders (change-orders.html)');
    console.log('='.repeat(60));

    await page.goto('http://localhost:3001/change-orders.html');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    const pageName = 'ChangeOrders';
    auditResults.pageStats[pageName] = {};

    if (jsErrors.length > 0) {
      logError(pageName, 'JavaScript', `${jsErrors.length} JS errors`, { errors: jsErrors });
    } else {
      logPass(pageName, 'No JavaScript errors');
    }

    // Check CO list
    const coRows = await page.locator('.co-row, .co-card, tr[data-co-id]').count();
    auditResults.pageStats[pageName].coCount = coRows;
    logPass(pageName, `${coRows} change orders displayed`);

    await page.screenshot({ path: 'tests/screenshots/audit-change-orders.png', fullPage: true });
  });

  // ============================================================
  // API ENDPOINTS AUDIT
  // ============================================================
  test('7. API Endpoints Audit', async ({ page, request }) => {
    console.log('\n' + '='.repeat(60));
    console.log('AUDITING: API Endpoints');
    console.log('='.repeat(60));

    const pageName = 'API';
    const endpoints = [
      { url: '/api/jobs', name: 'Jobs' },
      { url: '/api/vendors', name: 'Vendors' },
      { url: '/api/invoices', name: 'Invoices' },
      { url: '/api/purchase-orders', name: 'Purchase Orders' },
      { url: '/api/draws', name: 'Draws' },
      { url: '/api/cost-codes', name: 'Cost Codes' },
      { url: '/api/dashboard/stats', name: 'Dashboard Stats' },
      { url: '/api/purchase-orders/stats', name: 'PO Stats' },
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await request.get(`http://localhost:3001${endpoint.url}`);
        if (response.ok()) {
          const data = await response.json();
          const count = Array.isArray(data) ? data.length : 'object';
          logPass(pageName, `${endpoint.name}: ${response.status()} (${count} items)`);
        } else {
          logError(pageName, 'Endpoint', `${endpoint.name} returned ${response.status()}`);
        }
      } catch (err) {
        logError(pageName, 'Endpoint', `${endpoint.name} failed: ${err.message}`);
      }
    }
  });

  // ============================================================
  // WORKFLOW TESTS
  // ============================================================
  test('8. Invoice Workflow Audit', async ({ page }) => {
    console.log('\n' + '='.repeat(60));
    console.log('AUDITING: Invoice Workflow');
    console.log('='.repeat(60));

    await page.goto('http://localhost:3001/index.html');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    const pageName = 'Workflow';

    // Check invoice status distribution
    const statuses = ['received', 'needs_approval', 'approved', 'in_draw', 'paid'];
    for (const status of statuses) {
      const count = await page.locator(`.invoice-card.status-${status}`).count();
      logPass(pageName, `Invoices with status "${status}": ${count}`);
    }

    // Check for invoices with potential issues
    const invoiceCards = await page.locator('.invoice-card').count();
    if (invoiceCards > 0) {
      // Check first invoice for completeness
      await page.locator('.invoice-card').first().click();
      await page.waitForTimeout(2000);

      const modalActive = await page.locator('#modal-container.active').count();
      if (modalActive > 0) {
        // Check for missing data indicators
        const vendorValue = await page.locator('#edit-vendor').inputValue().catch(() => '');
        const jobValue = await page.locator('#edit-job').inputValue().catch(() => '');
        const amountValue = await page.locator('#edit-amount').inputValue().catch(() => '');

        if (!vendorValue) logWarning(pageName, 'Data', 'Invoice missing vendor');
        if (!jobValue) logWarning(pageName, 'Data', 'Invoice missing job');
        if (!amountValue || amountValue === '0') logWarning(pageName, 'Data', 'Invoice missing amount');

        // Check allocations
        const allocRows = await page.locator('.allocation-row, .cost-allocation-row').count();
        if (allocRows === 0) {
          logWarning(pageName, 'Data', 'Invoice has no cost code allocations');
        } else {
          logPass(pageName, `Invoice has ${allocRows} allocation(s)`);
        }

        // Close modal
        await page.keyboard.press('Escape');
      }
    }
  });

  // ============================================================
  // GENERATE FINAL REPORT
  // ============================================================
  test('9. Generate Audit Report', async ({ page }) => {
    console.log('\n' + '='.repeat(60));
    console.log('GENERATING AUDIT REPORT');
    console.log('='.repeat(60));

    // Summary
    console.log('\n📊 AUDIT SUMMARY:');
    console.log(`   ✅ Passed Checks: ${auditResults.passedChecks.length}`);
    console.log(`   ❌ Errors: ${auditResults.errors.length}`);
    console.log(`   ⚠️ Warnings: ${auditResults.warnings.length}`);
    console.log(`   💡 Improvements: ${auditResults.improvements.length}`);

    // Page Stats
    console.log('\n📈 PAGE STATISTICS:');
    for (const [page, stats] of Object.entries(auditResults.pageStats)) {
      console.log(`   ${page}: ${JSON.stringify(stats)}`);
    }

    // Errors
    if (auditResults.errors.length > 0) {
      console.log('\n❌ ERRORS TO FIX:');
      auditResults.errors.forEach((e, i) => {
        console.log(`   ${i + 1}. [${e.page}] ${e.category}: ${e.message}`);
      });
    }

    // Warnings
    if (auditResults.warnings.length > 0) {
      console.log('\n⚠️ WARNINGS TO REVIEW:');
      auditResults.warnings.forEach((w, i) => {
        console.log(`   ${i + 1}. [${w.page}] ${w.category}: ${w.message}`);
      });
    }

    // Save report to file
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        passed: auditResults.passedChecks.length,
        errors: auditResults.errors.length,
        warnings: auditResults.warnings.length,
        improvements: auditResults.improvements.length
      },
      pageStats: auditResults.pageStats,
      errors: auditResults.errors,
      warnings: auditResults.warnings,
      improvements: auditResults.improvements,
      passedChecks: auditResults.passedChecks
    };

    const fs = require('fs');
    fs.writeFileSync('tests/audit-report.json', JSON.stringify(report, null, 2));
    console.log('\n📄 Full report saved to: tests/audit-report.json');

    // Assert no critical errors
    expect(auditResults.errors.filter(e => e.category === 'JavaScript').length).toBe(0);
  });
});

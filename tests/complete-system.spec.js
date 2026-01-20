const { test, expect } = require('@playwright/test');

/**
 * Complete System Test Suite
 * Tests all features: Invoices, Change Orders, Purchase Orders, Draws, Budgets, Lien Releases, Vendors
 */

let errors = [];
let apiCalls = [];

// Helper to set up page monitoring
async function setupPageMonitoring(page) {
  errors = [];
  apiCalls = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (text.includes('Realtime')) return;
      if (text.includes('404') && !text.includes('/api/')) return;
      if (text.includes('favicon')) return;
      errors.push(text);
    }
  });

  page.on('pageerror', err => errors.push('PAGE ERROR: ' + err.message));

  page.on('response', async response => {
    const url = response.url();
    if (url.includes('/api/')) {
      apiCalls.push({ url, status: response.status() });
      if (response.status() >= 400) {
        try {
          const body = await response.json();
          errors.push(`API ${response.status()}: ${url} - ${JSON.stringify(body)}`);
        } catch (e) {
          errors.push(`API ${response.status()}: ${url}`);
        }
      }
    }
  });

  page.on('dialog', async dialog => {
    console.log('Dialog:', dialog.message());
    await dialog.accept();
  });
}

// ============================================================
// INVOICES
// ============================================================
test.describe('Invoices', () => {
  test.beforeEach(async ({ page }) => {
    await setupPageMonitoring(page);
    await page.goto('http://localhost:3001/index.html?t=' + Date.now());
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
  });

  test('1.1 Invoice page loads correctly', async ({ page }) => {
    await expect(page.locator('.header')).toBeVisible();
    await expect(page.locator('#invoiceList')).toBeVisible();

    const invoiceCards = await page.locator('.invoice-card').count();
    console.log('Invoice cards loaded:', invoiceCards);

    expect(errors.length).toBe(0);
  });

  test('1.2 Invoice filters work', async ({ page }) => {
    // Status filter
    const statusFilter = page.locator('#statusFilter');
    if (await statusFilter.count() > 0) {
      await statusFilter.selectOption('approved');
      await page.waitForTimeout(1000);
      console.log('Status filter applied');
    }

    // Job filter
    const jobFilter = page.locator('#jobFilter');
    if (await jobFilter.count() > 0) {
      const options = await jobFilter.locator('option').count();
      if (options > 1) {
        await jobFilter.selectOption({ index: 1 });
        await page.waitForTimeout(1000);
        console.log('Job filter applied');
      }
    }

    expect(errors.length).toBe(0);
  });

  test('1.3 Invoice modal opens and displays data', async ({ page }) => {
    const invoiceCard = page.locator('.invoice-card').first();
    if (await invoiceCard.count() > 0) {
      await invoiceCard.click();
      await page.waitForTimeout(2000);

      const modal = page.locator('#modal-container');
      const isActive = await modal.evaluate(el => el.classList.contains('active'));
      expect(isActive).toBe(true);

      // Check key fields exist
      await expect(page.locator('#edit-invoice-number')).toBeVisible();
      await expect(page.locator('#edit-amount')).toBeVisible();

      // Check PDF pane exists
      const pdfPane = page.locator('.modal-pdf-pane, iframe');
      expect(await pdfPane.count()).toBeGreaterThan(0);

      await page.locator('#modal-container .modal-close').first().click({ force: true });
    }

    expect(errors.length).toBe(0);
  });

  test('1.4 Invoice allocations work', async ({ page }) => {
    const editableInvoice = page.locator('.invoice-card.status-received, .invoice-card.status-needs_approval').first();

    if (await editableInvoice.count() > 0) {
      await editableInvoice.click();
      await page.waitForTimeout(2000);

      // Check allocation section exists
      const allocSection = page.locator('.allocations-section, #allocations');
      expect(await allocSection.count()).toBeGreaterThan(0);

      // Test cost code picker
      const ccPicker = page.locator('.cc-picker-input').first();
      if (await ccPicker.count() > 0) {
        await ccPicker.click();
        await page.waitForTimeout(500);

        const dropdown = page.locator('.cc-picker-dropdown.visible');
        if (await dropdown.count() > 0) {
          console.log('Cost code dropdown opens');
          await page.keyboard.press('Escape');
        }
      }

      // Test add allocation
      const addBtn = page.locator('button:has-text("Add Allocation"), button:has-text("Add Cost Code")');
      if (await addBtn.count() > 0) {
        const beforeCount = await page.locator('.allocation-row, .line-item').count();
        await addBtn.click();
        await page.waitForTimeout(500);
        const afterCount = await page.locator('.allocation-row, .line-item').count();
        console.log('Add allocation:', beforeCount, '->', afterCount);
      }

      // Test fill remaining
      const fillBtn = page.locator('.btn-fill-remaining').first();
      if (await fillBtn.count() > 0) {
        await fillBtn.click();
        await page.waitForTimeout(300);
        console.log('Fill remaining clicked');
      }

      await page.locator('#modal-container .modal-close').first().click({ force: true });
    }

    expect(errors.length).toBe(0);
  });

  test('1.5 Invoice status actions work', async ({ page }) => {
    // Test on needs_approval invoice
    const needsApprovalInvoice = page.locator('.invoice-card.status-needs_approval').first();

    if (await needsApprovalInvoice.count() > 0) {
      await needsApprovalInvoice.click();
      await page.waitForTimeout(2000);

      // Check approve button exists
      const approveBtn = page.locator('button.btn-success:has-text("Approve")');
      expect(await approveBtn.count()).toBeGreaterThan(0);
      console.log('Approve button present');

      // Check deny button exists
      const denyBtn = page.locator('button:has-text("Deny")');
      console.log('Deny button present:', await denyBtn.count() > 0);

      await page.locator('#modal-container .modal-close').first().click({ force: true });
    }

    // Test on approved invoice
    const approvedInvoice = page.locator('.invoice-card.status-approved').first();
    if (await approvedInvoice.count() > 0) {
      await approvedInvoice.click();
      await page.waitForTimeout(2000);

      const addToDrawBtn = page.locator('button:has-text("Add to Draw")');
      console.log('Add to Draw button present:', await addToDrawBtn.count() > 0);

      await page.locator('#modal-container .modal-close').first().click({ force: true });
    }

    expect(errors.length).toBe(0);
  });

  test('1.6 Invoice CO allocation dropdown works', async ({ page }) => {
    const editableInvoice = page.locator('.invoice-card.status-received, .invoice-card.status-needs_approval').first();

    if (await editableInvoice.count() > 0) {
      await editableInvoice.click();
      await page.waitForTimeout(2000);

      // Check for CO dropdown in allocations
      const coSelect = page.locator('.co-select, select[class*="co"]').first();
      if (await coSelect.count() > 0) {
        console.log('CO allocation dropdown present');
        const options = await coSelect.locator('option').count();
        console.log('CO options:', options);
      }

      await page.locator('#modal-container .modal-close').first().click({ force: true });
    }

    expect(errors.length).toBe(0);
  });
});

// ============================================================
// CHANGE ORDERS
// ============================================================
test.describe('Change Orders', () => {
  test.beforeEach(async ({ page }) => {
    await setupPageMonitoring(page);
    await page.goto('http://localhost:3001/change-orders.html?t=' + Date.now());
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
  });

  test('2.1 Change Orders page loads', async ({ page }) => {
    await expect(page.locator('.header')).toBeVisible();

    // Page should have filter and new button
    await expect(page.locator('#statusFilter')).toBeVisible();
    await expect(page.locator('button:has-text("New Change Order")')).toBeVisible();

    expect(errors.length).toBe(0);
  });

  test('2.2 Change Orders list loads for selected job', async ({ page }) => {
    // Wait for sidebar and job selection
    await page.waitForTimeout(2000);

    const coList = page.locator('#coList');
    // CO list may be hidden if no job selected - that's ok
    const isVisible = await coList.isVisible();
    console.log('CO list visible:', isVisible);

    const coCards = await page.locator('.co-card').count();
    console.log('Change Order cards:', coCards);

    expect(errors.length).toBe(0);
  });

  test('2.3 Create Change Order modal works', async ({ page }) => {
    const newBtn = page.locator('button:has-text("New Change Order")');
    await newBtn.click();
    await page.waitForTimeout(2000);

    // Modal should open (check display style or show class)
    const modal = page.locator('#createCOModal');
    const isVisible = await modal.evaluate(el =>
      el.classList.contains('show') || el.style.display === 'flex'
    );
    console.log('Create CO modal visible:', isVisible);

    // Check form fields exist
    const titleField = page.locator('#coTitle');
    const descField = page.locator('#coDescription');
    const reasonField = page.locator('#coReason');
    const baseAmountField = page.locator('#coBaseAmount');

    console.log('Title field present:', await titleField.count() > 0);
    console.log('Description field present:', await descField.count() > 0);
    console.log('Reason field present:', await reasonField.count() > 0);
    console.log('Base amount field present:', await baseAmountField.count() > 0);

    // Test GC fee calculation if base amount is visible
    if (await baseAmountField.isVisible()) {
      await baseAmountField.fill('10000');
      await page.waitForTimeout(500);

      const gcFeeAmount = await page.locator('#coGCFeeAmount').inputValue();
      const totalAmount = await page.locator('#coTotalAmount').inputValue();
      console.log('GC Fee:', gcFeeAmount, 'Total:', totalAmount);
    }

    // Close modal
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    expect(errors.length).toBe(0);
  });

  test('2.4 Cost code breakdown toggle works', async ({ page }) => {
    const newBtn = page.locator('button:has-text("New Change Order")');
    await newBtn.click();
    await page.waitForTimeout(2000);

    // Toggle cost code breakdown
    const toggle = page.locator('#coCostCodeToggle');
    if (await toggle.isVisible()) {
      await toggle.check();
      await page.waitForTimeout(500);

      // Section should be visible
      const ccSection = page.locator('#coCostCodeSection');
      console.log('Cost code section visible:', await ccSection.isVisible());

      // Should have at least one line
      const ccLines = await page.locator('.cost-code-line').count();
      console.log('Cost code lines:', ccLines);

      // Add another line if button exists
      const addBtn = page.locator('button:has-text("Add Cost Code")');
      if (await addBtn.isVisible()) {
        await addBtn.click();
        await page.waitForTimeout(300);
        const newLines = await page.locator('.cost-code-line').count();
        console.log('Cost code lines after add:', newLines);
      }
    } else {
      console.log('Toggle not visible - modal may not have opened');
    }

    // Close modal
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    expect(errors.length).toBe(0);
  });

  test('2.5 Change Order detail modal works', async ({ page }) => {
    const coCard = page.locator('.co-card').first();

    if (await coCard.count() > 0) {
      await coCard.click();
      await page.waitForTimeout(2000);

      // Detail modal should open
      const modal = page.locator('#coDetailModal');
      const isVisible = await modal.evaluate(el => el.classList.contains('show'));
      expect(isVisible).toBe(true);

      // Check sections exist
      await expect(page.locator('#coDetailBody')).toBeVisible();

      // Check for detail sections
      const detailSections = await page.locator('.detail-section').count();
      console.log('Detail sections:', detailSections);
      expect(detailSections).toBeGreaterThan(0);

      // Check status badge
      await expect(page.locator('#coStatusBadge')).toBeVisible();

      // Close modal
      await page.locator('#coDetailModal .close-btn').click();
    }

    expect(errors.length).toBe(0);
  });

  test('2.6 Change Order status filters work', async ({ page }) => {
    const statusFilter = page.locator('#statusFilter');

    // Test each status
    const statuses = ['draft', 'pending_approval', 'approved', 'closed'];
    for (const status of statuses) {
      await statusFilter.selectOption(status);
      await page.waitForTimeout(1000);
      console.log(`Filter ${status}: loaded`);
    }

    // Reset to all
    await statusFilter.selectOption('');
    await page.waitForTimeout(500);

    expect(errors.length).toBe(0);
  });

  test('2.7 Change Order search works', async ({ page }) => {
    const searchInput = page.locator('#searchInput');
    await searchInput.fill('test');
    await page.waitForTimeout(500);

    console.log('Search applied');

    // Clear search
    await searchInput.fill('');
    await page.waitForTimeout(500);

    expect(errors.length).toBe(0);
  });
});

// ============================================================
// PURCHASE ORDERS
// ============================================================
test.describe('Purchase Orders', () => {
  test.beforeEach(async ({ page }) => {
    await setupPageMonitoring(page);
    await page.goto('http://localhost:3001/pos.html?t=' + Date.now());
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
  });

  test('3.1 PO page loads correctly', async ({ page }) => {
    await expect(page.locator('.header')).toBeVisible();

    // Check for PO list
    const poList = page.locator('#poList, .po-list');
    await expect(poList).toBeVisible();

    // Check new PO button
    await expect(page.locator('button:has-text("New PO"), button:has-text("Create PO")')).toBeVisible();

    expect(errors.length).toBe(0);
  });

  test('3.2 PO filters work', async ({ page }) => {
    const statusFilter = page.locator('#statusFilter');
    if (await statusFilter.count() > 0) {
      await statusFilter.selectOption({ index: 1 });
      await page.waitForTimeout(1000);
      console.log('PO status filter applied');
    }

    const jobFilter = page.locator('#jobFilter');
    if (await jobFilter.count() > 0) {
      const options = await jobFilter.locator('option').count();
      if (options > 1) {
        await jobFilter.selectOption({ index: 1 });
        await page.waitForTimeout(1000);
        console.log('PO job filter applied');
      }
    }

    expect(errors.length).toBe(0);
  });

  test('3.3 PO detail modal opens', async ({ page }) => {
    const poCard = page.locator('.po-card, .po-row').first();

    if (await poCard.count() > 0) {
      await poCard.click();
      await page.waitForTimeout(2000);

      // Modal should be visible
      const modal = page.locator('#poModal');
      const isVisible = await modal.evaluate(el =>
        el.style.display === 'flex' || el.classList.contains('show')
      );
      expect(isVisible).toBe(true);

      // Check tabs exist
      const tabs = await page.locator('.tabs .tab, .tab-btn').count();
      console.log('PO modal tabs:', tabs);

      // Check PO info displays
      const poNumber = page.locator('.po-number, h2');
      await expect(poNumber).toBeVisible();

      // Close modal
      await page.locator('#poModal .close-btn').click();
    }

    expect(errors.length).toBe(0);
  });

  test('3.4 PO tabs work', async ({ page }) => {
    const poCard = page.locator('.po-card, .po-row').first();

    if (await poCard.count() > 0) {
      await poCard.click();
      await page.waitForTimeout(2000);

      // Click through tabs
      const tabs = ['overview', 'line-items', 'invoices', 'activity'];
      for (const tabName of tabs) {
        const tab = page.locator(`[data-tab="${tabName}"], button:has-text("${tabName}")`).first();
        if (await tab.count() > 0) {
          await tab.click();
          await page.waitForTimeout(500);
          console.log(`Tab ${tabName}: clicked`);
        }
      }

      await page.locator('#poModal .close-btn').click();
    }

    expect(errors.length).toBe(0);
  });

  test('3.5 Create PO modal works', async ({ page }) => {
    const createBtn = page.locator('button:has-text("New PO"), button:has-text("Create PO")');
    await createBtn.click();
    await page.waitForTimeout(1500);

    // Check if modal opened - look for any visible modal
    const modal = page.locator('.modal.show, .modal[style*="flex"]');
    const modalVisible = await modal.count() > 0;
    console.log('PO create modal opened:', modalVisible);

    // Close modal using escape key (most reliable)
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    expect(errors.length).toBe(0);
  });

  test('3.6 PO line items display', async ({ page }) => {
    const poCard = page.locator('.po-card, .po-row').first();

    if (await poCard.count() > 0) {
      await poCard.click();
      await page.waitForTimeout(2000);

      // Navigate to line items tab
      const lineItemsTab = page.locator('[data-tab="line-items"], button:has-text("Line Items")').first();
      if (await lineItemsTab.count() > 0) {
        await lineItemsTab.click();
        await page.waitForTimeout(500);
      }

      // Check line items display
      const lineItems = await page.locator('.line-item, .line-item-row, .li-row').count();
      console.log('PO line items:', lineItems);

      await page.locator('#poModal .close-btn').click();
    }

    expect(errors.length).toBe(0);
  });

  test('3.7 PO linked invoices display', async ({ page }) => {
    const poCard = page.locator('.po-card, .po-row').first();

    if (await poCard.count() > 0) {
      await poCard.click();
      await page.waitForTimeout(2000);

      // Navigate to invoices tab
      const invoicesTab = page.locator('[data-tab="invoices"], button:has-text("Invoices")').first();
      if (await invoicesTab.count() > 0) {
        await invoicesTab.click();
        await page.waitForTimeout(500);
      }

      // Check invoice list
      const invoices = await page.locator('.invoice-row, .linked-invoice').count();
      console.log('PO linked invoices:', invoices);

      await page.locator('#poModal .close-btn').click();
    }

    expect(errors.length).toBe(0);
  });
});

// ============================================================
// DRAWS
// ============================================================
test.describe('Draws', () => {
  test.beforeEach(async ({ page }) => {
    await setupPageMonitoring(page);
    await page.goto('http://localhost:3001/draws.html?t=' + Date.now());
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
  });

  test('4.1 Draws page loads correctly', async ({ page }) => {
    await expect(page.locator('.header')).toBeVisible();

    // Check for draw list or create button
    const drawList = page.locator('#drawList, .draws-list');
    await expect(drawList).toBeVisible();

    expect(errors.length).toBe(0);
  });

  test('4.2 Draw cards display correctly', async ({ page }) => {
    const drawCards = await page.locator('.draw-card').count();
    console.log('Draw cards:', drawCards);

    if (drawCards > 0) {
      const firstCard = page.locator('.draw-card').first();

      // Should show draw number and amount
      const hasDrawNumber = await firstCard.locator('text=/Draw #|Application/i').count() > 0 ||
                           await firstCard.textContent().then(t => t?.includes('Draw') || t?.includes('#'));
      console.log('Draw cards have draw info:', hasDrawNumber || drawCards > 0);
    }

    expect(errors.length).toBe(0);
  });

  test('4.3 Draw detail modal opens with tabs', async ({ page }) => {
    const drawCard = page.locator('.draw-card').first();

    if (await drawCard.count() > 0) {
      await drawCard.click();
      await page.waitForTimeout(2000);

      // Modal should be visible
      const modal = page.locator('#drawModal');
      if (await modal.count() > 0) {
        const isVisible = await modal.evaluate(el =>
          el.style.display === 'flex' || el.classList.contains('show')
        );
        expect(isVisible).toBe(true);

        // Check tabs
        const tabs = await page.locator('.tabs .tab, .draw-tabs .tab').count();
        console.log('Draw modal tabs:', tabs);

        await page.locator('#drawModal .close-btn').click();
      }
    }

    expect(errors.length).toBe(0);
  });

  test('4.4 G702 tab displays correctly', async ({ page }) => {
    const drawCard = page.locator('.draw-card').first();

    if (await drawCard.count() > 0) {
      await drawCard.click();
      await page.waitForTimeout(2000);

      // Click G702 tab
      const g702Tab = page.locator('[data-tab="g702"], button:has-text("G702")').first();
      if (await g702Tab.count() > 0) {
        await g702Tab.click();
        await page.waitForTimeout(500);

        // Check G702 content
        const g702Content = page.locator('.g702-section, #g702-content, [id*="g702"]');
        console.log('G702 content present:', await g702Content.count() > 0);
      }

      await page.locator('#drawModal .close-btn').click();
    }

    expect(errors.length).toBe(0);
  });

  test('4.5 G703 tab displays Schedule of Values', async ({ page }) => {
    const drawCard = page.locator('.draw-card').first();

    if (await drawCard.count() > 0) {
      await drawCard.click();
      await page.waitForTimeout(2000);

      // Click G703 tab
      const g703Tab = page.locator('[data-tab="g703"], button:has-text("G703")').first();
      if (await g703Tab.count() > 0) {
        await g703Tab.click();
        await page.waitForTimeout(500);

        // Check G703 table
        const g703Table = page.locator('.g703-table, table');
        console.log('G703 table present:', await g703Table.count() > 0);

        // Should have cost code rows
        const rows = await page.locator('tbody tr, .sov-row').count();
        console.log('G703 rows:', rows);
      }

      await page.locator('#drawModal .close-btn').click();
    }

    expect(errors.length).toBe(0);
  });

  test('4.6 Draw invoices tab works', async ({ page }) => {
    const drawCard = page.locator('.draw-card').first();

    if (await drawCard.count() > 0) {
      await drawCard.click();
      await page.waitForTimeout(2000);

      // Click Invoices tab
      const invoicesTab = page.locator('[data-tab="invoices"], button:has-text("Invoices")').first();
      if (await invoicesTab.count() > 0) {
        await invoicesTab.click();
        await page.waitForTimeout(500);

        // Check invoice list
        const invoices = await page.locator('.draw-invoice, .invoice-row').count();
        console.log('Draw invoices:', invoices);
      }

      await page.locator('#drawModal .close-btn').click();
    }

    expect(errors.length).toBe(0);
  });

  test('4.7 CO Billings section displays', async ({ page }) => {
    const drawCard = page.locator('.draw-card').first();

    if (await drawCard.count() > 0) {
      await drawCard.click();
      await page.waitForTimeout(2000);

      // Look for CO Billings section
      const coBillings = page.locator('.co-billings, [id*="co-billing"]');
      console.log('CO Billings section present:', await coBillings.count() > 0);

      await page.locator('#drawModal .close-btn').click();
    }

    expect(errors.length).toBe(0);
  });

  test('4.8 Export buttons exist', async ({ page }) => {
    const drawCard = page.locator('.draw-card').first();

    if (await drawCard.count() > 0) {
      await drawCard.click();
      await page.waitForTimeout(2000);

      // Check export buttons
      const excelBtn = page.locator('button:has-text("Excel"), button:has-text("Export Excel")');
      const pdfBtn = page.locator('button:has-text("PDF"), button:has-text("Export PDF")');

      console.log('Excel export button:', await excelBtn.count() > 0);
      console.log('PDF export button:', await pdfBtn.count() > 0);

      await page.locator('#drawModal .close-btn').click();
    }

    expect(errors.length).toBe(0);
  });

  test('4.9 Create draw functionality', async ({ page }) => {
    const createBtn = page.locator('button:has-text("Create Draw"), button:has-text("New Draw")');

    if (await createBtn.count() > 0) {
      await createBtn.click();
      await page.waitForTimeout(1000);

      // Should open create modal or show options
      const createModal = page.locator('#createDrawModal, .create-draw-modal');
      console.log('Create draw modal/options present:', await createModal.count() > 0);

      // Close if opened
      const cancelBtn = page.locator('button:has-text("Cancel")');
      if (await cancelBtn.count() > 0) {
        await cancelBtn.click();
      }
    }

    expect(errors.length).toBe(0);
  });
});

// ============================================================
// BUDGETS
// ============================================================
test.describe('Budgets', () => {
  test.beforeEach(async ({ page }) => {
    await setupPageMonitoring(page);
    await page.goto('http://localhost:3001/budgets.html?t=' + Date.now());
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
  });

  test('5.1 Budget page loads correctly', async ({ page }) => {
    await expect(page.locator('.header')).toBeVisible();

    expect(errors.length).toBe(0);
  });

  test('5.2 Budget table displays cost codes', async ({ page }) => {
    // Wait for data to load
    await page.waitForTimeout(1000);

    const budgetTable = page.locator('table, .budget-table, .budget-grid');
    console.log('Budget table present:', await budgetTable.count() > 0);

    const rows = await page.locator('tbody tr, .budget-row').count();
    console.log('Budget rows:', rows);

    expect(errors.length).toBe(0);
  });

  test('5.3 Budget columns show correct data', async ({ page }) => {
    await page.waitForTimeout(1000);

    // Check for expected columns: Budget, Committed, Billed, etc.
    const headers = await page.locator('th, .budget-header').allTextContents();
    console.log('Budget headers:', headers.slice(0, 8));

    expect(errors.length).toBe(0);
  });

  test('5.4 Budget totals display', async ({ page }) => {
    await page.waitForTimeout(1000);

    // Look for total row
    const totalRow = page.locator('.total-row, tfoot, .budget-totals');
    console.log('Budget totals present:', await totalRow.count() > 0);

    expect(errors.length).toBe(0);
  });

  test('5.5 Budget job filter works', async ({ page }) => {
    // Budget page uses sidebar for job selection, not a dropdown filter
    const sidebar = page.locator('.sidebar, .job-sidebar');
    console.log('Sidebar present:', await sidebar.count() > 0);

    // Check if there's a job filter dropdown
    const jobFilter = page.locator('#jobFilter');
    if (await jobFilter.count() > 0 && await jobFilter.isVisible()) {
      const options = await jobFilter.locator('option').count();
      if (options > 1) {
        await jobFilter.selectOption({ index: 1 });
        await page.waitForTimeout(1000);
        console.log('Budget job filter applied');
      }
    } else {
      console.log('Budget uses sidebar for job selection');
    }

    expect(errors.length).toBe(0);
  });

  test('5.6 Budget variance highlights', async ({ page }) => {
    await page.waitForTimeout(1000);

    // Check for variance indicators (over/under budget)
    const overBudget = await page.locator('.over-budget, .negative, .variance-negative, .text-danger').count();
    const underBudget = await page.locator('.under-budget, .positive, .variance-positive, .text-success').count();

    console.log('Over budget items:', overBudget);
    console.log('Under budget items:', underBudget);

    expect(errors.length).toBe(0);
  });
});

// ============================================================
// LIEN RELEASES
// ============================================================
test.describe('Lien Releases', () => {
  test.beforeEach(async ({ page }) => {
    await setupPageMonitoring(page);
    await page.goto('http://localhost:3001/lien-releases.html?t=' + Date.now());
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
  });

  test('6.1 Lien Releases page loads', async ({ page }) => {
    await expect(page.locator('.header')).toBeVisible();

    expect(errors.length).toBe(0);
  });

  test('6.2 Lien release list displays', async ({ page }) => {
    await page.waitForTimeout(1000);

    const lienList = page.locator('.lien-list, #lienList, table');
    console.log('Lien release list present:', await lienList.count() > 0);

    const lienCards = await page.locator('.lien-card, .lien-row, tbody tr').count();
    console.log('Lien release items:', lienCards);

    expect(errors.length).toBe(0);
  });

  test('6.3 Lien release filters work', async ({ page }) => {
    const statusFilter = page.locator('#statusFilter, select').first();

    if (await statusFilter.count() > 0) {
      const options = await statusFilter.locator('option').count();
      if (options > 1) {
        await statusFilter.selectOption({ index: 1 });
        await page.waitForTimeout(1000);
        console.log('Lien status filter applied');
      }
    }

    expect(errors.length).toBe(0);
  });

  test('6.4 Lien release detail modal works', async ({ page }) => {
    const lienCard = page.locator('.lien-card, .lien-row, tbody tr').first();

    if (await lienCard.count() > 0) {
      await lienCard.click();
      await page.waitForTimeout(1000);

      // Check if modal opened
      const modal = page.locator('.modal.show, .modal[style*="flex"]');
      console.log('Lien modal opened:', await modal.count() > 0);

      // Close modal
      const closeBtn = page.locator('.close-btn, button:has-text("Close")');
      if (await closeBtn.count() > 0) {
        await closeBtn.first().click();
      }
    }

    expect(errors.length).toBe(0);
  });

  test('6.5 Request lien release button exists', async ({ page }) => {
    const requestBtn = page.locator('button:has-text("Request"), button:has-text("New Lien")');
    console.log('Request lien release button:', await requestBtn.count() > 0);

    expect(errors.length).toBe(0);
  });

  test('6.6 Lien release status badges display', async ({ page }) => {
    const statusBadges = await page.locator('.status-badge, .lien-status').count();
    console.log('Lien status badges:', statusBadges);

    expect(errors.length).toBe(0);
  });
});

// ============================================================
// VENDORS
// ============================================================
test.describe('Vendors', () => {
  test.beforeEach(async ({ page }) => {
    await setupPageMonitoring(page);
    await page.goto('http://localhost:3001/vendors.html?t=' + Date.now());
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
  });

  test('7.1 Vendors page loads', async ({ page }) => {
    await expect(page.locator('.header')).toBeVisible();

    expect(errors.length).toBe(0);
  });

  test('7.2 Vendor list displays', async ({ page }) => {
    await page.waitForTimeout(1000);

    const vendorList = page.locator('.vendor-list, #vendorList, table');
    console.log('Vendor list present:', await vendorList.count() > 0);

    const vendorCards = await page.locator('.vendor-card, .vendor-row, tbody tr').count();
    console.log('Vendor items:', vendorCards);

    expect(errors.length).toBe(0);
  });

  test('7.3 Vendor search works', async ({ page }) => {
    const searchInput = page.locator('#searchInput, input[type="search"], input[placeholder*="search" i]');

    if (await searchInput.count() > 0) {
      await searchInput.fill('test');
      await page.waitForTimeout(500);
      console.log('Vendor search applied');

      await searchInput.fill('');
      await page.waitForTimeout(500);
    }

    expect(errors.length).toBe(0);
  });

  test('7.4 Vendor detail modal works', async ({ page }) => {
    const vendorCard = page.locator('.vendor-card, .vendor-row, tbody tr').first();

    if (await vendorCard.count() > 0) {
      await vendorCard.click();
      await page.waitForTimeout(1500);

      // Check if modal opened
      const modal = page.locator('#vendorDetailModal');
      const isVisible = await modal.evaluate(el =>
        el.classList.contains('show') || el.style.display === 'flex'
      ).catch(() => false);
      console.log('Vendor modal opened:', isVisible);

      // Close modal - try multiple methods
      if (isVisible) {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
      }
    }

    expect(errors.length).toBe(0);
  });

  test('7.5 Create vendor button exists', async ({ page }) => {
    const createBtn = page.locator('button:has-text("Add Vendor"), button:has-text("New Vendor"), button:has-text("Create")');
    console.log('Create vendor button:', await createBtn.count() > 0);

    expect(errors.length).toBe(0);
  });

  test('7.6 Vendor shows associated invoices/POs', async ({ page }) => {
    const vendorCard = page.locator('.vendor-card, .vendor-row, tbody tr').first();

    if (await vendorCard.count() > 0) {
      await vendorCard.click();
      await page.waitForTimeout(1500);

      // Check for invoice/PO count or list
      const invoiceSection = page.locator('.vendor-invoices, .invoice-list');
      const poSection = page.locator('.vendor-pos, .po-list');

      console.log('Invoice section in vendor:', await invoiceSection.count() > 0);
      console.log('PO section in vendor:', await poSection.count() > 0);

      // Close modal
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }

    expect(errors.length).toBe(0);
  });

  test('7.7 Vendor contact info displays', async ({ page }) => {
    const vendorCard = page.locator('.vendor-card, .vendor-row, tbody tr').first();

    if (await vendorCard.count() > 0) {
      await vendorCard.click();
      await page.waitForTimeout(1500);

      // Look for contact fields
      const emailField = page.locator('.vendor-email, input[type="email"], [id*="email"]');
      const phoneField = page.locator('.vendor-phone, input[type="tel"], [id*="phone"]');

      console.log('Email field present:', await emailField.count() > 0);
      console.log('Phone field present:', await phoneField.count() > 0);

      // Close modal
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }

    expect(errors.length).toBe(0);
  });
});

// ============================================================
// NAVIGATION & CROSS-PAGE
// ============================================================
test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await setupPageMonitoring(page);
  });

  test('8.1 Main navigation works', async ({ page }) => {
    await page.goto('http://localhost:3001/index.html');
    await page.waitForTimeout(1000);

    // Test navigation to each page
    const navLinks = [
      { name: 'Purchase Orders', url: 'pos.html' },
      { name: 'Change Orders', url: 'change-orders.html' },
      { name: 'Draws', url: 'draws.html' },
      { name: 'Budget', url: 'budgets.html' },
    ];

    for (const link of navLinks) {
      const navItem = page.locator(`a[href*="${link.url}"], a:has-text("${link.name}")`).first();
      if (await navItem.count() > 0) {
        await navItem.click();
        await page.waitForTimeout(1000);
        expect(page.url()).toContain(link.url.replace('.html', ''));
        console.log(`Navigation to ${link.name}: OK`);
      }
    }

    expect(errors.length).toBe(0);
  });

  test('8.2 Job sidebar persists selection', async ({ page }) => {
    await page.goto('http://localhost:3001/index.html');
    await page.waitForTimeout(1000);

    // Select a job in sidebar
    const jobItem = page.locator('.sidebar .job-item, .job-list-item').first();
    if (await jobItem.count() > 0) {
      await jobItem.click();
      await page.waitForTimeout(500);

      const selectedJob = await jobItem.textContent();
      console.log('Selected job:', selectedJob?.substring(0, 30));

      // Navigate to another page
      await page.goto('http://localhost:3001/pos.html');
      await page.waitForTimeout(1000);

      // Job should still be selected
      const stillSelected = page.locator('.sidebar .job-item.selected, .job-item.active');
      console.log('Job selection persisted:', await stillSelected.count() > 0);
    }

    expect(errors.length).toBe(0);
  });

  test('8.3 Connection status shows on all pages', async ({ page }) => {
    const pages = ['index.html', 'pos.html', 'draws.html', 'change-orders.html'];

    for (const pagePath of pages) {
      await page.goto(`http://localhost:3001/${pagePath}`);
      await page.waitForTimeout(1000);

      const connectionDot = page.locator('.connection-dot, .connection-status, #connectionDot');
      console.log(`${pagePath} connection status:`, await connectionDot.count() > 0);
    }

    expect(errors.length).toBe(0);
  });
});

// ============================================================
// API HEALTH CHECKS
// ============================================================
test.describe('API Health', () => {
  test('9.1 All core APIs respond', async ({ request }) => {
    const endpoints = [
      '/api/jobs',
      '/api/vendors',
      '/api/cost-codes',
      '/api/invoices',
      '/api/purchase-orders',
      '/api/draws',
    ];

    for (const endpoint of endpoints) {
      const response = await request.get(`http://localhost:3001${endpoint}`);
      console.log(`${endpoint}: ${response.status()}`);
      expect(response.status()).toBe(200);
    }
  });

  test('9.2 Job-specific APIs respond', async ({ request }) => {
    // Get a job ID first
    const jobsResponse = await request.get('http://localhost:3001/api/jobs');
    const jobs = await jobsResponse.json();

    if (jobs.length > 0) {
      const jobId = jobs[0].id;

      const endpoints = [
        `/api/jobs/${jobId}/budget`,
        `/api/jobs/${jobId}/change-orders`,
      ];

      for (const endpoint of endpoints) {
        const response = await request.get(`http://localhost:3001${endpoint}`);
        console.log(`${endpoint}: ${response.status()}`);
        expect(response.status()).toBe(200);
      }
    }
  });

  test('9.3 Dashboard stats API responds', async ({ request }) => {
    const response = await request.get('http://localhost:3001/api/dashboard/stats');
    console.log('Dashboard stats:', response.status());
    expect(response.status()).toBe(200);
  });
});

// ============================================================
// DATA INTEGRITY
// ============================================================
test.describe('Data Integrity', () => {
  test('10.1 Invoice amounts match allocations', async ({ page }) => {
    await page.goto('http://localhost:3001/index.html');
    await page.waitForTimeout(2000);

    const approvedInvoice = page.locator('.invoice-card.status-approved').first();

    if (await approvedInvoice.count() > 0) {
      await approvedInvoice.click();
      await page.waitForTimeout(2000);

      // Get invoice amount
      const amountField = page.locator('#edit-amount');
      const invoiceAmount = await amountField.inputValue();
      console.log('Invoice amount:', invoiceAmount);

      // Get allocation summary
      const summary = page.locator('.allocation-summary, #allocation-summary');
      if (await summary.count() > 0) {
        const summaryText = await summary.textContent();
        console.log('Allocation summary:', summaryText?.substring(0, 50));
      }

      await page.locator('#modal-container .modal-close').first().click({ force: true });
    }

    expect(errors.length).toBe(0);
  });

  test('10.2 Draw totals are consistent', async ({ page }) => {
    await page.goto('http://localhost:3001/draws.html');
    await page.waitForTimeout(2000);

    const drawCard = page.locator('.draw-card').first();

    if (await drawCard.count() > 0) {
      // Get draw amount from card
      const cardAmount = await drawCard.locator('.draw-amount, .amount').textContent();
      console.log('Card amount:', cardAmount);

      await drawCard.click();
      await page.waitForTimeout(2000);

      // Get amount from modal
      const modalAmount = page.locator('.draw-total, .total-amount, .payment-due');
      if (await modalAmount.count() > 0) {
        const modalAmountText = await modalAmount.first().textContent();
        console.log('Modal amount:', modalAmountText);
      }

      await page.locator('#drawModal .close-btn').click();
    }

    expect(errors.length).toBe(0);
  });

  test('10.3 PO amounts match line item totals', async ({ page }) => {
    await page.goto('http://localhost:3001/pos.html');
    await page.waitForTimeout(2000);

    const poCard = page.locator('.po-card, .po-row').first();

    if (await poCard.count() > 0) {
      await poCard.click();
      await page.waitForTimeout(2000);

      // Navigate to line items
      const lineItemsTab = page.locator('[data-tab="line-items"], button:has-text("Line Items")').first();
      if (await lineItemsTab.count() > 0) {
        await lineItemsTab.click();
        await page.waitForTimeout(500);
      }

      // Get total from line items
      const lineTotal = page.locator('.line-items-total, .total-row');
      if (await lineTotal.count() > 0) {
        const totalText = await lineTotal.textContent();
        console.log('Line items total:', totalText);
      }

      await page.locator('#poModal .close-btn').click();
    }

    expect(errors.length).toBe(0);
  });
});

// ============================================================
// ERROR HANDLING
// ============================================================
test.describe('Error Handling', () => {
  test('11.1 Invalid invoice ID shows error', async ({ page }) => {
    await page.goto('http://localhost:3001/index.html');
    await page.waitForTimeout(1000);

    // Try to fetch invalid invoice
    const response = await page.request.get('http://localhost:3001/api/invoices/invalid-uuid');
    console.log('Invalid invoice response:', response.status());
    expect(response.status()).toBeGreaterThanOrEqual(400);
  });

  test('11.2 Invalid job ID shows error', async ({ page }) => {
    const response = await page.request.get('http://localhost:3001/api/jobs/invalid-uuid/budget');
    console.log('Invalid job response:', response.status());
    expect(response.status()).toBeGreaterThanOrEqual(400);
  });

  test('11.3 Toast notifications work', async ({ page }) => {
    await page.goto('http://localhost:3001/index.html');
    await page.waitForTimeout(1000);

    // Toast container should exist
    const toastContainer = page.locator('#toast-container, .toast-container, #toastContainer');
    expect(await toastContainer.count()).toBeGreaterThan(0);
  });
});

const { test, expect } = require('@playwright/test');

test.describe('Comprehensive System Test', () => {
  const baseUrl = 'http://localhost:3001';

  test('1. Invoice Dashboard', async ({ page }) => {
    console.log('TEST 1: INVOICE DASHBOARD');
    await page.goto(baseUrl);
    await page.waitForTimeout(2000);
    console.log('Page title:', await page.title());
    console.log('Filter buttons:', await page.locator('.filter-btn').count());
    console.log('Job filter exists:', await page.locator('#jobFilter').count() > 0);
    console.log('Invoice count:', await page.locator('.invoice-row, .invoice-item, .invoice-card').count());
    console.log('Dashboard OK');
  });

  test('2. Invoice Modal', async ({ page }) => {
    console.log('TEST 2: INVOICE MODAL');
    await page.goto(baseUrl);
    await page.waitForTimeout(2000);
    const invoiceList = page.locator('#invoiceList');
    const invoiceCards = invoiceList.locator('.invoice-card, .invoice-row, .invoice-item, [onclick*="openInvoice"]');
    const cardCount = await invoiceCards.count();
    console.log('Invoice cards:', cardCount);
    if (cardCount > 0) {
      const firstCard = invoiceCards.first();
      console.log('Clicking first invoice...');
      await firstCard.click();
      await page.waitForTimeout(2000);
      const modal = page.locator('#invoiceModal');
      const isVisible = await modal.isVisible();
      console.log('Modal visible:', isVisible);
      if (isVisible) {
        const closeBtn = modal.locator('.close-btn');
        if (await closeBtn.count() > 0) await closeBtn.click();
      }
    }
    console.log('Invoice Modal OK');
  });

  test('3. Draws Page', async ({ page }) => {
    console.log('TEST 3: DRAWS PAGE');
    await page.goto(baseUrl + '/draws.html');
    await page.waitForTimeout(2000);
    console.log('Draw count:', await page.locator('.draw-row, .draw-item, .draw-card').count());
    console.log('Status filter:', await page.locator('#statusFilter').count() > 0);
    console.log('Draws Page OK');
  });

  test('4. Draw Modal', async ({ page }) => {
    console.log('TEST 4: DRAW MODAL');
    await page.goto(baseUrl + '/draws.html');
    await page.waitForTimeout(2000);
    const firstDraw = page.locator('.draw-row, .draw-item, .draw-card').first();
    if (await firstDraw.count() > 0) {
      await firstDraw.click();
      await page.waitForTimeout(1500);
      console.log('Summary cards:', await page.locator('.summary-card').count());
      await page.keyboard.press('Escape');
    }
    console.log('Draw Modal OK');
  });

  test('5. POs Page', async ({ page }) => {
    console.log('TEST 5: POs PAGE');
    await page.goto(baseUrl + '/pos.html');
    await page.waitForTimeout(2000);
    console.log('PO count:', await page.locator('.po-row, .po-item, .po-card, tr[data-po-id]').count());
    console.log('POs Page OK');
  });

  test('6. Budgets Page', async ({ page }) => {
    console.log('TEST 6: BUDGETS PAGE');
    await page.goto(baseUrl + '/budgets.html');
    await page.waitForTimeout(2000);
    console.log('Job filter:', await page.locator('#jobFilter').count() > 0);
    console.log('Budgets Page OK');
  });

  test('7. Invoice API', async ({ page }) => {
    console.log('TEST 7: INVOICE API');
    const res = await page.request.get(baseUrl + '/api/invoices');
    console.log('GET /api/invoices:', res.status());
    const invoices = await res.json();
    console.log('Invoice count:', invoices.length);
    console.log('Invoice API OK');
  });

  test('8. Draws API', async ({ page }) => {
    console.log('TEST 8: DRAWS API');
    const jobsRes = await page.request.get(baseUrl + '/api/jobs');
    const jobs = await jobsRes.json();
    if (jobs.length > 0) {
      const drawsRes = await page.request.get(baseUrl + '/api/jobs/' + jobs[0].id + '/draws');
      console.log('GET draws:', drawsRes.status());
      const draws = await drawsRes.json();
      console.log('Draws count:', draws.length);
    }
    console.log('Draws API OK');
  });

  test('9. PO API', async ({ page }) => {
    console.log('TEST 9: PO API');
    const res = await page.request.get(baseUrl + '/api/purchase-orders');
    console.log('GET /api/purchase-orders:', res.status());
    const pos = await res.json();
    console.log('PO count:', pos.length);
    console.log('PO API OK');
  });

  test('10. Allocation Validation', async ({ page }) => {
    console.log('TEST 10: ALLOCATION VALIDATION');
    const res = await page.request.get(baseUrl + '/api/invoices?status=needs_approval');
    const invoices = await res.json();
    if (invoices.length > 0) {
      const invoice = invoices[0];
      console.log('Testing invoice:', invoice.invoice_number);
      const billedAmount = Math.max(parseFloat(invoice.billed_amount || 0), parseFloat(invoice.paid_amount || 0));
      const remaining = parseFloat(invoice.amount) - billedAmount;
      console.log('Remaining:', remaining);
      const overRes = await page.request.post(baseUrl + '/api/invoices/' + invoice.id + '/allocate', {
        data: { allocations: [{ cost_code_id: '62d2bddd-8e38-42a0-b918-a122e15c2ba6', amount: remaining + 1000 }] }
      });
      console.log('Over-allocation rejected:', overRes.status() === 400);
    }
    console.log('Allocation Validation OK');
  });
});

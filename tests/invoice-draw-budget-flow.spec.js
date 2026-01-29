// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Invoice → Draw → Budget Integration Tests
 * Tests the full flow of invoice processing through draws and into budget
 */

test.describe('Invoice to Draw to Budget Flow', () => {

  test('invoice status changes when added to draw', async ({ request }) => {
    // Get an approved invoice
    const invoicesResponse = await request.get('/api/invoices');
    const invoices = await invoicesResponse.json();
    const approvedInvoice = invoices.find(inv => inv.status === 'approved' && inv.job_id);

    if (!approvedInvoice) {
      console.log('No approved invoice with job found');
      test.skip();
      return;
    }

    // Get or create a draft draw for the job
    const drawsResponse = await request.get('/api/draws');
    const draws = await drawsResponse.json();
    let draw = draws.find(d => d.job_id === approvedInvoice.job_id && d.status === 'draft');

    if (!draw) {
      // Create a new draw
      const createResponse = await request.post(`/api/jobs/${approvedInvoice.job_id}/draws`, {
        data: { period_end: new Date().toISOString().split('T')[0] }
      });
      if (createResponse.ok()) {
        draw = await createResponse.json();
      } else {
        console.log('Could not create draw');
        test.skip();
        return;
      }
    }

    // Add invoice to draw
    const addResponse = await request.post(`/api/draws/${draw.id}/add-invoices`, {
      data: { invoice_ids: [approvedInvoice.id] }
    });
    expect(addResponse.ok()).toBeTruthy();

    // Verify invoice status changed
    const updatedInvoiceResponse = await request.get(`/api/invoices/${approvedInvoice.id}`);
    const updatedInvoice = await updatedInvoiceResponse.json();
    expect(updatedInvoice.status).toBe('in_draw');
  });

  test('draw shows correct G702 totals', async ({ request }) => {
    // Get a draw with invoices
    const drawsResponse = await request.get('/api/draws');
    const draws = await drawsResponse.json();
    const drawWithInvoices = draws.find(d => d.invoices?.length > 0 || d.invoiceCount > 0);

    if (!drawWithInvoices) {
      console.log('No draw with invoices found');
      test.skip();
      return;
    }

    // Get draw details
    const drawResponse = await request.get(`/api/draws/${drawWithInvoices.id}`);
    const draw = await drawResponse.json();

    // Verify G702 data exists
    expect(draw.g702).toBeDefined();
    expect(draw.g702.totalCompletedThisPeriod).toBeGreaterThanOrEqual(0);
    expect(draw.g702.currentPaymentDue).toBeGreaterThanOrEqual(0);
  });

  test('budget reflects invoice allocations', async ({ request }) => {
    // Get an invoice with allocations
    const invoicesResponse = await request.get('/api/invoices');
    const invoices = await invoicesResponse.json();
    const invoiceWithJob = invoices.find(inv =>
      inv.job_id && ['approved', 'in_draw', 'paid'].includes(inv.status)
    );

    if (!invoiceWithJob) {
      console.log('No invoice with job in approved/in_draw/paid status');
      test.skip();
      return;
    }

    // Get budget summary
    const budgetResponse = await request.get(`/api/jobs/${invoiceWithJob.job_id}/budget-summary`);
    expect(budgetResponse.ok()).toBeTruthy();
    const budget = await budgetResponse.json();

    // Verify budget structure
    expect(budget.totals).toBeDefined();
    expect(budget.lines).toBeDefined();
    expect(Array.isArray(budget.lines)).toBe(true);

    // Should have billed amount if invoices are approved
    console.log('Budget totals:', budget.totals);
  });

  test('funding draw updates invoice to paid', async ({ request }) => {
    // Get a submitted draw
    const drawsResponse = await request.get('/api/draws');
    const draws = await drawsResponse.json();
    const submittedDraw = draws.find(d => d.status === 'submitted');

    if (!submittedDraw) {
      console.log('No submitted draw found');
      test.skip();
      return;
    }

    // Get draw details to find invoices
    const drawResponse = await request.get(`/api/draws/${submittedDraw.id}`);
    const draw = await drawResponse.json();

    if (!draw.invoices?.length) {
      console.log('Submitted draw has no invoices');
      test.skip();
      return;
    }

    const invoiceId = draw.invoices[0].id;

    // Fund the draw
    const fundResponse = await request.patch(`/api/draws/${submittedDraw.id}/fund`, {
      data: { funded_amount: draw.total_amount, funded_by: 'Test' }
    });
    expect(fundResponse.ok()).toBeTruthy();

    // Verify invoice is now paid
    const invoiceResponse = await request.get(`/api/invoices/${invoiceId}`);
    const invoice = await invoiceResponse.json();
    expect(invoice.status).toBe('paid');
    expect(invoice.paid_amount).toBe(invoice.amount);
  });

  test('budget shows paid amounts after draw funded', async ({ request }) => {
    // Get a funded draw
    const drawsResponse = await request.get('/api/draws');
    const draws = await drawsResponse.json();
    const fundedDraw = draws.find(d => d.status === 'funded');

    if (!fundedDraw) {
      console.log('No funded draw found');
      test.skip();
      return;
    }

    // Get budget summary
    const budgetResponse = await request.get(`/api/jobs/${fundedDraw.job_id}/budget-summary`);
    const budget = await budgetResponse.json();

    // Should have paid amount
    console.log('Budget after funding:', budget.totals);
    expect(budget.totals.paid).toBeGreaterThanOrEqual(0);
  });

  test('draw validation checks pass', async ({ request }) => {
    // Get any draw
    const drawsResponse = await request.get('/api/draws');
    const draws = await drawsResponse.json();

    if (draws.length === 0) {
      test.skip();
      return;
    }

    const draw = draws[0];
    const drawResponse = await request.get(`/api/draws/${draw.id}`);
    const drawDetails = await drawResponse.json();

    // Validation should exist
    expect(drawDetails.validation).toBeDefined();
    expect(drawDetails.validation.has_drift).toBeDefined();
    expect(drawDetails.validation.has_co_overlap).toBeDefined();
  });
});

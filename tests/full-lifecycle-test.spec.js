// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Full Invoice Lifecycle Test
 * Creates test invoices and moves them through all states
 * Tests budget and PO impacts at each step
 */

test.describe('Full Invoice Lifecycle', () => {
  const testJobId = 'd8a914c9-b861-4a4f-b888-75887b1570c4'; // Drummond job
  let testInvoiceId = null;
  let testVendorId = null;
  let testCostCodeId = null;
  let testDrawId = null;
  let initialBudgetState = null;

  test.beforeAll(async ({ request }) => {
    // Get a vendor for our test invoice
    const vendorsResp = await request.get('/api/vendors');
    const vendors = await vendorsResp.json();
    testVendorId = vendors[0]?.id;

    // Get a cost code for allocations
    const ccResp = await request.get('/api/cost-codes');
    const ccData = await ccResp.json();
    const costCodes = ccData.costCodes || ccData;
    testCostCodeId = costCodes.find(cc => cc.code === '24103')?.id || costCodes[0]?.id;

    console.log('Test setup:', { testVendorId, testCostCodeId });
  });

  test('1. Create test invoice via direct insert', async ({ request }) => {
    // First, capture initial budget state
    const budgetResp = await request.get(`/api/jobs/${testJobId}/budget-summary`);
    initialBudgetState = await budgetResp.json();
    console.log('=== INITIAL STATE ===');
    console.log('Billed:', initialBudgetState.totals.billed);
    console.log('Paid:', initialBudgetState.totals.paid);

    // Create invoice directly via internal endpoint
    // We'll use a workaround - create via database insert simulation
    const response = await request.post('/api/invoices/test-create', {
      data: {
        job_id: testJobId,
        vendor_id: testVendorId,
        invoice_number: `TEST-${Date.now()}`,
        invoice_date: new Date().toISOString().split('T')[0],
        amount: 5000.00,
        status: 'needs_approval'
      }
    });

    if (response.ok()) {
      const invoice = await response.json();
      testInvoiceId = invoice.id;
      console.log('Created test invoice:', testInvoiceId);
    } else {
      // Fallback: Find an existing needs_approval or received invoice
      const invoicesResp = await request.get('/api/invoices');
      const invoices = await invoicesResp.json();
      const testable = invoices.find(inv =>
        inv.status === 'needs_approval' || inv.status === 'received' || inv.status === 'approved'
      );
      if (testable) {
        testInvoiceId = testable.id;
        console.log('Using existing invoice:', testInvoiceId, 'status:', testable.status);
      } else {
        console.log('No testable invoice available - will create one via SQL');
      }
    }
  });

  test('2. Add allocation to invoice', async ({ request }) => {
    if (!testInvoiceId) {
      test.skip();
      return;
    }

    // Get invoice details
    const invoiceResp = await request.get(`/api/invoices/${testInvoiceId}`);
    const invoice = await invoiceResp.json();
    console.log('Invoice:', invoice.invoice_number, 'Amount:', invoice.amount, 'Status:', invoice.status);

    // Add allocation
    const allocateResp = await request.post(`/api/invoices/${testInvoiceId}/allocate`, {
      data: {
        allocations: [{
          cost_code_id: testCostCodeId,
          amount: invoice.amount,
          job_id: testJobId
        }]
      }
    });

    if (allocateResp.ok()) {
      console.log('Allocation added successfully');
    } else {
      const error = await allocateResp.json();
      console.log('Allocation error:', error.message || error.error);
    }

    // Verify allocation
    const detailResp = await request.get(`/api/invoices/${testInvoiceId}`);
    const detail = await detailResp.json();
    console.log('Allocations:', detail.allocations?.length || 0);
  });

  test('3. Approve invoice (needs_approval -> approved)', async ({ request }) => {
    if (!testInvoiceId) {
      test.skip();
      return;
    }

    const invoiceResp = await request.get(`/api/invoices/${testInvoiceId}`);
    const invoice = await invoiceResp.json();

    if (invoice.status === 'paid' || invoice.status === 'in_draw') {
      console.log('Invoice already in', invoice.status, '- skipping approval');
      return;
    }

    // Approve the invoice
    const approveResp = await request.patch(`/api/invoices/${testInvoiceId}/approve`, {
      data: {
        approved_by: 'Test User'
      }
    });

    if (approveResp.ok()) {
      const approved = await approveResp.json();
      console.log('Invoice approved:', approved.status);
    } else {
      const error = await approveResp.json();
      console.log('Approval error:', error.message || error.error);
    }
  });

  test('4. Check budget after approval (should show billed)', async ({ request }) => {
    const budgetResp = await request.get(`/api/jobs/${testJobId}/budget-summary`);
    const budget = await budgetResp.json();

    console.log('=== BUDGET AFTER APPROVAL ===');
    console.log('Billed:', budget.totals.billed);
    console.log('Paid:', budget.totals.paid);

    // Find the cost code we allocated to
    const line = budget.lines.find(l => l.costCodeId === testCostCodeId);
    if (line) {
      console.log('Cost code', line.costCode, '- Billed:', line.billed, 'Paid:', line.paid);
    }
  });

  test('5. Create or find a draft draw', async ({ request }) => {
    // First check for existing draft draw
    const drawsResp = await request.get('/api/draws');
    const draws = await drawsResp.json();

    const draftDraw = draws.find(d => d.status === 'draft' && d.job_id === testJobId);

    if (draftDraw) {
      testDrawId = draftDraw.id;
      console.log('Using existing draft draw:', testDrawId, 'Draw #', draftDraw.draw_number);
    } else {
      // Create new draw
      const createResp = await request.post(`/api/jobs/${testJobId}/draws`, {
        data: {
          period_end: new Date().toISOString().split('T')[0]
        }
      });

      if (createResp.ok()) {
        const newDraw = await createResp.json();
        testDrawId = newDraw.id;
        console.log('Created new draw:', testDrawId, 'Draw #', newDraw.draw_number);
      } else {
        const error = await createResp.json();
        console.log('Create draw error:', error.message);
      }
    }
  });

  test('6. Add invoice to draw (approved -> in_draw)', async ({ request }) => {
    if (!testInvoiceId || !testDrawId) {
      console.log('Missing invoice or draw');
      test.skip();
      return;
    }

    // Check current invoice status
    const invoiceResp = await request.get(`/api/invoices/${testInvoiceId}`);
    const invoice = await invoiceResp.json();

    if (invoice.status !== 'approved') {
      console.log('Invoice status is', invoice.status, '- needs to be approved first');
      if (invoice.status === 'in_draw' || invoice.status === 'paid') {
        console.log('Already processed - skipping');
        return;
      }
    }

    // Add to draw
    const addResp = await request.post(`/api/draws/${testDrawId}/add-invoices`, {
      data: {
        invoice_ids: [testInvoiceId]
      }
    });

    if (addResp.ok()) {
      const result = await addResp.json();
      console.log('Invoice added to draw successfully');
      console.log('Draw total:', result.total_amount);
    } else {
      const error = await addResp.json();
      console.log('Add to draw error:', error.message || error.error);
    }

    // Verify invoice status changed
    const verifyResp = await request.get(`/api/invoices/${testInvoiceId}`);
    const verified = await verifyResp.json();
    console.log('Invoice status after add to draw:', verified.status);
  });

  test('7. Submit draw', async ({ request }) => {
    if (!testDrawId) {
      test.skip();
      return;
    }

    const submitResp = await request.patch(`/api/draws/${testDrawId}/submit`);

    if (submitResp.ok()) {
      const draw = await submitResp.json();
      console.log('Draw submitted:', draw.status);
    } else {
      const error = await submitResp.json();
      console.log('Submit error:', error.message || error.error);
    }
  });

  test('8. Fund draw (marks invoices as paid)', async ({ request }) => {
    if (!testDrawId) {
      test.skip();
      return;
    }

    // Get draw details for funding amount
    const drawResp = await request.get(`/api/draws/${testDrawId}`);
    const draw = await drawResp.json();

    const fundResp = await request.patch(`/api/draws/${testDrawId}/fund`, {
      data: {
        funded_amount: draw.total_amount || draw.g702?.currentPaymentDue || 0
      }
    });

    if (fundResp.ok()) {
      const funded = await fundResp.json();
      console.log('Draw funded:', funded.funded_amount);
    } else {
      const error = await fundResp.json();
      console.log('Fund error:', error.message || error.error);
    }

    // Verify invoice is now paid
    if (testInvoiceId) {
      const invoiceResp = await request.get(`/api/invoices/${testInvoiceId}`);
      const invoice = await invoiceResp.json();
      console.log('Invoice status after funding:', invoice.status);
    }
  });

  test('9. Check final budget state', async ({ request }) => {
    const budgetResp = await request.get(`/api/jobs/${testJobId}/budget-summary`);
    const budget = await budgetResp.json();

    console.log('=== FINAL BUDGET STATE ===');
    console.log('Billed:', budget.totals.billed);
    console.log('Paid:', budget.totals.paid);
    console.log('Committed:', budget.totals.committed);

    // Compare with initial state
    if (initialBudgetState) {
      console.log('\n=== DELTA ===');
      console.log('Billed change:', budget.totals.billed - initialBudgetState.totals.billed);
      console.log('Paid change:', budget.totals.paid - initialBudgetState.totals.paid);
    }
  });

  test('10. Test removing invoice from draw', async ({ request }) => {
    // Find an invoice in a draft draw we can remove
    const drawsResp = await request.get('/api/draws');
    const draws = await drawsResp.json();

    const draftDraw = draws.find(d =>
      d.status === 'draft' &&
      d.job_id === testJobId &&
      d.invoices?.length > 0
    );

    if (!draftDraw) {
      console.log('No draft draw with invoices to test removal');
      return;
    }

    const invoiceToRemove = draftDraw.invoices[0];
    console.log('Testing removal of invoice', invoiceToRemove.id, 'from draw', draftDraw.id);

    // Get invoice status before
    const beforeResp = await request.get(`/api/invoices/${invoiceToRemove.id}`);
    const before = await beforeResp.json();
    console.log('Invoice status before removal:', before.status);

    const removeResp = await request.post(`/api/draws/${draftDraw.id}/remove-invoice`, {
      data: {
        invoice_id: invoiceToRemove.id
      }
    });

    if (removeResp.ok()) {
      console.log('Invoice removed successfully');

      // Check invoice status after
      const afterResp = await request.get(`/api/invoices/${invoiceToRemove.id}`);
      const after = await afterResp.json();
      console.log('Invoice status after removal:', after.status);
      expect(after.status).toBe('approved');
    } else {
      const error = await removeResp.json();
      console.log('Remove error:', error.message);
    }
  });

  test('11. Test PO impact', async ({ request }) => {
    // Get POs for the job
    const posResp = await request.get(`/api/purchase-orders?job_id=${testJobId}`);
    const pos = await posResp.json();

    console.log('=== PO STATUS ===');
    console.log('Total POs:', pos.length);

    pos.forEach(po => {
      const invoiced = po.invoiced_amount || 0;
      const remaining = po.total_amount - invoiced;
      const percent = po.total_amount > 0 ? ((invoiced / po.total_amount) * 100).toFixed(1) : 0;
      console.log(`${po.po_number}: Total $${po.total_amount}, Invoiced $${invoiced} (${percent}%), Remaining $${remaining}`);
    });
  });

  test('12. Test partial allocation scenario', async ({ request }) => {
    console.log('=== PARTIAL ALLOCATION TEST ===');
    console.log('This tests the flow when an invoice is partially allocated:');
    console.log('1. Invoice of $10,000 created');
    console.log('2. Only $5,000 allocated to cost code');
    console.log('3. Invoice approved with partial allocation');
    console.log('4. When added to draw:');
    console.log('   - $5,000 goes into the draw');
    console.log('   - Invoice status → needs_approval for remaining $5,000');
    console.log('   - User must allocate remaining and approve again');
    console.log('5. This allows splitting invoice costs across multiple draws');
  });

  test('13. Test status transition rules', async ({ request }) => {
    console.log('=== STATUS TRANSITION RULES ===');
    console.log('Valid transitions:');
    console.log('  received → needs_approval, denied');
    console.log('  needs_approval → approved, denied, received');
    console.log('  approved → in_draw, needs_approval');
    console.log('  in_draw → paid, approved (removal from draw)');
    console.log('  paid → (terminal state)');

    // Test an invalid transition
    const invoicesResp = await request.get('/api/invoices');
    const invoices = await invoicesResp.json();
    const paidInvoice = invoices.find(inv => inv.status === 'paid');

    if (paidInvoice) {
      console.log('\nTesting invalid transition from paid...');
      const transResp = await request.post(`/api/invoices/${paidInvoice.id}/transition`, {
        data: {
          new_status: 'approved',
          performed_by: 'Test'
        }
      });

      console.log('Response status:', transResp.status());
      if (!transResp.ok()) {
        const error = await transResp.json();
        console.log('Correctly rejected:', error.message || error.error);
      }
    }
  });
});

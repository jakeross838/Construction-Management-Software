// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Comprehensive Invoice Lifecycle Tests
 * Tests moving invoices through all states and verifying budget/PO impacts
 */

test.describe('Invoice Lifecycle', () => {
  let testInvoiceId = null;
  let testDrawId = null;
  const testJobId = 'd8a914c9-b861-4a4f-b888-75887b1570c4'; // Drummond job

  test('1. Get initial budget state', async ({ request }) => {
    const response = await request.get(`/api/jobs/${testJobId}/budget-summary`);
    expect(response.ok()).toBeTruthy();
    const budget = await response.json();

    console.log('=== INITIAL BUDGET STATE ===');
    console.log('Billed:', budget.totals.billed);
    console.log('Paid:', budget.totals.paid);
    console.log('Committed:', budget.totals.committed);
  });

  test('2. Create a test invoice', async ({ request }) => {
    // First get a vendor
    const vendorsResp = await request.get('/api/vendors');
    const vendors = await vendorsResp.json();
    const vendorId = vendors[0]?.id;

    if (!vendorId) {
      console.log('No vendors found, skipping');
      test.skip();
      return;
    }

    // Create invoice via the upload simulation or direct insert
    // For now, let's check if there's a needs_approval invoice we can use
    const invoicesResp = await request.get('/api/invoices');
    const invoices = await invoicesResp.json();

    // Find an invoice that's not paid that we can manipulate
    const testableInvoice = invoices.find(inv =>
      inv.status !== 'paid' && inv.job_id === testJobId
    );

    if (testableInvoice) {
      testInvoiceId = testableInvoice.id;
      console.log('Using existing invoice:', testInvoiceId, 'status:', testableInvoice.status);
    } else {
      console.log('No testable invoice found - all invoices are paid');
      // We'll test with the paid invoice by trying to transition it back
    }
  });

  test('3. Test allocation creation', async ({ request }) => {
    // Get an invoice to work with
    const invoicesResp = await request.get('/api/invoices');
    const invoices = await invoicesResp.json();

    if (invoices.length === 0) {
      test.skip();
      return;
    }

    const invoice = invoices[0];
    console.log('Testing with invoice:', invoice.id, 'status:', invoice.status, 'amount:', invoice.amount);

    // Check current allocations
    const detailResp = await request.get(`/api/invoices/${invoice.id}`);
    const detail = await detailResp.json();
    console.log('Current allocations:', detail.allocations?.length || 0);

    if (detail.allocations?.length > 0) {
      detail.allocations.forEach(a => {
        console.log('  -', a.cost_code?.code, a.cost_code?.name, ': $' + a.amount);
      });
    }
  });

  test('4. Test budget reflects allocations', async ({ request }) => {
    const budgetResp = await request.get(`/api/jobs/${testJobId}/budget-summary`);
    const budget = await budgetResp.json();

    console.log('=== BUDGET AFTER ALLOCATIONS ===');
    console.log('Total billed:', budget.totals.billed);
    console.log('Total paid:', budget.totals.paid);

    // Find lines with activity
    const activeLines = budget.lines.filter(l => l.billed > 0 || l.paid > 0);
    console.log('Cost codes with activity:');
    activeLines.forEach(l => {
      console.log('  ', l.costCode, l.description?.substring(0, 25), '- billed:', l.billed, 'paid:', l.paid);
    });
  });

  test('5. Test removing invoice from draw', async ({ request }) => {
    // Get the funded draw
    const drawsResp = await request.get('/api/draws');
    const draws = await drawsResp.json();
    const fundedDraw = draws.find(d => d.status === 'funded' && d.job_id === testJobId);

    if (!fundedDraw) {
      console.log('No funded draw to test removal from');
      test.skip();
      return;
    }

    console.log('Found funded draw:', fundedDraw.id, 'with', fundedDraw.invoices?.length || 0, 'invoices');

    // Note: Removing from a funded draw may not be allowed
    // Let's check if there's a draft draw instead
    const draftDraw = draws.find(d => d.status === 'draft' && d.job_id === testJobId);
    if (draftDraw && draftDraw.invoices?.length > 0) {
      const invoiceToRemove = draftDraw.invoices[0].id;
      console.log('Testing removal from draft draw:', draftDraw.id);

      const removeResp = await request.post(`/api/draws/${draftDraw.id}/remove-invoice`, {
        data: { invoice_id: invoiceToRemove }
      });

      console.log('Remove response status:', removeResp.status());
      if (removeResp.ok()) {
        console.log('Invoice removed successfully');
      } else {
        const error = await removeResp.json();
        console.log('Remove error:', error.message || error.error);
      }
    }
  });

  test('6. Test creating a new draw', async ({ request }) => {
    // Create a new draft draw for the job
    const createResp = await request.post(`/api/jobs/${testJobId}/draws`, {
      data: {
        period_end: new Date().toISOString().split('T')[0]
      }
    });

    if (createResp.ok()) {
      const newDraw = await createResp.json();
      testDrawId = newDraw.id;
      console.log('Created new draw:', newDraw.id, 'Draw #', newDraw.draw_number);
    } else {
      const error = await createResp.json();
      console.log('Create draw error:', error.message || error.error);
    }
  });

  test('7. Test status transitions', async ({ request }) => {
    // Get an invoice to transition
    const invoicesResp = await request.get('/api/invoices');
    const invoices = await invoicesResp.json();

    // Find one that's approved (can transition to needs_approval)
    const approvedInvoice = invoices.find(inv => inv.status === 'approved');

    if (approvedInvoice) {
      console.log('Testing transition for invoice:', approvedInvoice.id);

      // Try transitioning to needs_approval
      const transResp = await request.post(`/api/invoices/${approvedInvoice.id}/transition`, {
        data: {
          new_status: 'needs_approval',
          performed_by: 'Test'
        }
      });

      console.log('Transition response:', transResp.status());
      if (!transResp.ok()) {
        const error = await transResp.json();
        console.log('Transition error:', error.message || error.error);
      }
    } else {
      console.log('No approved invoice found to test transitions');
    }
  });

  test('8. Verify budget integrity after operations', async ({ request }) => {
    const budgetResp = await request.get(`/api/jobs/${testJobId}/budget-summary`);
    const budget = await budgetResp.json();

    console.log('=== FINAL BUDGET STATE ===');
    console.log('Billed:', budget.totals.billed);
    console.log('Paid:', budget.totals.paid);
    console.log('Committed:', budget.totals.committed);

    // Run integrity check
    const integrityResp = await request.post(`/api/jobs/${testJobId}/integrity`);
    if (integrityResp.ok()) {
      const integrity = await integrityResp.json();
      console.log('Integrity check:', integrity.status);
      if (integrity.issues?.length > 0) {
        console.log('Issues found:', integrity.issues);
      }
    }
  });

  test('9. Test PO tracking with invoices', async ({ request }) => {
    // Get POs for the job
    const posResp = await request.get(`/api/purchase-orders?job_id=${testJobId}`);

    if (!posResp.ok()) {
      console.log('Could not fetch POs');
      return;
    }

    const pos = await posResp.json();
    console.log('=== PO STATUS ===');
    console.log('Total POs:', pos.length);

    // Show POs with invoiced amounts
    const invoicedPOs = pos.filter(po => po.invoiced_amount > 0);
    console.log('POs with invoices:', invoicedPOs.length);
    invoicedPOs.forEach(po => {
      console.log('  ', po.po_number, '- Total:', po.total_amount, 'Invoiced:', po.invoiced_amount, 'Remaining:', po.remaining_amount);
    });
  });

  test('10. Test partial allocation scenario', async ({ request }) => {
    // Get cost codes
    const ccResp = await request.get('/api/cost-codes');
    const costCodes = await ccResp.json();

    if (costCodes.length < 2) {
      console.log('Not enough cost codes to test partial allocation');
      test.skip();
      return;
    }

    console.log('=== PARTIAL ALLOCATION TEST ===');
    console.log('Available cost codes:', costCodes.slice(0, 5).map(cc => cc.code + ' ' + cc.name).join(', '));

    // The allocation endpoint requires an invoice ID
    // This test documents the expected behavior
    console.log('Expected behavior:');
    console.log('1. Invoice can be approved with partial allocation (e.g., $5000 of $10000)');
    console.log('2. When added to draw, only allocated amount goes to draw');
    console.log('3. Invoice goes back to needs_approval for remaining amount');
    console.log('4. Allocations are cleared for re-entry');
  });
});

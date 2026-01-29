// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Partial Allocation Test
 * Tests that partial allocations work correctly when added to draws
 */

test.describe('Partial Allocation Flow', () => {
  const testJobId = 'd8a914c9-b861-4a4f-b888-75887b1570c4';
  let testInvoiceId = null;
  let testVendorId = null;
  let testCostCodeId = null;
  let testDrawId = null;

  test.beforeAll(async ({ request }) => {
    const vendorsResp = await request.get('/api/vendors');
    const vendors = await vendorsResp.json();
    testVendorId = vendors[0]?.id;

    const ccResp = await request.get('/api/cost-codes');
    const ccData = await ccResp.json();
    const costCodes = ccData.costCodes || ccData;
    testCostCodeId = costCodes.find(cc => cc.code === '24103')?.id || costCodes[0]?.id;
  });

  test('1. Create invoice for $10,000', async ({ request }) => {
    const response = await request.post('/api/invoices/test-create', {
      data: {
        job_id: testJobId,
        vendor_id: testVendorId,
        invoice_number: `PARTIAL-${Date.now()}`,
        invoice_date: new Date().toISOString().split('T')[0],
        amount: 10000.00,
        status: 'needs_approval'
      }
    });

    expect(response.ok()).toBeTruthy();
    const invoice = await response.json();
    testInvoiceId = invoice.id;
    console.log('Created invoice:', invoice.invoice_number, 'Amount: $10,000');
  });

  test('2. Add partial allocation ($5,000 of $10,000)', async ({ request }) => {
    const allocateResp = await request.post(`/api/invoices/${testInvoiceId}/allocate`, {
      data: {
        allocations: [{
          cost_code_id: testCostCodeId,
          amount: 5000,
          job_id: testJobId
        }]
      }
    });

    expect(allocateResp.ok()).toBeTruthy();
    console.log('Added partial allocation: $5,000 of $10,000');

    // Verify
    const detailResp = await request.get(`/api/invoices/${testInvoiceId}`);
    const detail = await detailResp.json();
    const totalAllocated = detail.allocations?.reduce((sum, a) => sum + parseFloat(a.amount), 0) || 0;
    console.log('Total allocated:', totalAllocated, '(should be 5000)');
    expect(totalAllocated).toBe(5000);
  });

  test('3. Approve with partial allocation', async ({ request }) => {
    // First try without allow_partial - should fail
    const rejectResp = await request.patch(`/api/invoices/${testInvoiceId}/approve`, {
      data: { approved_by: 'Test User' }
    });

    console.log('Without allow_partial:', rejectResp.status());
    const rejectResult = await rejectResp.json();

    if (!rejectResp.ok()) {
      console.log('Correctly rejected partial without flag:', rejectResult.error);
      expect(rejectResult.allow_partial_option).toBe(true);

      // Now try with allow_partial = true
      const approveResp = await request.patch(`/api/invoices/${testInvoiceId}/approve`, {
        data: {
          approved_by: 'Test User',
          allow_partial: true
        }
      });

      expect(approveResp.ok()).toBeTruthy();
      const approved = await approveResp.json();
      console.log('Approved with allow_partial:', approved.status);
    } else {
      console.log('Partial allocation was allowed:', rejectResult.status);
    }
  });

  test('4. Create a draft draw and add partial invoice', async ({ request }) => {
    // First create a fresh draft draw
    const createResp = await request.post(`/api/jobs/${testJobId}/draws`, {
      data: {
        period_end: new Date().toISOString().split('T')[0]
      }
    });

    if (createResp.ok()) {
      const draw = await createResp.json();
      testDrawId = draw.id;
      console.log('Created draw #', draw.draw_number);
    } else {
      // Use existing draft
      const drawsResp = await request.get('/api/draws');
      const draws = await drawsResp.json();
      const draft = draws.find(d => d.status === 'draft' && d.job_id === testJobId);
      if (draft) {
        testDrawId = draft.id;
        console.log('Using existing draft draw #', draft.draw_number);
      }
    }

    // Get invoice status
    const invoiceResp = await request.get(`/api/invoices/${testInvoiceId}`);
    const invoice = await invoiceResp.json();
    console.log('Invoice status before add:', invoice.status);

    if (invoice.status === 'approved') {
      // Add invoice to draw
      const addResp = await request.post(`/api/draws/${testDrawId}/add-invoices`, {
        data: { invoice_ids: [testInvoiceId] }
      });

      if (addResp.ok()) {
        const result = await addResp.json();
        console.log('Invoice added to draw. Draw total:', result.total_amount);
      } else {
        const error = await addResp.json();
        console.log('Add error:', error.message);
      }
    }
  });

  test('5. Verify partial allocation behavior', async ({ request }) => {
    // Get invoice status
    const invoiceResp = await request.get(`/api/invoices/${testInvoiceId}`);
    const invoice = await invoiceResp.json();

    console.log('=== PARTIAL ALLOCATION RESULT ===');
    console.log('Invoice status:', invoice.status);
    console.log('Invoice amount:', invoice.amount);

    const totalAllocated = invoice.allocations?.reduce((sum, a) => sum + parseFloat(a.amount), 0) || 0;
    console.log('Total allocated:', totalAllocated);

    // If partial, invoice should be sent back to needs_approval for remaining
    if (totalAllocated < invoice.amount) {
      console.log('Remaining to allocate:', invoice.amount - totalAllocated);
      // The expected behavior after adding partial to draw:
      // - $5,000 goes into the draw
      // - Invoice returns to needs_approval with remaining $5,000
    }
  });

  test('6. Cleanup - delete test invoice', async ({ request }) => {
    if (testInvoiceId) {
      // First, remove from any draws
      const invoiceResp = await request.get(`/api/invoices/${testInvoiceId}`);
      const invoice = await invoiceResp.json();

      if (invoice.draw_id) {
        await request.post(`/api/draws/${invoice.draw_id}/remove-invoice`, {
          data: { invoice_id: testInvoiceId }
        });
      }

      // Then delete
      const deleteResp = await request.delete(`/api/invoices/${testInvoiceId}?performedBy=Test`);
      if (deleteResp.ok()) {
        console.log('Test invoice cleaned up');
      }
    }
  });
});

test.describe('Invoice Removal from Draw', () => {
  const testJobId = 'd8a914c9-b861-4a4f-b888-75887b1570c4';
  let testInvoiceId = null;
  let testVendorId = null;
  let testCostCodeId = null;
  let testDrawId = null;

  test.beforeAll(async ({ request }) => {
    const vendorsResp = await request.get('/api/vendors');
    const vendors = await vendorsResp.json();
    testVendorId = vendors[0]?.id;

    const ccResp = await request.get('/api/cost-codes');
    const ccData = await ccResp.json();
    const costCodes = ccData.costCodes || ccData;
    testCostCodeId = costCodes.find(cc => cc.code === '24103')?.id || costCodes[0]?.id;
  });

  test('1. Setup: Create invoice and add to draft draw', async ({ request }) => {
    // Create invoice
    const createResp = await request.post('/api/invoices/test-create', {
      data: {
        job_id: testJobId,
        vendor_id: testVendorId,
        invoice_number: `REMOVE-TEST-${Date.now()}`,
        amount: 3000.00,
        status: 'needs_approval'
      }
    });

    const invoice = await createResp.json();
    testInvoiceId = invoice.id;
    console.log('Created invoice:', invoice.invoice_number);

    // Add allocation
    await request.post(`/api/invoices/${testInvoiceId}/allocate`, {
      data: {
        allocations: [{
          cost_code_id: testCostCodeId,
          amount: 3000,
          job_id: testJobId
        }]
      }
    });

    // Approve
    await request.patch(`/api/invoices/${testInvoiceId}/approve`, {
      data: { approved_by: 'Test' }
    });

    // Get invoice status (may already be in draw from auto-add)
    const statusResp = await request.get(`/api/invoices/${testInvoiceId}`);
    const status = await statusResp.json();
    console.log('Invoice status after approval:', status.status);

    // Create/find draft draw
    const drawsResp = await request.get('/api/draws');
    const draws = await drawsResp.json();
    let draft = draws.find(d => d.status === 'draft' && d.job_id === testJobId);

    if (!draft) {
      const createDrawResp = await request.post(`/api/jobs/${testJobId}/draws`, {
        data: { period_end: new Date().toISOString().split('T')[0] }
      });
      draft = await createDrawResp.json();
    }
    testDrawId = draft.id;
    console.log('Using draw:', testDrawId);

    // Add to draw if not already
    if (status.status === 'approved') {
      await request.post(`/api/draws/${testDrawId}/add-invoices`, {
        data: { invoice_ids: [testInvoiceId] }
      });
    }
  });

  test('2. Remove invoice from draft draw', async ({ request }) => {
    // Verify invoice is in draw
    const beforeResp = await request.get(`/api/invoices/${testInvoiceId}`);
    const before = await beforeResp.json();
    console.log('Invoice status before removal:', before.status);
    expect(before.status).toBe('in_draw');

    // Remove from draw
    const removeResp = await request.post(`/api/draws/${testDrawId}/remove-invoice`, {
      data: { invoice_id: testInvoiceId }
    });

    expect(removeResp.ok()).toBeTruthy();
    console.log('Removal successful');

    // Verify invoice returned to approved
    const afterResp = await request.get(`/api/invoices/${testInvoiceId}`);
    const after = await afterResp.json();
    console.log('Invoice status after removal:', after.status);
    expect(after.status).toBe('approved');
  });

  test('3. Verify draw no longer contains invoice', async ({ request }) => {
    const drawResp = await request.get(`/api/draws/${testDrawId}`);
    const draw = await drawResp.json();

    const hasInvoice = draw.invoices?.some(inv => inv.id === testInvoiceId);
    console.log('Draw contains removed invoice:', hasInvoice);
    expect(hasInvoice).toBe(false);
  });

  test('4. Re-add invoice to draw', async ({ request }) => {
    const addResp = await request.post(`/api/draws/${testDrawId}/add-invoices`, {
      data: { invoice_ids: [testInvoiceId] }
    });

    expect(addResp.ok()).toBeTruthy();
    console.log('Invoice re-added to draw');

    const statusResp = await request.get(`/api/invoices/${testInvoiceId}`);
    const status = await statusResp.json();
    expect(status.status).toBe('in_draw');
  });

  test('5. Cleanup', async ({ request }) => {
    if (testInvoiceId) {
      // Remove from draw first
      await request.post(`/api/draws/${testDrawId}/remove-invoice`, {
        data: { invoice_id: testInvoiceId }
      });

      // Delete invoice
      await request.delete(`/api/invoices/${testInvoiceId}?performedBy=Test`);
      console.log('Cleanup complete');
    }
  });
});

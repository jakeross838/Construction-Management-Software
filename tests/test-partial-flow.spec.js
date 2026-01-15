const { test, expect } = require('@playwright/test');

test('Partial approval flow test', async ({ page }) => {
  // Test 1: Verify remove from draw returns invoice to 'approved' status
  console.log('\n=== Test 1: Remove from draw should set status to approved ===');

  // Get an invoice that's in_draw
  const inDrawRes = await page.request.get('http://localhost:3001/api/invoices?status=in_draw');
  const inDrawInvoices = await inDrawRes.json();
  console.log('Invoices in_draw:', inDrawInvoices.length);

  if (inDrawInvoices.length > 0) {
    const testInvoice = inDrawInvoices[0];
    console.log('Test invoice:', testInvoice.id, 'status:', testInvoice.status);

    // Find which draw it's in
    const drawsRes = await page.request.get('http://localhost:3001/api/jobs/' + testInvoice.job_id + '/draws');
    const draws = await drawsRes.json();

    // Find draft draw with this invoice
    let targetDraw = null;
    for (const draw of draws) {
      if (draw.status === 'draft' && draw.invoices?.some(di => di.invoice?.id === testInvoice.id)) {
        targetDraw = draw;
        break;
      }
    }

    if (targetDraw) {
      console.log('Found draw:', targetDraw.id, 'status:', targetDraw.status);

      // Remove invoice from draw
      const removeRes = await page.request.post(`http://localhost:3001/api/draws/${targetDraw.id}/remove-invoice`, {
        data: { invoice_id: testInvoice.id }
      });
      const removeResult = await removeRes.json();
      console.log('Remove result:', removeResult);

      // Verify invoice is now 'approved'
      const checkRes = await page.request.get(`http://localhost:3001/api/invoices/${testInvoice.id}`);
      const updatedInvoice = await checkRes.json();
      console.log('After remove - Invoice status:', updatedInvoice.status);

      if (updatedInvoice.status === 'approved') {
        console.log('✓ SUCCESS: Invoice correctly returned to approved status');
      } else {
        console.log('✗ FAIL: Invoice status is', updatedInvoice.status, 'expected approved');
      }
    } else {
      console.log('No draft draw found with this invoice');
    }
  } else {
    console.log('No in_draw invoices to test with');
  }

  // Test 2: Verify funding a draw with partial moves invoice back to needs_approval
  console.log('\n=== Test 2: Fund draw with partial should kick back to needs_approval ===');
  console.log('(This would require a draft draw with partial to test - checking current state)');

  // Check for any invoices with paid_amount set (indicates partial payment history)
  const allInvoicesRes = await page.request.get('http://localhost:3001/api/invoices');
  const allInvoices = await allInvoicesRes.json();

  const partialHistoryInvoices = allInvoices.filter(inv =>
    parseFloat(inv.paid_amount || 0) > 0 &&
    parseFloat(inv.paid_amount || 0) < parseFloat(inv.amount || 0)
  );
  console.log('Invoices with partial payment history:', partialHistoryInvoices.length);

  if (partialHistoryInvoices.length > 0) {
    for (const inv of partialHistoryInvoices) {
      console.log(`  - ${inv.invoice_number}: paid ${inv.paid_amount} of ${inv.amount}, status: ${inv.status}`);
    }
  }

  console.log('\n=== Test Complete ===');
});

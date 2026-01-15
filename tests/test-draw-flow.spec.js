const { test, expect } = require('@playwright/test');

test('Draw flow - partial invoice kickback on submit', async ({ page }) => {
  const baseUrl = 'http://localhost:3001';

  console.log('\n=== DRAW FLOW TEST ===\n');

  // Step 1: Get the partial invoice (7093) which has $2,760 remaining
  console.log('Step 1: Check current state of partial invoice 7093');
  const invRes = await page.request.get(`${baseUrl}/api/invoices/0293dfb3-8d39-4a87-8ac6-a9b798efbde3`);
  const invoice = await invRes.json();
  console.log(`  Invoice: ${invoice.invoice_number}`);
  console.log(`  Status: ${invoice.status}`);
  console.log(`  Amount: $${invoice.amount}`);
  console.log(`  Paid: $${invoice.paid_amount || 0}`);
  console.log(`  Remaining: $${invoice.amount - (invoice.paid_amount || 0)}`);

  // Step 2: Approve the invoice with partial allocation
  console.log('\nStep 2: Approve invoice with allocation for remaining $2,760');

  // First, allocate the remaining amount
  const allocRes = await page.request.post(`${baseUrl}/api/invoices/${invoice.id}/allocate`, {
    data: {
      allocations: [{
        cost_code_id: '51cc1b37-8d8d-440e-8765-69f59e66b6a7', // Rough Carpentry
        amount: 2760,
        notes: 'Remaining balance'
      }]
    }
  });
  console.log(`  Allocation result: ${allocRes.ok() ? 'Success' : 'Failed'}`);

  // Then approve
  const approveRes = await page.request.patch(`${baseUrl}/api/invoices/${invoice.id}/approve`, {
    data: { approved_by: 'Test User' }
  });
  console.log(`  Approval result: ${approveRes.ok() ? 'Success' : 'Failed'}`);

  // Verify status changed to approved
  const afterApprove = await page.request.get(`${baseUrl}/api/invoices/${invoice.id}`);
  const approvedInv = await afterApprove.json();
  console.log(`  Status after approve: ${approvedInv.status}`);

  // Step 3: Create a new draw
  console.log('\nStep 3: Create new draw');
  const jobId = 'd8a914c9-b861-4a4f-b888-75887b1570c4';
  const createDrawRes = await page.request.post(`${baseUrl}/api/jobs/${jobId}/draws`, {
    data: { period_end: '2026-01-31' }
  });
  const newDraw = await createDrawRes.json();
  console.log(`  Created Draw #${newDraw.draw_number}, ID: ${newDraw.id?.substring(0, 8)}`);

  // Step 4: Add invoice to draw
  console.log('\nStep 4: Add invoice to draw');
  const addRes = await page.request.post(`${baseUrl}/api/draws/${newDraw.id}/add-invoices`, {
    data: { invoice_ids: [invoice.id] }
  });
  const addResult = await addRes.json();
  console.log(`  Add result: ${addResult.message || 'Added'}, new total: $${addResult.draw?.total_amount || 'N/A'}`);

  // Verify invoice is now in_draw
  const afterAdd = await page.request.get(`${baseUrl}/api/invoices/${invoice.id}`);
  const inDrawInv = await afterAdd.json();
  console.log(`  Invoice status after add: ${inDrawInv.status}`);

  // Step 5: Submit the draw
  console.log('\nStep 5: Submit the draw');
  console.log('  This should NOT kick back the invoice since we are billing the full remaining $2,760');
  const submitRes = await page.request.patch(`${baseUrl}/api/draws/${newDraw.id}/submit`);
  const submittedDraw = await submitRes.json();
  console.log(`  Draw status after submit: ${submittedDraw.status}`);

  // Verify invoice status after submit
  const afterSubmit = await page.request.get(`${baseUrl}/api/invoices/${invoice.id}`);
  const submittedInv = await afterSubmit.json();
  console.log(`  Invoice status after submit: ${submittedInv.status}`);
  console.log(`  Invoice billed_amount: $${submittedInv.billed_amount || 0}`);

  if (submittedInv.status === 'in_draw') {
    console.log('  ✓ Invoice correctly stayed in_draw (fully billed this draw)');
  } else if (submittedInv.status === 'needs_approval') {
    console.log('  ! Invoice kicked back to needs_approval (remaining balance)');
  } else {
    console.log(`  ? Unexpected status: ${submittedInv.status}`);
  }

  // Step 6: Fund the draw
  console.log('\nStep 6: Fund the draw');
  const fundRes = await page.request.patch(`${baseUrl}/api/draws/${newDraw.id}/fund`, {
    data: { funded_amount: submittedDraw.total_amount || 2760 }
  });
  const fundedDraw = await fundRes.json();
  console.log(`  Draw status after fund: ${fundedDraw.status}`);
  console.log(`  Funded amount: $${fundedDraw.funded_amount || 0}`);

  // Final check on invoice
  const finalInvRes = await page.request.get(`${baseUrl}/api/invoices/${invoice.id}`);
  const finalInv = await finalInvRes.json();
  console.log(`\nFinal invoice state:`);
  console.log(`  Status: ${finalInv.status}`);
  console.log(`  Paid amount: $${finalInv.paid_amount || 0}`);
  console.log(`  Total amount: $${finalInv.amount}`);

  if (finalInv.status === 'paid' && parseFloat(finalInv.paid_amount) >= parseFloat(finalInv.amount) - 0.01) {
    console.log('\n✓ SUCCESS: Invoice fully paid!');
  } else if (finalInv.status === 'paid') {
    console.log(`\n✓ Invoice marked as paid (paid: $${finalInv.paid_amount} of $${finalInv.amount})`);
  } else {
    console.log(`\n? Invoice status: ${finalInv.status}`);
  }

  console.log('\n=== TEST COMPLETE ===\n');
});

test('Draw flow - partial allocation should kick back', async ({ page }) => {
  const baseUrl = 'http://localhost:3001';

  console.log('\n=== PARTIAL ALLOCATION KICKBACK TEST ===\n');

  // Get an approved invoice with no prior payments
  console.log('Step 1: Get the Smartshield invoice (INV-105472)');
  const invRes = await page.request.get(`${baseUrl}/api/invoices/a0ee78ef-118d-47fe-a4b6-dcdf767159dd`);
  const invoice = await invRes.json();
  console.log(`  Invoice: ${invoice.invoice_number}`);
  console.log(`  Status: ${invoice.status}`);
  console.log(`  Amount: $${invoice.amount}`);
  console.log(`  Paid: $${invoice.paid_amount || 0}`);
  console.log(`  Current allocations: ${invoice.allocations?.length || 0}`);

  if (invoice.status !== 'needs_approval' && invoice.status !== 'approved') {
    console.log('  Skipping - invoice not in correct state for test');
    return;
  }

  // Allocate only partial amount
  console.log('\nStep 2: Set partial allocation ($2000 of $2845.84)');
  const allocRes = await page.request.post(`${baseUrl}/api/invoices/${invoice.id}/allocate`, {
    data: {
      allocations: [{
        cost_code_id: '62d2bddd-8e38-42a0-b918-a122e15c2ba6', // Electrical Labor
        amount: 2000,
        notes: 'Partial billing'
      }]
    }
  });
  console.log(`  Allocation result: ${allocRes.ok() ? 'Success' : 'Failed'}`);

  // Approve invoice
  console.log('\nStep 3: Approve invoice');
  const approveRes = await page.request.patch(`${baseUrl}/api/invoices/${invoice.id}/approve`, {
    data: { approved_by: 'Test User' }
  });
  console.log(`  Approval result: ${approveRes.ok() ? 'Success' : 'Failed'}`);

  // Create draw
  console.log('\nStep 4: Create new draw');
  const jobId = 'd8a914c9-b861-4a4f-b888-75887b1570c4';
  const createDrawRes = await page.request.post(`${baseUrl}/api/jobs/${jobId}/draws`, {
    data: { period_end: '2026-01-31' }
  });
  const newDraw = await createDrawRes.json();
  console.log(`  Created Draw #${newDraw.draw_number}`);

  // Add invoice to draw
  console.log('\nStep 5: Add invoice to draw');
  const addRes = await page.request.post(`${baseUrl}/api/draws/${newDraw.id}/add-invoices`, {
    data: { invoice_ids: [invoice.id] }
  });
  const addResult = await addRes.json();
  console.log(`  Draw total: $${addResult.draw?.total_amount || 'N/A'} (should be $2000, not $2845.84)`);

  // Submit draw - this should kick back the partial
  console.log('\nStep 6: Submit draw (should kick back partial)');
  const submitRes = await page.request.patch(`${baseUrl}/api/draws/${newDraw.id}/submit`);
  const submittedDraw = await submitRes.json();
  console.log(`  Draw status: ${submittedDraw.status}`);

  // Check invoice status
  const afterSubmit = await page.request.get(`${baseUrl}/api/invoices/${invoice.id}`);
  const submittedInv = await afterSubmit.json();
  console.log(`  Invoice status after submit: ${submittedInv.status}`);
  console.log(`  Invoice billed_amount: $${submittedInv.billed_amount || 0}`);
  console.log(`  Allocations remaining: ${submittedInv.allocations?.length || 0}`);

  if (submittedInv.status === 'needs_approval') {
    console.log('\n✓ SUCCESS: Partial invoice correctly kicked back to needs_approval');
  } else {
    console.log(`\n? Invoice status: ${submittedInv.status} (expected needs_approval)`);
  }

  console.log('\n=== TEST COMPLETE ===\n');
});

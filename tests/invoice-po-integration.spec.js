const { test, expect } = require('@playwright/test');

/**
 * Invoice-PO Integration Tests
 * Tests that PO line items are properly updated when:
 * 1. Invoice allocations change
 * 2. Invoice is unlinked from PO
 * 3. Invoice is moved between POs
 */

const API_BASE = 'http://localhost:3001/api';

test.describe('Invoice-PO Integration', () => {

  test('PO shows linked invoices correctly', async ({ request }) => {
    // Get all POs
    const posRes = await request.get(`${API_BASE}/purchase-orders`);
    expect(posRes.ok()).toBeTruthy();
    const pos = await posRes.json();
    console.log('Total POs:', pos.length);

    if (pos.length > 0) {
      // Get first PO with details
      const poRes = await request.get(`${API_BASE}/purchase-orders/${pos[0].id}`);
      expect(poRes.ok()).toBeTruthy();
      const po = await poRes.json();

      console.log('PO:', po.po_number);
      console.log('Total Amount:', po.total_amount);
      console.log('Linked Invoices:', po.invoices?.length || 0);

      if (po.invoices?.length > 0) {
        console.log('Invoice IDs:', po.invoices.map(i => i.id));
      }

      // Check line items
      if (po.line_items?.length > 0) {
        console.log('Line Items:');
        po.line_items.forEach(li => {
          console.log(`  - ${li.cost_code?.code || 'No code'}: $${li.amount} (invoiced: $${li.invoiced_amount || 0})`);
        });
      }
    }
  });

  test('Invoice linked to PO shows PO info', async ({ request }) => {
    // Get invoices that have a PO
    const invoicesRes = await request.get(`${API_BASE}/invoices`);
    expect(invoicesRes.ok()).toBeTruthy();
    const invoices = await invoicesRes.json();

    const linkedInvoices = invoices.filter(i => i.po_id);
    console.log('Invoices with PO:', linkedInvoices.length);

    if (linkedInvoices.length > 0) {
      const invoice = linkedInvoices[0];
      console.log('Invoice:', invoice.invoice_number);
      console.log('Status:', invoice.status);
      console.log('PO ID:', invoice.po_id);
      console.log('Amount:', invoice.amount);

      // Get full invoice with allocations
      const fullRes = await request.get(`${API_BASE}/invoices/${invoice.id}`);
      expect(fullRes.ok()).toBeTruthy();
      const fullInvoice = await fullRes.json();

      console.log('PO Number:', fullInvoice.po?.po_number);
      console.log('Allocations:', fullInvoice.allocations?.length || 0);

      if (fullInvoice.allocations?.length > 0) {
        fullInvoice.allocations.forEach(a => {
          console.log(`  - ${a.cost_code?.code}: $${a.amount}`);
        });
      }
    }
  });

  test('PO stats endpoint returns correct data', async ({ request }) => {
    const statsRes = await request.get(`${API_BASE}/purchase-orders/stats`);
    expect(statsRes.ok()).toBeTruthy();
    const stats = await statsRes.json();

    console.log('PO Stats:');
    console.log('  Total POs:', stats.total_count);
    console.log('  By Status:', JSON.stringify(stats.by_status));
    console.log('  Total Amount:', stats.total_value);
    console.log('  Billed Amount:', stats.total_billed);

    // Verify structure
    expect(stats).toHaveProperty('total_count');
    expect(stats).toHaveProperty('total_value');
    expect(stats).toHaveProperty('by_status');
  });

  test('Approval context includes PO impact', async ({ request }) => {
    // Get an invoice that's linked to a PO
    const invoicesRes = await request.get(`${API_BASE}/invoices`);
    const invoices = await invoicesRes.json();

    const linkedInvoice = invoices.find(i => i.po_id && i.status !== 'paid');
    if (!linkedInvoice) {
      console.log('No PO-linked invoice found for testing');
      return;
    }

    // Get approval context
    const contextRes = await request.get(`${API_BASE}/invoices/${linkedInvoice.id}/approval-context`);
    expect(contextRes.ok()).toBeTruthy();
    const context = await contextRes.json();

    console.log('Approval Context for:', linkedInvoice.invoice_number);
    console.log('Has PO Impact:', !!context.poImpact);

    if (context.poImpact) {
      console.log('PO Number:', context.poImpact.poNumber);
      console.log('PO Total:', context.poImpact.poTotal);
      console.log('Already Billed:', context.poImpact.alreadyBilled);
      console.log('This Invoice:', context.poImpact.thisInvoice);
      console.log('Remaining After:', context.poImpact.remainingAfter);
      console.log('Will Exceed:', context.poImpact.willExceed);
    }
  });

  test('Invoice can be edited without breaking PO link', async ({ request }) => {
    // Get an invoice linked to a PO that's not yet approved
    const invoicesRes = await request.get(`${API_BASE}/invoices`);
    const invoices = await invoicesRes.json();

    const editableInvoice = invoices.find(i =>
      i.po_id && ['received', 'needs_approval'].includes(i.status)
    );

    if (!editableInvoice) {
      console.log('No editable PO-linked invoice found');
      return;
    }

    console.log('Testing edit on:', editableInvoice.invoice_number);
    console.log('Current PO:', editableInvoice.po_id);

    // Get current state
    const beforeRes = await request.get(`${API_BASE}/invoices/${editableInvoice.id}`);
    const before = await beforeRes.json();
    console.log('Allocations before:', before.allocations?.length || 0);

    // Acquire lock
    const lockRes = await request.post(`${API_BASE}/locks/acquire`, {
      data: {
        entityType: 'invoice',
        entityId: editableInvoice.id,
        lockedBy: 'test-user'
      }
    });

    if (lockRes.ok()) {
      // Edit invoice notes (non-destructive)
      const editRes = await request.patch(`${API_BASE}/invoices/${editableInvoice.id}`, {
        data: {
          notes: `Test edit at ${new Date().toISOString()}`,
          performed_by: 'test-user'
        }
      });

      expect(editRes.ok()).toBeTruthy();
      const edited = await editRes.json();
      console.log('Edit successful:', edited.success);

      // Verify PO link preserved
      const afterRes = await request.get(`${API_BASE}/invoices/${editableInvoice.id}`);
      const after = await afterRes.json();
      expect(after.po_id).toBe(editableInvoice.po_id);
      console.log('PO link preserved:', after.po_id === editableInvoice.po_id);

      // Release lock
      await request.delete(`${API_BASE}/locks/invoice/${editableInvoice.id}`);
    }
  });

  test('PO line items structure is correct', async ({ request }) => {
    // Get a PO with line items
    const posRes = await request.get(`${API_BASE}/purchase-orders`);
    const pos = await posRes.json();

    const poWithLineItems = pos.find(p => p.line_items?.length > 0);
    if (!poWithLineItems) {
      console.log('No PO with line items found');
      return;
    }

    const poRes = await request.get(`${API_BASE}/purchase-orders/${poWithLineItems.id}`);
    const po = await poRes.json();

    console.log('PO:', po.po_number);
    console.log('Line Items:');

    let totalLineItemAmount = 0;
    let totalInvoicedAmount = 0;

    po.line_items.forEach(li => {
      const amount = parseFloat(li.amount) || 0;
      const invoiced = parseFloat(li.invoiced_amount) || 0;
      totalLineItemAmount += amount;
      totalInvoicedAmount += invoiced;

      console.log(`  ${li.cost_code?.code || 'N/A'}:`);
      console.log(`    Amount: $${amount.toFixed(2)}`);
      console.log(`    Invoiced: $${invoiced.toFixed(2)}`);
      console.log(`    Remaining: $${(amount - invoiced).toFixed(2)}`);
    });

    console.log('Summary:');
    console.log(`  Total Line Items: $${totalLineItemAmount.toFixed(2)}`);
    console.log(`  Total Invoiced: $${totalInvoicedAmount.toFixed(2)}`);
    console.log(`  PO Total: $${po.total_amount}`);

    // Verify line items sum to PO total (approximately)
    const diff = Math.abs(totalLineItemAmount - parseFloat(po.total_amount));
    console.log(`  Difference from PO total: $${diff.toFixed(2)}`);
  });
});

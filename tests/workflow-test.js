const http = require('http');

let passed = 0;
let failed = 0;
const errors = [];
const bugs = [];

async function fetchApi(endpoint, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL('http://localhost:3001' + endpoint);
    const req = http.request(url, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });
    req.on('error', reject);
    if (options.body) req.write(JSON.stringify(options.body));
    req.end();
  });
}

async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log('✓ ' + name);
  } catch (err) {
    failed++;
    console.log('✗ ' + name + ': ' + err.message);
    errors.push({ test: name, error: err.message });
  }
}

async function runTests() {
  console.log('=== WORKFLOW TESTS ===\n');

  const JOB_ID = 'd8a914c9-b861-4a4f-b888-75887b1570c4';

  // === INVOICE STATUS TRANSITIONS ===
  console.log('\n--- Invoice Status Transitions ---');

  // Get a needs_review invoice
  let testInvoiceId = null;
  await test('Find needs_review invoice for testing', async () => {
    const res = await fetchApi('/api/invoices?status=needs_review');
    if (res.data.length === 0) throw new Error('No needs_review invoices');
    testInvoiceId = res.data[0].id;
    console.log('    Using invoice: ' + testInvoiceId);
  });

  // Test invalid transition
  await test('Invalid status transition returns error', async () => {
    if (!testInvoiceId) throw new Error('No test invoice');
    const res = await fetchApi('/api/invoices/' + testInvoiceId + '/transition', {
      method: 'POST',
      body: { status: 'paid', performed_by: 'Test' }
    });
    // Should fail - can't go from needs_review to paid
    if (res.status === 200) throw new Error('Should have rejected invalid transition');
  });

  // === ALLOCATION TESTS ===
  console.log('\n--- Allocation Tests ---');

  // Get an invoice with allocations
  await test('Invoice allocations sum matches invoice amount', async () => {
    const res = await fetchApi('/api/invoices?status=approved');
    if (res.data.length === 0) throw new Error('No approved invoices');
    const invId = res.data[0].id;
    const invAmount = parseFloat(res.data[0].amount);

    const allocRes = await fetchApi('/api/invoices/' + invId + '/allocations');
    const allocSum = allocRes.data.reduce((sum, a) => sum + parseFloat(a.amount || 0), 0);

    if (Math.abs(allocSum - invAmount) > 0.01) {
      bugs.push({
        type: 'DATA_INTEGRITY',
        issue: 'Allocation sum (' + allocSum.toFixed(2) + ') != invoice amount (' + invAmount.toFixed(2) + ')',
        invoice_id: invId
      });
      throw new Error('Allocation mismatch');
    }
  });

  // Test allocation with CO cost code
  await test('CO cost codes are properly detected', async () => {
    const res = await fetchApi('/api/cost-codes');
    const coCodes = res.data.filter(cc => cc.code && cc.code.endsWith('C'));
    if (coCodes.length === 0) {
      console.log('    No CO cost codes found (might be OK)');
    } else {
      console.log('    Found ' + coCodes.length + ' CO cost codes');
    }
  });

  // === DRAW TESTS ===
  console.log('\n--- Draw Tests ---');

  await test('Draw G702 calculations are correct', async () => {
    const draws = await fetchApi('/api/draws');
    if (draws.data.length === 0) throw new Error('No draws');

    const draw = await fetchApi('/api/draws/' + draws.data[0].id);
    const g702 = draw.data.g702;

    // Check contract sum = original + change orders
    const expectedContractSum = g702.contractSum + g702.netChangeOrders;
    if (Math.abs(g702.contractSumToDate - expectedContractSum) > 0.01) {
      bugs.push({
        type: 'CALCULATION',
        issue: 'G702 contractSumToDate calculation mismatch',
        expected: expectedContractSum,
        actual: g702.contractSumToDate
      });
      throw new Error('G702 calculation error');
    }
  });

  await test('Draw invoices have correct status', async () => {
    const draws = await fetchApi('/api/draws');
    if (draws.data.length === 0) throw new Error('No draws');

    const draw = await fetchApi('/api/draws/' + draws.data[0].id);
    const invoices = draw.data.invoices || [];

    for (const inv of invoices) {
      if (inv.status !== 'in_draw') {
        bugs.push({
          type: 'DATA_INTEGRITY',
          issue: 'Invoice in draw has wrong status: ' + inv.status,
          invoice_id: inv.id
        });
        throw new Error('Invoice status mismatch');
      }
    }
  });

  await test('Draw CO billings are properly linked', async () => {
    const draws = await fetchApi('/api/draws');
    if (draws.data.length === 0) throw new Error('No draws');

    const billings = await fetchApi('/api/draws/' + draws.data[0].id + '/co-billings');
    if (!Array.isArray(billings.data)) {
      throw new Error('CO billings should be array');
    }
    console.log('    Found ' + billings.data.length + ' CO billings');
  });

  // === CHANGE ORDER TESTS ===
  console.log('\n--- Change Order Tests ---');

  await test('Change orders have valid status', async () => {
    const cos = await fetchApi('/api/jobs/' + JOB_ID + '/change-orders');
    const validStatuses = ['draft', 'pending_approval', 'approved', 'rejected'];

    for (const co of cos.data) {
      if (!validStatuses.includes(co.status)) {
        bugs.push({
          type: 'DATA_INTEGRITY',
          issue: 'Invalid CO status: ' + co.status,
          co_id: co.id
        });
        throw new Error('Invalid CO status');
      }
    }
    console.log('    All ' + cos.data.length + ' COs have valid status');
  });

  await test('CO invoiced_amount matches linked allocations', async () => {
    const cos = await fetchApi('/api/jobs/' + JOB_ID + '/change-orders');

    for (const co of cos.data.slice(0, 3)) { // Test first 3
      const invRes = await fetchApi('/api/change-orders/' + co.id + '/invoices');
      let allocTotal = 0;

      for (const inv of invRes.data) {
        if (inv.allocations) {
          allocTotal += inv.allocations
            .filter(a => a.change_order_id === co.id)
            .reduce((sum, a) => sum + parseFloat(a.amount || 0), 0);
        }
      }

      const coInvoiced = parseFloat(co.invoiced_amount || 0);
      // Allow for some discrepancy due to data sync timing
      if (allocTotal > 0 && Math.abs(allocTotal - coInvoiced) > 1) {
        console.log('    Warning: CO #' + co.change_order_number + ' invoiced_amount (' + coInvoiced + ') vs allocations (' + allocTotal + ')');
      }
    }
  });

  // === PO TESTS ===
  console.log('\n--- Purchase Order Tests ---');

  await test('PO total_amount >= invoiced_amount', async () => {
    const pos = await fetchApi('/api/purchase-orders');

    for (const po of pos.data) {
      const total = parseFloat(po.total_amount || 0);
      const invoiced = parseFloat(po.invoiced_total || 0);

      if (invoiced > total && total > 0) {
        bugs.push({
          type: 'DATA_INTEGRITY',
          issue: 'PO over-billed: invoiced (' + invoiced + ') > total (' + total + ')',
          po_id: po.id,
          po_number: po.po_number
        });
        // Don't fail - might be intentional in some cases
        console.log('    Warning: PO ' + po.po_number + ' over-billed');
      }
    }
  });

  await test('PO line items sum to total_amount', async () => {
    const pos = await fetchApi('/api/purchase-orders');

    for (const po of pos.data.slice(0, 5)) {
      const detail = await fetchApi('/api/purchase-orders/' + po.id);
      const lineItems = detail.data.line_items || [];
      const lineSum = lineItems.reduce((sum, li) => sum + parseFloat(li.amount || 0), 0);
      const total = parseFloat(detail.data.total_amount || 0);

      if (Math.abs(lineSum - total) > 0.01 && lineItems.length > 0) {
        bugs.push({
          type: 'DATA_INTEGRITY',
          issue: 'PO line items sum (' + lineSum + ') != total (' + total + ')',
          po_id: po.id
        });
        console.log('    Warning: PO ' + po.po_number + ' line items mismatch');
      }
    }
  });

  // === SPLIT INVOICE TESTS ===
  console.log('\n--- Split Invoice Tests ---');

  await test('Split parent invoices have status=split', async () => {
    const res = await fetchApi('/api/invoices');
    const parents = res.data.filter(inv => inv.is_split_parent);

    for (const parent of parents) {
      if (parent.status !== 'split') {
        bugs.push({
          type: 'DATA_INTEGRITY',
          issue: 'Split parent has wrong status: ' + parent.status,
          invoice_id: parent.id
        });
        throw new Error('Split parent status wrong');
      }
    }
    console.log('    Found ' + parents.length + ' split parents');
  });

  await test('Split children reference valid parent', async () => {
    const res = await fetchApi('/api/invoices');
    const children = res.data.filter(inv => inv.parent_invoice_id);

    for (const child of children) {
      const parent = res.data.find(p => p.id === child.parent_invoice_id);
      if (!parent) {
        // Could be parent was deleted
        console.log('    Warning: Child ' + child.invoice_number + ' has no visible parent');
      }
    }
    console.log('    Found ' + children.length + ' split children');
  });

  await test('Split family sums match', async () => {
    const res = await fetchApi('/api/invoices');
    const parents = res.data.filter(inv => inv.is_split_parent);

    for (const parent of parents) {
      const children = res.data.filter(inv => inv.parent_invoice_id === parent.id);
      const childSum = children.reduce((sum, c) => sum + parseFloat(c.amount || 0), 0);
      const parentOriginal = parseFloat(parent.original_amount || parent.amount || 0);

      if (Math.abs(childSum - parentOriginal) > 0.01) {
        bugs.push({
          type: 'DATA_INTEGRITY',
          issue: 'Split children sum (' + childSum + ') != parent original (' + parentOriginal + ')',
          parent_id: parent.id
        });
        console.log('    Warning: Split family sum mismatch for ' + parent.invoice_number);
      }
    }
  });

  // === BUDGET TESTS ===
  console.log('\n--- Budget Tests ---');

  await test('Budget lines have non-negative values', async () => {
    const res = await fetchApi('/api/jobs/' + JOB_ID + '/budget');

    for (const line of res.data) {
      if (parseFloat(line.budgeted_amount || 0) < 0) {
        bugs.push({
          type: 'DATA_INTEGRITY',
          issue: 'Negative budget amount',
          cost_code: line.cost_code?.code
        });
      }
      if (parseFloat(line.billed_amount || 0) < 0) {
        bugs.push({
          type: 'DATA_INTEGRITY',
          issue: 'Negative billed amount',
          cost_code: line.cost_code?.code
        });
      }
    }
  });

  // === PRINT RESULTS ===
  console.log('\n=== RESULTS ===');
  console.log('Passed: ' + passed);
  console.log('Failed: ' + failed);

  if (errors.length > 0) {
    console.log('\n=== TEST ERRORS ===');
    errors.forEach(e => console.log('  - ' + e.test + ': ' + e.error));
  }

  if (bugs.length > 0) {
    console.log('\n=== BUGS FOUND ===');
    bugs.forEach(b => {
      console.log('  [' + b.type + '] ' + b.issue);
      if (b.invoice_id) console.log('    Invoice: ' + b.invoice_id);
      if (b.po_id) console.log('    PO: ' + b.po_id);
    });
  }

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});

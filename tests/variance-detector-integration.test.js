/**
 * Integration Tests for Variance Detection
 *
 * Tests the full detectVariances function with realistic scenarios
 * Uses actual database queries to test end-to-end flows
 */

const { supabase } = require('../config');
const { detectVariances } = require('../server/services/varianceDetector');

// Test results tracking
const results = {
  passed: 0,
  failed: 0,
  skipped: 0,
  failures: []
};

async function test(name, fn) {
  try {
    await fn();
    results.passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    if (err.message === 'SKIP') {
      results.skipped++;
      console.log(`  ⊘ ${name} (skipped)`);
    } else {
      results.failed++;
      results.failures.push({ name, error: err.message });
      console.log(`  ✗ ${name}`);
      console.log(`    Error: ${err.message}`);
    }
  }
}

function assertEqual(actual, expected, msg = '') {
  if (actual !== expected) {
    throw new Error(`${msg} Expected ${expected}, got ${actual}`);
  }
}

function assertTrue(value, msg = '') {
  if (!value) {
    throw new Error(`${msg} Expected true, got ${value}`);
  }
}

function assertGreaterThan(actual, threshold, msg = '') {
  if (actual <= threshold) {
    throw new Error(`${msg} Expected > ${threshold}, got ${actual}`);
  }
}

function skip(reason) {
  throw new Error('SKIP');
}

// ============================================================================
// TEST DATA SETUP
// ============================================================================

async function getTestInvoice() {
  // Get a real invoice with PO for testing
  const { data } = await supabase
    .from('v2_invoices')
    .select('*')
    .not('po_id', 'is', null)
    .not('ai_extracted_data', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  return data;
}

async function getInvoiceWithoutPO() {
  const { data } = await supabase
    .from('v2_invoices')
    .select('*')
    .is('po_id', null)
    .not('ai_extracted_data', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  return data;
}

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

async function runTests() {
  console.log('\n=== INTEGRATION: Invoice with PO ===\n');

  await test('detectVariances returns valid structure', async () => {
    const invoice = await getTestInvoice();
    if (!invoice) skip('No test invoice with PO available');

    const result = await detectVariances(invoice);

    // Check result structure
    assertTrue(typeof result.hasVariances === 'boolean', 'hasVariances should be boolean');
    assertTrue(Array.isArray(result.warnings), 'warnings should be array');
    assertTrue(typeof result.details === 'object', 'details should be object');
    assertTrue(typeof result.details.poTotal === 'number', 'poTotal should be number');
    assertTrue(typeof result.details.invoiceAmount === 'number', 'invoiceAmount should be number');
  });

  await test('detectVariances includes summary', async () => {
    const invoice = await getTestInvoice();
    if (!invoice) skip('No test invoice with PO available');

    const result = await detectVariances(invoice);

    assertTrue(result.summary !== undefined, 'Should have summary');
    assertTrue(typeof result.summary.totalLineItems === 'number', 'totalLineItems should be number');
    assertTrue(typeof result.summary.matchedToPO === 'number', 'matchedToPO should be number');
    assertTrue(typeof result.summary.unmatched === 'number', 'unmatched should be number');
    assertTrue(typeof result.summary.overallStatus === 'string', 'overallStatus should be string');
    assertTrue(typeof result.summary.statusMessage === 'string', 'statusMessage should be string');
  });

  await test('detectVariances tracks matched items', async () => {
    const invoice = await getTestInvoice();
    if (!invoice) skip('No test invoice with PO available');

    const result = await detectVariances(invoice);

    assertTrue(Array.isArray(result.details.matchedItems), 'matchedItems should be array');
    if (result.details.matchedItems.length > 0) {
      const matched = result.details.matchedItems[0];
      assertTrue(matched.invoiceDescription !== undefined, 'Should have invoiceDescription');
      assertTrue(matched.invoiceAmount !== undefined, 'Should have invoiceAmount');
    }
  });

  await test('detectVariances tracks unmatched items', async () => {
    const invoice = await getTestInvoice();
    if (!invoice) skip('No test invoice with PO available');

    const result = await detectVariances(invoice);

    assertTrue(Array.isArray(result.details.unmatchedItems), 'unmatchedItems should be array');
    // Unmatched items (if any) should have the right structure
    for (const item of result.details.unmatchedItems) {
      assertTrue(item.description !== undefined, 'Unmatched item should have description');
      assertTrue(item.amount !== undefined, 'Unmatched item should have amount');
    }
  });

  console.log('\n=== INTEGRATION: Invoice without PO ===\n');

  await test('detectVariances handles invoice without PO', async () => {
    const invoice = await getInvoiceWithoutPO();
    if (!invoice) skip('No test invoice without PO available');

    const result = await detectVariances(invoice);

    // Should return basic structure without PO-specific data
    assertTrue(typeof result.hasVariances === 'boolean', 'hasVariances should be boolean');
    assertTrue(Array.isArray(result.warnings), 'warnings should be array');
    assertEqual(result.details.poTotal, 0, 'poTotal should be 0 without PO');
  });

  console.log('\n=== INTEGRATION: Synthetic Invoice Tests ===\n');

  await test('Synthetic: All items match PO', async () => {
    // Create a synthetic invoice that perfectly matches a PO
    const { data: po } = await supabase
      .from('v2_purchase_orders')
      .select('id, line_items:v2_po_line_items(title, amount)')
      .is('deleted_at', null)
      .eq('status', 'open')
      .limit(1)
      .single();

    if (!po || !po.line_items || po.line_items.length === 0) {
      skip('No PO with line items available');
    }

    // Create synthetic invoice with matching items
    const syntheticInvoice = {
      id: 'test-id',
      po_id: po.id,
      amount: po.line_items.reduce((sum, li) => sum + parseFloat(li.amount), 0),
      ai_extracted_data: {
        line_items: po.line_items.map(li => ({
          description: li.title,
          amount: li.amount
        }))
      }
    };

    const result = await detectVariances(syntheticInvoice);

    // All items should match
    assertEqual(result.summary.unmatched, 0, 'All items should match');
    assertEqual(result.summary.matchedToPO, po.line_items.length, 'All should match to PO');
  });

  await test('Synthetic: Extra work item is flagged', async () => {
    const { data: po } = await supabase
      .from('v2_purchase_orders')
      .select('id, total_amount, line_items:v2_po_line_items(title, amount)')
      .is('deleted_at', null)
      .eq('status', 'open')
      .limit(1)
      .single();

    if (!po) skip('No open PO available');

    // Create synthetic invoice with an extra change order item
    const syntheticInvoice = {
      id: 'test-id',
      po_id: po.id,
      amount: 5000,
      ai_extracted_data: {
        line_items: [
          { description: 'Change Order - Extra framing work', amount: 5000 }
        ]
      }
    };

    const result = await detectVariances(syntheticInvoice);

    // The change order item should be unmatched
    assertEqual(result.summary.unmatched, 1, 'Change order should be unmatched');
    assertTrue(result.hasVariances, 'Should have variances');

    // Check warning type
    const coWarning = result.warnings.find(w => w.type === 'change_order_not_in_po');
    assertTrue(coWarning !== undefined, 'Should have change_order_not_in_po warning');
  });

  await test('Synthetic: Credit item is flagged', async () => {
    const { data: po } = await supabase
      .from('v2_purchase_orders')
      .select('id')
      .is('deleted_at', null)
      .eq('status', 'open')
      .limit(1)
      .single();

    if (!po) skip('No open PO available');

    const syntheticInvoice = {
      id: 'test-id',
      po_id: po.id,
      amount: -1500,
      ai_extracted_data: {
        line_items: [
          { description: 'Credit - Deleted scope item', amount: -1500 }
        ]
      }
    };

    const result = await detectVariances(syntheticInvoice);

    assertEqual(result.summary.unmatched, 1, 'Credit should be unmatched');
    assertTrue(result.hasVariances, 'Should have variances');

    // Check it detected as credit
    const unmatchedItem = result.details.unmatchedItems[0];
    assertTrue(unmatchedItem.isCredit, 'Should be flagged as credit');
  });

  await test('Synthetic: Over budget is detected', async () => {
    const { data: po } = await supabase
      .from('v2_purchase_orders')
      .select('id, total_amount')
      .is('deleted_at', null)
      .eq('status', 'open')
      .limit(1)
      .single();

    if (!po) skip('No open PO available');

    // Create invoice that exceeds PO total
    const overAmount = parseFloat(po.total_amount) + 10000;
    const syntheticInvoice = {
      id: 'test-id',
      po_id: po.id,
      amount: overAmount,
      ai_extracted_data: {
        line_items: [
          { description: 'Large billing', amount: overAmount }
        ]
      }
    };

    const result = await detectVariances(syntheticInvoice);

    assertTrue(result.hasVariances, 'Should have variances');

    // Should have over_budget or exceeds_po_total warning
    const overWarning = result.warnings.find(
      w => w.type === 'over_budget' || w.type === 'exceeds_po_total'
    );
    assertTrue(overWarning !== undefined, 'Should have budget warning');
    assertEqual(overWarning.severity, 'high', 'Should be high severity');
  });

  console.log('\n=== INTEGRATION: Change Order Matching ===\n');

  await test('Item matching approved CO is not flagged', async () => {
    // Find a PO with an approved change order
    const { data: cos } = await supabase
      .from('v2_change_orders')
      .select('id, po_id, description, amount_change')
      .eq('status', 'approved')
      .limit(1)
      .single();

    if (!cos) skip('No approved change orders available');

    // Create invoice with line item matching the CO
    const syntheticInvoice = {
      id: 'test-id',
      po_id: cos.po_id,
      amount: cos.amount_change,
      ai_extracted_data: {
        line_items: [
          { description: cos.description, amount: cos.amount_change }
        ]
      }
    };

    const result = await detectVariances(syntheticInvoice);

    // Should match to CO, not be flagged as unmatched
    const matchedToCO = result.details.matchedItems.find(m => m.matchedTo === 'change_order');
    assertTrue(matchedToCO !== undefined, 'Should match to change_order');
    assertEqual(result.summary.unmatchedItems?.length || 0, 0, 'Should not have unmatched items');
  });

  console.log('\n=== INTEGRATION: VPO Matching ===\n');

  await test('Item matching approved VPO is not flagged', async () => {
    // Find a PO with an approved VPO
    const { data: vpo } = await supabase
      .from('v2_verbal_purchase_orders')
      .select('id, po_id, description, amount')
      .eq('status', 'approved')
      .limit(1)
      .single();

    if (!vpo) skip('No approved VPOs available');

    // Create invoice with line item matching the VPO
    const syntheticInvoice = {
      id: 'test-id',
      po_id: vpo.po_id,
      amount: vpo.amount,
      ai_extracted_data: {
        line_items: [
          { description: vpo.description, amount: vpo.amount }
        ]
      }
    };

    const result = await detectVariances(syntheticInvoice);

    // Should match to VPO, not be flagged as unmatched
    const matchedToVPO = result.details.matchedItems.find(m => m.matchedTo === 'vpo');
    assertTrue(matchedToVPO !== undefined, 'Should match to VPO');
  });

  console.log('\n=== INTEGRATION: Warning Message Quality ===\n');

  await test('Unmatched item warnings have suggested actions', async () => {
    const { data: po } = await supabase
      .from('v2_purchase_orders')
      .select('id')
      .is('deleted_at', null)
      .eq('status', 'open')
      .limit(1)
      .single();

    if (!po) skip('No open PO available');

    const syntheticInvoice = {
      id: 'test-id',
      po_id: po.id,
      amount: 3000,
      ai_extracted_data: {
        line_items: [
          { description: 'Change Order - New work added', amount: 3000 }
        ]
      }
    };

    const result = await detectVariances(syntheticInvoice);

    // Find the warning for this item
    const warning = result.warnings.find(w => w.type.includes('not_in'));
    assertTrue(warning !== undefined, 'Should have not_in warning');
    assertTrue(warning.suggestedAction !== undefined, 'Should have suggestedAction');
    assertTrue(warning.suggestedAction.length > 0, 'suggestedAction should not be empty');
  });

  await test('Summary status message is descriptive', async () => {
    const { data: po } = await supabase
      .from('v2_purchase_orders')
      .select('id')
      .is('deleted_at', null)
      .eq('status', 'open')
      .limit(1)
      .single();

    if (!po) skip('No open PO available');

    // Invoice with unmatched items
    const syntheticInvoice = {
      id: 'test-id',
      po_id: po.id,
      amount: 5000,
      ai_extracted_data: {
        line_items: [
          { description: 'Extra work - owner requested upgrade', amount: 5000 }
        ]
      }
    };

    const result = await detectVariances(syntheticInvoice);

    assertTrue(result.summary.statusMessage.length > 20, 'Status message should be descriptive');
    // Should mention the number of items requiring action
    if (result.summary.unmatched > 0) {
      assertTrue(
        result.summary.statusMessage.includes('require action') ||
        result.summary.statusMessage.includes('NOT in PO'),
        'Should mention action required'
      );
    }
  });

  // ============================================================================
  // SUMMARY
  // ============================================================================
  console.log('\n' + '='.repeat(60));
  console.log('INTEGRATION TEST RESULTS');
  console.log('='.repeat(60));
  console.log(`\nPassed:  ${results.passed}`);
  console.log(`Failed:  ${results.failed}`);
  console.log(`Skipped: ${results.skipped}`);
  console.log(`Total:   ${results.passed + results.failed + results.skipped}`);

  if (results.failures.length > 0) {
    console.log('\nFailed Tests:');
    for (const f of results.failures) {
      console.log(`  - ${f.name}: ${f.error}`);
    }
  }

  console.log('\n');
  process.exit(results.failed > 0 ? 1 : 0);
}

runTests();

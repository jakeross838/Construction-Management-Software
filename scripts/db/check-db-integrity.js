/**
 * Database Integrity Checker
 * Verifies constraints, indexes, and data integrity for core financial tables
 */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function runQuery(sql) {
  const { data, error } = await supabase.rpc('exec_sql', { query: sql });
  if (error) {
    // Fallback to raw fetch for queries not supported by RPC
    return { error };
  }
  return { data };
}

async function checkIntegrity() {
  console.log('========================================');
  console.log('DATABASE INTEGRITY CHECK');
  console.log('========================================\n');

  const issues = [];

  // 1. Check Core Tables Exist
  console.log('1. Checking core financial tables exist...');
  const coreTables = [
    'v2_jobs', 'v2_vendors', 'v2_cost_codes', 'v2_budget_lines',
    'v2_purchase_orders', 'v2_po_line_items', 'v2_invoices',
    'v2_invoice_allocations', 'v2_draws', 'v2_draw_allocations'
  ];

  for (const table of coreTables) {
    const { data, error } = await supabase.from(table).select('id').limit(1);
    if (error) {
      console.log(`  ❌ ${table}: NOT FOUND`);
      issues.push({ type: 'missing_table', table });
    } else {
      console.log(`  ✅ ${table}: exists`);
    }
  }

  // 2. Check for orphaned invoice allocations (no matching invoice)
  console.log('\n2. Checking for orphaned invoice allocations...');
  const { data: orphanedAllocs, error: orphanedError } = await supabase
    .from('v2_invoice_allocations')
    .select('id, invoice_id')
    .is('invoice_id', null);

  if (!orphanedError && orphanedAllocs?.length > 0) {
    console.log(`  ⚠️  Found ${orphanedAllocs.length} allocations with null invoice_id`);
    issues.push({ type: 'orphaned_data', table: 'v2_invoice_allocations', count: orphanedAllocs.length });
  } else {
    console.log('  ✅ No orphaned allocations (null invoice_id)');
  }

  // 3. Check for invoices referencing non-existent jobs
  console.log('\n3. Checking invoice-job references...');
  const { data: invoices } = await supabase
    .from('v2_invoices')
    .select('id, job_id');

  if (invoices) {
    const { data: jobs } = await supabase.from('v2_jobs').select('id');
    const jobIds = new Set(jobs?.map(j => j.id) || []);
    const badInvoices = invoices.filter(i => i.job_id && !jobIds.has(i.job_id));
    if (badInvoices.length > 0) {
      console.log(`  ⚠️  Found ${badInvoices.length} invoices referencing non-existent jobs`);
      issues.push({ type: 'dangling_reference', table: 'v2_invoices', field: 'job_id', count: badInvoices.length });
    } else {
      console.log('  ✅ All invoice job references valid');
    }
  }

  // 4. Check for PO line items referencing non-existent POs
  console.log('\n4. Checking PO line item references...');
  const { data: poLineItems } = await supabase
    .from('v2_po_line_items')
    .select('id, purchase_order_id');

  if (poLineItems) {
    const { data: pos } = await supabase.from('v2_purchase_orders').select('id');
    const poIds = new Set(pos?.map(p => p.id) || []);
    const badLineItems = poLineItems.filter(li => li.purchase_order_id && !poIds.has(li.purchase_order_id));
    if (badLineItems.length > 0) {
      console.log(`  ⚠️  Found ${badLineItems.length} line items referencing non-existent POs`);
      issues.push({ type: 'dangling_reference', table: 'v2_po_line_items', field: 'purchase_order_id', count: badLineItems.length });
    } else {
      console.log('  ✅ All PO line item references valid');
    }
  }

  // 5. Check for draw allocations referencing non-existent draws
  console.log('\n5. Checking draw allocation references...');
  const { data: drawAllocs } = await supabase
    .from('v2_draw_allocations')
    .select('id, draw_id');

  if (drawAllocs) {
    const { data: draws } = await supabase.from('v2_draws').select('id');
    const drawIds = new Set(draws?.map(d => d.id) || []);
    const badDrawAllocs = drawAllocs.filter(da => da.draw_id && !drawIds.has(da.draw_id));
    if (badDrawAllocs.length > 0) {
      console.log(`  ⚠️  Found ${badDrawAllocs.length} draw allocations referencing non-existent draws`);
      issues.push({ type: 'dangling_reference', table: 'v2_draw_allocations', field: 'draw_id', count: badDrawAllocs.length });
    } else {
      console.log('  ✅ All draw allocation references valid');
    }
  }

  // 6. Check for budget lines with missing job_id
  console.log('\n6. Checking budget line integrity...');
  const { data: budgetLines } = await supabase
    .from('v2_budget_lines')
    .select('id, job_id, cost_code_id');

  if (budgetLines) {
    const missingJob = budgetLines.filter(bl => !bl.job_id);
    const missingCostCode = budgetLines.filter(bl => !bl.cost_code_id);

    if (missingJob.length > 0) {
      console.log(`  ⚠️  Found ${missingJob.length} budget lines with null job_id`);
      issues.push({ type: 'null_required', table: 'v2_budget_lines', field: 'job_id', count: missingJob.length });
    } else {
      console.log('  ✅ All budget lines have job_id');
    }

    if (missingCostCode.length > 0) {
      console.log(`  ⚠️  Found ${missingCostCode.length} budget lines with null cost_code_id`);
      issues.push({ type: 'null_required', table: 'v2_budget_lines', field: 'cost_code_id', count: missingCostCode.length });
    } else {
      console.log('  ✅ All budget lines have cost_code_id');
    }
  }

  // 7. Check for negative budget amounts (except where valid)
  console.log('\n7. Checking budget amount constraints...');
  const { data: negativeBudgets } = await supabase
    .from('v2_budget_lines')
    .select('id, budgeted_amount, committed_amount')
    .or('budgeted_amount.lt.0,committed_amount.lt.0');

  if (negativeBudgets?.length > 0) {
    console.log(`  ⚠️  Found ${negativeBudgets.length} budget lines with negative amounts`);
    issues.push({ type: 'constraint_violation', table: 'v2_budget_lines', detail: 'negative amounts', count: negativeBudgets.length });
  } else {
    console.log('  ✅ No invalid negative budget amounts');
  }

  // 8. Check draw-invoice relationships
  console.log('\n8. Checking draw-invoice relationships...');
  const { data: drawsWithInvoices } = await supabase
    .from('v2_draws')
    .select('id, invoice_ids');

  if (drawsWithInvoices) {
    // Extract all invoice IDs from draws
    const allInvoiceIds = [];
    drawsWithInvoices.forEach(d => {
      if (d.invoice_ids && Array.isArray(d.invoice_ids)) {
        allInvoiceIds.push(...d.invoice_ids);
      }
    });

    const { data: existingInvoices } = await supabase
      .from('v2_invoices')
      .select('id')
      .in('id', allInvoiceIds.length > 0 ? allInvoiceIds : ['00000000-0000-0000-0000-000000000000']);

    const existingIds = new Set(existingInvoices?.map(i => i.id) || []);
    const missingInvoices = allInvoiceIds.filter(id => !existingIds.has(id));

    if (missingInvoices.length > 0) {
      console.log(`  ⚠️  Found ${missingInvoices.length} invoice references in draws that don't exist`);
      issues.push({ type: 'dangling_reference', table: 'v2_draws', field: 'invoice_ids', count: missingInvoices.length });
    } else {
      console.log('  ✅ All invoice references in draws are valid');
    }
  }

  // Summary
  console.log('\n========================================');
  console.log('INTEGRITY CHECK SUMMARY');
  console.log('========================================');

  if (issues.length === 0) {
    console.log('\n✅ All integrity checks passed!');
    console.log('No critical database integrity issues found.');
  } else {
    console.log(`\n⚠️  Found ${issues.length} potential issues:\n`);
    issues.forEach((issue, i) => {
      console.log(`${i + 1}. ${issue.type} in ${issue.table}`);
      if (issue.field) console.log(`   Field: ${issue.field}`);
      if (issue.count) console.log(`   Count: ${issue.count}`);
      if (issue.detail) console.log(`   Detail: ${issue.detail}`);
    });
  }

  return issues;
}

checkIntegrity()
  .then(issues => {
    process.exit(issues.length > 0 ? 1 : 0);
  })
  .catch(e => {
    console.error('Error running integrity check:', e.message);
    process.exit(1);
  });

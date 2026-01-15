const { supabase } = require('../config');

const issues = [];

async function checkDataIntegrity() {
  console.log('=== DATA INTEGRITY CHECK ===\n');

  // 1. Invoices in draws that aren't status=in_draw
  console.log('--- Checking invoice-draw status consistency ---');
  const { data: drawInvoices } = await supabase
    .from('v2_draw_invoices')
    .select(`
      id,
      draw_id,
      invoice:v2_invoices(id, invoice_number, status, amount)
    `);

  for (const di of (drawInvoices || [])) {
    if (di.invoice && di.invoice.status !== 'in_draw') {
      issues.push({
        type: 'INVOICE_DRAW_STATUS_MISMATCH',
        issue: `Invoice ${di.invoice.invoice_number} in draw but status=${di.invoice.status}`,
        invoice_id: di.invoice.id,
        draw_id: di.draw_id
      });
    }
  }

  // 2. Invoices where billed_amount > amount
  console.log('--- Checking billed_amount <= amount ---');
  const { data: invoices } = await supabase
    .from('v2_invoices')
    .select('id, invoice_number, amount, billed_amount, paid_amount')
    .is('deleted_at', null);

  for (const inv of (invoices || [])) {
    const amount = parseFloat(inv.amount || 0);
    const billed = parseFloat(inv.billed_amount || 0);
    const paid = parseFloat(inv.paid_amount || 0);

    if (billed > amount + 0.01) {
      issues.push({
        type: 'OVERBILLED',
        issue: `Invoice ${inv.invoice_number}: billed ($${billed}) > amount ($${amount})`,
        invoice_id: inv.id,
        amount,
        billed_amount: billed
      });
    }

    if (paid > amount + 0.01) {
      issues.push({
        type: 'OVERPAID',
        issue: `Invoice ${inv.invoice_number}: paid ($${paid}) > amount ($${amount})`,
        invoice_id: inv.id
      });
    }
  }

  // 3. Allocations sum != invoice amount
  console.log('--- Checking allocation sums ---');
  const { data: invoicesWithAlloc } = await supabase
    .from('v2_invoices')
    .select(`
      id, invoice_number, amount, status,
      allocations:v2_invoice_allocations(amount)
    `)
    .is('deleted_at', null)
    .in('status', ['approved', 'in_draw', 'paid']);

  for (const inv of (invoicesWithAlloc || [])) {
    const amount = parseFloat(inv.amount || 0);
    const allocSum = (inv.allocations || []).reduce((s, a) => s + parseFloat(a.amount || 0), 0);

    if (Math.abs(allocSum - amount) > 0.01) {
      issues.push({
        type: 'ALLOCATION_MISMATCH',
        issue: `Invoice ${inv.invoice_number}: allocations ($${allocSum.toFixed(2)}) != amount ($${amount.toFixed(2)})`,
        invoice_id: inv.id
      });
    }
  }

  // 4. Split invoices consistency
  console.log('--- Checking split invoice consistency ---');
  const { data: splitParents } = await supabase
    .from('v2_invoices')
    .select('id, invoice_number, amount, original_amount, is_split_parent, status')
    .eq('is_split_parent', true)
    .is('deleted_at', null);

  for (const parent of (splitParents || [])) {
    if (parent.status !== 'split') {
      issues.push({
        type: 'SPLIT_PARENT_STATUS',
        issue: `Split parent ${parent.invoice_number} has status=${parent.status} (should be split)`,
        invoice_id: parent.id
      });
    }

    // Check children sum
    const { data: children } = await supabase
      .from('v2_invoices')
      .select('id, invoice_number, amount')
      .eq('parent_invoice_id', parent.id)
      .is('deleted_at', null);

    const childSum = (children || []).reduce((s, c) => s + parseFloat(c.amount || 0), 0);
    const parentOriginal = parseFloat(parent.original_amount || parent.amount || 0);

    if (Math.abs(childSum - parentOriginal) > 0.01) {
      issues.push({
        type: 'SPLIT_SUM_MISMATCH',
        issue: `Split family ${parent.invoice_number}: children sum ($${childSum}) != parent original ($${parentOriginal})`,
        parent_id: parent.id
      });
    }
  }

  // 5. Orphaned split children
  console.log('--- Checking orphaned split children ---');
  const { data: splitChildren } = await supabase
    .from('v2_invoices')
    .select('id, invoice_number, parent_invoice_id')
    .not('parent_invoice_id', 'is', null)
    .is('deleted_at', null);

  for (const child of (splitChildren || [])) {
    const { data: parent } = await supabase
      .from('v2_invoices')
      .select('id, is_split_parent')
      .eq('id', child.parent_invoice_id)
      .single();

    if (!parent) {
      issues.push({
        type: 'ORPHANED_SPLIT_CHILD',
        issue: `Split child ${child.invoice_number} references non-existent parent`,
        invoice_id: child.id,
        parent_id: child.parent_invoice_id
      });
    } else if (!parent.is_split_parent) {
      issues.push({
        type: 'INVALID_SPLIT_PARENT',
        issue: `Split child ${child.invoice_number} references parent that isn't marked as split parent`,
        invoice_id: child.id
      });
    }
  }

  // 6. PO totals vs line items
  console.log('--- Checking PO totals vs line items ---');
  const { data: pos } = await supabase
    .from('v2_purchase_orders')
    .select(`
      id, po_number, total_amount,
      line_items:v2_po_line_items(amount)
    `)
    .is('deleted_at', null);

  for (const po of (pos || [])) {
    const total = parseFloat(po.total_amount || 0);
    const lineSum = (po.line_items || []).reduce((s, li) => s + parseFloat(li.amount || 0), 0);

    if (Math.abs(lineSum - total) > 0.01 && (po.line_items || []).length > 0) {
      issues.push({
        type: 'PO_LINE_ITEM_MISMATCH',
        issue: `PO ${po.po_number}: line items ($${lineSum.toFixed(2)}) != total ($${total.toFixed(2)})`,
        po_id: po.id
      });
    }
  }

  // 7. Budget lines with negative values
  console.log('--- Checking for negative budget values ---');
  const { data: budgetLines } = await supabase
    .from('v2_budget_lines')
    .select('id, job_id, cost_code_id, budgeted_amount, billed_amount, paid_amount');

  for (const bl of (budgetLines || [])) {
    if (parseFloat(bl.budgeted_amount || 0) < 0) {
      issues.push({
        type: 'NEGATIVE_BUDGET',
        issue: 'Negative budgeted_amount',
        budget_line_id: bl.id
      });
    }
    if (parseFloat(bl.billed_amount || 0) < 0) {
      issues.push({
        type: 'NEGATIVE_BILLED',
        issue: 'Negative billed_amount',
        budget_line_id: bl.id
      });
    }
  }

  // 8. Draw totals vs invoice sums
  console.log('--- Checking draw totals ---');
  const { data: draws } = await supabase
    .from('v2_draws')
    .select(`
      id, draw_number, total_amount,
      invoices:v2_draw_invoices(
        invoice:v2_invoices(amount)
      )
    `);

  for (const draw of (draws || [])) {
    const total = parseFloat(draw.total_amount || 0);
    const invoiceSum = (draw.invoices || []).reduce((s, di) =>
      s + parseFloat(di.invoice?.amount || 0), 0);

    if (Math.abs(invoiceSum - total) > 0.01) {
      issues.push({
        type: 'DRAW_TOTAL_MISMATCH',
        issue: `Draw #${draw.draw_number}: invoice sum ($${invoiceSum.toFixed(2)}) != total ($${total.toFixed(2)})`,
        draw_id: draw.id
      });
    }
  }

  // 9. CO invoiced_amount consistency
  console.log('--- Checking CO invoiced_amount ---');
  const { data: cos } = await supabase
    .from('v2_job_change_orders')
    .select('id, change_order_number, invoiced_amount');

  for (const co of (cos || [])) {
    const { data: allocations } = await supabase
      .from('v2_invoice_allocations')
      .select('amount')
      .eq('change_order_id', co.id);

    const allocSum = (allocations || []).reduce((s, a) => s + parseFloat(a.amount || 0), 0);
    const coInvoiced = parseFloat(co.invoiced_amount || 0);

    if (Math.abs(allocSum - coInvoiced) > 0.01) {
      issues.push({
        type: 'CO_INVOICED_MISMATCH',
        issue: `CO #${co.change_order_number}: allocation sum ($${allocSum.toFixed(2)}) != invoiced_amount ($${coInvoiced.toFixed(2)})`,
        co_id: co.id
      });
    }
  }

  // Print results
  console.log('\n=== RESULTS ===');
  console.log(`Found ${issues.length} issues\n`);

  if (issues.length > 0) {
    // Group by type
    const byType = {};
    for (const issue of issues) {
      if (!byType[issue.type]) byType[issue.type] = [];
      byType[issue.type].push(issue);
    }

    for (const [type, typeIssues] of Object.entries(byType)) {
      console.log(`\n[${type}] - ${typeIssues.length} issue(s)`);
      for (const issue of typeIssues) {
        console.log(`  - ${issue.issue}`);
      }
    }
  }

  process.exit(issues.length > 0 ? 1 : 0);
}

checkDataIntegrity().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

/**
 * Data Integrity Fix Script
 * Fixes the following issues:
 * 1. Invoices in draws with wrong status
 * 2. Overbilled invoices (billed_amount > amount)
 * 3. CO invoiced_amount mismatches
 */

const { supabase } = require('../config');

async function fixDataIntegrity() {
  console.log('=== DATA INTEGRITY FIX SCRIPT ===\n');

  let fixed = 0;
  const issues = [];

  // 1. Fix invoices in draws with wrong status
  console.log('--- Fixing invoice-draw status consistency ---');
  const { data: drawInvoices } = await supabase
    .from('v2_draw_invoices')
    .select(`
      id,
      draw_id,
      invoice:v2_invoices(id, invoice_number, status, amount)
    `);

  for (const di of (drawInvoices || [])) {
    if (di.invoice && di.invoice.status !== 'in_draw') {
      console.log(`  Invoice ${di.invoice.invoice_number} (${di.invoice.id}) in draw but status=${di.invoice.status}`);

      // Remove from draw_invoices table since invoice isn't actually in_draw status
      const { error } = await supabase
        .from('v2_draw_invoices')
        .delete()
        .eq('id', di.id);

      if (error) {
        console.log(`    ERROR: Failed to remove - ${error.message}`);
        issues.push({ type: 'DRAW_LINK_REMOVE_FAILED', invoice_id: di.invoice.id, error: error.message });
      } else {
        console.log(`    FIXED: Removed stale draw link`);
        fixed++;

        // Update draw total
        const { data: remainingInvoices } = await supabase
          .from('v2_draw_invoices')
          .select('invoice:v2_invoices(amount)')
          .eq('draw_id', di.draw_id);

        const newTotal = (remainingInvoices || []).reduce((sum, item) =>
          sum + parseFloat(item.invoice?.amount || 0), 0);

        await supabase
          .from('v2_draws')
          .update({ total_amount: newTotal })
          .eq('id', di.draw_id);

        console.log(`    Updated draw total to $${newTotal.toFixed(2)}`);
      }
    }
  }

  // 2. Fix overbilled invoices
  console.log('\n--- Fixing overbilled invoices ---');
  const { data: invoices } = await supabase
    .from('v2_invoices')
    .select('id, invoice_number, amount, billed_amount')
    .is('deleted_at', null);

  for (const inv of (invoices || [])) {
    const amount = parseFloat(inv.amount || 0);
    const billed = parseFloat(inv.billed_amount || 0);

    if (billed > amount + 0.01) {
      console.log(`  Invoice ${inv.invoice_number}: billed ($${billed}) > amount ($${amount})`);

      // Cap billed_amount at invoice amount
      const { error } = await supabase
        .from('v2_invoices')
        .update({ billed_amount: amount })
        .eq('id', inv.id);

      if (error) {
        console.log(`    ERROR: Failed to fix - ${error.message}`);
        issues.push({ type: 'OVERBILL_FIX_FAILED', invoice_id: inv.id, error: error.message });
      } else {
        console.log(`    FIXED: Capped billed_amount to $${amount.toFixed(2)}`);
        fixed++;
      }
    }
  }

  // 3. Fix CO invoiced_amount mismatches
  console.log('\n--- Fixing CO invoiced_amount mismatches ---');
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
      console.log(`  CO #${co.change_order_number}: allocation sum ($${allocSum.toFixed(2)}) != invoiced_amount ($${coInvoiced.toFixed(2)})`);

      const { error } = await supabase
        .from('v2_job_change_orders')
        .update({ invoiced_amount: allocSum })
        .eq('id', co.id);

      if (error) {
        console.log(`    ERROR: Failed to fix - ${error.message}`);
        issues.push({ type: 'CO_INVOICED_FIX_FAILED', co_id: co.id, error: error.message });
      } else {
        console.log(`    FIXED: Updated invoiced_amount to $${allocSum.toFixed(2)}`);
        fixed++;
      }
    }
  }

  // Print summary
  console.log('\n=== SUMMARY ===');
  console.log(`Fixed: ${fixed} issues`);

  if (issues.length > 0) {
    console.log(`Failed: ${issues.length} issues`);
    console.log('\nFailed fixes:');
    issues.forEach(i => console.log(`  - ${i.type}: ${i.error}`));
  }

  process.exit(issues.length > 0 ? 1 : 0);
}

fixDataIntegrity().catch(err => {
  console.error('Script error:', err);
  process.exit(1);
});

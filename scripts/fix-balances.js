/**
 * Balance Fix Script
 * Recalculates and fixes all draw totals, invoice billed amounts, and budget lines
 */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function fixAllBalances() {
  console.log('=== BALANCE FIX SCRIPT ===\n');

  let fixes = { draws: 0, invoices: 0, budgets: 0 };

  // Get all jobs
  const { data: jobs } = await supabase.from('v2_jobs').select('id, name');

  for (const job of (jobs || [])) {
    console.log(`\nProcessing: ${job.name}`);

    // FIX 1: Recalculate draw totals
    const { data: draws } = await supabase
      .from('v2_draws')
      .select('id, draw_number, total_amount')
      .eq('job_id', job.id);

    for (const draw of (draws || [])) {
      // Get all invoices in this draw
      const { data: drawInvoices } = await supabase
        .from('v2_draw_invoices')
        .select('invoice:v2_invoices(amount)')
        .eq('draw_id', draw.id);

      // Calculate actual total from invoice amounts
      const calculatedTotal = (drawInvoices || []).reduce((sum, di) => {
        return sum + parseFloat(di.invoice?.amount || 0);
      }, 0);

      // Also add change order amounts if any
      const { data: coAllocs } = await supabase
        .from('v2_invoice_allocations')
        .select('amount, change_order_id')
        .eq('job_id', job.id)
        .not('change_order_id', 'is', null);

      // Get unique COs and their amounts that are in this draw
      // (For now, just use invoice totals)

      const currentTotal = parseFloat(draw.total_amount || 0);

      if (Math.abs(currentTotal - calculatedTotal) > 0.01) {
        console.log(`  Draw #${draw.draw_number}: $${currentTotal} → $${calculatedTotal}`);
        await supabase
          .from('v2_draws')
          .update({ total_amount: calculatedTotal })
          .eq('id', draw.id);
        fixes.draws++;
      }
    }

    // FIX 2: Recalculate invoice billed_amount from draw allocations
    const { data: invoices } = await supabase
      .from('v2_invoices')
      .select(`
        id, invoice_number, amount, billed_amount, status,
        draw_allocations:v2_draw_allocations(amount)
      `)
      .eq('job_id', job.id)
      .is('deleted_at', null);

    for (const inv of (invoices || [])) {
      const currentBilled = parseFloat(inv.billed_amount || 0);
      const calculatedBilled = (inv.draw_allocations || []).reduce(
        (sum, da) => sum + parseFloat(da.amount || 0), 0
      );

      if (Math.abs(currentBilled - calculatedBilled) > 0.01) {
        console.log(`  Invoice ${inv.invoice_number}: billed $${currentBilled} → $${calculatedBilled}`);
        await supabase
          .from('v2_invoices')
          .update({ billed_amount: calculatedBilled })
          .eq('id', inv.id);
        fixes.invoices++;
      }
    }

    // FIX 3: Recalculate budget billed amounts from allocations
    // First, get all allocations for invoices that are in_draw or paid
    const { data: allocations } = await supabase
      .from('v2_invoice_allocations')
      .select(`
        amount, cost_code_id,
        invoice:v2_invoices(status)
      `)
      .eq('job_id', job.id);

    // Calculate actual billed per cost code (only for in_draw/paid invoices)
    const billedByCode = {};
    for (const alloc of (allocations || [])) {
      if (['in_draw', 'paid'].includes(alloc.invoice?.status)) {
        const codeId = alloc.cost_code_id;
        billedByCode[codeId] = (billedByCode[codeId] || 0) + parseFloat(alloc.amount || 0);
      }
    }

    // Get existing budget lines
    const { data: budgetLines } = await supabase
      .from('v2_budget_lines')
      .select('id, cost_code_id, billed_amount')
      .eq('job_id', job.id);

    // Update budget lines
    for (const bl of (budgetLines || [])) {
      const currentBilled = parseFloat(bl.billed_amount || 0);
      const calculatedBilled = billedByCode[bl.cost_code_id] || 0;

      if (Math.abs(currentBilled - calculatedBilled) > 0.01) {
        const { data: cc } = await supabase
          .from('v2_cost_codes')
          .select('code')
          .eq('id', bl.cost_code_id)
          .single();
        console.log(`  Budget ${cc?.code}: billed $${currentBilled} → $${calculatedBilled}`);
        await supabase
          .from('v2_budget_lines')
          .update({ billed_amount: calculatedBilled })
          .eq('id', bl.id);
        fixes.budgets++;
      }
    }

    // Create missing budget lines for cost codes with activity
    const existingCodeIds = new Set((budgetLines || []).map(bl => bl.cost_code_id));
    for (const [codeId, amount] of Object.entries(billedByCode)) {
      if (!existingCodeIds.has(codeId) && amount > 0) {
        const { data: cc } = await supabase
          .from('v2_cost_codes')
          .select('code')
          .eq('id', codeId)
          .single();
        console.log(`  Creating budget line for ${cc?.code} with billed $${amount}`);
        await supabase.from('v2_budget_lines').insert({
          job_id: job.id,
          cost_code_id: codeId,
          budgeted_amount: 0,
          committed_amount: 0,
          billed_amount: amount,
          paid_amount: 0
        });
        fixes.budgets++;
      }
    }
  }

  console.log('\n=== FIX SUMMARY ===');
  console.log(`Draws fixed: ${fixes.draws}`);
  console.log(`Invoices fixed: ${fixes.invoices}`);
  console.log(`Budget lines fixed: ${fixes.budgets}`);
}

fixAllBalances().catch(console.error);

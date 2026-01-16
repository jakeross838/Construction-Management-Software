/**
 * Fix Orphaned Budget Amounts
 * Recalculates ALL budget amounts based on actual invoice allocations
 * Any amounts not backed by allocations are reset to $0
 */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function fixOrphanedBudgets() {
  console.log('=== FIXING ORPHANED BUDGET AMOUNTS ===\n');

  // Get all jobs
  const { data: jobs } = await supabase.from('v2_jobs').select('id, name');

  for (const job of (jobs || [])) {
    console.log(`\nProcessing: ${job.name}`);

    // Get all invoice allocations for this job with invoice status
    const { data: allocations } = await supabase
      .from('v2_invoice_allocations')
      .select(`
        amount, cost_code_id,
        invoice:v2_invoices(status)
      `)
      .eq('job_id', job.id);

    // Calculate actual amounts per cost code
    const actualByCode = {};
    for (const alloc of (allocations || [])) {
      const codeId = alloc.cost_code_id;
      if (!actualByCode[codeId]) {
        actualByCode[codeId] = { billed: 0, paid: 0, total: 0 };
      }
      const amount = parseFloat(alloc.amount || 0);
      actualByCode[codeId].total += amount;

      // Billed = in_draw, Paid = paid status
      if (alloc.invoice?.status === 'in_draw') {
        actualByCode[codeId].billed += amount;
      } else if (alloc.invoice?.status === 'paid') {
        actualByCode[codeId].paid += amount;
      }
    }

    // Get all PO line items for committed amounts
    const { data: poLines } = await supabase
      .from('v2_po_line_items')
      .select(`
        amount, cost_code_id,
        po:v2_purchase_orders!inner(job_id, status, deleted_at)
      `)
      .eq('po.job_id', job.id)
      .is('po.deleted_at', null)
      .in('po.status', ['open', 'active']);

    const committedByCode = {};
    for (const line of (poLines || [])) {
      const codeId = line.cost_code_id;
      committedByCode[codeId] = (committedByCode[codeId] || 0) + parseFloat(line.amount || 0);
    }

    // Get all budget lines
    const { data: budgetLines } = await supabase
      .from('v2_budget_lines')
      .select('*, cost_code:v2_cost_codes(code, name)')
      .eq('job_id', job.id);

    // Fix each budget line
    for (const bl of (budgetLines || [])) {
      const actual = actualByCode[bl.cost_code_id] || { billed: 0, paid: 0 };
      const committed = committedByCode[bl.cost_code_id] || 0;

      const currentBilled = parseFloat(bl.billed_amount || 0);
      const currentPaid = parseFloat(bl.paid_amount || 0);
      const currentCommitted = parseFloat(bl.committed_amount || 0);

      const needsUpdate =
        Math.abs(currentBilled - actual.billed) > 0.01 ||
        Math.abs(currentPaid - actual.paid) > 0.01 ||
        Math.abs(currentCommitted - committed) > 0.01;

      if (needsUpdate) {
        console.log(`  ${bl.cost_code?.code} ${bl.cost_code?.name}:`);
        if (Math.abs(currentBilled - actual.billed) > 0.01) {
          console.log(`    Billed: $${currentBilled} → $${actual.billed}`);
        }
        if (Math.abs(currentPaid - actual.paid) > 0.01) {
          console.log(`    Paid: $${currentPaid} → $${actual.paid}`);
        }
        if (Math.abs(currentCommitted - committed) > 0.01) {
          console.log(`    Committed: $${currentCommitted} → $${committed}`);
        }

        await supabase
          .from('v2_budget_lines')
          .update({
            billed_amount: actual.billed,
            paid_amount: actual.paid,
            committed_amount: committed
          })
          .eq('id', bl.id);
      }
    }

    // Check for cost codes with activity but no budget line
    const allCodeIds = new Set([
      ...Object.keys(actualByCode),
      ...Object.keys(committedByCode)
    ]);
    const existingCodeIds = new Set((budgetLines || []).map(bl => bl.cost_code_id));

    for (const codeId of allCodeIds) {
      if (!existingCodeIds.has(codeId)) {
        const actual = actualByCode[codeId] || { billed: 0, paid: 0 };
        const committed = committedByCode[codeId] || 0;

        if (actual.billed > 0 || actual.paid > 0 || committed > 0) {
          const { data: cc } = await supabase
            .from('v2_cost_codes')
            .select('code, name')
            .eq('id', codeId)
            .single();

          console.log(`  Creating budget line for ${cc?.code} ${cc?.name}:`);
          console.log(`    Billed: $${actual.billed}, Paid: $${actual.paid}, Committed: $${committed}`);

          await supabase.from('v2_budget_lines').insert({
            job_id: job.id,
            cost_code_id: codeId,
            budgeted_amount: 0,
            committed_amount: committed,
            billed_amount: actual.billed,
            paid_amount: actual.paid
          });
        }
      }
    }
  }

  console.log('\n=== DONE ===');
}

fixOrphanedBudgets().catch(console.error);

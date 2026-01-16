const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  // Get Test Project
  const { data: job } = await supabase
    .from('v2_jobs')
    .select('id, name')
    .ilike('name', '%test%')
    .single();

  console.log('Job:', job?.name);

  // Get ALL budget lines with their cost codes
  const { data: budgetLines } = await supabase
    .from('v2_budget_lines')
    .select('*, cost_code:v2_cost_codes(code, name)')
    .eq('job_id', job.id)
    .order('cost_code(code)');

  console.log('\n=== BUDGET LINES ===');
  for (const bl of (budgetLines || [])) {
    const hasActivity = parseFloat(bl.budgeted_amount || 0) > 0 ||
                        parseFloat(bl.committed_amount || 0) > 0 ||
                        parseFloat(bl.billed_amount || 0) > 0 ||
                        parseFloat(bl.paid_amount || 0) > 0;
    if (hasActivity) {
      console.log(`${bl.cost_code?.code} ${bl.cost_code?.name}:`);
      console.log(`  Budgeted: $${bl.budgeted_amount}, Committed: $${bl.committed_amount}, Billed: $${bl.billed_amount}, Paid: $${bl.paid_amount}`);
    }
  }

  // Check if there are any allocations at all
  const { data: allocs } = await supabase
    .from('v2_invoice_allocations')
    .select('*, invoice:v2_invoices(invoice_number, status)')
    .eq('job_id', job.id);

  console.log('\n=== INVOICE ALLOCATIONS ===');
  console.log('Total allocations:', allocs?.length || 0);
  for (const a of (allocs || [])) {
    console.log(`  Invoice ${a.invoice?.invoice_number} (${a.invoice?.status}): $${a.amount}`);
  }

  // Check draw allocations
  const { data: drawAllocs } = await supabase
    .from('v2_draw_allocations')
    .select('*, draw:v2_draws(draw_number)')
    .eq('job_id', job.id);

  console.log('\n=== DRAW ALLOCATIONS ===');
  console.log('Total draw allocations:', drawAllocs?.length || 0);
  for (const da of (drawAllocs || [])) {
    console.log(`  Draw #${da.draw?.draw_number}: $${da.amount}`);
  }
}

check().catch(console.error);

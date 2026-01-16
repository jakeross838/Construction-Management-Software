const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  // Get Drummond job
  const { data: job } = await supabase
    .from('v2_jobs')
    .select('id, name')
    .ilike('name', '%drummond%')
    .single();

  console.log('Job:', job?.name, job?.id);

  // Get draws
  const { data: draws } = await supabase
    .from('v2_draws')
    .select('*')
    .eq('job_id', job.id);

  console.log('\nDraws:', JSON.stringify(draws, null, 2));

  // Get draw_invoices
  const { data: drawInvoices } = await supabase
    .from('v2_draw_invoices')
    .select('*, invoice:v2_invoices(id, invoice_number, amount, status)')
    .eq('draw_id', draws?.[0]?.id);

  console.log('\nDraw Invoices:', JSON.stringify(drawInvoices, null, 2));

  // Get all invoices for this job
  const { data: invoices } = await supabase
    .from('v2_invoices')
    .select('id, invoice_number, amount, status, billed_amount')
    .eq('job_id', job.id)
    .is('deleted_at', null);

  console.log('\nAll Invoices for job:', JSON.stringify(invoices, null, 2));

  // Get allocations
  const { data: allocations } = await supabase
    .from('v2_invoice_allocations')
    .select('*, cost_code:v2_cost_codes(code, name)')
    .eq('job_id', job.id);

  console.log('\nAllocations:', JSON.stringify(allocations, null, 2));

  // Get draw allocations
  const { data: drawAllocs } = await supabase
    .from('v2_draw_allocations')
    .select('*')
    .eq('job_id', job.id);

  console.log('\nDraw Allocations:', JSON.stringify(drawAllocs, null, 2));

  // Get budget lines
  const { data: budgetLines } = await supabase
    .from('v2_budget_lines')
    .select('*, cost_code:v2_cost_codes(code, name)')
    .eq('job_id', job.id);

  console.log('\nBudget Lines:', JSON.stringify(budgetLines, null, 2));
}

check().catch(console.error);

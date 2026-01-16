const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function diagnose() {
  console.log('=== BALANCE DIAGNOSTIC REPORT ===\n');

  // Get all jobs
  const { data: jobs } = await supabase.from('v2_jobs').select('id, name').eq('status', 'active');
  console.log('Active Jobs:', jobs?.length || 0);

  for (const job of (jobs || [])) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`JOB: ${job.name}`);
    console.log('='.repeat(60));

    // Get draws for this job
    const { data: draws } = await supabase
      .from('v2_draws')
      .select('id, draw_number, total_amount, status')
      .eq('job_id', job.id)
      .order('draw_number');

    console.log(`\nDRAWS (${draws?.length || 0}):`);
    let totalDrawAmount = 0;
    for (const draw of (draws || [])) {
      // Get invoices in this draw
      const { data: drawInvoices } = await supabase
        .from('v2_draw_invoices')
        .select('invoice_id')
        .eq('draw_id', draw.id);

      const invoiceIds = drawInvoices?.map(di => di.invoice_id) || [];

      // Get invoice amounts
      let invoiceTotal = 0;
      if (invoiceIds.length > 0) {
        const { data: invoices } = await supabase
          .from('v2_invoices')
          .select('id, amount, invoice_number')
          .in('id', invoiceIds);

        invoiceTotal = (invoices || []).reduce((sum, inv) => sum + Number(inv.amount || 0), 0);
      }

      console.log(`  Draw #${draw.draw_number}: DB total=$${draw.total_amount || 0}, Calc from invoices=$${invoiceTotal}, Status=${draw.status}, Invoices=${invoiceIds.length}`);
      totalDrawAmount += Number(draw.total_amount || 0);

      if (Number(draw.total_amount || 0) !== invoiceTotal) {
        console.log(`    ⚠️  MISMATCH: Draw total_amount doesn't match sum of invoice amounts!`);
      }
    }

    // Get all invoices for this job
    const { data: allInvoices } = await supabase
      .from('v2_invoices')
      .select('id, invoice_number, amount, status')
      .eq('job_id', job.id)
      .is('deleted_at', null);

    console.log(`\nINVOICES (${allInvoices?.length || 0}):`);
    let totalInvoiceAmount = 0;
    let approvedAmount = 0;
    let inDrawAmount = 0;
    let paidAmount = 0;

    for (const inv of (allInvoices || [])) {
      totalInvoiceAmount += Number(inv.amount || 0);
      if (inv.status === 'approved') approvedAmount += Number(inv.amount || 0);
      if (inv.status === 'in_draw') inDrawAmount += Number(inv.amount || 0);
      if (inv.status === 'paid') paidAmount += Number(inv.amount || 0);
    }
    console.log(`  Total: $${totalInvoiceAmount}`);
    console.log(`  By status: approved=$${approvedAmount}, in_draw=$${inDrawAmount}, paid=$${paidAmount}`);

    // Get allocations for this job
    const { data: allocations } = await supabase
      .from('v2_invoice_allocations')
      .select('id, amount, invoice_id, cost_code_id')
      .eq('job_id', job.id);

    let totalAllocAmount = 0;
    for (const alloc of (allocations || [])) {
      totalAllocAmount += Number(alloc.amount || 0);
    }
    console.log(`\nALLOCATIONS (${allocations?.length || 0}): Total=$${totalAllocAmount}`);

    // Check if allocations match invoice amounts
    const invoiceAllocMap = {};
    for (const alloc of (allocations || [])) {
      if (!invoiceAllocMap[alloc.invoice_id]) invoiceAllocMap[alloc.invoice_id] = 0;
      invoiceAllocMap[alloc.invoice_id] += Number(alloc.amount || 0);
    }

    for (const inv of (allInvoices || [])) {
      const allocSum = invoiceAllocMap[inv.id] || 0;
      if (Math.abs(Number(inv.amount || 0) - allocSum) > 0.01) {
        console.log(`  ⚠️  Invoice ${inv.invoice_number}: amount=$${inv.amount}, allocations=$${allocSum} - MISMATCH!`);
      }
    }

    // Get budget lines for this job
    const { data: budgetLines } = await supabase
      .from('v2_budget_lines')
      .select('id, budgeted_amount, committed_amount, billed_amount, paid_amount, cost_code_id')
      .eq('job_id', job.id);

    let totalBudgeted = 0;
    let totalCommitted = 0;
    let totalBilled = 0;
    let totalPaid = 0;

    for (const bl of (budgetLines || [])) {
      totalBudgeted += Number(bl.budgeted_amount || 0);
      totalCommitted += Number(bl.committed_amount || 0);
      totalBilled += Number(bl.billed_amount || 0);
      totalPaid += Number(bl.paid_amount || 0);
    }

    console.log(`\nBUDGET LINES (${budgetLines?.length || 0}):`);
    console.log(`  Budgeted: $${totalBudgeted}`);
    console.log(`  Committed: $${totalCommitted}`);
    console.log(`  Billed: $${totalBilled}`);
    console.log(`  Paid: $${totalPaid}`);

    // Get draw allocations
    const { data: drawAllocs } = await supabase
      .from('v2_draw_allocations')
      .select('id, amount, cost_code_id, draw_id')
      .eq('job_id', job.id);

    let totalDrawAllocAmount = 0;
    for (const da of (drawAllocs || [])) {
      totalDrawAllocAmount += Number(da.amount || 0);
    }
    console.log(`\nDRAW ALLOCATIONS (${drawAllocs?.length || 0}): Total=$${totalDrawAllocAmount}`);

    // Summary comparison
    console.log(`\n--- BALANCE CHECK ---`);
    console.log(`Invoice total: $${totalInvoiceAmount}`);
    console.log(`Allocation total: $${totalAllocAmount}`);
    console.log(`Draw total (from v2_draws.total_amount): $${totalDrawAmount}`);
    console.log(`Budget billed total: $${totalBilled}`);
    console.log(`Draw allocation total: $${totalDrawAllocAmount}`);

    if (Math.abs(totalInvoiceAmount - totalAllocAmount) > 0.01) {
      console.log(`⚠️  Invoice vs Allocation MISMATCH`);
    }
    if (Math.abs(totalDrawAmount - totalBilled) > 0.01) {
      console.log(`⚠️  Draw total vs Budget billed MISMATCH`);
    }
  }
}

diagnose().catch(console.error);

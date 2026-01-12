const { supabase } = require('../config');

async function check() {
  const { data: invoices } = await supabase
    .from('v2_invoices')
    .select('invoice_number, amount, status, vendor:v2_vendors(name), job:v2_jobs(name)')
    .order('created_at', { ascending: true });

  console.log('Invoices in database:');
  console.log('=====================');
  let total = 0;
  invoices?.forEach(inv => {
    const amt = parseFloat(inv.amount) || 0;
    total += amt;
    console.log(`  ${inv.invoice_number || 'N/A'} | $${amt.toFixed(2)} | ${inv.vendor?.name || 'Unknown'} | ${inv.job?.name || 'Unassigned'}`);
  });
  console.log('---------------------');
  console.log(`Total: ${invoices?.length || 0} invoices, $${total.toFixed(2)}`);
}

check();

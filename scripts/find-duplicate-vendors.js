const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function findDuplicateVendors() {
  const { data: vendors } = await supabase
    .from('v2_vendors')
    .select('id, name, email, phone, created_at')
    .ilike('name', '%tnt%')
    .order('created_at');

  console.log('TNT Vendors found:');
  for (const v of vendors || []) {
    // Count invoices
    const { count: invoiceCount } = await supabase
      .from('v2_invoices')
      .select('id', { count: 'exact' })
      .eq('vendor_id', v.id);

    // Count POs
    const { count: poCount } = await supabase
      .from('v2_purchase_orders')
      .select('id', { count: 'exact' })
      .eq('vendor_id', v.id);

    // Count lien releases
    const { count: lienCount } = await supabase
      .from('v2_lien_releases')
      .select('id', { count: 'exact' })
      .eq('vendor_id', v.id);

    console.log(`  - ${v.name}`);
    console.log(`    ID: ${v.id}`);
    console.log(`    Invoices: ${invoiceCount || 0}, POs: ${poCount || 0}, Lien Releases: ${lienCount || 0}`);
    console.log(`    Created: ${v.created_at}`);
    console.log('');
  }
}

findDuplicateVendors().catch(console.error);

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function mergeVendors(keepId, mergeId) {
  console.log(`Merging vendor ${mergeId} into ${keepId}...`);

  // Get vendor names
  const { data: keepVendor } = await supabase.from('v2_vendors').select('name').eq('id', keepId).single();
  const { data: mergeVendor } = await supabase.from('v2_vendors').select('name').eq('id', mergeId).single();

  console.log(`Keeping: "${keepVendor?.name}"`);
  console.log(`Merging: "${mergeVendor?.name}"`);

  // Update invoices
  const { data: invoices, error: invErr } = await supabase
    .from('v2_invoices')
    .update({ vendor_id: keepId })
    .eq('vendor_id', mergeId)
    .select('id');

  if (invErr) {
    console.error('Error updating invoices:', invErr.message);
  } else {
    console.log(`Updated ${invoices?.length || 0} invoices`);
  }

  // Update POs
  const { data: pos, error: poErr } = await supabase
    .from('v2_purchase_orders')
    .update({ vendor_id: keepId })
    .eq('vendor_id', mergeId)
    .select('id');

  if (poErr) {
    console.error('Error updating POs:', poErr.message);
  } else {
    console.log(`Updated ${pos?.length || 0} POs`);
  }

  // Update lien releases
  const { data: liens, error: lienErr } = await supabase
    .from('v2_lien_releases')
    .update({ vendor_id: keepId })
    .eq('vendor_id', mergeId)
    .select('id');

  if (lienErr) {
    console.error('Error updating lien releases:', lienErr.message);
  } else {
    console.log(`Updated ${liens?.length || 0} lien releases`);
  }

  // Delete the merged vendor
  const { error: delErr } = await supabase
    .from('v2_vendors')
    .delete()
    .eq('id', mergeId);

  if (delErr) {
    console.error('Error deleting merged vendor:', delErr.message);
  } else {
    console.log(`Deleted vendor "${mergeVendor?.name}"`);
  }

  console.log('Merge complete!');
}

// TNT Custom Painting (keep) <- Tnt Painting (merge)
const keepId = 'a3f95419-14f7-4114-91ef-2d0c0f3f336a';  // TNT Custom Painting
const mergeId = 'f3304e4b-4cd2-494b-ae45-49a1d371789e'; // Tnt Painting

mergeVendors(keepId, mergeId).catch(console.error);

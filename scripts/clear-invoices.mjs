// Script to clear test invoices
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jdbyrxfaqbhnrxfcdjys.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpkYnlyeGZhcWJobnJ4ZmNkanlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxOTI1ODcsImV4cCI6MjA4NDc2ODU4N30.aH_9gWqlVIf50-2l4F0YSlO0vJ3eZvht753b9l6zInQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function clearInvoices() {
  console.log('Fetching invoices...');

  // Get all invoices
  const { data: invoices, error: fetchError } = await supabase
    .from('invoices')
    .select('id, invoice_number');

  if (fetchError) {
    console.error('Error fetching invoices:', fetchError);
    return;
  }

  console.log(`Found ${invoices?.length || 0} invoices`);

  if (!invoices || invoices.length === 0) {
    console.log('No invoices to delete');
    return;
  }

  // Delete allocations first (foreign key constraint)
  for (const inv of invoices) {
    const { error: allocError } = await supabase
      .from('invoice_allocations')
      .delete()
      .eq('invoice_id', inv.id);

    if (allocError) {
      console.error(`Error deleting allocations for ${inv.invoice_number}:`, allocError);
    }
  }

  // Delete invoices
  const { error: deleteError } = await supabase
    .from('invoices')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all (dummy condition)

  if (deleteError) {
    console.error('Error deleting invoices:', deleteError);
  } else {
    console.log('All invoices deleted successfully');
  }
}

clearInvoices();

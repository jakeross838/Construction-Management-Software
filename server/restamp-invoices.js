/**
 * Re-stamp All Invoices Script
 *
 * This script re-applies the approval stamp to all approved/in_draw/paid invoices
 * using the new clean watermark design with Ross Built logo.
 *
 * Usage: node server/restamp-invoices.js [--dry-run] [--limit N]
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { stampApproval } = require('./pdf-stamper');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Parse command line args
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const limitIdx = args.indexOf('--limit');
const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1]) : null;

async function main() {
  console.log('='.repeat(60));
  console.log('RE-STAMP INVOICES - New Clean Watermark Design');
  console.log('='.repeat(60));

  if (dryRun) {
    console.log('\n*** DRY RUN MODE - No changes will be made ***\n');
  }

  // Fetch all invoices that have been approved (have stamped PDFs)
  console.log('\nFetching approved invoices...');

  let query = supabase
    .from('v2_invoices')
    .select(`
      id,
      invoice_number,
      invoice_date,
      amount,
      status,
      pdf_url,
      pdf_stamped_url,
      approved_at,
      approved_by,
      job:v2_jobs!inner(id, name),
      vendor:v2_vendors(id, name),
      po:v2_purchase_orders(id, po_number, description, total_amount),
      allocations:v2_invoice_allocations(
        amount,
        cost_code:v2_cost_codes(id, code, name)
      )
    `)
    .in('status', ['approved', 'in_draw', 'paid'])
    .not('pdf_url', 'is', null)
    .order('approved_at', { ascending: false });

  if (limit) {
    query = query.limit(limit);
  }

  const { data: invoices, error } = await query;

  if (error) {
    console.error('Error fetching invoices:', error);
    process.exit(1);
  }

  console.log(`Found ${invoices.length} invoices to re-stamp\n`);

  if (invoices.length === 0) {
    console.log('No invoices to process.');
    process.exit(0);
  }

  // Process each invoice
  let success = 0;
  let failed = 0;
  let skipped = 0;

  for (let i = 0; i < invoices.length; i++) {
    const invoice = invoices[i];
    const progress = `[${i + 1}/${invoices.length}]`;

    console.log(`${progress} Processing: ${invoice.invoice_number || invoice.id}`);
    console.log(`         Job: ${invoice.job?.name || 'Unknown'}`);
    console.log(`         Vendor: ${invoice.vendor?.name || 'Unknown'}`);
    console.log(`         Amount: $${invoice.amount}`);
    console.log(`         Status: ${invoice.status}`);

    if (!invoice.pdf_url) {
      console.log('         SKIPPED: No PDF URL\n');
      skipped++;
      continue;
    }

    try {
      // Download original PDF
      console.log('         Downloading original PDF...');

      // Extract bucket and path from URL
      const pdfUrl = invoice.pdf_url;
      let pdfBuffer;

      if (pdfUrl.includes('supabase')) {
        // Supabase storage URL - download via storage API
        const pathMatch = pdfUrl.match(/invoices\/(.+)$/);
        if (!pathMatch) {
          throw new Error('Could not parse PDF path from URL');
        }
        const filePath = pathMatch[1];

        const { data: fileData, error: downloadError } = await supabase.storage
          .from('invoices')
          .download(filePath);

        if (downloadError) throw downloadError;
        pdfBuffer = Buffer.from(await fileData.arrayBuffer());
      } else {
        // External URL - fetch directly
        const response = await fetch(pdfUrl);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        pdfBuffer = Buffer.from(await response.arrayBuffer());
      }

      console.log(`         Downloaded ${(pdfBuffer.length / 1024).toFixed(1)} KB`);

      // Build stamp data
      const costCodes = (invoice.allocations || []).map(a => ({
        code: a.cost_code?.code || 'Unknown',
        name: a.cost_code?.name || '',
        amount: a.amount
      }));

      // Get PO billing info if linked
      let poBilledToDate = 0;
      if (invoice.po?.id) {
        const { data: poInvoices } = await supabase
          .from('v2_invoices')
          .select('amount')
          .eq('po_id', invoice.po.id)
          .in('status', ['approved', 'in_draw', 'paid'])
          .neq('id', invoice.id);

        poBilledToDate = (poInvoices || []).reduce((sum, inv) => sum + parseFloat(inv.amount || 0), 0);
      }

      const stampData = {
        status: 'APPROVED',
        date: invoice.approved_at
          ? new Date(invoice.approved_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
          : new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        approvedBy: invoice.approved_by || 'System',
        jobName: invoice.job?.name,
        vendorName: invoice.vendor?.name,
        invoiceNumber: invoice.invoice_number,
        amount: parseFloat(invoice.amount),
        costCodes,
        poNumber: invoice.po?.po_number,
        poDescription: invoice.po?.description,
        poTotal: invoice.po?.total_amount ? parseFloat(invoice.po.total_amount) : undefined,
        poBilledToDate
      };

      // Apply new stamp
      console.log('         Applying new stamp...');
      const stampedPdf = await stampApproval(pdfBuffer, stampData);
      console.log(`         Stamped PDF: ${(stampedPdf.length / 1024).toFixed(1)} KB`);

      if (dryRun) {
        console.log('         DRY RUN: Would upload new stamped PDF\n');
        success++;
        continue;
      }

      // Upload new stamped PDF
      console.log('         Uploading stamped PDF...');

      // Generate filename
      const jobName = (invoice.job?.name || 'Unknown').replace(/[^a-zA-Z0-9]/g, '');
      const vendorName = (invoice.vendor?.name || 'Unknown').replace(/[^a-zA-Z0-9]/g, '');
      const dateStr = invoice.invoice_date || new Date().toISOString().split('T')[0];
      const filename = `stamped/INV_${jobName}_${vendorName}_${dateStr}_${Date.now()}.pdf`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('invoices')
        .upload(filename, stampedPdf, {
          contentType: 'application/pdf',
          upsert: false
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('invoices')
        .getPublicUrl(filename);

      const newStampedUrl = urlData.publicUrl;

      // Update invoice record
      const { error: updateError } = await supabase
        .from('v2_invoices')
        .update({ pdf_stamped_url: newStampedUrl })
        .eq('id', invoice.id);

      if (updateError) throw updateError;

      console.log('         SUCCESS: Invoice re-stamped\n');
      success++;

    } catch (err) {
      console.error(`         FAILED: ${err.message}\n`);
      failed++;
    }

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  // Summary
  console.log('='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total processed: ${invoices.length}`);
  console.log(`Success: ${success}`);
  console.log(`Failed: ${failed}`);
  console.log(`Skipped: ${skipped}`);

  if (dryRun) {
    console.log('\n*** This was a dry run. Run without --dry-run to apply changes. ***');
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

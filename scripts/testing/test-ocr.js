/**
 * Test OCR processing with a scanned invoice
 */
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

async function testOCR() {
  const fetch = (await import('node-fetch')).default;

  console.log('='.repeat(60));
  console.log('OCR PROCESSING TEST');
  console.log('='.repeat(60));
  console.log('');

  // Download a scanned invoice from storage
  // Using Paradise Foam invoice which we know is a scanned image
  const pdfUrl = 'https://sorghqcpeamdfbvysafj.supabase.co/storage/v1/object/public/invoices/null/1768237555703_unassigned_INV_Unknown_ParadiseFoam_2026-01-12.pdf';

  console.log('1. Downloading scanned invoice PDF...');
  const pdfRes = await fetch(pdfUrl);
  const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer());
  console.log(`   Downloaded: ${pdfBuffer.length} bytes`);

  // Save temporarily
  const tempPath = path.join(__dirname, 'temp-ocr-test.pdf');
  fs.writeFileSync(tempPath, pdfBuffer);
  console.log(`   Saved to: ${tempPath}`);
  console.log('');

  // Upload to AI processor
  console.log('2. Uploading to AI processor (expecting OCR)...');
  const form = new FormData();
  form.append('file', fs.createReadStream(tempPath));
  form.append('uploaded_by', 'OCR-Test');

  const startTime = Date.now();
  const response = await fetch('http://localhost:3001/api/invoices/process', {
    method: 'POST',
    body: form
  });

  const result = await response.json();
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`   Processing time: ${elapsed}s`);
  console.log('');

  // Display results
  console.log('3. PROCESSING RESULTS');
  console.log('-'.repeat(40));
  console.log(`   Success: ${result.success}`);
  console.log(`   Error: ${result.error || '(none)'}`);

  // Check extraction method from invoice record (API returns { success, invoice, processing })
  const invoice = result.invoice || {};
  const method = invoice.ai_extracted_data?.extraction_method ||
                 result.ai_extracted_data?.extraction_method ||
                 (invoice.review_flags?.includes('ocr_processed') ? 'vision_ocr' : 'text');
  console.log(`   Extraction Method: ${method}`);
  console.log(`   Review Flags: ${invoice.review_flags?.join(', ') || '(none)'}`);
  console.log('');

  // Get extracted data from processing result
  const extracted = result.processing?.extracted || result.extracted;
  if (extracted) {
    console.log('   EXTRACTED DATA:');
    console.log(`   - Vendor: ${extracted.vendor?.companyName || '(none)'}`);
    console.log(`   - Trade Type: ${extracted.vendor?.tradeType || '(none)'}`);
    console.log(`   - Invoice #: ${extracted.invoiceNumber || '(none)'}`);
    console.log(`   - Amount: $${extracted.totalAmount || '(none)'}`);
    console.log(`   - Date: ${extracted.invoiceDate || '(none)'}`);
    console.log('');
  }

  if (invoice.review_flags?.length > 0) {
    console.log('   REVIEW FLAGS:');
    invoice.review_flags.forEach(f => console.log(`   - ${f}`));
    console.log('');
  }

  const messages = result.processing?.messages || result.messages || [];
  if (messages.length > 0) {
    console.log('   MESSAGES:');
    messages.forEach(m => console.log(`   - ${m}`));
    console.log('');
  }

  // Clean up
  console.log('4. CLEANUP');
  console.log('-'.repeat(40));
  fs.unlinkSync(tempPath);
  console.log(`   Deleted temp file`);

  if (result.invoice?.id) {
    await fetch(`http://localhost:3001/api/invoices/${result.invoice.id}`, {
      method: 'DELETE'
    });
    console.log(`   Deleted test invoice: ${result.invoice.id}`);
  }
  console.log('');

  // Summary
  console.log('='.repeat(60));
  if (invoice.ai_extracted_data?.extraction_method === 'vision_ocr') {
    console.log('SUCCESS: OCR extraction was used!');
  } else if (invoice.ai_extracted_data?.extraction_method === 'text_fallback') {
    console.log('PARTIAL: OCR failed, fell back to text extraction');
  } else {
    console.log('NOTE: Standard text extraction was used (PDF had text)');
  }
  console.log('='.repeat(60));
}

testOCR().catch(err => {
  console.error('Test failed:', err.message);
  console.error(err.stack);
  process.exit(1);
});

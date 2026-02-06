const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

async function testAI() {
  const fetch = (await import('node-fetch')).default;

  // Download the PDF from an existing invoice
  const pdfUrl = 'https://sorghqcpeamdfbvysafj.supabase.co/storage/v1/object/public/invoices/null/1768321423669_unassigned_INV_Unknown_TntPainting_2026-01-13.pdf';

  console.log('Downloading PDF from storage...');
  const pdfResponse = await fetch(pdfUrl);
  const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());

  // Save temporarily
  const tempPath = './temp-test-invoice.pdf';
  fs.writeFileSync(tempPath, pdfBuffer);
  console.log(`Downloaded ${pdfBuffer.length} bytes\n`);

  // Upload to AI processor
  const form = new FormData();
  form.append('file', fs.createReadStream(tempPath));
  form.append('uploaded_by', 'AI-Test');

  console.log('Uploading to AI processor...\n');

  const response = await fetch('http://localhost:3001/api/invoices/process', {
    method: 'POST',
    body: form
  });

  const j = await response.json();

  console.log('=== AI PROCESSING RESULT ===');
  console.log('Success:', j.success);
  if (j.error) console.log('Error:', j.error);
  console.log('');

  console.log('--- Extracted Data ---');
  console.log('Vendor:', j.extracted?.vendor?.companyName || '(not extracted)');
  console.log('Trade Type:', j.extracted?.vendor?.tradeType || '(not extracted)');
  console.log('Invoice #:', j.extracted?.invoiceNumber || '(not extracted)');
  console.log('Invoice Type:', j.extracted?.invoiceType || 'standard');
  console.log('Amount:', j.extracted?.totalAmount || '(not extracted)');
  console.log('Date:', j.extracted?.invoiceDate || '(not extracted)');
  console.log('');

  console.log('--- Line Items with Cost Code Suggestions ---');
  const lineItems = j.ai_extracted_data?.line_items_with_codes || j.extracted?.lineItems || [];
  if (lineItems.length > 0) {
    lineItems.forEach((item, i) => {
      console.log(`  ${i+1}. ${item.description} - $${item.amount}`);
      if (item.suggestedCostCode) {
        console.log(`     -> Suggested: ${item.suggestedCostCode.code} ${item.suggestedCostCode.name} (conf: ${item.suggestedCostCode.confidence})`);
      } else {
        console.log(`     -> No cost code suggestion`);
      }
    });
  } else {
    console.log('  (no line items extracted)');
  }
  console.log('');

  console.log('--- Suggested Allocations ---');
  if (j.suggested_allocations?.length > 0) {
    j.suggested_allocations.forEach(a => {
      console.log(`  ${a.code} ${a.name}: $${a.amount}`);
      if (a.line_item_descriptions) {
        console.log(`     From line items: ${a.line_item_descriptions.join(', ')}`);
      }
    });
  } else {
    console.log('  (none - will use trade type fallback)');
  }
  console.log('');

  console.log('--- Split Detection ---');
  console.log('Split Suggested:', j.ai_split_suggested || false);
  if (j.ai_split_data?.shouldSplit) {
    console.log('Split Reason:', j.ai_split_data.reason);
    if (j.ai_split_data.suggestedSplits) {
      console.log('Suggested Splits:', JSON.stringify(j.ai_split_data.suggestedSplits));
    }
  }
  console.log('');

  console.log('--- Confidence Scores ---');
  if (j.ai_confidence) {
    Object.entries(j.ai_confidence).forEach(([k,v]) => {
      if (typeof v === 'number') {
        console.log(`  ${k}: ${(v * 100).toFixed(0)}%`);
      }
    });
  }
  console.log('');

  console.log('--- Review Flags ---');
  console.log(j.review_flags?.length > 0 ? j.review_flags.join(', ') : '(none)');
  console.log('');

  console.log('--- Messages ---');
  j.messages?.forEach(m => console.log('  ' + m));

  // Clean up
  fs.unlinkSync(tempPath);
  if (j.invoice?.id) {
    console.log('\n--- Cleaning up test invoice ---');
    await fetch(`http://localhost:3001/api/invoices/${j.invoice.id}`, {
      method: 'DELETE'
    });
    console.log('Deleted test invoice:', j.invoice.id);
  }
}

testAI().catch(err => {
  console.error('Test failed:', err.message);
  process.exit(1);
});

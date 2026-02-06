const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

async function testAI() {
  const fetch = (await import('node-fetch')).default;

  const form = new FormData();
  form.append('file', fs.createReadStream('./tests/test-invoice.pdf'));
  form.append('uploaded_by', 'Test');

  console.log('Uploading test invoice to AI processor...\n');

  const response = await fetch('http://localhost:3001/api/invoices/process', {
    method: 'POST',
    body: form
  });

  const j = await response.json();

  console.log('=== AI PROCESSING RESULT ===');
  console.log('Success:', j.success);
  console.log('');
  console.log('--- Extracted Data ---');
  console.log('Vendor:', j.extracted?.vendor?.companyName);
  console.log('Trade Type:', j.extracted?.vendor?.tradeType);
  console.log('Invoice #:', j.extracted?.invoiceNumber);
  console.log('Invoice Type:', j.extracted?.invoiceType || '(not set)');
  console.log('Amount:', j.extracted?.totalAmount);
  console.log('Date:', j.extracted?.invoiceDate);
  console.log('');

  console.log('--- Line Items with Cost Code Suggestions ---');
  const lineItems = j.ai_extracted_data?.line_items_with_codes || j.extracted?.lineItems || [];
  if (lineItems.length > 0) {
    lineItems.forEach((item, i) => {
      console.log(`  ${i+1}. ${item.description} - $${item.amount}`);
      if (item.suggestedCostCode) {
        console.log(`     -> Suggested: ${item.suggestedCostCode.code} ${item.suggestedCostCode.name} (conf: ${item.suggestedCostCode.confidence})`);
      }
    });
  } else {
    console.log('  (none)');
  }
  console.log('');

  console.log('--- Suggested Allocations ---');
  if (j.suggested_allocations?.length > 0) {
    j.suggested_allocations.forEach(a => {
      console.log(`  ${a.code} ${a.name}: $${a.amount}`);
    });
  } else {
    console.log('  (none)');
  }
  console.log('');

  console.log('--- Split Detection ---');
  console.log('Split Suggested:', j.ai_split_suggested || false);
  if (j.ai_split_data) {
    console.log('Split Reason:', j.ai_split_data.reason);
  }
  console.log('');

  console.log('--- Confidence Scores ---');
  if (j.ai_confidence) {
    Object.entries(j.ai_confidence).forEach(([k,v]) => {
      console.log(`  ${k}: ${typeof v === 'number' ? (v * 100).toFixed(0) + '%' : v}`);
    });
  }
  console.log('');

  console.log('--- Review Flags ---');
  console.log(j.review_flags?.length > 0 ? j.review_flags.join(', ') : '(none)');
  console.log('');

  console.log('--- Messages ---');
  j.messages?.forEach(m => console.log('  ' + m));

  // Clean up - delete the test invoice
  if (j.invoice?.id) {
    console.log('\n--- Cleaning up test invoice ---');
    await fetch(`http://localhost:3001/api/invoices/${j.invoice.id}`, {
      method: 'DELETE'
    });
    console.log('Deleted test invoice:', j.invoice.id);
  }
}

testAI().catch(console.error);

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');

const API_BASE = 'http://localhost:3001';

async function processInvoice(filePath) {
  const filename = path.basename(filePath);
  console.log(`\nProcessing: ${filename}`);

  try {
    // Create form data for upload - send directly to process endpoint
    const formData = new FormData();
    formData.append('pdf', fs.createReadStream(filePath), filename);

    // Process with AI (uploads and processes in one call)
    const processRes = await axios.post(`${API_BASE}/api/invoices/process`, formData, {
      headers: {
        ...formData.getHeaders()
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      timeout: 120000 // 2 minute timeout for AI processing
    });

    const invoice = processRes.data;
    console.log(`  Created invoice: ${invoice.invoice_number || 'N/A'}`);
    console.log(`  Vendor: ${invoice.vendor?.name || 'Unknown'}`);
    console.log(`  Amount: $${invoice.amount || 0}`);
    console.log(`  Job: ${invoice.job?.name || 'Not matched'}`);
    console.log(`  Status: ${invoice.status}`);

    return invoice;
  } catch (err) {
    console.log(`  Error: ${err.response?.data?.message || err.response?.data?.error || err.message}`);
    if (err.response?.data) {
      console.log(`  Details:`, JSON.stringify(err.response.data).substring(0, 200));
    }
    return null;
  }
}

async function main() {
  const invoiceDir = 'C:\\Users\\Jake\\Downloads\\split-invoices';

  // Get all PDF files
  const files = fs.readdirSync(invoiceDir)
    .filter(f => f.endsWith('.pdf'))
    .map(f => path.join(invoiceDir, f));

  console.log(`Found ${files.length} invoices to process\n`);
  console.log('='.repeat(50));

  let processed = 0;
  let failed = 0;

  for (const file of files) {
    const result = await processInvoice(file);
    if (result) {
      processed++;
    } else {
      failed++;
    }

    // Delay between API calls to not overwhelm the AI
    await new Promise(r => setTimeout(r, 3000));
  }

  console.log('\n' + '='.repeat(50));
  console.log(`Done! Processed: ${processed}, Failed: ${failed}`);
}

main().catch(console.error);

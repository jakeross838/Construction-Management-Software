/**
 * Test script for PDF Stamper v2
 * Run with: node server/scripts/test-stamp-v2.js
 */

const fs = require('fs');
const path = require('path');
const { stampApprovalV2, stampInDrawV2, stampPaidV2 } = require('../documents/pdf-stamper-v2');

async function testStamp() {
  console.log('Testing PDF Stamper v2...\n');

  // Load the test invoice PDF
  const testPdfPath = 'C:\\Users\\jaker\\Downloads\\Ross Built Drummond 40% Delivery Invoice.pdf';

  if (!fs.existsSync(testPdfPath)) {
    console.error('Test PDF not found at:', testPdfPath);
    console.log('Please provide a test PDF path.');
    return;
  }

  const pdfBuffer = fs.readFileSync(testPdfPath);
  console.log('Loaded PDF:', testPdfPath, `(${pdfBuffer.length} bytes)`);

  // Test data matching the Progressive Cabinetry invoice
  const stampData = {
    status: 'APPROVED',
    date: '2/5/2026',
    approvedBy: 'Jake Ross',
    jobName: 'Drummond-501 74th St',
    amount: 38326.40,
    costCodes: [
      { code: '21101', name: 'Cabinetry', amount: 38326.40 },
    ],
    poNumber: 'PO-Drummond501-0004',
    poTotal: 88950,
    poBilledToDate: 0,
    isPartial: false,
  };

  console.log('\nApplying APPROVED stamp...');
  let stampedPdf = await stampApprovalV2(pdfBuffer, stampData);

  console.log('Applying IN DRAW badge...');
  stampedPdf = await stampInDrawV2(stampedPdf, 3);

  // Save the result
  const outputPath = path.join(__dirname, '..', '..', 'test-output-stamp-v2.pdf');
  fs.writeFileSync(outputPath, stampedPdf);
  console.log('\n✓ Saved stamped PDF to:', outputPath);

  // Also test PAID stamp
  console.log('\nTesting PAID watermark...');
  const paidPdf = await stampPaidV2(pdfBuffer, '2/5/2026');
  const paidOutputPath = path.join(__dirname, '..', '..', 'test-output-paid-v2.pdf');
  fs.writeFileSync(paidOutputPath, paidPdf);
  console.log('✓ Saved PAID watermark PDF to:', paidOutputPath);

  // Test partial stamp
  console.log('\nTesting PARTIAL stamp...');
  const partialData = {
    ...stampData,
    isPartial: true,
    costCodes: [
      { code: '21101', name: 'Cabinetry', amount: 25000 },
    ],
  };
  const partialPdf = await stampApprovalV2(pdfBuffer, partialData);
  const partialOutputPath = path.join(__dirname, '..', '..', 'test-output-partial-v2.pdf');
  fs.writeFileSync(partialOutputPath, partialPdf);
  console.log('✓ Saved PARTIAL stamp PDF to:', partialOutputPath);

  console.log('\n=== Test Complete ===');
  console.log('Open the output PDFs to see the new stamp design.');
}

testStamp().catch(console.error);

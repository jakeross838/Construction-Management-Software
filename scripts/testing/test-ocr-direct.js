/**
 * Direct test of OCR processing
 */

// Load environment variables
require('dotenv').config();

async function testOCRDirect() {
  const fetch = (await import('node-fetch')).default;
  const ocrProcessor = require('./server/ocr-processor');
  const pdfParse = require('pdf-parse');

  console.log('='.repeat(60));
  console.log('DIRECT OCR TEST');
  console.log('='.repeat(60));
  console.log('');

  // Download a scanned invoice
  const pdfUrl = 'https://sorghqcpeamdfbvysafj.supabase.co/storage/v1/object/public/invoices/null/1768237555703_unassigned_INV_Unknown_ParadiseFoam_2026-01-12.pdf';

  console.log('1. Downloading scanned invoice...');
  const pdfRes = await fetch(pdfUrl);
  const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer());
  console.log(`   Downloaded: ${pdfBuffer.length} bytes`);
  console.log('');

  // Test text extraction
  console.log('2. Testing text extraction...');
  try {
    const pdfData = await pdfParse(pdfBuffer);
    const text = pdfData.text || '';
    const cleanText = text.replace(/\s+/g, ' ').trim();

    console.log(`   Raw text length: ${text.length}`);
    console.log(`   Clean text length: ${cleanText.length}`);
    console.log(`   First 200 chars: "${cleanText.substring(0, 200)}"`);
    console.log('');

    // Test OCR detection
    console.log('3. Testing scanned PDF detection...');
    const isScanned = ocrProcessor.isLikelyScannedPDF(text);
    console.log(`   isLikelyScannedPDF: ${isScanned}`);
    console.log(`   MIN_TEXT_LENGTH: ${ocrProcessor.MIN_TEXT_LENGTH}`);
    console.log('');

    if (isScanned) {
      // Test image extraction
      console.log('4. Testing image extraction from PDF...');
      const images = await ocrProcessor.extractEmbeddedImages(pdfBuffer);
      console.log(`   Found ${images.length} embedded image(s)`);

      if (images.length > 0) {
        console.log(`   First image: ${images[0].width}x${images[0].height} ${images[0].mediaType}`);
        console.log('');

        // Test OCR extraction
        console.log('5. Testing OCR extraction...');
        const startTime = Date.now();
        const result = await ocrProcessor.processWithOCR(pdfBuffer, 'test.pdf');
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

        console.log(`   Processing time: ${elapsed}s`);
        console.log(`   Vendor: ${result.vendor?.companyName || '(none)'}`);
        console.log(`   Amount: $${result.totalAmount || '(none)'}`);
        console.log(`   Invoice #: ${result.invoiceNumber || '(none)'}`);
        console.log(`   Extraction method: ${result._extractionMethod || 'unknown'}`);
      } else {
        console.log('   No images found - trying pdfjs extraction...');
        const pdfjsImages = await ocrProcessor.convertPDFToImages(pdfBuffer);
        console.log(`   pdfjs found ${pdfjsImages.length} image(s)`);
      }
    } else {
      console.log('   PDF has sufficient text - OCR not needed');
    }

  } catch (err) {
    console.error('Error:', err.message);
    console.error(err.stack);
  }

  console.log('');
  console.log('='.repeat(60));
  console.log('TEST COMPLETE');
  console.log('='.repeat(60));
}

testOCRDirect().catch(err => {
  console.error('Test failed:', err.message);
  console.error(err.stack);
});

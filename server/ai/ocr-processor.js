/**
 * OCR Processor - Handles scanned/image-based PDFs using Claude Vision
 *
 * When text extraction fails or yields minimal results, this module:
 * 1. Converts PDF pages to images
 * 2. Sends images to Claude Vision API for OCR + extraction
 */

const Anthropic = require('@anthropic-ai/sdk');
const sharp = require('sharp');
const path = require('path');
const logger = require('../utils/logger').child({ module: 'ocr' });

// Initialize Anthropic client
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Minimum text length to consider extraction successful
const MIN_TEXT_LENGTH = 50;

/**
 * Check if text extraction result indicates a scanned PDF
 */
function isLikelyScannedPDF(extractedText) {
  if (!extractedText) return true;

  // Remove whitespace and check length
  const cleanText = extractedText.replace(/\s+/g, ' ').trim();

  if (cleanText.length < MIN_TEXT_LENGTH) return true;

  // Check for common OCR failure patterns
  const hasOnlyWhitespace = /^[\s\n\r]*$/.test(extractedText);
  const hasOnlyGibberish = /^[^a-zA-Z0-9]*$/.test(cleanText);

  return hasOnlyWhitespace || hasOnlyGibberish;
}

/**
 * Convert PDF buffer to PNG images using pdfjs-dist
 * Returns array of base64 encoded PNG images
 */
async function convertPDFToImages(pdfBuffer) {
  // Dynamic import for ES module
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

  const images = [];

  try {
    // Load PDF document
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(pdfBuffer),
      useSystemFonts: true,
      disableFontFace: true
    });

    const pdf = await loadingTask.promise;
    const numPages = Math.min(pdf.numPages, 5); // Limit to first 5 pages

    logger.info('Converting PDF pages to images', { numPages });

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 2.0 }); // 2x scale for better OCR

      // Create a simple canvas-like structure for rendering
      // Since we don't have canvas, we'll extract embedded images instead
      const ops = await page.getOperatorList();

      // Check for embedded images in the page
      for (let i = 0; i < ops.fnArray.length; i++) {
        if (ops.fnArray[i] === pdfjsLib.OPS.paintImageXObject) {
          const imgName = ops.argsArray[i][0];
          try {
            const img = await page.objs.get(imgName);
            if (img && img.data) {
              // Convert raw image data to PNG using sharp
              const width = img.width;
              const height = img.height;

              // Handle different image formats
              let imageBuffer;
              if (img.data instanceof Uint8ClampedArray || img.data instanceof Uint8Array) {
                // Raw RGBA data
                imageBuffer = await sharp(Buffer.from(img.data), {
                  raw: {
                    width: width,
                    height: height,
                    channels: img.data.length / (width * height)
                  }
                })
                .png()
                .toBuffer();
              }

              if (imageBuffer) {
                const base64 = imageBuffer.toString('base64');
                images.push({
                  pageNum,
                  base64,
                  mediaType: 'image/png'
                });
                logger.debug('Extracted image from page', { pageNum, width, height });
              }
            }
          } catch (imgErr) {
            // Skip images that can't be extracted
            logger.debug('Could not extract image', { imgName, error: imgErr.message });
          }
        }
      }

      page.cleanup();
    }

    await pdf.cleanup();

  } catch (err) {
    logger.error('PDF conversion error', { error: err.message });
  }

  return images;
}

/**
 * Alternative: Convert PDF to images using raw buffer analysis
 * Extracts JPEG/PNG images embedded in PDF
 */
async function extractEmbeddedImages(pdfBuffer) {
  const images = [];
  const buffer = Buffer.from(pdfBuffer);

  // JPEG markers
  const jpegStart = Buffer.from([0xFF, 0xD8, 0xFF]);
  const jpegEnd = Buffer.from([0xFF, 0xD9]);

  // PNG markers
  const pngStart = Buffer.from([0x89, 0x50, 0x4E, 0x47]);
  const pngEnd = Buffer.from([0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82]);

  // Find and extract JPEG images
  let pos = 0;
  while (pos < buffer.length - 3) {
    const jpegStartPos = buffer.indexOf(jpegStart, pos);
    if (jpegStartPos === -1) break;

    const jpegEndPos = buffer.indexOf(jpegEnd, jpegStartPos + 3);
    if (jpegEndPos === -1) {
      pos = jpegStartPos + 3;
      continue;
    }

    const imageData = buffer.slice(jpegStartPos, jpegEndPos + 2);

    // Validate it's a reasonable image size (> 1KB, < 50MB)
    if (imageData.length > 1024 && imageData.length < 50 * 1024 * 1024) {
      try {
        // Verify it's a valid image using sharp
        const metadata = await sharp(imageData).metadata();
        if (metadata.width > 100 && metadata.height > 100) {
          images.push({
            pageNum: images.length + 1,
            base64: imageData.toString('base64'),
            mediaType: 'image/jpeg',
            width: metadata.width,
            height: metadata.height
          });
          logger.debug('Found embedded JPEG', { width: metadata.width, height: metadata.height });
        }
      } catch (e) {
        // Not a valid image, skip
      }
    }

    pos = jpegEndPos + 2;
  }

  // Find and extract PNG images
  pos = 0;
  while (pos < buffer.length - 8) {
    const pngStartPos = buffer.indexOf(pngStart, pos);
    if (pngStartPos === -1) break;

    const pngEndPos = buffer.indexOf(pngEnd, pngStartPos + 8);
    if (pngEndPos === -1) {
      pos = pngStartPos + 8;
      continue;
    }

    const imageData = buffer.slice(pngStartPos, pngEndPos + 8);

    if (imageData.length > 1024 && imageData.length < 50 * 1024 * 1024) {
      try {
        const metadata = await sharp(imageData).metadata();
        if (metadata.width > 100 && metadata.height > 100) {
          images.push({
            pageNum: images.length + 1,
            base64: imageData.toString('base64'),
            mediaType: 'image/png',
            width: metadata.width,
            height: metadata.height
          });
          logger.debug('Found embedded PNG', { width: metadata.width, height: metadata.height });
        }
      } catch (e) {
        // Not a valid image, skip
      }
    }

    pos = pngEndPos + 8;
  }

  return images;
}

/**
 * Invoice extraction schema for Claude Vision
 */
const VISION_EXTRACTION_PROMPT = `You are analyzing a CONSTRUCTION INVOICE image for a home builder called "Ross Built Custom Homes".
This invoice is from a vendor/subcontractor billing Ross Built for work on a construction project.

CRITICAL: This is a CONSTRUCTION invoice - look for JOB/PROJECT references which are essential:
- Client/homeowner name (e.g., "Drummond", "Smith", "Jones") - often appears as "Ship To", "Project", "Job", "Customer"
- Job site ADDRESS (e.g., "501 74th St", "123 Main Street") - the construction site location
- PO Number or Job Number that references the project
- Project name or reference number

Extract and return ONLY a valid JSON object:
{
  "vendor": {
    "companyName": "string - the company SENDING this invoice (NOT Ross Built)",
    "email": "string or null",
    "phone": "string or null",
    "address": "string or null - vendor's business address",
    "tradeType": "string: electrical, plumbing, hvac, drywall, framing, roofing, painting, flooring, tile, concrete, masonry, landscaping, pool, cabinets, countertops, windows_doors, insulation, lumber, stucco, siding, general, other"
  },
  "invoiceNumber": "string - invoice/receipt/confirmation number",
  "invoiceDate": "string - YYYY-MM-DD format",
  "dueDate": "string or null - YYYY-MM-DD format",
  "totalAmount": "number - total amount due",
  "invoiceType": "string: 'standard' | 'credit_memo' | 'debit_memo'",
  "job": {
    "reference": "string or null - ANY job/project identifier: client name, project name, job number",
    "clientName": "string or null - homeowner/client name like 'Drummond', 'Smith' (NOT Ross Built, NOT the vendor)",
    "address": "string or null - JOB SITE address where construction work was performed (NOT vendor address)"
  },
  "lineItems": [
    {
      "description": "string",
      "quantity": "number or null",
      "unitPrice": "number or null",
      "amount": "number"
    }
  ],
  "notes": "string or null"
}

CRITICAL RULES:
1. Return ONLY the JSON object, no markdown or explanation
2. JOB IDENTIFICATION IS CRUCIAL - look carefully for:
   - "Ship To" or "Deliver To" address = job site address
   - "Project:", "Job:", "Customer:", "Client:" labels
   - Any residential address that ISN'T the vendor's address
   - Names that appear to be homeowner names (not company names)
3. DO NOT confuse customer/payer name with job reference
   - If you see "Chris Langston paid via Speedpay" - that's a PAYER, not job reference
   - Look for actual construction project references
4. The vendor is the company AT THE TOP of the invoice (who is billing)
5. Parse dates as YYYY-MM-DD
6. If this is a payment confirmation (like FPL, utility), look for the SERVICE ADDRESS
7. For lumber yards, look for "Ship To" or "Deliver To" as the job address`;

/**
 * Extract invoice data from images using Claude Vision
 */
async function extractFromImages(images, filename) {
  if (!images || images.length === 0) {
    throw new Error('No images to process');
  }

  logger.info('Sending images to Claude Vision', { imageCount: images.length });

  // Build message content with images
  const content = [];

  // Add each image
  for (const img of images.slice(0, 3)) { // Limit to 3 images
    content.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: img.mediaType,
        data: img.base64
      }
    });
  }

  // Add the extraction prompt
  content.push({
    type: 'text',
    text: VISION_EXTRACTION_PROMPT
  });

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: content
      }]
    });

    const responseText = response.content[0]?.text || '';

    // Extract JSON from response
    let jsonStr = responseText;

    // Try to find JSON in the response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }

    const extracted = JSON.parse(jsonStr);

    logger.info('Vision API extraction successful', {
      vendor: extracted.vendor?.companyName || 'unknown',
      amount: extracted.totalAmount || 0
    });

    return {
      ...extracted,
      _extractionMethod: 'vision_ocr'
    };

  } catch (err) {
    logger.error('Vision extraction error', { error: err.message });
    throw new Error(`Vision OCR failed: ${err.message}`);
  }
}

/**
 * Main OCR processing function
 * Called when text extraction fails or yields minimal results
 */
async function processWithOCR(pdfBuffer, filename) {
  logger.info('Starting OCR processing', { filename });

  // Try to extract embedded images from PDF
  let images = await extractEmbeddedImages(pdfBuffer);

  // If no embedded images found, try pdfjs extraction
  if (images.length === 0) {
    logger.debug('No embedded images found, trying pdfjs extraction');
    images = await convertPDFToImages(pdfBuffer);
  }

  if (images.length === 0) {
    throw new Error('Could not extract any images from PDF for OCR processing');
  }

  // Send images to Claude Vision for extraction
  return await extractFromImages(images, filename);
}

module.exports = {
  isLikelyScannedPDF,
  processWithOCR,
  extractEmbeddedImages,
  convertPDFToImages,
  extractFromImages,
  MIN_TEXT_LENGTH
};

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

    console.log(`[OCR] Converting ${numPages} PDF page(s) to images...`);

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
                console.log(`[OCR] Extracted image from page ${pageNum} (${width}x${height})`);
              }
            }
          } catch (imgErr) {
            // Skip images that can't be extracted
            console.log(`[OCR] Could not extract image ${imgName}: ${imgErr.message}`);
          }
        }
      }

      page.cleanup();
    }

    await pdf.cleanup();

  } catch (err) {
    console.error('[OCR] PDF conversion error:', err.message);
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
          console.log(`[OCR] Found embedded JPEG (${metadata.width}x${metadata.height})`);
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
          console.log(`[OCR] Found embedded PNG (${metadata.width}x${metadata.height})`);
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
const VISION_EXTRACTION_PROMPT = `You are analyzing a scanned invoice image. Extract all visible information and return ONLY a valid JSON object (no markdown, no explanation).

Extract these fields:
{
  "vendor": {
    "companyName": "string - vendor/company name at top of invoice",
    "email": "string or null",
    "phone": "string or null",
    "address": "string or null",
    "tradeType": "string: electrical, plumbing, hvac, drywall, framing, roofing, painting, flooring, tile, concrete, masonry, landscaping, pool, cabinets, countertops, windows_doors, insulation, stucco, siding, general, other"
  },
  "invoiceNumber": "string - invoice/receipt number",
  "invoiceDate": "string - YYYY-MM-DD format",
  "dueDate": "string or null - YYYY-MM-DD format",
  "totalAmount": "number - total amount due (positive for invoices, negative for credits)",
  "invoiceType": "string: 'standard' | 'credit_memo' | 'debit_memo'",
  "job": {
    "reference": "string or null - job name/number/reference",
    "clientName": "string or null",
    "address": "string or null - job site address"
  },
  "lineItems": [
    {
      "description": "string",
      "quantity": "number or null",
      "unitPrice": "number or null",
      "amount": "number"
    }
  ],
  "notes": "string or null - any special notes or comments"
}

Important:
- Return ONLY the JSON object, no other text
- Use null for fields you cannot find
- Parse dates as YYYY-MM-DD
- Extract ALL visible line items
- Detect trade type from vendor name, letterhead, or line items
- If this is a credit memo or refund, set invoiceType and use negative amounts`;

/**
 * Extract invoice data from images using Claude Vision
 */
async function extractFromImages(images, filename) {
  if (!images || images.length === 0) {
    throw new Error('No images to process');
  }

  console.log(`[OCR] Sending ${images.length} image(s) to Claude Vision...`);

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

    console.log(`[OCR] Successfully extracted data via Vision API`);
    console.log(`[OCR] Vendor: ${extracted.vendor?.companyName || 'unknown'}`);
    console.log(`[OCR] Amount: $${extracted.totalAmount || 0}`);

    return {
      ...extracted,
      _extractionMethod: 'vision_ocr'
    };

  } catch (err) {
    console.error('[OCR] Vision extraction error:', err.message);
    throw new Error(`Vision OCR failed: ${err.message}`);
  }
}

/**
 * Main OCR processing function
 * Called when text extraction fails or yields minimal results
 */
async function processWithOCR(pdfBuffer, filename) {
  console.log(`[OCR] Starting OCR processing for: ${filename}`);

  // Try to extract embedded images from PDF
  let images = await extractEmbeddedImages(pdfBuffer);

  // If no embedded images found, try pdfjs extraction
  if (images.length === 0) {
    console.log('[OCR] No embedded images found, trying pdfjs extraction...');
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

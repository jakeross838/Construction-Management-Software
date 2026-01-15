/**
 * Document Converter Module
 *
 * Handles conversion of various document types to formats
 * suitable for AI processing:
 * - Images (JPEG, PNG, TIFF, HEIC, WebP) → Base64 for Claude Vision
 * - Word docs (.docx, .doc) → Text extraction
 * - Excel (.xlsx, .xls) → Text extraction
 * - PDF → Pass through (handled by existing processor)
 */

const sharp = require('sharp');
const mammoth = require('mammoth');
const XLSX = require('xlsx');
const path = require('path');
const { PDFDocument } = require('pdf-lib');

// Supported file types and their categories
const FILE_TYPES = {
  // Images - will use Claude Vision directly
  IMAGE: {
    extensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.tiff', '.tif', '.heic', '.heif', '.bmp'],
    mimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/tiff', 'image/heic', 'image/heif', 'image/bmp']
  },
  // PDFs - pass through to existing processor
  PDF: {
    extensions: ['.pdf'],
    mimeTypes: ['application/pdf']
  },
  // Word documents
  WORD: {
    extensions: ['.docx', '.doc'],
    mimeTypes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword']
  },
  // Excel spreadsheets
  EXCEL: {
    extensions: ['.xlsx', '.xls', '.csv'],
    mimeTypes: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel', 'text/csv']
  }
};

/**
 * Detect file type from extension and/or mimetype
 * @param {string} filename - Original filename
 * @param {string} mimetype - File mimetype
 * @returns {string} - File type category: 'IMAGE', 'PDF', 'WORD', 'EXCEL', or 'UNKNOWN'
 */
function detectFileType(filename, mimetype) {
  const ext = path.extname(filename).toLowerCase();

  for (const [type, config] of Object.entries(FILE_TYPES)) {
    if (config.extensions.includes(ext) || config.mimeTypes.includes(mimetype)) {
      return type;
    }
  }

  return 'UNKNOWN';
}

/**
 * Get supported extensions as a string for error messages
 */
function getSupportedExtensions() {
  const allExtensions = Object.values(FILE_TYPES)
    .flatMap(config => config.extensions);
  return allExtensions.join(', ');
}

/**
 * Process an image buffer for Claude Vision API
 * - Converts to JPEG/PNG if needed
 * - Resizes if too large (max 20MB for API)
 * - Returns base64 encoded data
 *
 * @param {Buffer} buffer - Image file buffer
 * @param {string} filename - Original filename
 * @returns {Promise<{base64: string, mediaType: string, originalFormat: string}>}
 */
async function processImageForVision(buffer, filename) {
  const ext = path.extname(filename).toLowerCase();

  try {
    // Get image metadata
    const metadata = await sharp(buffer).metadata();
    console.log(`[Converter] Image: ${filename}, Format: ${metadata.format}, Size: ${metadata.width}x${metadata.height}`);

    let processedBuffer = buffer;
    let outputFormat = metadata.format;
    let mediaType = `image/${metadata.format}`;

    // Convert HEIC/HEIF to JPEG (not supported by Claude directly)
    if (['heic', 'heif'].includes(metadata.format)) {
      console.log('[Converter] Converting HEIC/HEIF to JPEG...');
      processedBuffer = await sharp(buffer).jpeg({ quality: 95 }).toBuffer();
      outputFormat = 'jpeg';
      mediaType = 'image/jpeg';
    }

    // Convert BMP/TIFF to PNG for better compatibility
    if (['bmp', 'tiff', 'tif'].includes(metadata.format)) {
      console.log(`[Converter] Converting ${metadata.format} to PNG...`);
      processedBuffer = await sharp(buffer).png().toBuffer();
      outputFormat = 'png';
      mediaType = 'image/png';
    }

    // Resize if image is very large (> 4000px in either dimension)
    // Claude handles up to ~20MB but smaller is faster
    if (metadata.width > 4000 || metadata.height > 4000) {
      console.log('[Converter] Resizing large image...');
      processedBuffer = await sharp(processedBuffer)
        .resize(4000, 4000, { fit: 'inside', withoutEnlargement: true })
        .toBuffer();
    }

    // Check final size - if still > 10MB, compress more
    if (processedBuffer.length > 10 * 1024 * 1024) {
      console.log('[Converter] Compressing large image...');
      processedBuffer = await sharp(processedBuffer)
        .jpeg({ quality: 80 })
        .toBuffer();
      outputFormat = 'jpeg';
      mediaType = 'image/jpeg';
    }

    return {
      base64: processedBuffer.toString('base64'),
      mediaType,
      originalFormat: metadata.format,
      width: metadata.width,
      height: metadata.height
    };
  } catch (err) {
    console.error('[Converter] Image processing error:', err.message);
    throw new Error(`Failed to process image: ${err.message}`);
  }
}

/**
 * Convert image to PDF for storage
 * @param {Buffer} imageBuffer - Image file buffer
 * @param {string} filename - Original filename
 * @returns {Promise<Buffer>} - PDF buffer
 */
async function convertImageToPDF(imageBuffer, filename) {
  try {
    // First process image (resize if needed, convert format)
    const processed = await processImageForVision(imageBuffer, filename);

    // Determine if JPEG or PNG
    const isJpeg = processed.mediaType === 'image/jpeg';
    const imageBytes = Buffer.from(processed.base64, 'base64');

    // Create PDF with the image
    const pdfDoc = await PDFDocument.create();

    let image;
    if (isJpeg) {
      image = await pdfDoc.embedJpg(imageBytes);
    } else {
      image = await pdfDoc.embedPng(imageBytes);
    }

    // Calculate page size based on image dimensions (fit to letter size max)
    const maxWidth = 612; // 8.5 inches at 72 dpi
    const maxHeight = 792; // 11 inches at 72 dpi

    let width = image.width;
    let height = image.height;

    // Scale down if larger than letter size
    if (width > maxWidth || height > maxHeight) {
      const scaleX = maxWidth / width;
      const scaleY = maxHeight / height;
      const scale = Math.min(scaleX, scaleY);
      width = width * scale;
      height = height * scale;
    }

    // Add page with image
    const page = pdfDoc.addPage([width, height]);
    page.drawImage(image, {
      x: 0,
      y: 0,
      width,
      height
    });

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
  } catch (err) {
    console.error('[Converter] Image to PDF conversion error:', err.message);
    throw new Error(`Failed to convert image to PDF: ${err.message}`);
  }
}

/**
 * Extract text from Word document (.docx)
 * @param {Buffer} buffer - Word document buffer
 * @param {string} filename - Original filename
 * @returns {Promise<{text: string, html: string}>}
 */
async function extractTextFromWord(buffer, filename) {
  try {
    console.log(`[Converter] Extracting text from Word doc: ${filename}`);

    // mammoth extracts text and HTML from .docx files
    const result = await mammoth.extractRawText({ buffer });
    const htmlResult = await mammoth.convertToHtml({ buffer });

    console.log(`[Converter] Extracted ${result.value.length} characters from Word doc`);

    return {
      text: result.value,
      html: htmlResult.value,
      messages: result.messages.concat(htmlResult.messages)
    };
  } catch (err) {
    console.error('[Converter] Word extraction error:', err.message);
    throw new Error(`Failed to extract text from Word document: ${err.message}`);
  }
}

/**
 * Extract text/data from Excel file
 * @param {Buffer} buffer - Excel file buffer
 * @param {string} filename - Original filename
 * @returns {Promise<{text: string, sheets: Array}>}
 */
async function extractTextFromExcel(buffer, filename) {
  try {
    console.log(`[Converter] Extracting data from Excel: ${filename}`);

    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheets = [];
    let fullText = '';

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];

      // Convert to JSON for structured data
      const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      // Convert to text for AI processing
      const textData = XLSX.utils.sheet_to_txt(sheet);

      sheets.push({
        name: sheetName,
        data: jsonData,
        text: textData
      });

      fullText += `\n=== Sheet: ${sheetName} ===\n${textData}\n`;
    }

    console.log(`[Converter] Extracted ${sheets.length} sheets, ${fullText.length} characters`);

    return {
      text: fullText.trim(),
      sheets,
      sheetCount: sheets.length
    };
  } catch (err) {
    console.error('[Converter] Excel extraction error:', err.message);
    throw new Error(`Failed to extract data from Excel: ${err.message}`);
  }
}

/**
 * Master conversion function - routes to appropriate converter
 * @param {Buffer} buffer - File buffer
 * @param {string} filename - Original filename
 * @param {string} mimetype - File mimetype
 * @returns {Promise<Object>} - Conversion result with type-specific data
 */
async function convertDocument(buffer, filename, mimetype) {
  const fileType = detectFileType(filename, mimetype);

  console.log(`[Converter] Processing ${filename} (${mimetype}) -> Type: ${fileType}`);

  const result = {
    originalFilename: filename,
    originalMimetype: mimetype,
    fileType,
    success: false,
    data: null,
    pdfBuffer: null,  // PDF version for storage
    error: null
  };

  try {
    switch (fileType) {
      case 'PDF':
        // Pass through - no conversion needed
        result.data = { type: 'pdf', buffer };
        result.pdfBuffer = buffer;
        result.success = true;
        break;

      case 'IMAGE':
        // Process for Claude Vision + convert to PDF for storage
        const imageData = await processImageForVision(buffer, filename);
        const imagePdf = await convertImageToPDF(buffer, filename);
        result.data = {
          type: 'image',
          base64: imageData.base64,
          mediaType: imageData.mediaType,
          originalFormat: imageData.originalFormat,
          dimensions: { width: imageData.width, height: imageData.height }
        };
        result.pdfBuffer = imagePdf;
        result.success = true;
        break;

      case 'WORD':
        // Extract text from Word doc
        const wordData = await extractTextFromWord(buffer, filename);
        result.data = {
          type: 'word',
          text: wordData.text,
          html: wordData.html
        };
        // For Word docs, we'll create a simple text-based PDF or just store the original
        // For now, we'll note that AI will process the text directly
        result.pdfBuffer = null; // Original will be stored as-is
        result.success = true;
        break;

      case 'EXCEL':
        // Extract data from Excel
        const excelData = await extractTextFromExcel(buffer, filename);
        result.data = {
          type: 'excel',
          text: excelData.text,
          sheets: excelData.sheets,
          sheetCount: excelData.sheetCount
        };
        result.pdfBuffer = null; // Original will be stored as-is
        result.success = true;
        break;

      default:
        result.error = `Unsupported file type. Supported formats: ${getSupportedExtensions()}`;
        break;
    }
  } catch (err) {
    result.error = err.message;
  }

  return result;
}

/**
 * Check if a file type is supported
 */
function isSupported(filename, mimetype) {
  return detectFileType(filename, mimetype) !== 'UNKNOWN';
}

module.exports = {
  convertDocument,
  detectFileType,
  isSupported,
  getSupportedExtensions,
  processImageForVision,
  convertImageToPDF,
  extractTextFromWord,
  extractTextFromExcel,
  FILE_TYPES
};

/**
 * Contract PDF Generator
 * Creates professional contract PDFs with signature placeholders
 */

const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

// Brand colors
const BRAND_COLOR = rgb(0.29, 0.4, 0.45); // #4A6672 slate teal
const TEXT_DARK = rgb(0.2, 0.2, 0.2);
const TEXT_LIGHT = rgb(0.5, 0.5, 0.5);
const BORDER_COLOR = rgb(0.85, 0.85, 0.85);

// Page constants
const PAGE_WIDTH = 612;  // Letter size
const PAGE_HEIGHT = 792;
const MARGIN = 50;
const CONTENT_WIDTH = PAGE_WIDTH - (2 * MARGIN);
const LINE_HEIGHT = 14;
const PARAGRAPH_SPACING = 8;

/**
 * Load the company logo
 */
async function loadLogo() {
  const logoPath = path.join(__dirname, '..', 'assets', 'ross-built-logo.png');
  try {
    return fs.readFileSync(logoPath);
  } catch (err) {
    console.warn('Could not load logo:', err.message);
    return null;
  }
}

/**
 * Check if we need a new page
 */
function checkPageBreak(pdfDoc, currentPage, currentY, neededSpace) {
  const BOTTOM_MARGIN = 70;
  if (currentY - neededSpace < BOTTOM_MARGIN) {
    const newPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    return { page: newPage, y: PAGE_HEIGHT - MARGIN };
  }
  return { page: currentPage, y: currentY };
}

/**
 * Draw a horizontal line
 */
function drawLine(page, y, startX = MARGIN, endX = PAGE_WIDTH - MARGIN) {
  page.drawLine({
    start: { x: startX, y },
    end: { x: endX, y },
    thickness: 0.5,
    color: BORDER_COLOR
  });
}

/**
 * Word wrap text to fit within a given width
 */
function wrapText(text, font, fontSize, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine + (currentLine ? ' ' : '') + word;
    const testWidth = font.widthOfTextAtSize(testLine, fontSize);

    if (testWidth > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

/**
 * Parse contract content (HTML or plain text) into structured paragraphs
 */
function parseContent(content) {
  // Remove HTML tags but preserve structure
  let text = content
    // Convert common HTML elements
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<p[^>]*>/gi, '')
    .replace(/<\/div>/gi, '\n')
    .replace(/<div[^>]*>/gi, '')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<\/ul>/gi, '\n')
    .replace(/<ul[^>]*>/gi, '')
    .replace(/<\/ol>/gi, '\n')
    .replace(/<ol[^>]*>/gi, '')
    .replace(/<h[1-6][^>]*>/gi, '\n**')
    .replace(/<\/h[1-6]>/gi, '**\n')
    .replace(/<strong>/gi, '**')
    .replace(/<\/strong>/gi, '**')
    .replace(/<b>/gi, '**')
    .replace(/<\/b>/gi, '**')
    // Remove remaining tags
    .replace(/<[^>]+>/g, '')
    // Decode HTML entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    // Clean up whitespace
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return text;
}

/**
 * Draw text with bold support (marked with ** delimiters)
 */
async function drawFormattedText(pdfDoc, page, text, x, y, font, boldFont, fontSize, maxWidth, color = TEXT_DARK) {
  const parts = text.split(/(\*\*[^*]+\*\*)/);
  let currentX = x;
  let currentY = y;

  for (const part of parts) {
    if (part.startsWith('**') && part.endsWith('**')) {
      // Bold text
      const boldText = part.slice(2, -2);
      const lines = wrapText(boldText, boldFont, fontSize, maxWidth - (currentX - x));

      for (let i = 0; i < lines.length; i++) {
        if (i > 0) {
          currentY -= LINE_HEIGHT;
          currentX = x;
        }
        ({ page, y: currentY } = checkPageBreak(pdfDoc, page, currentY, LINE_HEIGHT));
        page.drawText(lines[i], { x: currentX, y: currentY, font: boldFont, size: fontSize, color });
        currentX = x + boldFont.widthOfTextAtSize(lines[i], fontSize);
      }
    } else if (part.trim()) {
      // Normal text
      const lines = wrapText(part, font, fontSize, maxWidth - (currentX - x));

      for (let i = 0; i < lines.length; i++) {
        if (i > 0) {
          currentY -= LINE_HEIGHT;
          currentX = x;
        }
        ({ page, y: currentY } = checkPageBreak(pdfDoc, page, currentY, LINE_HEIGHT));
        page.drawText(lines[i], { x: currentX, y: currentY, font, size: fontSize, color });
        currentX = x + font.widthOfTextAtSize(lines[i], fontSize);
      }
    }
  }

  return { page, y: currentY };
}

/**
 * Generate contract PDF
 * @param {Object} data - Contract data
 * @returns {Promise<Buffer>} - PDF buffer
 */
async function generateContractPDF(data) {
  const {
    company = {},      // Company branding info
    contract = {},     // Contract details (name, number, type)
    content = '',      // The contract content (with resolved variables)
    signers = [],      // Array of { name, role, email }
    includeSignatureLines = true,
    includeFlorida713Disclosure = false
  } = data;

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Load logo
  let logoImage = null;
  const logoBytes = await loadLogo();
  if (logoBytes) {
    try {
      logoImage = await pdfDoc.embedPng(logoBytes);
    } catch (err) {
      console.warn('Could not embed logo:', err.message);
    }
  }

  // First page
  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  // === HEADER WITH LOGO AND COMPANY INFO ===
  if (logoImage) {
    const logoDims = logoImage.scale(0.2);
    page.drawImage(logoImage, {
      x: MARGIN,
      y: y - logoDims.height,
      width: logoDims.width,
      height: logoDims.height
    });
    // Company info to the right of logo
    const textX = MARGIN + logoDims.width + 15;
    page.drawText(company.company_name || 'Your Company', {
      x: textX, y: y - 12, font: boldFont, size: 12, color: BRAND_COLOR
    });
    page.drawText(company.address || '', {
      x: textX, y: y - 25, font, size: 8, color: TEXT_LIGHT
    });
    page.drawText(`${company.phone || ''} | ${company.email || ''}`, {
      x: textX, y: y - 36, font, size: 8, color: TEXT_LIGHT
    });
    if (company.license_number) {
      page.drawText(`License: ${company.license_number}`, {
        x: textX, y: y - 47, font, size: 7, color: TEXT_LIGHT
      });
    }
    y -= Math.max(logoDims.height, 55) + 15;
  } else {
    // No logo - just text header
    page.drawText(company.company_name || 'Your Company', {
      x: MARGIN, y, font: boldFont, size: 14, color: BRAND_COLOR
    });
    y -= 35;
  }

  // === CONTRACT TITLE ===
  drawLine(page, y);
  y -= 25;

  const contractTitle = contract.name || 'CONSTRUCTION CONTRACT';
  const titleWidth = boldFont.widthOfTextAtSize(contractTitle, 16);
  page.drawText(contractTitle, {
    x: (PAGE_WIDTH - titleWidth) / 2, y, font: boldFont, size: 16, color: TEXT_DARK
  });

  // Contract number on right
  if (contract.contract_number) {
    const numText = contract.contract_number;
    const numWidth = font.widthOfTextAtSize(numText, 10);
    page.drawText(numText, {
      x: PAGE_WIDTH - MARGIN - numWidth, y: y + 2, font, size: 10, color: TEXT_LIGHT
    });
  }
  y -= 30;

  // Date
  const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  page.drawText(`Date: ${dateStr}`, {
    x: MARGIN, y, font, size: 10, color: TEXT_DARK
  });
  y -= 25;

  drawLine(page, y);
  y -= 20;

  // === FLORIDA LIEN LAW DISCLOSURE (if applicable) ===
  if (includeFlorida713Disclosure) {
    ({ page, y } = checkPageBreak(pdfDoc, page, y, 200));

    page.drawText('IMPORTANT NOTICE TO OWNER', {
      x: MARGIN, y, font: boldFont, size: 11, color: rgb(0.8, 0.2, 0.2)
    });
    y -= 18;

    const disclosureText = `Florida Construction Lien Law (Chapter 713, Florida Statutes) allows contractors, subcontractors, and material suppliers to place liens against your property for unpaid work or materials, even if you have paid your general contractor. To protect yourself:

• Require your contractor to provide a list of all subcontractors and suppliers
• Require lien releases before making final payment
• Consider joint check payments to ensure subcontractors are paid

You have the right to receive a copy of any Notice to Owner served on you. By signing below, you acknowledge receipt of this disclosure.`;

    const disclosureLines = disclosureText.split('\n');
    for (const line of disclosureLines) {
      const wrappedLines = wrapText(line, font, 9, CONTENT_WIDTH - 20);
      for (const wrappedLine of wrappedLines) {
        ({ page, y } = checkPageBreak(pdfDoc, page, y, LINE_HEIGHT));
        page.drawText(wrappedLine, {
          x: MARGIN + 10, y, font, size: 9, color: TEXT_DARK
        });
        y -= 12;
      }
      y -= 4;
    }
    y -= 10;
    drawLine(page, y);
    y -= 20;
  }

  // === CONTRACT CONTENT ===
  const parsedContent = parseContent(content);
  const paragraphs = parsedContent.split('\n\n');

  for (const paragraph of paragraphs) {
    if (!paragraph.trim()) continue;

    const lines = paragraph.split('\n');
    for (const line of lines) {
      if (!line.trim()) continue;

      ({ page, y } = await drawFormattedText(
        pdfDoc, page, line.trim(), MARGIN, y, font, boldFont, 10, CONTENT_WIDTH
      ));
      y -= LINE_HEIGHT;
    }
    y -= PARAGRAPH_SPACING;
  }

  // === SIGNATURE SECTION ===
  if (includeSignatureLines && signers.length > 0) {
    ({ page, y } = checkPageBreak(pdfDoc, page, y, 150));
    y -= 30;
    drawLine(page, y);
    y -= 25;

    page.drawText('SIGNATURES', {
      x: MARGIN, y, font: boldFont, size: 12, color: TEXT_DARK
    });
    y -= 20;

    page.drawText('By signing below, the parties agree to be bound by the terms of this contract.', {
      x: MARGIN, y, font, size: 9, color: TEXT_LIGHT
    });
    y -= 30;

    // Two-column layout for signatures
    const signerWidth = (CONTENT_WIDTH - 40) / 2;
    let col = 0;

    for (const signer of signers) {
      const xOffset = col === 0 ? MARGIN : MARGIN + signerWidth + 40;

      if (col === 0) {
        ({ page, y } = checkPageBreak(pdfDoc, page, y, 80));
      }

      // Role/Title
      page.drawText(signer.role || 'Signer', {
        x: xOffset, y, font: boldFont, size: 10, color: TEXT_DARK
      });
      y -= (col === 0 ? 0 : 0); // Keep same y for second column

      const sigY = col === 0 ? y - 15 : y - 15;

      // Signature line
      page.drawLine({
        start: { x: xOffset, y: sigY },
        end: { x: xOffset + signerWidth - 20, y: sigY },
        thickness: 1,
        color: TEXT_DARK
      });
      page.drawText('Signature', {
        x: xOffset, y: sigY - 12, font, size: 8, color: TEXT_LIGHT
      });

      // Print name line
      page.drawLine({
        start: { x: xOffset, y: sigY - 35 },
        end: { x: xOffset + signerWidth - 20, y: sigY - 35 },
        thickness: 0.5,
        color: BORDER_COLOR
      });
      if (signer.name) {
        page.drawText(signer.name, {
          x: xOffset, y: sigY - 33, font, size: 9, color: TEXT_DARK
        });
      }
      page.drawText('Print Name', {
        x: xOffset, y: sigY - 47, font, size: 8, color: TEXT_LIGHT
      });

      // Date line
      page.drawLine({
        start: { x: xOffset, y: sigY - 65 },
        end: { x: xOffset + 100, y: sigY - 65 },
        thickness: 0.5,
        color: BORDER_COLOR
      });
      page.drawText('Date', {
        x: xOffset, y: sigY - 77, font, size: 8, color: TEXT_LIGHT
      });

      col++;
      if (col >= 2) {
        col = 0;
        y -= 100;
      }
    }

    if (col !== 0) {
      y -= 100;
    }
  }

  // === PAGE NUMBERS ===
  const pages = pdfDoc.getPages();
  const totalPages = pages.length;
  for (let i = 0; i < totalPages; i++) {
    const pg = pages[i];
    const pageNumText = `Page ${i + 1} of ${totalPages}`;
    const pageNumWidth = font.widthOfTextAtSize(pageNumText, 8);
    pg.drawText(pageNumText, {
      x: (PAGE_WIDTH - pageNumWidth) / 2,
      y: 25,
      font,
      size: 8,
      color: TEXT_LIGHT
    });
  }

  return Buffer.from(await pdfDoc.save());
}

/**
 * Embed signature image into a PDF
 * @param {Buffer} pdfBuffer - Original PDF buffer
 * @param {Object} signature - Signature data { data: base64, x, y, page, width, height }
 * @returns {Promise<Buffer>} - Modified PDF buffer
 */
async function embedSignature(pdfBuffer, signature) {
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const pages = pdfDoc.getPages();

  const pageIndex = signature.page || 0;
  if (pageIndex >= pages.length) {
    throw new Error('Invalid page index for signature');
  }

  const page = pages[pageIndex];

  // Decode base64 signature image
  const signatureBytes = Buffer.from(signature.data.replace(/^data:image\/\w+;base64,/, ''), 'base64');

  // Try to embed as PNG first, fall back to JPEG
  let signatureImage;
  try {
    signatureImage = await pdfDoc.embedPng(signatureBytes);
  } catch {
    try {
      signatureImage = await pdfDoc.embedJpg(signatureBytes);
    } catch {
      throw new Error('Could not embed signature image');
    }
  }

  // Draw signature on page
  const width = signature.width || 150;
  const height = signature.height || 50;
  const x = signature.x || MARGIN;
  const y = signature.y || 200;

  page.drawImage(signatureImage, { x, y, width, height });

  return Buffer.from(await pdfDoc.save());
}

module.exports = {
  generateContractPDF,
  embedSignature
};

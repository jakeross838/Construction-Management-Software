/**
 * PDF Stamping Module v3
 * Clean, minimal approval stamps designed by Gemini
 *
 * Design features:
 * - Left accent strip for status color
 * - Status + Amount on same line
 * - Single thin divider
 * - Compact details block
 * - Subtle footer
 */

const { PDFDocument, rgb, StandardFonts, degrees } = require('pdf-lib');
const logger = require('../utils/logger').child({ module: 'pdf-stamper-v3' });

// Brand colors (rgb 0-1 scale)
const COLORS = {
  green: rgb(0.2, 0.53, 0.33),       // #338855 - Approved
  slate: rgb(0.29, 0.4, 0.45),       // #4A6672 - Primary/Brand
  amber: rgb(0.7, 0.55, 0.13),       // #B38C20 - Warning/Partial
  orange: rgb(0.85, 0.55, 0.13),     // #D98C20 - Needs Review
  blue: rgb(0.35, 0.54, 0.75),       // #598BC0 - Pending
  purple: rgb(0.4, 0.3, 0.6),        // #664D99 - Split
  dark: rgb(0.2, 0.2, 0.2),          // #333333 - Primary text
  gray: rgb(0.5, 0.5, 0.5),          // #808080 - Secondary text
  lightGray: rgb(0.8, 0.8, 0.8),     // #CCCCCC - Divider lines
  white: rgb(1, 1, 1),
};

// Stamp dimensions
const STAMP = {
  width: 220,
  height: 115,
  padding: 12,
  accentWidth: 6,
};

/**
 * Format currency
 */
function formatMoney(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2
  }).format(amount || 0);
}

/**
 * Format compact money (e.g., $38K)
 */
function formatMoneyCompact(amount) {
  const num = parseFloat(amount || 0);
  if (num >= 1000) {
    return '$' + Math.round(num / 1000) + 'K';
  }
  return formatMoney(amount);
}

/**
 * Get stamp position based on page rotation
 */
function getStampPosition(page, stampWidth, stampHeight) {
  const { width, height } = page.getSize();
  const rotation = page.getRotation().angle;
  const margin = 15;

  switch (rotation) {
    case 90:
      return { x: margin, y: height - margin - stampWidth, rotate: degrees(90) };
    case 180:
      return { x: margin, y: margin, rotate: degrees(180) };
    case 270:
      return { x: width - margin - stampHeight, y: margin, rotate: degrees(270) };
    default: // 0
      return { x: width - margin - stampWidth, y: height - margin - stampHeight, rotate: degrees(0) };
  }
}

/**
 * Get status color
 */
function getStatusColor(status) {
  const s = (status || '').toLowerCase();
  if (s.includes('approved')) return COLORS.green;
  if (s.includes('partial')) return COLORS.amber;
  if (s.includes('review') || s.includes('needs')) return COLORS.orange;
  if (s.includes('pending') || s.includes('ready')) return COLORS.blue;
  if (s.includes('split')) return COLORS.purple;
  return COLORS.slate;
}

/**
 * Stamp an approved invoice with clean minimal design
 *
 * @param {Buffer} pdfBuffer - Original PDF
 * @param {Object} stampData - Stamp information
 * @returns {Promise<Buffer>} Stamped PDF
 */
async function stampApprovalV3(pdfBuffer, stampData) {
  const {
    status = 'APPROVED',
    date,
    approvedBy,
    jobName,
    amount,
    costCodes = [],
    poNumber,
    poTotal,
    poBilledToDate = 0,
    isPartial = false,
  } = stampData;

  try {
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const pages = pdfDoc.getPages();
    const page = pages[0];

    const pos = getStampPosition(page, STAMP.width, STAMP.height);
    const startX = pos.x;
    const startY = pos.y;

    // Determine status text and color
    const statusText = isPartial ? 'PARTIAL' : status.toUpperCase();
    const accentColor = isPartial ? COLORS.amber : getStatusColor(status);

    // 1. White background
    page.drawRectangle({
      x: startX,
      y: startY,
      width: STAMP.width,
      height: STAMP.height,
      color: COLORS.white,
    });

    // 2. Left accent strip
    page.drawRectangle({
      x: startX,
      y: startY,
      width: STAMP.accentWidth,
      height: STAMP.height,
      color: accentColor,
    });

    // 3. Status + Amount (same line)
    const contentX = startX + STAMP.padding;
    let currentY = startY + STAMP.height - 22;

    page.drawText(statusText, {
      x: contentX,
      y: currentY,
      size: 12,
      font: helveticaBold,
      color: accentColor,
    });

    const amountText = formatMoney(amount);
    const amountWidth = helveticaBold.widthOfTextAtSize(amountText, 12);
    page.drawText(amountText, {
      x: startX + STAMP.width - STAMP.padding - amountWidth,
      y: currentY,
      size: 12,
      font: helveticaBold,
      color: COLORS.dark,
    });

    // 4. Job name
    currentY -= 14;
    const jobText = jobName || 'No Job';
    page.drawText(jobText.substring(0, 28), {
      x: contentX,
      y: currentY,
      size: 9,
      font: helveticaBold,
      color: COLORS.slate,
    });

    // 5. Divider line
    currentY -= 8;
    page.drawLine({
      start: { x: contentX, y: currentY },
      end: { x: startX + STAMP.width - STAMP.padding, y: currentY },
      thickness: 0.5,
      color: COLORS.lightGray,
    });

    // 6. Details block
    currentY -= 14;
    const lineHeight = 12;

    // Cost code (first one if multiple)
    if (costCodes.length > 0) {
      const cc = costCodes[0];
      const codeText = `${cc.code} ${cc.name}`.substring(0, 32);
      page.drawText(codeText, {
        x: contentX,
        y: currentY,
        size: 8,
        font: helvetica,
        color: COLORS.dark,
      });
      currentY -= lineHeight;
    }

    // PO reference
    if (poNumber) {
      page.drawText(poNumber.substring(0, 28), {
        x: contentX,
        y: currentY,
        size: 8,
        font: helvetica,
        color: COLORS.dark,
      });
      currentY -= lineHeight;

      // PO progress
      if (poTotal) {
        const billed = poBilledToDate + (amount || 0);
        const pct = Math.round((billed / poTotal) * 100);
        const progressText = `${pct}% billed (${formatMoneyCompact(billed)} of ${formatMoneyCompact(poTotal)})`;
        page.drawText(progressText, {
          x: contentX,
          y: currentY,
          size: 8,
          font: helvetica,
          color: COLORS.gray,
        });
      }
    }

    // 7. Footer (date + approver)
    const footerY = startY + 10;
    const footerText = `${date || 'N/A'} • ${approvedBy || 'System'}`;
    page.drawText(footerText, {
      x: contentX,
      y: footerY,
      size: 7,
      font: helvetica,
      color: COLORS.gray,
    });

    return Buffer.from(await pdfDoc.save());
  } catch (error) {
    logger.error('Failed to stamp PDF', { error: error.message });
    throw error;
  }
}

/**
 * Add "IN DRAW" badge to bottom-right
 */
async function stampInDrawV3(pdfBuffer, drawNumber) {
  try {
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const pages = pdfDoc.getPages();
    const page = pages[0];
    const { width, height } = page.getSize();

    const text = `DRAW #${drawNumber}`;
    const fontSize = 8;
    const textWidth = helveticaBold.widthOfTextAtSize(text, fontSize);
    const padding = 6;
    const badgeWidth = textWidth + padding * 2;
    const badgeHeight = 16;

    const x = width - badgeWidth - 15;
    const y = 15;

    // Badge background
    page.drawRectangle({
      x,
      y,
      width: badgeWidth,
      height: badgeHeight,
      color: COLORS.slate,
    });

    // Badge text
    page.drawText(text, {
      x: x + padding,
      y: y + 4,
      size: fontSize,
      font: helveticaBold,
      color: COLORS.white,
    });

    return Buffer.from(await pdfDoc.save());
  } catch (error) {
    logger.error('Failed to add IN DRAW badge', { error: error.message });
    throw error;
  }
}

/**
 * Add "PAID" watermark
 */
async function stampPaidV3(pdfBuffer, paidDate) {
  try {
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const pages = pdfDoc.getPages();
    const page = pages[0];
    const { width, height } = page.getSize();

    // Diagonal PAID watermark
    const text = 'PAID';
    const fontSize = 72;
    const textWidth = helveticaBold.widthOfTextAtSize(text, fontSize);

    page.drawText(text, {
      x: (width - textWidth) / 2,
      y: height / 2,
      size: fontSize,
      font: helveticaBold,
      color: COLORS.green,
      opacity: 0.15,
      rotate: degrees(-30),
    });

    // Small badge at bottom
    const badgeText = `Paid: ${paidDate || 'N/A'}`;
    const badgeFontSize = 8;
    const badgeWidth = helveticaBold.widthOfTextAtSize(badgeText, badgeFontSize) + 12;

    page.drawRectangle({
      x: 15,
      y: 15,
      width: badgeWidth,
      height: 16,
      color: COLORS.green,
    });

    page.drawText(badgeText, {
      x: 21,
      y: 19,
      size: badgeFontSize,
      font: helveticaBold,
      color: COLORS.white,
    });

    return Buffer.from(await pdfDoc.save());
  } catch (error) {
    logger.error('Failed to add PAID watermark', { error: error.message });
    throw error;
  }
}

module.exports = {
  stampApprovalV3,
  stampInDrawV3,
  stampPaidV3,
  // Expose colors for testing
  COLORS,
  STAMP,
};

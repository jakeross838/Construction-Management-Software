/**
 * PDF Stamping Module v2
 * Professional approval stamps with Ross Built branding
 *
 * Design improvements:
 * - Header bar with brand color
 * - Progress bar for PO billing
 * - Better visual hierarchy
 * - Section dividers
 * - Optional logo integration
 */

const { PDFDocument, rgb, StandardFonts, degrees } = require('pdf-lib');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger').child({ module: 'pdf-stamper-v2' });

// Brand colors
const COLORS = {
  brand: rgb(0.29, 0.4, 0.45),        // #4A6672 slate teal
  brandLight: rgb(0.35, 0.48, 0.53),  // Lighter teal for accents
  success: rgb(0.2, 0.53, 0.33),      // #338855 green
  successLight: rgb(0.85, 0.95, 0.88),// Light green background
  warning: rgb(0.7, 0.55, 0.13),      // #B38C20 amber
  warningLight: rgb(0.98, 0.95, 0.85),// Light amber background
  review: rgb(0.85, 0.55, 0.13),      // #D98C20 orange
  reviewLight: rgb(0.98, 0.92, 0.85), // Light orange background
  pending: rgb(0.35, 0.54, 0.75),     // #598BC0 blue
  pendingLight: rgb(0.9, 0.94, 0.98), // Light blue background
  split: rgb(0.4, 0.3, 0.6),          // #664D99 purple
  splitLight: rgb(0.94, 0.92, 0.97),  // Light purple background
  textDark: rgb(0.13, 0.13, 0.13),    // #222222
  textMedium: rgb(0.4, 0.4, 0.4),     // #666666
  textLight: rgb(0.6, 0.6, 0.6),      // #999999
  white: rgb(1, 1, 1),
  border: rgb(0.85, 0.85, 0.85),
  divider: rgb(0.9, 0.9, 0.9),
  progressBg: rgb(0.92, 0.92, 0.92),
  progressFill: rgb(0.29, 0.4, 0.45), // Brand color for progress
};

// Cache for logo image
let logoImageCache = null;

/**
 * Load the Ross Built logo for embedding
 */
async function loadLogo() {
  if (logoImageCache) return logoImageCache;

  const logoPath = path.join(__dirname, '..', 'assets', 'ross-built-logo.png');
  try {
    const logoBytes = fs.readFileSync(logoPath);
    logoImageCache = logoBytes;
    return logoBytes;
  } catch (err) {
    logger.warn('Could not load logo', { error: err.message });
    return null;
  }
}

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
 * Format compact money (no cents if whole number)
 */
function formatMoneyCompact(amount) {
  const num = parseFloat(amount || 0);
  if (num % 1 === 0 && num >= 1000) {
    return '$' + (num / 1000).toFixed(0) + 'K';
  }
  return formatMoney(amount);
}

/**
 * Draw a rounded rectangle (approximation using lines)
 */
function drawRoundedRect(page, x, y, width, height, radius, options = {}) {
  const { color, borderColor, borderWidth = 1, opacity = 1 } = options;

  // For simplicity, draw a regular rectangle with slightly inset corners
  // pdf-lib doesn't have native rounded rect, so we use a filled rect
  if (color) {
    page.drawRectangle({
      x, y, width, height,
      color,
      opacity,
    });
  }

  if (borderColor) {
    page.drawRectangle({
      x, y, width, height,
      borderColor,
      borderWidth,
      opacity,
    });
  }
}

/**
 * Draw a progress bar
 */
function drawProgressBar(page, x, y, width, height, percentage, options = {}) {
  const { bgColor = COLORS.progressBg, fillColor = COLORS.progressFill } = options;
  const pct = Math.min(100, Math.max(0, percentage)) / 100;

  // Background
  page.drawRectangle({
    x, y, width, height,
    color: bgColor,
  });

  // Fill
  if (pct > 0) {
    page.drawRectangle({
      x, y,
      width: width * pct,
      height,
      color: fillColor,
    });
  }
}

/**
 * Draw a horizontal divider line
 */
function drawDivider(page, x, y, width, options = {}) {
  const { color = COLORS.divider, thickness = 0.5 } = options;
  page.drawLine({
    start: { x, y },
    end: { x: x + width, y },
    thickness,
    color,
  });
}

/**
 * Get status styling based on status type
 */
function getStatusStyle(status, isPartial = false) {
  if (isPartial) {
    return {
      color: COLORS.warning,
      bgColor: COLORS.warningLight,
      borderColor: rgb(0.9, 0.8, 0.5),
      label: 'PARTIAL'
    };
  }

  switch (status?.toUpperCase()) {
    case 'APPROVED':
      return {
        color: COLORS.success,
        bgColor: COLORS.successLight,
        borderColor: rgb(0.7, 0.85, 0.75),
        label: 'APPROVED'
      };
    case 'NEEDS_REVIEW':
    case 'NEEDS REVIEW':
      return {
        color: COLORS.review,
        bgColor: COLORS.reviewLight,
        borderColor: rgb(0.9, 0.8, 0.6),
        label: 'NEEDS REVIEW'
      };
    case 'READY_FOR_APPROVAL':
    case 'READY FOR APPROVAL':
      return {
        color: COLORS.pending,
        bgColor: COLORS.pendingLight,
        borderColor: rgb(0.7, 0.8, 0.9),
        label: 'PENDING APPROVAL'
      };
    case 'SPLIT':
      return {
        color: COLORS.split,
        bgColor: COLORS.splitLight,
        borderColor: rgb(0.8, 0.75, 0.9),
        label: 'SPLIT'
      };
    default:
      return {
        color: COLORS.brand,
        bgColor: COLORS.white,
        borderColor: COLORS.border,
        label: status || 'PROCESSED'
      };
  }
}

/**
 * Professional approval stamp - v2 design
 */
async function stampApprovalV2(pdfBuffer, stampData) {
  const {
    status = 'APPROVED',
    date,
    approvedBy,
    jobName,
    costCodes = [],
    amount,
    poNumber,
    poTotal,
    poBilledToDate,
    poLinkedAmount = null,
    isPartial: isPartialFromServer = false,
    previouslyBilled = 0,
    splitInfo = null,
    coInfo = null
  } = stampData;

  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const pages = pdfDoc.getPages();
  const firstPage = pages[0];

  const rotation = firstPage.getRotation().angle;
  const { width: rawWidth, height: rawHeight } = firstPage.getSize();

  // Embed fonts
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Calculate partial status
  const invoiceAmount = parseFloat(amount || 0);
  const allocatedAmount = costCodes.reduce((sum, cc) => sum + parseFloat(cc.amount || 0), 0);
  const prevBilled = parseFloat(previouslyBilled || 0);
  const isPartial = isPartialFromServer || prevBilled > 0 ||
    (allocatedAmount > 0 && allocatedAmount < (invoiceAmount - prevBilled) - 0.01);

  // Get styling based on status
  let displayStatus = status;
  if (splitInfo?.isSplit) {
    displayStatus = 'SPLIT';
  }
  const style = getStatusStyle(displayStatus, isPartial);

  // === STAMP CONFIGURATION ===
  const config = {
    width: 230,
    padding: 14,
    headerHeight: 28,
    sectionGap: 10,
    lineHeight: 14,
    smallLineHeight: 12,
    margin: 20,
  };

  // === CALCULATE CONTENT HEIGHT ===
  let contentHeight = 0;

  // Status badge section
  contentHeight += config.headerHeight + 8;

  // Amount section
  if (amount) {
    contentHeight += 24 + 4; // Large amount + spacing
  }

  // Job section
  if (jobName) {
    contentHeight += config.lineHeight + config.sectionGap;
  }

  // Cost codes section
  if (costCodes.length > 0) {
    contentHeight += config.smallLineHeight; // Divider space
    const codeLines = Math.min(costCodes.length, 3);
    contentHeight += codeLines * config.smallLineHeight;
    if (costCodes.length > 3) contentHeight += config.smallLineHeight;
    contentHeight += config.sectionGap;
  }

  // PO section
  if (poNumber) {
    contentHeight += config.smallLineHeight; // Divider space
    contentHeight += config.lineHeight; // PO number
    if (poTotal) {
      contentHeight += 8; // Progress bar
      contentHeight += config.smallLineHeight; // Percentage text
    }
    contentHeight += config.sectionGap;
  }

  // Footer section (date/approver)
  contentHeight += config.smallLineHeight + 4;

  const totalHeight = contentHeight + config.padding * 2;

  // === DRAW STAMP (0° rotation) ===
  if (rotation === 0) {
    const boxX = rawWidth - config.margin - config.width;
    const boxY = rawHeight - config.margin - totalHeight;

    // Main container with subtle shadow effect (darker border on bottom/right)
    drawRoundedRect(firstPage, boxX, boxY, config.width, totalHeight, 4, {
      color: COLORS.white,
      opacity: 0.98,
    });

    // Border
    firstPage.drawRectangle({
      x: boxX, y: boxY,
      width: config.width, height: totalHeight,
      borderColor: style.borderColor,
      borderWidth: 1.5,
    });

    // === HEADER BAR (colored strip at top) ===
    const headerY = boxY + totalHeight - config.headerHeight;
    firstPage.drawRectangle({
      x: boxX + 1,
      y: headerY,
      width: config.width - 2,
      height: config.headerHeight - 1,
      color: style.bgColor,
    });

    // Status text centered in header
    const statusText = splitInfo?.isSplit
      ? `SPLIT ${splitInfo.index}/${splitInfo.total}`
      : (isPartial ? `${style.label} (PARTIAL)` : style.label);
    const statusWidth = boldFont.widthOfTextAtSize(statusText, 12);
    firstPage.drawText(statusText, {
      x: boxX + (config.width - statusWidth) / 2,
      y: headerY + 9,
      size: 12,
      font: boldFont,
      color: style.color,
    });

    // Small indicator before status (using ASCII-safe character)
    if (status === 'APPROVED' && !isPartial) {
      // Draw a small filled circle manually
      firstPage.drawCircle({
        x: boxX + (config.width - statusWidth) / 2 - 10,
        y: headerY + 13,
        size: 4,
        color: style.color,
      });
    }

    // === CONTENT AREA ===
    let currentY = headerY - 8;
    const contentX = boxX + config.padding;
    const contentWidth = config.width - config.padding * 2;

    // Amount (large, prominent)
    if (amount) {
      currentY -= 20;
      const amountText = formatMoney(amount);
      const amountWidth = boldFont.widthOfTextAtSize(amountText, 18);
      firstPage.drawText(amountText, {
        x: boxX + (config.width - amountWidth) / 2,
        y: currentY,
        size: 18,
        font: boldFont,
        color: COLORS.textDark,
      });
      currentY -= 8;
    }

    // Job name
    if (jobName) {
      currentY -= config.lineHeight;
      const truncJob = jobName.length > 28 ? jobName.substring(0, 25) + '...' : jobName;
      const jobWidth = boldFont.widthOfTextAtSize(truncJob, 10);
      firstPage.drawText(truncJob, {
        x: boxX + (config.width - jobWidth) / 2,
        y: currentY,
        size: 10,
        font: boldFont,
        color: COLORS.textDark,
      });
      currentY -= config.sectionGap;
    }

    // Cost codes section
    if (costCodes.length > 0) {
      // Divider
      drawDivider(firstPage, contentX, currentY + 4, contentWidth);
      currentY -= 4;

      costCodes.slice(0, 3).forEach(cc => {
        currentY -= config.smallLineHeight;
        const codeText = cc.code || '';
        const nameText = cc.name && cc.name.length > 12 ? cc.name.substring(0, 10) + '..' : (cc.name || '');
        const amtText = formatMoney(cc.amount);

        // Code on left
        firstPage.drawText(codeText, {
          x: contentX,
          y: currentY,
          size: 9,
          font: boldFont,
          color: COLORS.brand,
        });

        // Name in middle
        firstPage.drawText(nameText, {
          x: contentX + 45,
          y: currentY,
          size: 9,
          font: font,
          color: COLORS.textMedium,
        });

        // Amount on right
        const amtWidth = font.widthOfTextAtSize(amtText, 9);
        firstPage.drawText(amtText, {
          x: boxX + config.width - config.padding - amtWidth,
          y: currentY,
          size: 9,
          font: font,
          color: COLORS.textDark,
        });
      });

      if (costCodes.length > 3) {
        currentY -= config.smallLineHeight;
        const moreText = `+${costCodes.length - 3} more`;
        firstPage.drawText(moreText, {
          x: contentX,
          y: currentY,
          size: 8,
          font: font,
          color: COLORS.textLight,
        });
      }
      currentY -= config.sectionGap;
    }

    // PO section with progress bar
    if (poNumber) {
      // Divider
      drawDivider(firstPage, contentX, currentY + 4, contentWidth);
      currentY -= 6;

      // PO number
      currentY -= config.lineHeight;
      firstPage.drawText(`PO: ${poNumber}`, {
        x: contentX,
        y: currentY,
        size: 9,
        font: boldFont,
        color: COLORS.brand,
      });

      // Progress bar and percentage
      if (poTotal) {
        const thisInvoicePOAmount = poLinkedAmount !== null ? poLinkedAmount : (amount || 0);
        const billedWithThis = (poBilledToDate || 0) + thisInvoicePOAmount;
        const percentage = Math.round((billedWithThis / poTotal) * 100);
        const remaining = poTotal - billedWithThis;

        currentY -= 12;

        // Progress bar
        const barWidth = contentWidth - 40;
        const barHeight = 6;
        drawProgressBar(firstPage, contentX, currentY, barWidth, barHeight, percentage, {
          fillColor: percentage > 100 ? COLORS.warning : COLORS.brand,
        });

        // Percentage text
        const pctText = `${percentage}%`;
        const pctWidth = boldFont.widthOfTextAtSize(pctText, 9);
        firstPage.drawText(pctText, {
          x: contentX + barWidth + 6,
          y: currentY - 1,
          size: 9,
          font: boldFont,
          color: percentage > 100 ? COLORS.warning : COLORS.brand,
        });

        // Billed/Total amounts
        currentY -= config.smallLineHeight + 2;
        const billedText = `${formatMoneyCompact(billedWithThis)} of ${formatMoneyCompact(poTotal)}`;
        firstPage.drawText(billedText, {
          x: contentX,
          y: currentY,
          size: 8,
          font: font,
          color: COLORS.textMedium,
        });

        // Remaining (if any)
        if (remaining > 0) {
          const remText = `${formatMoneyCompact(remaining)} left`;
          const remWidth = font.widthOfTextAtSize(remText, 8);
          firstPage.drawText(remText, {
            x: boxX + config.width - config.padding - remWidth,
            y: currentY,
            size: 8,
            font: font,
            color: COLORS.warning,
          });
        }
      }
      currentY -= config.sectionGap;
    }

    // Change Order info
    if (coInfo) {
      currentY -= config.smallLineHeight;
      const coText = `CO #${coInfo.number}`;
      firstPage.drawText(coText, {
        x: contentX,
        y: currentY,
        size: 8,
        font: boldFont,
        color: COLORS.brand,
      });
      if (coInfo.title) {
        const truncTitle = coInfo.title.length > 20 ? coInfo.title.substring(0, 18) + '..' : coInfo.title;
        firstPage.drawText(truncTitle, {
          x: contentX + 45,
          y: currentY,
          size: 8,
          font: font,
          color: COLORS.textMedium,
        });
      }
      currentY -= 4;
    }

    // === FOOTER (date and approver) ===
    // Divider
    drawDivider(firstPage, contentX, currentY + 2, contentWidth);
    currentY -= config.smallLineHeight + 2;

    // Date and approver on same line
    const footerParts = [];
    if (date) footerParts.push(date);
    if (approvedBy) footerParts.push(`by ${approvedBy}`);
    const footerText = footerParts.join(' • ');

    const footerWidth = font.widthOfTextAtSize(footerText, 8);
    firstPage.drawText(footerText, {
      x: boxX + (config.width - footerWidth) / 2,
      y: currentY,
      size: 8,
      font: font,
      color: COLORS.textLight,
    });

  } else if (rotation === 90) {
    // 90° rotation - stamp on left side (visual top-right)
    // Similar logic but rotated
    const boxWidth = totalHeight;
    const boxHeight = config.width;
    const boxX = config.margin;
    const boxY = rawHeight - config.margin - boxHeight;

    // Container
    firstPage.drawRectangle({
      x: boxX, y: boxY,
      width: boxWidth, height: boxHeight,
      color: COLORS.white,
      opacity: 0.98,
      borderColor: style.borderColor,
      borderWidth: 1.5,
    });

    // For 90° we draw text with rotate: degrees(-90)
    // Text positioning is more complex - simplified version here
    let textX = boxX + config.padding;
    const centerY = boxY + boxHeight / 2;

    // Status (rotated)
    const statusText = isPartial ? `${style.label} (PARTIAL)` : style.label;
    const statusW = boldFont.widthOfTextAtSize(statusText, 12);
    firstPage.drawText(statusText, {
      x: textX + 8,
      y: centerY + statusW / 2,
      size: 12,
      font: boldFont,
      color: style.color,
      rotate: degrees(-90),
    });
    textX += 20;

    // Amount
    if (amount) {
      const amtText = formatMoney(amount);
      const amtW = boldFont.widthOfTextAtSize(amtText, 16);
      firstPage.drawText(amtText, {
        x: textX + 8,
        y: centerY + amtW / 2,
        size: 16,
        font: boldFont,
        color: COLORS.textDark,
        rotate: degrees(-90),
      });
      textX += 22;
    }

    // Job
    if (jobName) {
      const truncJob = jobName.length > 25 ? jobName.substring(0, 22) + '...' : jobName;
      const jobW = boldFont.widthOfTextAtSize(truncJob, 10);
      firstPage.drawText(truncJob, {
        x: textX + 8,
        y: centerY + jobW / 2,
        size: 10,
        font: boldFont,
        color: COLORS.textDark,
        rotate: degrees(-90),
      });
      textX += 14;
    }

    // Cost codes (simplified)
    if (costCodes.length > 0) {
      costCodes.slice(0, 2).forEach(cc => {
        const ccText = `${cc.code} ${formatMoney(cc.amount)}`;
        const ccW = font.widthOfTextAtSize(ccText, 8);
        firstPage.drawText(ccText, {
          x: textX + 6,
          y: centerY + ccW / 2,
          size: 8,
          font: font,
          color: COLORS.textMedium,
          rotate: degrees(-90),
        });
        textX += 12;
      });
    }

    // PO info (simplified)
    if (poNumber) {
      const poText = `PO: ${poNumber}`;
      const poW = boldFont.widthOfTextAtSize(poText, 9);
      firstPage.drawText(poText, {
        x: textX + 6,
        y: centerY + poW / 2,
        size: 9,
        font: boldFont,
        color: COLORS.brand,
        rotate: degrees(-90),
      });
    }

  } else if (rotation === 270) {
    // 270° rotation - stamp on right side (visual top-right)
    const boxWidth = totalHeight;
    const boxHeight = config.width;
    const boxX = rawWidth - config.margin - boxWidth;
    const boxY = config.margin;

    // Container
    firstPage.drawRectangle({
      x: boxX, y: boxY,
      width: boxWidth, height: boxHeight,
      color: COLORS.white,
      opacity: 0.98,
      borderColor: style.borderColor,
      borderWidth: 1.5,
    });

    // For 270° we draw text with rotate: degrees(90)
    let textX = boxX + boxWidth - config.padding;
    const centerY = boxY + boxHeight / 2;

    // Status
    const statusText = isPartial ? `${style.label} (PARTIAL)` : style.label;
    const statusW = boldFont.widthOfTextAtSize(statusText, 12);
    firstPage.drawText(statusText, {
      x: textX - 8,
      y: centerY - statusW / 2,
      size: 12,
      font: boldFont,
      color: style.color,
      rotate: degrees(90),
    });
    textX -= 20;

    // Amount
    if (amount) {
      const amtText = formatMoney(amount);
      const amtW = boldFont.widthOfTextAtSize(amtText, 16);
      firstPage.drawText(amtText, {
        x: textX - 8,
        y: centerY - amtW / 2,
        size: 16,
        font: boldFont,
        color: COLORS.textDark,
        rotate: degrees(90),
      });
      textX -= 22;
    }

    // Job
    if (jobName) {
      const truncJob = jobName.length > 25 ? jobName.substring(0, 22) + '...' : jobName;
      const jobW = boldFont.widthOfTextAtSize(truncJob, 10);
      firstPage.drawText(truncJob, {
        x: textX - 8,
        y: centerY - jobW / 2,
        size: 10,
        font: boldFont,
        color: COLORS.textDark,
        rotate: degrees(90),
      });
      textX -= 14;
    }

    // Cost codes (simplified)
    if (costCodes.length > 0) {
      costCodes.slice(0, 2).forEach(cc => {
        const ccText = `${cc.code} ${formatMoney(cc.amount)}`;
        const ccW = font.widthOfTextAtSize(ccText, 8);
        firstPage.drawText(ccText, {
          x: textX - 6,
          y: centerY - ccW / 2,
          size: 8,
          font: font,
          color: COLORS.textMedium,
          rotate: degrees(90),
        });
        textX -= 12;
      });
    }

    // PO info
    if (poNumber) {
      const poText = `PO: ${poNumber}`;
      const poW = boldFont.widthOfTextAtSize(poText, 9);
      firstPage.drawText(poText, {
        x: textX - 6,
        y: centerY - poW / 2,
        size: 9,
        font: boldFont,
        color: COLORS.brand,
        rotate: degrees(90),
      });
    }

  } else if (rotation === 180) {
    // 180° rotation - stamp at bottom-left (visual top-right)
    const boxX = config.margin;
    const boxY = config.margin;

    // Container
    firstPage.drawRectangle({
      x: boxX, y: boxY,
      width: config.width, height: totalHeight,
      color: COLORS.white,
      opacity: 0.98,
      borderColor: style.borderColor,
      borderWidth: 1.5,
    });

    // For 180° we draw text with rotate: degrees(180)
    const centerX = boxX + config.width / 2;
    let textY = boxY + config.padding;

    // Status
    const statusText = isPartial ? `${style.label} (PARTIAL)` : style.label;
    const statusW = boldFont.widthOfTextAtSize(statusText, 12);
    firstPage.drawText(statusText, {
      x: centerX + statusW / 2,
      y: textY + 8,
      size: 12,
      font: boldFont,
      color: style.color,
      rotate: degrees(180),
    });
    textY += 20;

    // Amount
    if (amount) {
      const amtText = formatMoney(amount);
      const amtW = boldFont.widthOfTextAtSize(amtText, 16);
      firstPage.drawText(amtText, {
        x: centerX + amtW / 2,
        y: textY + 8,
        size: 16,
        font: boldFont,
        color: COLORS.textDark,
        rotate: degrees(180),
      });
      textY += 22;
    }

    // Job
    if (jobName) {
      const truncJob = jobName.length > 25 ? jobName.substring(0, 22) + '...' : jobName;
      const jobW = boldFont.widthOfTextAtSize(truncJob, 10);
      firstPage.drawText(truncJob, {
        x: centerX + jobW / 2,
        y: textY + 6,
        size: 10,
        font: boldFont,
        color: COLORS.textDark,
        rotate: degrees(180),
      });
      textY += 14;
    }

    // Cost codes (simplified)
    if (costCodes.length > 0) {
      costCodes.slice(0, 2).forEach(cc => {
        const ccText = `${cc.code} ${formatMoney(cc.amount)}`;
        const ccW = font.widthOfTextAtSize(ccText, 8);
        firstPage.drawText(ccText, {
          x: centerX + ccW / 2,
          y: textY + 4,
          size: 8,
          font: font,
          color: COLORS.textMedium,
          rotate: degrees(180),
        });
        textY += 12;
      });
    }

    // PO info
    if (poNumber) {
      const poText = `PO: ${poNumber}`;
      const poW = boldFont.widthOfTextAtSize(poText, 9);
      firstPage.drawText(poText, {
        x: centerX + poW / 2,
        y: textY + 4,
        size: 9,
        font: boldFont,
        color: COLORS.brand,
        rotate: degrees(180),
      });
    }
  }

  const stampedPdfBytes = await pdfDoc.save();
  return Buffer.from(stampedPdfBytes);
}

/**
 * Add "IN DRAW" badge stamp - v2 design
 */
async function stampInDrawV2(pdfBuffer, drawNumber) {
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const pages = pdfDoc.getPages();
  const firstPage = pages[0];

  const { width: rawWidth, height: rawHeight } = firstPage.getSize();
  const rotation = firstPage.getRotation().angle;
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const text = `DRAW #${drawNumber}`;
  const textSize = 10;
  const textWidth = boldFont.widthOfTextAtSize(text, textSize);
  const badgeWidth = textWidth + 16;
  const badgeHeight = 18;

  if (rotation === 0) {
    const x = rawWidth - badgeWidth - 20;
    const y = 20;

    // Badge background
    firstPage.drawRectangle({
      x, y,
      width: badgeWidth,
      height: badgeHeight,
      color: COLORS.brand,
      opacity: 0.9,
    });

    // Text
    firstPage.drawText(text, {
      x: x + 8,
      y: y + 5,
      size: textSize,
      font: boldFont,
      color: COLORS.white,
    });
  } else if (rotation === 90) {
    firstPage.drawText(text, {
      x: rawWidth - 25,
      y: textWidth + 25,
      size: textSize,
      font: boldFont,
      color: COLORS.brand,
      rotate: degrees(-90),
    });
  } else if (rotation === 270) {
    firstPage.drawText(text, {
      x: 25,
      y: rawHeight - textWidth - 25,
      size: textSize,
      font: boldFont,
      color: COLORS.brand,
      rotate: degrees(90),
    });
  } else {
    firstPage.drawText(text, {
      x: textWidth + 25,
      y: rawHeight - 25,
      size: textSize,
      font: boldFont,
      color: COLORS.brand,
      rotate: degrees(180),
    });
  }

  const stampedPdfBytes = await pdfDoc.save();
  return Buffer.from(stampedPdfBytes);
}

/**
 * Add "PAID" watermark stamp - v2 design
 */
async function stampPaidV2(pdfBuffer, paidDate) {
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const pages = pdfDoc.getPages();
  const firstPage = pages[0];

  const { width: rawWidth, height: rawHeight } = firstPage.getSize();
  const rotation = firstPage.getRotation().angle;
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // Large diagonal "PAID" watermark
  const text = 'PAID';
  const textSize = 72;

  let x = rawWidth / 2 - 100;
  let y = rawHeight / 2 - 20;
  let textAngle = -25;

  if (rotation === 90) textAngle = 65;
  else if (rotation === 270) textAngle = -115;
  else if (rotation === 180) textAngle = 155;

  // Watermark text
  firstPage.drawText(text, {
    x,
    y,
    size: textSize,
    font: boldFont,
    color: COLORS.success,
    opacity: 0.12,
    rotate: degrees(textAngle),
  });

  // Small date badge at bottom
  if (paidDate && rotation === 0) {
    const dateText = `Paid: ${paidDate}`;
    const dateWidth = font.widthOfTextAtSize(dateText, 9);

    // Badge background
    firstPage.drawRectangle({
      x: 15,
      y: 15,
      width: dateWidth + 16,
      height: 20,
      color: COLORS.success,
      opacity: 0.15,
    });

    firstPage.drawText(dateText, {
      x: 23,
      y: 20,
      size: 9,
      font: boldFont,
      color: COLORS.success,
    });
  }

  const stampedPdfBytes = await pdfDoc.save();
  return Buffer.from(stampedPdfBytes);
}

module.exports = {
  stampApprovalV2,
  stampInDrawV2,
  stampPaidV2,
  // Re-export originals for compatibility
  stampApproval: stampApprovalV2,
  stampInDraw: stampInDrawV2,
  stampPaid: stampPaidV2,
};

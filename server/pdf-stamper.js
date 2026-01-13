/**
 * PDF Stamping Module
 * Adds professional approval stamps with Ross Built watermark to invoice PDFs
 */

const { PDFDocument, rgb, StandardFonts, degrees } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

// Brand colors (Ross Built slate/teal)
const BRAND_COLOR = rgb(0.29, 0.4, 0.45); // #4A6672 slate teal
const TEXT_DARK = rgb(0.2, 0.2, 0.2);
const TEXT_LIGHT = rgb(0.5, 0.5, 0.5);
const SUCCESS_COLOR = rgb(0.2, 0.5, 0.3);
const WARNING_COLOR = rgb(0.7, 0.5, 0.1);

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
    console.warn('Could not load logo:', err.message);
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
 * Get the visual dimensions of a page (accounting for rotation)
 * Returns { width, height, rotation } where width/height are the visual dimensions
 */
function getVisualDimensions(page) {
  const rotation = page.getRotation().angle;
  const { width, height } = page.getSize();

  // For 90 or 270 degree rotations, swap visual width/height
  if (rotation === 90 || rotation === 270) {
    return { width: height, height: width, rotation };
  }
  return { width, height, rotation };
}

/**
 * Add an approval stamp to a PDF - Clean watermark style
 * @param {Buffer} pdfBuffer - Original PDF as buffer
 * @param {Object} stampData - Data to include in stamp
 * @returns {Promise<Buffer>} - Stamped PDF as buffer
 */
async function stampApproval(pdfBuffer, stampData) {
  const {
    status = 'APPROVED',
    date,
    approvedBy,
    jobName,
    vendorName,
    invoiceNumber,
    costCodes = [],
    amount,
    poNumber,
    poTotal,
    poBilledToDate,
    isPartial: isPartialFromServer = false,
    previouslyBilled = 0
  } = stampData;

  // Load the PDF
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const pages = pdfDoc.getPages();
  const firstPage = pages[0];

  // Get visual dimensions (handles rotation)
  const { width: pageWidth, height: pageHeight, rotation } = getVisualDimensions(firstPage);
  const { width: rawWidth, height: rawHeight } = firstPage.getSize();

  // Embed fonts
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Load and embed logo
  const logoBytes = await loadLogo();
  let logoImage = null;
  if (logoBytes) {
    try {
      logoImage = await pdfDoc.embedPng(logoBytes);
    } catch (err) {
      console.warn('Could not embed logo:', err.message);
    }
  }

  // Calculate partial status
  const invoiceAmount = parseFloat(amount || 0);
  const allocatedAmount = costCodes.reduce((sum, cc) => sum + parseFloat(cc.amount || 0), 0);
  const prevBilled = parseFloat(previouslyBilled || 0);
  const isPartial = isPartialFromServer || prevBilled > 0 ||
    (allocatedAmount > 0 && allocatedAmount < (invoiceAmount - prevBilled) - 0.01);
  const remainingAmount = invoiceAmount - prevBilled - allocatedAmount;

  // Stamp configuration
  const margin = 15;
  const logoSize = 100; // Logo watermark size - larger and more visible
  const lineHeight = 11;
  const smallLineHeight = 9;

  // === DRAW WATERMARK LOGO ===
  // Position in visual top-right corner (accounting for page rotation)
  if (logoImage) {
    // Scale logo to desired size
    const scaleFactor = logoSize / Math.max(logoImage.width, logoImage.height);
    const logoW = logoImage.width * scaleFactor;
    const logoH = logoImage.height * scaleFactor;

    // PDF coordinates: Y=0 is bottom, Y increases upward
    // But pages can be rotated, so we need to position based on visual orientation
    let logoX, logoY;

    console.log(`Page: ${rawWidth}x${rawHeight}, rotation: ${rotation}°`);

    if (rotation === 90) {
      // 90° CW: raw bottom→visual top, raw right→visual right
      // Visual top-right = raw (right, bottom)
      logoX = rawWidth - logoW - margin;
      logoY = margin;
    } else if (rotation === 270) {
      // 270° CW: raw right edge becomes visual top
      // Visual top-right = raw (right, bottom)
      logoX = rawWidth - logoW - margin;
      logoY = margin;
    } else if (rotation === 180) {
      // 180°: raw bottom-left = visual top-right
      logoX = margin;
      logoY = margin;
    } else {
      // No rotation (0°): visual top-right = raw top-right
      logoX = rawWidth - logoW - margin;
      logoY = rawHeight - logoH - margin;
    }

    console.log(`Drawing logo at (${logoX}, ${logoY}), size ${logoW}x${logoH}`);

    firstPage.drawImage(logoImage, {
      x: logoX,
      y: logoY,
      width: logoW,
      height: logoH,
      opacity: 0.25
    });
  }

  // === DRAW APPROVAL TEXT ===
  // Build text lines for stamp
  const lines = [];

  // Status line
  const displayStatus = isPartial ? 'APPROVED (PARTIAL)' : status;
  const statusColor = isPartial ? WARNING_COLOR : SUCCESS_COLOR;
  lines.push({ text: displayStatus, bold: true, size: 14, color: statusColor });

  // Date and approver
  if (date) lines.push({ text: date, size: 9, color: TEXT_LIGHT });
  if (approvedBy) lines.push({ text: `by ${approvedBy}`, size: 9, color: TEXT_LIGHT });

  lines.push({ text: '', size: 4 }); // Spacer

  // Amount
  if (amount) {
    lines.push({ text: formatMoney(amount), bold: true, size: 16, color: TEXT_DARK });
  }

  // Partial info
  if (isPartial && remainingAmount > 0) {
    lines.push({ text: `(${formatMoney(remainingAmount)} remaining)`, size: 8, color: WARNING_COLOR });
  }

  lines.push({ text: '', size: 6 }); // Spacer

  // Job
  if (jobName) {
    const truncJob = jobName.length > 30 ? jobName.substring(0, 27) + '...' : jobName;
    lines.push({ text: truncJob, size: 9, color: TEXT_DARK });
  }

  // Cost codes (compact)
  if (costCodes.length > 0) {
    lines.push({ text: '', size: 4 }); // Spacer
    costCodes.slice(0, 4).forEach(cc => {
      const truncName = cc.name && cc.name.length > 20 ? cc.name.substring(0, 17) + '...' : (cc.name || '');
      lines.push({
        text: `${cc.code} ${truncName}  ${formatMoney(cc.amount)}`,
        size: 8,
        color: TEXT_LIGHT
      });
    });
    if (costCodes.length > 4) {
      lines.push({ text: `+${costCodes.length - 4} more...`, size: 7, color: TEXT_LIGHT });
    }
  }

  // PO info (compact)
  if (poNumber) {
    lines.push({ text: '', size: 4 }); // Spacer
    lines.push({ text: `PO: ${poNumber}`, size: 9, color: BRAND_COLOR, bold: true });
    if (poTotal && poBilledToDate !== undefined) {
      const billedWithThis = poBilledToDate + (amount || 0);
      const remaining = poTotal - billedWithThis;
      const pct = Math.round((billedWithThis / poTotal) * 100);
      lines.push({
        text: `${formatMoney(billedWithThis)} of ${formatMoney(poTotal)} (${pct}%)`,
        size: 8,
        color: TEXT_LIGHT
      });
      if (remaining > 0) {
        lines.push({ text: `${formatMoney(remaining)} remaining`, size: 8, color: TEXT_LIGHT });
      }
    }
  }

  // Calculate stamp position and draw text
  // Always position below the logo, right-aligned
  const textStartX = rawWidth - margin - 10;
  let textY;

  if (rotation === 0) {
    textY = rawHeight - logoSize - margin - 15;

    // Draw each line right-aligned
    lines.forEach(line => {
      if (line.text === '') {
        textY -= line.size;
        return;
      }
      const textWidth = (line.bold ? boldFont : font).widthOfTextAtSize(line.text, line.size);
      firstPage.drawText(line.text, {
        x: textStartX - textWidth,
        y: textY,
        size: line.size,
        font: line.bold ? boldFont : font,
        color: line.color || TEXT_DARK
      });
      textY -= line.size + 2;
    });
  } else {
    // For rotated pages, draw text in a way that it appears upright to the viewer
    // We'll use a different approach: draw at raw coordinates with counter-rotation

    let startX, startY;
    let textRotation;

    if (rotation === 90) {
      // Visual top-right is raw bottom-right
      startX = rawWidth - margin - logoSize - 25;
      startY = margin + 10;
      textRotation = -90;

      let offsetY = 0;
      lines.forEach(line => {
        if (line.text === '') {
          offsetY += line.size;
          return;
        }
        firstPage.drawText(line.text, {
          x: startX,
          y: startY + offsetY,
          size: line.size,
          font: line.bold ? boldFont : font,
          color: line.color || TEXT_DARK,
          rotate: degrees(textRotation)
        });
        offsetY += line.size + 2;
      });
    } else if (rotation === 270) {
      // Visual top-right is raw top-left
      startX = margin + logoSize + 25;
      startY = rawHeight - margin - 10;
      textRotation = 90;

      let offsetY = 0;
      lines.forEach(line => {
        if (line.text === '') {
          offsetY += line.size;
          return;
        }
        const textWidth = (line.bold ? boldFont : font).widthOfTextAtSize(line.text, line.size);
        firstPage.drawText(line.text, {
          x: startX,
          y: startY - offsetY - textWidth,
          size: line.size,
          font: line.bold ? boldFont : font,
          color: line.color || TEXT_DARK,
          rotate: degrees(textRotation)
        });
        offsetY += line.size + 2;
      });
    } else if (rotation === 180) {
      // Visual top-right is raw bottom-left
      startX = margin + 10;
      startY = margin + logoSize + 25;
      textRotation = 180;

      let offsetY = 0;
      lines.forEach(line => {
        if (line.text === '') {
          offsetY += line.size;
          return;
        }
        const textWidth = (line.bold ? boldFont : font).widthOfTextAtSize(line.text, line.size);
        firstPage.drawText(line.text, {
          x: startX + textWidth,
          y: startY + offsetY,
          size: line.size,
          font: line.bold ? boldFont : font,
          color: line.color || TEXT_DARK,
          rotate: degrees(textRotation)
        });
        offsetY += line.size + 2;
      });
    }
  }

  // Save and return
  const stampedPdfBytes = await pdfDoc.save();
  return Buffer.from(stampedPdfBytes);
}

/**
 * Add "IN DRAW" stamp to a PDF - Clean style
 */
async function stampInDraw(pdfBuffer, drawNumber) {
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const pages = pdfDoc.getPages();
  const firstPage = pages[0];

  const { width: rawWidth, height: rawHeight } = firstPage.getSize();
  const rotation = firstPage.getRotation().angle;
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const text = `DRAW #${drawNumber}`;
  const textSize = 11;
  const textWidth = boldFont.widthOfTextAtSize(text, textSize);

  // Position at bottom right, accounting for rotation
  let x, y;
  let textRotation;

  if (rotation === 0) {
    x = rawWidth - textWidth - 20;
    y = 20;
    textRotation = undefined;
  } else if (rotation === 90) {
    x = rawWidth - 20;
    y = textWidth + 20;
    textRotation = degrees(-90);
  } else if (rotation === 270) {
    x = 20;
    y = rawHeight - textWidth - 20;
    textRotation = degrees(90);
  } else {
    x = textWidth + 20;
    y = rawHeight - 20;
    textRotation = degrees(180);
  }

  firstPage.drawText(text, {
    x,
    y,
    size: textSize,
    font: boldFont,
    color: BRAND_COLOR,
    rotate: textRotation
  });

  const stampedPdfBytes = await pdfDoc.save();
  return Buffer.from(stampedPdfBytes);
}

/**
 * Add "PAID" stamp to a PDF - Clean watermark style
 */
async function stampPaid(pdfBuffer, paidDate) {
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const pages = pdfDoc.getPages();
  const firstPage = pages[0];

  const { width: rawWidth, height: rawHeight } = firstPage.getSize();
  const rotation = firstPage.getRotation().angle;
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Load and embed logo for center watermark
  const logoBytes = await loadLogo();
  if (logoBytes) {
    try {
      const logoImage = await pdfDoc.embedPng(logoBytes);
      const logoSize = Math.min(rawWidth, rawHeight) * 0.4;
      const logoDims = logoImage.scale(logoSize / logoImage.width);

      // Center the logo
      let logoX = (rawWidth - logoDims.width) / 2;
      let logoY = (rawHeight - logoDims.height) / 2;

      firstPage.drawImage(logoImage, {
        x: logoX,
        y: logoY,
        width: logoDims.width,
        height: logoDims.height,
        opacity: 0.08 // Very subtle
      });
    } catch (err) {
      console.warn('Could not embed logo for PAID stamp:', err.message);
    }
  }

  // Draw "PAID" text as subtle diagonal watermark
  const text = 'PAID';
  const textSize = 60;

  // Calculate center position
  let x = rawWidth / 2 - 80;
  let y = rawHeight / 2;

  // Adjust rotation for page orientation
  let textAngle = -30;
  if (rotation === 90) textAngle = 60;
  else if (rotation === 270) textAngle = -120;
  else if (rotation === 180) textAngle = 150;

  firstPage.drawText(text, {
    x,
    y,
    size: textSize,
    font: boldFont,
    color: SUCCESS_COLOR,
    opacity: 0.15,
    rotate: degrees(textAngle)
  });

  // Add paid date at bottom
  if (paidDate) {
    const dateText = `Paid: ${paidDate}`;
    const dateSize = 9;

    if (rotation === 0) {
      firstPage.drawText(dateText, {
        x: 20,
        y: 20,
        size: dateSize,
        font: boldFont,
        color: TEXT_LIGHT
      });
    }
  }

  const stampedPdfBytes = await pdfDoc.save();
  return Buffer.from(stampedPdfBytes);
}

/**
 * Add "PARTIALLY PAID" stamp to a PDF
 */
async function stampPartiallyPaid(pdfBuffer, paymentData) {
  const {
    paidDate,
    drawNumber,
    amountPaidThisDraw,
    cumulativePaid,
    invoiceTotal,
    remaining
  } = paymentData;

  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const pages = pdfDoc.getPages();
  const firstPage = pages[0];

  const { width: rawWidth, height: rawHeight } = firstPage.getSize();
  const rotation = firstPage.getRotation().angle;
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Draw "PARTIAL" as subtle diagonal watermark
  if (rotation === 0) {
    firstPage.drawText('PARTIAL', {
      x: rawWidth / 2 - 100,
      y: rawHeight / 2,
      size: 50,
      font: boldFont,
      color: WARNING_COLOR,
      opacity: 0.12,
      rotate: degrees(-30)
    });
  }

  // Add payment info at bottom left - clean text only
  if (rotation === 0) {
    const lines = [
      { text: `Draw #${drawNumber || 'N/A'}`, bold: true },
      { text: `This Payment: ${formatMoney(amountPaidThisDraw)}` },
      { text: `Total Paid: ${formatMoney(cumulativePaid)}` },
      { text: `Remaining: ${formatMoney(remaining)}`, color: WARNING_COLOR }
    ];

    let y = 50;
    lines.forEach(line => {
      firstPage.drawText(line.text, {
        x: 20,
        y,
        size: 9,
        font: line.bold ? boldFont : font,
        color: line.color || TEXT_LIGHT
      });
      y -= 12;
    });
  }

  const stampedPdfBytes = await pdfDoc.save();
  return Buffer.from(stampedPdfBytes);
}

/**
 * Add "PARTIAL BILLED" stamp to a PDF
 */
async function stampPartiallyBilled(pdfBuffer, billingData) {
  const {
    drawNumber,
    amountBilledThisDraw,
    cumulativeBilled,
    invoiceTotal,
    remaining
  } = billingData;

  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const pages = pdfDoc.getPages();
  const firstPage = pages[0];

  const { width: rawWidth, height: rawHeight } = firstPage.getSize();
  const rotation = firstPage.getRotation().angle;
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Add billing info at bottom left - clean text only
  if (rotation === 0) {
    const lines = [
      { text: `Billed - Draw #${drawNumber}`, bold: true, color: BRAND_COLOR },
      { text: `This Draw: ${formatMoney(amountBilledThisDraw)}` },
      { text: `Total Billed: ${formatMoney(cumulativeBilled)}` },
      { text: `Remaining: ${formatMoney(remaining)}`, color: WARNING_COLOR }
    ];

    let y = 50;
    lines.forEach(line => {
      firstPage.drawText(line.text, {
        x: 20,
        y,
        size: 9,
        font: line.bold ? boldFont : font,
        color: line.color || TEXT_LIGHT
      });
      y -= 12;
    });
  }

  const stampedPdfBytes = await pdfDoc.save();
  return Buffer.from(stampedPdfBytes);
}

module.exports = {
  stampApproval,
  stampInDraw,
  stampPaid,
  stampPartiallyPaid,
  stampPartiallyBilled
};

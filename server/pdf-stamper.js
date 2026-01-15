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
    costCodes = [],
    amount,
    poNumber,
    poTotal,
    poBilledToDate,
    poLinkedAmount = null, // Amount of THIS invoice allocated to the PO (may be less than total)
    isPartial: isPartialFromServer = false,
    previouslyBilled = 0,
    // Split invoice info
    splitInfo = null, // { isSplit: boolean, index: number, total: number }
    // Change Order info (from PO linkage)
    coInfo = null // { number: number, title: string }
  } = stampData;

  // Load the PDF
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const pages = pdfDoc.getPages();
  const firstPage = pages[0];

  const rotation = firstPage.getRotation().angle;
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

  // === BUILD TEXT LINES ===
  const lines = [];

  // Status line - bold (with split indicator if applicable)
  let displayStatus = isPartial ? 'APPROVED (PARTIAL)' : status;
  if (splitInfo?.isSplit) {
    displayStatus = `APPROVED (SPLIT ${splitInfo.index}/${splitInfo.total})`;
  }
  const statusColor = isPartial ? WARNING_COLOR : SUCCESS_COLOR;
  lines.push({ text: displayStatus, bold: true, size: 14, color: statusColor });

  // Date and approver
  if (date) lines.push({ text: date, size: 9, color: TEXT_DARK });
  if (approvedBy) lines.push({ text: `by ${approvedBy}`, size: 9, color: TEXT_DARK });

  lines.push({ text: '', size: 4 }); // Spacer

  // Amount - prominent
  if (amount) {
    lines.push({ text: formatMoney(amount), bold: true, size: 16, color: TEXT_DARK });
  }

  // Partial info
  if (isPartial && remainingAmount > 0) {
    lines.push({ text: `(${formatMoney(remainingAmount)} remaining)`, size: 8, color: WARNING_COLOR });
  }

  lines.push({ text: '', size: 4 }); // Spacer

  // Job - clear and readable
  if (jobName) {
    const truncJob = jobName.length > 25 ? jobName.substring(0, 22) + '...' : jobName;
    lines.push({ text: truncJob, size: 10, color: TEXT_DARK, bold: true });
  }

  // Cost codes
  if (costCodes.length > 0) {
    lines.push({ text: '', size: 2 }); // Spacer
    costCodes.slice(0, 3).forEach(cc => {
      const truncName = cc.name && cc.name.length > 15 ? cc.name.substring(0, 12) + '...' : (cc.name || '');
      lines.push({
        text: `${cc.code} ${truncName} ${formatMoney(cc.amount)}`,
        size: 8,
        color: TEXT_DARK
      });
    });
    if (costCodes.length > 3) {
      lines.push({ text: `+${costCodes.length - 3} more...`, size: 7, color: TEXT_DARK });
    }
  }

  // PO info - show PO number and balance
  if (poNumber) {
    lines.push({ text: '', size: 4 }); // Spacer
    lines.push({ text: `PO: ${poNumber}`, size: 10, color: BRAND_COLOR, bold: true });
    if (poTotal) {
      // Use poLinkedAmount if provided (amount of THIS invoice linked to PO), otherwise fall back to full amount
      const thisInvoicePOAmount = poLinkedAmount !== null ? poLinkedAmount : (amount || 0);
      const billedWithThis = (poBilledToDate || 0) + thisInvoicePOAmount;
      const remaining = poTotal - billedWithThis;
      const pct = Math.round((billedWithThis / poTotal) * 100);
      lines.push({
        text: `Billed: ${formatMoney(billedWithThis)} of ${formatMoney(poTotal)} (${pct}%)`,
        size: 8,
        color: TEXT_DARK
      });
      if (remaining > 0) {
        lines.push({
          text: `Remaining: ${formatMoney(remaining)}`,
          size: 8,
          color: WARNING_COLOR,
          bold: true
        });
      }
    }
  }

  // Change Order info (if PO is linked to a CO)
  if (coInfo) {
    lines.push({ text: '', size: 4 }); // Spacer
    const coTitle = coInfo.title && coInfo.title.length > 20
      ? coInfo.title.substring(0, 17) + '...'
      : (coInfo.title || '');
    lines.push({
      text: `CO #${coInfo.number}: ${coTitle}`,
      size: 9,
      color: BRAND_COLOR,
      bold: true
    });
  }

  // === STAMP CONFIGURATION (no logo, clean text-only) ===
  const containerWidth = 220; // Fixed width container (wide enough for all text)
  const containerPadding = 12;
  const edgeMargin = 20; // Margin from page edges
  const bgOpacity = 0.92; // White background opacity

  // Calculate total text height
  let totalTextHeight = 0;
  lines.forEach(line => {
    totalTextHeight += (line.text === '') ? line.size : (line.size + 3);
  });
  const containerHeight = containerPadding * 2 + totalTextHeight;

  // === DRAW STAMP BASED ON ROTATION ===
  if (rotation === 270) {
    // 270° ROTATED PAGE (raw 792x612, displays as 612x792 portrait)
    // After 270° rotation: raw Y becomes visual X, raw X becomes visual Y (inverted)
    // Visual top-right = high raw X, LOW raw Y (near 0)

    // Position: visual top-right corner with margin
    const visualMargin = 30;
    const boxX = rawWidth - visualMargin - containerHeight; // high raw X = visual top
    const boxY = visualMargin; // low raw Y = visual right
    const boxW = containerHeight; // visual height
    const boxH = containerWidth; // visual width

    // Draw white background
    firstPage.drawRectangle({
      x: boxX,
      y: boxY,
      width: boxW,
      height: boxH,
      color: rgb(1, 1, 1),
      opacity: bgOpacity,
      borderColor: rgb(0.85, 0.85, 0.85),
      borderWidth: 1
    });

    // Text positioning - centered in box
    // With degrees(-90), text extends in -Y direction (toward visual right edge)
    // So to center: y = boxCenter + textWidth/2
    let textX = boxX + boxW - containerPadding;
    const boxCenterY = boxY + boxH / 2;

    lines.forEach(line => {
      if (line.text === '') {
        textX -= line.size;
        return;
      }
      const textW = (line.bold ? boldFont : font).widthOfTextAtSize(line.text, line.size);
      // With -90° rotation, text extends in -Y direction, so add textW/2 to center
      firstPage.drawText(line.text, {
        x: textX,
        y: boxCenterY + textW / 2,
        size: line.size,
        font: line.bold ? boldFont : font,
        color: line.color || TEXT_DARK,
        rotate: degrees(-90)
      });
      textX -= line.size + 3;
    });

  } else if (rotation === 90) {
    // 90° ROTATED PAGE
    const containerRawX = edgeMargin;
    const containerRawY = rawHeight - edgeMargin - containerWidth;

    firstPage.drawRectangle({
      x: containerRawX,
      y: containerRawY,
      width: containerHeight,
      height: containerWidth,
      color: rgb(1, 1, 1),
      opacity: bgOpacity,
      borderColor: rgb(0.85, 0.85, 0.85),
      borderWidth: 1
    });

    let textX = containerRawX + containerPadding;
    const textCenterY = containerRawY + containerWidth / 2;

    lines.forEach(line => {
      if (line.text === '') {
        textX += line.size;
        return;
      }
      const textW = (line.bold ? boldFont : font).widthOfTextAtSize(line.text, line.size);
      firstPage.drawText(line.text, {
        x: textX,
        y: textCenterY + textW / 2,
        size: line.size,
        font: line.bold ? boldFont : font,
        color: line.color || TEXT_DARK,
        rotate: degrees(-90)
      });
      textX += line.size + 3;
    });

  } else if (rotation === 180) {
    // 180° ROTATED PAGE
    const containerRawX = edgeMargin;
    const containerRawY = edgeMargin;

    firstPage.drawRectangle({
      x: containerRawX,
      y: containerRawY,
      width: containerWidth,
      height: containerHeight,
      color: rgb(1, 1, 1),
      opacity: bgOpacity,
      borderColor: rgb(0.85, 0.85, 0.85),
      borderWidth: 1
    });

    const textCenterX = containerRawX + containerWidth / 2;
    let textY = containerRawY + containerPadding;

    lines.forEach(line => {
      if (line.text === '') {
        textY += line.size;
        return;
      }
      const textW = (line.bold ? boldFont : font).widthOfTextAtSize(line.text, line.size);
      firstPage.drawText(line.text, {
        x: textCenterX + textW / 2,
        y: textY,
        size: line.size,
        font: line.bold ? boldFont : font,
        color: line.color || TEXT_DARK,
        rotate: degrees(180)
      });
      textY += line.size + 3;
    });

  } else {
    // NO ROTATION (0°) - standard orientation
    const containerX = rawWidth - edgeMargin - containerWidth;
    const containerY = rawHeight - edgeMargin - containerHeight;

    firstPage.drawRectangle({
      x: containerX,
      y: containerY,
      width: containerWidth,
      height: containerHeight,
      color: rgb(1, 1, 1),
      opacity: bgOpacity,
      borderColor: rgb(0.85, 0.85, 0.85),
      borderWidth: 1
    });

    const textCenterX = containerX + containerWidth / 2;
    let textY = containerY + containerHeight - containerPadding;

    lines.forEach(line => {
      if (line.text === '') {
        textY -= line.size;
        return;
      }
      const textW = (line.bold ? boldFont : font).widthOfTextAtSize(line.text, line.size);
      firstPage.drawText(line.text, {
        x: textCenterX - textW / 2,
        y: textY,
        size: line.size,
        font: line.bold ? boldFont : font,
        color: line.color || TEXT_DARK
      });
      textY -= line.size + 3;
    });
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
        opacity: 0.08
      });
    } catch (err) {
      console.warn('Could not embed logo for PAID stamp:', err.message);
    }
  }

  // Draw "PAID" text as subtle diagonal watermark
  const text = 'PAID';
  const textSize = 60;

  let x = rawWidth / 2 - 80;
  let y = rawHeight / 2;

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

  if (paidDate && rotation === 0) {
    firstPage.drawText(`Paid: ${paidDate}`, {
      x: 20,
      y: 20,
      size: 9,
      font: boldFont,
      color: TEXT_LIGHT
    });
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
 * Add "SPLIT" stamp to a PDF when an invoice is split
 * Stamps immediately at split time to identify each portion
 */
async function stampSplit(pdfBuffer, splitData) {
  const {
    splitIndex,      // 1, 2, 3...
    splitTotal,      // Total number of splits
    splitDate,       // Date of split
    originalInvoiceNumber,
    originalAmount,
    thisAmount,
    notes = null,    // Optional notes from user
    jobName = null   // Optional job name if assigned
  } = splitData;

  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const pages = pdfDoc.getPages();
  const firstPage = pages[0];

  const rotation = firstPage.getRotation().angle;
  const { width: rawWidth, height: rawHeight } = firstPage.getSize();

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // === BUILD TEXT LINES ===
  const lines = [];

  const SPLIT_COLOR = rgb(0.4, 0.3, 0.6); // Purple for split

  // Main header: Amount >> Job (or Amount if unassigned)
  // Note: Using >> instead of → because WinAnsi fonts can't encode Unicode arrows
  const amountStr = formatMoney(thisAmount);
  if (jobName) {
    const truncJob = jobName.length > 18 ? jobName.substring(0, 15) + '...' : jobName;
    lines.push({
      text: `${amountStr} >> ${truncJob}`,
      bold: true,
      size: 13,
      color: SPLIT_COLOR
    });
  } else {
    lines.push({
      text: amountStr,
      bold: true,
      size: 14,
      color: SPLIT_COLOR
    });
    lines.push({
      text: '(Unassigned)',
      size: 10,
      color: WARNING_COLOR
    });
  }

  // Date
  if (splitDate) {
    lines.push({ text: splitDate, size: 9, color: TEXT_DARK });
  }

  lines.push({ text: '', size: 4 }); // Spacer

  // Original invoice info
  lines.push({
    text: `From: ${originalInvoiceNumber || 'N/A'}`,
    size: 9,
    color: TEXT_LIGHT
  });
  lines.push({
    text: `(${formatMoney(originalAmount)} total)`,
    size: 8,
    color: TEXT_LIGHT
  });

  // Notes if provided
  if (notes) {
    lines.push({ text: '', size: 4 }); // Spacer
    const truncNotes = notes.length > 30 ? notes.substring(0, 27) + '...' : notes;
    lines.push({ text: truncNotes, size: 9, color: TEXT_LIGHT });
  }

  // === STAMP CONFIGURATION ===
  const containerWidth = 200;
  const containerPadding = 12;
  const edgeMargin = 20;
  const bgOpacity = 0.92;

  // Calculate total text height
  let totalTextHeight = 0;
  lines.forEach(line => {
    totalTextHeight += (line.text === '') ? line.size : (line.size + 3);
  });
  const containerHeight = containerPadding * 2 + totalTextHeight;

  // === DRAW STAMP BASED ON ROTATION ===
  if (rotation === 270) {
    const visualMargin = 30;
    const boxX = rawWidth - visualMargin - containerHeight;
    const boxY = visualMargin;
    const boxW = containerHeight;
    const boxH = containerWidth;

    firstPage.drawRectangle({
      x: boxX,
      y: boxY,
      width: boxW,
      height: boxH,
      color: rgb(1, 1, 1),
      opacity: bgOpacity,
      borderColor: rgb(0.75, 0.7, 0.85), // Light purple border
      borderWidth: 1.5
    });

    let textX = boxX + boxW - containerPadding;
    const boxCenterY = boxY + boxH / 2;

    lines.forEach(line => {
      if (line.text === '') {
        textX -= line.size;
        return;
      }
      const textW = (line.bold ? boldFont : font).widthOfTextAtSize(line.text, line.size);
      firstPage.drawText(line.text, {
        x: textX,
        y: boxCenterY + textW / 2,
        size: line.size,
        font: line.bold ? boldFont : font,
        color: line.color || TEXT_DARK,
        rotate: degrees(-90)
      });
      textX -= line.size + 3;
    });

  } else if (rotation === 90) {
    const containerRawX = edgeMargin;
    const containerRawY = rawHeight - edgeMargin - containerWidth;

    firstPage.drawRectangle({
      x: containerRawX,
      y: containerRawY,
      width: containerHeight,
      height: containerWidth,
      color: rgb(1, 1, 1),
      opacity: bgOpacity,
      borderColor: rgb(0.75, 0.7, 0.85),
      borderWidth: 1.5
    });

    let textX = containerRawX + containerPadding;
    const textCenterY = containerRawY + containerWidth / 2;

    lines.forEach(line => {
      if (line.text === '') {
        textX += line.size;
        return;
      }
      const textW = (line.bold ? boldFont : font).widthOfTextAtSize(line.text, line.size);
      firstPage.drawText(line.text, {
        x: textX,
        y: textCenterY + textW / 2,
        size: line.size,
        font: line.bold ? boldFont : font,
        color: line.color || TEXT_DARK,
        rotate: degrees(-90)
      });
      textX += line.size + 3;
    });

  } else if (rotation === 180) {
    const containerRawX = edgeMargin;
    const containerRawY = edgeMargin;

    firstPage.drawRectangle({
      x: containerRawX,
      y: containerRawY,
      width: containerWidth,
      height: containerHeight,
      color: rgb(1, 1, 1),
      opacity: bgOpacity,
      borderColor: rgb(0.75, 0.7, 0.85),
      borderWidth: 1.5
    });

    const textCenterX = containerRawX + containerWidth / 2;
    let textY = containerRawY + containerPadding;

    lines.forEach(line => {
      if (line.text === '') {
        textY += line.size;
        return;
      }
      const textW = (line.bold ? boldFont : font).widthOfTextAtSize(line.text, line.size);
      firstPage.drawText(line.text, {
        x: textCenterX + textW / 2,
        y: textY,
        size: line.size,
        font: line.bold ? boldFont : font,
        color: line.color || TEXT_DARK,
        rotate: degrees(180)
      });
      textY += line.size + 3;
    });

  } else {
    // NO ROTATION (0°)
    const containerX = rawWidth - edgeMargin - containerWidth;
    const containerY = rawHeight - edgeMargin - containerHeight;

    firstPage.drawRectangle({
      x: containerX,
      y: containerY,
      width: containerWidth,
      height: containerHeight,
      color: rgb(1, 1, 1),
      opacity: bgOpacity,
      borderColor: rgb(0.75, 0.7, 0.85), // Light purple border
      borderWidth: 1.5
    });

    const textCenterX = containerX + containerWidth / 2;
    let textY = containerY + containerHeight - containerPadding;

    lines.forEach(line => {
      if (line.text === '') {
        textY -= line.size;
        return;
      }
      const textW = (line.bold ? boldFont : font).widthOfTextAtSize(line.text, line.size);
      firstPage.drawText(line.text, {
        x: textCenterX - textW / 2,
        y: textY,
        size: line.size,
        font: line.bold ? boldFont : font,
        color: line.color || TEXT_DARK
      });
      textY -= line.size + 3;
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

/**
 * Add "NEEDS REVIEW" stamp to a PDF
 * Applied when invoice enters the needs_review status
 */
async function stampNeedsReview(pdfBuffer, reviewData) {
  const {
    date,
    vendorName,
    invoiceNumber,
    amount,
    flags = [] // review flags like 'no_job', 'low_confidence', etc.
  } = reviewData;

  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const pages = pdfDoc.getPages();
  const firstPage = pages[0];

  const rotation = firstPage.getRotation().angle;
  const { width: rawWidth, height: rawHeight } = firstPage.getSize();

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // === BUILD TEXT LINES ===
  const lines = [];
  const REVIEW_COLOR = rgb(0.85, 0.55, 0.1); // Orange for review

  lines.push({
    text: 'NEEDS REVIEW',
    bold: true,
    size: 14,
    color: REVIEW_COLOR
  });

  if (date) {
    lines.push({ text: date, size: 9, color: TEXT_DARK });
  }

  lines.push({ text: '', size: 4 }); // Spacer

  // Amount
  if (amount) {
    lines.push({ text: formatMoney(amount), bold: true, size: 14, color: TEXT_DARK });
  }

  // Vendor
  if (vendorName) {
    lines.push({ text: '', size: 4 });
    const truncVendor = vendorName.length > 25 ? vendorName.substring(0, 22) + '...' : vendorName;
    lines.push({ text: truncVendor, size: 10, color: TEXT_DARK });
  }

  // Invoice number
  if (invoiceNumber) {
    lines.push({ text: `#${invoiceNumber}`, size: 9, color: TEXT_LIGHT });
  }

  // Show first 2 flags if any
  if (flags.length > 0) {
    lines.push({ text: '', size: 4 });
    const flagLabels = {
      'no_job': 'No Job',
      'no_po': 'No PO',
      'low_confidence': 'Low AI Confidence',
      'duplicate_warning': 'Possible Duplicate',
      'amount_mismatch': 'Amount Mismatch',
      'split_child': 'Split Invoice'
    };
    flags.slice(0, 2).forEach(flag => {
      const label = flagLabels[flag] || flag;
      // Note: Using [!] instead of ⚠ because WinAnsi fonts can't encode Unicode symbols
      lines.push({ text: `[!] ${label}`, size: 8, color: REVIEW_COLOR });
    });
  }

  // === STAMP CONFIGURATION ===
  const containerWidth = 180;
  const containerPadding = 10;
  const edgeMargin = 20;
  const bgOpacity = 0.92;

  let totalTextHeight = 0;
  lines.forEach(line => {
    totalTextHeight += (line.text === '') ? line.size : (line.size + 3);
  });
  const containerHeight = containerPadding * 2 + totalTextHeight;

  // === DRAW STAMP BASED ON ROTATION ===
  if (rotation === 0) {
    const containerX = rawWidth - edgeMargin - containerWidth;
    const containerY = rawHeight - edgeMargin - containerHeight;

    firstPage.drawRectangle({
      x: containerX,
      y: containerY,
      width: containerWidth,
      height: containerHeight,
      color: rgb(1, 1, 1),
      opacity: bgOpacity,
      borderColor: rgb(0.9, 0.75, 0.5), // Light orange border
      borderWidth: 1.5
    });

    const textCenterX = containerX + containerWidth / 2;
    let textY = containerY + containerHeight - containerPadding;

    lines.forEach(line => {
      if (line.text === '') {
        textY -= line.size;
        return;
      }
      const textW = (line.bold ? boldFont : font).widthOfTextAtSize(line.text, line.size);
      firstPage.drawText(line.text, {
        x: textCenterX - textW / 2,
        y: textY,
        size: line.size,
        font: line.bold ? boldFont : font,
        color: line.color || TEXT_DARK
      });
      textY -= line.size + 3;
    });
  } else if (rotation === 270) {
    const visualMargin = 30;
    const boxX = rawWidth - visualMargin - containerHeight;
    const boxY = visualMargin;
    const boxW = containerHeight;
    const boxH = containerWidth;

    firstPage.drawRectangle({
      x: boxX, y: boxY, width: boxW, height: boxH,
      color: rgb(1, 1, 1), opacity: bgOpacity,
      borderColor: rgb(0.9, 0.75, 0.5), borderWidth: 1.5
    });

    let textX = boxX + boxW - containerPadding;
    const boxCenterY = boxY + boxH / 2;

    lines.forEach(line => {
      if (line.text === '') { textX -= line.size; return; }
      const textW = (line.bold ? boldFont : font).widthOfTextAtSize(line.text, line.size);
      firstPage.drawText(line.text, {
        x: textX, y: boxCenterY + textW / 2,
        size: line.size, font: line.bold ? boldFont : font,
        color: line.color || TEXT_DARK, rotate: degrees(-90)
      });
      textX -= line.size + 3;
    });
  } else if (rotation === 90) {
    const containerRawX = edgeMargin;
    const containerRawY = rawHeight - edgeMargin - containerWidth;

    firstPage.drawRectangle({
      x: containerRawX, y: containerRawY,
      width: containerHeight, height: containerWidth,
      color: rgb(1, 1, 1), opacity: bgOpacity,
      borderColor: rgb(0.9, 0.75, 0.5), borderWidth: 1.5
    });

    let textX = containerRawX + containerPadding;
    const textCenterY = containerRawY + containerWidth / 2;

    lines.forEach(line => {
      if (line.text === '') { textX += line.size; return; }
      const textW = (line.bold ? boldFont : font).widthOfTextAtSize(line.text, line.size);
      firstPage.drawText(line.text, {
        x: textX, y: textCenterY + textW / 2,
        size: line.size, font: line.bold ? boldFont : font,
        color: line.color || TEXT_DARK, rotate: degrees(-90)
      });
      textX += line.size + 3;
    });
  } else if (rotation === 180) {
    const containerRawX = edgeMargin;
    const containerRawY = edgeMargin;

    firstPage.drawRectangle({
      x: containerRawX, y: containerRawY,
      width: containerWidth, height: containerHeight,
      color: rgb(1, 1, 1), opacity: bgOpacity,
      borderColor: rgb(0.9, 0.75, 0.5), borderWidth: 1.5
    });

    const textCenterX = containerRawX + containerWidth / 2;
    let textY = containerRawY + containerPadding;

    lines.forEach(line => {
      if (line.text === '') { textY += line.size; return; }
      const textW = (line.bold ? boldFont : font).widthOfTextAtSize(line.text, line.size);
      firstPage.drawText(line.text, {
        x: textCenterX + textW / 2, y: textY,
        size: line.size, font: line.bold ? boldFont : font,
        color: line.color || TEXT_DARK, rotate: degrees(180)
      });
      textY += line.size + 3;
    });
  }

  const stampedPdfBytes = await pdfDoc.save();
  return Buffer.from(stampedPdfBytes);
}

/**
 * Add "READY FOR APPROVAL" stamp to a PDF
 * Applied when invoice is submitted for approval (ready_for_approval status)
 * This stamp builds on any existing stamp (progressive stamping)
 */
async function stampReadyForApproval(pdfBuffer, approvalData) {
  const {
    date,
    codedBy,
    jobName,
    vendorName,
    amount,
    costCodes = [] // allocated cost codes
  } = approvalData;

  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const pages = pdfDoc.getPages();
  const firstPage = pages[0];

  const rotation = firstPage.getRotation().angle;
  const { width: rawWidth, height: rawHeight } = firstPage.getSize();

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // === BUILD TEXT LINES ===
  const lines = [];
  const PENDING_COLOR = rgb(0.35, 0.55, 0.75); // Blue for pending approval

  lines.push({
    text: 'READY FOR APPROVAL',
    bold: true,
    size: 12,
    color: PENDING_COLOR
  });

  if (date) {
    lines.push({ text: date, size: 9, color: TEXT_DARK });
  }
  if (codedBy) {
    lines.push({ text: `Coded by ${codedBy}`, size: 9, color: TEXT_DARK });
  }

  lines.push({ text: '', size: 4 }); // Spacer

  // Amount
  if (amount) {
    lines.push({ text: formatMoney(amount), bold: true, size: 14, color: TEXT_DARK });
  }

  lines.push({ text: '', size: 4 }); // Spacer

  // Job
  if (jobName) {
    const truncJob = jobName.length > 25 ? jobName.substring(0, 22) + '...' : jobName;
    lines.push({ text: truncJob, size: 10, color: TEXT_DARK, bold: true });
  }

  // Cost codes - show first 3
  if (costCodes.length > 0) {
    lines.push({ text: '', size: 2 });
    costCodes.slice(0, 3).forEach(cc => {
      const truncName = cc.name && cc.name.length > 15 ? cc.name.substring(0, 12) + '...' : (cc.name || '');
      lines.push({
        text: `${cc.code} ${truncName} ${formatMoney(cc.amount)}`,
        size: 8,
        color: TEXT_DARK
      });
    });
    if (costCodes.length > 3) {
      lines.push({ text: `+${costCodes.length - 3} more...`, size: 7, color: TEXT_DARK });
    }
  }

  // === STAMP CONFIGURATION ===
  const containerWidth = 200;
  const containerPadding = 12;
  const edgeMargin = 20;
  const bgOpacity = 0.92;

  let totalTextHeight = 0;
  lines.forEach(line => {
    totalTextHeight += (line.text === '') ? line.size : (line.size + 3);
  });
  const containerHeight = containerPadding * 2 + totalTextHeight;

  // === DRAW STAMP BASED ON ROTATION ===
  if (rotation === 0) {
    const containerX = rawWidth - edgeMargin - containerWidth;
    const containerY = rawHeight - edgeMargin - containerHeight;

    firstPage.drawRectangle({
      x: containerX,
      y: containerY,
      width: containerWidth,
      height: containerHeight,
      color: rgb(1, 1, 1),
      opacity: bgOpacity,
      borderColor: rgb(0.6, 0.75, 0.9), // Light blue border
      borderWidth: 1.5
    });

    const textCenterX = containerX + containerWidth / 2;
    let textY = containerY + containerHeight - containerPadding;

    lines.forEach(line => {
      if (line.text === '') {
        textY -= line.size;
        return;
      }
      const textW = (line.bold ? boldFont : font).widthOfTextAtSize(line.text, line.size);
      firstPage.drawText(line.text, {
        x: textCenterX - textW / 2,
        y: textY,
        size: line.size,
        font: line.bold ? boldFont : font,
        color: line.color || TEXT_DARK
      });
      textY -= line.size + 3;
    });
  } else if (rotation === 270) {
    const visualMargin = 30;
    const boxX = rawWidth - visualMargin - containerHeight;
    const boxY = visualMargin;
    const boxW = containerHeight;
    const boxH = containerWidth;

    firstPage.drawRectangle({
      x: boxX, y: boxY, width: boxW, height: boxH,
      color: rgb(1, 1, 1), opacity: bgOpacity,
      borderColor: rgb(0.6, 0.75, 0.9), borderWidth: 1.5
    });

    let textX = boxX + boxW - containerPadding;
    const boxCenterY = boxY + boxH / 2;

    lines.forEach(line => {
      if (line.text === '') { textX -= line.size; return; }
      const textW = (line.bold ? boldFont : font).widthOfTextAtSize(line.text, line.size);
      firstPage.drawText(line.text, {
        x: textX, y: boxCenterY + textW / 2,
        size: line.size, font: line.bold ? boldFont : font,
        color: line.color || TEXT_DARK, rotate: degrees(-90)
      });
      textX -= line.size + 3;
    });
  } else if (rotation === 90) {
    const containerRawX = edgeMargin;
    const containerRawY = rawHeight - edgeMargin - containerWidth;

    firstPage.drawRectangle({
      x: containerRawX, y: containerRawY,
      width: containerHeight, height: containerWidth,
      color: rgb(1, 1, 1), opacity: bgOpacity,
      borderColor: rgb(0.6, 0.75, 0.9), borderWidth: 1.5
    });

    let textX = containerRawX + containerPadding;
    const textCenterY = containerRawY + containerWidth / 2;

    lines.forEach(line => {
      if (line.text === '') { textX += line.size; return; }
      const textW = (line.bold ? boldFont : font).widthOfTextAtSize(line.text, line.size);
      firstPage.drawText(line.text, {
        x: textX, y: textCenterY + textW / 2,
        size: line.size, font: line.bold ? boldFont : font,
        color: line.color || TEXT_DARK, rotate: degrees(-90)
      });
      textX += line.size + 3;
    });
  } else if (rotation === 180) {
    const containerRawX = edgeMargin;
    const containerRawY = edgeMargin;

    firstPage.drawRectangle({
      x: containerRawX, y: containerRawY,
      width: containerWidth, height: containerHeight,
      color: rgb(1, 1, 1), opacity: bgOpacity,
      borderColor: rgb(0.6, 0.75, 0.9), borderWidth: 1.5
    });

    const textCenterX = containerRawX + containerWidth / 2;
    let textY = containerRawY + containerPadding;

    lines.forEach(line => {
      if (line.text === '') { textY += line.size; return; }
      const textW = (line.bold ? boldFont : font).widthOfTextAtSize(line.text, line.size);
      firstPage.drawText(line.text, {
        x: textCenterX + textW / 2, y: textY,
        size: line.size, font: line.bold ? boldFont : font,
        color: line.color || TEXT_DARK, rotate: degrees(180)
      });
      textY += line.size + 3;
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
  stampPartiallyBilled,
  stampSplit,
  stampNeedsReview,
  stampReadyForApproval
};

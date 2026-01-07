/**
 * PDF Stamping Module
 * Adds approval stamps to invoice PDFs
 */

const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');

/**
 * Add an approval stamp to a PDF
 * @param {Buffer} pdfBuffer - Original PDF as buffer
 * @param {Object} stampData - Data to include in stamp
 * @returns {Promise<Buffer>} - Stamped PDF as buffer
 */
async function stampApproval(pdfBuffer, stampData) {
  console.log('=== PDF STAMPER DEBUG ===');
  console.log('Received stampData:', JSON.stringify(stampData, null, 2));
  console.log('=========================');

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
    poDescription,
    poTotal,
    poBilledToDate
  } = stampData;

  // Load the PDF
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const pages = pdfDoc.getPages();
  const firstPage = pages[0];

  // Get page dimensions
  const { width, height } = firstPage.getSize();

  // Embed fonts
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Check if this is a partial approval (allocated < invoice amount)
  const invoiceAmount = parseFloat(amount || 0);
  const allocatedAmount = costCodes.reduce((sum, cc) => sum + parseFloat(cc.amount || 0), 0);
  const isPartial = allocatedAmount > 0 && allocatedAmount < invoiceAmount - 0.01;
  const remainingAmount = invoiceAmount - allocatedAmount;
  const allocPct = invoiceAmount > 0 ? Math.round((allocatedAmount / invoiceAmount) * 100) : 0;

  // Determine display status and color
  const displayStatus = isPartial ? 'PARTIAL APPROVAL' : status;
  const statusColor = isPartial ? rgb(0.9, 0.5, 0.1) : rgb(0.1, 0.5, 0.1); // Orange for partial, green for full

  // Stamp configuration
  const stampWidth = 240;
  const lineHeight = 13;
  const sectionGap = 4;
  const padding = 12;
  const x = width - stampWidth - 15;  // 15px from right edge
  const startY = height - 15;         // 15px from top

  // Build stamp content as sections
  const sections = [];

  // Header section
  const headerLines = [
    { text: displayStatus, bold: true, size: isPartial ? 14 : 16, color: statusColor }
  ];

  // Add partial info right after status
  if (isPartial) {
    headerLines.push({
      text: `${allocPct}% of invoice (${formatMoney(remainingAmount)} remaining)`,
      size: 9,
      color: rgb(0.7, 0.4, 0.1)
    });
  }
  if (date) headerLines.push({ text: `Date: ${date}`, size: 9 });
  if (approvedBy) headerLines.push({ text: `Approved By: ${approvedBy}`, size: 9 });
  sections.push({ lines: headerLines });

  // Invoice details section
  const detailLines = [];
  if (vendorName) {
    const truncVendor = vendorName.length > 30 ? vendorName.substring(0, 27) + '...' : vendorName;
    detailLines.push({ text: `Vendor: ${truncVendor}`, size: 9 });
  }
  if (invoiceNumber) detailLines.push({ text: `Invoice #: ${invoiceNumber}`, size: 9 });
  if (jobName) {
    const truncJob = jobName.length > 28 ? jobName.substring(0, 25) + '...' : jobName;
    detailLines.push({ text: `Job: ${truncJob}`, size: 9 });
  }
  if (amount) detailLines.push({ text: `Total Amount: ${formatMoney(amount)}`, bold: true, size: 11 });
  if (detailLines.length > 0) sections.push({ lines: detailLines });

  // Cost codes section
  console.log('Cost codes received:', costCodes.length, costCodes);
  if (costCodes.length > 0) {
    const ccLines = [
      { text: 'COST CODE ALLOCATIONS', bold: true, size: 8, color: rgb(0.3, 0.3, 0.3) }
    ];
    costCodes.forEach(cc => {
      console.log('Processing cost code:', cc);
      const truncName = cc.name && cc.name.length > 25 ? cc.name.substring(0, 22) + '...' : (cc.name || 'Unknown');
      ccLines.push({
        text: `${cc.code}  ${truncName}`,
        size: 9
      });
      ccLines.push({
        text: `     ${formatMoney(cc.amount)}`,
        size: 9,
        indent: true
      });
    });
    sections.push({ lines: ccLines });
    console.log('Added cost code section with', ccLines.length, 'lines');
  } else {
    console.log('No cost codes to add');
  }

  // PO section
  if (poNumber) {
    const poLines = [
      { text: 'LINKED PURCHASE ORDER', bold: true, size: 8, color: rgb(0.2, 0.4, 0.6) },
      { text: `PO #: ${poNumber}`, bold: true, size: 10 }
    ];
    if (poDescription) {
      const truncDesc = poDescription.length > 35 ? poDescription.substring(0, 32) + '...' : poDescription;
      poLines.push({ text: truncDesc, size: 8, color: rgb(0.4, 0.4, 0.4) });
    }
    if (poTotal) {
      poLines.push({ text: `PO Total: ${formatMoney(poTotal)}`, size: 9 });

      if (poBilledToDate !== undefined) {
        const billedWithThis = poBilledToDate + (amount || 0);
        const remaining = poTotal - billedWithThis;
        const pctBilled = Math.round((billedWithThis / poTotal) * 100);

        poLines.push({ text: `Previously Billed: ${formatMoney(poBilledToDate)}`, size: 9 });
        poLines.push({ text: `This Invoice: ${formatMoney(amount || 0)}`, size: 9 });
        poLines.push({
          text: `Total Billed: ${formatMoney(billedWithThis)} (${pctBilled}%)`,
          bold: true,
          size: 9
        });
        poLines.push({
          text: `PO Balance: ${formatMoney(remaining)}`,
          bold: true,
          size: 10,
          color: remaining < 0 ? rgb(0.8, 0.1, 0.1) : rgb(0.1, 0.4, 0.1)
        });
      }
    }
    sections.push({ lines: poLines });
  } else {
    // Show "No PO" indicator
    sections.push({
      lines: [
        { text: 'PURCHASE ORDER', bold: true, size: 8, color: rgb(0.5, 0.5, 0.5) },
        { text: 'No PO Linked', size: 9, color: rgb(0.5, 0.5, 0.5) }
      ]
    });
  }

  // Calculate total height
  let totalLines = 0;
  sections.forEach((section, i) => {
    totalLines += section.lines.length;
    if (i < sections.length - 1) totalLines += 0.5; // Gap between sections
  });
  const stampHeight = (totalLines * lineHeight) + (padding * 2) + (sections.length - 1) * sectionGap;

  // Draw stamp background
  firstPage.drawRectangle({
    x: x - padding,
    y: startY - stampHeight,
    width: stampWidth + (padding * 2),
    height: stampHeight,
    color: rgb(1, 1, 1),
    opacity: 0.95,
    borderColor: rgb(0.2, 0.6, 0.2),
    borderWidth: 2
  });

  // Draw a subtle header bar
  firstPage.drawRectangle({
    x: x - padding,
    y: startY - 28,
    width: stampWidth + (padding * 2),
    height: 28,
    color: rgb(0.9, 0.95, 0.9),
    opacity: 1
  });

  // Draw stamp text
  let currentY = startY - padding - lineHeight + 2;

  sections.forEach((section, sectionIndex) => {
    section.lines.forEach(line => {
      const textX = line.indent ? x + 20 : x;
      firstPage.drawText(line.text, {
        x: textX,
        y: currentY,
        size: line.size || 10,
        font: line.bold ? boldFont : font,
        color: line.color || rgb(0.15, 0.15, 0.15)
      });
      currentY -= lineHeight;
    });

    // Add gap between sections
    if (sectionIndex < sections.length - 1) {
      currentY -= sectionGap;
    }
  });

  // Save and return
  const stampedPdfBytes = await pdfDoc.save();
  return Buffer.from(stampedPdfBytes);
}

/**
 * Add "IN DRAW" stamp to a PDF
 * @param {Buffer} pdfBuffer - PDF as buffer
 * @param {number} drawNumber - Draw number
 * @returns {Promise<Buffer>}
 */
async function stampInDraw(pdfBuffer, drawNumber) {
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const pages = pdfDoc.getPages();
  const firstPage = pages[0];

  const { width, height } = firstPage.getSize();
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Draw "IN DRAW #X" stamp at bottom right
  const text = `IN DRAW #${drawNumber}`;
  const textWidth = font.widthOfTextAtSize(text, 12);

  firstPage.drawRectangle({
    x: width - textWidth - 30,
    y: 15,
    width: textWidth + 20,
    height: 25,
    color: rgb(0.9, 0.9, 0.5),
    borderColor: rgb(0.6, 0.6, 0.2),
    borderWidth: 1
  });

  firstPage.drawText(text, {
    x: width - textWidth - 20,
    y: 22,
    size: 12,
    font: font,
    color: rgb(0.3, 0.3, 0)
  });

  const stampedPdfBytes = await pdfDoc.save();
  return Buffer.from(stampedPdfBytes);
}

/**
 * Add "PAID" stamp to a PDF
 * @param {Buffer} pdfBuffer - PDF as buffer
 * @param {string} paidDate - Date paid
 * @returns {Promise<Buffer>}
 */
async function stampPaid(pdfBuffer, paidDate) {
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const pages = pdfDoc.getPages();
  const firstPage = pages[0];

  const { width, height } = firstPage.getSize();
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Draw large "PAID" watermark diagonally
  firstPage.drawText('PAID', {
    x: width / 2 - 100,
    y: height / 2,
    size: 72,
    font: font,
    color: rgb(0.8, 0.2, 0.2),
    opacity: 0.3,
    rotate: { type: 'degrees', angle: -45 }
  });

  // Add paid date stamp
  if (paidDate) {
    firstPage.drawText(`Paid: ${paidDate}`, {
      x: 20,
      y: 20,
      size: 10,
      font: font,
      color: rgb(0.5, 0.1, 0.1)
    });
  }

  const stampedPdfBytes = await pdfDoc.save();
  return Buffer.from(stampedPdfBytes);
}

/**
 * Add "PARTIALLY PAID" stamp to a PDF
 * @param {Buffer} pdfBuffer - PDF as buffer
 * @param {Object} paymentData - Payment information
 * @returns {Promise<Buffer>}
 */
async function stampPartiallyPaid(pdfBuffer, paymentData) {
  const {
    paidDate,
    drawNumber,
    amountPaidThisDraw,
    cumulativePaid,
    invoiceTotal,
    remaining,
    costCodes = []
  } = paymentData;

  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const pages = pdfDoc.getPages();
  const firstPage = pages[0];

  const { width, height } = firstPage.getSize();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Draw large "PARTIAL" watermark diagonally
  firstPage.drawText('PARTIAL', {
    x: width / 2 - 120,
    y: height / 2,
    size: 60,
    font: boldFont,
    color: rgb(0.9, 0.6, 0.1),
    opacity: 0.25,
    rotate: { type: 'degrees', angle: -45 }
  });

  // Add partial payment info box at bottom left
  const boxWidth = 220;
  const boxHeight = 100 + (costCodes.length * 12);
  const boxX = 15;
  const boxY = 15;

  // Draw background
  firstPage.drawRectangle({
    x: boxX,
    y: boxY,
    width: boxWidth,
    height: boxHeight,
    color: rgb(1, 0.98, 0.9),
    borderColor: rgb(0.9, 0.6, 0.1),
    borderWidth: 2
  });

  // Draw header bar
  firstPage.drawRectangle({
    x: boxX,
    y: boxY + boxHeight - 22,
    width: boxWidth,
    height: 22,
    color: rgb(0.95, 0.85, 0.6)
  });

  let textY = boxY + boxHeight - 16;
  const textX = boxX + 10;

  // Header
  firstPage.drawText('PARTIALLY PAID', {
    x: textX,
    y: textY,
    size: 12,
    font: boldFont,
    color: rgb(0.6, 0.4, 0)
  });
  textY -= 18;

  // Payment details
  const lines = [
    { label: 'Date:', value: paidDate || new Date().toLocaleDateString() },
    { label: 'Draw #:', value: String(drawNumber || 'N/A') },
    { label: 'This Payment:', value: formatMoney(amountPaidThisDraw || 0) },
    { label: 'Total Paid:', value: formatMoney(cumulativePaid || 0) },
    { label: 'Invoice Total:', value: formatMoney(invoiceTotal || 0) },
    { label: 'REMAINING:', value: formatMoney(remaining || 0), bold: true, color: rgb(0.8, 0.2, 0.1) }
  ];

  lines.forEach(line => {
    firstPage.drawText(line.label, {
      x: textX,
      y: textY,
      size: 9,
      font: font,
      color: rgb(0.3, 0.3, 0.3)
    });
    firstPage.drawText(line.value, {
      x: textX + 75,
      y: textY,
      size: line.bold ? 10 : 9,
      font: line.bold ? boldFont : font,
      color: line.color || rgb(0.1, 0.1, 0.1)
    });
    textY -= 12;
  });

  // Cost codes paid
  if (costCodes.length > 0) {
    textY -= 4;
    firstPage.drawText('Cost Codes Paid:', {
      x: textX,
      y: textY,
      size: 8,
      font: boldFont,
      color: rgb(0.4, 0.4, 0.4)
    });
    textY -= 10;

    costCodes.forEach(cc => {
      const ccText = `${cc.code} - ${formatMoney(cc.amount)}`;
      firstPage.drawText(ccText, {
        x: textX + 5,
        y: textY,
        size: 8,
        font: font,
        color: rgb(0.3, 0.3, 0.3)
      });
      textY -= 10;
    });
  }

  const stampedPdfBytes = await pdfDoc.save();
  return Buffer.from(stampedPdfBytes);
}

function formatMoney(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2
  }).format(amount);
}

module.exports = {
  stampApproval,
  stampInDraw,
  stampPaid,
  stampPartiallyPaid
};

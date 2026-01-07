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
    { text: status, bold: true, size: 16, color: rgb(0.1, 0.5, 0.1) }
  ];
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
  if (costCodes.length > 0) {
    const ccLines = [
      { text: 'COST CODE ALLOCATIONS', bold: true, size: 8, color: rgb(0.3, 0.3, 0.3) }
    ];
    costCodes.forEach(cc => {
      const truncName = cc.name.length > 25 ? cc.name.substring(0, 22) + '...' : cc.name;
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
  }

  // PO section
  if (poNumber) {
    const poLines = [
      { text: 'PURCHASE ORDER', bold: true, size: 8, color: rgb(0.3, 0.3, 0.3) },
      { text: `PO #: ${poNumber}`, size: 9 }
    ];
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
          text: `PO Remaining: ${formatMoney(remaining)}`,
          bold: true,
          size: 10,
          color: remaining < 0 ? rgb(0.8, 0.1, 0.1) : rgb(0.1, 0.4, 0.1)
        });
      }
    }
    sections.push({ lines: poLines });
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
  stampPaid
};

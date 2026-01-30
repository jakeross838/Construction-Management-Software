/**
 * Proposal PDF Generator
 * Creates professional client-facing proposal PDFs from estimate data
 */

const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

// Brand colors (matching pdf-stamper.js)
const BRAND_COLOR = rgb(0.29, 0.4, 0.45); // #4A6672 slate teal
const TEXT_DARK = rgb(0.2, 0.2, 0.2);
const TEXT_LIGHT = rgb(0.5, 0.5, 0.5);
const BORDER_COLOR = rgb(0.85, 0.85, 0.85);

// Page constants
const PAGE_WIDTH = 612;  // Letter size
const PAGE_HEIGHT = 792;
const MARGIN = 50;
const CONTENT_WIDTH = PAGE_WIDTH - (2 * MARGIN);

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
 * Load the Ross Built logo
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
  const BOTTOM_MARGIN = 60;
  if (currentY - neededSpace < BOTTOM_MARGIN) {
    const newPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    return { page: newPage, y: PAGE_HEIGHT - MARGIN };
  }
  return { page: currentPage, y: currentY };
}

/**
 * Draw a horizontal line
 */
function drawLine(page, y) {
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_WIDTH - MARGIN, y },
    thickness: 0.5,
    color: BORDER_COLOR
  });
}

/**
 * Generate proposal PDF
 * @param {Object} data - Proposal data
 * @returns {Promise<Buffer>} - PDF buffer
 */
async function generateProposalPDF(data) {
  const {
    company,         // Company branding info from v2_company_settings
    job,             // Job details
    estimate,        // Estimate with sections/items
    proposal,        // Proposal options (detail level, payment_terms)
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
    const logoDims = logoImage.scale(0.25);
    page.drawImage(logoImage, {
      x: MARGIN,
      y: y - logoDims.height,
      width: logoDims.width,
      height: logoDims.height
    });
    // Company info to the right of logo
    const textX = MARGIN + logoDims.width + 20;
    page.drawText(company.company_name || 'Ross Built Custom Homes', {
      x: textX, y: y - 15, font: boldFont, size: 14, color: BRAND_COLOR
    });
    page.drawText(company.address || '', {
      x: textX, y: y - 30, font, size: 9, color: TEXT_LIGHT
    });
    page.drawText(`${company.phone || ''} | ${company.email || ''}`, {
      x: textX, y: y - 42, font, size: 9, color: TEXT_LIGHT
    });
    if (company.license_number) {
      page.drawText(`License: ${company.license_number}`, {
        x: textX, y: y - 54, font, size: 8, color: TEXT_LIGHT
      });
    }
    y -= Math.max(logoDims.height, 60) + 20;
  } else {
    // No logo - just text header
    page.drawText(company.company_name || 'Ross Built Custom Homes', {
      x: MARGIN, y, font: boldFont, size: 16, color: BRAND_COLOR
    });
    y -= 40;
  }

  // === PROPOSAL TITLE ===
  drawLine(page, y);
  y -= 25;
  page.drawText('PROPOSAL', {
    x: MARGIN, y, font: boldFont, size: 20, color: TEXT_DARK
  });
  // Proposal number on right
  if (proposal.proposal_number) {
    const numText = proposal.proposal_number;
    const numWidth = boldFont.widthOfTextAtSize(numText, 12);
    page.drawText(numText, {
      x: PAGE_WIDTH - MARGIN - numWidth, y: y + 2, font: boldFont, size: 12, color: TEXT_LIGHT
    });
  }
  y -= 30;

  // === PROJECT INFO ===
  page.drawText('Project:', { x: MARGIN, y, font: boldFont, size: 11, color: TEXT_DARK });
  page.drawText(job.name || 'Project Name', { x: MARGIN + 60, y, font, size: 11, color: TEXT_DARK });
  y -= 16;
  if (job.address) {
    page.drawText('Address:', { x: MARGIN, y, font: boldFont, size: 10, color: TEXT_DARK });
    page.drawText(job.address, { x: MARGIN + 60, y, font, size: 10, color: TEXT_DARK });
    y -= 14;
  }
  if (job.client_name) {
    page.drawText('Client:', { x: MARGIN, y, font: boldFont, size: 10, color: TEXT_DARK });
    page.drawText(job.client_name, { x: MARGIN + 60, y, font, size: 10, color: TEXT_DARK });
    y -= 14;
  }
  const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  page.drawText('Date:', { x: MARGIN, y, font: boldFont, size: 10, color: TEXT_DARK });
  page.drawText(dateStr, { x: MARGIN + 60, y, font, size: 10, color: TEXT_DARK });
  y -= 30;

  // === SCOPE OF WORK SECTIONS ===
  drawLine(page, y);
  y -= 20;
  page.drawText('SCOPE OF WORK', { x: MARGIN, y, font: boldFont, size: 14, color: TEXT_DARK });
  y -= 25;

  // Process sections based on detail level
  const sections = estimate.sections || [];
  const allowances = [];

  for (const section of sections) {
    // Check page break
    ({ page, y } = checkPageBreak(pdfDoc, page, y, 60));

    // Section header
    page.drawText(section.name, { x: MARGIN, y, font: boldFont, size: 12, color: BRAND_COLOR });
    y -= 18;

    if (proposal.detail_level === 'line_items') {
      // Show individual items
      const items = section.items || [];
      for (const item of items) {
        ({ page, y } = checkPageBreak(pdfDoc, page, y, 20));

        // Mark allowances
        if (item.is_allowance) {
          allowances.push(item);
          page.drawText('[ALLOWANCE]', { x: MARGIN + 10, y, font: boldFont, size: 8, color: rgb(0.7, 0.5, 0.1) });
          y -= 12;
        }

        // Item description and amount
        const desc = item.description || 'Item';
        const truncDesc = desc.length > 60 ? desc.substring(0, 57) + '...' : desc;
        page.drawText(truncDesc, { x: MARGIN + 10, y, font, size: 10, color: TEXT_DARK });

        const amtText = formatMoney(item.amount);
        const amtWidth = font.widthOfTextAtSize(amtText, 10);
        page.drawText(amtText, { x: PAGE_WIDTH - MARGIN - amtWidth, y, font, size: 10, color: TEXT_DARK });
        y -= 14;
      }
    } else {
      // Summary view - just section total
      if (section.description) {
        page.drawText(section.description, { x: MARGIN + 10, y, font, size: 10, color: TEXT_LIGHT });
        y -= 14;
      }
    }

    // Section subtotal
    const subtotalText = formatMoney(section.subtotal || 0);
    const subtotalWidth = boldFont.widthOfTextAtSize(subtotalText, 11);
    page.drawText('Section Total:', { x: PAGE_WIDTH - MARGIN - subtotalWidth - 100, y, font, size: 10, color: TEXT_DARK });
    page.drawText(subtotalText, { x: PAGE_WIDTH - MARGIN - subtotalWidth, y, font: boldFont, size: 11, color: TEXT_DARK });
    y -= 25;

    // Collect allowances from section items for summary
    if (proposal.detail_level === 'summary' && section.items) {
      section.items.filter(i => i.is_allowance).forEach(a => allowances.push(a));
    }
  }

  // === ALLOWANCES CALLOUT (PRO-02) ===
  if (proposal.show_allowances && allowances.length > 0) {
    ({ page, y } = checkPageBreak(pdfDoc, page, y, 80));
    drawLine(page, y);
    y -= 20;
    page.drawText('ALLOWANCES', { x: MARGIN, y, font: boldFont, size: 12, color: rgb(0.7, 0.5, 0.1) });
    y -= 15;
    page.drawText('The following items are allowances - placeholder amounts for selections you will make:', {
      x: MARGIN, y, font, size: 9, color: TEXT_LIGHT
    });
    y -= 18;

    for (const allowance of allowances) {
      ({ page, y } = checkPageBreak(pdfDoc, page, y, 18));
      const aDesc = allowance.description || 'Allowance';
      page.drawText(`- ${aDesc}: ${formatMoney(allowance.amount)}`, {
        x: MARGIN + 10, y, font, size: 10, color: TEXT_DARK
      });
      if (allowance.allowance_notes) {
        y -= 12;
        page.drawText(`  ${allowance.allowance_notes}`, { x: MARGIN + 15, y, font, size: 9, color: TEXT_LIGHT });
      }
      y -= 14;
    }
    y -= 10;
  }

  // === PRICING SUMMARY ===
  ({ page, y } = checkPageBreak(pdfDoc, page, y, 120));
  drawLine(page, y);
  y -= 20;
  page.drawText('PRICING SUMMARY', { x: MARGIN, y, font: boldFont, size: 14, color: TEXT_DARK });
  y -= 25;

  const rightColX = PAGE_WIDTH - MARGIN - 100;

  // Subtotal
  page.drawText('Subtotal:', { x: rightColX - 80, y, font, size: 11, color: TEXT_DARK });
  page.drawText(formatMoney(estimate.subtotal || estimate.total_amount), {
    x: rightColX, y, font, size: 11, color: TEXT_DARK
  });
  y -= 16;

  // Markups (if any)
  if (estimate.overhead_amount > 0) {
    page.drawText(`Overhead (${estimate.overhead_percent || 0}%):`, { x: rightColX - 80, y, font, size: 10, color: TEXT_LIGHT });
    page.drawText(formatMoney(estimate.overhead_amount), { x: rightColX, y, font, size: 10, color: TEXT_LIGHT });
    y -= 14;
  }
  if (estimate.profit_amount > 0) {
    page.drawText(`Profit (${estimate.profit_percent || 0}%):`, { x: rightColX - 80, y, font, size: 10, color: TEXT_LIGHT });
    page.drawText(formatMoney(estimate.profit_amount), { x: rightColX, y, font, size: 10, color: TEXT_LIGHT });
    y -= 14;
  }
  if (estimate.contingency_amount > 0) {
    page.drawText(`Contingency (${estimate.contingency_percent || 0}%):`, { x: rightColX - 80, y, font, size: 10, color: TEXT_LIGHT });
    page.drawText(formatMoney(estimate.contingency_amount), { x: rightColX, y, font, size: 10, color: TEXT_LIGHT });
    y -= 14;
  }

  // Grand total
  y -= 5;
  drawLine(page, y);
  y -= 20;
  page.drawText('TOTAL:', { x: rightColX - 80, y, font: boldFont, size: 14, color: TEXT_DARK });
  page.drawText(formatMoney(estimate.total_amount), { x: rightColX, y, font: boldFont, size: 14, color: BRAND_COLOR });
  y -= 35;

  // === PAYMENT SCHEDULE (PRO-04) ===
  if (proposal.payment_terms && proposal.payment_terms.length > 0) {
    ({ page, y } = checkPageBreak(pdfDoc, page, y, 100));
    drawLine(page, y);
    y -= 20;
    page.drawText('PAYMENT SCHEDULE', { x: MARGIN, y, font: boldFont, size: 12, color: TEXT_DARK });
    y -= 20;

    const grandTotal = estimate.total_amount || 0;
    for (const term of proposal.payment_terms) {
      ({ page, y } = checkPageBreak(pdfDoc, page, y, 30));
      const amount = grandTotal * (term.percent / 100);
      page.drawText(`${term.milestone}:`, { x: MARGIN + 10, y, font: boldFont, size: 10, color: TEXT_DARK });
      page.drawText(`${term.percent}% (${formatMoney(amount)})`, { x: MARGIN + 180, y, font, size: 10, color: TEXT_DARK });
      y -= 14;
      if (term.description) {
        page.drawText(term.description, { x: MARGIN + 20, y, font, size: 9, color: TEXT_LIGHT });
        y -= 14;
      }
    }
    y -= 15;
  }

  // === TERMS TEXT ===
  if (proposal.terms_text) {
    ({ page, y } = checkPageBreak(pdfDoc, page, y, 80));
    drawLine(page, y);
    y -= 20;
    page.drawText('TERMS & CONDITIONS', { x: MARGIN, y, font: boldFont, size: 11, color: TEXT_DARK });
    y -= 18;
    // Simple word wrap for terms
    const words = proposal.terms_text.split(' ');
    let line = '';
    for (const word of words) {
      const testLine = line + (line ? ' ' : '') + word;
      const testWidth = font.widthOfTextAtSize(testLine, 9);
      if (testWidth > CONTENT_WIDTH - 20) {
        ({ page, y } = checkPageBreak(pdfDoc, page, y, 14));
        page.drawText(line, { x: MARGIN + 10, y, font, size: 9, color: TEXT_LIGHT });
        y -= 12;
        line = word;
      } else {
        line = testLine;
      }
    }
    if (line) {
      page.drawText(line, { x: MARGIN + 10, y, font, size: 9, color: TEXT_LIGHT });
      y -= 20;
    }
  }

  // === ACCEPTANCE BLOCK ===
  ({ page, y } = checkPageBreak(pdfDoc, page, y, 100));
  y -= 20;
  drawLine(page, y);
  y -= 25;
  page.drawText('ACCEPTANCE', { x: MARGIN, y, font: boldFont, size: 12, color: TEXT_DARK });
  y -= 18;
  page.drawText('By accepting this proposal, you agree to the scope of work and pricing outlined above.', {
    x: MARGIN, y, font, size: 10, color: TEXT_DARK
  });
  y -= 40;

  // Signature lines
  page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + 200, y }, thickness: 1, color: TEXT_DARK });
  page.drawText('Client Signature', { x: MARGIN, y: y - 12, font, size: 9, color: TEXT_LIGHT });

  page.drawLine({ start: { x: PAGE_WIDTH - MARGIN - 150, y }, end: { x: PAGE_WIDTH - MARGIN, y }, thickness: 1, color: TEXT_DARK });
  page.drawText('Date', { x: PAGE_WIDTH - MARGIN - 150, y: y - 12, font, size: 9, color: TEXT_LIGHT });
  y -= 30;

  page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + 200, y }, thickness: 1, color: TEXT_DARK });
  page.drawText('Print Name', { x: MARGIN, y: y - 12, font, size: 9, color: TEXT_LIGHT });

  // === FOOTER ===
  if (company.proposal_footer_text) {
    const footerY = 30;
    const footerWidth = font.widthOfTextAtSize(company.proposal_footer_text, 8);
    page.drawText(company.proposal_footer_text, {
      x: (PAGE_WIDTH - footerWidth) / 2,
      y: footerY,
      font,
      size: 8,
      color: TEXT_LIGHT
    });
  }

  return Buffer.from(await pdfDoc.save());
}

module.exports = {
  generateProposalPDF,
  formatMoney
};

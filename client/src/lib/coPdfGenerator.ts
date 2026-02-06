import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ChangeOrder, formatCurrency, formatDate } from '@/types/financial';
import { CompanyInfo } from '@/lib/companyInfo';

export interface COPdfData {
  co: ChangeOrder & {
    job_client?: string;
    vendor_name?: string;
    job_address?: string;
  };
}

function drawCompanyHeader(doc: jsPDF, company: CompanyInfo): void {
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(company.name.toUpperCase(), 14, 20);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Printed: ${formatDate(new Date().toISOString())}`, pageWidth - 14, 15, { align: 'right' });
  if (company.address) {
    doc.text(company.address, pageWidth - 14, 20, { align: 'right' });
  }
  if (company.phone) {
    doc.text(`Phone: ${company.phone}`, pageWidth - 14, 25, { align: 'right' });
  }

  doc.setDrawColor(200, 200, 200);
  doc.line(14, 32, pageWidth - 14, 32);
}

export function generateCOPdf(co: COPdfData['co'], companyInfo?: CompanyInfo): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  const company = companyInfo || { name: 'Your Company', address: '', phone: '', email: '' };

  // Company Header
  drawCompanyHeader(doc, company);

  // Change Order Title
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Change Order', 14, 42);

  // Status badge
  const statusText = co.status === 'approved' ? 'APPROVED' :
                     co.status === 'pending' ? 'PENDING APPROVAL' :
                     co.status.toUpperCase();
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(statusText, pageWidth - 14, 42, { align: 'right' });

  // CO Info Row
  let yPos = 52;
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text('Date Created', 14, yPos);
  doc.text('Date Approved', 80, yPos);
  doc.text('Change Order #', 146, yPos);

  yPos += 5;
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.text(formatDate(co.created_at), 14, yPos);
  doc.text(co.approved_at ? formatDate(co.approved_at) : '\u2014', 80, yPos);
  doc.text(co.co_number, 146, yPos);

  // Horizontal line
  yPos += 6;
  doc.line(14, yPos, pageWidth - 14, yPos);

  // Job Info
  yPos += 8;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 100, 100);
  doc.text('JOB', 14, yPos);
  doc.text('CLIENT', pageWidth / 2, yPos);

  yPos += 5;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(co.job_name || '\u2014', 14, yPos);
  doc.text(co.job_client || '\u2014', pageWidth / 2, yPos);

  yPos += 10;
  doc.line(14, yPos, pageWidth - 14, yPos);

  // CO Description
  yPos += 8;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Description', 14, yPos);
  yPos += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const descLines = doc.splitTextToSize(co.description || '', pageWidth - 28);
  doc.text(descLines, 14, yPos);
  yPos += descLines.length * 4 + 6;

  // Financial Summary Table
  autoTable(doc, {
    startY: yPos,
    head: [['Cost Breakdown', 'Amount']],
    body: [
      ['Line Items Subtotal', formatCurrency(co.subtotal)],
      [`PM Time (${co.pm_hours || 0} hrs @ ${formatCurrency(co.pm_hourly_rate || 0)}/hr)`, formatCurrency(co.pm_cost || 0)],
      [`Markup (${co.markup_percent || 0}%)`, formatCurrency(co.markup_amount || 0)],
    ],
    foot: [['Estimated Total (NTE)', formatCurrency(co.total_amount)]],
    headStyles: {
      fillColor: [245, 245, 245],
      textColor: [50, 50, 50],
      fontStyle: 'bold',
      fontSize: 9,
    },
    bodyStyles: {
      fontSize: 9,
    },
    footStyles: {
      fillColor: [34, 139, 34],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 10,
    },
    columnStyles: {
      1: { halign: 'right' }
    },
    margin: { left: 14, right: 14 },
  });

  yPos = (doc as any).lastAutoTable.finalY + 8;

  // Schedule Impact
  if (co.days_impact !== 0) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    const impactText = co.days_impact > 0
      ? `Schedule Impact: +${co.days_impact} days`
      : `Schedule Impact: ${co.days_impact} days`;
    doc.text(impactText, 14, yPos);
    yPos += 8;
  }

  // Line Items Table
  if (co.line_items && co.line_items.length > 0) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Line Items', 14, yPos);
    yPos += 4;

    const lineItemsData = co.line_items.map((item, idx) => [
      (idx + 1).toString(),
      item.cost_code || '\u2014',
      item.description,
      formatCurrency(item.amount),
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['#', 'Cost Code', 'Description', 'Amount']],
      body: lineItemsData,
      headStyles: {
        fillColor: [245, 245, 245],
        textColor: [50, 50, 50],
        fontStyle: 'bold',
        fontSize: 8,
      },
      bodyStyles: {
        fontSize: 8,
      },
      columnStyles: {
        0: { cellWidth: 10 },
        1: { cellWidth: 25 },
        3: { halign: 'right', cellWidth: 30 }
      },
      margin: { left: 14, right: 14 },
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;
  }

  // Terms & Conditions
  doc.setDrawColor(200, 200, 200);
  doc.line(14, yPos, pageWidth - 14, yPos);
  yPos += 6;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('Terms & Conditions', 14, yPos);
  yPos += 5;

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  const termsText = [
    '\u2022 This budgetary change order represents an estimated cost based on anticipated expenses.',
    '\u2022 Invoices will be processed against this change order as work is completed.',
    '\u2022 Final invoiced amounts will not exceed the estimated total (NTE) without additional written approval.',
    '\u2022 By signing, client accepts all terms, conditions, schedule impacts, and authorizes work to proceed.',
  ];
  termsText.forEach(term => {
    const lines = doc.splitTextToSize(term, pageWidth - 28);
    doc.text(lines, 14, yPos);
    yPos += lines.length * 3 + 2;
  });

  // Signature Section
  yPos += 10;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(9);

  // Client signature
  doc.text('Client Acceptance:', 14, yPos);
  doc.line(50, yPos, 100, yPos);
  doc.text('Date:', 105, yPos);
  doc.line(120, yPos, 160, yPos);

  yPos += 10;

  // Builder signature
  doc.text('Builder Approval:', 14, yPos);
  doc.line(50, yPos, 100, yPos);
  doc.text('Date:', 105, yPos);
  doc.line(120, yPos, 160, yPos);

  // If already approved, show approval info
  if (co.approved_at) {
    yPos += 10;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.text(`Approved by: ${co.approved_by || 'System'} on ${formatDate(co.approved_at)}`, 14, yPos);
  }

  // Save the PDF
  doc.save(`${co.co_number}.pdf`);
}

export function generateCOPdfBase64(co: COPdfData['co'], companyInfo?: CompanyInfo): string {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  const company = companyInfo || { name: 'Your Company', address: '', phone: '', email: '' };

  // Company Header
  drawCompanyHeader(doc, company);

  // Change Order Title
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Change Order', 14, 42);

  const statusText = co.status === 'approved' ? 'APPROVED' :
                     co.status === 'pending' ? 'PENDING APPROVAL' :
                     co.status.toUpperCase();
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(statusText, pageWidth - 14, 42, { align: 'right' });

  let yPos = 52;
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text('Date Created', 14, yPos);
  doc.text('Date Approved', 80, yPos);
  doc.text('Change Order #', 146, yPos);

  yPos += 5;
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.text(formatDate(co.created_at), 14, yPos);
  doc.text(co.approved_at ? formatDate(co.approved_at) : '\u2014', 80, yPos);
  doc.text(co.co_number, 146, yPos);

  yPos += 6;
  doc.line(14, yPos, pageWidth - 14, yPos);

  yPos += 8;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 100, 100);
  doc.text('JOB', 14, yPos);
  doc.text('CLIENT', pageWidth / 2, yPos);

  yPos += 5;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(co.job_name || '\u2014', 14, yPos);
  doc.text(co.job_client || '\u2014', pageWidth / 2, yPos);

  yPos += 10;
  doc.line(14, yPos, pageWidth - 14, yPos);

  yPos += 8;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Description', 14, yPos);
  yPos += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const descLines = doc.splitTextToSize(co.description || '', pageWidth - 28);
  doc.text(descLines, 14, yPos);
  yPos += descLines.length * 4 + 6;

  autoTable(doc, {
    startY: yPos,
    head: [['Cost Breakdown', 'Amount']],
    body: [
      ['Line Items Subtotal', formatCurrency(co.subtotal)],
      [`PM Time (${co.pm_hours || 0} hrs @ ${formatCurrency(co.pm_hourly_rate || 0)}/hr)`, formatCurrency(co.pm_cost || 0)],
      [`Markup (${co.markup_percent || 0}%)`, formatCurrency(co.markup_amount || 0)],
    ],
    foot: [['Estimated Total (NTE)', formatCurrency(co.total_amount)]],
    headStyles: {
      fillColor: [245, 245, 245],
      textColor: [50, 50, 50],
      fontStyle: 'bold',
      fontSize: 9,
    },
    bodyStyles: {
      fontSize: 9,
    },
    footStyles: {
      fillColor: [34, 139, 34],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 10,
    },
    columnStyles: {
      1: { halign: 'right' }
    },
    margin: { left: 14, right: 14 },
  });

  yPos = (doc as any).lastAutoTable.finalY + 8;

  if (co.days_impact !== 0) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    const impactText = co.days_impact > 0
      ? `Schedule Impact: +${co.days_impact} days`
      : `Schedule Impact: ${co.days_impact} days`;
    doc.text(impactText, 14, yPos);
    yPos += 8;
  }

  if (co.line_items && co.line_items.length > 0) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Line Items', 14, yPos);
    yPos += 4;

    const lineItemsData = co.line_items.map((item, idx) => [
      (idx + 1).toString(),
      item.cost_code || '\u2014',
      item.description,
      formatCurrency(item.amount),
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['#', 'Cost Code', 'Description', 'Amount']],
      body: lineItemsData,
      headStyles: {
        fillColor: [245, 245, 245],
        textColor: [50, 50, 50],
        fontStyle: 'bold',
        fontSize: 8,
      },
      bodyStyles: {
        fontSize: 8,
      },
      columnStyles: {
        0: { cellWidth: 10 },
        1: { cellWidth: 25 },
        3: { halign: 'right', cellWidth: 30 }
      },
      margin: { left: 14, right: 14 },
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;
  }

  doc.setDrawColor(200, 200, 200);
  doc.line(14, yPos, pageWidth - 14, yPos);
  yPos += 6;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('Terms & Conditions', 14, yPos);
  yPos += 5;

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  const termsText = [
    '\u2022 This budgetary change order represents an estimated cost based on anticipated expenses.',
    '\u2022 By signing, client accepts all terms, conditions, schedule impacts, and authorizes work to proceed.',
  ];
  termsText.forEach(term => {
    const lines = doc.splitTextToSize(term, pageWidth - 28);
    doc.text(lines, 14, yPos);
    yPos += lines.length * 3 + 2;
  });

  // Convert to base64
  const pdfOutput = doc.output('datauristring');
  const base64 = pdfOutput.split(',')[1];
  return base64;
}

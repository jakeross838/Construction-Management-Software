import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PurchaseOrder, formatCurrency, formatDate } from '@/types/financial';

export function generatePOPdf(po: PurchaseOrder): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Company Header
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('ROSS BUILT', 14, 20);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('CUSTOM HOMES', 14, 26);
  
  // Right side header info
  doc.setFontSize(9);
  doc.text(`Printed: ${formatDate(new Date().toISOString())}`, pageWidth - 14, 15, { align: 'right' });
  doc.text('305 67th Street West, Bradenton, FL 34209', pageWidth - 14, 20, { align: 'right' });
  doc.text('Phone: (941) 778-7600', pageWidth - 14, 25, { align: 'right' });
  
  // Horizontal line
  doc.setDrawColor(200, 200, 200);
  doc.line(14, 32, pageWidth - 14, 32);
  
  // Purchase Order Title
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Purchase Order', 14, 42);
  
  // Status badge (text representation)
  const statusText = po.approval_status === 'approved' ? 'APPROVED' : 
                     po.approval_status === 'pending' ? 'PENDING APPROVAL' : 
                     po.approval_status.toUpperCase();
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(statusText, pageWidth - 14, 42, { align: 'right' });
  
  // PO Info Row
  let yPos = 52;
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text('Date Created', 14, yPos);
  doc.text('Date Released', 80, yPos);
  doc.text('Purchase Order #', 146, yPos);
  
  yPos += 5;
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.text(formatDate(po.created_at), 14, yPos);
  doc.text(po.approved_at ? formatDate(po.approved_at) : '—', 80, yPos);
  doc.text(po.po_number, 146, yPos);
  
  // Horizontal line
  yPos += 6;
  doc.line(14, yPos, pageWidth - 14, yPos);
  
  // Vendor and Job Info
  yPos += 8;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 100, 100);
  doc.text('SUB/VENDOR', 14, yPos);
  doc.text('JOB', pageWidth / 2, yPos);
  
  yPos += 5;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(po.vendor_name || '—', 14, yPos);
  doc.text(po.job_name || '—', pageWidth / 2, yPos);
  
  yPos += 5;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  if (po.vendor_address) {
    const vendorLines = po.vendor_address.split('\n');
    vendorLines.forEach(line => {
      doc.text(line, 14, yPos);
      yPos += 4;
    });
  }
  
  if (po.vendor_phone) {
    doc.text(`Phone: ${po.vendor_phone}`, 14, yPos);
    yPos += 4;
  }
  
  // Reset yPos for job address (parallel to vendor)
  let jobYPos = 82;
  if (po.job_address) {
    const jobLines = po.job_address.split('\n');
    jobLines.forEach(line => {
      doc.text(line, pageWidth / 2, jobYPos);
      jobYPos += 4;
    });
  }
  
  yPos = Math.max(yPos, jobYPos) + 4;
  doc.line(14, yPos, pageWidth - 14, yPos);
  
  // PO Title Table
  yPos += 4;
  autoTable(doc, {
    startY: yPos,
    head: [['PO Title', 'Scheduled Completion', 'Total Price']],
    body: [[
      po.description || '—',
      '—',
      formatCurrency(po.current_amount || po.original_amount || 0)
    ]],
    headStyles: {
      fillColor: [245, 245, 245],
      textColor: [50, 50, 50],
      fontStyle: 'bold',
      fontSize: 9,
    },
    bodyStyles: {
      fontSize: 10,
    },
    columnStyles: {
      2: { halign: 'right', fontStyle: 'bold' }
    },
    margin: { left: 14, right: 14 },
  });
  
  yPos = (doc as any).lastAutoTable.finalY + 6;
  
  // Scope of Work
  if (po.scope_of_work) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Scope of Work', 14, yPos);
    yPos += 5;
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const scopeLines = doc.splitTextToSize(po.scope_of_work, pageWidth - 28);
    doc.text(scopeLines, 14, yPos);
    yPos += scopeLines.length * 4 + 6;
  }
  
  // Line Items Table
  if (po.line_items && po.line_items.length > 0) {
    const lineItemsData = po.line_items.map(item => [
      item.cost_code_name || item.description,
      item.cost_code || '—',
      item.description,
      '1.00',
      formatCurrency(item.amount),
      formatCurrency(item.amount),
      item.invoiced_amount ? formatCurrency(item.invoiced_amount) : '—'
    ]);
    
    const totalPrice = po.current_amount || po.original_amount || 0;
    const totalPaid = po.invoiced_amount || 0;
    
    autoTable(doc, {
      startY: yPos,
      head: [['Items', 'Cost Code', 'Description', 'Qty', 'Unit Cost', 'Price', 'Paid']],
      body: lineItemsData,
      foot: [['', '', '', '', 'Total:', formatCurrency(totalPrice), formatCurrency(totalPaid)]],
      headStyles: {
        fillColor: [245, 245, 245],
        textColor: [50, 50, 50],
        fontStyle: 'bold',
        fontSize: 8,
      },
      bodyStyles: {
        fontSize: 8,
      },
      footStyles: {
        fillColor: [250, 250, 250],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        fontSize: 9,
      },
      columnStyles: {
        3: { halign: 'right' },
        4: { halign: 'right' },
        5: { halign: 'right' },
        6: { halign: 'right' }
      },
      margin: { left: 14, right: 14 },
    });
    
    yPos = (doc as any).lastAutoTable.finalY + 8;
    
    // Remaining Balance
    const remainingBalance = totalPrice - totalPaid;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(`Remaining Balance: ${formatCurrency(remainingBalance)}`, pageWidth - 14, yPos, { align: 'right' });
    yPos += 12;
  }
  
  // Signature / Approval Section
  doc.setDrawColor(200, 200, 200);
  doc.line(14, yPos, pageWidth - 14, yPos);
  yPos += 6;
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(100, 100, 100);
  const signatureText = 'A signature of Approval or Electronic Acceptance is required before purchase order is effective. This purchase order then becomes part of the existing contract and is binding.';
  const signatureLines = doc.splitTextToSize(signatureText, pageWidth - 28);
  doc.text(signatureLines, 14, yPos);
  yPos += signatureLines.length * 3 + 6;
  
  // Approval info if approved
  if (po.approved_at) {
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Approvals', 14, yPos);
    yPos += 5;
    
    doc.setFont('helvetica', 'normal');
    doc.text(`${po.vendor_name || 'Vendor'} - Approved - ${formatDate(po.approved_at)}`, 14, yPos);
  }
  
  // Save the PDF
  doc.save(`${po.po_number}.pdf`);
}

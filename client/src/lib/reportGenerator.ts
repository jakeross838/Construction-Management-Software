import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { jobs } from '@/data/mockData';

export type ReportFormat = 'pdf' | 'excel';

interface ReportData {
  title: string;
  subtitle: string;
  headers: string[];
  rows: (string | number)[][];
  summary?: { label: string; value: string }[];
}

// Mock data generators for different report types
const getReportData = (reportId: string, jobId: string | null): ReportData => {
  const job = jobId ? jobs.find(j => j.id === jobId) : null;
  const jobName = job?.name || 'All Jobs';
  const dateStr = new Date().toLocaleDateString();

  switch (reportId) {
    case 'labor-hours':
      return {
        title: 'Labor Hours Summary',
        subtitle: `${jobName} - ${dateStr}`,
        headers: ['Employee', 'Role', 'Regular Hours', 'Overtime', 'Total Hours', 'Labor Cost'],
        rows: [
          ['Mike Johnson', 'Project Manager', 40, 5, 45, '$3,825'],
          ['Carlos Rodriguez', 'Lead Carpenter', 40, 8, 48, '$2,880'],
          ['Tom Smith', 'Electrician', 38, 0, 38, '$2,280'],
          ['Sarah Chen', 'Plumber', 40, 4, 44, '$2,640'],
          ['David Park', 'HVAC Tech', 36, 0, 36, '$2,160'],
        ],
        summary: [
          { label: 'Total Regular Hours', value: '194' },
          { label: 'Total Overtime', value: '17' },
          { label: 'Total Labor Cost', value: '$13,785' },
        ],
      };

    case 'daily-log-summary':
      return {
        title: 'Daily Log Summary',
        subtitle: `${jobName} - Week of ${dateStr}`,
        headers: ['Date', 'Weather', 'Crew Size', 'Work Completed', 'Issues/Notes'],
        rows: [
          ['01/20/2026', 'Sunny, 72°F', '8', 'Framing complete on 2nd floor', 'None'],
          ['01/21/2026', 'Partly Cloudy, 68°F', '10', 'Started roof trusses', 'Delivery delayed 2hrs'],
          ['01/22/2026', 'Rain, 65°F', '4', 'Interior work only', 'Weather delay'],
          ['01/23/2026', 'Sunny, 70°F', '12', 'Roof trusses complete', 'None'],
        ],
        summary: [
          { label: 'Total Work Days', value: '4' },
          { label: 'Average Crew Size', value: '8.5' },
          { label: 'Weather Delays', value: '1' },
        ],
      };

    case 'pnl':
      return {
        title: 'Profit & Loss Statement',
        subtitle: `${jobName} - ${dateStr}`,
        headers: ['Category', 'Budget', 'Actual', 'Variance', '% of Budget'],
        rows: [
          ['Revenue', '$1,850,000', '$1,720,000', '-$130,000', '93%'],
          ['Labor Costs', '$450,000', '$425,000', '$25,000', '94%'],
          ['Material Costs', '$680,000', '$695,000', '-$15,000', '102%'],
          ['Subcontractor Costs', '$380,000', '$365,000', '$15,000', '96%'],
          ['Equipment', '$85,000', '$78,000', '$7,000', '92%'],
          ['Overhead', '$120,000', '$118,000', '$2,000', '98%'],
          ['Gross Profit', '$135,000', '$39,000', '-$96,000', '29%'],
        ],
        summary: [
          { label: 'Gross Margin', value: '2.3%' },
          { label: 'Net Profit', value: '$39,000' },
          { label: 'Budget Variance', value: '-$96,000' },
        ],
      };

    case 'job-cost':
      return {
        title: 'Job Cost Report',
        subtitle: `${jobName} - ${dateStr}`,
        headers: ['Cost Code', 'Description', 'Budget', 'Committed', 'Actual', 'Remaining'],
        rows: [
          ['01000', 'General Conditions', '$85,000', '$82,000', '$78,500', '$6,500'],
          ['02000', 'Site Work', '$125,000', '$120,000', '$118,000', '$7,000'],
          ['03000', 'Concrete', '$180,000', '$175,000', '$172,000', '$8,000'],
          ['04000', 'Masonry', '$95,000', '$92,000', '$89,000', '$6,000'],
          ['05000', 'Metals', '$45,000', '$44,000', '$42,500', '$2,500'],
          ['06000', 'Wood & Plastics', '$220,000', '$215,000', '$208,000', '$12,000'],
          ['07000', 'Thermal & Moisture', '$85,000', '$82,000', '$79,500', '$5,500'],
        ],
        summary: [
          { label: 'Total Budget', value: '$835,000' },
          { label: 'Total Committed', value: '$810,000' },
          { label: 'Total Remaining', value: '$47,500' },
        ],
      };

    case 'budget-variance':
      return {
        title: 'Budget vs Actual Report',
        subtitle: `${jobName} - ${dateStr}`,
        headers: ['Category', 'Original Budget', 'Revised Budget', 'Actual', 'Variance', 'Status'],
        rows: [
          ['Labor', '$450,000', '$465,000', '$425,000', '+$40,000', 'Under'],
          ['Materials', '$680,000', '$680,000', '$695,000', '-$15,000', 'Over'],
          ['Subcontractors', '$380,000', '$395,000', '$365,000', '+$30,000', 'Under'],
          ['Equipment', '$85,000', '$85,000', '$78,000', '+$7,000', 'Under'],
          ['Overhead', '$120,000', '$120,000', '$118,000', '+$2,000', 'Under'],
        ],
        summary: [
          { label: 'Total Variance', value: '+$64,000' },
          { label: 'Variance %', value: '3.7%' },
        ],
      };

    case 'ar-aging':
      return {
        title: 'Accounts Receivable Aging',
        subtitle: `${jobName} - ${dateStr}`,
        headers: ['Invoice #', 'Client', 'Amount', 'Current', '1-30 Days', '31-60 Days', '60+ Days'],
        rows: [
          ['INV-001', 'The Drummond Family', '$125,000', '$125,000', '-', '-', '-'],
          ['INV-002', 'David & Sarah Chen', '$85,000', '-', '$85,000', '-', '-'],
          ['INV-003', 'Anderson Trust', '$45,000', '-', '-', '$45,000', '-'],
          ['INV-004', 'James & Emily Park', '$32,000', '-', '-', '-', '$32,000'],
        ],
        summary: [
          { label: 'Total Outstanding', value: '$287,000' },
          { label: 'Current', value: '$125,000' },
          { label: 'Past Due', value: '$162,000' },
        ],
      };

    case 'ap-aging':
      return {
        title: 'Accounts Payable Aging',
        subtitle: `${jobName} - ${dateStr}`,
        headers: ['Vendor', 'Invoice', 'Amount', 'Current', '1-30 Days', '31-60 Days', '60+ Days'],
        rows: [
          ['ABC Lumber', 'VEN-101', '$28,500', '$28,500', '-', '-', '-'],
          ['Gulf Electric', 'VEN-102', '$15,200', '-', '$15,200', '-', '-'],
          ['Coastal HVAC', 'VEN-103', '$42,000', '$42,000', '-', '-', '-'],
          ['Premium Tile', 'VEN-104', '$8,750', '-', '-', '$8,750', '-'],
        ],
        summary: [
          { label: 'Total Payables', value: '$94,450' },
          { label: 'Due This Week', value: '$70,500' },
        ],
      };

    default:
      return {
        title: reportId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        subtitle: `${jobName} - ${dateStr}`,
        headers: ['Item', 'Description', 'Value', 'Status'],
        rows: [
          ['Item 1', 'Sample description', '$10,000', 'Complete'],
          ['Item 2', 'Sample description', '$15,000', 'In Progress'],
          ['Item 3', 'Sample description', '$8,500', 'Pending'],
        ],
        summary: [
          { label: 'Total', value: '$33,500' },
        ],
      };
  }
};

export const generatePDF = (reportId: string, reportName: string, jobId: string | null): void => {
  const data = getReportData(reportId, jobId);
  const doc = new jsPDF();

  // Header
  doc.setFontSize(20);
  doc.setTextColor(40, 40, 40);
  doc.text(data.title, 14, 22);

  doc.setFontSize(12);
  doc.setTextColor(100, 100, 100);
  doc.text(data.subtitle, 14, 30);

  doc.setFontSize(10);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 38);

  // Table
  autoTable(doc, {
    startY: 45,
    head: [data.headers],
    body: data.rows,
    theme: 'striped',
    headStyles: {
      fillColor: [59, 130, 246],
      textColor: 255,
      fontStyle: 'bold',
    },
    styles: {
      fontSize: 9,
      cellPadding: 4,
    },
    alternateRowStyles: {
      fillColor: [245, 247, 250],
    },
  });

  // Summary section
  if (data.summary) {
    const finalY = (doc as any).lastAutoTable.finalY || 45;
    doc.setFontSize(11);
    doc.setTextColor(40, 40, 40);
    doc.text('Summary', 14, finalY + 15);

    doc.setFontSize(10);
    data.summary.forEach((item, index) => {
      doc.setTextColor(100, 100, 100);
      doc.text(`${item.label}:`, 14, finalY + 25 + (index * 8));
      doc.setTextColor(40, 40, 40);
      doc.text(item.value, 80, finalY + 25 + (index * 8));
    });
  }

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Ross Built CMS - Page ${i} of ${pageCount}`,
      doc.internal.pageSize.getWidth() / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
  }

  // Download
  const fileName = `${reportName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
};

export const generateExcel = (reportId: string, reportName: string, jobId: string | null): void => {
  const data = getReportData(reportId, jobId);

  // Create workbook and worksheet
  const wb = XLSX.utils.book_new();

  // Header info
  const headerRows = [
    [data.title],
    [data.subtitle],
    [`Generated: ${new Date().toLocaleString()}`],
    [], // Empty row
  ];

  // Data rows with headers
  const dataRows = [
    data.headers,
    ...data.rows,
  ];

  // Summary rows
  const summaryRows = data.summary ? [
    [], // Empty row
    ['Summary'],
    ...data.summary.map(item => [item.label, item.value]),
  ] : [];

  // Combine all rows
  const allRows = [...headerRows, ...dataRows, ...summaryRows];

  // Create worksheet
  const ws = XLSX.utils.aoa_to_sheet(allRows);

  // Set column widths
  const colWidths = data.headers.map((_, i) => ({
    wch: Math.max(
      data.headers[i]?.length || 10,
      ...data.rows.map(row => String(row[i] || '').length)
    ) + 2
  }));
  ws['!cols'] = colWidths;

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, 'Report');

  // Download
  const fileName = `${reportName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(wb, fileName);
};

export const generateReport = (
  reportId: string,
  reportName: string,
  format: ReportFormat,
  jobId: string | null
): void => {
  if (format === 'pdf') {
    generatePDF(reportId, reportName, jobId);
  } else {
    generateExcel(reportId, reportName, jobId);
  }
};

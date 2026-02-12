import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { jobs } from '@/data/mockData';
import { apiGet } from '@/lib/api';

export type ReportFormat = 'pdf' | 'excel';

interface ReportData {
  title: string;
  subtitle: string;
  headers: string[];
  rows: (string | number)[][];
  summary?: { label: string; value: string }[];
}

// Helper to format currency values
const fmt = (n: number): string => {
  const abs = Math.abs(n);
  const formatted = abs.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return n < 0 ? `-${formatted}` : formatted;
};

// Helper to format currency with +/- sign for variance display
const fmtVariance = (n: number): string => {
  const abs = Math.abs(n);
  const formatted = abs.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 });
  if (n > 0) return `+${formatted}`;
  if (n < 0) return `-${formatted}`;
  return formatted;
};

// ============================================================
// API FETCHERS - Real data from backend endpoints
// ============================================================

async function fetchJobCostData(jobId: string, jobName: string, dateStr: string): Promise<ReportData> {
  const res = await apiGet(`/api/reports/job-cost/${jobId}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const data = await res.json();

  const rows: (string | number)[][] = data.lines.map((line: any) => [
    line.costCode,
    line.description,
    fmt(line.budget),
    fmt(line.committed),
    fmt(line.actual),
    fmt(line.budget - line.actual),
  ]);

  return {
    title: 'Job Cost Report',
    subtitle: `${data.job?.name || jobName} - ${dateStr}`,
    headers: ['Cost Code', 'Description', 'Budget', 'Committed', 'Actual', 'Remaining'],
    rows,
    summary: [
      { label: 'Total Budget', value: fmt(data.summary.totalBudget) },
      { label: 'Total Committed', value: fmt(data.summary.totalCommitted) },
      { label: 'Total Actual', value: fmt(data.summary.totalActual) },
      { label: 'Total Variance', value: fmtVariance(data.summary.totalVariance) },
      { label: 'Percent Complete', value: `${data.summary.percentComplete}%` },
    ],
  };
}

async function fetchBudgetVarianceData(jobId: string, jobName: string, dateStr: string): Promise<ReportData> {
  const res = await apiGet(`/api/reports/budget-variance?jobId=${jobId}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const data = await res.json();

  const rows: (string | number)[][] = data.lines.map((line: any) => {
    const statusLabel = line.status === 'over' ? 'Over' : line.status === 'warning' ? 'Warning' : 'Under';
    return [
      `${line.costCode} - ${line.name}`,
      fmt(line.budget),
      fmt(line.committed),
      fmt(line.actual),
      fmtVariance(line.variance),
      statusLabel,
    ];
  });

  return {
    title: 'Budget vs Actual Report',
    subtitle: `${data.job?.name || jobName} - ${dateStr}`,
    headers: ['Cost Code', 'Budget', 'Committed', 'Actual', 'Variance', 'Status'],
    rows,
    summary: [
      { label: 'Total Budget', value: fmt(data.summary.totalBudget) },
      { label: 'Total Actual', value: fmt(data.summary.totalActual) },
      { label: 'Total Variance', value: fmtVariance(data.summary.totalVariance) },
      { label: 'Budget Used', value: `${data.summary.overallPercentUsed}%` },
      { label: 'Cost Codes Over Budget', value: String(data.summary.costCodesOverBudget) },
    ],
  };
}

async function fetchPnlData(jobId: string | null, jobName: string, dateStr: string): Promise<ReportData> {
  // P&L uses category-spend for the cost breakdown, combined with budget-variance for budget context
  // Fetch category spend as the basis for cost breakdown
  const url = jobId
    ? `/api/reports/category-spend?jobId=${jobId}`
    : '/api/reports/category-spend';
  const res = await apiGet(url);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const catData = await res.json();

  // If we have a jobId, also fetch budget-variance for budget figures
  let budgetMap: Record<string, number> = {};
  let totalBudget = 0;
  if (jobId) {
    try {
      const bvRes = await apiGet(`/api/reports/budget-variance?jobId=${jobId}`);
      if (bvRes.ok) {
        const bvData = await bvRes.json();
        totalBudget = bvData.summary.totalBudget;
        // Group budget by category from cost code prefix
        for (const line of bvData.lines) {
          const catCode = (line.costCode || '').substring(0, 2);
          const catName = line.category || line.name || catCode;
          if (!budgetMap[catName]) budgetMap[catName] = 0;
          budgetMap[catName] += line.budget;
        }
      }
    } catch {
      // Budget data not available, proceed with actuals only
    }
  }

  const rows: (string | number)[][] = catData.categories.map((cat: any) => {
    const budget = budgetMap[cat.categoryName] || 0;
    const actual = cat.totalSpend;
    const variance = budget - actual;
    const pct = budget > 0 ? `${Math.round((actual / budget) * 100)}%` : '-';
    return [
      cat.categoryName,
      budget > 0 ? fmt(budget) : '-',
      fmt(actual),
      budget > 0 ? fmtVariance(variance) : '-',
      pct,
    ];
  });

  const totalActual = catData.summary.totalSpend;
  const totalVariance = totalBudget - totalActual;

  return {
    title: 'Profit & Loss Statement',
    subtitle: `${jobName} - ${dateStr}`,
    headers: ['Category', 'Budget', 'Actual', 'Variance', '% of Budget'],
    rows,
    summary: [
      { label: 'Total Budget', value: totalBudget > 0 ? fmt(totalBudget) : '-' },
      { label: 'Total Costs', value: fmt(totalActual) },
      { label: 'Budget Variance', value: totalBudget > 0 ? fmtVariance(totalVariance) : '-' },
    ],
  };
}

async function fetchApAgingData(jobId: string | null, jobName: string, dateStr: string): Promise<ReportData> {
  const url = jobId
    ? `/api/reports/invoice-aging?jobId=${jobId}`
    : '/api/reports/invoice-aging';
  const res = await apiGet(url);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const data = await res.json();

  // Flatten all invoices from aging buckets into rows
  const rows: (string | number)[][] = [];
  const buckets = [
    { key: 'current', label: 'Current' },
    { key: 'days1to30', label: '1-30 Days' },
    { key: 'days31to60', label: '31-60 Days' },
    { key: 'days61to90', label: '61-90 Days' },
    { key: 'over90', label: '90+ Days' },
  ];

  for (const bucket of buckets) {
    const agingBucket = data.aging[bucket.key];
    if (!agingBucket?.invoices) continue;
    for (const inv of agingBucket.invoices) {
      // Place amount in the correct aging column
      const currentAmt = bucket.key === 'current' ? fmt(inv.amount) : '-';
      const days1to30Amt = bucket.key === 'days1to30' ? fmt(inv.amount) : '-';
      const days31to60Amt = bucket.key === 'days31to60' ? fmt(inv.amount) : '-';
      const days60PlusAmt = (bucket.key === 'days61to90' || bucket.key === 'over90') ? fmt(inv.amount) : '-';
      rows.push([
        inv.vendor || 'Unknown',
        inv.invoiceNumber || '-',
        fmt(inv.amount),
        currentAmt,
        days1to30Amt,
        days31to60Amt,
        days60PlusAmt,
      ]);
    }
  }

  // If no invoices found, add a placeholder row
  if (rows.length === 0) {
    rows.push(['No outstanding invoices', '-', '-', '-', '-', '-', '-']);
  }

  return {
    title: 'Accounts Payable Aging',
    subtitle: `${jobName} - ${dateStr}`,
    headers: ['Vendor', 'Invoice', 'Amount', 'Current', '1-30 Days', '31-60 Days', '60+ Days'],
    rows,
    summary: [
      { label: 'Total Outstanding', value: fmt(data.summary.totalOutstanding) },
      { label: 'Total Invoices', value: String(data.summary.totalInvoices) },
      { label: 'Past Due Amount', value: fmt(data.summary.pastDueAmount) },
      { label: 'Past Due Count', value: String(data.summary.pastDueCount) },
    ],
  };
}

async function fetchArAgingData(jobId: string | null, jobName: string, dateStr: string): Promise<ReportData> {
  // AR Aging uses the same invoice-aging endpoint (invoices are payables in this system)
  // For AR, we reuse the same data but present it from the client/receivable perspective
  const url = jobId
    ? `/api/reports/invoice-aging?jobId=${jobId}`
    : '/api/reports/invoice-aging';
  const res = await apiGet(url);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const data = await res.json();

  // Flatten all invoices from aging buckets into rows
  const rows: (string | number)[][] = [];
  const buckets = [
    { key: 'current', label: 'Current' },
    { key: 'days1to30', label: '1-30 Days' },
    { key: 'days31to60', label: '31-60 Days' },
    { key: 'days61to90', label: '61-90 Days' },
    { key: 'over90', label: '90+ Days' },
  ];

  for (const bucket of buckets) {
    const agingBucket = data.aging[bucket.key];
    if (!agingBucket?.invoices) continue;
    for (const inv of agingBucket.invoices) {
      const currentAmt = bucket.key === 'current' ? fmt(inv.amount) : '-';
      const days1to30Amt = bucket.key === 'days1to30' ? fmt(inv.amount) : '-';
      const days31to60Amt = bucket.key === 'days31to60' ? fmt(inv.amount) : '-';
      const days60PlusAmt = (bucket.key === 'days61to90' || bucket.key === 'over90') ? fmt(inv.amount) : '-';
      rows.push([
        inv.invoiceNumber || '-',
        inv.job || inv.vendor || 'Unknown',
        fmt(inv.amount),
        currentAmt,
        days1to30Amt,
        days31to60Amt,
        days60PlusAmt,
      ]);
    }
  }

  if (rows.length === 0) {
    rows.push(['No outstanding invoices', '-', '-', '-', '-', '-', '-']);
  }

  const currentAmount = data.aging.current?.amount || 0;
  const pastDue = data.summary.pastDueAmount;

  return {
    title: 'Accounts Receivable Aging',
    subtitle: `${jobName} - ${dateStr}`,
    headers: ['Invoice #', 'Client', 'Amount', 'Current', '1-30 Days', '31-60 Days', '60+ Days'],
    rows,
    summary: [
      { label: 'Total Outstanding', value: fmt(data.summary.totalOutstanding) },
      { label: 'Current', value: fmt(currentAmount) },
      { label: 'Past Due', value: fmt(pastDue) },
    ],
  };
}

// ============================================================
// MOCK DATA - for report types without real API endpoints yet
// ============================================================

// TODO: Connect to real API
const getMockLaborHours = (jobName: string, dateStr: string): ReportData => ({
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
});

// TODO: Connect to real API
const getMockDailyLogSummary = (jobName: string, dateStr: string): ReportData => ({
  title: 'Daily Log Summary',
  subtitle: `${jobName} - Week of ${dateStr}`,
  headers: ['Date', 'Weather', 'Crew Size', 'Work Completed', 'Issues/Notes'],
  rows: [
    ['01/20/2026', 'Sunny, 72\u00B0F', '8', 'Framing complete on 2nd floor', 'None'],
    ['01/21/2026', 'Partly Cloudy, 68\u00B0F', '10', 'Started roof trusses', 'Delivery delayed 2hrs'],
    ['01/22/2026', 'Rain, 65\u00B0F', '4', 'Interior work only', 'Weather delay'],
    ['01/23/2026', 'Sunny, 70\u00B0F', '12', 'Roof trusses complete', 'None'],
  ],
  summary: [
    { label: 'Total Work Days', value: '4' },
    { label: 'Average Crew Size', value: '8.5' },
    { label: 'Weather Delays', value: '1' },
  ],
});

// TODO: Connect to real API
const getMockScheduleVariance = (jobName: string, dateStr: string): ReportData => ({
  title: 'Schedule Variance',
  subtitle: `${jobName} - ${dateStr}`,
  headers: ['Task', 'Planned Start', 'Actual Start', 'Planned End', 'Actual End', 'Variance (Days)'],
  rows: [
    ['Foundation', '01/05/2026', '01/05/2026', '01/20/2026', '01/22/2026', '+2'],
    ['Framing', '01/21/2026', '01/23/2026', '02/15/2026', '02/18/2026', '+3'],
    ['Roofing', '02/16/2026', '02/19/2026', '03/01/2026', 'In Progress', '-'],
  ],
  summary: [
    { label: 'Tasks On Schedule', value: '0' },
    { label: 'Tasks Behind', value: '2' },
    { label: 'Average Delay', value: '2.5 days' },
  ],
});

// TODO: Connect to real API
const getMockCrewProductivity = (jobName: string, dateStr: string): ReportData => ({
  title: 'Crew Productivity',
  subtitle: `${jobName} - ${dateStr}`,
  headers: ['Crew', 'Tasks Completed', 'Hours Worked', 'Efficiency', 'Rating'],
  rows: [
    ['Framing Crew A', '12', '320', '94%', 'Excellent'],
    ['Electrical Team', '8', '160', '88%', 'Good'],
    ['Plumbing Team', '6', '120', '91%', 'Excellent'],
  ],
  summary: [
    { label: 'Average Efficiency', value: '91%' },
    { label: 'Total Tasks Completed', value: '26' },
  ],
});

// TODO: Connect to real API
const getMockMaterialUsage = (jobName: string, dateStr: string): ReportData => ({
  title: 'Material Usage',
  subtitle: `${jobName} - ${dateStr}`,
  headers: ['Material', 'Estimated Qty', 'Actual Qty', 'Variance', 'Unit Cost', 'Total Cost'],
  rows: [
    ['Lumber (2x4)', '5,000 bf', '4,850 bf', '-150 bf', '$0.85', '$4,122'],
    ['Concrete', '120 cy', '125 cy', '+5 cy', '$145', '$18,125'],
    ['Rebar #4', '2,500 lf', '2,480 lf', '-20 lf', '$0.95', '$2,356'],
  ],
  summary: [
    { label: 'Total Material Cost', value: '$24,603' },
    { label: 'Over Estimate Items', value: '1' },
  ],
});

// TODO: Connect to real API
const getMockChangeOrderLog = (jobName: string, dateStr: string): ReportData => ({
  title: 'Change Order Log',
  subtitle: `${jobName} - ${dateStr}`,
  headers: ['CO #', 'Description', 'Amount', 'Status', 'Date Submitted', 'Date Approved'],
  rows: [
    ['CO-001', 'Additional electrical outlets', '$3,500', 'Approved', '01/15/2026', '01/18/2026'],
    ['CO-002', 'Upgraded flooring', '$8,200', 'Pending', '01/28/2026', '-'],
    ['CO-003', 'Window upgrade', '$5,100', 'Approved', '02/01/2026', '02/03/2026'],
  ],
  summary: [
    { label: 'Total COs', value: '3' },
    { label: 'Approved Total', value: '$8,600' },
    { label: 'Pending Total', value: '$8,200' },
  ],
});

// TODO: Connect to real API
const getMockSubcontractorPerformance = (jobName: string, dateStr: string): ReportData => ({
  title: 'Subcontractor Performance',
  subtitle: `${jobName} - ${dateStr}`,
  headers: ['Subcontractor', 'Trade', 'Tasks Assigned', 'Completed On Time', 'Quality Rating', 'Overall Score'],
  rows: [
    ['Smith Electric', 'Electrical', '15', '13', '4.5/5', '87%'],
    ['Jones Plumbing', 'Plumbing', '10', '9', '4.2/5', '84%'],
    ['Metro HVAC', 'HVAC', '8', '8', '4.8/5', '96%'],
  ],
  summary: [
    { label: 'Average Score', value: '89%' },
    { label: 'On-Time Rate', value: '91%' },
  ],
});

// TODO: Connect to real API
const getMockTaskCompletion = (jobName: string, dateStr: string): ReportData => ({
  title: 'Task Completion Rate',
  subtitle: `${jobName} - ${dateStr}`,
  headers: ['Phase', 'Total Tasks', 'Completed', 'On Time', 'Delayed', 'Completion %'],
  rows: [
    ['Pre-Construction', '25', '25', '23', '2', '100%'],
    ['Foundation', '18', '18', '16', '2', '100%'],
    ['Framing', '30', '22', '18', '4', '73%'],
    ['MEP Rough-In', '20', '8', '7', '1', '40%'],
  ],
  summary: [
    { label: 'Overall Completion', value: '78%' },
    { label: 'On-Time Rate', value: '86%' },
  ],
});

const getMockDefault = (reportId: string, jobName: string, dateStr: string): ReportData => ({
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
});

// ============================================================
// MAIN DATA FUNCTION - Fetches from real API with mock fallback
// ============================================================

const getReportData = async (reportId: string, jobId: string | null): Promise<ReportData> => {
  const job = jobId ? jobs.find(j => j.id === jobId) : null;
  const jobName = job?.name || 'All Jobs';
  const dateStr = new Date().toLocaleDateString();

  // Reports with real API endpoints - attempt to fetch, fallback to mock on error
  switch (reportId) {
    case 'job-cost': {
      if (!jobId) {
        // job-cost API requires a jobId
        return getMockDefault(reportId, jobName, dateStr);
      }
      try {
        return await fetchJobCostData(jobId, jobName, dateStr);
      } catch (err) {
        console.warn('Failed to fetch job-cost data from API, using mock data:', err);
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
      }
    }

    case 'pnl': {
      try {
        return await fetchPnlData(jobId, jobName, dateStr);
      } catch (err) {
        console.warn('Failed to fetch P&L data from API, using mock data:', err);
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
      }
    }

    case 'budget-variance': {
      if (!jobId) {
        // budget-variance API requires a jobId
        return getMockDefault(reportId, jobName, dateStr);
      }
      try {
        return await fetchBudgetVarianceData(jobId, jobName, dateStr);
      } catch (err) {
        console.warn('Failed to fetch budget-variance data from API, using mock data:', err);
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
      }
    }

    case 'ar-aging': {
      try {
        return await fetchArAgingData(jobId, jobName, dateStr);
      } catch (err) {
        console.warn('Failed to fetch AR aging data from API, using mock data:', err);
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
      }
    }

    case 'ap-aging': {
      try {
        return await fetchApAgingData(jobId, jobName, dateStr);
      } catch (err) {
        console.warn('Failed to fetch AP aging data from API, using mock data:', err);
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
      }
    }

    // Reports without real API endpoints - use mock data
    // TODO: Connect to real API
    case 'labor-hours':
      return getMockLaborHours(jobName, dateStr);

    // TODO: Connect to real API
    case 'daily-log-summary':
      return getMockDailyLogSummary(jobName, dateStr);

    // TODO: Connect to real API
    case 'schedule-variance':
      return getMockScheduleVariance(jobName, dateStr);

    // TODO: Connect to real API
    case 'crew-productivity':
      return getMockCrewProductivity(jobName, dateStr);

    // TODO: Connect to real API
    case 'material-usage':
      return getMockMaterialUsage(jobName, dateStr);

    // TODO: Connect to real API
    case 'change-order-log':
      return getMockChangeOrderLog(jobName, dateStr);

    // TODO: Connect to real API
    case 'subcontractor-performance':
      return getMockSubcontractorPerformance(jobName, dateStr);

    // TODO: Connect to real API
    case 'task-completion':
      return getMockTaskCompletion(jobName, dateStr);

    default:
      return getMockDefault(reportId, jobName, dateStr);
  }
};

// ============================================================
// PDF & EXCEL GENERATION (unchanged logic, now async-aware)
// ============================================================

export const generatePDF = async (reportId: string, reportName: string, jobId: string | null): Promise<void> => {
  const data = await getReportData(reportId, jobId);
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
      `Construction CMS - Page ${i} of ${pageCount}`,
      doc.internal.pageSize.getWidth() / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
  }

  // Download
  const fileName = `${reportName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
};

export const generateExcel = async (reportId: string, reportName: string, jobId: string | null): Promise<void> => {
  const data = await getReportData(reportId, jobId);

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

export const generateReport = async (
  reportId: string,
  reportName: string,
  format: ReportFormat,
  jobId: string | null
): Promise<void> => {
  if (format === 'pdf') {
    await generatePDF(reportId, reportName, jobId);
  } else {
    await generateExcel(reportId, reportName, jobId);
  }
};

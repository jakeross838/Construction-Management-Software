/**
 * Reports Routes
 * Financial summary endpoints for job cost, vendor spend, and category spend analysis
 */

const express = require('express');
const router = express.Router();
const ExcelJS = require('exceljs');
const pdfMake = require('pdfmake/build/pdfmake');
const pdfFonts = require('pdfmake/build/vfs_fonts');
pdfMake.vfs = pdfFonts.vfs;
const { supabase } = require('../../config');
const { asyncHandler, AppError } = require('../errors');

// ============================================================
// JOB COST REPORT
// GET /api/reports/job-cost/:jobId
// ============================================================

router.get('/job-cost/:jobId', asyncHandler(async (req, res) => {
  const { jobId } = req.params;
  const { startDate, endDate } = req.query;

  // Get job info
  const { data: job, error: jobError } = await supabase
    .from('v2_jobs')
    .select('id, name')
    .eq('id', jobId)
    .single();

  if (jobError || !job) {
    throw new AppError('JOB_NOT_FOUND', 'Job not found', { jobId });
  }

  // Get budget lines for the job
  const { data: budgetLines, error: budgetError } = await supabase
    .from('v2_budget_lines')
    .select(`
      id,
      budgeted_amount,
      cost_code:v2_cost_codes(id, code, name, category)
    `)
    .eq('job_id', jobId);

  if (budgetError) {
    throw new AppError('DATABASE_ERROR', budgetError.message);
  }

  // Get committed amounts from PO line items
  let poQuery = supabase
    .from('v2_po_line_items')
    .select(`
      id,
      amount,
      cost_code_id,
      purchase_order:v2_purchase_orders!inner(id, job_id, status)
    `)
    .eq('purchase_order.job_id', jobId)
    .neq('purchase_order.status', 'cancelled');

  const { data: poLineItems, error: poError } = await poQuery;

  if (poError) {
    throw new AppError('DATABASE_ERROR', poError.message);
  }

  // Get actual costs from invoice allocations (approved, in_draw, paid invoices only)
  let allocQuery = supabase
    .from('v2_invoice_allocations')
    .select(`
      id,
      amount,
      cost_code_id,
      invoice:v2_invoices!inner(id, status, invoice_date)
    `)
    .eq('job_id', jobId)
    .in('invoice.status', ['approved', 'in_draw', 'paid']);

  // Apply date filters if provided
  if (startDate) {
    allocQuery = allocQuery.gte('invoice.invoice_date', startDate);
  }
  if (endDate) {
    allocQuery = allocQuery.lte('invoice.invoice_date', endDate);
  }

  const { data: allocations, error: allocError } = await allocQuery;

  if (allocError) {
    throw new AppError('DATABASE_ERROR', allocError.message);
  }

  // Build cost code map with budget, committed, and actual amounts
  const costCodeMap = new Map();

  // Initialize with budget lines
  for (const bl of budgetLines || []) {
    if (bl.cost_code) {
      costCodeMap.set(bl.cost_code.id, {
        costCodeId: bl.cost_code.id,
        costCode: bl.cost_code.code,
        description: bl.cost_code.name,
        category: bl.cost_code.category,
        budget: parseFloat(bl.budgeted_amount) || 0,
        committed: 0,
        actual: 0
      });
    }
  }

  // Add committed amounts from PO line items
  for (const item of poLineItems || []) {
    const existing = costCodeMap.get(item.cost_code_id);
    if (existing) {
      existing.committed += parseFloat(item.amount) || 0;
    } else {
      // Cost code not in budget, but has PO committed
      costCodeMap.set(item.cost_code_id, {
        costCodeId: item.cost_code_id,
        costCode: 'Unknown',
        description: 'Unknown',
        category: null,
        budget: 0,
        committed: parseFloat(item.amount) || 0,
        actual: 0
      });
    }
  }

  // Add actual amounts from invoice allocations
  for (const alloc of allocations || []) {
    const existing = costCodeMap.get(alloc.cost_code_id);
    if (existing) {
      existing.actual += parseFloat(alloc.amount) || 0;
    } else {
      // Cost code not in budget or POs, but has invoices
      costCodeMap.set(alloc.cost_code_id, {
        costCodeId: alloc.cost_code_id,
        costCode: 'Unknown',
        description: 'Unknown',
        category: null,
        budget: 0,
        committed: 0,
        actual: parseFloat(alloc.amount) || 0
      });
    }
  }

  // Calculate variance and status for each line
  const lines = [];
  let totalBudget = 0;
  let totalCommitted = 0;
  let totalActual = 0;

  for (const [, item] of costCodeMap) {
    const variance = item.budget - item.actual;
    const variancePercent = item.budget > 0
      ? Math.round((variance / item.budget) * 100)
      : 0;

    let status;
    if (item.actual > item.budget) {
      status = 'over';
    } else if (item.budget > 0 && item.actual > item.budget * 0.9) {
      status = 'near';
    } else {
      status = 'under';
    }

    lines.push({
      costCode: item.costCode,
      description: item.description,
      category: item.category,
      budget: item.budget,
      committed: item.committed,
      actual: item.actual,
      variance,
      variancePercent,
      status
    });

    totalBudget += item.budget;
    totalCommitted += item.committed;
    totalActual += item.actual;
  }

  // Sort by cost code
  lines.sort((a, b) => a.costCode.localeCompare(b.costCode));

  const totalVariance = totalBudget - totalActual;
  const percentComplete = totalBudget > 0
    ? Math.round((totalActual / totalBudget) * 100)
    : 0;

  res.json({
    job: { id: job.id, name: job.name },
    period: { start: startDate || null, end: endDate || null },
    summary: {
      totalBudget,
      totalCommitted,
      totalActual,
      totalVariance,
      percentComplete
    },
    lines
  });
}));

// ============================================================
// JOB COST REPORT - EXCEL EXPORT
// GET /api/reports/job-cost/:jobId/excel
// ============================================================

router.get('/job-cost/:jobId/excel', asyncHandler(async (req, res) => {
  const { jobId } = req.params;
  const { startDate, endDate } = req.query;

  // Get job info
  const { data: job, error: jobError } = await supabase
    .from('v2_jobs')
    .select('id, name')
    .eq('id', jobId)
    .single();

  if (jobError || !job) {
    throw new AppError('JOB_NOT_FOUND', 'Job not found', { jobId });
  }

  // Get budget lines for the job
  const { data: budgetLines, error: budgetError } = await supabase
    .from('v2_budget_lines')
    .select(`
      id,
      budgeted_amount,
      cost_code:v2_cost_codes(id, code, name, category)
    `)
    .eq('job_id', jobId);

  if (budgetError) {
    throw new AppError('DATABASE_ERROR', budgetError.message);
  }

  // Get committed amounts from PO line items
  let poQuery = supabase
    .from('v2_po_line_items')
    .select(`
      id,
      amount,
      cost_code_id,
      purchase_order:v2_purchase_orders!inner(id, job_id, status)
    `)
    .eq('purchase_order.job_id', jobId)
    .neq('purchase_order.status', 'cancelled');

  const { data: poLineItems, error: poError } = await poQuery;

  if (poError) {
    throw new AppError('DATABASE_ERROR', poError.message);
  }

  // Get actual costs from invoice allocations (approved, in_draw, paid invoices only)
  let allocQuery = supabase
    .from('v2_invoice_allocations')
    .select(`
      id,
      amount,
      cost_code_id,
      invoice:v2_invoices!inner(id, status, invoice_date)
    `)
    .eq('job_id', jobId)
    .in('invoice.status', ['approved', 'in_draw', 'paid']);

  // Apply date filters if provided
  if (startDate) {
    allocQuery = allocQuery.gte('invoice.invoice_date', startDate);
  }
  if (endDate) {
    allocQuery = allocQuery.lte('invoice.invoice_date', endDate);
  }

  const { data: allocations, error: allocError } = await allocQuery;

  if (allocError) {
    throw new AppError('DATABASE_ERROR', allocError.message);
  }

  // Build cost code map with budget, committed, and actual amounts
  const costCodeMap = new Map();

  // Initialize with budget lines
  for (const bl of budgetLines || []) {
    if (bl.cost_code) {
      costCodeMap.set(bl.cost_code.id, {
        costCodeId: bl.cost_code.id,
        costCode: bl.cost_code.code,
        description: bl.cost_code.name,
        category: bl.cost_code.category,
        budget: parseFloat(bl.budgeted_amount) || 0,
        committed: 0,
        actual: 0
      });
    }
  }

  // Add committed amounts from PO line items
  for (const item of poLineItems || []) {
    const existing = costCodeMap.get(item.cost_code_id);
    if (existing) {
      existing.committed += parseFloat(item.amount) || 0;
    } else {
      costCodeMap.set(item.cost_code_id, {
        costCodeId: item.cost_code_id,
        costCode: 'Unknown',
        description: 'Unknown',
        category: null,
        budget: 0,
        committed: parseFloat(item.amount) || 0,
        actual: 0
      });
    }
  }

  // Add actual amounts from invoice allocations
  for (const alloc of allocations || []) {
    const existing = costCodeMap.get(alloc.cost_code_id);
    if (existing) {
      existing.actual += parseFloat(alloc.amount) || 0;
    } else {
      costCodeMap.set(alloc.cost_code_id, {
        costCodeId: alloc.cost_code_id,
        costCode: 'Unknown',
        description: 'Unknown',
        category: null,
        budget: 0,
        committed: 0,
        actual: parseFloat(alloc.amount) || 0
      });
    }
  }

  // Calculate variance and status for each line
  const lines = [];
  let totalBudget = 0;
  let totalCommitted = 0;
  let totalActual = 0;

  for (const [, item] of costCodeMap) {
    const variance = item.budget - item.actual;
    const variancePercent = item.budget > 0
      ? Math.round((variance / item.budget) * 100)
      : 0;

    let status;
    if (item.actual > item.budget) {
      status = 'over';
    } else if (item.budget > 0 && item.actual > item.budget * 0.9) {
      status = 'near';
    } else {
      status = 'under';
    }

    lines.push({
      costCode: item.costCode,
      description: item.description,
      category: item.category,
      budget: item.budget,
      committed: item.committed,
      actual: item.actual,
      variance,
      variancePercent,
      status
    });

    totalBudget += item.budget;
    totalCommitted += item.committed;
    totalActual += item.actual;
  }

  // Sort by cost code
  lines.sort((a, b) => a.costCode.localeCompare(b.costCode));

  const totalVariance = totalBudget - totalActual;
  const percentComplete = totalBudget > 0
    ? Math.round((totalActual / totalBudget) * 100)
    : 0;

  // Create Excel workbook
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Ross Built CMS';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Job Cost Report');

  // Title row
  sheet.mergeCells('A1:I1');
  const titleCell = sheet.getCell('A1');
  titleCell.value = `Job Cost Report - ${job.name}`;
  titleCell.font = { bold: true, size: 16 };
  titleCell.alignment = { horizontal: 'center' };

  // Period row
  sheet.mergeCells('A2:I2');
  const periodCell = sheet.getCell('A2');
  const periodText = (startDate && endDate)
    ? `Period: ${startDate} to ${endDate}`
    : (startDate ? `Period: From ${startDate}` : (endDate ? `Period: Through ${endDate}` : 'Period: All Time'));
  periodCell.value = periodText;
  periodCell.alignment = { horizontal: 'center' };

  // Blank row
  sheet.addRow([]);

  // Summary section
  const summaryStartRow = 4;
  sheet.getCell(`A${summaryStartRow}`).value = 'Summary';
  sheet.getCell(`A${summaryStartRow}`).font = { bold: true, size: 12 };

  sheet.getCell(`A${summaryStartRow + 1}`).value = 'Total Budget:';
  sheet.getCell(`B${summaryStartRow + 1}`).value = totalBudget;
  sheet.getCell(`B${summaryStartRow + 1}`).numFmt = '$#,##0.00';

  sheet.getCell(`A${summaryStartRow + 2}`).value = 'Total Committed:';
  sheet.getCell(`B${summaryStartRow + 2}`).value = totalCommitted;
  sheet.getCell(`B${summaryStartRow + 2}`).numFmt = '$#,##0.00';

  sheet.getCell(`A${summaryStartRow + 3}`).value = 'Total Actual:';
  sheet.getCell(`B${summaryStartRow + 3}`).value = totalActual;
  sheet.getCell(`B${summaryStartRow + 3}`).numFmt = '$#,##0.00';

  sheet.getCell(`A${summaryStartRow + 4}`).value = 'Variance:';
  sheet.getCell(`B${summaryStartRow + 4}`).value = totalVariance;
  sheet.getCell(`B${summaryStartRow + 4}`).numFmt = '$#,##0.00';
  if (totalVariance < 0) {
    sheet.getCell(`B${summaryStartRow + 4}`).font = { color: { argb: 'FFFF0000' } };
  }

  sheet.getCell(`A${summaryStartRow + 5}`).value = '% Complete:';
  sheet.getCell(`B${summaryStartRow + 5}`).value = percentComplete / 100;
  sheet.getCell(`B${summaryStartRow + 5}`).numFmt = '0%';

  // Blank row before data
  const dataStartRow = summaryStartRow + 7;

  // Header row
  const headerRow = sheet.getRow(dataStartRow);
  headerRow.values = ['Cost Code', 'Description', 'Category', 'Budget', 'Committed', 'Actual', 'Variance', 'Var %', 'Status'];
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4472C4' }
  };
  headerRow.alignment = { horizontal: 'center' };

  // Set column widths
  sheet.columns = [
    { key: 'costCode', width: 12 },
    { key: 'description', width: 30 },
    { key: 'category', width: 20 },
    { key: 'budget', width: 15 },
    { key: 'committed', width: 15 },
    { key: 'actual', width: 15 },
    { key: 'variance', width: 15 },
    { key: 'variancePercent', width: 10 },
    { key: 'status', width: 10 }
  ];

  // Add data rows
  lines.forEach((line, idx) => {
    const rowNum = dataStartRow + 1 + idx;
    const row = sheet.getRow(rowNum);
    row.values = [
      line.costCode,
      line.description,
      line.category || '',
      line.budget,
      line.committed,
      line.actual,
      line.variance,
      line.variancePercent / 100,
      line.status.toUpperCase()
    ];

    // Currency format for columns D, E, F, G
    row.getCell(4).numFmt = '$#,##0.00';
    row.getCell(5).numFmt = '$#,##0.00';
    row.getCell(6).numFmt = '$#,##0.00';
    row.getCell(7).numFmt = '$#,##0.00';
    row.getCell(8).numFmt = '0%';

    // Conditional formatting for status
    const statusCell = row.getCell(9);
    if (line.status === 'over') {
      statusCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFCCCC' }
      };
      statusCell.font = { color: { argb: 'FF990000' } };
    } else if (line.status === 'near') {
      statusCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFFFCC' }
      };
      statusCell.font = { color: { argb: 'FF996600' } };
    } else {
      statusCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFCCFFCC' }
      };
      statusCell.font = { color: { argb: 'FF006600' } };
    }
  });

  // Freeze header row
  sheet.views = [{ state: 'frozen', xSplit: 0, ySplit: dataStartRow }];

  // Generate filename
  const dateStr = new Date().toISOString().slice(0, 10);
  const safeJobName = job.name.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-');
  const filename = `Job-Cost-${safeJobName}-${dateStr}.xlsx`;

  // Send response
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  await workbook.xlsx.write(res);
  res.end();
}));

// ============================================================
// JOB COST REPORT - PDF EXPORT
// GET /api/reports/job-cost/:jobId/pdf
// ============================================================

router.get('/job-cost/:jobId/pdf', asyncHandler(async (req, res) => {
  const { jobId } = req.params;
  const { startDate, endDate } = req.query;

  // Get job info
  const { data: job, error: jobError } = await supabase
    .from('v2_jobs')
    .select('id, name')
    .eq('id', jobId)
    .single();

  if (jobError || !job) {
    throw new AppError('JOB_NOT_FOUND', 'Job not found', { jobId });
  }

  // Get budget lines for the job
  const { data: budgetLines, error: budgetError } = await supabase
    .from('v2_budget_lines')
    .select(`
      id,
      budgeted_amount,
      cost_code:v2_cost_codes(id, code, name, category)
    `)
    .eq('job_id', jobId);

  if (budgetError) {
    throw new AppError('DATABASE_ERROR', budgetError.message);
  }

  // Get committed amounts from PO line items
  let poQuery = supabase
    .from('v2_po_line_items')
    .select(`
      id,
      amount,
      cost_code_id,
      purchase_order:v2_purchase_orders!inner(id, job_id, status)
    `)
    .eq('purchase_order.job_id', jobId)
    .neq('purchase_order.status', 'cancelled');

  const { data: poLineItems, error: poError } = await poQuery;

  if (poError) {
    throw new AppError('DATABASE_ERROR', poError.message);
  }

  // Get actual costs from invoice allocations (approved, in_draw, paid invoices only)
  let allocQuery = supabase
    .from('v2_invoice_allocations')
    .select(`
      id,
      amount,
      cost_code_id,
      invoice:v2_invoices!inner(id, status, invoice_date)
    `)
    .eq('job_id', jobId)
    .in('invoice.status', ['approved', 'in_draw', 'paid']);

  // Apply date filters if provided
  if (startDate) {
    allocQuery = allocQuery.gte('invoice.invoice_date', startDate);
  }
  if (endDate) {
    allocQuery = allocQuery.lte('invoice.invoice_date', endDate);
  }

  const { data: allocations, error: allocError } = await allocQuery;

  if (allocError) {
    throw new AppError('DATABASE_ERROR', allocError.message);
  }

  // Build cost code map with budget, committed, and actual amounts
  const costCodeMap = new Map();

  // Initialize with budget lines
  for (const bl of budgetLines || []) {
    if (bl.cost_code) {
      costCodeMap.set(bl.cost_code.id, {
        costCodeId: bl.cost_code.id,
        costCode: bl.cost_code.code,
        description: bl.cost_code.name,
        category: bl.cost_code.category,
        budget: parseFloat(bl.budgeted_amount) || 0,
        committed: 0,
        actual: 0
      });
    }
  }

  // Add committed amounts from PO line items
  for (const item of poLineItems || []) {
    const existing = costCodeMap.get(item.cost_code_id);
    if (existing) {
      existing.committed += parseFloat(item.amount) || 0;
    } else {
      costCodeMap.set(item.cost_code_id, {
        costCodeId: item.cost_code_id,
        costCode: 'Unknown',
        description: 'Unknown',
        category: null,
        budget: 0,
        committed: parseFloat(item.amount) || 0,
        actual: 0
      });
    }
  }

  // Add actual amounts from invoice allocations
  for (const alloc of allocations || []) {
    const existing = costCodeMap.get(alloc.cost_code_id);
    if (existing) {
      existing.actual += parseFloat(alloc.amount) || 0;
    } else {
      costCodeMap.set(alloc.cost_code_id, {
        costCodeId: alloc.cost_code_id,
        costCode: 'Unknown',
        description: 'Unknown',
        category: null,
        budget: 0,
        committed: 0,
        actual: parseFloat(alloc.amount) || 0
      });
    }
  }

  // Calculate variance and status for each line
  const lines = [];
  let totalBudget = 0;
  let totalCommitted = 0;
  let totalActual = 0;

  for (const [, item] of costCodeMap) {
    const variance = item.budget - item.actual;
    const variancePercent = item.budget > 0
      ? Math.round((variance / item.budget) * 100)
      : 0;

    let status;
    if (item.actual > item.budget) {
      status = 'over';
    } else if (item.budget > 0 && item.actual > item.budget * 0.9) {
      status = 'near';
    } else {
      status = 'under';
    }

    lines.push({
      costCode: item.costCode,
      description: item.description,
      category: item.category,
      budget: item.budget,
      committed: item.committed,
      actual: item.actual,
      variance,
      variancePercent,
      status
    });

    totalBudget += item.budget;
    totalCommitted += item.committed;
    totalActual += item.actual;
  }

  // Sort by cost code
  lines.sort((a, b) => a.costCode.localeCompare(b.costCode));

  const totalVariance = totalBudget - totalActual;
  const percentComplete = totalBudget > 0
    ? Math.round((totalActual / totalBudget) * 100)
    : 0;

  // Format period text
  const periodText = (startDate && endDate)
    ? `Period: ${startDate} to ${endDate}`
    : (startDate ? `Period: From ${startDate}` : (endDate ? `Period: Through ${endDate}` : 'Period: All Time'));

  // Helper function to format currency
  const formatCurrency = (amount) => {
    return '$' + amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Build table body
  const tableBody = [
    // Header row
    [
      { text: 'Cost Code', style: 'tableHeader' },
      { text: 'Description', style: 'tableHeader' },
      { text: 'Budget', style: 'tableHeader', alignment: 'right' },
      { text: 'Committed', style: 'tableHeader', alignment: 'right' },
      { text: 'Actual', style: 'tableHeader', alignment: 'right' },
      { text: 'Variance', style: 'tableHeader', alignment: 'right' },
      { text: 'Var %', style: 'tableHeader', alignment: 'center' },
      { text: 'Status', style: 'tableHeader', alignment: 'center' }
    ],
    // Data rows
    ...lines.map(line => {
      let statusColor;
      if (line.status === 'over') {
        statusColor = '#CC0000';
      } else if (line.status === 'near') {
        statusColor = '#CC6600';
      } else {
        statusColor = '#006600';
      }

      return [
        { text: line.costCode },
        { text: line.description },
        { text: formatCurrency(line.budget), alignment: 'right' },
        { text: formatCurrency(line.committed), alignment: 'right' },
        { text: formatCurrency(line.actual), alignment: 'right' },
        { text: formatCurrency(line.variance), alignment: 'right' },
        { text: `${line.variancePercent}%`, alignment: 'center' },
        { text: line.status.toUpperCase(), alignment: 'center', color: statusColor, bold: true }
      ];
    })
  ];

  // Create PDF document definition
  const docDefinition = {
    pageSize: 'LETTER',
    pageMargins: [40, 60, 40, 60],
    header: (currentPage, pageCount) => ({
      text: `Job Cost Report - Page ${currentPage} of ${pageCount}`,
      alignment: 'right',
      fontSize: 10,
      margin: [40, 20, 40, 0]
    }),
    footer: () => ({
      text: `Generated by Ross Built CMS - ${new Date().toLocaleDateString()}`,
      alignment: 'center',
      fontSize: 10,
      margin: [40, 0, 40, 20]
    }),
    content: [
      { text: `${job.name} - Job Cost Report`, style: 'title' },
      { text: periodText, style: 'subtitle' },

      // Summary section
      {
        margin: [0, 0, 0, 20],
        table: {
          widths: ['auto', 'auto'],
          body: [
            [{ text: 'Total Budget:', bold: true }, { text: formatCurrency(totalBudget), alignment: 'right' }],
            [{ text: 'Total Committed:', bold: true }, { text: formatCurrency(totalCommitted), alignment: 'right' }],
            [{ text: 'Total Actual:', bold: true }, { text: formatCurrency(totalActual), alignment: 'right' }],
            [{ text: 'Variance:', bold: true }, { text: formatCurrency(totalVariance), alignment: 'right', color: totalVariance < 0 ? '#CC0000' : '#006600' }],
            [{ text: '% Complete:', bold: true }, { text: `${percentComplete}%`, alignment: 'right' }]
          ]
        },
        layout: 'noBorders'
      },

      // Data table
      {
        table: {
          headerRows: 1,
          widths: ['10%', '25%', '12%', '12%', '12%', '12%', '9%', '8%'],
          body: tableBody
        },
        layout: {
          fillColor: (rowIndex) => {
            if (rowIndex === 0) return '#D9E1F2';
            return null;
          },
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
          hLineColor: () => '#CCCCCC',
          vLineColor: () => '#CCCCCC'
        }
      }
    ],
    styles: {
      title: { fontSize: 24, bold: true, color: '#1F4E78', margin: [0, 0, 0, 5] },
      subtitle: { fontSize: 12, color: '#666666', margin: [0, 0, 0, 20] },
      tableHeader: { bold: true, color: '#1F4E78', fontSize: 10 }
    },
    defaultStyle: {
      fontSize: 9
    }
  };

  // Generate PDF and send response
  const dateStr = new Date().toISOString().slice(0, 10);
  const safeJobName = job.name.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-');
  const filename = `Job-Cost-${safeJobName}-${dateStr}.pdf`;

  const pdfDoc = pdfMake.createPdf(docDefinition);
  pdfDoc.getBuffer((buffer) => {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(Buffer.from(buffer));
  });
}));

// ============================================================
// VENDOR SPEND REPORT
// GET /api/reports/vendor-spend
// ============================================================

router.get('/vendor-spend', asyncHandler(async (req, res) => {
  const { jobId, startDate, endDate } = req.query;

  // Build query for invoices with vendor info
  let query = supabase
    .from('v2_invoices')
    .select(`
      id,
      amount,
      invoice_date,
      vendor_id,
      vendor:v2_vendors(id, name)
    `)
    .is('deleted_at', null)
    .in('status', ['approved', 'in_draw', 'paid']);

  // Apply filters
  if (jobId) {
    query = query.eq('job_id', jobId);
  }
  if (startDate) {
    query = query.gte('invoice_date', startDate);
  }
  if (endDate) {
    query = query.lte('invoice_date', endDate);
  }

  const { data: invoices, error } = await query;

  if (error) {
    throw new AppError('DATABASE_ERROR', error.message);
  }

  // Get job name if filtered
  let jobName = null;
  if (jobId) {
    const { data: job } = await supabase
      .from('v2_jobs')
      .select('name')
      .eq('id', jobId)
      .single();
    jobName = job?.name || null;
  }

  // Group by vendor
  const vendorMap = new Map();

  for (const inv of invoices || []) {
    if (!inv.vendor_id) continue;

    const existing = vendorMap.get(inv.vendor_id);
    const amount = parseFloat(inv.amount) || 0;
    const invoiceDate = inv.invoice_date;

    if (existing) {
      existing.invoiceCount += 1;
      existing.totalSpend += amount;
      if (invoiceDate && (!existing.lastInvoiceDate || invoiceDate > existing.lastInvoiceDate)) {
        existing.lastInvoiceDate = invoiceDate;
      }
    } else {
      vendorMap.set(inv.vendor_id, {
        vendorId: inv.vendor_id,
        vendorName: inv.vendor?.name || 'Unknown',
        invoiceCount: 1,
        totalSpend: amount,
        lastInvoiceDate: invoiceDate || null
      });
    }
  }

  // Calculate stats and build result
  const vendors = [];
  let totalSpend = 0;
  let invoiceCount = 0;

  for (const [, v] of vendorMap) {
    v.avgInvoiceAmount = v.invoiceCount > 0
      ? Math.round(v.totalSpend / v.invoiceCount * 100) / 100
      : 0;
    vendors.push(v);
    totalSpend += v.totalSpend;
    invoiceCount += v.invoiceCount;
  }

  // Sort by total spend descending
  vendors.sort((a, b) => b.totalSpend - a.totalSpend);

  const avgInvoiceAmount = invoiceCount > 0
    ? Math.round(totalSpend / invoiceCount * 100) / 100
    : 0;

  res.json({
    period: { start: startDate || null, end: endDate || null },
    filters: { jobId: jobId || null, jobName },
    summary: {
      totalSpend,
      vendorCount: vendors.length,
      invoiceCount,
      avgInvoiceAmount
    },
    vendors
  });
}));

// ============================================================
// VENDOR SPEND REPORT - EXCEL EXPORT
// GET /api/reports/vendor-spend/excel
// ============================================================

router.get('/vendor-spend/excel', asyncHandler(async (req, res) => {
  const { jobId, startDate, endDate } = req.query;

  // Build query for invoices with vendor info
  let query = supabase
    .from('v2_invoices')
    .select(`
      id,
      amount,
      invoice_date,
      vendor_id,
      vendor:v2_vendors(id, name)
    `)
    .is('deleted_at', null)
    .in('status', ['approved', 'in_draw', 'paid']);

  // Apply filters
  if (jobId) {
    query = query.eq('job_id', jobId);
  }
  if (startDate) {
    query = query.gte('invoice_date', startDate);
  }
  if (endDate) {
    query = query.lte('invoice_date', endDate);
  }

  const { data: invoices, error } = await query;

  if (error) {
    throw new AppError('DATABASE_ERROR', error.message);
  }

  // Get job name if filtered
  let jobName = null;
  if (jobId) {
    const { data: job } = await supabase
      .from('v2_jobs')
      .select('name')
      .eq('id', jobId)
      .single();
    jobName = job?.name || null;
  }

  // Group by vendor
  const vendorMap = new Map();

  for (const inv of invoices || []) {
    if (!inv.vendor_id) continue;

    const existing = vendorMap.get(inv.vendor_id);
    const amount = parseFloat(inv.amount) || 0;
    const invoiceDate = inv.invoice_date;

    if (existing) {
      existing.invoiceCount += 1;
      existing.totalSpend += amount;
      if (invoiceDate && (!existing.lastInvoiceDate || invoiceDate > existing.lastInvoiceDate)) {
        existing.lastInvoiceDate = invoiceDate;
      }
    } else {
      vendorMap.set(inv.vendor_id, {
        vendorId: inv.vendor_id,
        vendorName: inv.vendor?.name || 'Unknown',
        invoiceCount: 1,
        totalSpend: amount,
        lastInvoiceDate: invoiceDate || null
      });
    }
  }

  // Calculate stats and build result
  const vendors = [];
  let totalSpend = 0;
  let invoiceCount = 0;

  for (const [, v] of vendorMap) {
    v.avgInvoiceAmount = v.invoiceCount > 0
      ? Math.round(v.totalSpend / v.invoiceCount * 100) / 100
      : 0;
    vendors.push(v);
    totalSpend += v.totalSpend;
    invoiceCount += v.invoiceCount;
  }

  // Sort by total spend descending
  vendors.sort((a, b) => b.totalSpend - a.totalSpend);

  const avgInvoiceAmount = invoiceCount > 0
    ? Math.round(totalSpend / invoiceCount * 100) / 100
    : 0;

  // Create Excel workbook
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Ross Built CMS';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Vendor Spend Report');

  // Title row
  sheet.mergeCells('A1:E1');
  const titleCell = sheet.getCell('A1');
  titleCell.value = 'Vendor Spend Report';
  titleCell.font = { bold: true, size: 16 };
  titleCell.alignment = { horizontal: 'center' };

  // Filter row
  sheet.mergeCells('A2:E2');
  const filterCell = sheet.getCell('A2');
  const jobLabel = jobName ? jobName : 'All Jobs';
  const periodLabel = (startDate && endDate)
    ? `${startDate} to ${endDate}`
    : (startDate ? `From ${startDate}` : (endDate ? `Through ${endDate}` : 'All Time'));
  filterCell.value = `Job: ${jobLabel} | Period: ${periodLabel}`;
  filterCell.alignment = { horizontal: 'center' };

  // Blank row
  sheet.addRow([]);

  // Summary section
  const summaryStartRow = 4;
  sheet.getCell(`A${summaryStartRow}`).value = 'Summary';
  sheet.getCell(`A${summaryStartRow}`).font = { bold: true, size: 12 };

  sheet.getCell(`A${summaryStartRow + 1}`).value = 'Total Spend:';
  sheet.getCell(`B${summaryStartRow + 1}`).value = totalSpend;
  sheet.getCell(`B${summaryStartRow + 1}`).numFmt = '$#,##0.00';

  sheet.getCell(`A${summaryStartRow + 2}`).value = 'Vendor Count:';
  sheet.getCell(`B${summaryStartRow + 2}`).value = vendors.length;

  sheet.getCell(`A${summaryStartRow + 3}`).value = 'Invoice Count:';
  sheet.getCell(`B${summaryStartRow + 3}`).value = invoiceCount;

  sheet.getCell(`A${summaryStartRow + 4}`).value = 'Avg Invoice Amount:';
  sheet.getCell(`B${summaryStartRow + 4}`).value = avgInvoiceAmount;
  sheet.getCell(`B${summaryStartRow + 4}`).numFmt = '$#,##0.00';

  // Blank row before data
  const dataStartRow = summaryStartRow + 6;

  // Header row
  const headerRow = sheet.getRow(dataStartRow);
  headerRow.values = ['Vendor', 'Invoice Count', 'Total Spend', 'Avg Invoice', 'Last Invoice Date'];
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4472C4' }
  };
  headerRow.alignment = { horizontal: 'center' };

  // Set column widths
  sheet.columns = [
    { key: 'vendor', width: 35 },
    { key: 'invoiceCount', width: 15 },
    { key: 'totalSpend', width: 18 },
    { key: 'avgInvoice', width: 18 },
    { key: 'lastInvoiceDate', width: 18 }
  ];

  // Add data rows
  vendors.forEach((vendor, idx) => {
    const rowNum = dataStartRow + 1 + idx;
    const row = sheet.getRow(rowNum);
    row.values = [
      vendor.vendorName,
      vendor.invoiceCount,
      vendor.totalSpend,
      vendor.avgInvoiceAmount,
      vendor.lastInvoiceDate || ''
    ];

    // Currency format for columns C, D
    row.getCell(3).numFmt = '$#,##0.00';
    row.getCell(4).numFmt = '$#,##0.00';
    // Date format for column E
    if (vendor.lastInvoiceDate) {
      row.getCell(5).numFmt = 'yyyy-mm-dd';
    }
  });

  // Freeze header row
  sheet.views = [{ state: 'frozen', xSplit: 0, ySplit: dataStartRow }];

  // Generate filename
  const dateStr = new Date().toISOString().slice(0, 10);
  const safeJobName = jobName ? jobName.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-') : 'All';
  const filename = `Vendor-Spend-${safeJobName}-${dateStr}.xlsx`;

  // Send response
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  await workbook.xlsx.write(res);
  res.end();
}));

// ============================================================
// VENDOR SPEND REPORT - PDF EXPORT
// GET /api/reports/vendor-spend/pdf
// ============================================================

router.get('/vendor-spend/pdf', asyncHandler(async (req, res) => {
  const { jobId, startDate, endDate } = req.query;

  // Build query for invoices with vendor info
  let query = supabase
    .from('v2_invoices')
    .select(`
      id,
      amount,
      invoice_date,
      vendor_id,
      vendor:v2_vendors(id, name)
    `)
    .is('deleted_at', null)
    .in('status', ['approved', 'in_draw', 'paid']);

  // Apply filters
  if (jobId) {
    query = query.eq('job_id', jobId);
  }
  if (startDate) {
    query = query.gte('invoice_date', startDate);
  }
  if (endDate) {
    query = query.lte('invoice_date', endDate);
  }

  const { data: invoices, error } = await query;

  if (error) {
    throw new AppError('DATABASE_ERROR', error.message);
  }

  // Get job name if filtered
  let jobName = null;
  if (jobId) {
    const { data: job } = await supabase
      .from('v2_jobs')
      .select('name')
      .eq('id', jobId)
      .single();
    jobName = job?.name || null;
  }

  // Group by vendor
  const vendorMap = new Map();

  for (const inv of invoices || []) {
    if (!inv.vendor_id) continue;

    const existing = vendorMap.get(inv.vendor_id);
    const amount = parseFloat(inv.amount) || 0;
    const invoiceDate = inv.invoice_date;

    if (existing) {
      existing.invoiceCount += 1;
      existing.totalSpend += amount;
      if (invoiceDate && (!existing.lastInvoiceDate || invoiceDate > existing.lastInvoiceDate)) {
        existing.lastInvoiceDate = invoiceDate;
      }
    } else {
      vendorMap.set(inv.vendor_id, {
        vendorId: inv.vendor_id,
        vendorName: inv.vendor?.name || 'Unknown',
        invoiceCount: 1,
        totalSpend: amount,
        lastInvoiceDate: invoiceDate || null
      });
    }
  }

  // Calculate stats and build result
  const vendors = [];
  let totalSpend = 0;
  let invoiceCount = 0;

  for (const [, v] of vendorMap) {
    v.avgInvoiceAmount = v.invoiceCount > 0
      ? Math.round(v.totalSpend / v.invoiceCount * 100) / 100
      : 0;
    vendors.push(v);
    totalSpend += v.totalSpend;
    invoiceCount += v.invoiceCount;
  }

  // Sort by total spend descending
  vendors.sort((a, b) => b.totalSpend - a.totalSpend);

  const avgInvoiceAmount = invoiceCount > 0
    ? Math.round(totalSpend / invoiceCount * 100) / 100
    : 0;

  // Format labels
  const jobLabel = jobName ? jobName : 'All Jobs';
  const periodLabel = (startDate && endDate)
    ? `${startDate} to ${endDate}`
    : (startDate ? `From ${startDate}` : (endDate ? `Through ${endDate}` : 'All Time'));

  // Helper function to format currency
  const formatCurrency = (amount) => {
    return '$' + amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Build table body
  const tableBody = [
    // Header row
    [
      { text: 'Vendor', style: 'tableHeader' },
      { text: 'Invoice Count', style: 'tableHeader', alignment: 'center' },
      { text: 'Total Spend', style: 'tableHeader', alignment: 'right' },
      { text: 'Avg Invoice', style: 'tableHeader', alignment: 'right' },
      { text: 'Last Invoice Date', style: 'tableHeader', alignment: 'center' }
    ],
    // Data rows
    ...vendors.map(vendor => [
      { text: vendor.vendorName },
      { text: vendor.invoiceCount.toString(), alignment: 'center' },
      { text: formatCurrency(vendor.totalSpend), alignment: 'right' },
      { text: formatCurrency(vendor.avgInvoiceAmount), alignment: 'right' },
      { text: vendor.lastInvoiceDate || '-', alignment: 'center' }
    ])
  ];

  // Create PDF document definition
  const docDefinition = {
    pageSize: 'LETTER',
    pageMargins: [40, 60, 40, 60],
    header: (currentPage, pageCount) => ({
      text: `Vendor Spend Report - Page ${currentPage} of ${pageCount}`,
      alignment: 'right',
      fontSize: 10,
      margin: [40, 20, 40, 0]
    }),
    footer: () => ({
      text: `Generated by Ross Built CMS - ${new Date().toLocaleDateString()}`,
      alignment: 'center',
      fontSize: 10,
      margin: [40, 0, 40, 20]
    }),
    content: [
      { text: 'Vendor Spend Report', style: 'title' },
      { text: `Job: ${jobLabel} | Period: ${periodLabel}`, style: 'subtitle' },

      // Summary section
      {
        margin: [0, 0, 0, 20],
        table: {
          widths: ['auto', 'auto'],
          body: [
            [{ text: 'Total Spend:', bold: true }, { text: formatCurrency(totalSpend), alignment: 'right' }],
            [{ text: 'Vendor Count:', bold: true }, { text: vendors.length.toString(), alignment: 'right' }],
            [{ text: 'Invoice Count:', bold: true }, { text: invoiceCount.toString(), alignment: 'right' }],
            [{ text: 'Avg Invoice Amount:', bold: true }, { text: formatCurrency(avgInvoiceAmount), alignment: 'right' }]
          ]
        },
        layout: 'noBorders'
      },

      // Data table
      {
        table: {
          headerRows: 1,
          widths: ['35%', '15%', '18%', '18%', '14%'],
          body: tableBody
        },
        layout: {
          fillColor: (rowIndex) => {
            if (rowIndex === 0) return '#D9E1F2';
            return null;
          },
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
          hLineColor: () => '#CCCCCC',
          vLineColor: () => '#CCCCCC'
        }
      }
    ],
    styles: {
      title: { fontSize: 24, bold: true, color: '#1F4E78', margin: [0, 0, 0, 5] },
      subtitle: { fontSize: 12, color: '#666666', margin: [0, 0, 0, 20] },
      tableHeader: { bold: true, color: '#1F4E78', fontSize: 10 }
    },
    defaultStyle: {
      fontSize: 9
    }
  };

  // Generate PDF and send response
  const dateStr = new Date().toISOString().slice(0, 10);
  const safeJobName = jobName ? jobName.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-') : 'All';
  const filename = `Vendor-Spend-${safeJobName}-${dateStr}.pdf`;

  const pdfDoc = pdfMake.createPdf(docDefinition);
  pdfDoc.getBuffer((buffer) => {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(Buffer.from(buffer));
  });
}));

// ============================================================
// CATEGORY SPEND REPORT
// GET /api/reports/category-spend
// ============================================================

router.get('/category-spend', asyncHandler(async (req, res) => {
  const { jobId, startDate, endDate } = req.query;

  // Build query for invoice allocations with cost code info
  let query = supabase
    .from('v2_invoice_allocations')
    .select(`
      id,
      amount,
      cost_code:v2_cost_codes(id, code, name, category),
      invoice:v2_invoices!inner(id, status, invoice_date, job_id)
    `)
    .in('invoice.status', ['approved', 'in_draw', 'paid']);

  // Apply filters
  if (jobId) {
    query = query.eq('invoice.job_id', jobId);
  }
  if (startDate) {
    query = query.gte('invoice.invoice_date', startDate);
  }
  if (endDate) {
    query = query.lte('invoice.invoice_date', endDate);
  }

  const { data: allocations, error } = await query;

  if (error) {
    throw new AppError('DATABASE_ERROR', error.message);
  }

  // Get job name if filtered
  let jobName = null;
  if (jobId) {
    const { data: job } = await supabase
      .from('v2_jobs')
      .select('name')
      .eq('id', jobId)
      .single();
    jobName = job?.name || null;
  }

  // Group by category (first 2 digits of cost code)
  const categoryMap = new Map();
  const costCodesByCategory = new Map();

  for (const alloc of allocations || []) {
    if (!alloc.cost_code) continue;

    const code = alloc.cost_code.code || '';
    const categoryCode = code.substring(0, 2);
    const categoryName = alloc.cost_code.category || getCategoryName(categoryCode);
    const amount = parseFloat(alloc.amount) || 0;

    const key = categoryCode;
    const existing = categoryMap.get(key);

    // Track unique cost codes per category
    if (!costCodesByCategory.has(key)) {
      costCodesByCategory.set(key, new Set());
    }
    costCodesByCategory.get(key).add(alloc.cost_code.id);

    if (existing) {
      existing.totalSpend += amount;
    } else {
      categoryMap.set(key, {
        categoryCode,
        categoryName,
        totalSpend: amount
      });
    }
  }

  // Calculate total spend and build result
  let totalSpend = 0;
  for (const [, cat] of categoryMap) {
    totalSpend += cat.totalSpend;
  }

  const categories = [];
  for (const [key, cat] of categoryMap) {
    const costCodeCount = costCodesByCategory.get(key)?.size || 0;
    const percentOfTotal = totalSpend > 0
      ? Math.round((cat.totalSpend / totalSpend) * 1000) / 10
      : 0;

    categories.push({
      categoryCode: cat.categoryCode,
      categoryName: cat.categoryName,
      costCodeCount,
      totalSpend: cat.totalSpend,
      percentOfTotal
    });
  }

  // Sort by total spend descending
  categories.sort((a, b) => b.totalSpend - a.totalSpend);

  res.json({
    period: { start: startDate || null, end: endDate || null },
    filters: { jobId: jobId || null, jobName },
    summary: {
      totalSpend,
      categoryCount: categories.length
    },
    categories
  });
}));

// ============================================================
// CATEGORY SPEND REPORT - EXCEL EXPORT
// GET /api/reports/category-spend/excel
// ============================================================

router.get('/category-spend/excel', asyncHandler(async (req, res) => {
  const { jobId, startDate, endDate } = req.query;

  // Build query for invoice allocations with cost code info
  let query = supabase
    .from('v2_invoice_allocations')
    .select(`
      id,
      amount,
      cost_code:v2_cost_codes(id, code, name, category),
      invoice:v2_invoices!inner(id, status, invoice_date, job_id)
    `)
    .in('invoice.status', ['approved', 'in_draw', 'paid']);

  // Apply filters
  if (jobId) {
    query = query.eq('invoice.job_id', jobId);
  }
  if (startDate) {
    query = query.gte('invoice.invoice_date', startDate);
  }
  if (endDate) {
    query = query.lte('invoice.invoice_date', endDate);
  }

  const { data: allocations, error } = await query;

  if (error) {
    throw new AppError('DATABASE_ERROR', error.message);
  }

  // Get job name if filtered
  let jobName = null;
  if (jobId) {
    const { data: job } = await supabase
      .from('v2_jobs')
      .select('name')
      .eq('id', jobId)
      .single();
    jobName = job?.name || null;
  }

  // Group by category (first 2 digits of cost code)
  const categoryMap = new Map();
  const costCodesByCategory = new Map();

  for (const alloc of allocations || []) {
    if (!alloc.cost_code) continue;

    const code = alloc.cost_code.code || '';
    const categoryCode = code.substring(0, 2);
    const categoryName = alloc.cost_code.category || getCategoryName(categoryCode);
    const amount = parseFloat(alloc.amount) || 0;

    const key = categoryCode;
    const existing = categoryMap.get(key);

    // Track unique cost codes per category
    if (!costCodesByCategory.has(key)) {
      costCodesByCategory.set(key, new Set());
    }
    costCodesByCategory.get(key).add(alloc.cost_code.id);

    if (existing) {
      existing.totalSpend += amount;
    } else {
      categoryMap.set(key, {
        categoryCode,
        categoryName,
        totalSpend: amount
      });
    }
  }

  // Calculate total spend and build result
  let totalSpend = 0;
  for (const [, cat] of categoryMap) {
    totalSpend += cat.totalSpend;
  }

  const categories = [];
  for (const [key, cat] of categoryMap) {
    const costCodeCount = costCodesByCategory.get(key)?.size || 0;
    const percentOfTotal = totalSpend > 0
      ? cat.totalSpend / totalSpend
      : 0;

    categories.push({
      categoryCode: cat.categoryCode,
      categoryName: cat.categoryName,
      costCodeCount,
      totalSpend: cat.totalSpend,
      percentOfTotal
    });
  }

  // Sort by total spend descending
  categories.sort((a, b) => b.totalSpend - a.totalSpend);

  // Create Excel workbook
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Ross Built CMS';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Category Spend Report');

  // Title row
  sheet.mergeCells('A1:E1');
  const titleCell = sheet.getCell('A1');
  titleCell.value = 'Category Spend Report';
  titleCell.font = { bold: true, size: 16 };
  titleCell.alignment = { horizontal: 'center' };

  // Filter row
  sheet.mergeCells('A2:E2');
  const filterCell = sheet.getCell('A2');
  const jobLabel = jobName ? jobName : 'All Jobs';
  const periodLabel = (startDate && endDate)
    ? `${startDate} to ${endDate}`
    : (startDate ? `From ${startDate}` : (endDate ? `Through ${endDate}` : 'All Time'));
  filterCell.value = `Job: ${jobLabel} | Period: ${periodLabel}`;
  filterCell.alignment = { horizontal: 'center' };

  // Blank row
  sheet.addRow([]);

  // Summary section
  const summaryStartRow = 4;
  sheet.getCell(`A${summaryStartRow}`).value = 'Summary';
  sheet.getCell(`A${summaryStartRow}`).font = { bold: true, size: 12 };

  sheet.getCell(`A${summaryStartRow + 1}`).value = 'Total Spend:';
  sheet.getCell(`B${summaryStartRow + 1}`).value = totalSpend;
  sheet.getCell(`B${summaryStartRow + 1}`).numFmt = '$#,##0.00';

  sheet.getCell(`A${summaryStartRow + 2}`).value = 'Category Count:';
  sheet.getCell(`B${summaryStartRow + 2}`).value = categories.length;

  // Blank row before data
  const dataStartRow = summaryStartRow + 4;

  // Header row
  const headerRow = sheet.getRow(dataStartRow);
  headerRow.values = ['Category Code', 'Category Name', 'Cost Codes', 'Total Spend', '% of Total'];
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4472C4' }
  };
  headerRow.alignment = { horizontal: 'center' };

  // Set column widths
  sheet.columns = [
    { key: 'categoryCode', width: 15 },
    { key: 'categoryName', width: 30 },
    { key: 'costCodes', width: 12 },
    { key: 'totalSpend', width: 18 },
    { key: 'percentOfTotal', width: 12 }
  ];

  // Add data rows
  categories.forEach((cat, idx) => {
    const rowNum = dataStartRow + 1 + idx;
    const row = sheet.getRow(rowNum);
    row.values = [
      cat.categoryCode,
      cat.categoryName,
      cat.costCodeCount,
      cat.totalSpend,
      cat.percentOfTotal
    ];

    // Currency format for column D
    row.getCell(4).numFmt = '$#,##0.00';
    // Percentage format for column E
    row.getCell(5).numFmt = '0.0%';
  });

  // Freeze header row
  sheet.views = [{ state: 'frozen', xSplit: 0, ySplit: dataStartRow }];

  // Generate filename
  const dateStr = new Date().toISOString().slice(0, 10);
  const safeJobName = jobName ? jobName.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-') : 'All';
  const filename = `Category-Spend-${safeJobName}-${dateStr}.xlsx`;

  // Send response
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  await workbook.xlsx.write(res);
  res.end();
}));

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Get category name from CSI MasterFormat division code
 */
function getCategoryName(divisionCode) {
  const divisions = {
    '01': 'General Requirements',
    '02': 'Site Construction',
    '03': 'Concrete',
    '04': 'Masonry',
    '05': 'Metals',
    '06': 'Wood & Plastics',
    '07': 'Thermal & Moisture Protection',
    '08': 'Doors & Windows',
    '09': 'Finishes',
    '10': 'Specialties',
    '11': 'Equipment',
    '12': 'Furnishings',
    '13': 'Special Construction',
    '14': 'Conveying Systems',
    '15': 'Mechanical',
    '16': 'Electrical',
    '21': 'Fire Suppression',
    '22': 'Plumbing',
    '23': 'HVAC',
    '26': 'Electrical',
    '27': 'Communications',
    '31': 'Earthwork',
    '32': 'Exterior Improvements',
    '33': 'Utilities'
  };
  return divisions[divisionCode] || 'Other';
}

module.exports = router;

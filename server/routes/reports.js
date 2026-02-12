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
const { asyncHandler, AppError } = require('../core/errors');
const { getBuilderId } = require('../core/multi-tenant');

// ============================================================
// JOB COST REPORT
// GET /api/reports/job-cost/:jobId
// ============================================================

router.get('/job-cost/:jobId', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { jobId } = req.params;
  const { startDate, endDate } = req.query;

  // Get job info
  const { data: job, error: jobError } = await supabase
    .from('v2_jobs')
    .select('id, name')
    .eq('id', jobId)
    .eq('builder_id', builderId)
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
    .eq('job_id', jobId)
    .eq('builder_id', builderId);

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
    .eq('purchase_order.builder_id', builderId)
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
    .eq('builder_id', builderId)
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
  const builderId = getBuilderId(req);
  const { jobId } = req.params;
  const { startDate, endDate } = req.query;

  // Get job info
  const { data: job, error: jobError } = await supabase
    .from('v2_jobs')
    .select('id, name')
    .eq('id', jobId)
    .eq('builder_id', builderId)
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
    .eq('job_id', jobId)
    .eq('builder_id', builderId);

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
    .eq('purchase_order.builder_id', builderId)
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
    .eq('builder_id', builderId)
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
  const builderId = getBuilderId(req);
  const { jobId } = req.params;
  const { startDate, endDate } = req.query;

  // Get job info
  const { data: job, error: jobError } = await supabase
    .from('v2_jobs')
    .select('id, name')
    .eq('id', jobId)
    .eq('builder_id', builderId)
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
    .eq('job_id', jobId)
    .eq('builder_id', builderId);

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
    .eq('purchase_order.builder_id', builderId)
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
    .eq('builder_id', builderId)
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
  const builderId = getBuilderId(req);
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
    .eq('builder_id', builderId)
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
      .eq('builder_id', builderId)
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
  const builderId = getBuilderId(req);
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
    .eq('builder_id', builderId)
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
      .eq('builder_id', builderId)
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
  const builderId = getBuilderId(req);
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
    .eq('builder_id', builderId)
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
      .eq('builder_id', builderId)
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
  const builderId = getBuilderId(req);
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
    .eq('builder_id', builderId)
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
      .eq('builder_id', builderId)
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
  const builderId = getBuilderId(req);
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
    .eq('builder_id', builderId)
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
      .eq('builder_id', builderId)
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
// SCHEDULE PERFORMANCE REPORT
// GET /api/reports/schedule-performance
// Combines: Schedule Tasks + Daily Logs
// ============================================================

router.get('/schedule-performance', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { jobId, startDate, endDate } = req.query;

  // Get job info if filtered
  let jobName = null;
  if (jobId) {
    const { data: job } = await supabase
      .from('v2_jobs')
      .select('name')
      .eq('id', jobId)
      .eq('builder_id', builderId)
      .single();
    jobName = job?.name || null;
  }

  // Build schedule query
  let scheduleQuery = supabase
    .from('v2_schedules')
    .select(`
      id,
      job_id,
      name,
      status,
      start_date,
      target_end_date,
      actual_end_date,
      on_schedule,
      critical_path_days,
      job:v2_jobs(id, name)
    `)
    .eq('builder_id', builderId);

  if (jobId) {
    scheduleQuery = scheduleQuery.eq('job_id', jobId);
  }

  const { data: schedules, error: schedError } = await scheduleQuery;

  if (schedError) {
    throw new AppError('DATABASE_ERROR', schedError.message);
  }

  // Get all schedule IDs
  const scheduleIds = (schedules || []).map(s => s.id);

  // Get tasks for all schedules
  let tasksQuery = supabase
    .from('v2_schedule_tasks')
    .select('*')
    .in('schedule_id', scheduleIds.length > 0 ? scheduleIds : ['00000000-0000-0000-0000-000000000000']);

  const { data: allTasks, error: tasksError } = await tasksQuery;

  if (tasksError) {
    throw new AppError('DATABASE_ERROR', tasksError.message);
  }

  // Get daily logs for context on delays/weather
  let logsQuery = supabase
    .from('v2_daily_logs')
    .select(`
      id,
      job_id,
      log_date,
      weather_conditions,
      delays_issues,
      status
    `)
    .eq('builder_id', builderId)
    .is('deleted_at', null);

  if (jobId) {
    logsQuery = logsQuery.eq('job_id', jobId);
  }
  if (startDate) {
    logsQuery = logsQuery.gte('log_date', startDate);
  }
  if (endDate) {
    logsQuery = logsQuery.lte('log_date', endDate);
  }

  const { data: dailyLogs, error: logsError } = await logsQuery;

  if (logsError) {
    throw new AppError('DATABASE_ERROR', logsError.message);
  }

  // Calculate task statistics
  const taskStats = {
    total: (allTasks || []).length,
    notStarted: 0,
    inProgress: 0,
    complete: 0,
    blocked: 0,
    onTime: 0,
    delayed: 0,
    critical: 0,
    criticalDelayed: 0
  };

  const today = new Date().toISOString().split('T')[0];
  const taskDetails = [];

  for (const task of allTasks || []) {
    // Count by status
    switch (task.status) {
      case 'not_started': taskStats.notStarted++; break;
      case 'in_progress': taskStats.inProgress++; break;
      case 'complete': taskStats.complete++; break;
      case 'blocked': taskStats.blocked++; break;
    }

    // Count critical path tasks
    if (task.is_critical) {
      taskStats.critical++;
    }

    // Check if delayed
    const isDelayed = task.planned_end && task.status !== 'complete' && task.planned_end < today;
    if (isDelayed) {
      taskStats.delayed++;
      if (task.is_critical) {
        taskStats.criticalDelayed++;
      }
    } else if (task.status === 'complete' || (task.planned_end && task.planned_end >= today)) {
      taskStats.onTime++;
    }

    // Add to details
    taskDetails.push({
      id: task.id,
      name: task.name,
      phase: task.phase,
      status: task.status,
      percentComplete: task.percent_complete || 0,
      plannedStart: task.planned_start,
      plannedEnd: task.planned_end,
      actualStart: task.actual_start,
      actualEnd: task.actual_end,
      isCritical: task.is_critical || false,
      isDelayed,
      daysDelayed: isDelayed ? Math.ceil((new Date(today) - new Date(task.planned_end)) / (1000 * 60 * 60 * 24)) : 0
    });
  }

  // Analyze daily logs for weather/delay patterns
  const weatherImpact = {
    totalLogs: (dailyLogs || []).length,
    daysWithDelays: 0,
    weatherBreakdown: {}
  };

  for (const log of dailyLogs || []) {
    if (log.delays_issues) {
      weatherImpact.daysWithDelays++;
    }
    if (log.weather_conditions) {
      weatherImpact.weatherBreakdown[log.weather_conditions] =
        (weatherImpact.weatherBreakdown[log.weather_conditions] || 0) + 1;
    }
  }

  // Calculate overall metrics
  const completionRate = taskStats.total > 0
    ? Math.round((taskStats.complete / taskStats.total) * 100)
    : 0;
  const onTimeRate = (taskStats.complete + taskStats.inProgress + taskStats.notStarted) > 0
    ? Math.round((taskStats.onTime / (taskStats.complete + taskStats.inProgress + taskStats.notStarted - taskStats.blocked)) * 100)
    : 0;

  // Sort tasks by delay status and planned end
  taskDetails.sort((a, b) => {
    if (a.isDelayed && !b.isDelayed) return -1;
    if (!a.isDelayed && b.isDelayed) return 1;
    if (a.isCritical && !b.isCritical) return -1;
    if (!a.isCritical && b.isCritical) return 1;
    return (a.plannedEnd || '').localeCompare(b.plannedEnd || '');
  });

  res.json({
    period: { start: startDate || null, end: endDate || null },
    filters: { jobId: jobId || null, jobName },
    summary: {
      totalTasks: taskStats.total,
      completionRate,
      onTimeRate,
      criticalTasks: taskStats.critical,
      criticalDelayed: taskStats.criticalDelayed,
      tasksDelayed: taskStats.delayed,
      daysWithDelays: weatherImpact.daysWithDelays
    },
    taskBreakdown: {
      notStarted: taskStats.notStarted,
      inProgress: taskStats.inProgress,
      complete: taskStats.complete,
      blocked: taskStats.blocked
    },
    weatherImpact,
    tasks: taskDetails.slice(0, 50) // Limit to first 50 for performance
  });
}));

// ============================================================
// REVENUE PER WORKER REPORT
// GET /api/reports/revenue-per-worker
// Combines: Daily Logs (crew) + Invoices + Draws
// ============================================================

router.get('/revenue-per-worker', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { jobId, startDate, endDate } = req.query;

  // Get job info if filtered
  let jobName = null;
  if (jobId) {
    const { data: job } = await supabase
      .from('v2_jobs')
      .select('name')
      .eq('id', jobId)
      .eq('builder_id', builderId)
      .single();
    jobName = job?.name || null;
  }

  // Get daily logs with crew entries
  let logsQuery = supabase
    .from('v2_daily_logs')
    .select(`
      id,
      job_id,
      log_date,
      status,
      crew:v2_daily_log_crew(
        id,
        worker_count,
        hours_worked,
        trade,
        vendor_id,
        vendor:v2_vendors(name)
      ),
      job:v2_jobs(name)
    `)
    .eq('builder_id', builderId)
    .is('deleted_at', null);

  if (jobId) {
    logsQuery = logsQuery.eq('job_id', jobId);
  }
  if (startDate) {
    logsQuery = logsQuery.gte('log_date', startDate);
  }
  if (endDate) {
    logsQuery = logsQuery.lte('log_date', endDate);
  }

  const { data: dailyLogs, error: logsError } = await logsQuery;

  if (logsError) {
    throw new AppError('DATABASE_ERROR', logsError.message);
  }

  // Get funded draws (revenue) for the same period
  let drawsQuery = supabase
    .from('v2_draws')
    .select(`
      id,
      job_id,
      total_amount,
      funded_amount,
      funded_at,
      status,
      job:v2_jobs(name)
    `)
    .eq('builder_id', builderId)
    .eq('status', 'funded');

  if (jobId) {
    drawsQuery = drawsQuery.eq('job_id', jobId);
  }
  if (startDate) {
    drawsQuery = drawsQuery.gte('funded_at', startDate);
  }
  if (endDate) {
    drawsQuery = drawsQuery.lte('funded_at', endDate);
  }

  const { data: draws, error: drawsError } = await drawsQuery;

  if (drawsError) {
    throw new AppError('DATABASE_ERROR', drawsError.message);
  }

  // Calculate total labor metrics
  let totalWorkerDays = 0;
  let totalLaborHours = 0;
  const tradeBreakdown = new Map();
  const jobBreakdown = new Map();

  for (const log of dailyLogs || []) {
    const jobKey = log.job_id;
    const jobLabel = log.job?.name || 'Unknown';

    if (!jobBreakdown.has(jobKey)) {
      jobBreakdown.set(jobKey, {
        jobId: jobKey,
        jobName: jobLabel,
        workerDays: 0,
        laborHours: 0,
        revenue: 0
      });
    }

    for (const crew of log.crew || []) {
      const workers = crew.worker_count || 1;
      const hours = parseFloat(crew.hours_worked) || 8;
      const trade = crew.trade || 'General';

      totalWorkerDays += workers;
      totalLaborHours += workers * hours;

      // Track by job
      jobBreakdown.get(jobKey).workerDays += workers;
      jobBreakdown.get(jobKey).laborHours += workers * hours;

      // Track by trade
      if (!tradeBreakdown.has(trade)) {
        tradeBreakdown.set(trade, { trade, workerDays: 0, laborHours: 0 });
      }
      tradeBreakdown.get(trade).workerDays += workers;
      tradeBreakdown.get(trade).laborHours += workers * hours;
    }
  }

  // Calculate total revenue from funded draws
  let totalRevenue = 0;
  for (const draw of draws || []) {
    const amount = parseFloat(draw.funded_amount) || parseFloat(draw.total_amount) || 0;
    totalRevenue += amount;

    // Add to job breakdown
    const jobKey = draw.job_id;
    if (jobBreakdown.has(jobKey)) {
      jobBreakdown.get(jobKey).revenue += amount;
    } else {
      jobBreakdown.set(jobKey, {
        jobId: jobKey,
        jobName: draw.job?.name || 'Unknown',
        workerDays: 0,
        laborHours: 0,
        revenue: amount
      });
    }
  }

  // Calculate efficiency metrics
  const revenuePerWorkerDay = totalWorkerDays > 0
    ? Math.round(totalRevenue / totalWorkerDays)
    : 0;
  const revenuePerLaborHour = totalLaborHours > 0
    ? Math.round(totalRevenue / totalLaborHours)
    : 0;
  const avgHoursPerDay = totalWorkerDays > 0
    ? Math.round((totalLaborHours / totalWorkerDays) * 10) / 10
    : 0;

  // Convert maps to arrays and sort
  const jobs = Array.from(jobBreakdown.values()).map(j => ({
    ...j,
    revenuePerWorkerDay: j.workerDays > 0 ? Math.round(j.revenue / j.workerDays) : 0,
    revenuePerHour: j.laborHours > 0 ? Math.round(j.revenue / j.laborHours) : 0
  })).sort((a, b) => b.revenue - a.revenue);

  const trades = Array.from(tradeBreakdown.values())
    .sort((a, b) => b.workerDays - a.workerDays);

  res.json({
    period: { start: startDate || null, end: endDate || null },
    filters: { jobId: jobId || null, jobName },
    summary: {
      totalRevenue,
      totalWorkerDays,
      totalLaborHours,
      revenuePerWorkerDay,
      revenuePerLaborHour,
      avgHoursPerDay,
      daysTracked: (dailyLogs || []).length,
      drawsIncluded: (draws || []).length
    },
    byJob: jobs,
    byTrade: trades
  });
}));

// ============================================================
// LABOR COST ANALYSIS REPORT
// GET /api/reports/labor-cost-analysis
// Combines: Daily Logs + Timesheets + Budget
// ============================================================

router.get('/labor-cost-analysis', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { jobId, startDate, endDate } = req.query;

  // Get job info if filtered
  let jobName = null;
  if (jobId) {
    const { data: job } = await supabase
      .from('v2_jobs')
      .select('name')
      .eq('id', jobId)
      .eq('builder_id', builderId)
      .single();
    jobName = job?.name || null;
  }

  // Get daily logs with crew data
  let logsQuery = supabase
    .from('v2_daily_logs')
    .select(`
      id,
      job_id,
      log_date,
      crew:v2_daily_log_crew(
        id,
        worker_count,
        hours_worked,
        trade,
        vendor_id,
        po_id
      ),
      job:v2_jobs(name)
    `)
    .eq('builder_id', builderId)
    .is('deleted_at', null);

  if (jobId) {
    logsQuery = logsQuery.eq('job_id', jobId);
  }
  if (startDate) {
    logsQuery = logsQuery.gte('log_date', startDate);
  }
  if (endDate) {
    logsQuery = logsQuery.lte('log_date', endDate);
  }

  const { data: dailyLogs, error: logsError } = await logsQuery;

  if (logsError) {
    throw new AppError('DATABASE_ERROR', logsError.message);
  }

  // Get timesheets if they exist
  let timesheetsQuery = supabase
    .from('v2_timesheets')
    .select(`
      id,
      job_id,
      employee_id,
      work_date,
      hours_regular,
      hours_overtime,
      hourly_rate,
      total_pay,
      employee:v2_employees(name, trade)
    `)
    .eq('builder_id', builderId);

  if (jobId) {
    timesheetsQuery = timesheetsQuery.eq('job_id', jobId);
  }
  if (startDate) {
    timesheetsQuery = timesheetsQuery.gte('work_date', startDate);
  }
  if (endDate) {
    timesheetsQuery = timesheetsQuery.lte('work_date', endDate);
  }

  const { data: timesheets, error: tsError } = await timesheetsQuery;
  // Don't throw on timesheet error - table might not exist
  const timesheetData = tsError ? [] : (timesheets || []);

  // Get budget for labor cost codes (06xxx for rough carpentry, etc.)
  let budgetQuery = supabase
    .from('v2_budget_lines')
    .select(`
      id,
      budgeted_amount,
      cost_code:v2_cost_codes(id, code, name, category)
    `)
    .eq('builder_id', builderId);

  if (jobId) {
    budgetQuery = budgetQuery.eq('job_id', jobId);
  }

  const { data: budgetLines, error: budgetError } = await budgetQuery;

  if (budgetError) {
    throw new AppError('DATABASE_ERROR', budgetError.message);
  }

  // Calculate labor metrics from daily logs
  const tradeStats = new Map();
  let totalHours = 0;
  let totalWorkerDays = 0;

  for (const log of dailyLogs || []) {
    for (const crew of log.crew || []) {
      const trade = crew.trade || 'General Labor';
      const workers = crew.worker_count || 1;
      const hours = parseFloat(crew.hours_worked) || 8;

      totalWorkerDays += workers;
      totalHours += workers * hours;

      if (!tradeStats.has(trade)) {
        tradeStats.set(trade, {
          trade,
          workerDays: 0,
          totalHours: 0,
          laborCost: 0
        });
      }

      tradeStats.get(trade).workerDays += workers;
      tradeStats.get(trade).totalHours += workers * hours;
    }
  }

  // Add timesheet costs if available
  let totalLaborCost = 0;
  for (const ts of timesheetData) {
    const cost = parseFloat(ts.total_pay) || 0;
    totalLaborCost += cost;

    const trade = ts.employee?.trade || 'General Labor';
    if (tradeStats.has(trade)) {
      tradeStats.get(trade).laborCost += cost;
    }
  }

  // Calculate labor budget from relevant cost codes
  let laborBudget = 0;
  for (const bl of budgetLines || []) {
    const code = bl.cost_code?.code || '';
    // Include labor-intensive categories: rough carpentry, finish carpentry, etc.
    if (code.startsWith('06') || code.startsWith('09') || code.startsWith('01')) {
      laborBudget += parseFloat(bl.budgeted_amount) || 0;
    }
  }

  // Calculate averages
  const avgHourlyRate = totalHours > 0 && totalLaborCost > 0
    ? Math.round((totalLaborCost / totalHours) * 100) / 100
    : 0;
  const avgDailyCost = totalWorkerDays > 0 && totalLaborCost > 0
    ? Math.round(totalLaborCost / totalWorkerDays)
    : 0;
  const budgetVariance = laborBudget - totalLaborCost;

  // Convert trade stats to sorted array
  const trades = Array.from(tradeStats.values()).map(t => ({
    ...t,
    avgHoursPerDay: t.workerDays > 0 ? Math.round((t.totalHours / t.workerDays) * 10) / 10 : 0,
    costPerHour: t.totalHours > 0 && t.laborCost > 0 ? Math.round((t.laborCost / t.totalHours) * 100) / 100 : 0
  })).sort((a, b) => b.totalHours - a.totalHours);

  res.json({
    period: { start: startDate || null, end: endDate || null },
    filters: { jobId: jobId || null, jobName },
    summary: {
      totalLaborHours: totalHours,
      totalWorkerDays,
      totalLaborCost,
      laborBudget,
      budgetVariance,
      avgHourlyRate,
      avgDailyCost,
      daysTracked: (dailyLogs || []).length,
      hasTimesheetData: timesheetData.length > 0
    },
    byTrade: trades
  });
}));

// ============================================================
// INVOICE AGING REPORT
// GET /api/reports/invoice-aging
// ============================================================

router.get('/invoice-aging', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { jobId } = req.query;

  // Get job info if filtered
  let jobName = null;
  if (jobId) {
    const { data: job } = await supabase
      .from('v2_jobs')
      .select('name')
      .eq('id', jobId)
      .eq('builder_id', builderId)
      .single();
    jobName = job?.name || null;
  }

  // Get unpaid invoices
  let query = supabase
    .from('v2_invoices')
    .select(`
      id,
      invoice_number,
      invoice_date,
      due_date,
      amount,
      status,
      vendor:v2_vendors(id, name),
      job:v2_jobs(id, name)
    `)
    .eq('builder_id', builderId)
    .is('deleted_at', null)
    .in('status', ['approved', 'in_draw', 'needs_approval']);

  if (jobId) {
    query = query.eq('job_id', jobId);
  }

  const { data: invoices, error } = await query;

  if (error) {
    throw new AppError('DATABASE_ERROR', error.message);
  }

  const today = new Date();
  const aging = {
    current: { count: 0, amount: 0, invoices: [] },
    days1to30: { count: 0, amount: 0, invoices: [] },
    days31to60: { count: 0, amount: 0, invoices: [] },
    days61to90: { count: 0, amount: 0, invoices: [] },
    over90: { count: 0, amount: 0, invoices: [] }
  };

  let totalOutstanding = 0;

  for (const inv of invoices || []) {
    const amount = parseFloat(inv.amount) || 0;
    const dueDate = inv.due_date ? new Date(inv.due_date) : new Date(inv.invoice_date);
    const daysPastDue = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));

    totalOutstanding += amount;

    const invoiceInfo = {
      id: inv.id,
      invoiceNumber: inv.invoice_number,
      vendor: inv.vendor?.name || 'Unknown',
      job: inv.job?.name || 'Unknown',
      amount,
      invoiceDate: inv.invoice_date,
      dueDate: inv.due_date,
      daysPastDue: Math.max(0, daysPastDue),
      status: inv.status
    };

    if (daysPastDue <= 0) {
      aging.current.count++;
      aging.current.amount += amount;
      aging.current.invoices.push(invoiceInfo);
    } else if (daysPastDue <= 30) {
      aging.days1to30.count++;
      aging.days1to30.amount += amount;
      aging.days1to30.invoices.push(invoiceInfo);
    } else if (daysPastDue <= 60) {
      aging.days31to60.count++;
      aging.days31to60.amount += amount;
      aging.days31to60.invoices.push(invoiceInfo);
    } else if (daysPastDue <= 90) {
      aging.days61to90.count++;
      aging.days61to90.amount += amount;
      aging.days61to90.invoices.push(invoiceInfo);
    } else {
      aging.over90.count++;
      aging.over90.amount += amount;
      aging.over90.invoices.push(invoiceInfo);
    }
  }

  // Sort invoices within each bucket by days past due
  Object.values(aging).forEach(bucket => {
    bucket.invoices.sort((a, b) => b.daysPastDue - a.daysPastDue);
    bucket.invoices = bucket.invoices.slice(0, 20); // Limit to 20 per bucket
  });

  res.json({
    filters: { jobId: jobId || null, jobName },
    summary: {
      totalOutstanding,
      totalInvoices: (invoices || []).length,
      pastDueAmount: aging.days1to30.amount + aging.days31to60.amount + aging.days61to90.amount + aging.over90.amount,
      pastDueCount: aging.days1to30.count + aging.days31to60.count + aging.days61to90.count + aging.over90.count
    },
    aging
  });
}));

// ============================================================
// BUDGET VS ACTUAL VARIANCE REPORT
// GET /api/reports/budget-variance
// ============================================================

router.get('/budget-variance', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { jobId } = req.query;

  if (!jobId) {
    throw new AppError('VALIDATION_ERROR', 'Job ID is required for budget variance report');
  }

  // Get job info
  const { data: job, error: jobError } = await supabase
    .from('v2_jobs')
    .select('id, name, contract_amount')
    .eq('id', jobId)
    .eq('builder_id', builderId)
    .single();

  if (jobError || !job) {
    throw new AppError('JOB_NOT_FOUND', 'Job not found');
  }

  // Get budget lines
  const { data: budgetLines, error: budgetError } = await supabase
    .from('v2_budget_lines')
    .select(`
      id,
      budgeted_amount,
      committed_amount,
      billed_amount,
      paid_amount,
      cost_code:v2_cost_codes(id, code, name, category)
    `)
    .eq('job_id', jobId)
    .eq('builder_id', builderId);

  if (budgetError) {
    throw new AppError('DATABASE_ERROR', budgetError.message);
  }

  // Get actual costs from invoice allocations
  const { data: allocations, error: allocError } = await supabase
    .from('v2_invoice_allocations')
    .select(`
      id,
      amount,
      cost_code_id,
      invoice:v2_invoices!inner(id, status)
    `)
    .eq('job_id', jobId)
    .eq('builder_id', builderId)
    .in('invoice.status', ['approved', 'in_draw', 'paid']);

  if (allocError) {
    throw new AppError('DATABASE_ERROR', allocError.message);
  }

  // Build variance by cost code
  const costCodeMap = new Map();

  for (const bl of budgetLines || []) {
    if (bl.cost_code) {
      costCodeMap.set(bl.cost_code.id, {
        costCodeId: bl.cost_code.id,
        costCode: bl.cost_code.code,
        name: bl.cost_code.name,
        category: bl.cost_code.category,
        budget: parseFloat(bl.budgeted_amount) || 0,
        committed: parseFloat(bl.committed_amount) || 0,
        actual: 0
      });
    }
  }

  // Add actual costs
  for (const alloc of allocations || []) {
    const existing = costCodeMap.get(alloc.cost_code_id);
    if (existing) {
      existing.actual += parseFloat(alloc.amount) || 0;
    }
  }

  // Calculate variances
  const lines = [];
  let totalBudget = 0;
  let totalCommitted = 0;
  let totalActual = 0;
  let overBudgetCount = 0;
  let underBudgetCount = 0;

  for (const [, item] of costCodeMap) {
    const variance = item.budget - item.actual;
    const variancePercent = item.budget > 0
      ? Math.round((variance / item.budget) * 100)
      : 0;
    const percentUsed = item.budget > 0
      ? Math.round((item.actual / item.budget) * 100)
      : 0;

    let status;
    if (item.actual > item.budget) {
      status = 'over';
      overBudgetCount++;
    } else if (item.budget > 0 && item.actual > item.budget * 0.9) {
      status = 'warning';
    } else {
      status = 'under';
      underBudgetCount++;
    }

    lines.push({
      ...item,
      variance,
      variancePercent,
      percentUsed,
      status
    });

    totalBudget += item.budget;
    totalCommitted += item.committed;
    totalActual += item.actual;
  }

  // Sort by variance (most over budget first)
  lines.sort((a, b) => a.variance - b.variance);

  const totalVariance = totalBudget - totalActual;
  const overallPercentUsed = totalBudget > 0 ? Math.round((totalActual / totalBudget) * 100) : 0;

  res.json({
    job: { id: job.id, name: job.name, contractAmount: parseFloat(job.contract_amount) || 0 },
    summary: {
      totalBudget,
      totalCommitted,
      totalActual,
      totalVariance,
      overallPercentUsed,
      costCodesOverBudget: overBudgetCount,
      costCodesUnderBudget: underBudgetCount,
      totalCostCodes: lines.length
    },
    lines
  });
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

// ============================================================
// CUSTOM REPORT BUILDER - TEMPLATE CRUD
// ============================================================

/**
 * Entity schema definitions for the report builder
 * Defines available fields, types, and relationships for each entity type
 */
const ENTITY_SCHEMAS = {
  jobs: {
    table: 'v2_jobs',
    label: 'Jobs',
    fields: {
      id: { type: 'uuid', label: 'Job ID' },
      name: { type: 'text', label: 'Job Name', sortable: true, filterable: true },
      address: { type: 'text', label: 'Address', sortable: true, filterable: true },
      client_name: { type: 'text', label: 'Client Name', sortable: true, filterable: true },
      contract_amount: { type: 'number', label: 'Contract Amount', sortable: true, filterable: true, aggregatable: true },
      status: { type: 'text', label: 'Status', sortable: true, filterable: true },
      construction_type: { type: 'text', label: 'Construction Type', filterable: true },
      square_footage: { type: 'number', label: 'Square Footage', sortable: true, filterable: true, aggregatable: true },
      created_at: { type: 'timestamp', label: 'Created', sortable: true, filterable: true }
    },
    defaultColumns: ['name', 'client_name', 'contract_amount', 'status']
  },
  invoices: {
    table: 'v2_invoices',
    label: 'Invoices',
    fields: {
      id: { type: 'uuid', label: 'Invoice ID' },
      invoice_number: { type: 'text', label: 'Invoice #', sortable: true, filterable: true },
      invoice_date: { type: 'date', label: 'Invoice Date', sortable: true, filterable: true },
      due_date: { type: 'date', label: 'Due Date', sortable: true, filterable: true },
      amount: { type: 'number', label: 'Amount', sortable: true, filterable: true, aggregatable: true },
      status: { type: 'text', label: 'Status', sortable: true, filterable: true },
      job_id: { type: 'uuid', label: 'Job', relation: 'v2_jobs' },
      vendor_id: { type: 'uuid', label: 'Vendor', relation: 'v2_vendors' },
      po_id: { type: 'uuid', label: 'PO', relation: 'v2_purchase_orders' },
      ai_processed: { type: 'boolean', label: 'AI Processed', filterable: true },
      needs_review: { type: 'boolean', label: 'Needs Review', filterable: true },
      created_at: { type: 'timestamp', label: 'Created', sortable: true, filterable: true }
    },
    joins: {
      job: { table: 'v2_jobs', fields: ['id', 'name'] },
      vendor: { table: 'v2_vendors', fields: ['id', 'name', 'trade'] },
      po: { table: 'v2_purchase_orders', fields: ['id', 'po_number'] }
    },
    defaultColumns: ['invoice_number', 'vendor.name', 'amount', 'status', 'invoice_date']
  },
  vendors: {
    table: 'v2_vendors',
    label: 'Vendors',
    fields: {
      id: { type: 'uuid', label: 'Vendor ID' },
      name: { type: 'text', label: 'Vendor Name', sortable: true, filterable: true },
      trade: { type: 'text', label: 'Trade', sortable: true, filterable: true },
      email: { type: 'text', label: 'Email', sortable: true, filterable: true },
      phone: { type: 'text', label: 'Phone', filterable: true },
      contact_name: { type: 'text', label: 'Contact Name', sortable: true, filterable: true },
      address: { type: 'text', label: 'Address', filterable: true },
      city: { type: 'text', label: 'City', sortable: true, filterable: true },
      state: { type: 'text', label: 'State', filterable: true },
      created_at: { type: 'timestamp', label: 'Created', sortable: true, filterable: true }
    },
    defaultColumns: ['name', 'trade', 'email', 'phone']
  },
  purchase_orders: {
    table: 'v2_purchase_orders',
    label: 'Purchase Orders',
    fields: {
      id: { type: 'uuid', label: 'PO ID' },
      po_number: { type: 'text', label: 'PO Number', sortable: true, filterable: true },
      description: { type: 'text', label: 'Description', filterable: true },
      total_amount: { type: 'number', label: 'Total Amount', sortable: true, filterable: true, aggregatable: true },
      status: { type: 'text', label: 'Status', sortable: true, filterable: true },
      status_detail: { type: 'text', label: 'Status Detail', filterable: true },
      job_id: { type: 'uuid', label: 'Job', relation: 'v2_jobs' },
      vendor_id: { type: 'uuid', label: 'Vendor', relation: 'v2_vendors' },
      original_amount: { type: 'number', label: 'Original Amount', sortable: true, aggregatable: true },
      change_order_total: { type: 'number', label: 'CO Total', sortable: true, aggregatable: true },
      created_at: { type: 'timestamp', label: 'Created', sortable: true, filterable: true }
    },
    joins: {
      job: { table: 'v2_jobs', fields: ['id', 'name'] },
      vendor: { table: 'v2_vendors', fields: ['id', 'name'] }
    },
    defaultColumns: ['po_number', 'vendor.name', 'job.name', 'total_amount', 'status']
  },
  draws: {
    table: 'v2_draws',
    label: 'Draws',
    fields: {
      id: { type: 'uuid', label: 'Draw ID' },
      draw_number: { type: 'number', label: 'Draw #', sortable: true, filterable: true },
      job_id: { type: 'uuid', label: 'Job', relation: 'v2_jobs' },
      period_start: { type: 'date', label: 'Period Start', sortable: true, filterable: true },
      period_end: { type: 'date', label: 'Period End', sortable: true, filterable: true },
      total_amount: { type: 'number', label: 'Total Amount', sortable: true, filterable: true, aggregatable: true },
      status: { type: 'text', label: 'Status', sortable: true, filterable: true },
      funded_amount: { type: 'number', label: 'Funded Amount', sortable: true, aggregatable: true },
      submitted_at: { type: 'timestamp', label: 'Submitted', sortable: true, filterable: true },
      funded_at: { type: 'timestamp', label: 'Funded', sortable: true, filterable: true },
      created_at: { type: 'timestamp', label: 'Created', sortable: true, filterable: true }
    },
    joins: {
      job: { table: 'v2_jobs', fields: ['id', 'name'] }
    },
    defaultColumns: ['draw_number', 'job.name', 'total_amount', 'status', 'period_end']
  },
  expenses: {
    table: 'v2_expenses',
    label: 'Expenses',
    fields: {
      id: { type: 'uuid', label: 'Expense ID' },
      amount: { type: 'number', label: 'Amount', sortable: true, filterable: true, aggregatable: true },
      description: { type: 'text', label: 'Description', filterable: true },
      expense_date: { type: 'date', label: 'Expense Date', sortable: true, filterable: true },
      category_id: { type: 'uuid', label: 'Category', relation: 'v2_expense_categories' },
      vendor_id: { type: 'uuid', label: 'Vendor', relation: 'v2_vendors' },
      job_id: { type: 'uuid', label: 'Job', relation: 'v2_jobs' },
      created_at: { type: 'timestamp', label: 'Created', sortable: true, filterable: true }
    },
    joins: {
      category: { table: 'v2_expense_categories', fields: ['id', 'name'] },
      vendor: { table: 'v2_vendors', fields: ['id', 'name'] },
      job: { table: 'v2_jobs', fields: ['id', 'name'] }
    },
    defaultColumns: ['description', 'amount', 'category.name', 'expense_date']
  },
  daily_logs: {
    table: 'v2_daily_logs',
    label: 'Daily Logs',
    fields: {
      id: { type: 'uuid', label: 'Log ID' },
      job_id: { type: 'uuid', label: 'Job', relation: 'v2_jobs' },
      log_date: { type: 'date', label: 'Date', sortable: true, filterable: true },
      status: { type: 'text', label: 'Status', sortable: true, filterable: true },
      weather_conditions: { type: 'text', label: 'Weather', filterable: true },
      temperature_high: { type: 'number', label: 'High Temp', filterable: true },
      temperature_low: { type: 'number', label: 'Low Temp', filterable: true },
      work_performed: { type: 'text', label: 'Work Performed', filterable: true },
      delays_issues: { type: 'text', label: 'Delays/Issues', filterable: true },
      created_at: { type: 'timestamp', label: 'Created', sortable: true, filterable: true }
    },
    joins: {
      job: { table: 'v2_jobs', fields: ['id', 'name'] }
    },
    defaultColumns: ['log_date', 'job.name', 'status', 'weather_conditions', 'work_performed']
  },
  budget_lines: {
    table: 'v2_budget_lines',
    label: 'Budget Lines',
    fields: {
      id: { type: 'uuid', label: 'Line ID' },
      job_id: { type: 'uuid', label: 'Job', relation: 'v2_jobs' },
      cost_code_id: { type: 'uuid', label: 'Cost Code', relation: 'v2_cost_codes' },
      budgeted_amount: { type: 'number', label: 'Budgeted', sortable: true, filterable: true, aggregatable: true },
      committed_amount: { type: 'number', label: 'Committed', sortable: true, filterable: true, aggregatable: true },
      billed_amount: { type: 'number', label: 'Billed', sortable: true, filterable: true, aggregatable: true },
      paid_amount: { type: 'number', label: 'Paid', sortable: true, filterable: true, aggregatable: true }
    },
    joins: {
      job: { table: 'v2_jobs', fields: ['id', 'name'] },
      cost_code: { table: 'v2_cost_codes', fields: ['id', 'code', 'name', 'category'] }
    },
    defaultColumns: ['cost_code.code', 'cost_code.name', 'budgeted_amount', 'committed_amount', 'billed_amount']
  }
};

// ============================================================
// GET ENTITY SCHEMA
// GET /api/reports/schema/:entity
// ============================================================

router.get('/schema/:entity', asyncHandler(async (req, res) => {
  const { entity } = req.params;

  const schema = ENTITY_SCHEMAS[entity];
  if (!schema) {
    throw new AppError('VALIDATION_ERROR', `Unknown entity type: ${entity}. Available types: ${Object.keys(ENTITY_SCHEMAS).join(', ')}`);
  }

  res.json({
    entity,
    label: schema.label,
    table: schema.table,
    fields: schema.fields,
    joins: schema.joins || {},
    defaultColumns: schema.defaultColumns
  });
}));

// ============================================================
// LIST ALL ENTITY SCHEMAS
// GET /api/reports/schemas
// ============================================================

router.get('/schemas', asyncHandler(async (req, res) => {
  const schemas = Object.entries(ENTITY_SCHEMAS).map(([key, schema]) => ({
    entity: key,
    label: schema.label,
    fieldCount: Object.keys(schema.fields).length
  }));

  res.json(schemas);
}));

// ============================================================
// LIST REPORT TEMPLATES
// GET /api/reports/templates
// ============================================================

router.get('/templates', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { entity_type, created_by } = req.query;

  let query = supabase
    .from('v2_report_templates')
    .select('*')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  // Filter by builder - show own templates + public templates
  if (builderId) {
    query = query.or(`builder_id.eq.${builderId},is_public.eq.true`);
  }

  if (entity_type) {
    query = query.eq('entity_type', entity_type);
  }

  if (created_by) {
    query = query.eq('created_by', created_by);
  }

  const { data, error } = await query;

  if (error) {
    throw new AppError('DATABASE_ERROR', error.message);
  }

  res.json(data || []);
}));

// ============================================================
// GET REPORT TEMPLATE BY ID
// GET /api/reports/templates/:id
// ============================================================

router.get('/templates/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const builderId = getBuilderId(req);

  let query = supabase
    .from('v2_report_templates')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null);

  const { data, error } = await query.single();

  if (error) {
    throw new AppError('DATABASE_ERROR', error.message);
  }

  if (!data) {
    throw new AppError('VALIDATION_ERROR', 'Report template not found');
  }

  // Check access
  if (data.builder_id !== builderId && !data.is_public) {
    throw new AppError('VALIDATION_ERROR', 'Access denied to this report template');
  }

  res.json(data);
}));

// ============================================================
// CREATE REPORT TEMPLATE
// POST /api/reports/templates
// ============================================================

router.post('/templates', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const {
    name,
    description,
    entity_type,
    columns,
    filters,
    grouping,
    sort,
    options,
    is_public,
    created_by
  } = req.body;

  // Validate required fields
  if (!name) {
    throw new AppError('VALIDATION_ERROR', 'Template name is required');
  }

  if (!entity_type || !ENTITY_SCHEMAS[entity_type]) {
    throw new AppError('VALIDATION_ERROR', `Invalid entity type. Available types: ${Object.keys(ENTITY_SCHEMAS).join(', ')}`);
  }

  // Validate columns reference valid fields
  if (columns && Array.isArray(columns)) {
    const schema = ENTITY_SCHEMAS[entity_type];
    for (const col of columns) {
      const fieldName = col.field?.split('.')[0]; // Handle nested fields like 'job.name'
      if (!schema.fields[fieldName] && !schema.joins?.[fieldName]) {
        throw new AppError('VALIDATION_ERROR', `Invalid column field: ${col.field}`);
      }
    }
  }

  const { data, error } = await supabase
    .from('v2_report_templates')
    .insert({
      builder_id: builderId,
      name,
      description: description || null,
      entity_type,
      columns: columns || [],
      filters: filters || [],
      grouping: grouping || {},
      sort: sort || [],
      options: options || {},
      is_public: is_public || false,
      created_by: created_by || null
    })
    .select()
    .single();

  if (error) {
    throw new AppError('DATABASE_ERROR', error.message);
  }

  res.status(201).json(data);
}));

// ============================================================
// UPDATE REPORT TEMPLATE
// PATCH /api/reports/templates/:id
// ============================================================

router.patch('/templates/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const builderId = getBuilderId(req);
  const updates = req.body;

  // Get existing template
  const { data: existing, error: fetchError } = await supabase
    .from('v2_report_templates')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (fetchError || !existing) {
    throw new AppError('VALIDATION_ERROR', 'Report template not found');
  }

  // Check ownership
  if (existing.builder_id !== builderId) {
    throw new AppError('VALIDATION_ERROR', 'Cannot modify template owned by another builder');
  }

  // Validate entity_type if being changed
  if (updates.entity_type && !ENTITY_SCHEMAS[updates.entity_type]) {
    throw new AppError('VALIDATION_ERROR', `Invalid entity type: ${updates.entity_type}`);
  }

  // Build update object (only allowed fields)
  const allowedFields = ['name', 'description', 'columns', 'filters', 'grouping', 'sort', 'options', 'is_public'];
  const updateData = {};
  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      updateData[field] = updates[field];
    }
  }

  const { data, error } = await supabase
    .from('v2_report_templates')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new AppError('DATABASE_ERROR', error.message);
  }

  res.json(data);
}));

// ============================================================
// DELETE REPORT TEMPLATE
// DELETE /api/reports/templates/:id
// ============================================================

router.delete('/templates/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const builderId = getBuilderId(req);

  // Get existing template
  const { data: existing, error: fetchError } = await supabase
    .from('v2_report_templates')
    .select('builder_id')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (fetchError || !existing) {
    throw new AppError('VALIDATION_ERROR', 'Report template not found');
  }

  // Check ownership
  if (existing.builder_id !== builderId) {
    throw new AppError('VALIDATION_ERROR', 'Cannot delete template owned by another builder');
  }

  // Soft delete
  const { error } = await supabase
    .from('v2_report_templates')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    throw new AppError('DATABASE_ERROR', error.message);
  }

  res.json({ success: true, message: 'Template deleted' });
}));

// ============================================================
// EXECUTE REPORT
// POST /api/reports/execute
// ============================================================

router.post('/execute', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const startTime = Date.now();
  const {
    entity_type,
    columns,
    filters,
    grouping,
    sort,
    limit = 500,
    offset = 0,
    template_id
  } = req.body;

  // Validate entity type
  if (!entity_type || !ENTITY_SCHEMAS[entity_type]) {
    throw new AppError('VALIDATION_ERROR', `Invalid entity type. Available types: ${Object.keys(ENTITY_SCHEMAS).join(', ')}`);
  }

  const schema = ENTITY_SCHEMAS[entity_type];

  // Build select clause
  let selectClause = '*';
  if (columns && Array.isArray(columns) && columns.length > 0) {
    const selectParts = [];
    const joinParts = [];

    for (const col of columns) {
      if (col.field.includes('.')) {
        // Nested field like 'job.name' - need to include join
        const [joinName, fieldName] = col.field.split('.');
        if (schema.joins?.[joinName]) {
          const join = schema.joins[joinName];
          joinParts.push(`${joinName}:${join.table}(${join.fields.join(',')})`);
        }
      } else {
        selectParts.push(col.field);
      }
    }

    // Always include id
    if (!selectParts.includes('id')) {
      selectParts.push('id');
    }

    // Remove duplicates from joins
    const uniqueJoins = [...new Set(joinParts)];
    selectClause = [...selectParts, ...uniqueJoins].join(',');
  } else {
    // Default: include all default columns + joins
    if (schema.joins) {
      const joinParts = Object.entries(schema.joins).map(([name, join]) =>
        `${name}:${join.table}(${join.fields.join(',')})`
      );
      selectClause = `*,${joinParts.join(',')}`;
    }
  }

  // Build query
  let query = supabase
    .from(schema.table)
    .select(selectClause, { count: 'exact' });

  // Apply builder filter if table supports it
  if (builderId) {
    // Check if table has builder_id column
    const tablesWithBuilderId = ['v2_jobs', 'v2_invoices', 'v2_vendors', 'v2_purchase_orders', 'v2_draws', 'v2_expenses', 'v2_daily_logs', 'v2_budget_lines'];
    if (tablesWithBuilderId.includes(schema.table)) {
      query = query.eq('builder_id', builderId);
    }
  }

  // Apply soft-delete filter
  query = query.is('deleted_at', null);

  // Apply filters
  if (filters && Array.isArray(filters)) {
    for (const filter of filters) {
      const { field, operator, value } = filter;

      // Handle nested fields (e.g., 'job.name')
      const actualField = field.includes('.') ? field.replace('.', '->>') : field;

      switch (operator) {
        case 'eq':
          query = query.eq(actualField, value);
          break;
        case 'neq':
          query = query.neq(actualField, value);
          break;
        case 'gt':
          query = query.gt(actualField, value);
          break;
        case 'gte':
          query = query.gte(actualField, value);
          break;
        case 'lt':
          query = query.lt(actualField, value);
          break;
        case 'lte':
          query = query.lte(actualField, value);
          break;
        case 'like':
          query = query.like(actualField, value);
          break;
        case 'ilike':
          query = query.ilike(actualField, `%${value}%`);
          break;
        case 'in':
          if (Array.isArray(value)) {
            query = query.in(actualField, value);
          }
          break;
        case 'is_null':
          query = query.is(actualField, null);
          break;
        case 'is_not_null':
          query = query.not(actualField, 'is', null);
          break;
        case 'between':
          if (Array.isArray(value) && value.length === 2) {
            query = query.gte(actualField, value[0]).lte(actualField, value[1]);
          }
          break;
        default:
          // Skip unknown operators
          break;
      }
    }
  }

  // Apply sorting
  if (sort && Array.isArray(sort) && sort.length > 0) {
    for (const s of sort) {
      query = query.order(s.field, { ascending: s.direction === 'asc' });
    }
  } else {
    // Default sort by created_at desc
    query = query.order('created_at', { ascending: false });
  }

  // Apply pagination
  const limitNum = Math.min(Math.max(1, parseInt(limit) || 500), 1000);
  const offsetNum = Math.max(0, parseInt(offset) || 0);
  query = query.range(offsetNum, offsetNum + limitNum - 1);

  // Execute query
  const { data, error, count } = await query;

  if (error) {
    throw new AppError('DATABASE_ERROR', error.message);
  }

  // Handle grouping and aggregation (in-memory for now)
  let resultData = data || [];
  let aggregations = null;

  if (grouping && grouping.groupBy && grouping.groupBy.length > 0) {
    const groups = new Map();

    for (const row of resultData) {
      // Create group key
      const keyParts = grouping.groupBy.map(field => {
        if (field.includes('.')) {
          const [joinName, fieldName] = field.split('.');
          return row[joinName]?.[fieldName] || 'null';
        }
        return row[field] || 'null';
      });
      const groupKey = keyParts.join('|');

      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          _groupKey: groupKey,
          _groupValues: Object.fromEntries(grouping.groupBy.map((f, i) => [f, keyParts[i]])),
          _rows: [],
          _count: 0
        });
      }

      groups.get(groupKey)._rows.push(row);
      groups.get(groupKey)._count++;
    }

    // Apply aggregations
    if (grouping.aggregations && Array.isArray(grouping.aggregations)) {
      for (const [, group] of groups) {
        for (const agg of grouping.aggregations) {
          const { field, function: aggFn, alias } = agg;
          const values = group._rows.map(r => parseFloat(r[field]) || 0);

          let result;
          switch (aggFn) {
            case 'sum':
              result = values.reduce((a, b) => a + b, 0);
              break;
            case 'avg':
              result = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
              break;
            case 'min':
              result = values.length > 0 ? Math.min(...values) : 0;
              break;
            case 'max':
              result = values.length > 0 ? Math.max(...values) : 0;
              break;
            case 'count':
              result = group._count;
              break;
            default:
              result = null;
          }

          group[alias || `${aggFn}_${field}`] = result;
        }

        // Remove internal fields
        delete group._rows;
      }
    }

    resultData = Array.from(groups.values());
  }

  // Calculate execution time
  const executionTime = Date.now() - startTime;

  // Log execution if template_id provided
  if (template_id) {
    await supabase
      .from('v2_report_executions')
      .insert({
        template_id,
        builder_id: builderId,
        executed_by: req.user?.email || null,
        runtime_filters: filters || null,
        row_count: resultData.length,
        execution_time_ms: executionTime
      });
  }

  res.json({
    data: resultData,
    meta: {
      total: count,
      limit: limitNum,
      offset: offsetNum,
      hasMore: offsetNum + limitNum < (count || 0),
      executionTimeMs: executionTime,
      groupedBy: grouping?.groupBy || null
    }
  });
}));

// ============================================================
// PREVIEW REPORT (same as execute but with smaller limit)
// POST /api/reports/preview
// ============================================================

router.post('/preview', asyncHandler(async (req, res) => {
  // Reuse execute logic with forced limit
  req.body.limit = 10;
  req.body.offset = 0;

  // Forward to execute handler
  const builderId = getBuilderId(req);
  const {
    entity_type,
    columns,
    filters,
    grouping,
    sort
  } = req.body;

  if (!entity_type || !ENTITY_SCHEMAS[entity_type]) {
    throw new AppError('VALIDATION_ERROR', `Invalid entity type`);
  }

  const schema = ENTITY_SCHEMAS[entity_type];

  // Build minimal select for preview
  let selectClause = '*';
  if (schema.joins) {
    const joinParts = Object.entries(schema.joins).map(([name, join]) =>
      `${name}:${join.table}(${join.fields.join(',')})`
    );
    selectClause = `*,${joinParts.join(',')}`;
  }

  let query = supabase
    .from(schema.table)
    .select(selectClause, { count: 'exact' })
    .is('deleted_at', null)
    .limit(10);

  // Apply builder filter
  if (builderId) {
    const tablesWithBuilderId = ['v2_jobs', 'v2_invoices', 'v2_vendors', 'v2_purchase_orders', 'v2_draws', 'v2_expenses', 'v2_daily_logs', 'v2_budget_lines'];
    if (tablesWithBuilderId.includes(schema.table)) {
      query = query.eq('builder_id', builderId);
    }
  }

  // Apply filters
  if (filters && Array.isArray(filters)) {
    for (const filter of filters) {
      const { field, operator, value } = filter;
      switch (operator) {
        case 'eq':
          query = query.eq(field, value);
          break;
        case 'ilike':
          query = query.ilike(field, `%${value}%`);
          break;
        case 'gte':
          query = query.gte(field, value);
          break;
        case 'lte':
          query = query.lte(field, value);
          break;
        // Add more as needed
      }
    }
  }

  // Apply sort
  if (sort && Array.isArray(sort) && sort.length > 0) {
    for (const s of sort) {
      query = query.order(s.field, { ascending: s.direction === 'asc' });
    }
  } else {
    query = query.order('created_at', { ascending: false });
  }

  const { data, error, count } = await query;

  if (error) {
    throw new AppError('DATABASE_ERROR', error.message);
  }

  res.json({
    preview: true,
    data: data || [],
    meta: {
      total: count,
      showing: (data || []).length,
      hasMore: (count || 0) > 10
    }
  });
}));

module.exports = router;

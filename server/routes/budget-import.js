/**
 * Budget Import Routes
 * Handles Excel template download and budget import from Excel files
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const XLSX = require('xlsx');
const ExcelJS = require('exceljs');
const { supabase } = require('../../config');
const { AppError, asyncHandler } = require('../core/errors');
const logger = require('../utils/logger');

// Configure multer for Excel file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
      'application/vnd.ms-excel', // xls
      'application/octet-stream' // fallback
    ];
    const allowedExts = ['.xlsx', '.xls'];
    const ext = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf('.'));

    if (allowedMimes.includes(file.mimetype) || allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel files (.xlsx, .xls) are allowed'));
    }
  }
});

// ============================================================
// TEMPLATE DOWNLOAD
// ============================================================

/**
 * Download blank budget template
 * GET /api/budget/template
 */
router.get('/template', asyncHandler(async (req, res) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Ross Built CMS';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Budget Template');

  // Set up columns with headers
  sheet.columns = [
    { header: 'Cost Code', key: 'costCode', width: 15 },
    { header: 'Description', key: 'description', width: 40 },
    { header: 'Budgeted Amount', key: 'amount', width: 18 },
    { header: 'Notes (Optional)', key: 'notes', width: 30 }
  ];

  // Style header row
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF2563EB' } // Blue background
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.height = 25;

  // Format amount column as currency
  sheet.getColumn('C').numFmt = '"$"#,##0.00';

  // Get all cost codes to populate example rows
  const { data: costCodes } = await supabase
    .from('v2_cost_codes')
    .select('code, name, category')
    .order('code')
    .limit(20);

  // Add example rows with cost codes
  if (costCodes && costCodes.length > 0) {
    costCodes.slice(0, 10).forEach((cc, idx) => {
      sheet.addRow({
        costCode: cc.code,
        description: cc.name,
        amount: idx === 0 ? 10000 : '', // Example amount in first row
        notes: idx === 0 ? 'Example - replace with your budget' : ''
      });
    });
  } else {
    // Add sample rows if no cost codes exist
    sheet.addRow({ costCode: '01000', description: 'General Requirements', amount: 15000, notes: 'Example row' });
    sheet.addRow({ costCode: '02000', description: 'Site Work', amount: 25000, notes: '' });
    sheet.addRow({ costCode: '03000', description: 'Concrete', amount: 45000, notes: '' });
    sheet.addRow({ costCode: '04000', description: 'Masonry', amount: 20000, notes: '' });
    sheet.addRow({ costCode: '06000', description: 'Wood & Plastics', amount: 55000, notes: '' });
  }

  // Add instructions sheet
  const instructions = workbook.addWorksheet('Instructions');
  instructions.columns = [
    { header: 'Instructions', key: 'text', width: 80 }
  ];

  const instructionRows = [
    '',
    'BUDGET IMPORT TEMPLATE INSTRUCTIONS',
    '',
    '1. Fill in the "Budget Template" sheet with your budget data',
    '',
    '2. Column A (Cost Code): Enter the cost code (e.g., "01000", "06100")',
    '   - If a cost code doesn\'t exist, it will be created automatically',
    '',
    '3. Column B (Description): Enter the cost code description',
    '   - This will be used as the name if creating a new cost code',
    '',
    '4. Column C (Budgeted Amount): Enter the budgeted amount',
    '   - Use positive numbers only',
    '   - Do not include currency symbols or commas (they will be parsed)',
    '',
    '5. Column D (Notes): Optional notes for the budget line',
    '',
    'IMPORT BEHAVIOR:',
    '- Existing budget lines will be UPDATED with new amounts',
    '- New cost codes will be created if they don\'t exist',
    '- Rows without a cost code or amount will be skipped',
    '',
    'SUPPORTED FORMATS:',
    '- .xlsx (Excel 2007+)',
    '- .xls (Excel 97-2003)',
  ];

  instructionRows.forEach((text, idx) => {
    const row = instructions.addRow({ text });
    if (text.includes('INSTRUCTIONS') || text.includes('IMPORT BEHAVIOR') || text.includes('SUPPORTED')) {
      row.font = { bold: true };
    }
  });

  instructions.getColumn(1).width = 80;

  // Set response headers
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="Budget-Import-Template.xlsx"');

  await workbook.xlsx.write(res);
  res.end();

  logger.info('Budget template downloaded', { component: 'budget-import' });
}));

// ============================================================
// IMPORT FROM EXCEL
// ============================================================

/**
 * Import budget from Excel file
 * POST /api/jobs/:jobId/budget/import-excel
 */
router.post('/jobs/:jobId/import-excel', upload.single('file'), asyncHandler(async (req, res) => {
  const { jobId } = req.params;

  if (!req.file) {
    throw new AppError('VALIDATION_ERROR', 'No file uploaded');
  }

  // Verify job exists
  const { data: job, error: jobError } = await supabase
    .from('v2_jobs')
    .select('id, name')
    .eq('id', jobId)
    .single();

  if (jobError || !job) {
    throw new AppError('NOT_FOUND', 'Job not found');
  }

  // Parse Excel file
  let workbook;
  try {
    workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
  } catch (parseError) {
    throw new AppError('VALIDATION_ERROR', 'Failed to parse Excel file: ' + parseError.message);
  }

  // Get first sheet (or sheet named "Budget Template")
  const sheetName = workbook.SheetNames.includes('Budget Template')
    ? 'Budget Template'
    : workbook.SheetNames[0];

  if (!sheetName) {
    throw new AppError('VALIDATION_ERROR', 'Excel file contains no worksheets');
  }

  const sheet = workbook.Sheets[sheetName];

  // Convert to JSON - try to detect header row
  const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  if (rawData.length < 2) {
    throw new AppError('VALIDATION_ERROR', 'Excel file must have at least a header row and one data row');
  }

  // Find header row (look for "Cost Code" in first 5 rows)
  let headerRowIdx = 0;
  for (let i = 0; i < Math.min(5, rawData.length); i++) {
    const row = rawData[i];
    const hasHeader = row.some(cell =>
      typeof cell === 'string' &&
      (cell.toLowerCase().includes('cost code') || cell.toLowerCase() === 'code')
    );
    if (hasHeader) {
      headerRowIdx = i;
      break;
    }
  }

  const headers = rawData[headerRowIdx].map(h => String(h || '').toLowerCase().trim());

  // Map column indices
  const colMap = {
    costCode: headers.findIndex(h => h.includes('cost') && h.includes('code')) !== -1
      ? headers.findIndex(h => h.includes('cost') && h.includes('code'))
      : headers.findIndex(h => h === 'code'),
    description: headers.findIndex(h => h.includes('description') || h.includes('name')),
    amount: headers.findIndex(h => h.includes('amount') || h.includes('budget')),
    notes: headers.findIndex(h => h.includes('note'))
  };

  // Fallback to position-based if headers not found
  if (colMap.costCode === -1) colMap.costCode = 0;
  if (colMap.description === -1) colMap.description = 1;
  if (colMap.amount === -1) colMap.amount = 2;
  if (colMap.notes === -1) colMap.notes = 3;

  // Get all existing cost codes
  const { data: costCodes } = await supabase
    .from('v2_cost_codes')
    .select('id, code, name');

  const costCodeMap = {};
  (costCodes || []).forEach(cc => {
    costCodeMap[cc.code] = cc;
    // Also map without leading zeros
    costCodeMap[cc.code.replace(/^0+/, '')] = cc;
  });

  // Process data rows
  const results = {
    imported: 0,
    created_cost_codes: 0,
    updated: 0,
    skipped: [],
    errors: []
  };

  const dataRows = rawData.slice(headerRowIdx + 1);

  for (let rowIdx = 0; rowIdx < dataRows.length; rowIdx++) {
    const row = dataRows[rowIdx];
    const rowNum = headerRowIdx + rowIdx + 2; // Excel row number (1-indexed + header)

    try {
      // Extract values
      const costCodeValue = String(row[colMap.costCode] || '').trim();
      const description = String(row[colMap.description] || '').trim();
      const amountValue = row[colMap.amount];
      const notes = colMap.notes >= 0 ? String(row[colMap.notes] || '').trim() : '';

      // Skip empty rows
      if (!costCodeValue) {
        results.skipped.push({ row: rowNum, reason: 'Empty cost code' });
        continue;
      }

      // Parse amount
      let amount = 0;
      if (amountValue !== null && amountValue !== undefined && amountValue !== '') {
        if (typeof amountValue === 'number') {
          amount = amountValue;
        } else {
          // Remove currency symbols, commas, whitespace
          const cleanAmount = String(amountValue).replace(/[$,\s]/g, '').trim();
          amount = parseFloat(cleanAmount);
        }
      }

      if (isNaN(amount) || amount < 0) {
        results.skipped.push({ row: rowNum, reason: `Invalid amount: ${amountValue}` });
        continue;
      }

      // Find or create cost code
      let costCode = costCodeMap[costCodeValue] || costCodeMap[costCodeValue.replace(/^0+/, '')];

      if (!costCode && costCodeValue) {
        // Create new cost code
        const { data: newCostCode, error: ccError } = await supabase
          .from('v2_cost_codes')
          .insert({
            code: costCodeValue,
            name: description || costCodeValue,
            category: 'Imported'
          })
          .select()
          .single();

        if (ccError) {
          results.errors.push({ row: rowNum, error: `Failed to create cost code: ${ccError.message}` });
          continue;
        }

        costCode = newCostCode;
        costCodeMap[costCodeValue] = costCode;
        results.created_cost_codes++;
      }

      if (!costCode) {
        results.skipped.push({ row: rowNum, reason: 'Could not resolve cost code' });
        continue;
      }

      // Check if budget line exists
      const { data: existing } = await supabase
        .from('v2_budget_lines')
        .select('id')
        .eq('job_id', jobId)
        .eq('cost_code_id', costCode.id)
        .single();

      if (existing) {
        // Update existing budget line
        const { error: updateError } = await supabase
          .from('v2_budget_lines')
          .update({
            budgeted_amount: amount,
            notes: notes || undefined
          })
          .eq('id', existing.id);

        if (updateError) {
          results.errors.push({ row: rowNum, error: `Failed to update: ${updateError.message}` });
        } else {
          results.updated++;
          results.imported++;
        }
      } else {
        // Insert new budget line
        const { error: insertError } = await supabase
          .from('v2_budget_lines')
          .insert({
            job_id: jobId,
            cost_code_id: costCode.id,
            budgeted_amount: amount,
            committed_amount: 0,
            billed_amount: 0,
            paid_amount: 0,
            notes: notes || null
          });

        if (insertError) {
          results.errors.push({ row: rowNum, error: `Failed to insert: ${insertError.message}` });
        } else {
          results.imported++;
        }
      }
    } catch (rowError) {
      results.errors.push({ row: rowNum, error: rowError.message });
    }
  }

  logger.info('Budget import completed', {
    component: 'budget-import',
    jobId,
    results: {
      imported: results.imported,
      created_cost_codes: results.created_cost_codes,
      updated: results.updated,
      skipped: results.skipped.length,
      errors: results.errors.length
    }
  });

  res.json({
    success: true,
    message: `Imported ${results.imported} budget lines (${results.updated} updated, ${results.imported - results.updated} new)`,
    results
  });
}));

// ============================================================
// EXPORT CURRENT BUDGET TO EXCEL
// ============================================================

/**
 * Export job budget to Excel (with actuals)
 * GET /api/jobs/:jobId/budget/export-excel
 */
router.get('/jobs/:jobId/export-excel', asyncHandler(async (req, res) => {
  const { jobId } = req.params;

  // Get job info
  const { data: job, error: jobError } = await supabase
    .from('v2_jobs')
    .select('id, name, contract_amount')
    .eq('id', jobId)
    .single();

  if (jobError || !job) {
    throw new AppError('NOT_FOUND', 'Job not found');
  }

  // Get budget lines with cost code info
  const { data: budgetLines } = await supabase
    .from('v2_budget_lines')
    .select(`
      id,
      budgeted_amount,
      committed_amount,
      billed_amount,
      paid_amount,
      notes,
      cost_code:v2_cost_codes(id, code, name, category)
    `)
    .eq('job_id', jobId)
    .order('cost_code(code)');

  // Create workbook
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Ross Built CMS';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Budget');

  // Title row
  sheet.mergeCells('A1:I1');
  sheet.getCell('A1').value = `Budget Export - ${job.name}`;
  sheet.getCell('A1').font = { bold: true, size: 16 };
  sheet.getCell('A1').alignment = { horizontal: 'left', vertical: 'middle' };
  sheet.getRow(1).height = 30;

  // Date row
  sheet.mergeCells('A2:I2');
  sheet.getCell('A2').value = `Exported: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`;
  sheet.getCell('A2').font = { italic: true, color: { argb: 'FF666666' } };

  // Empty row
  sheet.addRow([]);

  // Header row
  sheet.addRow([
    'Cost Code',
    'Description',
    'Category',
    'Budgeted',
    'Committed',
    'Billed',
    'Paid',
    '% Complete',
    'Remaining',
    'Variance'
  ]);

  const headerRow = sheet.getRow(4);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF2563EB' }
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

  // Data rows
  let totalBudgeted = 0;
  let totalCommitted = 0;
  let totalBilled = 0;
  let totalPaid = 0;

  (budgetLines || []).forEach(bl => {
    const budgeted = parseFloat(bl.budgeted_amount) || 0;
    const committed = parseFloat(bl.committed_amount) || 0;
    const billed = parseFloat(bl.billed_amount) || 0;
    const paid = parseFloat(bl.paid_amount) || 0;
    const percentComplete = budgeted > 0 ? (billed / budgeted) : 0;
    const remaining = budgeted - billed;
    const variance = budgeted - committed;

    totalBudgeted += budgeted;
    totalCommitted += committed;
    totalBilled += billed;
    totalPaid += paid;

    sheet.addRow([
      bl.cost_code?.code || '',
      bl.cost_code?.name || '',
      bl.cost_code?.category || '',
      budgeted,
      committed,
      billed,
      paid,
      percentComplete,
      remaining,
      variance
    ]);
  });

  // Totals row
  const totalPercentComplete = totalBudgeted > 0 ? (totalBilled / totalBudgeted) : 0;
  const totalRemaining = totalBudgeted - totalBilled;
  const totalVariance = totalBudgeted - totalCommitted;

  const totalsRow = sheet.addRow([
    'TOTALS',
    '',
    '',
    totalBudgeted,
    totalCommitted,
    totalBilled,
    totalPaid,
    totalPercentComplete,
    totalRemaining,
    totalVariance
  ]);
  totalsRow.font = { bold: true };
  totalsRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE5E7EB' }
  };

  // Column formatting
  sheet.getColumn('A').width = 12;
  sheet.getColumn('B').width = 35;
  sheet.getColumn('C').width = 15;
  ['D', 'E', 'F', 'G', 'I', 'J'].forEach(col => {
    sheet.getColumn(col).width = 14;
    sheet.getColumn(col).numFmt = '"$"#,##0.00';
  });
  sheet.getColumn('H').width = 12;
  sheet.getColumn('H').numFmt = '0.0%';

  // Add contract summary
  sheet.addRow([]);
  sheet.addRow(['Contract Amount:', '', '', job.contract_amount || 0]);
  sheet.getRow(sheet.rowCount).getCell(4).numFmt = '"$"#,##0.00';
  sheet.getRow(sheet.rowCount).font = { bold: true };

  // Set response headers
  const safeJobName = job.name.replace(/[^a-zA-Z0-9]/g, '_');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="Budget-${safeJobName}-${new Date().toISOString().split('T')[0]}.xlsx"`);

  await workbook.xlsx.write(res);
  res.end();

  logger.info('Budget exported to Excel', { component: 'budget-import', jobId });
}));

module.exports = router;

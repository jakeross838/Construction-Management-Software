/**
 * Buildertrend Integration Routes
 * Handles CSV import from Buildertrend exports
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { supabase } = require('../../config');
const { asyncHandler, AppError } = require('../core/errors');
const { getBuilderId } = require('../core/multi-tenant');
const {
  parseJobsExport,
  parseScheduleExport,
  parseBudgetExport,
  parseContactsExport,
  generateTemplateCSV,
  getCSVTemplate,
} = require('../services/buildertrend-parser');

// Configure multer for CSV uploads (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' ||
        file.mimetype === 'application/vnd.ms-excel' ||
        file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new AppError('VALIDATION_FAILED', 'Only CSV files are allowed'));
    }
  },
});

// ============================================================
// IMPORT ENDPOINTS
// ============================================================

/**
 * POST /api/integrations/buildertrend/import/jobs
 * Import jobs from Buildertrend CSV export
 */
router.post('/import/jobs', upload.single('file'), asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { imported_by } = req.body;

  if (!req.file) {
    throw new AppError('VALIDATION_FAILED', 'CSV file is required');
  }

  const csvContent = req.file.buffer.toString('utf-8');

  // Create import record
  const { data: importRecord, error: createError } = await supabase
    .from('v2_buildertrend_imports')
    .insert({
      builder_id: builderId,
      import_type: 'jobs',
      file_name: req.file.originalname,
      status: 'processing',
      imported_by: imported_by || 'System',
      started_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (createError) {
    throw new AppError('DATABASE_ERROR', createError.message);
  }

  try {
    // Parse CSV
    const parseResult = parseJobsExport(csvContent);

    let recordsImported = 0;
    let recordsSkipped = 0;
    let recordsFailed = 0;
    const importErrors = [...parseResult.errors];

    // Process each job
    for (const job of parseResult.jobs) {
      try {
        // Check for existing job with same name
        const { data: existing } = await supabase
          .from('v2_jobs')
          .select('id')
          .eq('name', job.name)
          .eq(builderId ? 'builder_id' : 'id', builderId || job.name) // Filter by builder if available
          .maybeSingle();

        if (existing) {
          // Update existing job
          const { error: updateError } = await supabase
            .from('v2_jobs')
            .update({
              address: job.address || undefined,
              client_name: job.client_name || undefined,
              contract_amount: job.contract_amount || undefined,
              status: job.status || undefined,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id);

          if (updateError) throw updateError;

          // Log imported record
          await supabase.from('v2_buildertrend_import_records').insert({
            import_id: importRecord.id,
            bt_record_id: job.external_id || null,
            entity_type: 'job',
            local_entity_id: existing.id,
            status: 'updated',
            raw_data: job._rawData,
          });

          recordsImported++;
        } else {
          // Create new job
          const insertData = {
            name: job.name,
            address: job.address || null,
            client_name: job.client_name || null,
            contract_amount: job.contract_amount || null,
            status: job.status || 'active',
          };

          if (builderId) {
            insertData.builder_id = builderId;
          }

          const { data: newJob, error: insertError } = await supabase
            .from('v2_jobs')
            .insert(insertData)
            .select()
            .single();

          if (insertError) throw insertError;

          // Log imported record
          await supabase.from('v2_buildertrend_import_records').insert({
            import_id: importRecord.id,
            bt_record_id: job.external_id || null,
            entity_type: 'job',
            local_entity_id: newJob.id,
            status: 'created',
            raw_data: job._rawData,
          });

          recordsImported++;
        }
      } catch (err) {
        recordsFailed++;
        importErrors.push({
          row: job._rowIndex,
          error: err.message,
          data: job._rawData,
        });

        // Log failed record
        await supabase.from('v2_buildertrend_import_records').insert({
          import_id: importRecord.id,
          entity_type: 'job',
          status: 'failed',
          error_message: err.message,
          raw_data: job._rawData,
        });
      }
    }

    // Update import record with results
    await supabase
      .from('v2_buildertrend_imports')
      .update({
        status: recordsFailed === parseResult.jobs.length ? 'failed' : 'completed',
        records_imported: recordsImported,
        records_skipped: recordsSkipped,
        records_failed: recordsFailed,
        errors: importErrors,
        mapping_notes: {
          fieldMapping: parseResult.fieldMapping,
          warnings: parseResult.warnings,
        },
        completed_at: new Date().toISOString(),
      })
      .eq('id', importRecord.id);

    res.json({
      success: true,
      import_id: importRecord.id,
      summary: {
        total_rows: parseResult.totalRows,
        imported: recordsImported,
        skipped: recordsSkipped,
        failed: recordsFailed,
      },
      field_mapping: parseResult.fieldMapping,
      warnings: parseResult.warnings,
      errors: importErrors.slice(0, 10), // Return first 10 errors
    });
  } catch (err) {
    // Update import record as failed
    await supabase
      .from('v2_buildertrend_imports')
      .update({
        status: 'failed',
        errors: [{ error: err.message }],
        completed_at: new Date().toISOString(),
      })
      .eq('id', importRecord.id);

    throw err;
  }
}));

/**
 * POST /api/integrations/buildertrend/import/schedule
 * Import schedule tasks from Buildertrend CSV export
 */
router.post('/import/schedule', upload.single('file'), asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { imported_by, job_id } = req.body;

  if (!req.file) {
    throw new AppError('VALIDATION_FAILED', 'CSV file is required');
  }

  const csvContent = req.file.buffer.toString('utf-8');

  // Create import record
  const { data: importRecord, error: createError } = await supabase
    .from('v2_buildertrend_imports')
    .insert({
      builder_id: builderId,
      import_type: 'schedules',
      file_name: req.file.originalname,
      status: 'processing',
      imported_by: imported_by || 'System',
      started_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (createError) {
    throw new AppError('DATABASE_ERROR', createError.message);
  }

  try {
    // Parse CSV
    const parseResult = parseScheduleExport(csvContent);

    // Get jobs for matching
    let jobQuery = supabase.from('v2_jobs').select('id, name');
    if (builderId) {
      jobQuery = jobQuery.eq('builder_id', builderId);
    }
    const { data: jobs } = await jobQuery;
    const jobMap = new Map((jobs || []).map(j => [j.name.toLowerCase(), j.id]));

    let recordsImported = 0;
    let recordsSkipped = 0;
    let recordsFailed = 0;
    const importErrors = [...parseResult.errors];

    // Process each task
    for (const task of parseResult.tasks) {
      try {
        // Determine job_id
        let taskJobId = job_id; // Use provided job_id if specified
        if (!taskJobId && task.job_name) {
          taskJobId = jobMap.get(task.job_name.toLowerCase());
        }

        if (!taskJobId) {
          // Skip if no job can be matched
          recordsSkipped++;
          await supabase.from('v2_buildertrend_import_records').insert({
            import_id: importRecord.id,
            entity_type: 'schedule_task',
            status: 'skipped',
            error_message: `Could not match job: ${task.job_name || 'No job specified'}`,
            raw_data: task._rawData,
          });
          continue;
        }

        // Create schedule task
        const insertData = {
          job_id: taskJobId,
          name: task.name,
          description: task.description || null,
          start_date: task.start_date || null,
          end_date: task.end_date || null,
          duration_days: task.duration_days || null,
          status: task.status || 'not_started',
          assigned_to: task.assigned_to || null,
          percent_complete: task.percent_complete || 0,
          notes: task.notes || null,
        };

        if (builderId) {
          insertData.builder_id = builderId;
        }

        const { data: newTask, error: insertError } = await supabase
          .from('v2_schedule_tasks')
          .insert(insertData)
          .select()
          .single();

        if (insertError) throw insertError;

        // Log imported record
        await supabase.from('v2_buildertrend_import_records').insert({
          import_id: importRecord.id,
          entity_type: 'schedule_task',
          local_entity_id: newTask.id,
          status: 'created',
          raw_data: task._rawData,
        });

        recordsImported++;
      } catch (err) {
        recordsFailed++;
        importErrors.push({
          row: task._rowIndex,
          error: err.message,
          data: task._rawData,
        });

        await supabase.from('v2_buildertrend_import_records').insert({
          import_id: importRecord.id,
          entity_type: 'schedule_task',
          status: 'failed',
          error_message: err.message,
          raw_data: task._rawData,
        });
      }
    }

    // Update import record
    await supabase
      .from('v2_buildertrend_imports')
      .update({
        status: recordsFailed === parseResult.tasks.length ? 'failed' : 'completed',
        records_imported: recordsImported,
        records_skipped: recordsSkipped,
        records_failed: recordsFailed,
        errors: importErrors,
        mapping_notes: {
          fieldMapping: parseResult.fieldMapping,
          warnings: parseResult.warnings,
        },
        completed_at: new Date().toISOString(),
      })
      .eq('id', importRecord.id);

    res.json({
      success: true,
      import_id: importRecord.id,
      summary: {
        total_rows: parseResult.totalRows,
        imported: recordsImported,
        skipped: recordsSkipped,
        failed: recordsFailed,
      },
      field_mapping: parseResult.fieldMapping,
      warnings: parseResult.warnings,
      errors: importErrors.slice(0, 10),
    });
  } catch (err) {
    await supabase
      .from('v2_buildertrend_imports')
      .update({
        status: 'failed',
        errors: [{ error: err.message }],
        completed_at: new Date().toISOString(),
      })
      .eq('id', importRecord.id);

    throw err;
  }
}));

/**
 * POST /api/integrations/buildertrend/import/budget
 * Import budget lines from Buildertrend CSV export
 */
router.post('/import/budget', upload.single('file'), asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { imported_by, job_id } = req.body;

  if (!req.file) {
    throw new AppError('VALIDATION_FAILED', 'CSV file is required');
  }

  const csvContent = req.file.buffer.toString('utf-8');

  // Create import record
  const { data: importRecord, error: createError } = await supabase
    .from('v2_buildertrend_imports')
    .insert({
      builder_id: builderId,
      import_type: 'budgets',
      file_name: req.file.originalname,
      status: 'processing',
      imported_by: imported_by || 'System',
      started_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (createError) {
    throw new AppError('DATABASE_ERROR', createError.message);
  }

  try {
    // Parse CSV
    const parseResult = parseBudgetExport(csvContent);

    // Get jobs for matching
    let jobQuery = supabase.from('v2_jobs').select('id, name');
    if (builderId) {
      jobQuery = jobQuery.eq('builder_id', builderId);
    }
    const { data: jobs } = await jobQuery;
    const jobMap = new Map((jobs || []).map(j => [j.name.toLowerCase(), j.id]));

    // Get cost codes for matching
    let costCodeQuery = supabase.from('v2_cost_codes').select('id, code, name');
    if (builderId) {
      costCodeQuery = costCodeQuery.eq('builder_id', builderId);
    }
    const { data: costCodes } = await costCodeQuery;
    const costCodeByCode = new Map((costCodes || []).map(c => [c.code.toLowerCase(), c.id]));
    const costCodeByName = new Map((costCodes || []).map(c => [c.name.toLowerCase(), c.id]));

    let recordsImported = 0;
    let recordsSkipped = 0;
    let recordsFailed = 0;
    const importErrors = [...parseResult.errors];

    // Process each budget line
    for (const line of parseResult.budgetLines) {
      try {
        // Determine job_id
        let lineJobId = job_id;
        if (!lineJobId && line.job_name) {
          lineJobId = jobMap.get(line.job_name.toLowerCase());
        }

        if (!lineJobId) {
          recordsSkipped++;
          await supabase.from('v2_buildertrend_import_records').insert({
            import_id: importRecord.id,
            entity_type: 'budget_line',
            status: 'skipped',
            error_message: `Could not match job: ${line.job_name || 'No job specified'}`,
            raw_data: line._rawData,
          });
          continue;
        }

        // Find or create cost code
        let costCodeId = null;
        if (line.cost_code) {
          costCodeId = costCodeByCode.get(line.cost_code.toLowerCase());
        }
        if (!costCodeId && line.description) {
          costCodeId = costCodeByName.get(line.description.toLowerCase());
        }

        // Create cost code if not found
        if (!costCodeId && (line.cost_code || line.description)) {
          const newCostCode = {
            code: line.cost_code || line.description.substring(0, 10),
            name: line.description || line.cost_code,
            category: line.category || 'Imported',
          };
          if (builderId) {
            newCostCode.builder_id = builderId;
          }

          const { data: createdCode, error: codeError } = await supabase
            .from('v2_cost_codes')
            .insert(newCostCode)
            .select()
            .single();

          if (!codeError && createdCode) {
            costCodeId = createdCode.id;
            costCodeByCode.set(newCostCode.code.toLowerCase(), costCodeId);
            costCodeByName.set(newCostCode.name.toLowerCase(), costCodeId);
          }
        }

        if (!costCodeId) {
          recordsSkipped++;
          await supabase.from('v2_buildertrend_import_records').insert({
            import_id: importRecord.id,
            entity_type: 'budget_line',
            status: 'skipped',
            error_message: 'Could not match or create cost code',
            raw_data: line._rawData,
          });
          continue;
        }

        // Check for existing budget line
        const { data: existingBudgetLine } = await supabase
          .from('v2_budget_lines')
          .select('id')
          .eq('job_id', lineJobId)
          .eq('cost_code_id', costCodeId)
          .maybeSingle();

        if (existingBudgetLine) {
          // Update existing
          const { error: updateError } = await supabase
            .from('v2_budget_lines')
            .update({
              budgeted_amount: line.budgeted_amount || undefined,
              committed_amount: line.committed_amount || undefined,
              billed_amount: line.billed_amount || undefined,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingBudgetLine.id);

          if (updateError) throw updateError;

          await supabase.from('v2_buildertrend_import_records').insert({
            import_id: importRecord.id,
            entity_type: 'budget_line',
            local_entity_id: existingBudgetLine.id,
            status: 'updated',
            raw_data: line._rawData,
          });

          recordsImported++;
        } else {
          // Create new budget line
          const insertData = {
            job_id: lineJobId,
            cost_code_id: costCodeId,
            budgeted_amount: line.budgeted_amount || 0,
            committed_amount: line.committed_amount || 0,
            billed_amount: line.billed_amount || 0,
            paid_amount: line.actual_amount || 0,
          };

          if (builderId) {
            insertData.builder_id = builderId;
          }

          const { data: newLine, error: insertError } = await supabase
            .from('v2_budget_lines')
            .insert(insertData)
            .select()
            .single();

          if (insertError) throw insertError;

          await supabase.from('v2_buildertrend_import_records').insert({
            import_id: importRecord.id,
            entity_type: 'budget_line',
            local_entity_id: newLine.id,
            status: 'created',
            raw_data: line._rawData,
          });

          recordsImported++;
        }
      } catch (err) {
        recordsFailed++;
        importErrors.push({
          row: line._rowIndex,
          error: err.message,
          data: line._rawData,
        });

        await supabase.from('v2_buildertrend_import_records').insert({
          import_id: importRecord.id,
          entity_type: 'budget_line',
          status: 'failed',
          error_message: err.message,
          raw_data: line._rawData,
        });
      }
    }

    // Update import record
    await supabase
      .from('v2_buildertrend_imports')
      .update({
        status: recordsFailed === parseResult.budgetLines.length ? 'failed' : 'completed',
        records_imported: recordsImported,
        records_skipped: recordsSkipped,
        records_failed: recordsFailed,
        errors: importErrors,
        mapping_notes: {
          fieldMapping: parseResult.fieldMapping,
          warnings: parseResult.warnings,
        },
        completed_at: new Date().toISOString(),
      })
      .eq('id', importRecord.id);

    res.json({
      success: true,
      import_id: importRecord.id,
      summary: {
        total_rows: parseResult.totalRows,
        imported: recordsImported,
        skipped: recordsSkipped,
        failed: recordsFailed,
      },
      field_mapping: parseResult.fieldMapping,
      warnings: parseResult.warnings,
      errors: importErrors.slice(0, 10),
    });
  } catch (err) {
    await supabase
      .from('v2_buildertrend_imports')
      .update({
        status: 'failed',
        errors: [{ error: err.message }],
        completed_at: new Date().toISOString(),
      })
      .eq('id', importRecord.id);

    throw err;
  }
}));

/**
 * POST /api/integrations/buildertrend/import/contacts
 * Import contacts/vendors from Buildertrend CSV export
 */
router.post('/import/contacts', upload.single('file'), asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { imported_by } = req.body;

  if (!req.file) {
    throw new AppError('VALIDATION_FAILED', 'CSV file is required');
  }

  const csvContent = req.file.buffer.toString('utf-8');

  // Create import record
  const { data: importRecord, error: createError } = await supabase
    .from('v2_buildertrend_imports')
    .insert({
      builder_id: builderId,
      import_type: 'contacts',
      file_name: req.file.originalname,
      status: 'processing',
      imported_by: imported_by || 'System',
      started_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (createError) {
    throw new AppError('DATABASE_ERROR', createError.message);
  }

  try {
    // Parse CSV
    const parseResult = parseContactsExport(csvContent);

    let recordsImported = 0;
    let recordsSkipped = 0;
    let recordsFailed = 0;
    const importErrors = [...parseResult.errors];

    // Process each contact
    for (const contact of parseResult.contacts) {
      try {
        // Check for existing vendor with same name
        let vendorQuery = supabase
          .from('v2_vendors')
          .select('id')
          .eq('name', contact.name);

        if (builderId) {
          vendorQuery = vendorQuery.eq('builder_id', builderId);
        }

        const { data: existing } = await vendorQuery.maybeSingle();

        if (existing) {
          // Update existing vendor
          const { error: updateError } = await supabase
            .from('v2_vendors')
            .update({
              email: contact.email || undefined,
              phone: contact.phone || contact.mobile || undefined,
              address: contact.address || undefined,
              trade: contact.trade || undefined,
              license_number: contact.license_number || undefined,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id);

          if (updateError) throw updateError;

          await supabase.from('v2_buildertrend_import_records').insert({
            import_id: importRecord.id,
            entity_type: 'vendor',
            local_entity_id: existing.id,
            status: 'updated',
            raw_data: contact._rawData,
          });

          recordsImported++;
        } else {
          // Create new vendor
          const insertData = {
            name: contact.name,
            email: contact.email || null,
            phone: contact.phone || contact.mobile || null,
            address: contact.address || null,
            trade: contact.trade || null,
            license_number: contact.license_number || null,
          };

          if (builderId) {
            insertData.builder_id = builderId;
          }

          const { data: newVendor, error: insertError } = await supabase
            .from('v2_vendors')
            .insert(insertData)
            .select()
            .single();

          if (insertError) throw insertError;

          await supabase.from('v2_buildertrend_import_records').insert({
            import_id: importRecord.id,
            entity_type: 'vendor',
            local_entity_id: newVendor.id,
            status: 'created',
            raw_data: contact._rawData,
          });

          recordsImported++;
        }
      } catch (err) {
        recordsFailed++;
        importErrors.push({
          row: contact._rowIndex,
          error: err.message,
          data: contact._rawData,
        });

        await supabase.from('v2_buildertrend_import_records').insert({
          import_id: importRecord.id,
          entity_type: 'vendor',
          status: 'failed',
          error_message: err.message,
          raw_data: contact._rawData,
        });
      }
    }

    // Update import record
    await supabase
      .from('v2_buildertrend_imports')
      .update({
        status: recordsFailed === parseResult.contacts.length ? 'failed' : 'completed',
        records_imported: recordsImported,
        records_skipped: recordsSkipped,
        records_failed: recordsFailed,
        errors: importErrors,
        mapping_notes: {
          fieldMapping: parseResult.fieldMapping,
          warnings: parseResult.warnings,
        },
        completed_at: new Date().toISOString(),
      })
      .eq('id', importRecord.id);

    res.json({
      success: true,
      import_id: importRecord.id,
      summary: {
        total_rows: parseResult.totalRows,
        imported: recordsImported,
        skipped: recordsSkipped,
        failed: recordsFailed,
      },
      field_mapping: parseResult.fieldMapping,
      warnings: parseResult.warnings,
      errors: importErrors.slice(0, 10),
    });
  } catch (err) {
    await supabase
      .from('v2_buildertrend_imports')
      .update({
        status: 'failed',
        errors: [{ error: err.message }],
        completed_at: new Date().toISOString(),
      })
      .eq('id', importRecord.id);

    throw err;
  }
}));

// ============================================================
// IMPORT HISTORY ENDPOINTS
// ============================================================

/**
 * GET /api/integrations/buildertrend/imports
 * List past imports
 */
router.get('/imports', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { import_type, status, limit = 50, offset = 0 } = req.query;

  let query = supabase
    .from('v2_buildertrend_imports')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

  if (builderId) {
    query = query.eq('builder_id', builderId);
  }

  if (import_type) {
    query = query.eq('import_type', import_type);
  }

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error, count } = await query;

  if (error) {
    throw new AppError('DATABASE_ERROR', error.message);
  }

  res.json({
    imports: data || [],
    total: count,
    limit: parseInt(limit),
    offset: parseInt(offset),
  });
}));

/**
 * GET /api/integrations/buildertrend/imports/:id
 * Get import details with records
 */
router.get('/imports/:id', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { id } = req.params;

  let query = supabase
    .from('v2_buildertrend_imports')
    .select('*')
    .eq('id', id);

  if (builderId) {
    query = query.eq('builder_id', builderId);
  }

  const { data: importRecord, error } = await query.single();

  if (error || !importRecord) {
    throw new AppError('NOT_FOUND', 'Import not found');
  }

  // Get imported records
  const { data: records } = await supabase
    .from('v2_buildertrend_import_records')
    .select('*')
    .eq('import_id', id)
    .order('created_at', { ascending: true })
    .limit(100);

  res.json({
    import: importRecord,
    records: records || [],
  });
}));

// ============================================================
// TEMPLATE ENDPOINTS
// ============================================================

/**
 * GET /api/integrations/buildertrend/template/:type
 * Get expected CSV format/template
 */
router.get('/template/:type', asyncHandler(async (req, res) => {
  const { type } = req.params;
  const { format = 'json' } = req.query;

  const validTypes = ['jobs', 'schedules', 'budgets', 'contacts'];
  if (!validTypes.includes(type)) {
    throw new AppError('VALIDATION_FAILED', `Invalid import type. Must be one of: ${validTypes.join(', ')}`);
  }

  if (format === 'csv') {
    const csvContent = generateTemplateCSV(type);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=buildertrend_${type}_template.csv`);
    return res.send(csvContent);
  }

  const template = getCSVTemplate(type);
  res.json({
    type,
    ...template,
    supported_fields: Object.keys(
      type === 'jobs' ? require('../services/buildertrend-parser').JOB_FIELD_MAPPINGS :
      type === 'schedules' ? require('../services/buildertrend-parser').SCHEDULE_FIELD_MAPPINGS :
      type === 'budgets' ? require('../services/buildertrend-parser').BUDGET_FIELD_MAPPINGS :
      require('../services/buildertrend-parser').CONTACT_FIELD_MAPPINGS
    ),
  });
}));

/**
 * GET /api/integrations/buildertrend/preview
 * Preview CSV parsing without importing
 */
router.post('/preview', upload.single('file'), asyncHandler(async (req, res) => {
  const { type } = req.body;

  if (!req.file) {
    throw new AppError('VALIDATION_FAILED', 'CSV file is required');
  }

  const validTypes = ['jobs', 'schedules', 'budgets', 'contacts'];
  if (!type || !validTypes.includes(type)) {
    throw new AppError('VALIDATION_FAILED', `Import type is required. Must be one of: ${validTypes.join(', ')}`);
  }

  const csvContent = req.file.buffer.toString('utf-8');

  let parseResult;
  switch (type) {
    case 'jobs':
      parseResult = parseJobsExport(csvContent);
      res.json({
        type,
        ...parseResult,
        preview: parseResult.jobs.slice(0, 10), // First 10 rows
      });
      break;
    case 'schedules':
      parseResult = parseScheduleExport(csvContent);
      res.json({
        type,
        ...parseResult,
        preview: parseResult.tasks.slice(0, 10),
      });
      break;
    case 'budgets':
      parseResult = parseBudgetExport(csvContent);
      res.json({
        type,
        ...parseResult,
        preview: parseResult.budgetLines.slice(0, 10),
      });
      break;
    case 'contacts':
      parseResult = parseContactsExport(csvContent);
      res.json({
        type,
        ...parseResult,
        preview: parseResult.contacts.slice(0, 10),
      });
      break;
  }
}));

module.exports = router;

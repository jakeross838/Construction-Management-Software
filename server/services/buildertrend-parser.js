/**
 * Buildertrend CSV Parser Service
 * Parses Buildertrend export CSV files and maps to our schema
 */

/**
 * Parse CSV content into array of objects
 * Handles quoted fields and escaped characters
 * @param {string} csvContent - Raw CSV string
 * @returns {Array<Object>} Array of row objects with headers as keys
 */
function parseCSV(csvContent) {
  const lines = csvContent.split(/\r?\n/).filter(line => line.trim());
  if (lines.length === 0) return [];

  // Parse header row
  const headers = parseCSVLine(lines[0]);

  // Parse data rows
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === 0) continue;

    const row = {};
    headers.forEach((header, index) => {
      row[header.trim()] = (values[index] || '').trim();
    });
    rows.push(row);
  }

  return rows;
}

/**
 * Parse a single CSV line handling quoted fields
 * @param {string} line - Single CSV line
 * @returns {Array<string>} Array of field values
 */
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else {
        // Toggle quote mode
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);

  return result;
}

/**
 * Parse currency string to number
 * @param {string} value - Currency string like "$1,234.56"
 * @returns {number|null}
 */
function parseCurrency(value) {
  if (!value || value === '') return null;
  // Remove currency symbols, commas, and whitespace
  const cleaned = value.replace(/[$,\s]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

/**
 * Parse date string to ISO format
 * Handles various Buildertrend date formats
 * @param {string} value - Date string
 * @returns {string|null} ISO date string or null
 */
function parseDate(value) {
  if (!value || value === '') return null;

  // Try various date formats
  const formats = [
    // MM/DD/YYYY
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
    // YYYY-MM-DD
    /^(\d{4})-(\d{2})-(\d{2})$/,
    // MM-DD-YYYY
    /^(\d{1,2})-(\d{1,2})-(\d{4})$/,
  ];

  for (const format of formats) {
    const match = value.match(format);
    if (match) {
      let year, month, day;
      if (format === formats[1]) {
        // YYYY-MM-DD format
        [, year, month, day] = match;
      } else {
        // MM/DD/YYYY or MM-DD-YYYY format
        [, month, day, year] = match;
      }
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  // Try native Date parsing as fallback
  const date = new Date(value);
  if (!isNaN(date.getTime())) {
    return date.toISOString().split('T')[0];
  }

  return null;
}

/**
 * Normalize status values to our schema
 * @param {string} btStatus - Buildertrend status
 * @param {string} type - Entity type (job, task, etc.)
 * @returns {string} Normalized status
 */
function normalizeStatus(btStatus, type = 'job') {
  const status = (btStatus || '').toLowerCase().trim();

  if (type === 'job') {
    if (['active', 'in progress', 'open'].includes(status)) return 'active';
    if (['completed', 'closed', 'finished'].includes(status)) return 'completed';
    if (['on hold', 'paused', 'hold'].includes(status)) return 'on_hold';
    if (['lead', 'opportunity', 'prospect'].includes(status)) return 'lead';
    if (['bid', 'bidding', 'estimate'].includes(status)) return 'bidding';
    return 'active'; // Default
  }

  if (type === 'task') {
    if (['complete', 'completed', 'done', 'finished'].includes(status)) return 'complete';
    if (['in progress', 'started', 'working'].includes(status)) return 'in_progress';
    if (['not started', 'pending', 'scheduled'].includes(status)) return 'not_started';
    return 'not_started';
  }

  return status;
}

// ============================================================
// JOBS EXPORT PARSER
// ============================================================

/**
 * Common Buildertrend job export field mappings
 */
const JOB_FIELD_MAPPINGS = {
  // Buildertrend field -> Our field
  'Job Name': 'name',
  'Project Name': 'name',
  'Name': 'name',
  'Job Address': 'address',
  'Address': 'address',
  'Street Address': 'address',
  'Client Name': 'client_name',
  'Customer Name': 'client_name',
  'Owner': 'client_name',
  'Contract Amount': 'contract_amount',
  'Contract Value': 'contract_amount',
  'Total Contract': 'contract_amount',
  'Status': 'status',
  'Job Status': 'status',
  'Start Date': 'start_date',
  'Project Start': 'start_date',
  'End Date': 'end_date',
  'Completion Date': 'end_date',
  'Project End': 'end_date',
  'City': 'city',
  'State': 'state',
  'Zip': 'zip',
  'Zip Code': 'zip',
  'Job Number': 'external_id',
  'Project Number': 'external_id',
  'Job ID': 'external_id',
};

/**
 * Parse Buildertrend jobs export
 * @param {string} csvContent - Raw CSV content
 * @returns {Object} Parsed result with jobs and errors
 */
function parseJobsExport(csvContent) {
  const rows = parseCSV(csvContent);
  const jobs = [];
  const errors = [];
  const warnings = [];

  // Detect which fields are present
  const sampleRow = rows[0] || {};
  const availableFields = Object.keys(sampleRow);
  const fieldMapping = {};

  // Build field mapping based on what's in the CSV
  for (const [btField, ourField] of Object.entries(JOB_FIELD_MAPPINGS)) {
    if (availableFields.includes(btField)) {
      fieldMapping[btField] = ourField;
    }
  }

  // Track mapped fields for reporting
  const mappedFields = Object.keys(fieldMapping);
  const unmappedFields = availableFields.filter(f => !mappedFields.includes(f));

  if (unmappedFields.length > 0) {
    warnings.push(`Unmapped fields in CSV: ${unmappedFields.join(', ')}`);
  }

  // Parse each row
  rows.forEach((row, index) => {
    try {
      const job = {
        _rowIndex: index + 2, // 1-indexed, accounting for header
        _rawData: row,
      };

      // Map fields
      for (const [btField, ourField] of Object.entries(fieldMapping)) {
        const value = row[btField];

        switch (ourField) {
          case 'contract_amount':
            job.contract_amount = parseCurrency(value);
            break;
          case 'start_date':
          case 'end_date':
            job[ourField] = parseDate(value);
            break;
          case 'status':
            job.status = normalizeStatus(value, 'job');
            break;
          default:
            job[ourField] = value || null;
        }
      }

      // Build full address if components are separate
      if (!job.address && (job.city || job.state || job.zip)) {
        const parts = [row['Street Address'] || row['Address']];
        if (job.city) parts.push(job.city);
        if (job.state) parts.push(job.state);
        if (job.zip) parts.push(job.zip);
        job.address = parts.filter(Boolean).join(', ');
      }

      // Validation
      if (!job.name) {
        errors.push({
          row: index + 2,
          error: 'Missing required field: Job Name',
          data: row,
        });
        return;
      }

      jobs.push(job);
    } catch (err) {
      errors.push({
        row: index + 2,
        error: err.message,
        data: row,
      });
    }
  });

  return {
    jobs,
    errors,
    warnings,
    fieldMapping,
    totalRows: rows.length,
    successCount: jobs.length,
    errorCount: errors.length,
  };
}

// ============================================================
// SCHEDULE EXPORT PARSER
// ============================================================

const SCHEDULE_FIELD_MAPPINGS = {
  'Task Name': 'name',
  'Task': 'name',
  'Name': 'name',
  'Description': 'description',
  'Notes': 'notes',
  'Start Date': 'start_date',
  'Scheduled Start': 'start_date',
  'End Date': 'end_date',
  'Scheduled End': 'end_date',
  'Due Date': 'end_date',
  'Duration': 'duration_days',
  'Duration (Days)': 'duration_days',
  'Status': 'status',
  'Task Status': 'status',
  'Assigned To': 'assigned_to',
  'Assignee': 'assigned_to',
  'Job': 'job_name',
  'Project': 'job_name',
  'Job Name': 'job_name',
  'Phase': 'phase',
  'Category': 'category',
  'Percent Complete': 'percent_complete',
  '% Complete': 'percent_complete',
  'Predecessors': 'predecessors',
  'Dependencies': 'predecessors',
};

/**
 * Parse Buildertrend schedule export
 * @param {string} csvContent - Raw CSV content
 * @returns {Object} Parsed result with tasks and errors
 */
function parseScheduleExport(csvContent) {
  const rows = parseCSV(csvContent);
  const tasks = [];
  const errors = [];
  const warnings = [];

  const sampleRow = rows[0] || {};
  const availableFields = Object.keys(sampleRow);
  const fieldMapping = {};

  for (const [btField, ourField] of Object.entries(SCHEDULE_FIELD_MAPPINGS)) {
    if (availableFields.includes(btField)) {
      fieldMapping[btField] = ourField;
    }
  }

  const unmappedFields = availableFields.filter(f => !Object.keys(fieldMapping).includes(f));
  if (unmappedFields.length > 0) {
    warnings.push(`Unmapped fields: ${unmappedFields.join(', ')}`);
  }

  rows.forEach((row, index) => {
    try {
      const task = {
        _rowIndex: index + 2,
        _rawData: row,
      };

      for (const [btField, ourField] of Object.entries(fieldMapping)) {
        const value = row[btField];

        switch (ourField) {
          case 'start_date':
          case 'end_date':
            task[ourField] = parseDate(value);
            break;
          case 'duration_days':
            task.duration_days = parseInt(value) || null;
            break;
          case 'percent_complete':
            // Handle "50%", "50", "0.5" formats
            let pct = value.replace('%', '').trim();
            const num = parseFloat(pct);
            task.percent_complete = isNaN(num) ? 0 : (num > 1 ? num : num * 100);
            break;
          case 'status':
            task.status = normalizeStatus(value, 'task');
            break;
          default:
            task[ourField] = value || null;
        }
      }

      // Calculate duration if we have start and end dates but no duration
      if (task.start_date && task.end_date && !task.duration_days) {
        const start = new Date(task.start_date);
        const end = new Date(task.end_date);
        task.duration_days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
      }

      if (!task.name) {
        errors.push({
          row: index + 2,
          error: 'Missing required field: Task Name',
          data: row,
        });
        return;
      }

      tasks.push(task);
    } catch (err) {
      errors.push({
        row: index + 2,
        error: err.message,
        data: row,
      });
    }
  });

  return {
    tasks,
    errors,
    warnings,
    fieldMapping,
    totalRows: rows.length,
    successCount: tasks.length,
    errorCount: errors.length,
  };
}

// ============================================================
// BUDGET EXPORT PARSER
// ============================================================

const BUDGET_FIELD_MAPPINGS = {
  'Cost Code': 'cost_code',
  'Code': 'cost_code',
  'Category': 'category',
  'Description': 'description',
  'Line Item': 'description',
  'Budget Amount': 'budgeted_amount',
  'Budget': 'budgeted_amount',
  'Original Budget': 'budgeted_amount',
  'Estimated': 'budgeted_amount',
  'Committed': 'committed_amount',
  'Committed Amount': 'committed_amount',
  'Actual': 'actual_amount',
  'Actual Amount': 'actual_amount',
  'Spent': 'actual_amount',
  'Invoiced': 'billed_amount',
  'Billed': 'billed_amount',
  'Job': 'job_name',
  'Project': 'job_name',
  'Job Name': 'job_name',
  'Vendor': 'vendor_name',
  'Subcontractor': 'vendor_name',
};

/**
 * Parse Buildertrend budget export
 * @param {string} csvContent - Raw CSV content
 * @returns {Object} Parsed result with budget lines and errors
 */
function parseBudgetExport(csvContent) {
  const rows = parseCSV(csvContent);
  const budgetLines = [];
  const errors = [];
  const warnings = [];

  const sampleRow = rows[0] || {};
  const availableFields = Object.keys(sampleRow);
  const fieldMapping = {};

  for (const [btField, ourField] of Object.entries(BUDGET_FIELD_MAPPINGS)) {
    if (availableFields.includes(btField)) {
      fieldMapping[btField] = ourField;
    }
  }

  const unmappedFields = availableFields.filter(f => !Object.keys(fieldMapping).includes(f));
  if (unmappedFields.length > 0) {
    warnings.push(`Unmapped fields: ${unmappedFields.join(', ')}`);
  }

  rows.forEach((row, index) => {
    try {
      const line = {
        _rowIndex: index + 2,
        _rawData: row,
      };

      for (const [btField, ourField] of Object.entries(fieldMapping)) {
        const value = row[btField];

        switch (ourField) {
          case 'budgeted_amount':
          case 'committed_amount':
          case 'actual_amount':
          case 'billed_amount':
            line[ourField] = parseCurrency(value);
            break;
          default:
            line[ourField] = value || null;
        }
      }

      // Need at least description or cost code
      if (!line.description && !line.cost_code) {
        errors.push({
          row: index + 2,
          error: 'Missing required field: Cost Code or Description',
          data: row,
        });
        return;
      }

      budgetLines.push(line);
    } catch (err) {
      errors.push({
        row: index + 2,
        error: err.message,
        data: row,
      });
    }
  });

  return {
    budgetLines,
    errors,
    warnings,
    fieldMapping,
    totalRows: rows.length,
    successCount: budgetLines.length,
    errorCount: errors.length,
  };
}

// ============================================================
// CONTACTS EXPORT PARSER
// ============================================================

const CONTACT_FIELD_MAPPINGS = {
  'Company': 'company_name',
  'Company Name': 'company_name',
  'Vendor': 'company_name',
  'Vendor Name': 'company_name',
  'Subcontractor': 'company_name',
  'Contact Name': 'contact_name',
  'Name': 'contact_name',
  'First Name': 'first_name',
  'Last Name': 'last_name',
  'Email': 'email',
  'Email Address': 'email',
  'Phone': 'phone',
  'Phone Number': 'phone',
  'Mobile': 'mobile',
  'Cell': 'mobile',
  'Cell Phone': 'mobile',
  'Address': 'address',
  'Street Address': 'address',
  'City': 'city',
  'State': 'state',
  'Zip': 'zip',
  'Zip Code': 'zip',
  'Trade': 'trade',
  'Category': 'trade',
  'Type': 'contact_type',
  'Contact Type': 'contact_type',
  'Notes': 'notes',
  'License Number': 'license_number',
  'License': 'license_number',
  'Insurance Exp': 'insurance_expiry',
  'Insurance Expiration': 'insurance_expiry',
};

/**
 * Parse Buildertrend contacts/vendors export
 * @param {string} csvContent - Raw CSV content
 * @returns {Object} Parsed result with contacts and errors
 */
function parseContactsExport(csvContent) {
  const rows = parseCSV(csvContent);
  const contacts = [];
  const errors = [];
  const warnings = [];

  const sampleRow = rows[0] || {};
  const availableFields = Object.keys(sampleRow);
  const fieldMapping = {};

  for (const [btField, ourField] of Object.entries(CONTACT_FIELD_MAPPINGS)) {
    if (availableFields.includes(btField)) {
      fieldMapping[btField] = ourField;
    }
  }

  const unmappedFields = availableFields.filter(f => !Object.keys(fieldMapping).includes(f));
  if (unmappedFields.length > 0) {
    warnings.push(`Unmapped fields: ${unmappedFields.join(', ')}`);
  }

  rows.forEach((row, index) => {
    try {
      const contact = {
        _rowIndex: index + 2,
        _rawData: row,
      };

      for (const [btField, ourField] of Object.entries(fieldMapping)) {
        const value = row[btField];

        switch (ourField) {
          case 'insurance_expiry':
            contact.insurance_expiry = parseDate(value);
            break;
          default:
            contact[ourField] = value || null;
        }
      }

      // Build full name if we have first/last
      if (!contact.contact_name && (contact.first_name || contact.last_name)) {
        contact.contact_name = [contact.first_name, contact.last_name].filter(Boolean).join(' ');
      }

      // Build full address if components are separate
      if (!contact.address && (contact.city || contact.state || contact.zip)) {
        const parts = [row['Street Address'] || row['Address']];
        if (contact.city) parts.push(contact.city);
        if (contact.state) parts.push(contact.state);
        if (contact.zip) parts.push(contact.zip);
        contact.address = parts.filter(Boolean).join(', ');
      }

      // Need at least company name or contact name
      if (!contact.company_name && !contact.contact_name) {
        errors.push({
          row: index + 2,
          error: 'Missing required field: Company Name or Contact Name',
          data: row,
        });
        return;
      }

      // Use company name as the primary name for vendors
      contact.name = contact.company_name || contact.contact_name;

      contacts.push(contact);
    } catch (err) {
      errors.push({
        row: index + 2,
        error: err.message,
        data: row,
      });
    }
  });

  return {
    contacts,
    errors,
    warnings,
    fieldMapping,
    totalRows: rows.length,
    successCount: contacts.length,
    errorCount: errors.length,
  };
}

// ============================================================
// TEMPLATE GENERATORS
// ============================================================

/**
 * Generate expected CSV template for each import type
 * @param {string} type - Import type
 * @returns {Object} Template with headers and sample data
 */
function getCSVTemplate(type) {
  const templates = {
    jobs: {
      headers: ['Job Name', 'Job Address', 'Client Name', 'Contract Amount', 'Status', 'Start Date', 'End Date'],
      sample: [
        ['Smith Residence', '123 Main St, Tampa FL 33601', 'John Smith', '$500,000', 'Active', '01/15/2026', '07/15/2026'],
        ['Johnson Remodel', '456 Oak Ave, Sarasota FL 34236', 'Jane Johnson', '$150,000', 'Bidding', '03/01/2026', '06/01/2026'],
      ],
      description: 'Import projects/jobs from Buildertrend. Required: Job Name.',
    },
    schedules: {
      headers: ['Task Name', 'Job Name', 'Start Date', 'End Date', 'Duration (Days)', 'Status', 'Assigned To', 'Predecessors'],
      sample: [
        ['Foundation', 'Smith Residence', '01/15/2026', '01/22/2026', '5', 'Complete', 'ABC Concrete', ''],
        ['Framing', 'Smith Residence', '01/23/2026', '02/10/2026', '14', 'In Progress', 'XYZ Framers', 'Foundation'],
      ],
      description: 'Import schedule tasks. Required: Task Name. Optional: Job Name to link to existing job.',
    },
    budgets: {
      headers: ['Cost Code', 'Description', 'Job Name', 'Budget Amount', 'Committed', 'Actual', 'Vendor'],
      sample: [
        ['03100', 'Concrete Foundation', 'Smith Residence', '$45,000', '$42,000', '$41,500', 'ABC Concrete'],
        ['06100', 'Rough Carpentry', 'Smith Residence', '$85,000', '$82,000', '$0', 'XYZ Framers'],
      ],
      description: 'Import budget lines. Required: Cost Code or Description.',
    },
    contacts: {
      headers: ['Company Name', 'Contact Name', 'Email', 'Phone', 'Address', 'Trade', 'License Number'],
      sample: [
        ['ABC Concrete', 'Mike Wilson', 'mike@abcconcrete.com', '(813) 555-1234', '789 Industrial Blvd, Tampa FL', 'Concrete', 'CRC123456'],
        ['XYZ Framers', 'Tom Brown', 'tom@xyzframers.com', '(941) 555-5678', '321 Construction Way, Sarasota FL', 'Framing', 'CBC789012'],
      ],
      description: 'Import vendors/subcontractors. Required: Company Name or Contact Name.',
    },
  };

  return templates[type] || null;
}

/**
 * Convert template to downloadable CSV string
 * @param {string} type - Import type
 * @returns {string} CSV content
 */
function generateTemplateCSV(type) {
  const template = getCSVTemplate(type);
  if (!template) return null;

  const lines = [
    template.headers.join(','),
    ...template.sample.map(row => row.map(v => `"${v}"`).join(',')),
  ];

  return lines.join('\n');
}

module.exports = {
  parseCSV,
  parseCSVLine,
  parseCurrency,
  parseDate,
  normalizeStatus,
  parseJobsExport,
  parseScheduleExport,
  parseBudgetExport,
  parseContactsExport,
  getCSVTemplate,
  generateTemplateCSV,
  JOB_FIELD_MAPPINGS,
  SCHEDULE_FIELD_MAPPINGS,
  BUDGET_FIELD_MAPPINGS,
  CONTACT_FIELD_MAPPINGS,
};

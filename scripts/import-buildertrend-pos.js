/**
 * Buildertrend PO Import Script
 *
 * Imports Purchase Orders from Buildertrend CSV export into Ross Built CMS.
 *
 * Usage:
 *   node scripts/import-buildertrend-pos.js <csv-file> [--dry-run]
 *
 * Expected CSV columns (flexible mapping):
 *   - PO Number, PO #, or Purchase Order Number
 *   - Job Name, Job, or Project
 *   - Vendor Name, Vendor, or Subcontractor
 *   - Description, Scope, or Notes
 *   - Amount, Total, PO Amount, or Contract Amount
 *   - Status (optional)
 *   - Date, Created Date, or PO Date (optional)
 *
 * The script will:
 *   1. Parse the CSV file
 *   2. Match jobs and vendors to existing records (or create new ones)
 *   3. Create POs with the mapped data
 *   4. Skip duplicates based on PO number
 */

const fs = require('fs');
const path = require('path');

// Load environment
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Column name mappings (case-insensitive)
const COLUMN_MAPPINGS = {
  po_number: ['po number', 'po #', 'po#', 'purchase order number', 'purchase order #', 'ponumber'],
  job_name: ['job name', 'job', 'project', 'project name', 'job title'],
  vendor_name: ['vendor name', 'vendor', 'subcontractor', 'sub', 'contractor', 'payee'],
  description: ['description', 'scope', 'scope of work', 'notes', 'memo', 'details'],
  amount: ['amount', 'total', 'po amount', 'contract amount', 'total amount', 'value', 'po total'],
  status: ['status', 'po status', 'state'],
  date: ['date', 'created date', 'po date', 'created', 'order date', 'issued date'],
  cost_code: ['cost code', 'costcode', 'code', 'category', 'budget code', 'line item']
};

// Status mapping from Buildertrend to our system
const STATUS_MAPPING = {
  'open': { status: 'open', status_detail: 'pending', approval_status: 'pending' },
  'active': { status: 'open', status_detail: 'active', approval_status: 'approved' },
  'approved': { status: 'open', status_detail: 'approved', approval_status: 'approved' },
  'sent': { status: 'open', status_detail: 'sent', approval_status: 'pending' },
  'pending': { status: 'open', status_detail: 'pending', approval_status: 'pending' },
  'closed': { status: 'closed', status_detail: 'closed', approval_status: 'approved' },
  'complete': { status: 'closed', status_detail: 'completed', approval_status: 'approved' },
  'completed': { status: 'closed', status_detail: 'completed', approval_status: 'approved' },
  'cancelled': { status: 'cancelled', status_detail: 'cancelled', approval_status: 'pending' },
  'void': { status: 'cancelled', status_detail: 'voided', approval_status: 'pending' },
  'voided': { status: 'cancelled', status_detail: 'voided', approval_status: 'pending' }
};

class BuildertrendImporter {
  constructor(options = {}) {
    this.dryRun = options.dryRun || false;
    this.jobs = new Map();
    this.vendors = new Map();
    this.costCodes = new Map();
    this.existingPOs = new Set();
    this.stats = {
      total: 0,
      created: 0,
      skipped: 0,
      errors: 0,
      jobsCreated: 0,
      vendorsCreated: 0
    };
  }

  async loadReferenceData() {
    console.log('Loading reference data...');

    // Load jobs
    const { data: jobs } = await supabase
      .from('v2_jobs')
      .select('id, name')
      .is('deleted_at', null);

    jobs?.forEach(j => {
      this.jobs.set(this.normalizeString(j.name), j);
    });
    console.log(`  Loaded ${this.jobs.size} jobs`);

    // Load vendors
    const { data: vendors } = await supabase
      .from('v2_vendors')
      .select('id, name')
      .is('deleted_at', null);

    vendors?.forEach(v => {
      this.vendors.set(this.normalizeString(v.name), v);
    });
    console.log(`  Loaded ${this.vendors.size} vendors`);

    // Load cost codes
    const { data: costCodes } = await supabase
      .from('v2_cost_codes')
      .select('id, code, name');

    costCodes?.forEach(cc => {
      this.costCodes.set(cc.code, cc);
      this.costCodes.set(this.normalizeString(cc.name), cc);
    });
    console.log(`  Loaded ${costCodes?.length || 0} cost codes`);

    // Load existing PO numbers
    const { data: pos } = await supabase
      .from('v2_purchase_orders')
      .select('po_number')
      .is('deleted_at', null);

    pos?.forEach(po => {
      if (po.po_number) {
        this.existingPOs.add(this.normalizeString(po.po_number));
      }
    });
    console.log(`  Loaded ${this.existingPOs.size} existing PO numbers`);
  }

  normalizeString(str) {
    if (!str) return '';
    return String(str).toLowerCase().trim().replace(/\s+/g, ' ');
  }

  parseCSV(content) {
    const lines = content.split(/\r?\n/).filter(line => line.trim());
    if (lines.length < 2) {
      throw new Error('CSV file must have at least a header row and one data row');
    }

    // Parse header
    const headerLine = lines[0];
    const headers = this.parseCSVLine(headerLine);

    // Map headers to our fields
    const columnMap = {};
    headers.forEach((header, index) => {
      const normalizedHeader = this.normalizeString(header);
      for (const [field, aliases] of Object.entries(COLUMN_MAPPINGS)) {
        if (aliases.some(alias => normalizedHeader.includes(alias) || alias.includes(normalizedHeader))) {
          columnMap[field] = index;
          break;
        }
      }
    });

    console.log('\nColumn mapping:');
    for (const [field, index] of Object.entries(columnMap)) {
      console.log(`  ${field}: "${headers[index]}" (column ${index + 1})`);
    }

    // Parse data rows
    const records = [];
    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i]);
      if (values.length === 0 || values.every(v => !v.trim())) continue;

      const record = {};
      for (const [field, index] of Object.entries(columnMap)) {
        record[field] = values[index]?.trim() || '';
      }
      records.push(record);
    }

    return records;
  }

  parseCSVLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (inQuotes) {
        if (char === '"' && nextChar === '"') {
          current += '"';
          i++; // Skip next quote
        } else if (char === '"') {
          inQuotes = false;
        } else {
          current += char;
        }
      } else {
        if (char === '"') {
          inQuotes = true;
        } else if (char === ',') {
          values.push(current);
          current = '';
        } else {
          current += char;
        }
      }
    }
    values.push(current);

    return values;
  }

  async findOrCreateJob(jobName) {
    if (!jobName) return null;

    const normalized = this.normalizeString(jobName);

    // Try exact match
    if (this.jobs.has(normalized)) {
      return this.jobs.get(normalized);
    }

    // Try fuzzy match
    for (const [key, job] of this.jobs) {
      if (key.includes(normalized) || normalized.includes(key)) {
        return job;
      }
    }

    // Create new job if not in dry run
    if (!this.dryRun) {
      const { data: newJob, error } = await supabase
        .from('v2_jobs')
        .insert({ name: jobName, status: 'active' })
        .select()
        .single();

      if (error) {
        console.error(`  Error creating job "${jobName}":`, error.message);
        return null;
      }

      this.jobs.set(normalized, newJob);
      this.stats.jobsCreated++;
      console.log(`  Created job: ${jobName}`);
      return newJob;
    }

    console.log(`  [DRY RUN] Would create job: ${jobName}`);
    return { id: 'dry-run-job-id', name: jobName };
  }

  async findOrCreateVendor(vendorName) {
    if (!vendorName) return null;

    const normalized = this.normalizeString(vendorName);

    // Try exact match
    if (this.vendors.has(normalized)) {
      return this.vendors.get(normalized);
    }

    // Try fuzzy match
    for (const [key, vendor] of this.vendors) {
      if (key.includes(normalized) || normalized.includes(key)) {
        return vendor;
      }
    }

    // Create new vendor if not in dry run
    if (!this.dryRun) {
      const { data: newVendor, error } = await supabase
        .from('v2_vendors')
        .insert({ name: vendorName })
        .select()
        .single();

      if (error) {
        console.error(`  Error creating vendor "${vendorName}":`, error.message);
        return null;
      }

      this.vendors.set(normalized, newVendor);
      this.stats.vendorsCreated++;
      console.log(`  Created vendor: ${vendorName}`);
      return newVendor;
    }

    console.log(`  [DRY RUN] Would create vendor: ${vendorName}`);
    return { id: 'dry-run-vendor-id', name: vendorName };
  }

  findCostCode(codeOrName) {
    if (!codeOrName) return null;

    // Try exact code match
    if (this.costCodes.has(codeOrName)) {
      return this.costCodes.get(codeOrName);
    }

    // Try normalized name match
    const normalized = this.normalizeString(codeOrName);
    if (this.costCodes.has(normalized)) {
      return this.costCodes.get(normalized);
    }

    // Try partial match
    for (const [key, cc] of this.costCodes) {
      if (key.includes(normalized) || normalized.includes(key)) {
        return cc;
      }
    }

    return null;
  }

  parseAmount(amountStr) {
    if (!amountStr) return 0;
    // Remove currency symbols, commas, and parse
    const cleaned = String(amountStr).replace(/[$,\s]/g, '').replace(/[()]/g, '-');
    const amount = parseFloat(cleaned);
    return isNaN(amount) ? 0 : amount;
  }

  parseDate(dateStr) {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return null;
    return date.toISOString();
  }

  mapStatus(btStatus) {
    if (!btStatus) {
      return STATUS_MAPPING['open'];
    }
    const normalized = this.normalizeString(btStatus);
    return STATUS_MAPPING[normalized] || STATUS_MAPPING['open'];
  }

  async importRecord(record, index) {
    const poNumber = record.po_number;

    // Check for duplicate
    if (poNumber && this.existingPOs.has(this.normalizeString(poNumber))) {
      console.log(`  [${index}] SKIP: PO ${poNumber} already exists`);
      this.stats.skipped++;
      return;
    }

    // Find/create job and vendor
    const job = await this.findOrCreateJob(record.job_name);
    const vendor = await this.findOrCreateVendor(record.vendor_name);

    if (!job) {
      console.log(`  [${index}] ERROR: No job found for "${record.job_name}"`);
      this.stats.errors++;
      return;
    }

    if (!vendor) {
      console.log(`  [${index}] ERROR: No vendor found for "${record.vendor_name}"`);
      this.stats.errors++;
      return;
    }

    const amount = this.parseAmount(record.amount);
    const statusInfo = this.mapStatus(record.status);
    const costCode = this.findCostCode(record.cost_code);

    const poData = {
      po_number: poNumber || null,
      job_id: job.id,
      vendor_id: vendor.id,
      description: record.description || null,
      total_amount: amount,
      original_amount: amount,
      status: statusInfo.status,
      status_detail: statusInfo.status_detail,
      approval_status: statusInfo.approval_status,
      notes: `Imported from Buildertrend on ${new Date().toLocaleDateString()}`,
      created_at: this.parseDate(record.date) || new Date().toISOString()
    };

    if (this.dryRun) {
      console.log(`  [${index}] DRY RUN: Would create PO ${poNumber || '(auto)'} - ${job.name} / ${vendor.name} - ${this.formatMoney(amount)}`);
      this.stats.created++;
      return;
    }

    // Create the PO
    const { data: newPO, error } = await supabase
      .from('v2_purchase_orders')
      .insert(poData)
      .select()
      .single();

    if (error) {
      console.log(`  [${index}] ERROR: Failed to create PO: ${error.message}`);
      this.stats.errors++;
      return;
    }

    // Create line item if we have a cost code
    if (costCode && amount > 0) {
      await supabase
        .from('v2_po_line_items')
        .insert({
          po_id: newPO.id,
          cost_code_id: costCode.id,
          description: record.description || costCode.name,
          amount: amount
        });
    }

    // Add to existing POs set
    if (poNumber) {
      this.existingPOs.add(this.normalizeString(poNumber));
    }

    console.log(`  [${index}] CREATED: PO ${newPO.po_number || newPO.id.slice(0, 8)} - ${job.name} / ${vendor.name} - ${this.formatMoney(amount)}`);
    this.stats.created++;
  }

  formatMoney(amount) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }

  async run(csvPath) {
    console.log('='.repeat(60));
    console.log('BUILDERTREND PO IMPORT');
    console.log('='.repeat(60));
    console.log(`\nFile: ${csvPath}`);
    console.log(`Mode: ${this.dryRun ? 'DRY RUN (no changes will be made)' : 'LIVE'}`);
    console.log('');

    // Check file exists
    if (!fs.existsSync(csvPath)) {
      throw new Error(`File not found: ${csvPath}`);
    }

    // Load reference data
    await this.loadReferenceData();

    // Parse CSV
    console.log('\nParsing CSV...');
    const content = fs.readFileSync(csvPath, 'utf-8');
    const records = this.parseCSV(content);
    console.log(`Found ${records.length} records to import`);

    // Import records
    console.log('\nImporting records:');
    this.stats.total = records.length;

    for (let i = 0; i < records.length; i++) {
      await this.importRecord(records[i], i + 1);
    }

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('IMPORT SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total records: ${this.stats.total}`);
    console.log(`Created: ${this.stats.created}`);
    console.log(`Skipped (duplicates): ${this.stats.skipped}`);
    console.log(`Errors: ${this.stats.errors}`);
    if (this.stats.jobsCreated > 0) {
      console.log(`Jobs created: ${this.stats.jobsCreated}`);
    }
    if (this.stats.vendorsCreated > 0) {
      console.log(`Vendors created: ${this.stats.vendorsCreated}`);
    }
    console.log('');

    if (this.dryRun) {
      console.log('This was a DRY RUN. No changes were made.');
      console.log('Run without --dry-run to import for real.');
    }
  }
}

// Main
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
Buildertrend PO Import Script

Usage:
  node scripts/import-buildertrend-pos.js <csv-file> [--dry-run]

Arguments:
  csv-file    Path to the Buildertrend PO export CSV file
  --dry-run   Preview import without making changes

Example:
  node scripts/import-buildertrend-pos.js exports/buildertrend-pos.csv --dry-run
  node scripts/import-buildertrend-pos.js exports/buildertrend-pos.csv
`);
    process.exit(0);
  }

  const csvPath = args.find(a => !a.startsWith('--'));
  const dryRun = args.includes('--dry-run');

  if (!csvPath) {
    console.error('Error: Please provide a CSV file path');
    process.exit(1);
  }

  const importer = new BuildertrendImporter({ dryRun });

  try {
    await importer.run(csvPath);
  } catch (err) {
    console.error('\nError:', err.message);
    process.exit(1);
  }
}

main();

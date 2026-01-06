/**
 * Database Setup & Seed Script
 * Run this to create tables and seed test data
 * Usage: node database/seed.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function seed() {
  console.log('Setting up Ross Built CMS v2...\n');

  // Create tables using raw SQL (run in Supabase console if this fails)
  console.log('Note: Tables should be created in Supabase SQL Editor using database/schema.sql');
  console.log('Checking if tables exist...\n');

  // Test if tables exist
  const { data: testJobs, error: jobsError } = await supabase
    .from('v2_jobs')
    .select('id')
    .limit(1);

  if (jobsError && jobsError.code === '42P01') {
    console.log('Tables do not exist! Please run database/schema.sql in Supabase SQL Editor first.');
    console.log('\nOpen Supabase Dashboard > SQL Editor > New Query > Paste schema.sql > Run');
    process.exit(1);
  }

  console.log('Tables exist. Seeding data...\n');

  // ============================================================
  // CLEAR EXISTING DATA
  // ============================================================
  console.log('Clearing existing test data...');
  await supabase.from('v2_draw_invoices').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('v2_draw_line_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('v2_draws').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('v2_invoice_allocations').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('v2_invoices').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('v2_budget_lines').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('v2_vendors').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('v2_cost_codes').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('v2_jobs').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  // ============================================================
  // CREATE TEST JOB
  // ============================================================
  console.log('Creating test job...');
  const { data: job, error: jobError } = await supabase
    .from('v2_jobs')
    .insert({
      name: 'Test Project - 123 Main St',
      address: '123 Main Street, Miami, FL 33139',
      client_name: 'John Smith',
      contract_amount: 850000,
      status: 'active'
    })
    .select()
    .single();

  if (jobError) {
    console.error('Failed to create job:', jobError);
    process.exit(1);
  }
  console.log(`  Created: ${job.name}`);

  // ============================================================
  // CREATE VENDORS
  // ============================================================
  console.log('\nCreating vendors...');
  const vendors = [
    { name: 'Florida Sunshine Carpentry', email: 'info@flsunshine.com', phone: '305-555-0101' },
    { name: 'ML Concrete LLC', email: 'mike@mlconcrete.com', phone: '305-555-0102' },
    { name: 'CoatRite Waterproofing', email: 'sales@coatrite.com', phone: '305-555-0103' },
    { name: 'Loftin Plumbing', email: 'service@loftinplumbing.com', phone: '305-555-0104' }
  ];

  const { data: createdVendors, error: vendorError } = await supabase
    .from('v2_vendors')
    .insert(vendors)
    .select();

  if (vendorError) {
    console.error('Failed to create vendors:', vendorError);
    process.exit(1);
  }
  createdVendors.forEach(v => console.log(`  Created: ${v.name}`));

  // ============================================================
  // CREATE COST CODES
  // ============================================================
  console.log('\nCreating cost codes...');
  const costCodes = [
    { code: '01100', name: 'General Conditions', category: 'General' },
    { code: '02100', name: 'Site Work', category: 'Site' },
    { code: '03100', name: 'Concrete', category: 'Concrete' },
    { code: '03122', name: 'Contractor Fee', category: 'General' },
    { code: '06100', name: 'Rough Carpentry', category: 'Carpentry' },
    { code: '06200', name: 'Finish Carpentry', category: 'Carpentry' },
    { code: '07100', name: 'Waterproofing', category: 'Moisture Protection' },
    { code: '07200', name: 'Roofing', category: 'Moisture Protection' },
    { code: '15100', name: 'Plumbing', category: 'Mechanical' },
    { code: '15200', name: 'HVAC', category: 'Mechanical' },
    { code: '16100', name: 'Electrical', category: 'Electrical' },
    { code: '09100', name: 'Drywall', category: 'Finishes' },
    { code: '09200', name: 'Painting', category: 'Finishes' },
    { code: '09300', name: 'Flooring', category: 'Finishes' }
  ];

  const { data: createdCostCodes, error: ccError } = await supabase
    .from('v2_cost_codes')
    .insert(costCodes)
    .select();

  if (ccError) {
    console.error('Failed to create cost codes:', ccError);
    process.exit(1);
  }
  console.log(`  Created ${createdCostCodes.length} cost codes`);

  // ============================================================
  // CREATE BUDGET LINES
  // ============================================================
  console.log('\nCreating budget lines...');
  const budgetAmounts = {
    '01100': 25000,
    '02100': 35000,
    '03100': 85000,
    '03122': 125000,
    '06100': 95000,
    '06200': 45000,
    '07100': 28000,
    '07200': 55000,
    '15100': 65000,
    '15200': 48000,
    '16100': 72000,
    '09100': 38000,
    '09200': 32000,
    '09300': 45000
  };

  const budgetLines = createdCostCodes.map(cc => ({
    job_id: job.id,
    cost_code_id: cc.id,
    budgeted_amount: budgetAmounts[cc.code] || 10000
  }));

  const { error: budgetError } = await supabase
    .from('v2_budget_lines')
    .insert(budgetLines);

  if (budgetError) {
    console.error('Failed to create budget lines:', budgetError);
    process.exit(1);
  }
  console.log(`  Created ${budgetLines.length} budget lines`);

  // ============================================================
  // CREATE SAMPLE INVOICES
  // ============================================================
  console.log('\nCreating sample invoices...');

  const vendorMap = {};
  createdVendors.forEach(v => vendorMap[v.name] = v.id);

  const codeMap = {};
  createdCostCodes.forEach(cc => codeMap[cc.code] = cc.id);

  const invoices = [
    // Pending invoices (need review)
    {
      job_id: job.id,
      vendor_id: vendorMap['Florida Sunshine Carpentry'],
      invoice_number: 'FSC-2025-001',
      invoice_date: '2025-01-02',
      due_date: '2025-02-01',
      amount: 12500,
      status: 'pending',
      notes: 'Rough framing - Level 1'
    },
    {
      job_id: job.id,
      vendor_id: vendorMap['Loftin Plumbing'],
      invoice_number: 'LP-4521',
      invoice_date: '2025-01-03',
      due_date: '2025-02-02',
      amount: 8750,
      status: 'pending',
      notes: 'Plumbing rough-in progress'
    },
    // Approved invoices (ready for draw)
    {
      job_id: job.id,
      vendor_id: vendorMap['ML Concrete LLC'],
      invoice_number: 'MLC-892',
      invoice_date: '2024-12-15',
      due_date: '2025-01-14',
      amount: 42500,
      status: 'pm_approved',
      approved_at: '2024-12-18',
      approved_by: 'Jake Ross',
      notes: 'Foundation pour complete'
    },
    {
      job_id: job.id,
      vendor_id: vendorMap['CoatRite Waterproofing'],
      invoice_number: 'CR-2024-156',
      invoice_date: '2024-12-20',
      due_date: '2025-01-19',
      amount: 14000,
      status: 'pm_approved',
      approved_at: '2024-12-22',
      approved_by: 'Jake Ross',
      notes: 'Foundation waterproofing'
    },
    // Paid invoices
    {
      job_id: job.id,
      vendor_id: vendorMap['ML Concrete LLC'],
      invoice_number: 'MLC-845',
      invoice_date: '2024-11-01',
      due_date: '2024-12-01',
      amount: 28000,
      status: 'paid',
      approved_at: '2024-11-05',
      approved_by: 'Jake Ross',
      notes: 'Site prep and footings'
    }
  ];

  const { data: createdInvoices, error: invError } = await supabase
    .from('v2_invoices')
    .insert(invoices)
    .select();

  if (invError) {
    console.error('Failed to create invoices:', invError);
    process.exit(1);
  }
  createdInvoices.forEach(inv => console.log(`  Created: ${inv.invoice_number} - $${inv.amount} (${inv.status})`));

  // ============================================================
  // CREATE ALLOCATIONS FOR APPROVED/PAID INVOICES
  // ============================================================
  console.log('\nCreating invoice allocations...');

  const allocations = [];

  // Find invoices by invoice_number
  const mclFoundation = createdInvoices.find(i => i.invoice_number === 'MLC-892');
  const coatrite = createdInvoices.find(i => i.invoice_number === 'CR-2024-156');
  const mclFootings = createdInvoices.find(i => i.invoice_number === 'MLC-845');

  if (mclFoundation) {
    allocations.push({ invoice_id: mclFoundation.id, cost_code_id: codeMap['03100'], amount: 42500 });
  }
  if (coatrite) {
    allocations.push({ invoice_id: coatrite.id, cost_code_id: codeMap['07100'], amount: 14000 });
  }
  if (mclFootings) {
    allocations.push({ invoice_id: mclFootings.id, cost_code_id: codeMap['03100'], amount: 28000 });
  }

  if (allocations.length > 0) {
    const { error: allocError } = await supabase
      .from('v2_invoice_allocations')
      .insert(allocations);

    if (allocError) {
      console.error('Failed to create allocations:', allocError);
    } else {
      console.log(`  Created ${allocations.length} allocations`);
    }
  }

  // ============================================================
  // DONE
  // ============================================================
  console.log('\n' + '='.repeat(50));
  console.log('SEED COMPLETE');
  console.log('='.repeat(50));
  console.log(`\nTest Job: ${job.name}`);
  console.log(`  - ${createdVendors.length} vendors`);
  console.log(`  - ${createdCostCodes.length} cost codes`);
  console.log(`  - ${budgetLines.length} budget lines`);
  console.log(`  - ${createdInvoices.length} invoices`);
  console.log('\nRun: npm start');
  console.log('Then open: http://localhost:3001');
}

seed().catch(console.error);

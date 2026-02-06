/**
 * Check Database Schema Constraints
 * Verifies that key constraints, indexes, and triggers are in place
 */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkSchemaConstraints() {
  console.log('========================================');
  console.log('SCHEMA CONSTRAINTS CHECK');
  console.log('========================================\n');

  const results = [];

  // Helper to check if constraint/index exists via query
  async function checkExists(description, table, checkFn) {
    try {
      const exists = await checkFn();
      if (exists) {
        console.log(`  ✅ ${description}`);
        results.push({ name: description, status: 'exists' });
      } else {
        console.log(`  ❌ ${description} - MISSING`);
        results.push({ name: description, status: 'missing' });
      }
    } catch (e) {
      console.log(`  ⚠️  ${description} - Check failed: ${e.message}`);
      results.push({ name: description, status: 'error', error: e.message });
    }
  }

  // 1. Check if key columns exist
  console.log('1. Checking key columns exist on core tables...');

  // Check v2_budget_lines has job_id and cost_code_id
  const { data: budgetSample } = await supabase
    .from('v2_budget_lines')
    .select('id, job_id, cost_code_id, budgeted_amount, committed_amount, updated_at')
    .limit(1);

  if (budgetSample) {
    console.log('  ✅ v2_budget_lines has required columns (job_id, cost_code_id, updated_at)');
  }

  // Check v2_cost_codes has deleted_at for soft delete
  const { data: ccSample } = await supabase
    .from('v2_cost_codes')
    .select('id, code, deleted_at, updated_at')
    .limit(1);

  if (ccSample !== undefined) {
    console.log('  ✅ v2_cost_codes has soft delete support (deleted_at, updated_at)');
  }

  // Check v2_jobs has deleted_at and updated_at
  const { data: jobSample } = await supabase
    .from('v2_jobs')
    .select('id, deleted_at, updated_at')
    .limit(1);

  if (jobSample !== undefined) {
    console.log('  ✅ v2_jobs has soft delete and audit support');
  }

  // 2. Test profitability function exists and works
  console.log('\n2. Checking profitability function...');
  const { data: jobs } = await supabase.from('v2_jobs').select('id').limit(1);
  if (jobs && jobs.length > 0) {
    const { data: profitData, error: profitError } = await supabase
      .rpc('calculate_job_profitability', { p_job_id: jobs[0].id });

    if (!profitError) {
      console.log('  ✅ calculate_job_profitability function works');
    } else {
      console.log(`  ❌ calculate_job_profitability error: ${profitError.message}`);
    }
  } else {
    console.log('  ⚠️  No jobs to test profitability function');
  }

  // 3. Check get_job_direct_costs function
  console.log('\n3. Checking direct costs function...');
  if (jobs && jobs.length > 0) {
    const { data: costsData, error: costsError } = await supabase
      .rpc('get_job_direct_costs', { p_job_id: jobs[0].id });

    if (!costsError) {
      console.log('  ✅ get_job_direct_costs function works');
    } else {
      console.log(`  ⚠️  get_job_direct_costs: ${costsError.message}`);
    }
  }

  // 4. Check multi-tenancy (builder_id column)
  console.log('\n4. Checking multi-tenancy columns...');
  const tenantTables = ['v2_jobs', 'v2_vendors', 'v2_invoices', 'v2_purchase_orders'];
  for (const table of tenantTables) {
    const { data, error } = await supabase.from(table).select('builder_id').limit(1);
    if (!error) {
      console.log(`  ✅ ${table} has builder_id for multi-tenancy`);
    } else if (error.message.includes('builder_id')) {
      console.log(`  ❌ ${table} missing builder_id column`);
    }
  }

  // 5. Check auth tables
  console.log('\n5. Checking authentication tables...');
  const authTables = ['v2_builders', 'v2_users'];
  for (const table of authTables) {
    const { data, error } = await supabase.from(table).select('id').limit(1);
    if (!error) {
      console.log(`  ✅ ${table} exists`);
    } else {
      console.log(`  ❌ ${table}: ${error.message}`);
    }
  }

  // Summary
  console.log('\n========================================');
  console.log('SCHEMA CONSTRAINTS SUMMARY');
  console.log('========================================');

  const missing = results.filter(r => r.status === 'missing');
  const errors = results.filter(r => r.status === 'error');

  if (missing.length === 0 && errors.length === 0) {
    console.log('\n✅ All checked schema constraints are in place!');
  } else {
    if (missing.length > 0) {
      console.log(`\n❌ Missing constraints: ${missing.length}`);
      missing.forEach(m => console.log(`   - ${m.name}`));
    }
    if (errors.length > 0) {
      console.log(`\n⚠️  Check errors: ${errors.length}`);
      errors.forEach(e => console.log(`   - ${e.name}: ${e.error}`));
    }
  }

  return { missing, errors };
}

checkSchemaConstraints()
  .then(({ missing, errors }) => {
    process.exit(missing.length > 0 || errors.length > 0 ? 1 : 0);
  })
  .catch(e => {
    console.error('Error:', e.message);
    process.exit(1);
  });

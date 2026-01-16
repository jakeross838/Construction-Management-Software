const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const { reconcileAll } = require('../server/reconciliation');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  console.log('Running reconciliation...\n');
  const results = await reconcileAll(supabase);

  console.log('=== RECONCILIATION SUMMARY ===');
  console.log(`Jobs checked: ${results.jobs_checked}`);
  console.log(`Total errors: ${results.summary.total_errors}`);
  console.log(`Total warnings: ${results.summary.total_warnings}`);
  console.log(`Jobs with issues: ${results.summary.jobs_with_issues}`);

  for (const jobResult of results.results) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`JOB: ${jobResult.job_name}`);
    console.log(`Passed: ${jobResult.summary.passed}, Failed: ${jobResult.summary.failed}, Warnings: ${jobResult.summary.warnings}`);

    if (jobResult.errors.length > 0) {
      console.log('\nERRORS:');
      for (const err of jobResult.errors) {
        console.log(`  - [${err.type}] ${err.message}`);
        if (err.expected !== undefined) {
          console.log(`    Expected: $${err.expected?.toFixed?.(2) || err.expected}, Actual: $${err.actual?.toFixed?.(2) || err.actual}`);
        }
      }
    }

    if (jobResult.warnings.length > 0) {
      console.log('\nWARNINGS:');
      for (const warn of jobResult.warnings) {
        console.log(`  - [${warn.type}] ${warn.message}`);
      }
    }
  }
}

run().catch(console.error);

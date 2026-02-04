const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkTables() {
  console.log('Checking database tables...\n');

  // List all tables using information_schema
  const { data, error } = await supabase
    .from('v2_jobs')
    .select('id')
    .limit(1);

  if (error) {
    console.log('Connection error:', error.message);
    return;
  }

  console.log('Connected successfully!');
  console.log('Jobs table accessible:', data ? 'yes' : 'no');

  // Check each contract-related table
  const tables = [
    'v2_contract_templates',
    'v2_contract_clauses',
    'v2_contract_documents',
    'v2_contract_pricing_terms',
    'v2_contract_variable_sources',
    'v2_contracts'
  ];

  console.log('\nChecking contract tables:');
  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('id').limit(1);
    if (error) {
      console.log(`  ${table}: NOT FOUND - ${error.message}`);
    } else {
      console.log(`  ${table}: EXISTS (${data?.length || 0} sample rows)`);
    }
  }
}

checkTables().catch(e => console.error('Error:', e.message));

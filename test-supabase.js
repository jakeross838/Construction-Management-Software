const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  // Test connection
  const { data, error } = await supabase.from('v2_jobs').select('id').limit(1);
  if (error) {
    console.log('Error:', error.message);
  } else {
    console.log('Connected! Found jobs:', data?.length || 0);
  }

  // Check if tables exist
  const { data: templates, error: tErr } = await supabase.from('v2_contract_templates').select('id').limit(1);
  console.log('Templates table:', tErr ? 'does not exist - ' + tErr.message : 'exists');

  const { data: clauses, error: cErr } = await supabase.from('v2_contract_clauses').select('id').limit(1);
  console.log('Clauses table:', cErr ? 'does not exist - ' + cErr.message : 'exists');
}

run().catch(e => console.error('Error:', e.message));

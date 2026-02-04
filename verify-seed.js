const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verify() {
  console.log('Verifying seeded data...\n');

  // Check clauses
  const { data: clauses, error: cErr } = await supabase.from('v2_contract_clauses').select('id, name, category');
  console.log(`Contract Clauses: ${clauses?.length || 0} rows`);
  if (clauses?.length > 0) {
    clauses.forEach(c => console.log(`  - ${c.name} (${c.category})`));
  }

  // Check variable sources
  const { data: vars, error: vErr } = await supabase.from('v2_contract_variable_sources').select('variable_name, display_label');
  console.log(`\nVariable Sources: ${vars?.length || 0} rows`);
  if (vars?.length > 0) {
    vars.slice(0, 10).forEach(v => console.log(`  - ${v.variable_name}: ${v.display_label}`));
    if (vars.length > 10) console.log(`  ... and ${vars.length - 10} more`);
  }

  // Check templates
  const { data: templates, error: tErr } = await supabase.from('v2_contract_templates').select('id, name, template_type, is_default');
  console.log(`\nContract Templates: ${templates?.length || 0} rows`);
  if (templates?.length > 0) {
    templates.forEach(t => console.log(`  - ${t.name} (${t.template_type}) ${t.is_default ? '[DEFAULT]' : ''}`));
  }

  console.log('\n✅ Verification complete!');
}

verify().catch(e => console.error('Error:', e.message));

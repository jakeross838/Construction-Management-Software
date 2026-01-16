const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function listCodes() {
  const { data: codes } = await supabase
    .from('v2_cost_codes')
    .select('code, name, category')
    .order('code');

  // Group by category
  const byCategory = {};
  for (const c of codes || []) {
    if (!byCategory[c.category]) byCategory[c.category] = [];
    byCategory[c.category].push(c);
  }

  // Print grouped
  for (const [cat, items] of Object.entries(byCategory).sort()) {
    console.log(`\n=== ${cat} ===`);
    for (const c of items) {
      console.log(`  ${c.code}: ${c.name}`);
    }
  }

  // Check if specific codes exist
  const checkCodes = ['01100', '02100', '07100', '09200', '27101', '26107', '06101'];
  console.log('\n=== Code Existence Check ===');
  for (const code of checkCodes) {
    const found = codes?.find(c => c.code === code);
    console.log(`${code}: ${found ? found.name : 'NOT FOUND'}`);
  }
}

listCodes().catch(console.error);

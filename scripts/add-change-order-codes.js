/**
 * Add Change Order Cost Codes
 *
 * Creates a change order variant (with 'C' suffix) for every existing cost code.
 * Example: 10101 "Framing Labor" -> 10101C "Framing Labor - CO"
 *
 * Usage: node scripts/add-change-order-codes.js [--dry-run]
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function addChangeOrderCodes() {
  const dryRun = process.argv.includes('--dry-run');

  console.log('='.repeat(60));
  console.log('ADD CHANGE ORDER COST CODES');
  console.log('='.repeat(60));
  console.log('Mode:', dryRun ? 'DRY RUN (no changes)' : 'LIVE');
  console.log('');

  // Fetch all existing cost codes
  console.log('Fetching existing cost codes...');
  const { data: existingCodes, error: fetchError } = await supabase
    .from('v2_cost_codes')
    .select('id, code, name, category')
    .order('code');

  if (fetchError) {
    console.error('Error fetching cost codes:', fetchError);
    process.exit(1);
  }

  console.log(`Found ${existingCodes.length} existing cost codes\n`);

  // Separate base codes from CO codes
  const baseCodes = existingCodes.filter(cc => !cc.code.endsWith('C'));
  const existingCOCodes = existingCodes.filter(cc => cc.code.endsWith('C'));

  console.log(`Base codes (without C): ${baseCodes.length}`);
  console.log(`Existing CO codes (with C): ${existingCOCodes.length}\n`);

  // Build set of existing CO codes
  const existingCOSet = new Set(existingCOCodes.map(cc => cc.code));

  // Create CO variants for base codes that don't have one
  const toInsert = [];
  for (const cc of baseCodes) {
    const coCode = cc.code + 'C';
    if (!existingCOSet.has(coCode)) {
      toInsert.push({
        code: coCode,
        name: cc.name + ' - CO',
        category: cc.category
      });
    }
  }

  console.log(`Change Order codes to create: ${toInsert.length}\n`);

  if (toInsert.length === 0) {
    console.log('All change order codes already exist!');
    return;
  }

  if (dryRun) {
    console.log('DRY RUN - Would create these codes:');
    toInsert.slice(0, 30).forEach(cc => {
      console.log(`  ${cc.code} | ${cc.name} | ${cc.category}`);
    });
    if (toInsert.length > 30) {
      console.log(`  ... and ${toInsert.length - 30} more`);
    }
    console.log('\nRun without --dry-run to insert into database');
    return;
  }

  // Insert in batches of 50
  console.log('Inserting change order codes...');
  const batchSize = 50;
  let inserted = 0;

  for (let i = 0; i < toInsert.length; i += batchSize) {
    const batch = toInsert.slice(i, i + batchSize);
    const { error: insertError } = await supabase
      .from('v2_cost_codes')
      .insert(batch);

    if (insertError) {
      console.error(`Error inserting batch ${i / batchSize + 1}:`, insertError);
      process.exit(1);
    }

    inserted += batch.length;
    console.log(`  Inserted ${inserted}/${toInsert.length}`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('COMPLETE');
  console.log('='.repeat(60));
  console.log(`Created ${inserted} change order cost codes`);

  // Show sample
  console.log('\nSample of new codes:');
  toInsert.slice(0, 10).forEach(cc => {
    console.log(`  ${cc.code} | ${cc.name}`);
  });
}

addChangeOrderCodes().catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});

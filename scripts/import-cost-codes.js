/**
 * Import cost codes from Buildertrend Excel file
 *
 * Usage: node scripts/import-cost-codes.js [--dry-run]
 */

const XLSX = require('xlsx');
const { supabase } = require('../config');

// Network path to cost codes Excel
const COST_CODES_FILE = '\\\\RB2019\\RedirectedFolders\\Jake\\Desktop\\BT - Cost Code Budget Import.xls';

// Category mapping based on code prefix
const CATEGORY_MAP = {
  '01': 'Design & Pre-Construction',
  '02': 'Permits & Fees',
  '03': 'Project Administration',
  '04': 'Site Work',
  '05': 'Concrete & Masonry',
  '06': 'Framing & Carpentry',
  '07': 'Moisture Protection',
  '08': 'Doors & Windows',
  '09': 'Finishes',
  '10': 'Specialties',
  '11': 'Equipment',
  '12': 'Furnishings',
  '13': 'Special Construction',
  '14': 'Conveying Systems',
  '15': 'Mechanical',
  '16': 'Electrical',
  '17': 'Communications',
  '18': 'Low Voltage',
  '19': 'Other',
  '20': 'Site Improvements'
};

function getCategory(code) {
  const prefix = code.substring(0, 2);
  return CATEGORY_MAP[prefix] || 'Uncategorized';
}

async function importCostCodes() {
  const dryRun = process.argv.includes('--dry-run');

  console.log('='.repeat(60));
  console.log('COST CODES IMPORT');
  console.log('='.repeat(60));
  console.log('Mode:', dryRun ? 'DRY RUN (no changes)' : 'LIVE');
  console.log('');

  console.log('Reading cost codes from:', COST_CODES_FILE);
  const workbook = XLSX.readFile(COST_CODES_FILE);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  // Parse cost codes
  const costCodes = [];
  for (const row of data) {
    if (!row[0] || !row[1]) continue;

    const code = String(row[0]).trim();
    const name = String(row[1]).trim();

    // Skip header rows or invalid codes
    if (!/^\d{5}$/.test(code)) {
      console.log(`  Skipping invalid code: "${code}" - "${name}"`);
      continue;
    }

    costCodes.push({
      code,
      name,
      category: getCategory(code)
    });
  }

  console.log(`\nParsed ${costCodes.length} valid cost codes\n`);

  // Group by category for display
  const byCategory = {};
  for (const cc of costCodes) {
    if (!byCategory[cc.category]) byCategory[cc.category] = [];
    byCategory[cc.category].push(cc);
  }

  console.log('Cost codes by category:');
  for (const [cat, codes] of Object.entries(byCategory).sort()) {
    console.log(`  ${cat}: ${codes.length} codes`);
  }

  if (dryRun) {
    console.log('\nDRY RUN - Showing first 20 codes:');
    costCodes.slice(0, 20).forEach(cc => {
      console.log(`  ${cc.code} | ${cc.name} | ${cc.category}`);
    });
    console.log('\nRun without --dry-run to import to database');
    return;
  }

  // Get existing codes
  console.log('\nFetching existing cost codes from database...');
  const { data: existing, error: fetchError } = await supabase
    .from('v2_cost_codes')
    .select('id, code, name, category');

  if (fetchError) {
    console.error('Error fetching existing codes:', fetchError);
    process.exit(1);
  }

  const existingByCode = {};
  for (const cc of (existing || [])) {
    existingByCode[cc.code] = cc;
  }
  console.log(`  Found ${Object.keys(existingByCode).length} existing codes`);

  // Categorize changes
  const toInsert = [];
  const toUpdate = [];
  const unchanged = [];

  for (const cc of costCodes) {
    const existing = existingByCode[cc.code];
    if (!existing) {
      toInsert.push(cc);
    } else if (existing.name !== cc.name || existing.category !== cc.category) {
      toUpdate.push({ ...cc, id: existing.id });
    } else {
      unchanged.push(cc);
    }
  }

  console.log(`\nChanges:`);
  console.log(`  New codes to insert: ${toInsert.length}`);
  console.log(`  Existing codes to update: ${toUpdate.length}`);
  console.log(`  Unchanged: ${unchanged.length}`);

  // Insert new codes
  if (toInsert.length > 0) {
    console.log('\nInserting new cost codes...');
    const { error: insertError } = await supabase
      .from('v2_cost_codes')
      .insert(toInsert);

    if (insertError) {
      console.error('Error inserting codes:', insertError);
      process.exit(1);
    }
    console.log(`  Inserted ${toInsert.length} new codes`);
  }

  // Update existing codes
  if (toUpdate.length > 0) {
    console.log('\nUpdating existing codes...');
    for (const cc of toUpdate) {
      const { error: updateError } = await supabase
        .from('v2_cost_codes')
        .update({ name: cc.name, category: cc.category })
        .eq('id', cc.id);

      if (updateError) {
        console.error(`Error updating ${cc.code}:`, updateError);
      }
    }
    console.log(`  Updated ${toUpdate.length} codes`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('IMPORT COMPLETE');
  console.log('='.repeat(60));
  console.log(`Total codes in database: ${costCodes.length + unchanged.length}`);
}

importCostCodes().catch(err => {
  console.error('Import failed:', err);
  process.exit(1);
});

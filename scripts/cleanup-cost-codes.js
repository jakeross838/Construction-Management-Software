/**
 * Clean up cost codes - remove any not in the import file
 */

const XLSX = require('xlsx');
const { supabase } = require('../config');

const COST_CODES_FILE = '\\\\RB2019\\RedirectedFolders\\Jake\\Desktop\\BT - Cost Code Budget Import.xls';

async function cleanup() {
  // Get imported codes from Excel
  console.log('Reading Excel file...');
  const workbook = XLSX.readFile(COST_CODES_FILE);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  const importedCodes = new Set();
  for (const row of data) {
    if (row[0] && /^\d{5}$/.test(String(row[0]).trim())) {
      importedCodes.add(String(row[0]).trim());
    }
  }
  console.log('Codes in Excel file:', importedCodes.size);

  // Get all from database
  const { data: dbCodes } = await supabase.from('v2_cost_codes').select('id, code, name');
  console.log('Codes in database:', dbCodes.length);

  const toRemove = dbCodes.filter(cc => !importedCodes.has(cc.code));
  console.log('Codes NOT in Excel (to remove):', toRemove.length);

  if (toRemove.length > 0) {
    console.log('\nRemoving these codes:');
    toRemove.forEach(cc => console.log('  ' + cc.code + ' - ' + cc.name));

    // Delete them
    const { error } = await supabase
      .from('v2_cost_codes')
      .delete()
      .in('id', toRemove.map(cc => cc.id));

    if (error) {
      console.error('Delete error:', error);
    } else {
      console.log('\nRemoved ' + toRemove.length + ' codes');
    }
  } else {
    console.log('\nNo codes to remove - database matches Excel file');
  }
}

cleanup().catch(console.error);

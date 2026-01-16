const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Same mapping as migrate script
const codeMapping = {
  '01100': null,        // General Conditions - no direct equivalent
  '02100': '06101',     // Site Work -> Clearing and Grubbing
  '03100': '08101',     // Concrete -> Concrete (Foundation)
  '06100': '10101',     // Rough Carpentry -> Framing Labor
  '06200': '25102',     // Finish Carpentry -> Interior Trim
  '07100': '26107',     // Waterproofing -> Deck Waterproofing
  '07200': '17101',     // Roofing -> Roofing
  '15100': '12101',     // Plumbing -> Plumbing Labor
  '15200': '14101',     // HVAC -> HVAC System
  '16100': '13101',     // Electrical -> Electrical Labor
  '09100': '19101',     // Drywall -> Drywall
  '09200': '27101',     // Painting -> Painting
  '09300': '23102'      // Flooring -> Flooring Labor
};

async function fixDrawAllocations() {
  // Get old code IDs
  const oldCodes = Object.keys(codeMapping);
  const { data: oldCodesData } = await supabase
    .from('v2_cost_codes')
    .select('id, code')
    .in('code', oldCodes);

  if (!oldCodesData || oldCodesData.length === 0) {
    console.log('No old codes found in database');
    return;
  }

  const oldCodeIdMap = new Map(oldCodesData.map(c => [c.code, c.id]));
  const oldIdToCode = new Map(oldCodesData.map(c => [c.id, c.code]));
  console.log('Found', oldCodesData.length, 'old codes still in DB:', oldCodesData.map(c => c.code));

  // Get new code IDs
  const newCodes = Object.values(codeMapping).filter(Boolean);
  const { data: newCodesData } = await supabase
    .from('v2_cost_codes')
    .select('id, code')
    .in('code', newCodes);

  const newCodeIdMap = new Map(newCodesData.map(c => [c.code, c.id]));

  // Check all tables for remaining references
  const oldIds = [...oldCodeIdMap.values()];

  // Draw allocations
  const { data: drawAllocs } = await supabase
    .from('v2_draw_allocations')
    .select('id, cost_code_id, amount')
    .in('cost_code_id', oldIds);

  console.log('Draw allocations with old codes:', drawAllocs?.length || 0);

  // Update draw allocations
  for (const alloc of (drawAllocs || [])) {
    const oldCode = oldIdToCode.get(alloc.cost_code_id);
    const newCode = codeMapping[oldCode];

    if (newCode) {
      const newId = newCodeIdMap.get(newCode);
      if (newId) {
        const { error } = await supabase
          .from('v2_draw_allocations')
          .update({ cost_code_id: newId })
          .eq('id', alloc.id);

        if (error) {
          console.error('Error updating draw allocation:', error.message);
        } else {
          console.log('Updated draw allocation', alloc.id, 'from', oldCode, 'to', newCode);
        }
      }
    } else {
      // No mapping - need to delete or assign to a default
      console.log('Draw allocation', alloc.id, 'has unmapped code', oldCode, '- deleting');
      const { error } = await supabase
        .from('v2_draw_allocations')
        .delete()
        .eq('id', alloc.id);
      if (error) console.error('Error deleting:', error.message);
    }
  }

  // Now try to delete old codes again
  console.log('\nAttempting to delete old codes...');
  const { error } = await supabase.from('v2_cost_codes').delete().in('id', oldIds);
  if (error) {
    console.error('Delete error:', error.message);

    // Check what's still referencing
    console.log('\nChecking remaining references...');
    for (const table of ['v2_invoice_allocations', 'v2_po_line_items', 'v2_budget_lines', 'v2_draw_allocations']) {
      const { data } = await supabase.from(table).select('id, cost_code_id').in('cost_code_id', oldIds);
      if (data && data.length > 0) {
        console.log(table, 'still has', data.length, 'references');
      }
    }
  } else {
    console.log('Successfully deleted', oldIds.length, 'old codes');
  }

  // Final count
  const { data: finalCodes } = await supabase.from('v2_cost_codes').select('id');
  console.log('Final cost codes count:', finalCodes?.length);
}

fixDrawAllocations().catch(console.error);

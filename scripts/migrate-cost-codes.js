const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Mapping old codes to new codes from Excel
const codeMapping = {
  '01100': null,        // General Conditions - no direct equivalent
  '02100': '06101',     // Site Work -> Clearing and Grubbing (Site Work category)
  '03100': '08101',     // Concrete -> Concrete (Foundation)
  '06100': '10101',     // Rough Carpentry -> Framing Labor & General Carpentry
  '06200': '25102',     // Finish Carpentry -> Interior Trim and Door Labor
  '07100': '26107',     // Waterproofing -> Deck Waterproofing
  '07200': '17101',     // Roofing -> Roofing
  '15100': '12101',     // Plumbing -> Plumbing Labor
  '15200': '14101',     // HVAC -> HVAC System and Ducting
  '16100': '13101',     // Electrical -> Electrical Labor
  '09100': '19101',     // Drywall -> Drywall
  '09200': '27101',     // Painting -> Painting
  '09300': '23102'      // Flooring -> Flooring Labor
};

async function migrateAllocations() {
  // Get old code IDs
  const { data: oldCodes } = await supabase
    .from('v2_cost_codes')
    .select('id, code')
    .in('code', Object.keys(codeMapping));

  const oldCodeIdMap = new Map(oldCodes?.map(c => [c.code, c.id]) || []);
  console.log('Found old codes:', oldCodeIdMap.size);

  // Get new code IDs
  const newCodes = Object.values(codeMapping).filter(Boolean);
  const { data: newCodesData } = await supabase
    .from('v2_cost_codes')
    .select('id, code')
    .in('code', newCodes);

  const newCodeIdMap = new Map(newCodesData?.map(c => [c.code, c.id]) || []);
  console.log('Found new codes:', newCodeIdMap.size);

  // Update allocations
  for (const [oldCode, newCode] of Object.entries(codeMapping)) {
    const oldId = oldCodeIdMap.get(oldCode);
    if (!oldId) continue;

    if (newCode) {
      const newId = newCodeIdMap.get(newCode);
      if (newId) {
        // Update invoice allocations
        const { data: updated1 } = await supabase
          .from('v2_invoice_allocations')
          .update({ cost_code_id: newId })
          .eq('cost_code_id', oldId)
          .select();

        // Update PO line items
        const { data: updated2 } = await supabase
          .from('v2_po_line_items')
          .update({ cost_code_id: newId })
          .eq('cost_code_id', oldId)
          .select();

        // Update budget lines
        const { data: updated3 } = await supabase
          .from('v2_budget_lines')
          .update({ cost_code_id: newId })
          .eq('cost_code_id', oldId)
          .select();

        // Update draw allocations
        const { data: updated4 } = await supabase
          .from('v2_draw_allocations')
          .update({ cost_code_id: newId })
          .eq('cost_code_id', oldId)
          .select();

        const total = (updated1?.length||0) + (updated2?.length||0) + (updated3?.length||0) + (updated4?.length||0);
        if (total > 0) console.log('Migrated', oldCode, '->', newCode, ':', total, 'records');
      }
    }
  }

  // Now delete the old codes
  const oldIds = [...oldCodeIdMap.values()];
  if (oldIds.length > 0) {
    const { error } = await supabase.from('v2_cost_codes').delete().in('id', oldIds);
    if (error) console.error('Delete old codes error:', error.message);
    else console.log('Deleted', oldIds.length, 'old codes');
  }

  // Final count
  const { data: finalCodes } = await supabase.from('v2_cost_codes').select('id');
  console.log('Final cost codes:', finalCodes?.length);
}

migrateAllocations().catch(console.error);

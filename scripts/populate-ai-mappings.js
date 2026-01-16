const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Trade type to cost codes (with priority - lower = primary)
const TRADE_MAPPINGS = {
  electrical: [['13101', 1], ['13102', 2]],
  plumbing: [['12101', 1], ['12102', 2]],
  hvac: [['14101', 1]],
  drywall: [['19101', 1]],
  framing: [['10101', 1], ['10102', 2]],
  carpentry: [['10101', 1], ['25102', 2]],
  roofing: [['17101', 1]],
  painting: [['27101', 1]],
  flooring: [['23102', 1], ['23101', 2]],
  tile: [['24101', 1], ['24102', 2]],
  concrete: [['08101', 1]],
  masonry: [['09101', 1]],
  waterproofing: [['26107', 1]],
  sitework: [['06101', 1], ['06103', 2]],
  landscaping: [['35101', 1]],
  cabinets: [['21101', 1], ['21102', 2]],
  countertops: [['21103', 1]],
  windows_doors: [['11101', 1], ['11102', 2]],
  insulation: [['18101', 1]],
  stucco: [['26112', 1]],
  siding: [['26101', 1], ['26102', 2]],
  pool: [['34101', 1]],
  general: [['03116', 1], ['03121', 2]]
};

// Description keyword to cost code
const DESCRIPTION_MAPPINGS = {
  // Electrical
  'electrical labor': '13101',
  'wiring': '13101',
  'panel': '13101',
  'circuit': '13101',
  'outlet': '13101',
  'switch': '13101',
  'electrical fixture': '13102',
  'light fixture': '13102',
  'lighting': '13102',
  'chandelier': '13102',
  'electrical': '13101',
  // Plumbing
  'plumbing labor': '12101',
  'plumbing rough': '12101',
  'rough-in': '12101',
  'plumbing': '12101',
  'pipe': '12101',
  'drain': '12101',
  'water heater': '12103',
  'plumbing fixture': '12102',
  'faucet': '12102',
  'toilet': '12102',
  'sink': '12102',
  'shower': '12102',
  // HVAC
  'hvac': '14101',
  'air conditioning': '14101',
  'ac unit': '14101',
  'ductwork': '14101',
  'furnace': '14101',
  'thermostat': '14101',
  'heating': '14101',
  'cooling': '14101',
  // Framing/Carpentry
  'framing labor': '10101',
  'framing': '10101',
  'lumber': '10102',
  'studs': '10102',
  'sheathing': '10102',
  'truss': '10105',
  'carpentry': '10101',
  'trim': '25102',
  'molding': '25103',
  'baseboard': '25103',
  'crown': '25103',
  'finish carpentry': '25102',
  // Drywall
  'drywall': '19101',
  'sheetrock': '19101',
  'gypsum': '19101',
  'taping': '19101',
  'mud': '19101',
  // Roofing
  'roofing': '17101',
  'roof': '17101',
  'shingle': '17101',
  'flashing': '17101',
  // Painting
  'painting': '27101',
  'paint': '27101',
  'primer': '27101',
  'stain': '27101',
  'stucco': '26112',
  // Flooring
  'flooring material': '23101',
  'hardwood': '23101',
  'vinyl': '23101',
  'carpet': '24105',
  'flooring labor': '23102',
  'floor installation': '23102',
  'flooring': '23102',
  'lvp': '23101',
  'laminate': '23101',
  // Tile
  'tile labor': '24101',
  'tile installation': '24101',
  'tile material': '24102',
  'grout': '24101',
  'backsplash': '24103',
  'tile': '24101',
  'ceramic': '24102',
  'porcelain': '24102',
  'marble': '24102',
  'travertine': '24102',
  'durarock': '24106',
  // Concrete/Masonry
  'concrete': '08101',
  'slab': '08101',
  'foundation': '08101',
  'rebar': '08101',
  'footing': '08101',
  'masonry': '09101',
  'brick': '09101',
  'block': '09101',
  'stone': '09101',
  // Cabinets/Countertops
  'cabinet': '21101',
  'cabinetry': '21101',
  'cabinet installation': '21102',
  'countertop': '21103',
  'granite': '21103',
  'quartz': '21103',
  // Windows/Doors
  'window': '11101',
  'glass': '11101',
  'door': '25101',
  'entry door': '11102',
  'sliding door': '11101',
  'interior door': '25101',
  'front door': '11104',
  // Insulation
  'insulation': '18101',
  'spray foam': '18101',
  'batt insulation': '18101',
  'waterproofing': '26107',
  // Site Work
  'landscaping': '35101',
  'irrigation': '35101',
  'sod': '35101',
  'sprinkler': '35101',
  'grading': '06103',
  'excavation': '05101',
  'sitework': '06101',
  'clearing': '06101',
  'demolition': '05101',
  // General
  'cleanup': '03116',
  'debris': '03112',
  'dumpster': '03112',
  'permit': '02104',
  'general conditions': '03116',
  'supervision': '03121',
  'mobilization': '03116'
};

async function populate() {
  // Get all cost codes for lookup
  const { data: costCodes } = await supabase
    .from('v2_cost_codes')
    .select('id, code');

  const codeToId = new Map(costCodes.map(c => [c.code, c.id]));
  console.log('Found', costCodes.length, 'cost codes');

  // Clear existing mappings
  await supabase.from('v2_trade_cost_mappings').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('v2_description_cost_mappings').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log('Cleared existing mappings');

  // Insert trade mappings
  const tradeMappings = [];
  for (const [trade, codes] of Object.entries(TRADE_MAPPINGS)) {
    for (const [code, priority] of codes) {
      const costCodeId = codeToId.get(code);
      if (costCodeId) {
        tradeMappings.push({
          trade_type: trade,
          cost_code_id: costCodeId,
          priority: priority
        });
      } else {
        console.warn('Trade mapping - code not found:', code);
      }
    }
  }

  const { error: tradeError } = await supabase
    .from('v2_trade_cost_mappings')
    .insert(tradeMappings);

  if (tradeError) {
    console.error('Trade insert error:', tradeError.message);
  } else {
    console.log('Inserted', tradeMappings.length, 'trade mappings');
  }

  // Insert description mappings
  const descMappings = [];
  for (const [keyword, code] of Object.entries(DESCRIPTION_MAPPINGS)) {
    const costCodeId = codeToId.get(code);
    if (costCodeId) {
      descMappings.push({
        keyword: keyword,
        cost_code_id: costCodeId
      });
    } else {
      console.warn('Description mapping - code not found:', code);
    }
  }

  const { error: descError } = await supabase
    .from('v2_description_cost_mappings')
    .insert(descMappings);

  if (descError) {
    console.error('Description insert error:', descError.message);
  } else {
    console.log('Inserted', descMappings.length, 'description mappings');
  }

  // Verify
  const { data: tradeCount } = await supabase.from('v2_trade_cost_mappings').select('id');
  const { data: descCount } = await supabase.from('v2_description_cost_mappings').select('id');
  console.log('\nFinal counts:');
  console.log('  Trade mappings:', tradeCount?.length);
  console.log('  Description mappings:', descCount?.length);
}

populate().catch(console.error);

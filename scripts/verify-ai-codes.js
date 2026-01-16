const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Import the maps from ai-processor (re-defined here for checking)
const TRADE_COST_CODE_MAP = {
  electrical: ['13101', '13102'],
  plumbing: ['12101', '12102'],
  hvac: ['14101'],
  drywall: ['19101'],
  framing: ['10101', '10102'],
  carpentry: ['10101', '25102'],
  roofing: ['17101'],
  painting: ['27101'],
  flooring: ['23102', '23101'],
  tile: ['24101', '24102'],
  concrete: ['08101'],
  masonry: ['09101'],
  waterproofing: ['26107'],
  sitework: ['06101', '06103'],
  landscaping: ['35101'],
  cabinets: ['21101', '21102'],
  countertops: ['21103'],
  windows_doors: ['11101', '11102'],
  insulation: ['18101'],
  stucco: ['26112'],
  siding: ['26101', '26102'],
  pool: ['34101'],
  general: ['03116', '03121']
};

const DESCRIPTION_COST_CODE_MAP = {
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
  'hvac': '14101',
  'air conditioning': '14101',
  'ac unit': '14101',
  'ductwork': '14101',
  'furnace': '14101',
  'thermostat': '14101',
  'heating': '14101',
  'cooling': '14101',
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
  'drywall': '19101',
  'sheetrock': '19101',
  'gypsum': '19101',
  'taping': '19101',
  'mud': '19101',
  'roofing': '17101',
  'roof': '17101',
  'shingle': '17101',
  'flashing': '17101',
  'painting': '27101',
  'paint': '27101',
  'primer': '27101',
  'stain': '27101',
  'stucco': '26112',
  'flooring material': '23101',
  'hardwood': '23101',
  'vinyl': '23101',
  'carpet': '24105',
  'flooring labor': '23102',
  'floor installation': '23102',
  'flooring': '23102',
  'lvp': '23101',
  'laminate': '23101',
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
  'concrete': '08101',
  'slab': '08101',
  'foundation': '08101',
  'rebar': '08101',
  'footing': '08101',
  'masonry': '09101',
  'brick': '09101',
  'block': '09101',
  'stone': '09101',
  'cabinet': '21101',
  'cabinetry': '21101',
  'cabinet installation': '21102',
  'countertop': '21103',
  'granite': '21103',
  'quartz': '21103',
  'window': '11101',
  'glass': '11101',
  'door': '25101',
  'entry door': '11102',
  'sliding door': '11101',
  'interior door': '25101',
  'front door': '11104',
  'insulation': '18101',
  'spray foam': '18101',
  'batt insulation': '18101',
  'waterproofing': '26107',
  'landscaping': '35101',
  'irrigation': '35101',
  'sod': '35101',
  'sprinkler': '35101',
  'grading': '06103',
  'excavation': '05101',
  'sitework': '06101',
  'clearing': '06101',
  'demolition': '05101',
  'cleanup': '03116',
  'debris': '03112',
  'dumpster': '03112',
  'permit': '02104',
  'general conditions': '03116',
  'supervision': '03121',
  'mobilization': '03116'
};

async function verify() {
  // Get all valid codes
  const { data: validCodes } = await supabase.from('v2_cost_codes').select('code');
  const validSet = new Set(validCodes.map(c => c.code));

  console.log('Total valid codes in DB:', validSet.size);

  // Check TRADE_COST_CODE_MAP
  console.log('\n=== TRADE_COST_CODE_MAP Verification ===');
  let tradeErrors = 0;
  for (const [trade, codes] of Object.entries(TRADE_COST_CODE_MAP)) {
    for (const code of codes) {
      if (!validSet.has(code)) {
        console.log(`INVALID: ${trade} -> ${code}`);
        tradeErrors++;
      }
    }
  }
  console.log(tradeErrors === 0 ? 'All trade codes VALID' : `${tradeErrors} invalid codes found`);

  // Check DESCRIPTION_COST_CODE_MAP
  console.log('\n=== DESCRIPTION_COST_CODE_MAP Verification ===');
  let descErrors = 0;
  for (const [desc, code] of Object.entries(DESCRIPTION_COST_CODE_MAP)) {
    if (!validSet.has(code)) {
      console.log(`INVALID: "${desc}" -> ${code}`);
      descErrors++;
    }
  }
  console.log(descErrors === 0 ? 'All description codes VALID' : `${descErrors} invalid codes found`);
}

verify().catch(console.error);

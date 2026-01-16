/**
 * Ross Built CMS - AI Document Processor
 *
 * Comprehensive extraction system for construction documents:
 * 1. Auto-categorizing uploaded documents
 * 2. Extracting detailed specs from Architectural plans
 * 3. Extracting structural details from Structural plans
 * 4. Extracting MEP (Mechanical/Electrical/Plumbing) specs
 */

const Anthropic = require('@anthropic-ai/sdk');

// Initialize Anthropic client
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Document categories with detection keywords
const DOCUMENT_CATEGORIES = {
  plans: {
    keywords: ['floor plan', 'elevation', 'section', 'detail', 'scale:', 'architect', 'drawn by', 'sheet', 'a-', 's-', 'e-', 'm-', 'p-', 'architectural', 'structural', 'mechanical', 'electrical'],
    description: 'Architectural/Engineering Plans & Drawings'
  },
  contracts: {
    keywords: ['contract', 'agreement', 'terms and conditions', 'scope of work', 'contractor', 'subcontract'],
    description: 'Contracts & Agreements'
  },
  permits: {
    keywords: ['permit', 'building department', 'approval', 'inspection', 'certificate of occupancy'],
    description: 'Permits & Approvals'
  },
  insurance: {
    keywords: ['insurance', 'certificate of insurance', 'coi', 'liability', 'workers comp', 'policy number'],
    description: 'Insurance & Bonds'
  },
  proposals: {
    keywords: ['proposal', 'quote', 'quotation', 'estimate', 'bid', 'pricing'],
    description: 'Proposals & Bids'
  },
  specs: {
    keywords: ['specifications', 'division', 'section', 'material', 'performance', 'submittal'],
    description: 'Specifications'
  },
  warranties: {
    keywords: ['warranty', 'guarantee', 'limited warranty', 'manufacturer'],
    description: 'Warranties'
  },
  correspondence: {
    keywords: ['letter', 'memo', 'memorandum', 'notice', 're:', 'regarding', 'dear'],
    description: 'Correspondence'
  },
  invoices: {
    keywords: ['invoice', 'bill', 'amount due', 'payment due', 'invoice number'],
    description: 'Invoices & Billing'
  },
  photos: { keywords: [], description: 'Photos' },
  other: { keywords: [], description: 'Other' }
};

/**
 * Detect plan type from filename and content
 */
function detectPlanType(fileName) {
  const lower = fileName.toLowerCase();
  if (lower.includes('struct') || lower.includes('s-') || lower.includes('framing')) {
    return 'structural';
  }
  if (lower.includes('elect') || lower.includes('e-') || lower.includes('electrical')) {
    return 'electrical';
  }
  if (lower.includes('mech') || lower.includes('m-') || lower.includes('hvac')) {
    return 'mechanical';
  }
  if (lower.includes('plumb') || lower.includes('p-')) {
    return 'plumbing';
  }
  if (lower.includes('arch') || lower.includes('a-') || lower.includes('floor')) {
    return 'architectural';
  }
  return 'architectural'; // default
}

/**
 * Auto-categorize a document based on its content
 */
async function categorizeDocument(fileBuffer, mimeType, fileName) {
  try {
    const lower = fileName.toLowerCase();

    // Quick categorization by file extension for images
    if (/\.(jpg|jpeg|png|webp|heic)$/i.test(fileName)) {
      return { category: 'photos', confidence: 0.8, suggestedName: null };
    }

    // Check filename patterns
    if (lower.includes('plan') || lower.includes('arch') || lower.includes('struct') || lower.includes('elev')) {
      return { category: 'plans', confidence: 0.85, suggestedName: null };
    }
    if (lower.includes('contract') || lower.includes('agreement')) {
      return { category: 'contracts', confidence: 0.85, suggestedName: null };
    }
    if (lower.includes('permit')) {
      return { category: 'permits', confidence: 0.85, suggestedName: null };
    }
    if (lower.includes('insurance') || lower.includes('coi')) {
      return { category: 'insurance', confidence: 0.85, suggestedName: null };
    }
    if (lower.includes('proposal') || lower.includes('quote') || lower.includes('bid')) {
      return { category: 'proposals', confidence: 0.85, suggestedName: null };
    }
    if (lower.includes('invoice') || lower.includes('bill')) {
      return { category: 'invoices', confidence: 0.85, suggestedName: null };
    }

    // Default to 'other' with low confidence
    return { category: 'other', confidence: 0.5, suggestedName: null };
  } catch (err) {
    console.error('Categorization error:', err);
    return { category: 'other', confidence: 0.3, suggestedName: null };
  }
}

/**
 * Get the comprehensive extraction prompt for ARCHITECTURAL plans
 */
function getArchitecturalPrompt() {
  return `You are an expert construction document analyst specializing in architectural plans. Extract EVERY specification you can find.

SEARCH THESE LOCATIONS:
- COVER SHEET: Project info, area calculations, code info, team members
- SITE PLAN: Lot dimensions, setbacks, coverage, utilities, hardscape
- FLOOR PLANS: Room dimensions, room names, fixtures, features
- ROOM SCHEDULES: Room areas, ceiling heights, finishes
- ELEVATIONS: Stories, heights, materials, window/door locations
- SECTIONS: Wall assemblies, ceiling heights, roof structure
- DOOR SCHEDULE: Every door with size, type, material, hardware
- WINDOW SCHEDULE: Every window with size, type, glazing, manufacturer
- FINISH SCHEDULE: Flooring, wall finishes, ceiling finishes by room
- ELECTRICAL PLANS: Panel size, outlet counts, fixture counts
- PLUMBING PLANS: Fixture counts, water heater, pipe materials
- MECHANICAL PLANS: HVAC equipment, tonnage, zones, ductwork
- DETAILS: Special features, built-ins, trim profiles
- NOTES & LEGENDS: Code requirements, materials, specifications

EXTRACT ALL OF THIS (use null if not found):

{
  // === BASIC BUILDING INFO ===
  "project_name": "string",
  "sqft_conditioned": number,
  "sqft_total": number,
  "sqft_garage": number,
  "sqft_covered": number,
  "sqft_first_floor": number,
  "sqft_second_floor": number,
  "bedrooms": number,
  "bathrooms": number,
  "half_baths": number,
  "stories": number,
  "garage_spaces": number,

  // === CONSTRUCTION TYPE ===
  "construction_type": "new_construction|renovation|addition",
  "foundation_type": "slab|crawl|basement|pier|stem_wall",
  "roof_type": "shingle|tile|metal|flat|standing_seam",
  "exterior_finish": "stucco|siding|brick|stone|hardie|CBS",

  // === WINDOWS ===
  "windows_total_count": number,
  "windows_impact_rated": boolean,
  "windows_manufacturer": "string",
  "windows_frame_material": "aluminum|vinyl|wood|fiberglass",
  "windows_glass_type": "single|double|triple|low-e|impact",
  "schedule_windows": [{"mark": "W1", "size": "3'-0\" x 5'-0\"", "type": "single hung", "qty": 2}, ...],

  // === DOORS ===
  "doors_exterior_count": number,
  "doors_interior_count": number,
  "doors_garage_count": number,
  "doors_garage_width": number (total feet),
  "doors_impact_rated": boolean,
  "schedule_doors": [{"mark": "D1", "size": "3'-0\" x 8'-0\"", "type": "entry", "material": "fiberglass", "qty": 1}, ...],

  // === ROOM DETAILS ===
  "ceiling_height_main": number (feet),
  "ceiling_height_max": number (feet, for vaulted),
  "schedule_rooms": [{"name": "Master Bedroom", "sqft": 240, "ceiling": 10, "flooring": "wood", "walls": "paint"}, ...],

  // === FINISHES ===
  "flooring_tile_sqft": number,
  "flooring_wood_sqft": number,
  "flooring_carpet_sqft": number,
  "countertop_material": "granite|quartz|marble|laminate|solid surface",
  "countertop_linear_ft": number,
  "cabinet_linear_ft": number,
  "fireplace_count": number,
  "fireplace_type": "gas|wood|electric",

  // === PLUMBING ===
  "plumb_fixtures_total": number,
  "plumb_toilets": number,
  "plumb_sinks": number,
  "plumb_showers": number,
  "plumb_tubs": number,
  "plumb_water_heater_type": "tank|tankless",
  "plumb_water_heater_gallons": number,
  "plumb_water_heater_count": number,
  "plumb_gas_line": boolean,
  "plumb_water_source": "city|well",
  "plumb_sewer_type": "city|septic",

  // === ELECTRICAL ===
  "elec_service_amps": number (200, 400, etc),
  "elec_panel_count": number,
  "elec_outlets_count": number (estimate if needed),
  "elec_switches_count": number,
  "elec_lighting_fixtures": number,
  "elec_recessed_lights": number,
  "elec_ceiling_fans": number,
  "elec_smoke_detectors": number,
  "elec_generator_ready": boolean,
  "elec_solar_ready": boolean,
  "elec_ev_charger_ready": boolean,

  // === HVAC ===
  "ac_units": number,
  "ac_tonnage": number,
  "hvac_system_type": "split|package|mini-split",
  "hvac_fuel_type": "electric|gas|heat pump",
  "hvac_zones": number,
  "hvac_thermostat_count": number,
  "hvac_seer_rating": number,

  // === EXTERIOR & SITE ===
  "ext_siding_sqft": number,
  "ext_stucco_sqft": number,
  "ext_brick_sqft": number,
  "ext_driveway_sqft": number,
  "ext_driveway_material": "concrete|asphalt|pavers",
  "ext_patio_sqft": number,
  "ext_deck_sqft": number,
  "ext_pool_sqft": number,
  "pool_type": "in_ground|above_ground|spa|none",

  // === ROOFING ===
  "roof_sqft": number,
  "roof_squares": number (roof_sqft / 100),
  "roof_material": "dimensional shingle|3-tab|concrete tile|clay tile|metal standing seam|5V crimp",
  "roof_manufacturer": "string",
  "roof_pitch": "4:12, 6:12, etc",
  "roof_skylights": number,

  // === PROPERTY INFO ===
  "lot_size_sqft": number,
  "lot_size_acres": number,
  "zoning": "string",
  "flood_zone": "string (X, AE, VE, etc)",
  "parcel_id": "string",
  "setback_front": number (feet),
  "setback_rear": number,
  "setback_left": number,
  "setback_right": number,

  // === CODE INFO ===
  "code_building_code": "FBC 7th|IRC 2021|etc",
  "code_occupancy_type": "R-3|etc",
  "code_fire_sprinklers": boolean,

  // === TEAM ===
  "architect": "string",
  "team_architect_firm": "string",
  "team_architect_license": "string",
  "engineer": "string",
  "team_engineer_firm": "string",
  "permit_number": "string",

  // === APPLIANCES (if shown) ===
  "appl_range_type": "gas|electric|induction",
  "appl_vent_hood_type": "string",
  "appl_dishwasher": boolean,
  "appl_disposal": boolean,

  // === MATERIALS (estimate if possible) ===
  "mat_drywall_sqft": number,
  "mat_trim_linear_ft": number,
  "mat_baseboard_linear_ft": number,

  // === METADATA ===
  "_confidence": 0.0 to 1.0,
  "_notes": "Detailed summary of what you found and from which sheets",
  "_pages_analyzed": "List the specific sheets/pages"
}

Be thorough! Count windows in elevations if no schedule. Count doors from floor plans. Estimate electrical from room count if needed. Return ONLY valid JSON.`;
}

/**
 * Get the comprehensive extraction prompt for STRUCTURAL plans
 */
function getStructuralPrompt() {
  return `You are an expert structural engineer analyst. Extract EVERY structural specification from these plans.

SEARCH THESE LOCATIONS:
- COVER SHEET: Project info, design criteria, codes
- FOUNDATION PLAN: Pier layout, beam sizes, slab details
- FRAMING PLANS: Joist sizes, beam sizes, column locations
- ROOF FRAMING: Truss specs, ridge beams, hip/valley details
- STRUCTURAL DETAILS: Connections, hardware, hold-downs
- SECTIONS: Wall assembly, floor assembly, roof assembly
- SCHEDULES: Beam schedule, column schedule, footing schedule
- STRUCTURAL NOTES: Design loads, concrete specs, lumber grades
- GENERAL NOTES: Wind speed, exposure, seismic requirements

EXTRACT ALL OF THIS (use null if not found):

{
  // === FOUNDATION ===
  "foundation_type": "slab|crawl|basement|pier|stem_wall",
  "struct_foundation_depth": number (inches),
  "struct_foundation_width": number (inches),
  "struct_pier_count": number,
  "struct_pier_depth": number (feet),
  "struct_pier_diameter": number (inches),
  "struct_concrete_psi": number (3000, 4000, etc),
  "struct_concrete_yards": number (estimate total CY),
  "struct_rebar_tons": number (estimate),

  // === STEEL ===
  "struct_steel_beams": number (count of steel beams),
  "struct_steel_columns": number (count),
  "struct_steel_tonnage": number (estimate),

  // === WOOD FRAMING ===
  "struct_wood_beam_count": number,
  "struct_lvl_beam_count": number (engineered lumber),
  "struct_wall_framing": "2x4|2x6|2x8",
  "struct_sheathing_type": "OSB|plywood|Zip",
  "mat_framing_bf": number (estimate board feet),

  // === ROOF STRUCTURE ===
  "struct_truss_count": number,
  "struct_truss_span_max": number (feet),
  "roof_pitch": "4:12|6:12|etc",

  // === DESIGN CRITERIA ===
  "struct_wind_speed": number (mph),
  "struct_exposure_category": "B|C|D",
  "struct_seismic_category": "string",
  "struct_live_load_floor": number (PSF),
  "struct_live_load_roof": number (PSF),

  // === CODE INFO ===
  "code_building_code": "FBC 7th|IRC 2021|etc",
  "code_construction_type": "Type V-B|etc",

  // === TEAM ===
  "engineer": "string (PE name)",
  "team_engineer_firm": "string",
  "team_engineer_license": "string",

  // === BUILDING BASICS (if shown) ===
  "stories": number,
  "sqft_total": number,
  "pool_type": "in_ground|none" (if pool foundation shown),

  // === METADATA ===
  "_confidence": 0.0 to 1.0,
  "_notes": "Detailed summary of structural specs found",
  "_pages_analyzed": "List specific sheets"
}

COUNT: Piers on foundation plan, beams in schedules, trusses in roof framing. ESTIMATE: Concrete yards from foundation size, rebar from complexity. Return ONLY valid JSON.`;
}

/**
 * Analyze document using Claude Vision/PDF understanding
 */
async function analyzeDocumentWithVision(base64Data, mediaType, planType = 'architectural') {
  try {
    console.log(`[SpecExtractor] Analyzing ${planType} plans...`);

    let apiMediaType = mediaType;
    if (mediaType.includes('pdf')) {
      apiMediaType = 'application/pdf';
    }

    const prompt = planType === 'structural' ? getStructuralPrompt() : getArchitecturalPrompt();

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8000,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: apiMediaType,
              data: base64Data
            }
          },
          {
            type: 'text',
            text: prompt
          }
        ]
      }]
    });

    const responseText = response.content[0].text;
    console.log('[SpecExtractor] Raw response length:', responseText.length);

    // Extract JSON from response - try multiple approaches
    let specs;

    // Try to find JSON block
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    try {
      specs = JSON.parse(jsonMatch[0]);
    } catch (parseErr) {
      console.log('[SpecExtractor] Initial JSON parse failed, attempting cleanup...');

      // Clean up common JSON issues
      let cleanedJson = jsonMatch[0]
        .replace(/,\s*}/g, '}')           // Remove trailing commas before }
        .replace(/,\s*]/g, ']')           // Remove trailing commas before ]
        .replace(/[\x00-\x1F\x7F]/g, ' ') // Remove control characters
        .replace(/\n/g, ' ')              // Replace newlines with spaces
        .replace(/\t/g, ' ')              // Replace tabs with spaces
        .replace(/"\s*\n\s*"/g, '", "')   // Fix broken strings across lines
        .replace(/([^\\])"/g, '$1\\"')    // Escape unescaped quotes (careful)
        .replace(/\\\\"/g, '\\"');        // Fix double-escaped quotes

      // Try parsing cleaned JSON
      try {
        specs = JSON.parse(cleanedJson);
      } catch (cleanErr) {
        console.log('[SpecExtractor] Cleaned JSON parse failed, extracting key-value pairs...');

        // Fall back to extracting individual values via regex
        specs = extractSpecsViaRegex(responseText);
      }
    }

    // Clean up specs - remove null values except metadata
    const cleanSpecs = {};
    for (const [key, value] of Object.entries(specs)) {
      if (key.startsWith('_')) {
        cleanSpecs[key] = value;
        continue;
      }
      if (value !== null && value !== undefined && value !== '' && value !== 0) {
        cleanSpecs[key] = value;
      }
    }

    console.log('[SpecExtractor] Extracted', Object.keys(cleanSpecs).length, 'fields');

    return cleanSpecs;
  } catch (err) {
    console.error('[SpecExtractor] Analysis error:', err);
    return {
      _confidence: 0.2,
      _error: err.message,
      _notes: 'Failed to analyze document'
    };
  }
}

/**
 * Extract specs from a single plan document
 */
async function extractSpecsFromPlans(documentUrl, documentId, fileName = '') {
  try {
    console.log('[SpecExtractor] Fetching document:', documentUrl);

    const response = await fetch(documentUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch document: ${response.status}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get('content-type') || 'application/pdf';
    const base64Data = buffer.toString('base64');

    console.log(`[SpecExtractor] Document size: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);

    // Detect plan type
    const planType = detectPlanType(fileName || documentUrl);
    console.log(`[SpecExtractor] Detected plan type: ${planType}`);

    const specs = await analyzeDocumentWithVision(base64Data, contentType, planType);

    return {
      specs,
      confidence: specs._confidence || 0.7,
      document_id: documentId,
      plan_type: planType
    };
  } catch (err) {
    console.error('Spec extraction error:', err);
    throw err;
  }
}

/**
 * Merge specs from multiple documents intelligently
 */
function mergeSpecs(allSpecs, newSpecs, planType) {
  for (const [key, value] of Object.entries(newSpecs)) {
    if (key.startsWith('_')) continue;
    if (value === null || value === undefined || value === '') continue;

    // For arrays/objects (schedules), merge them
    if (Array.isArray(value)) {
      if (!allSpecs[key]) {
        allSpecs[key] = value;
      } else if (Array.isArray(allSpecs[key])) {
        // Merge arrays, avoiding duplicates
        allSpecs[key] = [...allSpecs[key], ...value];
      }
      continue;
    }

    // For structural fields, prefer structural plans
    if (key.startsWith('struct_') && planType === 'structural') {
      allSpecs[key] = value;
      continue;
    }

    // For electrical fields, prefer electrical plans
    if (key.startsWith('elec_') && planType === 'electrical') {
      allSpecs[key] = value;
      continue;
    }

    // For HVAC fields, prefer mechanical plans
    if ((key.startsWith('hvac_') || key.startsWith('ac_')) && planType === 'mechanical') {
      allSpecs[key] = value;
      continue;
    }

    // For plumbing fields, prefer plumbing plans
    if (key.startsWith('plumb_') && planType === 'plumbing') {
      allSpecs[key] = value;
      continue;
    }

    // Only set if we don't have a value yet
    if (allSpecs[key] === undefined || allSpecs[key] === null) {
      allSpecs[key] = value;
    }
  }

  return allSpecs;
}

/**
 * Extract specs from multiple documents
 */
async function extractSpecsFromMultipleDocuments(documents) {
  try {
    let allSpecs = {};
    let highestConfidence = 0;
    const allNotes = [];
    const planTypes = [];

    for (const doc of documents) {
      try {
        console.log(`[SpecExtractor] Processing: ${doc.name}`);

        const result = await extractSpecsFromPlans(doc.url, doc.id, doc.name);
        const planType = result.plan_type || 'architectural';
        planTypes.push(planType);

        // Merge specs
        allSpecs = mergeSpecs(allSpecs, result.specs, planType);

        if (result.confidence > highestConfidence) {
          highestConfidence = result.confidence;
        }

        if (result.specs._notes) {
          allNotes.push(`[${planType.toUpperCase()}] ${doc.name}: ${result.specs._notes}`);
        }
      } catch (err) {
        console.error(`Failed to process ${doc.name}:`, err);
        allNotes.push(`[ERROR] ${doc.name}: ${err.message}`);
      }
    }

    // Add metadata
    allSpecs._confidence = highestConfidence;
    allSpecs._notes = allNotes.join('\n\n');
    allSpecs._plan_types = [...new Set(planTypes)];

    return {
      specs: allSpecs,
      confidence: highestConfidence,
      plan_types: allSpecs._plan_types
    };
  } catch (err) {
    console.error('Multi-document extraction error:', err);
    throw err;
  }
}

/**
 * Fallback: Extract specs via regex patterns when JSON parsing fails
 */
function extractSpecsViaRegex(text) {
  const specs = { _confidence: 0.6, _notes: 'Extracted via regex fallback due to JSON parse error' };

  // Number extraction patterns
  const numberPatterns = {
    sqft_conditioned: /["']?sqft_conditioned["']?\s*:\s*(\d+)/i,
    sqft_total: /["']?sqft_total["']?\s*:\s*(\d+)/i,
    sqft_garage: /["']?sqft_garage["']?\s*:\s*(\d+)/i,
    sqft_covered: /["']?sqft_covered["']?\s*:\s*(\d+)/i,
    bedrooms: /["']?bedrooms["']?\s*:\s*(\d+)/i,
    bathrooms: /["']?bathrooms["']?\s*:\s*(\d+)/i,
    half_baths: /["']?half_baths["']?\s*:\s*(\d+)/i,
    stories: /["']?stories["']?\s*:\s*(\d+)/i,
    garage_spaces: /["']?garage_spaces["']?\s*:\s*(\d+)/i,
    ac_units: /["']?ac_units["']?\s*:\s*(\d+)/i,
    ac_tonnage: /["']?ac_tonnage["']?\s*:\s*(\d+)/i,
    windows_total_count: /["']?windows_total_count["']?\s*:\s*(\d+)/i,
    doors_exterior_count: /["']?doors_exterior_count["']?\s*:\s*(\d+)/i,
    doors_interior_count: /["']?doors_interior_count["']?\s*:\s*(\d+)/i,
    elec_service_amps: /["']?elec_service_amps["']?\s*:\s*(\d+)/i,
    plumb_toilets: /["']?plumb_toilets["']?\s*:\s*(\d+)/i,
    plumb_sinks: /["']?plumb_sinks["']?\s*:\s*(\d+)/i,
    roof_sqft: /["']?roof_sqft["']?\s*:\s*(\d+)/i,
    lot_size_sqft: /["']?lot_size_sqft["']?\s*:\s*(\d+)/i,
    ceiling_height_main: /["']?ceiling_height_main["']?\s*:\s*(\d+\.?\d*)/i,
  };

  // String extraction patterns
  const stringPatterns = {
    project_name: /["']?project_name["']?\s*:\s*["']([^"']+)["']/i,
    foundation_type: /["']?foundation_type["']?\s*:\s*["']([^"']+)["']/i,
    roof_type: /["']?roof_type["']?\s*:\s*["']([^"']+)["']/i,
    exterior_finish: /["']?exterior_finish["']?\s*:\s*["']([^"']+)["']/i,
    construction_type: /["']?construction_type["']?\s*:\s*["']([^"']+)["']/i,
    pool_type: /["']?pool_type["']?\s*:\s*["']([^"']+)["']/i,
    architect: /["']?architect["']?\s*:\s*["']([^"']+)["']/i,
    engineer: /["']?engineer["']?\s*:\s*["']([^"']+)["']/i,
    flood_zone: /["']?flood_zone["']?\s*:\s*["']([^"']+)["']/i,
    zoning: /["']?zoning["']?\s*:\s*["']([^"']+)["']/i,
    parcel_id: /["']?parcel_id["']?\s*:\s*["']([^"']+)["']/i,
    countertop_material: /["']?countertop_material["']?\s*:\s*["']([^"']+)["']/i,
    hvac_system_type: /["']?hvac_system_type["']?\s*:\s*["']([^"']+)["']/i,
    hvac_fuel_type: /["']?hvac_fuel_type["']?\s*:\s*["']([^"']+)["']/i,
    windows_manufacturer: /["']?windows_manufacturer["']?\s*:\s*["']([^"']+)["']/i,
    roof_pitch: /["']?roof_pitch["']?\s*:\s*["']([^"']+)["']/i,
  };

  // Extract numbers
  for (const [key, pattern] of Object.entries(numberPatterns)) {
    const match = text.match(pattern);
    if (match) {
      specs[key] = parseFloat(match[1]);
    }
  }

  // Extract strings
  for (const [key, pattern] of Object.entries(stringPatterns)) {
    const match = text.match(pattern);
    if (match) {
      specs[key] = match[1];
    }
  }

  // Extract booleans
  const booleanPatterns = {
    windows_impact_rated: /["']?windows_impact_rated["']?\s*:\s*(true|false)/i,
    doors_impact_rated: /["']?doors_impact_rated["']?\s*:\s*(true|false)/i,
    plumb_gas_line: /["']?plumb_gas_line["']?\s*:\s*(true|false)/i,
    elec_generator_ready: /["']?elec_generator_ready["']?\s*:\s*(true|false)/i,
    elec_solar_ready: /["']?elec_solar_ready["']?\s*:\s*(true|false)/i,
    code_fire_sprinklers: /["']?code_fire_sprinklers["']?\s*:\s*(true|false)/i,
  };

  for (const [key, pattern] of Object.entries(booleanPatterns)) {
    const match = text.match(pattern);
    if (match) {
      specs[key] = match[1].toLowerCase() === 'true';
    }
  }

  console.log('[SpecExtractor] Regex fallback extracted', Object.keys(specs).length, 'fields');
  return specs;
}

module.exports = {
  categorizeDocument,
  extractSpecsFromPlans,
  extractSpecsFromMultipleDocuments,
  analyzeDocumentWithVision,
  detectPlanType,
  extractSpecsViaRegex,
  DOCUMENT_CATEGORIES
};

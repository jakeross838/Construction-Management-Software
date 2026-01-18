/**
 * Seed Price Intelligence Data
 * Run with: node scripts/seed-price-data.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function seedData() {
  console.log('Seeding Price Intelligence data...\n');

  // 1. Create master items
  const masterItems = [
    // Lumber
    { id: '11111111-1111-1111-1111-000000000001', category: 'Lumber', subcategory: 'Studs', standard_name: '2x4x8 SPF Stud', standard_unit: 'ea', keywords: ['stud', '2x4', 'framing', 'spf'] },
    { id: '11111111-1111-1111-1111-000000000002', category: 'Lumber', subcategory: 'Studs', standard_name: '2x4x10 SPF Stud', standard_unit: 'ea', keywords: ['stud', '2x4', 'framing', 'spf'] },
    { id: '11111111-1111-1111-1111-000000000003', category: 'Lumber', subcategory: 'Studs', standard_name: '2x6x8 SPF Stud', standard_unit: 'ea', keywords: ['stud', '2x6', 'framing', 'spf'] },
    { id: '11111111-1111-1111-1111-000000000004', category: 'Lumber', subcategory: 'Dimensional', standard_name: '2x4x16 SPF', standard_unit: 'ea', keywords: ['dimensional', '2x4', 'framing'] },
    { id: '11111111-1111-1111-1111-000000000005', category: 'Lumber', subcategory: 'Dimensional', standard_name: '2x6x16 SPF', standard_unit: 'ea', keywords: ['dimensional', '2x6', 'framing'] },
    { id: '11111111-1111-1111-1111-000000000006', category: 'Lumber', subcategory: 'Treated', standard_name: '2x6x8 PT Ground Contact', standard_unit: 'ea', keywords: ['pressure treated', 'pt'] },
    { id: '11111111-1111-1111-1111-000000000007', category: 'Lumber', subcategory: 'LVL', standard_name: '1-3/4x11-7/8 LVL', standard_unit: 'lf', keywords: ['lvl', 'beam', 'engineered'] },
    // Plywood
    { id: '11111111-1111-1111-1111-000000000010', category: 'Plywood', subcategory: 'Sheathing', standard_name: '7/16 OSB Sheathing 4x8', standard_unit: 'sheet', keywords: ['osb', 'sheathing'] },
    { id: '11111111-1111-1111-1111-000000000011', category: 'Plywood', subcategory: 'Sheathing', standard_name: '23/32 T&G OSB Subfloor', standard_unit: 'sheet', keywords: ['osb', 'subfloor', 'advantech'] },
    { id: '11111111-1111-1111-1111-000000000012', category: 'Plywood', subcategory: 'CDX', standard_name: '1/2 CDX Plywood 4x8', standard_unit: 'sheet', keywords: ['cdx', 'plywood'] },
    { id: '11111111-1111-1111-1111-000000000013', category: 'Plywood', subcategory: 'CDX', standard_name: '3/4 CDX Plywood 4x8', standard_unit: 'sheet', keywords: ['cdx', 'plywood'] },
    // Drywall
    { id: '11111111-1111-1111-1111-000000000020', category: 'Drywall', subcategory: 'Regular', standard_name: '1/2 Drywall 4x8', standard_unit: 'sheet', keywords: ['drywall', 'sheetrock'] },
    { id: '11111111-1111-1111-1111-000000000021', category: 'Drywall', subcategory: 'Regular', standard_name: '1/2 Drywall 4x12', standard_unit: 'sheet', keywords: ['drywall', 'sheetrock'] },
    { id: '11111111-1111-1111-1111-000000000022', category: 'Drywall', subcategory: 'Regular', standard_name: '5/8 Drywall 4x8', standard_unit: 'sheet', keywords: ['drywall', 'fire rated'] },
    { id: '11111111-1111-1111-1111-000000000023', category: 'Drywall', subcategory: 'Moisture Resistant', standard_name: '1/2 Green Board 4x8', standard_unit: 'sheet', keywords: ['greenboard', 'bathroom'] },
    // Insulation
    { id: '11111111-1111-1111-1111-000000000030', category: 'Insulation', subcategory: 'Batt', standard_name: 'R-13 Unfaced Batt 15"', standard_unit: 'bag', keywords: ['r13', 'batt', 'fiberglass'] },
    { id: '11111111-1111-1111-1111-000000000031', category: 'Insulation', subcategory: 'Batt', standard_name: 'R-19 Unfaced Batt 15"', standard_unit: 'bag', keywords: ['r19', 'batt', 'fiberglass'] },
    { id: '11111111-1111-1111-1111-000000000032', category: 'Insulation', subcategory: 'Batt', standard_name: 'R-30 Unfaced Batt 16"', standard_unit: 'bag', keywords: ['r30', 'batt', 'attic'] },
    { id: '11111111-1111-1111-1111-000000000033', category: 'Insulation', subcategory: 'Rigid', standard_name: '1" XPS Rigid Foam 4x8', standard_unit: 'sheet', keywords: ['xps', 'foam', 'rigid'] },
    // Roofing
    { id: '11111111-1111-1111-1111-000000000040', category: 'Roofing', subcategory: 'Shingles', standard_name: 'Architectural Shingle Bundle', standard_unit: 'bundle', keywords: ['shingle', 'architectural'] },
    { id: '11111111-1111-1111-1111-000000000041', category: 'Roofing', subcategory: 'Underlayment', standard_name: '15# Felt Underlayment', standard_unit: 'roll', keywords: ['felt', 'underlayment'] },
    // Concrete
    { id: '11111111-1111-1111-1111-000000000050', category: 'Concrete', subcategory: 'Ready Mix', standard_name: 'Concrete 80# Bag', standard_unit: 'bag', keywords: ['concrete', 'quikrete'] },
    { id: '11111111-1111-1111-1111-000000000051', category: 'Concrete', subcategory: 'Rebar', standard_name: '#4 Rebar 20ft', standard_unit: 'ea', keywords: ['rebar', 'reinforcing'] },
    // Hardware
    { id: '11111111-1111-1111-1111-000000000060', category: 'Hardware', subcategory: 'Fasteners', standard_name: '3" Deck Screws 5# Box', standard_unit: 'box', keywords: ['deck screws', 'fasteners'] },
    { id: '11111111-1111-1111-1111-000000000061', category: 'Hardware', subcategory: 'Fasteners', standard_name: '16d Framing Nails 50# Box', standard_unit: 'box', keywords: ['nails', 'framing'] },
    { id: '11111111-1111-1111-1111-000000000062', category: 'Hardware', subcategory: 'Hangers', standard_name: 'LUS26 Joist Hanger', standard_unit: 'ea', keywords: ['joist hanger', 'simpson'] },
    // Siding
    { id: '11111111-1111-1111-1111-000000000070', category: 'Siding', subcategory: 'Hardie', standard_name: 'HardiePlank Lap Siding', standard_unit: 'pc', keywords: ['hardie', 'fiber cement'] },
    { id: '11111111-1111-1111-1111-000000000071', category: 'Siding', subcategory: 'Vinyl', standard_name: 'D4 Vinyl Siding White', standard_unit: 'sq', keywords: ['vinyl', 'siding'] },
  ];

  console.log('Inserting master items...');
  const { data: items, error: itemsError } = await supabase
    .from('v2_master_items')
    .upsert(masterItems, { onConflict: 'id' })
    .select();

  if (itemsError) {
    console.error('Error inserting items:', itemsError.message);
    return;
  }
  console.log(`  ✓ Inserted ${items.length} master items\n`);

  // 2. Get vendors
  const { data: vendors, error: vendorsError } = await supabase
    .from('v2_vendors')
    .select('id, name')
    .limit(4);

  if (vendorsError || !vendors.length) {
    console.error('No vendors found. Creating sample vendors...');
    const { data: newVendors } = await supabase
      .from('v2_vendors')
      .upsert([
        { name: '84 Lumber', email: 'orders@84lumber.com' },
        { name: 'Builders FirstSource', email: 'sales@bldr.com' },
        { name: 'ABC Supply', email: 'orders@abcsupply.com' },
        { name: 'Home Depot Pro', email: 'pro@homedepot.com' },
      ])
      .select();
    vendors.push(...(newVendors || []));
  }

  console.log(`Found ${vendors.length} vendors: ${vendors.map(v => v.name).join(', ')}\n`);

  // 3. Insert price history
  const priceData = [];
  const today = new Date().toISOString().split('T')[0];
  const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // Price variations per vendor
  const priceVariations = [
    // 2x4x8 Stud
    { item: '11111111-1111-1111-1111-000000000001', prices: [3.98, 4.15, 4.29, 4.47] },
    // 2x4x10 Stud
    { item: '11111111-1111-1111-1111-000000000002', prices: [5.48, 5.75, 5.99, 6.25] },
    // 2x6x8 Stud
    { item: '11111111-1111-1111-1111-000000000003', prices: [6.28, 6.49, 6.75, 6.97] },
    // OSB Sheathing
    { item: '11111111-1111-1111-1111-000000000010', prices: [11.98, 12.45, 12.89, 14.27] },
    // Subfloor OSB
    { item: '11111111-1111-1111-1111-000000000011', prices: [28.50, 29.95, 31.25, 33.99] },
    // 1/2 Drywall
    { item: '11111111-1111-1111-1111-000000000020', prices: [9.98, 10.25, 10.75, 12.47] },
    // R-13 Insulation
    { item: '11111111-1111-1111-1111-000000000030', prices: [32.50, 34.95, 36.25, 36.97] },
    // Shingles
    { item: '11111111-1111-1111-1111-000000000040', prices: [32.98, 35.50, 34.25, 37.99] },
    // Concrete
    { item: '11111111-1111-1111-1111-000000000050', prices: [5.98, 6.25, 6.49, 6.97] },
    // Joist Hangers
    { item: '11111111-1111-1111-1111-000000000062', prices: [2.45, 2.65, 2.89, 3.17] },
    // HardiePlank
    { item: '11111111-1111-1111-1111-000000000070', prices: [8.95, 9.45, 9.75, 10.25] },
  ];

  const dates = [fiveDaysAgo, threeDaysAgo, sevenDaysAgo, today];
  const sourceTypes = ['quote', 'invoice', 'quote', 'manual'];

  for (const pv of priceVariations) {
    for (let i = 0; i < Math.min(vendors.length, pv.prices.length); i++) {
      priceData.push({
        master_item_id: pv.item,
        vendor_id: vendors[i].id,
        source_type: sourceTypes[i],
        unit_price: pv.prices[i],
        unit: 'ea',
        quantity: 1,
        price_per_each: pv.prices[i],
        lead_days: [2, 1, 3, 0][i],
        in_stock: i !== 2, // ABC Supply sometimes out of stock
        price_date: dates[i],
      });
    }
  }

  console.log('Inserting price history...');
  const { data: prices, error: pricesError } = await supabase
    .from('v2_price_history')
    .insert(priceData)
    .select();

  if (pricesError) {
    console.error('Error inserting prices:', pricesError.message);
  } else {
    console.log(`  ✓ Inserted ${prices.length} price records\n`);
  }

  // 4. Insert waste factors
  const wasteFactors = [
    { category: 'Lumber', subcategory: 'Studs', default_waste_percent: 5, notes: 'Minimal waste on standard stud framing' },
    { category: 'Lumber', subcategory: 'Dimensional', default_waste_percent: 8, notes: 'Some waste from cuts and defects' },
    { category: 'Plywood', subcategory: 'Sheathing', default_waste_percent: 8, notes: 'Some waste at openings and edges' },
    { category: 'Plywood', subcategory: 'Subfloor', default_waste_percent: 5, notes: 'Less waste due to large floor areas' },
    { category: 'Drywall', subcategory: null, default_waste_percent: 10, notes: 'Standard drywall waste factor' },
    { category: 'Insulation', subcategory: 'Batt', default_waste_percent: 5, notes: 'Minimal waste on batt insulation' },
    { category: 'Roofing', subcategory: 'Shingles', default_waste_percent: 10, notes: 'Hip and valley cuts add waste' },
    { category: 'Siding', subcategory: null, default_waste_percent: 10, notes: 'Corners and openings add waste' },
    { category: 'Concrete', subcategory: null, default_waste_percent: 5, notes: 'Minimal waste on bag concrete' },
    { category: 'Hardware', subcategory: null, default_waste_percent: 0, notes: 'No waste on hardware items' },
  ];

  console.log('Inserting waste factors...');
  const { data: waste, error: wasteError } = await supabase
    .from('v2_waste_factors')
    .upsert(wasteFactors, { onConflict: 'category,subcategory', ignoreDuplicates: true })
    .select();

  if (wasteError) {
    console.error('Error inserting waste factors:', wasteError.message);
  } else {
    console.log(`  ✓ Inserted ${waste?.length || wasteFactors.length} waste factors\n`);
  }

  console.log('Done! Check the Price Intelligence page.');
}

seedData().catch(console.error);

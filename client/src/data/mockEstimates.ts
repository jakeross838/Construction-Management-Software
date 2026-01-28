import { 
  Estimate, 
  Assembly, 
  EstimateSection, 
  EstimateGroup,
  EstimateSubgroup,
  EstimateLineItem,
  defaultMarkupSettings 
} from '@/types/estimate';

// Helper to convert legacy lineItems to hierarchical structure
function createSectionWithItems(
  id: string,
  name: string,
  description: string,
  sortOrder: number,
  subtotal: number,
  subtotalWithMarkup: number,
  lineItems: EstimateLineItem[]
): EstimateSection {
  const subgroup: EstimateSubgroup = {
    id: `sub-${id}`,
    name: 'General',
    lineItems,
    subtotal,
    subtotalWithMarkup,
    sortOrder: 1,
  };
  
  const group: EstimateGroup = {
    id: `grp-${id}`,
    name: 'General',
    subgroups: [subgroup],
    subtotal,
    subtotalWithMarkup,
    sortOrder: 1,
  };

  return {
    id,
    name,
    description,
    groups: [group],
    subtotal,
    subtotalWithMarkup,
    sortOrder,
  };
}

function createEmptySection(id: string, name: string, sortOrder: number, subtotal: number, subtotalWithMarkup: number): EstimateSection {
  return {
    id,
    name,
    groups: [],
    subtotal,
    subtotalWithMarkup,
    sortOrder,
  };
}

// Standard Assemblies - Pre-built templates for common work
// Note: costCodeId and costCode should be populated from the database when used
export const assemblies: Assembly[] = [
  {
    id: 'asm-1',
    name: 'Interior Wall - Standard',
    description: '2x4 wood stud wall with drywall both sides, paint ready',
    category: 'Framing',
    unit: 'lf',
    lineItems: [
      { category: 'Framing', description: '2x4x8 Studs (16" OC)', type: 'material', quantity: 0.75, unit: 'ea', unitCost: 4.25, markup: 15, markupType: 'percentage' },
      { category: 'Framing', description: 'Top/Bottom Plates', type: 'material', quantity: 2, unit: 'lf', unitCost: 0.85, markup: 15, markupType: 'percentage' },
      { category: 'Framing', description: '1/2" Drywall (both sides)', type: 'material', quantity: 2, unit: 'sf', unitCost: 0.45, markup: 15, markupType: 'percentage' },
      { category: 'Framing', description: 'Framing Labor', type: 'labor', quantity: 0.15, unit: 'hrs', unitCost: 45, markup: 35, markupType: 'percentage' },
      { category: 'Framing', description: 'Drywall Hang & Finish', type: 'labor', quantity: 0.25, unit: 'hrs', unitCost: 50, markup: 35, markupType: 'percentage' },
    ],
    totalCostPerUnit: 28.50,
    isActive: true,
    createdAt: '2025-01-01',
    updatedAt: '2025-01-01',
  },
  {
    id: 'asm-2',
    name: 'Exterior Wall - 2x6 Insulated',
    description: '2x6 wall with R-19 insulation, housewrap, ready for siding',
    category: 'Framing',
    unit: 'lf',
    lineItems: [
      { category: 'Framing', description: '2x6x8 Studs (16" OC)', type: 'material', quantity: 0.75, unit: 'ea', unitCost: 6.75, markup: 15, markupType: 'percentage' },
      { category: 'Framing', description: 'Top/Bottom Plates', type: 'material', quantity: 2, unit: 'lf', unitCost: 1.25, markup: 15, markupType: 'percentage' },
      { category: 'Framing', description: 'R-19 Batt Insulation', type: 'material', quantity: 1, unit: 'sf', unitCost: 0.95, markup: 15, markupType: 'percentage' },
      { category: 'Framing', description: 'Housewrap', type: 'material', quantity: 1, unit: 'sf', unitCost: 0.25, markup: 15, markupType: 'percentage' },
      { category: 'Framing', description: 'Framing Labor', type: 'labor', quantity: 0.18, unit: 'hrs', unitCost: 45, markup: 35, markupType: 'percentage' },
    ],
    totalCostPerUnit: 24.80,
    isActive: true,
    createdAt: '2025-01-01',
    updatedAt: '2025-01-01',
  },
  {
    id: 'asm-3',
    name: 'Concrete Slab - 4" Monolithic',
    description: '4" concrete slab with turned-down edge, rebar, vapor barrier',
    category: 'Foundation',
    unit: 'sf',
    lineItems: [
      { category: 'Foundation', description: '4" Concrete (3500 PSI)', type: 'material', quantity: 0.012, unit: 'cy', unitCost: 165, markup: 15, markupType: 'percentage' },
      { category: 'Foundation', description: '#4 Rebar Grid', type: 'material', quantity: 0.15, unit: 'lb', unitCost: 0.85, markup: 15, markupType: 'percentage' },
      { category: 'Foundation', description: '6 mil Vapor Barrier', type: 'material', quantity: 1.1, unit: 'sf', unitCost: 0.08, markup: 15, markupType: 'percentage' },
      { category: 'Foundation', description: '4" Compacted Base', type: 'material', quantity: 0.012, unit: 'cy', unitCost: 45, markup: 15, markupType: 'percentage' },
      { category: 'Foundation', description: 'Concrete Labor', type: 'labor', quantity: 0.02, unit: 'hrs', unitCost: 55, markup: 35, markupType: 'percentage' },
    ],
    totalCostPerUnit: 5.85,
    isActive: true,
    createdAt: '2025-01-01',
    updatedAt: '2025-01-01',
  },
  {
    id: 'asm-4',
    name: 'Asphalt Shingle Roof - 30yr',
    description: '30-year architectural shingles with felt, ice & water shield at eaves',
    category: 'Roofing',
    unit: 'sf',
    lineItems: [
      { category: 'Roofing', description: '30yr Architectural Shingles', type: 'material', quantity: 1.1, unit: 'sf', unitCost: 1.85, markup: 15, markupType: 'percentage' },
      { category: 'Roofing', description: '#30 Felt Underlayment', type: 'material', quantity: 1.05, unit: 'sf', unitCost: 0.15, markup: 15, markupType: 'percentage' },
      { category: 'Roofing', description: 'Drip Edge', type: 'material', quantity: 0.1, unit: 'lf', unitCost: 1.50, markup: 15, markupType: 'percentage' },
      { category: 'Roofing', description: 'Roofing Nails & Supplies', type: 'material', quantity: 1, unit: 'sf', unitCost: 0.08, markup: 15, markupType: 'percentage' },
      { category: 'Roofing', description: 'Roofing Installation', type: 'subcontractor', quantity: 1, unit: 'sf', unitCost: 2.25, markup: 10, markupType: 'percentage' },
    ],
    totalCostPerUnit: 4.95,
    isActive: true,
    createdAt: '2025-01-01',
    updatedAt: '2025-01-01',
  },
  {
    id: 'asm-5',
    name: 'Electrical Rough-In - Standard',
    description: 'Standard electrical rough per 1000 SF of living space',
    category: 'Electrical',
    unit: 'sf',
    lineItems: [
      { category: 'Electrical', description: 'Electrical Rough Materials', type: 'material', quantity: 1, unit: 'sf', unitCost: 3.50, markup: 15, markupType: 'percentage' },
      { category: 'Electrical', description: 'Electrical Rough Labor', type: 'subcontractor', quantity: 1, unit: 'sf', unitCost: 8.00, markup: 10, markupType: 'percentage' },
    ],
    totalCostPerUnit: 12.82,
    isActive: true,
    createdAt: '2025-01-01',
    updatedAt: '2025-01-01',
  },
  {
    id: 'asm-6',
    name: 'Plumbing Rough-In - Standard',
    description: 'Standard plumbing rough per 1000 SF of living space',
    category: 'Plumbing',
    unit: 'sf',
    lineItems: [
      { category: 'Plumbing', description: 'Plumbing Rough Materials', type: 'material', quantity: 1, unit: 'sf', unitCost: 4.25, markup: 15, markupType: 'percentage' },
      { category: 'Plumbing', description: 'Plumbing Rough Labor', type: 'subcontractor', quantity: 1, unit: 'sf', unitCost: 9.50, markup: 10, markupType: 'percentage' },
    ],
    totalCostPerUnit: 15.34,
    isActive: true,
    createdAt: '2025-01-01',
    updatedAt: '2025-01-01',
  },
];

// Sample Estimates with hierarchical structure
export const estimates: Estimate[] = [
  {
    id: '1',
    number: 'EST-2026-001',
    version: 1,
    jobId: '1', // Drummond
    clientName: 'John & Sarah Drummond',
    clientEmail: 'drummond@email.com',
    clientPhone: '941-555-1234',
    clientAddress: '501 74th Street, Sarasota, FL 34242',
    projectName: 'Drummond',
    projectAddress: '501 74th Street, Sarasota, FL 34242',
    projectDescription: 'New custom home construction - 4,200 SF single-story with 4BR/3BA, pool-ready, impact windows',
    projectSquareFeet: 4200,
    projectType: 'new_construction',
    status: 'approved',
    createdAt: '2026-01-18',
    updatedAt: '2026-01-19',
    sentAt: '2026-01-19',
    expiresAt: '2026-02-18',
    sections: [
      createSectionWithItems('sec-1', 'Site Work', 'Site preparation and utilities', 1, 72500, 85000, [
        { id: 'li-1', costCodeId: '1', costCode: '01000', category: 'Site Work', description: 'Clearing & Grubbing', type: 'subcontractor', quantity: 1, unit: 'ls', unitCost: 8500, totalCost: 8500, markup: 10, markupType: 'percentage', totalWithMarkup: 9350, sortOrder: 1 },
        { id: 'li-2', costCodeId: '1', costCode: '01000', category: 'Site Work', description: 'Grading & Fill', type: 'subcontractor', quantity: 1, unit: 'ls', unitCost: 18000, totalCost: 18000, markup: 10, markupType: 'percentage', totalWithMarkup: 19800, sortOrder: 2 },
        { id: 'li-3', costCodeId: '1', costCode: '01000', category: 'Site Work', description: 'Driveway - Concrete', type: 'subcontractor', quantity: 450, unit: 'sf', unitCost: 12, totalCost: 5400, totalWithMarkup: 5940, markup: 10, markupType: 'percentage', sortOrder: 3 },
        { id: 'li-4', costCodeId: '1', costCode: '01000', category: 'Site Work', description: 'Water & Sewer Connection', type: 'subcontractor', quantity: 1, unit: 'ls', unitCost: 12500, totalCost: 12500, markup: 10, markupType: 'percentage', totalWithMarkup: 13750, sortOrder: 4 },
        { id: 'li-5', costCodeId: '1', costCode: '01000', category: 'Site Work', description: 'Electric Service Connection', type: 'subcontractor', quantity: 1, unit: 'ls', unitCost: 8500, totalCost: 8500, markup: 10, markupType: 'percentage', totalWithMarkup: 9350, sortOrder: 5 },
        { id: 'li-6', costCodeId: '1', costCode: '01000', category: 'Site Work', description: 'Landscaping Allowance', type: 'other', quantity: 1, unit: 'ls', unitCost: 19600, totalCost: 19600, markup: 10, markupType: 'percentage', totalWithMarkup: 21560, sortOrder: 6 },
      ]),
      createSectionWithItems('sec-2', 'Foundation', 'Concrete foundation and slab', 2, 113636, 125000, [
        { id: 'li-7', costCodeId: '2', costCode: '03100', category: 'Foundation', description: 'Concrete Slab 4" w/ Turndown', type: 'material', quantity: 4200, unit: 'sf', unitCost: 5.50, totalCost: 23100, markup: 15, markupType: 'percentage', totalWithMarkup: 26565, sortOrder: 1, assemblyId: 'asm-3' },
        { id: 'li-8', costCodeId: '2', costCode: '03100', category: 'Foundation', description: 'Concrete Labor & Finishing', type: 'labor', quantity: 180, unit: 'hrs', unitCost: 55, totalCost: 9900, markup: 35, markupType: 'percentage', totalWithMarkup: 13365, sortOrder: 2 },
        { id: 'li-9', costCodeId: '2', costCode: '03100', category: 'Foundation', description: '#4 Rebar w/ Installation', type: 'material', quantity: 2800, unit: 'lb', unitCost: 1.25, totalCost: 3500, markup: 15, markupType: 'percentage', totalWithMarkup: 4025, sortOrder: 3 },
        { id: 'li-10', costCodeId: '2', costCode: '03100', category: 'Foundation', description: 'Pump Truck', type: 'equipment', quantity: 1, unit: 'ea', unitCost: 1800, totalCost: 1800, markup: 15, markupType: 'percentage', totalWithMarkup: 2070, sortOrder: 4 },
        { id: 'li-11', costCodeId: '2', costCode: '03100', category: 'Foundation', description: 'Termite Pre-Treatment', type: 'subcontractor', quantity: 4200, unit: 'sf', unitCost: 0.45, totalCost: 1890, markup: 10, markupType: 'percentage', totalWithMarkup: 2079, sortOrder: 5 },
      ]),
      createSectionWithItems('sec-3', 'Framing', 'Wood framing - walls, roof trusses, sheathing', 3, 245454, 285000, [
        { id: 'li-12', costCodeId: '3', costCode: '06100', category: 'Framing', description: 'Lumber Package (delivered)', type: 'material', quantity: 1, unit: 'ls', unitCost: 95000, totalCost: 95000, markup: 15, markupType: 'percentage', totalWithMarkup: 109250, sortOrder: 1 },
        { id: 'li-13', costCodeId: '3', costCode: '06100', category: 'Framing', description: 'Engineered Trusses', type: 'material', quantity: 1, unit: 'ls', unitCost: 32000, totalCost: 32000, markup: 15, markupType: 'percentage', totalWithMarkup: 36800, sortOrder: 2 },
        { id: 'li-14', costCodeId: '3', costCode: '06100', category: 'Framing', description: 'OSB Sheathing - Walls', type: 'material', quantity: 180, unit: 'sheet', unitCost: 38, totalCost: 6840, markup: 15, markupType: 'percentage', totalWithMarkup: 7866, sortOrder: 3 },
        { id: 'li-15', costCodeId: '3', costCode: '06100', category: 'Framing', description: 'OSB Sheathing - Roof', type: 'material', quantity: 150, unit: 'sheet', unitCost: 38, totalCost: 5700, markup: 15, markupType: 'percentage', totalWithMarkup: 6555, sortOrder: 4 },
        { id: 'li-16', costCodeId: '3', costCode: '06100', category: 'Framing', description: 'Framing Labor', type: 'labor', quantity: 820, unit: 'hrs', unitCost: 48, totalCost: 39360, markup: 35, markupType: 'percentage', totalWithMarkup: 53136, sortOrder: 5 },
        { id: 'li-17', costCodeId: '3', costCode: '06100', category: 'Framing', description: 'Crane Rental - Truss Set', type: 'equipment', quantity: 2, unit: 'days', unitCost: 1800, totalCost: 3600, markup: 15, markupType: 'percentage', totalWithMarkup: 4140, sortOrder: 6 },
      ]),
      createSectionWithItems('sec-4', 'MEP (Mechanical/Electrical/Plumbing)', 'All mechanical systems rough and finish', 4, 272727, 310000, [
        { id: 'li-18', costCodeId: '5', costCode: '16100', category: 'Electrical', description: 'Electrical - Complete', type: 'subcontractor', quantity: 4200, unit: 'sf', unitCost: 18, totalCost: 75600, markup: 10, markupType: 'percentage', totalWithMarkup: 83160, sortOrder: 1 },
        { id: 'li-19', costCodeId: '4', costCode: '15100', category: 'Plumbing', description: 'Plumbing - Complete', type: 'subcontractor', quantity: 4200, unit: 'sf', unitCost: 22, totalCost: 92400, markup: 10, markupType: 'percentage', totalWithMarkup: 101640, sortOrder: 2 },
        { id: 'li-20', costCodeId: '6', costCode: '15500', category: 'HVAC', description: 'HVAC - Complete (2 zones)', type: 'subcontractor', quantity: 1, unit: 'ls', unitCost: 42000, totalCost: 42000, markup: 10, markupType: 'percentage', totalWithMarkup: 46200, sortOrder: 3 },
        { id: 'li-21', costCodeId: '5', costCode: '16100', category: 'Electrical', description: 'Low Voltage / Smart Home', type: 'subcontractor', quantity: 1, unit: 'ls', unitCost: 15000, totalCost: 15000, markup: 10, markupType: 'percentage', totalWithMarkup: 16500, sortOrder: 4 },
      ]),
      createSectionWithItems('sec-5', 'Finishes', 'Interior and exterior finishes', 5, 390909, 445000, [
        { id: 'li-22', category: 'Roofing', description: 'Roofing - 30yr Architectural', type: 'subcontractor', quantity: 5200, unit: 'sf', unitCost: 4.50, totalCost: 23400, markup: 10, markupType: 'percentage', totalWithMarkup: 25740, sortOrder: 1 },
        { id: 'li-23', category: 'Exterior', description: 'Impact Windows & Doors', type: 'material', quantity: 1, unit: 'ls', unitCost: 85000, totalCost: 85000, markup: 15, markupType: 'percentage', totalWithMarkup: 97750, sortOrder: 2 },
        { id: 'li-24', category: 'Exterior', description: 'Stucco Exterior', type: 'subcontractor', quantity: 4800, unit: 'sf', unitCost: 8.50, totalCost: 40800, markup: 10, markupType: 'percentage', totalWithMarkup: 44880, sortOrder: 3 },
        { id: 'li-25', category: 'Interior', description: 'Drywall - Hang, Tape, Finish', type: 'subcontractor', quantity: 14000, unit: 'sf', unitCost: 2.85, totalCost: 39900, markup: 10, markupType: 'percentage', totalWithMarkup: 43890, sortOrder: 4 },
        { id: 'li-26', category: 'Interior', description: 'Interior Paint', type: 'subcontractor', quantity: 14000, unit: 'sf', unitCost: 1.75, totalCost: 24500, markup: 10, markupType: 'percentage', totalWithMarkup: 26950, sortOrder: 5 },
        { id: 'li-27', category: 'Flooring', description: 'Tile Flooring', type: 'material', quantity: 2800, unit: 'sf', unitCost: 8.50, totalCost: 23800, markup: 15, markupType: 'percentage', totalWithMarkup: 27370, sortOrder: 6 },
        { id: 'li-28', category: 'Flooring', description: 'Tile Installation', type: 'labor', quantity: 2800, unit: 'sf', unitCost: 6.00, totalCost: 16800, markup: 35, markupType: 'percentage', totalWithMarkup: 22680, sortOrder: 7 },
        { id: 'li-29', category: 'Flooring', description: 'LVP Flooring (w/ install)', type: 'material', quantity: 1400, unit: 'sf', unitCost: 7.50, totalCost: 10500, markup: 15, markupType: 'percentage', totalWithMarkup: 12075, sortOrder: 8 },
        { id: 'li-30', category: 'Cabinetry', description: 'Kitchen & Bath Cabinets', type: 'material', quantity: 1, unit: 'ls', unitCost: 35000, totalCost: 35000, markup: 15, markupType: 'percentage', totalWithMarkup: 40250, sortOrder: 9 },
        { id: 'li-31', category: 'Countertops', description: 'Quartz Countertops', type: 'subcontractor', quantity: 85, unit: 'sf', unitCost: 95, totalCost: 8075, markup: 10, markupType: 'percentage', totalWithMarkup: 8882, sortOrder: 10 },
        { id: 'li-32', category: 'Trim', description: 'Interior Trim & Doors', type: 'material', quantity: 1, unit: 'ls', unitCost: 22000, totalCost: 22000, markup: 15, markupType: 'percentage', totalWithMarkup: 25300, sortOrder: 11 },
        { id: 'li-33', category: 'Trim', description: 'Trim Carpentry Labor', type: 'labor', quantity: 280, unit: 'hrs', unitCost: 52, totalCost: 14560, markup: 35, markupType: 'percentage', totalWithMarkup: 19656, sortOrder: 12 },
        { id: 'li-34', category: 'Appliances', description: 'Appliance Package', type: 'material', quantity: 1, unit: 'ls', unitCost: 18000, totalCost: 18000, markup: 10, markupType: 'percentage', totalWithMarkup: 19800, sortOrder: 13 },
      ]),
    ],
    subtotalMaterial: 398440,
    subtotalLabor: 80620,
    subtotalSubcontractor: 508575,
    subtotalEquipment: 5400,
    subtotalOther: 19600,
    subtotalDirect: 1012635,
    markupSettings: {
      materialMarkup: 15,
      laborMarkup: 35,
      subcontractorMarkup: 10,
      equipmentMarkup: 15,
      overheadPercent: 12,
      profitPercent: 10,
      contingencyPercent: 5,
    },
    overheadAmount: 150000,
    profitAmount: 125000,
    contingencyAmount: 62500,
    totalBeforeContingency: 1187500,
    totalAmount: 1250000,
    allowances: [
      { id: 'allow-1', category: 'Fixtures', description: 'Plumbing Fixtures Allowance', amount: 12000 },
      { id: 'allow-2', category: 'Lighting', description: 'Lighting Fixtures Allowance', amount: 8500 },
      { id: 'allow-3', category: 'Hardware', description: 'Door Hardware Allowance', amount: 3500 },
    ],
    totalAllowances: 24000,
    exclusions: [
      'Pool and pool deck construction',
      'Outdoor kitchen/summer kitchen',
      'Fencing and gates',
      'Window treatments',
      'Furniture and decor',
    ],
    clarifications: [
      'Pricing valid for 30 days from date of estimate',
      'Allowances are included in total; overages will be billed as change orders',
      'Timeline assumes no significant weather delays',
      'Permit fees are included; impact fees are excluded',
    ],
    termsAndConditions: 'Standard residential construction contract terms apply. Payment schedule: 10% upon signing, progress payments monthly based on work completed. Final payment due upon substantial completion.',
    createdBy: 'user-1',
    assignedTo: 'user-1',
    notes: 'Client prefers coastal contemporary design. Emphasis on hurricane-resistant construction.',
  },
  {
    id: '2',
    number: 'EST-2026-002',
    version: 1,
    jobId: '5', // Martinez Modern
    clientName: 'Carlos & Maria Martinez',
    clientEmail: 'martinez@email.com',
    projectName: 'Martinez Modern',
    projectAddress: '321 Palm Circle, Venice, FL 34285',
    projectDescription: 'Contemporary design - 5,800 SF two-story with rooftop deck',
    projectSquareFeet: 5800,
    projectType: 'new_construction',
    status: 'draft',
    createdAt: '2026-01-20',
    updatedAt: '2026-01-20',
    sections: [
      createEmptySection('sec-6', 'Site Work', 1, 109090, 120000),
      createEmptySection('sec-7', 'Foundation', 2, 168181, 185000),
      createEmptySection('sec-8', 'Structure', 3, 381818, 420000),
      createEmptySection('sec-9', 'MEP', 4, 440909, 485000),
      createEmptySection('sec-10', 'Finishes', 5, 809090, 890000),
    ],
    subtotalMaterial: 650000,
    subtotalLabor: 320000,
    subtotalSubcontractor: 890000,
    subtotalEquipment: 35000,
    subtotalOther: 14088,
    subtotalDirect: 1909088,
    markupSettings: defaultMarkupSettings,
    overheadAmount: 252000,
    profitAmount: 210000,
    contingencyAmount: 105000,
    totalBeforeContingency: 1995000,
    totalAmount: 2100000,
    allowances: [],
    totalAllowances: 0,
    exclusions: [],
    clarifications: [],
    createdBy: 'user-1',
  },
  {
    id: '3',
    number: 'EST-2026-003',
    version: 2,
    parentEstimateId: 'est-prev',
    jobId: '2', // Crews Residence
    clientName: 'Robert & Lisa Crews',
    clientEmail: 'crews@email.com',
    projectName: 'Crews Residence',
    projectAddress: '123 Ocean Blvd, Siesta Key, FL 34242',
    projectDescription: 'Full custom home - gut and rebuild with new layout, custom cabinets, high-end appliances',
    projectSquareFeet: 5200,
    projectType: 'new_construction',
    status: 'approved',
    createdAt: '2026-01-10',
    updatedAt: '2026-01-15',
    sentAt: '2026-01-12',
    approvedAt: '2026-01-15',
    sections: [
      createEmptySection('sec-11', 'Demo & Prep', 1, 8000, 9500),
      createEmptySection('sec-12', 'MEP Rough', 2, 15000, 18000),
      createEmptySection('sec-13', 'Finishes', 3, 52000, 62000),
    ],
    subtotalMaterial: 42000,
    subtotalLabor: 18500,
    subtotalSubcontractor: 22000,
    subtotalEquipment: 1200,
    subtotalOther: 800,
    subtotalDirect: 84500,
    markupSettings: {
      ...defaultMarkupSettings,
      overheadPercent: 15,
      profitPercent: 12,
    },
    overheadAmount: 12675,
    profitAmount: 11664,
    contingencyAmount: 5442,
    totalBeforeContingency: 103397,
    totalAmount: 108839,
    allowances: [
      { id: 'allow-4', category: 'Appliances', description: 'Kitchen Appliance Package', amount: 15000 },
    ],
    totalAllowances: 15000,
    exclusions: ['Structural modifications', 'Flooring outside kitchen area'],
    clarifications: ['Existing plumbing locations to remain; relocation would add cost'],
    createdBy: 'user-1',
    assignedTo: 'user-2',
  },
];

// Helper functions
export const getEstimateById = (id: string): Estimate | undefined => {
  return estimates.find(e => e.id === id);
};

export const getAssemblies = (): Assembly[] => {
  return assemblies.filter(a => a.isActive);
};

export const getAssemblyById = (id: string): Assembly | undefined => {
  return assemblies.find(a => a.id === id);
};

export const getAssembliesByCategory = (category: string): Assembly[] => {
  return assemblies.filter(a => a.isActive && a.category === category);
};

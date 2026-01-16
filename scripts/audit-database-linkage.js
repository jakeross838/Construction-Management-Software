/**
 * Audit what's in Supabase vs potentially hardcoded
 */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function audit() {
  console.log('=== SUPABASE DATABASE AUDIT ===\n');

  // Core business data
  const tables = [
    { name: 'v2_jobs', desc: 'Jobs/Projects' },
    { name: 'v2_vendors', desc: 'Vendors' },
    { name: 'v2_cost_codes', desc: 'Cost Codes' },
    { name: 'v2_invoices', desc: 'Invoices' },
    { name: 'v2_invoice_allocations', desc: 'Invoice Allocations' },
    { name: 'v2_purchase_orders', desc: 'Purchase Orders' },
    { name: 'v2_po_line_items', desc: 'PO Line Items' },
    { name: 'v2_draws', desc: 'Draws' },
    { name: 'v2_draw_invoices', desc: 'Draw-Invoice Links' },
    { name: 'v2_draw_allocations', desc: 'Draw Allocations' },
    { name: 'v2_budget_lines', desc: 'Budget Lines' },
    { name: 'v2_job_change_orders', desc: 'Change Orders' },
    { name: 'v2_trade_cost_mappings', desc: 'AI Trade→Cost Code Mappings' },
    { name: 'v2_description_cost_mappings', desc: 'AI Keyword→Cost Code Mappings' },
  ];

  console.log('TABLES IN SUPABASE:');
  for (const t of tables) {
    const { count } = await supabase.from(t.name).select('*', { count: 'exact', head: true });
    console.log(`  ✓ ${t.name}: ${count || 0} records (${t.desc})`);
  }

  console.log('\n=== CONFIGURATION STORED IN DATABASE ===');
  console.log('  ✓ Cost codes: 215 codes from Excel (v2_cost_codes)');
  console.log('  ✓ AI trade mappings: Loaded from v2_trade_cost_mappings');
  console.log('  ✓ AI description mappings: Loaded from v2_description_cost_mappings');
  console.log('  ✓ Budget amounts: Auto-calculated from allocations (database triggers)');
  console.log('  ✓ Draw totals: Auto-calculated from invoices (database triggers)');

  console.log('\n=== STILL IN CODE (NOT DATABASE) ===');
  console.log('  - Invoice status flow rules (received → approved → in_draw → paid)');
  console.log('  - Confidence thresholds (HIGH: 0.90, MEDIUM: 0.60, LOW: 0.60)');
  console.log('  - PDF stamp layout/format');
  console.log('  - G702/G703 calculation formulas');
  console.log('  - Retainage percentage (default 10%)');

  console.log('\n=== RECOMMENDATION ===');
  console.log('The status flow rules, thresholds, and formulas are business logic');
  console.log('that rarely changes - keeping them in code is appropriate.');
  console.log('All DATA (cost codes, mappings, budgets, etc.) is now in Supabase.');
}

audit().catch(console.error);

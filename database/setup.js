/**
 * Database Setup Script
 * Creates v2 tables in Supabase
 * Usage: node database/setup.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const schema = `
-- Jobs
CREATE TABLE IF NOT EXISTS v2_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  client_name TEXT,
  contract_amount DECIMAL(12,2),
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vendors
CREATE TABLE IF NOT EXISTS v2_vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cost Codes
CREATE TABLE IF NOT EXISTS v2_cost_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Budget Lines
CREATE TABLE IF NOT EXISTS v2_budget_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES v2_jobs(id) ON DELETE CASCADE,
  cost_code_id UUID REFERENCES v2_cost_codes(id) ON DELETE CASCADE,
  budgeted_amount DECIMAL(12,2) DEFAULT 0,
  committed_amount DECIMAL(12,2) DEFAULT 0,
  billed_amount DECIMAL(12,2) DEFAULT 0,
  paid_amount DECIMAL(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(job_id, cost_code_id)
);

-- Invoices
CREATE TABLE IF NOT EXISTS v2_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES v2_jobs(id) ON DELETE CASCADE,
  vendor_id UUID REFERENCES v2_vendors(id) ON DELETE SET NULL,
  invoice_number TEXT,
  invoice_date DATE,
  due_date DATE,
  amount DECIMAL(12,2) NOT NULL,
  status TEXT DEFAULT 'pending',
  pdf_path TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  approved_by TEXT
);

-- Invoice Allocations
CREATE TABLE IF NOT EXISTS v2_invoice_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES v2_invoices(id) ON DELETE CASCADE,
  cost_code_id UUID REFERENCES v2_cost_codes(id) ON DELETE CASCADE,
  amount DECIMAL(12,2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Draws
CREATE TABLE IF NOT EXISTS v2_draws (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES v2_jobs(id) ON DELETE CASCADE,
  draw_number INTEGER NOT NULL,
  period_end DATE,
  total_amount DECIMAL(12,2) DEFAULT 0,
  status TEXT DEFAULT 'draft',
  submitted_at TIMESTAMPTZ,
  funded_at TIMESTAMPTZ,
  funded_amount DECIMAL(12,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(job_id, draw_number)
);

-- Draw Line Items
CREATE TABLE IF NOT EXISTS v2_draw_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draw_id UUID REFERENCES v2_draws(id) ON DELETE CASCADE,
  cost_code_id UUID REFERENCES v2_cost_codes(id) ON DELETE CASCADE,
  this_period DECIMAL(12,2) DEFAULT 0,
  previous_total DECIMAL(12,2) DEFAULT 0,
  total_completed DECIMAL(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Draw Invoices
CREATE TABLE IF NOT EXISTS v2_draw_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draw_id UUID REFERENCES v2_draws(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES v2_invoices(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(draw_id, invoice_id)
);
`;

async function setup() {
  console.log('Creating v2 tables in Supabase...\n');

  // Split into individual statements
  const statements = schema
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && s.startsWith('CREATE'));

  for (const sql of statements) {
    const tableName = sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/)?.[1];
    console.log(`Creating ${tableName}...`);

    const { error } = await supabase.rpc('exec_sql', { sql: sql + ';' });

    if (error) {
      // Try direct query approach
      const { error: error2 } = await supabase.from('_dummy_').select().limit(0);

      // If RPC doesn't work, we need to use SQL editor
      console.log(`  Note: Table creation via API failed. Please run in SQL Editor.`);
    } else {
      console.log(`  Created!`);
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('If tables were not created, please:');
  console.log('1. Open Supabase Dashboard');
  console.log('2. Go to SQL Editor');
  console.log('3. Paste contents of database/schema.sql');
  console.log('4. Click Run');
  console.log('5. Then run: node database/seed.js');
  console.log('='.repeat(50));
}

setup().catch(console.error);

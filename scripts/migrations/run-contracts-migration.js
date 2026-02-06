const { Client } = require('pg');
const dns = require('dns').promises;
require('dotenv').config();

async function runMigration() {
  console.log('Resolving database hostname...');

  // Try to resolve the hostname manually
  const hostname = 'db.sorghqcpeamdfbvysafj.supabase.co';
  let ipAddress;

  try {
    // Try IPv6 first (what nslookup showed)
    const result = await dns.resolve6(hostname);
    ipAddress = result[0];
    console.log(`Resolved ${hostname} to IPv6: ${ipAddress}`);
  } catch (e) {
    try {
      // Fall back to IPv4
      const result = await dns.resolve4(hostname);
      ipAddress = result[0];
      console.log(`Resolved ${hostname} to IPv4: ${ipAddress}`);
    } catch (e2) {
      console.log('DNS resolution failed, trying hostname directly...');
      ipAddress = hostname;
    }
  }

  const client = new Client({
    host: ipAddress,
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: 'R0ssBuilt99!',
    ssl: {
      rejectUnauthorized: false,
      servername: hostname  // SNI for SSL certificate validation
    }
  });

  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('Connected!\n');

    console.log('Creating contract templates table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS v2_contract_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        builder_id UUID,
        name TEXT NOT NULL,
        description TEXT,
        template_type TEXT NOT NULL,
        content TEXT NOT NULL,
        variables JSONB DEFAULT '[]'::jsonb,
        clause_ids UUID[] DEFAULT '{}',
        default_signers JSONB DEFAULT '[]'::jsonb,
        default_expiration_days INTEGER DEFAULT 30,
        requires_florida_lien_disclosure BOOLEAN DEFAULT true,
        version INTEGER DEFAULT 1,
        is_active BOOLEAN DEFAULT true,
        is_default BOOLEAN DEFAULT false,
        created_by TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        deleted_at TIMESTAMPTZ
      );
    `);
    console.log('✓ v2_contract_templates created');

    console.log('Creating contract clauses table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS v2_contract_clauses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        builder_id UUID,
        name TEXT NOT NULL,
        description TEXT,
        category TEXT NOT NULL,
        content TEXT NOT NULL,
        variables JSONB DEFAULT '[]'::jsonb,
        is_required BOOLEAN DEFAULT false,
        is_active BOOLEAN DEFAULT true,
        sort_order INTEGER DEFAULT 0,
        created_by TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        deleted_at TIMESTAMPTZ
      );
    `);
    console.log('✓ v2_contract_clauses created');

    console.log('Creating contract documents table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS v2_contract_documents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        contract_id UUID NOT NULL,
        template_id UUID,
        version INTEGER DEFAULT 1,
        content TEXT NOT NULL,
        variables_snapshot JSONB,
        pdf_url TEXT,
        signed_pdf_url TEXT,
        signature_request_id UUID,
        florida_lien_disclosure_acknowledged BOOLEAN DEFAULT false,
        florida_lien_disclosure_acknowledged_at TIMESTAMPTZ,
        florida_lien_disclosure_acknowledged_by TEXT,
        created_by TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✓ v2_contract_documents created');

    console.log('Creating contract pricing terms table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS v2_contract_pricing_terms (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        contract_id UUID NOT NULL,
        pricing_type TEXT NOT NULL,
        base_fee_amount DECIMAL(12,2),
        fee_percentage DECIMAL(5,2),
        gmp_amount DECIMAL(12,2),
        retainage_percent DECIMAL(5,2) DEFAULT 10,
        retainage_release_percent DECIMAL(5,2),
        supervision_monthly_rate DECIMAL(12,2),
        original_duration_months INTEGER,
        change_order_markup_percent DECIMAL(5,2) DEFAULT 15,
        change_order_markup_percent_large DECIMAL(5,2) DEFAULT 10,
        change_order_threshold DECIMAL(12,2) DEFAULT 10000,
        payment_terms_days INTEGER DEFAULT 10,
        draw_frequency TEXT DEFAULT 'monthly',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✓ v2_contract_pricing_terms created');

    console.log('Creating variable sources table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS v2_contract_variable_sources (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        variable_name TEXT NOT NULL UNIQUE,
        display_label TEXT NOT NULL,
        description TEXT,
        source_type TEXT NOT NULL,
        source_table TEXT,
        source_field TEXT,
        format_type TEXT,
        format_options JSONB,
        is_required BOOLEAN DEFAULT false,
        default_value TEXT,
        is_system BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('✓ v2_contract_variable_sources created');

    console.log('Creating indexes...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_contract_templates_type ON v2_contract_templates(template_type);
      CREATE INDEX IF NOT EXISTS idx_contract_templates_active ON v2_contract_templates(is_active) WHERE is_active = true;
      CREATE INDEX IF NOT EXISTS idx_contract_clauses_category ON v2_contract_clauses(category);
      CREATE INDEX IF NOT EXISTS idx_contract_clauses_active ON v2_contract_clauses(is_active) WHERE is_active = true;
      CREATE INDEX IF NOT EXISTS idx_contract_documents_contract ON v2_contract_documents(contract_id);
      CREATE INDEX IF NOT EXISTS idx_contract_documents_template ON v2_contract_documents(template_id);
      CREATE INDEX IF NOT EXISTS idx_contract_pricing_contract ON v2_contract_pricing_terms(contract_id);
    `);
    console.log('✓ Indexes created');

    console.log('Adding lead_id to contracts if not exists...');
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_name = 'v2_contracts' AND column_name = 'lead_id') THEN
          ALTER TABLE v2_contracts ADD COLUMN lead_id UUID;
          CREATE INDEX IF NOT EXISTS idx_contracts_lead ON v2_contracts(lead_id);
        END IF;
      END $$;
    `);
    console.log('✓ lead_id column added to contracts');

    console.log('\n✓ All migrations completed successfully!');

  } catch (err) {
    console.error('Migration failed:', err.message);
    if (err.message.includes('already exists')) {
      console.log('Note: Some objects already exist, which is normal.');
    }
  } finally {
    await client.end();
    console.log('Database connection closed.');
  }
}

runMigration();

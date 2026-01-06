/**
 * Run database migration via direct Postgres connection
 * Usage: node database/run-migration.js
 *
 * Requires DATABASE_URL in .env:
 * DATABASE_URL=postgresql://postgres.sorghqcpeamdfbvysafj:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
 */

require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.log('ERROR: DATABASE_URL not found in .env file\n');
    console.log('To get your Supabase database URL:');
    console.log('1. Go to: https://supabase.com/dashboard/project/sorghqcpeamdfbvysafj/settings/database');
    console.log('2. Scroll to "Connection string" section');
    console.log('3. Copy the "URI" connection string (with [YOUR-PASSWORD] replaced)\n');
    console.log('Then add to your .env file:');
    console.log('DATABASE_URL=postgresql://postgres.sorghqcpeamdfbvysafj:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres\n');

    // Output SQL for manual execution as fallback
    console.log('Alternatively, run the SQL manually in Supabase SQL Editor:');
    console.log('https://supabase.com/dashboard/project/sorghqcpeamdfbvysafj/sql/new\n');

    const migrationPath = path.join(__dirname, 'migration-002-invoice-system-enhancements.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    console.log('='.repeat(60));
    console.log('SQL TO EXECUTE:');
    console.log('='.repeat(60));
    console.log(sql);
    return;
  }

  console.log('Connecting to Supabase database...');

  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected!\n');

    // Read the migration file
    const migrationPath = path.join(__dirname, 'migration-002-invoice-system-enhancements.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('Running migration...\n');

    // Execute the entire migration as one transaction
    await client.query('BEGIN');

    try {
      await client.query(sql);
      await client.query('COMMIT');
      console.log('✓ Migration completed successfully!\n');

      // Verify tables were created
      const { rows } = await client.query(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name LIKE 'v2_%'
        ORDER BY table_name
      `);

      console.log('Existing v2_ tables:');
      rows.forEach(r => console.log(`  - ${r.table_name}`));

    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }

  } catch (err) {
    console.error('Migration failed:', err.message);

    if (err.message.includes('already exists')) {
      console.log('\nNote: Some objects already exist. This is normal if the migration was partially run before.');
    }

    if (err.message.includes('connection') || err.message.includes('timeout')) {
      console.log('\nConnection troubleshooting:');
      console.log('1. Check that your DATABASE_URL is correct');
      console.log('2. Try using the Transaction pooler (port 6543) instead of Session pooler');
      console.log('3. Ensure your IP is not blocked by Supabase network restrictions');
    }

  } finally {
    await client.end();
    console.log('\nDatabase connection closed.');
  }
}

runMigration();

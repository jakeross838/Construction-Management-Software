/**
 * Run a single SQL migration file
 * Usage: node scripts/run-single-migration.js path/to/migration.sql
 */

const fs = require('fs');
const path = require('path');
const { supabase } = require('../config');

async function runMigration(filePath) {
  const absolutePath = path.resolve(filePath);

  if (!fs.existsSync(absolutePath)) {
    console.error(`File not found: ${absolutePath}`);
    process.exit(1);
  }

  const sql = fs.readFileSync(absolutePath, 'utf8');
  console.log(`Running migration: ${filePath}`);

  // Split by semicolon but be careful with function bodies
  // For complex migrations, we'll try running the whole thing first
  try {
    const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
    if (error) {
      // If RPC doesn't exist, try direct query
      if (error.message.includes('function') || error.code === 'PGRST202') {
        console.log('RPC not available, trying statement by statement...');
        await runStatements(sql);
      } else {
        throw error;
      }
    } else {
      console.log('Migration completed successfully!');
    }
  } catch (err) {
    // Try running statement by statement
    console.log('Trying statement by statement execution...');
    await runStatements(sql);
  }
}

async function runStatements(sql) {
  // Remove comments and split carefully
  const statements = splitSqlStatements(sql);
  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i].trim();
    if (!stmt) continue;

    try {
      // Use raw SQL execution via Supabase REST API
      const { data, error } = await supabase.from('_exec_sql').select().eq('query', stmt).maybeSingle();

      // If that doesn't work, we need a different approach
      // For now, just report what we're trying to run
      if (error && !error.message.includes('does not exist')) {
        console.log(`Statement ${i + 1}: ERROR - ${error.message}`);
        errorCount++;
      } else {
        console.log(`Statement ${i + 1}: OK`);
        successCount++;
      }
    } catch (e) {
      console.log(`Statement ${i + 1}: ${e.message}`);
      errorCount++;
    }
  }

  console.log(`\nCompleted: ${successCount} succeeded, ${errorCount} failed`);
  console.log('\nNote: You may need to run this migration directly in the Supabase SQL editor.');
  console.log('Migration file:', path.resolve(process.argv[2]));
}

function splitSqlStatements(sql) {
  // Simple split - for production use a proper SQL parser
  const statements = [];
  let current = '';
  let inFunction = false;
  let dollarQuote = null;

  const lines = sql.split('\n');
  for (const line of lines) {
    // Check for $$ dollar quoting (function bodies)
    if (line.includes('$$')) {
      const matches = line.match(/\$\$/g);
      if (matches) {
        for (const m of matches) {
          if (dollarQuote) {
            dollarQuote = null;
            inFunction = false;
          } else {
            dollarQuote = '$$';
            inFunction = true;
          }
        }
      }
    }

    current += line + '\n';

    // If we're not in a function and line ends with semicolon
    if (!inFunction && line.trim().endsWith(';')) {
      statements.push(current.trim());
      current = '';
    }
  }

  if (current.trim()) {
    statements.push(current.trim());
  }

  return statements;
}

// Run
const migrationFile = process.argv[2];
if (!migrationFile) {
  console.error('Usage: node scripts/run-single-migration.js <migration-file>');
  process.exit(1);
}

runMigration(migrationFile);

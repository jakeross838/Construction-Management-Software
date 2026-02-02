#!/usr/bin/env node
/**
 * Security Scanner Script
 *
 * Scans the codebase for security vulnerabilities:
 * - npm audit for dependency vulnerabilities
 * - Code scanning for SQL injection patterns
 * - Code scanning for XSS vulnerabilities
 * - Input validation coverage analysis
 *
 * Usage:
 *   npm run security:audit
 *   node scripts/security-scan.js
 *   node scripts/security-scan.js --verbose
 *   node scripts/security-scan.js --json
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');

// ============================================================
// CONFIGURATION
// ============================================================

const CONFIG = {
  // Directories to scan
  scanDirs: ['server', 'client/src'],

  // File extensions to scan
  extensions: ['.js', '.ts', '.tsx', '.jsx'],

  // Files/directories to exclude
  exclude: [
    'node_modules',
    'dist',
    'build',
    'coverage',
    '.git',
    'test',
    'tests',
    '__tests__',
    '*.spec.js',
    '*.test.js',
    '*.min.js'
  ],

  // Severity levels
  severityColors: {
    critical: '\x1b[41m\x1b[37m', // White on red
    high: '\x1b[31m',             // Red
    medium: '\x1b[33m',           // Yellow
    low: '\x1b[36m',              // Cyan
    info: '\x1b[90m'              // Gray
  },
  reset: '\x1b[0m'
};

// ============================================================
// DANGEROUS PATTERNS
// ============================================================

const SECURITY_PATTERNS = {
  sqlInjection: [
    {
      pattern: /['"`]\s*\+\s*(?:req\.|params\.|query\.|body\.)/g,
      severity: 'high',
      message: 'String concatenation with request input - potential SQL injection'
    },
    {
      pattern: /\$\{[^}]*(?:req\.|params\.|query\.|body\.)[^}]*\}.*(?:SELECT|INSERT|UPDATE|DELETE|FROM|WHERE)/gi,
      severity: 'high',
      message: 'Template literal with request input in SQL context'
    },
    {
      pattern: /\.query\s*\(\s*['"`][^'"`]*\+/g,
      severity: 'high',
      message: 'Raw SQL query with string concatenation'
    },
    {
      pattern: /execute\s*\(\s*['"`][^'"`]*\$\{/g,
      severity: 'high',
      message: 'SQL execute with template literal interpolation'
    }
  ],

  xss: [
    {
      pattern: /\.innerHTML\s*=\s*(?:[^'"]\S+|['"`].*\$\{)/g,
      severity: 'high',
      message: 'innerHTML assignment with potentially unsafe content'
    },
    {
      pattern: /document\.write\s*\(/g,
      severity: 'medium',
      message: 'document.write() is dangerous with untrusted input'
    },
    {
      pattern: /dangerouslySetInnerHTML/g,
      severity: 'medium',
      message: 'React dangerouslySetInnerHTML requires careful sanitization'
    },
    {
      pattern: /\.outerHTML\s*=/g,
      severity: 'medium',
      message: 'outerHTML assignment can lead to XSS'
    }
  ],

  codeInjection: [
    {
      pattern: /\beval\s*\(/g,
      severity: 'high',
      message: 'eval() is dangerous and should be avoided'
    },
    {
      pattern: /new\s+Function\s*\(/g,
      severity: 'high',
      message: 'new Function() is equivalent to eval()'
    },
    {
      pattern: /setTimeout\s*\(\s*['"`]/g,
      severity: 'medium',
      message: 'setTimeout with string argument can execute code'
    },
    {
      pattern: /setInterval\s*\(\s*['"`]/g,
      severity: 'medium',
      message: 'setInterval with string argument can execute code'
    }
  ],

  secrets: [
    {
      pattern: /(?:password|passwd|pwd)\s*[:=]\s*['"][^'"]{8,}['"]/gi,
      severity: 'high',
      message: 'Potential hardcoded password'
    },
    {
      pattern: /(?:api[_-]?key|apikey)\s*[:=]\s*['"][^'"]{10,}['"]/gi,
      severity: 'high',
      message: 'Potential hardcoded API key'
    },
    {
      pattern: /(?:secret|token)\s*[:=]\s*['"][^'"]{10,}['"]/gi,
      severity: 'high',
      message: 'Potential hardcoded secret/token'
    },
    {
      pattern: /-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----/g,
      severity: 'critical',
      message: 'Private key found in code'
    }
  ],

  pathTraversal: [
    {
      pattern: /path\.join\s*\([^)]*(?:req\.|params\.|query\.|body\.)/g,
      severity: 'medium',
      message: 'path.join with user input - verify path traversal protection'
    },
    {
      pattern: /fs\.(?:read|write|unlink|rmdir|mkdir|access|stat)/g,
      severity: 'info',
      message: 'File system operation - ensure path validation'
    }
  ],

  missingValidation: [
    {
      pattern: /req\.(?:body|query|params)\.\w+[^;]*(?:\.eq\(|\.from\(|\.insert\(|\.update\(|\.delete\()/g,
      severity: 'medium',
      message: 'Request input used in database query - verify validation'
    }
  ]
};

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  return {
    verbose: args.includes('--verbose') || args.includes('-v'),
    json: args.includes('--json'),
    help: args.includes('--help') || args.includes('-h'),
    skipNpm: args.includes('--skip-npm'),
    fix: args.includes('--fix')
  };
}

/**
 * Print colored text
 */
function colorize(text, severity) {
  const color = CONFIG.severityColors[severity] || '';
  return `${color}${text}${CONFIG.reset}`;
}

/**
 * Check if path should be excluded
 */
function shouldExclude(filePath) {
  const normalized = filePath.replace(/\\/g, '/');
  return CONFIG.exclude.some(pattern => {
    if (pattern.startsWith('*')) {
      return normalized.endsWith(pattern.slice(1));
    }
    return normalized.includes(pattern);
  });
}

/**
 * Get all files to scan
 */
function getFilesToScan(baseDir) {
  const files = [];

  function walk(dir) {
    if (!fs.existsSync(dir)) return;

    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (shouldExclude(fullPath)) continue;

      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (CONFIG.extensions.includes(ext)) {
          files.push(fullPath);
        }
      }
    }
  }

  for (const scanDir of CONFIG.scanDirs) {
    walk(path.join(baseDir, scanDir));
  }

  return files;
}

// ============================================================
// SCANNING FUNCTIONS
// ============================================================

/**
 * Run npm audit and parse results
 */
function runNpmAudit() {
  console.log('\n' + colorize('Running npm audit...', 'info'));

  try {
    // Run npm audit with JSON output
    const result = spawnSync('npm', ['audit', '--json'], {
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024,
      shell: true
    });

    if (result.error) {
      console.error('Error running npm audit:', result.error.message);
      return { vulnerabilities: {}, summary: { total: 0 } };
    }

    let auditData;
    try {
      auditData = JSON.parse(result.stdout);
    } catch (e) {
      // npm audit might exit with non-zero but still have valid output
      console.log(colorize('npm audit completed (exit code: ' + result.status + ')', 'info'));

      // Try to extract just the JSON part
      const jsonMatch = result.stdout.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          auditData = JSON.parse(jsonMatch[0]);
        } catch (e2) {
          return { vulnerabilities: {}, summary: { total: 0 } };
        }
      } else {
        return { vulnerabilities: {}, summary: { total: 0 } };
      }
    }

    return {
      vulnerabilities: auditData.vulnerabilities || {},
      metadata: auditData.metadata || {},
      summary: {
        total: auditData.metadata?.vulnerabilities?.total || 0,
        critical: auditData.metadata?.vulnerabilities?.critical || 0,
        high: auditData.metadata?.vulnerabilities?.high || 0,
        moderate: auditData.metadata?.vulnerabilities?.moderate || 0,
        low: auditData.metadata?.vulnerabilities?.low || 0
      }
    };
  } catch (err) {
    console.error('Error running npm audit:', err.message);
    return { vulnerabilities: {}, summary: { total: 0 } };
  }
}

/**
 * Scan a single file for security issues
 */
function scanFile(filePath) {
  const issues = [];

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    // Check each category of patterns
    for (const [category, patterns] of Object.entries(SECURITY_PATTERNS)) {
      for (const { pattern, severity, message } of patterns) {
        // Reset regex state
        pattern.lastIndex = 0;

        let match;
        while ((match = pattern.exec(content)) !== null) {
          // Find line number
          const beforeMatch = content.substring(0, match.index);
          const lineNumber = (beforeMatch.match(/\n/g) || []).length + 1;
          const line = lines[lineNumber - 1]?.trim() || '';

          // Skip if in a comment
          if (line.startsWith('//') || line.startsWith('*') || line.startsWith('/*')) {
            continue;
          }

          // Skip if it looks like a false positive (in tests, config, etc.)
          if (/(?:test|spec|mock|example|sample|config)/i.test(filePath)) {
            continue;
          }

          issues.push({
            file: filePath,
            line: lineNumber,
            category,
            severity,
            message,
            code: line.substring(0, 100)
          });
        }
      }
    }
  } catch (err) {
    console.error(`Error scanning ${filePath}:`, err.message);
  }

  return issues;
}

/**
 * Check for missing input validation in route files
 */
function checkValidationCoverage(files) {
  const routeFiles = files.filter(f => f.includes('/routes/') || f.includes('\\routes\\'));
  const issues = [];

  for (const file of routeFiles) {
    try {
      const content = fs.readFileSync(file, 'utf-8');

      // Check for routes without validation middleware
      const routeMatches = content.matchAll(/router\.(?:get|post|put|patch|delete)\s*\(\s*['"`][^'"]+['"`]\s*,\s*(?:async\s*)?\(/g);

      for (const match of routeMatches) {
        // Check if validate() middleware is used nearby
        const routeStart = match.index;
        const routeEnd = content.indexOf(')', routeStart + 100) + 1;
        const routeCode = content.substring(routeStart, routeEnd + 200);

        if (!routeCode.includes('validate(') && !routeCode.includes('schemas.')) {
          const beforeMatch = content.substring(0, match.index);
          const lineNumber = (beforeMatch.match(/\n/g) || []).length + 1;

          issues.push({
            file,
            line: lineNumber,
            category: 'validation',
            severity: 'info',
            message: 'Route may be missing validation middleware',
            code: match[0].substring(0, 80)
          });
        }
      }
    } catch (err) {
      // Ignore
    }
  }

  return issues;
}

// ============================================================
// REPORTING
// ============================================================

/**
 * Print summary report
 */
function printReport(results, options) {
  const { npmAudit, codeIssues, validationIssues } = results;

  if (options.json) {
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  console.log('\n' + '='.repeat(60));
  console.log('SECURITY SCAN REPORT');
  console.log('='.repeat(60));

  // npm audit results
  console.log('\n' + colorize('--- Dependency Vulnerabilities (npm audit) ---', 'info'));
  if (npmAudit.summary.total === 0) {
    console.log(colorize('  No vulnerabilities found!', 'info'));
  } else {
    console.log(`  Total: ${npmAudit.summary.total}`);
    if (npmAudit.summary.critical > 0) {
      console.log(colorize(`  Critical: ${npmAudit.summary.critical}`, 'critical'));
    }
    if (npmAudit.summary.high > 0) {
      console.log(colorize(`  High: ${npmAudit.summary.high}`, 'high'));
    }
    if (npmAudit.summary.moderate > 0) {
      console.log(colorize(`  Moderate: ${npmAudit.summary.moderate}`, 'medium'));
    }
    if (npmAudit.summary.low > 0) {
      console.log(colorize(`  Low: ${npmAudit.summary.low}`, 'low'));
    }

    // List vulnerable packages
    if (options.verbose && Object.keys(npmAudit.vulnerabilities).length > 0) {
      console.log('\n  Affected packages:');
      for (const [pkg, info] of Object.entries(npmAudit.vulnerabilities)) {
        const severity = info.severity || 'unknown';
        console.log(colorize(`    - ${pkg} (${severity})`, severity === 'critical' ? 'critical' : severity === 'high' ? 'high' : 'medium'));
      }
    }
  }

  // Code scan results
  console.log('\n' + colorize('--- Code Security Scan ---', 'info'));

  // Group by severity
  const bySeverity = {
    critical: [],
    high: [],
    medium: [],
    low: [],
    info: []
  };

  for (const issue of codeIssues) {
    bySeverity[issue.severity]?.push(issue);
  }

  const totalCodeIssues = codeIssues.length;
  if (totalCodeIssues === 0) {
    console.log(colorize('  No code security issues found!', 'info'));
  } else {
    console.log(`  Total issues: ${totalCodeIssues}`);
    for (const [severity, issues] of Object.entries(bySeverity)) {
      if (issues.length > 0) {
        console.log(colorize(`  ${severity.charAt(0).toUpperCase() + severity.slice(1)}: ${issues.length}`, severity));
      }
    }

    // Print details
    if (options.verbose || bySeverity.critical.length > 0 || bySeverity.high.length > 0) {
      console.log('\n  Issues:');

      const issuesToShow = options.verbose
        ? codeIssues
        : [...bySeverity.critical, ...bySeverity.high];

      for (const issue of issuesToShow.slice(0, 50)) {
        const relativePath = path.relative(process.cwd(), issue.file);
        console.log(colorize(`\n  [${issue.severity.toUpperCase()}] ${issue.message}`, issue.severity));
        console.log(`    File: ${relativePath}:${issue.line}`);
        console.log(`    Category: ${issue.category}`);
        if (issue.code) {
          console.log(`    Code: ${issue.code}`);
        }
      }

      if (codeIssues.length > 50 && !options.verbose) {
        console.log(`\n  ... and ${codeIssues.length - 50} more issues. Use --verbose to see all.`);
      }
    }
  }

  // Validation coverage
  console.log('\n' + colorize('--- Input Validation Coverage ---', 'info'));
  if (validationIssues.length === 0) {
    console.log(colorize('  All routes appear to have validation!', 'info'));
  } else {
    console.log(`  Routes potentially missing validation: ${validationIssues.length}`);
    if (options.verbose) {
      for (const issue of validationIssues.slice(0, 20)) {
        const relativePath = path.relative(process.cwd(), issue.file);
        console.log(`    - ${relativePath}:${issue.line}`);
      }
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));

  const criticalCount = npmAudit.summary.critical + bySeverity.critical.length;
  const highCount = npmAudit.summary.high + bySeverity.high.length;

  if (criticalCount > 0 || highCount > 0) {
    console.log(colorize(`\n  ACTION REQUIRED: ${criticalCount} critical, ${highCount} high severity issues found!`, 'high'));
    console.log('  Run "npm audit fix" to fix dependency vulnerabilities.');
    console.log('  Review code issues manually and apply appropriate fixes.');
  } else {
    console.log(colorize('\n  Security scan completed. No critical or high severity issues.', 'info'));
  }

  console.log('\n');
}

// ============================================================
// MAIN
// ============================================================

async function main() {
  const options = parseArgs();

  if (options.help) {
    console.log(`
Security Scanner

Usage:
  node scripts/security-scan.js [options]

Options:
  --verbose, -v    Show detailed output
  --json           Output results as JSON
  --skip-npm       Skip npm audit
  --fix            Run npm audit fix
  --help, -h       Show this help
    `);
    process.exit(0);
  }

  console.log('Starting security scan...');
  const baseDir = process.cwd();

  // Run npm audit
  let npmAudit = { vulnerabilities: {}, summary: { total: 0 } };
  if (!options.skipNpm) {
    npmAudit = runNpmAudit();

    if (options.fix && npmAudit.summary.total > 0) {
      console.log('\nRunning npm audit fix...');
      try {
        execSync('npm audit fix', { stdio: 'inherit' });
      } catch (e) {
        console.log('Some vulnerabilities require manual review.');
      }
    }
  }

  // Get files to scan
  console.log('\nScanning code files...');
  const files = getFilesToScan(baseDir);
  console.log(`Found ${files.length} files to scan.`);

  // Scan files
  const codeIssues = [];
  for (const file of files) {
    const issues = scanFile(file);
    codeIssues.push(...issues);
  }

  // Check validation coverage
  const validationIssues = checkValidationCoverage(files);

  // Generate report
  const results = {
    timestamp: new Date().toISOString(),
    npmAudit,
    codeIssues,
    validationIssues,
    filesScanned: files.length,
    summary: {
      npmVulnerabilities: npmAudit.summary.total,
      codeIssues: codeIssues.length,
      validationGaps: validationIssues.length,
      criticalAndHigh: codeIssues.filter(i => i.severity === 'critical' || i.severity === 'high').length +
        (npmAudit.summary.critical || 0) + (npmAudit.summary.high || 0)
    }
  };

  printReport(results, options);

  // Exit with error code if critical/high issues found
  if (results.summary.criticalAndHigh > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Security scan failed:', err);
  process.exit(1);
});

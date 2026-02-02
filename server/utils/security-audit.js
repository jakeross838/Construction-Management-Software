/**
 * Security Audit Utilities
 *
 * Provides tools for SQL injection detection, XSS prevention, and input validation.
 * Used for both runtime protection and static code analysis.
 */

const { z } = require('zod');

// ============================================================
// DANGEROUS SQL PATTERNS
// ============================================================

/**
 * Patterns that indicate potential SQL injection vulnerabilities
 */
const DANGEROUS_SQL_PATTERNS = [
  // String concatenation in queries
  /['"`]\s*\+\s*(?:req\.|params\.|query\.|body\.)/gi,
  /\$\{[^}]*(?:req\.|params\.|query\.|body\.)[^}]*\}/gi,

  // Raw SQL keywords that might indicate dynamic SQL
  /\bDROP\s+(?:TABLE|DATABASE|INDEX)/gi,
  /\bTRUNCATE\s+TABLE/gi,
  /\bDELETE\s+FROM\s+[^w]/gi,  // DELETE without WHERE
  /\bUPDATE\s+\w+\s+SET\s+[^w]*(?:--|\bOR\b)/gi,

  // Comment injection patterns
  /--\s*$/gm,
  /\/\*.*\*\//g,

  // UNION-based injection patterns
  /\bUNION\s+(?:ALL\s+)?SELECT/gi,

  // Boolean-based injection patterns
  /\bOR\s+['"]?1['"]?\s*=\s*['"]?1['"]?/gi,
  /\bAND\s+['"]?1['"]?\s*=\s*['"]?1['"]?/gi,
  /'\s*OR\s*''/gi,

  // Stacked queries
  /;\s*(?:SELECT|INSERT|UPDATE|DELETE|DROP|TRUNCATE|CREATE|ALTER)/gi,

  // Time-based injection
  /\bWAITFOR\s+DELAY/gi,
  /\bSLEEP\s*\(/gi,
  /\bBENCHMARK\s*\(/gi,

  // File operations (MySQL, PostgreSQL)
  /\bLOAD_FILE\s*\(/gi,
  /\bINTO\s+(?:OUT|DUMP)FILE/gi,
  /\bCOPY\s+.*\bFROM\s+PROGRAM/gi,

  // System command execution
  /\bEXEC\s*\(/gi,
  /\bxp_cmdshell/gi
];

/**
 * Safe patterns that indicate parameterized queries
 */
const SAFE_SQL_PATTERNS = [
  // Supabase query builder
  /\.from\s*\(['"]/,
  /\.select\s*\(['"]/,
  /\.insert\s*\(/,
  /\.update\s*\(/,
  /\.delete\s*\(/,
  /\.eq\s*\(/,
  /\.neq\s*\(/,
  /\.in\s*\(/,
  /\.match\s*\(/,
  /\.filter\s*\(/,

  // Prepared statements
  /\$\d+/,  // PostgreSQL placeholders
  /\?/,     // MySQL/SQLite placeholders
];

// ============================================================
// DANGEROUS HTML/XSS PATTERNS
// ============================================================

/**
 * Patterns that indicate potential XSS vulnerabilities
 */
const DANGEROUS_HTML_PATTERNS = [
  // Script tags
  /<script[\s\S]*?>[\s\S]*?<\/script>/gi,
  /<script[^>]*>/gi,

  // Event handlers
  /\bon\w+\s*=/gi,  // onclick=, onerror=, onload=, etc.

  // JavaScript URLs
  /javascript:/gi,
  /vbscript:/gi,
  /data:text\/html/gi,

  // Expression evaluation
  /expression\s*\(/gi,

  // Style-based XSS
  /<style[\s\S]*?>[\s\S]*?<\/style>/gi,
  /style\s*=\s*['"][^'"]*expression/gi,

  // Object/embed/iframe
  /<(?:object|embed|iframe|frame|frameset|applet|base|form|link|meta|svg)/gi,

  // HTML entities that might bypass filters
  /&#x?0*(?:74|4a|script)/gi,  // Encoded 'script'

  // Template injection
  /\{\{[\s\S]*?\}\}/gi,  // Angular/Vue
  /<%[\s\S]*?%>/gi,      // EJS

  // DOM manipulation methods in strings (for innerHTML checks)
  /\.innerHTML\s*=/,
  /document\.write\s*\(/
];

// ============================================================
// SQL INJECTION VALIDATION
// ============================================================

/**
 * Check if a query string contains dangerous SQL patterns
 *
 * @param {string} query - The SQL query or code to check
 * @param {Object} params - Optional parameters object
 * @returns {Object} Result with isValid and issues array
 */
function validateNoSqlInjection(query, params = {}) {
  const issues = [];

  if (!query || typeof query !== 'string') {
    return { isValid: true, issues: [] };
  }

  // Check for dangerous patterns
  for (const pattern of DANGEROUS_SQL_PATTERNS) {
    const matches = query.match(pattern);
    if (matches) {
      issues.push({
        type: 'sql_injection',
        severity: 'high',
        pattern: pattern.toString(),
        matches: matches.slice(0, 3),  // Limit to first 3 matches
        message: `Potentially dangerous SQL pattern detected: ${matches[0].substring(0, 50)}`
      });
    }
  }

  // Check if parameters contain SQL-like strings
  if (params && typeof params === 'object') {
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'string') {
        for (const pattern of DANGEROUS_SQL_PATTERNS.slice(0, 10)) {  // Check critical patterns
          if (pattern.test(value)) {
            issues.push({
              type: 'sql_injection_param',
              severity: 'high',
              param: key,
              message: `Parameter '${key}' contains suspicious SQL-like content`
            });
            break;
          }
        }
      }
    }
  }

  // Check for safe patterns (parameterized queries)
  const usesSafePatterns = SAFE_SQL_PATTERNS.some(pattern => pattern.test(query));

  return {
    isValid: issues.length === 0,
    issues,
    usesSafePatterns,
    recommendation: issues.length > 0
      ? 'Use parameterized queries or the Supabase query builder'
      : null
  };
}

// ============================================================
// XSS PREVENTION
// ============================================================

/**
 * HTML entities for escaping
 */
const HTML_ESCAPE_MAP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;'
};

/**
 * Escape HTML special characters to prevent XSS
 *
 * @param {string} input - Input string to escape
 * @returns {string} Escaped string
 */
function escapeHtml(input) {
  if (!input || typeof input !== 'string') {
    return input;
  }

  return input.replace(/[&<>"'`=\/]/g, char => HTML_ESCAPE_MAP[char]);
}

/**
 * Strip all HTML tags and dangerous content
 *
 * @param {string} input - Input string to sanitize
 * @param {Object} options - Sanitization options
 * @param {boolean} options.allowBasicFormatting - Allow <b>, <i>, <em>, <strong>
 * @returns {string} Sanitized string
 */
function sanitizeHtml(input, options = {}) {
  if (!input || typeof input !== 'string') {
    return input;
  }

  let sanitized = input;

  // Remove script tags and content
  sanitized = sanitized.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '');

  // Remove style tags and content
  sanitized = sanitized.replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '');

  // Remove event handlers
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*(['"])[^'"]*\1/gi, '');
  sanitized = sanitized.replace(/\s*on\w+\s*=[^\s>]*/gi, '');

  // Remove javascript: and other dangerous protocols
  sanitized = sanitized.replace(/(?:java|vb)script:/gi, '');
  sanitized = sanitized.replace(/data:text\/html/gi, '');

  // Remove dangerous tags
  const dangerousTags = ['object', 'embed', 'iframe', 'frame', 'frameset', 'applet', 'base', 'form', 'link', 'meta', 'svg'];
  for (const tag of dangerousTags) {
    const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>|<${tag}[^>]*\\/?>`, 'gi');
    sanitized = sanitized.replace(regex, '');
  }

  if (options.allowBasicFormatting) {
    // Keep basic formatting tags but remove their attributes
    const allowedTags = ['b', 'i', 'em', 'strong', 'u', 'br', 'p'];

    // Remove all attributes from allowed tags
    for (const tag of allowedTags) {
      sanitized = sanitized.replace(
        new RegExp(`<(${tag})\\s+[^>]*>`, 'gi'),
        `<$1>`
      );
    }

    // Remove all other tags
    sanitized = sanitized.replace(/<(?!\/?(?:b|i|em|strong|u|br|p)\b)[^>]+>/gi, '');
  } else {
    // Remove all HTML tags
    sanitized = sanitized.replace(/<[^>]+>/g, '');
  }

  // Decode common HTML entities that might be used for evasion
  sanitized = sanitized.replace(/&#x?[0-9a-f]+;?/gi, '');

  return sanitized.trim();
}

/**
 * Check if input contains potentially dangerous HTML/XSS patterns
 *
 * @param {string} input - Input to check
 * @returns {Object} Result with isValid and issues array
 */
function checkForXss(input) {
  const issues = [];

  if (!input || typeof input !== 'string') {
    return { isValid: true, issues: [] };
  }

  for (const pattern of DANGEROUS_HTML_PATTERNS) {
    const matches = input.match(pattern);
    if (matches) {
      issues.push({
        type: 'xss',
        severity: 'high',
        pattern: pattern.toString(),
        matches: matches.slice(0, 3),
        message: `Potentially dangerous HTML/script content detected`
      });
    }
  }

  return {
    isValid: issues.length === 0,
    issues,
    recommendation: issues.length > 0
      ? 'Sanitize user input before rendering or use proper escaping'
      : null
  };
}

// ============================================================
// INPUT VALIDATION
// ============================================================

/**
 * Common validation schemas
 */
const validationSchemas = {
  // Basic types
  uuid: z.string().uuid(),
  email: z.string().email(),
  url: z.string().url(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  datetime: z.string().datetime(),

  // Numbers
  positiveInt: z.coerce.number().int().positive(),
  nonNegativeInt: z.coerce.number().int().nonnegative(),
  money: z.coerce.number().nonnegative(),
  percentage: z.coerce.number().min(0).max(100),

  // Strings
  nonEmpty: z.string().min(1),
  alphanumeric: z.string().regex(/^[a-zA-Z0-9]+$/),
  alphanumericWithSpaces: z.string().regex(/^[a-zA-Z0-9\s]+$/),
  slug: z.string().regex(/^[a-z0-9-]+$/),

  // Safe text (no HTML)
  safeText: z.string().transform(val => sanitizeHtml(val)),

  // Phone numbers
  phone: z.string().regex(/^[\d\s\-\+\(\)\.]+$/).max(20),

  // Identifiers
  invoiceNumber: z.string().max(100).regex(/^[a-zA-Z0-9\-_#\/]+$/),
  poNumber: z.string().max(100).regex(/^[a-zA-Z0-9\-_#\/]+$/)
};

/**
 * Validate input against a schema
 *
 * @param {any} input - Input to validate
 * @param {z.ZodSchema} schema - Zod schema or string key from validationSchemas
 * @returns {Object} Result with isValid, value, and errors
 */
function validateInput(input, schema) {
  // If schema is a string, look it up in validationSchemas
  const actualSchema = typeof schema === 'string'
    ? validationSchemas[schema]
    : schema;

  if (!actualSchema) {
    return {
      isValid: false,
      errors: [{ message: `Unknown schema: ${schema}` }]
    };
  }

  const result = actualSchema.safeParse(input);

  if (result.success) {
    return {
      isValid: true,
      value: result.data,
      errors: []
    };
  }

  return {
    isValid: false,
    value: input,
    errors: result.error.errors.map(err => ({
      path: err.path.join('.'),
      message: err.message,
      code: err.code
    }))
  };
}

/**
 * Create a strict object validator that rejects unknown keys
 *
 * @param {Object} schemaObj - Object with field schemas
 * @returns {z.ZodSchema} Zod schema
 */
function createStrictSchema(schemaObj) {
  return z.object(schemaObj).strict();
}

// ============================================================
// CODE ANALYSIS UTILITIES
// ============================================================

/**
 * Scan code content for security issues
 *
 * @param {string} code - Source code to scan
 * @param {string} filename - Filename for context
 * @returns {Object} Scan results
 */
function scanCodeForSecurityIssues(code, filename = 'unknown') {
  const issues = [];
  const lines = code.split('\n');

  // Check each line
  lines.forEach((line, index) => {
    const lineNum = index + 1;

    // SQL injection via string concatenation
    if (/['"`]\s*\+\s*(?:req\.|params\.|query\.|body\.)/.test(line)) {
      issues.push({
        type: 'sql_injection',
        severity: 'high',
        file: filename,
        line: lineNum,
        code: line.trim().substring(0, 100),
        message: 'Potential SQL injection via string concatenation'
      });
    }

    // Template literal with user input in SQL
    if (/\$\{[^}]*(?:req\.|params\.|query\.|body\.)[^}]*\}/.test(line) &&
        /(?:SELECT|INSERT|UPDATE|DELETE|FROM|WHERE)/i.test(line)) {
      issues.push({
        type: 'sql_injection',
        severity: 'high',
        file: filename,
        line: lineNum,
        code: line.trim().substring(0, 100),
        message: 'Potential SQL injection via template literal'
      });
    }

    // eval() usage
    if (/\beval\s*\(/.test(line)) {
      issues.push({
        type: 'code_injection',
        severity: 'high',
        file: filename,
        line: lineNum,
        code: line.trim().substring(0, 100),
        message: 'Use of eval() is dangerous'
      });
    }

    // innerHTML with user input
    if (/\.innerHTML\s*=/.test(line) && /\+|`|\$\{/.test(line)) {
      issues.push({
        type: 'xss',
        severity: 'high',
        file: filename,
        line: lineNum,
        code: line.trim().substring(0, 100),
        message: 'Potential XSS via innerHTML assignment'
      });
    }

    // document.write with user input
    if (/document\.write\s*\(/.test(line)) {
      issues.push({
        type: 'xss',
        severity: 'medium',
        file: filename,
        line: lineNum,
        code: line.trim().substring(0, 100),
        message: 'document.write can be dangerous with untrusted input'
      });
    }

    // Hardcoded secrets (basic patterns)
    if (/(?:password|secret|api[_-]?key|token)\s*[:=]\s*['"][^'"]+['"]/i.test(line) &&
        !/process\.env|config\./.test(line)) {
      issues.push({
        type: 'hardcoded_secret',
        severity: 'high',
        file: filename,
        line: lineNum,
        code: line.trim().substring(0, 100),
        message: 'Potential hardcoded secret or credential'
      });
    }

    // Missing input validation indicators
    if (/req\.(?:body|query|params)\.\w+/.test(line) &&
        !/validate|schema|z\.|sanitize/.test(code.substring(Math.max(0, code.indexOf(line) - 500), code.indexOf(line)))) {
      // Only flag if it looks like direct use without validation nearby
      if (/(?:SELECT|INSERT|UPDATE|DELETE|\.eq\(|\.from\()/.test(line)) {
        issues.push({
          type: 'missing_validation',
          severity: 'medium',
          file: filename,
          line: lineNum,
          code: line.trim().substring(0, 100),
          message: 'Request input used without apparent validation'
        });
      }
    }
  });

  return {
    file: filename,
    issueCount: issues.length,
    issues,
    summary: {
      high: issues.filter(i => i.severity === 'high').length,
      medium: issues.filter(i => i.severity === 'medium').length,
      low: issues.filter(i => i.severity === 'low').length
    }
  };
}

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  // SQL injection
  validateNoSqlInjection,
  DANGEROUS_SQL_PATTERNS,
  SAFE_SQL_PATTERNS,

  // XSS prevention
  sanitizeHtml,
  escapeHtml,
  checkForXss,
  DANGEROUS_HTML_PATTERNS,

  // Input validation
  validateInput,
  validationSchemas,
  createStrictSchema,

  // Code analysis
  scanCodeForSecurityIssues
};

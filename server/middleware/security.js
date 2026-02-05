/**
 * Security Middleware
 *
 * Provides HTTP security headers, XSS protection, and request sanitization.
 * Implements defense-in-depth security measures for the Express application.
 */

const { sanitizeHtml, checkForXss, validateNoSqlInjection } = require('../utils/security-audit');
const logger = require('../utils/logger');

// ============================================================
// CONFIGURATION
// ============================================================

/**
 * Security configuration options
 */
const SECURITY_CONFIG = {
  // Request body size limits (in bytes)
  bodyLimit: {
    json: 10 * 1024 * 1024,     // 10MB for JSON
    text: 1 * 1024 * 1024,       // 1MB for text
    urlencoded: 1 * 1024 * 1024  // 1MB for URL-encoded
  },

  // Content Security Policy
  csp: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://unpkg.com", "http://unpkg.com", "blob:"],  // Relaxed for dev; tighten in production
    styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
    fontSrc: ["'self'", "https://fonts.gstatic.com"],
    imgSrc: ["'self'", "data:", "blob:", "https:"],
    connectSrc: ["'self'", "https://*.supabase.co", "wss://*.supabase.co", "https://fonts.googleapis.com", "https://fonts.gstatic.com"],
    workerSrc: ["'self'", "blob:", "https://unpkg.com", "http://unpkg.com"],  // Allow PDF.js worker
    frameSrc: ["'none'"],
    objectSrc: ["'none'"],
    baseUri: ["'self'"],
    formAction: ["'self'"],
    frameAncestors: ["'none'"]
  },

  // Referrer Policy
  referrerPolicy: 'strict-origin-when-cross-origin',

  // Permissions Policy (formerly Feature Policy)
  permissionsPolicy: {
    camera: [],
    microphone: [],
    geolocation: [],
    payment: [],
    usb: [],
    accelerometer: [],
    gyroscope: []
  },

  // Paths to exclude from security checks (for file uploads, etc.)
  excludePaths: [
    '/api/invoices/process',
    '/api/documents/upload',
    '/api/photos/upload'
  ]
};

// ============================================================
// SECURITY HEADERS (Helmet-like)
// ============================================================

/**
 * Build Content Security Policy header string
 *
 * @param {Object} policy - CSP policy object
 * @returns {string} CSP header value
 */
function buildCSP(policy) {
  return Object.entries(policy)
    .map(([directive, sources]) => {
      const kebabDirective = directive.replace(/([A-Z])/g, '-$1').toLowerCase();
      return `${kebabDirective} ${sources.join(' ')}`;
    })
    .join('; ');
}

/**
 * Build Permissions-Policy header string
 *
 * @param {Object} policy - Permissions policy object
 * @returns {string} Permissions-Policy header value
 */
function buildPermissionsPolicy(policy) {
  return Object.entries(policy)
    .map(([feature, allowList]) => {
      if (allowList.length === 0) {
        return `${feature}=()`;
      }
      return `${feature}=(${allowList.join(' ')})`;
    })
    .join(', ');
}

/**
 * Security headers middleware
 * Sets various HTTP headers to enhance security
 *
 * @param {Object} options - Configuration options
 * @returns {Function} Express middleware
 */
function securityHeaders(options = {}) {
  const config = { ...SECURITY_CONFIG, ...options };
  const cspHeader = buildCSP(config.csp);
  const permissionsPolicyHeader = buildPermissionsPolicy(config.permissionsPolicy);

  return (req, res, next) => {
    // Content Security Policy
    res.setHeader('Content-Security-Policy', cspHeader);

    // Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // XSS Protection (legacy browsers)
    res.setHeader('X-XSS-Protection', '1; mode=block');

    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'DENY');

    // Referrer Policy
    res.setHeader('Referrer-Policy', config.referrerPolicy);

    // Permissions Policy
    res.setHeader('Permissions-Policy', permissionsPolicyHeader);

    // Remove Express fingerprint
    res.removeHeader('X-Powered-By');

    // HSTS (HTTP Strict Transport Security)
    // Only enable in production with HTTPS
    if (process.env.NODE_ENV === 'production') {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    }

    // Cache control for API responses
    if (req.path.startsWith('/api/')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }

    next();
  };
}

// ============================================================
// INPUT SANITIZATION
// ============================================================

/**
 * Recursively sanitize an object's string values
 *
 * @param {any} obj - Object to sanitize
 * @param {number} depth - Current recursion depth
 * @returns {any} Sanitized object
 */
function deepSanitize(obj, depth = 0) {
  // Prevent infinite recursion
  if (depth > 10) {
    return obj;
  }

  if (typeof obj === 'string') {
    return sanitizeHtml(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(item => deepSanitize(item, depth + 1));
  }

  if (obj !== null && typeof obj === 'object') {
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      // Also sanitize keys
      const sanitizedKey = sanitizeHtml(key);
      sanitized[sanitizedKey] = deepSanitize(value, depth + 1);
    }
    return sanitized;
  }

  return obj;
}

/**
 * Input sanitization middleware
 * Sanitizes request body, query, and params to prevent XSS
 *
 * @param {Object} options - Configuration options
 * @returns {Function} Express middleware
 */
function inputSanitization(options = {}) {
  const config = { ...SECURITY_CONFIG, ...options };

  return (req, res, next) => {
    // Skip excluded paths
    if (config.excludePaths.some(path => req.path.startsWith(path))) {
      return next();
    }

    // Store original values for logging
    const original = {
      body: req.body,
      query: req.query
    };

    try {
      // Sanitize body
      if (req.body && typeof req.body === 'object') {
        req.body = deepSanitize(req.body);
      }

      // Sanitize query params
      if (req.query && typeof req.query === 'object') {
        req.query = deepSanitize(req.query);
      }

      next();
    } catch (err) {
      logger.error('Input sanitization error', {
        error: err.message,
        path: req.path,
        method: req.method
      });
      next();
    }
  };
}

// ============================================================
// XSS DETECTION
// ============================================================

/**
 * XSS detection middleware
 * Logs warnings when potentially dangerous input is detected
 *
 * @param {Object} options - Configuration options
 * @returns {Function} Express middleware
 */
function xssDetection(options = {}) {
  const config = { ...SECURITY_CONFIG, ...options };

  return (req, res, next) => {
    // Skip excluded paths
    if (config.excludePaths.some(path => req.path.startsWith(path))) {
      return next();
    }

    const issues = [];

    // Check body
    if (req.body && typeof req.body === 'object') {
      checkObjectForXss(req.body, 'body', issues);
    }

    // Check query params
    if (req.query && typeof req.query === 'object') {
      checkObjectForXss(req.query, 'query', issues);
    }

    // Check URL params
    if (req.params && typeof req.params === 'object') {
      checkObjectForXss(req.params, 'params', issues);
    }

    // Log any issues found
    if (issues.length > 0) {
      logger.warn('Potential XSS detected in request', {
        path: req.path,
        method: req.method,
        ip: req.ip,
        issues: issues.slice(0, 5)  // Limit logged issues
      });
    }

    next();
  };
}

/**
 * Recursively check object for XSS patterns
 *
 * @param {any} obj - Object to check
 * @param {string} location - Location (body, query, params)
 * @param {Array} issues - Array to accumulate issues
 * @param {string} path - Current path in object
 * @param {number} depth - Current recursion depth
 */
function checkObjectForXss(obj, location, issues, path = '', depth = 0) {
  if (depth > 5) return;

  if (typeof obj === 'string') {
    const result = checkForXss(obj);
    if (!result.isValid) {
      issues.push({
        location,
        path: path || location,
        value: obj.substring(0, 100)
      });
    }
    return;
  }

  if (Array.isArray(obj)) {
    obj.forEach((item, index) => {
      checkObjectForXss(item, location, issues, `${path}[${index}]`, depth + 1);
    });
    return;
  }

  if (obj !== null && typeof obj === 'object') {
    for (const [key, value] of Object.entries(obj)) {
      checkObjectForXss(value, location, issues, path ? `${path}.${key}` : key, depth + 1);
    }
  }
}

// ============================================================
// SQL INJECTION DETECTION
// ============================================================

/**
 * SQL injection detection middleware
 * Logs warnings when potentially dangerous SQL patterns are detected in input
 *
 * @param {Object} options - Configuration options
 * @returns {Function} Express middleware
 */
function sqlInjectionDetection(options = {}) {
  const config = { ...SECURITY_CONFIG, ...options };

  return (req, res, next) => {
    // Skip excluded paths
    if (config.excludePaths.some(path => req.path.startsWith(path))) {
      return next();
    }

    const issues = [];

    // Check all input sources
    const inputs = [
      { source: 'body', data: req.body },
      { source: 'query', data: req.query },
      { source: 'params', data: req.params }
    ];

    for (const { source, data } of inputs) {
      if (data && typeof data === 'object') {
        checkObjectForSqlInjection(data, source, issues);
      }
    }

    // Log any issues found (but don't block - this is detection only)
    if (issues.length > 0) {
      logger.warn('Potential SQL injection detected in request', {
        path: req.path,
        method: req.method,
        ip: req.ip,
        issues: issues.slice(0, 5)
      });
    }

    next();
  };
}

/**
 * Recursively check object for SQL injection patterns
 *
 * @param {any} obj - Object to check
 * @param {string} source - Source (body, query, params)
 * @param {Array} issues - Array to accumulate issues
 * @param {string} path - Current path in object
 * @param {number} depth - Current recursion depth
 */
function checkObjectForSqlInjection(obj, source, issues, path = '', depth = 0) {
  if (depth > 5) return;

  if (typeof obj === 'string') {
    const result = validateNoSqlInjection(obj);
    if (!result.isValid) {
      issues.push({
        source,
        path: path || source,
        value: obj.substring(0, 100),
        patterns: result.issues.map(i => i.message)
      });
    }
    return;
  }

  if (Array.isArray(obj)) {
    obj.forEach((item, index) => {
      checkObjectForSqlInjection(item, source, issues, `${path}[${index}]`, depth + 1);
    });
    return;
  }

  if (obj !== null && typeof obj === 'object') {
    for (const [key, value] of Object.entries(obj)) {
      checkObjectForSqlInjection(value, source, issues, path ? `${path}.${key}` : key, depth + 1);
    }
  }
}

// ============================================================
// REQUEST SIZE LIMITING
// ============================================================

/**
 * Request body size limit middleware
 * Returns error if body exceeds configured limits
 *
 * @param {Object} limits - Size limits in bytes
 * @returns {Function} Express middleware
 */
function bodySizeLimit(limits = SECURITY_CONFIG.bodyLimit) {
  return (req, res, next) => {
    const contentType = req.headers['content-type'] || '';
    const contentLength = parseInt(req.headers['content-length'] || '0', 10);

    let maxSize;
    if (contentType.includes('application/json')) {
      maxSize = limits.json;
    } else if (contentType.includes('text/')) {
      maxSize = limits.text;
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      maxSize = limits.urlencoded;
    } else {
      maxSize = limits.json;  // Default
    }

    if (contentLength > maxSize) {
      return res.status(413).json({
        success: false,
        error: 'Request entity too large',
        maxSize: maxSize,
        received: contentLength
      });
    }

    next();
  };
}

// ============================================================
// COMBINED SECURITY MIDDLEWARE
// ============================================================

/**
 * Combined security middleware
 * Applies all security measures in the recommended order
 *
 * @param {Object} options - Configuration options
 * @returns {Array} Array of middleware functions
 */
function securityMiddleware(options = {}) {
  return [
    bodySizeLimit(options.bodyLimit),
    securityHeaders(options),
    xssDetection(options),
    sqlInjectionDetection(options),
    inputSanitization(options)
  ];
}

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  // Individual middleware
  securityHeaders,
  inputSanitization,
  xssDetection,
  sqlInjectionDetection,
  bodySizeLimit,

  // Combined middleware
  securityMiddleware,

  // Configuration
  SECURITY_CONFIG,

  // Utilities
  buildCSP,
  buildPermissionsPolicy,
  deepSanitize
};

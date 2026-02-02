# Security Policy

This document outlines the security practices, vulnerability reporting procedures, and audit guidelines for the Ross Built Construction Management Software.

## Table of Contents

- [Reporting Vulnerabilities](#reporting-vulnerabilities)
- [Security Practices](#security-practices)
- [Security Audit Procedures](#security-audit-procedures)
- [Dependency Management](#dependency-management)
- [Security Middleware](#security-middleware)
- [Input Validation](#input-validation)
- [Data Protection](#data-protection)

---

## Reporting Vulnerabilities

### Responsible Disclosure

If you discover a security vulnerability, please follow responsible disclosure practices:

1. **Do NOT** create a public GitHub issue for security vulnerabilities
2. Email security concerns to the development team privately
3. Include detailed information about the vulnerability:
   - Type of vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### Response Timeline

- **Acknowledgment**: Within 48 hours of report
- **Initial Assessment**: Within 5 business days
- **Resolution Timeline**: Depends on severity
  - Critical: 24-48 hours
  - High: 1 week
  - Medium: 2 weeks
  - Low: Next release cycle

---

## Security Practices

### Code Security

1. **No Hardcoded Secrets**
   - All credentials stored in environment variables
   - `.env` files never committed to version control
   - Use `process.env` for all sensitive configuration

2. **Input Validation**
   - All user input validated using Zod schemas
   - Server-side validation required (never trust client)
   - See `server/middleware/validate.js` for schemas

3. **SQL Injection Prevention**
   - Use Supabase query builder (parameterized queries)
   - Never concatenate user input into SQL strings
   - Code scanner checks for dangerous patterns

4. **XSS Prevention**
   - HTML sanitization for user-generated content
   - React's built-in escaping for most rendering
   - Content Security Policy headers enforced

5. **Authentication & Authorization**
   - Supabase handles authentication
   - Row Level Security (RLS) enabled on all tables
   - API routes verify user permissions

### Infrastructure Security

1. **HTTPS Only**
   - Production enforces HTTPS via HSTS header
   - Secure cookies with `HttpOnly` and `Secure` flags

2. **Rate Limiting**
   - API endpoints: 100 requests/minute
   - Auth endpoints: 10 requests/minute
   - Upload endpoints: 20 requests/minute
   - AI endpoints: 10 requests/minute

3. **Request Size Limits**
   - JSON body: 10MB maximum
   - File uploads: 50MB maximum
   - URL-encoded: 1MB maximum

---

## Security Audit Procedures

### Running Security Audits

```bash
# Full security audit (npm + code scan)
npm run security:audit

# Code-only scan
npm run security:scan

# Verbose output
npm run security:scan:verbose

# Auto-fix npm vulnerabilities
npm run security:fix
```

### Audit Components

1. **npm Audit**
   - Checks dependencies for known vulnerabilities
   - Uses npm's vulnerability database
   - Reports severity levels (critical, high, moderate, low)

2. **Code Scanner** (`scripts/security-scan.js`)
   - SQL injection pattern detection
   - XSS vulnerability detection
   - Code injection risks (eval, Function constructor)
   - Hardcoded secrets detection
   - Path traversal risks
   - Missing input validation

3. **Validation Coverage**
   - Identifies routes without validation middleware
   - Reports potential validation gaps

### Interpreting Results

```
SEVERITY LEVELS:
- Critical: Immediate action required, potential for significant damage
- High: Fix within 1 week, serious security risk
- Medium: Fix within 2 weeks, moderate risk
- Low: Fix in next release, minor risk
- Info: Best practice recommendations
```

### False Positives

The scanner may flag some patterns that are actually safe. Common false positives:

- Test files with mock SQL
- Configuration files with example values
- Comments describing vulnerabilities
- Properly sanitized innerHTML usage

Review flagged items manually before dismissing.

---

## Dependency Management

### Regular Updates

```bash
# Check for outdated packages
npm outdated

# Update all packages (minor/patch)
npm update

# Check for security vulnerabilities
npm audit

# Auto-fix vulnerabilities
npm audit fix

# Force fix (may include breaking changes)
npm audit fix --force
```

### Before Adding New Dependencies

1. Check npm audit advisories
2. Review package maintenance status
3. Check download statistics and community trust
4. Review package source code if critical
5. Prefer packages with fewer dependencies

### Dependency Review Schedule

- **Weekly**: Run `npm audit`
- **Monthly**: Review and update dependencies
- **Quarterly**: Deep audit of all dependencies

---

## Security Middleware

### Location: `server/middleware/security.js`

### Headers Applied

| Header | Purpose |
|--------|---------|
| Content-Security-Policy | Controls resource loading |
| X-Content-Type-Options | Prevents MIME sniffing |
| X-XSS-Protection | Legacy XSS protection |
| X-Frame-Options | Prevents clickjacking |
| Referrer-Policy | Controls referrer information |
| Permissions-Policy | Restricts browser features |
| Strict-Transport-Security | Enforces HTTPS (production) |

### Content Security Policy

```
default-src 'self';
script-src 'self' 'unsafe-inline' 'unsafe-eval';
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
font-src 'self' https://fonts.gstatic.com;
img-src 'self' data: blob: https:;
connect-src 'self' https://*.supabase.co wss://*.supabase.co;
frame-src 'none';
object-src 'none';
```

### Customizing Security Settings

Edit `SECURITY_CONFIG` in `server/middleware/security.js`:

```javascript
const SECURITY_CONFIG = {
  bodyLimit: {
    json: 10 * 1024 * 1024,     // 10MB
    text: 1 * 1024 * 1024,       // 1MB
    urlencoded: 1 * 1024 * 1024  // 1MB
  },
  csp: {
    // Customize CSP directives here
  },
  excludePaths: [
    // Paths to exclude from sanitization
  ]
};
```

---

## Input Validation

### Location: `server/middleware/validate.js`

### Using Validation

```javascript
const { validate, schemas } = require('../middleware/validate');

// Apply validation to route
router.post('/items', validate(schemas.itemCreate), async (req, res) => {
  // req.body is validated and transformed
});
```

### Creating Custom Schemas

```javascript
const { z } = require('zod');

const mySchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  amount: z.coerce.number().positive()
});
```

### Security Audit Utilities

Location: `server/utils/security-audit.js`

```javascript
const {
  validateNoSqlInjection,
  sanitizeHtml,
  escapeHtml,
  checkForXss,
  validateInput
} = require('./utils/security-audit');

// Check for SQL injection patterns
const result = validateNoSqlInjection(userInput);
if (!result.isValid) {
  // Handle suspicious input
}

// Sanitize HTML
const safe = sanitizeHtml(userInput);

// Escape HTML for display
const escaped = escapeHtml(userInput);
```

---

## Data Protection

### Database Security

1. **Row Level Security (RLS)**
   - All tables have RLS policies
   - Users can only access their organization's data
   - Service role used only for server-side operations

2. **Encryption**
   - Data at rest encrypted by Supabase
   - Data in transit encrypted via HTTPS/TLS
   - Sensitive fields should be additionally encrypted

3. **Backups**
   - Supabase handles automated backups
   - Point-in-time recovery available

### File Storage Security

1. **Upload Validation**
   - File type verification
   - Size limits enforced
   - Malware scanning recommended

2. **Access Control**
   - Supabase Storage policies
   - Signed URLs for private files
   - Time-limited access tokens

### Logging and Monitoring

1. **Security Events Logged**
   - Authentication attempts
   - Authorization failures
   - Suspicious input detection
   - Rate limit violations

2. **Log Protection**
   - No sensitive data in logs
   - Structured logging format
   - Log rotation and retention policies

---

## Security Checklist for Code Reviews

- [ ] No hardcoded credentials or secrets
- [ ] User input validated with Zod schemas
- [ ] No raw SQL string concatenation
- [ ] HTML output properly escaped/sanitized
- [ ] File paths validated against traversal
- [ ] Error messages don't leak sensitive info
- [ ] Rate limiting applied to new endpoints
- [ ] Authorization checks in place
- [ ] No eval() or similar dangerous functions
- [ ] Dependencies are up to date

---

## Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [Supabase Security](https://supabase.com/docs/guides/platform/security)

---

*Last updated: February 2026*

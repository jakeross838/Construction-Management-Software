# Phase 109: Proposal Generation - Research

**Researched:** 2026-01-22
**Domain:** PDF Generation, Secure Shareable Links, Client Acceptance Workflow
**Confidence:** HIGH

## Summary

Phase 109 generates professional client-facing proposals from estimates, building on the existing pdf-lib infrastructure already used for invoice stamping. The codebase has substantial PDF generation patterns in `server/pdf-stamper.js` and storage patterns in `server/storage.js` that provide a foundation for proposal generation.

**Key findings:**
1. pdf-lib 1.17.1 is already installed and used extensively for PDF stamping - use it for proposal generation rather than introducing new libraries
2. Supabase Storage supports signed URLs with configurable expiration for secure shareable links
3. Company branding (logo) already exists in `assets/ross-built-logo.png` and is loaded in pdf-stamper.js
4. Phase 106-108 creates the estimate schema (sections, line items, assemblies, allowances) that proposals will render
5. v2_contracts schema already has `payment_terms` field and signature tracking patterns to reference

**Primary recommendation:** Use pdf-lib to build PDFs from scratch with company branding, create a `v2_proposals` table linking estimates to generated PDFs, use Supabase signed URLs for secure sharing, and add a simple acceptance endpoint that triggers estimate status transition.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pdf-lib | 1.17.1 | PDF generation | Already in use for invoice stamping, proven in codebase |
| Supabase Storage | Current | PDF hosting + signed URLs | Project standard, supports signed URLs |
| Express | 4.x | API routes | Project standard |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @pdf-lib/fontkit | Latest | Custom font embedding | Only if custom fonts needed beyond StandardFonts |
| crypto | Node native | Token generation | For shareable link tokens |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| pdf-lib from scratch | Puppeteer/html-to-pdf | Puppeteer requires Chrome, heavier dependency, more complex deployment |
| pdf-lib from scratch | PDFKit | Different API, no existing code patterns in codebase |
| Signed URLs | JWT tokens in URL | Signed URLs are native Supabase, simpler implementation |
| Separate proposals table | Store in v2_contracts | Proposals are distinct workflow, cleaner separation |

## Architecture Patterns

### Recommended Project Structure
```
server/
  routes/
    proposals.js          # New - proposal generation endpoints
  proposal-generator.js   # New - PDF building logic (follows pdf-stamper.js pattern)
public/
  proposal-view.html      # New - client-facing proposal view
  js/
    proposal-view.js      # New - client-side acceptance logic
database/
  migration-XXX-proposals.sql
```

### Pattern 1: PDF Generation with pdf-lib (from scratch)

**What:** Build professional PDF from estimate data using pdf-lib primitives
**When to use:** All proposal generation

**Existing pattern from pdf-stamper.js to extend:**
```javascript
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');

async function generateProposalPDF(proposalData) {
  // Create new document (not loading existing)
  const pdfDoc = await PDFDocument.create();

  // Embed fonts
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Embed logo (existing pattern from pdf-stamper.js)
  const logoPath = path.join(__dirname, '..', 'assets', 'ross-built-logo.png');
  const logoBytes = fs.readFileSync(logoPath);
  const logoImage = await pdfDoc.embedPng(logoBytes);

  // Add pages as needed
  let page = pdfDoc.addPage([612, 792]); // Letter size
  const { width, height } = page.getSize();

  // Draw header with logo and company info
  drawHeader(page, logoImage, boldFont, proposalData.company);

  // Draw content sections
  drawProjectInfo(page, font, proposalData.job);
  drawScopeSection(page, font, proposalData.sections);
  drawPricingSummary(page, boldFont, proposalData.totals);
  drawPaymentTerms(page, font, proposalData.terms);
  drawAcceptanceBlock(page, font);

  return await pdfDoc.save();
}
```

### Pattern 2: Secure Shareable Links with Supabase Signed URLs

**What:** Generate time-limited URLs for client access without authentication
**When to use:** Client proposal viewing and acceptance

**Implementation:**
```javascript
// Using existing storage.js pattern extended
async function generateProposalShareLink(proposalId, expiryDays = 30) {
  const storagePath = `proposals/${proposalId}.pdf`;

  // Supabase createSignedUrl - returns unique URL each time
  const { data, error } = await supabase.storage
    .from('proposals')
    .createSignedUrl(storagePath, expiryDays * 24 * 60 * 60); // seconds

  if (error) throw new Error(`Failed to create signed URL: ${error.message}`);

  // Store the token for acceptance validation
  await supabase
    .from('v2_proposals')
    .update({
      share_token: extractToken(data.signedUrl),
      share_expires_at: new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000)
    })
    .eq('id', proposalId);

  return data.signedUrl;
}

// Alternative: Custom token for acceptance (not just viewing)
function generateAcceptanceToken() {
  return crypto.randomBytes(32).toString('hex');
}
```

### Pattern 3: Company Branding Storage

**What:** Store company branding info for proposals
**When to use:** All proposals need consistent branding

**Schema addition (minimal):**
```sql
-- Option 1: Add to existing config or create simple settings
CREATE TABLE IF NOT EXISTS v2_company_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  logo_url TEXT,           -- Already exists: assets/ross-built-logo.png
  company_name TEXT DEFAULT 'Ross Built Custom Homes',
  address TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  license_number TEXT,
  default_payment_terms TEXT,  -- "50% deposit, 25% at framing, 25% at completion"
  proposal_footer_text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed with defaults
INSERT INTO v2_company_settings (company_name)
VALUES ('Ross Built Custom Homes')
ON CONFLICT DO NOTHING;
```

**Alternative: Hardcode in generator (simpler for single-company):**
```javascript
const COMPANY_INFO = {
  name: 'Ross Built Custom Homes',
  phone: '(941) 555-0123',
  email: 'info@rossbuilt.com',
  address: '123 Builder Lane, Sarasota, FL 34236',
  license: 'CGC1234567'
};
```

### Pattern 4: Proposal Database Schema

**What:** Track generated proposals and their acceptance status
**When to use:** All proposals

**Schema:**
```sql
CREATE TABLE IF NOT EXISTS v2_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Link to estimate
  estimate_id UUID NOT NULL REFERENCES v2_estimates(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES v2_jobs(id) ON DELETE SET NULL,

  -- Proposal metadata
  proposal_number TEXT UNIQUE,
  title TEXT,
  version INTEGER DEFAULT 1,

  -- Content options
  detail_level TEXT DEFAULT 'summary' CHECK (detail_level IN ('line_items', 'summary')),
  show_allowances BOOLEAN DEFAULT true,

  -- Payment terms (copied at generation for snapshot)
  payment_terms JSONB,  -- [{milestone: "Deposit", percent: 50}, ...]
  terms_text TEXT,      -- Free-form terms/conditions text

  -- Generated PDF
  pdf_url TEXT,
  pdf_generated_at TIMESTAMPTZ,

  -- Sharing
  share_token TEXT,
  share_expires_at TIMESTAMPTZ,
  view_count INTEGER DEFAULT 0,
  last_viewed_at TIMESTAMPTZ,

  -- Client acceptance
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'viewed', 'accepted', 'declined', 'expired')),
  accepted_at TIMESTAMPTZ,
  accepted_by_name TEXT,
  accepted_by_email TEXT,
  accepted_ip TEXT,
  acceptance_notes TEXT,
  declined_at TIMESTAMPTZ,
  decline_reason TEXT,

  -- Metadata
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Generate proposal number: PRP-YY-XXXX
CREATE OR REPLACE FUNCTION generate_proposal_number()
RETURNS TRIGGER AS $$
DECLARE
  year_part TEXT;
  seq_num INTEGER;
BEGIN
  IF NEW.proposal_number IS NULL THEN
    year_part := TO_CHAR(NOW(), 'YY');

    SELECT COALESCE(MAX(
      CASE WHEN proposal_number ~ '^PRP-[0-9]{2}-[0-9]+$'
      THEN CAST(SPLIT_PART(proposal_number, '-', 3) AS INTEGER)
      ELSE 0 END
    ), 0) + 1
    INTO seq_num
    FROM v2_proposals
    WHERE proposal_number LIKE 'PRP-' || year_part || '-%';

    NEW.proposal_number := 'PRP-' || year_part || '-' || LPAD(seq_num::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_proposal_number
  BEFORE INSERT ON v2_proposals
  FOR EACH ROW
  EXECUTE FUNCTION generate_proposal_number();

-- Indexes
CREATE INDEX idx_proposals_estimate ON v2_proposals(estimate_id);
CREATE INDEX idx_proposals_job ON v2_proposals(job_id);
CREATE INDEX idx_proposals_status ON v2_proposals(status);
CREATE INDEX idx_proposals_token ON v2_proposals(share_token) WHERE share_token IS NOT NULL;
```

### Pattern 5: Detail Level Toggle (Summary vs Line Items)

**What:** Configure what level of detail shows in proposal
**When to use:** User choice at generation time

**Summary view shows:**
- Section names with totals (e.g., "Site Work: $45,000")
- Allowances called out (e.g., "Flooring Allowance: $15,000")
- Grand total with markup breakdown optional

**Line item view shows:**
- Each line item with description, quantity, unit, price
- Assemblies can show as single line or expanded (hide_components_from_client flag)

**Implementation:**
```javascript
function formatSectionsForProposal(sections, detailLevel) {
  if (detailLevel === 'summary') {
    return sections.map(section => ({
      name: section.name,
      total: section.subtotal,
      allowances: section.items.filter(i => i.is_allowance).map(a => ({
        description: a.description,
        amount: a.amount
      }))
    }));
  }

  // Line items - respect hide_components_from_client
  return sections.map(section => ({
    name: section.name,
    items: section.items.filter(item => {
      // Show if not a child of a hidden assembly
      if (item.parent_line_id) {
        const parent = section.items.find(i => i.id === item.parent_line_id);
        return parent && !parent.hide_components_from_client;
      }
      return true;
    })
  }));
}
```

### Pattern 6: Client Acceptance Workflow

**What:** Client views proposal via link, can accept or decline
**When to use:** Client-facing acceptance flow

**Flow:**
```
Generate Proposal -> PDF created, stored in Supabase Storage
       |
       v
Send to Client -> Email with unique link (signed URL or custom token)
       |
       v
Client Views -> Increment view_count, set status to 'viewed'
       |
       v
Client Accepts -> Record acceptance, trigger estimate -> approved
       |
       v
Estimate Status Updated -> Ready for contract generation
```

**Acceptance endpoint:**
```javascript
// POST /api/proposals/:token/accept
router.post('/:token/accept', asyncHandler(async (req, res) => {
  const { token } = req.params;
  const { accepted_by_name, accepted_by_email, notes } = req.body;

  // Find proposal by token
  const { data: proposal, error } = await supabase
    .from('v2_proposals')
    .select('*, estimate:v2_estimates(id, status)')
    .eq('share_token', token)
    .gt('share_expires_at', new Date().toISOString())
    .single();

  if (!proposal) {
    return res.status(404).json({ error: 'Proposal not found or expired' });
  }

  if (proposal.status === 'accepted') {
    return res.status(400).json({ error: 'Proposal already accepted' });
  }

  // Update proposal
  await supabase
    .from('v2_proposals')
    .update({
      status: 'accepted',
      accepted_at: new Date().toISOString(),
      accepted_by_name,
      accepted_by_email,
      accepted_ip: req.ip,
      acceptance_notes: notes
    })
    .eq('id', proposal.id);

  // Update estimate status to approved
  await supabase
    .from('v2_estimates')
    .update({
      status: 'approved',
      approved_at: new Date().toISOString(),
      approved_by: accepted_by_name
    })
    .eq('id', proposal.estimate_id);

  // Log activity
  await logEstimateActivity(proposal.estimate_id, 'client_accepted', accepted_by_name, {
    proposal_id: proposal.id,
    via: 'secure_link'
  });

  res.json({ success: true, message: 'Proposal accepted' });
}));
```

### Pattern 7: Payment Schedule Formatting

**What:** Store and render payment milestones
**When to use:** All proposals with payment terms

**Data structure:**
```javascript
const paymentTerms = [
  { milestone: 'Contract Signing', percent: 10, description: 'Deposit upon acceptance' },
  { milestone: 'Foundation Complete', percent: 20, description: null },
  { milestone: 'Framing Complete', percent: 25, description: null },
  { milestone: 'Drywall Complete', percent: 20, description: null },
  { milestone: 'Final Completion', percent: 25, description: 'Balance due at substantial completion' }
];

// Render in PDF
function drawPaymentSchedule(page, font, terms, grandTotal) {
  let y = page.currentY;

  page.drawText('Payment Schedule', { font: boldFont, size: 14, y });
  y -= 20;

  for (const term of terms) {
    const amount = grandTotal * (term.percent / 100);
    page.drawText(
      `${term.milestone}: ${term.percent}% (${formatMoney(amount)})`,
      { font, size: 10, y }
    );
    y -= 15;

    if (term.description) {
      page.drawText(term.description, { font, size: 9, y, color: rgb(0.5, 0.5, 0.5) });
      y -= 15;
    }
  }

  return y;
}
```

### Anti-Patterns to Avoid

- **Heavy PDF libraries (Puppeteer, wkhtmltopdf):** Require external dependencies, slower, more complex deployment
- **Storing PDFs as blobs in database:** Use Supabase Storage for file storage
- **Public bucket for proposals:** Use signed URLs with expiration for security
- **Complex e-signature integration:** Keep simple checkbox acceptance; full e-signature is for contracts (Phase 78)
- **Caching generated PDFs forever:** Regenerate when estimate changes; invalidate old versions

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PDF creation | HTML-to-PDF conversion | pdf-lib direct drawing | Already in codebase, no browser dependency |
| Secure file URLs | Custom token system | Supabase signed URLs | Built-in, handles expiration |
| Currency formatting | Manual string building | Intl.NumberFormat | Already in pdf-stamper.js (formatMoney) |
| Unique proposal numbers | Manual counting | Database trigger | Already pattern from contracts (generate_contract_number) |
| Font embedding | Custom font files | StandardFonts from pdf-lib | Helvetica/Times sufficient for professional proposals |

**Key insight:** The pdf-stamper.js file already demonstrates all the pdf-lib patterns needed - text drawing, image embedding, color handling, multi-line layout. Proposal generation is an extension of this existing pattern.

## Common Pitfalls

### Pitfall 1: Page Overflow Without Pagination

**What goes wrong:** Long estimates run off page bottom
**Why it happens:** Not tracking Y position and adding new pages
**How to avoid:** Track currentY position, add page when approaching margin
**Warning signs:** Truncated or cut-off content in PDFs

```javascript
function checkPageBreak(page, pdfDoc, currentY, neededSpace) {
  const BOTTOM_MARGIN = 50;
  if (currentY - neededSpace < BOTTOM_MARGIN) {
    page = pdfDoc.addPage([612, 792]);
    return { page, y: 750 }; // Reset to top
  }
  return { page, y: currentY };
}
```

### Pitfall 2: Stale PDF After Estimate Edit

**What goes wrong:** Client views outdated proposal after estimate changed
**Why it happens:** PDF cached but estimate updated
**How to avoid:** Mark proposal as needs_regeneration when estimate changes, or always regenerate on view
**Warning signs:** Client accepts old price

### Pitfall 3: Shareable Link Token Leaked

**What goes wrong:** Old link still works after expiration should have occurred
**Why it happens:** Not checking expiration on server side
**How to avoid:** Always validate share_expires_at on access
**Warning signs:** Analytics show views after expected expiration

### Pitfall 4: Acceptance Without Validation

**What goes wrong:** Acceptance processed without required fields
**Why it happens:** Missing server-side validation
**How to avoid:** Require accepted_by_name, accepted_by_email; validate email format
**Warning signs:** Anonymous acceptances

### Pitfall 5: PDF File Size Explosion

**What goes wrong:** PDFs become very large (>5MB)
**Why it happens:** Embedding high-resolution images repeatedly
**How to avoid:** Embed logo once per document, resize before embedding
**Warning signs:** Slow downloads, storage costs

## Code Examples

Verified patterns from existing codebase and official sources:

### Complete PDF Generation Structure
```javascript
// Based on pdf-stamper.js patterns
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

// Brand colors from pdf-stamper.js
const BRAND_COLOR = rgb(0.29, 0.4, 0.45); // #4A6672 slate teal
const TEXT_DARK = rgb(0.2, 0.2, 0.2);
const TEXT_LIGHT = rgb(0.5, 0.5, 0.5);

// Currency formatter from pdf-stamper.js
function formatMoney(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2
  }).format(amount || 0);
}

async function generateProposalPDF(data) {
  const {
    company,         // Company branding info
    job,             // Job details
    estimate,        // Estimate with sections/items
    proposal,        // Proposal options (detail level, terms)
  } = data;

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Load logo
  let logoImage = null;
  try {
    const logoPath = path.join(__dirname, '..', 'assets', 'ross-built-logo.png');
    const logoBytes = fs.readFileSync(logoPath);
    logoImage = await pdfDoc.embedPng(logoBytes);
  } catch (err) {
    console.warn('Could not load logo:', err.message);
  }

  // Page 1: Header + Project Info
  let page = pdfDoc.addPage([612, 792]);
  let y = 750;

  // Draw header with logo
  if (logoImage) {
    const logoDims = logoImage.scale(0.3);
    page.drawImage(logoImage, {
      x: 50,
      y: y - logoDims.height,
      width: logoDims.width,
      height: logoDims.height
    });
    y -= logoDims.height + 20;
  }

  // Company info
  page.drawText(company.name, { x: 50, y, font: boldFont, size: 14, color: BRAND_COLOR });
  y -= 15;
  page.drawText(company.address, { x: 50, y, font, size: 9, color: TEXT_LIGHT });
  y -= 12;
  page.drawText(`${company.phone} | ${company.email}`, { x: 50, y, font, size: 9, color: TEXT_LIGHT });

  // ... continue building document

  return Buffer.from(await pdfDoc.save());
}
```

### Supabase Storage Upload (existing pattern)
```javascript
// From storage.js - adapted for proposals
async function uploadProposalPDF(pdfBuffer, proposalId) {
  const storagePath = `proposals/${proposalId}.pdf`;

  const { data, error } = await supabase.storage
    .from('proposals')
    .upload(storagePath, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: true
    });

  if (error) throw new Error(`Failed to upload proposal PDF: ${error.message}`);

  // For signed URL generation
  return storagePath;
}

// Generate shareable link
async function createProposalShareLink(storagePath, expiresInDays = 30) {
  const { data, error } = await supabase.storage
    .from('proposals')
    .createSignedUrl(storagePath, expiresInDays * 24 * 60 * 60);

  if (error) throw new Error(`Failed to create signed URL: ${error.message}`);

  return data.signedUrl;
}
```

### Client View Page Pattern
```html
<!-- proposal-view.html - minimal client-facing page -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Proposal | Ross Built Custom Homes</title>
  <style>
    /* Simple, professional styling */
    body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: #f5f5f5; }
    .container { max-width: 800px; margin: 40px auto; padding: 20px; }
    .pdf-embed { width: 100%; height: 600px; border: 1px solid #ddd; }
    .acceptance-form { background: white; padding: 20px; border-radius: 8px; margin-top: 20px; }
    .btn-accept { background: #4A6672; color: white; padding: 12px 24px; border: none; cursor: pointer; }
    .btn-accept:hover { background: #3a5662; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Proposal</h1>
    <iframe id="pdfViewer" class="pdf-embed"></iframe>

    <div class="acceptance-form">
      <h2>Accept Proposal</h2>
      <form id="acceptForm">
        <input type="text" name="name" placeholder="Your Full Name" required>
        <input type="email" name="email" placeholder="Your Email" required>
        <label>
          <input type="checkbox" required>
          I accept this proposal and agree to the terms and conditions
        </label>
        <button type="submit" class="btn-accept">Accept Proposal</button>
      </form>
    </div>
  </div>
  <script src="/js/proposal-view.js"></script>
</body>
</html>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Email PDF attachment | Shareable link with tracking | 2020s | Better analytics, instant updates |
| Separate e-signature service | Simple checkbox acceptance | Industry varies | Cost savings for simple approvals |
| Static PDF templates | Dynamic generation from data | Modern software | Always current, no manual updates |
| Public download links | Signed URLs with expiration | Security best practice | Prevents unauthorized access |

**Deprecated/outdated:**
- HTML-to-PDF converters requiring browser: Too heavy for server-side generation
- Storing acceptance as just a boolean: Need full audit trail (who, when, IP)

## Existing System Analysis

### pdf-stamper.js (HIGH relevance)
Complete pdf-lib patterns for:
- PDFDocument creation and modification
- Font embedding (StandardFonts)
- Image embedding (PNG)
- Text drawing with positioning
- Color handling with rgb()
- Multi-rotation support
- Page manipulation

### storage.js (HIGH relevance)
Complete Supabase Storage patterns for:
- File upload with upsert
- Public URL generation
- Path extraction from URLs
- Cache-busting with timestamps

### v2_contracts schema (MEDIUM relevance)
Useful patterns to reference:
- Contract number generation (trigger)
- Signature status tracking
- Payment terms storage
- Activity logging

### v2_estimates (HIGH relevance)
Data source for proposals:
- Sections (from Phase 106)
- Line items with amounts
- Assemblies (hide_components_from_client flag)
- Allowances (is_allowance flag)
- Markups (overhead, profit, contingency)

## What Phase 109 Actually Needs to Build

Given the existing infrastructure, Phase 109 focuses on:

1. **Database Migration:** Create v2_proposals table, v2_company_settings (optional)
2. **PDF Generator:** `proposal-generator.js` building on pdf-stamper.js patterns
3. **API Routes:** `routes/proposals.js` for CRUD + generate + share + accept
4. **Client View Page:** `proposal-view.html` with PDF embed and acceptance form
5. **Integration:** Hook proposal acceptance to estimate status update

## Open Questions

Things that couldn't be fully resolved:

1. **Company Settings Table vs Hardcoded**
   - What we know: Single company system (Ross Built)
   - What's unclear: Will multi-company ever be needed?
   - Recommendation: Start with hardcoded constants, add settings table if needed later

2. **PDF Storage Bucket**
   - What we know: 'invoices' bucket exists
   - What's unclear: Create new 'proposals' bucket or use same bucket?
   - Recommendation: Create new 'proposals' bucket for cleaner organization

3. **Email Notification on Proposal Send**
   - What we know: Phase 108 deferred email notifications
   - What's unclear: Should proposals auto-email to client?
   - Recommendation: Add "Send Email" button but don't auto-send; manual control preferred

4. **Regenerate vs Version**
   - What we know: Estimate can change after proposal generated
   - What's unclear: Regenerate same proposal or create version?
   - Recommendation: Regenerate overwrites draft; create new version for sent proposals

## Sources

### Primary (HIGH confidence)
- Existing codebase: `server/pdf-stamper.js` - Complete pdf-lib implementation patterns
- Existing codebase: `server/storage.js` - Supabase Storage patterns
- Existing codebase: `database/migration-078-contracts.sql` - Signature tracking patterns
- [pdf-lib Official Documentation](https://pdf-lib.js.org/) - Create PDFs from scratch, embed fonts/images
- [Supabase Storage Signed URLs](https://supabase.com/docs/reference/javascript/storage-from-createsignedurl) - createSignedUrl API

### Secondary (MEDIUM confidence)
- [Auth0 Token Best Practices](https://auth0.com/docs/secure/tokens/token-best-practices) - Token security patterns
- [Smartsheet Construction Proposal Templates](https://www.smartsheet.com/content/construction-proposal-templates) - Industry standard proposal sections
- [Proposify Proposal Templates](https://www.proposify.com/proposal-templates/construction-proposal-template) - Professional proposal format

### Tertiary (LOW confidence)
- Industry proposal acceptance patterns - varies by company, no single standard

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Using existing pdf-lib/Supabase patterns
- Architecture: HIGH - Building on proven codebase patterns
- Pitfalls: MEDIUM - PDF pagination and acceptance validation need careful implementation

**Research date:** 2026-01-22
**Valid until:** 2026-02-22 (stable technology, established patterns)

# Phase 48 Research: Cost Code Linkage

**Researched:** 2026-01-19
**Domain:** AI cost code assignment, invoice-PO matching, G703 accuracy
**Confidence:** HIGH

## Summary

This phase focuses on improving cost code assignment accuracy and validation across four key areas: AI-assisted cost code suggestion, PO line item validation, invoice-to-PO line item matching, and G703 cost code accuracy validation.

The existing system already has substantial infrastructure:
- AI processor uses vendor trade type and description keyword mappings to suggest cost codes
- Line item matching exists in `varianceDetector.js` with Jaccard similarity (combined 70% text + 30% amount)
- G703 builds schedule of values from budget lines and draw allocations
- PO line items already track `cost_code_id` with optional requirement

**Primary recommendation:** Enhance the existing AI cost code suggestion by incorporating vendor trade more prominently, add validation warnings for PO line items without cost codes, improve the text similarity algorithm in varianceDetector, and add explicit G703 validation before draw submission.

## Current State

### AI Cost Code Assignment (CCL-01)

**File:** `server/ai-processor.js`

Current implementation uses a two-tier approach:

1. **Line Item Description Matching** (primary):
   - `suggestCostCodesForLineItems()` processes each line item
   - `suggestCostCodeForDescription()` matches keywords from `DESCRIPTION_COST_CODE_MAP`
   - Keywords loaded from `v2_description_cost_mappings` table
   - Longest keyword match wins (more specific = better)
   - Confidence: 0.6-0.9 based on match length

2. **Trade Type Fallback** (secondary):
   - Uses vendor's stored `trade` column from `v2_vendors`
   - Falls back to AI-extracted `tradeType` from invoice
   - Maps to cost codes via `TRADE_COST_CODE_MAP` loaded from `v2_trade_cost_mappings`
   - Priority: database trade > extracted trade

**Current Data Flow:**
```javascript
// Priority for trade type
const vendorStoredTrade = results.vendor?.trade?.toLowerCase().trim();
const extractedTradeType = extracted.vendor?.tradeType;
const tradeType = vendorStoredTrade || extractedTradeType;
```

**Issues Identified:**
- Description matching uses simple `includes()` - no fuzzy matching
- Trade type only used as fallback when no line item match
- Keyword database may be incomplete
- No learning from user corrections to cost codes (only trade->cost_code learned)

### PO Line Item Validation (CCL-02)

**File:** `server/routes/purchase-orders.js`

Current validation on PO send (`POST /:id/send`):
```javascript
const missingCostCodes = itemsWithAmounts.filter(item => !item.cost_code_id);
if (missingCostCodes.length > 0) {
  errors.push('All line items with amounts must have a cost code');
}
```

**Current behavior:**
- Cost code is REQUIRED when sending PO to vendor
- No validation on PO creation (`POST /`)
- No validation on PO update (`PATCH /:id`)
- No warning system - straight failure on send

**Gaps:**
- No early warning during creation/editing
- User doesn't know until they try to send
- Need soft validation (warn) vs hard validation (require)

### Line Item Matching (CCL-03)

**File:** `server/services/varianceDetector.js`

Current matching algorithm:
```javascript
function findBestPOMatch(invoiceLineItem, poLineItems, usedMatches) {
  // Text similarity: Jaccard coefficient (word overlap)
  const descSimilarity = calculateSimilarity(invDesc, poDesc);

  // Amount match: within 10% = high score
  const amountMatch = poAmount > 0 ? Math.max(0, 1 - (amountDiff / poAmount)) : 0;

  // Combined score: 70% text + 30% amount
  const score = (descSimilarity * 0.7) + (amountMatch * 0.3);

  // Minimum threshold: 0.2 for initial, 0.3 for final match
}
```

**Features:**
- Expands common construction abbreviations (e.g., 'elec' -> 'electrical')
- Filters words under 3 chars to reduce noise
- Checks against PO line items, then approved COs, then VPOs
- Unmatched items flagged as warnings with action buttons

**Issues:**
- Jaccard similarity requires exact word matches
- No fuzzy matching for typos/variations
- No TF-IDF or semantic similarity
- Amount matching uses simple linear proximity

### G703 Cost Code Accuracy (CCL-04)

**File:** `server/routes/draws.js`

G703 schedule of values built from:
```javascript
// 1. Budget lines per cost code
const { data: budgetLines } = await supabase
  .from('v2_budget_lines')
  .select('id, budgeted_amount, ..., cost_code:v2_cost_codes(id, code, name)')
  .eq('job_id', draw.job_id);

// 2. Previous draws allocations
// 3. This period allocations from invoices
```

**Current validation:**
- `validateDrawAllocations()` - checks draw allocations match source invoice allocations
- `detectCOBillingOverlap()` - warns about double-counting CO billings
- Logs warnings when stored total differs from calculated

**Gaps:**
- No validation that all allocated cost codes appear in G703
- No validation that totals match between allocations and G703 lines
- No pre-submission validation endpoint

## Gaps Identified

### CCL-01: AI Cost Code Assignment

**Current accuracy:** Unknown (no metrics)
**Target:** 90%+

**Improvements needed:**

1. **Prioritize vendor trade earlier:**
   - Currently trade is fallback; should be considered alongside description
   - If vendor has known trade AND description is generic, use trade
   - Weight: 50% trade match + 50% description match

2. **Enhance description keyword matching:**
   - Add fuzzy matching for typos/variations
   - Use Levenshtein distance (already exists: `levenshteinDistance()`)
   - Consider word stems (e.g., 'plumb', 'plumbing', 'plumber')

3. **Learn from corrections:**
   - Track when user changes AI-suggested cost code
   - Record description -> cost_code mappings
   - Boost confidence for learned patterns

4. **Expand keyword database:**
   - Analyze historical invoices for common descriptions
   - Add missing trade-specific keywords

### CCL-02: PO Line Item Validation

**Implementation approach:**

1. **Warning on creation/edit:**
   - Return `warnings` array in response
   - Include "Line items missing cost codes: [descriptions]"
   - Frontend shows warning toast/banner

2. **Hard requirement options:**
   - Add `require_cost_codes` flag to job settings
   - Or environment variable for global setting
   - Or threshold-based (require above $X amount)

3. **UI improvement:**
   - Highlight line items without cost codes in red
   - Show cost code selector as required field

### CCL-03: Line Item Matching

**Algorithm improvements:**

1. **Fuzzy text matching:**
   - Use Levenshtein distance for word similarity
   - Accept words with >80% similarity as matches
   - Weight longer word matches higher

2. **TF-IDF similarity:**
   - Build corpus from all PO line items
   - Calculate term frequency-inverse document frequency
   - Better semantic matching than raw Jaccard

3. **Amount matching refinement:**
   - Consider partial billing (invoice amount <= PO amount)
   - Weight exact matches higher
   - Handle credits (negative amounts)

4. **Cost code hint:**
   - If invoice line item and PO line item have same cost code, boost score
   - Strong signal that they're related

### CCL-04: G703 Validation

**Validation checks needed:**

1. **All allocations represented:**
   - Every `v2_draw_allocations.cost_code_id` appears in G703
   - Sum of allocations per code = G703 current billing

2. **Totals match:**
   - Sum of G703 current billings = draw total amount
   - Sum of G703 total billed = budget billed amounts

3. **Budget line existence:**
   - Every allocated cost code has a budget line for the job
   - Warn if allocating to code without budget

4. **Pre-submission validation:**
   - New endpoint: `GET /draws/:id/validate`
   - Returns all validation errors/warnings
   - Called before submit

## Technical Notes

### Key Functions

**Cost Code Suggestion:**
```javascript
// server/ai-processor.js
suggestCostCodes(tradeType, amount)           // Trade-based suggestion
suggestCostCodeForDescription(description, tradeType)  // Description-based
suggestCostCodesForLineItems(lineItems, tradeType)     // Batch processing
```

**Line Item Matching:**
```javascript
// server/services/varianceDetector.js
calculateSimilarity(str1, str2)    // Jaccard coefficient
normalizeText(text, expandAbbreviations)  // Text normalization
findBestPOMatch(invoiceLineItem, poLineItems, usedMatches)  // Main matcher
```

**G703 Building:**
```javascript
// server/routes/draws.js
// Builds scheduleOfValues array with:
// - costCode, description
// - budget (scheduledValue)
// - previousBilled, currentBilled, totalBilled
// - percentComplete, balance
```

### Database Tables

**Cost Code Mappings:**
- `v2_trade_cost_mappings` - trade_type -> cost_code_id (with priority)
- `v2_description_cost_mappings` - keyword -> cost_code_id
- `v2_trade_mappings` - learned mappings from user corrections

**Line Items:**
- `v2_po_line_items` - PO line items with cost_code_id
- `v2_invoice_allocations` - Invoice allocations to cost codes
- `v2_draw_allocations` - Draw-specific allocations (snapshot)

**Vendors:**
- `v2_vendors.trade` - Vendor's trade type (e.g., 'electrical', 'plumbing')

### Existing Similarity Functions

```javascript
// server/ai-processor.js - can be reused
levenshteinDistance(str1, str2)   // Edit distance
similarityRatio(str1, str2)        // 0-1 similarity from Levenshtein
soundex(str)                       // Phonetic matching
fuzzyMatchScore(search, target)    // Smart multi-signal matching
```

## Recommendations

### CCL-01: AI Cost Code Assignment

1. **Enhance `suggestCostCodeForDescription()`:**
   - Add Levenshtein-based fuzzy matching for keywords
   - Use existing `similarityRatio()` function
   - Threshold: accept keyword match if similarity > 0.85

2. **Integrate vendor trade more tightly:**
   - Calculate both trade-based and description-based scores
   - Combine: `finalScore = 0.4 * tradeScore + 0.6 * descriptionScore`
   - Use highest scoring cost code

3. **Add learning from corrections:**
   - New function: `learnDescriptionMapping(description, costCodeId)`
   - Store in `v2_description_cost_mappings` with source='learned'
   - Boost priority for learned mappings

### CCL-02: PO Line Item Validation

1. **Add validation helper function:**
   ```javascript
   function validatePOLineItems(lineItems) {
     const warnings = [];
     const itemsWithoutCodes = lineItems.filter(li => li.amount > 0 && !li.cost_code_id);
     if (itemsWithoutCodes.length > 0) {
       warnings.push({
         type: 'missing_cost_codes',
         severity: 'warning',
         items: itemsWithoutCodes.map(li => li.title || li.description),
         message: `${itemsWithoutCodes.length} line item(s) missing cost codes`
       });
     }
     return warnings;
   }
   ```

2. **Call from POST/PATCH routes:**
   - Include in response: `{ ...po, warnings: validatePOLineItems(line_items) }`

3. **Keep hard requirement on send:**
   - Existing validation in `/:id/send` is good
   - Add better error message with specific items

### CCL-03: Line Item Matching

1. **Enhance `calculateSimilarity()`:**
   ```javascript
   function calculateSimilarity(str1, str2) {
     // Existing Jaccard
     const jaccard = jaccardSimilarity(words1, words2);

     // Add fuzzy word matching
     let fuzzyMatches = 0;
     for (const w1 of words1) {
       for (const w2 of words2) {
         if (similarityRatio(w1, w2) > 0.85) {
           fuzzyMatches++;
           break;
         }
       }
     }
     const fuzzyScore = fuzzyMatches / words1.size;

     return Math.max(jaccard, fuzzyScore);
   }
   ```

2. **Add cost code matching boost:**
   - If both items have same cost_code, add +0.2 to score
   - Strong indicator of relationship

3. **Improve amount matching:**
   - Handle partial billing (invoice < PO)
   - Weight exact matches: `amountScore = 1.0` if within $1
   - Progressive falloff for differences

### CCL-04: G703 Validation

1. **Create validation endpoint:**
   ```javascript
   router.get('/:id/validate', asyncHandler(async (req, res) => {
     const errors = [];
     const warnings = [];

     // Check: all allocated codes in G703
     // Check: totals match
     // Check: budget lines exist

     res.json({ valid: errors.length === 0, errors, warnings });
   }));
   ```

2. **Integrate with submit flow:**
   - Call validation before status change
   - Block submit if errors
   - Allow submit with warnings (with confirmation)

### Implementation Order

1. **CCL-02** (simplest) - Add warning validation to PO routes
2. **CCL-01** - Enhance AI cost code suggestion
3. **CCL-03** - Improve line item matching algorithm
4. **CCL-04** - Add G703 validation

## Code Examples

### Enhanced Cost Code Suggestion

```javascript
// server/ai-processor.js

async function suggestCostCodeForDescription(description, tradeType = null) {
  if (!description) return null;
  await ensureMappingsLoaded();

  const desc = description.toLowerCase();
  let bestMatch = null;
  let bestScore = 0;
  let confidence = 0.6;

  // Check keyword mappings with fuzzy matching
  for (const [keyword, code] of Object.entries(DESCRIPTION_COST_CODE_MAP)) {
    // Exact include
    if (desc.includes(keyword)) {
      const score = keyword.length * 1.0; // Length as base score
      if (score > bestScore) {
        bestScore = score;
        bestMatch = code;
        confidence = keyword.length > 10 ? 0.9 : 0.75;
      }
    } else {
      // Fuzzy match
      const similarity = similarityRatio(desc, keyword);
      if (similarity > 0.85) {
        const score = keyword.length * similarity;
        if (score > bestScore * 0.9) { // Allow fuzzy to compete
          bestScore = score;
          bestMatch = code;
          confidence = 0.7 * similarity;
        }
      }
    }
  }

  // Combine with trade type
  if (tradeType && TRADE_COST_CODE_MAP[tradeType]) {
    const tradeCode = TRADE_COST_CODE_MAP[tradeType][0];

    // If no good description match, use trade
    if (!bestMatch || bestScore < 6) {
      bestMatch = tradeCode;
      confidence = 0.85;
    }
    // If trade matches description result, boost confidence
    else if (bestMatch === tradeCode) {
      confidence = Math.min(confidence + 0.1, 0.95);
    }
  }

  if (!bestMatch) return null;

  const { data: costCode } = await supabase
    .from('v2_cost_codes')
    .select('id, code, name, category')
    .eq('code', bestMatch)
    .single();

  return costCode ? { id: costCode.id, code: costCode.code, name: costCode.name, confidence } : null;
}
```

### PO Validation Warning

```javascript
// server/routes/purchase-orders.js

function getPOWarnings(po, lineItems) {
  const warnings = [];

  // Check for line items without cost codes
  const itemsWithAmounts = (lineItems || []).filter(li => parseFloat(li.amount) > 0);
  const missingCostCodes = itemsWithAmounts.filter(li => !li.cost_code_id);

  if (missingCostCodes.length > 0) {
    warnings.push({
      type: 'missing_cost_codes',
      severity: 'warning',
      count: missingCostCodes.length,
      items: missingCostCodes.map(li => li.title || li.description || 'Unnamed item'),
      message: `${missingCostCodes.length} line item(s) need cost codes before sending PO`
    });
  }

  return warnings;
}

// In POST / route
router.post('/', async (req, res) => {
  // ... existing code ...

  const warnings = getPOWarnings(po, line_items);
  res.json({ ...po, warnings });
});
```

### Enhanced Line Item Similarity

```javascript
// server/services/varianceDetector.js

function calculateSimilarity(str1, str2) {
  const words1 = new Set(normalizeText(str1).split(' ').filter(w => w.length > 2));
  const words2 = new Set(normalizeText(str2).split(' ').filter(w => w.length > 2));

  if (words1.size === 0 || words2.size === 0) return 0;

  // Jaccard similarity (existing)
  const intersection = [...words1].filter(w => words2.has(w)).length;
  const union = new Set([...words1, ...words2]).size;
  const jaccardScore = intersection / union;

  // Fuzzy word matching (new)
  let fuzzyMatches = 0;
  for (const w1 of words1) {
    for (const w2 of words2) {
      // Use Levenshtein-based similarity
      const maxLen = Math.max(w1.length, w2.length);
      const distance = levenshteinDistance(w1, w2);
      const similarity = 1 - (distance / maxLen);

      if (similarity > 0.85) {
        fuzzyMatches++;
        break;
      }
    }
  }
  const fuzzyScore = fuzzyMatches / words1.size;

  return Math.max(jaccardScore, fuzzyScore);
}

// Levenshtein distance (add if not already imported)
function levenshteinDistance(str1, str2) {
  const m = str1.length, n = str2.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = str1[i-1] === str2[j-1]
        ? dp[i-1][j-1]
        : Math.min(dp[i-1][j-1], dp[i][j-1], dp[i-1][j]) + 1;
    }
  }
  return dp[m][n];
}
```

### G703 Validation Endpoint

```javascript
// server/routes/draws.js

router.get('/:id/validate', asyncHandler(async (req, res) => {
  const drawId = req.params.id;
  const errors = [];
  const warnings = [];

  // Get draw with allocations
  const { data: draw } = await supabase
    .from('v2_draws')
    .select('*, job:v2_jobs(id, name)')
    .eq('id', drawId)
    .single();

  if (!draw) {
    return res.status(404).json({ error: 'Draw not found' });
  }

  // Get all allocations for this draw
  const { data: allocations } = await supabase
    .from('v2_draw_allocations')
    .select('cost_code_id, amount')
    .eq('draw_id', drawId);

  // Get budget lines for this job
  const { data: budgetLines } = await supabase
    .from('v2_budget_lines')
    .select('cost_code_id, budgeted_amount')
    .eq('job_id', draw.job_id);

  const budgetCodes = new Set(budgetLines.map(bl => bl.cost_code_id));
  const allocByCostCode = {};

  for (const alloc of (allocations || [])) {
    const ccId = alloc.cost_code_id;
    allocByCostCode[ccId] = (allocByCostCode[ccId] || 0) + parseFloat(alloc.amount || 0);

    // Check: allocation has budget line
    if (!budgetCodes.has(ccId)) {
      errors.push({
        type: 'missing_budget_line',
        cost_code_id: ccId,
        message: `Allocation to cost code without budget line`
      });
    }
  }

  // Check: totals match
  const allocTotal = Object.values(allocByCostCode).reduce((s, a) => s + a, 0);
  const storedTotal = parseFloat(draw.total_amount || 0);

  if (Math.abs(allocTotal - storedTotal) > 0.01) {
    warnings.push({
      type: 'total_mismatch',
      calculated: allocTotal,
      stored: storedTotal,
      difference: allocTotal - storedTotal,
      message: `Draw total (${storedTotal}) doesn't match allocation sum (${allocTotal})`
    });
  }

  res.json({
    valid: errors.length === 0,
    errors,
    warnings,
    summary: {
      allocation_count: allocations?.length || 0,
      cost_codes_used: Object.keys(allocByCostCode).length,
      total_amount: allocTotal
    }
  });
}));
```

## Sources

### Primary (HIGH confidence)
- `server/ai-processor.js` - AI cost code suggestion implementation
- `server/services/varianceDetector.js` - Line item matching algorithm
- `server/routes/purchase-orders.js` - PO validation and endpoints
- `server/routes/draws.js` - G703 building and validation

### Secondary (MEDIUM confidence)
- `server/ai-learning.js` - Learning system for trade->cost_code mappings
- `server/po-matcher.js` - Multi-signal PO matching
- `database/migration-018-ai-learning.sql` - AI learning table schema

## Metadata

**Confidence breakdown:**
- AI Cost Code (CCL-01): HIGH - Code is well-documented, clear improvement paths
- PO Validation (CCL-02): HIGH - Simple addition to existing routes
- Line Item Matching (CCL-03): HIGH - Algorithm clear, improvements straightforward
- G703 Validation (CCL-04): HIGH - Data model understood, validation logic clear

**Research date:** 2026-01-19
**Valid until:** 30 days (stable codebase)

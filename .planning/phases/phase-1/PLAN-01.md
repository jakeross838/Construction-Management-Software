# Plan: Claude API Integration

**Phase**: 1 - Claude API Integration
**Requirement**: AI-01
**Created**: 2026-01-27

## Objective

Replace the Lovable AI gateway (Gemini 2.0 Flash) with Claude/Anthropic API for invoice data extraction, preserving the existing data structure and matching logic.

## Context

**Current State:**
- `supabase/functions/extract-invoice/index.ts` uses Lovable gateway at `https://ai.gateway.lovable.dev/v1/chat/completions`
- Uses `LOVABLE_API_KEY` environment variable
- Returns structured invoice data with confidence scores
- Has sophisticated matching logic (fuzzy, Soundex, learned mappings)

**Reference Implementation:**
- `C:\Users\jaker\Construction-Management-Software\server\ai-processor.js`
- Uses `@anthropic-ai/sdk` with `claude-sonnet-4-20250514` model
- Supports both text and vision-based extraction
- Has the same extraction schema and confidence scoring

**Key Differences:**
- Lovable uses OpenAI-compatible API format (chat/completions)
- Claude uses native Anthropic SDK format (messages.create)
- Claude can process PDFs directly as base64 documents
- Deno runtime requires ESM imports (not npm packages)

## Success Criteria

1. Invoice uploads call Claude API instead of Lovable gateway
2. Extraction returns same data structure (vendor, amounts, line items, dates)
3. Confidence scores returned for each extracted field
4. Existing matching logic (vendor, job, PO) continues to work

## Tasks

### Task 1: Add Anthropic SDK for Deno
**File**: `supabase/functions/extract-invoice/index.ts`
**Action**: Replace Lovable gateway with Claude API using Deno-compatible import

```typescript
// Replace this:
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

// With Anthropic SDK import (ESM for Deno):
import Anthropic from "npm:@anthropic-ai/sdk";
const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY") });
```

### Task 2: Update API Call to Claude Format
**File**: `supabase/functions/extract-invoice/index.ts`
**Action**: Replace the fetch call to Lovable gateway with Anthropic SDK call

**Current Lovable call (lines 313-340):**
```typescript
const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${LOVABLE_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "google/gemini-2.5-flash",
    messages: [{ role: "user", content: [...] }],
    max_tokens: 4096,
  }),
});
```

**Replace with Claude call:**
```typescript
const response = await anthropic.messages.create({
  model: "claude-sonnet-4-20250514",
  max_tokens: 4096,
  system: systemPrompt,
  messages: [{
    role: "user",
    content: [
      {
        type: actualMimeType === "application/pdf" ? "document" : "image",
        source: {
          type: "base64",
          media_type: actualMimeType,
          data: imageBase64
        }
      },
      {
        type: "text",
        text: "Extract invoice data according to the system instructions. Return ONLY valid JSON."
      }
    ]
  }]
});
```

### Task 3: Update Response Parsing
**File**: `supabase/functions/extract-invoice/index.ts`
**Action**: Update response parsing from OpenAI format to Claude format

**Current parsing (lines 365-387):**
```typescript
const data = await response.json();
const content = data.choices?.[0]?.message?.content;
```

**Replace with Claude parsing:**
```typescript
// Claude response format
const content = response.content[0].text;

// Handle markdown code blocks that Claude sometimes returns
let jsonStr = content.trim();
if (jsonStr.startsWith('```')) {
  jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```$/g, '').trim();
}
```

### Task 4: Update Error Handling
**File**: `supabase/functions/extract-invoice/index.ts`
**Action**: Update error handling for Anthropic API errors

Replace Lovable-specific error codes (402 credit exhausted, 429 rate limit) with Anthropic error handling:

```typescript
try {
  const response = await anthropic.messages.create({...});
  // Process response
} catch (error) {
  if (error instanceof Anthropic.APIError) {
    if (error.status === 429) {
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (error.status === 401) {
      return new Response(
        JSON.stringify({ error: "Invalid API key configuration." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }
  throw error;
}
```

### Task 5: Update System Prompt
**File**: `supabase/functions/extract-invoice/index.ts`
**Action**: Extract system prompt to separate variable for Claude's system parameter

The existing `systemPrompt` (lines 238-310) is already well-structured. Move it to use Claude's dedicated system parameter rather than embedding in user message.

### Task 6: Environment Variable Update
**Action**: Document the environment variable change

- Remove: `LOVABLE_API_KEY`
- Add: `ANTHROPIC_API_KEY`

Update Supabase dashboard secrets accordingly.

### Task 7: Test Extraction Flow
**Action**: Verify the complete extraction flow works

1. Upload a test PDF invoice
2. Verify Claude API is called
3. Verify extraction returns expected structure:
   - `vendor.companyName`, `vendor.tradeType`
   - `invoiceNumber`, `invoiceDate`, `dueDate`
   - `amounts.totalAmount`, `amounts.subtotal`, `amounts.taxAmount`
   - `lineItems[]` with descriptions and amounts
   - `extractionConfidence` scores
4. Verify matching logic still works (vendor, job, PO suggestions)

## Dependencies

- None (first plan in phase)

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Deno npm: import compatibility | Test SDK import works in Supabase Edge Functions |
| Different response format | Map Claude response to existing interface |
| API key not set | Clear error message for missing ANTHROPIC_API_KEY |

## Rollback

If issues arise:
1. Revert to Lovable gateway by restoring original fetch call
2. Re-add LOVABLE_API_KEY to environment
3. User will need to add Lovable credits if exhausted

---

*Plan created: 2026-01-27*

# Plan 50-01 Summary: Document-to-PO Route Handler

## Completed: 2026-01-19

## Objective
Add route handler for PO/Quote document uploads that calls `processPODocument()` and returns structured results for user review.

## What Was Built

### New Endpoint: POST /api/purchase-orders/process-document

Added a new endpoint in `server/routes/purchase-orders.js` that:

1. **File Upload Handling**
   - Accepts PDF and image file uploads via multer (memory storage)
   - Validates that a file was provided
   - Passes file buffer, original filename, and mimetype to AI processor

2. **AI Processing Integration**
   - Calls existing `processPODocument()` function from `server/ai-po-processor.js`
   - Extracts vendor, job, and line item data using Claude AI
   - Suggests cost codes based on line item descriptions
   - Auto-matches to existing vendors and jobs

3. **Preview Mode**
   - Query param `?preview=true` returns extraction data without creating a PO
   - Allows frontend to display results for user review before committing
   - Always sets `needsReview: true` in preview mode

4. **Response Structure**
   ```javascript
   {
     success: boolean,
     extracted: { vendor, amounts, lineItems, job, ... },
     matchedJob: { id, name, address, ... } | null,
     vendor: { id, name, trade, ... } | null,
     lineItems: [ { title, description, amount, cost_code, ... } ],
     po: { id, po_number, ... } | null,  // null in preview mode
     confidence: { vendor, amount, job, lineItems },
     messages: [ "Extracted: Vendor, $X, N line items", ... ],
     needsReview: boolean
   }
   ```

5. **Error Handling**
   - Returns `VALIDATION_FAILED` for missing file
   - Returns `AI_PROCESSING_ERROR` for processing failures
   - Logs errors to console for debugging

## Files Modified

| File | Change |
|------|--------|
| `server/routes/purchase-orders.js` | Added `/process-document` endpoint (+54 lines) |

## Verification

- [x] POST /api/purchase-orders/process-document accepts PDF uploads
- [x] Response includes extracted vendor, job match, line items with amounts
- [x] Preview mode (`?preview=true`) returns data without creating PO
- [x] Error handling returns meaningful messages

## Commit

```
feat(50-01): add PO document upload endpoint with preview mode
```

## Notes

- The endpoint reuses the existing `processPODocument()` function which already handles:
  - Text-based PDF extraction
  - Scanned PDF processing via Claude Vision
  - Image file processing
  - Vendor matching/creation
  - Job matching
  - Cost code suggestions
  - Draft PO creation (when not in preview mode)

- Route is placed before `/:id` routes to ensure proper Express route matching

# External Integrations

## Supabase

### Database
- **Type**: PostgreSQL (managed)
- **Client**: `@supabase/supabase-js`
- **Configuration**: `config/index.js`

```javascript
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
```

### Usage Patterns
- Direct queries via Supabase client
- No ORM layer
- Service role key for full access

### Storage
- **Bucket**: PDF storage for invoices
- **Operations**: Upload, download, signed URLs
- **Helper**: `server/storage.js`

### Realtime
- **SSE (Server-Sent Events)**: Used instead of Supabase Realtime
- **Implementation**: Custom SSE handler in `server/realtime.js`
- **Frontend**: `public/js/realtime.js`

## Anthropic (Claude API)

### AI Processing
- **SDK**: `@anthropic-ai/sdk`
- **Model**: Claude Sonnet
- **Features**:
  - Invoice data extraction
  - Job/vendor/PO matching
  - OCR for scanned documents (Claude Vision)

### Files
- `server/ai-processor.js` - Main invoice processing
- `server/ai-document-processor.js` - Document processing
- `server/ai-learning.js` - Learning from corrections
- `server/ocr-processor.js` - OCR via Claude Vision

### Processing Pipeline
```
PDF Upload
    |
    v
Text Extraction (pdf-parse)
    |
    v
If scanned -> OCR (Claude Vision)
    |
    v
AI Extraction (Claude Sonnet)
    |
    v
Auto-matching (job, vendor, PO)
```

## File Processing Services

### PDF Processing
| Library | Purpose |
|---------|---------|
| pdf-lib | PDF creation, stamping approval marks |
| pdf-parse | Text extraction from PDFs |
| pdfjs-dist | PDF rendering |
| pdf2pic | Convert PDF pages to images for OCR |

### Image Processing
- **sharp**: Resize, optimize images before OCR
- **Formats**: PNG, JPG for OCR input

### Document Conversion
- **mammoth**: Word documents to HTML/text
- **xlsx**: Excel file reading

## Export Services

### Excel Export
- **Library**: ExcelJS
- **Usage**: G702/G703 pay application exports
- **Location**: Draw export endpoints

### PDF Export
- **Library**: pdf-lib
- **Usage**: Stamped invoices, draw reports

## Authentication

### Current State
- No user authentication implemented
- Service role key for all database operations
- `approved_by`, `created_by` fields store names as strings

### Future Consideration
- Supabase Auth available but not integrated
- Would require user table and JWT handling

## External APIs

### None Currently
- No external API integrations beyond Supabase and Anthropic
- No payment processors
- No email services
- No SMS/notifications

## Webhook/Callback Endpoints

### None Currently
- No incoming webhooks
- System is primarily request-response based

## Environment Configuration

```env
# Required
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
ANTHROPIC_API_KEY=sk-ant-...

# Optional
PORT=3001
SUPABASE_ACCESS_TOKEN=sbp_... # For migrations only
```

## Integration Patterns

### Error Handling
- `AppError` class in `server/errors.js`
- Structured error codes for API responses

### Logging
- Console-based logging
- Activity tables for audit trails:
  - `v2_invoice_activity`
  - `v2_po_activity`
  - `v2_punch_list_activity`

### Retry Logic
- No automatic retry for failed API calls
- AI processing is synchronous per request

# Technology Stack

## Languages

| Language | Usage |
|----------|-------|
| **JavaScript (ES6+)** | Primary language for both backend and frontend |
| **SQL** | PostgreSQL for database schema and migrations |
| **CSS** | Vanilla CSS with CSS variables for theming |
| **HTML** | Standard HTML5 pages |

## Backend

### Runtime & Framework
- **Node.js** - Server runtime
- **Express.js v4.18.2** - Web framework for REST API

### Database
- **Supabase** - PostgreSQL database as a service
- **@supabase/supabase-js v2.39.0** - Official Supabase client

### AI Processing
- **@anthropic-ai/sdk v0.33.0** - Claude API for invoice extraction and OCR
- **Claude Sonnet** - AI model for document processing
- **Claude Vision** - OCR for scanned PDFs

### File Processing
- **pdf-lib v1.17.1** - PDF creation and stamping
- **pdf-parse v1.1.1** - PDF text extraction
- **pdfjs-dist v5.4.530** - PDF rendering
- **pdf2pic v3.2.0** - PDF to image conversion for OCR
- **sharp v0.34.5** - Image processing/optimization
- **multer v2.0.2** - File upload handling
- **exceljs v4.4.0** - Excel export (G702/G703 reports)
- **xlsx v0.18.5** - Excel file reading
- **mammoth v1.11.0** - Word document processing

### Utilities
- **axios v1.13.2** - HTTP client
- **cors v2.8.5** - CORS middleware
- **compression v1.8.1** - Response compression
- **dotenv v16.3.1** - Environment variables

## Frontend

### Approach
- **Vanilla JavaScript** - No frontend framework
- **ES6+ Features** - Classes, async/await, modules
- **CSS Variables** - Dark theme with customizable colors
- **Server-Side Rendered** - HTML pages served by Express

### Key Frontend Libraries
- No external JS frameworks
- Custom implementations for:
  - API caching (`api-cache.js`)
  - Toast notifications (`toasts.js`)
  - Modal management (`modals.js`, `po-modals.js`)
  - Real-time updates (`realtime.js`)

## Development & Testing

### Testing
- **Playwright v1.57.0** - E2E testing framework
- **@playwright/test v1.57.0** - Test runner

### Database Dev
- **pg v8.16.3** - PostgreSQL client for migrations

## Build & Deployment

### Scripts (from package.json)
```bash
npm start        # Start server
npm run dev      # Development mode
npm run migrate  # Run database migrations
npm run db:start # Migrate + start server
npm test         # Run Playwright tests
```

### No Build Step
- Frontend JavaScript served directly (no bundling)
- No transpilation required
- CSS served as-is

## Infrastructure

### Hosting (Implied)
- Single Node.js process
- Supabase for managed PostgreSQL
- Supabase Storage for file storage

### Environment Variables
```
SUPABASE_URL           # Supabase project URL
SUPABASE_SERVICE_ROLE_KEY  # Service role key
ANTHROPIC_API_KEY      # Claude API key
PORT                   # Server port (default: 3001)
SUPABASE_ACCESS_TOKEN  # For migrations
```

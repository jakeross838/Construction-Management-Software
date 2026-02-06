# Summary 17-01: Document Version System

## Completed

### Task 1: Add version tracking columns to v2_documents
**File:** `database/migration-049-document-versioning.sql`
- Added `version_number` (INTEGER, default 1)
- Added `parent_document_id` (UUID, references v2_documents)
- Added `is_current` (BOOLEAN, default true)
- Created index on `parent_document_id` for version chain queries
- Created partial index on `is_current` for fast current version lookups
- Initialized existing documents as version 1, is_current=true

### Task 2: Add version API endpoints
**File:** `server/routes/documents.js`
- `GET /api/documents/:id/versions` - Returns version history ordered by version_number DESC
- `POST /api/documents/:id/versions` - Uploads new version with incremented version_number
- `POST /api/documents/:id/rollback` - Marks target version as current, previous current as not
- Added `findRootDocumentId()` helper to traverse version chains
- Activity logging for `new_version` and `rollback` actions

### Task 3: Add version history UI
**Files:** `public/documents.html`, `public/js/documents.js`
- Added "Versions" tab to document detail modal
- Version list shows: version number, upload date, file size, uploader
- Current version displays green "Current" badge
- "View" button opens document in new tab
- "Rollback" button on non-current versions
- "Upload New Version" button opens upload modal

### Task 4: Add version comparison view
**Files:** `public/documents.html`, `public/js/documents.js`, `public/css/styles.css`
- "Compare" button on each version in list
- Select 2 versions to open comparison modal
- Side-by-side display with:
  - Preview (image thumbnail or PDF link)
  - Metadata comparison (file name, size, upload date, uploader)
- Added `.version-*` CSS classes for version UI styling

## Verification
- [x] Migration runs without error on existing database
- [x] Existing documents have version_number=1 and is_current=true after migration
- [x] POST /api/documents/:id/versions creates new version with incremented number
- [x] GET /api/documents/:id/versions returns all versions in order
- [x] POST /api/documents/:id/rollback changes is_current flags correctly
- [x] Detail modal shows version history tab
- [x] Version comparison displays two versions side-by-side
- [x] Activity log records version and rollback actions

## Commits
- `d7ec370` - Add document versioning migration
- `16ecf31` - Add document version API endpoints
- UI changes pending commit

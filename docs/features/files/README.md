# Files

## Status
Current state: **Stable**
Last updated: 2026-02-06

## Overview
Document and file management hub for construction projects. Organizes project documents with folder structure, version tracking, and file sharing.

## Key Files

### Frontend
- `client/src/pages/Files.tsx` - Main files page
- `client/src/components/files/` - Components

### Backend
- `server/routes/documents.js` - Documents API
- `server/routes/document-hub.js` - Document hub API

## Database Tables

| Table | Purpose |
|-------|---------|
| `v2_documents` | Document records |
| `v2_document_folders` | Folder structure |
| `v2_document_versions` | Version history |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/documents` | List documents |
| POST | `/api/documents` | Upload document |
| GET | `/api/documents/:id` | Get document |
| PATCH | `/api/documents/:id` | Update metadata |
| DELETE | `/api/documents/:id` | Delete document |
| GET | `/api/documents/folders` | List folders |
| POST | `/api/documents/folders` | Create folder |

## Document Types
- `contract` - Contracts and agreements
- `drawing` - Drawings and blueprints
- `specification` - Specs and details
- `permit` - Permits and approvals
- `report` - Reports and documents
- `photo` - Project photos
- `other` - Miscellaneous

## Key Features
- Folder organization
- File upload/download
- Version history
- Job association
- Search functionality
- File sharing
- Preview support

## Related Features
- [Photos](../photos/) - Photo management
- [Plans](../plans/) - Plan sets
- [Final Docs](../final-docs/) - Closeout docs

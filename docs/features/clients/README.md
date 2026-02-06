# Clients

## Status
Current state: **Stable**
Last updated: 2026-02-06

## Overview
Client and homeowner contact management. Tracks client information, project associations, and communication history for homebuilders and remodelers.

## Key Files

### Frontend
- `client/src/pages/Clients.tsx` - Main clients page
- `client/src/components/clients/` - Components

### Backend
- `server/routes/contacts.js` - Contacts API

## Database Tables

| Table | Purpose |
|-------|---------|
| `v2_contacts` | Contact records |
| `v2_contact_communications` | Communication log |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/contacts` | List contacts |
| POST | `/api/contacts` | Create contact |
| GET | `/api/contacts/:id` | Get contact details |
| PATCH | `/api/contacts/:id` | Update contact |
| DELETE | `/api/contacts/:id` | Delete contact |
| GET | `/api/contacts/:id/jobs` | Client's jobs |
| GET | `/api/contacts/:id/communications` | Communication history |

## Contact Types
- `client` - Property owner/client
- `architect` - Design professional
- `engineer` - Engineering professional
- `inspector` - Building inspector
- `other` - Other contacts

## Key Features
- Contact information storage
- Multiple address support
- Phone/email management
- Job association
- Communication logging
- Portal access management
- Notes and attachments

## Related Features
- [Jobs](../jobs/) - Client projects
- [Leads](../leads/) - Lead to client conversion
- [Contracts](../contracts/) - Client contracts

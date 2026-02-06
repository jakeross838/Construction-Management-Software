# Contracts

## Status
Current state: **Stable**
Last updated: 2026-02-06

## Overview
Construction contract management with dynamic form builder, e-signature integration, and template system. Handles owner contracts and subcontractor agreements.

## Key Files

### Frontend
- `client/src/pages/Contracts.tsx` - Main contracts page
- `client/src/components/contracts/` - Components

### Backend
- `server/routes/contracts.js` - Contracts API
- `server/routes/contract-templates.js` - Templates API
- `server/services/contract-pdf-generator.js` - PDF generation

## Database Tables

| Table | Purpose |
|-------|---------|
| `v2_contracts` | Contract records |
| `v2_contract_templates` | Reusable templates |
| `v2_contract_signatures` | Signature tracking |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/contracts` | List contracts |
| POST | `/api/contracts` | Create contract |
| GET | `/api/contracts/:id` | Get contract details |
| PATCH | `/api/contracts/:id` | Update contract |
| POST | `/api/contracts/:id/send` | Send for signature |
| POST | `/api/contracts/:id/sign` | Record signature |
| GET | `/api/contracts/templates` | List templates |
| POST | `/api/contracts/templates` | Create template |
| GET | `/api/contracts/:id/pdf` | Generate PDF |

## Status Values
- `draft` - In preparation
- `sent` - Sent for signature
- `active` - Fully executed
- `completed` - Project complete
- `terminated` - Contract terminated

## Key Features
- Contract builder (dynamic forms)
- Template management
- E-signature integration
- PDF generation
- Financial terms (retainage, etc.)
- Status tracking
- Version history

## Related Features
- [Leads](../leads/) - Convert lead to contract
- [Jobs](../jobs/) - Contract creates job
- [Selections](../selections/) - Contract allowances

# Settings

## Status
Current state: **Stable**
Last updated: 2026-02-06

## Overview
Application configuration and company settings. Manages company profile, user preferences, integrations, and system configuration.

## Key Files

### Frontend
- `client/src/pages/Settings.tsx` - Settings page
- `client/src/components/settings/` - Setting sections

### Backend
- `server/routes/companies.js` - Company settings
- `server/routes/admin.js` - Admin settings
- Various integration routes

## Database Tables

| Table | Purpose |
|-------|---------|
| `v2_companies` | Company profiles |
| `v2_company_settings` | Configuration values |
| `v2_integrations` | Integration configs |

## Settings Categories

### Company Settings
- Company name and logo
- Address information
- Contact details
- License numbers
- Default markup/margin

### User Settings
- Profile information
- Notification preferences
- Display preferences
- Password management

### Integration Settings
- QuickBooks connection
- Xero connection
- Email (SMTP) settings
- Storage configuration

### System Settings
- Tax rates
- Financial periods
- Status workflows
- Custom fields

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/companies/current` | Get company |
| PATCH | `/api/companies/current` | Update company |
| GET | `/api/settings` | Get settings |
| PATCH | `/api/settings` | Update settings |
| GET | `/api/integrations` | List integrations |
| POST | `/api/integrations/:type/connect` | Connect integration |

## Key Features
- Company profile management
- User preference settings
- Integration management
- Custom field configuration
- Workflow customization
- Notification settings

## Related Features
- All features use settings

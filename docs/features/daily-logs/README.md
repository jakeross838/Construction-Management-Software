# Daily Logs

## Status
Current state: **Stable**
Last updated: 2026-02-06

## Overview
Field documentation for construction projects. Tracks crew, weather, deliveries, work performed, and site conditions. Includes photo attachments, voice notes with transcription, and GPS location tagging.

## Key Files

### Frontend
- `client/src/pages/DailyLogs.tsx` - Main daily logs page
- `client/src/components/daily-logs/` - Components
  - `DailyLogFormDialog.tsx` - Create/edit form
  - `DailyLogViewDialog.tsx` - Detail viewer
  - `DailyLogCard.tsx` - Log card
  - `DailyLogStats.tsx` - Statistics

### Backend
- `server/routes/daily-logs.js` - Daily log API (1720 lines)
- `server/services/daily-log-intelligence.js` - AI analysis

## Database Tables

| Table | Purpose |
|-------|---------|
| `v2_daily_logs` | Main daily log records |
| `v2_daily_log_crew` | Crew entries (workers, hours, trades) |
| `v2_daily_log_deliveries` | Material/equipment deliveries |
| `v2_daily_log_attachments` | Photos and attachments |
| `v2_daily_log_inspections` | Associated inspections |
| `v2_daily_log_activity` | Audit trail |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/daily-logs/` | List logs with filters |
| GET | `/api/daily-logs/:id` | Single log with details |
| POST | `/api/daily-logs/` | Create new log |
| PATCH | `/api/daily-logs/:id` | Update log |
| POST | `/api/daily-logs/:id/complete` | Mark completed |
| POST | `/api/daily-logs/:id/crew` | Add crew entry |
| POST | `/api/daily-logs/:id/deliveries` | Add delivery |
| POST | `/api/daily-logs/:id/photos` | Upload photo |
| POST | `/api/daily-logs/:id/weather` | Fetch weather data |
| POST | `/api/daily-logs/:id/voice-note` | Upload voice note |
| POST | `/api/daily-logs/:id/transcribe` | Transcribe voice note |
| GET | `/api/daily-logs/report/weekly` | Weekly report |

## Status Values
- `draft` - In progress
- `completed` - Finalized

## Key Features
- Crew tracking (workers, hours, trade)
- Material delivery logging
- Photo attachments (before/during/after)
- Weather integration (Open-Meteo API)
- GPS location tagging
- Voice note recording & transcription
- Weekly report generation
- Template duplication (clone yesterday)

## Related Features
- [Schedule](../schedule/) - Task progress sync
- [Photos](../photos/) - Photo management
- [Jobs](../jobs/) - Logs belong to jobs

# Phase 37: Leads Database & API - Summary

**Status:** COMPLETE (pre-built)
**Completed:** 2026-01-18
**Plans:** 3/3 (discovered pre-built)

## Overview

The Leads/CRM database schema and API endpoints were found already implemented in the codebase. This phase was marked complete after discovery.

## What Was Built

### Database Schema (`database/migration-055-leads.sql`)

**Tables Created:**
1. `v2_lead_sources` - Reference table for lead source dropdown (Website, Referral, etc.)
2. `v2_leads` - Main CRM table with contact info, project details, qualification, pipeline stage
3. `v2_lead_activities` - Contact history (calls, emails, meetings)
4. `v2_lead_tasks` - Follow-up reminders with due dates
5. `v2_lead_documents` - File attachments for leads
6. `v2_lead_stage_history` - Pipeline stage change tracking for analytics

**Key Features:**
- Comprehensive lead qualification fields (budget, timeline, has_lot, has_architect, etc.)
- Pipeline stages: inquiry → qualification → consultation → design_agreement → proposal → contract → won/lost
- Job conversion with `job_id` foreign key
- Soft delete support via `deleted_at`

### API Routes (`server/routes/leads.js`)

**Endpoints (778 lines):**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/leads/sources` | List lead sources |
| GET | `/api/leads/stats` | Pipeline statistics |
| GET | `/api/leads` | List leads with filters |
| GET | `/api/leads/:id` | Get lead with activities, tasks, documents |
| POST | `/api/leads` | Create lead |
| PATCH | `/api/leads/:id` | Update lead |
| DELETE | `/api/leads/:id` | Soft delete lead |
| POST | `/api/leads/:id/stage` | Change pipeline stage |
| POST | `/api/leads/:id/convert` | Convert to Job |
| POST | `/api/leads/:id/lost` | Mark as lost |
| GET/POST | `/api/leads/:id/activities` | Activities CRUD |
| GET/POST/PATCH/DELETE | `/api/leads/:id/tasks` | Tasks CRUD |
| GET/POST/DELETE | `/api/leads/:id/documents` | Documents CRUD |
| GET | `/api/leads/:id/history` | Stage change history |

**Implementation Details:**
- Follows `asyncHandler` pattern for error handling
- Stage changes logged to `v2_lead_stage_history`
- Document uploads to Supabase Storage (`lead-documents/` prefix)
- Qualification scoring (hot ≥12, warm ≥8, cool ≥4, cold <4)

## Files

- `database/migration-055-leads.sql` - 196 lines
- `server/routes/leads.js` - 778 lines

## Requirements Satisfied

- LED-01: Leads can be created with contact info
- LED-02: Leads track project details
- LED-03: Leads have source attribution
- LED-05: Pipeline stages with history
- LED-06: Lead tasks with due dates
- LED-07: Lead activities (calls, emails, meetings)
- LED-08: Lead to Job conversion
- LED-09: Lead marked lost with reason
- LED-10: Lead documents
- LED-11: Qualification scoring
- LED-12: Lead soft delete

---
*Summary created: 2026-01-19*

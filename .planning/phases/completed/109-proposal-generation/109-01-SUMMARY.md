# Phase 109 Plan 01 Summary: Proposal Schema Migration

## Completed: 2026-01-22

## What Was Built

### Database Tables

1. **v2_proposals** - Main proposals table with:
   - `estimate_id` (FK to v2_estimates, ON DELETE CASCADE)
   - `job_id` (FK to v2_jobs, ON DELETE SET NULL)
   - `proposal_number` (auto-generated PRP-YY-XXXX format)
   - `detail_level` ('line_items' or 'summary')
   - `show_allowances` (boolean)
   - `payment_terms` (JSONB array of milestones)
   - `terms_text` (free-form terms)
   - `pdf_url`, `pdf_generated_at` (PDF storage)
   - `share_token`, `share_expires_at`, `view_count`, `last_viewed_at` (sharing)
   - `status` ('draft', 'sent', 'viewed', 'accepted', 'declined', 'expired')
   - `accepted_at`, `accepted_by_name`, `accepted_by_email`, `accepted_ip`, `acceptance_notes` (acceptance tracking)
   - `declined_at`, `decline_reason` (decline tracking)

2. **v2_company_branding** - Company info for proposals:
   - `logo_url`, `company_name`, `address`, `phone`, `email`, `website`
   - `license_number` (CGC number)
   - `default_payment_terms` (JSONB)
   - `proposal_footer_text`, `proposal_terms_boilerplate`
   - Seeded with Ross Built defaults

### Triggers & Functions

1. **generate_proposal_number()** - Auto-generates PRP-YY-XXXX format
   - Increments sequence per year
   - Applied via BEFORE INSERT trigger

2. **update_proposals_timestamp()** - Updates `updated_at` on changes

### Indexes

- `idx_proposals_estimate` - For estimate lookups
- `idx_proposals_job` - For job filtering
- `idx_proposals_status` - For status filtering
- `idx_proposals_token` - Partial index for share token lookups
- `idx_proposals_expires` - Partial index for expiration queries

## Note on Table Naming

Used `v2_company_branding` instead of `v2_company_settings` because the latter already exists as a key-value configuration store (burden rates, etc.).

## Verification

```bash
# Proposal number auto-generates correctly
INSERT → PRP-26-0001

# Company branding seeded
company_name: Ross Built Custom Homes
license_number: CGC1234567
```

## Migration File

`database/migration-120-proposals.sql`

## Commit

Pending (will be committed with Wave 2)

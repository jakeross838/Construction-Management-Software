# Phase 108 Plan 02 Summary: API Routes for Client Approval

## Completed: 2026-01-22

## What Was Built

### API Endpoints Added to `server/routes/selections.js`

1. **Client Approval Section**
   - `POST /api/selections/items/:id/client-approve` - Single selection approval with audit trail
   - `POST /api/selections/items/bulk-approve` - Bulk approve multiple selections at once

2. **Estimate Integration Section**
   - `POST /api/selections/convert-estimate-allowances` - Convert estimate allowance lines to job allowances
   - `GET /api/selections/allowances/job/:jobId/variance-summary` - Aggregate variance stats for a job
   - `GET /api/selections/items/:id/check-post-contract` - Check if selection is post-contract and needs CO

3. **Role-Based Filtering**
   - `filterSelectionForRole()` - Removes internal_notes from client role responses
   - `filterSelectionsForRole()` - Applies filtering to arrays
   - Added `role` query param to `GET /items` and `GET /items/:id`

## Key Implementation Details

### Client Approval Records
- `client_approved_at` - ISO timestamp
- `client_approved_by` - Who approved
- `client_approval_ip` - IP address (optional)
- `client_approval_method` - Always "checkbox" for UI approvals
- `client_approval_notes` - Optional notes from client

### Bulk Approval
- Validates all selections exist and aren't already approved
- Returns error if any are already approved (with list of IDs)
- Creates status history records for each selection

### Post-Contract Detection
- Checks job status against post-contract statuses: `construction`, `in_progress`, `active`, `closed`, `complete`
- Returns `needs_change_order: true` if post-contract AND has overage

## Verification

All endpoints tested and working:
```bash
# Test check-post-contract
curl http://localhost:3001/api/selections/items/:id/check-post-contract
# Returns: { is_post_contract: true, needs_change_order: true, overage_amount: 500 }

# Test client-approve
curl -X POST http://localhost:3001/api/selections/items/:id/client-approve \
  -H "Content-Type: application/json" \
  -d '{"approved_by":"Test User","notes":"Test"}'
# Returns: Updated selection with client_approved_at set
```

## Files Modified
- `server/routes/selections.js` - Added 5 new endpoints and role-based filtering

## Commit
`ad8f3cb` - Phase 108-02 & 108-03: Client approval API endpoints and frontend UI

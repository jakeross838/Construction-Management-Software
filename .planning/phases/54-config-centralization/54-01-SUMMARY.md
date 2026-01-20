# Phase 54-01: Config Centralization

## Completed: 2026-01-19

### What Was Done

1. **Created config/constants.js** (~90 lines) - Centralized all hardcoded constants:
   - `LOCK_DURATION_MINUTES = 5`
   - `UNDO_WINDOW_SECONDS = 30`
   - `SSE_HEARTBEAT_MS = 30000`
   - `PRICE_CACHE_TTL_MS = 300000`
   - `MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024`
   - `SIGNED_URL_EXPIRY_SECONDS = 3600`
   - `INVOICE_STATUS` enum object
   - `VALID_TRANSITIONS` state machine
   - `PO_STATUS`, `DRAW_STATUS` enums

2. **Updated config/index.js** - Exports constants alongside supabase client

3. **Updated consumers** - Changed imports to use centralized config:
   - `server/locking.js`
   - `server/undo.js`
   - `server/realtime.js`
   - `server/price-capture.js`

### Files Changed

| File | Action | Lines |
|------|--------|-------|
| `config/constants.js` | Created | ~90 |
| `config/index.js` | Updated | +10 |
| `server/locking.js` | Updated imports | ~5 |
| `server/undo.js` | Updated imports | ~5 |
| `server/realtime.js` | Updated imports | ~5 |
| `server/price-capture.js` | Updated imports | ~5 |

### Benefits

- Single source of truth for magic numbers
- Easier to adjust timing/limits globally
- Status enums prevent typos
- Valid transitions documented in code

# Technical Concerns

## Code Quality

### Large Files
| File | Lines | Concern |
|------|-------|---------|
| `public/css/styles.css` | ~7200 | Monolithic CSS, hard to maintain |
| `server/index.js` | ~1000+ | Could split more routes out |
| `server/routes/invoices.js` | ~1500+ | Large, complex business logic |
| `server/routes/purchase-orders.js` | ~1200+ | Many endpoints, growing |

### Recommended Splits
- CSS: Split into component files (modals.css, tables.css, forms.css)
- Routes: Already improved with modular routes/, continue pattern

### Code Duplication
- Modal open/close patterns repeated across pages
- Filter/search logic duplicated in each page JS
- Status badge rendering duplicated

## Architecture Concerns

### No Authentication
- All endpoints publicly accessible
- `approved_by` fields are just strings
- No user sessions or JWT
- **Risk**: Any user can approve invoices, modify data

### No Input Validation Layer
- Validation in individual routes
- No schema validation middleware
- Relies on database constraints
- **Risk**: Inconsistent validation

### Tight Coupling
- Direct Supabase queries in route handlers
- No repository/service abstraction
- Hard to mock for testing
- **Mitigation**: Already using `services/` for some logic

### Single Process
- No clustering or load balancing
- SSE connections all in one process
- **Risk**: Not horizontally scalable

## Security Concerns

### SQL Injection
- Using Supabase client (parameterized)
- **Low risk** - Supabase handles this

### XSS
- Some user input rendered without escaping
- `innerHTML` used in places
- **Medium risk** - Should sanitize user content

### Authentication
- **High risk** - No auth implemented
- Service role key exposes full DB access

### File Upload
- Multer handles uploads
- Files go to Supabase Storage
- **Low risk** - Supabase validates

## Performance Concerns

### No Pagination
- Lists load all records
- Could be slow with large datasets
- **Risk**: Memory issues, slow loads

### No Caching
- `api-cache.js` exists but limited use
- Database hit on every request
- **Risk**: Unnecessary load

### Large CSS File
- 7200+ lines loaded on every page
- No CSS splitting or lazy loading
- **Impact**: Slower initial load

### No CDN
- Static files served by Express
- No edge caching
- **Impact**: Slower for distant users

## Database Concerns

### Migration Numbering
- Some number collisions (e.g., multiple 006 migrations)
- Manual tracking required
- **Risk**: Migration confusion

### No Indexes (Some)
- Added in migration-027 but may be missing others
- Check query performance

### Soft Delete Overhead
- `deleted_at IS NULL` on every query
- Could use views for cleaner queries

## Documentation Concerns

### JSDoc Missing
- No JSDoc comments on functions
- Harder for new developers
- Rely on CLAUDE.md for context

### API Documentation
- No OpenAPI/Swagger spec
- Endpoints documented in CLAUDE.md only
- **Risk**: API drift from docs

## Testing Concerns

### No Test Isolation
- Tests run against dev database
- No cleanup between tests
- **Risk**: Flaky tests

### No CI/CD
- Manual test runs only
- No automated checks on commit
- **Risk**: Regressions slip through

### Limited Coverage
- E2E tests only
- No unit tests for business logic
- AI processing not tested

## Technical Debt

### TODO Comments Found
```javascript
// TODO: Add pagination
// TODO: Handle edge case
// FIXME: This is a workaround
```

### Known Issues (from CLAUDE.md)
1. Modal not visible - need `.show` class
2. API 404 - route order matters
3. Budget not updating - check allocations

### Workarounds in Code
- `force` parameter to bypass punch list blocking
- Manual version tracking on entities
- Inline SQL for complex queries

## Recommendations

### High Priority
1. **Add Authentication** - Critical for production
2. **Add Input Validation** - Middleware layer
3. **Split CSS** - Maintainability

### Medium Priority
4. **Add Pagination** - Scalability
5. **Add CI/CD** - Quality assurance
6. **Add Caching** - Performance

### Low Priority
7. **Split Large Files** - Maintainability
8. **Add JSDoc** - Documentation
9. **Add Unit Tests** - Coverage

## Known Bugs

### From Codebase
- None documented in TODO/FIXME that aren't addressed

### From User Reports
- Check GitHub issues (if any)

## Upgrade Path

### Dependencies
- Check for outdated packages
- `@anthropic-ai/sdk` may have breaking changes
- Supabase client updates

### Node.js
- Currently works on Node 18+
- Test on newer versions

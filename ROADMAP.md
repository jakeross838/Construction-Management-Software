# Ross Built Construction Management - Feature Roadmap

## Priority Levels
- **P0 (Critical)**: Blocks core business operations
- **P1 (High)**: Significantly impacts productivity
- **P2 (Medium)**: Nice to have, improves experience
- **P3 (Low)**: Future enhancements

---

## Phase 1: Foundation Fixes (Completed)
*Estimated: 1 week*

### Completed
- [x] Fix Estimates API FK ambiguity (migration-146)
- [x] Fix Profitability Summary column references (migration-148)
- [x] Fix Budget Lines schema (migration-147)
- [x] Add route aliases for frontend compatibility
- [x] QuickBooks integration backend
- [x] Xero integration backend
- [x] Stripe subscriptions backend
- [x] API keys & webhooks system
- [x] Client portal backend

---

## Phase 2: Core Improvements (P0/P1)
*Estimated: 2-3 weeks*

### User Roles & Permissions (P0) ✅
- [x] Define role types: Owner, Admin, Project Manager, Superintendent, Accountant, Field Worker
- [x] Create permissions matrix per module
- [x] Implement role-based route guards
- [x] Add user management UI to Settings

### Pagination & Performance (P1)
- [x] Add pagination to `/api/invoices` (50+ records) - in progress
- [x] Add pagination to `/api/jobs`
- [x] Add pagination to `/api/vendors`
- [ ] Add pagination to `/api/purchase-orders`
- [ ] Implement cursor-based pagination for real-time tables
- [ ] Add Redis caching for reference data (cost codes, jobs list)

### Error Handling (P1) ✅
- [x] Standardize all API responses to `{ success, data, error, meta }`
- [x] Add request correlation IDs for debugging
- [x] Sanitize error messages for production (hide internal details)
- [x] Add error boundary with retry capability

### Missing CRUD Operations (P1)
- [x] Complete Contracts module (verified working with real data)
- [x] Complete Warranties with claim management
- [x] Complete Tasks module with assignments (Kanban board, checklists, comments)
- [ ] Complete Files/Documents with folder management

---

## Phase 3: Financial Features (P1)
*Estimated: 3-4 weeks*

### Accounts Receivable (P1) ✅
- [x] Client invoice generation from draws
- [x] Payment tracking and receipts
- [x] AR aging report (30/60/90 days)
- [x] Statement generation

### QuickBooks Integration (P1)
- [ ] Complete OAuth flow with token refresh
- [ ] Sync vendors ↔ QBO Vendors
- [ ] Sync invoices → QBO Bills
- [ ] Sync payments → QBO Bill Payments
- [ ] Two-way sync status dashboard

### Retainage Management (P1) ✅
- [x] Per-line retainage percentages
- [x] Retainage release tracking
- [x] Retainage reporting by job

### Budget Enhancements (P2)
- [ ] Budget revision history
- [ ] Budget vs forecast comparison
- [ ] Auto-populate from accepted bids
- [ ] Import from Excel template

---

## Phase 4: Project Management (P1)
*Estimated: 4-6 weeks*

### Gantt Chart Visualization (P1) ✅
- [x] Integrate Gantt library (custom implementation with ScheduleGanttView)
- [x] Milestone markers (diamond display with flag icon)
- [x] Critical path highlighting
- [x] Task dependencies (finish-to-start, FS/FF/SS/SF with curved SVG lines)
- [x] Baseline schedule overlay with toggle
- [ ] Export to PDF

### Schedule Enhancements (P1)
- [x] Baseline schedule capture
- [x] Variance tracking (planned vs actual)
- [ ] Weather delay tracking
- [ ] Resource conflict detection

### Task Management (P2)
- [ ] Kanban board view
- [ ] Task templates
- [ ] Recurring tasks
- [ ] Mobile push notifications

---

## Phase 5: Mobile & Field (P1)
*Estimated: 4-6 weeks*

### Progressive Web App (P1)
- [ ] Offline daily log entry
- [ ] Offline photo capture
- [ ] Background sync when online
- [ ] Install prompt on mobile

### Daily Logs Enhancement (P1)
- [ ] Voice-to-text notes
- [ ] Auto weather from API
- [ ] Crew time tracking integration
- [ ] GPS location tagging

### Punch Lists Mobile (P2)
- [ ] Photo annotation
- [ ] Swipe-to-complete
- [ ] QR code scan for location

---

## Phase 6: Document Management (P2)
*Estimated: 3-4 weeks*

### Plan Set Management (P2)
- [ ] Drawing version control
- [ ] Sheet list with thumbnails
- [ ] Revision clouds/marks
- [ ] Distribution tracking

### Document Intelligence (P2)
- [ ] PDF text extraction
- [ ] Auto-categorization
- [ ] Expiration alerts (insurance, licenses)
- [ ] Full-text search

### E-Signatures (P2)
- [ ] DocuSign/HelloSign integration
- [ ] In-app signature capture
- [ ] Signature audit trail

---

## Phase 7: Reporting & Analytics (P2)
*Estimated: 3-4 weeks*

### Custom Report Builder (P2)
- [ ] Drag-and-drop field selection
- [ ] Filter conditions
- [ ] Grouping and aggregation
- [ ] Save report templates

### Executive Dashboard (P2)
- [x] Company-wide KPIs
- [x] Job portfolio overview
- [x] Cash position summary
- [ ] Pipeline/backlog chart

### Scheduled Reports (P2)
- [ ] Email delivery on schedule
- [ ] Multiple recipients
- [ ] Excel/PDF format options

---

## Phase 8: Integrations (P2/P3)
*Estimated: 4-6 weeks*

### Accounting
- [x] QuickBooks Online (backend complete)
- [x] Xero (backend complete)
- [ ] Sage integration

### Project Management
- [ ] Procore two-way sync
- [ ] Buildertrend import

### Communication
- [ ] Email integration (send from app)
- [ ] SMS notifications (Twilio)
- [ ] Slack notifications

### Suppliers
- [ ] Material supplier EDI
- [ ] Auto-PO from low stock
- [ ] Price comparison

---

## Phase 9: Advanced Features (P3)
*Estimated: 6-8 weeks*

### Time Tracking
- [ ] Mobile clock in/out
- [ ] GPS fence validation
- [ ] Overtime calculations
- [ ] Certified payroll reports

### Safety & Compliance
- [ ] OSHA log 300
- [ ] Incident reporting
- [ ] Safety meeting tracking
- [ ] Toolbox talk templates

### Estimating Enhancements
- [ ] Assembly-based estimating
- [ ] Takeoff integration
- [ ] Historical cost trending
- [ ] AI cost predictions

---

## Technical Debt

### Code Quality
- [ ] Add unit tests for critical routes
- [ ] Add E2E tests with Playwright
- [ ] TypeScript strict mode
- [x] API documentation (OpenAPI/Swagger)

### Infrastructure
- [ ] Docker containerization
- [ ] CI/CD pipeline
- [ ] Staging environment
- [ ] Database backups automation

### Security
- [ ] Rate limiting per user
- [ ] SQL injection audit
- [ ] XSS prevention audit
- [ ] Dependency vulnerability scan

---

## Metrics to Track

### Business Metrics
- Monthly Active Users (MAU)
- Invoice processing time
- Draw cycle time
- User retention rate

### Technical Metrics
- API response time (p95 < 200ms)
- Error rate (< 0.1%)
- Uptime (99.9%)
- Page load time (< 2s)

---

## Version Milestones

### v2.1.0 (Current Sprint)
- Critical bug fixes
- Route aliases
- Profitability fixes

### v2.2.0 (Next Sprint)
- User roles & permissions
- API pagination
- QuickBooks sync completion

### v2.3.0
- Gantt chart
- Mobile offline
- Custom reports

### v3.0.0
- Multi-tenant SaaS
- White-label support
- Public API v1

// Feature Registry — 205 features across 10 categories
// This is the master list of all RossOS capabilities that can be toggled per company

export interface Feature {
  id: number
  cat: string
  name: string
  desc: string
  phase: number
  status: 'ready' | 'planned' | 'future'
  effort: 'S' | 'M' | 'L' | 'XL'
  selfLearn: boolean
}

export const statusConfig = {
  ready: { label: 'Ready to Build', color: 'text-green-400', bg: 'bg-green-950', border: 'border-green-800/30' },
  planned: { label: 'Planned', color: 'text-amber-400', bg: 'bg-amber-950', border: 'border-amber-800/30' },
  future: { label: 'Future', color: 'text-indigo-400', bg: 'bg-indigo-950', border: 'border-indigo-800/30' },
} as const

export const effortConfig = {
  S: { label: 'Small', color: 'text-green-300' },
  M: { label: 'Medium', color: 'text-yellow-300' },
  L: { label: 'Large', color: 'text-orange-400' },
  XL: { label: 'XL', color: 'text-red-400' },
} as const

export const FEATURES: Feature[] = [
  // ═══════════════════════════════════════════
  // CATEGORY: ONBOARDING & SETUP (1-18)
  // ═══════════════════════════════════════════
  { id: 1, cat: 'Onboarding & Setup', name: 'Smart Company Setup Wizard', desc: '5-step wizard: upload your license/insurance docs → AI extracts company name, license #, EIN, address, insurance details. Done in 2 minutes instead of 20 form fields.', phase: 1, status: 'ready', effort: 'M', selfLearn: true },
  { id: 2, cat: 'Onboarding & Setup', name: 'Business Card Scanner', desc: 'Take a photo of any vendor/sub business card → AI extracts name, phone, email, trade, company. Auto-creates vendor record.', phase: 1, status: 'ready', effort: 'S', selfLearn: true },
  { id: 3, cat: 'Onboarding & Setup', name: 'QuickBooks Import Bridge', desc: 'Connect QBO → auto-import all vendors, clients, chart of accounts, open invoices, job history. Maps cost codes automatically.', phase: 1, status: 'ready', effort: 'L', selfLearn: false },
  { id: 4, cat: 'Onboarding & Setup', name: 'Buildertrend / CoConstruct Import', desc: 'Migrate from competing software: import jobs, contacts, budgets, schedules, documents. One-click migration.', phase: 2, status: 'planned', effort: 'XL', selfLearn: false },
  { id: 5, cat: 'Onboarding & Setup', name: 'Bulk Employee Upload (CSV/Excel)', desc: 'Upload a spreadsheet of employees → auto-create accounts, set roles, send invites. Template provided.', phase: 1, status: 'ready', effort: 'S', selfLearn: false },
  { id: 6, cat: 'Onboarding & Setup', name: 'Vendor Onboarding Link', desc: 'Send vendors a magic link → they fill out their own info, upload W-9, COI, license. Auto-creates vendor record with compliance status.', phase: 1, status: 'ready', effort: 'M', selfLearn: false },
  { id: 7, cat: 'Onboarding & Setup', name: 'AI Contract Reader', desc: 'Upload any existing contract (PDF/Word) → AI extracts: client name, address, contract amount, scope, allowances, exclusions, payment terms. Pre-fills the job setup.', phase: 1, status: 'ready', effort: 'M', selfLearn: true },
  { id: 8, cat: 'Onboarding & Setup', name: 'Insurance Auto-Verify (ACORD)', desc: 'Vendors upload COI → AI reads ACORD form, extracts carrier, coverage, expiration, additional insured status. Auto-flags gaps.', phase: 1, status: 'ready', effort: 'M', selfLearn: true },
  { id: 9, cat: 'Onboarding & Setup', name: 'W-9 Auto-Extract', desc: 'Upload W-9 → AI extracts TIN, business name, entity type, address. Auto-fills vendor tax info.', phase: 1, status: 'ready', effort: 'S', selfLearn: true },
  { id: 10, cat: 'Onboarding & Setup', name: 'Role-Based Guided Tours', desc: 'First login → role-specific walkthrough. PM sees job management flow, Super sees field tools, Office sees financial workflows. Skip anytime.', phase: 1, status: 'ready', effort: 'M', selfLearn: false },
  { id: 11, cat: 'Onboarding & Setup', name: 'Sample Data Sandbox', desc: 'New accounts get a pre-loaded demo project with realistic data so users can explore before entering real data. One-click to clear.', phase: 1, status: 'ready', effort: 'S', selfLearn: false },
  { id: 12, cat: 'Onboarding & Setup', name: 'Email Signature Scanner', desc: 'Paste someone\'s email → AI extracts contact info from the signature block. Auto-creates contact record.', phase: 2, status: 'planned', effort: 'S', selfLearn: true },
  { id: 13, cat: 'Onboarding & Setup', name: 'Bank Account Auto-Connect (Plaid)', desc: 'Connect bank via Plaid → auto-import transactions for payment matching. No manual entry of bank details.', phase: 2, status: 'planned', effort: 'L', selfLearn: false },
  { id: 14, cat: 'Onboarding & Setup', name: 'Google Contacts / Outlook Sync', desc: 'Import contacts from Google or Outlook → match to existing clients/vendors or create new. Bi-directional sync.', phase: 2, status: 'planned', effort: 'M', selfLearn: false },
  { id: 15, cat: 'Onboarding & Setup', name: 'Lien Law Setup by State', desc: 'Select your state → auto-configures lien notice deadlines, required forms, retainage rules, bond thresholds per FL/NC/SC law.', phase: 1, status: 'ready', effort: 'M', selfLearn: false },
  { id: 16, cat: 'Onboarding & Setup', name: 'Cost Code Library Presets', desc: 'Choose from preset cost code libraries (CSI MasterFormat, custom residential, commercial) → pre-loads your chart of accounts.', phase: 1, status: 'ready', effort: 'S', selfLearn: false },
  { id: 17, cat: 'Onboarding & Setup', name: 'Logo & Branding Auto-Apply', desc: 'Upload your logo → AI extracts brand colors → auto-applies to proposals, invoices, client portal, reports. Instant branding.', phase: 1, status: 'ready', effort: 'S', selfLearn: false },
  { id: 18, cat: 'Onboarding & Setup', name: 'Checklist: \'Ready to Go Live\'', desc: 'Progress checklist showing what\'s set up and what\'s missing before going live: company info, first job, bank connected, etc.', phase: 1, status: 'ready', effort: 'S', selfLearn: false },

  // ═══════════════════════════════════════════
  // CATEGORY: PHOTO & MEDIA (19-35)
  // ═══════════════════════════════════════════
  { id: 19, cat: 'Photo & Media', name: 'AI Room Auto-Tagging', desc: 'Upload photo → AI identifies room type (Kitchen, Bedroom #1, Master Bath) and tags automatically. Learns your project\'s room names.', phase: 1, status: 'ready', effort: 'L', selfLearn: true },
  { id: 20, cat: 'Photo & Media', name: 'Construction Phase Detection', desc: 'AI detects construction phase from photo: framing, rough-in, drywall, trim, paint, final. Auto-tags timeline.', phase: 1, status: 'ready', effort: 'L', selfLearn: true },
  { id: 21, cat: 'Photo & Media', name: 'Before/After Slider', desc: 'Select two photos of same location → generates interactive before/after comparison slider. Great for client presentations.', phase: 1, status: 'ready', effort: 'S', selfLearn: false },
  { id: 22, cat: 'Photo & Media', name: 'Photo Timeline by Room', desc: 'View any room\'s complete photo history on a visual timeline. See Kitchen go from framing → drywall → cabinets → counters → final.', phase: 1, status: 'ready', effort: 'M', selfLearn: false },
  { id: 23, cat: 'Photo & Media', name: 'Bulk Photo Upload (Drag & Drop)', desc: 'Drag 50 photos at once → AI auto-sorts by room, tags by phase, timestamps from EXIF data. Batch review and correct.', phase: 1, status: 'ready', effort: 'M', selfLearn: true },
  { id: 24, cat: 'Photo & Media', name: 'Photo Markup & Annotation', desc: 'Draw arrows, circles, text on photos to highlight issues. Save annotated versions for punch items, RFIs, daily logs.', phase: 1, status: 'ready', effort: 'M', selfLearn: false },
  { id: 25, cat: 'Photo & Media', name: '360 Photo Support', desc: 'Upload 360 photos from Ricoh Theta or similar → interactive panorama viewer. Pin to floor plan location.', phase: 3, status: 'future', effort: 'L', selfLearn: false },
  { id: 26, cat: 'Photo & Media', name: 'Drone Photo Integration', desc: 'Upload drone photos/video → AI stitches aerial progress views. Auto-tag by date for time-lapse.', phase: 3, status: 'future', effort: 'L', selfLearn: false },
  { id: 27, cat: 'Photo & Media', name: 'Time-Lapse Generator', desc: 'Auto-generate time-lapse video from photos tagged to same location over time. Export as MP4 for client presentations.', phase: 2, status: 'planned', effort: 'M', selfLearn: false },
  { id: 28, cat: 'Photo & Media', name: 'Photo to Punch Item (1-tap)', desc: 'Take a photo of an issue → tap \'Create Punch Item\' → AI pre-fills description, location, trade. Attach photo automatically.', phase: 1, status: 'ready', effort: 'S', selfLearn: true },
  { id: 29, cat: 'Photo & Media', name: 'Progress % from Photos (AI)', desc: 'AI analyzes room photos to estimate completion percentage. \'Kitchen appears ~70% complete based on cabinet install visible.\'', phase: 3, status: 'future', effort: 'XL', selfLearn: true },
  { id: 30, cat: 'Photo & Media', name: 'Client Photo Gallery (Filtered)', desc: 'Auto-generate client-safe photo gallery — filters out messy/work-in-progress shots. Only shows polished progress photos.', phase: 1, status: 'ready', effort: 'M', selfLearn: true },
  { id: 31, cat: 'Photo & Media', name: 'Photo GPS Auto-Tag to Job Site', desc: 'Photos taken on-site auto-link to the correct job based on GPS coordinates. No manual job selection needed.', phase: 1, status: 'ready', effort: 'S', selfLearn: false },
  { id: 32, cat: 'Photo & Media', name: 'Video Walkthrough Recording', desc: 'Record video walkthroughs with voice narration → auto-transcribe → link to rooms. AI summarizes key points.', phase: 2, status: 'planned', effort: 'L', selfLearn: true },
  { id: 33, cat: 'Photo & Media', name: 'Photo Storage Usage Dashboard', desc: 'Track storage per job, per user. Auto-compress old photos. Set retention policies. Export archive.', phase: 2, status: 'planned', effort: 'S', selfLearn: false },
  { id: 34, cat: 'Photo & Media', name: 'QR Code Photo Stations', desc: 'Print QR codes for each room → crew scans QR before taking photos → auto-tags room perfectly every time. Zero AI needed.', phase: 1, status: 'ready', effort: 'S', selfLearn: false },
  { id: 35, cat: 'Photo & Media', name: 'Material Defect Detection (AI)', desc: 'Photo of delivered materials → AI flags visible damage, wrong color, missing items. Auto-creates damage report.', phase: 3, status: 'future', effort: 'XL', selfLearn: true },

  // ═══════════════════════════════════════════
  // CATEGORY: ACTIVITY LOG & ANALYTICS (36-52)
  // ═══════════════════════════════════════════
  { id: 36, cat: 'Activity & Analytics', name: 'Real-Time Activity Feed', desc: 'Live feed: \'Jake approved Invoice #1024\' → \'Sarah updated Smith Residence budget\' → \'Mike logged 8 hours\'. See who\'s doing what NOW.', phase: 1, status: 'ready', effort: 'M', selfLearn: false },
  { id: 37, cat: 'Activity & Analytics', name: 'Page Visit Tracking', desc: 'Track every page visit per user: who looked at what job, what financial page, how long they stayed. Heat calendar view.', phase: 1, status: 'ready', effort: 'M', selfLearn: false },
  { id: 38, cat: 'Activity & Analytics', name: 'Button Click Analytics', desc: 'Every button click logged: Approve, Reject, Send, Export, Create. Know exactly what actions each team member takes.', phase: 1, status: 'ready', effort: 'M', selfLearn: false },
  { id: 39, cat: 'Activity & Analytics', name: 'Full Audit Trail (Data Changes)', desc: 'Every data change tracked: who changed what field, when, old value → new value. Complete forensic trail.', phase: 1, status: 'ready', effort: 'L', selfLearn: false },
  { id: 40, cat: 'Activity & Analytics', name: 'Role-Based Activity Dashboards', desc: 'PM sees their jobs\' activity. Owner sees all activity. Super sees field activity only. Each role gets relevant feed.', phase: 1, status: 'ready', effort: 'M', selfLearn: false },
  { id: 41, cat: 'Activity & Analytics', name: 'Feature Usage Heatmap', desc: 'Visual heatmap of most/least used features per role. Discover what\'s valuable and what\'s ignored.', phase: 2, status: 'planned', effort: 'M', selfLearn: true },
  { id: 42, cat: 'Activity & Analytics', name: 'Anomaly Detection', desc: 'AI detects unusual patterns: \'Jake usually approves invoices by 2pm but hasn\'t today\' or \'Someone accessed financials at 3am.\'', phase: 2, status: 'planned', effort: 'L', selfLearn: true },
  { id: 43, cat: 'Activity & Analytics', name: 'Weekly Team Activity Report', desc: 'Auto-generated weekly digest: who was most active, what got approved/created/updated, bottlenecks identified.', phase: 1, status: 'ready', effort: 'M', selfLearn: false },
  { id: 44, cat: 'Activity & Analytics', name: 'Approval Velocity Tracking', desc: 'Track how fast approvals happen: avg time from \'submitted\' to \'approved\' per person, per type. Flag bottlenecks.', phase: 1, status: 'ready', effort: 'S', selfLearn: true },
  { id: 45, cat: 'Activity & Analytics', name: 'Login History & Session Tracking', desc: 'Track every login: time, device, IP, location, session duration. Security audit capability.', phase: 1, status: 'ready', effort: 'S', selfLearn: false },
  { id: 46, cat: 'Activity & Analytics', name: 'Client Portal Activity Tracking', desc: 'See when clients log in, what they view, how long they spend on budget vs photos vs schedule.', phase: 2, status: 'planned', effort: 'S', selfLearn: true },
  { id: 47, cat: 'Activity & Analytics', name: 'Navigation Path Analysis', desc: 'Track user flows: Dashboard → Jobs → Smith Residence → Budget → Back. Find friction points.', phase: 2, status: 'planned', effort: 'M', selfLearn: true },
  { id: 48, cat: 'Activity & Analytics', name: 'Search Analytics', desc: 'What are users searching for? Track search queries to discover missing features or hard-to-find content.', phase: 2, status: 'planned', effort: 'S', selfLearn: true },
  { id: 49, cat: 'Activity & Analytics', name: 'Export Activity to CSV/PDF', desc: 'Export any activity log view to CSV or PDF for compliance, legal, or management review.', phase: 1, status: 'ready', effort: 'S', selfLearn: false },
  { id: 50, cat: 'Activity & Analytics', name: 'Slack/Email Activity Digest', desc: 'Daily or weekly activity summary pushed to Slack channel or email. Configurable per role.', phase: 2, status: 'planned', effort: 'S', selfLearn: false },
  { id: 51, cat: 'Activity & Analytics', name: 'Time-on-Task Analytics', desc: 'How long does it take to create an invoice? Approve a draw? Complete a daily log? Benchmark and optimize.', phase: 2, status: 'planned', effort: 'M', selfLearn: true },
  { id: 52, cat: 'Activity & Analytics', name: 'Custom Dashboard Builder', desc: 'Drag-drop widgets to build your own activity dashboard: charts, feeds, KPIs, alerts. Save per role.', phase: 3, status: 'future', effort: 'XL', selfLearn: false },

  // ═══════════════════════════════════════════
  // CATEGORY: SELF-LEARNING AI (53-72)
  // ═══════════════════════════════════════════
  { id: 53, cat: 'Self-Learning AI', name: 'Feedback Loop on All AI Suggestions', desc: 'Thumbs up/down on every AI card. System tracks: suggested X → user did Y → outcome Z. Retrains weekly.', phase: 1, status: 'ready', effort: 'L', selfLearn: true },
  { id: 54, cat: 'Self-Learning AI', name: 'Invoice Auto-Coding Learning', desc: 'AI codes invoices to cost codes. When user corrects it, system learns. Accuracy improves: 94% → 97% → 99%.', phase: 1, status: 'ready', effort: 'M', selfLearn: true },
  { id: 55, cat: 'Self-Learning AI', name: 'Estimate vs Actual Learning', desc: 'AI compares every estimate line to actual cost at job close. Learns: \'your framing estimates are 8% low on coastal homes.\'', phase: 1, status: 'ready', effort: 'M', selfLearn: true },
  { id: 56, cat: 'Self-Learning AI', name: 'Lead Score Calibration', desc: 'Track which leads convert and which don\'t. AI recalibrates scoring: \'Parade of Homes leads convert 3x better than Houzz.\'', phase: 1, status: 'ready', effort: 'M', selfLearn: true },
  { id: 57, cat: 'Self-Learning AI', name: 'Schedule Duration Learning', desc: 'AI compares estimated vs actual task durations. Learns: \'Framing takes 12 days, not 10, on 2-story homes in your projects.\'', phase: 1, status: 'ready', effort: 'M', selfLearn: true },
  { id: 58, cat: 'Self-Learning AI', name: 'Vendor Performance Learning', desc: 'Tracks punch items, callbacks, on-time rate per vendor. Auto-adjusts vendor scores and recommendations.', phase: 1, status: 'ready', effort: 'M', selfLearn: true },
  { id: 59, cat: 'Self-Learning AI', name: 'Cash Flow Prediction Learning', desc: 'AI predicts cash flow → compares to actual. Learns: \'Smith family always pays 3 days after reminder, not 7.\'', phase: 2, status: 'planned', effort: 'L', selfLearn: true },
  { id: 60, cat: 'Self-Learning AI', name: 'Monthly AI Accuracy Report', desc: 'Dashboard showing AI accuracy trends: invoice coding 94→97%, schedule predictions 88→92%, lead scoring 72→81%.', phase: 1, status: 'ready', effort: 'M', selfLearn: false },
  { id: 61, cat: 'Self-Learning AI', name: 'A/B Test AI Suggestions', desc: 'Silently show different AI suggestion strategies to different users. Track which approach gets better outcomes. Auto-adopt winner.', phase: 3, status: 'future', effort: 'XL', selfLearn: true },
  { id: 62, cat: 'Self-Learning AI', name: 'Smart Defaults (Per User)', desc: 'AI learns each user\'s preferences: Jake always sets Net 30, Sarah prefers email over phone. Pre-fill forms with learned defaults.', phase: 2, status: 'planned', effort: 'M', selfLearn: true },
  { id: 63, cat: 'Self-Learning AI', name: 'Proactive Risk Alerts', desc: 'AI notices patterns before you do: \'Last 3 times lumber prices rose 5%, your margins dropped. Consider locking pricing now.\'', phase: 2, status: 'planned', effort: 'L', selfLearn: true },
  { id: 64, cat: 'Self-Learning AI', name: 'Natural Language Search', desc: 'Type \'show me all overdue invoices over $10k\' → AI understands and filters. No need to navigate menus.', phase: 2, status: 'planned', effort: 'L', selfLearn: true },
  { id: 65, cat: 'Self-Learning AI', name: 'Auto-Categorize Documents', desc: 'Upload any document → AI classifies: contract, permit, COI, submittal, RFI response, change order. Files automatically.', phase: 1, status: 'ready', effort: 'M', selfLearn: true },
  { id: 66, cat: 'Self-Learning AI', name: 'Client Communication Drafting', desc: 'AI drafts client emails based on context: \'Draft update for Smith family about schedule delay.\' Uses your tone from past emails.', phase: 2, status: 'planned', effort: 'M', selfLearn: true },
  { id: 67, cat: 'Self-Learning AI', name: 'Predictive Scheduling', desc: 'AI predicts when tasks will actually finish based on historical data, not just what\'s planned. \'Drywall will take 14 days, not 10.\'', phase: 2, status: 'planned', effort: 'L', selfLearn: true },
  { id: 68, cat: 'Self-Learning AI', name: 'Smart Notifications (Priority Ranked)', desc: 'AI learns which notifications you act on vs dismiss. Ranks by importance. Reduces notification fatigue by 60%.', phase: 2, status: 'planned', effort: 'M', selfLearn: true },
  { id: 69, cat: 'Self-Learning AI', name: 'Sentiment Analysis on Client Emails', desc: 'AI reads incoming client emails and flags tone: frustrated, happy, confused, urgent. Alerts PM before issues escalate.', phase: 3, status: 'future', effort: 'L', selfLearn: true },
  { id: 70, cat: 'Self-Learning AI', name: 'Weather Impact Predictor', desc: 'AI cross-references weather forecast with schedule. Learns: \'Your crew doesn\'t work in rain >0.5 inches but works in drizzle.\'', phase: 2, status: 'planned', effort: 'M', selfLearn: true },
  { id: 71, cat: 'Self-Learning AI', name: 'Auto-Generate SOW from Chat', desc: 'Discuss scope with client in AI chat → AI generates formal Scope of Work document from conversation. Review and send.', phase: 3, status: 'future', effort: 'L', selfLearn: true },
  { id: 72, cat: 'Self-Learning AI', name: 'Company Knowledge Base (RAG)', desc: 'AI trained on YOUR past projects, emails, documents. Ask: \'What did we pay for impact windows last year?\' and get real answers.', phase: 2, status: 'planned', effort: 'XL', selfLearn: true },

  // ═══════════════════════════════════════════
  // CATEGORY: SELF-DEBUGGING & RELIABILITY (73-88)
  // ═══════════════════════════════════════════
  { id: 73, cat: 'Self-Debugging', name: 'Global Error Boundary', desc: 'Every page wrapped in error handler. Crashes show friendly message + auto-report to dev team. Never a white screen.', phase: 1, status: 'ready', effort: 'S', selfLearn: false },
  { id: 74, cat: 'Self-Debugging', name: 'API Retry with Backoff', desc: 'All API calls retry 3x with exponential backoff before failing. Handles network blips silently.', phase: 1, status: 'ready', effort: 'S', selfLearn: false },
  { id: 75, cat: 'Self-Debugging', name: 'Dead Button Detection', desc: 'If a button click produces no result in 3 seconds → log it, alert dev, show user a helpful message.', phase: 1, status: 'ready', effort: 'S', selfLearn: true },
  { id: 76, cat: 'Self-Debugging', name: 'Integration Health Dashboard', desc: 'Real-time status of all integrations: QBO, Email, GPS, Bank Feed. Auto-alerts on failure.', phase: 1, status: 'ready', effort: 'M', selfLearn: false },
  { id: 77, cat: 'Self-Debugging', name: 'Auto-Recovery Queue', desc: 'Failed operations (QBO sync, email send) → queue → auto-retry every 5 min. Dashboard shows queue status.', phase: 1, status: 'ready', effort: 'M', selfLearn: true },
  { id: 78, cat: 'Self-Debugging', name: 'Nightly Smoke Tests', desc: 'Automated tests run every night: can create a job? approve an invoice? load the dashboard? Email report of failures.', phase: 1, status: 'ready', effort: 'L', selfLearn: false },
  { id: 79, cat: 'Self-Debugging', name: 'Error Pattern Recognition', desc: 'AI groups errors: \'QBO sync fails every Tuesday 2am → likely cron conflict.\' Suggests root cause.', phase: 2, status: 'planned', effort: 'L', selfLearn: true },
  { id: 80, cat: 'Self-Debugging', name: 'User-Facing Status Page', desc: 'status.rossos.com showing real-time system health. \'All systems operational\' or \'QBO sync delayed 5 min.\'', phase: 1, status: 'ready', effort: 'S', selfLearn: false },
  { id: 81, cat: 'Self-Debugging', name: 'Deploy Canary (10% Rollout)', desc: 'New features roll out to 10% of users first. Auto-rollback if error rate spikes. Zero-downtime deploys.', phase: 2, status: 'planned', effort: 'L', selfLearn: true },
  { id: 82, cat: 'Self-Debugging', name: 'Performance Monitoring', desc: 'Track page load times, API response times, database query speed. Alert when things slow down.', phase: 1, status: 'ready', effort: 'M', selfLearn: false },
  { id: 83, cat: 'Self-Debugging', name: 'Data Integrity Checks', desc: 'Nightly: verify all invoice totals match line items, all budgets balance, no orphaned records. Auto-flag discrepancies.', phase: 1, status: 'ready', effort: 'M', selfLearn: false },
  { id: 84, cat: 'Self-Debugging', name: 'Undo/Rollback on Any Action', desc: 'Accidentally approved? Deleted a record? 30-second undo toast on all destructive actions. Full rollback capability.', phase: 1, status: 'ready', effort: 'M', selfLearn: false },
  { id: 85, cat: 'Self-Debugging', name: 'Browser Compatibility Auto-Test', desc: 'Automated cross-browser testing: Chrome, Safari, Firefox, Edge. Flag layout/functionality breaks.', phase: 2, status: 'planned', effort: 'M', selfLearn: false },
  { id: 86, cat: 'Self-Debugging', name: 'Memory Leak Detection', desc: 'Monitor browser memory usage over time. Alert devs if pages are leaking memory on long sessions.', phase: 2, status: 'planned', effort: 'M', selfLearn: false },
  { id: 87, cat: 'Self-Debugging', name: 'Stale Data Detection', desc: 'If data on screen is >5 min old, show subtle refresh indicator. Auto-refresh critical data (cash position, alerts).', phase: 1, status: 'ready', effort: 'S', selfLearn: false },
  { id: 88, cat: 'Self-Debugging', name: 'Feature Flag System', desc: 'Toggle any feature on/off per company, per role, or globally without deploying code. Instant enable/disable.', phase: 1, status: 'ready', effort: 'M', selfLearn: false },

  // ═══════════════════════════════════════════
  // CATEGORY: DAILY OPERATIONS (89-108)
  // ═══════════════════════════════════════════
  { id: 89, cat: 'Daily Operations', name: 'Daily Log with Voice-to-Text', desc: 'Super speaks into phone → AI transcribes → auto-fills: weather, crew count, work completed, issues. Review and submit.', phase: 1, status: 'ready', effort: 'M', selfLearn: true },
  { id: 90, cat: 'Daily Operations', name: 'Daily Log Photo Attachment', desc: 'Attach unlimited photos per daily log entry. Photos auto-tagged by room and linked to log date.', phase: 1, status: 'ready', effort: 'S', selfLearn: false },
  { id: 91, cat: 'Daily Operations', name: 'AI Daily Log Summary', desc: 'End of week → AI summarizes all daily logs into a weekly progress report. Email to PM and owner.', phase: 1, status: 'ready', effort: 'M', selfLearn: true },
  { id: 92, cat: 'Daily Operations', name: 'Punch List Management', desc: 'Per-room, per-trade punch items with photo evidence. Track: Open → Assigned → In Progress → Verified → Closed.', phase: 1, status: 'ready', effort: 'L', selfLearn: false },
  { id: 93, cat: 'Daily Operations', name: 'Punch List Walkthrough Mode', desc: 'Mobile mode: walk through house, tap room on floor plan → see/add punch items. Homeowner walkthrough mode.', phase: 2, status: 'planned', effort: 'M', selfLearn: false },
  { id: 94, cat: 'Daily Operations', name: 'RFI Management', desc: 'Create RFIs with question + drawings. Track: Open → Submitted → Responded → Closed. Auto-remind when overdue.', phase: 1, status: 'ready', effort: 'M', selfLearn: false },
  { id: 95, cat: 'Daily Operations', name: 'Submittal Tracking', desc: 'Track submittals: created → submitted → reviewed → approved/rejected. Link to specs and selections.', phase: 1, status: 'ready', effort: 'M', selfLearn: false },
  { id: 96, cat: 'Daily Operations', name: 'Change Order Workflow', desc: 'Create CO → price with markup → client approval (digital signature) → update budget + schedule. Full lifecycle.', phase: 1, status: 'ready', effort: 'L', selfLearn: false },
  { id: 97, cat: 'Daily Operations', name: 'Crew Time Clock (GPS)', desc: 'Mobile clock-in/out with GPS verification. Auto-assign to job by location. Overtime alerts.', phase: 1, status: 'ready', effort: 'L', selfLearn: false },
  { id: 98, cat: 'Daily Operations', name: 'Material Waste Tracking', desc: 'Log material waste per phase. AI benchmarks: \'Your drywall waste is 12% — industry avg is 8%.\' Suggests improvements.', phase: 2, status: 'planned', effort: 'M', selfLearn: true },
  { id: 99, cat: 'Daily Operations', name: 'Safety Checklist (OSHA)', desc: 'Digital OSHA safety checklists. Daily site safety audit with photo evidence. Track incidents. OSHA 300 log auto-fill.', phase: 1, status: 'ready', effort: 'M', selfLearn: false },
  { id: 100, cat: 'Daily Operations', name: 'Tool & Equipment Tracking', desc: 'Track who has what tool/equipment, where it is, maintenance schedule. Barcode/QR scan check-in/out.', phase: 2, status: 'planned', effort: 'M', selfLearn: false },
  { id: 101, cat: 'Daily Operations', name: 'Warranty Claim Management', desc: 'Post-completion: homeowner submits warranty claim → routes to responsible vendor → track resolution → close.', phase: 1, status: 'ready', effort: 'M', selfLearn: true },
  { id: 102, cat: 'Daily Operations', name: 'Closeout Checklist Module', desc: 'Per job type: final inspection, CO, utility transfers, warranty registration, lien releases, retainage release, as-builts, owner manual.', phase: 1, status: 'ready', effort: 'L', selfLearn: false },
  { id: 103, cat: 'Daily Operations', name: 'Meeting Minutes Auto-Generate', desc: 'Record meeting → AI transcribes → generates minutes with action items, assignees, and due dates. Auto-distribute.', phase: 2, status: 'planned', effort: 'M', selfLearn: true },
  { id: 104, cat: 'Daily Operations', name: 'Site Visitor Log', desc: 'Digital sign-in for anyone visiting job site. Track: who, when, purpose, company. Liability protection.', phase: 1, status: 'ready', effort: 'S', selfLearn: false },
  { id: 105, cat: 'Daily Operations', name: 'Weather-Based Auto-Scheduling', desc: 'Rain forecast → auto-reschedule outdoor tasks → notify affected crews and subs. Indoor tasks unaffected.', phase: 2, status: 'planned', effort: 'L', selfLearn: true },
  { id: 106, cat: 'Daily Operations', name: 'Permit Tracking Dashboard', desc: 'Track all permits per job: applied → under review → approved → inspections. Auto-remind before expiration.', phase: 1, status: 'ready', effort: 'M', selfLearn: false },
  { id: 107, cat: 'Daily Operations', name: 'Sub/Vendor Field Check-In', desc: 'Subs scan QR at job site → logged as on-site. Verify they showed up when scheduled. No-show alerts.', phase: 2, status: 'planned', effort: 'M', selfLearn: false },
  { id: 108, cat: 'Daily Operations', name: 'Three-Week Look-Ahead Auto-Generate', desc: 'AI generates 3-week look-ahead schedule from master schedule. Formats for weekly sub meeting handout.', phase: 1, status: 'ready', effort: 'M', selfLearn: true },

  // ═══════════════════════════════════════════
  // CATEGORY: FINANCIAL ENHANCEMENTS (109-128)
  // ═══════════════════════════════════════════
  { id: 109, cat: 'Financial', name: 'WIP Report (Work in Progress)', desc: 'Automated WIP report for bank/bonding: % complete, billings, costs, over/under billings. Required for credit lines.', phase: 1, status: 'ready', effort: 'L', selfLearn: false },
  { id: 110, cat: 'Financial', name: 'Draw Request Builder', desc: 'Select completed work items → auto-generate AIA G702/G703 draw request. Track approval + payment.', phase: 1, status: 'ready', effort: 'L', selfLearn: false },
  { id: 111, cat: 'Financial', name: 'Budget Alerts (Threshold-Based)', desc: 'Alert when any cost code hits 80%, 90%, 100% of budget. Configurable per job. Auto-notify PM.', phase: 1, status: 'ready', effort: 'S', selfLearn: false },
  { id: 112, cat: 'Financial', name: 'Purchase Order System', desc: 'Create POs → approve → send to vendor → receive → match to invoice. Full PO lifecycle with budget impact.', phase: 1, status: 'ready', effort: 'L', selfLearn: false },
  { id: 113, cat: 'Financial', name: 'Lien Waiver Automation', desc: 'Auto-generate conditional/unconditional lien waivers. Track status per payment. Block payment without waiver.', phase: 1, status: 'ready', effort: 'M', selfLearn: false },
  { id: 114, cat: 'Financial', name: 'Multi-Entity / Multi-Company', desc: 'Manage multiple LLCs/companies from one login. Consolidated reporting or per-entity views.', phase: 3, status: 'future', effort: 'XL', selfLearn: false },
  { id: 115, cat: 'Financial', name: 'Tax Report Generation', desc: 'Auto-generate 1099 reports, sales tax summaries, job cost reports for CPA at year-end.', phase: 2, status: 'planned', effort: 'M', selfLearn: false },
  { id: 116, cat: 'Financial', name: 'Invoice OCR (Scan Paper Invoices)', desc: 'Photograph paper invoice → AI extracts vendor, amount, date, line items. Auto-creates digital invoice.', phase: 1, status: 'ready', effort: 'M', selfLearn: true },
  { id: 117, cat: 'Financial', name: 'Client Payment Portal', desc: 'Clients pay draws/invoices online via ACH or credit card. Auto-reconcile. Reduce collection time by 50%.', phase: 1, status: 'ready', effort: 'L', selfLearn: false },
  { id: 118, cat: 'Financial', name: 'Escrow / Construction Loan Tracking', desc: 'Track draw schedules against lender requirements. Match inspections to draw approvals. Forecast next draw timing.', phase: 2, status: 'planned', effort: 'L', selfLearn: true },
  { id: 119, cat: 'Financial', name: 'Payroll Integration', desc: 'Sync crew time → calculate payroll → export to Gusto/ADP. Track labor burden per job/phase.', phase: 2, status: 'planned', effort: 'L', selfLearn: false },
  { id: 120, cat: 'Financial', name: 'Credit Card Receipt Matching', desc: 'Connect company card → AI matches receipts to jobs and cost codes. No more shoebox of receipts.', phase: 2, status: 'planned', effort: 'M', selfLearn: true },
  { id: 121, cat: 'Financial', name: 'Allowance Tracking', desc: 'Track allowances per selection: budget, client selections, overages, credits. Real-time allowance burn dashboard.', phase: 1, status: 'ready', effort: 'M', selfLearn: false },
  { id: 122, cat: 'Financial', name: 'Retainage Release Scheduler', desc: 'Track retainage per job with release date/conditions. Auto-remind when retainage is eligible for release.', phase: 1, status: 'ready', effort: 'S', selfLearn: false },
  { id: 123, cat: 'Financial', name: 'Profit Fade Warning', desc: 'AI detects when a job\'s projected margin is shrinking. Alerts before it\'s too late: \'Smith Residence margin dropped from 18% to 14%.\'', phase: 1, status: 'ready', effort: 'M', selfLearn: true },
  { id: 124, cat: 'Financial', name: 'Cost-to-Complete Forecasting', desc: 'AI projects remaining costs based on actual spend rate vs budget. Shows: \'At current pace, you\'ll be $12K over on framing.\'', phase: 1, status: 'ready', effort: 'M', selfLearn: true },
  { id: 125, cat: 'Financial', name: 'Vendor Price Comparison', desc: 'When creating a PO, see price history: \'ABC Lumber quoted $12.50/BF. Your avg over 6 POs is $11.80. Industry: $12.00.\'', phase: 2, status: 'planned', effort: 'M', selfLearn: true },
  { id: 126, cat: 'Financial', name: 'Owner\'s Draw / Distribution Tracking', desc: 'Track owner draws, distributions, retained earnings. Personal vs business expense flagging.', phase: 2, status: 'planned', effort: 'M', selfLearn: false },
  { id: 127, cat: 'Financial', name: 'What-If Scenario Modeling', desc: 'What if lumber goes up 10%? What if we lose the Johnson job? Model financial impact before it happens.', phase: 3, status: 'future', effort: 'L', selfLearn: false },
  { id: 128, cat: 'Financial', name: 'Backlog & Pipeline Revenue Forecast', desc: 'Combined view: signed contracts + weighted pipeline = projected revenue by month. Bank-ready report.', phase: 2, status: 'planned', effort: 'M', selfLearn: true },

  // ═══════════════════════════════════════════
  // CATEGORY: CLIENT EXPERIENCE (129-145)
  // ═══════════════════════════════════════════
  { id: 129, cat: 'Client Experience', name: 'Homeowner Portal', desc: 'Client-facing dashboard: progress %, photos by room, upcoming schedule, budget summary, selections, messages.', phase: 1, status: 'ready', effort: 'XL', selfLearn: false },
  { id: 130, cat: 'Client Experience', name: 'Selection Tracking (Client-Side)', desc: 'Client browses selections (tile, fixtures, paint) → approves with digital signature → locks pricing → updates budget.', phase: 1, status: 'ready', effort: 'L', selfLearn: false },
  { id: 131, cat: 'Client Experience', name: 'Digital Signatures (DocuSign-style)', desc: 'Built-in e-signature for contracts, change orders, selections. No external tool needed. Legally binding.', phase: 1, status: 'ready', effort: 'L', selfLearn: false },
  { id: 132, cat: 'Client Experience', name: 'Weekly Progress Email (Auto)', desc: 'Every Friday → AI generates progress email with photos, schedule update, upcoming milestones. PM reviews and sends.', phase: 1, status: 'ready', effort: 'M', selfLearn: true },
  { id: 133, cat: 'Client Experience', name: 'Client Chat / Messaging', desc: 'In-app messaging between client and PM. No more lost texts/emails. All messages in one thread per job.', phase: 1, status: 'ready', effort: 'M', selfLearn: false },
  { id: 134, cat: 'Client Experience', name: 'Design Selection Mood Board', desc: 'Visual mood board for client selections: drag in photos, swatches, product links. Share and collaborate.', phase: 2, status: 'planned', effort: 'M', selfLearn: false },
  { id: 135, cat: 'Client Experience', name: 'Client Satisfaction Surveys', desc: 'Auto-send surveys at milestones (framing, drywall, final). Track NPS score over time. Flag unhappy clients early.', phase: 2, status: 'planned', effort: 'M', selfLearn: true },
  { id: 136, cat: 'Client Experience', name: 'Live Webcam / Job Site Camera', desc: 'Connect a Wyze/Ring camera → clients can see live view of their job site anytime. Time-lapse generation.', phase: 3, status: 'future', effort: 'L', selfLearn: false },
  { id: 137, cat: 'Client Experience', name: 'Client Referral Tracking', desc: 'Track which clients refer new business. Auto-prompt happy clients for referrals. Referral bonus tracking.', phase: 2, status: 'planned', effort: 'S', selfLearn: true },
  { id: 138, cat: 'Client Experience', name: 'Online Estimate Request (Public)', desc: 'Website widget: visitors describe project → get instant AI ballpark estimate → converts to lead in pipeline.', phase: 1, status: 'ready', effort: 'M', selfLearn: true },
  { id: 139, cat: 'Client Experience', name: 'Appointment Scheduling (Calendly-style)', desc: 'Leads and clients book meetings directly on PM\'s calendar. Auto-confirm, remind, and sync.', phase: 2, status: 'planned', effort: 'M', selfLearn: false },
  { id: 140, cat: 'Client Experience', name: 'Construction Jargon Translator', desc: 'Client portal replaces jargon with plain language: \'rough-in\' → \'initial installation of pipes/wires behind walls.\'', phase: 2, status: 'planned', effort: 'S', selfLearn: true },
  { id: 141, cat: 'Client Experience', name: 'Multi-Language Support', desc: 'Client portal and communications available in Spanish, Portuguese, and other languages. AI auto-translates.', phase: 3, status: 'future', effort: 'L', selfLearn: true },
  { id: 142, cat: 'Client Experience', name: 'Client Document Vault', desc: 'Clients access their docs anytime: contract, plans, permits, warranty, CO approvals, close-out package.', phase: 1, status: 'ready', effort: 'M', selfLearn: false },
  { id: 143, cat: 'Client Experience', name: 'Move-In Readiness Checklist', desc: 'Shared checklist with client for move-in: utilities transferred, keys cut, appliance manuals, warranty cards, etc.', phase: 1, status: 'ready', effort: 'S', selfLearn: false },
  { id: 144, cat: 'Client Experience', name: 'Post-Build Maintenance Reminders', desc: 'After close-out: auto-send seasonal maintenance reminders (clean gutters, inspect caulking, HVAC filter change).', phase: 2, status: 'planned', effort: 'S', selfLearn: false },
  { id: 145, cat: 'Client Experience', name: 'Client Review / Testimonial Collection', desc: 'Auto-prompt happy clients (high NPS) for Google/Houzz reviews. Collect testimonials for website.', phase: 2, status: 'planned', effort: 'S', selfLearn: true },

  // ═══════════════════════════════════════════
  // CATEGORY: MOBILE & FIELD (146-160)
  // ═══════════════════════════════════════════
  { id: 146, cat: 'Mobile & Field', name: 'Progressive Web App (PWA)', desc: 'Install on phone home screen. Works offline. Push notifications. Native-app feel without app store.', phase: 1, status: 'ready', effort: 'L', selfLearn: false },
  { id: 147, cat: 'Mobile & Field', name: 'Offline Mode (Sync Later)', desc: 'Create daily logs, take photos, log time — all offline. Auto-syncs when back on WiFi/cellular.', phase: 1, status: 'ready', effort: 'L', selfLearn: false },
  { id: 148, cat: 'Mobile & Field', name: 'Push Notifications', desc: 'Mobile push for: approvals needed, schedule changes, delivery arrivals, client messages, overdue items.', phase: 1, status: 'ready', effort: 'M', selfLearn: false },
  { id: 149, cat: 'Mobile & Field', name: 'QR Code Scanning', desc: 'Scan QR codes on deliveries for instant receiving. Scan room QR for photo tagging. Scan tool QR for check-out.', phase: 1, status: 'ready', effort: 'M', selfLearn: false },
  { id: 150, cat: 'Mobile & Field', name: 'GPS Auto-Job-Site Detection', desc: 'Phone detects you\'re at a job site based on GPS → auto-sets context to that job. No manual selection.', phase: 1, status: 'ready', effort: 'S', selfLearn: true },
  { id: 151, cat: 'Mobile & Field', name: 'Voice Command Mode', desc: '\'Hey RossOS, create a punch item for kitchen backsplash, assign to tile contractor.\' Hands-free operation.', phase: 3, status: 'future', effort: 'XL', selfLearn: true },
  { id: 152, cat: 'Mobile & Field', name: 'AR Measurement Tool', desc: 'Point phone camera at a room → AR measures dimensions, area, volume. Auto-populate for material calculations.', phase: 3, status: 'future', effort: 'XL', selfLearn: false },
  { id: 153, cat: 'Mobile & Field', name: 'Mobile Approval Swipe', desc: 'Swipe right to approve, left to reject. Quick approval of invoices, POs, time sheets from mobile.', phase: 1, status: 'ready', effort: 'S', selfLearn: false },
  { id: 154, cat: 'Mobile & Field', name: 'Field Worker Simplified View', desc: 'Stripped-down mobile view for field workers: just today\'s tasks, time clock, daily log, photos. No financial data.', phase: 1, status: 'ready', effort: 'M', selfLearn: false },
  { id: 155, cat: 'Mobile & Field', name: 'Delivery Receiving with Photo', desc: 'Delivery arrives → scan or select PO → photo items → mark condition → submit. Auto-updates inventory and triggers invoice matching.', phase: 1, status: 'ready', effort: 'M', selfLearn: false },
  { id: 156, cat: 'Mobile & Field', name: 'Floor Plan Pin-Drop', desc: 'Tap on floor plan to drop a pin → attach photo, punch item, note, or RFI to exact location.', phase: 2, status: 'planned', effort: 'L', selfLearn: false },
  { id: 157, cat: 'Mobile & Field', name: 'Geofenced Time Tracking', desc: 'Auto-detect when crew enters/leaves job site. Suggest clock-in/out. Flag if someone clocks in but isn\'t at site.', phase: 2, status: 'planned', effort: 'M', selfLearn: true },
  { id: 158, cat: 'Mobile & Field', name: 'Weather Widget (Job Site Specific)', desc: 'Per-job-site weather: current conditions + 7-day forecast. Auto-flag outdoor task conflicts.', phase: 1, status: 'ready', effort: 'S', selfLearn: false },
  { id: 159, cat: 'Mobile & Field', name: 'Quick Expense Capture', desc: 'Snap receipt photo → AI reads amount, vendor, date → assign to job + cost code. No manual data entry.', phase: 1, status: 'ready', effort: 'M', selfLearn: true },
  { id: 160, cat: 'Mobile & Field', name: 'Sub/Vendor Mobile Portal', desc: 'Subs get limited mobile access: see their scheduled work, submit invoices, upload lien waivers, view POs.', phase: 2, status: 'planned', effort: 'L', selfLearn: false },

  // ═══════════════════════════════════════════
  // CATEGORY: REPORTS & DOCUMENTS (161-175)
  // ═══════════════════════════════════════════
  { id: 161, cat: 'Reports & Docs', name: 'Report Builder (Drag & Drop)', desc: 'Drag-drop fields to build custom reports. Save templates. Schedule auto-delivery via email.', phase: 2, status: 'planned', effort: 'XL', selfLearn: false },
  { id: 162, cat: 'Reports & Docs', name: 'WIP Report (Bank/Bonding)', desc: 'Auto-generate Work in Progress report formatted for bank covenant review. Pull data from all active jobs.', phase: 1, status: 'ready', effort: 'L', selfLearn: false },
  { id: 163, cat: 'Reports & Docs', name: 'Job Cost Detail Report', desc: 'Per-job breakdown: budget vs actual by cost code, committed costs, forecasted total. Drill into line items.', phase: 1, status: 'ready', effort: 'M', selfLearn: false },
  { id: 164, cat: 'Reports & Docs', name: 'AR Aging Report', desc: 'Aging buckets: Current, 30, 60, 90, 120+ days. Per client. Highlight problem payers.', phase: 1, status: 'ready', effort: 'S', selfLearn: false },
  { id: 165, cat: 'Reports & Docs', name: 'Scheduled Report Delivery', desc: 'Set reports to auto-generate and email: WIP to bank monthly, job cost to owner weekly, AR aging to office daily.', phase: 1, status: 'ready', effort: 'M', selfLearn: false },
  { id: 166, cat: 'Reports & Docs', name: 'AI Narrative Report Summaries', desc: 'Instead of just numbers, AI writes: \'Smith Residence is 65% complete, on budget, but 5 days behind schedule due to weather.\'', phase: 2, status: 'planned', effort: 'M', selfLearn: true },
  { id: 167, cat: 'Reports & Docs', name: 'Document Management System', desc: 'Central doc repository per job: plans, specs, permits, contracts, submittals. Version control. Full-text search.', phase: 1, status: 'ready', effort: 'L', selfLearn: false },
  { id: 168, cat: 'Reports & Docs', name: 'Proposal / Contract Generator', desc: 'AI generates professional proposals from estimates. Customizable templates. Digital signature built in.', phase: 1, status: 'ready', effort: 'L', selfLearn: true },
  { id: 169, cat: 'Reports & Docs', name: 'Close-Out Package Generator', desc: 'Auto-compile close-out package: as-builts, warranties, manuals, lien releases, CO, photos. One-click PDF.', phase: 1, status: 'ready', effort: 'M', selfLearn: false },
  { id: 170, cat: 'Reports & Docs', name: 'Comparison Report (Budget vs Actual)', desc: 'Side-by-side: estimated vs actual cost for completed jobs. Identify where you consistently over/under-estimate.', phase: 1, status: 'ready', effort: 'M', selfLearn: true },
  { id: 171, cat: 'Reports & Docs', name: 'Vendor 1099 Report', desc: 'Year-end: auto-generate 1099 data for all vendors paid >$600. Export for accountant.', phase: 2, status: 'planned', effort: 'S', selfLearn: false },
  { id: 172, cat: 'Reports & Docs', name: 'Project Snapshot PDF', desc: 'One-click: generate a polished PDF snapshot of any job — financials, schedule, photos, risks. Great for owner meetings.', phase: 1, status: 'ready', effort: 'M', selfLearn: false },
  { id: 173, cat: 'Reports & Docs', name: 'Email Template Library', desc: 'Pre-built email templates: payment reminder, schedule update, selection request, meeting invite. Customizable.', phase: 1, status: 'ready', effort: 'S', selfLearn: false },
  { id: 174, cat: 'Reports & Docs', name: 'Letterhead / Branding on All Docs', desc: 'Company logo, colors, and contact info auto-applied to all generated documents, proposals, invoices.', phase: 1, status: 'ready', effort: 'S', selfLearn: false },
  { id: 175, cat: 'Reports & Docs', name: 'Document Expiration Alerts', desc: 'Track expiring documents: permits, insurance, licenses, contracts. Auto-remind 30/15/7 days before.', phase: 1, status: 'ready', effort: 'S', selfLearn: false },

  // ═══════════════════════════════════════════
  // CATEGORY: INTEGRATIONS (176-190)
  // ═══════════════════════════════════════════
  { id: 176, cat: 'Integrations', name: 'QuickBooks Online (Enhanced)', desc: 'Bi-directional sync: invoices, payments, vendors, chart of accounts. Real-time, not batch.', phase: 1, status: 'ready', effort: 'L', selfLearn: false },
  { id: 177, cat: 'Integrations', name: 'Email Integration (Gmail/Outlook)', desc: 'Send/receive emails from within RossOS. Auto-link emails to jobs, clients, vendors. Never lose context.', phase: 2, status: 'planned', effort: 'L', selfLearn: true },
  { id: 178, cat: 'Integrations', name: 'SMS / Text Messaging', desc: 'Send texts to clients and subs from RossOS. Tracked in conversation history. Auto-reminders via text.', phase: 1, status: 'ready', effort: 'M', selfLearn: false },
  { id: 179, cat: 'Integrations', name: 'Zapier / Webhooks', desc: 'Connect to 5,000+ apps via Zapier. Custom webhooks for any event: job created, invoice approved, etc.', phase: 2, status: 'planned', effort: 'M', selfLearn: false },
  { id: 180, cat: 'Integrations', name: 'Google Drive / Dropbox Sync', desc: 'Sync project documents to Google Drive or Dropbox. Architects can drop plans in shared folder → auto-imports.', phase: 2, status: 'planned', effort: 'M', selfLearn: false },
  { id: 181, cat: 'Integrations', name: 'Procore Data Bridge', desc: 'Import/export data to/from Procore for clients who require it on commercial projects.', phase: 3, status: 'future', effort: 'XL', selfLearn: false },
  { id: 182, cat: 'Integrations', name: 'Supplier Catalog API', desc: 'Connect to lumber/material suppliers → real-time pricing in estimates. Auto-update when prices change.', phase: 3, status: 'future', effort: 'XL', selfLearn: true },
  { id: 183, cat: 'Integrations', name: 'Credit Card Processing (Stripe)', desc: 'Accept credit card payments on invoices and draws. 2.9% + $0.30 per transaction.', phase: 2, status: 'planned', effort: 'L', selfLearn: false },
  { id: 184, cat: 'Integrations', name: 'ACH Payment Processing', desc: 'Accept and send ACH payments. Lower fees than credit cards. Auto-reconcile with bank.', phase: 2, status: 'planned', effort: 'L', selfLearn: false },
  { id: 185, cat: 'Integrations', name: 'County Permit Portal Scraping', desc: 'Auto-check county permit status. Scrape inspection results. Alert when permits are approved or failed.', phase: 3, status: 'future', effort: 'XL', selfLearn: true },
  { id: 186, cat: 'Integrations', name: 'Weather API (Auto-Schedule)', desc: 'Integrate NOAA/Weather.com → auto-adjust schedule when bad weather predicted. Notify affected crews.', phase: 1, status: 'ready', effort: 'M', selfLearn: true },
  { id: 187, cat: 'Integrations', name: 'Houzz / Zillow Lead Import', desc: 'Leads from Houzz, Zillow, or website forms auto-create in pipeline. No manual entry.', phase: 2, status: 'planned', effort: 'M', selfLearn: false },
  { id: 188, cat: 'Integrations', name: 'Calendar Sync (Google/Apple/Outlook)', desc: 'RossOS calendar events sync bi-directionally with personal calendars. Never double-book.', phase: 1, status: 'ready', effort: 'M', selfLearn: false },
  { id: 189, cat: 'Integrations', name: 'Accounting API (Xero, Sage)', desc: 'For companies not on QBO: connect to Xero or Sage for financial sync.', phase: 3, status: 'future', effort: 'XL', selfLearn: false },
  { id: 190, cat: 'Integrations', name: 'Slack Notifications', desc: 'Push RossOS notifications to Slack channels. Per-channel configuration: #finance, #fieldops, #alerts.', phase: 2, status: 'planned', effort: 'S', selfLearn: false },

  // ═══════════════════════════════════════════
  // CATEGORY: SECURITY & ADMIN (191-205)
  // ═══════════════════════════════════════════
  { id: 191, cat: 'Security & Admin', name: 'Role-Based Access Control (RBAC)', desc: 'Granular permissions: PM sees their jobs only, Super sees field only, Office sees finances, Owner sees all.', phase: 1, status: 'ready', effort: 'L', selfLearn: false },
  { id: 192, cat: 'Security & Admin', name: 'Two-Factor Authentication', desc: 'SMS or authenticator app 2FA. Required for admin accounts, optional for others.', phase: 1, status: 'ready', effort: 'M', selfLearn: false },
  { id: 193, cat: 'Security & Admin', name: 'SSO (Single Sign-On)', desc: 'Login with Google, Microsoft, or company SSO. No separate password to manage.', phase: 2, status: 'planned', effort: 'L', selfLearn: false },
  { id: 194, cat: 'Security & Admin', name: 'IP Allowlisting', desc: 'Restrict access to specific IP ranges. Office-only access for financial data.', phase: 2, status: 'planned', effort: 'S', selfLearn: false },
  { id: 195, cat: 'Security & Admin', name: 'Data Export (Full Backup)', desc: 'One-click export of ALL your data in standard formats. You own your data. Never locked in.', phase: 1, status: 'ready', effort: 'M', selfLearn: false },
  { id: 196, cat: 'Security & Admin', name: 'Automatic Backups (Daily)', desc: 'Nightly encrypted backups. 90-day retention. Point-in-time recovery if needed.', phase: 1, status: 'ready', effort: 'M', selfLearn: false },
  { id: 197, cat: 'Security & Admin', name: 'Data Retention Policies', desc: 'Set auto-delete rules: delete closed job data after 7 years, archive photos after 2 years, etc.', phase: 2, status: 'planned', effort: 'M', selfLearn: false },
  { id: 198, cat: 'Security & Admin', name: 'User Deactivation (Not Delete)', desc: 'Deactivate former employees without losing their audit trail. Reassign their jobs/tasks.', phase: 1, status: 'ready', effort: 'S', selfLearn: false },
  { id: 199, cat: 'Security & Admin', name: 'Custom Field Builder', desc: 'Add custom fields to any record type: jobs, contacts, invoices. No dev needed. Just configure.', phase: 2, status: 'planned', effort: 'L', selfLearn: false },
  { id: 200, cat: 'Security & Admin', name: 'White-Label / Custom Domain', desc: 'Use your own domain: app.rossbuilt.com instead of app.rossos.com. Your branding everywhere.', phase: 3, status: 'future', effort: 'L', selfLearn: false },
  { id: 201, cat: 'Security & Admin', name: 'API Access (Build Your Own)', desc: 'RESTful API so power users or IT teams can build custom integrations, reports, or automations.', phase: 3, status: 'future', effort: 'XL', selfLearn: false },
  { id: 202, cat: 'Security & Admin', name: 'SOC 2 Compliance Mode', desc: 'Enable SOC 2 compliance features: enhanced logging, access reviews, data encryption at rest.', phase: 3, status: 'future', effort: 'XL', selfLearn: false },
  { id: 203, cat: 'Security & Admin', name: 'Notification Preferences', desc: 'Per-user: choose what notifications you get, how (email/push/in-app), and when (real-time/daily digest).', phase: 1, status: 'ready', effort: 'M', selfLearn: false },
  { id: 204, cat: 'Security & Admin', name: 'Keyboard Shortcuts', desc: 'Power user shortcuts: Ctrl+N new job, Ctrl+K search, Ctrl+I new invoice. Customizable.', phase: 1, status: 'ready', effort: 'S', selfLearn: false },
  { id: 205, cat: 'Security & Admin', name: 'Bulk Actions', desc: 'Select multiple records → bulk approve, bulk export, bulk assign, bulk delete. Saves hours on repetitive tasks.', phase: 1, status: 'ready', effort: 'M', selfLearn: false },

  // ═══════════════════════════════════════════
  // PRODUCTION BLUEPRINT — TRADE INTUITION AI (T1-T80)
  // The foundational knowledge engine that lives inside every AI feature
  // ═══════════════════════════════════════════

  // Domain 1: Material Science & Compatibility (T1-T10)
  { id: 206, cat: 'Trade Intuition AI', name: 'Material Compatibility Matrix', desc: 'AI knows which materials can touch each other and which can\'t. Dissimilar metals cause galvanic corrosion, certain adhesives eat foams, acidic cleaners destroy marble. Flags conflicts in selections and estimates.', phase: 2, status: 'planned', effort: 'XL', selfLearn: true },
  { id: 207, cat: 'Trade Intuition AI', name: 'Weight & Structural Loading', desc: 'AI flags heavy materials: "Selected tile weighs 1,200 lbs on this shower floor. Verify structural support." Knows porcelain slab is 6 lbs/SF vs 2 lbs/SF ceramic.', phase: 2, status: 'planned', effort: 'L', selfLearn: true },
  { id: 208, cat: 'Trade Intuition AI', name: 'Moisture & Climate Behavior', desc: 'Knows wood expansion, hardwood acclimation (7-14 days), LVP expansion gaps, coastal UV/salt ratings, concrete 28-day cure before flooring. Adjusts schedules and selections.', phase: 2, status: 'planned', effort: 'L', selfLearn: true },
  { id: 209, cat: 'Trade Intuition AI', name: 'Thermal Expansion Rules', desc: 'Metal roofing expands 1" per 100\' in Florida heat — needs slip clips. Large-format exterior tile needs expansion joints every 12\'. Composite decking needs 3/16" gap.', phase: 2, status: 'planned', effort: 'M', selfLearn: true },
  { id: 210, cat: 'Trade Intuition AI', name: 'Finish Durability Ratings', desc: 'Matte tile shows every footprint. Polished marble etches from lemon juice. Satin paint is better than flat in kitchens. Informs selections and client expectations.', phase: 2, status: 'planned', effort: 'M', selfLearn: true },
  { id: 211, cat: 'Trade Intuition AI', name: 'Material Cutting Behavior', desc: 'Porcelain slab CANNOT be mitered — requires waterjet. Glass tile needs diamond blade + slow feed. Adds real labor time and tool costs to estimates.', phase: 2, status: 'planned', effort: 'M', selfLearn: true },
  { id: 212, cat: 'Trade Intuition AI', name: 'Adhesive & Fastener Science', desc: 'Thinset types (modified vs unmodified), construction adhesive by substrate, structural screws vs nails, Tapcon spacing in CMU. Validates quality and estimating.', phase: 2, status: 'planned', effort: 'M', selfLearn: true },
  { id: 213, cat: 'Trade Intuition AI', name: 'Material Interaction Over Time', desc: 'Cedar bleeds tannins onto concrete. Iron fasteners in cedar cause black streaks. Silicone over latex peels in 2 years. Prevents warranty issues.', phase: 2, status: 'planned', effort: 'M', selfLearn: true },
  { id: 214, cat: 'Trade Intuition AI', name: 'Indoor Air Quality Factors', desc: 'VOC ratings, cure times before occupancy, low-VOC alternatives. "This epoxy requires 72-hour ventilation before other trades can work." Impacts scheduling.', phase: 3, status: 'future', effort: 'M', selfLearn: true },
  { id: 215, cat: 'Trade Intuition AI', name: 'Material Storage Requirements', desc: 'Hardwood: store flat, climate-controlled, 7+ days acclimation. Drywall: can\'t get wet. Paint: above 50°F. Informs delivery planning and site logistics.', phase: 2, status: 'planned', effort: 'S', selfLearn: true },

  // Domain 2: Installation Sequences & Trade Coordination (T11-T20)
  { id: 216, cat: 'Trade Intuition AI', name: 'Master Build Sequence', desc: 'Foundation → framing → roof → windows → rough MEP → insulation → drywall → prime → cabinets → countertops → tile → trim → paint → fixtures → flooring → punch. AI enforces the correct order.', phase: 2, status: 'planned', effort: 'XL', selfLearn: true },
  { id: 217, cat: 'Trade Intuition AI', name: 'Trade Stacking Rules', desc: 'Can\'t have electrician and plumber in same bathroom (too small). CAN have framers on 2nd floor while electrician does 1st. Drywall hangers and tapers can overlap.', phase: 2, status: 'planned', effort: 'L', selfLearn: true },
  { id: 218, cat: 'Trade Intuition AI', name: 'Prerequisite Chain Logic', desc: 'Before flooring: subfloor must be level, clean, dry. Before tile: backer board + waterproofing cured 24-48 hrs. AI knows EVERY prerequisite for every task.', phase: 2, status: 'planned', effort: 'XL', selfLearn: true },
  { id: 219, cat: 'Trade Intuition AI', name: 'Work Backwards Engine', desc: 'Client wants to move in June 1 → AI works backwards through every trade with real durations, trade availability, lead times, weather buffer. Shows TRUE start date.', phase: 2, status: 'planned', effort: 'L', selfLearn: true },
  { id: 220, cat: 'Trade Intuition AI', name: 'Trade Overlap Opportunities', desc: 'Finds safe overlaps to compress schedule: "Painters can cut in ceilings while trim carpenters install base — saves 2 days."', phase: 2, status: 'planned', effort: 'L', selfLearn: true },
  { id: 221, cat: 'Trade Intuition AI', name: 'Protection Sequencing', desc: 'Hardwood installed? All subsequent trades must use ram board protection. AI adds $0.35/SF for protection materials to estimates automatically.', phase: 2, status: 'planned', effort: 'S', selfLearn: true },
  { id: 222, cat: 'Trade Intuition AI', name: 'Mobilization Reality', desc: 'Tile crew doesn\'t just "show up" — they bring wet saw, mixing station, and need water/power. AI adds realistic mob/demob time to every trade schedule.', phase: 2, status: 'planned', effort: 'S', selfLearn: true },
  { id: 223, cat: 'Trade Intuition AI', name: 'Blade & Consumable Tracking', desc: 'Cutting 2,400 SF porcelain = ~8 diamond blades at $45 each = $360 in consumables. These costs are real and usually missed in estimates.', phase: 2, status: 'planned', effort: 'S', selfLearn: true },
  { id: 224, cat: 'Trade Intuition AI', name: 'Cure Time Enforcement', desc: 'Concrete: 28 days before heavy loads. Grout: 24-72 hrs before sealing. Waterproofing: 24-48 hrs before tile. AI blocks next task until cure time passes.', phase: 2, status: 'planned', effort: 'M', selfLearn: true },
  { id: 225, cat: 'Trade Intuition AI', name: 'Multi-Story Sequencing', desc: 'Work flows DOWN for most trades (roof → 2nd → 1st) but plumbing rough goes UP (drains need slope). HVAC trunk goes 1st floor or attic first. AI knows the exceptions.', phase: 2, status: 'planned', effort: 'M', selfLearn: true },

  // Domain 3: Real-World Constraints & Physics (T21-T30)
  { id: 226, cat: 'Trade Intuition AI', name: 'Gravity & Slope Requirements', desc: 'Drain lines need 1/4" per foot slope. Shower floors need slope to drain. Exterior grade must slope away from foundation 6" in 10\'. AI checks plans.', phase: 2, status: 'planned', effort: 'L', selfLearn: true },
  { id: 227, cat: 'Trade Intuition AI', name: 'Clearance & Access Requirements', desc: 'Toilet rough-in: 15" min from center to wall. Shower: 30" clear width. Electrical panel: 36" clear. AI flags plan violations.', phase: 2, status: 'planned', effort: 'L', selfLearn: true },
  { id: 228, cat: 'Trade Intuition AI', name: 'Lifting & Equipment Needs', desc: 'Steel beam 800 lbs → needs crane. Granite countertop 20 lbs/SF → 3-person lift. Porcelain slab 300 lbs → suction cups + 4-person team. Auto-adds equipment to estimates.', phase: 2, status: 'planned', effort: 'M', selfLearn: true },
  { id: 229, cat: 'Trade Intuition AI', name: 'Access Path Planning', desc: '10\' granite island won\'t fit through 36" door. Plan delivery BEFORE door frames are installed, or bring through window opening during framing.', phase: 2, status: 'planned', effort: 'M', selfLearn: true },
  { id: 230, cat: 'Trade Intuition AI', name: 'Temperature & Weather Constraints', desc: 'Can\'t pour concrete below 40°F. Can\'t spray paint below 50°F. Can\'t install hardwood below 60°F. AI checks weather forecast against scheduled tasks.', phase: 2, status: 'planned', effort: 'M', selfLearn: true },

  // Domain 4: Problem-Solving Engine (T31-T40)
  { id: 231, cat: 'Trade Intuition AI', name: 'Floor Leveling Solutions', desc: 'Subfloor 3/8" out? Option A: Self-leveling compound ($3.50/SF). Option B: Plywood shim ($1.50/SF). Option C: Grind high spots ($2/SF). Ranked by cost/quality.', phase: 2, status: 'planned', effort: 'L', selfLearn: true },
  { id: 232, cat: 'Trade Intuition AI', name: 'Schedule Compression Options', desc: 'Job 10 days behind? Option A: Saturday work (+$4,800 OT). Option B: Double crews on trim/paint (saves 6 days, +$2,400). Option C: Defer to warranty.', phase: 2, status: 'planned', effort: 'L', selfLearn: true },
  { id: 233, cat: 'Trade Intuition AI', name: 'Budget Overrun Recovery', desc: 'Framing $8K over? Option A: Value-engineer finishes. Option B: Change order for scope additions. Option C: Absorb in contingency. AI ranks options.', phase: 2, status: 'planned', effort: 'L', selfLearn: true },
  { id: 234, cat: 'Trade Intuition AI', name: 'Material Substitution Engine', desc: 'Specified tile discontinued? AI matches replacement: size, color, PEI rating, price range. Checks manufacturer alternatives and dead stock.', phase: 2, status: 'planned', effort: 'M', selfLearn: true },
  { id: 235, cat: 'Trade Intuition AI', name: 'Weather Delay Recovery', desc: '5 rain days killed exterior schedule? AI suggests: shift to interior work, add crews when weather clears, adjust sequence to keep critical path moving.', phase: 2, status: 'planned', effort: 'M', selfLearn: true },

  // Domain 5-8: Trade Knowledge, Coordination, Cost, Safety (T41-T80) — summarized
  { id: 236, cat: 'Trade Intuition AI', name: 'Framing Intelligence', desc: 'Crown direction, jack/king/cripple studs, header sizing by span, shear wall nailing, blocking for cabinets/grab bars/TVs, Simpson ties per wind zone.', phase: 2, status: 'planned', effort: 'XL', selfLearn: true },
  { id: 237, cat: 'Trade Intuition AI', name: 'Electrical Intelligence', desc: 'Wire gauge by amperage, box fill calcs, AFCI/GFCI by room (2020 NEC), panel sizing, dedicated circuits for all major appliances.', phase: 2, status: 'planned', effort: 'XL', selfLearn: true },
  { id: 238, cat: 'Trade Intuition AI', name: 'Plumbing Intelligence', desc: 'DWV sizing by fixture units, vent requirements, PEX vs copper, shower valve rough-in dimensions by manufacturer, gas line sizing by BTU.', phase: 2, status: 'planned', effort: 'XL', selfLearn: true },
  { id: 239, cat: 'Trade Intuition AI', name: 'HVAC Intelligence', desc: 'Manual J load calc, duct sizing by CFM, return air per room, refrigerant line sizing, zoning strategies for 2-story homes.', phase: 2, status: 'planned', effort: 'XL', selfLearn: true },
  { id: 240, cat: 'Trade Intuition AI', name: 'Tile / Cabinet / Paint / Flooring Intelligence', desc: 'Deep knowledge per trade: substrate prep, thinset types, grout joints, cabinet fillers, paint prep, flooring subfloor requirements, transition types.', phase: 2, status: 'planned', effort: 'XL', selfLearn: true },
  { id: 241, cat: 'Trade Intuition AI', name: 'Roofing / Concrete Intelligence', desc: 'Underlayment by pitch/wind zone, flashing details, ventilation calcs, mix design by application, rebar spacing, control joints, form removal timing.', phase: 2, status: 'planned', effort: 'XL', selfLearn: true },
  { id: 242, cat: 'Trade Intuition AI', name: 'Coordination Intelligence', desc: 'Pre-rough coordination, penetration conflicts, ceiling height impact analysis, floor transitions, backing/blocking maps, outlet coordination, door swing conflicts.', phase: 2, status: 'planned', effort: 'XL', selfLearn: true },
  { id: 243, cat: 'Trade Intuition AI', name: 'True Installation Rates', desc: 'Real rates: tile crew 150 SF/day floor, 60 SF/day mosaic, 40 SF/day shower walls. AI uses YOUR actual rates, not textbook averages.', phase: 2, status: 'planned', effort: 'M', selfLearn: true },
  { id: 244, cat: 'Trade Intuition AI', name: 'Hidden Cost Detection', desc: 'Porcelain slab install? Add: suction cup rental, extra labor (4 vs 2), blade consumption, edge polishing. These add 30% beyond "just the tile" cost.', phase: 2, status: 'planned', effort: 'M', selfLearn: true },
  { id: 245, cat: 'Trade Intuition AI', name: 'Waste Factor Learning', desc: 'Tracks YOUR actual waste: drywall 8-12%, framing 5-8%, hardwood 10-15%, tile 10-20% depending on pattern. Calibrates future takeoffs.', phase: 2, status: 'planned', effort: 'M', selfLearn: true },
  { id: 246, cat: 'Trade Intuition AI', name: 'Safety & Compliance Intelligence', desc: 'Fall protection rules, silica dust compliance, confined space, hot work protocols, lead/asbestos awareness, LOTO, trench safety, hurricane prep, code versions.', phase: 2, status: 'planned', effort: 'L', selfLearn: true },
  { id: 247, cat: 'Trade Intuition AI', name: '7-Layer Thinking Engine', desc: 'Every decision runs through 7 validation layers: Prerequisites, Material Validation, Trade Conflict Scan, Downstream Impact, Cost & Budget, Quality & Warranty Risk, Client Communication.', phase: 2, status: 'planned', effort: 'XL', selfLearn: true },

  // ═══════════════════════════════════════════
  // PART 1: PLAN ANALYSIS & TAKEOFFS (248-287)
  // ═══════════════════════════════════════════
  { id: 248, cat: 'Plan Analysis', name: 'Drag-Drop Plan Upload', desc: 'Upload full plan sets (PDF, DWG, DXF). Auto-detect page types: floor plan, elevation, electrical, plumbing, HVAC, structural, site plan.', phase: 2, status: 'planned', effort: 'M', selfLearn: true },
  { id: 249, cat: 'Plan Analysis', name: 'AI Plan Page Classification', desc: 'AI reads each page and labels it: "Sheet A2.1 - First Floor Plan" vs "Sheet S3 - Roof Framing." No manual sorting.', phase: 2, status: 'planned', effort: 'L', selfLearn: true },
  { id: 250, cat: 'Plan Analysis', name: 'Room Detection from Plans', desc: 'AI identifies rooms from floor plans: Kitchen (12x14), Master Bedroom (16x18), Bath 2 (8x10). Creates room registry for the job.', phase: 2, status: 'planned', effort: 'XL', selfLearn: true },
  { id: 251, cat: 'Plan Analysis', name: 'Dimension Extraction', desc: 'AI reads dimensions from plans. Sets scale automatically from scale bar. Extracts room sizes, wall lengths, window openings.', phase: 2, status: 'planned', effort: 'XL', selfLearn: true },
  { id: 252, cat: 'Plan Analysis', name: 'Plan Comparison (Version Diff)', desc: 'Upload Rev A and Rev B → AI highlights what changed: moved wall, added window, changed dimension. No manual redline comparison.', phase: 2, status: 'planned', effort: 'L', selfLearn: true },
  { id: 253, cat: 'Plan Analysis', name: 'Plan Markup & Redline', desc: 'Draw on plans: circles, arrows, text, measurements. Save markups per user. Share with subs. Link markups to RFIs.', phase: 2, status: 'planned', effort: 'M', selfLearn: false },
  { id: 254, cat: 'Plan Analysis', name: 'Spec Book Parser', desc: 'Upload spec book PDF → AI extracts specifications by division (03-Concrete, 06-Wood, 09-Finishes). Links specs to relevant plan pages.', phase: 2, status: 'planned', effort: 'L', selfLearn: true },
  { id: 255, cat: 'Plan Analysis', name: 'Plan Search (Full Text)', desc: 'Search across all plan pages: "where is the tray ceiling?" → AI finds it on Sheet A4.2 and highlights the area.', phase: 2, status: 'planned', effort: 'L', selfLearn: true },
  { id: 256, cat: 'Plan Analysis', name: 'Split-Screen Plan Viewer', desc: 'View two plan pages side-by-side: floor plan + electrical, or elevation + structural. Synchronized zoom/pan.', phase: 2, status: 'planned', effort: 'M', selfLearn: false },
  { id: 257, cat: 'Plan Analysis', name: 'Code Compliance Quick-Check', desc: 'AI scans plans against local building code: "Bedroom egress window appears undersized (4.2 SF vs 5.7 SF required)."', phase: 3, status: 'future', effort: 'XL', selfLearn: true },
  { id: 258, cat: 'Plan Analysis', name: 'MEP Coordination Viewer', desc: 'Overlay mechanical, electrical, and plumbing plans to spot conflicts: "Duct route crosses beam at Grid B-4."', phase: 3, status: 'future', effort: 'L', selfLearn: true },

  // Material Takeoffs
  { id: 259, cat: 'Plan Analysis', name: 'AI Framing Takeoff', desc: 'From floor plans + structural → AI calculates: studs, plates, headers, cripples, blocking. Accounts for 16" or 24" OC.', phase: 2, status: 'planned', effort: 'XL', selfLearn: true },
  { id: 260, cat: 'Plan Analysis', name: 'AI Drywall Takeoff', desc: 'From room dimensions → calculate drywall sheets, joint compound, tape, screws. Accounts for ceiling height, waste factor.', phase: 2, status: 'planned', effort: 'L', selfLearn: true },
  { id: 261, cat: 'Plan Analysis', name: 'AI Paint Takeoff', desc: 'From wall/ceiling SF → calculate gallons by room. Primer vs topcoat, number of coats, doors/windows deducted.', phase: 2, status: 'planned', effort: 'L', selfLearn: true },
  { id: 262, cat: 'Plan Analysis', name: 'AI Flooring / Tile / Roofing Takeoff', desc: 'Calculate SF + waste for flooring, tile (thinset, grout, backer board), roofing (squares, underlayment, flashing). Pattern-aware waste factors.', phase: 2, status: 'planned', effort: 'XL', selfLearn: true },
  { id: 263, cat: 'Plan Analysis', name: 'AI Concrete / Insulation Takeoff', desc: 'From foundation plan → CY of concrete, rebar, forms. From wall plans → insulation batts/blown-in by R-value zone.', phase: 2, status: 'planned', effort: 'XL', selfLearn: true },
  { id: 264, cat: 'Plan Analysis', name: 'AI Window & Door Schedule', desc: 'From plans → extract every window and door with size, type, quantity, location. Auto-creates W&D schedule.', phase: 2, status: 'planned', effort: 'L', selfLearn: true },
  { id: 265, cat: 'Plan Analysis', name: 'AI Trim & Millwork Takeoff', desc: 'Calculate baseboard LF, crown LF, casing LF per door/window, wainscot SF. By room and total.', phase: 2, status: 'planned', effort: 'L', selfLearn: true },
  { id: 266, cat: 'Plan Analysis', name: 'Takeoff Comparison (Estimate vs Actual)', desc: 'After job completion: compare AI takeoff quantities to what you actually ordered. Calibrate future accuracy.', phase: 2, status: 'planned', effort: 'M', selfLearn: true },
  { id: 267, cat: 'Plan Analysis', name: 'Multi-Vendor Price Comparison', desc: 'Same material list → send to 3 suppliers → compare prices side-by-side. AI highlights best deal per line item.', phase: 2, status: 'planned', effort: 'M', selfLearn: true },
  { id: 268, cat: 'Plan Analysis', name: 'SF/LF Calculator Tool', desc: 'On-screen measurement tool: click-drag on uploaded plans to measure SF areas or LF runs. Auto-scales based on plan scale.', phase: 2, status: 'planned', effort: 'M', selfLearn: false },

  // ═══════════════════════════════════════════
  // PART 2: BIDDING & ESTIMATING (269-293)
  // ═══════════════════════════════════════════
  { id: 269, cat: 'Bidding & Estimating', name: 'Bid Package Builder', desc: 'Select trades to bid → system generates bid package: relevant plan sheets, spec sections, scope letter, bid form. One click.', phase: 2, status: 'planned', effort: 'L', selfLearn: false },
  { id: 270, cat: 'Bidding & Estimating', name: 'Bid Invitation Portal', desc: 'Send bid invitations to subs via email. They get a portal link to: download plans, ask questions, submit bid, upload exclusions.', phase: 2, status: 'planned', effort: 'L', selfLearn: false },
  { id: 271, cat: 'Bidding & Estimating', name: 'Bid Leveling Spreadsheet', desc: 'All bids displayed side-by-side. Auto-flag: missing scope items, unusually low/high numbers, exclusions that others included.', phase: 2, status: 'planned', effort: 'L', selfLearn: true },
  { id: 272, cat: 'Bidding & Estimating', name: 'AI Bid Analysis', desc: 'AI reads submitted bids and summarizes: "Electrician A is $4K cheaper but excludes low-voltage. True cost difference: $800."', phase: 2, status: 'planned', effort: 'XL', selfLearn: true },
  { id: 273, cat: 'Bidding & Estimating', name: 'Scope Gap Detection', desc: 'AI compares each bid against scope letter: "Plumber B didn\'t include gas line. Neither included water softener loop."', phase: 2, status: 'planned', effort: 'L', selfLearn: true },
  { id: 274, cat: 'Bidding & Estimating', name: 'Historical Bid Database', desc: 'Every bid you\'ve ever received, searchable. Trend pricing over time. "What did ABC Framing bid for 3,500 SF last year?"', phase: 2, status: 'planned', effort: 'M', selfLearn: true },
  { id: 275, cat: 'Bidding & Estimating', name: 'Value Engineering Suggestions', desc: 'AI suggests cost-saving alternatives: "Swap engineered hardwood for LVP in secondary bedrooms: save $4,200."', phase: 2, status: 'planned', effort: 'L', selfLearn: true },
  { id: 276, cat: 'Bidding & Estimating', name: 'Contingency Calculator', desc: 'AI recommends contingency % based on: project complexity, historical overruns, client decisiveness, plan completeness. Not just a flat 5%.', phase: 2, status: 'planned', effort: 'M', selfLearn: true },
  { id: 277, cat: 'Bidding & Estimating', name: 'Estimate Presentation Mode', desc: 'Transform estimate into polished client presentation: clean formatting, grouped by phase, alternates shown, no cost-code jargon.', phase: 2, status: 'planned', effort: 'M', selfLearn: false },
  { id: 278, cat: 'Bidding & Estimating', name: 'Escalation Forecasting', desc: 'AI predicts material price changes: "If you wait 3 months to start, lumber could be 5-8% higher. Impact: +$6,200."', phase: 3, status: 'future', effort: 'L', selfLearn: true },
  { id: 279, cat: 'Bidding & Estimating', name: 'Client Budget Reality Check', desc: 'Client says "$400K for 3,000 SF custom." AI: "Your average cost is $285/SF. Budget supports 1,400 SF or scope reduction needed."', phase: 2, status: 'planned', effort: 'M', selfLearn: true },
  { id: 280, cat: 'Bidding & Estimating', name: 'Estimate-to-Contract Converter', desc: 'One click: convert approved estimate into contract with line items, payment schedule, terms, allowances, exclusions. Ready for signature.', phase: 2, status: 'planned', effort: 'M', selfLearn: false },
  { id: 281, cat: 'Bidding & Estimating', name: 'Cost Database Community', desc: 'Opt-in: share anonymized cost data with other RossOS users in your region. See avg framing labor, material costs in your market.', phase: 3, status: 'future', effort: 'XL', selfLearn: true },

  // ═══════════════════════════════════════════
  // PART 3 + 7: SELECTIONS EXPERIENCE (282-321)
  // ═══════════════════════════════════════════
  { id: 282, cat: 'Selections Experience', name: 'Vibe Board Creator', desc: 'Clients create visual mood boards: drag in photos from Pinterest, Houzz, Instagram, or upload. Organize by room or style.', phase: 2, status: 'planned', effort: 'L', selfLearn: false },
  { id: 283, cat: 'Selections Experience', name: 'AI Style Detection', desc: 'Upload vibe board photos → AI identifies: "Modern Farmhouse with Coastal influences. Primary palette: white/navy/natural wood."', phase: 2, status: 'planned', effort: 'L', selfLearn: true },
  { id: 284, cat: 'Selections Experience', name: 'Vibe-to-Selections Matching', desc: 'AI analyzes vibe board → suggests specific products that match the style. Links to local suppliers.', phase: 2, status: 'planned', effort: 'XL', selfLearn: true },
  { id: 285, cat: 'Selections Experience', name: 'Style Quiz for Clients', desc: 'Fun 10-question visual quiz: "Pick the kitchen you love most." Result: "73% Coastal Modern, 27% Transitional." Auto-generates starter vibe board.', phase: 2, status: 'planned', effort: 'M', selfLearn: true },
  { id: 286, cat: 'Selections Experience', name: 'Selection Cards (Swipeable)', desc: 'Each option as a beautiful card: product photo, name, price, lead time, specs. Swipe through options like a dating app.', phase: 2, status: 'planned', effort: 'L', selfLearn: false },
  { id: 287, cat: 'Selections Experience', name: 'Good / Better / Best Tiers', desc: 'For each selection: 3 tiers with real products and pricing. Client sees exactly what each upgrade costs. Links to allowance.', phase: 2, status: 'planned', effort: 'M', selfLearn: false },
  { id: 288, cat: 'Selections Experience', name: 'Budget Impact (Real-Time)', desc: 'Client picks tile at $15/SF over $12/SF allowance: instantly see "This adds $840 to your contract." Before they commit.', phase: 2, status: 'planned', effort: 'M', selfLearn: false },
  { id: 289, cat: 'Selections Experience', name: 'AR Room Preview', desc: 'Point phone at a room → AR overlays selected paint color, flooring, or tile on actual walls/floors. See before you commit.', phase: 3, status: 'future', effort: 'XL', selfLearn: true },
  { id: 290, cat: 'Selections Experience', name: 'Paint Color Visualizer', desc: 'Upload room photo → virtually paint walls in any Sherwin-Williams/Benjamin Moore color. See YOUR walls, not stock photos.', phase: 2, status: 'planned', effort: 'L', selfLearn: true },
  { id: 291, cat: 'Selections Experience', name: 'Couple Decision Mode', desc: 'Both partners independently rate options (1-5 stars), then reveal matches. "You both gave Calcutta marble 5 stars!" Reduces arguments.', phase: 2, status: 'planned', effort: 'M', selfLearn: false },
  { id: 292, cat: 'Selections Experience', name: 'Selection Gamification', desc: 'Progress bars, completion badges, streak tracking. "You\'ve made 12 selections this week — Master Selector!" Makes it fun, not a chore.', phase: 2, status: 'planned', effort: 'M', selfLearn: false },
  { id: 293, cat: 'Selections Experience', name: 'Compatibility Checker', desc: 'AI flags conflicts: "Undermount sink requires solid surface countertop. Your current selection is tile — not compatible."', phase: 2, status: 'planned', effort: 'L', selfLearn: true },
  { id: 294, cat: 'Selections Experience', name: 'Lead Time Alerts', desc: 'AI checks: "Wolf range has 16-week lead time. Order by Feb 1 or kitchen install delays by 6 weeks."', phase: 2, status: 'planned', effort: 'M', selfLearn: true },
  { id: 295, cat: 'Selections Experience', name: 'Finish Palette Harmony Check', desc: 'AI evaluates all selections together: "Warm brass hardware conflicts with cool chrome faucets. Consider matching metals."', phase: 2, status: 'planned', effort: 'L', selfLearn: true },
  { id: 296, cat: 'Selections Experience', name: 'Room Visualizer (3D)', desc: 'Basic 3D room model → swap cabinet colors, countertop materials, floor options, paint colors. See the whole room come together.', phase: 3, status: 'future', effort: 'XL', selfLearn: true },
  { id: 297, cat: 'Selections Experience', name: 'Exterior Visualizer', desc: 'Upload photo of home → swap siding color, trim color, roof color, front door color, shutters. See full exterior options.', phase: 3, status: 'future', effort: 'XL', selfLearn: true },
  { id: 298, cat: 'Selections Experience', name: 'Backsplash Pattern Preview', desc: 'Preview actual patterns: subway stack, herringbone, basket weave, chevron. See each layout with YOUR selected tile.', phase: 3, status: 'future', effort: 'L', selfLearn: false },
  { id: 299, cat: 'Selections Experience', name: 'Selection-to-PO Pipeline', desc: 'Selection locked → auto-create PO to supplier with exact product details. No manual re-entry. Tracks through delivery.', phase: 2, status: 'planned', effort: 'M', selfLearn: false },
  { id: 300, cat: 'Selections Experience', name: 'Selection Meeting Notes (AI)', desc: 'Record selection meeting → AI transcribes and summarizes decisions, follow-ups, and client preferences.', phase: 2, status: 'planned', effort: 'M', selfLearn: true },

  // ═══════════════════════════════════════════
  // PART 4: PRODUCTION & QUALITY (301-335)
  // ═══════════════════════════════════════════
  { id: 301, cat: 'Production & Quality', name: 'Gantt Chart Builder', desc: 'Visual Gantt with task dependencies, critical path highlighting, resource assignment. Drag to adjust. Auto-recalculate downstream dates.', phase: 2, status: 'planned', effort: 'XL', selfLearn: false },
  { id: 302, cat: 'Production & Quality', name: 'AI Schedule Generator', desc: 'Input: home type, SF, finish level → AI generates complete schedule with realistic durations based on YOUR historical data.', phase: 2, status: 'planned', effort: 'XL', selfLearn: true },
  { id: 303, cat: 'Production & Quality', name: 'Template Schedules', desc: 'Pre-built templates: "3/2 Slab Ranch" = 180 tasks pre-loaded with typical durations and dependencies. Clone and customize per job.', phase: 2, status: 'planned', effort: 'M', selfLearn: false },
  { id: 304, cat: 'Production & Quality', name: 'Critical Path Auto-Calculate', desc: 'AI identifies the critical path: "If framing delays 2 days, project delays 2 days. But painting has 3 days float."', phase: 2, status: 'planned', effort: 'L', selfLearn: false },
  { id: 305, cat: 'Production & Quality', name: 'Schedule vs Actual Tracking', desc: 'Planned vs actual start/finish per task. Visual: green (on time), yellow (1-3 days late), red (4+ late).', phase: 2, status: 'planned', effort: 'M', selfLearn: false },
  { id: 306, cat: 'Production & Quality', name: 'Earned Value Analysis', desc: 'Planned % complete vs actual % complete vs % budget spent. The holy trinity of project health.', phase: 2, status: 'planned', effort: 'L', selfLearn: false },
  { id: 307, cat: 'Production & Quality', name: 'Resource Leveling', desc: 'AI: "3 jobs need framing crew same week but only 2 crews. Suggest: delay Davis job 4 days (non-critical)."', phase: 2, status: 'planned', effort: 'L', selfLearn: true },
  { id: 308, cat: 'Production & Quality', name: 'Task Completion Verification', desc: 'Task marked complete → requires photo evidence, inspection passed (if applicable), PM sign-off. No fake "complete" statuses.', phase: 2, status: 'planned', effort: 'M', selfLearn: false },
  { id: 309, cat: 'Production & Quality', name: 'Quality Checklist by Phase', desc: 'Per phase: configurable checklists. Framing: crown/plumb, nailing pattern, blocking, straps. Photo required per item.', phase: 2, status: 'planned', effort: 'M', selfLearn: false },
  { id: 310, cat: 'Production & Quality', name: 'Pre-Drywall Walkthrough Checklist', desc: 'THE most critical QC point. 50+ items: electrical covers, plumbing tests, HVAC duct sealing, fire blocking, framing corrections.', phase: 2, status: 'planned', effort: 'M', selfLearn: false },
  { id: 311, cat: 'Production & Quality', name: 'Inspection Prep Checklist', desc: 'Before calling inspector: AI-generated checklist of what inspectors look for. Different per type and county. Reduce failures.', phase: 2, status: 'planned', effort: 'M', selfLearn: true },
  { id: 312, cat: 'Production & Quality', name: 'Warranty Item Prevention', desc: 'AI analyzes past warranty claims: "12 of last 20 homes had grout cracking. Recommend: flexible grout + expansion joints."', phase: 2, status: 'planned', effort: 'L', selfLearn: true },
  { id: 313, cat: 'Production & Quality', name: 'Sub Quality Scorecard', desc: 'Per sub, per job: quality score based on inspection pass rate, punch count, callback frequency, rework needed.', phase: 2, status: 'planned', effort: 'M', selfLearn: true },
  { id: 314, cat: 'Production & Quality', name: 'Daily Crew Board', desc: 'Visual board: who\'s on what job today. Drag-drop to reassign. See gaps in crew scheduling.', phase: 2, status: 'planned', effort: 'M', selfLearn: false },
  { id: 315, cat: 'Production & Quality', name: 'Site Logistics Map', desc: 'Interactive site map: dumpster, port-a-john, material staging, equipment, parking. Update as phases change.', phase: 2, status: 'planned', effort: 'L', selfLearn: false },
  { id: 316, cat: 'Production & Quality', name: 'Schedule Delay Predictor', desc: 'AI: "Based on current pace + weather + sub availability, job finishes April 22 (7 days late). Cause: framing took 3 extra days."', phase: 2, status: 'planned', effort: 'L', selfLearn: true },
  { id: 317, cat: 'Production & Quality', name: 'Cost Overrun Predictor', desc: 'AI: "At current spend rate, electrical exceeds budget by $2,400. Cause: 3 additional circuits. Recommend change order."', phase: 2, status: 'planned', effort: 'L', selfLearn: true },
  { id: 318, cat: 'Production & Quality', name: 'Crew Composition Optimizer', desc: 'AI: "Most productive framing crew is Mike + Carlos + Jesus (14% above average). Assign them to critical-path framing."', phase: 3, status: 'future', effort: 'M', selfLearn: true },
  { id: 319, cat: 'Production & Quality', name: 'Job Similarity Matching', desc: 'AI: "This job is 87% similar to Miller Addition. Miller actual costs make a great budget benchmark."', phase: 2, status: 'planned', effort: 'M', selfLearn: true },

  // ═══════════════════════════════════════════
  // PART 5: PROCUREMENT & SUPPLY CHAIN (320-339)
  // ═══════════════════════════════════════════
  { id: 320, cat: 'Procurement', name: 'PO from Takeoff (1-Click)', desc: 'Takeoff says 150 sheets drywall → click "Create PO" → auto-fills item, quantity, job, cost code, vendor. Just approve and send.', phase: 2, status: 'planned', effort: 'M', selfLearn: false },
  { id: 321, cat: 'Procurement', name: 'Delivery Calendar (All Jobs)', desc: 'Visual calendar of all expected deliveries across all jobs. Spot conflicts: "Two lumber deliveries same morning at different sites."', phase: 2, status: 'planned', effort: 'M', selfLearn: false },
  { id: 322, cat: 'Procurement', name: 'Delivery Receiving App', desc: 'Mobile: delivery arrives → scan PO barcode → compare items vs ordered → photo condition → note damages → submit. Updates inventory instantly.', phase: 2, status: 'planned', effort: 'L', selfLearn: false },
  { id: 323, cat: 'Procurement', name: 'Backorder Tracking', desc: 'Item backordered? Track revised ETA. AI adjusts schedule: "Backordered vanity delays bath trim by 8 days."', phase: 2, status: 'planned', effort: 'M', selfLearn: true },
  { id: 324, cat: 'Procurement', name: 'Preferred Vendor Auto-Suggest', desc: 'Creating PO for framing lumber? AI: "ABC Lumber (preferred, 95% reliable, best pricing for this material)."', phase: 2, status: 'planned', effort: 'S', selfLearn: true },
  { id: 325, cat: 'Procurement', name: 'Order Consolidation', desc: 'AI: "3 POs to ABC Lumber across 3 jobs. Consolidate into one delivery to save $300 in delivery fees."', phase: 2, status: 'planned', effort: 'M', selfLearn: true },
  { id: 326, cat: 'Procurement', name: 'Lead Time Calendar', desc: 'Database of lead times: impact windows 8 weeks, custom cabinets 6 weeks, appliances 12 weeks. Auto-calculate order-by dates.', phase: 2, status: 'planned', effort: 'M', selfLearn: true },
  { id: 327, cat: 'Procurement', name: 'Vendor Compliance Dashboard', desc: 'At a glance: which vendors have current insurance, W-9, valid license. Block POs to non-compliant vendors.', phase: 2, status: 'planned', effort: 'M', selfLearn: false },
  { id: 328, cat: 'Procurement', name: 'Takeoff-to-PO-to-Schedule Pipeline', desc: 'Complete flow: AI takeoff → PO created → delivery scheduled → linked to schedule task → invoice matched. Zero manual linking.', phase: 3, status: 'future', effort: 'XL', selfLearn: false },
  { id: 329, cat: 'Procurement', name: 'Surplus Material Marketplace', desc: 'Leftover materials? Post to internal marketplace. Other PMs can "shop" before ordering new. Reduce waste and cost.', phase: 3, status: 'future', effort: 'L', selfLearn: false },

  // ═══════════════════════════════════════════
  // PART 6: SMART REPORTS (330-349)
  // ═══════════════════════════════════════════
  { id: 330, cat: 'Smart Reports', name: 'Owner\'s Weekly Report (AI)', desc: 'Auto-generated: AI writes narrative + key metrics + photos + issues + next week preview. PM reviews, clicks send.', phase: 2, status: 'planned', effort: 'M', selfLearn: true },
  { id: 331, cat: 'Smart Reports', name: 'Bank Draw Package', desc: 'Auto-compile: AIA G702/G703, progress photos, inspection reports, lien waivers. Upload to lender portal or export PDF.', phase: 2, status: 'planned', effort: 'L', selfLearn: false },
  { id: 332, cat: 'Smart Reports', name: 'Post-Job Autopsy Report', desc: 'After close: AI analyzes estimated vs actual costs per trade, schedule variance, change orders, lessons learned.', phase: 2, status: 'planned', effort: 'L', selfLearn: true },
  { id: 333, cat: 'Smart Reports', name: 'Portfolio Health Dashboard', desc: 'Across ALL jobs: which are healthy, at risk, or in trouble? Ranked by concern level. One view to rule them all.', phase: 2, status: 'planned', effort: 'L', selfLearn: false },
  { id: 334, cat: 'Smart Reports', name: 'Cash Flow Forecast (90-Day)', desc: 'Projected cash flow: money in (draws, payments) vs money out (payables, payroll, POs). Graph shows when cash gets tight.', phase: 2, status: 'planned', effort: 'L', selfLearn: true },
  { id: 335, cat: 'Smart Reports', name: 'Labor Productivity Report', desc: 'Per crew/trade: output per hour/day. Trend over time. Compare crews on similar tasks. Identify best performers.', phase: 2, status: 'planned', effort: 'M', selfLearn: true },
  { id: 336, cat: 'Smart Reports', name: 'Change Order Trend Report', desc: 'Across all jobs: CO frequency, causes, dollar impact. "42% of your COs come from client selection changes."', phase: 2, status: 'planned', effort: 'M', selfLearn: true },
  { id: 337, cat: 'Smart Reports', name: 'Schedule Adherence Report', desc: 'Per job: % of tasks completed on time. Trend over project life. Identify phases that consistently run late.', phase: 2, status: 'planned', effort: 'M', selfLearn: true },
  { id: 338, cat: 'Smart Reports', name: 'Custom KPI Dashboard', desc: 'Build your own dashboard: pick metrics, drag-drop widgets, save layouts per role. Your data, your way.', phase: 3, status: 'future', effort: 'XL', selfLearn: false },

  // ═══════════════════════════════════════════
  // PART 8: CROSS-CUTTING AI (339-358)
  // ═══════════════════════════════════════════
  { id: 339, cat: 'Cross-Cutting AI', name: 'Morning Briefing (AI)', desc: '7am daily: schedule, deliveries, inspections, overdue items, weather impact, top 3 things needing attention. Push or email.', phase: 2, status: 'planned', effort: 'M', selfLearn: true },
  { id: 340, cat: 'Cross-Cutting AI', name: 'Project Health Score', desc: 'Single 0-100 score per job combining: budget health, schedule adherence, quality score, client satisfaction, risk factors. Glanceable.', phase: 2, status: 'planned', effort: 'L', selfLearn: true },
  { id: 341, cat: 'Cross-Cutting AI', name: '"What If" Scenario Engine', desc: 'Ask: "What if Johnson upgrades appliances?" → AI models: budget impact (+$8K), schedule impact (+3 days lead time), cash flow shift.', phase: 2, status: 'planned', effort: 'L', selfLearn: true },
  { id: 342, cat: 'Cross-Cutting AI', name: 'Cross-Job Resource Optimizer', desc: 'AI manages all jobs: "Move Jones Plumbing from Smith (has float) to Johnson (critical path) this week. Net gain: 3 days."', phase: 3, status: 'future', effort: 'XL', selfLearn: true },
  { id: 343, cat: 'Cross-Cutting AI', name: 'Lessons Learned Database', desc: 'After every job: what went right/wrong. AI surfaces relevant lessons when starting similar new projects.', phase: 2, status: 'planned', effort: 'M', selfLearn: true },
  { id: 344, cat: 'Cross-Cutting AI', name: 'Risk Register', desc: 'Per job: identified risks with probability, impact, mitigation. AI auto-populates common risks based on job type and season.', phase: 2, status: 'planned', effort: 'M', selfLearn: true },
  { id: 345, cat: 'Cross-Cutting AI', name: 'Client Personality Profiler', desc: 'AI learns communication preferences: "Smiths prefer weekly email, Johnsons want immediate text for any issue."', phase: 2, status: 'planned', effort: 'M', selfLearn: true },
  { id: 346, cat: 'Cross-Cutting AI', name: 'Business Benchmarking', desc: 'Anonymous comparison with similar builders: "Your avg margin (14.8%) is below peer group (17.2%). Key gap: change order capture rate."', phase: 3, status: 'future', effort: 'L', selfLearn: true },
  { id: 347, cat: 'Cross-Cutting AI', name: 'AI Voice Assistant', desc: 'In the truck: "Hey RossOS, what\'s on my schedule today?" Hands-free operation for field workers.', phase: 3, status: 'future', effort: 'XL', selfLearn: true },
]

export const CATEGORIES = [...new Set(FEATURES.map(f => f.cat))] as string[]

export const ONBOARDING_STEPS = [
  { step: 1, title: 'Upload Your License & Insurance', time: '30 sec', desc: 'Drop your contractor\'s license + GL insurance PDF → AI reads everything: company name, license #, EIN, coverage amounts, expiration dates. No typing.', icon: 'FileText' },
  { step: 2, title: 'Connect QuickBooks (Optional)', time: '60 sec', desc: 'One-click QBO connect → imports ALL: vendors, clients, chart of accounts, open invoices, payment history. Everything mapped automatically.', icon: 'Link' },
  { step: 3, title: 'Import Contacts (Magic Link)', time: '2 min', desc: 'Enter email addresses of your subs/vendors → each gets a magic link to fill out THEIR OWN info: W-9, COI, trade, contact details. You do nothing.', icon: 'Mail' },
  { step: 4, title: 'Upload a Contract (Any Job)', time: '45 sec', desc: 'Drop any existing contract PDF → AI extracts: client name, address, contract amount, scope, payment schedule, allowances, exclusions. Creates the job automatically.', icon: 'FileCheck' },
  { step: 5, title: 'Invite Your Team', time: '30 sec', desc: 'Enter names + emails + roles → one-click invite all. Each person gets a guided tour customized to their role (PM, Super, Office).', icon: 'Users' },
  { step: 6, title: 'You\'re Live!', time: '', desc: 'Checklist shows what\'s done and what\'s optional. Start using immediately. Add more data as you go — nothing blocks you from working.', icon: 'Rocket' },
] as const

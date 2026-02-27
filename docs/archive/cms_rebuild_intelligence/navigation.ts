import {
  LayoutDashboard,
  Target,
  Briefcase,
  Calendar,
  DollarSign,
  CheckSquare,
  Users,
  Database,
  Settings,
  HardHat,
  FileText,
  FolderOpen,
  ArrowLeft,
  Home,
  BarChart3,
  BookOpen,
  TrendingUp,
  Puzzle,
  GraduationCap,
  LifeBuoy,
  Palette,
  Brain,
  Clock,
  Package,
  Landmark,
  ToggleRight,
} from 'lucide-react'

export interface NavSubItem {
  name: string
  href: string
  description: string
}

export interface NavItem {
  label: string
  icon: React.ElementType
  href?: string
  items?: NavSubItem[]
}

// ── Company-Level Navigation ──────────────────────────────────

// Company flow: pre-job pipeline
export const companyNav: NavItem[] = [
  {
    label: 'Dashboard',
    icon: LayoutDashboard,
    href: '/skeleton',
  },
  {
    label: 'Sales',
    icon: Target,
    items: [
      { name: 'Leads', href: '/skeleton/leads', description: 'Pipeline, scoring, follow-ups' },
      { name: 'Estimates', href: '/skeleton/estimates', description: 'Selection-based pricing' },
      { name: 'Proposals', href: '/skeleton/proposals', description: 'Client presentations' },
      { name: 'Contracts', href: '/skeleton/contracts', description: 'E-signature, execution' },
    ],
  },
  {
    label: 'Jobs',
    icon: Briefcase,
    href: '/skeleton/jobs',
  },
]

// Job-aggregate views: across all jobs
export const companyJobNav: NavItem[] = [
  {
    label: 'Operations',
    icon: Calendar,
    items: [
      { name: 'Calendar', href: '/skeleton/operations/calendar', description: 'Company-wide schedule' },
      { name: 'Crew Schedule', href: '/skeleton/operations/crew-schedule', description: 'Resource allocation' },
      { name: 'Time Clock', href: '/skeleton/operations/time-clock', description: 'GPS clock in/out & timesheets' },
      { name: 'Equipment', href: '/skeleton/operations/equipment', description: 'Assets & tools' },
      { name: 'Inventory', href: '/skeleton/operations/inventory', description: 'Materials & stock tracking' },
      { name: 'Deliveries', href: '/skeleton/operations/deliveries', description: 'Incoming materials' },
    ],
  },
  {
    label: 'Financial',
    icon: DollarSign,
    items: [
      { name: 'Dashboard', href: '/skeleton/financial/dashboard', description: 'Financial overview' },
      { name: 'Chart of Accounts', href: '/skeleton/financial/chart-of-accounts', description: 'GL accounts & structure' },
      { name: 'Journal Entries', href: '/skeleton/financial/journal-entries', description: 'Manual journal entries' },
      { name: 'Receivables', href: '/skeleton/financial/receivables', description: 'Client balances' },
      { name: 'Payables', href: '/skeleton/financial/payables', description: 'Vendor balances' },
      { name: 'Bank Reconciliation', href: '/skeleton/financial/bank-reconciliation', description: 'Bank account matching' },
      { name: 'Cash Flow', href: '/skeleton/financial/cash-flow', description: 'Forecasting' },
      { name: 'Profitability', href: '/skeleton/financial/profitability', description: 'Margin analysis' },
      { name: 'Reports', href: '/skeleton/financial/reports', description: 'Financial reports' },
    ],
  },
  {
    label: 'Closeout',
    icon: CheckSquare,
    items: [
      { name: 'Punch Lists', href: '/skeleton/punch-lists', description: 'Final punch tracking' },
      { name: 'Warranties', href: '/skeleton/warranties', description: 'Warranty tracking and claims' },
    ],
  },
]

// Intelligence: AI-powered construction tools
export const companyIntelligenceNav: NavItem[] = [
  {
    label: 'Intelligence',
    icon: Brain,
    items: [
      { name: 'Trade Intuition AI', href: '/skeleton/intelligence/trade-intuition', description: '80 knowledge domains + 7-Layer Engine' },
      { name: 'Plan Analysis', href: '/skeleton/intelligence/plan-analysis', description: 'AI plan reading & takeoffs' },
      { name: 'Bidding', href: '/skeleton/intelligence/bidding', description: 'Bid analysis & estimating' },
      { name: 'Selections', href: '/skeleton/intelligence/selections', description: 'Vibe boards & visual selections' },
      { name: 'Production', href: '/skeleton/intelligence/production', description: 'Gantt, quality & crew management' },
      { name: 'Procurement', href: '/skeleton/intelligence/procurement', description: 'POs, deliveries & supply chain' },
      { name: 'Smart Reports', href: '/skeleton/intelligence/reports', description: 'AI-generated narratives & dashboards' },
      { name: 'AI Hub', href: '/skeleton/intelligence/ai-hub', description: 'Morning briefings & project health' },
    ],
  },
]

export const companyRightNav: NavItem[] = [
  {
    label: 'Directory',
    icon: Users,
    items: [
      { name: 'Clients', href: '/skeleton/directory/clients', description: 'Client profiles & intelligence' },
      { name: 'Vendors', href: '/skeleton/directory/vendors', description: 'Subs & suppliers' },
      { name: 'Team', href: '/skeleton/directory/team', description: 'Employees & roles' },
      { name: 'Contacts', href: '/skeleton/directory/contacts', description: 'Other contacts' },
    ],
  },
  {
    label: 'Library',
    icon: Database,
    items: [
      { name: 'Selections Catalog', href: '/skeleton/library/selections', description: 'Products & materials' },
      { name: 'Assemblies', href: '/skeleton/library/assemblies', description: 'Estimate templates' },
      { name: 'Cost Codes', href: '/skeleton/library/cost-codes', description: 'Budget categories' },
      { name: 'Templates', href: '/skeleton/library/templates', description: 'Standard forms' },
    ],
  },
  {
    label: 'Settings',
    icon: Settings,
    items: [
      { name: 'Settings', href: '/skeleton/company/settings', description: 'Configuration' },
      { name: 'Features', href: '/skeleton/company/features', description: 'Toggle 205 capabilities' },
      { name: 'Integrations', href: '/skeleton/company/integrations', description: 'QuickBooks, Stripe' },
      { name: 'Insurance', href: '/skeleton/compliance/insurance', description: 'COIs & policies' },
      { name: 'Licenses', href: '/skeleton/compliance/licenses', description: 'Contractor licenses' },
      { name: 'Safety', href: '/skeleton/compliance/safety', description: 'OSHA & incidents' },
      { name: 'Dashboards', href: '/skeleton/company/dashboards', description: 'Custom views' },
      { name: 'Email Marketing', href: '/skeleton/company/email-marketing', description: 'Client outreach' },
    ],
  },
]

// ── Job-Level Navigation ──────────────────────────────────────

// Job context: back link + overview
export const jobNav: NavItem[] = [
  {
    label: '← Company',
    icon: ArrowLeft,
    href: '/skeleton/jobs',
  },
  {
    label: 'Overview',
    icon: LayoutDashboard,
    href: '', // resolved to /skeleton/jobs/[id]
  },
]

// Job lifecycle phases
export const jobPhaseNav: NavItem[] = [
  {
    label: 'Pre-Con',
    icon: HardHat,
    items: [
      { name: 'Selections', href: '/selections', description: 'Product selections for this job' },
      { name: 'Change Orders', href: '/change-orders', description: 'Scope and price changes' },
    ],
  },
  {
    label: 'Field',
    icon: Calendar,
    items: [
      { name: 'Schedule', href: '/schedule', description: 'Gantt chart with weather/tide' },
      { name: 'Daily Logs', href: '/daily-logs', description: 'Voice-to-text field updates' },
      { name: 'Time Clock', href: '/time-clock', description: 'Clock in/out & timesheets' },
      { name: 'Photos', href: '/photos', description: 'AI-curated photo gallery' },
      { name: 'Permits', href: '/permits', description: 'Permit tracking' },
      { name: 'Inspections', href: '/inspections', description: 'Inspection scheduling' },
    ],
  },
  {
    label: 'Financial',
    icon: DollarSign,
    items: [
      { name: 'Budget', href: '/budget', description: 'Real-time budget tracking' },
      { name: 'Purchase Orders', href: '/purchase-orders', description: 'PO management' },
      { name: 'Inventory', href: '/inventory', description: 'Job site materials & stock' },
      { name: 'Invoices', href: '/invoices', description: 'Invoice processing' },
      { name: 'Draws', href: '/draws', description: 'Draw requests' },
      { name: 'Lien Waivers', href: '/lien-waivers', description: 'Lien waiver tracking' },
    ],
  },
  {
    label: 'Docs',
    icon: FolderOpen,
    items: [
      { name: 'Documents', href: '/files', description: 'Document management' },
      { name: 'RFIs', href: '/rfis', description: 'RFI tracking' },
      { name: 'Submittals', href: '/submittals', description: 'Submittal tracking' },
      { name: 'Communications', href: '/communications', description: 'Messages & emails' },
      { name: 'Team', href: '/team', description: 'Job team members' },
    ],
  },
  {
    label: 'Closeout',
    icon: CheckSquare,
    items: [
      { name: 'Punch List', href: '/punch-list', description: 'Final punch tracking' },
      { name: 'Warranties', href: '/warranties', description: 'Warranty tracking' },
    ],
  },
]

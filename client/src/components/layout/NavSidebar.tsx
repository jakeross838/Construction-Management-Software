import { useState, useMemo, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useJob } from '@/contexts/JobContext';
import { useSidebar } from '@/contexts/SidebarContext';
import { useDBJobs } from '@/hooks/useFinancialData';
import { hasPermission, type UserRole } from '@/types/auth';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Building2,
  LayoutDashboard,
  Target,
  FileEdit,
  Hammer,
  DollarSign,
  ShieldCheck,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Search,
  MapPin,
  Plus,
  Briefcase,
  Truck,
  ClipboardList,
  TrendingUp,
  Calculator,
  CalendarDays,
  ListChecks,
  Camera,
  Package,
  Users,
  FileText,
  Receipt,
  Clock,
  FolderOpen,
  Ruler,
  HardHat,
  type LucideIcon,
} from 'lucide-react';
import { JobFormDialog } from '@/components/jobs/JobFormDialog';

// ============================================================================
// NAV DATA STRUCTURE
// ============================================================================

interface NavItem {
  label: string;
  icon: LucideIcon;
  href: string;
  permission?: string;
}

interface NavSection {
  title: string;
  icon: LucideIcon;
  items: NavItem[];
  defaultOpen?: boolean;
  pinBottom?: boolean;
}

const navigationSections: NavSection[] = [
  {
    title: 'Overview',
    icon: LayoutDashboard,
    defaultOpen: true,
    items: [
      { label: 'Dashboard', icon: LayoutDashboard, href: '/' },
      { label: 'Job Hub', icon: Building2, href: '/job-details' },
    ],
  },
  {
    title: 'Pre-Construction',
    icon: FileEdit,
    items: [
      { label: 'Leads', icon: Target, href: '/leads', permission: 'canViewLeads' },
      { label: 'Estimates', icon: Calculator, href: '/estimates', permission: 'canViewEstimates' },
      { label: 'Bids', icon: ClipboardList, href: '/bids' },
      { label: 'Selections', icon: Package, href: '/selections' },
      { label: 'Proposals', icon: FileText, href: '/proposals', permission: 'canGenerateProposals' },
      { label: 'Contracts', icon: FileEdit, href: '/contracts', permission: 'canViewContracts' },
      { label: 'Permits', icon: Ruler, href: '/permits' },
    ],
  },
  {
    title: 'Operations',
    icon: Hammer,
    items: [
      { label: 'Schedule', icon: CalendarDays, href: '/schedule', permission: 'canEditSchedule' },
      { label: 'Daily Logs', icon: Camera, href: '/daily-logs', permission: 'canSubmitDailyLog' },
      { label: 'Tasks', icon: ListChecks, href: '/tasks' },
      { label: 'Time Tracking', icon: Clock, href: '/time-tracking' },
      { label: 'Change Orders', icon: FileEdit, href: '/change-orders' },
      { label: 'RFIs', icon: FileText, href: '/rfis' },
      { label: 'Submittals', icon: FolderOpen, href: '/submittals' },
      { label: 'Inspections', icon: ShieldCheck, href: '/inspections' },
      { label: 'Photos', icon: Camera, href: '/photos' },
      { label: 'Files', icon: FileText, href: '/files', permission: 'canUploadFiles' },
    ],
  },
  {
    title: 'Financial',
    icon: DollarSign,
    defaultOpen: true,
    items: [
      { label: 'Invoices', icon: Receipt, href: '/invoices', permission: 'canApproveInvoices' },
      { label: 'Purchase Orders', icon: ClipboardList, href: '/purchase-orders', permission: 'canCreatePO' },
      { label: 'Draws', icon: Briefcase, href: '/draws', permission: 'canSubmitDraw' },
      { label: 'Budget', icon: Calculator, href: '/budget', permission: 'canViewFinancials' },
      { label: 'Expenses', icon: DollarSign, href: '/expenses', permission: 'canManageExpenses' },
      { label: 'P&L Reports', icon: BarChart3, href: '/pnl', permission: 'canViewFinancials' },
      { label: 'Profitability', icon: TrendingUp, href: '/profitability', permission: 'canViewProfitability' },
      { label: 'Cash Flow', icon: DollarSign, href: '/cash-flow', permission: 'canViewFinancials' },
      { label: 'WIP Schedule', icon: BarChart3, href: '/wip', permission: 'canViewFinancials' },
      { label: 'Price Intelligence', icon: TrendingUp, href: '/pricing' },
    ],
  },
  {
    title: 'Closeout',
    icon: ShieldCheck,
    items: [
      { label: 'Punch Lists', icon: ListChecks, href: '/punch-lists' },
      { label: 'Warranties', icon: ShieldCheck, href: '/warranties' },
      { label: 'Lien Releases', icon: FileText, href: '/lien-releases' },
      { label: 'Final Docs', icon: FileText, href: '/final-docs' },
    ],
  },
  {
    title: 'Reports',
    icon: BarChart3,
    items: [
      { label: 'All Reports', icon: BarChart3, href: '/reports', permission: 'canViewFinancials' },
      { label: 'Business Planning', icon: Target, href: '/business-planning' },
      { label: 'Plans', icon: FileText, href: '/plans' },
    ],
  },
  {
    title: 'Directory',
    icon: Users,
    items: [
      { label: 'Clients', icon: Users, href: '/clients' },
      { label: 'Vendors', icon: Truck, href: '/vendors', permission: 'canManageVendors' },
      { label: 'Employees', icon: Users, href: '/employees', permission: 'canManageEmployees' },
    ],
  },
  {
    title: 'Settings',
    icon: Settings,
    pinBottom: true,
    items: [
      { label: 'Cost Codes', icon: Calculator, href: '/cost-codes' },
      { label: 'Company', icon: Settings, href: '/settings', permission: 'canViewSettings' },
    ],
  },
];

// ============================================================================
// JOB STATUS COLORS
// ============================================================================

const statusColors: Record<string, string> = {
  active: 'bg-green-500',
  pre_construction: 'bg-blue-500',
  completed: 'bg-gray-400',
  warranty: 'bg-amber-500',
  on_hold: 'bg-red-500',
  closed: 'bg-gray-400',
};

// ============================================================================
// LOCALSTORAGE KEYS
// ============================================================================

const JOBS_OPEN_KEY = 'nav-sidebar-jobs-open';

function getStoredBoolean(key: string, fallback: boolean): boolean {
  try {
    const val = localStorage.getItem(key);
    if (val === null) return fallback;
    return val === 'true';
  } catch {
    return fallback;
  }
}

// ============================================================================
// COMPONENT
// ============================================================================

export function NavSidebar() {
  const location = useLocation();
  const { user, builder } = useAuth();
  const { selectedJobId, setSelectedJob } = useJob();
  const userRole = (user?.role ?? 'field_crew') as UserRole;

  // Sidebar collapse state (from context, shared with AppLayout)
  const { collapsed, setCollapsed } = useSidebar();

  // Job selector open state
  const [jobsOpen, setJobsOpen] = useState(() => getStoredBoolean(JOBS_OPEN_KEY, false));
  const [jobSearch, setJobSearch] = useState('');
  const [showNewJobDialog, setShowNewJobDialog] = useState(false);

  // Nav section open state — auto-open section containing active route
  const [openSections, setOpenSections] = useState<string[]>(() => {
    const defaults = navigationSections
      .filter(s => s.defaultOpen)
      .map(s => s.title);
    // Also open the section containing the current route
    const activeSection = navigationSections.find(s =>
      s.items.some(item => item.href === location.pathname)
    );
    if (activeSection && !defaults.includes(activeSection.title)) {
      defaults.push(activeSection.title);
    }
    return defaults;
  });

  useEffect(() => {
    try { localStorage.setItem(JOBS_OPEN_KEY, String(jobsOpen)); } catch { /* noop */ }
  }, [jobsOpen]);

  // Auto-expand section when navigating
  useEffect(() => {
    const activeSection = navigationSections.find(s =>
      s.items.some(item => item.href === location.pathname)
    );
    if (activeSection && !openSections.includes(activeSection.title)) {
      setOpenSections(prev => [...prev, activeSection.title]);
    }
  }, [location.pathname]);

  // Jobs data
  const { data: dbJobs = [], isLoading: jobsLoading } = useDBJobs();
  const filteredJobs = useMemo(() => {
    if (!jobSearch.trim()) return dbJobs;
    const q = jobSearch.toLowerCase();
    return dbJobs.filter(job =>
      job.name?.toLowerCase().includes(q) ||
      job.address?.toLowerCase().includes(q) ||
      job.client?.toLowerCase().includes(q)
    );
  }, [jobSearch, dbJobs]);

  // Permission filtering
  const filteredSections = useMemo(() =>
    navigationSections.map(section => ({
      ...section,
      items: section.items.filter(item =>
        !item.permission || hasPermission(userRole, item.permission as any)
      ),
    })).filter(section => section.items.length > 0),
    [userRole]
  );

  const mainSections = filteredSections.filter(s => !s.pinBottom);
  const bottomSections = filteredSections.filter(s => s.pinBottom);

  const toggleSection = (title: string) => {
    setOpenSections(prev =>
      prev.includes(title)
        ? prev.filter(s => s !== title)
        : [...prev, title]
    );
  };

  const isActive = (href: string) => location.pathname === href;

  const selectedJobName = useMemo(() => {
    if (!selectedJobId) return 'All Jobs';
    const job = dbJobs.find(j => j.id === selectedJobId);
    return job?.name ?? 'All Jobs';
  }, [selectedJobId, dbJobs]);

  return (
    <>
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 h-screen bg-card border-r border-border transition-all duration-300 flex flex-col",
          collapsed ? "w-16" : "w-64"
        )}
      >
        {/* ── Logo ── */}
        <div className="flex h-14 items-center justify-between border-b border-border px-3 shrink-0">
          {!collapsed ? (
            <Link to="/" className="flex items-center gap-2 min-w-0">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary shrink-0">
                <Building2 className="h-4 w-4 text-primary-foreground" />
              </div>
              <div className="min-w-0">
                <h1 className="text-sm font-semibold text-foreground truncate">
                  {builder?.name || 'RossOS'}
                </h1>
              </div>
            </Link>
          ) : (
            <Link to="/" className="mx-auto">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <Building2 className="h-4 w-4 text-primary-foreground" />
              </div>
            </Link>
          )}
        </div>

        {/* ── Job Selector ── */}
        {!collapsed && (
          <Collapsible open={jobsOpen} onOpenChange={setJobsOpen}>
            <CollapsibleTrigger asChild>
              <button className="flex w-full items-center gap-2 px-3 py-2.5 border-b border-border text-sm hover:bg-accent/50 transition-colors">
                <HardHat className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="flex-1 text-left font-medium truncate">{selectedJobName}</span>
                {jobsOpen ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="border-b border-border bg-muted/30">
                {/* Search */}
                <div className="p-2">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Search jobs..."
                      value={jobSearch}
                      onChange={e => setJobSearch(e.target.value)}
                      className="pl-7 h-7 text-xs"
                    />
                  </div>
                </div>
                {/* Job list */}
                <ScrollArea className="max-h-48">
                  <div className="px-2 pb-2 space-y-0.5">
                    {/* All Jobs */}
                    <button
                      onClick={() => setSelectedJob(null)}
                      className={cn(
                        "w-full text-left rounded px-2 py-1.5 text-xs transition-colors hover:bg-accent",
                        !selectedJobId && "bg-primary/10 text-primary font-medium"
                      )}
                    >
                      All Jobs
                    </button>
                    {/* Job items */}
                    {filteredJobs.map(job => (
                      <button
                        key={job.id}
                        onClick={() => setSelectedJob({ id: job.id, name: job.name })}
                        className={cn(
                          "w-full text-left rounded px-2 py-1.5 transition-colors hover:bg-accent",
                          selectedJobId === job.id && "bg-primary/10 text-primary"
                        )}
                      >
                        <div className="flex items-center gap-1.5">
                          <div className={cn("h-1.5 w-1.5 rounded-full shrink-0", statusColors[job.status])} />
                          <span className="text-xs font-medium truncate">{job.name}</span>
                        </div>
                        {job.address && (
                          <div className="flex items-center gap-1 ml-3 mt-0.5">
                            <MapPin className="h-2.5 w-2.5 text-muted-foreground shrink-0" />
                            <span className="text-[10px] text-muted-foreground truncate">{job.address.split(',')[0]}</span>
                          </div>
                        )}
                      </button>
                    ))}
                    {jobsLoading && (
                      <div className="space-y-1 px-1">
                        <Skeleton className="h-6 w-full" />
                        <Skeleton className="h-6 w-full" />
                      </div>
                    )}
                    {!jobsLoading && filteredJobs.length === 0 && (
                      <p className="text-[10px] text-muted-foreground text-center py-2">No jobs found</p>
                    )}
                  </div>
                </ScrollArea>
                {/* New Job */}
                <div className="px-2 pb-2">
                  <Button variant="outline" size="sm" className="w-full h-7 text-xs gap-1" onClick={() => setShowNewJobDialog(true)}>
                    <Plus className="h-3 w-3" /> New Job
                  </Button>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Collapsed job icon */}
        {collapsed && (
          <div className="border-b border-border p-2">
            <Button
              variant="ghost"
              size="icon"
              className="w-full h-9"
              title={selectedJobName}
              onClick={() => { setCollapsed(false); setJobsOpen(true); }}
            >
              <HardHat className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* ── Navigation Sections ── */}
        <ScrollArea className="flex-1">
          <nav className="py-2 px-2">
            {mainSections.map(section => (
              <NavSectionGroup
                key={section.title}
                section={section}
                collapsed={collapsed}
                isOpen={openSections.includes(section.title)}
                onToggle={() => toggleSection(section.title)}
                isActive={isActive}
              />
            ))}
          </nav>
        </ScrollArea>

        {/* ── Bottom Sections (Settings) ── */}
        <div className="border-t border-border px-2 py-2">
          {bottomSections.map(section => (
            <NavSectionGroup
              key={section.title}
              section={section}
              collapsed={collapsed}
              isOpen={openSections.includes(section.title)}
              onToggle={() => toggleSection(section.title)}
              isActive={isActive}
            />
          ))}

          {/* Collapse toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCollapsed(!collapsed)}
            className={cn("w-full mt-1", collapsed ? "justify-center" : "justify-start gap-2")}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <>
                <ChevronLeft className="h-4 w-4" />
                <span className="text-xs">Collapse</span>
              </>
            )}
          </Button>
        </div>
      </aside>

      {/* New Job Dialog */}
      <JobFormDialog open={showNewJobDialog} onOpenChange={setShowNewJobDialog} />
    </>
  );
}

// ============================================================================
// NAV SECTION GROUP
// ============================================================================

interface NavSectionGroupProps {
  section: NavSection & { items: NavItem[] };
  collapsed: boolean;
  isOpen: boolean;
  onToggle: () => void;
  isActive: (href: string) => boolean;
}

function NavSectionGroup({ section, collapsed, isOpen, onToggle, isActive }: NavSectionGroupProps) {
  const SectionIcon = section.icon;

  // In collapsed mode, show first item as direct link if only 1 item, otherwise section icon as tooltip
  if (collapsed) {
    if (section.items.length === 1) {
      const item = section.items[0];
      const Icon = item.icon;
      return (
        <Link
          to={item.href}
          className={cn(
            "flex items-center justify-center rounded-lg h-9 w-full mb-0.5 transition-colors hover:bg-accent",
            isActive(item.href) && "bg-primary/10 text-primary"
          )}
          title={item.label}
        >
          <Icon className="h-4 w-4" />
        </Link>
      );
    }
    // Multiple items — show section icon, no expand
    const sectionActive = section.items.some(item => isActive(item.href));
    return (
      <button
        className={cn(
          "flex items-center justify-center rounded-lg h-9 w-full mb-0.5 transition-colors hover:bg-accent",
          sectionActive && "bg-primary/10 text-primary"
        )}
        title={section.title}
        onClick={() => {
          // When collapsed, clicking a section could navigate to the first item
          // or we could expand. For now, expand sidebar
        }}
      >
        <SectionIcon className="h-4 w-4" />
      </button>
    );
  }

  return (
    <Collapsible open={isOpen} onOpenChange={onToggle} className="mb-1">
      <CollapsibleTrigger asChild>
        <button
          className={cn(
            "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
            section.items.some(item => isActive(item.href)) && "text-foreground"
          )}
        >
          <SectionIcon className="h-3.5 w-3.5 shrink-0" />
          <span className="flex-1 text-left">{section.title}</span>
          {isOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ul className="mt-0.5 space-y-0.5 pl-2">
          {section.items.map(item => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <li key={item.href}>
                <Link
                  to={item.href}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs transition-colors hover:bg-accent",
                    active
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}

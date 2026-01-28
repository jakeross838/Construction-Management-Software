import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { 
  LayoutDashboard, 
  Building2, 
  Receipt, 
  DollarSign, 
  BarChart3,
  Users,
  FileText,
  Settings,
  ChevronLeft,
  ChevronRight,
  Briefcase,
  Truck,
  ClipboardList,
  TrendingUp,
  Calculator,
  CalendarDays,
  FileEdit,
  Target,
  Package,
  ListChecks,
  Camera,
  ShieldCheck,
  Hammer,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { hasPermission, type UserRole } from '@/types/auth';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface NavItem {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  permission?: string;
}

interface NavSection {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  items: NavItem[];
  defaultOpen?: boolean;
}

const navigationSections: NavSection[] = [
  {
    title: 'Overview',
    icon: LayoutDashboard,
    defaultOpen: true,
    items: [
      { label: 'Dashboard', icon: LayoutDashboard, href: '/' },
      { label: 'Job Hub', icon: Building2, href: '/job-hub' },
    ],
  },
  {
    title: 'Sales',
    icon: Target,
    items: [
      { label: 'Leads', icon: Target, href: '/leads', permission: 'canViewLeads' },
    ],
  },
  {
    title: 'Pre-Con',
    icon: FileEdit,
    items: [
      { label: 'Estimates', icon: Calculator, href: '/estimates', permission: 'canViewEstimates' },
      { label: 'Bids', icon: ClipboardList, href: '/bids' },
      { label: 'Selections', icon: Package, href: '/selections' },
      { label: 'Proposals', icon: FileText, href: '/proposals', permission: 'canGenerateProposals' },
      { label: 'Contracts', icon: FileEdit, href: '/contracts', permission: 'canViewContracts' },
    ],
  },
  {
    title: 'Operations',
    icon: Hammer,
    items: [
      { label: 'Schedule', icon: CalendarDays, href: '/schedule', permission: 'canEditSchedule' },
      { label: 'Daily Logs', icon: Camera, href: '/daily-logs', permission: 'canSubmitDailyLog' },
      { label: 'Tasks', icon: ListChecks, href: '/tasks' },
      { label: 'Files', icon: FileText, href: '/files', permission: 'canUploadFiles' },
      { label: 'Change Orders', icon: FileEdit, href: '/change-orders' },
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
      { label: 'Lien Releases', icon: FileText, href: '/lien-releases' },
      { label: 'Budget', icon: Calculator, href: '/budget', permission: 'canViewFinancials' },
      { label: 'Expenses', icon: DollarSign, href: '/expenses', permission: 'canManageExpenses' },
      { label: 'Price Intelligence', icon: TrendingUp, href: '/pricing' },
      { label: 'P&L Reports', icon: BarChart3, href: '/pnl', permission: 'canViewFinancials' },
      { label: 'Profitability', icon: TrendingUp, href: '/profitability', permission: 'canViewProfitability' },
    ],
  },
  {
    title: 'Closeout',
    icon: ShieldCheck,
    items: [
      { label: 'Punch Lists', icon: ListChecks, href: '/punch-lists' },
      { label: 'Warranties', icon: ShieldCheck, href: '/warranties' },
      { label: 'Final Docs', icon: FileText, href: '/final-docs' },
    ],
  },
  {
    title: 'Settings',
    icon: Settings,
    items: [
      { label: 'Vendors', icon: Truck, href: '/vendors', permission: 'canManageVendors' },
      { label: 'Employees', icon: Users, href: '/employees', permission: 'canManageEmployees' },
      { label: 'Cost Codes', icon: Calculator, href: '/cost-codes' },
      { label: 'Company', icon: Settings, href: '/settings', permission: 'canViewSettings' },
    ],
  },
];

interface SidebarProps {
  userRole: UserRole;
}

export function Sidebar({ userRole }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [openSections, setOpenSections] = useState<string[]>(['Overview', 'Financial', 'Settings']);
  const location = useLocation();

  const toggleSection = (title: string) => {
    setOpenSections(prev => 
      prev.includes(title) 
        ? prev.filter(s => s !== title)
        : [...prev, title]
    );
  };

  const filteredSections = navigationSections.map(section => ({
    ...section,
    items: section.items.filter(item => 
      !item.permission || hasPermission(userRole, item.permission as any)
    ),
  })).filter(section => section.items.length > 0);

  return (
    <aside 
      className={cn(
        "fixed left-0 top-0 z-40 h-screen bg-sidebar border-r border-sidebar-border transition-all duration-300 flex flex-col",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4 shrink-0">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <Building2 className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-foreground">Ross Built</h1>
              <p className="text-xs text-muted-foreground">Custom Homes</p>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary mx-auto">
            <Building2 className="h-5 w-5 text-primary-foreground" />
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2">
        {filteredSections.map((section) => {
          const isOpen = openSections.includes(section.title);
          const SectionIcon = section.icon;
          
          return (
            <Collapsible
              key={section.title}
              open={collapsed ? false : isOpen}
              onOpenChange={() => !collapsed && toggleSection(section.title)}
              className="mb-2"
            >
              <CollapsibleTrigger asChild>
                <button
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent",
                    collapsed && "justify-center px-2"
                  )}
                  title={collapsed ? section.title : undefined}
                >
                  <SectionIcon className="h-4 w-4 shrink-0" />
                  {!collapsed && (
                    <>
                      <span className="flex-1 text-left">{section.title}</span>
                      {isOpen ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </>
                  )}
                </button>
              </CollapsibleTrigger>
              
              <CollapsibleContent>
                <ul className="mt-1 space-y-0.5 pl-2">
                  {section.items.map((item) => {
                    const isActive = location.pathname === item.href;
                    const Icon = item.icon;
                    
                    return (
                      <li key={item.href} className="relative">
                        <Link
                          to={item.href}
                          className={cn(
                            "nav-item text-sm",
                            isActive && "active",
                            collapsed && "justify-center px-2"
                          )}
                          title={collapsed ? item.label : undefined}
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                          {!collapsed && <span>{item.label}</span>}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <div className="border-t border-sidebar-border p-2 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed(!collapsed)}
          className={cn("w-full", collapsed ? "justify-center" : "justify-start gap-2")}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4" />
              <span>Collapse</span>
            </>
          )}
        </Button>
      </div>
    </aside>
  );
}

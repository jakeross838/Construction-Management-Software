import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { hasPermission, type UserRole } from '@/types/auth';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { 
  LayoutDashboard, 
  Target,
  FileEdit,
  Hammer,
  DollarSign,
  ShieldCheck,
  BarChart3,
  Settings,
  ChevronDown,
} from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  permission?: string;
}

interface NavSection {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  items: NavItem[];
}

const navigationSections: NavSection[] = [
  {
    title: 'Sales',
    icon: Target,
    items: [
      { label: 'Leads', href: '/leads', permission: 'canViewLeads' },
    ],
  },
  {
    title: 'Overview',
    icon: LayoutDashboard,
    items: [
      { label: 'Dashboard', href: '/' },
      { label: 'Job Details', href: '/job-details' },
    ],
  },
  {
    title: 'Pre-Con',
    icon: FileEdit,
    items: [
      { label: 'Bids', href: '/bids' },
      { label: 'Estimates', href: '/estimates', permission: 'canViewEstimates' },
      { label: 'Selections', href: '/selections' },
      { label: 'Proposals', href: '/proposals', permission: 'canGenerateProposals' },
      { label: 'Contracts', href: '/contracts', permission: 'canViewContracts' },
      { label: 'Permitting', href: '/permits' },
    ],
  },
  {
    title: 'Operations',
    icon: Hammer,
    items: [
      { label: 'Schedule', href: '/schedule', permission: 'canEditSchedule' },
      { label: 'Daily Logs', href: '/daily-logs', permission: 'canSubmitDailyLog' },
      { label: 'Time Tracking', href: '/time-tracking' },
      { label: 'Tasks', href: '/tasks' },
      { label: 'Files', href: '/files', permission: 'canUploadFiles' },
      { label: 'Change Orders', href: '/change-orders' },
    ],
  },
  {
    title: 'Financial',
    icon: DollarSign,
    items: [
      { label: 'Invoices', href: '/invoices', permission: 'canApproveInvoices' },
      { label: 'Purchase Orders', href: '/purchase-orders', permission: 'canCreatePO' },
      { label: 'Draws', href: '/draws', permission: 'canSubmitDraw' },
      { label: 'Budget', href: '/budget', permission: 'canViewFinancials' },
      { label: 'Expenses', href: '/expenses', permission: 'canManageExpenses' },
      { label: 'Price Intelligence', href: '/pricing' },
    ],
  },
  {
    title: 'Closeout',
    icon: ShieldCheck,
    items: [
      { label: 'Punch Lists', href: '/punch-lists' },
      { label: 'Warranties', href: '/warranties' },
      { label: 'Lien Releases', href: '/lien-releases' },
      { label: 'Final Docs', href: '/final-docs' },
    ],
  },
  {
    title: 'Reports',
    icon: BarChart3,
    items: [
      { label: 'All Reports', href: '/reports', permission: 'canViewFinancials' },
    ],
  },
  {
    title: 'Settings',
    icon: Settings,
    items: [
      { label: 'Vendors', href: '/vendors', permission: 'canManageVendors' },
      { label: 'Employees', href: '/employees', permission: 'canManageEmployees' },
      { label: 'Expenses', href: '/expenses', permission: 'canManageExpenses' },
      { label: 'Cost Codes', href: '/cost-codes' },
      { label: 'Company', href: '/settings', permission: 'canViewSettings' },
    ],
  },
];

interface TopNavigationProps {
  userRole: UserRole;
  mobile?: boolean;
}

// Key navigation items for mobile bottom bar
const mobileNavItems = [
  { icon: LayoutDashboard, label: 'Home', href: '/' },
  { icon: DollarSign, label: 'Financial', href: '/invoices' },
  { icon: Hammer, label: 'Ops', href: '/schedule' },
  { icon: BarChart3, label: 'Reports', href: '/reports' },
  { icon: Settings, label: 'More', href: '/settings' },
];

export function TopNavigation({ userRole, mobile = false }: TopNavigationProps) {
  const location = useLocation();

  const filteredSections = navigationSections.map(section => ({
    ...section,
    items: section.items.filter(item =>
      !item.permission || hasPermission(userRole, item.permission as any)
    ),
  })).filter(section => section.items.length > 0);

  const isActive = (href: string) => location.pathname === href;
  const isSectionActive = (section: NavSection) =>
    section.items.some(item => isActive(item.href));

  // Mobile bottom navigation
  if (mobile) {
    return (
      <nav className="flex items-center justify-around h-14 px-2">
        {mobileNavItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 px-3 py-1 rounded-lg transition-colors",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    );
  }

  // Desktop dropdown navigation
  return (
    <nav className="flex items-center gap-1">
      {filteredSections.map((section) => {
        const SectionIcon = section.icon;
        const sectionActive = isSectionActive(section);

        return (
          <DropdownMenu key={section.title}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-9 px-3 text-sm gap-1.5",
                  sectionActive && "bg-primary/10 text-primary"
                )}
              >
                <SectionIcon className="h-4 w-4" />
                <span className="hidden lg:inline">{section.title}</span>
                <ChevronDown className="h-3 w-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="w-48 bg-popover z-50"
              sideOffset={8}
            >
              {section.items.map((item) => (
                <DropdownMenuItem key={item.href} asChild>
                  <Link
                    to={item.href}
                    className={cn(
                      "w-full cursor-pointer",
                      isActive(item.href) && "bg-primary/10 text-primary font-medium"
                    )}
                  >
                    {item.label}
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      })}
    </nav>
  );
}

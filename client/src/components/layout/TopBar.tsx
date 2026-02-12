import { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSearchContext } from '@/components/search/SearchContext';
import { NotificationDropdown } from '@/components/notifications/NotificationDropdown';
import { AIUploadButton } from '@/components/ai/AIUploadButton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Search, ChevronRight } from 'lucide-react';

// Breadcrumb label mapping
const routeLabels: Record<string, string> = {
  '': 'Dashboard',
  'job-details': 'Job Hub',
  'leads': 'Leads',
  'estimates': 'Estimates',
  'bids': 'Bids',
  'selections': 'Selections',
  'proposals': 'Proposals',
  'contracts': 'Contracts',
  'permits': 'Permits',
  'schedule': 'Schedule',
  'daily-logs': 'Daily Logs',
  'tasks': 'Tasks',
  'time-tracking': 'Time Tracking',
  'change-orders': 'Change Orders',
  'rfis': 'RFIs',
  'submittals': 'Submittals',
  'inspections': 'Inspections',
  'photos': 'Photos',
  'files': 'Files',
  'invoices': 'Invoices',
  'purchase-orders': 'Purchase Orders',
  'draws': 'Draws',
  'budget': 'Budget',
  'expenses': 'Expenses',
  'pnl': 'P&L Reports',
  'profitability': 'Profitability',
  'cash-flow': 'Cash Flow',
  'wip': 'WIP Schedule',
  'pricing': 'Price Intelligence',
  'punch-lists': 'Punch Lists',
  'warranties': 'Warranties',
  'lien-releases': 'Lien Releases',
  'final-docs': 'Final Docs',
  'reports': 'Reports',
  'business-planning': 'Business Planning',
  'plans': 'Plans',
  'clients': 'Clients',
  'vendors': 'Vendors',
  'employees': 'Employees',
  'cost-codes': 'Cost Codes',
  'settings': 'Settings',
  'jobs': 'Jobs',
};

export function TopBar() {
  const location = useLocation();
  const { user, builder, signOut } = useAuth();
  const { openSearch } = useSearchContext();

  const userName = user
    ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'User'
    : 'User';
  const userInitials = user
    ? `${(user.first_name || 'U')[0]}${(user.last_name || '')[0] || ''}`
    : 'U';

  // Build breadcrumb from pathname
  const breadcrumbs = useMemo(() => {
    const segments = location.pathname.split('/').filter(Boolean);
    if (segments.length === 0) return [{ label: 'Dashboard', href: '/' }];
    return segments.map((seg, i) => ({
      label: routeLabels[seg] || seg.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      href: '/' + segments.slice(0, i + 1).join('/'),
    }));
  }, [location.pathname]);

  return (
    <header className="sticky top-0 z-30 flex h-12 items-center justify-between border-b border-border bg-card px-4 shrink-0">
      {/* Left: Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm min-w-0">
        {breadcrumbs.map((crumb, i) => (
          <span key={crumb.href} className="flex items-center gap-1 min-w-0">
            {i > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />}
            {i === breadcrumbs.length - 1 ? (
              <span className="font-medium text-foreground truncate">{crumb.label}</span>
            ) : (
              <Link
                to={crumb.href}
                className="text-muted-foreground hover:text-foreground transition-colors truncate"
              >
                {crumb.label}
              </Link>
            )}
          </span>
        ))}
      </nav>

      {/* Right: Search + Actions */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Global Search */}
        <button
          type="button"
          onClick={openSearch}
          className="hidden md:inline-flex items-center gap-2 w-52 h-8 rounded-md border border-input bg-muted/50 px-2.5 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="flex-1 text-left">Search...</span>
          <kbd className="pointer-events-none hidden h-4 select-none items-center gap-0.5 rounded border bg-muted px-1 font-mono text-[10px] font-medium text-muted-foreground sm:flex">
            <span className="text-[10px]">&#8984;</span>K
          </kbd>
        </button>

        {/* AI Upload */}
        <AIUploadButton />

        {/* Notifications */}
        <NotificationDropdown />

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2 pl-1.5 h-8">
              <Avatar className="h-6 w-6">
                <AvatarImage src={user?.avatar_url || undefined} />
                <AvatarFallback className="text-[10px]">{userInitials}</AvatarFallback>
              </Avatar>
              <span className="hidden lg:block text-xs font-medium">
                {user?.first_name || 'User'}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div>
                <p className="font-medium">{userName}</p>
                <p className="text-xs text-muted-foreground">{user?.email || ''}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Profile Settings</DropdownMenuItem>
            <DropdownMenuItem>Notifications</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive" onClick={() => signOut()}>
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

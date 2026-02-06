import { MobileLayout } from '@/components/mobile/layout';
import { useAuth } from '@/contexts/AuthContext';
import { Link } from 'react-router-dom';
import {
  Settings,
  User,
  Bell,
  HelpCircle,
  LogOut,
  ChevronRight,
  FileText,
  Calendar,
  Users,
  DollarSign,
  Briefcase,
  ClipboardCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface MenuItemProps {
  icon: React.ElementType;
  label: string;
  href?: string;
  onClick?: () => void;
  description?: string;
  badge?: string;
}

function MenuItem({ icon: Icon, label, href, onClick, description, badge }: MenuItemProps) {
  const content = (
    <div className="flex items-center gap-3 p-4">
      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground">{label}</p>
        {description && (
          <p className="text-sm text-muted-foreground truncate">{description}</p>
        )}
      </div>
      {badge && (
        <span className="px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-xs font-medium">
          {badge}
        </span>
      )}
      <ChevronRight className="h-5 w-5 text-muted-foreground" />
    </div>
  );

  const className = cn(
    'block w-full text-left',
    'hover:bg-accent transition-colors duration-200'
  );

  if (href) {
    return (
      <Link to={href} className={className}>
        {content}
      </Link>
    );
  }

  return (
    <button onClick={onClick} className={className}>
      {content}
    </button>
  );
}

function MenuSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h2 className="px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
        {title}
      </h2>
      <div className="bg-card rounded-xl border border-border divide-y divide-border overflow-hidden">
        {children}
      </div>
    </div>
  );
}

export default function MobileMore() {
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <MobileLayout title="More" showLocationIndicator={false}>
      <div className="p-4">
        {/* User Info */}
        <div className="bg-card rounded-xl border border-border p-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-7 w-7 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-lg truncate">
                {user?.user_metadata?.full_name || 'User'}
              </p>
              <p className="text-sm text-muted-foreground truncate">
                {user?.email}
              </p>
            </div>
          </div>
        </div>

        {/* Operations */}
        <MenuSection title="Operations">
          <MenuItem icon={Calendar} label="Schedule" href="/m/schedule" />
          <MenuItem icon={ClipboardCheck} label="Tasks" href="/m/tasks" />
          <MenuItem icon={FileText} label="Daily Logs" href="/m/logs" />
          <MenuItem icon={Briefcase} label="Jobs" href="/jobs" />
        </MenuSection>

        {/* Financial */}
        <MenuSection title="Financial">
          <MenuItem icon={DollarSign} label="Invoices" href="/invoices" badge="3" />
          <MenuItem icon={FileText} label="Purchase Orders" href="/purchase-orders" />
          <MenuItem icon={Users} label="Vendors" href="/vendors" />
        </MenuSection>

        {/* Settings */}
        <MenuSection title="Settings">
          <MenuItem icon={User} label="Profile" href="/settings" description="Account settings" />
          <MenuItem icon={Bell} label="Notifications" href="/settings" description="Push & email preferences" />
          <MenuItem icon={Settings} label="App Settings" href="/settings" />
          <MenuItem icon={HelpCircle} label="Help & Support" href="/settings" />
        </MenuSection>

        {/* Sign Out */}
        <div className="mt-6">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center justify-center gap-2 p-4 rounded-xl bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
          >
            <LogOut className="h-5 w-5" />
            <span className="font-medium">Sign Out</span>
          </button>
        </div>

        {/* App Version */}
        <p className="text-center text-xs text-muted-foreground mt-6">
          Construction CMS v1.0.0
        </p>
      </div>
    </MobileLayout>
  );
}

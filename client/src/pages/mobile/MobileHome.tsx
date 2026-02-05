import { MobileLayout } from '@/components/mobile/layout';
import { useUserRole, useTimeClock } from '@/hooks/mobile';
import { useAuth } from '@/contexts/AuthContext';
import { useJob } from '@/contexts/JobContext';
import { Clock, Camera, FileText, CheckSquare, Calendar, DollarSign, Users, AlertTriangle, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

// Quick action button component
function QuickAction({
  icon: Icon,
  label,
  href,
  variant = 'default'
}: {
  icon: React.ElementType;
  label: string;
  href: string;
  variant?: 'default' | 'primary' | 'success' | 'warning';
}) {
  const variantStyles = {
    default: 'bg-card hover:bg-accent',
    primary: 'bg-primary/10 hover:bg-primary/20 text-primary',
    success: 'bg-green-500/10 hover:bg-green-500/20 text-green-500',
    warning: 'bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500',
  };

  return (
    <Link
      to={href}
      className={cn(
        'flex flex-col items-center justify-center gap-2',
        'p-4 rounded-xl border border-border',
        'transition-colors duration-200',
        variantStyles[variant]
      )}
    >
      <Icon className="h-8 w-8" />
      <span className="text-sm font-medium">{label}</span>
    </Link>
  );
}

// Field Crew Dashboard
function FieldCrewDashboard() {
  const { selectedJob } = useJob();
  const { status, summary, loading, elapsedTime } = useTimeClock();

  const isClockedIn = status?.clocked_in;
  const isOnBreak = !!status?.active_break;
  const todayHours = summary?.today.hours || 0;

  // Format hours for display
  const formatHours = (hours: number) => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}h ${m}m`;
  };

  return (
    <div className="p-4 space-y-6">
      {/* Current Job */}
      <div className="bg-card rounded-xl p-4 border border-border">
        <p className="text-sm text-muted-foreground">Current Job</p>
        <p className="text-lg font-semibold truncate">
          {status?.entry?.job?.name || selectedJob?.name || 'No job selected'}
        </p>
      </div>

      {/* Time Clock Status - Prominent */}
      <div className={cn(
        'rounded-xl p-6 border',
        isClockedIn && !isOnBreak && 'bg-green-500/10 border-green-500/20',
        isOnBreak && 'bg-yellow-500/10 border-yellow-500/20',
        !isClockedIn && 'bg-primary/10 border-primary/20'
      )}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm text-muted-foreground">
              {isClockedIn ? (isOnBreak ? 'On Break' : 'Working') : 'Today'}
            </p>
            {loading ? (
              <Loader2 className="h-8 w-8 animate-spin text-primary mt-2" />
            ) : isClockedIn ? (
              <p className={cn(
                'text-3xl font-bold font-mono tabular-nums',
                isOnBreak ? 'text-yellow-500' : 'text-green-500'
              )}>
                {elapsedTime}
              </p>
            ) : (
              <p className="text-3xl font-bold text-primary">{formatHours(todayHours)}</p>
            )}
          </div>
          <Clock className={cn(
            'h-12 w-12',
            isClockedIn && !isOnBreak && 'text-green-500/50',
            isOnBreak && 'text-yellow-500/50',
            !isClockedIn && 'text-primary/50'
          )} />
        </div>
        <Link
          to="/m/time"
          className={cn(
            'block w-full py-3 rounded-lg text-center font-semibold',
            isClockedIn && !isOnBreak && 'bg-green-600 text-white',
            isOnBreak && 'bg-yellow-600 text-yellow-950',
            !isClockedIn && 'bg-primary text-primary-foreground'
          )}
        >
          {isClockedIn ? (isOnBreak ? 'Resume Work' : 'View Time Clock') : 'Clock In'}
        </Link>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground mb-3">Quick Actions</h2>
        <div className="grid grid-cols-3 gap-3">
          <QuickAction icon={Camera} label="Photo" href="/m/photo" variant="primary" />
          <QuickAction icon={FileText} label="Daily Log" href="/m/logs" />
          <QuickAction icon={CheckSquare} label="Tasks" href="/m/tasks" />
        </div>
      </div>

      {/* Today's Schedule */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground mb-3">Today's Schedule</h2>
        <div className="bg-card rounded-xl border border-border divide-y divide-border">
          <div className="p-3 flex items-center gap-3">
            <div className="w-1 h-10 bg-blue-500 rounded-full" />
            <div>
              <p className="font-medium">8:00 AM - Framing inspection</p>
              <p className="text-sm text-muted-foreground">Building dept</p>
            </div>
          </div>
          <div className="p-3 flex items-center gap-3">
            <div className="w-1 h-10 bg-green-500 rounded-full" />
            <div>
              <p className="font-medium">2:00 PM - Material delivery</p>
              <p className="text-sm text-muted-foreground">Lumber package</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Foreman Dashboard
function ForemanDashboard() {
  return (
    <div className="p-4 space-y-6">
      {/* Crew Status */}
      <div className="bg-card rounded-xl p-4 border border-border">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold">Crew On Site</h2>
          <span className="text-2xl font-bold text-primary">5/7</span>
        </div>
        <Link to="/m/crew" className="text-sm text-primary">View details →</Link>
      </div>

      {/* Daily Log Status */}
      <div className="bg-yellow-500/10 rounded-xl p-4 border border-yellow-500/20">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-6 w-6 text-yellow-500" />
          <div>
            <p className="font-semibold text-yellow-500">Daily Log Not Submitted</p>
            <p className="text-sm text-muted-foreground">Due by 5:00 PM</p>
          </div>
        </div>
        <Link
          to="/m/logs/new"
          className="block w-full mt-3 py-2 bg-yellow-500 text-yellow-950 rounded-lg text-center font-semibold"
        >
          Create Daily Log
        </Link>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        <QuickAction icon={Users} label="Crew Time" href="/m/crew" />
        <QuickAction icon={Calendar} label="Schedule" href="/m/schedule" />
        <QuickAction icon={Camera} label="Photos" href="/m/photos" />
        <QuickAction icon={CheckSquare} label="Safety" href="/m/safety" />
      </div>

      {/* Pending Approvals */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground mb-3">Pending Approvals (3)</h2>
        <div className="bg-card rounded-xl border border-border p-3">
          <p className="text-sm">2 Timesheets • 1 Safety Report</p>
          <Link to="/m/approvals" className="text-sm text-primary">Review →</Link>
        </div>
      </div>
    </div>
  );
}

// PM Dashboard
function PMDashboard() {
  return (
    <div className="p-4 space-y-6">
      {/* Job Health Overview */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground mb-3">Job Health</h2>
        <div className="space-y-2">
          <div className="bg-card rounded-xl p-3 border border-border flex items-center justify-between">
            <div>
              <p className="font-medium">Drummond - 501 74th St</p>
              <p className="text-sm text-muted-foreground">$45K / $50K budget</p>
            </div>
            <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-500">On Track</span>
          </div>
          <div className="bg-card rounded-xl p-3 border border-border flex items-center justify-between">
            <div>
              <p className="font-medium">Crews - 8290 Manasota Key</p>
              <p className="text-sm text-muted-foreground">$32K / $30K budget</p>
            </div>
            <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-500">At Risk</span>
          </div>
        </div>
      </div>

      {/* Pending Approvals */}
      <div className="bg-primary/10 rounded-xl p-4 border border-primary/20">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Pending Approvals</h2>
          <span className="text-2xl font-bold text-primary">7</span>
        </div>
        <div className="text-sm space-y-1 text-muted-foreground">
          <p>3 Invoices ($12,450)</p>
          <p>2 POs ($8,200)</p>
          <p>2 Change Orders ($3,100)</p>
        </div>
        <Link
          to="/m/approvals"
          className="block w-full mt-3 py-2 bg-primary text-primary-foreground rounded-lg text-center font-semibold"
        >
          Review All
        </Link>
      </div>

      {/* Alerts */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground mb-3">Alerts</h2>
        <div className="bg-yellow-500/10 rounded-xl p-3 border border-yellow-500/20">
          <div className="flex items-center gap-2 text-yellow-500">
            <AlertTriangle className="h-4 w-4" />
            <p className="text-sm font-medium">Job 2: Budget at 107%</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Owner Dashboard
function OwnerDashboard() {
  return (
    <div className="p-4 space-y-6">
      {/* Financial Overview */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card rounded-xl p-4 border border-border">
          <p className="text-sm text-muted-foreground">Revenue MTD</p>
          <p className="text-2xl font-bold text-green-500">$284,500</p>
        </div>
        <div className="bg-card rounded-xl p-4 border border-border">
          <p className="text-sm text-muted-foreground">Expenses MTD</p>
          <p className="text-2xl font-bold text-foreground">$198,200</p>
        </div>
      </div>

      {/* Profit Margin */}
      <div className="bg-green-500/10 rounded-xl p-4 border border-green-500/20">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Profit Margin</p>
            <p className="text-3xl font-bold text-green-500">30.3%</p>
          </div>
          <DollarSign className="h-12 w-12 text-green-500/30" />
        </div>
        <p className="text-sm text-green-500 mt-2">↑ +2.1% from last month</p>
      </div>

      {/* Cash Position */}
      <div className="bg-card rounded-xl p-4 border border-border">
        <h2 className="font-semibold mb-2">Cash Position</h2>
        <p className="text-xl font-bold">$142,000</p>
        <p className="text-sm text-muted-foreground">$65,000 receivables (30 days)</p>
      </div>

      {/* Critical Approvals */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground mb-3">Critical Approvals (2)</h2>
        <div className="space-y-2">
          <div className="bg-card rounded-xl p-3 border border-border">
            <p className="font-medium">CO #47 - $15,000</p>
            <p className="text-sm text-muted-foreground">Drummond - Kitchen upgrade</p>
          </div>
          <div className="bg-card rounded-xl p-3 border border-border">
            <p className="font-medium">Final Invoice - $28,000</p>
            <p className="text-sm text-muted-foreground">Crews - Project completion</p>
          </div>
        </div>
      </div>

      {/* Project Status */}
      <div className="flex items-center justify-center gap-4 py-2">
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-green-500" />
          <span className="text-sm">4 On Track</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-yellow-500" />
          <span className="text-sm">1 At Risk</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-red-500" />
          <span className="text-sm">0 Critical</span>
        </div>
      </div>
    </div>
  );
}

// Main Mobile Home Component
export default function MobileHome() {
  const { user } = useAuth();
  const { role, isFieldCrew, isForeman, isPM, isOwner } = useUserRole();

  // Determine which dashboard to show based on role
  const renderDashboard = () => {
    if (isOwner) return <OwnerDashboard />;
    if (isPM) return <PMDashboard />;
    if (isForeman) return <ForemanDashboard />;
    // Default to field crew dashboard
    return <FieldCrewDashboard />;
  };

  // Get greeting based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'there';

  return (
    <MobileLayout
      title={`${getGreeting()}, ${userName}`}
      notificationsCount={3}
    >
      {renderDashboard()}
    </MobileLayout>
  );
}

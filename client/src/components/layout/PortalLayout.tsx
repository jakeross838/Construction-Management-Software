import { ReactNode, useEffect, useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Home,
  Image,
  MessageSquare,
  FileText,
  Calendar,
  DollarSign,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import { PortalSession, ClientPortalSettings } from '@/hooks/useClientPortal';
import { cn } from '@/lib/utils';

interface PortalLayoutProps {
  children: ReactNode;
}

const PortalLayout = ({ children }: PortalLayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [session, setSession] = useState<PortalSession | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const storedSession = localStorage.getItem('portal_session');
    if (!storedSession) {
      navigate('/portal/login');
      return;
    }

    try {
      const parsed = JSON.parse(storedSession) as PortalSession;
      setSession(parsed);
    } catch {
      localStorage.removeItem('portal_session');
      navigate('/portal/login');
    }
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('portal_session');
    navigate('/portal/login');
  };

  if (!session) {
    return null;
  }

  const { settings, builder, job, client } = session;

  // Build navigation based on settings
  const navItems = [
    { label: 'Dashboard', icon: Home, path: '/portal/dashboard', show: true },
    { label: 'Photos', icon: Image, path: '/portal/photos', show: settings.show_photos },
    { label: 'Schedule', icon: Calendar, path: '/portal/schedule', show: settings.show_schedule },
    { label: 'Documents', icon: FileText, path: '/portal/documents', show: settings.show_documents },
    { label: 'Selections', icon: FileText, path: '/portal/selections', show: settings.show_selections },
    { label: 'Budget', icon: DollarSign, path: '/portal/budget', show: settings.show_budget },
    { label: 'Messages', icon: MessageSquare, path: '/portal/messages', show: settings.allow_messaging },
  ].filter(item => item.show);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4">
          {/* Logo / Builder Name */}
          <div className="flex items-center gap-3">
            {builder.logo_url ? (
              <img src={builder.logo_url} alt={builder.name} className="h-8 w-auto" />
            ) : (
              <div
                className="h-8 w-8 rounded-full flex items-center justify-center text-white font-semibold"
                style={{ backgroundColor: settings.primary_color || '#3b82f6' }}
              >
                {builder.name.charAt(0)}
              </div>
            )}
            <div className="hidden sm:block">
              <p className="font-semibold text-sm">{builder.name}</p>
              <p className="text-xs text-muted-foreground">{job.name}</p>
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                  location.pathname === item.path
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            ))}
          </nav>

          {/* User Menu */}
          <div className="flex items-center gap-2">
            <span className="hidden sm:block text-sm text-muted-foreground">
              {client.name}
            </span>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline ml-2">Logout</span>
            </Button>

            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="sm"
              className="md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <nav className="md:hidden border-t bg-background p-4 space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                  location.pathname === item.path
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            ))}
          </nav>
        )}
      </header>

      {/* Main Content */}
      <main className="container px-4 py-6">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t py-4 mt-auto">
        <div className="container px-4 text-center text-xs text-muted-foreground">
          <p>{job.address}</p>
        </div>
      </footer>
    </div>
  );
};

export default PortalLayout;

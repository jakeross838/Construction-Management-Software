import { ReactNode, useState } from 'react';
import { NavSidebar } from './NavSidebar';
import { TopBar } from './TopBar';
import { TopNavigation } from './TopNavigation';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useSidebar } from '@/contexts/SidebarContext';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from '@/components/ui/sheet';

interface AppLayoutProps {
  children: ReactNode;
  hideJobSidebar?: boolean;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { user } = useAuth();
  const { collapsed } = useSidebar();
  const userRole = user?.role ?? 'field_crew';
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="h-screen bg-background flex">
      {/* Desktop Sidebar (fixed position) */}
      <div className="hidden md:block">
        <NavSidebar />
      </div>

      {/* Right side: top bar + main content */}
      <div
        className={cn(
          "flex flex-col flex-1 min-w-0 transition-all duration-300",
          // Offset for the fixed sidebar
          collapsed ? "md:ml-16" : "md:ml-64"
        )}
      >
        {/* Mobile header with hamburger */}
        <div className="md:hidden flex items-center h-12 border-b border-border bg-card px-3 shrink-0">
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 mr-2 shrink-0">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-72">
              <NavSidebar />
            </SheetContent>
          </Sheet>
          <TopBar />
        </div>

        {/* Desktop top bar */}
        <div className="hidden md:block">
          <TopBar />
        </div>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
          <div className="p-4 md:p-6">
            {children}
          </div>
        </main>

        {/* Mobile bottom nav */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border safe-area-inset-bottom">
          <TopNavigation userRole={userRole} mobile />
        </nav>
      </div>
    </div>
  );
}

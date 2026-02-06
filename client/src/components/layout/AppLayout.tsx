import { ReactNode, useState } from 'react';
import { Link } from 'react-router-dom';
import { TopNavigation } from './TopNavigation';
import { JobSidebar } from './JobSidebar';
import { AIUploadButton } from '@/components/ai/AIUploadButton';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Building2, Bell, Search, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useJob } from '@/contexts/JobContext';

interface AppLayoutProps {
  children: ReactNode;
  hideJobSidebar?: boolean;
}

export function AppLayout({ children, hideJobSidebar = false }: AppLayoutProps) {
  const { selectedJobId, setSelectedJob } = useJob();
  const { user, builder } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const userName = user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'User' : 'User';
  const userInitials = user ? `${(user.first_name || 'U')[0]}${(user.last_name || '')[0] || ''}` : 'U';
  const userRole = user?.role ?? 'field_crew';

  return (
    <div className="min-h-screen bg-background">
      {/* Top Header with Navigation */}
      <header className="fixed top-0 left-0 right-0 z-50 h-14 md:h-16 bg-card border-b border-border">
        <div className="h-full flex items-center justify-between px-3 md:px-4">
          {/* Mobile Menu Button + Logo */}
          <div className="flex items-center gap-2">
            {/* Mobile Sidebar Toggle */}
            {!hideJobSidebar && (
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="lg:hidden">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="p-0 w-72">
                  <div className="h-full pt-14">
                    <JobSidebar
                      selectedJobId={selectedJobId ?? undefined}
                      onJobSelect={(job) => {
                        setSelectedJob(job);
                        setMobileMenuOpen(false);
                      }}
                      inSheet
                    />
                  </div>
                </SheetContent>
              </Sheet>
            )}

            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 shrink-0">
              <div className="flex h-8 w-8 md:h-9 md:w-9 items-center justify-center rounded-lg bg-primary">
                <Building2 className="h-4 w-4 md:h-5 md:w-5 text-primary-foreground" />
              </div>
              <div className="hidden sm:block">
                <h1 className="text-sm font-semibold text-foreground">{builder?.name || 'Construction CMS'}</h1>
                <p className="text-xs text-muted-foreground">Management Platform</p>
              </div>
            </Link>
          </div>

          {/* Navigation - Hidden on small screens */}
          <div className="hidden md:flex flex-1 justify-center px-4">
            <TopNavigation userRole={userRole} />
          </div>

          {/* Right Side Actions */}
          <div className="flex items-center gap-1 md:gap-2 shrink-0">
            {/* Global Search - Hidden on mobile */}
            <div className="hidden lg:block relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                className="w-48 pl-8 h-9 bg-muted/50"
              />
            </div>

            {/* AI Upload Button */}
            <AIUploadButton />

            {/* Notifications */}
            <Button variant="ghost" size="icon" className="relative h-9 w-9">
              <Bell className="h-5 w-5" />
              <span className="absolute -top-1 -right-1 h-4 w-4 bg-destructive text-destructive-foreground text-xs rounded-full flex items-center justify-center">
                3
              </span>
            </Button>

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2 pl-2 h-9">
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={user?.avatar_url || undefined} />
                    <AvatarFallback>
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden lg:block text-sm font-medium">
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
                <DropdownMenuItem className="text-destructive">Sign Out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border safe-area-inset-bottom">
        <TopNavigation userRole={userRole} mobile />
      </nav>

      {/* Job Sidebar - Desktop Only */}
      {!hideJobSidebar && (
        <div className="hidden lg:block">
          <JobSidebar
            selectedJobId={selectedJobId ?? undefined}
            onJobSelect={(job) => setSelectedJob(job)}
          />
        </div>
      )}

      {/* Main Content */}
      <main className={cn(
        "pt-14 md:pt-16 pb-16 md:pb-0 transition-all duration-300",
        !hideJobSidebar && "lg:ml-64" // Account for job sidebar on desktop only
      )}>
        <div className="p-4 md:p-6">
          {children}
        </div>
      </main>
    </div>
  );
}

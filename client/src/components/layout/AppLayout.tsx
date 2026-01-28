import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { TopNavigation } from './TopNavigation';
import { JobSidebar } from './JobSidebar';
import { AIUploadButton } from '@/components/ai/AIUploadButton';
import { mockUser } from '@/types/auth';
import { cn } from '@/lib/utils';
import { Building2, Bell, Search } from 'lucide-react';
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useJob } from '@/contexts/JobContext';

interface AppLayoutProps {
  children: ReactNode;
  hideJobSidebar?: boolean;
}

export function AppLayout({ children, hideJobSidebar = false }: AppLayoutProps) {
  const { selectedJobId, setSelectedJob } = useJob();

  return (
    <div className="min-h-screen bg-background">
      {/* Top Header with Navigation */}
      <header className="fixed top-0 left-0 right-0 z-50 h-16 bg-card border-b border-border">
        <div className="h-full flex items-center justify-between px-4">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <Building2 className="h-5 w-5 text-primary-foreground" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-sm font-semibold text-foreground">Ross Built</h1>
              <p className="text-xs text-muted-foreground">Custom Homes</p>
            </div>
          </Link>

          {/* Navigation */}
          <div className="flex-1 flex justify-center px-4">
            <TopNavigation userRole={mockUser.role} />
          </div>

          {/* Right Side Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Global Search */}
            <div className="hidden md:block relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search..." 
                className="w-48 pl-8 h-9 bg-muted/50"
              />
            </div>

            {/* AI Upload Button */}
            <AIUploadButton />

            {/* Notifications */}
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              <span className="absolute -top-1 -right-1 h-4 w-4 bg-destructive text-destructive-foreground text-xs rounded-full flex items-center justify-center">
                3
              </span>
            </Button>

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2 pl-2">
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={mockUser.avatar} />
                    <AvatarFallback>
                      {mockUser.name.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden lg:block text-sm font-medium">
                    {mockUser.name.split(' ')[0]}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div>
                    <p className="font-medium">{mockUser.name}</p>
                    <p className="text-xs text-muted-foreground">{mockUser.email}</p>
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

      {/* Job Sidebar */}
      {!hideJobSidebar && (
        <JobSidebar 
          selectedJobId={selectedJobId ?? undefined} 
          onJobSelect={(job) => setSelectedJob(job)} 
        />
      )}

      {/* Main Content */}
      <main className={cn(
        "pt-16 transition-all duration-300",
        !hideJobSidebar && "ml-64" // Account for job sidebar
      )}>
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  );
}

import { useState, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useDBJobs } from '@/hooks/useFinancialData';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Search, 
  Building2,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Plus,
} from 'lucide-react';

const statusColors: Record<string, string> = {
  active: 'bg-green-500',
  pre_construction: 'bg-blue-500',
  completed: 'bg-gray-400',
  warranty: 'bg-amber-500',
  on_hold: 'bg-red-500',
  closed: 'bg-gray-400',
};

interface JobSidebarProps {
  selectedJobId?: string;
  onJobSelect?: (job: { id: string; name: string } | null) => void;
  inSheet?: boolean;
}

export function JobSidebar({ selectedJobId, onJobSelect, inSheet = false }: JobSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const location = useLocation();
  const { data: dbJobs = [], isLoading } = useDBJobs();

  const filteredJobs = useMemo(() => {
    if (!searchQuery.trim()) return dbJobs;
    const query = searchQuery.toLowerCase();
    return dbJobs.filter(job =>
      job.name?.toLowerCase().includes(query) ||
      job.address?.toLowerCase().includes(query) ||
      job.client?.toLowerCase().includes(query)
    );
  }, [searchQuery, dbJobs]);

  const activeJobs = filteredJobs.filter(j => j.status === 'active');
  const otherJobs = filteredJobs.filter(j => j.status !== 'active');

  // In sheet mode, don't use fixed positioning and always expand
  const effectiveCollapsed = inSheet ? false : collapsed;

  return (
    <aside
      className={cn(
        "bg-sidebar border-r border-sidebar-border transition-all duration-300 flex flex-col",
        inSheet
          ? "h-full w-full"
          : cn(
              "fixed left-0 top-16 z-30 h-[calc(100vh-4rem)]",
              effectiveCollapsed ? "w-16" : "w-64"
            )
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-sidebar-border shrink-0">
        {!effectiveCollapsed && (
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Jobs</span>
          </div>
        )}
        {!inSheet && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setCollapsed(!collapsed)}
          >
            {effectiveCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        )}
      </div>

      {/* Search */}
      {!effectiveCollapsed && (
        <div className="p-3 border-b border-sidebar-border shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search jobs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
        </div>
      )}

      {/* Job List */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {effectiveCollapsed ? (
            // Collapsed view - just icons
            <div className="space-y-1">
              {/* All Jobs option */}
              <Button
                variant={!selectedJobId ? "secondary" : "ghost"}
                size="icon"
                className="w-full h-10"
                onClick={() => onJobSelect?.(null)}
                title="All Jobs"
              >
                <Building2 className="h-4 w-4" />
              </Button>
              {filteredJobs.slice(0, 8).map((job) => (
                <Button
                  key={job.id}
                  variant={selectedJobId === job.id ? "secondary" : "ghost"}
                  size="icon"
                  className="w-full h-10"
                  onClick={() => onJobSelect?.({ id: job.id, name: job.name })}
                  title={job.name}
                >
                  <div className={cn("h-2 w-2 rounded-full", statusColors[job.status])} />
                </Button>
              ))}
            </div>
          ) : (
            // Expanded view
            <>
              {/* All Jobs Option */}
              <div className="mb-4">
                <button
                  onClick={() => onJobSelect?.(null)}
                  className={cn(
                    "w-full text-left rounded-lg px-2 py-2 transition-colors",
                    "hover:bg-sidebar-accent",
                    !selectedJobId && "bg-primary/10 border border-primary/20"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">All Jobs</span>
                  </div>
                </button>
              </div>

              {/* Active Jobs Section */}
              {activeJobs.length > 0 && (
                <div className="mb-4">
                  <div className="flex items-center gap-2 px-2 py-1.5 mb-1">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Active ({activeJobs.length})
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    {activeJobs.map((job) => (
                      <JobItem 
                        key={job.id}
                        job={job}
                        isSelected={selectedJobId === job.id}
                        onClick={() => onJobSelect?.({ id: job.id, name: job.name })}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Other Jobs Section */}
              {otherJobs.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 px-2 py-1.5 mb-1">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Other ({otherJobs.length})
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    {otherJobs.map((job) => (
                      <JobItem 
                        key={job.id}
                        job={job}
                        isSelected={selectedJobId === job.id}
                        onClick={() => onJobSelect?.({ id: job.id, name: job.name })}
                      />
                    ))}
                  </div>
                </div>
              )}

              {isLoading ? (
                <div className="space-y-2 px-2">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : filteredJobs.length === 0 && (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  No jobs found
                </div>
              )}
            </>
          )}
        </div>
      </ScrollArea>

      {/* New Job Button */}
      {!collapsed && (
        <div className="p-3 border-t border-sidebar-border shrink-0">
          <Button variant="outline" size="sm" className="w-full gap-2">
            <Plus className="h-3.5 w-3.5" />
            New Job
          </Button>
        </div>
      )}
    </aside>
  );
}

interface JobItemProps {
  job: { id: string; name: string; address: string | null; client: string | null; status: string; percent_complete: number };
  isSelected: boolean;
  onClick: () => void;
}

function JobItem({ job, isSelected, onClick }: JobItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left rounded-lg px-2 py-2 transition-colors",
        "hover:bg-sidebar-accent",
        isSelected && "bg-primary/10 border border-primary/20"
      )}
    >
      <div className="flex items-start gap-2">
        <div className={cn("h-2 w-2 rounded-full mt-1.5 shrink-0", statusColors[job.status])} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{job.name}</p>
          {job.address && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{job.address.split(',')[0]}</span>
            </div>
          )}
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className="text-xs h-5 px-1.5">
              {Math.round(job.percent_complete || 0)}%
            </Badge>
          </div>
        </div>
      </div>
    </button>
  );
}

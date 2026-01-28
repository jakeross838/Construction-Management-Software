import { Receipt, Clock, AlertTriangle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMemo } from 'react';
import { DBJob } from '@/types/financial';

interface Activity {
  id: string;
  type: 'invoice' | 'time' | 'alert' | 'completed';
  title: string;
  description: string;
  timestamp: string;
  jobId?: string;
  jobName?: string;
}

interface RecentActivityProps {
  selectedJobId?: string | null;
  jobs: DBJob[];
}

const typeConfig = {
  invoice: { icon: Receipt, color: 'text-primary bg-primary/10' },
  time: { icon: Clock, color: 'text-info bg-info/10' },
  alert: { icon: AlertTriangle, color: 'text-warning bg-warning/10' },
  completed: { icon: CheckCircle, color: 'text-profit bg-profit/10' },
};

export function RecentActivity({ selectedJobId, jobs }: RecentActivityProps) {
  // Generate activities based on actual jobs
  const activities = useMemo(() => {
    const allActivities: Activity[] = [];
    
    // Generate sample activities for each job
    jobs.forEach((job, index) => {
      // Invoice activity
      allActivities.push({
        id: `inv-${job.id}`,
        type: 'invoice' as const,
        title: 'Invoice Approved',
        description: `Vendor payment - $${(Math.random() * 15000 + 5000).toFixed(0)}`,
        timestamp: `${index * 2 + 10} min ago`,
        jobId: job.id,
        jobName: job.name,
      });
      
      // Add progress update for jobs > 50% complete
      if ((job.percent_complete || 0) > 50) {
        allActivities.push({
          id: `prog-${job.id}`,
          type: 'completed' as const,
          title: 'Milestone Reached',
          description: `${job.percent_complete}% complete`,
          timestamp: `${index * 3 + 1} hour ago`,
          jobId: job.id,
          jobName: job.name,
        });
      }
      
      // Add budget alert for jobs with low margin
      if ((job.target_margin || 0) < 15) {
        allActivities.push({
          id: `alert-${job.id}`,
          type: 'alert' as const,
          title: 'Budget Alert',
          description: `Target margin at ${job.target_margin}%`,
          timestamp: `${index + 2} hours ago`,
          jobId: job.id,
          jobName: job.name,
        });
      }
    });
    
    // Sort by recency (using the index-based timestamps)
    allActivities.sort((a, b) => {
      const getMinutes = (ts: string) => {
        if (ts.includes('min')) return parseInt(ts);
        if (ts.includes('hour')) return parseInt(ts) * 60;
        return 999;
      };
      return getMinutes(a.timestamp) - getMinutes(b.timestamp);
    });
    
    // Filter by selected job if applicable
    if (selectedJobId) {
      return allActivities.filter(a => a.jobId === selectedJobId).slice(0, 6);
    }
    
    return allActivities.slice(0, 6);
  }, [jobs, selectedJobId]);

  const selectedJob = selectedJobId ? jobs.find(j => j.id === selectedJobId) : null;

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="border-b border-border px-6 py-4">
        <h3 className="font-semibold">Recent Activity</h3>
        <p className="text-sm text-muted-foreground">
          {selectedJob ? `Updates for ${selectedJob.name}` : 'Latest updates across all jobs'}
        </p>
      </div>
      
      <div className="divide-y divide-border">
        {activities.length === 0 ? (
          <div className="px-6 py-8 text-center text-muted-foreground">
            {selectedJobId ? 'No recent activity for this job' : 'No recent activity'}
          </div>
        ) : (
          activities.map((activity) => {
            const config = typeConfig[activity.type];
            const Icon = config.icon;
            
            return (
              <div 
                key={activity.id} 
                className="flex items-start gap-4 px-6 py-4 transition-colors hover:bg-accent/30 cursor-pointer"
              >
                <div className={cn("rounded-lg p-2", config.color)}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium truncate">{activity.title}</p>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {activity.timestamp}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground truncate">
                    {activity.description}
                  </p>
                  {!selectedJobId && activity.jobName && (
                    <p className="text-xs text-primary mt-1">{activity.jobName}</p>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
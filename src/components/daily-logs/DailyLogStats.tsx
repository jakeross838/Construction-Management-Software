import { Card, CardContent } from '@/components/ui/card';
import { FileText, Edit, CheckCircle, CalendarDays } from 'lucide-react';

interface DailyLogStatsProps {
  stats: {
    total: number;
    draft: number;
    completed: number;
    thisWeek: number;
  } | undefined;
  isLoading?: boolean;
}

export function DailyLogStats({ stats, isLoading }: DailyLogStatsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="h-16 bg-muted animate-pulse rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const statItems = [
    {
      label: 'Total Logs',
      value: stats?.total || 0,
      icon: FileText,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      label: 'Drafts',
      value: stats?.draft || 0,
      icon: Edit,
      color: 'text-amber-600',
      bgColor: 'bg-amber-100 dark:bg-amber-900/30',
    },
    {
      label: 'Completed',
      value: stats?.completed || 0,
      icon: CheckCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-100 dark:bg-green-900/30',
    },
    {
      label: 'This Week',
      value: stats?.thisWeek || 0,
      icon: CalendarDays,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {statItems.map((item) => (
        <Card key={item.label}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-lg ${item.bgColor}`}>
                <item.icon className={`h-5 w-5 ${item.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold">{item.value}</p>
                <p className="text-xs text-muted-foreground">{item.label}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

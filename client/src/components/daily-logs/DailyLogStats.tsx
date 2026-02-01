import { Skeleton } from '@/components/ui/skeleton';
import { FileText, Edit, CheckCircle, CalendarDays } from 'lucide-react';
import { CompactStats, StatItem } from '@/components/ui/compact-stats';

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
    return <Skeleton className="h-8 w-96" />;
  }

  const statItems: StatItem[] = [
    {
      label: 'Drafts',
      value: stats?.draft || 0,
      icon: Edit,
      color: 'amber',
    },
    {
      label: 'Completed',
      value: stats?.completed || 0,
      icon: CheckCircle,
      color: 'green',
    },
    {
      label: 'This Week',
      value: stats?.thisWeek || 0,
      icon: CalendarDays,
      color: 'blue',
    },
    {
      label: 'Total',
      value: stats?.total || 0,
      icon: FileText,
      color: 'default',
    },
  ];

  return <CompactStats stats={statItems} />;
}

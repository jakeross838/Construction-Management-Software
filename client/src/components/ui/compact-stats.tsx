import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

export interface StatItem {
  label: string;
  value: string | number;
  subValue?: string;
  icon?: LucideIcon;
  color?: 'default' | 'green' | 'amber' | 'red' | 'blue' | 'purple';
}

interface CompactStatsProps {
  stats: StatItem[];
  className?: string;
}

const colorMap = {
  default: 'text-muted-foreground',
  green: 'text-green-600',
  amber: 'text-amber-600',
  red: 'text-red-600',
  blue: 'text-blue-600',
  purple: 'text-purple-600',
};

const bgColorMap = {
  default: 'bg-muted/50',
  green: 'bg-green-50 dark:bg-green-950/30',
  amber: 'bg-amber-50 dark:bg-amber-950/30',
  red: 'bg-red-50 dark:bg-red-950/30',
  blue: 'bg-blue-50 dark:bg-blue-950/30',
  purple: 'bg-purple-50 dark:bg-purple-950/30',
};

export function CompactStats({ stats, className }: CompactStatsProps) {
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        const color = stat.color || 'default';

        return (
          <div
            key={index}
            className={cn(
              'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs',
              bgColorMap[color]
            )}
          >
            {Icon && <Icon className={cn('h-3.5 w-3.5', colorMap[color])} />}
            <span className="text-muted-foreground">{stat.label}:</span>
            <span className={cn('font-medium', colorMap[color])}>
              {stat.value}
            </span>
            {stat.subValue && (
              <span className="text-muted-foreground">({stat.subValue})</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Simpler version - just text inline
interface InlineStatsProps {
  items: Array<{ label: string; value: string | number }>;
  separator?: string;
  className?: string;
}

export function InlineStats({ items, separator = '·', className }: InlineStatsProps) {
  return (
    <div className={cn('flex items-center gap-2 text-xs text-muted-foreground', className)}>
      {items.map((item, index) => (
        <span key={index} className="flex items-center gap-1">
          {index > 0 && <span className="mx-1">{separator}</span>}
          <span>{item.label}:</span>
          <span className="font-medium text-foreground">{item.value}</span>
        </span>
      ))}
    </div>
  );
}

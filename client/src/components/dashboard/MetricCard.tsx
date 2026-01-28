import { cn } from '@/lib/utils';
import { LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string;
  change?: {
    value: number;
    label: string;
  };
  icon?: LucideIcon;
  trend?: 'up' | 'down' | 'neutral';
  className?: string;
}

export function MetricCard({ 
  title, 
  value, 
  change, 
  icon: Icon,
  trend,
  className 
}: MetricCardProps) {
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  
  return (
    <div className={cn("metric-card group", className)}>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold tracking-tight font-mono">{value}</p>
        </div>
        {Icon && (
          <div className="rounded-lg bg-primary/10 p-2.5 text-primary transition-colors group-hover:bg-primary/20">
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
      
      {change && (
        <div className="mt-4 flex items-center gap-2">
          <div className={cn(
            "flex items-center gap-1 text-sm font-medium",
            trend === 'up' && "text-profit",
            trend === 'down' && "text-loss",
            trend === 'neutral' && "text-muted-foreground"
          )}>
            <TrendIcon className="h-3.5 w-3.5" />
            <span>{change.value > 0 ? '+' : ''}{change.value}%</span>
          </div>
          <span className="text-sm text-muted-foreground">{change.label}</span>
        </div>
      )}
    </div>
  );
}

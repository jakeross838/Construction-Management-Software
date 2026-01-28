import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface AIConfidenceBadgeProps {
  confidence: number;
  label?: string;
  showPercent?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

export function getConfidenceLevel(confidence: number): 'high' | 'medium' | 'low' | 'very-low' {
  if (confidence >= 0.85) return 'high';
  if (confidence >= 0.70) return 'medium';
  if (confidence >= 0.50) return 'low';
  return 'very-low';
}

export function getConfidenceLabel(confidence: number): string {
  const level = getConfidenceLevel(confidence);
  switch (level) {
    case 'high': return 'High';
    case 'medium': return 'Medium';
    case 'low': return 'Low';
    case 'very-low': return 'Very Low';
  }
}

export function getConfidenceColor(confidence: number): string {
  const level = getConfidenceLevel(confidence);
  switch (level) {
    case 'high': return 'text-green-600';
    case 'medium': return 'text-amber-600';
    case 'low': return 'text-orange-600';
    case 'very-low': return 'text-red-600';
  }
}

export function AIConfidenceBadge({ 
  confidence, 
  label, 
  showPercent = true,
  size = 'sm',
  className 
}: AIConfidenceBadgeProps) {
  const level = getConfidenceLevel(confidence);
  const percent = Math.round(confidence * 100);
  
  const badgeStyles = {
    'high': 'bg-green-100 text-green-700 border-green-200',
    'medium': 'bg-amber-100 text-amber-700 border-amber-200',
    'low': 'bg-orange-100 text-orange-700 border-orange-200',
    'very-low': 'bg-red-100 text-red-700 border-red-200',
  };

  const sizeStyles = {
    'sm': 'text-xs px-1.5 py-0.5',
    'md': 'text-sm px-2 py-1',
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant="outline" 
            className={cn(
              badgeStyles[level],
              sizeStyles[size],
              'font-medium',
              className
            )}
          >
            {label && <span className="mr-1">{label}:</span>}
            {showPercent ? `${percent}%` : getConfidenceLabel(confidence)}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>{getConfidenceLabel(confidence)} confidence ({percent}%)</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface AIConfidenceBarProps {
  confidence: number;
  label?: string;
  className?: string;
}

export function AIConfidenceBar({ confidence, label, className }: AIConfidenceBarProps) {
  const level = getConfidenceLevel(confidence);
  const percent = Math.round(confidence * 100);
  
  const barColors = {
    'high': 'bg-green-500',
    'medium': 'bg-amber-500',
    'low': 'bg-orange-500',
    'very-low': 'bg-red-500',
  };

  return (
    <div className={cn('space-y-1', className)}>
      {label && (
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">{label}</span>
          <span className={getConfidenceColor(confidence)}>{percent}%</span>
        </div>
      )}
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div 
          className={cn('h-full rounded-full transition-all', barColors[level])}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

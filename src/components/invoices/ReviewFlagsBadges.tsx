import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  AlertTriangle, 
  AlertCircle, 
  Info, 
  Building2, 
  Briefcase, 
  FileWarning,
  DollarSign,
  Calendar,
  ScanLine,
  Copy
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ReviewFlagConfig {
  label: string;
  description: string;
  severity: 'error' | 'warning' | 'info';
  icon: React.ElementType;
}

export const REVIEW_FLAGS: Record<string, ReviewFlagConfig> = {
  'verify_job': { 
    label: 'Verify Job', 
    description: 'Job match confidence is medium - please verify the correct job is selected',
    severity: 'warning',
    icon: Briefcase
  },
  'select_job': { 
    label: 'Select Job', 
    description: 'No confident job match found - manual selection required',
    severity: 'error',
    icon: Briefcase
  },
  'no_job_match': { 
    label: 'No Job Reference', 
    description: 'No job reference found in the invoice document',
    severity: 'warning',
    icon: Briefcase
  },
  'verify_vendor': { 
    label: 'Verify Vendor', 
    description: 'Vendor match confidence is medium - please verify',
    severity: 'warning',
    icon: Building2
  },
  'select_vendor': { 
    label: 'Select Vendor', 
    description: 'No confident vendor match found - manual selection required',
    severity: 'error',
    icon: Building2
  },
  'verify_amount': { 
    label: 'Verify Amount', 
    description: 'Amount extraction confidence is low - please verify the total',
    severity: 'warning',
    icon: DollarSign
  },
  'verify_date': { 
    label: 'Verify Date', 
    description: 'Date extraction confidence is low - please verify invoice date',
    severity: 'warning',
    icon: Calendar
  },
  'ocr_processed': { 
    label: 'Scanned Document', 
    description: 'This appears to be a scanned document - OCR was used, please verify accuracy',
    severity: 'info',
    icon: ScanLine
  },
  'low_text_quality': { 
    label: 'Poor Quality', 
    description: 'Document text quality is poor - extraction may be less accurate',
    severity: 'warning',
    icon: FileWarning
  },
  'possible_duplicate': { 
    label: 'Possible Duplicate', 
    description: 'This invoice may be a duplicate of an existing record',
    severity: 'error',
    icon: Copy
  },
  'verify_po': { 
    label: 'Verify PO', 
    description: 'Purchase order match confidence is low - please verify',
    severity: 'warning',
    icon: FileWarning
  },
};

interface ReviewFlagBadgeProps {
  flag: string;
  showTooltip?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

export function ReviewFlagBadge({ flag, showTooltip = true, size = 'sm', className }: ReviewFlagBadgeProps) {
  const config = REVIEW_FLAGS[flag] || { 
    label: flag, 
    description: flag,
    severity: 'info' as const,
    icon: Info
  };
  
  const Icon = config.icon;
  
  const severityStyles = {
    error: 'bg-red-100 text-red-700 border-red-200',
    warning: 'bg-amber-100 text-amber-700 border-amber-200',
    info: 'bg-blue-100 text-blue-700 border-blue-200',
  };

  const sizeStyles = {
    sm: 'text-xs px-1.5 py-0.5',
    md: 'text-sm px-2 py-1',
  };

  const badge = (
    <Badge 
      variant="outline" 
      className={cn(
        severityStyles[config.severity],
        sizeStyles[size],
        'font-medium gap-1',
        className
      )}
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );

  if (!showTooltip) return badge;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent>
          <p className="max-w-xs">{config.description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface ReviewFlagsListProps {
  flags: string[];
  showTooltips?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

export function ReviewFlagsList({ flags, showTooltips = true, size = 'sm', className }: ReviewFlagsListProps) {
  if (!flags || flags.length === 0) return null;

  // Sort by severity: error first, then warning, then info
  const sortedFlags = [...flags].sort((a, b) => {
    const aConfig = REVIEW_FLAGS[a];
    const bConfig = REVIEW_FLAGS[b];
    const order = { error: 0, warning: 1, info: 2 };
    return (order[aConfig?.severity || 'info'] || 2) - (order[bConfig?.severity || 'info'] || 2);
  });

  return (
    <div className={cn('flex flex-wrap gap-1', className)}>
      {sortedFlags.map(flag => (
        <ReviewFlagBadge key={flag} flag={flag} showTooltip={showTooltips} size={size} />
      ))}
    </div>
  );
}

interface ReviewStatusSummaryProps {
  needsReview: boolean;
  flags: string[];
  overallConfidence?: number;
}

export function ReviewStatusSummary({ needsReview, flags, overallConfidence }: ReviewStatusSummaryProps) {
  const errorCount = flags.filter(f => REVIEW_FLAGS[f]?.severity === 'error').length;
  const warningCount = flags.filter(f => REVIEW_FLAGS[f]?.severity === 'warning').length;

  if (!needsReview && !flags.length) {
    return (
      <div className="flex items-center gap-2 text-green-600 text-sm">
        <AlertCircle className="h-4 w-4" />
        <span>Ready for approval</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      {errorCount > 0 && (
        <div className="flex items-center gap-1 text-red-600">
          <AlertCircle className="h-4 w-4" />
          <span>{errorCount} issue{errorCount !== 1 ? 's' : ''}</span>
        </div>
      )}
      {warningCount > 0 && (
        <div className="flex items-center gap-1 text-amber-600">
          <AlertTriangle className="h-4 w-4" />
          <span>{warningCount} warning{warningCount !== 1 ? 's' : ''}</span>
        </div>
      )}
    </div>
  );
}

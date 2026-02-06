import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { formatCurrency, formatDate, lienReleaseTypeConfig, lienReleaseStatusConfig } from '@/types/financial';
import type { LienRelease, LienReleaseType, LienReleaseStatus } from '@/types/financial';
import {
  ShieldCheck,
  Building2,
  Calendar,
  DollarSign,
  CheckCircle,
  FileInput,
  Paperclip,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface LienReleaseQuickViewProps {
  lienRelease: LienRelease | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const statusConfig = {
  received: { label: 'Received', color: 'text-blue-600', bgColor: 'bg-blue-50', icon: FileInput },
  verified: { label: 'Verified', color: 'text-green-600', bgColor: 'bg-green-50', icon: CheckCircle },
  attached: { label: 'Attached', color: 'text-purple-600', bgColor: 'bg-purple-50', icon: Paperclip },
};

export function LienReleaseQuickView({ lienRelease, open, onOpenChange }: LienReleaseQuickViewProps) {
  if (!lienRelease) return null;
  
  const config = statusConfig[lienRelease.status as keyof typeof statusConfig] || statusConfig.received;
  const StatusIcon = config.icon;
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className={cn("p-2 rounded-lg", config.bgColor)}>
              <ShieldCheck className={cn("h-5 w-5", config.color)} />
            </div>
            <div>
              <DialogTitle>Lien Release</DialogTitle>
              <p className="text-sm text-muted-foreground">{lienRelease.vendor_name}</p>
            </div>
          </div>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Status & Type */}
          <div className="flex items-center gap-2">
            {(() => {
              const typeConf = lienReleaseTypeConfig[lienRelease.release_type as LienReleaseType];
              return (
                <Badge
                  variant="outline"
                  className={cn(typeConf?.color || 'text-amber-600')}
                >
                  {typeConf?.label || lienRelease.release_type}
                </Badge>
              );
            })()}
            <Badge variant="outline" className={cn(config.color, config.bgColor, "gap-1")}>
              <StatusIcon className="h-3 w-3" />
              {config.label}
            </Badge>
          </div>
          
          <Separator />
          
          {/* Details */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-start gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">Vendor</p>
                <p className="text-sm font-medium">{lienRelease.vendor_name || '—'}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">Amount</p>
                <p className="text-sm font-medium">{formatCurrency(lienRelease.amount)}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">Through Date</p>
                <p className="text-sm font-medium">
                  {lienRelease.through_date ? formatDate(lienRelease.through_date) : '—'}
                </p>
              </div>
            </div>
            {lienRelease.verified_at && (
              <div className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">Verified</p>
                  <p className="text-sm font-medium">{formatDate(lienRelease.verified_at)}</p>
                </div>
              </div>
            )}
          </div>
          
          {lienRelease.notes && (
            <>
              <Separator />
              <div>
                <p className="text-xs text-muted-foreground mb-1">Notes</p>
                <p className="text-sm">{lienRelease.notes}</p>
              </div>
            </>
          )}
        </div>
        
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

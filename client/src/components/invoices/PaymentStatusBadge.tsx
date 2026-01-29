/**
 * Payment Status Badge
 * Shows vendor payment status (unpaid/partial/paid)
 */
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { DollarSign, AlertCircle, CheckCircle2 } from 'lucide-react';
import { formatCurrency } from '@/data/mockData';

interface PaymentStatusBadgeProps {
  paymentStatus: 'unpaid' | 'partial' | 'paid' | undefined | null;
  paidAmount?: number | null;
  totalAmount?: number | null;
  compact?: boolean;
}

export function PaymentStatusBadge({
  paymentStatus,
  paidAmount,
  totalAmount,
  compact = false,
}: PaymentStatusBadgeProps) {
  const status = paymentStatus || 'unpaid';
  const paid = paidAmount || 0;
  const total = totalAmount || 0;
  const remaining = total - paid;

  if (status === 'paid') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="default" className="bg-green-600 hover:bg-green-700 gap-1">
              <CheckCircle2 className="h-3 w-3" />
              {!compact && 'Paid'}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>Paid to vendor: {formatCurrency(paid)}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (status === 'partial') {
    const percentPaid = total > 0 ? Math.round((paid / total) * 100) : 0;
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 gap-1">
              <DollarSign className="h-3 w-3" />
              {compact ? `${percentPaid}%` : `Partial (${percentPaid}%)`}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <div className="space-y-1">
              <p>Paid: {formatCurrency(paid)}</p>
              <p>Remaining: {formatCurrency(remaining)}</p>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Unpaid
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className="text-muted-foreground gap-1">
            <AlertCircle className="h-3 w-3" />
            {!compact && 'Unpaid'}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>Not yet paid to vendor</p>
          {total > 0 && <p>Amount due: {formatCurrency(total)}</p>}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

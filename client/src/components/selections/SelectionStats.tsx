import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  CheckCircle2, 
  Clock, 
  ShoppingCart, 
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SelectionStatsData {
  total: number;
  pending: number;
  approved: number;
  needsOrder: number;
  totalAllowance: number;
  totalActual: number;
  variance: number;
}

interface SelectionStatsProps {
  stats?: SelectionStatsData;
  isLoading?: boolean;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

export function SelectionStats({ stats, isLoading }: SelectionStatsProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  const data = stats || {
    total: 0,
    pending: 0,
    approved: 0,
    needsOrder: 0,
    totalAllowance: 0,
    totalActual: 0,
    variance: 0,
  };

  return (
    <div className="grid gap-4 md:grid-cols-4">
      <Card className="border-l-4 border-l-amber-500">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Pending Approval</p>
              <p className="text-2xl font-semibold">{data.pending}</p>
              <p className="text-xs text-muted-foreground">of {data.total} total</p>
            </div>
            <Clock className="h-8 w-8 text-amber-500" />
          </div>
        </CardContent>
      </Card>

      <Card className="border-l-4 border-l-green-500">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Approved</p>
              <p className="text-2xl font-semibold">{data.approved}</p>
              <p className="text-xs text-muted-foreground">
                {data.total > 0 ? Math.round((data.approved / data.total) * 100) : 0}% complete
              </p>
            </div>
            <CheckCircle2 className="h-8 w-8 text-green-500" />
          </div>
        </CardContent>
      </Card>

      <Card className="border-l-4 border-l-blue-500">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Ready to Order</p>
              <p className="text-2xl font-semibold">{data.needsOrder}</p>
              <p className="text-xs text-muted-foreground">approved, not ordered</p>
            </div>
            <ShoppingCart className="h-8 w-8 text-blue-500" />
          </div>
        </CardContent>
      </Card>

      <Card className={cn(
        "border-l-4",
        data.variance >= 0 ? "border-l-green-500" : "border-l-red-500"
      )}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Budget Variance</p>
              <p className={cn(
                "text-2xl font-semibold",
                data.variance >= 0 ? "text-green-600" : "text-red-600"
              )}>
                {data.variance >= 0 ? '+' : ''}{formatCurrency(data.variance)}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatCurrency(data.totalActual)} of {formatCurrency(data.totalAllowance)}
              </p>
            </div>
            {data.variance >= 0 ? (
              <TrendingUp className="h-8 w-8 text-green-500" />
            ) : (
              <TrendingDown className="h-8 w-8 text-red-500" />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

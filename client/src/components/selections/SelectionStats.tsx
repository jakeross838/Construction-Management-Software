import { Skeleton } from '@/components/ui/skeleton';
import {
  CheckCircle2,
  Clock,
  ShoppingCart,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { CompactStats, StatItem } from '@/components/ui/compact-stats';

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
    return <Skeleton className="h-8 w-96" />;
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

  const statItems: StatItem[] = [
    {
      label: 'Pending',
      value: data.pending,
      subValue: `of ${data.total}`,
      icon: Clock,
      color: 'amber'
    },
    {
      label: 'Approved',
      value: data.approved,
      subValue: data.total > 0 ? `${Math.round((data.approved / data.total) * 100)}%` : '0%',
      icon: CheckCircle2,
      color: 'green'
    },
    {
      label: 'Ready to Order',
      value: data.needsOrder,
      icon: ShoppingCart,
      color: 'blue'
    },
    {
      label: 'Variance',
      value: `${data.variance >= 0 ? '+' : ''}${formatCurrency(data.variance)}`,
      icon: data.variance >= 0 ? TrendingUp : TrendingDown,
      color: data.variance >= 0 ? 'green' : 'red'
    },
  ];

  return <CompactStats stats={statItems} />;
}

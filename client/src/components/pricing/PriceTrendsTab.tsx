import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, TrendingDown, Minus, DollarSign, Clock, BarChart3, ChevronRight } from 'lucide-react';
import { useCurrentPrices, usePriceHistory, useMasterItems, MATERIAL_CATEGORIES, PRICE_SOURCE_TYPES, MasterItem } from '@/hooks/usePricing';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { MaterialDetailPanel } from './MaterialDetailPanel';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

export function PriceTrendsTab() {
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [selectedItem, setSelectedItem] = useState<MasterItem | null>(null);
  const [showDetailPanel, setShowDetailPanel] = useState(false);

  const { data: currentPrices = [], isLoading: pricesLoading } = useCurrentPrices(
    categoryFilter !== 'all' ? categoryFilter : undefined
  );
  const { data: priceHistory = [], isLoading: historyLoading } = usePriceHistory();
  const { data: masterItems = [] } = useMasterItems();

  // Calculate stats
  const avgPriceCount = currentPrices.length > 0
    ? Math.round(currentPrices.reduce((sum, p) => sum + p.price_count, 0) / currentPrices.length)
    : 0;

  const recentPrices = priceHistory.slice(0, 10);

  const handleItemClick = (masterItemId: string) => {
    const item = masterItems.find((i) => i.id === masterItemId);
    if (item) {
      setSelectedItem(item);
      setShowDetailPanel(true);
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Price Points</p>
                <p className="text-2xl font-semibold">{currentPrices.length}</p>
              </div>
              <DollarSign className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Data Points</p>
                <p className="text-2xl font-semibold">{avgPriceCount}</p>
              </div>
              <BarChart3 className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Recent Updates</p>
                <p className="text-2xl font-semibold">{priceHistory.length}</p>
              </div>
              <Clock className="h-8 w-8 text-amber-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-4">
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {MATERIAL_CATEGORIES.filter((cat) => cat).map((cat) => (
              <SelectItem key={cat} value={cat} className="capitalize">
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Current Prices */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Current Prices by Vendor</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {pricesLoading ? (
              <div className="p-6 space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : currentPrices.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No price data available
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Range</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentPrices.slice(0, 15).map((price) => {
                    const hasRange = price.min_price !== price.max_price;
                    return (
                      <TableRow
                        key={price.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleItemClick(price.master_item_id)}
                      >
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">{price.master_item_name}</p>
                            <Badge variant="secondary" className="text-xs capitalize">
                              {price.master_item_category}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{price.vendor_name}</TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {formatCurrency(price.latest_price)}/{price.unit}
                        </TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">
                          <div className="flex items-center justify-end gap-1">
                            {hasRange && price.min_price && price.max_price ? (
                              <span>
                                {formatCurrency(price.min_price)} - {formatCurrency(price.max_price)}
                              </span>
                            ) : (
                              <span>—</span>
                            )}
                            <ChevronRight className="h-4 w-4" />
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Recent Price Updates */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Price Updates</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {historyLoading ? (
              <div className="p-6 space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : recentPrices.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No price history available
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">When</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentPrices.map((entry) => {
                    const sourceInfo = PRICE_SOURCE_TYPES.find((s) => s.value === entry.source_type);
                    return (
                      <TableRow
                        key={entry.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleItemClick(entry.master_item_id)}
                      >
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">{entry.master_item_name}</p>
                            <p className="text-xs text-muted-foreground">{entry.vendor_name}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn('text-xs', sourceInfo?.color)}
                          >
                            {sourceInfo?.label || entry.source_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {formatCurrency(entry.unit_price)}/{entry.unit}
                        </TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">
                          <div className="flex items-center justify-end gap-1">
                            {formatDistanceToNow(new Date(entry.captured_at), { addSuffix: true })}
                            <ChevronRight className="h-4 w-4" />
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detail Panel */}
      <MaterialDetailPanel
        item={selectedItem}
        open={showDetailPanel}
        onOpenChange={setShowDetailPanel}
      />
    </div>
  );
}

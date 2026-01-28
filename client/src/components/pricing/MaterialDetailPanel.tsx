import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  TrendingDown,
  TrendingUp,
  FileText,
  Package,
  Building2,
  Calendar,
  Hash,
  Award,
} from 'lucide-react';
import { usePriceHistory, MasterItem, PRICE_SOURCE_TYPES } from '@/hooks/usePricing';
import { cn } from '@/lib/utils';
import { formatDistanceToNow, format } from 'date-fns';

interface MaterialDetailPanelProps {
  item: MasterItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

export function MaterialDetailPanel({ item, open, onOpenChange }: MaterialDetailPanelProps) {
  const [activeTab, setActiveTab] = useState('vendors');
  
  const { data: priceHistory = [], isLoading } = usePriceHistory(item?.id);

  if (!item) return null;

  // Calculate vendor rankings
  const vendorStats = priceHistory.reduce((acc, entry) => {
    const vendorId = entry.vendor_id;
    if (!acc[vendorId]) {
      acc[vendorId] = {
        vendor_id: vendorId,
        vendor_name: entry.vendor_name || 'Unknown',
        prices: [],
        sources: new Map<string, { type: string; id: string; date: string; job?: string }>(),
      };
    }
    acc[vendorId].prices.push(entry.unit_price);
    
    // Track unique sources
    if (entry.source_id) {
      acc[vendorId].sources.set(entry.source_id, {
        type: entry.source_type,
        id: entry.source_id,
        date: entry.captured_at,
        job: entry.job_name,
      });
    }
    
    return acc;
  }, {} as Record<string, { vendor_id: string; vendor_name: string; prices: number[]; sources: Map<string, any> }>);

  const vendorRankings = Object.values(vendorStats)
    .map((v) => ({
      ...v,
      avgPrice: v.prices.reduce((a, b) => a + b, 0) / v.prices.length,
      minPrice: Math.min(...v.prices),
      maxPrice: Math.max(...v.prices),
      entryCount: v.prices.length,
      sourceCount: v.sources.size,
    }))
    .sort((a, b) => a.avgPrice - b.avgPrice);

  const totalEntries = priceHistory.length;
  const totalVendors = vendorRankings.length;
  const lowestPrice = vendorRankings[0]?.minPrice;
  const highestPrice = vendorRankings[vendorRankings.length - 1]?.maxPrice;

  // Get all source documents
  const allSources = priceHistory
    .filter((p) => p.source_id)
    .reduce((acc, p) => {
      if (!acc.find((s) => s.source_id === p.source_id)) {
        acc.push({
          source_id: p.source_id!,
          source_type: p.source_type,
          vendor_name: p.vendor_name || 'Unknown',
          job_name: p.job_name,
          captured_at: p.captured_at,
          unit_price: p.unit_price,
          unit: p.unit,
        });
      }
      return acc;
    }, [] as Array<{ source_id: string; source_type: string; vendor_name: string; job_name?: string; captured_at: string; unit_price: number; unit: string }>)
    .sort((a, b) => new Date(b.captured_at).getTime() - new Date(a.captured_at).getTime());

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            {item.name}
          </SheetTitle>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="capitalize">
              {item.category}
            </Badge>
            <Badge variant="outline">{item.default_unit}</Badge>
          </div>
        </SheetHeader>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 gap-3">
              <Card>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Price Points</p>
                      <p className="text-xl font-semibold">{totalEntries}</p>
                    </div>
                    <Hash className="h-6 w-6 text-primary" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Vendors</p>
                      <p className="text-xl font-semibold">{totalVendors}</p>
                    </div>
                    <Building2 className="h-6 w-6 text-blue-500" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Lowest</p>
                      <p className="text-lg font-semibold text-green-600">
                        {lowestPrice ? formatCurrency(lowestPrice) : '—'}
                      </p>
                    </div>
                    <TrendingDown className="h-6 w-6 text-green-500" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Highest</p>
                      <p className="text-lg font-semibold text-red-600">
                        {highestPrice ? formatCurrency(highestPrice) : '—'}
                      </p>
                    </div>
                    <TrendingUp className="h-6 w-6 text-red-500" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="vendors" className="gap-1">
                  <Award className="h-4 w-4" />
                  Vendor Rankings
                </TabsTrigger>
                <TabsTrigger value="sources" className="gap-1">
                  <FileText className="h-4 w-4" />
                  Source Documents
                </TabsTrigger>
              </TabsList>

              <TabsContent value="vendors" className="mt-4">
                {vendorRankings.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No vendor data available
                  </div>
                ) : (
                  <div className="space-y-3">
                    {vendorRankings.map((vendor, index) => (
                      <Card
                        key={vendor.vendor_id}
                        className={cn(
                          index === 0 && 'border-green-500 bg-green-50/50 dark:bg-green-950/20'
                        )}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <div
                                className={cn(
                                  'flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold',
                                  index === 0
                                    ? 'bg-green-500 text-white'
                                    : index === 1
                                    ? 'bg-blue-500 text-white'
                                    : index === 2
                                    ? 'bg-amber-500 text-white'
                                    : 'bg-muted text-muted-foreground'
                                )}
                              >
                                #{index + 1}
                              </div>
                              <div>
                                <p className="font-medium">{vendor.vendor_name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {vendor.entryCount} price points • {vendor.sourceCount} sources
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-mono font-semibold">
                                {formatCurrency(vendor.avgPrice)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatCurrency(vendor.minPrice)} - {formatCurrency(vendor.maxPrice)}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="sources" className="mt-4">
                {allSources.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No source documents available
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Source</TableHead>
                        <TableHead>Vendor</TableHead>
                        <TableHead className="text-right">Price</TableHead>
                        <TableHead className="text-right">Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allSources.map((source) => {
                        const sourceInfo = PRICE_SOURCE_TYPES.find(
                          (s) => s.value === source.source_type
                        );
                        return (
                          <TableRow key={source.source_id}>
                            <TableCell>
                              <div>
                                <Badge
                                  variant="outline"
                                  className={cn('text-xs', sourceInfo?.color)}
                                >
                                  {sourceInfo?.label || source.source_type}
                                </Badge>
                                {source.job_name && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {source.job_name}
                                  </p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-sm">{source.vendor_name}</TableCell>
                            <TableCell className="text-right font-mono text-sm">
                              {formatCurrency(source.unit_price)}/{source.unit}
                            </TableCell>
                            <TableCell className="text-right text-xs text-muted-foreground">
                              {format(new Date(source.captured_at), 'MMM d, yyyy')}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>
            </Tabs>

            {/* Price History */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Recent Price History
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vendor</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead className="text-right">When</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {priceHistory.slice(0, 10).map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="text-sm">{entry.vendor_name}</TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {formatCurrency(entry.unit_price)}/{entry.unit}
                        </TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(entry.captured_at), { addSuffix: true })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

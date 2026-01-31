import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Award,
  CheckCircle2,
  XCircle,
  DollarSign,
  TrendingDown,
  TrendingUp,
  Calendar,
  FileText,
  Shield,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface SubcontractorBid {
  id: string;
  vendor_id: string;
  vendor_name: string;
  bid_amount: number;
  unit_price_per_sf?: number | null;
  inclusions?: string[];
  exclusions?: string[];
  clarifications?: string[];
  proposed_start_date?: string | null;
  proposed_duration_days?: number | null;
  payment_terms?: string | null;
  warranty_terms?: string | null;
  bond_included?: boolean;
  insurance_verified?: boolean;
  valid_until?: string | null;
  notes?: string | null;
  submitted_at?: string | null;
  status: string;
  document_count?: number;
}

interface BidComparisonViewProps {
  bids: SubcontractorBid[];
  onSelectBid?: (bidId: string) => void;
}

export function BidComparisonView({ bids, onSelectBid }: BidComparisonViewProps) {
  if (bids.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <DollarSign className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p>No bids to compare</p>
        <p className="text-sm">Record at least 2 bids to enable comparison</p>
      </div>
    );
  }

  if (bids.length === 1) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <DollarSign className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p>Need at least 2 bids to compare</p>
        <p className="text-sm">Currently have 1 bid from {bids[0].vendor_name}</p>
      </div>
    );
  }

  // Sort by bid amount
  const sortedBids = [...bids].sort((a, b) => a.bid_amount - b.bid_amount);
  const lowestBid = sortedBids[0].bid_amount;
  const highestBid = sortedBids[sortedBids.length - 1].bid_amount;
  const avgBid = sortedBids.reduce((sum, b) => sum + b.bid_amount, 0) / sortedBids.length;
  const spread = highestBid - lowestBid;
  const spreadPercent = ((spread / lowestBid) * 100).toFixed(1);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Lowest Bid</p>
            <p className="text-xl font-bold text-green-600">{formatCurrency(lowestBid)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Highest Bid</p>
            <p className="text-xl font-bold text-red-500">{formatCurrency(highestBid)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Average</p>
            <p className="text-xl font-bold">{formatCurrency(avgBid)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Spread</p>
            <p className="text-xl font-bold">{spreadPercent}%</p>
            <p className="text-xs text-muted-foreground">{formatCurrency(spread)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Side-by-side Comparison */}
      <ScrollArea className="w-full">
        <div className="flex gap-4 min-w-max pb-4">
          {sortedBids.map((bid, index) => {
            const isLowest = index === 0;
            const diffFromLowest = bid.bid_amount - lowestBid;
            const percentDiff = ((diffFromLowest / lowestBid) * 100).toFixed(1);

            return (
              <Card
                key={bid.id}
                className={cn(
                  'w-80 shrink-0',
                  isLowest && 'ring-2 ring-green-500'
                )}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        {isLowest && <Award className="h-5 w-5 text-amber-500" />}
                        {bid.vendor_name}
                      </CardTitle>
                      {isLowest && (
                        <Badge className="mt-1 bg-green-100 text-green-700">
                          Lowest Bid
                        </Badge>
                      )}
                    </div>
                    {bid.status === 'selected' && (
                      <Badge className="bg-blue-100 text-blue-700">Selected</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Price */}
                  <div className="text-center py-3 bg-muted rounded-lg">
                    <p className="text-3xl font-bold">{formatCurrency(bid.bid_amount)}</p>
                    {bid.unit_price_per_sf && (
                      <p className="text-sm text-muted-foreground">
                        ${bid.unit_price_per_sf.toFixed(2)}/SF
                      </p>
                    )}
                    {!isLowest && (
                      <p className="text-xs text-red-500 mt-1">
                        +{formatCurrency(diffFromLowest)} (+{percentDiff}%)
                      </p>
                    )}
                  </div>

                  <Separator />

                  {/* Details Grid */}
                  <div className="space-y-3 text-sm">
                    {/* Schedule */}
                    {(bid.proposed_start_date || bid.proposed_duration_days) && (
                      <div className="flex items-start gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <div>
                          {bid.proposed_start_date && (
                            <p>Start: {format(new Date(bid.proposed_start_date), 'MMM d, yyyy')}</p>
                          )}
                          {bid.proposed_duration_days && (
                            <p className="text-muted-foreground">
                              Duration: {bid.proposed_duration_days} days
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Bond & Insurance */}
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1">
                        <Shield className="h-4 w-4 text-muted-foreground" />
                        <span>Bond:</span>
                        {bid.bond_included ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-400" />
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <span>Insured:</span>
                        {bid.insurance_verified ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-400" />
                        )}
                      </div>
                    </div>

                    {/* Validity */}
                    {bid.valid_until && (
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span>Valid until: {format(new Date(bid.valid_until), 'MMM d, yyyy')}</span>
                      </div>
                    )}

                    {/* Documents */}
                    {bid.document_count !== undefined && bid.document_count > 0 && (
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span>{bid.document_count} document(s) attached</span>
                      </div>
                    )}
                  </div>

                  <Separator />

                  {/* Inclusions */}
                  {bid.inclusions && bid.inclusions.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-green-600 mb-1 flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" />
                        Inclusions ({bid.inclusions.length})
                      </p>
                      <ul className="text-xs space-y-0.5">
                        {bid.inclusions.slice(0, 3).map((inc, i) => (
                          <li key={i} className="text-muted-foreground truncate">• {inc}</li>
                        ))}
                        {bid.inclusions.length > 3 && (
                          <li className="text-muted-foreground">
                            +{bid.inclusions.length - 3} more...
                          </li>
                        )}
                      </ul>
                    </div>
                  )}

                  {/* Exclusions */}
                  {bid.exclusions && bid.exclusions.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-red-600 mb-1 flex items-center gap-1">
                        <TrendingDown className="h-3 w-3" />
                        Exclusions ({bid.exclusions.length})
                      </p>
                      <ul className="text-xs space-y-0.5">
                        {bid.exclusions.slice(0, 3).map((exc, i) => (
                          <li key={i} className="text-muted-foreground truncate">• {exc}</li>
                        ))}
                        {bid.exclusions.length > 3 && (
                          <li className="text-muted-foreground">
                            +{bid.exclusions.length - 3} more...
                          </li>
                        )}
                      </ul>
                    </div>
                  )}

                  {/* Notes */}
                  {bid.notes && (
                    <div>
                      <p className="text-xs font-medium mb-1">Notes</p>
                      <p className="text-xs text-muted-foreground line-clamp-2">{bid.notes}</p>
                    </div>
                  )}

                  {/* Select Button */}
                  {onSelectBid && bid.status !== 'selected' && (
                    <Button
                      className="w-full mt-2"
                      variant={isLowest ? 'default' : 'outline'}
                      onClick={() => onSelectBid(bid.id)}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Select This Bid
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}

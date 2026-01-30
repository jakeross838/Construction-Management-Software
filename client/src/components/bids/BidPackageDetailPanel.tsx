import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  X,
  Edit,
  FileText,
  Upload,
  Users,
  MoreVertical,
  Award,
  Trash2,
  Plus,
  ExternalLink,
  CheckCircle2,
  Clock,
  DollarSign,
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  BidPackage,
  BID_PACKAGE_STATUS_OPTIONS,
  SUBCONTRACTOR_BID_STATUS_OPTIONS,
  useBidPackageDocuments,
  useBidPackageInvites,
  useSubcontractorBids,
  useUpdateBidPackage,
  useUpdateSubcontractorBid,
} from '@/hooks/useBidPackages';
import { SubcontractorBidFormDialog } from './SubcontractorBidFormDialog';
import { BidPackageDocumentsSection } from './BidPackageDocumentsSection';
import { BidPackageInvitesSection } from './BidPackageInvitesSection';

interface BidPackageDetailPanelProps {
  bidPackage: BidPackage;
  onClose: () => void;
  onEdit: () => void;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

export function BidPackageDetailPanel({
  bidPackage,
  onClose,
  onEdit,
}: BidPackageDetailPanelProps) {
  const [showBidForm, setShowBidForm] = useState(false);
  const [editingBid, setEditingBid] = useState<any>(null);

  const { data: documents = [] } = useBidPackageDocuments(bidPackage.id);
  const { data: invites = [] } = useBidPackageInvites(bidPackage.id);
  const { data: bids = [] } = useSubcontractorBids(bidPackage.id);

  const updatePackage = useUpdateBidPackage();
  const updateBid = useUpdateSubcontractorBid();

  const statusInfo = BID_PACKAGE_STATUS_OPTIONS.find(
    (s) => s.value === bidPackage.status
  );

  const lowestBid = bids.length > 0 ? Math.min(...bids.map((b) => b.bid_amount)) : null;
  const avgBid =
    bids.length > 0
      ? bids.reduce((sum, b) => sum + b.bid_amount, 0) / bids.length
      : null;

  const handleSelectBid = (bidId: string) => {
    // Mark this bid as selected, others as rejected
    bids.forEach((bid) => {
      if (bid.id === bidId) {
        updateBid.mutate({ id: bid.id, status: 'selected', is_lowest_bid: true });
      } else if (bid.status !== 'withdrawn') {
        updateBid.mutate({ id: bid.id, status: 'rejected' });
      }
    });

    // Update package to awarded
    const selectedBid = bids.find((b) => b.id === bidId);
    if (selectedBid) {
      updatePackage.mutate({
        id: bidPackage.id,
        status: 'awarded',
        awarded_vendor_id: selectedBid.vendor_id,
        awarded_amount: selectedBid.bid_amount,
        awarded_at: new Date().toISOString(),
      });
    }
  };

  return (
    <>
      <Card className="h-full flex flex-col">
        <CardHeader className="pb-4 flex-shrink-0">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <CardTitle className="text-xl">{bidPackage.title}</CardTitle>
                <Badge className={cn('text-xs', statusInfo?.color)}>
                  {statusInfo?.label}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {bidPackage.package_number && `${bidPackage.package_number} • `}
                {bidPackage.trade_category || (bidPackage as any).trade_type || 'General'}
              </p>
              {(bidPackage.job_name || (bidPackage as any).job?.name) && (
                <p className="text-sm text-muted-foreground">
                  {bidPackage.job_name || (bidPackage as any).job?.name}
                </p>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Button size="icon" variant="ghost" onClick={onEdit}>
                <Edit className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <ScrollArea className="flex-1">
          <CardContent className="space-y-6">
            {/* Vendor & Amount Info (for v2_bids) */}
            {(bidPackage as any).vendor && (
              <Card className="border-blue-200 bg-blue-50/50">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Vendor</p>
                      <p className="font-semibold text-lg">{(bidPackage as any).vendor.name}</p>
                    </div>
                    {(bidPackage as any).bid_amount && (
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Bid Amount</p>
                        <p className="font-bold text-2xl text-green-600">
                          {formatCurrency((bidPackage as any).bid_amount)}
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Key Info */}
            <div className="grid grid-cols-3 gap-4">
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">Due Date</p>
                <p className="font-semibold">
                  {bidPackage.due_date
                    ? format(new Date(bidPackage.due_date), 'MMM d, yyyy')
                    : '—'}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">Received Date</p>
                <p className="font-semibold">
                  {(bidPackage as any).received_date
                    ? format(new Date((bidPackage as any).received_date), 'MMM d, yyyy')
                    : (bidPackage as any).created_at
                    ? format(new Date((bidPackage as any).created_at), 'MMM d, yyyy')
                    : '—'}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">Documents</p>
                <p className="font-semibold">{(bidPackage as any).documents?.length || documents.length || 0}</p>
              </div>
            </div>

            {/* Bid Summary */}
            {bids.length > 0 && (
              <Card className="border-green-200 bg-green-50/50">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-green-600" />
                      Bid Summary
                    </h4>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-xs text-muted-foreground">Lowest Bid</p>
                      <p className="text-lg font-bold text-green-600">
                        {lowestBid ? formatCurrency(lowestBid) : '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Average</p>
                      <p className="text-lg font-semibold">
                        {avgBid ? formatCurrency(avgBid) : '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Spread</p>
                      <p className="text-lg font-semibold">
                        {bids.length >= 2
                          ? formatCurrency(
                              Math.max(...bids.map((b) => b.bid_amount)) -
                                Math.min(...bids.map((b) => b.bid_amount))
                            )
                          : '—'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Scope of Work */}
            {bidPackage.scope_of_work && (
              <div>
                <h4 className="text-sm font-medium mb-2">Scope of Work</h4>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {bidPackage.scope_of_work}
                </p>
              </div>
            )}

            <Tabs defaultValue="bids" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="bids" className="gap-1">
                  <DollarSign className="h-3 w-3" />
                  Bids ({bids.length})
                </TabsTrigger>
                <TabsTrigger value="documents" className="gap-1">
                  <FileText className="h-3 w-3" />
                  Documents ({documents.length})
                </TabsTrigger>
                <TabsTrigger value="invites" className="gap-1">
                  <Users className="h-3 w-3" />
                  Invites ({invites.length})
                </TabsTrigger>
              </TabsList>

              {/* Bids Tab */}
              <TabsContent value="bids" className="space-y-4">
                <div className="flex justify-end">
                  <Button size="sm" onClick={() => setShowBidForm(true)}>
                    <Plus className="h-4 w-4 mr-1" />
                    Record Bid
                  </Button>
                </div>

                {bids.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <DollarSign className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No bids received yet</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Subcontractor</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="text-right">$/SF</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bids.map((bid) => {
                        const isLowest = bid.bid_amount === lowestBid;
                        const bidStatusInfo = SUBCONTRACTOR_BID_STATUS_OPTIONS.find(
                          (s) => s.value === bid.status
                        );
                        return (
                          <TableRow
                            key={bid.id}
                            className={cn(isLowest && 'bg-green-50')}
                          >
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {isLowest && (
                                  <Award className="h-4 w-4 text-amber-500" />
                                )}
                                <span className="font-medium">{bid.vendor_name}</span>
                              </div>
                              {bid.inclusions.length > 0 && (
                                <p className="text-xs text-muted-foreground">
                                  {bid.inclusions.length} inclusions
                                </p>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-mono font-semibold">
                              {formatCurrency(bid.bid_amount)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm">
                              {bid.unit_price_per_sf
                                ? `$${bid.unit_price_per_sf.toFixed(2)}`
                                : '—'}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="secondary"
                                className={cn('text-xs', bidStatusInfo?.color)}
                              >
                                {bidStatusInfo?.label}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button size="icon" variant="ghost" className="h-7 w-7">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setEditingBid(bid);
                                      setShowBidForm(true);
                                    }}
                                  >
                                    <Edit className="h-4 w-4 mr-2" />
                                    Edit Bid
                                  </DropdownMenuItem>
                                  {bid.status !== 'selected' && (
                                    <DropdownMenuItem
                                      onClick={() => handleSelectBid(bid.id)}
                                    >
                                      <CheckCircle2 className="h-4 w-4 mr-2" />
                                      Select This Bid
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>

              {/* Documents Tab */}
              <TabsContent value="documents">
                <BidPackageDocumentsSection
                  bidPackageId={bidPackage.id}
                  documents={documents}
                />
              </TabsContent>

              {/* Invites Tab */}
              <TabsContent value="invites">
                <BidPackageInvitesSection
                  bidPackageId={bidPackage.id}
                  invites={invites}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </ScrollArea>
      </Card>

      <SubcontractorBidFormDialog
        open={showBidForm}
        onOpenChange={(open) => {
          setShowBidForm(open);
          if (!open) setEditingBid(null);
        }}
        bidPackage={bidPackage}
        editBid={editingBid}
      />
    </>
  );
}

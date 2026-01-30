import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
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
  Edit,
  FileText,
  Users,
  MoreVertical,
  Award,
  Plus,
  CheckCircle2,
  DollarSign,
  Calendar,
  Building2,
  Phone,
  Mail,
  MapPin,
  Clock,
  Tag,
  Briefcase,
  ClipboardList,
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  BidPackage,
  BidDocument,
  BID_PACKAGE_STATUS_OPTIONS,
  SUBCONTRACTOR_BID_STATUS_OPTIONS,
  useBidDocuments,
  useBidPackageInvites,
  useSubcontractorBids,
  useUpdateBidPackage,
  useUpdateSubcontractorBid,
  useAwardBidPackage,
} from '@/hooks/useBidPackages';
import { SubcontractorBidFormDialog } from './SubcontractorBidFormDialog';
import { BidPackageDocumentsSection } from './BidPackageDocumentsSection';
import { BidPackageInvitesSection } from './BidPackageInvitesSection';

interface BidPackageDetailDialogProps {
  bidPackage: BidPackage | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

export function BidPackageDetailDialog({
  bidPackage,
  open,
  onOpenChange,
  onEdit,
}: BidPackageDetailDialogProps) {
  const [showBidForm, setShowBidForm] = useState(false);
  const [editingBid, setEditingBid] = useState<any>(null);

  const { data: documents = [] } = useBidDocuments(bidPackage?.id || '');
  const { data: invites = [] } = useBidPackageInvites(bidPackage?.id || '');
  const { data: bids = [] } = useSubcontractorBids(bidPackage?.id);

  const updatePackage = useUpdateBidPackage();
  const updateBid = useUpdateSubcontractorBid();
  const awardPackage = useAwardBidPackage();

  if (!bidPackage) return null;

  const statusInfo = BID_PACKAGE_STATUS_OPTIONS.find(
    (s) => s.value === bidPackage.status
  );

  const lowestBid = bids.length > 0 ? Math.min(...bids.map((b) => b.bid_amount)) : null;
  const avgBid =
    bids.length > 0
      ? bids.reduce((sum, b) => sum + b.bid_amount, 0) / bids.length
      : null;

  const handleSelectBid = (bidId: string) => {
    const selectedBid = bids.find((b) => b.id === bidId);
    if (selectedBid) {
      awardPackage.mutate({
        id: bidPackage.id,
        vendor_id: selectedBid.vendor_id,
        amount: selectedBid.bid_amount,
        submission_id: selectedBid.id,
      });
    }
  };

  // Extract vendor info from v2_bids structure
  const vendor = (bidPackage as any).vendor;
  const bidAmount = (bidPackage as any).bid_amount;
  const receivedDate = (bidPackage as any).received_date || (bidPackage as any).created_at;
  const bidDocuments = (bidPackage as any).documents || [];
  const description = bidPackage.description || (bidPackage as any).notes;
  const jobName = bidPackage.job_name || (bidPackage as any).job?.name;
  const tradeCategory = bidPackage.trade_category || (bidPackage as any).trade_type || 'General';

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0 gap-0">
          {/* Header */}
          <DialogHeader className="p-6 pb-4 border-b flex-shrink-0">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <DialogTitle className="text-2xl font-semibold">
                    {bidPackage.title}
                  </DialogTitle>
                  <Badge className={cn('text-sm px-3 py-1', statusInfo?.color)}>
                    {statusInfo?.label}
                  </Badge>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  {bidPackage.package_number && (
                    <span className="flex items-center gap-1">
                      <Tag className="h-4 w-4" />
                      {bidPackage.package_number}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Briefcase className="h-4 w-4" />
                    {tradeCategory}
                  </span>
                  {jobName && (
                    <span className="flex items-center gap-1">
                      <Building2 className="h-4 w-4" />
                      {jobName}
                    </span>
                  )}
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={onEdit} className="gap-2">
                <Edit className="h-4 w-4" />
                Edit
              </Button>
            </div>
          </DialogHeader>

          {/* Content */}
          <ScrollArea className="flex-1">
            <div className="p-6 space-y-6">
              {/* Primary Bid Info Card - for v2_bids with vendor */}
              {vendor && bidAmount && (
                <Card className="border-2 border-green-200 bg-gradient-to-r from-green-50 to-emerald-50">
                  <CardContent className="p-6">
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div>
                          <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Vendor</p>
                          <p className="font-semibold text-xl">{vendor.name}</p>
                        </div>
                        {vendor.email && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Mail className="h-4 w-4" />
                            {vendor.email}
                          </div>
                        )}
                        {vendor.phone && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Phone className="h-4 w-4" />
                            {vendor.phone}
                          </div>
                        )}
                      </div>
                      <div className="text-right space-y-2">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Bid Amount</p>
                        <p className="font-bold text-4xl text-green-600">
                          {formatCurrency(bidAmount)}
                        </p>
                        {bidPackage.square_footage && (
                          <p className="text-sm text-muted-foreground">
                            ${(bidAmount / bidPackage.square_footage).toFixed(2)} / SF
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Key Details Grid */}
              <div className="grid grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-blue-100">
                        <Calendar className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Due Date</p>
                        <p className="font-semibold">
                          {bidPackage.due_date
                            ? format(new Date(bidPackage.due_date), 'MMM d, yyyy')
                            : '—'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-green-100">
                        <Clock className="h-5 w-5 text-green-600" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Received</p>
                        <p className="font-semibold">
                          {receivedDate
                            ? format(new Date(receivedDate), 'MMM d, yyyy')
                            : '—'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-purple-100">
                        <FileText className="h-5 w-5 text-purple-600" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Documents</p>
                        <p className="font-semibold">{bidDocuments.length || documents.length || 0}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-amber-100">
                        <MapPin className="h-5 w-5 text-amber-600" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Square Footage</p>
                        <p className="font-semibold">
                          {bidPackage.square_footage
                            ? bidPackage.square_footage.toLocaleString() + ' SF'
                            : '—'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Bid Summary for subcontractor bids */}
              {bids.length > 0 && (
                <Card className="border-green-200 bg-green-50/50">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-semibold text-lg flex items-center gap-2">
                        <DollarSign className="h-5 w-5 text-green-600" />
                        Bid Comparison Summary
                      </h4>
                      <Badge variant="secondary">{bids.length} bids received</Badge>
                    </div>
                    <div className="grid grid-cols-4 gap-6 text-center">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Lowest Bid</p>
                        <p className="text-2xl font-bold text-green-600">
                          {lowestBid ? formatCurrency(lowestBid) : '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Average</p>
                        <p className="text-2xl font-semibold">
                          {avgBid ? formatCurrency(avgBid) : '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Highest Bid</p>
                        <p className="text-2xl font-semibold text-muted-foreground">
                          {bids.length > 0
                            ? formatCurrency(Math.max(...bids.map((b) => b.bid_amount)))
                            : '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Spread</p>
                        <p className="text-2xl font-semibold text-amber-600">
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

              {/* Scope of Work and Description */}
              {(bidPackage.scope_of_work || description) && (
                <Card>
                  <CardContent className="p-6">
                    <h4 className="font-semibold text-lg flex items-center gap-2 mb-4">
                      <ClipboardList className="h-5 w-5" />
                      Scope of Work
                    </h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                      {bidPackage.scope_of_work || description}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Special Requirements */}
              {bidPackage.special_requirements && (
                <Card className="border-amber-200 bg-amber-50/50">
                  <CardContent className="p-6">
                    <h4 className="font-semibold text-lg mb-4">Special Requirements</h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {bidPackage.special_requirements}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Tabs for Bids, Documents, Invites */}
              <Tabs defaultValue="bids" className="w-full">
                <TabsList className="grid w-full grid-cols-3 h-12">
                  <TabsTrigger value="bids" className="gap-2 text-sm">
                    <DollarSign className="h-4 w-4" />
                    Subcontractor Bids ({bids.length})
                  </TabsTrigger>
                  <TabsTrigger value="documents" className="gap-2 text-sm">
                    <FileText className="h-4 w-4" />
                    Documents ({bidDocuments.length || documents.length})
                  </TabsTrigger>
                  <TabsTrigger value="invites" className="gap-2 text-sm">
                    <Users className="h-4 w-4" />
                    Invited Vendors ({invites.length})
                  </TabsTrigger>
                </TabsList>

                {/* Bids Tab */}
                <TabsContent value="bids" className="mt-4 space-y-4">
                  <div className="flex justify-end">
                    <Button size="sm" onClick={() => setShowBidForm(true)}>
                      <Plus className="h-4 w-4 mr-1" />
                      Record Bid
                    </Button>
                  </div>

                  {bids.length === 0 ? (
                    <Card className="border-dashed">
                      <CardContent className="p-8 text-center">
                        <DollarSign className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                        <p className="text-muted-foreground">No bids received yet</p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-4"
                          onClick={() => setShowBidForm(true)}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Record First Bid
                        </Button>
                      </CardContent>
                    </Card>
                  ) : (
                    <Card>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Subcontractor</TableHead>
                            <TableHead className="text-right">Bid Amount</TableHead>
                            <TableHead className="text-right">$/SF</TableHead>
                            <TableHead>Submitted</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="w-10"></TableHead>
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
                                      <Award className="h-5 w-5 text-amber-500" />
                                    )}
                                    <div>
                                      <span className="font-medium">{bid.vendor_name}</span>
                                      {bid.inclusions && bid.inclusions.length > 0 && (
                                        <p className="text-xs text-muted-foreground">
                                          {bid.inclusions.length} inclusions
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell className="text-right font-mono font-semibold text-lg">
                                  {formatCurrency(bid.bid_amount)}
                                </TableCell>
                                <TableCell className="text-right font-mono text-sm">
                                  {bid.unit_price_per_sf
                                    ? `$${bid.unit_price_per_sf.toFixed(2)}`
                                    : '—'}
                                </TableCell>
                                <TableCell className="text-sm">
                                  {bid.submitted_at
                                    ? format(new Date(bid.submitted_at), 'MMM d, yyyy')
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
                                      <Button size="icon" variant="ghost" className="h-8 w-8">
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
                    </Card>
                  )}
                </TabsContent>

                {/* Documents Tab */}
                <TabsContent value="documents" className="mt-4">
                  <BidPackageDocumentsSection
                    bidPackageId={bidPackage.id}
                    bidTitle={bidPackage.title}
                    documents={documents}
                  />
                </TabsContent>

                {/* Invites Tab */}
                <TabsContent value="invites" className="mt-4">
                  <BidPackageInvitesSection
                    bidPackageId={bidPackage.id}
                    invites={invites}
                  />
                </TabsContent>
              </Tabs>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

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

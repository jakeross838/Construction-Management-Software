import { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  ExternalLink,
  Pencil,
  CheckCircle2,
  XCircle,
  Truck,
  Package,
  Calendar,
  DollarSign,
  MapPin,
  Clock,
  User,
  FileText,
  ShoppingCart,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Selection,
  CATEGORY_OPTIONS,
  ORDER_STATUS_OPTIONS,
  APPROVAL_STATUS_OPTIONS,
  useUpdateSelection,
} from '@/hooks/useSelections';

interface SelectionDetailPanelProps {
  selection: Selection | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (selection: Selection) => void;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

export function SelectionDetailPanel({
  selection,
  open,
  onOpenChange,
  onEdit,
}: SelectionDetailPanelProps) {
  const updateMutation = useUpdateSelection();

  if (!selection) return null;

  const categoryInfo = CATEGORY_OPTIONS.find(c => c.value === selection.category) || {
    icon: '📦',
    label: selection.category,
  };
  const orderStatusInfo = ORDER_STATUS_OPTIONS.find(s => s.value === selection.order_status) || ORDER_STATUS_OPTIONS[0];
  const approvalStatusInfo = APPROVAL_STATUS_OPTIONS.find(s => s.value === selection.approval_status) || APPROVAL_STATUS_OPTIONS[0];
  const variance = selection.allowance_amount - selection.actual_cost;

  const handleApprove = () => {
    updateMutation.mutate({
      id: selection.id,
      approval_status: 'approved',
      approved_at: new Date().toISOString(),
      approved_by: 'Current User',
    });
  };

  const handleReject = () => {
    updateMutation.mutate({
      id: selection.id,
      approval_status: 'rejected',
    });
  };

  const handleUpdateOrderStatus = (status: string) => {
    updateMutation.mutate({
      id: selection.id,
      order_status: status as Selection['order_status'],
      ordered_at: status === 'ordered' ? new Date().toISOString() : selection.ordered_at,
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              {selection.image_url && (
                <div className="w-16 h-16 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                  <img
                    src={selection.image_url}
                    alt={selection.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </div>
              )}
              <div>
                <SheetTitle className="text-left">{selection.name}</SheetTitle>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-sm text-muted-foreground">
                    {categoryInfo.icon} {categoryInfo.label}
                  </span>
                  {selection.room_area && (
                    <>
                      <span className="text-muted-foreground">•</span>
                      <span className="text-sm text-muted-foreground">
                        {selection.room_area}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => onEdit(selection)}>
              <Pencil className="h-4 w-4 mr-1" />
              Edit
            </Button>
          </div>

          {/* Status badges */}
          <div className="flex flex-wrap gap-2">
            <Badge
              variant="secondary"
              className={cn(approvalStatusInfo.color, approvalStatusInfo.bgColor)}
            >
              {approvalStatusInfo.label}
            </Badge>
            <Badge variant="outline" className={orderStatusInfo.color}>
              {orderStatusInfo.label}
            </Badge>
            {selection.job_name && (
              <Badge variant="outline">{selection.job_name}</Badge>
            )}
          </div>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* Description */}
          {selection.description && (
            <div>
              <h4 className="text-sm font-medium mb-2">Description</h4>
              <p className="text-sm text-muted-foreground">{selection.description}</p>
            </div>
          )}

          <Separator />

          {/* Financial Summary */}
          <div>
            <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Financial Summary
            </h4>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Allowance</p>
                <p className="text-lg font-semibold">{formatCurrency(selection.allowance_amount)}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Actual</p>
                <p className="text-lg font-semibold">{formatCurrency(selection.actual_cost)}</p>
              </div>
              <div className={cn(
                "rounded-lg p-3",
                variance >= 0 ? "bg-green-50" : "bg-red-50"
              )}>
                <p className="text-xs text-muted-foreground">Variance</p>
                <p className={cn(
                  "text-lg font-semibold",
                  variance >= 0 ? "text-green-600" : "text-red-600"
                )}>
                  {variance >= 0 ? '+' : ''}{formatCurrency(variance)}
                </p>
              </div>
            </div>
            {selection.cost_code_name && (
              <p className="text-xs text-muted-foreground mt-2">
                Cost Code: {selection.cost_code_name}
              </p>
            )}
          </div>

          <Separator />

          {/* Procurement */}
          <div>
            <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
              <Truck className="h-4 w-4" />
              Procurement
            </h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Vendor</span>
                <span className="text-sm font-medium">{selection.vendor_name || '—'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Lead Time</span>
                <span className="text-sm font-medium">
                  {selection.lead_time_days ? `${selection.lead_time_days} days` : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Expected Delivery</span>
                <span className="text-sm font-medium">
                  {formatDate(selection.expected_delivery)}
                </span>
              </div>
              {selection.po_number && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">PO Number</span>
                  <Badge variant="outline">{selection.po_number}</Badge>
                </div>
              )}

              {/* Order Status Actions */}
              <div className="pt-2">
                <p className="text-xs text-muted-foreground mb-2">Update Order Status</p>
                <div className="flex flex-wrap gap-2">
                  {ORDER_STATUS_OPTIONS.map((status) => (
                    <Button
                      key={status.value}
                      variant={selection.order_status === status.value ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleUpdateOrderStatus(status.value)}
                      disabled={updateMutation.isPending}
                    >
                      {status.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Dates */}
          <div>
            <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Timeline
            </h4>
            <div className="space-y-2">
              {selection.due_date && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Decision Due</span>
                  <span className="text-sm font-medium">{formatDate(selection.due_date)}</span>
                </div>
              )}
              {selection.ordered_at && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Ordered</span>
                  <span className="text-sm font-medium">{formatDate(selection.ordered_at)}</span>
                </div>
              )}
              {selection.approved_at && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Approved</span>
                  <span className="text-sm font-medium">
                    {formatDate(selection.approved_at)}
                    {selection.approved_by && ` by ${selection.approved_by}`}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* References */}
          {(selection.reference_url || selection.image_url) && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <ExternalLink className="h-4 w-4" />
                  References
                </h4>
                <div className="flex flex-wrap gap-2">
                  {selection.reference_url && (
                    <Button variant="outline" size="sm" asChild>
                      <a
                        href={selection.reference_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="h-4 w-4 mr-1" />
                        View Product
                      </a>
                    </Button>
                  )}
                  {selection.image_url && (
                    <Button variant="outline" size="sm" asChild>
                      <a
                        href={selection.image_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        View Full Image
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Notes */}
          {(selection.notes || selection.client_notes) && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Notes
                </h4>
                {selection.notes && (
                  <div className="mb-3">
                    <p className="text-xs text-muted-foreground mb-1">Internal Notes</p>
                    <p className="text-sm">{selection.notes}</p>
                  </div>
                )}
                {selection.client_notes && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Client Notes</p>
                    <p className="text-sm">{selection.client_notes}</p>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Approval Actions */}
          {selection.approval_status === 'pending' && (
            <>
              <Separator />
              <div className="flex gap-3">
                <Button
                  className="flex-1"
                  onClick={handleApprove}
                  disabled={updateMutation.isPending}
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Approve
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleReject}
                  disabled={updateMutation.isPending}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Reject
                </Button>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  useChangeOrder, 
  useUpdateChangeOrder, 
  useApproveChangeOrder,
  useRejectChangeOrder,
} from '@/hooks/useChangeOrders';
import { 
  formatCurrency, 
  formatDate, 
  coStatusConfig, 
  coTypeConfig,
  COStatus,
  COType,
  RequestedBy,
} from '@/types/financial';
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  FileEdit,
  Building2,
  User,
  Calendar,
  Pencil,
  Save,
  X,
  AlertTriangle,
  FileText,
  Timer,
  Download,
  Mail,
  MoreVertical,
  ArrowRight,
  Link2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { generateCOPdf } from '@/lib/coPdfGenerator';
import { SendCOEmailDialog } from './SendCOEmailDialog';
import { COToPODialog } from './COToPODialog';

interface CODetailPanelProps {
  coId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CODetailPanel({ coId, open, onOpenChange }: CODetailPanelProps) {
  const { data: co, isLoading } = useChangeOrder(coId || '');
  const updateCO = useUpdateChangeOrder();
  const approveCO = useApproveChangeOrder();
  const rejectCO = useRejectChangeOrder();
  
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    description: '',
    type: 'addition' as COType,
    requested_by: 'client' as RequestedBy,
    markup_percent: 10,
    days_impact: 0,
    pm_hours: 0,
    pm_hourly_rate: 75,
    notes: '',
  });
  const [rejectNotes, setRejectNotes] = useState('');
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [showPODialog, setShowPODialog] = useState(false);
  
  const startEditing = () => {
    if (!co) return;
    setEditForm({
      description: co.description || '',
      type: co.type,
      requested_by: co.requested_by || 'client',
      markup_percent: co.markup_percent,
      days_impact: co.days_impact || 0,
      pm_hours: co.pm_hours || 0,
      pm_hourly_rate: co.pm_hourly_rate || 75,
      notes: co.notes || '',
    });
    setIsEditing(true);
  };
  
  const cancelEditing = () => {
    setIsEditing(false);
  };
  
  const saveEdits = async () => {
    if (!co) return;
    await updateCO.mutateAsync({
      id: co.id,
      ...editForm,
    });
    setIsEditing(false);
  };
  
  // Validation: all line items must have cost codes
  const lineItemsWithCostCodes = co?.line_items?.filter(li => li.cost_code_id) || [];
  const allLineItemsHaveCostCodes = co?.line_items?.length ? co.line_items.every(li => li.cost_code_id) : false;
  
  const handleApprove = async () => {
    if (!co) return;
    if (!allLineItemsHaveCostCodes) {
      return; // Button should be disabled
    }
    await approveCO.mutateAsync({ id: co.id, approved_by: 'Current User' });
  };
  
  const handleReject = async () => {
    if (!co) return;
    await rejectCO.mutateAsync({ id: co.id, notes: rejectNotes });
    setShowRejectDialog(false);
    setRejectNotes('');
  };
  
  const getStatusIcon = (status: COStatus) => {
    switch (status) {
      case 'approved': return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'rejected': return <XCircle className="h-4 w-4 text-red-600" />;
      case 'pending': return <Clock className="h-4 w-4 text-amber-600" />;
      default: return <FileEdit className="h-4 w-4 text-gray-600" />;
    }
  };
  
  const getStatusBadge = (status: COStatus) => {
    const config = coStatusConfig[status];
    return (
      <Badge variant="outline" className={cn(config.color, config.bgColor, 'gap-1')}>
        {getStatusIcon(status)}
        {config.label}
      </Badge>
    );
  };
  
  const getTypeBadge = (type: COType) => {
    const config = coTypeConfig[type];
    return (
      <Badge variant="outline" className={config.color}>
        {config.label}
      </Badge>
    );
  };
  
  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          {isLoading ? (
            <div className="space-y-4 p-2">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-48 w-full" />
            </div>
          ) : co ? (
            <>
              {/* Header */}
              <DialogHeader className="pb-2">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <DialogTitle className="text-xl font-semibold">
                        {co.co_number}
                      </DialogTitle>
                      {getStatusBadge(co.status)}
                      {getTypeBadge(co.type)}
                    </div>
                    {isEditing ? (
                      <Input
                        value={editForm.description}
                        onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                        placeholder="Description"
                        className="h-8 text-sm"
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground">{co.description}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {isEditing ? (
                      <>
                        <Button variant="outline" size="sm" onClick={cancelEditing}>
                          <X className="h-4 w-4 mr-1" />
                          Cancel
                        </Button>
                        <Button size="sm" onClick={saveEdits} disabled={updateCO.isPending}>
                          <Save className="h-4 w-4 mr-1" />
                          Save
                        </Button>
                      </>
                    ) : (
                      <>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={startEditing}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => generateCOPdf(co)}>
                              <Download className="h-4 w-4 mr-2" />
                              Download PDF
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setShowEmailDialog(true)}>
                              <Mail className="h-4 w-4 mr-2" />
                              Email CO
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => setShowPODialog(true)}>
                              <ArrowRight className="h-4 w-4 mr-2" />
                              Create/Amend PO
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </>
                    )}
                  </div>
                </div>
              </DialogHeader>
              
              <ScrollArea className="flex-1 -mx-6 px-6">
                <div className="space-y-5 pb-4">
                  {/* Budgetary Notice */}
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-300">Budgetary Estimate</Badge>
                      <span className="text-xs text-blue-600">Actual costs invoiced against this CO as work progresses</span>
                    </div>
                  </div>
                  
                  {/* Financial Summary */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="rounded-lg border bg-card p-3">
                      <p className="text-xs text-muted-foreground mb-1">Subtotal</p>
                      <p className="text-lg font-bold">{formatCurrency(co.subtotal)}</p>
                    </div>
                    <div className="rounded-lg border bg-card p-3">
                      <p className="text-xs text-muted-foreground mb-1">Markup ({co.markup_percent}%)</p>
                      <p className="text-lg font-bold">{formatCurrency(co.markup_amount)}</p>
                    </div>
                    <div className={cn(
                      "rounded-lg border p-3",
                      co.total_amount >= 0 ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"
                    )}>
                      <p className="text-xs text-muted-foreground mb-1">Estimated Total (NTE)</p>
                      <p className={cn(
                        "text-lg font-bold",
                        co.total_amount >= 0 ? "text-green-700" : "text-red-700"
                      )}>
                        {co.total_amount >= 0 ? '+' : ''}{formatCurrency(co.total_amount)}
                      </p>
                    </div>
                    <div className={cn(
                      "rounded-lg border p-3",
                      (co.days_impact || 0) > 0 ? "bg-amber-50 border-amber-200" : 
                      (co.days_impact || 0) < 0 ? "bg-green-50 border-green-200" : "bg-card"
                    )}>
                      <p className="text-xs text-muted-foreground mb-1">Schedule Impact</p>
                      <p className={cn(
                        "text-lg font-bold",
                        (co.days_impact || 0) > 0 ? "text-amber-700" : 
                        (co.days_impact || 0) < 0 ? "text-green-700" : "text-muted-foreground"
                      )}>
                        {(co.days_impact || 0) > 0 ? '+' : ''}{co.days_impact || 0} days
                      </p>
                    </div>
                  </div>
                  
                  {/* PM Time & Schedule Impact - Always show, editable */}
                  <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
                    <div className="flex items-center gap-2">
                      <Timer className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs font-medium text-muted-foreground uppercase">PM Time & Schedule Impact</span>
                    </div>
                    {isEditing ? (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="space-y-1">
                          <Label className="text-xs">PM Hours</Label>
                          <Input
                            type="number"
                            value={editForm.pm_hours || ''}
                            onChange={(e) => setEditForm({ ...editForm, pm_hours: parseFloat(e.target.value) || 0 })}
                            className="h-8"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Hourly Rate ($)</Label>
                          <Input
                            type="number"
                            value={editForm.pm_hourly_rate || ''}
                            onChange={(e) => setEditForm({ ...editForm, pm_hourly_rate: parseFloat(e.target.value) || 0 })}
                            className="h-8"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Markup %</Label>
                          <Input
                            type="number"
                            value={editForm.markup_percent || ''}
                            onChange={(e) => setEditForm({ ...editForm, markup_percent: parseFloat(e.target.value) || 0 })}
                            className="h-8"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Schedule Impact (Days)</Label>
                          <Input
                            type="number"
                            value={editForm.days_impact || ''}
                            onChange={(e) => setEditForm({ ...editForm, days_impact: parseInt(e.target.value) || 0 })}
                            className="h-8"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">PM Hours</p>
                          <p className="font-semibold">{co.pm_hours || 0} hrs</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">PM Rate</p>
                          <p className="font-semibold">{formatCurrency(co.pm_hourly_rate || 0)}/hr</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">PM Cost</p>
                          <p className="font-semibold">{formatCurrency(co.pm_cost || 0)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Markup</p>
                          <p className="font-semibold">{co.markup_percent || 0}%</p>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Job & PO Info */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs font-medium text-muted-foreground uppercase">Job</span>
                      </div>
                      <p className="font-semibold">{co.job_name || '—'}</p>
                    </div>
                    <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs font-medium text-muted-foreground uppercase">Purchase Order</span>
                      </div>
                      <p className="font-semibold">{co.po_number || 'Not linked'}</p>
                    </div>
                  </div>
                  
                  {/* Metadata */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Requested By</p>
                        <p className="text-sm font-medium capitalize">{co.requested_by || '—'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Created</p>
                        <p className="text-sm font-medium">{formatDate(co.created_at)}</p>
                      </div>
                    </div>
                    {co.approved_at && (
                      <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <div>
                          <p className="text-xs text-muted-foreground">Approved</p>
                          <p className="text-sm font-medium">{formatDate(co.approved_at)}</p>
                        </div>
                      </div>
                    )}
                    {co.client_signature_required && (
                      <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                        <AlertTriangle className={cn(
                          "h-4 w-4",
                          co.client_signed_at ? "text-green-600" : "text-amber-600"
                        )} />
                        <div>
                          <p className="text-xs text-muted-foreground">Client Signature</p>
                          <p className="text-sm font-medium">
                            {co.client_signed_at ? formatDate(co.client_signed_at) : 'Required'}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Terms Notice for pending signature */}
                  {co.client_signature_required && !co.client_signed_at && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm">
                      <p className="font-medium text-amber-800 mb-2">Client Acceptance Terms</p>
                      <ul className="text-amber-700 space-y-1 text-xs list-disc list-inside">
                        <li>This budgetary change order represents an estimated cost based on anticipated expenses.</li>
                        <li>Invoices will be processed against this change order as work is completed.</li>
                        <li>Final invoiced amounts will not exceed the estimated total without additional written approval.</li>
                        <li>By signing, client accepts all terms, conditions, schedule impacts, and authorizes the work to proceed.</li>
                      </ul>
                    </div>
                  )}
                  
                  <Separator />
                  
                  {/* Line Items */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold">Line Items</h3>
                      {!allLineItemsHaveCostCodes && (
                        <Badge variant="outline" className="text-xs border-amber-500 text-amber-600 gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Cost codes required
                        </Badge>
                      )}
                    </div>
                    <div className="border rounded-lg divide-y">
                      {co.line_items && co.line_items.length > 0 ? (
                        co.line_items.map((item, idx) => (
                          <div key={item.id} className="p-3 space-y-1">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <span className="text-sm text-muted-foreground w-6">{idx + 1}.</span>
                                {item.cost_code ? (
                                  <Badge variant="secondary" className="text-xs font-mono">
                                    {item.cost_code}
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-xs border-amber-500 text-amber-600">
                                    No cost code
                                  </Badge>
                                )}
                                <span className="text-sm font-medium">{item.cost_code_name || ''}</span>
                              </div>
                              <span className={cn(
                                "font-medium",
                                item.amount >= 0 ? "text-green-600" : "text-red-600"
                              )}>
                                {item.amount >= 0 ? '+' : ''}{formatCurrency(item.amount)}
                              </span>
                            </div>
                            {item.description && (
                              <p className="text-sm text-muted-foreground pl-9">{item.description}</p>
                            )}
                          </div>
                        ))
                      ) : (
                        <div className="p-4 text-center text-muted-foreground text-sm">
                          No line items
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Notes */}
                  {(co.notes || isEditing) && (
                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold">Notes</h3>
                      {isEditing ? (
                        <Textarea
                          value={editForm.notes}
                          onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                          rows={3}
                        />
                      ) : (
                        <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
                          {co.notes}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </ScrollArea>
              
              {/* Action Buttons */}
              {(co.status === 'draft' || co.status === 'pending') && (
                <DialogFooter className="gap-2 pt-4 border-t">
                  {co.status === 'draft' && (
                    <Button 
                      variant="outline" 
                      onClick={async () => {
                        await updateCO.mutateAsync({ id: co.id, status: 'pending' });
                      }}
                      disabled={updateCO.isPending}
                    >
                      Submit for Approval
                    </Button>
                  )}
                  {co.status === 'pending' && (
                    <>
                      <Button 
                        variant="outline" 
                        className="text-red-600"
                        onClick={() => setShowRejectDialog(true)}
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Reject
                      </Button>
                      <Button 
                        onClick={handleApprove}
                        disabled={approveCO.isPending || !allLineItemsHaveCostCodes}
                        title={!allLineItemsHaveCostCodes ? 'All line items must have cost codes assigned' : ''}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        Approve
                      </Button>
                    </>
                  )}
                </DialogFooter>
              )}
            </>
          ) : (
            <div className="p-8 text-center text-muted-foreground">
              Change order not found
            </div>
          )}
        </DialogContent>
      </Dialog>
      
      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Change Order</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Rejection Reason</Label>
              <Textarea
                value={rejectNotes}
                onChange={(e) => setRejectNotes(e.target.value)}
                placeholder="Explain why this change order is being rejected..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={rejectCO.isPending}>
              Reject Change Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Email CO Dialog */}
      {co && (
        <SendCOEmailDialog
          open={showEmailDialog}
          onOpenChange={setShowEmailDialog}
          co={co}
        />
      )}
      
      {/* CO to PO Dialog */}
      {co && (
        <COToPODialog
          open={showPODialog}
          onOpenChange={setShowPODialog}
          co={co}
        />
      )}
    </>
  );
}

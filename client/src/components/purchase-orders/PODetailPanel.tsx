import { useState, useRef, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { usePurchaseOrder, usePOAttachments, useUploadPOAttachment, useDeletePOAttachment, useUpdatePurchaseOrder, useVendors, useDBJobs } from '@/hooks/useFinancialData';
import { formatCurrency, formatDate, poStatusConfig, invoiceStatusConfig, POStatus, ApprovalStatus } from '@/types/financial';
import { 
  Phone, 
  Building2, 
  User, 
  Upload, 
  FileText, 
  Trash2, 
  Download, 
  Mail,
  Receipt,
  TrendingUp,
  Calendar,
  MapPin,
  UserCheck,
  Clock,
  CheckCircle2,
  AlertCircle,
  Pencil,
  Save,
  X,
} from 'lucide-react';
import { InvoiceDetailDialog } from '@/components/invoices/InvoiceDetailDialog';
import { generatePOPdf } from '@/lib/poPdfGenerator';
import { SendPOEmailDialog } from './SendPOEmailDialog';
import { POFormDialog } from './POFormDialog';
import { POLineItemsEditor } from './POLineItemsEditor';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { buildCompanyInfo } from '@/lib/companyInfo';

interface PODetailPanelProps {
  poId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PODetailPanel({ poId, open, onOpenChange }: PODetailPanelProps) {
  const { data: po, isLoading } = usePurchaseOrder(poId || '');
  const { data: attachments = [] } = usePOAttachments(poId || '');
  const { data: vendors = [] } = useVendors();
  const { data: jobs = [] } = useDBJobs();
  const uploadAttachment = useUploadPOAttachment();
  const deleteAttachment = useDeletePOAttachment();
  const updatePO = useUpdatePurchaseOrder();
  const { builder } = useAuth();
  const companyInfo = buildCompanyInfo(builder);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [editFormDialogOpen, setEditFormDialogOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  // Edit form state
  const [editForm, setEditForm] = useState({
    description: '',
    scope_of_work: '',
    status: 'open' as POStatus,
    approval_status: 'pending' as ApprovalStatus,
    vendor_id: '',
    job_id: '',
  });

  const startEditing = () => {
    if (!po) return;
    setEditForm({
      description: po.description || '',
      scope_of_work: po.scope_of_work || '',
      status: po.status,
      approval_status: po.approval_status,
      vendor_id: po.vendor_id,
      job_id: po.job_id,
    });
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
  };

  const saveEdits = async () => {
    if (!po) return;
    await updatePO.mutateAsync({
      id: po.id,
      ...editForm,
    });
    setIsEditing(false);
  };

  // Calculate financials
  const totalAmount = po?.current_amount || po?.original_amount || 0;
  const invoicedAmount = po?.invoiced_amount || 0;
  const remainingAmount = totalAmount - invoicedAmount;
  const changeOrderAmount = po?.change_order_amount || 0;
  const originalAmount = po?.original_amount || 0;
  
  // Percentages for progress bars
  const invoicedPercent = totalAmount > 0 ? (invoicedAmount / totalAmount) * 100 : 0;

  const getStatusBadge = (status: string, approvalStatus: string) => {
    if (approvalStatus === 'pending') {
      return <Badge className="bg-amber-100 text-amber-700 border-amber-200">Pending Approval</Badge>;
    }
    if (approvalStatus === 'rejected') {
      return <Badge variant="destructive">Rejected</Badge>;
    }
    const config = poStatusConfig[status as keyof typeof poStatusConfig];
    if (!config) return <Badge variant="secondary">{status}</Badge>;
    return (
      <Badge variant="outline" className={`${config.color} ${config.bgColor}`}>
        {config.label}
      </Badge>
    );
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || !poId) return;
    for (const file of Array.from(files)) {
      await uploadAttachment.mutateAsync({ poId, file });
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileUpload(e.dataTransfer.files);
  }, [poId]);

  const handleDeleteAttachment = async (id: string, fileUrl: string) => {
    if (!poId) return;
    await deleteAttachment.mutateAsync({ id, poId, fileUrl });
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          {isLoading ? (
            <div className="space-y-4 p-2">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-48 w-full" />
            </div>
          ) : po ? (
            <>
              {/* Header */}
              <DialogHeader className="pb-2">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <DialogTitle className="text-xl font-semibold">
                        {po.po_number}
                      </DialogTitle>
                      {isEditing ? (
                        <Select
                          value={editForm.status}
                          onValueChange={(v) => setEditForm({ ...editForm, status: v as POStatus })}
                        >
                          <SelectTrigger className="w-32 h-7">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="open">Open</SelectItem>
                            <SelectItem value="closed">Closed</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        getStatusBadge(po.status, po.approval_status)
                      )}
                    </div>
                    {isEditing ? (
                      <Input
                        value={editForm.description}
                        onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                        placeholder="Description"
                        className="h-8 text-sm"
                      />
                    ) : po.description ? (
                      <p className="text-sm font-medium text-foreground">{po.description}</p>
                    ) : null}
                  </div>
                  <div className="flex gap-2">
                    {isEditing ? (
                      <>
                        <Button variant="outline" size="sm" className="gap-2" onClick={cancelEditing}>
                          <X className="h-4 w-4" />
                          Cancel
                        </Button>
                        <Button size="sm" className="gap-2" onClick={saveEdits} disabled={updatePO.isPending}>
                          <Save className="h-4 w-4" />
                          Save
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button variant="outline" size="sm" className="gap-2" onClick={() => setEditFormDialogOpen(true)}>
                          <Pencil className="h-4 w-4" />
                          Edit
                        </Button>
                        <Button variant="outline" size="sm" className="gap-2" onClick={() => setEmailDialogOpen(true)}>
                          <Mail className="h-4 w-4" />
                          Email
                        </Button>
                        <Button variant="outline" size="sm" className="gap-2" onClick={() => generatePOPdf(po, companyInfo)}>
                          <Download className="h-4 w-4" />
                          PDF
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </DialogHeader>

              <ScrollArea className="flex-1 -mx-6 px-6">
                <div className="space-y-5 pb-4">
                  {/* Financial Summary Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="rounded-lg border bg-card p-3">
                      <p className="text-xs text-muted-foreground mb-1">Total Amount</p>
                      <p className="text-lg font-bold">{formatCurrency(totalAmount)}</p>
                      {changeOrderAmount !== 0 && (
                        <p className="text-xs text-muted-foreground">Orig: {formatCurrency(originalAmount)}</p>
                      )}
                    </div>
                    <div className="rounded-lg border bg-card p-3">
                      <p className="text-xs text-muted-foreground mb-1">Invoiced</p>
                      <p className="text-lg font-bold text-blue-600">{formatCurrency(invoicedAmount)}</p>
                      <Progress value={invoicedPercent} className="h-1.5 mt-1" />
                    </div>
                    <div className={cn(
                      "rounded-lg border p-3",
                      remainingAmount > 0 ? "bg-amber-50 border-amber-200" : "bg-green-50 border-green-200"
                    )}>
                      <p className="text-xs text-muted-foreground mb-1">Remaining</p>
                      <p className={cn(
                        "text-lg font-bold",
                        remainingAmount > 0 ? "text-amber-700" : "text-green-700"
                      )}>
                        {formatCurrency(remainingAmount)}
                      </p>
                    </div>
                    <div className="rounded-lg border bg-card p-3">
                      <p className="text-xs text-muted-foreground mb-1">Change Orders</p>
                      <p className={cn(
                        "text-lg font-bold",
                        changeOrderAmount === 0 ? "text-muted-foreground" : changeOrderAmount > 0 ? "text-green-600" : "text-red-600"
                      )}>
                        {changeOrderAmount >= 0 ? '+' : ''}{formatCurrency(changeOrderAmount)}
                      </p>
                    </div>
                  </div>

                  {/* Vendor & Job Info */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Vendor Card */}
                    <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs font-medium text-muted-foreground uppercase">Vendor</span>
                      </div>
                      {isEditing ? (
                        <Select
                          value={editForm.vendor_id}
                          onValueChange={(v) => setEditForm({ ...editForm, vendor_id: v })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select vendor..." />
                          </SelectTrigger>
                          <SelectContent>
                            {vendors.map((v) => (
                              <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="space-y-2">
                          <p className="font-semibold">{po.vendor_name || '—'}</p>
                          {po.vendor_contact && (
                            <p className="text-sm text-muted-foreground flex items-center gap-2">
                              <UserCheck className="h-3.5 w-3.5" />
                              {po.vendor_contact}
                            </p>
                          )}
                          {po.vendor_phone && (
                            <p className="text-sm text-muted-foreground flex items-center gap-2">
                              <Phone className="h-3.5 w-3.5" />
                              {po.vendor_phone}
                            </p>
                          )}
                          {po.vendor_email && (
                            <p className="text-sm text-muted-foreground flex items-center gap-2">
                              <Mail className="h-3.5 w-3.5" />
                              {po.vendor_email}
                            </p>
                          )}
                          {po.vendor_address && (
                            <p className="text-sm text-muted-foreground flex items-start gap-2">
                              <MapPin className="h-3.5 w-3.5 mt-0.5" />
                              <span>{po.vendor_address}</span>
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Job Card */}
                    <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs font-medium text-muted-foreground uppercase">Job</span>
                      </div>
                      {isEditing ? (
                        <Select
                          value={editForm.job_id}
                          onValueChange={(v) => setEditForm({ ...editForm, job_id: v })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select job..." />
                          </SelectTrigger>
                          <SelectContent>
                            {jobs.map((j) => (
                              <SelectItem key={j.id} value={j.id}>{j.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="space-y-2">
                          <p className="font-semibold">{po.job_name || '—'}</p>
                          {po.job_client && (
                            <p className="text-sm text-muted-foreground flex items-center gap-2">
                              <User className="h-3.5 w-3.5" />
                              {po.job_client}
                            </p>
                          )}
                          {po.job_address && (
                            <p className="text-sm text-muted-foreground flex items-start gap-2">
                              <MapPin className="h-3.5 w-3.5 mt-0.5" />
                              <span>{po.job_address}</span>
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Dates & Approval Info */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Created</p>
                        <p className="text-sm font-medium">{formatDate(po.created_at)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Updated</p>
                        <p className="text-sm font-medium">{formatDate(po.updated_at)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                      {po.approval_status === 'approved' ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      ) : po.approval_status === 'rejected' ? (
                        <AlertCircle className="h-4 w-4 text-red-600" />
                      ) : (
                        <Clock className="h-4 w-4 text-amber-600" />
                      )}
                      <div>
                        <p className="text-xs text-muted-foreground">Approved</p>
                        <p className="text-sm font-medium">{po.approved_at ? formatDate(po.approved_at) : 'Pending'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                      <UserCheck className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Approved By</p>
                        <p className="text-sm font-medium">{po.approved_by || '—'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Scope of Work */}
                  {(po.scope_of_work || isEditing) && (
                    <div className="rounded-lg border bg-card p-4">
                      <p className="text-xs font-medium text-muted-foreground uppercase mb-2">Scope of Work</p>
                      {isEditing ? (
                        <Textarea
                          value={editForm.scope_of_work}
                          onChange={(e) => setEditForm({ ...editForm, scope_of_work: e.target.value })}
                          placeholder="Describe the scope of work..."
                          className="min-h-[100px]"
                        />
                      ) : (
                        <p className="text-sm whitespace-pre-wrap">{po.scope_of_work}</p>
                      )}
                    </div>
                  )}

                  <Separator />

                  {/* Tabs Content */}
                  <Tabs defaultValue="items" className="flex-1">
                    <TabsList className="w-fit">
                      <TabsTrigger value="items">
                        Items ({po.line_items?.length || 0})
                      </TabsTrigger>
                      <TabsTrigger value="invoices">
                        Invoices ({po.invoices?.length || 0})
                      </TabsTrigger>
                      <TabsTrigger value="cos">
                        Change Orders ({po.change_orders?.length || 0})
                      </TabsTrigger>
                      <TabsTrigger value="files">
                        Files ({attachments.length})
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="items" className="mt-4 space-y-2">
                      {(po.line_items && po.line_items.length > 0) || isEditing ? (
                        <POLineItemsEditor 
                          poId={po.id} 
                          lineItems={po.line_items || []} 
                          isEditing={isEditing}
                        />
                      ) : (
                        <div className="text-center py-12 text-muted-foreground">
                          <FileText className="h-10 w-10 mx-auto mb-3 opacity-50" />
                          <p>No line items</p>
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="invoices" className="mt-4 space-y-2">
                      {po.invoices && po.invoices.length > 0 ? (
                        <div className="space-y-2">
                          {po.invoices.map((inv) => {
                            const statusConfig = invoiceStatusConfig[inv.status as keyof typeof invoiceStatusConfig];
                            return (
                              <div 
                                key={inv.id} 
                                className="flex items-center justify-between p-4 rounded-lg border bg-card cursor-pointer hover:bg-muted/50 transition-colors"
                                onClick={() => {
                                  setSelectedInvoiceId(inv.id);
                                  setInvoiceDialogOpen(true);
                                }}
                              >
                                <div>
                                  <p className="font-medium">{inv.invoice_number}</p>
                                  <p className="text-sm text-muted-foreground">{formatDate(inv.invoice_date)}</p>
                                </div>
                                <div className="flex items-center gap-3">
                                  <Badge variant="outline" className={`${statusConfig?.color} ${statusConfig?.bgColor}`}>
                                    {statusConfig?.label || inv.status}
                                  </Badge>
                                  <span className="font-semibold">{formatCurrency(inv.amount)}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-center py-12 text-muted-foreground">
                          <Receipt className="h-10 w-10 mx-auto mb-3 opacity-50" />
                          <p>No invoices linked</p>
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="cos" className="mt-4 space-y-2">
                      {po.change_orders && po.change_orders.length > 0 ? (
                        <div className="space-y-2">
                          {po.change_orders.map((co) => (
                            <div key={co.id} className="flex items-center justify-between p-4 rounded-lg border bg-card">
                              <div>
                                <p className="font-medium">{co.co_number}</p>
                                <p className="text-sm text-muted-foreground line-clamp-1">{co.description}</p>
                              </div>
                              <div className="flex items-center gap-3">
                                <Badge variant="outline">{co.status}</Badge>
                                <span className={cn(
                                  "font-semibold",
                                  co.total_amount >= 0 ? "text-green-600" : "text-red-600"
                                )}>
                                  {co.total_amount >= 0 ? '+' : ''}{formatCurrency(co.total_amount)}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-12 text-muted-foreground">
                          <TrendingUp className="h-10 w-10 mx-auto mb-3 opacity-50" />
                          <p>No change orders</p>
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="files" className="mt-4 space-y-4">
                      {/* Drop Zone */}
                      <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className={cn(
                          "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
                          isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
                        )}
                      >
                        <input
                          ref={fileInputRef}
                          type="file"
                          multiple
                          className="hidden"
                          onChange={(e) => handleFileUpload(e.target.files)}
                        />
                        <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                        <p className="text-sm font-medium">Drop files here or click to upload</p>
                        <p className="text-xs text-muted-foreground mt-1">PDFs, images, documents</p>
                      </div>

                      {/* Attachments List */}
                      {attachments.length > 0 ? (
                        <div className="space-y-2">
                          {attachments.map((att) => (
                            <div key={att.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                              <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <a 
                                  href={att.file_url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-sm font-medium truncate block hover:text-primary"
                                >
                                  {att.file_name}
                                </a>
                                <p className="text-xs text-muted-foreground">
                                  {formatFileSize(att.file_size)} • {formatDate(att.created_at)}
                                </p>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleDeleteAttachment(att.id, att.file_url)}
                              >
                                <Trash2 className="h-4 w-4 text-muted-foreground" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-6 text-muted-foreground">
                          <p className="text-sm">No files attached yet</p>
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                </div>
              </ScrollArea>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Invoice Detail Dialog */}
      <InvoiceDetailDialog
        invoiceId={selectedInvoiceId}
        open={invoiceDialogOpen}
        onOpenChange={setInvoiceDialogOpen}
      />

      {/* PO Edit Form Dialog */}
      {po && (
        <POFormDialog
          open={editFormDialogOpen}
          onOpenChange={setEditFormDialogOpen}
          po={po}
        />
      )}

      {/* Send PO Email Dialog */}
      {po && (
        <SendPOEmailDialog
          open={emailDialogOpen}
          onOpenChange={setEmailDialogOpen}
          poData={{
            id: po.id,
            po_number: po.po_number,
            title: po.description || '',
            total_amount: totalAmount,
            scope_of_work: po.scope_of_work,
            created_at: po.created_at,
            release_date: po.approved_at,
            status: po.status,
            approved_at: po.approved_at,
            approved_by: po.approved_by,
            vendor: {
              name: po.vendor_name || '',
              email: po.vendor_email,
              address: po.vendor_address,
              phone: po.vendor_phone,
            },
            job: {
              name: po.job_name || '',
              address: po.job_address,
            },
            line_items: (po.line_items || []).map(item => ({
              cost_code: item.cost_code,
              description: item.description,
              quantity: 1,
              unit_price: item.amount,
              total_price: item.amount,
            })),
          }}
        />
      )}
    </>
  );
}

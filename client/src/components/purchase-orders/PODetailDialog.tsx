import { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { usePurchaseOrder, usePOAttachments, useUploadPOAttachment, useDeletePOAttachment } from '@/hooks/useFinancialData';
import { 
  formatCurrency, 
  formatDate, 
  poStatusConfig, 
  invoiceStatusConfig,
  coStatusConfig,
} from '@/types/financial';
import { Phone, User, Upload, FileText, Trash2, ExternalLink, Loader2, Paperclip, Download, Mail } from 'lucide-react';
import { InvoiceDetailDialog } from '@/components/invoices/InvoiceDetailDialog';
import { generatePOPdf } from '@/lib/poPdfGenerator';
import { SendPOEmailDialog } from './SendPOEmailDialog';

interface PODetailDialogProps {
  poId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PODetailDialog({ poId, open, onOpenChange }: PODetailDialogProps) {
  const { data: po, isLoading } = usePurchaseOrder(poId || '');
  const { data: attachments = [], isLoading: attachmentsLoading } = usePOAttachments(poId || '');
  const uploadAttachment = useUploadPOAttachment();
  const deleteAttachment = useDeletePOAttachment();
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);

  const getStatusBadge = (status: string, approvalStatus: string) => {
    if (approvalStatus === 'pending') {
      return <Badge variant="destructive">Pending Approval</Badge>;
    }
    if (approvalStatus === 'rejected') {
      return <Badge variant="outline" className="text-red-600">Rejected</Badge>;
    }
    const config = poStatusConfig[status as keyof typeof poStatusConfig];
    if (!config) return <Badge variant="secondary">{status}</Badge>;
    return (
      <Badge variant="outline" className={`${config.color} ${config.bgColor}`}>
        {config.label}
      </Badge>
    );
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !poId) return;
    
    await uploadAttachment.mutateAsync({ poId, file });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDeleteAttachment = async (id: string, fileUrl: string) => {
    if (!poId) return;
    await deleteAttachment.mutateAsync({ id, poId, fileUrl });
  };

  const handleInvoiceClick = (invoiceId: string) => {
    setSelectedInvoiceId(invoiceId);
    setInvoiceDialogOpen(true);
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Calculate totals
  const totalPrice = po?.current_amount || po?.original_amount || 0;
  const totalPaid = po?.invoiced_amount || 0;
  const remainingBalance = totalPrice - totalPaid;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : po ? (
            <div className="bg-white">
              {/* Company Header */}
              <div className="p-6 border-b">
                <div className="flex justify-between items-start">
                  <div>
                    <h1 className="text-2xl font-bold text-foreground">ROSS BUILT</h1>
                    <p className="text-sm text-muted-foreground">CUSTOM HOMES</p>
                  </div>
                  <div className="text-right text-sm text-muted-foreground">
                    <p>Printed: {formatDate(new Date().toISOString())}</p>
                    <p>305 67th Street West, Bradenton, FL 34209</p>
                    <p>Phone: (941) 778-7600</p>
                  </div>
                </div>
              </div>

              {/* PO Title and Status */}
              <DialogHeader className="px-6 pt-4 pb-2">
                <div className="flex items-center justify-between">
                  <DialogTitle className="text-xl font-semibold">Purchase Order</DialogTitle>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setEmailDialogOpen(true)}
                      className="gap-1.5"
                    >
                      <Mail className="h-4 w-4" />
                      Send Email
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => generatePOPdf(po)}
                      className="gap-1.5"
                    >
                      <Download className="h-4 w-4" />
                      Export PDF
                    </Button>
                    {getStatusBadge(po.status, po.approval_status)}
                  </div>
                </div>
              </DialogHeader>

              {/* PO Info Row */}
              <div className="px-6 pb-4">
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground font-medium">Date Created</p>
                    <p className="font-semibold">{formatDate(po.created_at)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground font-medium">Date Released</p>
                    <p className="font-semibold">{po.approved_at ? formatDate(po.approved_at) : '—'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground font-medium">Purchase Order #</p>
                    <p className="font-semibold">{po.po_number}</p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Vendor and Job Info */}
              <div className="px-6 py-4 grid grid-cols-2 gap-8">
                {/* Vendor */}
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">SUB/VENDOR</p>
                  <p className="font-semibold text-foreground">{po.vendor_name || '—'}</p>
                  {po.vendor_address && (
                    <p className="text-sm text-muted-foreground whitespace-pre-line">{po.vendor_address}</p>
                  )}
                  {po.vendor_phone && (
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Phone className="h-3.5 w-3.5" />
                      <span>{po.vendor_phone}</span>
                    </div>
                  )}
                </div>

                {/* Job */}
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Job</p>
                  <p className="font-semibold text-foreground">{po.job_name || '—'}</p>
                  {po.job_address && (
                    <p className="text-sm text-muted-foreground whitespace-pre-line">{po.job_address}</p>
                  )}
                </div>
              </div>

              <Separator />

              {/* PO Title / Description Row */}
              <div className="px-6 py-4">
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="font-semibold">PO Title</TableHead>
                        <TableHead className="font-semibold">Scheduled Completion</TableHead>
                        <TableHead className="text-right font-semibold">Total Price</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell className="font-medium">{po.description || '—'}</TableCell>
                        <TableCell>—</TableCell>
                        <TableCell className="text-right font-bold text-lg">{formatCurrency(totalPrice)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Scope of Work */}
              {po.scope_of_work && (
                <div className="px-6 pb-4">
                  <div className="border rounded-lg overflow-hidden">
                    <div className="bg-muted/50 px-4 py-2 border-b">
                      <p className="font-semibold text-sm">Scope of Work</p>
                    </div>
                    <div className="p-4">
                      <p className="text-sm whitespace-pre-wrap">{po.scope_of_work}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Tabs for Line Items, Invoices, Change Orders, Attachments */}
              <div className="px-6 pb-6">
                <Tabs defaultValue="line-items" className="w-full">
                  <TabsList className="mb-4">
                    <TabsTrigger value="line-items">
                      Line Items ({po.line_items?.length || 0})
                    </TabsTrigger>
                    <TabsTrigger value="invoices">
                      Invoices ({po.invoices?.length || 0})
                    </TabsTrigger>
                    <TabsTrigger value="change-orders">
                      Change Orders ({po.change_orders?.length || 0})
                    </TabsTrigger>
                    <TabsTrigger value="attachments">
                      <Paperclip className="h-4 w-4 mr-1" />
                      Files ({attachments.length})
                    </TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="line-items" className="mt-0">
                    {po.line_items && po.line_items.length > 0 ? (
                      <div className="border rounded-lg overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/50">
                              <TableHead className="font-semibold">Items</TableHead>
                              <TableHead className="font-semibold">Cost Code</TableHead>
                              <TableHead className="font-semibold">Description</TableHead>
                              <TableHead className="text-right font-semibold">Qty/Unit</TableHead>
                              <TableHead className="text-right font-semibold">Unit Cost</TableHead>
                              <TableHead className="text-right font-semibold">Price</TableHead>
                              <TableHead className="text-right font-semibold">Paid</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {po.line_items.map((item) => (
                              <TableRow key={item.id}>
                                <TableCell className="font-medium">
                                  {item.cost_code_name || item.description}
                                  {item.cost_code && (
                                    <p className="text-xs text-muted-foreground">{item.cost_code}-{item.cost_code_name}</p>
                                  )}
                                </TableCell>
                                <TableCell className="font-mono text-sm text-muted-foreground">
                                  {item.cost_code || '—'}
                                </TableCell>
                                <TableCell className="text-sm">{item.description}</TableCell>
                                <TableCell className="text-right">1.00</TableCell>
                                <TableCell className="text-right">{formatCurrency(item.amount)}</TableCell>
                                <TableCell className="text-right font-medium">{formatCurrency(item.amount)}</TableCell>
                                <TableCell className="text-right">
                                  {item.invoiced_amount ? formatCurrency(item.invoiced_amount) : '—'}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                          <TableFooter>
                            <TableRow>
                              <TableCell colSpan={5} className="text-right font-semibold">Total</TableCell>
                              <TableCell className="text-right font-bold">{formatCurrency(totalPrice)}</TableCell>
                              <TableCell className="text-right font-bold">{formatCurrency(totalPaid)}</TableCell>
                            </TableRow>
                          </TableFooter>
                        </Table>
                      </div>
                    ) : (
                      <div className="border rounded-lg p-8 text-center text-muted-foreground">
                        No line items
                      </div>
                    )}

                    {/* Remaining Balance */}
                    <div className="flex justify-end mt-4">
                      <div className="bg-muted/50 rounded-lg px-6 py-3">
                        <span className="font-semibold text-lg">Remaining Balance: </span>
                        <span className="font-bold text-lg text-foreground">{formatCurrency(remainingBalance)}</span>
                      </div>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="invoices" className="mt-0">
                    {po.invoices && po.invoices.length > 0 ? (
                      <div className="border rounded-lg overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/50">
                              <TableHead className="font-semibold">Invoice #</TableHead>
                              <TableHead className="font-semibold">Date</TableHead>
                              <TableHead className="text-right font-semibold">Amount</TableHead>
                              <TableHead className="font-semibold">Status</TableHead>
                              <TableHead className="w-[100px]"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {po.invoices.map((inv) => {
                              const statusConfig = invoiceStatusConfig[inv.status as keyof typeof invoiceStatusConfig];
                              return (
                                <TableRow 
                                  key={inv.id} 
                                  className="cursor-pointer hover:bg-muted/50"
                                  onClick={() => handleInvoiceClick(inv.id)}
                                >
                                  <TableCell className="font-mono font-medium">{inv.invoice_number}</TableCell>
                                  <TableCell>{formatDate(inv.invoice_date)}</TableCell>
                                  <TableCell className="text-right font-medium">{formatCurrency(inv.amount)}</TableCell>
                                  <TableCell>
                                    <Badge variant="outline" className={`${statusConfig?.color} ${statusConfig?.bgColor}`}>
                                      {statusConfig?.label || inv.status}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    <Button variant="ghost" size="sm">
                                      <ExternalLink className="h-4 w-4" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      <div className="border rounded-lg p-8 text-center text-muted-foreground">
                        No invoices linked to this PO
                      </div>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="change-orders" className="mt-0">
                    {po.change_orders && po.change_orders.length > 0 ? (
                      <div className="border rounded-lg overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/50">
                              <TableHead className="font-semibold">CO #</TableHead>
                              <TableHead className="font-semibold">Description</TableHead>
                              <TableHead className="text-right font-semibold">Amount</TableHead>
                              <TableHead className="font-semibold">Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {po.change_orders.map((co) => {
                              const statusConfig = coStatusConfig[co.status as keyof typeof coStatusConfig];
                              return (
                                <TableRow key={co.id}>
                                  <TableCell className="font-mono font-medium">{co.co_number}</TableCell>
                                  <TableCell>{co.description}</TableCell>
                                  <TableCell className="text-right font-medium">{formatCurrency(co.total_amount || 0)}</TableCell>
                                  <TableCell>
                                    <Badge variant="outline" className={`${statusConfig?.color} ${statusConfig?.bgColor}`}>
                                      {statusConfig?.label || co.status}
                                    </Badge>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      <div className="border rounded-lg p-8 text-center text-muted-foreground">
                        No change orders for this PO
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="attachments" className="mt-0">
                    {/* Upload Button */}
                    <div className="mb-4">
                      <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        onChange={handleFileUpload}
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                      />
                      <Button 
                        variant="outline" 
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadAttachment.isPending}
                      >
                        {uploadAttachment.isPending ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Upload className="h-4 w-4 mr-2" />
                        )}
                        Upload File
                      </Button>
                    </div>

                    {attachmentsLoading ? (
                      <div className="space-y-2">
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                      </div>
                    ) : attachments.length > 0 ? (
                      <div className="border rounded-lg overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/50">
                              <TableHead className="font-semibold">File Name</TableHead>
                              <TableHead className="font-semibold">Type</TableHead>
                              <TableHead className="font-semibold">Size</TableHead>
                              <TableHead className="font-semibold">Uploaded</TableHead>
                              <TableHead className="w-[100px]"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {attachments.map((attachment) => (
                              <TableRow key={attachment.id}>
                                <TableCell className="font-medium">
                                  <div className="flex items-center gap-2">
                                    <FileText className="h-4 w-4 text-muted-foreground" />
                                    {attachment.file_name}
                                  </div>
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  {attachment.file_type?.split('/')[1]?.toUpperCase() || '—'}
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  {formatFileSize(attachment.file_size)}
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  {formatDate(attachment.created_at)}
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      asChild
                                    >
                                      <a href={attachment.file_url} target="_blank" rel="noopener noreferrer">
                                        <ExternalLink className="h-4 w-4" />
                                      </a>
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleDeleteAttachment(attachment.id, attachment.file_url)}
                                      disabled={deleteAttachment.isPending}
                                    >
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      <div className="border rounded-lg p-8 text-center text-muted-foreground">
                        <Paperclip className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>No files attached</p>
                        <p className="text-sm">Upload quotes, contracts, or other documents</p>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </div>

              {/* Approval Signature Section */}
              <Separator />
              <div className="px-6 py-4 bg-muted/30">
                <p className="text-xs text-muted-foreground italic">
                  A signature of Approval or Electronic Acceptance is required before purchase order is effective. 
                  This purchase order then becomes part of the existing contract and is binding.
                </p>
                
                {po.approved_at && (
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Approvals</p>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2 text-sm">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{po.vendor_name}</span>
                      </div>
                      <Badge variant="outline" className="bg-green-50 text-green-700">Approved</Badge>
                      <span className="text-sm text-muted-foreground">{formatDate(po.approved_at)}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Invoice Detail Dialog */}
      <InvoiceDetailDialog
        invoiceId={selectedInvoiceId}
        open={invoiceDialogOpen}
        onOpenChange={setInvoiceDialogOpen}
      />

      {/* Send PO Email Dialog */}
      {po && (
        <SendPOEmailDialog
          open={emailDialogOpen}
          onOpenChange={setEmailDialogOpen}
          poData={{
            id: po.id,
            po_number: po.po_number,
            title: po.description || '',
            total_amount: po.current_amount || po.original_amount || 0,
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

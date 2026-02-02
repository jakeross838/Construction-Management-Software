import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Calendar,
  Building,
  Phone,
  Mail,
  FileText,
  AlertCircle,
  Plus,
  Edit,
  Trash2,
  Loader2,
} from 'lucide-react';
import { Warranty, WarrantyClaim, useWarranty, useDeleteWarranty } from '@/hooks/useWarranties';
import { ClaimFormDialog } from './ClaimFormDialog';
import { WarrantyFormDialog } from './WarrantyFormDialog';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface WarrantyDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  warrantyId: string | null;
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  active: { label: 'Active', variant: 'default' },
  expired: { label: 'Expired', variant: 'destructive' },
  claimed: { label: 'Claimed', variant: 'secondary' },
  void: { label: 'Void', variant: 'outline' },
};

const claimStatusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  submitted: { label: 'Submitted', variant: 'outline' },
  in_progress: { label: 'In Progress', variant: 'secondary' },
  approved: { label: 'Approved', variant: 'default' },
  denied: { label: 'Denied', variant: 'destructive' },
  completed: { label: 'Completed', variant: 'default' },
};

export function WarrantyDetailDialog({ open, onOpenChange, warrantyId }: WarrantyDetailDialogProps) {
  const { data: warranty, isLoading } = useWarranty(warrantyId || '');
  const deleteWarranty = useDeleteWarranty();

  const [showClaimForm, setShowClaimForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedClaim, setSelectedClaim] = useState<WarrantyClaim | null>(null);

  const handleDelete = async () => {
    if (!warranty) return;
    try {
      await deleteWarranty.mutateAsync(warranty.id);
      toast.success('Warranty deleted');
      onOpenChange(false);
    } catch (error) {
      toast.error('Failed to delete warranty');
    }
  };

  const handleClaimClick = (claim: WarrantyClaim) => {
    setSelectedClaim(claim);
    setShowClaimForm(true);
  };

  const handleNewClaim = () => {
    setSelectedClaim(null);
    setShowClaimForm(true);
  };

  if (!warrantyId) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-3">
                <span>{warranty?.warranty_number || 'Loading...'}</span>
                {warranty && (
                  <Badge variant={statusConfig[warranty.status]?.variant || 'secondary'}>
                    {statusConfig[warranty.status]?.label || warranty.status}
                  </Badge>
                )}
              </DialogTitle>
              {warranty && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setShowEditForm(true)}>
                    <Edit className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setShowDeleteConfirm(true)}>
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete
                  </Button>
                </div>
              )}
            </div>
          </DialogHeader>

          {isLoading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : warranty ? (
            <Tabs defaultValue="details" className="flex-1 min-h-0 flex flex-col">
              <TabsList className="flex-shrink-0">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="claims">
                  Claims {warranty.claims && warranty.claims.length > 0 && `(${warranty.claims.length})`}
                </TabsTrigger>
                <TabsTrigger value="documents">Documents</TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="flex-1 overflow-auto mt-4">
                <div className="space-y-6">
                  {/* Basic Info */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg">Warranty Information</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                          <p className="text-sm text-muted-foreground">Item</p>
                          <p className="font-medium">{warranty.name}</p>
                        </div>
                        {warranty.job && (
                          <div className="col-span-2">
                            <p className="text-sm text-muted-foreground">Job</p>
                            <p className="font-medium">{warranty.job.name}</p>
                          </div>
                        )}
                        <div>
                          <p className="text-sm text-muted-foreground">Type</p>
                          <p className="font-medium capitalize">{warranty.type}</p>
                        </div>
                        {warranty.category && (
                          <div>
                            <p className="text-sm text-muted-foreground">Category</p>
                            <p className="font-medium">{warranty.category}</p>
                          </div>
                        )}
                        {(warranty.vendor || warranty.manufacturer) && (
                          <div className="col-span-2">
                            <p className="text-sm text-muted-foreground flex items-center gap-1">
                              <Building className="h-3 w-3" />
                              {warranty.vendor ? 'Vendor' : 'Manufacturer'}
                            </p>
                            <p className="font-medium">{warranty.vendor?.name || warranty.manufacturer}</p>
                          </div>
                        )}
                        <div>
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Start Date
                          </p>
                          <p className="font-medium">{new Date(warranty.start_date).toLocaleDateString()}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            End Date
                          </p>
                          <p className="font-medium">{new Date(warranty.end_date).toLocaleDateString()}</p>
                        </div>
                        {warranty.model_number && (
                          <div>
                            <p className="text-sm text-muted-foreground">Model #</p>
                            <p className="font-medium">{warranty.model_number}</p>
                          </div>
                        )}
                        {warranty.serial_number && (
                          <div>
                            <p className="text-sm text-muted-foreground">Serial #</p>
                            <p className="font-medium">{warranty.serial_number}</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Contact Info */}
                  {(warranty.contact_name || warranty.contact_phone || warranty.contact_email) && (
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg">Contact Information</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-3 gap-4">
                          {warranty.contact_name && (
                            <div>
                              <p className="text-sm text-muted-foreground">Name</p>
                              <p className="font-medium">{warranty.contact_name}</p>
                            </div>
                          )}
                          {warranty.contact_phone && (
                            <div>
                              <p className="text-sm text-muted-foreground flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                Phone
                              </p>
                              <p className="font-medium">{warranty.contact_phone}</p>
                            </div>
                          )}
                          {warranty.contact_email && (
                            <div>
                              <p className="text-sm text-muted-foreground flex items-center gap-1">
                                <Mail className="h-3 w-3" />
                                Email
                              </p>
                              <p className="font-medium">{warranty.contact_email}</p>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Coverage Details */}
                  {warranty.coverage_details && (
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg">Coverage Details</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm">{warranty.coverage_details}</p>
                      </CardContent>
                    </Card>
                  )}

                  {/* Notes */}
                  {warranty.notes && (
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg">Notes</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm">{warranty.notes}</p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="claims" className="flex-1 overflow-auto mt-4">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="font-medium">Warranty Claims</h3>
                    <Button size="sm" onClick={handleNewClaim}>
                      <Plus className="h-4 w-4 mr-1" />
                      File Claim
                    </Button>
                  </div>

                  {warranty.claims && warranty.claims.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Claim #</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Issue</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {warranty.claims.map((claim) => (
                          <TableRow
                            key={claim.id}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => handleClaimClick(claim)}
                          >
                            <TableCell className="font-medium">{claim.claim_number}</TableCell>
                            <TableCell>{new Date(claim.claim_date).toLocaleDateString()}</TableCell>
                            <TableCell className="max-w-[200px] truncate">{claim.issue_description}</TableCell>
                            <TableCell>
                              {claim.claim_amount ? `$${claim.claim_amount.toLocaleString()}` : '-'}
                            </TableCell>
                            <TableCell>
                              <Badge variant={claimStatusConfig[claim.status]?.variant || 'outline'}>
                                {claimStatusConfig[claim.status]?.label || claim.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                      <AlertCircle className="h-8 w-8 mb-2" />
                      <p>No claims filed yet</p>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="documents" className="flex-1 overflow-auto mt-4">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="font-medium">Documents & Attachments</h3>
                    <Button size="sm" variant="outline" disabled>
                      <Plus className="h-4 w-4 mr-1" />
                      Upload Document
                    </Button>
                  </div>

                  {warranty.attachments && warranty.attachments.length > 0 ? (
                    <div className="space-y-2">
                      {warranty.attachments.map((attachment) => (
                        <div key={attachment.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center gap-3">
                            <FileText className="h-5 w-5 text-muted-foreground" />
                            <div>
                              <p className="font-medium">{attachment.name}</p>
                              <p className="text-sm text-muted-foreground capitalize">{attachment.attachment_type}</p>
                            </div>
                          </div>
                          <Button variant="outline" size="sm" asChild>
                            <a href={attachment.file_url} target="_blank" rel="noopener noreferrer">
                              View
                            </a>
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                      <FileText className="h-8 w-8 mb-2" />
                      <p>No documents attached</p>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          ) : (
            <div className="flex items-center justify-center h-48 text-muted-foreground">
              <AlertCircle className="h-8 w-8 mr-2" />
              <p>Warranty not found</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Warranty Dialog */}
      {warranty && (
        <WarrantyFormDialog
          open={showEditForm}
          onOpenChange={setShowEditForm}
          warranty={warranty}
        />
      )}

      {/* File/Edit Claim Dialog */}
      {warranty && (
        <ClaimFormDialog
          open={showClaimForm}
          onOpenChange={(open) => {
            setShowClaimForm(open);
            if (!open) setSelectedClaim(null);
          }}
          warranty={warranty}
          claim={selectedClaim}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Warranty?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this warranty and all associated claims. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

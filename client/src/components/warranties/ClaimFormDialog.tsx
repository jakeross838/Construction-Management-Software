import { useState, useEffect } from 'react';
import { BaseFormDialog } from '@/components/ui/base-form-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Warranty,
  WarrantyClaim,
  claimStatuses,
  useCreateClaim,
  useUpdateClaim,
  useResolveClaim
} from '@/hooks/useWarranties';
import { toast } from 'sonner';

interface ClaimFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  warranty: Warranty;
  claim?: WarrantyClaim | null;
}

export function ClaimFormDialog({ open, onOpenChange, warranty, claim }: ClaimFormDialogProps) {
  const createClaim = useCreateClaim();
  const updateClaim = useUpdateClaim();
  const resolveClaim = useResolveClaim();

  const [formData, setFormData] = useState({
    issue_description: '',
    claim_date: '',
    claim_amount: '',
    notes: '',
    status: 'submitted',
    resolution_description: '',
    approved_amount: '',
  });

  useEffect(() => {
    if (claim) {
      setFormData({
        issue_description: claim.issue_description,
        claim_date: claim.claim_date || '',
        claim_amount: claim.claim_amount?.toString() || '',
        notes: claim.notes || '',
        status: claim.status,
        resolution_description: claim.resolution_description || '',
        approved_amount: claim.approved_amount?.toString() || '',
      });
    } else {
      setFormData({
        issue_description: '',
        claim_date: new Date().toISOString().split('T')[0],
        claim_amount: '',
        notes: '',
        status: 'submitted',
        resolution_description: '',
        approved_amount: '',
      });
    }
  }, [claim, open]);

  const handleSubmit = async () => {
    try {
      if (claim) {
        // If resolving or completing the claim
        if (formData.status === 'completed' && claim.status !== 'completed') {
          await resolveClaim.mutateAsync({
            warrantyId: warranty.id,
            claimId: claim.id,
            resolution: {
              resolution_description: formData.resolution_description || undefined,
              approved_amount: formData.approved_amount ? parseFloat(formData.approved_amount) : undefined,
            }
          });
          toast.success('Claim resolved');
        } else {
          // Regular update
          await updateClaim.mutateAsync({
            warrantyId: warranty.id,
            claimId: claim.id,
            updates: {
              issue_description: formData.issue_description,
              claim_date: formData.claim_date,
              claim_amount: formData.claim_amount ? parseFloat(formData.claim_amount) : undefined,
              notes: formData.notes || undefined,
              status: formData.status as WarrantyClaim['status'],
              resolution_description: formData.resolution_description || undefined,
              approved_amount: formData.approved_amount ? parseFloat(formData.approved_amount) : undefined,
            }
          });
          toast.success('Claim updated');
        }
      } else {
        await createClaim.mutateAsync({
          warrantyId: warranty.id,
          claim: {
            issue_description: formData.issue_description,
            claim_date: formData.claim_date,
            claim_amount: formData.claim_amount ? parseFloat(formData.claim_amount) : undefined,
            notes: formData.notes || undefined,
          }
        });
        toast.success('Claim submitted');
      }
      onOpenChange(false);
    } catch (error) {
      toast.error(claim ? 'Failed to update claim' : 'Failed to submit claim');
    }
  };

  const isLoading = createClaim.isPending || updateClaim.isPending || resolveClaim.isPending;
  const isEditing = !!claim;

  return (
    <BaseFormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? 'Edit Claim' : 'File Warranty Claim'}
      description={`${warranty.warranty_number} - ${warranty.name}`}
      size="form"
      onSubmit={handleSubmit}
      submitLabel={isEditing ? 'Update Claim' : 'Submit Claim'}
      isSubmitting={isLoading}
      submitDisabled={!formData.issue_description || !formData.claim_date}
    >
      <div className="grid grid-cols-2 gap-4">
        {/* Claim Date */}
        <div>
          <Label>Claim Date *</Label>
          <Input
            type="date"
            value={formData.claim_date}
            onChange={(e) => setFormData({ ...formData, claim_date: e.target.value })}
          />
        </div>

        {/* Claim Amount */}
        <div>
          <Label>Claim Amount</Label>
          <Input
            type="number"
            step="0.01"
            value={formData.claim_amount}
            onChange={(e) => setFormData({ ...formData, claim_amount: e.target.value })}
            placeholder="0.00"
          />
        </div>

        {/* Status (only for editing) */}
        {isEditing && (
          <div className="col-span-2">
            <Label>Status</Label>
            <Select
              value={formData.status}
              onValueChange={(value) => setFormData({ ...formData, status: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                {claimStatuses.map((status) => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Issue Description */}
      <div>
        <Label>Issue Description *</Label>
        <Textarea
          value={formData.issue_description}
          onChange={(e) => setFormData({ ...formData, issue_description: e.target.value })}
          rows={3}
          placeholder="Describe the issue in detail..."
        />
      </div>

      {/* Resolution (only for editing) */}
      {isEditing && (
        <div className="border-t pt-4">
          <h4 className="font-medium mb-3">Resolution Details</h4>
          <div className="space-y-4">
            <div>
              <Label>Resolution Description</Label>
              <Textarea
                value={formData.resolution_description}
                onChange={(e) => setFormData({ ...formData, resolution_description: e.target.value })}
                rows={2}
                placeholder="How was this issue resolved?"
              />
            </div>
            <div className="w-1/2">
              <Label>Approved Amount</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.approved_amount}
                onChange={(e) => setFormData({ ...formData, approved_amount: e.target.value })}
                placeholder="0.00"
              />
            </div>
          </div>
        </div>
      )}

      {/* Notes */}
      <div>
        <Label>Notes</Label>
        <Textarea
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          rows={2}
          placeholder="Additional notes..."
        />
      </div>
    </BaseFormDialog>
  );
}

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
import { Checkbox } from '@/components/ui/checkbox';
import { useJob } from '@/contexts/JobContext';
import { useDBJobs } from '@/hooks/useFinancialData';
import {
  Permit,
  PermitInsert,
  permitTypes,
  permitStatuses,
  useCreatePermit,
  useUpdatePermit
} from '@/hooks/usePermits';

interface PermitFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  permit?: Permit | null;
}

export function PermitFormDialog({ open, onOpenChange, permit }: PermitFormDialogProps) {
  const { selectedJobId } = useJob();
  const createPermit = useCreatePermit();
  const updatePermit = useUpdatePermit();

  const [formData, setFormData] = useState({
    job_id: '',
    type: '',
    number: '',
    status: 'not_submitted',
    submitted_date: '',
    approved_date: '',
    expires_date: '',
    jurisdiction: '',
    inspector_name: '',
    inspector_phone: '',
    inspector_email: '',
    fee_amount: '',
    fee_paid: false,
    notes: ''
  });

  const { data: jobs } = useDBJobs();

  useEffect(() => {
    if (permit) {
      setFormData({
        job_id: permit.job_id,
        type: permit.type,
        number: permit.number || '',
        status: permit.status,
        submitted_date: permit.submitted_date || '',
        approved_date: permit.approved_date || '',
        expires_date: permit.expires_date || '',
        jurisdiction: permit.jurisdiction || '',
        inspector_name: permit.inspector_name || '',
        inspector_phone: permit.inspector_phone || '',
        inspector_email: permit.inspector_email || '',
        fee_amount: permit.fee_amount?.toString() || '',
        fee_paid: permit.fee_paid || false,
        notes: permit.notes || ''
      });
    } else {
      setFormData({
        job_id: selectedJobId || '',
        type: '',
        number: '',
        status: 'not_submitted',
        submitted_date: '',
        approved_date: '',
        expires_date: '',
        jurisdiction: '',
        inspector_name: '',
        inspector_phone: '',
        inspector_email: '',
        fee_amount: '',
        fee_paid: false,
        notes: ''
      });
    }
  }, [permit, selectedJobId, open]);

  const handleSubmit = async () => {
    const permitData: PermitInsert = {
      job_id: formData.job_id,
      type: formData.type,
      number: formData.number || null,
      status: formData.status,
      submitted_date: formData.submitted_date || null,
      approved_date: formData.approved_date || null,
      expires_date: formData.expires_date || null,
      jurisdiction: formData.jurisdiction || null,
      inspector_name: formData.inspector_name || null,
      inspector_phone: formData.inspector_phone || null,
      inspector_email: formData.inspector_email || null,
      fee_amount: formData.fee_amount ? parseFloat(formData.fee_amount) : null,
      fee_paid: formData.fee_paid,
      notes: formData.notes || null
    };

    try {
      if (permit) {
        await updatePermit.mutateAsync({ id: permit.id, ...permitData });
      } else {
        await createPermit.mutateAsync(permitData);
      }
      onOpenChange(false);
    } catch (error) {
      // Error handled by mutation
    }
  };

  const isLoading = createPermit.isPending || updatePermit.isPending;
  const isEditing = !!permit;

  return (
    <BaseFormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? 'Edit Permit' : 'Add Permit'}
      size="form"
      onSubmit={handleSubmit}
      submitLabel={isEditing ? 'Update Permit' : 'Create Permit'}
      isSubmitting={isLoading}
      submitDisabled={!formData.job_id || !formData.type}
    >
      <div className="grid grid-cols-2 gap-4">
        {/* Job Selection - hidden if job is selected */}
        {!selectedJobId && (
          <div className="col-span-2">
            <Label>Job *</Label>
            <Select
              value={formData.job_id}
              onValueChange={(value) => setFormData({ ...formData, job_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select job" />
              </SelectTrigger>
              <SelectContent>
                {jobs?.map((job) => (
                  <SelectItem key={job.id} value={job.id}>
                    {job.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Permit Type */}
        <div>
          <Label>Permit Type *</Label>
          <Select
            value={formData.type}
            onValueChange={(value) => setFormData({ ...formData, type: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              {permitTypes.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Status */}
        <div>
          <Label>Status *</Label>
          <Select
            value={formData.status}
            onValueChange={(value) => setFormData({ ...formData, status: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              {permitStatuses.map((status) => (
                <SelectItem key={status.value} value={status.value}>
                  {status.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Permit Number */}
        <div>
          <Label>Permit Number</Label>
          <Input
            value={formData.number}
            onChange={(e) => setFormData({ ...formData, number: e.target.value })}
            placeholder="e.g., BP-2026-0142"
          />
        </div>

        {/* Jurisdiction */}
        <div>
          <Label>Jurisdiction</Label>
          <Input
            value={formData.jurisdiction}
            onChange={(e) => setFormData({ ...formData, jurisdiction: e.target.value })}
            placeholder="e.g., City of Austin"
          />
        </div>

        {/* Dates */}
        <div>
          <Label>Submitted Date</Label>
          <Input
            type="date"
            value={formData.submitted_date}
            onChange={(e) => setFormData({ ...formData, submitted_date: e.target.value })}
          />
        </div>

        <div>
          <Label>Approved Date</Label>
          <Input
            type="date"
            value={formData.approved_date}
            onChange={(e) => setFormData({ ...formData, approved_date: e.target.value })}
          />
        </div>

        <div>
          <Label>Expires Date</Label>
          <Input
            type="date"
            value={formData.expires_date}
            onChange={(e) => setFormData({ ...formData, expires_date: e.target.value })}
          />
        </div>

        {/* Fee */}
        <div>
          <Label>Fee Amount</Label>
          <Input
            type="number"
            step="0.01"
            value={formData.fee_amount}
            onChange={(e) => setFormData({ ...formData, fee_amount: e.target.value })}
            placeholder="0.00"
          />
        </div>

        {/* Fee Paid */}
        <div className="flex items-center gap-2 pt-6">
          <Checkbox
            id="fee_paid"
            checked={formData.fee_paid}
            onCheckedChange={(checked) => setFormData({ ...formData, fee_paid: checked as boolean })}
          />
          <Label htmlFor="fee_paid" className="cursor-pointer">Fee Paid</Label>
        </div>
      </div>

      {/* Inspector Info */}
      <div className="border-t pt-4">
        <h4 className="font-medium mb-3">Inspector Information</h4>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label>Inspector Name</Label>
            <Input
              value={formData.inspector_name}
              onChange={(e) => setFormData({ ...formData, inspector_name: e.target.value })}
            />
          </div>
          <div>
            <Label>Inspector Phone</Label>
            <Input
              value={formData.inspector_phone}
              onChange={(e) => setFormData({ ...formData, inspector_phone: e.target.value })}
            />
          </div>
          <div>
            <Label>Inspector Email</Label>
            <Input
              type="email"
              value={formData.inspector_email}
              onChange={(e) => setFormData({ ...formData, inspector_email: e.target.value })}
            />
          </div>
        </div>
      </div>

      {/* Notes */}
      <div>
        <Label>Notes</Label>
        <Textarea
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          rows={3}
          placeholder="Additional notes about the permit..."
        />
      </div>
    </BaseFormDialog>
  );
}

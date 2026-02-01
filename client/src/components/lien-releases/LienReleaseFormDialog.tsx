import { useState, useEffect } from 'react';
import { BaseFormDialog } from '@/components/ui/base-form-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCreateLienRelease, useUpdateLienRelease, releaseTypeOptions, releaseStatusOptions, type LienRelease } from '@/hooks/useLienReleases';
import { useVendors } from '@/hooks/useVendors';
import { useDBJobs } from '@/hooks/useFinancialData';
import { useQuery } from '@tanstack/react-query';
import { useJob } from '@/contexts/JobContext';

interface LienReleaseFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  release?: LienRelease | null;
  defaultJobId?: string | null;
  defaultDrawId?: string | null;
}

export function LienReleaseFormDialog({ open, onOpenChange, release, defaultJobId, defaultDrawId }: LienReleaseFormDialogProps) {
  const { selectedJobId: contextJobId } = useJob();

  // Prefer prop, then context
  const effectiveJobId = defaultJobId || contextJobId || '';
  const showJobSelector = !effectiveJobId;

  const [jobId, setJobId] = useState('');
  const [drawId, setDrawId] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [releaseType, setReleaseType] = useState('conditional');
  const [amount, setAmount] = useState('');
  const [throughDate, setThroughDate] = useState('');
  const [status, setStatus] = useState('pending');
  const [notes, setNotes] = useState('');

  const { data: vendors = [] } = useVendors();
  const { data: jobs = [] } = useDBJobs();

  const { data: draws = [] } = useQuery({
    queryKey: ['draws-for-job', jobId],
    queryFn: async () => {
      if (!jobId) return [];
      const response = await fetch(`/api/draws?job_id=${jobId}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch draws: HTTP ${response.status}`);
      }
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: !!jobId,
  });

  const createMutation = useCreateLienRelease();
  const updateMutation = useUpdateLienRelease();

  const isEditing = !!release;

  useEffect(() => {
    if (release) {
      setJobId(release.job_id);
      setDrawId(release.draw_id);
      setVendorId(release.vendor_id);
      setReleaseType(release.release_type);
      setAmount(release.amount.toString());
      setThroughDate(release.through_date || '');
      setStatus(release.status);
      setNotes(release.notes || '');
    } else {
      setJobId(effectiveJobId);
      setDrawId(defaultDrawId || '');
      setVendorId('');
      setReleaseType('conditional');
      setAmount('');
      setThroughDate('');
      setStatus('pending');
      setNotes('');
    }
  }, [release, open, effectiveJobId, defaultDrawId]);

  const handleSubmit = async () => {
    if (!jobId || !drawId || !vendorId || !amount) return;

    const data = {
      job_id: jobId,
      draw_id: drawId,
      vendor_id: vendorId,
      release_type: releaseType,
      amount: parseFloat(amount),
      through_date: throughDate || null,
      status,
      notes: notes || null,
    };

    try {
      if (isEditing && release) {
        await updateMutation.mutateAsync({ id: release.id, ...data });
      } else {
        await createMutation.mutateAsync(data);
      }
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to save lien release:', error);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <BaseFormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? 'Edit Lien Release' : 'Request Lien Release'}
      size="md"
      onSubmit={handleSubmit}
      submitLabel={isEditing ? 'Save Changes' : 'Request Release'}
      isSubmitting={isPending}
      submitDisabled={!jobId || !drawId || !vendorId || !amount}
    >
      <div className="grid grid-cols-2 gap-4">
        {showJobSelector && (
          <div className="space-y-2">
            <Label>Job *</Label>
            <Select value={jobId} onValueChange={setJobId}>
              <SelectTrigger>
                <SelectValue placeholder="Select job" />
              </SelectTrigger>
              <SelectContent>
                {jobs.map((job) => (
                  <SelectItem key={job.id} value={job.id}>{job.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="space-y-2">
          <Label>Draw *</Label>
          <Select value={drawId} onValueChange={setDrawId} disabled={!jobId}>
            <SelectTrigger>
              <SelectValue placeholder="Select draw" />
            </SelectTrigger>
            <SelectContent>
              {draws.map((draw) => (
                <SelectItem key={draw.id} value={draw.id}>Draw #{draw.draw_number}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Vendor *</Label>
        <Select value={vendorId} onValueChange={setVendorId}>
          <SelectTrigger>
            <SelectValue placeholder="Select vendor" />
          </SelectTrigger>
          <SelectContent>
            {vendors.map((vendor) => (
              <SelectItem key={vendor.id} value={vendor.id}>{vendor.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Release Type *</Label>
          <Select value={releaseType} onValueChange={setReleaseType}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {releaseTypeOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {releaseStatusOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="amount">Amount *</Label>
          <Input
            id="amount"
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="throughDate">Through Date</Label>
          <Input
            id="throughDate"
            type="date"
            value={throughDate}
            onChange={(e) => setThroughDate(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Additional notes..."
          rows={2}
        />
      </div>
    </BaseFormDialog>
  );
}

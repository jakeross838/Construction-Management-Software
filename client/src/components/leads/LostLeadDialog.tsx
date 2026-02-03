import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
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
import { AlertTriangle, Building2 } from 'lucide-react';
import { useLostLeadReasons, useMarkLeadAsLost } from '@/hooks/useDBLeads';

interface LostLeadDialogProps {
  leadId: string | null;
  leadName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function LostLeadDialog({
  leadId,
  leadName,
  open,
  onOpenChange,
  onSuccess,
}: LostLeadDialogProps) {
  const [reason, setReason] = useState('');
  const [competitor, setCompetitor] = useState('');
  const [notes, setNotes] = useState('');

  const { data: reasons = [], isLoading: reasonsLoading } = useLostLeadReasons();
  const markAsLost = useMarkLeadAsLost();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadId) return;

    await markAsLost.mutateAsync({
      leadId,
      lost_reason: reason || undefined,
      lost_competitor: competitor || undefined,
      notes: notes || undefined,
    });

    // Reset form
    setReason('');
    setCompetitor('');
    setNotes('');
    onOpenChange(false);
    onSuccess?.();
  };

  const handleClose = () => {
    setReason('');
    setCompetitor('');
    setNotes('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Mark Lead as Lost
          </DialogTitle>
          <DialogDescription>
            Record why "{leadName}" was lost to help improve future sales efforts.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="reason">Lost Reason *</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue placeholder="Select a reason..." />
              </SelectTrigger>
              <SelectContent>
                {reasonsLoading ? (
                  <SelectItem value="" disabled>Loading...</SelectItem>
                ) : (
                  reasons.map((r) => (
                    <SelectItem key={r.id} value={r.name}>
                      {r.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {(reason === 'Chose competitor' || reason === 'Price too high') && (
            <div className="space-y-2">
              <Label htmlFor="competitor" className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Competitor Name (if known)
              </Label>
              <Input
                id="competitor"
                placeholder="e.g., ABC Builders"
                value={competitor}
                onChange={(e) => setCompetitor(e.target.value)}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="notes">Additional Notes</Label>
            <Textarea
              id="notes"
              placeholder="Any additional context about why this lead was lost..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={!reason || markAsLost.isPending}
            >
              {markAsLost.isPending ? 'Saving...' : 'Mark as Lost'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

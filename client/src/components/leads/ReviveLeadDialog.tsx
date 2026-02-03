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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RefreshCw, Sparkles } from 'lucide-react';
import { useReviveLead, usePipelineStages } from '@/hooks/useDBLeads';

interface ReviveLeadDialogProps {
  leadId: string | null;
  leadName: string;
  previousReason?: string | null;
  previousCompetitor?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function ReviveLeadDialog({
  leadId,
  leadName,
  previousReason,
  previousCompetitor,
  open,
  onOpenChange,
  onSuccess,
}: ReviveLeadDialogProps) {
  const [targetStage, setTargetStage] = useState('inquiry');
  const [notes, setNotes] = useState('');

  const { data: stages = [] } = usePipelineStages();
  const reviveLead = useReviveLead();

  // Filter out won/lost stages
  const activeStages = stages.filter(s => !s.is_won_stage && !s.is_lost_stage);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadId) return;

    await reviveLead.mutateAsync({
      leadId,
      notes: notes || undefined,
      target_stage: targetStage,
    });

    // Reset form
    setTargetStage('inquiry');
    setNotes('');
    onOpenChange(false);
    onSuccess?.();
  };

  const handleClose = () => {
    setTargetStage('inquiry');
    setNotes('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-green-500" />
            Revive Lost Lead
          </DialogTitle>
          <DialogDescription>
            Bring "{leadName}" back into the pipeline. The lead will be moved to the selected stage.
          </DialogDescription>
        </DialogHeader>

        {(previousReason || previousCompetitor) && (
          <div className="bg-muted/50 rounded-lg p-3 text-sm">
            <p className="font-medium mb-1">Previous Lost Info:</p>
            {previousReason && (
              <p className="text-muted-foreground">Reason: {previousReason}</p>
            )}
            {previousCompetitor && (
              <p className="text-muted-foreground">Competitor: {previousCompetitor}</p>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="stage">Return to Stage</Label>
            <Select value={targetStage} onValueChange={setTargetStage}>
              <SelectTrigger>
                <SelectValue placeholder="Select stage..." />
              </SelectTrigger>
              <SelectContent>
                {activeStages.map((stage) => (
                  <SelectItem key={stage.id} value={stage.slug}>
                    <div className="flex items-center gap-2">
                      <div
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: stage.color }}
                      />
                      {stage.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Revival Notes</Label>
            <Textarea
              id="notes"
              placeholder="Why is this lead being revived? Any new information or changed circumstances?"
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
              className="bg-green-600 hover:bg-green-700"
              disabled={reviveLead.isPending}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              {reviveLead.isPending ? 'Reviving...' : 'Revive Lead'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

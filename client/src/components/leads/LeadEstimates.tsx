import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Calculator,
  Plus,
  ExternalLink,
  Clock,
  CheckCircle2,
  XCircle,
  FileText,
  Send,
} from 'lucide-react';
import { useLeadEstimates, useCreateEstimateFromLead, LeadEstimate } from '@/hooks/useDBLeads';
import { formatDistanceToNow } from 'date-fns';
import { formatCurrency } from '@/data/mockData';

interface LeadEstimatesProps {
  leadId: string;
  leadName?: string;
}

const statusConfig: Record<string, { label: string; icon: typeof Clock; color: string }> = {
  draft: { label: 'Draft', icon: Clock, color: 'bg-gray-100 text-gray-800' },
  submitted: { label: 'Submitted', icon: Send, color: 'bg-blue-100 text-blue-800' },
  approved: { label: 'Approved', icon: CheckCircle2, color: 'bg-green-100 text-green-800' },
  rejected: { label: 'Rejected', icon: XCircle, color: 'bg-red-100 text-red-800' },
  converted: { label: 'Converted', icon: FileText, color: 'bg-purple-100 text-purple-800' },
};

export function LeadEstimates({ leadId, leadName }: LeadEstimatesProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [title, setTitle] = useState('');

  const { data: estimates = [], isLoading } = useLeadEstimates(leadId);
  const createEstimate = useCreateEstimateFromLead();

  const handleCreate = async () => {
    await createEstimate.mutateAsync({
      leadId,
      title: title || undefined,
    });
    setIsCreateOpen(false);
    setTitle('');
  };

  const handleViewEstimate = (estimate: LeadEstimate) => {
    // Navigate to estimate detail page
    window.location.href = `/estimates/${estimate.id}`;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calculator className="h-4 w-4" />
            Estimates
            {estimates.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {estimates.length}
              </Badge>
            )}
          </div>
          <Button size="sm" onClick={() => setIsCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Estimate
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-4 text-sm text-muted-foreground">
            Loading estimates...
          </div>
        ) : estimates.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Calculator className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No estimates yet</p>
            <p className="text-xs mt-1">Click "Create Estimate" to start one</p>
          </div>
        ) : (
          <div className="space-y-3">
            {estimates.map((estimate) => {
              const config = statusConfig[estimate.status] || statusConfig.draft;
              const StatusIcon = config.icon;

              return (
                <div
                  key={estimate.id}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => handleViewEstimate(estimate)}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Calculator className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">
                          {estimate.estimate_number || 'Estimate'}
                        </p>
                        <Badge variant="secondary" className={`text-xs ${config.color}`}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {config.label}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                        {estimate.title}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="font-semibold text-green-600">
                      {formatCurrency(estimate.total_amount || 0)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(estimate.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      {/* Create Estimate Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Estimate</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Create a new estimate for this lead. The estimate will be pre-populated
              with the lead's project information.
            </p>

            <div className="space-y-2">
              <Label>Estimate Title (optional)</Label>
              <Input
                placeholder={`${leadName || 'Lead'} - New Estimate`}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Leave blank to auto-generate from lead name
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={createEstimate.isPending}>
              {createEstimate.isPending ? 'Creating...' : 'Create Estimate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

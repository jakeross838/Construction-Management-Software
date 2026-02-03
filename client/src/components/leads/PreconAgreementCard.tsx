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
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  FileSignature,
  Calendar,
  DollarSign,
  FileText,
  CheckCircle2,
  Clock,
  Pencil,
} from 'lucide-react';
import { Lead, useUpdateLead } from '@/hooks/useDBLeads';
import { formatCurrency } from '@/data/mockData';

interface PreconAgreementCardProps {
  lead: Lead;
  onUpdate?: () => void;
}

export function PreconAgreementCard({ lead, onUpdate }: PreconAgreementCardProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    signed: lead.precon_agreement_signed || false,
    date: lead.precon_agreement_date || '',
    amount: lead.precon_agreement_amount || '',
    notes: lead.precon_agreement_notes || '',
  });

  const updateLead = useUpdateLead();

  const handleSave = async () => {
    await updateLead.mutateAsync({
      id: lead.id,
      precon_agreement_signed: formData.signed,
      precon_agreement_date: formData.date || null,
      precon_agreement_amount: formData.amount ? parseFloat(formData.amount.toString()) : null,
      precon_agreement_notes: formData.notes || null,
    } as any);

    setIsDialogOpen(false);
    onUpdate?.();
  };

  const isSigned = lead.precon_agreement_signed;

  return (
    <Card className={isSigned ? 'border-green-200 bg-green-50/50' : ''}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileSignature className="h-4 w-4" />
            Preconstruction Agreement
            {isSigned && (
              <Badge className="bg-green-100 text-green-800 gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Signed
              </Badge>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setFormData({
                signed: lead.precon_agreement_signed || false,
                date: lead.precon_agreement_date || '',
                amount: lead.precon_agreement_amount || '',
                notes: lead.precon_agreement_notes || '',
              });
              setIsDialogOpen(true);
            }}
          >
            <Pencil className="h-4 w-4 mr-2" />
            {isSigned ? 'Edit' : 'Record'}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isSigned ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              {lead.precon_agreement_date && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-muted-foreground text-xs">Signed Date</p>
                    <p className="font-medium">
                      {new Date(lead.precon_agreement_date).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              )}
              {lead.precon_agreement_amount && (
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-muted-foreground text-xs">Retainer Amount</p>
                    <p className="font-medium text-green-600">
                      {formatCurrency(lead.precon_agreement_amount)}
                    </p>
                  </div>
                </div>
              )}
            </div>
            {lead.precon_agreement_notes && (
              <div className="text-sm">
                <p className="text-muted-foreground text-xs mb-1">Notes</p>
                <p className="whitespace-pre-wrap">{lead.precon_agreement_notes}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-4 text-muted-foreground">
            <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Agreement not yet signed</p>
            <p className="text-xs mt-1">Click "Record" when the client signs</p>
          </div>
        )}
      </CardContent>

      {/* Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Preconstruction Agreement</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="signed"
                checked={formData.signed}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, signed: checked as boolean })
                }
              />
              <Label htmlFor="signed" className="font-medium">
                Agreement has been signed
              </Label>
            </div>

            {formData.signed && (
              <>
                <div className="space-y-2">
                  <Label>Date Signed</Label>
                  <Input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Retainer/Fee Amount ($)</Label>
                  <Input
                    type="number"
                    placeholder="e.g., 5000"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea
                    placeholder="Any notes about the agreement..."
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                  />
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={updateLead.isPending}>
              {updateLead.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

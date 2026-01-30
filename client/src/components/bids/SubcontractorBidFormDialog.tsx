import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { X, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useVendors } from '@/hooks/useVendors';
import {
  useCreateSubcontractorBid,
  useUpdateSubcontractorBid,
  SubcontractorBid,
  BidPackage,
} from '@/hooks/useBidPackages';

interface SubcontractorBidFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bidPackage: BidPackage;
  editBid?: SubcontractorBid | null;
}

export function SubcontractorBidFormDialog({
  open,
  onOpenChange,
  bidPackage,
  editBid,
}: SubcontractorBidFormDialogProps) {
  const { data: vendors = [] } = useVendors();
  const createBid = useCreateSubcontractorBid();
  const updateBid = useUpdateSubcontractorBid();

  const [formData, setFormData] = useState({
    vendor_id: '',
    bid_amount: '',
    unit_price_per_sf: '',
    proposed_start_date: '',
    proposed_duration_days: '',
    payment_terms: '',
    warranty_terms: '',
    bond_included: false,
    insurance_verified: false,
    valid_until: '',
    notes: '',
  });

  const [inclusions, setInclusions] = useState<string[]>([]);
  const [exclusions, setExclusions] = useState<string[]>([]);
  const [clarifications, setClarifications] = useState<string[]>([]);
  const [newInclusion, setNewInclusion] = useState('');
  const [newExclusion, setNewExclusion] = useState('');
  const [newClarification, setNewClarification] = useState('');

  useEffect(() => {
    if (open) {
      if (editBid) {
        setFormData({
          vendor_id: editBid.vendor_id,
          bid_amount: editBid.bid_amount.toString(),
          unit_price_per_sf: editBid.unit_price_per_sf?.toString() || '',
          proposed_start_date: editBid.proposed_start_date?.split('T')[0] || '',
          proposed_duration_days: editBid.proposed_duration_days?.toString() || '',
          payment_terms: editBid.payment_terms || '',
          warranty_terms: editBid.warranty_terms || '',
          bond_included: editBid.bond_included,
          insurance_verified: editBid.insurance_verified,
          valid_until: editBid.valid_until?.split('T')[0] || '',
          notes: editBid.notes || '',
        });
        setInclusions(editBid.inclusions || []);
        setExclusions(editBid.exclusions || []);
        setClarifications(editBid.clarifications || []);
      } else {
        setFormData({
          vendor_id: '',
          bid_amount: '',
          unit_price_per_sf: '',
          proposed_start_date: '',
          proposed_duration_days: '',
          payment_terms: 'Net 30',
          warranty_terms: '1 year labor warranty',
          bond_included: false,
          insurance_verified: false,
          valid_until: '',
          notes: '',
        });
        setInclusions([]);
        setExclusions([]);
        setClarifications([]);
      }
    }
  }, [open, editBid]);

  // Auto-calculate unit price per SF
  useEffect(() => {
    if (formData.bid_amount && bidPackage.square_footage) {
      const perSf = parseFloat(formData.bid_amount) / bidPackage.square_footage;
      setFormData((p) => ({ ...p, unit_price_per_sf: perSf.toFixed(2) }));
    }
  }, [formData.bid_amount, bidPackage.square_footage]);

  const handleAddItem = (
    type: 'inclusion' | 'exclusion' | 'clarification',
    value: string,
    setValue: (v: string) => void
  ) => {
    if (!value.trim()) return;
    if (type === 'inclusion') {
      setInclusions((p) => [...p, value.trim()]);
    } else if (type === 'exclusion') {
      setExclusions((p) => [...p, value.trim()]);
    } else {
      setClarifications((p) => [...p, value.trim()]);
    }
    setValue('');
  };

  const handleRemoveItem = (
    type: 'inclusion' | 'exclusion' | 'clarification',
    index: number
  ) => {
    if (type === 'inclusion') {
      setInclusions((p) => p.filter((_, i) => i !== index));
    } else if (type === 'exclusion') {
      setExclusions((p) => p.filter((_, i) => i !== index));
    } else {
      setClarifications((p) => p.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields
    if (!formData.proposed_duration_days || parseInt(formData.proposed_duration_days) < 1) {
      toast.error('Duration is required - please enter the estimated days to complete');
      return;
    }

    const payload = {
      bid_package_id: bidPackage.id,
      vendor_id: formData.vendor_id,
      bid_amount: parseFloat(formData.bid_amount),
      unit_price_per_sf: formData.unit_price_per_sf
        ? parseFloat(formData.unit_price_per_sf)
        : null,
      proposed_start_date: formData.proposed_start_date || null,
      proposed_duration_days: formData.proposed_duration_days
        ? parseInt(formData.proposed_duration_days)
        : null,
      payment_terms: formData.payment_terms || null,
      warranty_terms: formData.warranty_terms || null,
      bond_included: formData.bond_included,
      insurance_verified: formData.insurance_verified,
      valid_until: formData.valid_until || null,
      notes: formData.notes || null,
      inclusions,
      exclusions,
      clarifications,
    };

    if (editBid) {
      updateBid.mutate({ id: editBid.id, ...payload }, { onSuccess: () => onOpenChange(false) });
    } else {
      createBid.mutate(payload, { onSuccess: () => onOpenChange(false) });
    }
  };

  const isPending = createBid.isPending || updateBid.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editBid ? 'Edit Subcontractor Bid' : 'Record Subcontractor Bid'}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {bidPackage.title} • {bidPackage.trade_category}
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Vendor & Amount */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="vendor_id">Subcontractor *</Label>
              <Select
                value={formData.vendor_id}
                onValueChange={(v) => setFormData((p) => ({ ...p, vendor_id: v }))}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select vendor" />
                </SelectTrigger>
                <SelectContent>
                  {vendors.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bid_amount">Bid Amount *</Label>
              <Input
                id="bid_amount"
                type="number"
                step="0.01"
                value={formData.bid_amount}
                onChange={(e) => setFormData((p) => ({ ...p, bid_amount: e.target.value }))}
                placeholder="50000"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="unit_price_per_sf">$/SF</Label>
              <Input
                id="unit_price_per_sf"
                type="number"
                step="0.01"
                value={formData.unit_price_per_sf}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, unit_price_per_sf: e.target.value }))
                }
                placeholder="Auto-calculated"
                readOnly={!!bidPackage.square_footage}
              />
            </div>
          </div>

          {/* Timeline */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="proposed_start_date">Proposed Start</Label>
              <Input
                id="proposed_start_date"
                type="date"
                value={formData.proposed_start_date}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, proposed_start_date: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="proposed_duration_days">Duration (days) *</Label>
              <Input
                id="proposed_duration_days"
                type="number"
                min="1"
                value={formData.proposed_duration_days}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, proposed_duration_days: e.target.value }))
                }
                placeholder="14"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="valid_until">Bid Valid Until</Label>
              <Input
                id="valid_until"
                type="date"
                value={formData.valid_until}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, valid_until: e.target.value }))
                }
              />
            </div>
          </div>

          {/* Terms */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="payment_terms">Payment Terms</Label>
              <Input
                id="payment_terms"
                value={formData.payment_terms}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, payment_terms: e.target.value }))
                }
                placeholder="Net 30"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="warranty_terms">Warranty Terms</Label>
              <Input
                id="warranty_terms"
                value={formData.warranty_terms}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, warranty_terms: e.target.value }))
                }
                placeholder="1 year labor warranty"
              />
            </div>
          </div>

          {/* Checkboxes */}
          <div className="flex gap-6">
            <div className="flex items-center gap-2">
              <Checkbox
                id="bond_included"
                checked={formData.bond_included}
                onCheckedChange={(v) =>
                  setFormData((p) => ({ ...p, bond_included: !!v }))
                }
              />
              <Label htmlFor="bond_included" className="font-normal">
                Bond included
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="insurance_verified"
                checked={formData.insurance_verified}
                onCheckedChange={(v) =>
                  setFormData((p) => ({ ...p, insurance_verified: !!v }))
                }
              />
              <Label htmlFor="insurance_verified" className="font-normal">
                Insurance verified
              </Label>
            </div>
          </div>

          {/* Inclusions */}
          <div className="space-y-2">
            <Label>Inclusions</Label>
            <div className="flex gap-2">
              <Input
                value={newInclusion}
                onChange={(e) => setNewInclusion(e.target.value)}
                placeholder="Add what's included..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddItem('inclusion', newInclusion, setNewInclusion);
                  }
                }}
              />
              <Button
                type="button"
                size="icon"
                variant="outline"
                onClick={() => handleAddItem('inclusion', newInclusion, setNewInclusion)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {inclusions.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {inclusions.map((item, i) => (
                  <Badge key={i} variant="secondary" className="gap-1">
                    {item}
                    <X
                      className="h-3 w-3 cursor-pointer"
                      onClick={() => handleRemoveItem('inclusion', i)}
                    />
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Exclusions */}
          <div className="space-y-2">
            <Label>Exclusions</Label>
            <div className="flex gap-2">
              <Input
                value={newExclusion}
                onChange={(e) => setNewExclusion(e.target.value)}
                placeholder="Add what's excluded..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddItem('exclusion', newExclusion, setNewExclusion);
                  }
                }}
              />
              <Button
                type="button"
                size="icon"
                variant="outline"
                onClick={() => handleAddItem('exclusion', newExclusion, setNewExclusion)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {exclusions.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {exclusions.map((item, i) => (
                  <Badge key={i} variant="outline" className="gap-1 text-red-600">
                    {item}
                    <X
                      className="h-3 w-3 cursor-pointer"
                      onClick={() => handleRemoveItem('exclusion', i)}
                    />
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Clarifications */}
          <div className="space-y-2">
            <Label>Clarifications</Label>
            <div className="flex gap-2">
              <Input
                value={newClarification}
                onChange={(e) => setNewClarification(e.target.value)}
                placeholder="Add clarification..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddItem('clarification', newClarification, setNewClarification);
                  }
                }}
              />
              <Button
                type="button"
                size="icon"
                variant="outline"
                onClick={() =>
                  handleAddItem('clarification', newClarification, setNewClarification)
                }
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {clarifications.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {clarifications.map((item, i) => (
                  <Badge key={i} variant="secondary" className="gap-1 bg-amber-100 text-amber-800">
                    {item}
                    <X
                      className="h-3 w-3 cursor-pointer"
                      onClick={() => handleRemoveItem('clarification', i)}
                    />
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))}
              placeholder="Additional notes about this bid..."
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Saving...' : editBid ? 'Update Bid' : 'Record Bid'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

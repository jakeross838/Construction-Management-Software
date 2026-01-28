import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
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
import { Combobox } from '@/components/ui/combobox';
import { 
  EstimateLineItem, 
  LineItemType, 
  MarkupType,
  lineItemTypes, 
  commonUnits,
  formatCurrencyEstimate,
  calculateMarkup,
} from '@/types/estimate';
import { useCostCodes } from '@/hooks/useFinancialData';

interface LineItemFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lineItem?: EstimateLineItem | null;
  defaultType?: LineItemType;
  onSave: (data: Omit<EstimateLineItem, 'id' | 'sortOrder' | 'totalCost' | 'totalWithMarkup'>) => void;
}

const defaultLineItem = {
  costCodeId: '',
  costCode: '',
  category: '',
  description: '',
  type: 'material' as LineItemType,
  quantity: 1,
  unit: 'ea',
  unitCost: 0,
  markup: 15,
  markupType: 'percentage' as MarkupType,
  notes: '',
};

export function LineItemForm({ open, onOpenChange, lineItem, defaultType, onSave }: LineItemFormProps) {
  const { data: costCodes = [] } = useCostCodes();
  const [formData, setFormData] = useState(defaultLineItem);
  
  const costCodeOptions = costCodes.map(cc => ({
    value: cc.id,
    label: `${cc.code} - ${cc.name}`,
    description: cc.category || undefined,
  }));

  useEffect(() => {
    if (lineItem) {
      setFormData({
        costCodeId: lineItem.costCodeId || '',
        costCode: lineItem.costCode || '',
        category: lineItem.category,
        description: lineItem.description,
        type: lineItem.type,
        quantity: lineItem.quantity,
        unit: lineItem.unit,
        unitCost: lineItem.unitCost,
        markup: lineItem.markup,
        markupType: lineItem.markupType,
        notes: lineItem.notes || '',
      });
    } else {
      const defaultMarkup = defaultType === 'labor' ? 35 : 
                           defaultType === 'subcontractor' ? 10 : 15;
      setFormData({
        ...defaultLineItem,
        type: defaultType || 'material',
        markup: defaultMarkup,
      });
    }
  }, [lineItem, defaultType, open]);

  const handleCostCodeChange = (costCodeId: string) => {
    const selectedCode = costCodes.find(cc => cc.id === costCodeId);
    setFormData({
      ...formData,
      costCodeId,
      costCode: selectedCode?.code || '',
      category: selectedCode?.category || formData.category,
    });
  };

  const totalCost = formData.quantity * formData.unitCost;
  const markupAmount = calculateMarkup(totalCost, formData.markup, formData.markupType);
  const totalWithMarkup = totalCost + markupAmount;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onOpenChange(false);
  };

  const handleTypeChange = (type: LineItemType) => {
    const defaultMarkup = type === 'labor' ? 35 : 
                         type === 'subcontractor' ? 10 : 15;
    setFormData({ ...formData, type, markup: defaultMarkup });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{lineItem ? 'Edit Line Item' : 'Add Line Item'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={formData.type} onValueChange={handleTypeChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {lineItemTypes.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Cost Code</Label>
              <Combobox
                options={costCodeOptions}
                value={formData.costCodeId}
                onValueChange={handleCostCodeChange}
                placeholder="Select cost code..."
                searchPlaceholder="Search cost codes..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Input
                id="category"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                placeholder="Auto-filled from cost code"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe the item or work..."
              rows={2}
              required
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity *</Label>
              <Input
                id="quantity"
                type="number"
                step="0.01"
                min="0"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: parseFloat(e.target.value) || 0 })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Unit</Label>
              <Select value={formData.unit} onValueChange={(v) => setFormData({ ...formData, unit: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {commonUnits.map(unit => (
                    <SelectItem key={unit.value} value={unit.value}>
                      {unit.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="unitCost">Unit Cost *</Label>
              <Input
                id="unitCost"
                type="number"
                step="0.01"
                min="0"
                value={formData.unitCost}
                onChange={(e) => setFormData({ ...formData, unitCost: parseFloat(e.target.value) || 0 })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="markup">Markup %</Label>
              <Input
                id="markup"
                type="number"
                step="0.1"
                value={formData.markup}
                onChange={(e) => setFormData({ ...formData, markup: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div className="space-y-2">
              <Label>Markup Type</Label>
              <Select 
                value={formData.markupType} 
                onValueChange={(v) => setFormData({ ...formData, markupType: v as MarkupType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Percentage</SelectItem>
                  <SelectItem value="fixed">Fixed Amount</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Optional notes..."
              rows={2}
            />
          </div>

          {/* Calculated Preview */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Base Cost</span>
              <span>{formatCurrencyEstimate(totalCost)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                Markup ({formData.markupType === 'percentage' ? `${formData.markup}%` : 'Fixed'})
              </span>
              <span>{formatCurrencyEstimate(markupAmount)}</span>
            </div>
            <div className="flex justify-between font-semibold border-t pt-2">
              <span>Total</span>
              <span className="text-primary">{formatCurrencyEstimate(totalWithMarkup)}</span>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">
              {lineItem ? 'Update' : 'Add'} Line Item
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

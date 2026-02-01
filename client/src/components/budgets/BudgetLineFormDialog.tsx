import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCreateBudgetLine, useUpdateBudgetLine, type BudgetLine } from '@/hooks/useBudget';
import { useCostCodes } from '@/hooks/useFinancialData';
import { formatCurrency } from '@/data/mockData';
import { AlertTriangle } from 'lucide-react';

interface BudgetLineFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  budgetLine?: BudgetLine | null;
  jobId: string;
  existingCostCodeIds?: string[];
}

export function BudgetLineFormDialog({
  open,
  onOpenChange,
  budgetLine,
  jobId,
  existingCostCodeIds = []
}: BudgetLineFormDialogProps) {
  const [costCodeId, setCostCodeId] = useState('');
  const [budgetedAmount, setBudgetedAmount] = useState('');
  const [notes, setNotes] = useState('');

  const { data: costCodes = [] } = useCostCodes();
  const createMutation = useCreateBudgetLine();
  const updateMutation = useUpdateBudgetLine();

  const isEditing = !!budgetLine;

  // Filter out cost codes that already have budget lines (for create mode)
  const availableCostCodes = isEditing
    ? costCodes
    : costCodes.filter(cc => !existingCostCodeIds.includes(cc.id));

  // Group cost codes by category
  const costCodesByCategory = availableCostCodes.reduce((acc, cc) => {
    const cat = cc.category || 'Other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(cc);
    return acc;
  }, {} as Record<string, typeof costCodes>);

  const categories = Object.keys(costCodesByCategory).sort();

  useEffect(() => {
    if (budgetLine) {
      setCostCodeId(budgetLine.cost_code_id);
      setBudgetedAmount(budgetLine.budgeted_amount.toString());
      setNotes(budgetLine.notes || '');
    } else {
      setCostCodeId('');
      setBudgetedAmount('');
      setNotes('');
    }
  }, [budgetLine, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const amount = parseFloat(budgetedAmount);
    if (isNaN(amount) || amount < 0) return;

    try {
      if (isEditing && budgetLine) {
        await updateMutation.mutateAsync({
          id: budgetLine.id,
          job_id: jobId,
          budgeted_amount: amount,
          notes: notes || undefined,
        });
      } else {
        if (!costCodeId) return;
        await createMutation.mutateAsync({
          job_id: jobId,
          cost_code_id: costCodeId,
          budgeted_amount: amount,
          notes: notes || undefined,
        });
      }
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to save budget line:', error);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;
  const selectedCostCode = costCodes.find(cc => cc.id === costCodeId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Budget Line' : 'Add Budget Line'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update the budgeted amount for this cost code.'
              : 'Add a new budget allocation for a cost code.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="costCode">Cost Code *</Label>
            {isEditing ? (
              <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                <span className="font-mono text-sm">{budgetLine?.cost_code}</span>
                <span className="text-muted-foreground">-</span>
                <span>{budgetLine?.cost_code_name}</span>
              </div>
            ) : (
              <Select value={costCodeId} onValueChange={setCostCodeId} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select cost code" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {categories.map((category) => (
                    <div key={category}>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50">
                        {category}
                      </div>
                      {costCodesByCategory[category].map((cc) => (
                        <SelectItem key={cc.id} value={cc.id}>
                          <span className="font-mono text-sm mr-2">{cc.code}</span>
                          <span>{cc.name}</span>
                        </SelectItem>
                      ))}
                    </div>
                  ))}
                </SelectContent>
              </Select>
            )}
            {!isEditing && availableCostCodes.length === 0 && (
              <p className="text-sm text-amber-600 flex items-center gap-1">
                <AlertTriangle className="h-4 w-4" />
                All cost codes already have budget lines for this job.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Budgeted Amount *</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                value={budgetedAmount}
                onChange={(e) => setBudgetedAmount(e.target.value)}
                placeholder="0.00"
                className="pl-7"
                required
              />
            </div>
            {budgetedAmount && !isNaN(parseFloat(budgetedAmount)) && (
              <p className="text-sm text-muted-foreground">
                {formatCurrency(parseFloat(budgetedAmount))}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes about this budget allocation..."
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending || (!isEditing && !costCodeId) || !budgetedAmount || parseFloat(budgetedAmount) < 0}
            >
              {isPending ? 'Saving...' : isEditing ? 'Save Changes' : 'Add Budget Line'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

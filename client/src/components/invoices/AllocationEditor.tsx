import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Combobox } from '@/components/ui/combobox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Plus,
  Trash2,
  SplitSquareHorizontal,
  Check,
  AlertTriangle,
  Sparkles,
  ChevronDown,
  RefreshCw,
  FileText,
} from 'lucide-react';
import { formatCurrency } from '@/types/financial';
import { useCostCodes } from '@/hooks/useFinancialData';
import { usePurchaseOrders } from '@/hooks/usePurchaseOrders';
import { CostCodeSuggestions, CostCodeSuggestion } from './CostCodeSuggestions';
import { cn } from '@/lib/utils';

export interface Allocation {
  id?: string;
  cost_code_id: string;
  amount: number;
  description?: string;
}

interface AllocationEditorProps {
  allocations: Allocation[];
  onChange: (allocations: Allocation[]) => void;
  invoiceAmount: number;
  jobId: string;
  poId?: string | null;
  disabled?: boolean;
  suggestions?: CostCodeSuggestion[];
  onSuggestionsApplied?: () => void;
}

export function AllocationEditor({
  allocations,
  onChange,
  invoiceAmount,
  jobId,
  poId,
  disabled = false,
  suggestions,
  onSuggestionsApplied,
}: AllocationEditorProps) {
  const { data: costCodes = [] } = useCostCodes();
  const { data: purchaseOrders = [] } = usePurchaseOrders(jobId);
  const [showSuggestions, setShowSuggestions] = useState(!!suggestions?.length);

  // Get the linked PO
  const linkedPO = purchaseOrders.find(po => po.id === poId);

  // Calculate totals
  const totalAllocated = allocations.reduce((sum, a) => sum + (a.amount || 0), 0);
  const remaining = invoiceAmount - totalAllocated;
  const percentAllocated = invoiceAmount > 0 ? (totalAllocated / invoiceAmount) * 100 : 0;
  const isBalanced = Math.abs(remaining) < 0.01;
  const isOverAllocated = remaining < -0.01;

  // Cost code options
  const costCodeOptions = costCodes.map(cc => ({
    value: cc.id,
    label: `${cc.code} - ${cc.name}`,
  }));

  // Add allocation
  const addAllocation = () => {
    onChange([...allocations, { cost_code_id: '', amount: 0, description: '' }]);
  };

  // Remove allocation
  const removeAllocation = (index: number) => {
    onChange(allocations.filter((_, i) => i !== index));
  };

  // Update allocation
  const updateAllocation = (index: number, updates: Partial<Allocation>) => {
    const updated = [...allocations];
    updated[index] = { ...updated[index], ...updates };
    onChange(updated);
  };

  // Split equally across all allocations
  const splitEqually = () => {
    if (allocations.length === 0) return;
    const perAllocation = invoiceAmount / allocations.length;
    onChange(allocations.map(a => ({ ...a, amount: Math.round(perAllocation * 100) / 100 })));
  };

  // Split proportionally based on PO line items
  const splitFromPO = () => {
    if (!linkedPO?.line_items?.length) return;

    const poTotal = linkedPO.line_items.reduce((sum, li: any) => sum + (li.amount || 0), 0);
    if (poTotal <= 0) return;

    const newAllocations: Allocation[] = linkedPO.line_items.map((li: any) => {
      const proportion = (li.amount || 0) / poTotal;
      return {
        cost_code_id: li.cost_code_id || '',
        amount: Math.round(proportion * invoiceAmount * 100) / 100,
        description: li.description || '',
      };
    });

    onChange(newAllocations);
  };

  // Assign remaining to last allocation
  const assignRemaining = () => {
    if (allocations.length === 0 || isBalanced) return;
    const updated = [...allocations];
    const lastIdx = updated.length - 1;
    updated[lastIdx] = { ...updated[lastIdx], amount: updated[lastIdx].amount + remaining };
    onChange(updated);
  };

  // Handle AI suggestions acceptance
  const handleAcceptSuggestions = (suggested: Array<{ cost_code_id: string; amount: number }>) => {
    onChange(suggested.map(s => ({ ...s, description: '' })));
    setShowSuggestions(false);
    onSuggestionsApplied?.();
  };

  // Determine status color
  const getStatusColor = () => {
    if (isOverAllocated) return 'bg-red-500';
    if (isBalanced) return 'bg-green-500';
    return 'bg-amber-500';
  };

  const getStatusBadge = () => {
    if (isOverAllocated) {
      return (
        <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50">
          <AlertTriangle className="h-3 w-3 mr-1" />
          Over by {formatCurrency(Math.abs(remaining))}
        </Badge>
      );
    }
    if (isBalanced) {
      return (
        <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
          <Check className="h-3 w-3 mr-1" />
          Balanced
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">
        {formatCurrency(remaining)} remaining
      </Badge>
    );
  };

  return (
    <div className="space-y-4">
      {/* AI Suggestions */}
      {showSuggestions && suggestions && suggestions.length > 0 && (
        <CostCodeSuggestions
          suggestions={suggestions}
          invoiceAmount={invoiceAmount}
          onAccept={handleAcceptSuggestions}
          onDismiss={() => setShowSuggestions(false)}
        />
      )}

      {/* Allocation Progress Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Allocated: <span className="font-medium text-foreground">{formatCurrency(totalAllocated)}</span>
            {' of '}
            <span className="font-medium text-foreground">{formatCurrency(invoiceAmount)}</span>
          </span>
          {getStatusBadge()}
        </div>
        <div className="relative">
          <Progress
            value={Math.min(percentAllocated, 100)}
            className={cn("h-2", isOverAllocated && "[&>div]:bg-red-500")}
          />
          {isOverAllocated && (
            <div
              className="absolute top-0 h-2 bg-red-500/30 rounded-r"
              style={{
                left: '100%',
                width: `${Math.min((percentAllocated - 100), 20)}%`
              }}
            />
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          variant="outline"
          size="sm"
          onClick={addAllocation}
          disabled={disabled}
        >
          <Plus className="h-4 w-4 mr-1" />
          Add Cost Code
        </Button>

        {allocations.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={disabled}>
                <SplitSquareHorizontal className="h-4 w-4 mr-1" />
                Split
                <ChevronDown className="h-3 w-3 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={splitEqually}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Split Equally
              </DropdownMenuItem>
              {linkedPO?.line_items?.length > 0 && (
                <DropdownMenuItem onClick={splitFromPO}>
                  <FileText className="h-4 w-4 mr-2" />
                  Split from PO ({linkedPO.po_number})
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={assignRemaining} disabled={isBalanced}>
                <Plus className="h-4 w-4 mr-2" />
                Assign {formatCurrency(remaining)} to Last
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {suggestions && suggestions.length > 0 && !showSuggestions && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSuggestions(true)}
          >
            <Sparkles className="h-4 w-4 mr-1 text-primary" />
            AI Suggestions
          </Button>
        )}
      </div>

      {/* Allocation Rows */}
      <div className="space-y-2">
        {allocations.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-4 border rounded-lg bg-muted/30">
            No cost codes allocated. Add a cost code or use AI suggestions.
          </div>
        ) : (
          allocations.map((alloc, idx) => {
            const costCode = costCodes.find(cc => cc.id === alloc.cost_code_id);

            return (
              <div
                key={idx}
                className="flex items-center gap-2 p-2 rounded-lg border bg-card"
              >
                <div className="flex-1 min-w-[200px]">
                  <Combobox
                    options={costCodeOptions}
                    value={alloc.cost_code_id}
                    onValueChange={(v) => updateAllocation(idx, { cost_code_id: v })}
                    placeholder="Select cost code..."
                    disabled={disabled}
                  />
                </div>
                <div className="w-32">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={alloc.amount || ''}
                    onChange={(e) => updateAllocation(idx, { amount: parseFloat(e.target.value) || 0 })}
                    placeholder="Amount"
                    disabled={disabled}
                    className="text-right"
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => removeAllocation(idx)}
                  disabled={disabled}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            );
          })
        )}
      </div>

      {/* Summary */}
      {allocations.length > 0 && (
        <div className={cn(
          "flex items-center gap-2 p-3 rounded-lg text-sm",
          isOverAllocated ? "bg-red-50 border-red-200 border" :
          isBalanced ? "bg-green-50 border-green-200 border" :
          "bg-muted/50 border"
        )}>
          {isBalanced ? (
            <Check className="h-4 w-4 text-green-600" />
          ) : (
            <AlertTriangle className={cn("h-4 w-4", isOverAllocated ? "text-red-600" : "text-amber-600")} />
          )}
          <span className="font-medium">
            {allocations.length} allocation{allocations.length !== 1 ? 's' : ''} totaling {formatCurrency(totalAllocated)}
          </span>
          {!isBalanced && (
            <span className={cn(
              "text-xs",
              isOverAllocated ? "text-red-600" : "text-amber-600"
            )}>
              — {isOverAllocated ? 'Cannot exceed invoice amount' : 'Partial allocation allowed'}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

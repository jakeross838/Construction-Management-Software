import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sparkles, Check, Plus, Trash2, DollarSign } from 'lucide-react';
import { AIConfidenceBadge } from './AIConfidenceBadge';
import { formatCurrency } from '@/types/financial';
import { cn } from '@/lib/utils';

export interface CostCodeSuggestion {
  id: string;
  code: string;
  name: string;
  amount: number;
  confidence: number;
  reason: string;
}

interface CostCodeSuggestionsProps {
  suggestions: CostCodeSuggestion[];
  invoiceAmount: number;
  onAccept: (allocations: Array<{ cost_code_id: string; amount: number }>) => void;
  onDismiss: () => void;
}

export function CostCodeSuggestions({ 
  suggestions, 
  invoiceAmount, 
  onAccept, 
  onDismiss 
}: CostCodeSuggestionsProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(suggestions.filter(s => s.confidence >= 0.7).map(s => s.id))
  );
  const [amounts, setAmounts] = useState<Record<string, number>>(
    Object.fromEntries(suggestions.map(s => [s.id, s.amount]))
  );

  const handleToggle = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleAmountChange = (id: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    setAmounts(prev => ({ ...prev, [id]: numValue }));
  };

  const totalSelected = Array.from(selectedIds).reduce(
    (sum, id) => sum + (amounts[id] || 0), 
    0
  );

  const isBalanced = Math.abs(totalSelected - invoiceAmount) < 0.01;

  const handleAccept = () => {
    const allocations = Array.from(selectedIds).map(id => ({
      cost_code_id: id,
      amount: amounts[id] || 0
    }));
    onAccept(allocations);
  };

  // Auto-adjust last selected item to balance
  const handleAutoBalance = () => {
    const selectedArray = Array.from(selectedIds);
    if (selectedArray.length === 0) return;
    
    const lastId = selectedArray[selectedArray.length - 1];
    const otherTotal = selectedArray
      .filter(id => id !== lastId)
      .reduce((sum, id) => sum + (amounts[id] || 0), 0);
    
    const remaining = invoiceAmount - otherTotal;
    setAmounts(prev => ({ ...prev, [lastId]: Math.max(0, remaining) }));
  };

  if (!suggestions.length) return null;

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-primary" />
          AI Cost Code Suggestions
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          {suggestions.map(suggestion => (
            <div 
              key={suggestion.id}
              className={cn(
                'flex items-start gap-3 p-3 rounded-lg border transition-colors',
                selectedIds.has(suggestion.id) 
                  ? 'border-primary/30 bg-background' 
                  : 'border-transparent bg-muted/50'
              )}
            >
              <Checkbox
                id={suggestion.id}
                checked={selectedIds.has(suggestion.id)}
                onCheckedChange={() => handleToggle(suggestion.id)}
                className="mt-1"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Label 
                    htmlFor={suggestion.id} 
                    className="font-medium cursor-pointer"
                  >
                    {suggestion.code} - {suggestion.name}
                  </Label>
                  <AIConfidenceBadge confidence={suggestion.confidence} size="sm" />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {suggestion.reason}
                </p>
              </div>
              <div className="w-28 shrink-0">
                <Input
                  type="number"
                  step="0.01"
                  value={amounts[suggestion.id] || ''}
                  onChange={(e) => handleAmountChange(suggestion.id, e.target.value)}
                  disabled={!selectedIds.has(suggestion.id)}
                  className="text-right text-sm h-8"
                  placeholder="Amount"
                />
              </div>
            </div>
          ))}
        </div>

        {/* Total and Balance */}
        <div className="flex items-center justify-between pt-2 border-t">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">
              Selected: <strong>{formatCurrency(totalSelected)}</strong>
            </span>
            {!isBalanced && (
              <Badge variant="outline" className="text-amber-600 border-amber-200">
                {totalSelected > invoiceAmount ? '+' : ''}{formatCurrency(totalSelected - invoiceAmount)} difference
              </Badge>
            )}
            {isBalanced && (
              <Badge variant="outline" className="text-green-600 border-green-200">
                <Check className="h-3 w-3 mr-1" />
                Balanced
              </Badge>
            )}
          </div>
          <div className="text-sm text-muted-foreground">
            Invoice: {formatCurrency(invoiceAmount)}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2">
          {!isBalanced && selectedIds.size > 0 && (
            <Button variant="outline" size="sm" onClick={handleAutoBalance}>
              Auto-balance
            </Button>
          )}
          <div className="flex-1" />
          <Button variant="ghost" size="sm" onClick={onDismiss}>
            Dismiss
          </Button>
          <Button 
            size="sm" 
            onClick={handleAccept}
            disabled={selectedIds.size === 0 || !isBalanced}
          >
            <Check className="h-4 w-4 mr-1" />
            Apply {selectedIds.size} allocation{selectedIds.size !== 1 ? 's' : ''}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2, Save, X, Pencil, GripVertical, AlertTriangle, FileDown, ListPlus } from 'lucide-react';
import { POLineItem, formatCurrency } from '@/types/financial';
import { useCostCodes, useUpdatePOLineItem, useCreatePOLineItem, useDeletePOLineItem } from '@/hooks/useFinancialData';
import { useBudgetSummary } from '@/hooks/useBudget';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface POLineItemsEditorProps {
  poId: string;
  jobId: string;
  lineItems: POLineItem[];
  isEditing: boolean;
}

interface EditingLineItem {
  id?: string;
  title: string;
  description: string;
  cost_code_id: string | null;
  unit_cost: number;
  quantity: number;
  amount: number;
}

interface BudgetLineData {
  cost_code_id: string;
  cost_code: string;
  budgeted_amount: number;
  committed_amount: number;
  remaining: number;
}

export function POLineItemsEditor({ poId, jobId, lineItems, isEditing }: POLineItemsEditorProps) {
  const { data: costCodes = [] } = useCostCodes();
  const { data: budgetData } = useBudgetSummary(jobId);
  const updateLineItem = useUpdatePOLineItem();
  const createLineItem = useCreatePOLineItem();
  const deleteLineItem = useDeletePOLineItem();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<EditingLineItem | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [selectedTemplateItems, setSelectedTemplateItems] = useState<Set<string>>(new Set());
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const [newItem, setNewItem] = useState<EditingLineItem>({
    title: '',
    description: '',
    cost_code_id: null,
    unit_cost: 0,
    quantity: 1,
    amount: 0,
  });

  // Build budget lookup for warnings
  const budgetByCode = (budgetData?.lines || []).reduce((acc, line) => {
    if (line.cost_code_id) {
      acc[line.cost_code_id] = {
        cost_code_id: line.cost_code_id,
        cost_code: line.cost_code || '',
        budgeted_amount: line.budgeted_amount || 0,
        committed_amount: line.committed_amount || 0,
        remaining: (line.budgeted_amount || 0) - (line.committed_amount || 0),
      };
    }
    return acc;
  }, {} as Record<string, BudgetLineData>);

  const calculateAmount = (unitCost: number, quantity: number) => unitCost * quantity;

  // Check if a line item exceeds budget
  const getBudgetWarning = (costCodeId: string | null, amount: number): string | null => {
    if (!costCodeId) return null;
    const budget = budgetByCode[costCodeId];
    if (!budget) return null;
    if (amount > budget.remaining) {
      return `Exceeds remaining budget by ${formatCurrency(amount - budget.remaining)}`;
    }
    return null;
  };

  const handleEditStart = (item: POLineItem) => {
    setEditingId(item.id);
    setEditData({
      id: item.id,
      title: item.title || '',
      description: item.description,
      cost_code_id: item.cost_code_id,
      unit_cost: item.unit_cost || 0,
      quantity: item.quantity || 1,
      amount: item.amount,
    });
  };

  const handleEditSave = async () => {
    if (!editData || !editingId) return;

    const amount = calculateAmount(editData.unit_cost, editData.quantity);
    await updateLineItem.mutateAsync({
      id: editingId,
      po_id: poId,
      title: editData.title || null,
      description: editData.description,
      cost_code_id: editData.cost_code_id,
      unit_cost: editData.unit_cost,
      quantity: editData.quantity,
      amount,
    });

    setEditingId(null);
    setEditData(null);
  };

  const handleEditCancel = () => {
    setEditingId(null);
    setEditData(null);
  };

  const handleNewItemSave = async () => {
    const amount = calculateAmount(newItem.unit_cost, newItem.quantity);
    await createLineItem.mutateAsync({
      po_id: poId,
      title: newItem.title || null,
      description: newItem.description || 'New item',
      cost_code_id: newItem.cost_code_id,
      unit_cost: newItem.unit_cost,
      quantity: newItem.quantity,
      amount,
      sort_order: lineItems.length,
    });

    setShowNewForm(false);
    setNewItem({
      title: '',
      description: '',
      cost_code_id: null,
      unit_cost: 0,
      quantity: 1,
      amount: 0,
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this line item?')) return;
    await deleteLineItem.mutateAsync({ id, po_id: poId });
  };

  // Drag and drop handlers
  const handleDragStart = useCallback((e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (draggedId !== id) {
      setDragOverId(id);
    }
  }, [draggedId]);

  const handleDragEnd = useCallback(async () => {
    if (draggedId && dragOverId && draggedId !== dragOverId) {
      // Calculate new order
      const currentOrder = lineItems.map(li => li.id);
      const draggedIndex = currentOrder.indexOf(draggedId);
      const dropIndex = currentOrder.indexOf(dragOverId);

      // Remove dragged item and insert at new position
      currentOrder.splice(draggedIndex, 1);
      currentOrder.splice(dropIndex, 0, draggedId);

      try {
        await api(`/purchase-orders/${poId}/line-items/reorder`, {
          method: 'POST',
          body: JSON.stringify({ line_item_ids: currentOrder }),
        });
        toast.success('Line items reordered');
      } catch (err) {
        toast.error('Failed to reorder items');
      }
    }

    setDraggedId(null);
    setDragOverId(null);
  }, [draggedId, dragOverId, lineItems, poId]);

  // Template import - add items from cost codes with budget
  const handleAddFromTemplate = async () => {
    if (selectedTemplateItems.size === 0) {
      toast.error('Select at least one cost code');
      return;
    }

    for (const costCodeId of selectedTemplateItems) {
      const costCode = costCodes.find(cc => cc.id === costCodeId);
      const budget = budgetByCode[costCodeId];

      await createLineItem.mutateAsync({
        po_id: poId,
        title: costCode?.name || '',
        description: `${costCode?.code} - ${costCode?.name}`,
        cost_code_id: costCodeId,
        unit_cost: budget?.remaining || 0,
        quantity: 1,
        amount: budget?.remaining || 0,
        sort_order: lineItems.length,
      });
    }

    toast.success(`Added ${selectedTemplateItems.size} line items`);
    setShowTemplateDialog(false);
    setSelectedTemplateItems(new Set());
  };

  const toggleTemplateItem = (id: string) => {
    const newSet = new Set(selectedTemplateItems);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedTemplateItems(newSet);
  };

  // Get cost codes that are in budget but not yet in this PO
  const availableCostCodes = costCodes.filter(cc => {
    const inBudget = budgetByCode[cc.id];
    const alreadyInPO = lineItems.some(li => li.cost_code_id === cc.id);
    return inBudget && !alreadyInPO && inBudget.remaining > 0;
  });

  const renderEditableRow = (
    data: EditingLineItem,
    onChange: (updates: Partial<EditingLineItem>) => void,
    onSave: () => void,
    onCancel: () => void,
    isNew = false
  ) => {
    const warning = getBudgetWarning(data.cost_code_id, calculateAmount(data.unit_cost, data.quantity));

    return (
      <tr className="bg-muted/30">
        <td className="p-2 w-8"></td>
        <td className="p-2">
          <div className="space-y-1">
            <Input
              placeholder="Title"
              value={data.title}
              onChange={(e) => onChange({ title: e.target.value })}
              className="h-8 text-sm"
            />
            <Textarea
              placeholder="Description"
              value={data.description}
              onChange={(e) => onChange({ description: e.target.value })}
              className="min-h-[40px] text-sm resize-none"
            />
          </div>
        </td>
        <td className="p-2">
          <Select
            value={data.cost_code_id || 'none'}
            onValueChange={(v) => onChange({ cost_code_id: v === 'none' ? null : v })}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Select..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {costCodes.map((cc) => (
                <SelectItem key={cc.id} value={cc.id}>
                  {cc.code} - {cc.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {warning && (
            <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              {warning}
            </p>
          )}
        </td>
        <td className="p-2">
          <Input
            type="number"
            step="0.01"
            value={data.unit_cost}
            onChange={(e) => {
              const unitCost = parseFloat(e.target.value) || 0;
              onChange({
                unit_cost: unitCost,
                amount: calculateAmount(unitCost, data.quantity)
              });
            }}
            className="h-8 text-sm text-right w-24"
          />
        </td>
        <td className="p-2">
          <Input
            type="number"
            value={data.quantity}
            onChange={(e) => {
              const quantity = parseFloat(e.target.value) || 1;
              onChange({
                quantity,
                amount: calculateAmount(data.unit_cost, quantity)
              });
            }}
            className="h-8 text-sm text-right w-16"
          />
        </td>
        <td className="p-2 text-right font-medium">
          {formatCurrency(calculateAmount(data.unit_cost, data.quantity))}
        </td>
        <td className="p-2">
          <div className="flex gap-1 justify-end">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onSave}>
              <Save className="h-3.5 w-3.5 text-green-600" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onCancel}>
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </div>
        </td>
      </tr>
    );
  };

  const total = lineItems.reduce((sum, item) => sum + item.amount, 0);
  const hasWarnings = lineItems.some(li => getBudgetWarning(li.cost_code_id, li.amount));

  return (
    <div className="space-y-2">
      {/* Summary with warnings */}
      {hasWarnings && (
        <div className="flex items-center gap-2 p-2 bg-amber-500/10 border border-amber-500/30 rounded text-sm text-amber-600">
          <AlertTriangle className="h-4 w-4" />
          Some line items exceed their budget allocation
        </div>
      )}

      <div className="rounded-lg border overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr className="text-left text-xs font-medium text-muted-foreground uppercase">
              {isEditing && <th className="p-3 w-8"></th>}
              <th className="p-3">Title / Description</th>
              <th className="p-3">Cost Code</th>
              <th className="p-3 text-right">Unit Cost</th>
              <th className="p-3 text-right">Qty</th>
              <th className="p-3 text-right">Amount</th>
              {isEditing && <th className="p-3 w-20"></th>}
            </tr>
          </thead>
          <tbody className="divide-y">
            {lineItems.map((item) => {
              const warning = getBudgetWarning(item.cost_code_id, item.amount);

              if (editingId === item.id && editData) {
                return (
                  <tr key={item.id}>
                    {renderEditableRow(
                      editData,
                      (updates) => setEditData({ ...editData, ...updates }),
                      handleEditSave,
                      handleEditCancel
                    )}
                  </tr>
                );
              }

              return (
                <tr
                  key={item.id}
                  className={cn(
                    "text-sm",
                    isEditing && "hover:bg-muted/30 cursor-move",
                    draggedId === item.id && "opacity-50",
                    dragOverId === item.id && "bg-primary/10"
                  )}
                  draggable={isEditing}
                  onDragStart={(e) => handleDragStart(e, item.id)}
                  onDragOver={(e) => handleDragOver(e, item.id)}
                  onDragEnd={handleDragEnd}
                >
                  {isEditing && (
                    <td className="p-2 text-muted-foreground">
                      <GripVertical className="h-4 w-4" />
                    </td>
                  )}
                  <td className="p-3">
                    <p className="font-medium">{item.title || item.description}</p>
                    {item.title && item.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                    )}
                  </td>
                  <td className="p-3">
                    <span className="font-mono text-xs">{item.cost_code || '—'}</span>
                    {item.cost_code_name && (
                      <p className="text-xs text-muted-foreground">{item.cost_code_name}</p>
                    )}
                    {warning && (
                      <Badge variant="outline" className="mt-1 text-amber-600 border-amber-600/30 bg-amber-600/10">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Over budget
                      </Badge>
                    )}
                  </td>
                  <td className="p-3 text-right">{formatCurrency(item.unit_cost || 0)}</td>
                  <td className="p-3 text-right">{item.quantity || 1}</td>
                  <td className="p-3 text-right font-medium">{formatCurrency(item.amount)}</td>
                  {isEditing && (
                    <td className="p-3">
                      <div className="flex gap-1 justify-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleEditStart(item)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          onClick={() => handleDelete(item.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}

            {showNewForm && (
              <tr>
                {renderEditableRow(
                  newItem,
                  (updates) => setNewItem({ ...newItem, ...updates }),
                  handleNewItemSave,
                  () => setShowNewForm(false),
                  true
                )}
              </tr>
            )}
          </tbody>
          <tfoot className="bg-muted/30">
            <tr className="font-semibold">
              <td className="p-3" colSpan={isEditing ? 5 : 4}>Total</td>
              <td className="p-3 text-right">{formatCurrency(total)}</td>
              {isEditing && <td></td>}
            </tr>
          </tfoot>
        </table>

        {isEditing && !showNewForm && (
          <div className="p-3 border-t flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => setShowNewForm(true)}
            >
              <Plus className="h-4 w-4" />
              Add Line Item
            </Button>
            {availableCostCodes.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => setShowTemplateDialog(true)}
              >
                <ListPlus className="h-4 w-4" />
                Add from Budget
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Template Selection Dialog */}
      <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add from Budget</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Select cost codes with remaining budget to add as line items.
          </p>
          <ScrollArea className="h-[300px] pr-4">
            <div className="space-y-2">
              {availableCostCodes.map(cc => {
                const budget = budgetByCode[cc.id];
                return (
                  <div
                    key={cc.id}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                      selectedTemplateItems.has(cc.id)
                        ? "bg-primary/10 border-primary"
                        : "hover:bg-muted/50"
                    )}
                    onClick={() => toggleTemplateItem(cc.id)}
                  >
                    <Checkbox
                      checked={selectedTemplateItems.has(cc.id)}
                      onCheckedChange={() => toggleTemplateItem(cc.id)}
                    />
                    <div className="flex-1">
                      <p className="font-medium text-sm">{cc.code} - {cc.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Remaining: {formatCurrency(budget?.remaining || 0)}
                      </p>
                    </div>
                  </div>
                );
              })}
              {availableCostCodes.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No cost codes with remaining budget available
                </p>
              )}
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTemplateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddFromTemplate} disabled={selectedTemplateItems.size === 0}>
              Add {selectedTemplateItems.size} Item{selectedTemplateItems.size !== 1 ? 's' : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useState } from 'react';
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
import { Plus, Trash2, Save, X, Pencil } from 'lucide-react';
import { POLineItem, formatCurrency } from '@/types/financial';
import { useCostCodes, useUpdatePOLineItem, useCreatePOLineItem, useDeletePOLineItem } from '@/hooks/useFinancialData';
import { cn } from '@/lib/utils';

interface POLineItemsEditorProps {
  poId: string;
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

export function POLineItemsEditor({ poId, lineItems, isEditing }: POLineItemsEditorProps) {
  const { data: costCodes = [] } = useCostCodes();
  const updateLineItem = useUpdatePOLineItem();
  const createLineItem = useCreatePOLineItem();
  const deleteLineItem = useDeletePOLineItem();
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<EditingLineItem | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newItem, setNewItem] = useState<EditingLineItem>({
    title: '',
    description: '',
    cost_code_id: null,
    unit_cost: 0,
    quantity: 1,
    amount: 0,
  });

  const calculateAmount = (unitCost: number, quantity: number) => unitCost * quantity;

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

  const renderEditableRow = (
    data: EditingLineItem,
    onChange: (updates: Partial<EditingLineItem>) => void,
    onSave: () => void,
    onCancel: () => void,
    isNew = false
  ) => (
    <tr className="bg-muted/30">
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

  return (
    <div className="rounded-lg border overflow-hidden">
      <table className="w-full">
        <thead className="bg-muted/50">
          <tr className="text-left text-xs font-medium text-muted-foreground uppercase">
            <th className="p-3">Title / Description</th>
            <th className="p-3">Cost Code</th>
            <th className="p-3 text-right">Unit Cost</th>
            <th className="p-3 text-right">Qty</th>
            <th className="p-3 text-right">Amount</th>
            {isEditing && <th className="p-3 w-20"></th>}
          </tr>
        </thead>
        <tbody className="divide-y">
          {lineItems.map((item) => (
            editingId === item.id && editData ? (
              renderEditableRow(
                editData,
                (updates) => setEditData({ ...editData, ...updates }),
                handleEditSave,
                handleEditCancel
              )
            ) : (
              <tr key={item.id} className={cn("text-sm", isEditing && "hover:bg-muted/30")}>
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
            )
          ))}
          
          {showNewForm && renderEditableRow(
            newItem,
            (updates) => setNewItem({ ...newItem, ...updates }),
            handleNewItemSave,
            () => setShowNewForm(false),
            true
          )}
        </tbody>
        <tfoot className="bg-muted/30">
          <tr className="font-semibold">
            <td className="p-3" colSpan={isEditing ? 4 : 4}>Total</td>
            <td className="p-3 text-right">
              {formatCurrency(lineItems.reduce((sum, item) => sum + item.amount, 0))}
            </td>
            {isEditing && <td></td>}
          </tr>
        </tfoot>
      </table>
      
      {isEditing && !showNewForm && (
        <div className="p-3 border-t">
          <Button 
            variant="outline" 
            size="sm" 
            className="gap-2"
            onClick={() => setShowNewForm(true)}
          >
            <Plus className="h-4 w-4" />
            Add Line Item
          </Button>
        </div>
      )}
    </div>
  );
}

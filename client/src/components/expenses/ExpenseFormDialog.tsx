import { useState, useEffect } from 'react';
import { BaseFormDialog } from '@/components/ui/base-form-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useVendors } from '@/hooks/useVendors';
import {
  type Expense,
  type ExpenseCategory,
  type ExpenseFrequency,
  type ExpenseStatus,
  categoryConfig,
  frequencyConfig,
} from '@/hooks/useExpenses';

interface ExpenseFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense?: Expense | null;
  onSave: (data: Omit<Expense, 'id' | 'created_at' | 'updated_at' | 'vendor'>) => void;
}

export function ExpenseFormDialog({
  open,
  onOpenChange,
  expense,
  onSave,
}: ExpenseFormDialogProps) {
  const { data: vendors = [] } = useVendors();

  const [formData, setFormData] = useState({
    category: 'office' as ExpenseCategory,
    name: '',
    description: '',
    amount: '',
    recurring: true,
    frequency: 'monthly' as ExpenseFrequency,
    vendor_id: '',
    payment_date: '',
    next_due_date: '',
    status: 'active' as ExpenseStatus,
    notes: '',
  });

  useEffect(() => {
    if (expense) {
      setFormData({
        category: expense.category,
        name: expense.name,
        description: expense.description || '',
        amount: expense.amount.toString(),
        recurring: expense.recurring,
        frequency: expense.frequency || 'monthly',
        vendor_id: expense.vendor_id || '',
        payment_date: expense.payment_date || '',
        next_due_date: expense.next_due_date || '',
        status: expense.status,
        notes: expense.notes || '',
      });
    } else {
      setFormData({
        category: 'office',
        name: '',
        description: '',
        amount: '',
        recurring: true,
        frequency: 'monthly',
        vendor_id: '',
        payment_date: '',
        next_due_date: '',
        status: 'active',
        notes: '',
      });
    }
  }, [expense, open]);

  const handleSubmit = () => {
    if (!formData.name || !formData.amount) {
      return;
    }

    onSave({
      category: formData.category,
      name: formData.name,
      description: formData.description || null,
      amount: parseFloat(formData.amount),
      recurring: formData.recurring,
      frequency: formData.recurring ? formData.frequency : null,
      vendor_id: formData.vendor_id || null,
      payment_date: formData.payment_date || null,
      next_due_date: formData.next_due_date || null,
      status: formData.status,
      notes: formData.notes || null,
    });

    onOpenChange(false);
  };

  const isEditing = !!expense;

  return (
    <BaseFormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? 'Edit Expense' : 'Add Expense'}
      size="form"
      onSubmit={handleSubmit}
      submitLabel={isEditing ? 'Save Changes' : 'Add Expense'}
      submitDisabled={!formData.name || !formData.amount}
    >
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="category">Category *</Label>
          <Select
            value={formData.category}
            onValueChange={(v) => setFormData({ ...formData, category: v as ExpenseCategory })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(categoryConfig).map(([key, config]) => (
                <SelectItem key={key} value={key}>
                  {config.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select
            value={formData.status}
            onValueChange={(v) => setFormData({ ...formData, status: v as ExpenseStatus })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="name">Expense Name *</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="e.g., Workers Comp Insurance"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Input
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Brief description of this expense"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="amount">Amount *</Label>
          <Input
            id="amount"
            type="number"
            step="0.01"
            value={formData.amount}
            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
            placeholder="0.00"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="vendor">Vendor</Label>
          <Select
            value={formData.vendor_id}
            onValueChange={(v) => setFormData({ ...formData, vendor_id: v })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select vendor..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">No vendor</SelectItem>
              {vendors.map((vendor) => (
                <SelectItem key={vendor.id} value={vendor.id}>
                  {vendor.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
        <Switch
          id="recurring"
          checked={formData.recurring}
          onCheckedChange={(checked) => setFormData({ ...formData, recurring: checked })}
        />
        <Label htmlFor="recurring" className="cursor-pointer">
          Recurring Expense
        </Label>

        {formData.recurring && (
          <Select
            value={formData.frequency}
            onValueChange={(v) => setFormData({ ...formData, frequency: v as ExpenseFrequency })}
          >
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(frequencyConfig).map(([key, config]) => (
                <SelectItem key={key} value={key}>
                  {config.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="payment_date">Last Payment Date</Label>
          <Input
            id="payment_date"
            type="date"
            value={formData.payment_date}
            onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="next_due_date">Next Due Date</Label>
          <Input
            id="next_due_date"
            type="date"
            value={formData.next_due_date}
            onChange={(e) => setFormData({ ...formData, next_due_date: e.target.value })}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          placeholder="Additional notes..."
          rows={3}
        />
      </div>
    </BaseFormDialog>
  );
}

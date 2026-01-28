import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
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
import { Employee, departmentOptions, roleOptions } from '@/hooks/useEmployees';

interface EmployeeFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee?: Employee | null;
  onSave: (employee: Omit<Employee, 'id' | 'created_at' | 'updated_at'>) => void;
}

export function EmployeeFormDialog({ open, onOpenChange, employee, onSave }: EmployeeFormDialogProps) {
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    role: '',
    department: '',
    hourly_rate: null as number | null,
    is_active: true,
    avatar_url: '',
    notes: '',
  });

  useEffect(() => {
    if (employee) {
      setForm({
        first_name: employee.first_name,
        last_name: employee.last_name,
        email: employee.email || '',
        phone: employee.phone || '',
        role: employee.role || '',
        department: employee.department || '',
        hourly_rate: employee.hourly_rate,
        is_active: employee.is_active,
        avatar_url: employee.avatar_url || '',
        notes: employee.notes || '',
      });
    } else {
      setForm({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        role: '',
        department: '',
        hourly_rate: null,
        is_active: true,
        avatar_url: '',
        notes: '',
      });
    }
  }, [employee, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.first_name || !form.last_name) return;
    
    onSave({
      ...form,
      email: form.email || null,
      phone: form.phone || null,
      role: form.role || null,
      department: form.department || null,
      avatar_url: form.avatar_url || null,
      notes: form.notes || null,
    });
    onOpenChange(false);
  };

  const updateField = (field: string, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{employee ? 'Edit Employee' : 'Add Employee'}</DialogTitle>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="first_name">First Name *</Label>
                <Input
                  id="first_name"
                  value={form.first_name}
                  onChange={(e) => updateField('first_name', e.target.value)}
                  placeholder="John"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="last_name">Last Name *</Label>
                <Input
                  id="last_name"
                  value={form.last_name}
                  onChange={(e) => updateField('last_name', e.target.value)}
                  placeholder="Smith"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => updateField('email', e.target.value)}
                  placeholder="john@example.com"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={form.phone}
                  onChange={(e) => updateField('phone', e.target.value)}
                  placeholder="(555) 123-4567"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Role</Label>
                <Select value={form.role} onValueChange={(v) => updateField('role', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roleOptions.map(role => (
                      <SelectItem key={role} value={role}>{role}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Department</Label>
                <Select value={form.department} onValueChange={(v) => updateField('department', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departmentOptions.map(dept => (
                      <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="hourly_rate">Hourly Rate ($)</Label>
                <Input
                  id="hourly_rate"
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.hourly_rate ?? ''}
                  onChange={(e) => updateField('hourly_rate', e.target.value ? Number(e.target.value) : null)}
                  placeholder="0.00"
                />
              </div>
              <div className="grid gap-2">
                <Label>Status</Label>
                <div className="flex items-center gap-3 h-10">
                  <Switch
                    checked={form.is_active}
                    onCheckedChange={(checked) => updateField('is_active', checked)}
                  />
                  <span className="text-sm">{form.is_active ? 'Active' : 'Inactive'}</span>
                </div>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={form.notes}
                onChange={(e) => updateField('notes', e.target.value)}
                placeholder="Additional notes..."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!form.first_name || !form.last_name}>
              {employee ? 'Save Changes' : 'Add Employee'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

import { useState, useEffect } from 'react';
import { BaseFormDialog } from '@/components/ui/base-form-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useCreateVendor, useUpdateVendor, type Vendor } from '@/hooks/useVendors';

interface VendorFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendor?: Vendor | null;
}

export function VendorFormDialog({ open, onOpenChange, vendor }: VendorFormDialogProps) {
  const [name, setName] = useState('');
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [taxId, setTaxId] = useState('');
  const [w9OnFile, setW9OnFile] = useState(false);
  const [insuranceExpiry, setInsuranceExpiry] = useState('');
  const [notes, setNotes] = useState('');

  const createMutation = useCreateVendor();
  const updateMutation = useUpdateVendor();

  const isEditing = !!vendor;

  useEffect(() => {
    if (vendor) {
      setName(vendor.name);
      setContactName(vendor.contact_name || '');
      setEmail(vendor.email || '');
      setPhone(vendor.phone || '');
      setAddress(vendor.address || '');
      setTaxId(vendor.tax_id || '');
      setW9OnFile(vendor.w9_on_file || false);
      setInsuranceExpiry(vendor.insurance_expiry || '');
      setNotes(vendor.notes || '');
    } else {
      setName('');
      setContactName('');
      setEmail('');
      setPhone('');
      setAddress('');
      setTaxId('');
      setW9OnFile(false);
      setInsuranceExpiry('');
      setNotes('');
    }
  }, [vendor, open]);

  const handleSubmit = async () => {
    if (!name.trim()) return;

    const data = {
      name: name.trim(),
      contact_name: contactName || null,
      email: email || null,
      phone: phone || null,
      address: address || null,
      tax_id: taxId || null,
      w9_on_file: w9OnFile,
      insurance_expiry: insuranceExpiry || null,
      status: 'active',
      notes: notes || null,
    };

    try {
      if (isEditing && vendor) {
        await updateMutation.mutateAsync({ id: vendor.id, ...data });
      } else {
        await createMutation.mutateAsync(data);
      }
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to save vendor:', error);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <BaseFormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? 'Edit Vendor' : 'Add Vendor'}
      size="form"
      onSubmit={handleSubmit}
      submitLabel={isEditing ? 'Save Changes' : 'Add Vendor'}
      isSubmitting={isPending}
      submitDisabled={!name.trim()}
    >
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">Company Name *</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ABC Construction"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contactName">Contact Name</Label>
          <Input
            id="contactName"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            placeholder="John Smith"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="contact@vendor.com"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(555) 123-4567"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="address">Address</Label>
        <Textarea
          id="address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="123 Main St, City, State 12345"
          rows={2}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="taxId">Tax ID / EIN</Label>
          <Input
            id="taxId"
            value={taxId}
            onChange={(e) => setTaxId(e.target.value)}
            placeholder="XX-XXXXXXX"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="insuranceExpiry">Insurance Expiry</Label>
          <Input
            id="insuranceExpiry"
            type="date"
            value={insuranceExpiry}
            onChange={(e) => setInsuranceExpiry(e.target.value)}
          />
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <Switch id="w9" checked={w9OnFile} onCheckedChange={setW9OnFile} />
        <Label htmlFor="w9">W-9 on File</Label>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Additional notes about this vendor..."
          rows={2}
        />
      </div>
    </BaseFormDialog>
  );
}

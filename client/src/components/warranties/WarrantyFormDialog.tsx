import { useState, useEffect } from 'react';
import { BaseFormDialog } from '@/components/ui/base-form-dialog';
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
import { useJob } from '@/contexts/JobContext';
import { useDBJobs } from '@/hooks/useFinancialData';
import { useVendors } from '@/hooks/useVendors';
import {
  Warranty,
  warrantyTypes,
  warrantyCategories,
  useCreateWarranty,
  useUpdateWarranty
} from '@/hooks/useWarranties';
import { toast } from 'sonner';

interface WarrantyFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  warranty?: Warranty | null;
}

export function WarrantyFormDialog({ open, onOpenChange, warranty }: WarrantyFormDialogProps) {
  const { selectedJobId } = useJob();
  const createWarranty = useCreateWarranty();
  const updateWarranty = useUpdateWarranty();

  const [formData, setFormData] = useState({
    job_id: '',
    name: '',
    description: '',
    type: 'manufacturer',
    category: '',
    coverage_details: '',
    vendor_id: '',
    manufacturer: '',
    model_number: '',
    serial_number: '',
    contact_name: '',
    contact_phone: '',
    contact_email: '',
    start_date: '',
    end_date: '',
    installation_date: '',
    notes: ''
  });

  const { data: jobs } = useDBJobs();
  const { data: vendors } = useVendors();

  useEffect(() => {
    if (warranty) {
      setFormData({
        job_id: warranty.job_id,
        name: warranty.name,
        description: warranty.description || '',
        type: warranty.type || 'manufacturer',
        category: warranty.category || '',
        coverage_details: warranty.coverage_details || '',
        vendor_id: warranty.vendor_id || '',
        manufacturer: warranty.manufacturer || '',
        model_number: warranty.model_number || '',
        serial_number: warranty.serial_number || '',
        contact_name: warranty.contact_name || '',
        contact_phone: warranty.contact_phone || '',
        contact_email: warranty.contact_email || '',
        start_date: warranty.start_date || '',
        end_date: warranty.end_date || '',
        installation_date: warranty.installation_date || '',
        notes: warranty.notes || ''
      });
    } else {
      setFormData({
        job_id: selectedJobId || '',
        name: '',
        description: '',
        type: 'manufacturer',
        category: '',
        coverage_details: '',
        vendor_id: '',
        manufacturer: '',
        model_number: '',
        serial_number: '',
        contact_name: '',
        contact_phone: '',
        contact_email: '',
        start_date: new Date().toISOString().split('T')[0],
        end_date: '',
        installation_date: '',
        notes: ''
      });
    }
  }, [warranty, selectedJobId, open]);

  const handleSubmit = async () => {
    const warrantyData = {
      job_id: formData.job_id,
      name: formData.name,
      description: formData.description || null,
      type: formData.type,
      category: formData.category || null,
      coverage_details: formData.coverage_details || null,
      vendor_id: formData.vendor_id || null,
      manufacturer: formData.manufacturer || null,
      model_number: formData.model_number || null,
      serial_number: formData.serial_number || null,
      contact_name: formData.contact_name || null,
      contact_phone: formData.contact_phone || null,
      contact_email: formData.contact_email || null,
      start_date: formData.start_date,
      end_date: formData.end_date,
      installation_date: formData.installation_date || null,
      notes: formData.notes || null
    };

    try {
      if (warranty) {
        await updateWarranty.mutateAsync({ id: warranty.id, updates: warrantyData });
        toast.success('Warranty updated');
      } else {
        await createWarranty.mutateAsync(warrantyData);
        toast.success('Warranty created');
      }
      onOpenChange(false);
    } catch (error) {
      toast.error(warranty ? 'Failed to update warranty' : 'Failed to create warranty');
    }
  };

  const isLoading = createWarranty.isPending || updateWarranty.isPending;
  const isEditing = !!warranty;

  return (
    <BaseFormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? 'Edit Warranty' : 'Add Warranty'}
      size="form"
      onSubmit={handleSubmit}
      submitLabel={isEditing ? 'Update Warranty' : 'Create Warranty'}
      isSubmitting={isLoading}
      submitDisabled={!formData.job_id || !formData.name || !formData.start_date || !formData.end_date}
    >
      <div className="grid grid-cols-2 gap-4">
        {/* Job Selection - hidden if job is selected */}
        {!selectedJobId && (
          <div className="col-span-2">
            <Label>Job *</Label>
            <Select
              value={formData.job_id}
              onValueChange={(value) => setFormData({ ...formData, job_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select job" />
              </SelectTrigger>
              <SelectContent>
                {jobs?.map((job) => (
                  <SelectItem key={job.id} value={job.id}>
                    {job.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Name */}
        <div className="col-span-2">
          <Label>Item Name *</Label>
          <Input
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g., HVAC System, Roof, Windows"
          />
        </div>

        {/* Type */}
        <div>
          <Label>Warranty Type</Label>
          <Select
            value={formData.type}
            onValueChange={(value) => setFormData({ ...formData, type: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              {warrantyTypes.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Category */}
        <div>
          <Label>Category</Label>
          <Select
            value={formData.category}
            onValueChange={(value) => setFormData({ ...formData, category: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {warrantyCategories.map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Vendor */}
        <div>
          <Label>Vendor</Label>
          <Select
            value={formData.vendor_id}
            onValueChange={(value) => setFormData({ ...formData, vendor_id: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select vendor" />
            </SelectTrigger>
            <SelectContent>
              {vendors?.map((vendor) => (
                <SelectItem key={vendor.id} value={vendor.id}>
                  {vendor.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Manufacturer */}
        <div>
          <Label>Manufacturer</Label>
          <Input
            value={formData.manufacturer}
            onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
            placeholder="e.g., Carrier, GAF"
          />
        </div>

        {/* Model & Serial */}
        <div>
          <Label>Model Number</Label>
          <Input
            value={formData.model_number}
            onChange={(e) => setFormData({ ...formData, model_number: e.target.value })}
          />
        </div>

        <div>
          <Label>Serial Number</Label>
          <Input
            value={formData.serial_number}
            onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
          />
        </div>

        {/* Dates */}
        <div>
          <Label>Start Date *</Label>
          <Input
            type="date"
            value={formData.start_date}
            onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
          />
        </div>

        <div>
          <Label>End Date *</Label>
          <Input
            type="date"
            value={formData.end_date}
            onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
          />
        </div>

        <div>
          <Label>Installation Date</Label>
          <Input
            type="date"
            value={formData.installation_date}
            onChange={(e) => setFormData({ ...formData, installation_date: e.target.value })}
          />
        </div>
      </div>

      {/* Coverage Details */}
      <div>
        <Label>Coverage Details</Label>
        <Textarea
          value={formData.coverage_details}
          onChange={(e) => setFormData({ ...formData, coverage_details: e.target.value })}
          rows={2}
          placeholder="Describe what is covered under this warranty..."
        />
      </div>

      {/* Contact Info */}
      <div className="border-t pt-4">
        <h4 className="font-medium mb-3">Contact Information</h4>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label>Contact Name</Label>
            <Input
              value={formData.contact_name}
              onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
            />
          </div>
          <div>
            <Label>Contact Phone</Label>
            <Input
              value={formData.contact_phone}
              onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
            />
          </div>
          <div>
            <Label>Contact Email</Label>
            <Input
              type="email"
              value={formData.contact_email}
              onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
            />
          </div>
        </div>
      </div>

      {/* Description */}
      <div>
        <Label>Description</Label>
        <Textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          rows={2}
          placeholder="Additional details about the warranty item..."
        />
      </div>

      {/* Notes */}
      <div>
        <Label>Notes</Label>
        <Textarea
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          rows={2}
          placeholder="Internal notes..."
        />
      </div>
    </BaseFormDialog>
  );
}

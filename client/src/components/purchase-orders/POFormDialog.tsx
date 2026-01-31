import { useEffect, useState, useRef, useCallback } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Combobox } from '@/components/ui/combobox';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2, Building2, Upload, X, FileText, Loader2, Clock, Ruler } from 'lucide-react';
import { useJobs, useVendors, useCostCodes, useCreatePurchaseOrder, useUploadPOAttachment } from '@/hooks/useFinancialData';
import { useScopeCategories, calculateEstimatedDays, getUnitLabel } from '@/hooks/useScopeTracking';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const COST_TYPE_OPTIONS = [
  { value: 'labor', label: 'Labor' },
  { value: 'material', label: 'Material' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'subcontractor', label: 'Subcontractor' },
  { value: 'other', label: 'Other' },
];

const lineItemSchema = z.object({
  title: z.string().min(1, 'Title required'),
  cost_code_id: z.string().min(1, 'Cost code required'),
  description: z.string().optional(),
  cost_type: z.string().optional(),
  unit_cost: z.coerce.number().min(0, 'Must be positive'),
  quantity: z.coerce.number().min(0.01, 'Quantity required'),
});

const poFormSchema = z.object({
  po_number: z.string().min(1, 'PO number required'),
  vendor_id: z.string().min(1, 'Vendor required'),
  job_id: z.string().min(1, 'Job required'),
  description: z.string().optional(),
  scope_of_work: z.string().optional(),
  scope_category_id: z.string().optional(),
  scope_quantity: z.coerce.number().optional(),
  line_items: z.array(lineItemSchema).min(1, 'At least one line item required'),
});

type POFormValues = z.infer<typeof poFormSchema>;

interface PendingFile {
  file: File;
  id: string;
}

interface POFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedJobId?: string | null;
}

export function POFormDialog({ open, onOpenChange, selectedJobId }: POFormDialogProps) {
  const { data: jobs = [] } = useJobs();
  const { data: vendors = [] } = useVendors();
  const { data: costCodes = [] } = useCostCodes();
  const { data: scopeCategories = [] } = useScopeCategories();
  const createPO = useCreatePurchaseOrder();
  const uploadAttachment = useUploadPOAttachment();
  const { toast } = useToast();

  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedJob = selectedJobId ? jobs.find(j => j.id === selectedJobId) : null;

  const form = useForm<POFormValues>({
    resolver: zodResolver(poFormSchema),
    defaultValues: {
      po_number: '',
      vendor_id: '',
      job_id: selectedJobId || '',
      description: '',
      scope_of_work: '',
      scope_category_id: '',
      scope_quantity: undefined,
      line_items: [{ title: '', cost_code_id: '', description: '', cost_type: '', unit_cost: 0, quantity: 1 }],
    },
  });

  // Update job_id when selectedJobId changes
  useEffect(() => {
    if (selectedJobId) {
      form.setValue('job_id', selectedJobId);
    }
  }, [selectedJobId, form]);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      form.reset({
        po_number: '',
        vendor_id: '',
        job_id: selectedJobId || '',
        description: '',
        scope_of_work: '',
        scope_category_id: '',
        scope_quantity: undefined,
        line_items: [{ title: '', cost_code_id: '', description: '', cost_type: '', unit_cost: 0, quantity: 1 }],
      });
      setPendingFiles([]);
    }
  }, [open, selectedJobId, form]);

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'line_items',
  });

  const jobOptions = jobs.map(j => ({ value: j.id, label: j.name }));
  const vendorOptions = vendors.map(v => ({ value: v.id, label: v.name }));
  const costCodeOptions = costCodes.map(c => ({ value: c.id, label: `${c.code} - ${c.name}` }));
  const scopeCategoryOptions = scopeCategories.map(c => ({ value: c.id, label: `${c.name} (${c.trade})` }));

  // Scope tracking calculations
  const watchedScopeCategoryId = form.watch('scope_category_id');
  const watchedScopeQuantity = form.watch('scope_quantity');
  const selectedScopeCategory = scopeCategories.find(c => c.id === watchedScopeCategoryId);
  const estimatedDays = calculateEstimatedDays(selectedScopeCategory, watchedScopeQuantity);
  const unitLabel = getUnitLabel(selectedScopeCategory);

  const lineItems = form.watch('line_items');
  const totalAmount = lineItems.reduce((sum, li) => sum + ((Number(li.unit_cost) || 0) * (Number(li.quantity) || 0)), 0);

  // File handling
  const handleFiles = useCallback((files: FileList | null) => {
    if (!files) return;
    
    const newFiles: PendingFile[] = Array.from(files).map(file => ({
      file,
      id: `${file.name}-${Date.now()}-${Math.random()}`,
    }));
    
    setPendingFiles(prev => [...prev, ...newFiles]);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const removeFile = (id: string) => {
    setPendingFiles(prev => prev.filter(f => f.id !== id));
  };

  const onSubmit = async (data: POFormValues) => {
    const { line_items, scope_category_id, scope_quantity, ...poData } = data;

    try {
      // Create PO with scope tracking data
      const createdPO = await createPO.mutateAsync({
        ...poData,
        original_amount: totalAmount,
        current_amount: totalAmount,
        remaining_amount: totalAmount,
        invoiced_amount: 0,
        change_order_amount: 0,
        status: 'open',
        approval_status: 'pending',
        // Scope tracking fields
        scope_category_id: scope_category_id || null,
        scope_quantity: scope_quantity || null,
        scope_unit: selectedScopeCategory?.primary_unit || null,
        estimated_days: estimatedDays,
        line_items: line_items.map((li) => ({
          cost_code_id: li.cost_code_id || null,
          title: li.title,
          description: li.description || '',
          unit_cost: li.unit_cost || 0,
          quantity: li.quantity || 1,
          amount: (li.unit_cost || 0) * (li.quantity || 0),
        })),
      } as any);

      // Upload pending files if PO was created successfully
      if (createdPO && pendingFiles.length > 0) {
        setIsUploading(true);
        for (const pf of pendingFiles) {
          try {
            await uploadAttachment.mutateAsync({ poId: createdPO.id, file: pf.file });
          } catch (err) {
            console.error('Failed to upload file:', pf.file.name, err);
          }
        }
        setIsUploading(false);
        
        toast({
          title: "Files uploaded",
          description: `${pendingFiles.length} file(s) attached to PO`,
        });
      }

      form.reset();
      setPendingFiles([]);
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to create PO:', error);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Purchase Order</DialogTitle>
          <DialogDescription>
            {selectedJob ? (
              <span className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Creating PO for <strong>{selectedJob.name}</strong>
              </span>
            ) : (
              'Create a new purchase order for a vendor'
            )}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* PO Details */}
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="po_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>PO Number</FormLabel>
                    <FormControl>
                      <Input placeholder="PO-2024-001" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="vendor_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vendor</FormLabel>
                    <FormControl>
                      <Combobox
                        options={vendorOptions}
                        value={field.value}
                        onValueChange={field.onChange}
                        placeholder="Select vendor..."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Only show job selector if no job is pre-selected */}
              {!selectedJobId && (
                <FormField
                  control={form.control}
                  name="job_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Job</FormLabel>
                      <FormControl>
                        <Combobox
                          options={jobOptions}
                          value={field.value}
                          onValueChange={field.onChange}
                          placeholder="Select job..."
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Input placeholder="Brief description of work" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="scope_of_work"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Scope of Work</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Detailed scope of work..."
                      className="min-h-[80px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Scope Tracking Section */}
            <div className="p-4 border rounded-lg bg-muted/30 space-y-4">
              <div className="flex items-center gap-2">
                <Ruler className="h-4 w-4 text-muted-foreground" />
                <Label className="text-base font-medium">Performance Tracking (Optional)</Label>
              </div>
              <p className="text-sm text-muted-foreground">
                Track scope and calculate estimated duration based on historical performance data.
              </p>

              <div className="grid gap-4 md:grid-cols-3">
                <FormField
                  control={form.control}
                  name="scope_category_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Scope Category</FormLabel>
                      <FormControl>
                        <Combobox
                          options={scopeCategoryOptions}
                          value={field.value || ''}
                          onValueChange={field.onChange}
                          placeholder="Select category..."
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="scope_quantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Quantity {selectedScopeCategory && `(${unitLabel})`}
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder={selectedScopeCategory ? `Enter ${unitLabel}` : 'Select category first'}
                          disabled={!selectedScopeCategory}
                          {...field}
                          value={field.value ?? ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div>
                  <Label className="text-sm">Estimated Duration</Label>
                  <div className="mt-2 p-3 border rounded-md bg-background">
                    {estimatedDays !== null ? (
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-primary" />
                        <span className="text-lg font-semibold">{estimatedDays} days</span>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        {selectedScopeCategory ? 'Enter quantity' : 'Select category and quantity'}
                      </span>
                    )}
                  </div>
                  {selectedScopeCategory && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Based on {selectedScopeCategory.baseline_days_per_unit} days/{selectedScopeCategory.primary_unit}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Line Items */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-medium">Line Items</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append({ title: '', cost_code_id: '', description: '', cost_type: '', unit_cost: 0, quantity: 1 })}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Line
                </Button>
              </div>

              {/* Line Item Headers */}
              <div className="hidden md:grid md:grid-cols-12 gap-2 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                <div className="col-span-3">Title</div>
                <div className="col-span-2">Cost Code</div>
                <div className="col-span-2">Cost Type</div>
                <div className="col-span-2">Unit Cost</div>
                <div className="col-span-2">Qty</div>
                <div className="col-span-1"></div>
              </div>

              <div className="space-y-3">
                {fields.map((field, index) => {
                  const unitCost = Number(form.watch(`line_items.${index}.unit_cost`)) || 0;
                  const quantity = Number(form.watch(`line_items.${index}.quantity`)) || 0;
                  const lineTotal = unitCost * quantity;

                  return (
                    <div key={field.id} className="p-3 border rounded-lg bg-muted/30 space-y-3">
                      {/* Top Row: Title, Cost Code, Cost Type, Unit Cost, Qty */}
                      <div className="grid gap-2 md:grid-cols-12 items-start">
                        {/* Title */}
                        <div className="md:col-span-3">
                          <Label className="text-xs text-muted-foreground md:hidden">Title</Label>
                          <Input
                            {...form.register(`line_items.${index}.title`)}
                            placeholder="Item title"
                          />
                          {form.formState.errors.line_items?.[index]?.title && (
                            <p className="text-xs text-destructive mt-1">
                              {form.formState.errors.line_items[index]?.title?.message}
                            </p>
                          )}
                        </div>

                        {/* Cost Code */}
                        <div className="md:col-span-2">
                          <Label className="text-xs text-muted-foreground md:hidden">Cost Code *</Label>
                          <Combobox
                            options={costCodeOptions}
                            value={form.watch(`line_items.${index}.cost_code_id`) || ''}
                            onValueChange={(val) => form.setValue(`line_items.${index}.cost_code_id`, val)}
                            placeholder="Required"
                          />
                          {form.formState.errors.line_items?.[index]?.cost_code_id && (
                            <p className="text-xs text-destructive mt-1">Cost code required</p>
                          )}
                        </div>

                        {/* Cost Type */}
                        <div className="md:col-span-2">
                          <Label className="text-xs text-muted-foreground md:hidden">Cost Type</Label>
                          <Select
                            value={form.watch(`line_items.${index}.cost_type`) || ''}
                            onValueChange={(val) => form.setValue(`line_items.${index}.cost_type`, val)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Type..." />
                            </SelectTrigger>
                            <SelectContent>
                              {COST_TYPE_OPTIONS.map(opt => (
                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Unit Cost */}
                        <div className="md:col-span-2">
                          <Label className="text-xs text-muted-foreground md:hidden">Unit Cost</Label>
                          <Input
                            type="number"
                            step="0.01"
                            {...form.register(`line_items.${index}.unit_cost`)}
                            placeholder="0.00"
                          />
                        </div>

                        {/* Quantity */}
                        <div className="md:col-span-2">
                          <Label className="text-xs text-muted-foreground md:hidden">Quantity</Label>
                          <Input
                            type="number"
                            step="0.01"
                            {...form.register(`line_items.${index}.quantity`)}
                            placeholder="1"
                          />
                        </div>

                        {/* Delete */}
                        <div className="md:col-span-1 flex items-center justify-end">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => fields.length > 1 && remove(index)}
                            disabled={fields.length === 1}
                          >
                            <Trash2 className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </div>
                      </div>

                      {/* Bottom Row: Description (full width) */}
                      <div>
                        <Label className="text-xs text-muted-foreground">Description</Label>
                        <Textarea
                          {...form.register(`line_items.${index}.description`)}
                          placeholder="Detailed description of work..."
                          className="min-h-[60px] mt-1"
                        />
                      </div>

                      {/* Line Total (mobile) */}
                      <div className="flex justify-end md:hidden">
                        <span className="text-sm font-medium">
                          Line Total: ${lineTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-end pt-2 border-t">
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Total Amount</p>
                  <p className="text-2xl font-bold">
                    ${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </div>

            {/* File Upload Section */}
            <div className="space-y-3">
              <Label className="text-base font-medium">Attachments</Label>
              
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={cn(
                  "border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer",
                  isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
                )}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => handleFiles(e.target.files)}
                />
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm font-medium">
                  Drop files here or <span className="text-primary">browse</span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  PDFs, images, documents up to 20MB
                </p>
              </div>

              {/* Pending Files List */}
              {pendingFiles.length > 0 && (
                <div className="space-y-2">
                  {pendingFiles.map((pf) => (
                    <div key={pf.id} className="flex items-center gap-3 p-2 border rounded-lg bg-muted/30">
                      <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{pf.file.name}</p>
                        <p className="text-xs text-muted-foreground">{formatFileSize(pf.file.size)}</p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeFile(pf.id)}
                        className="h-8 w-8"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createPO.isPending || isUploading}>
                {createPO.isPending || isUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {isUploading ? 'Uploading files...' : 'Creating...'}
                  </>
                ) : (
                  'Create PO'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

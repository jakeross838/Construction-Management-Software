import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useDBJobs } from '@/hooks/useFinancialData';
import { useVendors } from '@/hooks/useVendors';
import { useCostCodes } from '@/hooks/useCostCodes';
import {
  useCreateSelection,
  useUpdateSelection,
  Selection,
  CATEGORY_OPTIONS,
  ROOM_AREA_OPTIONS,
  SelectionCategory,
} from '@/hooks/useSelections';

const formSchema = z.object({
  job_id: z.string().min(1, 'Job is required'),
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  category: z.string().min(1, 'Category is required'),
  room_area: z.string().optional(),
  allowance_amount: z.coerce.number().min(0).default(0),
  actual_cost: z.coerce.number().min(0).default(0),
  cost_code_id: z.string().optional(),
  vendor_id: z.string().optional(),
  lead_time_days: z.coerce.number().min(0).optional(),
  expected_delivery: z.string().optional(),
  is_required: z.boolean().default(true),
  due_date: z.string().optional(),
  image_url: z.string().url().optional().or(z.literal('')),
  reference_url: z.string().url().optional().or(z.literal('')),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface SelectionFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selection?: Selection | null;
  defaultJobId?: string | null;
}

export function SelectionFormDialog({
  open,
  onOpenChange,
  selection,
  defaultJobId,
}: SelectionFormDialogProps) {
  const { data: jobs = [] } = useDBJobs();
  const { data: vendors = [] } = useVendors();
  const { data: costCodes = [] } = useCostCodes();
  const createMutation = useCreateSelection();
  const updateMutation = useUpdateSelection();

  const isEditing = !!selection;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      job_id: '',
      name: '',
      description: '',
      category: '',
      room_area: '',
      allowance_amount: 0,
      actual_cost: 0,
      cost_code_id: '',
      vendor_id: '',
      lead_time_days: undefined,
      expected_delivery: '',
      is_required: true,
      due_date: '',
      image_url: '',
      reference_url: '',
      notes: '',
    },
  });

  useEffect(() => {
    if (open) {
      if (selection) {
        form.reset({
          job_id: selection.job_id,
          name: selection.name,
          description: selection.description || '',
          category: selection.category,
          room_area: selection.room_area || '',
          allowance_amount: selection.allowance_amount,
          actual_cost: selection.actual_cost,
          cost_code_id: selection.cost_code_id || '',
          vendor_id: selection.vendor_id || '',
          lead_time_days: selection.lead_time_days || undefined,
          expected_delivery: selection.expected_delivery || '',
          is_required: selection.is_required,
          due_date: selection.due_date || '',
          image_url: selection.image_url || '',
          reference_url: selection.reference_url || '',
          notes: selection.notes || '',
        });
      } else {
        form.reset({
          job_id: defaultJobId || '',
          name: '',
          description: '',
          category: '',
          room_area: '',
          allowance_amount: 0,
          actual_cost: 0,
          cost_code_id: '',
          vendor_id: '',
          lead_time_days: undefined,
          expected_delivery: '',
          is_required: true,
          due_date: '',
          image_url: '',
          reference_url: '',
          notes: '',
        });
      }
    }
  }, [open, selection, defaultJobId, form]);

  const onSubmit = async (values: FormValues) => {
    const basePayload = {
      name: values.name,
      category: values.category as SelectionCategory,
      allowance_amount: values.allowance_amount,
      actual_cost: values.actual_cost,
      is_required: values.is_required,
      room_area: values.room_area || null,
      cost_code_id: values.cost_code_id || null,
      vendor_id: values.vendor_id || null,
      lead_time_days: values.lead_time_days || null,
      expected_delivery: values.expected_delivery || null,
      due_date: values.due_date || null,
      image_url: values.image_url || null,
      reference_url: values.reference_url || null,
      notes: values.notes || null,
      description: values.description || null,
    };

    if (isEditing && selection) {
      await updateMutation.mutateAsync({ id: selection.id, ...basePayload });
    } else {
      // For create, job_id is required
      await createMutation.mutateAsync({
        ...basePayload,
        job_id: values.job_id,
      });
    }
    onOpenChange(false);
  };

  const isPending = createMutation.isPending || updateMutation.isPending;
  const showJobSelect = !defaultJobId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Edit Selection' : 'New Selection'}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Basic Info */}
            <div className="grid gap-4 md:grid-cols-2">
              {showJobSelect && (
                <FormField
                  control={form.control}
                  name="job_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Job *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select job" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {jobs.map((job) => (
                            <SelectItem key={job.id} value={job.id}>
                              {job.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className={showJobSelect ? '' : 'md:col-span-2'}>
                    <FormLabel>Selection Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Kitchen Faucet" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {CATEGORY_OPTIONS.map((cat) => (
                          <SelectItem key={cat.value} value={cat.value}>
                            {cat.icon} {cat.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="room_area"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Room/Area</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select room" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {ROOM_AREA_OPTIONS.map((room) => (
                          <SelectItem key={room} value={room}>
                            {room}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Detailed description of the selection..."
                      className="resize-none"
                      rows={2}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Financial */}
            <div className="grid gap-4 md:grid-cols-3">
              <FormField
                control={form.control}
                name="allowance_amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Allowance ($)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" min="0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="actual_cost"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Actual Cost ($)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" min="0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="cost_code_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cost Code</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select cost code" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {costCodes.map((cc) => (
                          <SelectItem key={cc.id} value={cc.id}>
                            {cc.code} - {cc.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Procurement */}
            <div className="grid gap-4 md:grid-cols-3">
              <FormField
                control={form.control}
                name="vendor_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vendor</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select vendor" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {vendors.map((v) => (
                          <SelectItem key={v.id} value={v.id}>
                            {v.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="lead_time_days"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lead Time (days)</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="expected_delivery"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expected Delivery</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* References */}
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="image_url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Image URL</FormLabel>
                    <FormControl>
                      <Input placeholder="https://..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="reference_url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reference URL</FormLabel>
                    <FormControl>
                      <Input placeholder="https://..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Dates & Required */}
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="due_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Decision Due Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="is_required"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-3 pt-8">
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormLabel className="!mt-0">Required Selection</FormLabel>
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Internal Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Notes for the team..."
                      className="resize-none"
                      rows={2}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Saving...' : isEditing ? 'Update' : 'Create'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

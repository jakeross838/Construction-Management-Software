import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { useJobs } from '@/hooks/useJobs';
import { useCostCodes } from '@/hooks/useCostCodes';
import {
  Submittal,
  useCreateSubmittal,
  useUpdateSubmittal,
  submittalTypeConfig,
  SubmittalType,
} from '@/hooks/useSubmittals';

const submittalSchema = z.object({
  job_id: z.string().min(1, 'Job is required'),
  title: z.string().min(1, 'Title is required'),
  type: z.enum(['shop_drawing', 'product_data', 'sample', 'mock_up', 'other']).default('shop_drawing'),
  spec_section: z.string().optional(),
  cost_code_id: z.string().optional(),
  description: z.string().optional(),
  submitted_by: z.string().optional(),
  submitted_to: z.string().optional(),
  subcontractor: z.string().optional(),
  manufacturer: z.string().optional(),
  date_required: z.string().optional(),
  lead_time_days: z.coerce.number().optional(),
  notes: z.string().optional(),
});

type SubmittalFormData = z.infer<typeof submittalSchema>;

interface SubmittalFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submittal?: Submittal | null;
  defaultJobId?: string;
}

export function SubmittalFormDialog({
  open,
  onOpenChange,
  submittal,
  defaultJobId,
}: SubmittalFormDialogProps) {
  const isEditing = !!submittal;
  const { data: jobs } = useJobs();
  const { data: costCodes } = useCostCodes();
  const createSubmittal = useCreateSubmittal();
  const updateSubmittal = useUpdateSubmittal();

  const form = useForm<SubmittalFormData>({
    resolver: zodResolver(submittalSchema),
    defaultValues: {
      job_id: defaultJobId || '',
      title: '',
      type: 'shop_drawing',
      spec_section: '',
      cost_code_id: '',
      description: '',
      submitted_by: '',
      submitted_to: '',
      subcontractor: '',
      manufacturer: '',
      date_required: '',
      lead_time_days: undefined,
      notes: '',
    },
  });

  // Reset form when dialog opens or submittal changes
  useEffect(() => {
    if (open) {
      if (submittal) {
        form.reset({
          job_id: submittal.job_id,
          title: submittal.title,
          type: submittal.type,
          spec_section: submittal.spec_section || '',
          cost_code_id: submittal.cost_code_id || '',
          description: submittal.description || '',
          submitted_by: submittal.submitted_by || '',
          submitted_to: submittal.submitted_to || '',
          subcontractor: submittal.subcontractor || '',
          manufacturer: submittal.manufacturer || '',
          date_required: submittal.date_required || '',
          lead_time_days: submittal.lead_time_days ?? undefined,
          notes: submittal.notes || '',
        });
      } else {
        form.reset({
          job_id: defaultJobId || '',
          title: '',
          type: 'shop_drawing',
          spec_section: '',
          cost_code_id: '',
          description: '',
          submitted_by: '',
          submitted_to: '',
          subcontractor: '',
          manufacturer: '',
          date_required: '',
          lead_time_days: undefined,
          notes: '',
        });
      }
    }
  }, [open, submittal, defaultJobId, form]);

  const onSubmit = async (data: SubmittalFormData) => {
    try {
      // Clean up empty strings to undefined
      const cleanData = {
        ...data,
        cost_code_id: data.cost_code_id || undefined,
        spec_section: data.spec_section || undefined,
        description: data.description || undefined,
        submitted_by: data.submitted_by || undefined,
        submitted_to: data.submitted_to || undefined,
        subcontractor: data.subcontractor || undefined,
        manufacturer: data.manufacturer || undefined,
        date_required: data.date_required || undefined,
        notes: data.notes || undefined,
      };

      if (isEditing && submittal) {
        await updateSubmittal.mutateAsync({ id: submittal.id, ...cleanData });
      } else {
        await createSubmittal.mutateAsync(cleanData);
      }
      onOpenChange(false);
    } catch {
      // Error handled by mutation
    }
  };

  const isSubmitting = createSubmittal.isPending || updateSubmittal.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? `Edit ${submittal.submittal_number}` : 'Create Submittal'}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Job Selection */}
            <FormField
              control={form.control}
              name="job_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Job *</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={isEditing}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select job" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {jobs?.map((job) => (
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

            {/* Title and Type */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Kitchen Cabinets" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(Object.keys(submittalTypeConfig) as SubmittalType[]).map((type) => (
                          <SelectItem key={type} value={type}>
                            {submittalTypeConfig[type].label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Spec Section and Cost Code */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="spec_section"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Spec Section</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., 06 41 00" {...field} />
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
                    <Select onValueChange={field.onChange} value={field.value || ''}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select cost code" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {costCodes?.map((cc) => (
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

            {/* Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Detailed description of the submittal..."
                      className="min-h-[80px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Subcontractor and Manufacturer */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="subcontractor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Subcontractor</FormLabel>
                    <FormControl>
                      <Input placeholder="Subcontractor name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="manufacturer"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Manufacturer</FormLabel>
                    <FormControl>
                      <Input placeholder="Manufacturer name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Submitted By/To */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="submitted_by"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Submitted By</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Jake Ross" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="submitted_to"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Submitted To</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Architect" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Dates and Lead Time */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="date_required"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date Required</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
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
                      <Input type="number" placeholder="0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Additional notes..."
                      className="resize-none"
                      rows={2}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditing ? 'Update Submittal' : 'Create Submittal'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

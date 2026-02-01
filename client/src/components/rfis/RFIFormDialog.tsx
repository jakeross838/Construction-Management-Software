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
import {
  RFI,
  useCreateRFI,
  useUpdateRFI,
  rfiPriorityConfig,
  RFIPriority,
} from '@/hooks/useRFIs';

const rfiSchema = z.object({
  job_id: z.string().min(1, 'Job is required'),
  subject: z.string().min(1, 'Subject is required'),
  question: z.string().min(1, 'Question is required'),
  reference_drawings: z.string().optional(),
  reference_specs: z.string().optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  assigned_to: z.string().optional(),
  due_date: z.string().optional(),
  date_required: z.string().optional(),
  cost_impact: z.coerce.number().optional(),
  schedule_impact_days: z.coerce.number().optional(),
  notes: z.string().optional(),
});

type RFIFormData = z.infer<typeof rfiSchema>;

interface RFIFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rfi?: RFI | null;
  defaultJobId?: string;
}

export function RFIFormDialog({
  open,
  onOpenChange,
  rfi,
  defaultJobId,
}: RFIFormDialogProps) {
  const isEditing = !!rfi;
  const { data: jobs } = useJobs();
  const createRFI = useCreateRFI();
  const updateRFI = useUpdateRFI();

  const form = useForm<RFIFormData>({
    resolver: zodResolver(rfiSchema),
    defaultValues: {
      job_id: defaultJobId || '',
      subject: '',
      question: '',
      reference_drawings: '',
      reference_specs: '',
      priority: 'normal',
      assigned_to: '',
      due_date: '',
      date_required: '',
      cost_impact: undefined,
      schedule_impact_days: undefined,
      notes: '',
    },
  });

  // Reset form when dialog opens or rfi changes
  useEffect(() => {
    if (open) {
      if (rfi) {
        form.reset({
          job_id: rfi.job_id,
          subject: rfi.subject,
          question: rfi.question,
          reference_drawings: rfi.reference_drawings || '',
          reference_specs: rfi.reference_specs || '',
          priority: rfi.priority,
          assigned_to: rfi.assigned_to || '',
          due_date: rfi.due_date || '',
          date_required: rfi.date_required || '',
          cost_impact: rfi.cost_impact ?? undefined,
          schedule_impact_days: rfi.schedule_impact_days ?? undefined,
          notes: rfi.notes || '',
        });
      } else {
        form.reset({
          job_id: defaultJobId || '',
          subject: '',
          question: '',
          reference_drawings: '',
          reference_specs: '',
          priority: 'normal',
          assigned_to: '',
          due_date: '',
          date_required: '',
          cost_impact: undefined,
          schedule_impact_days: undefined,
          notes: '',
        });
      }
    }
  }, [open, rfi, defaultJobId, form]);

  const onSubmit = async (data: RFIFormData) => {
    try {
      if (isEditing && rfi) {
        await updateRFI.mutateAsync({ id: rfi.id, ...data });
      } else {
        await createRFI.mutateAsync(data);
      }
      onOpenChange(false);
    } catch {
      // Error handled by mutation
    }
  };

  const isSubmitting = createRFI.isPending || updateRFI.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? `Edit RFI ${rfi.rfi_number}` : 'Create RFI'}
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

            {/* Subject */}
            <FormField
              control={form.control}
              name="subject"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Subject *</FormLabel>
                  <FormControl>
                    <Input placeholder="Brief summary of the question" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Question */}
            <FormField
              control={form.control}
              name="question"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Question *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Detailed question or request for information..."
                      className="min-h-[120px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Reference Documents */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="reference_drawings"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reference Drawings</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Sheet A-102" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="reference_specs"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reference Specifications</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Section 06 10 00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Priority and Assignment */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(Object.keys(rfiPriorityConfig) as RFIPriority[]).map((priority) => (
                          <SelectItem key={priority} value={priority}>
                            {rfiPriorityConfig[priority].label}
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
                name="assigned_to"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assigned To</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Architect" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="due_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Due Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="date_required"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date Required on Site</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Impact */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="cost_impact"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cost Impact ($)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="0.00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="schedule_impact_days"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Schedule Impact (days)</FormLabel>
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
                {isEditing ? 'Update RFI' : 'Create RFI'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

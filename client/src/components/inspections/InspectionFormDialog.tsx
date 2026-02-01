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
  Inspection,
  useCreateInspection,
  useUpdateInspection,
  useInspectionTypes,
} from '@/hooks/useInspections';

const inspectionSchema = z.object({
  job_id: z.string().min(1, 'Job is required'),
  inspection_type: z.string().min(1, 'Inspection type is required'),
  scheduled_date: z.string().min(1, 'Scheduled date is required'),
  scheduled_time: z.string().optional(),
  inspector_name: z.string().optional(),
  inspector_phone: z.string().optional(),
  inspector_agency: z.string().optional(),
});

type InspectionFormData = z.infer<typeof inspectionSchema>;

interface InspectionFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inspection?: Inspection | null;
  defaultJobId?: string;
}

export function InspectionFormDialog({
  open,
  onOpenChange,
  inspection,
  defaultJobId,
}: InspectionFormDialogProps) {
  const isEditing = !!inspection;
  const { data: jobs } = useJobs();
  const { data: inspectionTypes } = useInspectionTypes();
  const createInspection = useCreateInspection();
  const updateInspection = useUpdateInspection();

  const form = useForm<InspectionFormData>({
    resolver: zodResolver(inspectionSchema),
    defaultValues: {
      job_id: defaultJobId || '',
      inspection_type: '',
      scheduled_date: '',
      scheduled_time: '',
      inspector_name: '',
      inspector_phone: '',
      inspector_agency: '',
    },
  });

  // Reset form when dialog opens or inspection changes
  useEffect(() => {
    if (open) {
      if (inspection) {
        form.reset({
          job_id: inspection.job_id,
          inspection_type: inspection.inspection_type,
          scheduled_date: inspection.scheduled_date,
          scheduled_time: inspection.scheduled_time || '',
          inspector_name: inspection.inspector_name || '',
          inspector_phone: inspection.inspector_phone || '',
          inspector_agency: inspection.inspector_agency || '',
        });
      } else {
        form.reset({
          job_id: defaultJobId || '',
          inspection_type: '',
          scheduled_date: '',
          scheduled_time: '',
          inspector_name: '',
          inspector_phone: '',
          inspector_agency: '',
        });
      }
    }
  }, [open, inspection, defaultJobId, form]);

  const onSubmit = async (data: InspectionFormData) => {
    try {
      const cleanData = {
        ...data,
        scheduled_time: data.scheduled_time || undefined,
        inspector_name: data.inspector_name || undefined,
        inspector_phone: data.inspector_phone || undefined,
        inspector_agency: data.inspector_agency || undefined,
      };

      if (isEditing && inspection) {
        await updateInspection.mutateAsync({
          id: inspection.id,
          ...cleanData,
          updated_by: 'Jake Ross',
        });
      } else {
        await createInspection.mutateAsync({
          ...cleanData,
          created_by: 'Jake Ross',
        });
      }
      onOpenChange(false);
    } catch {
      // Error handled by mutation
    }
  };

  const isSubmitting = createInspection.isPending || updateInspection.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Edit Inspection' : 'Schedule Inspection'}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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

            {/* Inspection Type */}
            <FormField
              control={form.control}
              name="inspection_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Inspection Type *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {inspectionTypes?.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Date and Time */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="scheduled_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="scheduled_time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Time</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Inspector Info */}
            <FormField
              control={form.control}
              name="inspector_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Inspector Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Inspector name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="inspector_phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input placeholder="(555) 123-4567" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="inspector_agency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Agency</FormLabel>
                    <FormControl>
                      <Input placeholder="Agency name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditing ? 'Update' : 'Schedule'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

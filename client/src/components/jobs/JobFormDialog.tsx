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
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Job,
  useCreateJob,
  useUpdateJob,
  statusOptions,
  constructionTypeOptions,
  architecturalStyleOptions,
} from '@/hooks/useJobs';

const jobFormSchema = z.object({
  name: z.string().min(1, 'Job name is required').max(100),
  client: z.string().max(100).optional().or(z.literal('')),
  address: z.string().max(200).optional().or(z.literal('')),
  status: z.string().default('planning'),
  budget_amount: z.coerce.number().min(0).optional(),
  contract_amount: z.coerce.number().min(0).optional(),
  start_date: z.string().optional().or(z.literal('')),
  end_date: z.string().optional().or(z.literal('')),
  percent_complete: z.coerce.number().min(0).max(100).optional(),
  project_manager: z.string().max(100).optional().or(z.literal('')),
  site_supervisor: z.string().max(100).optional().or(z.literal('')),
  architect: z.string().max(100).optional().or(z.literal('')),
  engineer: z.string().max(100).optional().or(z.literal('')),
  client_email: z.string().email().optional().or(z.literal('')),
  client_phone: z.string().max(20).optional().or(z.literal('')),
  client_cell: z.string().max(20).optional().or(z.literal('')),
  square_footage: z.coerce.number().min(0).optional(),
  bedrooms: z.coerce.number().min(0).optional(),
  bathrooms: z.coerce.number().min(0).optional(),
  half_baths: z.coerce.number().min(0).optional(),
  stories: z.coerce.number().min(1).optional(),
  garage_spaces: z.coerce.number().min(0).optional(),
  construction_type: z.string().optional().or(z.literal('')),
  architectural_style: z.string().optional().or(z.literal('')),
  target_margin: z.coerce.number().min(0).max(100).optional(),
  retainage_percent: z.coerce.number().min(0).max(100).optional(),
  notes: z.string().max(2000).optional().or(z.literal('')),
});

type JobFormValues = z.infer<typeof jobFormSchema>;

interface JobFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job?: Job | null;
}

export function JobFormDialog({ open, onOpenChange, job }: JobFormDialogProps) {
  const isEditing = !!job;
  const createJob = useCreateJob();
  const updateJob = useUpdateJob();

  const form = useForm<JobFormValues>({
    resolver: zodResolver(jobFormSchema),
    defaultValues: {
      name: '',
      client: '',
      address: '',
      status: 'planning',
      budget_amount: 0,
      contract_amount: 0,
      start_date: '',
      end_date: '',
      percent_complete: 0,
      project_manager: '',
      site_supervisor: '',
      architect: '',
      engineer: '',
      client_email: '',
      client_phone: '',
      client_cell: '',
      square_footage: 0,
      bedrooms: 0,
      bathrooms: 0,
      half_baths: 0,
      stories: 1,
      garage_spaces: 0,
      construction_type: '',
      architectural_style: '',
      target_margin: 10,
      retainage_percent: 10,
      notes: '',
    },
  });

  useEffect(() => {
    if (job) {
      form.reset({
        name: job.name || '',
        client: job.client || '',
        address: job.address || '',
        status: job.status || 'planning',
        budget_amount: job.budget_amount || 0,
        contract_amount: job.contract_amount || 0,
        start_date: job.start_date || '',
        end_date: job.end_date || '',
        percent_complete: job.percent_complete || 0,
        project_manager: job.project_manager || '',
        site_supervisor: job.site_supervisor || '',
        architect: job.architect || '',
        engineer: job.engineer || '',
        client_email: job.client_email || '',
        client_phone: job.client_phone || '',
        client_cell: job.client_cell || '',
        square_footage: job.square_footage || 0,
        bedrooms: job.bedrooms || 0,
        bathrooms: job.bathrooms || 0,
        half_baths: job.half_baths || 0,
        stories: job.stories || 1,
        garage_spaces: job.garage_spaces || 0,
        construction_type: job.construction_type || '',
        architectural_style: job.architectural_style || '',
        target_margin: job.target_margin || 10,
        retainage_percent: job.retainage_percent || 10,
        notes: job.notes || '',
      });
    } else {
      form.reset({
        name: '',
        client: '',
        address: '',
        status: 'planning',
        budget_amount: 0,
        contract_amount: 0,
        start_date: '',
        end_date: '',
        percent_complete: 0,
        project_manager: '',
        site_supervisor: '',
        architect: '',
        engineer: '',
        client_email: '',
        client_phone: '',
        client_cell: '',
        square_footage: 0,
        bedrooms: 0,
        bathrooms: 0,
        half_baths: 0,
        stories: 1,
        garage_spaces: 0,
        construction_type: '',
        architectural_style: '',
        target_margin: 10,
        retainage_percent: 10,
        notes: '',
      });
    }
  }, [job, form]);

  const handleSubmit = async (values: JobFormValues) => {
    try {
      if (isEditing && job) {
        await updateJob.mutateAsync({ id: job.id, ...values });
      } else {
        await createJob.mutateAsync(values);
      }
      onOpenChange(false);
    } catch (error) {
      // Error handled by mutation
    }
  };

  const isPending = createJob.isPending || updateJob.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>{isEditing ? 'Edit Job' : 'Create New Job'}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col flex-1 min-h-0">
            <ScrollArea className="flex-1 -mx-6 px-6">
              <div className="py-4 space-y-6">
                <Tabs defaultValue="general" className="w-full">
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="general">General</TabsTrigger>
                    <TabsTrigger value="client">Client</TabsTrigger>
                    <TabsTrigger value="specs">Specs</TabsTrigger>
                    <TabsTrigger value="financials">Financials</TabsTrigger>
                  </TabsList>

                  <TabsContent value="general" className="space-y-4 mt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Job Name *</FormLabel>
                            <FormControl>
                              <Input placeholder="Lakewood Estate" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="status"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Status</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select status" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {statusOptions.map((opt) => (
                                  <SelectItem key={opt.value} value={opt.value}>
                                    {opt.label}
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
                      name="address"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Project Address</FormLabel>
                          <FormControl>
                            <Input placeholder="123 Main St, Austin TX" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="start_date"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Start Date</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="end_date"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Target Completion</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="project_manager"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Project Manager</FormLabel>
                            <FormControl>
                              <Input placeholder="John Smith" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="site_supervisor"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Site Supervisor</FormLabel>
                            <FormControl>
                              <Input placeholder="Mike Johnson" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="architect"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Architect</FormLabel>
                            <FormControl>
                              <Input placeholder="Architect name" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="engineer"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Engineer</FormLabel>
                            <FormControl>
                              <Input placeholder="Engineer name" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Notes</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Additional job notes..."
                              className="resize-none"
                              rows={3}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </TabsContent>

                  <TabsContent value="client" className="space-y-4 mt-4">
                    <FormField
                      control={form.control}
                      name="client"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Client Name</FormLabel>
                          <FormControl>
                            <Input placeholder="The Morrison Family" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="client_email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Client Email</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="client@email.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="client_phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Client Phone</FormLabel>
                            <FormControl>
                              <Input placeholder="512-555-1234" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="client_cell"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Client Cell</FormLabel>
                            <FormControl>
                              <Input placeholder="512-555-5678" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </TabsContent>

                  <TabsContent value="specs" className="space-y-4 mt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="construction_type"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Construction Type</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value || ''}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {constructionTypeOptions.map((opt) => (
                                  <SelectItem key={opt.value} value={opt.value}>
                                    {opt.label}
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
                        name="architectural_style"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Architectural Style</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value || ''}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select style" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {architecturalStyleOptions.map((opt) => (
                                  <SelectItem key={opt.value} value={opt.value}>
                                    {opt.label}
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
                      name="square_footage"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Square Footage</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="4500" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-4 gap-4">
                      <FormField
                        control={form.control}
                        name="bedrooms"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Bedrooms</FormLabel>
                            <FormControl>
                              <Input type="number" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="bathrooms"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Full Baths</FormLabel>
                            <FormControl>
                              <Input type="number" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="half_baths"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Half Baths</FormLabel>
                            <FormControl>
                              <Input type="number" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="stories"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Stories</FormLabel>
                            <FormControl>
                              <Input type="number" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="garage_spaces"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Garage Spaces</FormLabel>
                          <FormControl>
                            <Input type="number" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </TabsContent>

                  <TabsContent value="financials" className="space-y-4 mt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="contract_amount"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Contract Amount ($)</FormLabel>
                            <FormControl>
                              <Input type="number" placeholder="2500000" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="budget_amount"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Budget Amount ($)</FormLabel>
                            <FormControl>
                              <Input type="number" placeholder="2000000" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="target_margin"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Target Margin (%)</FormLabel>
                            <FormControl>
                              <Input type="number" placeholder="20" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="retainage_percent"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Retainage (%)</FormLabel>
                            <FormControl>
                              <Input type="number" placeholder="10" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="percent_complete"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>% Complete</FormLabel>
                            <FormControl>
                              <Input type="number" placeholder="0" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </ScrollArea>

            <DialogFooter className="flex-shrink-0 gap-2 sm:gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Job'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

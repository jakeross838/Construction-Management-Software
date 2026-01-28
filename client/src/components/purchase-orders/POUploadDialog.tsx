import { useState, useEffect } from 'react';
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
import { Badge } from '@/components/ui/badge';
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
  Upload, 
  FileText, 
  Plus, 
  Trash2, 
  Building2, 
  Loader2, 
  Sparkles, 
  CheckCircle, 
  AlertCircle 
} from 'lucide-react';
import { useJobs, useVendors, useCostCodes, useCreatePurchaseOrder } from '@/hooks/useFinancialData';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const lineItemSchema = z.object({
  cost_code_id: z.string().optional(),
  description: z.string().min(1, 'Description required'),
  amount: z.coerce.number().min(0.01, 'Amount must be positive'),
});

const poFormSchema = z.object({
  po_number: z.string().min(1, 'PO number required'),
  vendor_id: z.string().min(1, 'Vendor required'),
  job_id: z.string().min(1, 'Job required'),
  description: z.string().optional(),
  scope_of_work: z.string().optional(),
  line_items: z.array(lineItemSchema).min(1, 'At least one line item required'),
});

type POFormValues = z.infer<typeof poFormSchema>;

interface ProcessingStep {
  id: string;
  label: string;
  status: 'pending' | 'active' | 'complete' | 'error';
}

interface AIConfidence {
  vendor_name: number;
  total_amount: number;
  line_items: number;
}

interface POUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedJobId?: string | null;
}

export function POUploadDialog({ open, onOpenChange, selectedJobId }: POUploadDialogProps) {
  const [step, setStep] = useState<'upload' | 'processing' | 'review'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [aiConfidence, setAiConfidence] = useState<AIConfidence | null>(null);
  const [extractedVendorName, setExtractedVendorName] = useState<string | null>(null);
  const [processingSteps, setProcessingSteps] = useState<ProcessingStep[]>([
    { id: 'upload', label: 'Reading document', status: 'pending' },
    { id: 'extract', label: 'Extracting quote data with AI', status: 'pending' },
    { id: 'match', label: 'Matching vendor', status: 'pending' },
  ]);

  const { data: jobs = [] } = useJobs();
  const { data: vendors = [] } = useVendors();
  const { data: costCodes = [] } = useCostCodes();
  const createPO = useCreatePurchaseOrder();

  const selectedJob = selectedJobId ? jobs.find(j => j.id === selectedJobId) : null;

  const form = useForm<POFormValues>({
    resolver: zodResolver(poFormSchema),
    defaultValues: {
      po_number: '',
      vendor_id: '',
      job_id: selectedJobId || '',
      description: '',
      scope_of_work: '',
      line_items: [{ cost_code_id: '', description: '', amount: 0 }],
    },
  });

  const { fields, append, remove, replace } = useFieldArray({
    control: form.control,
    name: 'line_items',
  });

  const jobOptions = jobs.map(j => ({ value: j.id, label: j.name }));
  const vendorOptions = vendors.map(v => ({ value: v.id, label: v.name }));
  const costCodeOptions = costCodes.map(c => ({ value: c.id, label: `${c.code} - ${c.name}` }));

  const lineItems = form.watch('line_items');
  const totalAmount = lineItems.reduce((sum, li) => sum + (Number(li.amount) || 0), 0);

  useEffect(() => {
    if (selectedJobId) {
      form.setValue('job_id', selectedJobId);
    }
  }, [selectedJobId, form]);

  const updateStep = (stepId: string, status: ProcessingStep['status']) => {
    setProcessingSteps(prev => 
      prev.map(s => s.id === stepId ? { ...s, status } : s)
    );
  };

  const convertFileToBase64 = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const matchVendor = (vendorName: string | null): string => {
    if (!vendorName) return '';
    
    const lowerName = vendorName.toLowerCase();
    const matched = vendors.find(v => 
      v.name.toLowerCase().includes(lowerName) ||
      lowerName.includes(v.name.toLowerCase())
    );
    
    return matched?.id || '';
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    const validTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
    if (!validTypes.includes(selectedFile.type)) {
      toast.error('Please upload a PDF or image file');
      return;
    }
    if (selectedFile.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }

    setFile(selectedFile);
    setStep('processing');
    setProcessingSteps(prev => prev.map(s => ({ ...s, status: 'pending' })));

    try {
      // Step 1: Read file
      updateStep('upload', 'active');
      const imageBase64 = await convertFileToBase64(selectedFile);
      const mimeType = selectedFile.type;
      updateStep('upload', 'complete');

      // Step 2: Call AI extraction
      updateStep('extract', 'active');
      const { data: extractionResult, error: functionError } = await supabase.functions.invoke('extract-po', {
        body: { imageBase64, mimeType }
      });

      if (functionError) {
        throw new Error(functionError.message || 'Failed to extract document data');
      }

      if (!extractionResult?.success) {
        throw new Error(extractionResult?.error || 'Failed to extract document data');
      }

      const extracted = extractionResult.data;
      updateStep('extract', 'complete');

      // Step 3: Match vendor
      updateStep('match', 'active');
      const matchedVendorId = matchVendor(extracted.vendor_name);
      setExtractedVendorName(extracted.vendor_name);
      setAiConfidence(extracted.confidence);
      updateStep('match', 'complete');

      // Populate form with extracted data
      form.setValue('vendor_id', matchedVendorId);
      form.setValue('description', extracted.description || '');
      form.setValue('scope_of_work', extracted.scope_of_work || '');
      
      // Set line items from extraction
      if (extracted.line_items && extracted.line_items.length > 0) {
        replace(extracted.line_items.map((li: any) => ({
          cost_code_id: '',
          description: li.description || '',
          amount: li.amount || 0,
        })));
      }

      setStep('review');
      toast.success('Quote data extracted successfully!');

    } catch (error) {
      console.error('Processing error:', error);
      
      setProcessingSteps(prev => 
        prev.map(s => s.status === 'active' ? { ...s, status: 'error' } : s)
      );

      toast.error(error instanceof Error ? error.message : 'Failed to process document');
      
      setTimeout(() => {
        setStep('review');
      }, 1500);
    }
  };

  const onSubmit = async (data: POFormValues) => {
    const { line_items, ...poData } = data;
    
    await createPO.mutateAsync({
      ...poData,
      original_amount: totalAmount,
      current_amount: totalAmount,
      remaining_amount: totalAmount,
      invoiced_amount: 0,
      change_order_amount: 0,
      status: 'open',
      approval_status: 'pending',
      line_items: line_items.map((li) => ({
        cost_code_id: li.cost_code_id || null,
        description: li.description,
        amount: li.amount,
      })),
    } as any);

    resetForm();
    onOpenChange(false);
  };

  const resetForm = () => {
    setStep('upload');
    setFile(null);
    setAiConfidence(null);
    setExtractedVendorName(null);
    setProcessingSteps(prev => prev.map(s => ({ ...s, status: 'pending' })));
    form.reset({
      po_number: '',
      vendor_id: '',
      job_id: selectedJobId || '',
      description: '',
      scope_of_work: '',
      line_items: [{ cost_code_id: '', description: '', amount: 0 }],
    });
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      resetForm();
    }
    onOpenChange(open);
  };

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 0.8) return <Badge variant="default" className="bg-green-500">High</Badge>;
    if (confidence >= 0.5) return <Badge variant="secondary" className="bg-amber-500 text-white">Medium</Badge>;
    return <Badge variant="destructive">Low</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step === 'upload' && (
              <>
                <Sparkles className="h-5 w-5 text-primary" />
                AI Upload - Create PO from Quote
              </>
            )}
            {step === 'processing' && (
              <>
                <Sparkles className="h-5 w-5 text-primary" />
                AI Processing Document
              </>
            )}
            {step === 'review' && 'Review & Create Purchase Order'}
          </DialogTitle>
          <DialogDescription>
            {step === 'upload' && 'Upload a vendor quote, proposal, or bid to automatically extract PO details'}
            {step === 'review' && selectedJob && (
              <span className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Creating PO for <strong>{selectedJob.name}</strong>
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4">
            <div 
              className="border-2 border-dashed rounded-lg p-12 text-center cursor-pointer hover:border-primary transition-colors"
              onClick={() => document.getElementById('po-file')?.click()}
            >
              <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-medium">Drag & drop quote/proposal here</p>
              <p className="text-sm text-muted-foreground mt-1">PDF, PNG, or JPG up to 10MB</p>
              <input
                id="po-file"
                type="file"
                accept=".pdf,image/png,image/jpeg,image/jpg"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
            <p className="text-sm text-muted-foreground text-center">
              AI will extract vendor, line items, scope of work, and amounts
            </p>
          </div>
        )}

        {step === 'processing' && (
          <div className="py-8 text-center">
            <Loader2 className="h-12 w-12 mx-auto mb-4 animate-spin text-primary" />
            <p className="text-lg font-medium mb-6">Extracting quote data...</p>
            <div className="space-y-3 text-left max-w-sm mx-auto">
              {processingSteps.map((s) => (
                <div key={s.id} className="flex items-center gap-3 text-sm">
                  {s.status === 'complete' && <CheckCircle className="h-5 w-5 text-green-500 shrink-0" />}
                  {s.status === 'active' && <Loader2 className="h-5 w-5 animate-spin text-primary shrink-0" />}
                  {s.status === 'pending' && <div className="h-5 w-5 rounded-full border-2 border-muted shrink-0" />}
                  {s.status === 'error' && <AlertCircle className="h-5 w-5 text-destructive shrink-0" />}
                  <span className={s.status === 'pending' ? 'text-muted-foreground' : ''}>
                    {s.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 'review' && (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {file && (
                <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                  <FileText className="h-5 w-5 text-primary" />
                  <span className="font-medium flex-1">{file.name}</span>
                  {aiConfidence && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Sparkles className="h-3 w-3" />
                      AI Extracted
                    </div>
                  )}
                </div>
              )}

              {aiConfidence && (
                <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
                  <div className="flex items-center gap-2 mb-2 text-sm font-medium">
                    <Sparkles className="h-4 w-4 text-primary" />
                    AI Extraction Confidence
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <div className="flex items-center gap-1 text-xs">
                      <span className="text-muted-foreground">Vendor:</span>
                      {getConfidenceBadge(aiConfidence.vendor_name)}
                    </div>
                    <div className="flex items-center gap-1 text-xs">
                      <span className="text-muted-foreground">Amount:</span>
                      {getConfidenceBadge(aiConfidence.total_amount)}
                    </div>
                    <div className="flex items-center gap-1 text-xs">
                      <span className="text-muted-foreground">Line Items:</span>
                      {getConfidenceBadge(aiConfidence.line_items)}
                    </div>
                  </div>
                  {extractedVendorName && !form.watch('vendor_id') && (
                    <p className="text-xs text-amber-600 mt-2">
                      ⚠️ Vendor "{extractedVendorName}" not found. Please select manually.
                    </p>
                  )}
                </div>
              )}

              {/* PO Details */}
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="po_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>PO Number *</FormLabel>
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
                      <FormLabel>Vendor *</FormLabel>
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

                {!selectedJobId && (
                  <FormField
                    control={form.control}
                    name="job_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Job *</FormLabel>
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

              {/* Line Items */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-medium">Line Items</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => append({ cost_code_id: '', description: '', amount: 0 })}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Line
                  </Button>
                </div>

                <div className="space-y-3">
                  {fields.map((field, index) => (
                    <div key={field.id} className="grid gap-3 md:grid-cols-12 items-start p-3 border rounded-lg">
                      <div className="md:col-span-3">
                        <Label className="text-xs text-muted-foreground">Cost Code</Label>
                        <Combobox
                          options={costCodeOptions}
                          value={form.watch(`line_items.${index}.cost_code_id`) || ''}
                          onValueChange={(val) => form.setValue(`line_items.${index}.cost_code_id`, val)}
                          placeholder="Select..."
                        />
                      </div>
                      <div className="md:col-span-5">
                        <Label className="text-xs text-muted-foreground">Description</Label>
                        <Input
                          {...form.register(`line_items.${index}.description`)}
                          placeholder="Work description"
                        />
                        {form.formState.errors.line_items?.[index]?.description && (
                          <p className="text-xs text-destructive mt-1">
                            {form.formState.errors.line_items[index]?.description?.message}
                          </p>
                        )}
                      </div>
                      <div className="md:col-span-3">
                        <Label className="text-xs text-muted-foreground">Amount</Label>
                        <Input
                          type="number"
                          step="0.01"
                          {...form.register(`line_items.${index}.amount`)}
                          placeholder="0.00"
                        />
                      </div>
                      <div className="md:col-span-1 flex items-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => fields.length > 1 && remove(index)}
                          disabled={fields.length === 1}
                          className="mt-5"
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </div>
                    </div>
                  ))}
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

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => handleClose(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createPO.isPending}>
                  {createPO.isPending ? 'Creating...' : 'Create PO'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}

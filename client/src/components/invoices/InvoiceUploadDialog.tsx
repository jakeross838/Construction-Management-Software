import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Combobox } from '@/components/ui/combobox';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, FileText, CheckCircle, Loader2, AlertCircle, Sparkles, AlertTriangle, Building2, Briefcase, FileWarning } from 'lucide-react';
import { AIProcessingAnimation } from '@/components/ai/AIProcessingAnimation';
import { Vendor } from '@/types/financial';
import { useCreateInvoice, useUpdateInvoice, usePurchaseOrders } from '@/hooks/useFinancialData';
import { useDBJobs } from '@/hooks/useFinancialData';
import { useStampInvoice } from '@/hooks/useInvoiceStamping';
import { useRecordCorrection } from '@/hooks/useAILearning';
import { useInvoiceAI, AIExtractionResult, REVIEW_FLAG_LABELS, getConfidenceColor, getConfidenceLabel } from '@/hooks/useInvoiceAI';
import { toast } from 'sonner';

interface InvoiceUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendors: Vendor[];
  selectedJobId: string | null;
}

interface ProcessingStep {
  id: string;
  label: string;
  status: 'pending' | 'active' | 'complete' | 'error';
}

export function InvoiceUploadDialog({
  open,
  onOpenChange,
  vendors,
  selectedJobId,
}: InvoiceUploadDialogProps) {
  const [step, setStep] = useState<'upload' | 'processing' | 'review'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [createdInvoiceId, setCreatedInvoiceId] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<AIExtractionResult | null>(null);
  const [currentProcessingStep, setCurrentProcessingStep] = useState(0);
  const [processingSteps, setProcessingSteps] = useState<ProcessingStep[]>([
    { id: 'upload', label: 'Uploading file', status: 'pending' },
    { id: 'extract', label: 'Extracting invoice data with AI', status: 'pending' },
    { id: 'match', label: 'Matching vendor, job, and PO', status: 'pending' },
    { id: 'suggest', label: 'Suggesting cost codes', status: 'pending' },
  ]);
  const [formData, setFormData] = useState({
    invoice_number: '',
    vendor_id: '',
    job_id: selectedJobId || '',
    po_id: '',
    amount: '',
    invoice_date: new Date().toISOString().split('T')[0],
    due_date: '',
    notes: '',
    is_credit: false,
  });

  const { data: jobs = [] } = useDBJobs();
  const { data: purchaseOrders = [] } = usePurchaseOrders();
  const createInvoice = useCreateInvoice();
  const updateInvoice = useUpdateInvoice();
  const stampInvoice = useStampInvoice();
  const recordCorrection = useRecordCorrection();
  const { extractInvoiceData, isProcessing, processingStep } = useInvoiceAI();

  const vendorOptions = vendors.map(v => ({
    value: v.id,
    label: v.name,
  }));

  const jobOptions = jobs.map(j => ({
    value: j.id,
    label: j.name,
    description: j.address || undefined,
  }));

  // Filter POs by selected job if job is selected
  const filteredPOs = formData.job_id
    ? purchaseOrders.filter(po => po.job_id === formData.job_id)
    : purchaseOrders;

  const poOptions = filteredPOs.map(po => ({
    value: po.id,
    label: po.po_number,
    description: po.description || po.vendor_name || undefined,
  }));

  const updateStep = (stepId: string, status: ProcessingStep['status']) => {
    setProcessingSteps(prev =>
      prev.map(s => s.id === stepId ? { ...s, status } : s)
    );
    // Update current step index for animation
    const stepIndex = processingSteps.findIndex(s => s.id === stepId);
    if (status === 'active' && stepIndex >= 0) {
      setCurrentProcessingStep(stepIndex);
    } else if (status === 'complete' && stepIndex >= 0) {
      setCurrentProcessingStep(stepIndex + 1);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(selectedFile.type)) {
      toast.error('Please upload a PDF or image file');
      return;
    }
    if (selectedFile.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }

    setFile(selectedFile);
    setStep('processing');

    // Reset processing steps
    setCurrentProcessingStep(0);
    setProcessingSteps(prev => prev.map(s => ({ ...s, status: 'pending' })));

    try {
      // Step 1-4: Upload + AI extraction with matching (API handles storage)
      updateStep('upload', 'active');
      updateStep('extract', 'active');
      const result = await extractInvoiceData(selectedFile);

      updateStep('upload', 'complete');
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to extract invoice data');
      }
      
      updateStep('extract', 'complete');
      updateStep('match', 'complete');
      updateStep('suggest', 'complete');

      setAiResult(result);

      // Store the created invoice ID from the API
      if (result.invoiceId) {
        setCreatedInvoiceId(result.invoiceId);
      }

      // Populate form with extracted and matched data
      const extracted = result.data;
      setFormData(prev => ({
        ...prev,
        invoice_number: extracted?.invoice_number || '',
        vendor_id: result.matchedVendor?.id || '',
        job_id: result.matchedJob?.id || selectedJobId || '',
        po_id: result.matchedPO?.id || '',
        amount: extracted?.amount?.toString() || '',
        invoice_date: extracted?.invoice_date || prev.invoice_date,
        due_date: extracted?.due_date || '',
        is_credit: extracted?.invoice_type === 'credit_memo',
      }));

      setStep('review');
      
      // Show appropriate toast based on results
      if (result.possibleDuplicate) {
        toast.warning(`Possible duplicate of invoice ${result.possibleDuplicate.invoice_number}`);
      } else if (result.needsReview && result.reviewFlags?.length) {
        toast.info('Invoice extracted - please review flagged items');
      } else {
        toast.success('Invoice data extracted successfully!');
      }

    } catch (error) {
      console.error('Processing error:', error);
      
      // Mark current active step as error
      setProcessingSteps(prev => 
        prev.map(s => s.status === 'active' ? { ...s, status: 'error' } : s)
      );

      toast.error(error instanceof Error ? error.message : 'Failed to process invoice');
      
      // Still allow manual entry
      setTimeout(() => {
        setStep('review');
      }, 1500);
    }
  };

  const handleVendorChange = (vendorId: string) => {
    // Record correction if AI extracted a vendor name and user selected differently
    const aiVendorId = aiResult?.matchedVendor?.id;
    const aiVendorName = aiResult?.data?.vendor_name || aiResult?.extracted?.vendor?.companyName;
    if (aiVendorName && vendorId && vendorId !== aiVendorId) {
      recordCorrection.mutate({
        entityType: 'vendor',
        extractedValue: aiVendorName,
        correctedId: vendorId
      });
    }
    setFormData(prev => ({ ...prev, vendor_id: vendorId }));
  };

  const handleJobChange = (jobId: string) => {
    // Record correction if AI extracted job info and user selected differently
    const aiJobId = aiResult?.matchedJob?.id;
    const extractedJobRef = aiResult?.extracted?.job?.reference ||
                           aiResult?.extracted?.job?.clientName ||
                           aiResult?.extracted?.job?.address;
    if (extractedJobRef && jobId && jobId !== aiJobId) {
      recordCorrection.mutate({
        entityType: 'job',
        extractedValue: extractedJobRef,
        correctedId: jobId
      });
    }
    setFormData(prev => ({ ...prev, job_id: jobId }));
  };

  const handleSubmit = async () => {
    if (!formData.invoice_number || !formData.amount || !formData.invoice_date) {
      toast.error('Please fill in required fields');
      return;
    }

    try {
      // Build update data for any user corrections
      const updateData: Record<string, unknown> = {
        invoice_number: formData.invoice_number,
        vendor_id: formData.vendor_id || null,
        job_id: formData.job_id || null,
        po_id: formData.po_id || null,
        amount: parseFloat(formData.amount),
        invoice_date: formData.invoice_date,
        due_date: formData.due_date || null,
        notes: formData.notes || null,
        is_credit: formData.is_credit,
      };

      let invoiceId = createdInvoiceId;
      let pdfUrl = aiResult?.pdfUrl;

      if (createdInvoiceId) {
        // Invoice was already created by AI processing - just update with user corrections
        await updateInvoice.mutateAsync({ id: createdInvoiceId, ...updateData });
      } else {
        // Manual entry mode - create new invoice
        const aiData = aiResult ? {
          extracted: aiResult.extracted,
          matchedVendor: aiResult.matchedVendor,
          matchedJob: aiResult.matchedJob,
          matchedPO: aiResult.matchedPO,
          reviewFlags: aiResult.reviewFlags,
          overallConfidence: aiResult.overallConfidence
        } : null;

        const invoiceData: Record<string, unknown> = {
          ...updateData,
          status: 'needs_approval',
          ai_confidence: aiResult?.data?.confidence,
          ai_extracted_data: aiData,
          needs_review: aiResult?.needsReview ?? true,
          review_flags: aiResult?.reviewFlags || [],
          matched_confidence: {
            vendor: aiResult?.matchedVendor?.confidence,
            job: aiResult?.matchedJob?.confidence,
            po: aiResult?.matchedPO?.confidence,
            overall: aiResult?.overallConfidence
          },
        };

        const newInvoice = await createInvoice.mutateAsync(invoiceData);
        invoiceId = newInvoice?.id;
      }

      // Stamp the invoice with "Needs Review" stamp (if PDF exists)
      if (invoiceId && pdfUrl) {
        try {
          await stampInvoice.mutateAsync({
            invoiceId,
            status: 'needs_approval',
          });
        } catch (stampError) {
          console.error('Stamping error:', stampError);
        }
      }

      toast.success('Invoice saved successfully');
      onOpenChange(false);
      resetForm();
    } catch (error) {
      // Error is handled by the mutation
    }
  };

  const resetForm = () => {
    setStep('upload');
    setFile(null);
    setCreatedInvoiceId(null);
    setAiResult(null);
    setCurrentProcessingStep(0);
    setProcessingSteps(prev => prev.map(s => ({ ...s, status: 'pending' })));
    setFormData({
      invoice_number: '',
      vendor_id: '',
      job_id: selectedJobId || '',
      po_id: '',
      amount: '',
      invoice_date: new Date().toISOString().split('T')[0],
      due_date: '',
      notes: '',
      is_credit: false,
    });
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      resetForm();
    }
    onOpenChange(open);
  };

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 0.85) return <Badge variant="default" className="bg-green-500">High</Badge>;
    if (confidence >= 0.70) return <Badge variant="secondary" className="bg-amber-500 text-white">Medium</Badge>;
    return <Badge variant="destructive">Low</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step === 'upload' && 'Upload Invoice'}
            {step === 'processing' && (
              <>
                <Sparkles className="h-5 w-5 text-primary" />
                AI Processing Invoice
              </>
            )}
            {step === 'review' && 'Review Invoice Details'}
          </DialogTitle>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4">
            <div 
              className="border-2 border-dashed rounded-lg p-12 text-center cursor-pointer hover:border-primary transition-colors"
              onClick={() => document.getElementById('invoice-file')?.click()}
            >
              <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-medium">Drag & drop PDF or image here</p>
              <p className="text-sm text-muted-foreground mt-1">or click to browse</p>
              <input
                id="invoice-file"
                type="file"
                accept=".pdf,image/*"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
            <p className="text-sm text-muted-foreground text-center">
              AI will automatically extract vendor, amount, dates, match to jobs & POs, and suggest cost codes
            </p>
            
            <div className="flex justify-center">
              <Button variant="outline" onClick={() => setStep('review')}>
                Enter Manually Instead
              </Button>
            </div>
          </div>
        )}

        {step === 'processing' && (
          <AIProcessingAnimation
            statusMessage={processingStep || 'Analyzing invoice...'}
            documentType="Invoice"
            currentStep={currentProcessingStep}
            classificationComplete={currentProcessingStep >= 1}
            processingComplete={currentProcessingStep >= 4}
          />
        )}

        {step === 'review' && (
          <div className="space-y-4">
            {file && (
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                <FileText className="h-5 w-5 text-primary" />
                <span className="font-medium flex-1">{file.name}</span>
                {aiResult?.overallConfidence && (
                  <div className="flex items-center gap-2 text-xs">
                    <Sparkles className="h-3 w-3" />
                    <span className={getConfidenceColor(aiResult.overallConfidence)}>
                      {getConfidenceLabel(aiResult.overallConfidence)} ({Math.round(aiResult.overallConfidence * 100)}%)
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Possible Duplicate Warning */}
            {aiResult?.possibleDuplicate && (
              <Alert variant="destructive">
                <FileWarning className="h-4 w-4" />
                <AlertDescription>
                  <strong>Possible duplicate!</strong> This may be a duplicate of invoice {aiResult.possibleDuplicate.invoice_number} (${aiResult.possibleDuplicate.amount.toLocaleString()})
                </AlertDescription>
              </Alert>
            )}

            {/* Review Flags */}
            {aiResult?.reviewFlags && aiResult.reviewFlags.length > 0 && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {aiResult.reviewFlags.map(flag => {
                      const flagInfo = REVIEW_FLAG_LABELS[flag] || { label: flag, severity: 'info' };
                      return (
                        <Badge 
                          key={flag} 
                          variant={flagInfo.severity === 'error' ? 'destructive' : flagInfo.severity === 'warning' ? 'secondary' : 'outline'}
                        >
                          {flagInfo.label}
                        </Badge>
                      );
                    })}
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* AI Confidence & Match Info */}
            {aiResult?.data?.confidence && (
              <div className="p-3 bg-primary/5 rounded-lg border border-primary/20 space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Sparkles className="h-4 w-4 text-primary" />
                  AI Extraction Results
                </div>
                
                {/* Extraction confidence */}
                <div className="flex flex-wrap gap-3">
                  <div className="flex items-center gap-1 text-xs">
                    <span className="text-muted-foreground">Invoice #:</span>
                    {getConfidenceBadge(aiResult.data.confidence.invoice_number)}
                  </div>
                  <div className="flex items-center gap-1 text-xs">
                    <span className="text-muted-foreground">Amount:</span>
                    {getConfidenceBadge(aiResult.data.confidence.amount)}
                  </div>
                  <div className="flex items-center gap-1 text-xs">
                    <span className="text-muted-foreground">Vendor:</span>
                    {getConfidenceBadge(aiResult.data.confidence.vendor_name)}
                  </div>
                  <div className="flex items-center gap-1 text-xs">
                    <span className="text-muted-foreground">Date:</span>
                    {getConfidenceBadge(aiResult.data.confidence.invoice_date)}
                  </div>
                </div>

                {/* Matched entities */}
                <div className="flex flex-wrap gap-4 pt-2 border-t border-primary/10">
                  {aiResult.matchedVendor && (
                    <div className="flex items-center gap-2 text-xs">
                      <Building2 className="h-3 w-3 text-muted-foreground" />
                      <span className="text-muted-foreground">Vendor:</span>
                      <span className="font-medium">{aiResult.matchedVendor.name}</span>
                      <span className={getConfidenceColor(aiResult.matchedVendor.confidence)}>
                        ({Math.round(aiResult.matchedVendor.confidence * 100)}%)
                      </span>
                    </div>
                  )}
                  {aiResult.matchedJob && (
                    <div className="flex items-center gap-2 text-xs">
                      <Briefcase className="h-3 w-3 text-muted-foreground" />
                      <span className="text-muted-foreground">Job:</span>
                      <span className="font-medium">{aiResult.matchedJob.name}</span>
                      <span className={getConfidenceColor(aiResult.matchedJob.confidence)}>
                        ({Math.round(aiResult.matchedJob.confidence * 100)}%)
                      </span>
                    </div>
                  )}
                </div>

                {/* Warnings for unmatched */}
                {aiResult.data.vendor_name && !aiResult.matchedVendor && (
                  <p className="text-xs text-amber-600">
                    ⚠️ Vendor "{aiResult.data.vendor_name}" not found in system. Please select manually.
                  </p>
                )}
              </div>
            )}

            {/* Cost Code Suggestions */}
            {aiResult?.suggestions?.costCodes && aiResult.suggestions.costCodes.length > 0 && (
              <div className="p-3 bg-secondary/30 rounded-lg border">
                <div className="text-sm font-medium mb-2">Suggested Cost Codes</div>
                <div className="flex flex-wrap gap-2">
                  {aiResult.suggestions.costCodes.slice(0, 3).map(cc => (
                    <Badge key={cc.id} variant="outline" className="text-xs">
                      {cc.code} - {cc.name}
                      <span className="ml-1 text-muted-foreground">({Math.round(cc.confidence * 100)}%)</span>
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Credit memo indicator */}
            {formData.is_credit && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  This appears to be a <strong>Credit Memo</strong>. The amount will be recorded as a credit.
                </AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="invoice_number">Invoice Number *</Label>
                <Input
                  id="invoice_number"
                  value={formData.invoice_number}
                  onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                  placeholder="INV-001"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount">Amount *</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Vendor</Label>
                <Combobox
                  options={vendorOptions}
                  value={formData.vendor_id}
                  onValueChange={handleVendorChange}
                  placeholder="Select vendor..."
                  searchPlaceholder="Search vendors..."
                />
                {/* Vendor suggestions */}
                {!formData.vendor_id && aiResult?.suggestions?.vendors && aiResult.suggestions.vendors.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    <span className="text-xs text-muted-foreground">Suggestions:</span>
                    {aiResult.suggestions.vendors.slice(0, 3).map(v => (
                      <Button
                        key={v.id}
                        variant="ghost"
                        size="sm"
                        className="h-5 px-1 text-xs"
                        onClick={() => handleVendorChange(v.id)}
                      >
                        {v.name}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
              {/* Only show job selector if no job is pre-selected */}
              {!selectedJobId && (
                <div className="space-y-2">
                  <Label>Job</Label>
                  <Combobox
                    options={jobOptions}
                    value={formData.job_id}
                    onValueChange={handleJobChange}
                    placeholder="Select job..."
                    searchPlaceholder="Search jobs..."
                  />
                  {/* Job suggestions */}
                  {!formData.job_id && aiResult?.suggestions?.jobs && aiResult.suggestions.jobs.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      <span className="text-xs text-muted-foreground">Suggestions:</span>
                      {aiResult.suggestions.jobs.slice(0, 3).map(j => (
                        <Button
                          key={j.id}
                          variant="ghost"
                          size="sm"
                          className="h-5 px-1 text-xs"
                          onClick={() => handleJobChange(j.id)}
                        >
                          {j.name}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* PO Selector */}
            <div className="space-y-2">
              <Label>Purchase Order</Label>
              <Combobox
                options={poOptions}
                value={formData.po_id}
                onValueChange={(poId) => setFormData({ ...formData, po_id: poId })}
                placeholder="Select PO (optional)..."
                searchPlaceholder="Search POs..."
              />
              {formData.job_id && poOptions.length === 0 && (
                <p className="text-xs text-muted-foreground">No POs found for this job</p>
              )}
              {/* PO suggestion from AI */}
              {!formData.po_id && aiResult?.matchedPO && (
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-muted-foreground">AI Matched:</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 px-1 text-xs"
                    onClick={() => setFormData({ ...formData, po_id: aiResult.matchedPO!.id })}
                  >
                    {aiResult.matchedPO.po_number} ({Math.round(aiResult.matchedPO.confidence * 100)}%)
                  </Button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="invoice_date">Invoice Date *</Label>
                <Input
                  id="invoice_date"
                  type="date"
                  value={formData.invoice_date}
                  onChange={(e) => setFormData({ ...formData, invoice_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="due_date">Due Date</Label>
                <Input
                  id="due_date"
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Add any notes..."
                rows={2}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => handleClose(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={createInvoice.isPending}>
                {createInvoice.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Invoice'
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
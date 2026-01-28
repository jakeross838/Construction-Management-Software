import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sparkles,
  Upload,
  X,
  CheckCircle,
  Loader2,
  AlertCircle,
  DollarSign,
  Package,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useVendors } from '@/hooks/useVendors';
import { useJobs } from '@/hooks/useJobs';
import { useCreatePriceEntry, useCreateMasterItem, useMasterItems } from '@/hooks/usePricing';
import { useQueryClient } from '@tanstack/react-query';

interface ExtractedLineItem {
  item_name: string;
  description?: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total_price: number;
  category: string;
}

interface ExtractedData {
  vendor_name?: string;
  document_date?: string;
  document_number?: string;
  document_type?: string;
  line_items: ExtractedLineItem[];
  confidence?: number;
}

interface UploadedFile {
  id: string;
  file: File;
  status: 'pending' | 'processing' | 'extracted' | 'saving' | 'complete' | 'error';
  extractedData?: ExtractedData;
  error?: string;
}

const SOURCE_TYPES = [
  { value: 'invoice', label: 'Invoice' },
  { value: 'quote', label: 'Quote' },
  { value: 'catalog', label: 'Catalog' },
  { value: 'manual', label: 'Manual Entry' },
];

export function PriceUploadButton() {
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [sourceType, setSourceType] = useState('invoice');
  const [selectedVendor, setSelectedVendor] = useState<string>('');
  const [selectedJob, setSelectedJob] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  const { data: vendors = [] } = useVendors();
  const { data: jobs = [] } = useJobs();
  const { data: masterItems = [] } = useMasterItems();
  const createPriceEntry = useCreatePriceEntry();
  const createMasterItem = useCreateMasterItem();
  const queryClient = useQueryClient();

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    addFiles(droppedFiles);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      addFiles(selectedFiles);
    }
  };

  const addFiles = (newFiles: File[]) => {
    const uploadFiles: UploadedFile[] = newFiles.map((file) => ({
      id: crypto.randomUUID(),
      file,
      status: 'pending',
    }));

    setFiles((prev) => [...prev, ...uploadFiles]);

    uploadFiles.forEach((uploadFile) => {
      processFile(uploadFile);
    });
  };

  const processFile = async (uploadFile: UploadedFile) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === uploadFile.id ? { ...f, status: 'processing' } : f))
    );

    try {
      // Convert file to base64
      const base64 = await fileToBase64(uploadFile.file);

      const { data, error } = await supabase.functions.invoke('extract-prices', {
        body: {
          file_base64: base64,
          file_name: uploadFile.file.name,
          file_type: uploadFile.file.type,
          vendor_id: selectedVendor || null,
          job_id: selectedJob || null,
          source_type: sourceType,
        },
      });

      if (error) throw error;

      if (data.error) throw new Error(data.error);

      setFiles((prev) =>
        prev.map((f) =>
          f.id === uploadFile.id
            ? { ...f, status: 'extracted', extractedData: data }
            : f
        )
      );
    } catch (error) {
      console.error('Extraction error:', error);
      setFiles((prev) =>
        prev.map((f) =>
          f.id === uploadFile.id
            ? {
                ...f,
                status: 'error',
                error: error instanceof Error ? error.message : 'Extraction failed',
              }
            : f
        )
      );
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
    });
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const saveExtractedPrices = async () => {
    if (!selectedVendor) {
      toast.error('Please select a vendor before saving');
      return;
    }

    setIsSaving(true);
    let savedCount = 0;
    let newItemsCount = 0;

    try {
      for (const uploadFile of files) {
        if (uploadFile.status !== 'extracted' || !uploadFile.extractedData) continue;

        setFiles((prev) =>
          prev.map((f) => (f.id === uploadFile.id ? { ...f, status: 'saving' } : f))
        );

        for (const item of uploadFile.extractedData.line_items) {
          // Find or create master item
          let masterItem = masterItems.find(
            (mi) =>
              mi.name.toLowerCase() === item.item_name.toLowerCase() ||
              mi.name.toLowerCase().includes(item.item_name.toLowerCase())
          );

          if (!masterItem) {
            // Create new master item
            const newItem = await createMasterItem.mutateAsync({
              name: item.item_name,
              category: item.category || 'other',
              description: item.description,
              default_unit: item.unit,
            });
            masterItem = newItem;
            newItemsCount++;
          }

          // Create price entry
          await createPriceEntry.mutateAsync({
            master_item_id: masterItem.id,
            vendor_id: selectedVendor,
            unit_price: item.unit_price,
            unit: item.unit,
            quantity: item.quantity || 1,
            source_type: sourceType as any,
            job_id: selectedJob || undefined,
            notes: uploadFile.extractedData.document_number
              ? `From ${uploadFile.extractedData.document_type || 'document'} #${uploadFile.extractedData.document_number}`
              : undefined,
          });

          savedCount++;
        }

        setFiles((prev) =>
          prev.map((f) => (f.id === uploadFile.id ? { ...f, status: 'complete' } : f))
        );
      }

      toast.success(
        `Saved ${savedCount} price entries${newItemsCount > 0 ? ` and created ${newItemsCount} new items` : ''}`
      );
      
      // Refresh data
      queryClient.invalidateQueries({ queryKey: ['price-history'] });
      queryClient.invalidateQueries({ queryKey: ['current-prices'] });
      queryClient.invalidateQueries({ queryKey: ['master-items'] });
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Failed to save some price entries');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setFiles([]);
    setSelectedVendor('');
    setSelectedJob('');
    setSourceType('invoice');
    setOpen(false);
  };

  const extractedFiles = files.filter((f) => f.status === 'extracted');
  const completedFiles = files.filter((f) => f.status === 'complete');
  const processingFiles = files.filter((f) => f.status === 'processing' || f.status === 'saving');
  const totalLineItems = extractedFiles.reduce(
    (acc, f) => acc + (f.extractedData?.line_items.length || 0),
    0
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) handleClose();
        else setOpen(true);
      }}
    >
      <DialogTrigger asChild>
        <Button className="gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-md">
          <Sparkles className="h-4 w-4" />
          <span className="hidden sm:inline">AI Upload</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Price Extraction
          </DialogTitle>
          <DialogDescription>
            Upload invoices, quotes, or catalogs to automatically extract and save material prices.
          </DialogDescription>
        </DialogHeader>

        {/* Config Row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Source Type</Label>
            <Select value={sourceType} onValueChange={setSourceType}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SOURCE_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Vendor *</Label>
            <Select value={selectedVendor} onValueChange={setSelectedVendor}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select vendor" />
              </SelectTrigger>
              <SelectContent>
                {vendors.map((vendor) => (
                  <SelectItem key={vendor.id} value={vendor.id}>
                    {vendor.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Job (optional)</Label>
            <Select value={selectedJob || "_none"} onValueChange={(v) => setSelectedJob(v === "_none" ? "" : v)}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select job" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">No job</SelectItem>
                {jobs.map((job) => (
                  <SelectItem key={job.id} value={job.id}>
                    {job.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Drop Zone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={cn(
            'border-2 border-dashed rounded-lg p-6 text-center transition-colors',
            isDragging
              ? 'border-primary bg-primary/5'
              : 'border-muted-foreground/25 hover:border-muted-foreground/50'
          )}
        >
          <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground mb-1">
            Drop invoices, quotes, or catalog pages
          </p>
          <label className="cursor-pointer">
            <span className="text-sm text-primary hover:underline">Or click to browse</span>
            <input
              type="file"
              multiple
              className="hidden"
              onChange={handleFileSelect}
              accept=".pdf,.jpg,.jpeg,.png"
            />
          </label>
        </div>

        {/* File List with Extracted Data */}
        {files.length > 0 && (
          <ScrollArea className="flex-1 max-h-[300px]">
            <div className="space-y-3 pr-4">
              {files.map((uploadFile) => (
                <div
                  key={uploadFile.id}
                  className={cn(
                    'rounded-lg border p-3',
                    uploadFile.status === 'complete' &&
                      'bg-green-50 border-green-200 dark:bg-green-900/10 dark:border-green-800',
                    uploadFile.status === 'extracted' &&
                      'bg-blue-50 border-blue-200 dark:bg-blue-900/10 dark:border-blue-800',
                    uploadFile.status === 'error' &&
                      'bg-red-50 border-red-200 dark:bg-red-900/10 dark:border-red-800'
                  )}
                >
                  {/* File Header */}
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        'h-8 w-8 rounded-full flex items-center justify-center shrink-0',
                        uploadFile.status === 'complete' &&
                          'bg-green-100 text-green-600 dark:bg-green-800 dark:text-green-300',
                        uploadFile.status === 'extracted' &&
                          'bg-blue-100 text-blue-600 dark:bg-blue-800 dark:text-blue-300',
                        uploadFile.status === 'processing' &&
                          'bg-amber-100 text-amber-600 dark:bg-amber-800 dark:text-amber-300',
                        uploadFile.status === 'saving' &&
                          'bg-purple-100 text-purple-600 dark:bg-purple-800 dark:text-purple-300',
                        uploadFile.status === 'error' &&
                          'bg-red-100 text-red-600 dark:bg-red-800 dark:text-red-300',
                        uploadFile.status === 'pending' && 'bg-muted text-muted-foreground'
                      )}
                    >
                      {uploadFile.status === 'processing' && (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      )}
                      {uploadFile.status === 'saving' && (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      )}
                      {uploadFile.status === 'extracted' && <DollarSign className="h-4 w-4" />}
                      {uploadFile.status === 'complete' && <CheckCircle className="h-4 w-4" />}
                      {uploadFile.status === 'error' && <AlertCircle className="h-4 w-4" />}
                      {uploadFile.status === 'pending' && <Package className="h-4 w-4" />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{uploadFile.file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {uploadFile.status === 'processing' && 'AI extracting prices...'}
                        {uploadFile.status === 'saving' && 'Saving to database...'}
                        {uploadFile.status === 'extracted' &&
                          `Found ${uploadFile.extractedData?.line_items.length || 0} items`}
                        {uploadFile.status === 'complete' && 'Prices saved'}
                        {uploadFile.status === 'error' && uploadFile.error}
                        {uploadFile.status === 'pending' && 'Waiting...'}
                      </p>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0"
                      onClick={() => removeFile(uploadFile.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>

                  {/* Extracted Items Preview */}
                  {uploadFile.status === 'extracted' && uploadFile.extractedData && (
                    <div className="mt-3 space-y-1.5">
                      {uploadFile.extractedData.line_items.slice(0, 5).map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between text-xs bg-background/50 rounded px-2 py-1"
                        >
                          <span className="truncate flex-1">{item.item_name}</span>
                          <Badge variant="outline" className="ml-2 text-xs">
                            {item.category}
                          </Badge>
                          <span className="ml-2 font-mono font-medium text-green-600">
                            ${item.unit_price.toFixed(2)}/{item.unit}
                          </span>
                        </div>
                      ))}
                      {uploadFile.extractedData.line_items.length > 5 && (
                        <p className="text-xs text-muted-foreground text-center">
                          +{uploadFile.extractedData.line_items.length - 5} more items
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        {/* Progress Summary */}
        {files.length > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {processingFiles.length > 0
                  ? 'Processing...'
                  : `${extractedFiles.length} files ready, ${totalLineItems} line items`}
              </span>
              <span className="font-medium">
                {completedFiles.length}/{files.length} saved
              </span>
            </div>
            <Progress
              value={
                files.length > 0
                  ? ((completedFiles.length + extractedFiles.length * 0.5) / files.length) * 100
                  : 0
              }
              className="h-2"
            />
          </div>
        )}

        {/* Footer Actions */}
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setFiles([])}>
            Clear
          </Button>
          <Button
            onClick={saveExtractedPrices}
            disabled={
              extractedFiles.length === 0 || !selectedVendor || isSaving || processingFiles.length > 0
            }
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              `Save ${totalLineItems} Prices`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

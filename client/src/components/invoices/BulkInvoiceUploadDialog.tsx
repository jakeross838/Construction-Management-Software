import { useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Upload,
  FileText,
  CheckCircle,
  XCircle,
  Loader2,
  Trash2,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { useBulkInvoiceUpload, QueuedFile } from '@/hooks/useBulkInvoiceUpload';
import { useStampInvoice } from '@/hooks/useInvoiceStamping';
import { toast } from 'sonner';

interface BulkInvoiceUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedJobId: string | null;
}

export function BulkInvoiceUploadDialog({
  open,
  onOpenChange,
  selectedJobId,
}: BulkInvoiceUploadDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    queue,
    isProcessing,
    addFiles,
    removeFile,
    clearQueue,
    processQueue,
    retryFile,
    stats,
  } = useBulkInvoiceUpload();

  const stampInvoice = useStampInvoice();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const added = addFiles(files);
      if (added.length < files.length) {
        toast.warning(`${files.length - added.length} files skipped (invalid type or too large)`);
      }
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      addFiles(files);
    }
  };

  const handleSaveCompleted = async () => {
    // Invoices are already created by the API during processing
    // This function now just stamps them if needed and clears the queue
    const completedFiles = queue.filter(f => f.status === 'complete' && f.result?.success);
    let stampedCount = 0;

    for (const qf of completedFiles) {
      try {
        const result = qf.result!;
        const invoiceId = result.invoiceId;
        const pdfUrl = result.pdfUrl;

        // Stamp if we have invoice ID and PDF
        if (invoiceId && pdfUrl) {
          try {
            await stampInvoice.mutateAsync({ invoiceId, status: 'needs_approval' });
            stampedCount++;
          } catch (e) {
            console.error('Stamping error:', e);
          }
        }
      } catch (error) {
        console.error('Error processing invoice:', error);
      }
    }

    const totalCompleted = completedFiles.length;
    if (totalCompleted > 0) {
      toast.success(`${totalCompleted} invoice${totalCompleted !== 1 ? 's' : ''} processed successfully`);
      clearQueue(true);
    }
  };

  const getStatusIcon = (status: QueuedFile['status']) => {
    switch (status) {
      case 'pending':
        return <div className="h-5 w-5 rounded-full border-2 border-muted" />;
      case 'uploading':
      case 'processing':
        return <Loader2 className="h-5 w-5 animate-spin text-primary" />;
      case 'complete':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-destructive" />;
    }
  };

  const getStatusBadge = (qf: QueuedFile) => {
    if (qf.status === 'complete' && qf.result?.success) {
      const confidence = qf.result.overallConfidence || 0;
      if (confidence >= 0.85) return <Badge variant="default" className="bg-green-500">High</Badge>;
      if (confidence >= 0.70) return <Badge variant="secondary" className="bg-amber-500 text-white">Medium</Badge>;
      return <Badge variant="destructive">Low</Badge>;
    }
    if (qf.status === 'error') {
      return <Badge variant="destructive">Failed</Badge>;
    }
    return null;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Bulk Invoice Upload
          </DialogTitle>
        </DialogHeader>

        {/* Drop zone */}
        <div
          className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
        >
          <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
          <p className="font-medium">Drop files here or click to browse</p>
          <p className="text-sm text-muted-foreground mt-1">PDF or images, max 10MB each</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,image/*"
            multiple
            className="hidden"
            onChange={handleFileSelect}
          />
        </div>

        {/* Queue stats */}
        {queue.length > 0 && (
          <div className="flex items-center gap-4 text-sm">
            <span className="text-muted-foreground">
              {stats.total} file{stats.total !== 1 ? 's' : ''}
            </span>
            {stats.pending > 0 && <Badge variant="outline">{stats.pending} pending</Badge>}
            {stats.processing > 0 && <Badge variant="secondary">{stats.processing} processing</Badge>}
            {stats.complete > 0 && <Badge variant="default" className="bg-green-500">{stats.complete} complete</Badge>}
            {stats.error > 0 && <Badge variant="destructive">{stats.error} failed</Badge>}
          </div>
        )}

        {/* Queue list */}
        {queue.length > 0 && (
          <ScrollArea className="flex-1 max-h-[300px] border rounded-lg">
            <div className="p-2 space-y-2">
              {queue.map((qf) => (
                <div
                  key={qf.id}
                  className="flex items-center gap-3 p-2 rounded-lg bg-muted/50"
                >
                  {getStatusIcon(qf.status)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="font-medium truncate text-sm">{qf.file.name}</span>
                      {getStatusBadge(qf)}
                    </div>
                    {(qf.status === 'uploading' || qf.status === 'processing') && (
                      <Progress value={qf.progress} className="h-1 mt-1" />
                    )}
                    {qf.status === 'complete' && qf.result?.data && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {qf.result.data.vendor_name || 'Unknown vendor'} • ${qf.result.data.amount?.toLocaleString() || '0'}
                      </p>
                    )}
                    {qf.status === 'error' && (
                      <p className="text-xs text-destructive mt-1">{qf.error}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {qf.status === 'error' && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => retryFile(qf.id)}>
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    )}
                    {(qf.status === 'pending' || qf.status === 'error') && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeFile(qf.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        {/* Info message */}
        {stats.complete > 0 && (
          <div className="flex items-start gap-2 p-3 bg-primary/5 rounded-lg text-sm">
            <AlertCircle className="h-4 w-4 text-primary mt-0.5" />
            <p>
              {stats.complete} invoice{stats.complete !== 1 ? 's' : ''} extracted.
              Click "Save All" to create invoice records. You can review and edit them individually afterward.
            </p>
          </div>
        )}

        <DialogFooter className="gap-2">
          {queue.length > 0 && (
            <Button variant="outline" onClick={() => clearQueue()} disabled={isProcessing}>
              Clear All
            </Button>
          )}
          {stats.pending > 0 && (
            <Button onClick={processQueue} disabled={isProcessing}>
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                `Process ${stats.pending} File${stats.pending !== 1 ? 's' : ''}`
              )}
            </Button>
          )}
          {stats.complete > 0 && !isProcessing && (
            <Button onClick={handleSaveCompleted}>
              Save All ({stats.complete})
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

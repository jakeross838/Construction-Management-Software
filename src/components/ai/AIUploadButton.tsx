import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { 
  Sparkles, 
  Upload, 
  FileText, 
  Receipt, 
  ClipboardList,
  FileImage,
  X,
  CheckCircle,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface UploadedFile {
  id: string;
  file: File;
  status: 'pending' | 'processing' | 'complete' | 'error';
  category?: string;
  message?: string;
}

const categoryIcons: Record<string, React.ReactNode> = {
  invoice: <Receipt className="h-4 w-4" />,
  purchase_order: <ClipboardList className="h-4 w-4" />,
  contract: <FileText className="h-4 w-4" />,
  photo: <FileImage className="h-4 w-4" />,
  other: <FileText className="h-4 w-4" />,
};

const categoryLabels: Record<string, string> = {
  invoice: 'Invoice',
  purchase_order: 'Purchase Order',
  contract: 'Contract',
  photo: 'Site Photo',
  other: 'Document',
};

export function AIUploadButton() {
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const { toast } = useToast();

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
    const uploadFiles: UploadedFile[] = newFiles.map(file => ({
      id: crypto.randomUUID(),
      file,
      status: 'pending',
    }));
    
    setFiles(prev => [...prev, ...uploadFiles]);
    
    // Simulate AI processing for each file
    uploadFiles.forEach(uploadFile => {
      processFile(uploadFile);
    });
  };

  const processFile = async (uploadFile: UploadedFile) => {
    // Update to processing
    setFiles(prev => prev.map(f => 
      f.id === uploadFile.id ? { ...f, status: 'processing' } : f
    ));

    // Simulate AI processing delay
    await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 1500));

    // Determine category based on file name/type (mock logic)
    const fileName = uploadFile.file.name.toLowerCase();
    let category = 'other';
    if (fileName.includes('invoice') || fileName.includes('inv')) {
      category = 'invoice';
    } else if (fileName.includes('po') || fileName.includes('purchase')) {
      category = 'purchase_order';
    } else if (fileName.includes('contract') || fileName.includes('agreement')) {
      category = 'contract';
    } else if (uploadFile.file.type.startsWith('image/')) {
      category = 'photo';
    }

    // Update to complete
    setFiles(prev => prev.map(f => 
      f.id === uploadFile.id ? { 
        ...f, 
        status: 'complete', 
        category,
        message: `Classified as ${categoryLabels[category]}`
      } : f
    ));
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const handleClose = () => {
    if (files.some(f => f.status === 'complete')) {
      toast({
        title: "Documents processed",
        description: `${files.filter(f => f.status === 'complete').length} document(s) have been sorted and saved.`,
      });
    }
    setFiles([]);
    setOpen(false);
  };

  const completedCount = files.filter(f => f.status === 'complete').length;
  const processingCount = files.filter(f => f.status === 'processing').length;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) handleClose();
      else setOpen(true);
    }}>
      <DialogTrigger asChild>
        <Button 
          className="gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-md"
        >
          <Sparkles className="h-4 w-4" />
          <span className="hidden sm:inline">AI Upload</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Document Upload
          </DialogTitle>
          <DialogDescription>
            Drop files here and AI will automatically classify and route them to the correct location.
          </DialogDescription>
        </DialogHeader>

        {/* Drop Zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={cn(
            "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
            isDragging 
              ? "border-primary bg-primary/5" 
              : "border-muted-foreground/25 hover:border-muted-foreground/50"
          )}
        >
          <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
          <p className="text-sm text-muted-foreground mb-2">
            Drag & drop invoices, POs, contracts, or photos
          </p>
          <label className="cursor-pointer">
            <span className="text-sm text-primary hover:underline">
              Or click to browse files
            </span>
            <input
              type="file"
              multiple
              className="hidden"
              onChange={handleFileSelect}
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
            />
          </label>
        </div>

        {/* File List */}
        {files.length > 0 && (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {files.map((uploadFile) => (
              <div 
                key={uploadFile.id}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border",
                  uploadFile.status === 'complete' && "bg-green-50 border-green-200 dark:bg-green-900/10 dark:border-green-800",
                  uploadFile.status === 'processing' && "bg-blue-50 border-blue-200 dark:bg-blue-900/10 dark:border-blue-800",
                  uploadFile.status === 'error' && "bg-red-50 border-red-200 dark:bg-red-900/10 dark:border-red-800",
                )}
              >
                {/* Icon */}
                <div className={cn(
                  "h-8 w-8 rounded-full flex items-center justify-center shrink-0",
                  uploadFile.status === 'complete' && "bg-green-100 text-green-600 dark:bg-green-800 dark:text-green-300",
                  uploadFile.status === 'processing' && "bg-blue-100 text-blue-600 dark:bg-blue-800 dark:text-blue-300",
                  uploadFile.status === 'pending' && "bg-muted text-muted-foreground",
                )}>
                  {uploadFile.status === 'processing' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : uploadFile.status === 'complete' ? (
                    categoryIcons[uploadFile.category || 'other']
                  ) : (
                    <FileText className="h-4 w-4" />
                  )}
                </div>

                {/* File Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{uploadFile.file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {uploadFile.status === 'processing' && 'AI is analyzing...'}
                    {uploadFile.status === 'complete' && uploadFile.message}
                    {uploadFile.status === 'pending' && 'Waiting...'}
                  </p>
                </div>

                {/* Status/Actions */}
                {uploadFile.status === 'complete' && (
                  <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                )}
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-6 w-6 shrink-0"
                  onClick={() => removeFile(uploadFile.id)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Progress Summary */}
        {files.length > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Processing progress</span>
              <span className="font-medium">{completedCount}/{files.length} complete</span>
            </div>
            <Progress value={(completedCount / files.length) * 100} className="h-2" />
          </div>
        )}

        {/* Footer Actions */}
        {completedCount > 0 && processingCount === 0 && (
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setFiles([])}>
              Clear All
            </Button>
            <Button onClick={handleClose}>
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

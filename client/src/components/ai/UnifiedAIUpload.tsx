/**
 * Unified AI Upload Component
 *
 * Context-aware document upload that:
 * 1. Detects document type using AI
 * 2. Uses page context as a hint for likely type
 * 3. Routes to appropriate processing pipeline
 * 4. Shows results with links to created records
 */

import { useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
  AlertTriangle,
  ExternalLink,
  RefreshCw,
  FileCheck,
  ScrollText,
  Package,
  Truck,
  Shield,
  Edit,
  Eye,
  ZoomIn,
  ZoomOut,
  RotateCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { AIProcessingAnimation } from './AIProcessingAnimation';
import { supabase } from '@/integrations/supabase/client';

// Helper to get auth headers for authenticated requests
async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (token) {
    return { 'Authorization': `Bearer ${token}` };
  }
  return {};
}

// Document type definitions
type DocumentType =
  | 'invoice'
  | 'quote'
  | 'proposal'
  | 'purchase_order'
  | 'change_order'
  | 'contract'
  | 'spec_sheet'
  | 'delivery_receipt'
  | 'warranty_doc'
  | 'photo'
  | 'unknown';

interface DocumentTypeConfig {
  label: string;
  icon: React.ReactNode;
  color: string;
  description: string;
  route: string;
}

const DOCUMENT_TYPES: Record<DocumentType, DocumentTypeConfig> = {
  invoice: {
    label: 'Invoice',
    icon: <Receipt className="h-4 w-4" />,
    color: 'bg-blue-100 text-blue-700 border-blue-200',
    description: 'Vendor bill for goods or services',
    route: '/invoices',
  },
  quote: {
    label: 'Quote/Estimate',
    icon: <FileCheck className="h-4 w-4" />,
    color: 'bg-purple-100 text-purple-700 border-purple-200',
    description: 'Price estimate from vendor',
    route: '/purchase-orders',
  },
  proposal: {
    label: 'Proposal',
    icon: <ScrollText className="h-4 w-4" />,
    color: 'bg-indigo-100 text-indigo-700 border-indigo-200',
    description: 'Detailed work proposal',
    route: '/purchase-orders',
  },
  purchase_order: {
    label: 'Purchase Order',
    icon: <ClipboardList className="h-4 w-4" />,
    color: 'bg-green-100 text-green-700 border-green-200',
    description: 'Authorization to purchase',
    route: '/purchase-orders',
  },
  change_order: {
    label: 'Change Order',
    icon: <Edit className="h-4 w-4" />,
    color: 'bg-orange-100 text-orange-700 border-orange-200',
    description: 'Contract modification',
    route: '/change-orders',
  },
  contract: {
    label: 'Contract',
    icon: <FileText className="h-4 w-4" />,
    color: 'bg-gray-100 text-gray-700 border-gray-200',
    description: 'Formal agreement',
    route: '/documents',
  },
  spec_sheet: {
    label: 'Spec Sheet',
    icon: <Package className="h-4 w-4" />,
    color: 'bg-cyan-100 text-cyan-700 border-cyan-200',
    description: 'Product specifications',
    route: '/selections',
  },
  delivery_receipt: {
    label: 'Delivery Receipt',
    icon: <Truck className="h-4 w-4" />,
    color: 'bg-teal-100 text-teal-700 border-teal-200',
    description: 'Proof of delivery',
    route: '/documents',
  },
  warranty_doc: {
    label: 'Warranty',
    icon: <Shield className="h-4 w-4" />,
    color: 'bg-amber-100 text-amber-700 border-amber-200',
    description: 'Warranty documentation',
    route: '/documents',
  },
  photo: {
    label: 'Site Photo',
    icon: <FileImage className="h-4 w-4" />,
    color: 'bg-pink-100 text-pink-700 border-pink-200',
    description: 'Construction site image',
    route: '/photos',
  },
  unknown: {
    label: 'Document',
    icon: <FileText className="h-4 w-4" />,
    color: 'bg-gray-100 text-gray-700 border-gray-200',
    description: 'Unclassified document',
    route: '/documents',
  },
};

// Map page routes to likely document types
const PAGE_CONTEXT_HINTS: Record<string, DocumentType[]> = {
  '/invoices': ['invoice'],
  '/purchase-orders': ['quote', 'proposal', 'purchase_order'],
  '/pos': ['quote', 'proposal', 'purchase_order'],
  '/change-orders': ['change_order'],
  '/photos': ['photo'],
  '/documents': ['contract', 'spec_sheet', 'delivery_receipt', 'warranty_doc'],
  '/selections': ['spec_sheet'],
  '/budget': ['invoice', 'quote'],
  '/draws': ['invoice'],
};

interface UploadedFile {
  id: string;
  file: File;
  status: 'pending' | 'classifying' | 'classified' | 'processing' | 'complete' | 'error';
  detectedType?: DocumentType;
  selectedType?: DocumentType;
  confidence?: number;
  reasoning?: string;
  result?: any;
  error?: string;
  resultId?: string;
}

interface UnifiedAIUploadProps {
  /** Override default button trigger */
  trigger?: React.ReactNode;
  /** Context hint from current page */
  contextHint?: DocumentType;
  /** Callback when upload completes */
  onComplete?: (results: UploadedFile[]) => void;
  /** Job ID to associate uploads with */
  jobId?: string;
}

export function UnifiedAIUpload({
  trigger,
  contextHint,
  onComplete,
  jobId,
}: UnifiedAIUploadProps) {
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [previewFile, setPreviewFile] = useState<UploadedFile | null>(null);
  const [previewZoom, setPreviewZoom] = useState(100);
  const [previewRotation, setPreviewRotation] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  // Create object URL for preview
  const previewUrl = useMemo(() => {
    if (previewFile) {
      return URL.createObjectURL(previewFile.file);
    }
    return null;
  }, [previewFile]);

  // Cleanup object URL on unmount or preview change
  const closePreview = useCallback(() => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewFile(null);
    setPreviewZoom(100);
    setPreviewRotation(0);
  }, [previewUrl]);

  // Determine context hint from current page if not provided
  const effectiveContextHint = contextHint || (() => {
    const hints = PAGE_CONTEXT_HINTS[location.pathname];
    return hints?.[0];
  })();

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

    // Classify each file
    uploadFiles.forEach(uploadFile => {
      classifyFile(uploadFile);
    });
  };

  const classifyFile = async (uploadFile: UploadedFile) => {
    // Update to classifying
    setFiles(prev => prev.map(f =>
      f.id === uploadFile.id ? { ...f, status: 'classifying' } : f
    ));

    // Minimum animation time for visual feedback
    const minAnimationTime = 1500;
    const startTime = Date.now();

    try {
      // Check if it's an image (likely photo)
      if (uploadFile.file.type.startsWith('image/') && !uploadFile.file.name.toLowerCase().includes('invoice')) {
        // Quick check - if pure image and on photos page, assume it's a photo
        if (effectiveContextHint === 'photo') {
          // Ensure minimum animation time
          const elapsed = Date.now() - startTime;
          if (elapsed < minAnimationTime) {
            await new Promise(resolve => setTimeout(resolve, minAnimationTime - elapsed));
          }
          setFiles(prev => prev.map(f =>
            f.id === uploadFile.id ? {
              ...f,
              status: 'classified',
              detectedType: 'photo',
              selectedType: 'photo',
              confidence: 0.95,
              reasoning: 'Image file detected on photos page'
            } : f
          ));
          return;
        }
      }

      // Use AI classification
      const formData = new FormData();
      formData.append('file', uploadFile.file);
      if (effectiveContextHint) {
        formData.append('context_hint', effectiveContextHint);
      }

      const authHeaders = await getAuthHeaders();
      const response = await fetch('/api/document-hub/classify', {
        method: 'POST',
        headers: authHeaders,
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Classification failed: ${response.status}`);
      }

      const result = await response.json();

      // Map result to our type
      let detectedType: DocumentType = result.document_type || 'unknown';

      // If context hint matches classification with lower confidence, boost it
      if (effectiveContextHint && result.confidence < 0.7) {
        const contextMatches = PAGE_CONTEXT_HINTS[location.pathname] || [];
        if (contextMatches.includes(detectedType)) {
          // Context matches, keep detected type
        } else if (contextMatches.length > 0) {
          // Use context hint if AI is uncertain
          detectedType = contextMatches[0];
        }
      }

      // Ensure minimum animation time for visual feedback
      const elapsed = Date.now() - startTime;
      if (elapsed < minAnimationTime) {
        await new Promise(resolve => setTimeout(resolve, minAnimationTime - elapsed));
      }

      setFiles(prev => prev.map(f =>
        f.id === uploadFile.id ? {
          ...f,
          status: 'classified',
          detectedType,
          selectedType: detectedType,
          confidence: result.confidence || 0.5,
          reasoning: result.reasoning || 'AI classification'
        } : f
      ));

    } catch (err: any) {
      console.error('Classification error:', err);

      // Ensure minimum animation time even on error
      const elapsed = Date.now() - startTime;
      if (elapsed < minAnimationTime) {
        await new Promise(resolve => setTimeout(resolve, minAnimationTime - elapsed));
      }

      // Fallback to context hint or filename-based classification
      let fallbackType: DocumentType = effectiveContextHint || 'unknown';
      const fileName = uploadFile.file.name.toLowerCase();

      if (fileName.includes('invoice') || fileName.includes('inv')) {
        fallbackType = 'invoice';
      } else if (fileName.includes('quote') || fileName.includes('estimate')) {
        fallbackType = 'quote';
      } else if (fileName.includes('po') || fileName.includes('purchase')) {
        fallbackType = 'purchase_order';
      } else if (fileName.includes('contract')) {
        fallbackType = 'contract';
      } else if (uploadFile.file.type.startsWith('image/')) {
        fallbackType = 'photo';
      }

      setFiles(prev => prev.map(f =>
        f.id === uploadFile.id ? {
          ...f,
          status: 'classified',
          detectedType: fallbackType,
          selectedType: fallbackType,
          confidence: 0.5,
          reasoning: 'Classified by filename/type (AI unavailable)'
        } : f
      ));
    }
  };

  const updateFileType = (fileId: string, newType: DocumentType) => {
    setFiles(prev => prev.map(f =>
      f.id === fileId ? { ...f, selectedType: newType } : f
    ));
  };

  const processFile = async (uploadFile: UploadedFile) => {
    const docType = uploadFile.selectedType || uploadFile.detectedType || 'unknown';

    setFiles(prev => prev.map(f =>
      f.id === uploadFile.id ? { ...f, status: 'processing' } : f
    ));

    try {
      let result: any;
      let resultId: string | undefined;

      // Route to appropriate processor based on type
      switch (docType) {
        case 'invoice': {
          const formData = new FormData();
          formData.append('file', uploadFile.file);
          if (jobId) formData.append('job_id', jobId);

          const authHeaders = await getAuthHeaders();
          const response = await fetch('/api/invoices/process', {
            method: 'POST',
            headers: authHeaders,
            body: formData,
          });

          if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error || `Processing failed: ${response.status}`);
          }

          result = await response.json();
          resultId = result.invoice?.id;
          break;
        }

        case 'quote':
        case 'proposal':
        case 'purchase_order': {
          const formData = new FormData();
          formData.append('file', uploadFile.file);
          if (jobId) formData.append('job_id', jobId);

          const authHeaders = await getAuthHeaders();
          const response = await fetch('/api/purchase-orders/process-document?preview=false', {
            method: 'POST',
            headers: authHeaders,
            body: formData,
          });

          if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error || `Processing failed: ${response.status}`);
          }

          result = await response.json();
          resultId = result.po?.id;
          break;
        }

        case 'photo': {
          const formData = new FormData();
          formData.append('file', uploadFile.file);
          if (jobId) formData.append('job_id', jobId);

          const authHeaders = await getAuthHeaders();
          const response = await fetch('/api/photos', {
            method: 'POST',
            headers: authHeaders,
            body: formData,
          });

          if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error || `Upload failed: ${response.status}`);
          }

          result = await response.json();
          resultId = result.id;
          break;
        }

        default: {
          // Generic document upload
          const formData = new FormData();
          formData.append('file', uploadFile.file);
          formData.append('document_type', docType);
          if (jobId) formData.append('job_id', jobId);

          const authHeaders = await getAuthHeaders();
          const response = await fetch('/api/documents/upload', {
            method: 'POST',
            headers: authHeaders,
            body: formData,
          });

          if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error || `Upload failed: ${response.status}`);
          }

          result = await response.json();
          resultId = result.id;
          break;
        }
      }

      setFiles(prev => prev.map(f =>
        f.id === uploadFile.id ? {
          ...f,
          status: 'complete',
          result,
          resultId
        } : f
      ));

      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['photos'] });
      queryClient.invalidateQueries({ queryKey: ['documents'] });

    } catch (err: any) {
      console.error('Processing error:', err);
      setFiles(prev => prev.map(f =>
        f.id === uploadFile.id ? {
          ...f,
          status: 'error',
          error: err.message || 'Processing failed'
        } : f
      ));
    }
  };

  const processAllClassified = () => {
    const classifiedFiles = files.filter(f => f.status === 'classified');
    classifiedFiles.forEach(file => processFile(file));
  };

  const retryFile = (fileId: string) => {
    const file = files.find(f => f.id === fileId);
    if (file) {
      if (file.status === 'error' && file.detectedType) {
        processFile(file);
      } else {
        classifyFile(file);
      }
    }
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const handleClose = () => {
    const completedFiles = files.filter(f => f.status === 'complete');

    if (completedFiles.length > 0) {
      toast.success(`${completedFiles.length} document(s) processed successfully`);
      onComplete?.(completedFiles);
    }

    setFiles([]);
    setOpen(false);
  };

  const navigateToResult = (file: UploadedFile) => {
    const config = DOCUMENT_TYPES[file.selectedType || file.detectedType || 'unknown'];
    if (file.resultId) {
      navigate(`${config.route}?highlight=${file.resultId}`);
    } else {
      navigate(config.route);
    }
    handleClose();
  };

  // Stats
  const pendingCount = files.filter(f => f.status === 'pending' || f.status === 'classifying').length;
  const classifiedCount = files.filter(f => f.status === 'classified').length;
  const processingCount = files.filter(f => f.status === 'processing').length;
  const completedCount = files.filter(f => f.status === 'complete').length;
  const errorCount = files.filter(f => f.status === 'error').length;

  const canProcess = classifiedCount > 0 && pendingCount === 0;
  const isProcessing = processingCount > 0;
  const allDone = files.length > 0 && pendingCount === 0 && classifiedCount === 0 && processingCount === 0;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) handleClose();
      else setOpen(true);
    }}>
      <DialogTrigger asChild>
        {trigger || (
          <Button
            className="gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-md"
          >
            <Sparkles className="h-4 w-4" />
            <span className="hidden sm:inline">AI Upload</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Document Upload
          </DialogTitle>
          <DialogDescription>
            Drop any document and AI will automatically classify and process it.
            {effectiveContextHint && (
              <span className="ml-1 text-primary">
                (Expecting: {DOCUMENT_TYPES[effectiveContextHint]?.label})
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4">
          {/* AI Processing Animation - shown when actively processing */}
          {(pendingCount > 0 || processingCount > 0) && files.length > 0 && (
            <AIProcessingAnimation
              statusMessage={
                processingCount > 0
                  ? `Processing ${processingCount} document${processingCount > 1 ? 's' : ''}...`
                  : `Analyzing ${pendingCount} document${pendingCount > 1 ? 's' : ''}...`
              }
              documentType={
                files.find(f => f.status === 'classifying' || f.status === 'processing')?.selectedType
                  ? DOCUMENT_TYPES[files.find(f => f.status === 'classifying' || f.status === 'processing')?.selectedType || 'unknown']?.label
                  : undefined
              }
              currentStep={processingCount > 0 ? 3 : pendingCount > 0 ? 1 : 0}
              classificationComplete={pendingCount === 0}
              processingComplete={allDone && completedCount > 0}
            />
          )}

          {/* Drop Zone - hidden when processing */}
          {pendingCount === 0 && processingCount === 0 && (
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={cn(
                "border-2 border-dashed rounded-lg p-6 text-center transition-colors",
                isDragging
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-muted-foreground/50"
              )}
            >
              <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-1">
                Drag & drop invoices, quotes, POs, contracts, or photos
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
                  accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx"
                />
              </label>
            </div>
          )}

          {/* File List */}
          {files.length > 0 && (
            <div className="space-y-2">
              {files.map((uploadFile) => {
                const typeConfig = DOCUMENT_TYPES[uploadFile.selectedType || uploadFile.detectedType || 'unknown'];

                return (
                  <div
                    key={uploadFile.id}
                    className={cn(
                      "flex items-start gap-3 p-3 rounded-lg border transition-colors",
                      uploadFile.status === 'complete' && "bg-green-50 border-green-200 dark:bg-green-900/10 dark:border-green-800",
                      uploadFile.status === 'processing' && "bg-blue-50 border-blue-200 dark:bg-blue-900/10 dark:border-blue-800",
                      uploadFile.status === 'classifying' && "bg-purple-50 border-purple-200 dark:bg-purple-900/10 dark:border-purple-800",
                      uploadFile.status === 'classified' && "bg-amber-50 border-amber-200 dark:bg-amber-900/10 dark:border-amber-800",
                      uploadFile.status === 'error' && "bg-red-50 border-red-200 dark:bg-red-900/10 dark:border-red-800",
                    )}
                  >
                    {/* Icon */}
                    <div className={cn(
                      "h-10 w-10 rounded-full flex items-center justify-center shrink-0",
                      uploadFile.status === 'complete' && "bg-green-100 text-green-600",
                      uploadFile.status === 'processing' && "bg-blue-100 text-blue-600",
                      uploadFile.status === 'classifying' && "bg-purple-100 text-purple-600",
                      uploadFile.status === 'classified' && "bg-amber-100 text-amber-600",
                      uploadFile.status === 'error' && "bg-red-100 text-red-600",
                      uploadFile.status === 'pending' && "bg-muted text-muted-foreground",
                    )}>
                      {uploadFile.status === 'processing' || uploadFile.status === 'classifying' ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : uploadFile.status === 'error' ? (
                        <AlertTriangle className="h-5 w-5" />
                      ) : uploadFile.status === 'complete' ? (
                        <CheckCircle className="h-5 w-5" />
                      ) : (
                        typeConfig.icon
                      )}
                    </div>

                    {/* File Info */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <p className="text-sm font-medium truncate">{uploadFile.file.name}</p>

                      {/* Status text */}
                      <p className="text-xs text-muted-foreground">
                        {uploadFile.status === 'pending' && 'Waiting to classify...'}
                        {uploadFile.status === 'classifying' && 'AI is analyzing document...'}
                        {uploadFile.status === 'classified' && (
                          <>
                            Detected as <span className="font-medium">{typeConfig.label}</span>
                            {uploadFile.confidence && (
                              <span className="ml-1">({Math.round(uploadFile.confidence * 100)}% confident)</span>
                            )}
                          </>
                        )}
                        {uploadFile.status === 'processing' && `Processing as ${typeConfig.label}...`}
                        {uploadFile.status === 'complete' && `Saved as ${typeConfig.label}`}
                        {uploadFile.status === 'error' && uploadFile.error}
                      </p>

                      {/* Type selector for classified files */}
                      {uploadFile.status === 'classified' && (
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-xs text-muted-foreground">Type:</span>
                          <Select
                            value={uploadFile.selectedType || uploadFile.detectedType || 'unknown'}
                            onValueChange={(v) => updateFileType(uploadFile.id, v as DocumentType)}
                          >
                            <SelectTrigger className="h-7 w-40 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(DOCUMENT_TYPES).map(([type, config]) => (
                                <SelectItem key={type} value={type} className="text-xs">
                                  <span className="flex items-center gap-2">
                                    {config.icon}
                                    {config.label}
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {uploadFile.selectedType !== uploadFile.detectedType && (
                            <Badge variant="outline" className="text-xs">Changed</Badge>
                          )}
                        </div>
                      )}

                      {/* View result link for completed files */}
                      {uploadFile.status === 'complete' && (
                        <Button
                          variant="link"
                          size="sm"
                          className="h-auto p-0 text-xs"
                          onClick={() => navigateToResult(uploadFile)}
                        >
                          View in {typeConfig.label}s
                          <ExternalLink className="h-3 w-3 ml-1" />
                        </Button>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      {/* Preview button - available for classified and pending files */}
                      {(uploadFile.status === 'classified' || uploadFile.status === 'pending') && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => setPreviewFile(uploadFile)}
                          title="Preview document"
                        >
                          <Eye className="h-3 w-3" />
                        </Button>
                      )}
                      {uploadFile.status === 'error' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => retryFile(uploadFile.id)}
                        >
                          <RefreshCw className="h-3 w-3" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => removeFile(uploadFile.id)}
                        disabled={uploadFile.status === 'processing' || uploadFile.status === 'classifying'}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Progress Summary */}
          {files.length > 0 && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {pendingCount > 0 && `${pendingCount} classifying`}
                  {pendingCount > 0 && classifiedCount > 0 && ' · '}
                  {classifiedCount > 0 && `${classifiedCount} ready`}
                  {(pendingCount > 0 || classifiedCount > 0) && processingCount > 0 && ' · '}
                  {processingCount > 0 && `${processingCount} processing`}
                </span>
                <span className="font-medium">
                  {completedCount}/{files.length} complete
                  {errorCount > 0 && <span className="text-red-500 ml-1">({errorCount} failed)</span>}
                </span>
              </div>
              <Progress
                value={(completedCount / files.length) * 100}
                className="h-2"
              />
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex justify-between items-center pt-4 border-t">
          <div className="text-xs text-muted-foreground">
            {effectiveContextHint && (
              <span>Context: {DOCUMENT_TYPES[effectiveContextHint]?.label} page</span>
            )}
          </div>
          <div className="flex gap-2">
            {files.length > 0 && !allDone && (
              <Button variant="outline" onClick={() => setFiles([])}>
                Clear All
              </Button>
            )}
            {canProcess && !isProcessing && (
              <Button onClick={processAllClassified}>
                <Sparkles className="h-4 w-4 mr-2" />
                Process {classifiedCount} File{classifiedCount !== 1 ? 's' : ''}
              </Button>
            )}
            {allDone && (
              <Button onClick={handleClose}>
                Done
              </Button>
            )}
          </div>
        </div>
      </DialogContent>

      {/* Document Preview Sheet */}
      <Sheet open={!!previewFile} onOpenChange={(isOpen) => !isOpen && closePreview()}>
        <SheetContent side="right" className="w-full sm:max-w-2xl lg:max-w-4xl p-0 flex flex-col">
          <SheetHeader className="px-6 py-4 border-b">
            <SheetTitle className="flex items-center justify-between">
              <span className="truncate flex-1">{previewFile?.file.name}</span>
              <div className="flex items-center gap-1 ml-4">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setPreviewZoom(z => Math.max(25, z - 25))}
                  disabled={previewZoom <= 25}
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="text-sm w-12 text-center">{previewZoom}%</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setPreviewZoom(z => Math.min(200, z + 25))}
                  disabled={previewZoom >= 200}
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setPreviewRotation(r => (r + 90) % 360)}
                >
                  <RotateCw className="h-4 w-4" />
                </Button>
              </div>
            </SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-auto bg-muted/50 p-4">
            {previewFile && previewUrl && (
              <div className="flex items-center justify-center min-h-full">
                {previewFile.file.type.startsWith('image/') ? (
                  <img
                    src={previewUrl}
                    alt={previewFile.file.name}
                    className="max-w-full h-auto shadow-lg rounded"
                    style={{
                      transform: `scale(${previewZoom / 100}) rotate(${previewRotation}deg)`,
                      transformOrigin: 'center center',
                      transition: 'transform 0.2s ease',
                    }}
                  />
                ) : previewFile.file.type === 'application/pdf' ? (
                  <object
                    data={previewUrl}
                    type="application/pdf"
                    className="w-full bg-white rounded shadow-lg"
                    style={{
                      height: `${Math.max(600, 600 * (previewZoom / 100))}px`,
                      transform: `rotate(${previewRotation}deg)`,
                      transformOrigin: 'center center',
                    }}
                  >
                    <div className="flex flex-col items-center justify-center h-96 text-muted-foreground">
                      <FileText className="h-16 w-16 mb-4" />
                      <p>PDF preview not available in your browser</p>
                      <a
                        href={previewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 text-primary hover:underline"
                      >
                        Open in new tab
                      </a>
                    </div>
                  </object>
                ) : (
                  <div className="flex flex-col items-center justify-center h-96 text-muted-foreground">
                    <FileText className="h-16 w-16 mb-4" />
                    <p className="text-lg font-medium">{previewFile.file.name}</p>
                    <p className="text-sm mt-1">
                      {(previewFile.file.size / 1024).toFixed(1)} KB · {previewFile.file.type || 'Unknown type'}
                    </p>
                    <p className="mt-4 text-sm">Preview not available for this file type</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="px-6 py-4 border-t flex justify-between items-center">
            <div className="text-sm text-muted-foreground">
              {previewFile && (
                <>
                  {(previewFile.file.size / 1024).toFixed(1)} KB
                  {previewFile.detectedType && (
                    <span className="ml-2">
                      · Detected as <span className="font-medium">{DOCUMENT_TYPES[previewFile.detectedType]?.label}</span>
                    </span>
                  )}
                </>
              )}
            </div>
            <Button onClick={closePreview}>
              Close Preview
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </Dialog>
  );
}

// Export a hook to get context hint from current location
export function useUploadContext(): DocumentType | undefined {
  const location = useLocation();
  const hints = PAGE_CONTEXT_HINTS[location.pathname];
  return hints?.[0];
}

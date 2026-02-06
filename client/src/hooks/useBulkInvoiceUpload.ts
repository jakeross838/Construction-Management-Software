import { useState, useCallback } from 'react';
import { AIExtractionResult } from './useInvoiceAI';
import { apiFetch } from '@/lib/api';

export interface QueuedFile {
  id: string;
  file: File;
  status: 'pending' | 'uploading' | 'processing' | 'complete' | 'error';
  progress: number; // 0-100
  result?: AIExtractionResult;
  error?: string;
  storedFileName?: string;
}

export function useBulkInvoiceUpload() {
  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Add files to queue
  const addFiles = useCallback((files: FileList | File[]) => {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const maxSize = 10 * 1024 * 1024; // 10MB

    const newFiles: QueuedFile[] = Array.from(files)
      .filter(file => {
        if (!allowedTypes.includes(file.type)) {
          console.warn(`Skipping ${file.name}: invalid type`);
          return false;
        }
        if (file.size > maxSize) {
          console.warn(`Skipping ${file.name}: too large`);
          return false;
        }
        return true;
      })
      .map(file => ({
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        file,
        status: 'pending' as const,
        progress: 0,
      }));

    setQueue(prev => [...prev, ...newFiles]);
    return newFiles;
  }, []);

  // Remove file from queue
  const removeFile = useCallback((id: string) => {
    setQueue(prev => prev.filter(f => f.id !== id));
  }, []);

  // Clear completed or all
  const clearQueue = useCallback((onlyCompleted = false) => {
    if (onlyCompleted) {
      setQueue(prev => prev.filter(f => f.status !== 'complete' && f.status !== 'error'));
    } else {
      setQueue([]);
    }
  }, []);

  // Process a single file using the API
  const processFile = async (queuedFile: QueuedFile): Promise<QueuedFile> => {
    const { id, file } = queuedFile;

    try {
      // Update status: uploading
      setQueue(prev => prev.map(f => f.id === id ? { ...f, status: 'uploading', progress: 10 } : f));

      // Create FormData for file upload
      const formData = new FormData();
      formData.append('file', file);

      // Update status: processing
      setQueue(prev => prev.map(f => f.id === id ? { ...f, status: 'processing', progress: 40 } : f));

      // Call the Node.js backend API for processing
      const response = await apiFetch('/api/invoices/process', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: Failed to process invoice`);
      }

      const data = await response.json();

      if (!data?.success && data?.error) {
        throw new Error(data.error || 'Extraction failed');
      }

      // Update progress
      setQueue(prev => prev.map(f => f.id === id ? { ...f, progress: 80 } : f));

      // Map backend response to expected format
      const result: AIExtractionResult = {
        success: true,
        data: {
          invoice_number: data.invoice?.invoice_number || null,
          vendor_name: data.invoice?.vendor_name || data.vendor?.name || null,
          amount: data.invoice?.amount || null,
          invoice_date: data.invoice?.invoice_date || null,
          due_date: data.invoice?.due_date || null,
          line_items: data.invoice?.line_items || [],
          invoice_type: data.invoice?.invoice_type || 'standard',
          confidence: data.invoice?.ai_confidence || {
            invoice_number: 0,
            vendor_name: 0,
            amount: 0,
            invoice_date: 0,
            due_date: 0,
          },
        },
        extracted: data.invoice?.ai_extracted_data,
        // Pass through created invoice info and matches
        invoiceId: data.invoice?.id,
        pdfUrl: data.invoice?.pdf_url,
        matchedVendor: data.matchedVendor,
        matchedJob: data.matchedJob,
        matchedPO: data.matchedPO,
        suggestions: data.suggestions,
        needsReview: data.invoice?.needs_review,
        reviewFlags: data.invoice?.review_flags,
        overallConfidence: data.overallConfidence,
      };

      // Update: complete
      setQueue(prev => prev.map(f => f.id === id ? {
        ...f,
        status: 'complete',
        progress: 100,
        result,
        storedFileName: data.invoice?.pdf_url || file.name,
      } : f));

      return { ...queuedFile, status: 'complete', progress: 100, result, storedFileName: data.invoice?.pdf_url || file.name };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      setQueue(prev => prev.map(f => f.id === id ? { ...f, status: 'error', error: errorMsg } : f));
      return { ...queuedFile, status: 'error', error: errorMsg };
    }
  };

  // Process all pending files in queue
  const processQueue = useCallback(async () => {
    const pendingFiles = queue.filter(f => f.status === 'pending');
    if (pendingFiles.length === 0) return;

    setIsProcessing(true);

    // Process up to 3 files in parallel
    const batchSize = 3;
    for (let i = 0; i < pendingFiles.length; i += batchSize) {
      const batch = pendingFiles.slice(i, i + batchSize);
      await Promise.allSettled(batch.map(processFile));
    }

    setIsProcessing(false);
  }, [queue]);

  // Retry a failed file
  const retryFile = useCallback((id: string) => {
    setQueue(prev => prev.map(f => f.id === id ? { ...f, status: 'pending', progress: 0, error: undefined } : f));
  }, []);

  return {
    queue,
    isProcessing,
    addFiles,
    removeFile,
    clearQueue,
    processQueue,
    retryFile,
    stats: {
      total: queue.length,
      pending: queue.filter(f => f.status === 'pending').length,
      processing: queue.filter(f => f.status === 'uploading' || f.status === 'processing').length,
      complete: queue.filter(f => f.status === 'complete').length,
      error: queue.filter(f => f.status === 'error').length,
    }
  };
}

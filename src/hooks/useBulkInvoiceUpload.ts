import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AIExtractionResult } from './useInvoiceAI';

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

  // Process a single file
  const processFile = async (queuedFile: QueuedFile): Promise<QueuedFile> => {
    const { id, file } = queuedFile;

    try {
      // Update status: uploading
      setQueue(prev => prev.map(f => f.id === id ? { ...f, status: 'uploading', progress: 10 } : f));

      // Upload to storage
      const fileName = `${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('invoices')
        .upload(fileName, file);

      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      // Update status: processing
      setQueue(prev => prev.map(f => f.id === id ? { ...f, status: 'processing', progress: 40, storedFileName: fileName } : f));

      // Convert to base64
      const imageBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // Update progress
      setQueue(prev => prev.map(f => f.id === id ? { ...f, progress: 60 } : f));

      // Call extraction
      const { data, error } = await supabase.functions.invoke('extract-invoice', {
        body: { imageBase64, mimeType: file.type || 'application/pdf' }
      });

      if (error) {
        throw new Error(error.message || 'Extraction failed');
      }

      // Update: complete
      setQueue(prev => prev.map(f => f.id === id ? {
        ...f,
        status: 'complete',
        progress: 100,
        result: data as AIExtractionResult
      } : f));

      return { ...queuedFile, status: 'complete', progress: 100, result: data, storedFileName: fileName };

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

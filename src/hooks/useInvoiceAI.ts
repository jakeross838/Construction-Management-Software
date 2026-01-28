import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ExtractedVendor {
  companyName: string | null;
  tradeType: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
}

export interface ExtractedJob {
  reference: string | null;
  address: string | null;
  clientName: string | null;
  poNumber: string | null;
}

export interface LineItem {
  description: string;
  quantity?: number;
  unit?: string;
  unitPrice?: number;
  amount: number;
}

export interface AIExtractionResult {
  success: boolean;
  error?: string;
  
  // Basic extracted data (backward compatible)
  data?: {
    invoice_number: string | null;
    vendor_name: string | null;
    amount: number | null;
    invoice_date: string | null;
    due_date: string | null;
    line_items: LineItem[];
    invoice_type: 'standard' | 'credit_memo' | 'debit_memo';
    confidence: {
      invoice_number: number;
      vendor_name: number;
      amount: number;
      invoice_date: number;
      due_date: number;
    };
  };
  
  // Full extracted structure
  extracted?: {
    vendor: ExtractedVendor;
    invoiceNumber: string | null;
    invoiceDate: string | null;
    dueDate: string | null;
    invoiceType: string;
    job: ExtractedJob;
    amounts: {
      subtotal: number | null;
      taxAmount: number | null;
      totalAmount: number | null;
    };
    lineItems: LineItem[];
    extractionConfidence: {
      vendor: number;
      amount: number;
      invoiceNumber: number;
      date: number;
      job: number;
    };
  };
  
  // Matched entities
  matchedVendor?: {
    id: string;
    name: string;
    confidence: number;
    matchType: string;
  } | null;
  
  matchedJob?: {
    id: string;
    name: string;
    address: string | null;
    confidence: number;
    matchType: string;
  } | null;
  
  matchedPO?: {
    id: string;
    po_number: string;
    vendor_id: string;
    total_amount: number;
    invoiced_amount: number;
    confidence: number;
  } | null;
  
  // Suggestions for user selection
  suggestions?: {
    vendors: Array<{ id: string; name: string; score: number }>;
    jobs: Array<{ id: string; name: string; address: string | null; score: number }>;
    purchaseOrders: Array<{ id: string; po_number: string; total_amount: number; remaining: number }>;
    costCodes: Array<{
      id: string;
      code: string;
      name: string;
      amount: number;
      confidence: number;
      reason: string;
    }>;
  };
  
  // Duplicate detection
  possibleDuplicate?: {
    id: string;
    invoice_number: string;
    amount: number;
  } | null;
  
  // Review info
  needsReview?: boolean;
  reviewFlags?: string[];
  overallConfidence?: number;
  messages?: string[];
}

export function useInvoiceAI() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState<string | null>(null);

  const extractInvoiceData = async (
    file: File
  ): Promise<AIExtractionResult> => {
    setIsProcessing(true);
    setProcessingStep('Converting file...');

    try {
      // Convert file to base64
      const imageBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          const base64 = result.split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      setProcessingStep('Extracting data with AI...');

      // Call the enhanced extraction function
      const { data, error } = await supabase.functions.invoke('extract-invoice', {
        body: { 
          imageBase64, 
          mimeType: file.type || 'application/pdf'
        }
      });

      if (error) {
        throw new Error(error.message || 'Failed to extract invoice data');
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Extraction failed');
      }

      setProcessingStep('Processing matches...');

      // Log messages for debugging
      if (data.messages) {
        console.log('AI Processing:', data.messages);
      }

      return data as AIExtractionResult;

    } catch (error) {
      console.error('Invoice AI extraction error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Handle specific error types
      if (errorMessage.includes('Rate limit')) {
        toast.error('AI rate limit reached. Please try again in a moment.');
      } else if (errorMessage.includes('credits')) {
        toast.error('AI credits exhausted. Please add credits to continue.');
      } else {
        toast.error(`Failed to process invoice: ${errorMessage}`);
      }
      
      return {
        success: false,
        error: errorMessage
      };
    } finally {
      setIsProcessing(false);
      setProcessingStep(null);
    }
  };

  return {
    extractInvoiceData,
    isProcessing,
    processingStep
  };
}

// Review flag display helpers
export const REVIEW_FLAG_LABELS: Record<string, { label: string; severity: 'warning' | 'error' | 'info' }> = {
  'verify_job': { label: 'Verify job match', severity: 'warning' },
  'select_job': { label: 'Select job manually', severity: 'error' },
  'no_job_match': { label: 'No job reference found', severity: 'warning' },
  'verify_vendor': { label: 'Verify vendor match', severity: 'warning' },
  'select_vendor': { label: 'Select vendor manually', severity: 'error' },
  'verify_amount': { label: 'Verify amount', severity: 'warning' },
  'verify_date': { label: 'Verify date', severity: 'warning' },
  'ocr_processed': { label: 'Scanned document - verify OCR', severity: 'info' },
  'low_text_quality': { label: 'Poor document quality', severity: 'warning' },
  'possible_duplicate': { label: 'Possible duplicate', severity: 'error' }
};

export function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.85) return 'text-green-600';
  if (confidence >= 0.70) return 'text-amber-600';
  return 'text-red-600';
}

export function getConfidenceLabel(confidence: number): string {
  if (confidence >= 0.85) return 'High';
  if (confidence >= 0.70) return 'Medium';
  if (confidence >= 0.50) return 'Low';
  return 'Very Low';
}

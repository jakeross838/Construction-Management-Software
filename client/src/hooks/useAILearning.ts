import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

// API helper
async function api<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api${endpoint}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || error.message || `HTTP ${response.status}`);
  }
  return response.json();
}

// Record when user corrects an AI match
export function useRecordCorrection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      entityType,
      extractedValue,
      correctedId
    }: {
      entityType: 'vendor' | 'job' | 'cost_code';
      extractedValue: string;
      correctedId: string;
    }) => {
      return api('/ai/corrections', {
        method: 'POST',
        body: JSON.stringify({
          entity_type: entityType,
          extracted_value: extractedValue,
          corrected_id: correctedId,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-learned-mappings'] });
      queryClient.invalidateQueries({ queryKey: ['vendor-aliases'] });
    },
    onError: (error: Error) => {
      console.error('Failed to record correction:', error);
    }
  });
}

// Increment use count when a learned mapping is used successfully
export function useIncrementMappingUse() {
  return useMutation({
    mutationFn: async ({
      entityType,
      extractedValue
    }: {
      entityType: string;
      extractedValue: string;
    }) => {
      return api('/ai/mappings/increment', {
        method: 'POST',
        body: JSON.stringify({
          entity_type: entityType,
          extracted_value: extractedValue,
        }),
      });
    }
  });
}

// Create a vendor alias manually
export function useCreateVendorAlias() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      vendorId,
      aliasName
    }: {
      vendorId: string;
      aliasName: string;
    }) => {
      return api('/vendors/aliases', {
        method: 'POST',
        body: JSON.stringify({
          vendor_id: vendorId,
          alias_name: aliasName,
          source: 'manual',
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor-aliases'] });
      toast.success('Vendor alias created');
    },
    onError: (error: Error) => {
      console.error('Failed to create vendor alias:', error);
      toast.error('Failed to create vendor alias');
    }
  });
}

// Create or update trade → cost code mapping
export function useUpdateTradeCostMapping() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      tradeType,
      costCodeId,
      priority = 1
    }: {
      tradeType: string;
      costCodeId: string;
      priority?: number;
    }) => {
      return api('/cost-codes/trade-mappings', {
        method: 'POST',
        body: JSON.stringify({
          trade_type: tradeType,
          cost_code_id: costCodeId,
          priority,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trade-cost-mappings'] });
      toast.success('Trade mapping updated');
    },
    onError: (error: Error) => {
      console.error('Failed to update trade mapping:', error);
      toast.error('Failed to update trade mapping');
    }
  });
}

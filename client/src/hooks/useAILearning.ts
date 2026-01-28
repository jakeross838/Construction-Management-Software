import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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
      // Check if mapping already exists
      const { data: existing } = await supabase
        .from('ai_learned_mappings')
        .select('*')
        .eq('entity_type', entityType)
        .eq('extracted_value', extractedValue)
        .maybeSingle();

      let result;
      if (existing) {
        if (existing.matched_id === correctedId) {
          // Same match - increment use_count and boost confidence
          const newConfidence = Math.min(0.99, (existing.confidence || 0.9) + 0.02);
          const { data, error } = await supabase
            .from('ai_learned_mappings')
            .update({
              use_count: (existing.use_count || 0) + 1,
              confidence: newConfidence,
              last_used_at: new Date().toISOString()
            })
            .eq('id', existing.id)
            .select()
            .single();
          if (error) throw error;
          result = data;
        } else {
          // Different match - update mapping with new ID, reset confidence
          const { data, error } = await supabase
            .from('ai_learned_mappings')
            .update({
              matched_id: correctedId,
              confidence: 0.90,
              use_count: 1,
              last_used_at: new Date().toISOString()
            })
            .eq('id', existing.id)
            .select()
            .single();
          if (error) throw error;
          result = data;
        }
      } else {
        // Create new mapping
        const { data, error } = await supabase
          .from('ai_learned_mappings')
          .insert({
            entity_type: entityType,
            extracted_value: extractedValue,
            matched_id: correctedId,
            confidence: 0.90,
            use_count: 1,
            last_used_at: new Date().toISOString()
          })
          .select()
          .single();
        if (error) throw error;
        result = data;
      }

      // If vendor correction, also create alias
      if (entityType === 'vendor') {
        await supabase
          .from('vendor_aliases')
          .upsert({
            vendor_id: correctedId,
            alias_name: extractedValue,
            source: 'ai_correction'
          }, {
            onConflict: 'alias_name'
          });
      }

      return result;
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
      // First get the current record
      const { data: existing } = await supabase
        .from('ai_learned_mappings')
        .select('use_count')
        .eq('entity_type', entityType)
        .eq('extracted_value', extractedValue)
        .maybeSingle();

      if (!existing) return;

      const { error } = await supabase
        .from('ai_learned_mappings')
        .update({
          use_count: (existing.use_count || 0) + 1,
          last_used_at: new Date().toISOString()
        })
        .eq('entity_type', entityType)
        .eq('extracted_value', extractedValue);

      if (error) throw error;
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
      const { data, error } = await supabase
        .from('vendor_aliases')
        .insert({
          vendor_id: vendorId,
          alias_name: aliasName,
          source: 'manual'
        })
        .select()
        .single();

      if (error) throw error;
      return data;
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
      const { data, error } = await supabase
        .from('trade_cost_mappings')
        .upsert({
          trade_type: tradeType,
          cost_code_id: costCodeId,
          priority
        }, {
          onConflict: 'trade_type,cost_code_id'
        })
        .select()
        .single();

      if (error) throw error;
      return data;
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

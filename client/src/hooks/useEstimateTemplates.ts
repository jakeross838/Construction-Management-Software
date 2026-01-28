import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Estimate, EstimateSection, EstimateMarkupSettings, defaultMarkupSettings, generateId } from '@/types/estimate';
import { Json } from '@/integrations/supabase/types';

export interface EstimateTemplate {
  id: string;
  name: string;
  description: string | null;
  category: string;
  project_type: string | null;
  sections: EstimateSection[];
  markup_settings: EstimateMarkupSettings;
  exclusions: string[];
  clarifications: string[];
  terms_and_conditions: string | null;
  is_active: boolean;
  is_default: boolean;
  sort_order: number | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

// Type helpers for JSON conversion
function parseSections(json: Json): EstimateSection[] {
  if (!json || !Array.isArray(json)) return [];
  return json as unknown as EstimateSection[];
}

function parseMarkupSettings(json: Json): EstimateMarkupSettings {
  if (!json || typeof json !== 'object') return defaultMarkupSettings;
  return json as unknown as EstimateMarkupSettings;
}

function parseStringArray(json: Json): string[] {
  if (!json || !Array.isArray(json)) return [];
  return json as string[];
}

export function useEstimateTemplates() {
  return useQuery({
    queryKey: ['estimate-templates'],
    queryFn: async (): Promise<EstimateTemplate[]> => {
      const { data, error } = await supabase
        .from('estimate_templates')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;

      return (data || []).map(row => ({
        ...row,
        sections: parseSections(row.sections),
        markup_settings: parseMarkupSettings(row.markup_settings),
        exclusions: parseStringArray(row.exclusions),
        clarifications: parseStringArray(row.clarifications),
      }));
    },
  });
}

export function useCreateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (template: Omit<EstimateTemplate, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('estimate_templates')
        .insert({
          name: template.name,
          description: template.description,
          category: template.category,
          project_type: template.project_type,
          sections: template.sections as unknown as Json,
          markup_settings: template.markup_settings as unknown as Json,
          exclusions: template.exclusions as unknown as Json,
          clarifications: template.clarifications as unknown as Json,
          terms_and_conditions: template.terms_and_conditions,
          is_active: template.is_active,
          is_default: template.is_default,
          sort_order: template.sort_order,
          created_by: template.created_by,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estimate-templates'] });
      toast.success('Template created successfully');
    },
    onError: (error) => {
      toast.error(`Failed to create template: ${error.message}`);
    },
  });
}

export function useUpdateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<EstimateTemplate> & { id: string }) => {
      const updateData: Record<string, unknown> = {};
      
      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.category !== undefined) updateData.category = updates.category;
      if (updates.project_type !== undefined) updateData.project_type = updates.project_type;
      if (updates.sections !== undefined) updateData.sections = updates.sections as unknown as Json;
      if (updates.markup_settings !== undefined) updateData.markup_settings = updates.markup_settings as unknown as Json;
      if (updates.exclusions !== undefined) updateData.exclusions = updates.exclusions as unknown as Json;
      if (updates.clarifications !== undefined) updateData.clarifications = updates.clarifications as unknown as Json;
      if (updates.terms_and_conditions !== undefined) updateData.terms_and_conditions = updates.terms_and_conditions;
      if (updates.is_active !== undefined) updateData.is_active = updates.is_active;
      if (updates.is_default !== undefined) updateData.is_default = updates.is_default;
      if (updates.sort_order !== undefined) updateData.sort_order = updates.sort_order;

      const { data, error } = await supabase
        .from('estimate_templates')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estimate-templates'] });
      toast.success('Template updated');
    },
    onError: (error) => {
      toast.error(`Failed to update template: ${error.message}`);
    },
  });
}

export function useDeleteTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('estimate_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estimate-templates'] });
      toast.success('Template deleted');
    },
    onError: (error) => {
      toast.error(`Failed to delete template: ${error.message}`);
    },
  });
}

// Helper: Convert an estimate to a template
export function estimateToTemplate(estimate: Estimate, name: string, category: string): Omit<EstimateTemplate, 'id' | 'created_at' | 'updated_at'> {
  // Deep clone sections and regenerate IDs for template use
  const cloneSections = (sections: EstimateSection[]): EstimateSection[] => {
    return sections.map(section => ({
      ...section,
      id: generateId('sec'),
      groups: section.groups.map(group => ({
        ...group,
        id: generateId('grp'),
        subgroups: group.subgroups.map(subgroup => ({
          ...subgroup,
          id: generateId('sub'),
          lineItems: subgroup.lineItems.map(item => ({
            ...item,
            id: generateId('li'),
          })),
        })),
      })),
    }));
  };

  return {
    name,
    description: estimate.projectDescription || `Template from ${estimate.number}`,
    category,
    project_type: estimate.projectType,
    sections: cloneSections(estimate.sections),
    markup_settings: { ...estimate.markupSettings },
    exclusions: [...estimate.exclusions],
    clarifications: [...estimate.clarifications],
    terms_and_conditions: estimate.termsAndConditions || null,
    is_active: true,
    is_default: false,
    sort_order: 0,
    created_by: 'current-user',
  };
}

// Helper: Create an estimate from a template
export function templateToEstimate(template: EstimateTemplate): Partial<Estimate> {
  // Deep clone sections and regenerate IDs
  const cloneSections = (sections: EstimateSection[]): EstimateSection[] => {
    return sections.map(section => ({
      ...section,
      id: generateId('sec'),
      groups: section.groups.map(group => ({
        ...group,
        id: generateId('grp'),
        subgroups: group.subgroups.map(subgroup => ({
          ...subgroup,
          id: generateId('sub'),
          lineItems: subgroup.lineItems.map(item => ({
            ...item,
            id: generateId('li'),
          })),
        })),
      })),
    }));
  };

  return {
    projectType: (template.project_type as Estimate['projectType']) || 'new_construction',
    projectDescription: template.description || '',
    sections: cloneSections(template.sections),
    markupSettings: { ...template.markup_settings },
    exclusions: [...template.exclusions],
    clarifications: [...template.clarifications],
    termsAndConditions: template.terms_and_conditions || undefined,
  };
}

// Get unique categories from templates
export function useTemplateCategories() {
  const { data: templates } = useEstimateTemplates();
  
  const categories = new Set<string>();
  templates?.forEach(t => categories.add(t.category));
  
  return ['General', 'New Construction', 'Remodel', 'Kitchen', 'Bath', 'Addition', ...Array.from(categories)].filter((v, i, a) => a.indexOf(v) === i);
}

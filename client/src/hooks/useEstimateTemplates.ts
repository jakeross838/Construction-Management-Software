import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Estimate, EstimateSection, EstimateMarkupSettings, defaultMarkupSettings, generateId } from '@/types/estimate';
import { apiFetch } from '@/lib/api';

// API helper
async function api<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await apiFetch(`/api${endpoint}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || error.message || `HTTP ${response.status}`);
  }
  return response.json();
}

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
function parseSections(json: unknown): EstimateSection[] {
  if (!json || !Array.isArray(json)) return [];
  return json as unknown as EstimateSection[];
}

function parseMarkupSettings(json: unknown): EstimateMarkupSettings {
  if (!json || typeof json !== 'object') return defaultMarkupSettings;
  return json as unknown as EstimateMarkupSettings;
}

function parseStringArray(json: unknown): string[] {
  if (!json || !Array.isArray(json)) return [];
  return json as string[];
}

export function useEstimateTemplates() {
  return useQuery({
    queryKey: ['estimate-templates'],
    queryFn: async (): Promise<EstimateTemplate[]> => {
      const data = await api<EstimateTemplate[]>('/estimates/templates');

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
      return api<EstimateTemplate>('/estimates/templates', {
        method: 'POST',
        body: JSON.stringify(template),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estimate-templates'] });
      toast.success('Template created successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to create template: ${error.message}`);
    },
  });
}

export function useUpdateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<EstimateTemplate> & { id: string }) => {
      return api<EstimateTemplate>(`/estimates/templates/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estimate-templates'] });
      toast.success('Template updated');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update template: ${error.message}`);
    },
  });
}

export function useDeleteTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      return api(`/estimates/templates/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estimate-templates'] });
      toast.success('Template deleted');
    },
    onError: (error: Error) => {
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

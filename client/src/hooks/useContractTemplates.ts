import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Types
export interface ContractTemplate {
  id: string;
  builder_id: string | null;
  name: string;
  description: string | null;
  template_type: string;
  content: string;
  variables: string[];
  clause_ids: string[];
  default_signers: any[];
  default_expiration_days: number;
  requires_florida_lien_disclosure: boolean;
  version: number;
  is_active: boolean;
  is_default: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  clauses?: ContractClause[];
}

export interface ContractClause {
  id: string;
  builder_id: string | null;
  name: string;
  description: string | null;
  category: string;
  content: string;
  variables: string[];
  is_required: boolean;
  is_active: boolean;
  sort_order: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface VariableSource {
  id: string;
  variable_name: string;
  display_label: string;
  description: string | null;
  source_type: string;
  source_table: string | null;
  source_field: string | null;
  format_type: string | null;
  format_options: any;
  is_required: boolean;
  default_value: string | null;
  is_system: boolean;
  created_at: string;
}

export interface ContractDocument {
  id: string;
  contract_id: string;
  template_id: string | null;
  version: number;
  content: string;
  variables_snapshot: Record<string, string>;
  pdf_url: string | null;
  signed_pdf_url: string | null;
  signature_request_id: string | null;
  florida_lien_disclosure_acknowledged: boolean;
  florida_lien_disclosure_acknowledged_at: string | null;
  florida_lien_disclosure_acknowledged_by: string | null;
  created_by: string;
  created_at: string;
  template?: ContractTemplate;
}

// Helper for API calls
async function fetchApi<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`);
  }
  return response.json();
}

// Fetch all templates
export function useContractTemplates(options?: { type?: string; active_only?: boolean }) {
  return useQuery({
    queryKey: ['contract-templates', options],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (options?.type) params.set('type', options.type);
      if (options?.active_only) params.set('active_only', 'true');
      const data = await fetchApi<{ templates: ContractTemplate[] }>(`/api/contract-templates/templates?${params}`);
      return data.templates;
    },
  });
}

// Fetch single template
export function useContractTemplate(id: string | null) {
  return useQuery({
    queryKey: ['contract-template', id],
    queryFn: async () => {
      if (!id) return null;
      const data = await fetchApi<{ template: ContractTemplate }>(`/api/contract-templates/templates/${id}`);
      return data.template;
    },
    enabled: !!id,
  });
}

// Fetch all clauses
export function useContractClauses(options?: { category?: string; active_only?: boolean }) {
  return useQuery({
    queryKey: ['contract-clauses', options],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (options?.category) params.set('category', options.category);
      if (options?.active_only) params.set('active_only', 'true');
      const data = await fetchApi<{ clauses: ContractClause[] }>(`/api/contract-templates/clauses?${params}`);
      return data.clauses;
    },
  });
}

// Fetch clause categories
export function useClauseCategories() {
  return useQuery({
    queryKey: ['clause-categories'],
    queryFn: async () => {
      const data = await fetchApi<{ categories: { value: string; label: string }[] }>('/api/contract-templates/clauses/categories');
      return data.categories;
    },
  });
}

// Fetch variable sources
export function useVariableSources() {
  return useQuery({
    queryKey: ['variable-sources'],
    queryFn: async () => {
      const data = await fetchApi<{ variables: VariableSource[] }>('/api/contract-templates/variables');
      return data.variables;
    },
  });
}

// Resolve variables for a specific context
export function useResolveVariables() {
  return useMutation({
    mutationFn: async (params: {
      contract_id?: string;
      job_id?: string;
      lead_id?: string;
      company_id?: string;
      contact_id?: string;
      custom_values?: Record<string, string>;
    }) => {
      const data = await fetchApi<{ variables: Record<string, string> }>('/api/contract-templates/variables/resolve', {
        method: 'POST',
        body: JSON.stringify(params),
      });
      return data.variables;
    },
  });
}

// Generate document from template
export function useGenerateDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      contract_id: string;
      template_id: string;
      variables: Record<string, string>;
      created_by?: string;
    }) => {
      const data = await fetchApi<{ document: ContractDocument }>('/api/contract-templates/documents/generate', {
        method: 'POST',
        body: JSON.stringify(params),
      });
      return data.document;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['contract-documents', variables.contract_id] });
    },
  });
}

// Fetch documents for a contract
export function useContractDocuments(contractId: string | null) {
  return useQuery({
    queryKey: ['contract-documents', contractId],
    queryFn: async () => {
      if (!contractId) return [];
      const data = await fetchApi<{ documents: ContractDocument[] }>(`/api/contract-templates/documents/${contractId}`);
      return data.documents;
    },
    enabled: !!contractId,
  });
}

// Acknowledge Florida Lien Disclosure
export function useAcknowledgeDisclosure() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { documentId: string; acknowledged_by?: string }) => {
      const data = await fetchApi<{ document: ContractDocument }>(
        `/api/contract-templates/documents/${params.documentId}/acknowledge-disclosure`,
        {
          method: 'POST',
          body: JSON.stringify({ acknowledged_by: params.acknowledged_by }),
        }
      );
      return data.document;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['contract-documents', data.contract_id] });
    },
  });
}

// Fetch template types
export function useTemplateTypes() {
  return useQuery({
    queryKey: ['template-types'],
    queryFn: async () => {
      const data = await fetchApi<{ types: { value: string; label: string }[] }>('/api/contract-templates/template-types');
      return data.types;
    },
  });
}

// Create template
export function useCreateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (template: Partial<ContractTemplate>) => {
      const data = await fetchApi<{ template: ContractTemplate }>('/api/contract-templates/templates', {
        method: 'POST',
        body: JSON.stringify(template),
      });
      return data.template;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contract-templates'] });
    },
  });
}

// Update template
export function useUpdateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ContractTemplate> & { id: string }) => {
      const data = await fetchApi<{ template: ContractTemplate }>(`/api/contract-templates/templates/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
      return data.template;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['contract-templates'] });
      queryClient.invalidateQueries({ queryKey: ['contract-template', data.id] });
    },
  });
}

// Delete template
export function useDeleteTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await fetchApi(`/api/contract-templates/templates/${id}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contract-templates'] });
    },
  });
}

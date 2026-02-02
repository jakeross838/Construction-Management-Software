/**
 * useInvoicesInfinite Hook
 *
 * React Query hook for cursor-based infinite scrolling of invoices.
 * Uses cursor pagination which is better for real-time data because it handles
 * insertions/deletions without page drift.
 *
 * @example
 * // Basic usage
 * const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useInvoicesInfinite();
 *
 * // With filters
 * const { data } = useInvoicesInfinite({ status: 'approved', job_id: 'uuid-123' });
 *
 * // Access all loaded invoices
 * const allInvoices = data?.pages.flatMap(page => page.data) ?? [];
 */

import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';

// Invoice type (matching backend response)
export interface Invoice {
  id: string;
  job_id?: string;
  vendor_id?: string;
  po_id?: string;
  invoice_number?: string;
  invoice_date?: string;
  due_date?: string;
  amount: number;
  status: string;
  pdf_url?: string;
  pdf_stamped_url?: string;
  ai_processed?: boolean;
  ai_confidence?: Record<string, number>;
  ai_extracted_data?: Record<string, unknown>;
  needs_review?: boolean;
  review_flags?: string[];
  notes?: string;
  created_at: string;
  // Relations
  vendor?: { id: string; name: string; trade?: string };
  job?: { id: string; name: string };
  po?: { id: string; po_number: string; total_amount: number };
  allocations?: Array<{
    id: string;
    amount: number;
    notes?: string;
    job_id?: string;
    change_order_id?: string;
    po_id?: string;
    cost_code_id?: string;
    cost_code?: { id: string; code: string; name: string };
    purchase_order?: { id: string; po_number: string };
  }>;
  draw_invoices?: Array<{
    draw_id: string;
    draw?: { id: string; draw_number: number; status: string };
  }>;
}

// Cursor pagination response from API
export interface CursorPaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    type: 'cursor';
    nextCursor: string | null;
    hasMore: boolean;
  };
}

// Filter options for the query
export interface InvoiceFilters {
  job_id?: string;
  vendor_id?: string;
  status?: string;
  search?: string;
}

// Query options
export interface UseInvoicesInfiniteOptions extends InvoiceFilters {
  limit?: number;
  enabled?: boolean;
}

/**
 * Fetch a page of invoices using cursor pagination
 */
async function fetchInvoicesPage(
  filters: InvoiceFilters,
  limit: number,
  cursor?: string
): Promise<CursorPaginatedResponse<Invoice>> {
  const params = new URLSearchParams();

  // Always include limit for cursor pagination
  params.append('limit', String(limit));

  // Add cursor if provided (not first page)
  if (cursor) {
    params.append('cursor', cursor);
  }

  // Add filters
  if (filters.job_id) params.append('job_id', filters.job_id);
  if (filters.vendor_id) params.append('vendor_id', filters.vendor_id);
  if (filters.status) params.append('status', filters.status);
  if (filters.search) params.append('search', filters.search);

  const response = await fetch(`/api/invoices?${params.toString()}`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to fetch invoices');
  }

  return response.json();
}

/**
 * Hook for infinite scrolling of invoices with cursor pagination
 *
 * @param options - Filter and configuration options
 * @returns React Query infinite query result
 */
export function useInvoicesInfinite(options: UseInvoicesInfiniteOptions = {}) {
  const { job_id, vendor_id, status, search, limit = 50, enabled = true } = options;

  const filters: InvoiceFilters = { job_id, vendor_id, status, search };

  return useInfiniteQuery({
    queryKey: ['invoices', 'infinite', filters, limit],
    queryFn: ({ pageParam }) => fetchInvoicesPage(filters, limit, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      // Return the next cursor if there are more pages
      if (lastPage.pagination?.hasMore && lastPage.pagination?.nextCursor) {
        return lastPage.pagination.nextCursor;
      }
      return undefined; // No more pages
    },
    enabled,
    staleTime: 30 * 1000, // 30 seconds
    refetchOnWindowFocus: false,
  });
}

/**
 * Helper hook to get flattened invoice list from infinite query
 * Useful when you need all loaded invoices as a single array
 */
export function useAllLoadedInvoices(options: UseInvoicesInfiniteOptions = {}) {
  const query = useInvoicesInfinite(options);

  return {
    ...query,
    invoices: query.data?.pages.flatMap(page => page.data) ?? [],
    totalLoaded: query.data?.pages.reduce((sum, page) => sum + page.data.length, 0) ?? 0,
  };
}

/**
 * Hook to prefetch the next page of invoices
 * Useful for optimistic prefetching on hover or scroll near end
 */
export function usePrefetchNextInvoicesPage() {
  const queryClient = useQueryClient();

  return async (
    filters: InvoiceFilters,
    limit: number,
    nextCursor: string
  ) => {
    await queryClient.prefetchInfiniteQuery({
      queryKey: ['invoices', 'infinite', filters, limit],
      queryFn: ({ pageParam }) => fetchInvoicesPage(filters, limit, pageParam),
      initialPageParam: nextCursor,
    });
  };
}

/**
 * Hook to invalidate infinite invoice queries
 * Call this after mutations to refresh the list
 */
export function useInvalidateInvoicesInfinite() {
  const queryClient = useQueryClient();

  return () => {
    queryClient.invalidateQueries({ queryKey: ['invoices', 'infinite'] });
  };
}

export default useInvoicesInfinite;

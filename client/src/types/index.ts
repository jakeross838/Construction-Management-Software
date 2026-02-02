// =====================================================
// CENTRAL TYPE DEFINITIONS
// Ross Built Construction Management System
// =====================================================
// This file provides centralized type definitions for the entire application.
// Import from '@/types' for consistent typing across components and hooks.
// =====================================================

// Re-export all types from domain-specific files
export * from './financial';
export * from './job';
export * from './estimate';
export * from './auth';

// =====================================================
// COMMON UTILITY TYPES
// =====================================================

/**
 * Makes all properties of T nullable (can be null)
 */
export type Nullable<T> = { [P in keyof T]: T[P] | null };

/**
 * Makes specified keys required while keeping others optional
 */
export type RequireKeys<T, K extends keyof T> = T & Required<Pick<T, K>>;

/**
 * Makes specified keys optional while keeping others required
 */
export type OptionalKeys<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * Extracts only string keys from an object type
 */
export type StringKeys<T> = Extract<keyof T, string>;

/**
 * Generic ID type - all entities use UUID strings
 */
export type EntityId = string;

/**
 * ISO date string type for consistency
 */
export type ISODateString = string;

/**
 * Timestamp type for created_at, updated_at fields
 */
export type Timestamp = string;

// =====================================================
// API RESPONSE TYPES
// =====================================================

/**
 * Standard API success response wrapper
 */
export interface ApiResponse<T> {
  data: T;
  message?: string;
}

/**
 * Standard API error response
 */
export interface ApiError {
  error: string;
  message?: string;
  code?: string;
  details?: unknown;
}

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

/**
 * Pagination metadata
 */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

/**
 * Pagination request parameters
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
}

// =====================================================
// FILTER & SORT TYPES
// =====================================================

/**
 * Sort direction
 */
export type SortDirection = 'asc' | 'desc';

/**
 * Generic sort configuration
 */
export interface SortConfig<T> {
  field: keyof T;
  direction: SortDirection;
}

/**
 * Generic filter configuration
 */
export interface FilterConfig {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'in';
  value: unknown;
}

// =====================================================
// FORM & INPUT TYPES
// =====================================================

/**
 * Standard select option for dropdowns
 */
export interface SelectOption<T = string> {
  value: T;
  label: string;
}

/**
 * Select option with color for status badges
 */
export interface ColoredSelectOption<T = string> extends SelectOption<T> {
  color?: string;
  bgColor?: string;
}

/**
 * Form field validation result
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

// =====================================================
// ENTITY OPERATION TYPES
// =====================================================

/**
 * Standard entity insert type - omits auto-generated fields
 */
export type EntityInsert<T> = Omit<T, 'id' | 'created_at' | 'updated_at'>;

/**
 * Standard entity update type - partial update with required id
 */
export type EntityUpdate<T> = Partial<Omit<T, 'id' | 'created_at'>> & { id: string };

/**
 * Bulk operation result
 */
export interface BulkOperationResult {
  succeeded: number;
  failed: number;
  total: number;
  errors?: string[];
}

// =====================================================
// ACTIVITY & AUDIT TYPES
// =====================================================

/**
 * Activity action types
 */
export type ActivityAction =
  | 'created'
  | 'updated'
  | 'deleted'
  | 'approved'
  | 'rejected'
  | 'submitted'
  | 'status_changed'
  | 'attached'
  | 'detached';

/**
 * Generic activity log entry
 */
export interface ActivityEntry {
  id: string;
  entity_type: string;
  entity_id: string;
  action: ActivityAction | string;
  description: string | null;
  user_name: string | null;
  metadata: Record<string, unknown> | null;
  created_at: Timestamp;
}

// =====================================================
// FILE & DOCUMENT TYPES
// =====================================================

/**
 * File upload metadata
 */
export interface FileUpload {
  file: File;
  name: string;
  size: number;
  type: string;
}

/**
 * Stored document reference
 */
export interface StoredDocument {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number;
  uploaded_by: string | null;
  uploaded_at: Timestamp;
}

// =====================================================
// STATUS BADGE CONFIGURATION
// =====================================================

/**
 * Status badge configuration for UI display
 */
export interface StatusBadgeConfig {
  label: string;
  color: string;
  bgColor: string;
  icon?: string;
}

// =====================================================
// FETCH/QUERY STATE TYPES
// =====================================================

/**
 * Async operation state
 */
export interface AsyncState<T> {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Mutation state
 */
export interface MutationState {
  isPending: boolean;
  isSuccess: boolean;
  isError: boolean;
  error: Error | null;
}

// =====================================================
// TYPE GUARDS
// =====================================================

/**
 * Type guard to check if value is not null or undefined
 */
export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/**
 * Type guard to check if value is a non-empty string
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Type guard to check if value is a valid number (not NaN)
 */
export function isValidNumber(value: unknown): value is number {
  return typeof value === 'number' && !Number.isNaN(value);
}

/**
 * Type guard for API error responses
 */
export function isApiError(error: unknown): error is ApiError {
  return (
    typeof error === 'object' &&
    error !== null &&
    ('error' in error || 'message' in error)
  );
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Safely parse JSON with type assertion
 */
export function safeParseJSON<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

/**
 * Format currency for display (USD)
 */
export function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format compact currency (e.g., $1.5M, $500K)
 */
export function formatCurrencyCompact(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '$0';
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return formatCurrency(amount);
}

/**
 * Format date for display
 */
export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '--';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Format short date (no year)
 */
export function formatDateShort(date: string | Date | null | undefined): string {
  if (!date) return '--';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

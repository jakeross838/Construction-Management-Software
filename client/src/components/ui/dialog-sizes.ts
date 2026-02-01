/**
 * Standardized dialog size tiers
 * Use these constants to ensure consistent sizing across all dialogs
 */

export const DIALOG_SIZES = {
  /** 448px - Confirmations, single-field dialogs */
  sm: 'max-w-md',
  /** 512px - Simple forms (3-5 fields) */
  md: 'max-w-lg',
  /** 672px - Standard forms (6-12 fields) */
  form: 'max-w-2xl',
  /** 896px - Detail views, tabbed content */
  detail: 'max-w-4xl',
  /** 1152px - Complex tables/views */
  full: 'max-w-6xl',
  /** 95vw with max 1400px - Large data displays */
  viewport: 'max-w-[95vw] xl:max-w-[1400px]',
} as const;

export type DialogSize = keyof typeof DIALOG_SIZES;

/** Standard max height to prevent dialogs from overflowing viewport */
export const DIALOG_MAX_HEIGHT = 'max-h-[90vh]';

/** Get the width class for a dialog size */
export function getDialogSizeClass(size: DialogSize): string {
  return DIALOG_SIZES[size];
}

/** Standard content area height for scrollable dialogs */
export const DIALOG_CONTENT_HEIGHT = {
  /** For dialogs with header + footer */
  withFooter: 'max-h-[calc(90vh-12rem)]',
  /** For dialogs with only header */
  withoutFooter: 'max-h-[calc(90vh-6rem)]',
} as const;

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export interface BudgetImportResult {
  success: boolean;
  message: string;
  results: {
    imported: number;
    created_cost_codes: number;
    updated: number;
    skipped: Array<{ row: number; reason: string }>;
    errors: Array<{ row: number; error: string }>;
  };
}

/**
 * Download budget import template
 */
export async function downloadBudgetTemplate(): Promise<void> {
  try {
    const response = await fetch('/api/budget/template');
    if (!response.ok) {
      throw new Error('Failed to download template');
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Budget-Import-Template.xlsx';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    toast.success('Template downloaded successfully');
  } catch (error) {
    toast.error('Failed to download template');
    throw error;
  }
}

/**
 * Export current budget to Excel
 */
export async function exportBudgetToExcel(jobId: string, jobName?: string): Promise<void> {
  try {
    const response = await fetch(`/api/jobs/${jobId}/budget/export-excel`);
    if (!response.ok) {
      throw new Error('Failed to export budget');
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeName = (jobName || 'Budget').replace(/[^a-zA-Z0-9]/g, '_');
    a.download = `Budget-${safeName}-${new Date().toISOString().split('T')[0]}.xlsx`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    toast.success('Budget exported successfully');
  } catch (error) {
    toast.error('Failed to export budget');
    throw error;
  }
}

/**
 * Import budget from Excel file
 */
export function useImportBudget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ jobId, file }: { jobId: string; file: File }): Promise<BudgetImportResult> => {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`/api/jobs/${jobId}/budget/import-excel`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || error.message || `HTTP ${response.status}`);
      }

      return response.json();
    },
    onSuccess: (data, variables) => {
      // Invalidate budget queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['budget-lines', variables.jobId] });
      queryClient.invalidateQueries({ queryKey: ['budget-summary', variables.jobId] });
      queryClient.invalidateQueries({ queryKey: ['cost-codes'] });

      // Show success message with details
      const { results } = data;
      let message = `Imported ${results.imported} budget lines`;
      if (results.created_cost_codes > 0) {
        message += ` (${results.created_cost_codes} new cost codes created)`;
      }
      if (results.skipped.length > 0) {
        message += `. ${results.skipped.length} rows skipped.`;
      }
      if (results.errors.length > 0) {
        message += ` ${results.errors.length} errors.`;
        toast.warning(message);
      } else {
        toast.success(message);
      }
    },
    onError: (error: Error) => {
      toast.error(`Import failed: ${error.message}`);
    },
  });
}

/**
 * Parse Excel file locally for preview (without importing)
 */
export async function previewExcelFile(file: File): Promise<{
  headers: string[];
  rows: Array<Record<string, string | number>>;
  rowCount: number;
}> {
  // Dynamic import of xlsx for client-side preview
  const XLSX = await import('xlsx');

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });

        const sheetName = workbook.SheetNames.includes('Budget Template')
          ? 'Budget Template'
          : workbook.SheetNames[0];

        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as Array<Array<string | number>>;

        if (jsonData.length < 2) {
          reject(new Error('File must have at least a header row and one data row'));
          return;
        }

        const headers = jsonData[0].map(h => String(h || ''));
        const rows = jsonData.slice(1).map(row => {
          const obj: Record<string, string | number> = {};
          headers.forEach((h, i) => {
            obj[h || `Column${i + 1}`] = row[i];
          });
          return obj;
        });

        resolve({
          headers,
          rows: rows.slice(0, 100), // Limit preview to 100 rows
          rowCount: rows.length
        });
      } catch (err) {
        reject(new Error('Failed to parse Excel file'));
      }
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsBinaryString(file);
  });
}

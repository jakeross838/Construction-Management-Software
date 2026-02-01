/**
 * CSV Import/Export Utilities
 */

// Parse CSV content into array of objects
export function parseCSV<T extends Record<string, string>>(
  csvContent: string,
  options: {
    hasHeader?: boolean;
    columnMapping?: Record<string, string>;
  } = {}
): { data: T[]; headers: string[]; errors: string[] } {
  const { hasHeader = true, columnMapping = {} } = options;
  const errors: string[] = [];
  const lines = csvContent.split(/\r?\n/).filter(line => line.trim());

  if (lines.length === 0) {
    return { data: [], headers: [], errors: ['Empty CSV file'] };
  }

  // Parse headers
  const headerLine = lines[0];
  const headers = parseCSVLine(headerLine);

  if (!hasHeader) {
    // If no header, generate column names (col_0, col_1, etc.)
    return {
      data: lines.map((line, i) => {
        const values = parseCSVLine(line);
        const obj: Record<string, string> = {};
        values.forEach((val, j) => {
          const key = columnMapping[`col_${j}`] || `col_${j}`;
          obj[key] = val;
        });
        return obj as T;
      }),
      headers: headers.map((_, i) => `col_${i}`),
      errors,
    };
  }

  // Map headers to field names
  const mappedHeaders = headers.map(h => {
    const trimmed = h.trim().toLowerCase().replace(/\s+/g, '_');
    return columnMapping[trimmed] || columnMapping[h] || trimmed;
  });

  // Parse data rows
  const data: T[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    const values = parseCSVLine(line);
    if (values.length !== headers.length) {
      errors.push(`Row ${i + 1}: Expected ${headers.length} columns, got ${values.length}`);
      continue;
    }

    const obj: Record<string, string> = {};
    mappedHeaders.forEach((key, j) => {
      obj[key] = values[j]?.trim() || '';
    });
    data.push(obj as T);
  }

  return { data, headers: mappedHeaders, errors };
}

// Parse a single CSV line handling quoted values
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else {
        // Toggle quote mode
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

// Generate CSV content from array of objects
export function generateCSV<T extends Record<string, unknown>>(
  data: T[],
  options: {
    headers?: string[];
    columnOrder?: string[];
    columnLabels?: Record<string, string>;
  } = {}
): string {
  if (data.length === 0) return '';

  const { columnOrder, columnLabels = {} } = options;

  // Determine columns from data or use specified order
  const columns = columnOrder || Object.keys(data[0]);

  // Generate header row
  const headerRow = columns.map(col => {
    const label = columnLabels[col] || col;
    return escapeCSVValue(label);
  });

  // Generate data rows
  const dataRows = data.map(item =>
    columns.map(col => escapeCSVValue(String(item[col] ?? '')))
  );

  return [headerRow.join(','), ...dataRows.map(row => row.join(','))].join('\n');
}

// Escape a value for CSV
function escapeCSVValue(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// Download CSV file
export function downloadCSV(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

// Read file content as text
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

// Validate imported data against a schema
export interface ValidationRule {
  field: string;
  required?: boolean;
  type?: 'string' | 'number' | 'email' | 'date';
  pattern?: RegExp;
  validate?: (value: string) => boolean | string;
}

export function validateImportData<T extends Record<string, string>>(
  data: T[],
  rules: ValidationRule[]
): { valid: T[]; invalid: { row: number; data: T; errors: string[] }[] } {
  const valid: T[] = [];
  const invalid: { row: number; data: T; errors: string[] }[] = [];

  data.forEach((item, index) => {
    const errors: string[] = [];

    rules.forEach(rule => {
      const value = item[rule.field] || '';

      // Required check
      if (rule.required && !value.trim()) {
        errors.push(`${rule.field} is required`);
        return;
      }

      if (!value.trim()) return; // Skip other validations if empty and not required

      // Type check
      if (rule.type === 'number' && isNaN(Number(value))) {
        errors.push(`${rule.field} must be a number`);
      }
      if (rule.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        errors.push(`${rule.field} must be a valid email`);
      }
      if (rule.type === 'date' && isNaN(Date.parse(value))) {
        errors.push(`${rule.field} must be a valid date`);
      }

      // Pattern check
      if (rule.pattern && !rule.pattern.test(value)) {
        errors.push(`${rule.field} has invalid format`);
      }

      // Custom validation
      if (rule.validate) {
        const result = rule.validate(value);
        if (result !== true) {
          errors.push(typeof result === 'string' ? result : `${rule.field} is invalid`);
        }
      }
    });

    if (errors.length === 0) {
      valid.push(item);
    } else {
      invalid.push({ row: index + 2, data: item, errors }); // +2 for 1-based and header row
    }
  });

  return { valid, invalid };
}

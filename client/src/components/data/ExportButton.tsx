import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Download, FileSpreadsheet, ChevronDown } from 'lucide-react';
import { generateCSV, downloadCSV } from '@/lib/csv-utils';

interface ExportColumn {
  key: string;
  label: string;
  formatter?: (value: unknown) => string;
}

interface ExportButtonProps<T extends Record<string, unknown>> {
  data: T[];
  columns: ExportColumn[];
  filename: string;
  variant?: 'default' | 'outline' | 'secondary' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
  disabled?: boolean;
}

export function ExportButton<T extends Record<string, unknown>>({
  data,
  columns,
  filename,
  variant = 'outline',
  size = 'sm',
  className,
  disabled,
}: ExportButtonProps<T>) {
  const handleExportCSV = () => {
    // Transform data using formatters
    const transformedData = data.map(item => {
      const transformed: Record<string, string> = {};
      columns.forEach(col => {
        const value = item[col.key];
        transformed[col.key] = col.formatter
          ? col.formatter(value)
          : String(value ?? '');
      });
      return transformed;
    });

    const csv = generateCSV(transformedData, {
      columnOrder: columns.map(c => c.key),
      columnLabels: Object.fromEntries(columns.map(c => [c.key, c.label])),
    });

    const timestamp = new Date().toISOString().split('T')[0];
    downloadCSV(csv, `${filename}-${timestamp}.csv`);
  };

  const handleExportJSON = () => {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    const timestamp = new Date().toISOString().split('T')[0];
    link.download = `${filename}-${timestamp}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  if (data.length === 0) {
    return (
      <Button variant={variant} size={size} className={className} disabled>
        <Download className="h-4 w-4 mr-2" />
        Export
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size} className={className} disabled={disabled}>
          <Download className="h-4 w-4 mr-2" />
          Export
          <ChevronDown className="h-4 w-4 ml-1" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleExportCSV}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Export as CSV ({data.length} rows)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExportJSON}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Export as JSON
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

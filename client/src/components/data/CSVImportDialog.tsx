import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import {
  Upload,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle,
  X,
  Loader2,
  Download,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  parseCSV,
  validateImportData,
  readFileAsText,
  downloadCSV,
  generateCSV,
  ValidationRule,
} from '@/lib/csv-utils';

interface CSVImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  templateColumns: { key: string; label: string; required?: boolean }[];
  validationRules?: ValidationRule[];
  onImport: (data: Record<string, string>[]) => Promise<void>;
  sampleData?: Record<string, string>[];
}

type ImportStep = 'upload' | 'preview' | 'importing' | 'complete';

export function CSVImportDialog({
  open,
  onOpenChange,
  title,
  description,
  templateColumns,
  validationRules = [],
  onImport,
  sampleData,
}: CSVImportDialogProps) {
  const [step, setStep] = useState<ImportStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<Record<string, string>[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [validData, setValidData] = useState<Record<string, string>[]>([]);
  const [invalidData, setInvalidData] = useState<{ row: number; data: Record<string, string>; errors: string[] }[]>([]);
  const [importError, setImportError] = useState<string | null>(null);
  const [importedCount, setImportedCount] = useState(0);

  const resetState = () => {
    setStep('upload');
    setFile(null);
    setParsedData([]);
    setParseErrors([]);
    setValidData([]);
    setInvalidData([]);
    setImportError(null);
    setImportedCount(0);
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    const file = acceptedFiles[0];
    setFile(file);

    try {
      const content = await readFileAsText(file);

      // Create column mapping from template
      const columnMapping: Record<string, string> = {};
      templateColumns.forEach(col => {
        columnMapping[col.label.toLowerCase().replace(/\s+/g, '_')] = col.key;
        columnMapping[col.key.toLowerCase()] = col.key;
      });

      const { data, errors } = parseCSV(content, { columnMapping });
      setParsedData(data);
      setParseErrors(errors);

      // Validate data
      if (validationRules.length > 0) {
        const { valid, invalid } = validateImportData(data, validationRules);
        setValidData(valid);
        setInvalidData(invalid);
      } else {
        setValidData(data);
        setInvalidData([]);
      }

      setStep('preview');
    } catch (err) {
      setParseErrors(['Failed to parse CSV file']);
    }
  }, [templateColumns, validationRules]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.csv'],
    },
    maxFiles: 1,
  });

  const handleDownloadTemplate = () => {
    const headers = templateColumns.map(col => col.label);
    let content: string;

    if (sampleData && sampleData.length > 0) {
      content = generateCSV(sampleData, {
        columnOrder: templateColumns.map(col => col.key),
        columnLabels: Object.fromEntries(templateColumns.map(col => [col.key, col.label])),
      });
    } else {
      content = headers.join(',');
    }

    downloadCSV(content, `${title.toLowerCase().replace(/\s+/g, '-')}-template.csv`);
  };

  const handleImport = async () => {
    setStep('importing');
    setImportError(null);

    try {
      await onImport(validData);
      setImportedCount(validData.length);
      setStep('complete');
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Import failed');
      setStep('preview');
    }
  };

  const handleClose = () => {
    resetState();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4 py-4">
            <div
              {...getRootProps()}
              className={cn(
                'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
                isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
              )}
            >
              <input {...getInputProps()} />
              <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
              {isDragActive ? (
                <p className="text-primary">Drop the CSV file here...</p>
              ) : (
                <>
                  <p className="font-medium">Drag & drop a CSV file here</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    or click to select a file
                  </p>
                </>
              )}
            </div>

            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm">Need the template?</span>
              </div>
              <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
                <Download className="h-4 w-4 mr-2" />
                Download Template
              </Button>
            </div>

            <div className="text-sm text-muted-foreground">
              <p className="font-medium mb-2">Required columns:</p>
              <div className="flex flex-wrap gap-2">
                {templateColumns.map(col => (
                  <Badge
                    key={col.key}
                    variant={col.required ? 'default' : 'outline'}
                  >
                    {col.label}
                    {col.required && '*'}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4 py-4 flex-1 overflow-hidden flex flex-col">
            {parseErrors.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Parse Errors</AlertTitle>
                <AlertDescription>
                  {parseErrors.map((err, i) => (
                    <div key={i}>{err}</div>
                  ))}
                </AlertDescription>
              </Alert>
            )}

            {importError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Import Error</AlertTitle>
                <AlertDescription>{importError}</AlertDescription>
              </Alert>
            )}

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm font-medium">{file?.name}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFile(null);
                  setStep('upload');
                }}
              >
                <X className="h-4 w-4 mr-1" />
                Remove
              </Button>
            </div>

            <div className="flex gap-4">
              <Badge variant="secondary" className="gap-1">
                <CheckCircle className="h-3 w-3 text-green-600" />
                {validData.length} valid
              </Badge>
              {invalidData.length > 0 && (
                <Badge variant="destructive" className="gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {invalidData.length} with errors
                </Badge>
              )}
            </div>

            {invalidData.length > 0 && (
              <Alert variant="destructive" className="py-2">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  {invalidData.slice(0, 3).map((item, i) => (
                    <div key={i}>
                      Row {item.row}: {item.errors.join(', ')}
                    </div>
                  ))}
                  {invalidData.length > 3 && (
                    <div>...and {invalidData.length - 3} more</div>
                  )}
                </AlertDescription>
              </Alert>
            )}

            <ScrollArea className="flex-1 border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[60px]">#</TableHead>
                    {templateColumns.map(col => (
                      <TableHead key={col.key}>{col.label}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {validData.slice(0, 50).map((row, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                      {templateColumns.map(col => (
                        <TableCell key={col.key} className="max-w-[200px] truncate">
                          {row[col.key] || '-'}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {validData.length > 50 && (
                <div className="p-2 text-center text-sm text-muted-foreground border-t">
                  Showing 50 of {validData.length} rows
                </div>
              )}
            </ScrollArea>
          </div>
        )}

        {step === 'importing' && (
          <div className="py-12 text-center">
            <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary mb-4" />
            <p className="text-lg font-medium">Importing data...</p>
            <p className="text-sm text-muted-foreground mt-1">
              Processing {validData.length} records
            </p>
          </div>
        )}

        {step === 'complete' && (
          <div className="py-12 text-center">
            <CheckCircle className="h-12 w-12 mx-auto text-green-600 mb-4" />
            <p className="text-lg font-medium">Import Complete</p>
            <p className="text-sm text-muted-foreground mt-1">
              Successfully imported {importedCount} record(s)
            </p>
          </div>
        )}

        <DialogFooter>
          {step === 'upload' && (
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
          )}
          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={() => setStep('upload')}>
                Back
              </Button>
              <Button
                onClick={handleImport}
                disabled={validData.length === 0}
              >
                Import {validData.length} Record(s)
              </Button>
            </>
          )}
          {step === 'complete' && (
            <Button onClick={handleClose}>
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, FileText, ArrowRight, Loader2, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import {
  usePreviewCSV,
  useImportLeads,
  useLeadFields,
  useMappingTemplates,
} from '@/hooks/useLeadImports';

interface LeadImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Step = 'upload' | 'mapping' | 'preview' | 'importing' | 'complete';

export function LeadImportDialog({ open, onOpenChange }: LeadImportDialogProps) {
  const [step, setStep] = useState<Step>('upload');
  const [csvContent, setCsvContent] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [sampleRows, setSampleRows] = useState<Record<string, string>[]>([]);
  const [totalRows, setTotalRows] = useState<number>(0);
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [importResult, setImportResult] = useState<{
    successful: number;
    failed: number;
    errors: Array<{ row: number; error: string }>;
  } | null>(null);

  const { data: leadFields = [] } = useLeadFields();
  const { data: templates = [] } = useMappingTemplates();
  const previewCSV = usePreviewCSV();
  const importLeads = useImportLeads();

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      setCsvContent(content);

      // Preview the CSV
      try {
        const result = await previewCSV.mutateAsync({ csvContent: content, sampleSize: 5 });
        setCsvHeaders(result.headers);
        setSampleRows(result.sample_rows);
        setTotalRows(result.total_rows);

        // Auto-map matching headers
        const autoMappings: Record<string, string> = {};
        result.headers.forEach((header) => {
          const normalized = header.toLowerCase().replace(/\s+/g, '_');
          const matchingField = leadFields.find(
            (f) => f.name === normalized || f.label.toLowerCase().replace(/\s+/g, '_') === normalized
          );
          if (matchingField) {
            autoMappings[normalized] = matchingField.name;
          }
        });
        setMappings(autoMappings);

        setStep('mapping');
      } catch (err) {
        // Error handled by mutation
      }
    };
    reader.readAsText(file);
  }, [previewCSV, leadFields]);

  const applyTemplate = (templateId: string) => {
    const template = templates.find((t) => t.id === templateId);
    if (template) {
      setMappings(template.mappings);
    }
  };

  const handleMapping = (csvField: string, leadField: string) => {
    setMappings((prev) => ({
      ...prev,
      [csvField]: leadField,
    }));
  };

  const handleImport = async () => {
    setStep('importing');
    try {
      const result = await importLeads.mutateAsync({
        csvContent,
        fileName,
        mappings,
      });
      setImportResult({
        successful: result.successful,
        failed: result.failed,
        errors: result.errors,
      });
      setStep('complete');
    } catch (err) {
      setStep('mapping');
    }
  };

  const handleClose = () => {
    // Reset state
    setStep('upload');
    setCsvContent('');
    setFileName('');
    setCsvHeaders([]);
    setSampleRows([]);
    setTotalRows(0);
    setMappings({});
    setImportResult(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import Leads from CSV
          </DialogTitle>
          <DialogDescription>
            {step === 'upload' && 'Upload a CSV file to import leads'}
            {step === 'mapping' && 'Map CSV columns to lead fields'}
            {step === 'preview' && 'Review before importing'}
            {step === 'importing' && 'Importing leads...'}
            {step === 'complete' && 'Import complete'}
          </DialogDescription>
        </DialogHeader>

        {/* Step: Upload */}
        {step === 'upload' && (
          <div className="space-y-4 py-4">
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground mb-4">
                Upload a CSV file with your lead data
              </p>
              <Input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="max-w-xs mx-auto"
              />
            </div>
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                CSV should include headers in the first row. Common fields: first_name, last_name, email, phone, company, project_address
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* Step: Mapping */}
        {step === 'mapping' && (
          <div className="space-y-4 py-4">
            <div className="flex items-center justify-between">
              <div>
                <Badge variant="secondary">{fileName}</Badge>
                <span className="text-sm text-muted-foreground ml-2">
                  {totalRows} rows to import
                </span>
              </div>
              {templates.length > 0 && (
                <Select onValueChange={applyTemplate}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Apply template..." />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>CSV Column</TableHead>
                    <TableHead></TableHead>
                    <TableHead>Lead Field</TableHead>
                    <TableHead>Sample Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {csvHeaders.map((header) => {
                    const normalizedHeader = header.toLowerCase().replace(/\s+/g, '_');
                    const sampleValue = sampleRows[0]?.[normalizedHeader] || '';
                    return (
                      <TableRow key={header}>
                        <TableCell className="font-medium">{header}</TableCell>
                        <TableCell>
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        </TableCell>
                        <TableCell>
                          <Select
                            value={mappings[normalizedHeader] || ''}
                            onValueChange={(v) => handleMapping(normalizedHeader, v)}
                          >
                            <SelectTrigger className="w-48">
                              <SelectValue placeholder="Skip this column" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="">Skip this column</SelectItem>
                              {leadFields.map((field) => (
                                <SelectItem key={field.name} value={field.name}>
                                  {field.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-muted-foreground truncate max-w-[150px]">
                          {sampleValue}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* Step: Importing */}
        {step === 'importing' && (
          <div className="py-12 text-center">
            <Loader2 className="h-12 w-12 mx-auto animate-spin text-primary mb-4" />
            <p className="text-lg font-medium">Importing leads...</p>
            <p className="text-sm text-muted-foreground">This may take a moment</p>
          </div>
        )}

        {/* Step: Complete */}
        {step === 'complete' && importResult && (
          <div className="space-y-4 py-4">
            <div className="text-center py-4">
              {importResult.failed === 0 ? (
                <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
              ) : (
                <AlertTriangle className="h-12 w-12 mx-auto text-amber-500 mb-4" />
              )}
              <p className="text-lg font-medium">
                Import Complete
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-green-50 rounded-lg p-4 text-center">
                <CheckCircle className="h-6 w-6 mx-auto text-green-500 mb-2" />
                <p className="text-2xl font-bold text-green-700">{importResult.successful}</p>
                <p className="text-sm text-green-600">Successful</p>
              </div>
              <div className="bg-red-50 rounded-lg p-4 text-center">
                <XCircle className="h-6 w-6 mx-auto text-red-500 mb-2" />
                <p className="text-2xl font-bold text-red-700">{importResult.failed}</p>
                <p className="text-sm text-red-600">Failed</p>
              </div>
            </div>

            {importResult.errors.length > 0 && (
              <div className="space-y-2">
                <Label>Errors (first 10):</Label>
                <div className="border rounded-lg p-2 max-h-32 overflow-y-auto bg-muted/50">
                  {importResult.errors.slice(0, 10).map((err, i) => (
                    <p key={i} className="text-xs text-red-600">
                      Row {err.row}: {err.error}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {step === 'upload' && (
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
          )}
          {step === 'mapping' && (
            <>
              <Button variant="outline" onClick={() => setStep('upload')}>
                Back
              </Button>
              <Button
                onClick={handleImport}
                disabled={Object.keys(mappings).length === 0}
              >
                Import {totalRows} Leads
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

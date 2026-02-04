import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import {
  FileText,
  Variable,
  Eye,
  Save,
  Send,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  FileSignature,
  Scale,
  Info,
  Calculator,
  Download,
} from 'lucide-react';
import { ContractPricingEngine } from './ContractPricingEngine';
import { SendForSignatureDialog } from './SendForSignatureDialog';
import {
  useContractTemplates,
  useContractTemplate,
  useVariableSources,
  useResolveVariables,
  VariableSource,
} from '@/hooks/useContractTemplates';
import { useCreateContract } from '@/hooks/useContracts';

interface ContractBuilderProps {
  jobId?: string;
  leadId?: string;
  contactId?: string;
  companyId?: string;
  onSave?: (contractId: string) => void;
  onCancel?: () => void;
}

export function ContractBuilder({
  jobId,
  leadId,
  contactId,
  companyId,
  onSave,
  onCancel,
}: ContractBuilderProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState('template');
  const [showDisclosure, setShowDisclosure] = useState(false);
  const [disclosureAcknowledged, setDisclosureAcknowledged] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [contractName, setContractName] = useState('');
  const [showSendDialog, setShowSendDialog] = useState(false);
  const [savedDocumentId, setSavedDocumentId] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  // Fetch data
  const { data: templates = [], isLoading: loadingTemplates } = useContractTemplates({ active_only: true });
  const { data: template } = useContractTemplate(selectedTemplateId);
  const { data: variableSources = [] } = useVariableSources();
  const resolveVariables = useResolveVariables();
  const createContract = useCreateContract();

  // Create a map of variable sources for quick lookup
  const variableSourceMap = useMemo(() => {
    const map: Record<string, VariableSource> = {};
    variableSources.forEach(v => {
      map[v.variable_name] = v;
    });
    return map;
  }, [variableSources]);

  // Auto-resolve variables when context changes
  useEffect(() => {
    if (template && (jobId || leadId || contactId || companyId)) {
      resolveVariables.mutate(
        { job_id: jobId, lead_id: leadId, contact_id: contactId, company_id: companyId },
        {
          onSuccess: (resolved) => {
            setVariableValues(prev => ({
              ...resolved,
              ...prev, // Keep any user-edited values
            }));
          },
        }
      );
    }
  }, [template, jobId, leadId, contactId, companyId]);

  // Get required variables from template
  const templateVariables = useMemo(() => {
    if (!template) return [];
    return template.variables.map(varName => ({
      name: varName,
      source: variableSourceMap[varName],
      value: variableValues[varName] || '',
      isRequired: variableSourceMap[varName]?.is_required || false,
    }));
  }, [template, variableSourceMap, variableValues]);

  // Generate preview content
  const previewContent = useMemo(() => {
    if (!template) return '';
    let content = template.content;
    for (const [key, value] of Object.entries(variableValues)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      content = content.replace(regex, value || `[${key}]`);
    }
    // Handle Florida Lien Disclosure
    if (content.includes('{{FLORIDA_LIEN_DISCLOSURE}}')) {
      const disclosure = `NOTICE TO OWNER

YOU ARE BEING ASKED TO SIGN A PROPOSAL OR CONTRACT FOR RESIDENTIAL CONSTRUCTION OR IMPROVEMENTS. FLORIDA LAW (CHAPTER 713, FLORIDA STATUTES) REQUIRES THAT THE OWNER OF RESIDENTIAL PROPERTY BE GIVEN WRITTEN NOTICE OF CERTAIN RIGHTS AND RESPONSIBILITIES REGARDING CONSTRUCTION LIENS.

FLORIDA'S CONSTRUCTION LIEN LAW ALLOWS CONTRACTORS, SUBCONTRACTORS, AND MATERIAL SUPPLIERS TO RECORD LIENS AGAINST YOUR PROPERTY IF THEY ARE NOT PAID FOR WORK THEY PERFORM OR MATERIALS THEY PROVIDE FOR YOUR PROJECT - EVEN IF YOU HAVE ALREADY PAID YOUR GENERAL CONTRACTOR.

TO PROTECT YOURSELF:
1. REQUIRE YOUR CONTRACTOR TO GIVE YOU A LIST OF ALL SUBCONTRACTORS AND MATERIAL SUPPLIERS WORKING ON YOUR PROJECT.
2. REQUIRE YOUR CONTRACTOR TO OBTAIN LIEN RELEASES FROM ALL SUBCONTRACTORS AND MATERIAL SUPPLIERS BEFORE YOU MAKE FINAL PAYMENT.
3. CONSIDER REQUIRING THAT ALL PAYMENTS BE MADE BY JOINT CHECK PAYABLE TO BOTH YOUR CONTRACTOR AND THE SUBCONTRACTOR OR MATERIAL SUPPLIER.`;
      content = content.replace(/{{FLORIDA_LIEN_DISCLOSURE}}/g, disclosure);
    }
    return content;
  }, [template, variableValues]);

  // Check if all required variables are filled
  const missingRequired = useMemo(() => {
    return templateVariables
      .filter(v => v.isRequired && !v.value)
      .map(v => v.source?.display_label || v.name);
  }, [templateVariables]);

  // Handle variable change
  const handleVariableChange = (varName: string, value: string) => {
    setVariableValues(prev => ({ ...prev, [varName]: value }));
  };

  // Handle save/create contract
  const handleSave = async (sendForSignature: boolean = false) => {
    if (!template || !contractName) return;

    // Check if disclosure needs acknowledgment
    if (template.requires_florida_lien_disclosure && !disclosureAcknowledged) {
      setShowDisclosure(true);
      return;
    }

    setIsSaving(true);
    try {
      const contract = await createContract.mutateAsync({
        name: contractName,
        contract_type: template.template_type === 'prime_contract' ? 'prime' : template.template_type,
        job_id: jobId,
        lead_id: leadId,
        contact_id: contactId,
        company_id: companyId,
        status: sendForSignature ? 'pending_signature' : 'draft',
      });

      setSavedDocumentId(contract.id);

      if (sendForSignature) {
        setShowSendDialog(true);
      } else if (onSave) {
        onSave(contract.id);
      }
    } catch (error) {
      console.error('Failed to create contract:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!template || !renderedContent) return;

    setIsDownloading(true);
    try {
      const response = await fetch('/api/contract-templates/pdf/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: renderedContent,
          title: contractName || template.name || 'Contract',
          include_florida_disclosure: template.requires_florida_lien_disclosure,
        }),
      });

      if (!response.ok) throw new Error('Failed to generate PDF');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${contractName || 'contract'}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Failed to download PDF:', error);
    } finally {
      setIsDownloading(false);
    }
  };

  // Handle disclosure acknowledgment
  const handleDisclosureAcknowledge = () => {
    setDisclosureAcknowledged(true);
    setShowDisclosure(false);
  };

  // Group variables by source type
  const groupedVariables = useMemo(() => {
    const groups: Record<string, typeof templateVariables> = {
      owner: [],
      project: [],
      contract: [],
      pricing: [],
      other: [],
    };

    templateVariables.forEach(v => {
      const sourceType = v.source?.source_type;
      if (sourceType === 'contact') {
        groups.owner.push(v);
      } else if (sourceType === 'job') {
        groups.project.push(v);
      } else if (sourceType === 'contract') {
        groups.contract.push(v);
      } else if (v.name.includes('PERCENT') || v.name.includes('AMOUNT') || v.name.includes('RATE') || v.name.includes('THRESHOLD')) {
        groups.pricing.push(v);
      } else {
        groups.other.push(v);
      }
    });

    return groups;
  }, [templateVariables]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Contract Builder</h2>
          <p className="text-sm text-muted-foreground">Create a new contract from a template</p>
        </div>
        <div className="flex gap-2">
          {onCancel && (
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button
            variant="outline"
            onClick={handleDownloadPDF}
            disabled={!selectedTemplateId || !renderedContent || isDownloading}
          >
            {isDownloading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
            Download PDF
          </Button>
          <Button
            variant="outline"
            onClick={() => handleSave(false)}
            disabled={!selectedTemplateId || !contractName || isSaving}
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Save Draft
          </Button>
          <Button
            variant="default"
            onClick={() => handleSave(true)}
            disabled={!selectedTemplateId || !contractName || missingRequired.length > 0 || isSaving}
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
            Save & Send
          </Button>
        </div>
      </div>

      {/* Contract Name */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="contract-name">Contract Name *</Label>
              <Input
                id="contract-name"
                placeholder="e.g., Smith Residence Construction Agreement"
                value={contractName}
                onChange={(e) => setContractName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Template *</Label>
              <Select
                value={selectedTemplateId || ''}
                onValueChange={setSelectedTemplateId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a template..." />
                </SelectTrigger>
                <SelectContent>
                  {templates.map(t => (
                    <SelectItem key={t.id} value={t.id}>
                      <div className="flex items-center gap-2">
                        <span>{t.name}</span>
                        {t.is_default && <Badge variant="secondary" className="text-xs">Default</Badge>}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content */}
      {selectedTemplateId && template && (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="template" className="gap-2">
              <FileText className="h-4 w-4" />
              Template
            </TabsTrigger>
            <TabsTrigger value="pricing" className="gap-2">
              <Calculator className="h-4 w-4" />
              Pricing
            </TabsTrigger>
            <TabsTrigger value="variables" className="gap-2">
              <Variable className="h-4 w-4" />
              Variables
              {missingRequired.length > 0 && (
                <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 flex items-center justify-center">
                  {missingRequired.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="preview" className="gap-2">
              <Eye className="h-4 w-4" />
              Preview
            </TabsTrigger>
          </TabsList>

          {/* Template Tab */}
          <TabsContent value="template" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileSignature className="h-5 w-5" />
                  {template.name}
                </CardTitle>
                <CardDescription>{template.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-sm text-muted-foreground">Type</p>
                    <p className="font-medium capitalize">{template.template_type.replace(/_/g, ' ')}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Variables</p>
                    <p className="font-medium">{template.variables.length} fields to fill</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Default Expiration</p>
                    <p className="font-medium">{template.default_expiration_days} days</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Florida Lien Disclosure</p>
                    <p className="font-medium flex items-center gap-2">
                      {template.requires_florida_lien_disclosure ? (
                        <>
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                          Required
                        </>
                      ) : (
                        'Not Required'
                      )}
                    </p>
                  </div>
                </div>

                {template.requires_florida_lien_disclosure && (
                  <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-950 rounded-lg border border-amber-200 dark:border-amber-800">
                    <div className="flex items-start gap-3">
                      <Scale className="h-5 w-5 text-amber-600 mt-0.5" />
                      <div>
                        <p className="font-medium text-amber-800 dark:text-amber-200">Florida Construction Lien Law Notice</p>
                        <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                          This contract template includes the required Florida Construction Lien Law disclosure.
                          The client will need to acknowledge receipt of this notice before signing.
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-2"
                          onClick={() => setShowDisclosure(true)}
                        >
                          <Info className="h-4 w-4 mr-2" />
                          View Disclosure
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Pricing Tab */}
          <TabsContent value="pricing" className="space-y-4">
            <ContractPricingEngine
              jobId={jobId}
              leadId={leadId}
              onPricingChange={(pricing) => {
                // Update variable values with calculated pricing
                setVariableValues(prev => ({
                  ...prev,
                  CONTRACT_AMOUNT: pricing.contract_amount
                    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(pricing.contract_amount)
                    : '',
                  GMP_AMOUNT: pricing.gmp_amount
                    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(pricing.gmp_amount)
                    : '',
                  BUILDER_FEE_PERCENT: pricing.builder_fee_percent?.toString() || '',
                  RETAINAGE_PERCENT: variableValues.RETAINAGE_PERCENT || '10',
                }));
              }}
            />

            {/* Pricing Summary Card */}
            {variableValues.CONTRACT_AMOUNT && (
              <Card className="border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                      <span className="font-medium text-green-800 dark:text-green-200">
                        Contract Amount Set
                      </span>
                    </div>
                    <span className="text-lg font-bold text-green-700 dark:text-green-300">
                      {variableValues.CONTRACT_AMOUNT}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Variables Tab */}
          <TabsContent value="variables" className="space-y-4">
            {missingRequired.length > 0 && (
              <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950 dark:border-amber-800">
                <CardContent className="pt-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-600" />
                    <div>
                      <p className="font-medium text-amber-800 dark:text-amber-200">Missing Required Fields</p>
                      <p className="text-sm text-amber-700 dark:text-amber-300">
                        Please fill in: {missingRequired.join(', ')}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              {/* Owner Information */}
              {groupedVariables.owner.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Owner Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {groupedVariables.owner.map(v => (
                      <div key={v.name} className="space-y-2">
                        <Label htmlFor={v.name} className="flex items-center gap-2">
                          {v.source?.display_label || v.name}
                          {v.isRequired && <span className="text-red-500">*</span>}
                        </Label>
                        <Input
                          id={v.name}
                          value={v.value}
                          onChange={(e) => handleVariableChange(v.name, e.target.value)}
                          placeholder={v.source?.description || ''}
                        />
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Project Information */}
              {groupedVariables.project.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Project Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {groupedVariables.project.map(v => (
                      <div key={v.name} className="space-y-2">
                        <Label htmlFor={v.name} className="flex items-center gap-2">
                          {v.source?.display_label || v.name}
                          {v.isRequired && <span className="text-red-500">*</span>}
                        </Label>
                        {v.name === 'PROJECT_DESCRIPTION' ? (
                          <Textarea
                            id={v.name}
                            value={v.value}
                            onChange={(e) => handleVariableChange(v.name, e.target.value)}
                            placeholder={v.source?.description || ''}
                            rows={3}
                          />
                        ) : (
                          <Input
                            id={v.name}
                            value={v.value}
                            onChange={(e) => handleVariableChange(v.name, e.target.value)}
                            placeholder={v.source?.description || ''}
                          />
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Pricing Terms */}
              {groupedVariables.pricing.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Pricing Terms</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {groupedVariables.pricing.map(v => (
                      <div key={v.name} className="space-y-2">
                        <Label htmlFor={v.name} className="flex items-center gap-2">
                          {v.source?.display_label || v.name}
                          {v.isRequired && <span className="text-red-500">*</span>}
                        </Label>
                        <Input
                          id={v.name}
                          type={v.source?.format_type === 'currency' || v.source?.format_type === 'percentage' ? 'number' : 'text'}
                          value={v.value}
                          onChange={(e) => handleVariableChange(v.name, e.target.value)}
                          placeholder={v.source?.default_value || v.source?.description || ''}
                        />
                        {v.source?.format_type && (
                          <p className="text-xs text-muted-foreground">
                            Format: {v.source.format_type}
                            {v.source.default_value && ` (Default: ${v.source.default_value})`}
                          </p>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Other Fields */}
              {groupedVariables.other.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Additional Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {groupedVariables.other.map(v => (
                      <div key={v.name} className="space-y-2">
                        <Label htmlFor={v.name} className="flex items-center gap-2">
                          {v.source?.display_label || v.name}
                          {v.isRequired && <span className="text-red-500">*</span>}
                        </Label>
                        <Input
                          id={v.name}
                          value={v.value}
                          onChange={(e) => handleVariableChange(v.name, e.target.value)}
                          placeholder={v.source?.description || ''}
                        />
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* Preview Tab */}
          <TabsContent value="preview">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  Contract Preview
                </CardTitle>
                <CardDescription>
                  Review the generated contract document
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[600px] w-full rounded-md border p-6">
                  <pre className="whitespace-pre-wrap font-serif text-sm leading-relaxed">
                    {previewContent}
                  </pre>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* Florida Lien Law Disclosure Modal */}
      <Dialog open={showDisclosure} onOpenChange={setShowDisclosure}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Scale className="h-5 w-5" />
              Florida Construction Lien Law Notice
            </DialogTitle>
            <DialogDescription>
              Required disclosure under Florida Statutes Chapter 713
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-4 text-sm">
              <div className="p-4 bg-amber-50 dark:bg-amber-950 rounded-lg border border-amber-200 dark:border-amber-800">
                <p className="font-bold text-center mb-4">NOTICE TO OWNER</p>

                <p className="mb-4">
                  YOU ARE BEING ASKED TO SIGN A PROPOSAL OR CONTRACT FOR RESIDENTIAL CONSTRUCTION OR IMPROVEMENTS.
                  FLORIDA LAW (CHAPTER 713, FLORIDA STATUTES) REQUIRES THAT THE OWNER OF RESIDENTIAL PROPERTY BE
                  GIVEN WRITTEN NOTICE OF CERTAIN RIGHTS AND RESPONSIBILITIES REGARDING CONSTRUCTION LIENS.
                </p>

                <p className="mb-4">
                  FLORIDA'S CONSTRUCTION LIEN LAW ALLOWS CONTRACTORS, SUBCONTRACTORS, AND MATERIAL SUPPLIERS TO
                  RECORD LIENS AGAINST YOUR PROPERTY IF THEY ARE NOT PAID FOR WORK THEY PERFORM OR MATERIALS THEY
                  PROVIDE FOR YOUR PROJECT - EVEN IF YOU HAVE ALREADY PAID YOUR GENERAL CONTRACTOR.
                </p>

                <p className="font-semibold mb-2">TO PROTECT YOURSELF:</p>

                <ol className="list-decimal list-inside space-y-2 mb-4">
                  <li>
                    REQUIRE YOUR CONTRACTOR TO GIVE YOU A LIST OF ALL SUBCONTRACTORS AND MATERIAL SUPPLIERS
                    WORKING ON YOUR PROJECT.
                  </li>
                  <li>
                    REQUIRE YOUR CONTRACTOR TO OBTAIN LIEN RELEASES FROM ALL SUBCONTRACTORS AND MATERIAL
                    SUPPLIERS BEFORE YOU MAKE FINAL PAYMENT.
                  </li>
                  <li>
                    CONSIDER REQUIRING THAT ALL PAYMENTS BE MADE BY JOINT CHECK PAYABLE TO BOTH YOUR CONTRACTOR
                    AND THE SUBCONTRACTOR OR MATERIAL SUPPLIER.
                  </li>
                </ol>

                <Separator className="my-4" />

                <p className="font-semibold">PROPERTY OWNER ACKNOWLEDGMENT:</p>
                <p className="italic">
                  I have received a copy of this notice and have had the opportunity to read and understand it.
                </p>
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="flex-col sm:flex-row gap-4">
            <div className="flex items-center space-x-2 flex-1">
              <Checkbox
                id="acknowledge"
                checked={disclosureAcknowledged}
                onCheckedChange={(checked) => setDisclosureAcknowledged(checked === true)}
              />
              <label
                htmlFor="acknowledge"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                I acknowledge receipt of this notice
              </label>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowDisclosure(false)}>
                Close
              </Button>
              <Button onClick={handleDisclosureAcknowledge} disabled={!disclosureAcknowledged}>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Confirm Acknowledgment
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send for Signature Dialog */}
      {savedDocumentId && (
        <SendForSignatureDialog
          open={showSendDialog}
          onOpenChange={(open) => {
            setShowSendDialog(open);
            if (!open && onSave) {
              onSave(savedDocumentId);
            }
          }}
          documentId={savedDocumentId}
          documentName={contractName || 'Contract'}
          onSent={(requestId) => {
            if (onSave) onSave(savedDocumentId);
          }}
        />
      )}
    </div>
  );
}

export default ContractBuilder;

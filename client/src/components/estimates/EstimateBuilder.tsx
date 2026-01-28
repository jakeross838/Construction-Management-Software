import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ArrowLeft,
  Save,
  Send,
  FileText,
  Settings2,
  Layers,
  Plus,
  Calculator,
  Package,
  Wrench,
  Users,
  Truck,
  AlertCircle,
  MoreHorizontal,
  Copy,
  BookMarked,
} from 'lucide-react';
import { 
  Estimate, 
  EstimateSection,
  EstimateGroup,
  EstimateSubgroup,
  EstimateLineItem,
  EstimateAllowance,
  formatCurrencyEstimate,
  formatCurrencyCompact,
  estimateStatusConfig,
  generateId,
} from '@/types/estimate';
import { EnhancedSectionManager } from './EnhancedSectionManager';
import { AssemblyPicker } from './AssemblyPicker';
import { SaveAsTemplateDialog } from './SaveAsTemplateDialog';
import { toast } from 'sonner';

interface EstimateBuilderProps {
  estimate: Estimate;
  onUpdate: (data: Partial<Estimate>) => void;
  onSave: () => void;
  onSend: () => void;
  onBack: () => void;
}

export function EstimateBuilder({ 
  estimate, 
  onUpdate, 
  onSave, 
  onSend,
  onBack 
}: EstimateBuilderProps) {
  const [assemblyPickerOpen, setAssemblyPickerOpen] = useState(false);
  const [saveAsTemplateOpen, setSaveAsTemplateOpen] = useState(false);
  const [newAllowance, setNewAllowance] = useState({ category: '', description: '', amount: '' });
  const [newExclusion, setNewExclusion] = useState('');
  const [newClarification, setNewClarification] = useState('');

  const statusConfig = estimateStatusConfig[estimate.status];

  const handleUpdateSections = useCallback((sections: EstimateSection[]) => {
    onUpdate({ sections });
  }, [onUpdate]);

  const handleInsertAssembly = (lineItems: Omit<EstimateLineItem, 'id' | 'sortOrder' | 'totalCost' | 'totalWithMarkup'>[]) => {
    // If no sections exist, create a default structure
    if (estimate.sections.length === 0) {
      const newSubgroup: EstimateSubgroup = {
        id: generateId('sub'),
        name: 'General',
        lineItems: lineItems.map((item, index) => ({
          ...item,
          id: generateId('li'),
          sortOrder: index + 1,
          totalCost: item.quantity * item.unitCost,
          totalWithMarkup: 0,
        })),
        subtotal: 0,
        subtotalWithMarkup: 0,
        sortOrder: 1,
      };
      
      const newGroup: EstimateGroup = {
        id: generateId('grp'),
        name: 'General',
        subgroups: [newSubgroup],
        subtotal: 0,
        subtotalWithMarkup: 0,
        sortOrder: 1,
      };
      
      const newSection: EstimateSection = {
        id: generateId('sec'),
        name: 'General',
        groups: [newGroup],
        subtotal: 0,
        subtotalWithMarkup: 0,
        sortOrder: 1,
      };
      
      onUpdate({ sections: [newSection] });
    } else {
      // Add to first section's first group's first subgroup
      const sections = [...estimate.sections];
      const firstSection = sections[0];
      
      if (firstSection.groups.length === 0) {
        // Create a group and subgroup
        const newSubgroup: EstimateSubgroup = {
          id: generateId('sub'),
          name: 'General',
          lineItems: lineItems.map((item, index) => ({
            ...item,
            id: generateId('li'),
            sortOrder: index + 1,
            totalCost: item.quantity * item.unitCost,
            totalWithMarkup: 0,
          })),
          subtotal: 0,
          subtotalWithMarkup: 0,
          sortOrder: 1,
        };
        
        firstSection.groups = [{
          id: generateId('grp'),
          name: 'General',
          subgroups: [newSubgroup],
          subtotal: 0,
          subtotalWithMarkup: 0,
          sortOrder: 1,
        }];
      } else {
        const firstGroup = firstSection.groups[0];
        if (firstGroup.subgroups.length === 0) {
          firstGroup.subgroups = [{
            id: generateId('sub'),
            name: 'General',
            lineItems: lineItems.map((item, index) => ({
              ...item,
              id: generateId('li'),
              sortOrder: index + 1,
              totalCost: item.quantity * item.unitCost,
              totalWithMarkup: 0,
            })),
            subtotal: 0,
            subtotalWithMarkup: 0,
            sortOrder: 1,
          }];
        } else {
          const firstSubgroup = firstGroup.subgroups[0];
          const newItems = lineItems.map((item, index) => ({
            ...item,
            id: generateId('li'),
            sortOrder: firstSubgroup.lineItems.length + index + 1,
            totalCost: item.quantity * item.unitCost,
            totalWithMarkup: 0,
          }));
          firstSubgroup.lineItems = [...firstSubgroup.lineItems, ...newItems];
        }
      }
      
      onUpdate({ sections });
    }
    
    toast.success('Assembly inserted');
  };

  const handleAddAllowance = () => {
    if (!newAllowance.category || !newAllowance.description || !newAllowance.amount) return;
    
    const allowance: EstimateAllowance = {
      id: generateId('allow'),
      category: newAllowance.category,
      description: newAllowance.description,
      amount: parseFloat(newAllowance.amount) || 0,
    };
    
    onUpdate({ allowances: [...estimate.allowances, allowance] });
    setNewAllowance({ category: '', description: '', amount: '' });
  };

  const handleRemoveAllowance = (id: string) => {
    onUpdate({ allowances: estimate.allowances.filter(a => a.id !== id) });
  };

  const handleAddExclusion = () => {
    if (!newExclusion.trim()) return;
    onUpdate({ exclusions: [...estimate.exclusions, newExclusion.trim()] });
    setNewExclusion('');
  };

  const handleRemoveExclusion = (index: number) => {
    onUpdate({ exclusions: estimate.exclusions.filter((_, i) => i !== index) });
  };

  const handleAddClarification = () => {
    if (!newClarification.trim()) return;
    onUpdate({ clarifications: [...estimate.clarifications, newClarification.trim()] });
    setNewClarification('');
  };

  const handleRemoveClarification = (index: number) => {
    onUpdate({ clarifications: estimate.clarifications.filter((_, i) => i !== index) });
  };

  const handleUpdateMarkupSettings = (key: keyof typeof estimate.markupSettings, value: number) => {
    onUpdate({
      markupSettings: { ...estimate.markupSettings, [key]: value }
    });
  };

  // Count total items across all sections
  const totalLineItems = estimate.sections.reduce((sum, section) => 
    sum + section.groups.reduce((gSum, group) => 
      gSum + group.subgroups.reduce((sgSum, subgroup) => 
        sgSum + subgroup.lineItems.length, 0
      ), 0
    ), 0
  );

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-semibold">{estimate.number}</h1>
                <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {estimate.clientName} • {estimate.projectName}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onSave}>
              <Save className="mr-2 h-4 w-4" />
              Save
            </Button>
            {estimate.status === 'draft' && (
              <Button size="sm" onClick={onSend}>
                <Send className="mr-2 h-4 w-4" />
                Send to Client
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setSaveAsTemplateOpen(true)}>
                  <BookMarked className="mr-2 h-4 w-4" />
                  Save as Template
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Copy className="mr-2 h-4 w-4" />
                  Duplicate Estimate
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <FileText className="mr-2 h-4 w-4" />
                  Export PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full flex">
          {/* Left Panel - Builder */}
          <div className="flex-1 overflow-y-auto p-4">
            <Tabs defaultValue="items" className="h-full">
              <TabsList>
                <TabsTrigger value="items" className="gap-2">
                  <FileText className="h-4 w-4" />
                  Line Items
                </TabsTrigger>
                <TabsTrigger value="terms" className="gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Terms & Exclusions
                </TabsTrigger>
                <TabsTrigger value="settings" className="gap-2">
                  <Settings2 className="h-4 w-4" />
                  Settings
                </TabsTrigger>
              </TabsList>

              <TabsContent value="items" className="mt-4 space-y-4">
                {/* Quick Actions */}
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setAssemblyPickerOpen(true)}
                  >
                    <Layers className="mr-2 h-4 w-4" />
                    Insert Assembly
                  </Button>
                </div>

                {/* Hierarchical Sections with Drag & Drop */}
                <EnhancedSectionManager
                  sections={estimate.sections}
                  onUpdateSections={handleUpdateSections}
                />
              </TabsContent>

              <TabsContent value="terms" className="mt-4 space-y-6">
                {/* Allowances */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Allowances</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {estimate.allowances.length > 0 && (
                      <div className="space-y-2">
                        {estimate.allowances.map((allowance) => (
                          <div key={allowance.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                            <div>
                              <span className="font-medium">{allowance.category}: </span>
                              <span className="text-muted-foreground">{allowance.description}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">{formatCurrencyEstimate(allowance.amount)}</span>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => handleRemoveAllowance(allowance.id)}
                              >
                                ×
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="grid grid-cols-4 gap-2">
                      <Input 
                        placeholder="Category"
                        value={newAllowance.category}
                        onChange={(e) => setNewAllowance({ ...newAllowance, category: e.target.value })}
                      />
                      <Input 
                        placeholder="Description"
                        className="col-span-2"
                        value={newAllowance.description}
                        onChange={(e) => setNewAllowance({ ...newAllowance, description: e.target.value })}
                      />
                      <div className="flex gap-2">
                        <Input 
                          placeholder="Amount"
                          type="number"
                          value={newAllowance.amount}
                          onChange={(e) => setNewAllowance({ ...newAllowance, amount: e.target.value })}
                        />
                        <Button size="icon" onClick={handleAddAllowance}>
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Exclusions */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Exclusions</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {estimate.exclusions.length > 0 && (
                      <ul className="space-y-2">
                        {estimate.exclusions.map((exclusion, index) => (
                          <li key={index} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                            <span>• {exclusion}</span>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleRemoveExclusion(index)}
                            >
                              ×
                            </Button>
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="flex gap-2">
                      <Input 
                        placeholder="Add exclusion..."
                        value={newExclusion}
                        onChange={(e) => setNewExclusion(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddExclusion()}
                      />
                      <Button size="icon" onClick={handleAddExclusion}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Clarifications */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Clarifications</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {estimate.clarifications.length > 0 && (
                      <ul className="space-y-2">
                        {estimate.clarifications.map((clarification, index) => (
                          <li key={index} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                            <span>• {clarification}</span>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleRemoveClarification(index)}
                            >
                              ×
                            </Button>
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="flex gap-2">
                      <Input 
                        placeholder="Add clarification..."
                        value={newClarification}
                        onChange={(e) => setNewClarification(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddClarification()}
                      />
                      <Button size="icon" onClick={handleAddClarification}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Terms & Conditions */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Terms & Conditions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Textarea 
                      placeholder="Enter terms and conditions..."
                      value={estimate.termsAndConditions || ''}
                      onChange={(e) => onUpdate({ termsAndConditions: e.target.value })}
                      rows={6}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="settings" className="mt-4 space-y-6">
                {/* Markup Settings */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Cost Type Markups</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="space-y-2">
                        <Label>Material %</Label>
                        <Input
                          type="number"
                          value={estimate.markupSettings.materialMarkup}
                          onChange={(e) => handleUpdateMarkupSettings('materialMarkup', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Labor %</Label>
                        <Input
                          type="number"
                          value={estimate.markupSettings.laborMarkup}
                          onChange={(e) => handleUpdateMarkupSettings('laborMarkup', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Subcontractor %</Label>
                        <Input
                          type="number"
                          value={estimate.markupSettings.subcontractorMarkup}
                          onChange={(e) => handleUpdateMarkupSettings('subcontractorMarkup', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Equipment %</Label>
                        <Input
                          type="number"
                          value={estimate.markupSettings.equipmentMarkup}
                          onChange={(e) => handleUpdateMarkupSettings('equipmentMarkup', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Overhead, Profit & Contingency</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Overhead %</Label>
                        <Input
                          type="number"
                          value={estimate.markupSettings.overheadPercent}
                          onChange={(e) => handleUpdateMarkupSettings('overheadPercent', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Profit %</Label>
                        <Input
                          type="number"
                          value={estimate.markupSettings.profitPercent}
                          onChange={(e) => handleUpdateMarkupSettings('profitPercent', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Contingency %</Label>
                        <Input
                          type="number"
                          value={estimate.markupSettings.contingencyPercent}
                          onChange={(e) => handleUpdateMarkupSettings('contingencyPercent', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Right Panel - Summary */}
          <div className="w-80 border-l bg-muted/30 p-4 overflow-y-auto">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calculator className="h-4 w-4" />
                  Estimate Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Cost Breakdown */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-blue-500" />
                      <span>Materials</span>
                    </div>
                    <span>{formatCurrencyCompact(estimate.subtotalMaterial)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Wrench className="h-4 w-4 text-green-500" />
                      <span>Labor</span>
                    </div>
                    <span>{formatCurrencyCompact(estimate.subtotalLabor)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-purple-500" />
                      <span>Subcontractors</span>
                    </div>
                    <span>{formatCurrencyCompact(estimate.subtotalSubcontractor)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Truck className="h-4 w-4 text-amber-500" />
                      <span>Equipment</span>
                    </div>
                    <span>{formatCurrencyCompact(estimate.subtotalEquipment)}</span>
                  </div>
                </div>

                <Separator />

                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Direct Costs</span>
                  <span>{formatCurrencyEstimate(estimate.subtotalDirect)}</span>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Overhead ({estimate.markupSettings.overheadPercent}%)</span>
                    <span>{formatCurrencyCompact(estimate.overheadAmount)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Profit ({estimate.markupSettings.profitPercent}%)</span>
                    <span>{formatCurrencyCompact(estimate.profitAmount)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Contingency ({estimate.markupSettings.contingencyPercent}%)</span>
                    <span>{formatCurrencyCompact(estimate.contingencyAmount)}</span>
                  </div>
                </div>

                <Separator />

                <div className="flex justify-between items-center">
                  <span className="font-semibold">Total</span>
                  <span className="text-xl font-bold text-primary">
                    {formatCurrencyEstimate(estimate.totalAmount)}
                  </span>
                </div>

                {estimate.projectSquareFeet && estimate.projectSquareFeet > 0 && (
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Cost per SF</span>
                    <span>{formatCurrencyEstimate(estimate.totalAmount / estimate.projectSquareFeet)}/SF</span>
                  </div>
                )}

                {/* Quick Stats */}
                <Separator />
                
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="p-2 bg-muted rounded-lg">
                    <p className="text-lg font-semibold">{estimate.sections.length}</p>
                    <p className="text-xs text-muted-foreground">Sections</p>
                  </div>
                  <div className="p-2 bg-muted rounded-lg">
                    <p className="text-lg font-semibold">{totalLineItems}</p>
                    <p className="text-xs text-muted-foreground">Line Items</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Assembly Picker Dialog */}
      <AssemblyPicker
        open={assemblyPickerOpen}
        onOpenChange={setAssemblyPickerOpen}
        onInsert={handleInsertAssembly}
      />

      {/* Save as Template Dialog */}
      <SaveAsTemplateDialog
        estimate={estimate}
        open={saveAsTemplateOpen}
        onOpenChange={setSaveAsTemplateOpen}
      />
    </div>
  );
}

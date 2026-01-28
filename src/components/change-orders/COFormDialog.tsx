import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useDBJobs, usePurchaseOrders, useCostCodes } from '@/hooks/useFinancialData';
import { useCreateChangeOrder } from '@/hooks/useChangeOrders';
import { formatCurrency } from '@/types/financial';
import type { COType, RequestedBy } from '@/types/financial';
import { cn } from '@/lib/utils';
import { useJob } from '@/contexts/JobContext';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';

interface COFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedJobId?: string | null;
}

interface LineItem {
  id: string;
  cost_code_id: string;
  description: string;
  amount: number;
}

export function COFormDialog({ open, onOpenChange, selectedJobId }: COFormDialogProps) {
  const { data: jobs = [] } = useDBJobs();
  const { data: costCodes = [] } = useCostCodes();
  const createCO = useCreateChangeOrder();
  const { selectedJobId: contextJobId } = useJob();
  
  // Prefer prop, then context
  const effectiveJobId = selectedJobId || contextJobId || '';
  
  const [jobId, setJobId] = useState<string>(effectiveJobId);
  const [poId, setPoId] = useState<string>('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<COType>('addition');
  const [requestedBy, setRequestedBy] = useState<RequestedBy>('client');
  const [markupPercent, setMarkupPercent] = useState(10);
  const [daysImpact, setDaysImpact] = useState(0);
  const [pmHours, setPmHours] = useState(0);
  const [pmHourlyRate, setPmHourlyRate] = useState(75); // Default PM rate
  const [clientSignatureRequired, setClientSignatureRequired] = useState(true);
  const [notes, setNotes] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: crypto.randomUUID(), cost_code_id: '', description: '', amount: 0 }
  ]);
  const [includeSupervision, setIncludeSupervision] = useState(true);
  
  const { data: purchaseOrders = [] } = usePurchaseOrders(jobId || undefined);
  
  // Get the selected job for supervision rate calculation
  const selectedJob = useMemo(() => jobs.find(j => j.id === jobId), [jobs, jobId]);
  
  // Find supervision cost code
  const supervisionCostCode = useMemo(() => 
    costCodes.find(cc => cc.name?.toLowerCase().includes('supervision') && cc.code?.endsWith('C')),
    [costCodes]
  );
  
  // Auto-calculate supervision cost based on days impact
  // Formula: (days / 30) * monthly_supervision_rate
  const supervisionCost = useMemo(() => {
    if (!includeSupervision || daysImpact <= 0) return 0;
    const monthlyRate = selectedJob?.monthly_supervision_rate ?? 6000; // Default $6k/month
    return (daysImpact / 30) * monthlyRate;
  }, [daysImpact, selectedJob?.monthly_supervision_rate, includeSupervision]);
  
  // Hide job selector when we have an effective job
  const showJobSelector = !effectiveJobId;
  
  useEffect(() => {
    if (effectiveJobId) {
      setJobId(effectiveJobId);
    }
  }, [effectiveJobId]);
  
  useEffect(() => {
    if (!open) {
      // Reset form
      setJobId(effectiveJobId);
      setPoId('');
      setDescription('');
      setType('addition');
      setRequestedBy('client');
      setMarkupPercent(10);
      setDaysImpact(0);
      setPmHours(0);
      setPmHourlyRate(75);
      setClientSignatureRequired(true);
      setNotes('');
      setLineItems([{ id: crypto.randomUUID(), cost_code_id: '', description: '', amount: 0 }]);
      setIncludeSupervision(true);
    }
  }, [open, effectiveJobId]);
  
  const pmCost = pmHours * pmHourlyRate;
  const lineItemsTotal = lineItems.reduce((sum, li) => sum + (li.amount || 0), 0);
  const subtotal = lineItemsTotal + pmCost + supervisionCost;
  const markupAmount = subtotal * (markupPercent / 100);
  const totalAmount = subtotal + markupAmount;
  
  const addLineItem = () => {
    setLineItems([...lineItems, { id: crypto.randomUUID(), cost_code_id: '', description: '', amount: 0 }]);
  };
  
  const removeLineItem = (id: string) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter(li => li.id !== id));
    }
  };
  
  const updateLineItem = (id: string, field: 'cost_code_id' | 'description' | 'amount', value: string | number) => {
    setLineItems(lineItems.map(li => 
      li.id === id ? { ...li, [field]: value } : li
    ));
  };
  
  // Validation: all line items with descriptions must have cost codes
  const validLineItems = lineItems.filter(li => li.description.trim());
  const allHaveCostCodes = validLineItems.length > 0 && validLineItems.every(li => li.cost_code_id);
  
  const handleSubmit = async () => {
    if (!jobId || !description.trim() || validLineItems.length === 0) {
      return;
    }
    
    if (!allHaveCostCodes) {
      return; // Button should be disabled anyway
    }
    
    // Build final line items including supervision if applicable
    const finalLineItems = validLineItems.map((li, idx) => ({
      id: '',
      change_order_id: '',
      cost_code_id: li.cost_code_id,
      description: li.description,
      amount: li.amount,
      sort_order: idx,
    }));
    
    // Add supervision line item if days are added and supervision is included
    if (includeSupervision && daysImpact > 0 && supervisionCost > 0 && supervisionCostCode) {
      const monthlyRate = selectedJob?.monthly_supervision_rate ?? 6000;
      const daysLabel = daysImpact === 1 ? '1 day' : `${daysImpact} days`;
      finalLineItems.push({
        id: '',
        change_order_id: '',
        cost_code_id: supervisionCostCode.id,
        description: `Extended supervision for ${daysLabel} (${formatCurrency(monthlyRate)}/month)`,
        amount: supervisionCost,
        sort_order: finalLineItems.length,
      });
    }
    
    await createCO.mutateAsync({
      job_id: jobId,
      po_id: poId && poId !== 'none' ? poId : null,
      description,
      type,
      requested_by: requestedBy,
      subtotal,
      markup_percent: markupPercent,
      markup_amount: markupAmount,
      total_amount: totalAmount,
      days_impact: daysImpact,
      pm_hours: pmHours,
      pm_hourly_rate: pmHourlyRate,
      pm_cost: pmCost,
      client_signature_required: clientSignatureRequired,
      notes: notes || null,
      status: 'draft',
      line_items: finalLineItems,
    });
    
    onOpenChange(false);
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Budgetary Change Order</DialogTitle>
          <p className="text-sm text-muted-foreground">
            This is a budgetary estimate. Actual costs will be reconciled as invoices are received against this change order.
          </p>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            {showJobSelector && (
              <div className="space-y-2">
                <Label>Job *</Label>
                <Select value={jobId} onValueChange={setJobId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select job..." />
                  </SelectTrigger>
                  <SelectContent>
                    {jobs.map(job => (
                      <SelectItem key={job.id} value={job.id}>{job.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            <div className="space-y-2">
              <Label>Link to PO (optional)</Label>
              <Select value={poId} onValueChange={setPoId} disabled={!jobId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select PO..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {purchaseOrders.map(po => (
                    <SelectItem key={po.id} value={po.id}>
                      {po.po_number} - {po.vendor_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label>Description *</Label>
            <Input 
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the change order"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as COType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="addition">Addition</SelectItem>
                  <SelectItem value="deduction">Deduction</SelectItem>
                  <SelectItem value="scope_change">Scope Change</SelectItem>
                  <SelectItem value="unforeseen_condition">Unforeseen Condition</SelectItem>
                  <SelectItem value="additional_scope">Additional Scope</SelectItem>
                  <SelectItem value="upgrade">Upgrade</SelectItem>
                  <SelectItem value="allowance_adjustment">Allowance Adjustment</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Requested By</Label>
              <Select value={requestedBy} onValueChange={(v) => setRequestedBy(v as RequestedBy)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="client">Client</SelectItem>
                  <SelectItem value="builder">Builder</SelectItem>
                  <SelectItem value="architect">Architect</SelectItem>
                  <SelectItem value="designer">Designer</SelectItem>
                  <SelectItem value="engineer">Engineer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {/* Schedule & PM Time Impact */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label>Schedule Impact (Days)</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>Days added will extend the project end date and automatically calculate supervision costs based on the job's monthly supervision rate.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Input 
                type="number"
                value={daysImpact}
                onChange={(e) => setDaysImpact(parseInt(e.target.value) || 0)}
                placeholder="+ adds, - reduces"
              />
              <p className="text-xs text-muted-foreground">
                {daysImpact > 0 ? `+${daysImpact} working days` : daysImpact < 0 ? `${daysImpact} working days` : 'No schedule change'}
              </p>
            </div>
            
            <div className="space-y-2">
              <Label>PM Hours</Label>
              <Input 
                type="number"
                value={pmHours || ''}
                onChange={(e) => setPmHours(parseFloat(e.target.value) || 0)}
                placeholder="0"
              />
            </div>
            
            <div className="space-y-2">
              <Label>PM Hourly Rate ($)</Label>
              <Input 
                type="number"
                value={pmHourlyRate}
                onChange={(e) => setPmHourlyRate(parseFloat(e.target.value) || 0)}
              />
              <p className="text-xs text-muted-foreground">
                PM Cost: {formatCurrency(pmCost)}
              </p>
            </div>
          </div>
          
          {/* Supervision Cost Auto-Calculation */}
          {daysImpact > 0 && (
            <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="includeSupervision"
                    checked={includeSupervision}
                    onChange={(e) => setIncludeSupervision(e.target.checked)}
                    className="h-4 w-4"
                  />
                  <Label htmlFor="includeSupervision" className="text-sm font-medium text-blue-800">
                    Include Extended Supervision Cost
                  </Label>
                </div>
                {includeSupervision && (
                  <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
                    +{formatCurrency(supervisionCost)}
                  </Badge>
                )}
              </div>
              {includeSupervision && (
                <div className="text-xs text-blue-700 space-y-1">
                  <p>
                    <strong>{daysImpact} days</strong> ÷ 30 days × {formatCurrency(selectedJob?.monthly_supervision_rate ?? 6000)}/month = <strong>{formatCurrency(supervisionCost)}</strong>
                  </p>
                  <p className="text-blue-600">
                    A line item will be automatically added for supervision using cost code: {supervisionCostCode?.code ?? 'Supervision - Change'}
                  </p>
                </div>
              )}
            </div>
          )}
          
          <div className="space-y-2">
            <Label>Markup %</Label>
            <Input 
              type="number"
              value={markupPercent}
              onChange={(e) => setMarkupPercent(parseFloat(e.target.value) || 0)}
              className="w-32"
            />
          </div>
          
          {/* Line Items */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label>Line Items</Label>
                <Badge variant="outline" className="text-xs border-amber-500 text-amber-600">
                  Cost Codes Required
                </Badge>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
                <Plus className="h-4 w-4 mr-1" />
                Add Item
              </Button>
            </div>
            
            <div className="border rounded-lg divide-y">
              {lineItems.map((item, idx) => (
                <div key={item.id} className="p-3 space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground w-6">{idx + 1}.</span>
                    <div className="flex-1">
                      <Select 
                        value={item.cost_code_id || ''} 
                        onValueChange={(v) => updateLineItem(item.id, 'cost_code_id', v)}
                      >
                        <SelectTrigger className={cn("h-8 text-sm", !item.cost_code_id && item.description.trim() && "border-amber-500")}>
                          <SelectValue placeholder="Select cost code *" />
                        </SelectTrigger>
                        <SelectContent>
                          {costCodes.map(cc => (
                            <SelectItem key={cc.id} value={cc.id}>
                              {cc.code} - {cc.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="w-28">
                      <Input 
                        type="number"
                        placeholder="Amount"
                        value={item.amount || ''}
                        onChange={(e) => updateLineItem(item.id, 'amount', parseFloat(e.target.value) || 0)}
                        className="h-8"
                      />
                    </div>
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="icon"
                      onClick={() => removeLineItem(item.id)}
                      disabled={lineItems.length === 1}
                      className="h-8 w-8"
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                  <div className="pl-9">
                    <Input 
                      placeholder="Description of work"
                      value={item.description}
                      onChange={(e) => updateLineItem(item.id, 'description', e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Totals */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground uppercase">Budgetary Estimate</span>
              <Badge variant="outline" className="text-xs">Not-To-Exceed</Badge>
            </div>
            <div className="flex justify-between text-sm">
              <span>Line Items</span>
              <span>{formatCurrency(lineItemsTotal)}</span>
            </div>
            {pmCost > 0 && (
              <div className="flex justify-between text-sm">
                <span>PM Time ({pmHours} hrs × {formatCurrency(pmHourlyRate)}/hr)</span>
                <span>{formatCurrency(pmCost)}</span>
              </div>
            )}
            {supervisionCost > 0 && includeSupervision && (
              <div className="flex justify-between text-sm text-blue-700">
                <span>Extended Supervision ({daysImpact} days)</span>
                <span>{formatCurrency(supervisionCost)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm border-t pt-1">
              <span>Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Markup ({markupPercent}%)</span>
              <span>{formatCurrency(markupAmount)}</span>
            </div>
            <div className="flex justify-between font-semibold text-lg border-t pt-2">
              <span>Estimated Total</span>
              <span className={totalAmount >= 0 ? 'text-green-600' : 'text-red-600'}>
                {totalAmount >= 0 ? '+' : ''}{formatCurrency(totalAmount)}
              </span>
            </div>
            {daysImpact !== 0 && (
              <div className="flex justify-between text-sm pt-1 border-t">
                <span>Schedule Impact</span>
                <span className={daysImpact > 0 ? 'text-amber-600' : 'text-green-600'}>
                  {daysImpact > 0 ? '+' : ''}{daysImpact} working days
                </span>
              </div>
            )}
          </div>
          
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea 
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes or context..."
              rows={3}
            />
          </div>
          
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="clientSignature"
              checked={clientSignatureRequired}
              onChange={(e) => setClientSignatureRequired(e.target.checked)}
              className="h-4 w-4"
            />
            <Label htmlFor="clientSignature" className="text-sm font-normal">
              Client signature required
            </Label>
          </div>
          
          {/* Terms & Conditions Notice */}
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm">
            <p className="font-medium text-amber-800 mb-2">Budgetary Change Order Terms</p>
            <ul className="text-amber-700 space-y-1 text-xs list-disc list-inside">
              <li>This is a budgetary estimate based on anticipated costs.</li>
              <li>Actual costs will be invoiced against this change order as work progresses.</li>
              <li>Final amounts may be less than the estimated total but will not exceed without additional approval.</li>
              <li>Client signature constitutes acceptance of all terms, conditions, and schedule impacts.</li>
            </ul>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={createCO.isPending || !jobId || !description.trim() || !allHaveCostCodes}
            title={!allHaveCostCodes ? 'All line items must have cost codes assigned' : ''}
          >
            {createCO.isPending ? 'Creating...' : 'Create Change Order'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

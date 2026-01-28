import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { FilePlus, FileEdit, Loader2, ArrowRight } from "lucide-react";
import { ChangeOrder, formatCurrency } from "@/types/financial";
import { Badge } from "@/components/ui/badge";

interface COToPODialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  co: ChangeOrder & { 
    job_client?: string; 
    vendor_name?: string; 
  };
}

interface Vendor {
  id: string;
  name: string;
  email?: string;
}

interface ExistingPO {
  id: string;
  po_number: string;
  vendor_name: string;
  current_amount: number;
  description: string;
}

export function COToPODialog({ open, onOpenChange, co }: COToPODialogProps) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<'new' | 'amend'>('new');
  const [isProcessing, setIsProcessing] = useState(false);
  
  // For new PO
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [selectedVendorId, setSelectedVendorId] = useState<string>('');
  const [poDescription, setPODescription] = useState(co.description);
  const [scopeOfWork, setScopeOfWork] = useState('');
  
  // For amend existing PO
  const [existingPOs, setExistingPOs] = useState<ExistingPO[]>([]);
  const [selectedPOId, setSelectedPOId] = useState<string>('');
  
  // Load vendors and existing POs for the job
  useEffect(() => {
    if (open) {
      loadVendors();
      loadExistingPOs();
      setPODescription(co.description);
    }
  }, [open, co.job_id]);
  
  const loadVendors = async () => {
    const { data } = await supabase
      .from('vendors')
      .select('id, name, email')
      .eq('status', 'active')
      .order('name');
    setVendors(data || []);
  };
  
  const loadExistingPOs = async () => {
    const { data } = await supabase
      .from('purchase_orders')
      .select(`
        id, 
        po_number, 
        current_amount, 
        description,
        vendors (name)
      `)
      .eq('job_id', co.job_id)
      .eq('status', 'open')
      .order('created_at', { ascending: false });
    
    setExistingPOs(
      (data || []).map((po: any) => ({
        id: po.id,
        po_number: po.po_number,
        vendor_name: po.vendors?.name || 'Unknown',
        current_amount: po.current_amount || 0,
        description: po.description || '',
      }))
    );
  };
  
  const handleCreateNewPO = async () => {
    if (!selectedVendorId) {
      toast.error("Please select a vendor");
      return;
    }
    
    setIsProcessing(true);
    
    try {
      // Get next PO number for this job
      const { data: existingPOs } = await supabase
        .from('purchase_orders')
        .select('po_number')
        .eq('job_id', co.job_id)
        .order('po_number', { ascending: false })
        .limit(1);
      
      let nextNumber = 'PO-001';
      if (existingPOs && existingPOs.length > 0) {
        const lastNum = existingPOs[0].po_number.replace(/^PO-0*/, '');
        const num = parseInt(lastNum) + 1;
        nextNumber = `PO-${num.toString().padStart(3, '0')}`;
      }
      
      // Create the new PO
      const { data: newPO, error: poError } = await supabase
        .from('purchase_orders')
        .insert({
          po_number: nextNumber,
          job_id: co.job_id,
          vendor_id: selectedVendorId,
          description: poDescription,
          scope_of_work: scopeOfWork,
          original_amount: co.total_amount,
          current_amount: co.total_amount,
          remaining_amount: co.total_amount,
          change_order_amount: co.total_amount,
          status: 'open',
          approval_status: 'pending',
        })
        .select()
        .single();
      
      if (poError) throw poError;
      
      // Create line items from CO line items
      if (co.line_items && co.line_items.length > 0) {
        const poLineItems = co.line_items.map((item, idx) => ({
          po_id: newPO.id,
          cost_code_id: item.cost_code_id,
          title: item.description,
          description: item.description,
          amount: item.amount,
          unit_cost: item.amount,
          quantity: 1,
          sort_order: idx,
        }));
        
        await supabase.from('po_line_items').insert(poLineItems);
      }
      
      // Link CO to the new PO
      await supabase
        .from('change_orders')
        .update({ po_id: newPO.id })
        .eq('id', co.id);
      
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['change-orders'] });
      queryClient.invalidateQueries({ queryKey: ['change-order', co.id] });
      
      toast.success(`Created ${nextNumber} from ${co.co_number}`);
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error creating PO:', error);
      toast.error(error.message || 'Failed to create PO');
    } finally {
      setIsProcessing(false);
    }
  };
  
  const handleAmendExistingPO = async () => {
    if (!selectedPOId) {
      toast.error("Please select a PO to amend");
      return;
    }
    
    setIsProcessing(true);
    
    try {
      // Get current PO data
      const { data: currentPO, error: fetchError } = await supabase
        .from('purchase_orders')
        .select('*')
        .eq('id', selectedPOId)
        .single();
      
      if (fetchError) throw fetchError;
      
      // Update PO with new amounts
      const newChangeOrderAmount = (currentPO.change_order_amount || 0) + co.total_amount;
      const newCurrentAmount = (currentPO.original_amount || 0) + newChangeOrderAmount;
      const newRemainingAmount = newCurrentAmount - (currentPO.invoiced_amount || 0);
      
      const { error: updateError } = await supabase
        .from('purchase_orders')
        .update({
          change_order_amount: newChangeOrderAmount,
          current_amount: newCurrentAmount,
          remaining_amount: newRemainingAmount,
        })
        .eq('id', selectedPOId);
      
      if (updateError) throw updateError;
      
      // Add CO line items to PO
      if (co.line_items && co.line_items.length > 0) {
        // Get current max sort order
        const { data: existingItems } = await supabase
          .from('po_line_items')
          .select('sort_order')
          .eq('po_id', selectedPOId)
          .order('sort_order', { ascending: false })
          .limit(1);
        
        const startOrder = existingItems?.[0]?.sort_order ?? -1;
        
        const poLineItems = co.line_items.map((item, idx) => ({
          po_id: selectedPOId,
          cost_code_id: item.cost_code_id,
          title: `[${co.co_number}] ${item.description}`,
          description: item.description,
          amount: item.amount,
          unit_cost: item.amount,
          quantity: 1,
          sort_order: startOrder + idx + 1,
        }));
        
        await supabase.from('po_line_items').insert(poLineItems);
      }
      
      // Link CO to the PO
      await supabase
        .from('change_orders')
        .update({ po_id: selectedPOId })
        .eq('id', co.id);
      
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-order', selectedPOId] });
      queryClient.invalidateQueries({ queryKey: ['change-orders'] });
      queryClient.invalidateQueries({ queryKey: ['change-order', co.id] });
      
      const amendedPO = existingPOs.find(p => p.id === selectedPOId);
      toast.success(`Added ${co.co_number} to ${amendedPO?.po_number || 'PO'}`);
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error amending PO:', error);
      toast.error(error.message || 'Failed to amend PO');
    } finally {
      setIsProcessing(false);
    }
  };
  
  const handleSubmit = () => {
    if (mode === 'new') {
      handleCreateNewPO();
    } else {
      handleAmendExistingPO();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRight className="h-5 w-5" />
            Create or Amend Purchase Order
          </DialogTitle>
          <DialogDescription>
            Authorize {co.co_number} ({formatCurrency(co.total_amount)}) by creating a new PO or amending an existing one.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Mode Selection */}
          <RadioGroup value={mode} onValueChange={(v) => setMode(v as 'new' | 'amend')}>
            <div className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
              <RadioGroupItem value="new" id="mode-new" className="mt-0.5" />
              <div className="flex-1">
                <Label htmlFor="mode-new" className="flex items-center gap-2 cursor-pointer">
                  <FilePlus className="h-4 w-4 text-green-600" />
                  Create New Purchase Order
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Create a new PO for a subcontractor to perform the CO work
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
              <RadioGroupItem value="amend" id="mode-amend" className="mt-0.5" />
              <div className="flex-1">
                <Label htmlFor="mode-amend" className="flex items-center gap-2 cursor-pointer">
                  <FileEdit className="h-4 w-4 text-blue-600" />
                  Amend Existing Purchase Order
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Add the CO amount to an existing PO for the same subcontractor
                </p>
              </div>
            </div>
          </RadioGroup>

          {/* New PO Form */}
          {mode === 'new' && (
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Select Vendor/Subcontractor</Label>
                <Select value={selectedVendorId} onValueChange={setSelectedVendorId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a vendor..." />
                  </SelectTrigger>
                  <SelectContent>
                    {vendors.map(vendor => (
                      <SelectItem key={vendor.id} value={vendor.id}>
                        {vendor.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>PO Title/Description</Label>
                <Input
                  value={poDescription}
                  onChange={(e) => setPODescription(e.target.value)}
                  placeholder="e.g., Additional framing work per CO-001"
                />
              </div>
              
              <div className="space-y-2">
                <Label>Scope of Work (Optional)</Label>
                <Textarea
                  value={scopeOfWork}
                  onChange={(e) => setScopeOfWork(e.target.value)}
                  placeholder="Detailed scope of work for the subcontractor..."
                  rows={3}
                />
              </div>
              
              <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm">
                <p className="font-medium text-green-800">New PO will be created with:</p>
                <ul className="text-green-700 mt-1 space-y-1">
                  <li>• Amount: {formatCurrency(co.total_amount)}</li>
                  <li>• {co.line_items?.length || 0} line items from CO</li>
                  <li>• Linked to {co.co_number}</li>
                </ul>
              </div>
            </div>
          )}

          {/* Amend Existing PO Form */}
          {mode === 'amend' && (
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Select Purchase Order to Amend</Label>
                <Select value={selectedPOId} onValueChange={setSelectedPOId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a PO..." />
                  </SelectTrigger>
                  <SelectContent>
                    {existingPOs.length === 0 ? (
                      <div className="p-2 text-sm text-muted-foreground">
                        No open POs found for this job
                      </div>
                    ) : (
                      existingPOs.map(po => (
                        <SelectItem key={po.id} value={po.id}>
                          <div className="flex items-center gap-2">
                            <span className="font-mono">{po.po_number}</span>
                            <span className="text-muted-foreground">-</span>
                            <span>{po.vendor_name}</span>
                            <Badge variant="secondary" className="ml-2">
                              {formatCurrency(po.current_amount)}
                            </Badge>
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              
              {selectedPOId && (
                <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-sm">
                  <p className="font-medium text-blue-800">PO will be amended:</p>
                  {(() => {
                    const selectedPO = existingPOs.find(p => p.id === selectedPOId);
                    if (!selectedPO) return null;
                    const newTotal = selectedPO.current_amount + co.total_amount;
                    return (
                      <ul className="text-blue-700 mt-1 space-y-1">
                        <li>• Current Amount: {formatCurrency(selectedPO.current_amount)}</li>
                        <li>• CO Addition: +{formatCurrency(co.total_amount)}</li>
                        <li>• <strong>New Total: {formatCurrency(newTotal)}</strong></li>
                        <li>• {co.line_items?.length || 0} line items will be added</li>
                      </ul>
                    );
                  })()}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessing}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isProcessing}>
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : mode === 'new' ? (
              <>
                <FilePlus className="mr-2 h-4 w-4" />
                Create PO
              </>
            ) : (
              <>
                <FileEdit className="mr-2 h-4 w-4" />
                Amend PO
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

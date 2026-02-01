import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Combobox } from '@/components/ui/combobox';
import { useVendors } from '@/hooks/useVendors';
import { usePurchaseOrders } from '@/hooks/usePurchaseOrders';
import { useCostCodes } from '@/hooks/useFinancialData';
import { useCreateInvoice } from '@/hooks/useFinancialData';
import { formatCurrency } from '@/data/mockData';
import { Plus, Trash2, Loader2, FileText } from 'lucide-react';
import { toast } from 'sonner';

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  cost_code_id: string;
}

interface InvoiceManualFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  onSuccess?: () => void;
}

const generateId = () => Math.random().toString(36).substr(2, 9);

export function InvoiceManualFormDialog({
  open,
  onOpenChange,
  jobId,
  onSuccess,
}: InvoiceManualFormDialogProps) {
  // Form state
  const [vendorId, setVendorId] = useState('');
  const [poId, setPoId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: generateId(), description: '', quantity: 1, unit_price: 0, amount: 0, cost_code_id: '' }
  ]);

  // Queries
  const { data: vendors = [] } = useVendors();
  const { data: purchaseOrders = [] } = usePurchaseOrders(jobId);
  const { data: costCodes = [] } = useCostCodes();
  const createInvoice = useCreateInvoice();

  // Filter POs for selected vendor or show all if no vendor selected
  const filteredPOs = useMemo(() => {
    if (!vendorId) return purchaseOrders;
    return purchaseOrders.filter(po => po.vendor_id === vendorId);
  }, [purchaseOrders, vendorId]);

  // Calculate total from line items
  const totalAmount = useMemo(() => {
    return lineItems.reduce((sum, item) => sum + (item.amount || 0), 0);
  }, [lineItems]);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setVendorId('');
      setPoId('');
      setInvoiceNumber('');
      setInvoiceDate(new Date().toISOString().split('T')[0]);
      setDueDate('');
      setDescription('');
      setNotes('');
      setLineItems([
        { id: generateId(), description: '', quantity: 1, unit_price: 0, amount: 0, cost_code_id: '' }
      ]);
    }
  }, [open]);

  // When PO is selected, auto-fill vendor and optionally load line items
  useEffect(() => {
    if (poId) {
      const selectedPO = purchaseOrders.find(po => po.id === poId);
      if (selectedPO) {
        if (selectedPO.vendor_id) {
          setVendorId(selectedPO.vendor_id);
        }
        // Could populate line items from PO line items here
      }
    }
  }, [poId, purchaseOrders]);

  const handleLineItemChange = (id: string, field: keyof LineItem, value: string | number) => {
    setLineItems(prev => prev.map(item => {
      if (item.id !== id) return item;

      const updated = { ...item, [field]: value };

      // Auto-calculate amount when quantity or unit_price changes
      if (field === 'quantity' || field === 'unit_price') {
        const qty = field === 'quantity' ? Number(value) : item.quantity;
        const price = field === 'unit_price' ? Number(value) : item.unit_price;
        updated.amount = qty * price;
      }

      return updated;
    }));
  };

  const addLineItem = () => {
    setLineItems(prev => [
      ...prev,
      { id: generateId(), description: '', quantity: 1, unit_price: 0, amount: 0, cost_code_id: '' }
    ]);
  };

  const removeLineItem = (id: string) => {
    if (lineItems.length <= 1) return;
    setLineItems(prev => prev.filter(item => item.id !== id));
  };

  const loadFromPO = () => {
    if (!poId) return;
    const selectedPO = purchaseOrders.find(po => po.id === poId);
    if (!selectedPO?.line_items?.length) {
      toast.info('No line items found on this PO');
      return;
    }

    const poLineItems: LineItem[] = selectedPO.line_items.map((li: any) => ({
      id: generateId(),
      description: li.description || '',
      quantity: 1,
      unit_price: parseFloat(li.amount || 0),
      amount: parseFloat(li.amount || 0),
      cost_code_id: li.cost_code_id || '',
    }));

    setLineItems(poLineItems.length > 0 ? poLineItems : lineItems);
    toast.success(`Loaded ${poLineItems.length} line items from PO`);
  };

  const handleSubmit = async () => {
    // Validation
    if (!vendorId) {
      toast.error('Please select a vendor');
      return;
    }
    if (!invoiceNumber.trim()) {
      toast.error('Please enter an invoice number');
      return;
    }
    if (totalAmount <= 0) {
      toast.error('Invoice amount must be greater than 0');
      return;
    }

    try {
      await createInvoice.mutateAsync({
        job_id: jobId,
        vendor_id: vendorId,
        po_id: poId || undefined,
        invoice_number: invoiceNumber.trim(),
        invoice_date: invoiceDate || new Date().toISOString().split('T')[0],
        due_date: dueDate || undefined,
        amount: totalAmount,
        description: description || undefined,
        notes: notes || undefined,
        // Line items will be handled as allocations after creation
      });

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error('Failed to create invoice:', error);
    }
  };

  // Group cost codes by category
  const costCodesByCategory = useMemo(() => {
    return costCodes.reduce((acc, cc) => {
      const cat = cc.category || 'Other';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(cc);
      return acc;
    }, {} as Record<string, typeof costCodes>);
  }, [costCodes]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Create Invoice Manually
          </DialogTitle>
          <DialogDescription>
            Enter invoice details without uploading a PDF. You can attach a PDF later if needed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Vendor & PO Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Vendor *</Label>
              <Combobox
                options={vendors.map(v => ({ value: v.id, label: v.name }))}
                value={vendorId}
                onValueChange={setVendorId}
                placeholder="Select vendor..."
                searchPlaceholder="Search vendors..."
              />
            </div>
            <div className="space-y-2">
              <Label>Purchase Order</Label>
              <Select value={poId} onValueChange={setPoId}>
                <SelectTrigger>
                  <SelectValue placeholder="Optional - Link to PO" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No PO</SelectItem>
                  {filteredPOs.map(po => (
                    <SelectItem key={po.id} value={po.id}>
                      {po.po_number} - {formatCurrency(po.total_amount || 0)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Invoice Details */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Invoice # *</Label>
              <Input
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="INV-001"
              />
            </div>
            <div className="space-y-2">
              <Label>Invoice Date</Label>
              <Input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Due Date</Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label>Description</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of invoice..."
            />
          </div>

          {/* Line Items */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Line Items</Label>
              <div className="flex gap-2">
                {poId && (
                  <Button type="button" variant="outline" size="sm" onClick={loadFromPO}>
                    Load from PO
                  </Button>
                )}
                <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Line
                </Button>
              </div>
            </div>

            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Description</TableHead>
                    <TableHead className="w-[80px]">Qty</TableHead>
                    <TableHead className="w-[100px]">Unit Price</TableHead>
                    <TableHead className="w-[100px]">Amount</TableHead>
                    <TableHead className="w-[180px]">Cost Code</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lineItems.map((item, index) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Input
                          value={item.description}
                          onChange={(e) => handleLineItemChange(item.id, 'description', e.target.value)}
                          placeholder="Item description"
                          className="h-8"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => handleLineItemChange(item.id, 'quantity', e.target.value)}
                          className="h-8"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.unit_price}
                          onChange={(e) => handleLineItemChange(item.id, 'unit_price', e.target.value)}
                          className="h-8"
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(item.amount)}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={item.cost_code_id}
                          onValueChange={(v) => handleLineItemChange(item.id, 'cost_code_id', v)}
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue placeholder="Select..." />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(costCodesByCategory).map(([category, codes]) => (
                              <div key={category}>
                                <div className="px-2 py-1 text-xs font-semibold text-muted-foreground bg-muted/50">
                                  {category}
                                </div>
                                {codes.map(cc => (
                                  <SelectItem key={cc.id} value={cc.id}>
                                    <span className="font-mono text-xs mr-1">{cc.code}</span>
                                    {cc.name}
                                  </SelectItem>
                                ))}
                              </div>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => removeLineItem(item.id)}
                          disabled={lineItems.length <= 1}
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-end">
              <div className="text-right">
                <span className="text-sm text-muted-foreground mr-4">Total:</span>
                <span className="text-lg font-semibold">{formatCurrency(totalAmount)}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={createInvoice.isPending}>
            {createInvoice.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Create Invoice
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

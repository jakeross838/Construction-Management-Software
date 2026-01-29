/**
 * Record Vendor Payment Dialog
 * Allows recording payments made to vendors for invoices
 */
import { useState } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  CreditCard,
  Building2,
  Banknote,
  Wallet,
  DollarSign,
  Calendar,
  FileText,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { useRecordPayment, usePaymentHistory } from '@/hooks/useVendorPayments';
import { Invoice, PaymentMethod } from '@/types/financial';
import { formatCurrency } from '@/data/mockData';

interface RecordPaymentDialogProps {
  invoice: Invoice | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PAYMENT_METHODS: { value: PaymentMethod; label: string; icon: React.ReactNode }[] = [
  { value: 'check', label: 'Check', icon: <FileText className="h-4 w-4" /> },
  { value: 'ach', label: 'ACH Transfer', icon: <Building2 className="h-4 w-4" /> },
  { value: 'wire', label: 'Wire Transfer', icon: <Banknote className="h-4 w-4" /> },
  { value: 'credit_card', label: 'Credit Card', icon: <CreditCard className="h-4 w-4" /> },
  { value: 'cash', label: 'Cash', icon: <Wallet className="h-4 w-4" /> },
  { value: 'other', label: 'Other', icon: <DollarSign className="h-4 w-4" /> },
];

export function RecordPaymentDialog({ invoice, open, onOpenChange }: RecordPaymentDialogProps) {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('check');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');

  const recordPayment = useRecordPayment();
  const { data: paymentData } = usePaymentHistory(invoice?.id || '');

  if (!invoice) return null;

  const invoiceAmount = invoice.amount || 0;
  const previouslyPaid = paymentData?.summary?.total_paid || 0;
  const remainingBalance = invoiceAmount - previouslyPaid;
  const paymentStatus = invoice.payment_status || 'unpaid';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const amount = paymentAmount ? parseFloat(paymentAmount) : remainingBalance;

    await recordPayment.mutateAsync({
      invoiceId: invoice.id,
      payment_method: paymentMethod,
      payment_amount: amount,
      payment_date: paymentDate,
      payment_reference: paymentReference || undefined,
      payment_notes: paymentNotes || undefined,
    });

    // Reset form and close
    setPaymentAmount('');
    setPaymentReference('');
    setPaymentNotes('');
    onOpenChange(false);
  };

  const handlePayFullBalance = () => {
    setPaymentAmount(remainingBalance.toFixed(2));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-green-500" />
            Record Vendor Payment
          </DialogTitle>
          <DialogDescription>
            Record a payment made to {invoice.vendor_name || 'vendor'} for invoice {invoice.invoice_number}
          </DialogDescription>
        </DialogHeader>

        {/* Invoice Summary */}
        <div className="bg-muted/50 rounded-lg p-4 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Invoice Amount</span>
            <span className="font-medium">{formatCurrency(invoiceAmount)}</span>
          </div>
          {previouslyPaid > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Previously Paid</span>
              <span className="font-medium text-green-600">-{formatCurrency(previouslyPaid)}</span>
            </div>
          )}
          <Separator />
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Remaining Balance</span>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg">{formatCurrency(remainingBalance)}</span>
              {paymentStatus !== 'unpaid' && (
                <Badge variant={paymentStatus === 'paid' ? 'default' : 'secondary'}>
                  {paymentStatus === 'paid' ? 'Paid' : 'Partial'}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {paymentStatus === 'paid' ? (
          <div className="flex items-center gap-2 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <AlertCircle className="h-5 w-5 text-green-600" />
            <span className="text-sm text-green-700 dark:text-green-400">
              This invoice has been fully paid to the vendor.
            </span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Payment Method */}
            <div className="space-y-2">
              <Label>Payment Method *</Label>
              <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((method) => (
                    <SelectItem key={method.value} value={method.value}>
                      <div className="flex items-center gap-2">
                        {method.icon}
                        {method.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Payment Amount */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Payment Amount</Label>
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-xs"
                  onClick={handlePayFullBalance}
                >
                  Pay full balance
                </Button>
              </div>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={remainingBalance}
                  placeholder={remainingBalance.toFixed(2)}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="pl-9"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Leave blank to pay the full remaining balance
              </p>
            </div>

            {/* Payment Date */}
            <div className="space-y-2">
              <Label>Payment Date *</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="pl-9"
                  required
                />
              </div>
            </div>

            {/* Reference Number */}
            <div className="space-y-2">
              <Label>Reference # (Check #, ACH Ref, etc.)</Label>
              <Input
                placeholder="e.g., Check #1234"
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
              />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                placeholder="Optional payment notes..."
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                rows={2}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={recordPayment.isPending}>
                {recordPayment.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Recording...
                  </>
                ) : (
                  <>
                    <DollarSign className="h-4 w-4 mr-2" />
                    Record Payment
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

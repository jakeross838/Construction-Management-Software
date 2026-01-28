import { useState, useEffect } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/types/financial';
import { useFundDraw, FundingStatus } from '@/hooks/useDrawMutations';
import { 
  DollarSign, 
  CheckCircle, 
  AlertTriangle, 
  TrendingUp,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface FundDrawDialogProps {
  draw: {
    id: string;
    draw_number: number;
    current_payment_due: number | null;
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FundDrawDialog({ draw, open, onOpenChange }: FundDrawDialogProps) {
  const [fundedAmount, setFundedAmount] = useState('');
  const fundDraw = useFundDraw();
  
  const paymentDue = draw?.current_payment_due || 0;
  const enteredAmount = parseFloat(fundedAmount) || 0;
  
  // Determine funding status
  const getFundingStatus = (): FundingStatus => {
    if (enteredAmount === paymentDue) return 'funded';
    if (enteredAmount < paymentDue) return 'partial';
    return 'over';
  };
  
  const fundingStatus = getFundingStatus();
  const variance = enteredAmount - paymentDue;
  
  useEffect(() => {
    if (open && draw) {
      setFundedAmount(paymentDue.toString());
    }
  }, [open, draw, paymentDue]);
  
  const handleFund = async () => {
    if (!draw) return;
    
    await fundDraw.mutateAsync({
      drawId: draw.id,
      fundedAmount: enteredAmount,
      fundingStatus,
    });
    
    onOpenChange(false);
  };
  
  if (!draw) return null;
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Fund Draw #{draw.draw_number}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Payment Due */}
          <div className="rounded-lg border bg-muted/50 p-4">
            <p className="text-sm text-muted-foreground">Current Payment Due</p>
            <p className="text-2xl font-bold">{formatCurrency(paymentDue)}</p>
          </div>
          
          {/* Funded Amount Input */}
          <div className="space-y-2">
            <Label htmlFor="funded-amount">Funded Amount</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <Input
                id="funded-amount"
                type="number"
                step="0.01"
                value={fundedAmount}
                onChange={(e) => setFundedAmount(e.target.value)}
                className="pl-7 text-lg"
                placeholder="0.00"
              />
            </div>
          </div>
          
          {/* Status Indicator */}
          {enteredAmount > 0 && (
            <div className={cn(
              "rounded-lg border p-3 flex items-center gap-3",
              fundingStatus === 'funded' && "bg-green-50 border-green-200",
              fundingStatus === 'partial' && "bg-amber-50 border-amber-200",
              fundingStatus === 'over' && "bg-blue-50 border-blue-200",
            )}>
              {fundingStatus === 'funded' && (
                <>
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="font-medium text-green-700">Fully Funded</p>
                    <p className="text-sm text-green-600">Amount matches payment due</p>
                  </div>
                </>
              )}
              {fundingStatus === 'partial' && (
                <>
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                  <div>
                    <p className="font-medium text-amber-700">Partially Funded</p>
                    <p className="text-sm text-amber-600">
                      Shortfall of {formatCurrency(Math.abs(variance))} will carry to next draw
                    </p>
                  </div>
                </>
              )}
              {fundingStatus === 'over' && (
                <>
                  <TrendingUp className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="font-medium text-blue-700">Over-Funded</p>
                    <p className="text-sm text-blue-600">
                      Overage of {formatCurrency(variance)} will credit next draw
                    </p>
                  </div>
                </>
              )}
            </div>
          )}
          
          {/* Quick Set Buttons */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFundedAmount(paymentDue.toString())}
              className="flex-1"
            >
              Full Amount
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFundedAmount((paymentDue * 0.9).toFixed(2))}
              className="flex-1"
            >
              90%
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFundedAmount((paymentDue * 0.8).toFixed(2))}
              className="flex-1"
            >
              80%
            </Button>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleFund}
            disabled={fundDraw.isPending || enteredAmount <= 0}
          >
            {fundDraw.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <CheckCircle className="h-4 w-4 mr-2" />
            )}
            Mark as Funded
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

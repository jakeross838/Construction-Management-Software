import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Mail, Loader2, Send } from "lucide-react";
import { generateCOPdfBase64 } from "@/lib/coPdfGenerator";
import { ChangeOrder, formatCurrency } from "@/types/financial";

interface SendCOEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  co: ChangeOrder & { 
    job_client?: string; 
    vendor_name?: string; 
    job_address?: string;
  };
}

export function SendCOEmailDialog({ open, onOpenChange, co }: SendCOEmailDialogProps) {
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState(`Change Order ${co.co_number} - ${co.job_name || 'Project'}`);
  const [message, setMessage] = useState(
    `Please find attached Change Order ${co.co_number} for your review and approval.\n\nAmount: ${formatCurrency(co.total_amount)}\nDescription: ${co.description}\n\nPlease review the attached document and sign to authorize the work to proceed.`
  );
  const [isSending, setIsSending] = useState(false);

  const handleSend = async () => {
    if (!email) {
      toast.error("Please enter an email address");
      return;
    }

    setIsSending(true);

    try {
      const pdfBase64 = generateCOPdfBase64(co);

      const { data, error } = await supabase.functions.invoke('send-po-email', {
        body: {
          vendorEmail: email,
          vendorName: co.job_client || "Client",
          poNumber: co.co_number,
          poTitle: co.description,
          jobName: co.job_name || 'Project',
          totalAmount: co.total_amount,
          pdfBase64: pdfBase64,
          customSubject: subject,
          customMessage: message,
          documentType: 'Change Order',
        },
      });

      if (error) throw error;

      if (data?.success) {
        toast.success(`Change Order sent to ${email}`);
        onOpenChange(false);
      } else {
        throw new Error(data?.error || "Failed to send email");
      }
    } catch (error: any) {
      console.error("Error sending CO email:", error);
      toast.error(error.message || "Failed to send email");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Send Change Order
          </DialogTitle>
          <DialogDescription>
            Send {co.co_number} as a PDF attachment for review and signature.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="co-number">Change Order</Label>
            <Input
              id="co-number"
              value={`${co.co_number} - ${formatCurrency(co.total_amount)}`}
              disabled
              className="bg-muted"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="recipient-email">Recipient Email</Label>
            <Input
              id="recipient-email"
              type="email"
              placeholder="client@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
            />
          </div>

          <div className="rounded-lg bg-muted p-3 text-sm">
            <p className="font-medium mb-1">Email will include:</p>
            <ul className="text-muted-foreground space-y-1">
              <li>• PDF attachment with full CO document</li>
              <li>• Cost breakdown and line items</li>
              <li>• Signature block for client approval</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSending}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={isSending}>
            {isSending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Send Email
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

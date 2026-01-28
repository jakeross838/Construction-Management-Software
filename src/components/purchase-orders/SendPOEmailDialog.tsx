import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Mail, Loader2, Send } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface SendPOEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  poData: {
    id: string;
    po_number: string;
    title: string;
    total_amount: number;
    scope_of_work?: string;
    created_at: string;
    release_date?: string;
    scheduled_completion?: string;
    status: string;
    approved_at?: string;
    approved_by?: string;
    vendor: {
      name: string;
      email?: string;
      address?: string;
      phone?: string;
    };
    job: {
      name: string;
      address?: string;
      phone?: string;
    };
    line_items: Array<{
      cost_code?: string;
      description: string;
      quantity: number;
      unit_price: number;
      total_price: number;
    }>;
  };
}

export function SendPOEmailDialog({ open, onOpenChange, poData }: SendPOEmailDialogProps) {
  const [email, setEmail] = useState(poData.vendor.email || "");
  const [isSending, setIsSending] = useState(false);
  const { toast } = useToast();

  const generatePdfBase64 = (): string => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Header
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("BuildFlow Pro", 14, 20);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Building Excellence Together", 14, 26);

    // Printing date
    doc.setFontSize(8);
    doc.text(`Printed: ${new Date().toLocaleDateString()}`, pageWidth - 14, 15, { align: "right" });
    doc.text("123 Construction Ave", pageWidth - 14, 20, { align: "right" });
    doc.text("(555) 123-4567", pageWidth - 14, 25, { align: "right" });

    // Title
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("Purchase Order", pageWidth / 2, 40, { align: "center" });
    
    const statusText = poData.status === 'approved' ? '(Approved)' : `(${poData.status})`;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(statusText, pageWidth / 2, 46, { align: "center" });

    // Line
    doc.setLineWidth(0.5);
    doc.line(14, 50, pageWidth - 14, 50);

    // PO Info
    let yPos = 58;
    doc.setFontSize(9);
    doc.text(`Created: ${new Date(poData.created_at).toLocaleDateString()}`, 14, yPos);
    if (poData.release_date) {
      doc.text(`Release Date: ${new Date(poData.release_date).toLocaleDateString()}`, 80, yPos);
    }
    doc.text(`PO #: ${poData.po_number}`, pageWidth - 14, yPos, { align: "right" });

    // Vendor and Job Info
    yPos = 70;
    doc.setFont("helvetica", "bold");
    doc.text("Vendor:", 14, yPos);
    doc.text("Job:", 110, yPos);
    
    doc.setFont("helvetica", "normal");
    yPos += 6;
    doc.text(poData.vendor.name, 14, yPos);
    doc.text(poData.job.name, 110, yPos);
    
    if (poData.vendor.address) {
      yPos += 5;
      doc.text(poData.vendor.address, 14, yPos);
    }
    if (poData.job.address) {
      doc.text(poData.job.address, 110, yPos);
    }

    // Summary table
    yPos += 15;
    autoTable(doc, {
      startY: yPos,
      head: [["Title", "Scheduled Completion", "Total Price"]],
      body: [[
        poData.title,
        poData.scheduled_completion ? new Date(poData.scheduled_completion).toLocaleDateString() : "N/A",
        `$${poData.total_amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}`
      ]],
      theme: "grid",
      headStyles: { fillColor: [66, 66, 66] },
      margin: { left: 14, right: 14 },
    });

    // Scope of work
    yPos = (doc as any).lastAutoTable.finalY + 10;
    if (poData.scope_of_work) {
      doc.setFont("helvetica", "bold");
      doc.text("Scope of Work:", 14, yPos);
      doc.setFont("helvetica", "normal");
      yPos += 6;
      const scopeLines = doc.splitTextToSize(poData.scope_of_work, pageWidth - 28);
      doc.text(scopeLines, 14, yPos);
      yPos += scopeLines.length * 5 + 10;
    }

    // Line items
    if (poData.line_items && poData.line_items.length > 0) {
      autoTable(doc, {
        startY: yPos,
        head: [["Cost Code", "Description", "Qty", "Unit Price", "Total"]],
        body: poData.line_items.map(item => [
          item.cost_code || "-",
          item.description,
          item.quantity.toString(),
          `$${item.unit_price.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
          `$${item.total_price.toLocaleString("en-US", { minimumFractionDigits: 2 })}`
        ]),
        theme: "striped",
        headStyles: { fillColor: [66, 66, 66] },
        margin: { left: 14, right: 14 },
      });
    }

    // Footer
    const finalY = (doc as any).lastAutoTable?.finalY || yPos;
    doc.setFontSize(8);
    doc.text(
      "By signing below, you acknowledge receipt and acceptance of this Purchase Order.",
      14,
      finalY + 15
    );

    if (poData.status === 'approved' && poData.approved_at) {
      doc.text(
        `Approved by: ${poData.approved_by || 'System'} on ${new Date(poData.approved_at).toLocaleString()}`,
        14,
        finalY + 22
      );
    }

    // Convert to base64
    const pdfOutput = doc.output('datauristring');
    // Extract just the base64 part (remove the data:application/pdf;base64, prefix)
    const base64 = pdfOutput.split(',')[1];
    return base64;
  };

  const handleSend = async () => {
    if (!email) {
      toast({
        title: "Email required",
        description: "Please enter a vendor email address",
        variant: "destructive",
      });
      return;
    }

    setIsSending(true);

    try {
      const pdfBase64 = generatePdfBase64();

      const { data, error } = await supabase.functions.invoke('send-po-email', {
        body: {
          vendorEmail: email,
          vendorName: poData.vendor.name,
          poNumber: poData.po_number,
          poTitle: poData.title,
          jobName: poData.job.name,
          totalAmount: poData.total_amount,
          pdfBase64: pdfBase64,
        },
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: "Email sent!",
          description: `PO ${poData.po_number} has been sent to ${email}`,
        });
        onOpenChange(false);
      } else {
        throw new Error(data?.error || "Failed to send email");
      }
    } catch (error: any) {
      console.error("Error sending PO email:", error);
      toast({
        title: "Failed to send email",
        description: error.message || "Please try again later",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Send PO to Vendor
          </DialogTitle>
          <DialogDescription>
            Send PO #{poData.po_number} as a PDF attachment to the vendor.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="vendor-name">Vendor</Label>
            <Input
              id="vendor-name"
              value={poData.vendor.name}
              disabled
              className="bg-muted"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="vendor-email">Email Address</Label>
            <Input
              id="vendor-email"
              type="email"
              placeholder="vendor@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="rounded-lg bg-muted p-3 text-sm">
            <p className="font-medium mb-1">Email will include:</p>
            <ul className="text-muted-foreground space-y-1">
              <li>• PO details summary</li>
              <li>• PDF attachment with full PO document</li>
              <li>• Job: {poData.job.name}</li>
              <li>• Amount: ${poData.total_amount.toLocaleString()}</li>
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

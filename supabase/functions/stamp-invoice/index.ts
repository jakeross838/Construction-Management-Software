import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, StandardFonts, rgb, degrees } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface StampData {
  invoiceId: string;
  status: "needs_review" | "needs_approval" | "approved" | "in_draw" | "paid";
}

interface InvoiceDetails {
  id: string;
  invoice_number: string;
  amount: number;
  invoice_date: string;
  due_date: string | null;
  vendor_name: string | null;
  job_name: string | null;
  status: string;
  pdf_url: string | null;
  approved_at: string | null;
  approved_by: string | null;
  paid_at: string | null;
  is_credit: boolean;
  ai_confidence: Record<string, number> | null;
  draw_number?: number;
  allocations: Array<{
    cost_code: string;
    cost_code_name: string;
    amount: number;
  }>;
  po_number?: string;
  po_total?: number;
  po_invoiced?: number;
  po_remaining?: number;
  coded_by?: string;
}

// Color definitions (RGB 0-1 scale)
const colors = {
  // Status colors - more saturated for better visibility
  orange: rgb(0.91, 0.45, 0.08),    // Darker, more professional orange
  blue: rgb(0.15, 0.35, 0.75),      // Deeper blue
  green: rgb(0.08, 0.50, 0.20),     // Richer green
  purple: rgb(0.45, 0.20, 0.65),    // Deeper purple

  // Neutrals
  gray: rgb(0.35, 0.35, 0.35),      // Darker for better text contrast
  lightGray: rgb(0.88, 0.88, 0.88), // Slightly darker for visible borders
  white: rgb(1, 1, 1),

  // Accent colors
  red: rgb(0.75, 0.15, 0.15),       // Deeper red for credits
  amber: rgb(0.80, 0.50, 0.05),     // Warning color for flags
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatDate(dateString: string | null): string {
  if (!dateString) return "";
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { invoiceId, status }: StampData = await req.json();

    if (!invoiceId || !status) {
      return new Response(
        JSON.stringify({ error: "Invoice ID and status are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch invoice with all related data (using v2_ tables directly for FK joins)
    const { data: invoiceData, error: invoiceError } = await supabase
      .from("v2_invoices")
      .select(`
        *,
        v2_vendors (name),
        v2_jobs (name),
        v2_purchase_orders (
          po_number,
          original_amount,
          change_order_total,
          total_amount
        ),
        v2_draws (draw_number),
        v2_invoice_allocations (
          amount,
          v2_cost_codes (code, name)
        )
      `)
      .eq("id", invoiceId)
      .single();

    if (invoiceError || !invoiceData) {
      console.error("Invoice fetch error:", invoiceError);
      return new Response(
        JSON.stringify({ error: "Invoice not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Transform to our interface (using v2_ prefixed keys from response)
    const invoice: InvoiceDetails = {
      id: invoiceData.id,
      invoice_number: invoiceData.invoice_number,
      amount: invoiceData.amount,
      invoice_date: invoiceData.invoice_date,
      due_date: invoiceData.due_date,
      vendor_name: (invoiceData.v2_vendors as any)?.name || null,
      job_name: (invoiceData.v2_jobs as any)?.name || null,
      status: invoiceData.status,
      pdf_url: invoiceData.pdf_url,
      approved_at: invoiceData.approved_at,
      approved_by: invoiceData.approved_by,
      paid_at: invoiceData.paid_at,
      is_credit: invoiceData.is_credit || false,
      ai_confidence: invoiceData.ai_confidence as Record<string, number> | null,
      draw_number: (invoiceData.v2_draws as any)?.draw_number,
      allocations: ((invoiceData.v2_invoice_allocations as any[]) || []).map((a: any) => ({
        cost_code: a.v2_cost_codes?.code || "",
        cost_code_name: a.v2_cost_codes?.name || "",
        amount: a.amount,
      })),
      po_number: (invoiceData.v2_purchase_orders as any)?.po_number,
      po_total: (invoiceData.v2_purchase_orders as any)?.total_amount || (invoiceData.v2_purchase_orders as any)?.original_amount,
      po_invoiced: 0, // Will need to compute from invoices if needed
      po_remaining: 0, // Will need to compute if needed
    };

    // Check if we have a PDF to stamp
    if (!invoice.pdf_url) {
      return new Response(
        JSON.stringify({ success: true, message: "No PDF to stamp" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Download the original PDF from storage
    // Extract path after /invoices/ from the full URL
    const invoicesBucketIndex = invoice.pdf_url.indexOf("/invoices/");
    if (invoicesBucketIndex === -1) {
      return new Response(
        JSON.stringify({ error: "Invalid PDF URL format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const pdfPath = invoice.pdf_url.substring(invoicesBucketIndex + "/invoices/".length);
    if (!pdfPath) {
      return new Response(
        JSON.stringify({ error: "Invalid PDF URL" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Downloading PDF from path:", pdfPath);
    const { data: pdfData, error: downloadError } = await supabase.storage
      .from("invoices")
      .download(pdfPath);

    if (downloadError || !pdfData) {
      console.error("PDF download error:", downloadError);
      return new Response(
        JSON.stringify({ error: "Failed to download original PDF" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Convert to array buffer
    const pdfBytes = await pdfData.arrayBuffer();

    // Load and stamp the PDF
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();
    const firstPage = pages[0];
    const { width, height } = firstPage.getSize();
    const rotation = firstPage.getRotation().angle;

    // Embed fonts
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Calculate stamp position (top-right corner, accounting for rotation)
    const stampWidth = 220;
    const margin = 15;
    
    // Build stamp based on status
    let stampLines: Array<{
      text: string;
      font: typeof helvetica;
      size: number;
      color: typeof colors.gray;
      separator?: boolean;  // Draw separator line before this item
    }> = [];

    let headerColor = colors.gray;
    let headerText = "";

    switch (status) {
      case "needs_review":
        headerColor = colors.orange;
        headerText = "NEEDS REVIEW";
        stampLines = [
          { text: formatDate(new Date().toISOString()), font: helvetica, size: 8, color: colors.gray },
          { text: "", font: helvetica, size: 4, color: colors.gray },
          { text: formatCurrency(invoice.amount), font: helveticaBold, size: 14, color: colors.gray },
          { text: "", font: helvetica, size: 4, color: colors.gray },
        ];
        if (invoice.vendor_name) {
          stampLines.push({ text: invoice.vendor_name, font: helvetica, size: 9, color: colors.gray });
        }
        stampLines.push({ text: `#${invoice.invoice_number}`, font: helvetica, size: 8, color: colors.gray });
        
        // Add flags
        if (!invoice.job_name) {
          stampLines.push({ text: "", font: helvetica, size: 4, color: colors.gray });
          stampLines.push({ text: "⚠ No Job Assigned", font: helvetica, size: 8, color: colors.amber });
        }
        if (invoice.ai_confidence) {
          const lowConfidence = Object.values(invoice.ai_confidence).some(v => (v as number) < 0.7);
          if (lowConfidence) {
            stampLines.push({ text: "⚠ Low AI Confidence", font: helvetica, size: 8, color: colors.amber });
          }
        }
        break;

      case "needs_approval":
        headerColor = colors.blue;
        headerText = "NEEDS APPROVAL";
        stampLines = [
          { text: formatDate(new Date().toISOString()), font: helvetica, size: 8, color: colors.gray },
          { text: invoice.coded_by ? `Coded by ${invoice.coded_by}` : "", font: helvetica, size: 8, color: colors.gray },
          { text: "", font: helvetica, size: 4, color: colors.gray },
          { text: formatCurrency(invoice.amount), font: helveticaBold, size: 14, color: colors.gray },
          { text: "", font: helvetica, size: 4, color: colors.gray },
        ];
        if (invoice.job_name) {
          stampLines.push({ text: invoice.job_name, font: helveticaBold, size: 9, color: colors.gray });
        }
        // Add allocations
        if (invoice.allocations.length > 0) {
          stampLines.push({ text: "", font: helvetica, size: 4, color: colors.gray, separator: true });
          for (const alloc of invoice.allocations.slice(0, 5)) {
            const truncatedName = alloc.cost_code_name.length > 12
              ? alloc.cost_code_name.substring(0, 12) + "..."
              : alloc.cost_code_name;
            stampLines.push({
              text: `${alloc.cost_code} ${truncatedName} ${formatCurrency(alloc.amount)}`,
              font: helvetica,
              size: 7,
              color: colors.gray,
            });
          }
          if (invoice.allocations.length > 5) {
            stampLines.push({ text: `+ ${invoice.allocations.length - 5} more...`, font: helvetica, size: 7, color: colors.gray });
          }
        }
        break;

      case "approved":
        headerColor = colors.green;
        headerText = invoice.is_credit ? "CREDIT APPROVED" : "APPROVED";
        stampLines = [
          { text: formatDate(invoice.approved_at || new Date().toISOString()), font: helvetica, size: 8, color: colors.gray },
          { text: invoice.approved_by ? `by ${invoice.approved_by}` : "", font: helvetica, size: 8, color: colors.gray },
          { text: "", font: helvetica, size: 4, color: colors.gray },
          { text: formatCurrency(invoice.amount), font: helveticaBold, size: 14, color: invoice.is_credit ? colors.red : colors.gray },
          { text: "", font: helvetica, size: 4, color: colors.gray },
        ];
        if (invoice.job_name) {
          stampLines.push({ text: invoice.job_name, font: helveticaBold, size: 9, color: colors.gray });
        }
        // Add allocations
        if (invoice.allocations.length > 0) {
          stampLines.push({ text: "", font: helvetica, size: 4, color: colors.gray, separator: true });
          for (const alloc of invoice.allocations.slice(0, 5)) {
            const truncatedName = alloc.cost_code_name.length > 12
              ? alloc.cost_code_name.substring(0, 12) + "..."
              : alloc.cost_code_name;
            stampLines.push({
              text: `${alloc.cost_code} ${truncatedName} ${formatCurrency(alloc.amount)}`,
              font: helvetica,
              size: 7,
              color: colors.gray,
            });
          }
        }
        // Add PO info
        if (invoice.po_number) {
          stampLines.push({ text: "", font: helvetica, size: 4, color: colors.gray, separator: true });
          stampLines.push({ text: `PO: ${invoice.po_number}`, font: helveticaBold, size: 8, color: colors.gray });
          if (invoice.po_total && invoice.po_invoiced !== undefined) {
            const percent = Math.round((invoice.po_invoiced / invoice.po_total) * 100);
            stampLines.push({
              text: `Billed: ${formatCurrency(invoice.po_invoiced)} (${percent}%)`,
              font: helvetica,
              size: 7,
              color: colors.gray,
            });
            if (invoice.po_remaining) {
              stampLines.push({
                text: `Remaining: ${formatCurrency(invoice.po_remaining)}`,
                font: helvetica,
                size: 7,
                color: colors.gray,
              });
            }
          }
        }
        break;

      case "in_draw":
        // For in_draw, we stamp "APPROVED" plus a draw badge
        headerColor = colors.green;
        headerText = "APPROVED";
        stampLines = [
          { text: formatDate(invoice.approved_at || new Date().toISOString()), font: helvetica, size: 8, color: colors.gray },
          { text: invoice.approved_by ? `by ${invoice.approved_by}` : "", font: helvetica, size: 8, color: colors.gray },
          { text: "", font: helvetica, size: 4, color: colors.gray },
          { text: formatCurrency(invoice.amount), font: helveticaBold, size: 14, color: colors.gray },
          { text: "", font: helvetica, size: 4, color: colors.gray },
        ];
        if (invoice.job_name) {
          stampLines.push({ text: invoice.job_name, font: helveticaBold, size: 9, color: colors.gray });
        }
        if (invoice.allocations.length > 0) {
          stampLines.push({ text: "", font: helvetica, size: 4, color: colors.gray, separator: true });
          for (const alloc of invoice.allocations.slice(0, 4)) {
            const truncatedName = alloc.cost_code_name.length > 12
              ? alloc.cost_code_name.substring(0, 12) + "..."
              : alloc.cost_code_name;
            stampLines.push({
              text: `${alloc.cost_code} ${truncatedName} ${formatCurrency(alloc.amount)}`,
              font: helvetica,
              size: 7,
              color: colors.gray,
            });
          }
        }
        // Add draw badge at the end
        stampLines.push({ text: "", font: helvetica, size: 6, color: colors.gray, separator: true });
        stampLines.push({
          text: `DRAW #${invoice.draw_number || "—"}`,
          font: helveticaBold,
          size: 10,
          color: colors.purple,
        });
        break;

      case "paid":
        // For paid, we add approval stamp + PAID watermark
        headerColor = colors.green;
        headerText = "APPROVED";
        stampLines = [
          { text: formatDate(invoice.approved_at || new Date().toISOString()), font: helvetica, size: 8, color: colors.gray },
          { text: invoice.approved_by ? `by ${invoice.approved_by}` : "", font: helvetica, size: 8, color: colors.gray },
          { text: "", font: helvetica, size: 4, color: colors.gray },
          { text: formatCurrency(invoice.amount), font: helveticaBold, size: 14, color: colors.gray },
          { text: "", font: helvetica, size: 4, color: colors.gray },
        ];
        if (invoice.job_name) {
          stampLines.push({ text: invoice.job_name, font: helveticaBold, size: 9, color: colors.gray });
        }
        stampLines.push({ text: "", font: helvetica, size: 6, color: colors.gray });
        stampLines.push({
          text: `PAID: ${formatDate(invoice.paid_at)}`,
          font: helveticaBold,
          size: 10,
          color: colors.green,
        });
        break;
    }

    // Calculate stamp height
    const lineHeight = 1.5;
    const padding = 14;
    const headerHeight = 24;
    let totalHeight = padding * 2 + headerHeight;
    for (const line of stampLines) {
      totalHeight += line.size * lineHeight;
    }

    // Position stamp (top-right corner)
    const stampX = width - margin - stampWidth;
    const stampY = height - margin - totalHeight;

    // Shadow effect
    firstPage.drawRectangle({
      x: stampX + 2,
      y: stampY - 2,
      width: stampWidth,
      height: totalHeight,
      color: rgb(0.85, 0.85, 0.85),
      opacity: 0.5,
    });

    // Draw white background with border
    firstPage.drawRectangle({
      x: stampX,
      y: stampY,
      width: stampWidth,
      height: totalHeight,
      color: colors.white,
      opacity: 0.95,
      borderColor: colors.lightGray,
      borderWidth: 1,
    });

    // Helper to draw separator line
    const drawSeparator = (y: number) => {
      firstPage.drawLine({
        start: { x: stampX + padding, y },
        end: { x: stampX + stampWidth - padding, y },
        thickness: 0.5,
        color: colors.lightGray,
      });
    };

    // Draw colored header bar
    firstPage.drawRectangle({
      x: stampX,
      y: stampY + totalHeight - headerHeight,
      width: stampWidth,
      height: headerHeight,
      color: headerColor,
    });

    // Draw header text (centered)
    const headerTextWidth = helveticaBold.widthOfTextAtSize(headerText, 12);
    firstPage.drawText(headerText, {
      x: stampX + (stampWidth - headerTextWidth) / 2,
      y: stampY + totalHeight - headerHeight + 7,
      size: 12,
      font: helveticaBold,
      color: colors.white,
    });

    // Draw stamp lines
    let currentY = stampY + totalHeight - headerHeight - padding - 2;
    for (const line of stampLines) {
      // Draw separator if flagged
      if (line.separator) {
        drawSeparator(currentY + line.size * 0.3);
      }
      if (line.text) {
        const textWidth = line.font.widthOfTextAtSize(line.text, line.size);
        firstPage.drawText(line.text, {
          x: stampX + (stampWidth - textWidth) / 2,
          y: currentY,
          size: line.size,
          font: line.font,
          color: line.color,
        });
      }
      currentY -= line.size * lineHeight;
    }

    // For PAID status, add a large diagonal watermark
    if (status === "paid") {
      const watermarkText = "PAID";
      const watermarkSize = 72;
      const watermarkWidth = helveticaBold.widthOfTextAtSize(watermarkText, watermarkSize);
      
      firstPage.drawText(watermarkText, {
        x: (width - watermarkWidth) / 2,
        y: height / 2 - watermarkSize / 2,
        size: watermarkSize,
        font: helveticaBold,
        color: colors.green,
        opacity: 0.15,
        rotate: degrees(-30),
      });
    }

    // Save the stamped PDF
    const stampedPdfBytes = await pdfDoc.save();

    // Upload stamped PDF (preserve folder structure, just prefix filename with stamped-)
    const pathParts = pdfPath.split("/");
    const fileName = pathParts.pop();
    const folderPath = pathParts.join("/");
    const stampedFileName = folderPath
      ? `${folderPath}/stamped-${Date.now()}-${fileName}`
      : `stamped-${Date.now()}-${fileName}`;

    console.log("Uploading stamped PDF to:", stampedFileName);
    const { error: uploadError } = await supabase.storage
      .from("invoices")
      .upload(stampedFileName, stampedPdfBytes, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return new Response(
        JSON.stringify({ error: "Failed to upload stamped PDF" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("invoices")
      .getPublicUrl(stampedFileName);

    // Update invoice with stamped PDF URL (use v2_ table directly)
    const { error: updateError } = await supabase
      .from("v2_invoices")
      .update({ pdf_stamped_url: urlData.publicUrl })
      .eq("id", invoiceId);

    if (updateError) {
      console.error("Update error:", updateError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        stamped_pdf_url: urlData.publicUrl,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Stamp invoice error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

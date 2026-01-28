import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SendPOEmailRequest {
  vendorEmail: string;
  vendorName: string;
  poNumber: string;
  poTitle: string;
  jobName: string;
  totalAmount: number;
  pdfBase64: string;
  senderName?: string;
  customSubject?: string;
  customMessage?: string;
  documentType?: string; // 'Purchase Order' or 'Change Order'
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      vendorEmail, 
      vendorName, 
      poNumber, 
      poTitle,
      jobName,
      totalAmount,
      pdfBase64,
      senderName = "Ross Built",
      customSubject,
      customMessage,
      documentType = "Purchase Order"
    }: SendPOEmailRequest = await req.json();

    if (!vendorEmail) {
      throw new Error("Recipient email is required");
    }

    if (!pdfBase64) {
      throw new Error("PDF data is required");
    }

    const formattedAmount = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(totalAmount);

    // Use custom message if provided, otherwise use default template
    const emailBody = customMessage 
      ? customMessage.replace(/\n/g, '<br>')
      : `Please find attached the ${documentType} for your review and records.`;

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #333; border-bottom: 2px solid #eee; padding-bottom: 10px;">
          ${documentType} ${poNumber}
        </h1>
        
        <p>Dear ${vendorName},</p>
        
        <p>${emailBody}</p>
        
        <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #555;">${documentType} Details</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #666;">${documentType === 'Change Order' ? 'CO' : 'PO'} Number:</td>
              <td style="padding: 8px 0; font-weight: bold;">${poNumber}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">Description:</td>
              <td style="padding: 8px 0; font-weight: bold;">${poTitle}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">Job:</td>
              <td style="padding: 8px 0; font-weight: bold;">${jobName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;">Amount:</td>
              <td style="padding: 8px 0; font-weight: bold; color: #2563eb;">${formattedAmount}</td>
            </tr>
          </table>
        </div>
        
        <p>If you have any questions, please don't hesitate to contact us.</p>
        
        <p style="margin-top: 30px;">
          Best regards,<br>
          <strong>${senderName}</strong>
        </p>
        
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="color: #999; font-size: 12px;">
          This email was sent automatically. The PDF document is attached for your records.
        </p>
      </div>
    `;

    const emailSubject = customSubject || `${documentType} ${poNumber} - ${poTitle}`;
    const filename = documentType === 'Change Order' ? `${poNumber}.pdf` : `PO-${poNumber}.pdf`;

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: `${senderName} <onboarding@resend.dev>`,
        to: [vendorEmail],
        subject: emailSubject,
        html: emailHtml,
        attachments: [
          {
            filename: filename,
            content: pdfBase64,
          },
        ],
      }),
    });

    const emailResponse = await response.json();
    
    if (!response.ok) {
      throw new Error(emailResponse.message || "Failed to send email");
    }

    console.log("PO email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, data: emailResponse }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-po-email function:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { file_base64, file_name, file_type, vendor_id, job_id, source_type } = await req.json();

    if (!file_base64) {
      throw new Error("No file provided");
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `You are a construction cost analyst. Extract all pricing information from this document (invoice, quote, proposal, or catalog).

For each line item found, extract:
- item_name: The material/product name (normalize to common names like "2x4 Stud", "1/2" Drywall Sheet", etc.)
- description: Additional details about the item
- quantity: Number of units purchased
- unit: The unit of measure (each, SF, LF, sheet, roll, gallon, box, bag, board_foot, square)
- unit_price: Price per unit
- total_price: Total line item price
- category: Best fit category (lumber, drywall, insulation, roofing, tile, flooring, electrical, plumbing, paint, hardware, concrete, masonry, windows, doors, cabinets, countertops, appliances, hvac, other)

Also extract document-level info:
- vendor_name: The vendor/supplier name
- document_date: The date on the document
- document_number: Invoice/quote/PO number
- document_type: "invoice", "quote", "proposal", or "catalog"

Return a JSON object with this structure:
{
  "vendor_name": "string",
  "document_date": "YYYY-MM-DD",
  "document_number": "string",
  "document_type": "string",
  "line_items": [
    {
      "item_name": "string",
      "description": "string",
      "quantity": number,
      "unit": "string",
      "unit_price": number,
      "total_price": number,
      "category": "string"
    }
  ],
  "confidence": number (0-1)
}`;

    const messages = [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Extract all pricing data from this ${source_type || 'document'} (${file_name}). Return ONLY valid JSON.`
          },
          {
            type: "image_url",
            image_url: {
              url: `data:${file_type};base64,${file_base64}`
            }
          }
        ]
      }
    ];

    console.log("Calling Lovable AI for price extraction...");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No response from AI");
    }

    // Parse the JSON from the response
    let extractedData;
    try {
      // Try to find JSON in the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        extractedData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      throw new Error("Failed to parse price data from document");
    }

    // Add metadata
    extractedData.source_vendor_id = vendor_id;
    extractedData.source_job_id = job_id;
    extractedData.source_type = source_type || extractedData.document_type || "invoice";

    console.log("Extracted price data:", JSON.stringify(extractedData, null, 2));

    return new Response(
      JSON.stringify(extractedData),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Price extraction error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ExtractedPOData {
  vendor_name: string | null;
  description: string | null;
  scope_of_work: string | null;
  total_amount: number | null;
  quote_date: string | null;
  valid_until: string | null;
  line_items: Array<{
    description: string;
    quantity?: number;
    unit_price?: number;
    amount: number;
  }>;
  confidence: {
    vendor_name: number;
    total_amount: number;
    line_items: number;
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64, mimeType } = await req.json();

    if (!imageBase64) {
      return new Response(
        JSON.stringify({ error: "No image data provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Anthropic API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = `You are an expert document extraction system for construction management. Analyze the provided vendor quote, proposal, or bid document and extract the following information to create a Purchase Order:

1. Vendor Name - The company or contractor who provided the quote
2. Description - A brief summary of the work (1-2 sentences)
3. Scope of Work - Detailed description of what work will be performed
4. Total Amount - The total quoted price (as a number, no currency symbols)
5. Quote Date - When the quote was issued (format: YYYY-MM-DD)
6. Valid Until - Quote expiration date if shown (format: YYYY-MM-DD)
7. Line Items - Break down of individual items/services with:
   - description: What the item is
   - quantity: Number of units (optional)
   - unit_price: Price per unit (optional)
   - amount: Total for this line item

Be precise and extract what you can clearly see. If a field is not visible or unclear, return null.

For confidence scores, rate from 0 to 1:
- 1.0 = Clearly visible and unambiguous
- 0.7-0.9 = Visible but slightly unclear
- 0.4-0.6 = Partially visible or inferred
- 0.1-0.3 = Guessed based on context
- 0 = Not found

You MUST respond with ONLY a valid JSON object in this exact format, no other text:
{
  "vendor_name": "string or null",
  "description": "string or null",
  "scope_of_work": "string or null",
  "total_amount": number or null,
  "quote_date": "YYYY-MM-DD or null",
  "valid_until": "YYYY-MM-DD or null",
  "line_items": [{"description": "string", "quantity": number, "unit_price": number, "amount": number}],
  "confidence": {
    "vendor_name": number,
    "total_amount": number,
    "line_items": number
  }
}`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: mimeType || "image/png",
                  data: imageBase64,
                },
              },
              {
                type: "text",
                text: systemPrompt,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Anthropic API error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402 || response.status === 400) {
        return new Response(
          JSON.stringify({ error: "Anthropic API error. Please check your credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: "Failed to process document with AI" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const content = data.content?.[0]?.text;

    if (!content) {
      return new Response(
        JSON.stringify({ error: "No response from AI" }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse the JSON response
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }
      
      const extractedData: ExtractedPOData = JSON.parse(jsonMatch[0]);

      return new Response(
        JSON.stringify({ success: true, data: extractedData }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      return new Response(
        JSON.stringify({ error: "Could not parse document data from AI response" }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

  } catch (error) {
    console.error("Extract PO error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

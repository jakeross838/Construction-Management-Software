import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPPORTED_MIME_TYPES = [
  "image/jpeg", 
  "image/png", 
  "image/gif", 
  "image/webp",
  "application/pdf"
];

// Trade types we recognize
const TRADE_TYPES = [
  'electrical', 'plumbing', 'hvac', 'framing', 'drywall', 'roofing',
  'painting', 'flooring', 'cabinets', 'countertops', 'appliances',
  'windows', 'doors', 'insulation', 'siding', 'concrete', 'masonry',
  'landscaping', 'fencing', 'gutters', 'septic', 'well', 'grading',
  'demolition', 'cleanup', 'rental', 'general', 'other'
];

interface ExtractedVendor {
  companyName: string | null;
  tradeType: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
}

interface ExtractedJob {
  reference: string | null;
  address: string | null;
  clientName: string | null;
  poNumber: string | null;
}

interface LineItem {
  description: string;
  quantity?: number;
  unit?: string;
  unitPrice?: number;
  amount: number;
}

interface ExtractedInvoiceData {
  vendor: ExtractedVendor;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  dueDate: string | null;
  invoiceType: 'standard' | 'credit_memo' | 'debit_memo';
  job: ExtractedJob;
  amounts: {
    subtotal: number | null;
    taxAmount: number | null;
    totalAmount: number | null;
  };
  lineItems: LineItem[];
  extractionConfidence: {
    vendor: number;
    amount: number;
    invoiceNumber: number;
    date: number;
    job: number;
  };
}

interface MatchedVendor {
  id: string;
  name: string;
  confidence: number;
  matchType: 'exact' | 'alias' | 'fuzzy' | 'learned';
}

interface MatchedJob {
  id: string;
  name: string;
  address: string | null;
  confidence: number;
  matchType: 'exact' | 'address' | 'client_name' | 'po' | 'fuzzy' | 'learned';
}

interface MatchedPO {
  id: string;
  po_number: string;
  vendor_id: string;
  total_amount: number;
  invoiced_amount: number;
  confidence: number;
}

interface CostCodeSuggestion {
  id: string;
  code: string;
  name: string;
  amount: number;
  confidence: number;
  reason: string;
}

// Fuzzy matching utilities
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

function soundex(s: string): string {
  const a = s.toLowerCase().split('');
  const f = a.shift() as string;
  const r = a
    .map((c) => {
      switch (c) {
        case 'b': case 'f': case 'p': case 'v': return '1';
        case 'c': case 'g': case 'j': case 'k': case 'q': case 's': case 'x': case 'z': return '2';
        case 'd': case 't': return '3';
        case 'l': return '4';
        case 'm': case 'n': return '5';
        case 'r': return '6';
        default: return '';
      }
    })
    .join('')
    .replace(/(.)\1+/g, '$1');
  return (f + r).toUpperCase().substring(0, 4).padEnd(4, '0');
}

function fuzzyMatchScore(search: string, target: string): number {
  const s = search.toLowerCase().trim();
  const t = target.toLowerCase().trim();
  
  if (s === t) return 1.0;
  if (t.includes(s) || s.includes(t)) return 0.85;
  
  const distance = levenshteinDistance(s, t);
  const maxLen = Math.max(s.length, t.length);
  const similarity = 1 - (distance / maxLen);
  
  const soundexMatch = soundex(s) === soundex(t);
  if (soundexMatch && similarity > 0.6) {
    return 0.70 + (similarity * 0.25);
  }
  
  return similarity;
}

function normalizeVendorName(name: string): string {
  return name
    .replace(/\b(inc|llc|co|corp|ltd|company|incorporated|corporation)\b\.?/gi, '')
    .replace(/[.,'"]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeInvoiceNumber(num: string): string {
  return num.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64, mimeType, rawText } = await req.json();

    if (!imageBase64) {
      return new Response(
        JSON.stringify({ error: "No image data provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const actualMimeType = mimeType || "image/png";
    if (!SUPPORTED_MIME_TYPES.includes(actualMimeType)) {
      return new Response(
        JSON.stringify({ 
          error: `Unsupported file type: ${actualMimeType}. Please upload a PDF or image (JPEG, PNG, GIF, or WebP).` 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Anthropic API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Anthropic client
    const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Fetch context data for matching
    const [
      { data: jobs },
      { data: vendors },
      { data: vendorAliases },
      { data: learnedMappings },
      { data: purchaseOrders },
      { data: costCodes },
      { data: tradeMappings }
    ] = await Promise.all([
      supabase.from('jobs').select('id, name, address, client').eq('status', 'active'),
      supabase.from('vendors').select('id, name, trade_type, email, phone'),
      supabase.from('vendor_aliases').select('vendor_id, alias_name'),
      supabase.from('ai_learned_mappings').select('*'),
      supabase.from('purchase_orders').select('id, po_number, vendor_id, job_id, total_amount, invoiced_amount, status').eq('status', 'approved'),
      supabase.from('cost_codes').select('id, code, name, category').eq('is_active', true),
      supabase.from('trade_cost_mappings').select('trade_type, cost_code_id')
    ]);

    // Build the enhanced extraction prompt
    const systemPrompt = `You are an expert invoice data extraction system for a construction company called "Ross Built Custom Homes".

CRITICAL IDENTIFICATION RULES:
1. Ross Built Custom Homes is ALWAYS the contractor being billed - NEVER the vendor
2. The VENDOR is the company SENDING the invoice (look for letterhead, logo, "From:", "Remit To:")
3. "Bill To:" typically shows Ross Built or client name - this is NOT the vendor
4. The vendor's address is usually at the TOP of the invoice, NOT the "Bill To" or "Ship To" address

JOB/PROJECT IDENTIFICATION - Check these locations (in order of reliability):
1. "P.O.#" or "PO#" or "Purchase Order" field - often contains job name or client name
2. "Subject:", "Re:", "Job:", "Project:", "Site:", "Location:" fields
3. "Ship To" or "Deliver To" address = this is the JOB SITE address
4. Any street address that ISN'T the vendor's address
5. Client/homeowner last name (e.g., "Drummond", "Crews", "Smith")

INVOICE TYPE DETECTION:
- Look for "Credit Memo", "Credit", "Refund", "Return", "Adjustment" = credit_memo
- NEGATIVE total amounts = credit_memo  
- "Debit Memo" = debit_memo
- Otherwise = standard

TRADE TYPE - Identify what trade/category this vendor is based on invoice content:
Valid trade types: ${TRADE_TYPES.join(', ')}

Extract the following and return ONLY valid JSON:

{
  "vendor": {
    "companyName": "Company sending the invoice (from letterhead/logo)",
    "tradeType": "One of the valid trade types or 'other'",
    "address": "Vendor's business address",
    "phone": "Vendor phone number",
    "email": "Vendor email"
  },
  "invoiceNumber": "Invoice number/ID",
  "invoiceDate": "YYYY-MM-DD format",
  "dueDate": "YYYY-MM-DD format or null",
  "invoiceType": "standard, credit_memo, or debit_memo",
  "job": {
    "reference": "Any job identifier, PO reference, or project name found",
    "address": "Job site address (NOT vendor address)",
    "clientName": "Homeowner/client last name if found",
    "poNumber": "Purchase order number if referenced"
  },
  "amounts": {
    "subtotal": number or null,
    "taxAmount": number or null,
    "totalAmount": number (the final total)
  },
  "lineItems": [
    {
      "description": "Item description",
      "quantity": number or 1,
      "unit": "EA, LF, SF, LS, HR, etc.",
      "unitPrice": number,
      "amount": number
    }
  ],
  "extractionConfidence": {
    "vendor": 0.0-1.0,
    "amount": 0.0-1.0,
    "invoiceNumber": 0.0-1.0,
    "date": 0.0-1.0,
    "job": 0.0-1.0
  }
}

For confidence scores:
- 1.0 = Clearly visible and unambiguous
- 0.7-0.9 = Visible but slightly unclear
- 0.4-0.6 = Partially visible or inferred
- 0.1-0.3 = Guessed based on context
- 0 = Not found`;

    // Call Claude API for extraction
    let content: string;
    try {
      // Build the content array based on mime type
      const documentContent = actualMimeType === "application/pdf"
        ? {
            type: "document" as const,
            source: {
              type: "base64" as const,
              media_type: "application/pdf" as const,
              data: imageBase64,
            },
          }
        : {
            type: "image" as const,
            source: {
              type: "base64" as const,
              media_type: actualMimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
              data: imageBase64,
            },
          };

      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: [
              documentContent,
              {
                type: "text",
                text: "Extract invoice data according to the system instructions. Return ONLY valid JSON, no markdown code blocks.",
              },
            ],
          },
        ],
      });

      // Extract text content from Claude response
      const textBlock = response.content.find(block => block.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        return new Response(
          JSON.stringify({ error: "No text response from AI" }),
          { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      content = textBlock.text;
    } catch (error) {
      console.error("Claude API error:", error);

      // Handle Anthropic API errors
      if (error instanceof Error) {
        const errorMessage = error.message.toLowerCase();
        if (errorMessage.includes("rate limit") || errorMessage.includes("429")) {
          return new Response(
            JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        if (errorMessage.includes("authentication") || errorMessage.includes("401")) {
          return new Response(
            JSON.stringify({ error: "Invalid API key configuration." }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      return new Response(
        JSON.stringify({ error: "Failed to process invoice with AI" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse AI response
    let extracted: ExtractedInvoiceData;
    try {
      // Handle markdown code blocks that Claude sometimes returns
      let jsonStr = content.trim();
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```$/g, '').trim();
      }

      // Extract JSON object from response
      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found in response");
      extracted = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      return new Response(
        JSON.stringify({ error: "Could not parse invoice data from AI response" }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === VENDOR MATCHING ===
    let matchedVendor: MatchedVendor | null = null;
    const vendorName = extracted.vendor?.companyName;
    const normalizedVendorName = vendorName ? normalizeVendorName(vendorName) : '';
    
    if (vendorName) {
      // 1. Check learned mappings first
      const learnedVendor = (learnedMappings || []).find(
        m => m.entity_type === 'vendor' && 
        m.extracted_value.toLowerCase() === vendorName.toLowerCase()
      );
      if (learnedVendor) {
        const vendor = (vendors || []).find(v => v.id === learnedVendor.matched_id);
        if (vendor) {
          matchedVendor = {
            id: vendor.id,
            name: vendor.name,
            confidence: learnedVendor.confidence,
            matchType: 'learned'
          };
        }
      }

      // 2. Check vendor aliases
      if (!matchedVendor) {
        const alias = (vendorAliases || []).find(
          a => a.alias_name.toLowerCase() === vendorName.toLowerCase() ||
               a.alias_name.toLowerCase() === normalizedVendorName.toLowerCase()
        );
        if (alias) {
          const vendor = (vendors || []).find(v => v.id === alias.vendor_id);
          if (vendor) {
            matchedVendor = {
              id: vendor.id,
              name: vendor.name,
              confidence: 0.95,
              matchType: 'alias'
            };
          }
        }
      }

      // 3. Exact match
      if (!matchedVendor) {
        const exactMatch = (vendors || []).find(
          v => v.name.toLowerCase() === vendorName.toLowerCase() ||
               normalizeVendorName(v.name).toLowerCase() === normalizedVendorName.toLowerCase()
        );
        if (exactMatch) {
          matchedVendor = {
            id: exactMatch.id,
            name: exactMatch.name,
            confidence: 0.98,
            matchType: 'exact'
          };
        }
      }

      // 4. Fuzzy match
      if (!matchedVendor && vendors) {
        let bestMatch: { vendor: typeof vendors[0]; score: number } | null = null;
        for (const vendor of vendors) {
          const score = fuzzyMatchScore(normalizedVendorName, normalizeVendorName(vendor.name));
          if (score > 0.65 && (!bestMatch || score > bestMatch.score)) {
            bestMatch = { vendor, score };
          }
        }
        if (bestMatch) {
          matchedVendor = {
            id: bestMatch.vendor.id,
            name: bestMatch.vendor.name,
            confidence: bestMatch.score,
            matchType: 'fuzzy'
          };
        }
      }
    }

    // Build vendor suggestions (top 5 matches)
    const vendorSuggestions = (vendors || [])
      .map(v => ({
        id: v.id,
        name: v.name,
        score: vendorName ? fuzzyMatchScore(normalizedVendorName, normalizeVendorName(v.name)) : 0
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    // === JOB MATCHING ===
    let matchedJob: MatchedJob | null = null;
    const jobRef = extracted.job?.reference;
    const jobAddress = extracted.job?.address;
    const clientName = extracted.job?.clientName;
    const poNumber = extracted.job?.poNumber;

    if (jobs && jobs.length > 0) {
      // 1. Check learned mappings
      const searchTerms = [jobRef, jobAddress, clientName, poNumber].filter(Boolean);
      for (const term of searchTerms) {
        const learnedJob = (learnedMappings || []).find(
          m => m.entity_type === 'job' && 
          m.extracted_value.toLowerCase() === term!.toLowerCase()
        );
        if (learnedJob) {
          const job = jobs.find(j => j.id === learnedJob.matched_id);
          if (job) {
            matchedJob = {
              id: job.id,
              name: job.name,
              address: job.address,
              confidence: learnedJob.confidence,
              matchType: 'learned'
            };
            break;
          }
        }
      }

      // 2. Match by PO number
      if (!matchedJob && poNumber && purchaseOrders) {
        const po = purchaseOrders.find(p => 
          p.po_number.toLowerCase().includes(poNumber.toLowerCase()) ||
          poNumber.toLowerCase().includes(p.po_number.toLowerCase())
        );
        if (po) {
          const job = jobs.find(j => j.id === po.job_id);
          if (job) {
            matchedJob = {
              id: job.id,
              name: job.name,
              address: job.address,
              confidence: 0.92,
              matchType: 'po'
            };
          }
        }
      }

      // 3. Match by client name in job name
      if (!matchedJob && clientName) {
        const clientLower = clientName.toLowerCase();
        for (const job of jobs) {
          const jobNameLower = job.name.toLowerCase();
          const jobClient = job.client?.toLowerCase() || '';
          if (jobNameLower.includes(clientLower) || jobClient.includes(clientLower)) {
            matchedJob = {
              id: job.id,
              name: job.name,
              address: job.address,
              confidence: 0.88,
              matchType: 'client_name'
            };
            break;
          }
        }
      }

      // 4. Match by address
      if (!matchedJob && jobAddress) {
        const addressLower = jobAddress.toLowerCase();
        // Extract street number
        const streetNum = jobAddress.match(/\d+/)?.[0];
        
        for (const job of jobs) {
          if (!job.address) continue;
          const jobAddrLower = job.address.toLowerCase();
          
          // Exact or near-exact address match
          if (jobAddrLower.includes(addressLower) || addressLower.includes(jobAddrLower)) {
            matchedJob = {
              id: job.id,
              name: job.name,
              address: job.address,
              confidence: 0.90,
              matchType: 'address'
            };
            break;
          }
          
          // Street number match with fuzzy street name
          if (streetNum && job.address.includes(streetNum)) {
            const score = fuzzyMatchScore(addressLower, jobAddrLower);
            if (score > 0.6) {
              matchedJob = {
                id: job.id,
                name: job.name,
                address: job.address,
                confidence: 0.75 + (score * 0.15),
                matchType: 'address'
              };
              break;
            }
          }
        }
      }

      // 5. Fuzzy match on job reference
      if (!matchedJob && jobRef) {
        let bestMatch: { job: typeof jobs[0]; score: number } | null = null;
        for (const job of jobs) {
          const nameScore = fuzzyMatchScore(jobRef.toLowerCase(), job.name.toLowerCase());
          const addrScore = job.address ? fuzzyMatchScore(jobRef.toLowerCase(), job.address.toLowerCase()) : 0;
          const score = Math.max(nameScore, addrScore);
          
          if (score > 0.60 && (!bestMatch || score > bestMatch.score)) {
            bestMatch = { job, score };
          }
        }
        if (bestMatch) {
          matchedJob = {
            id: bestMatch.job.id,
            name: bestMatch.job.name,
            address: bestMatch.job.address,
            confidence: bestMatch.score,
            matchType: 'fuzzy'
          };
        }
      }
    }

    // Build job suggestions
    const combinedSearchTerm = [jobRef, jobAddress, clientName, poNumber].filter(Boolean).join(' ').toLowerCase();
    const jobSuggestions = (jobs || [])
      .map(j => {
        const nameScore = combinedSearchTerm ? fuzzyMatchScore(combinedSearchTerm, j.name.toLowerCase()) : 0;
        const addrScore = j.address && combinedSearchTerm ? fuzzyMatchScore(combinedSearchTerm, j.address.toLowerCase()) : 0;
        return {
          id: j.id,
          name: j.name,
          address: j.address,
          score: Math.max(nameScore, addrScore)
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    // === PO MATCHING ===
    let matchedPO: MatchedPO | null = null;
    
    if (purchaseOrders && matchedVendor && matchedJob) {
      // Find POs for this vendor and job
      const candidatePOs = purchaseOrders.filter(
        po => po.vendor_id === matchedVendor!.id && po.job_id === matchedJob!.id
      );
      
      if (candidatePOs.length === 1) {
        const po = candidatePOs[0];
        matchedPO = {
          id: po.id,
          po_number: po.po_number,
          vendor_id: po.vendor_id,
          total_amount: po.total_amount,
          invoiced_amount: po.invoiced_amount || 0,
          confidence: 0.85
        };
      } else if (candidatePOs.length > 1 && poNumber) {
        // Multiple POs - try to match by PO number
        const exactPO = candidatePOs.find(po => 
          po.po_number.toLowerCase() === poNumber.toLowerCase()
        );
        if (exactPO) {
          matchedPO = {
            id: exactPO.id,
            po_number: exactPO.po_number,
            vendor_id: exactPO.vendor_id,
            total_amount: exactPO.total_amount,
            invoiced_amount: exactPO.invoiced_amount || 0,
            confidence: 0.92
          };
        }
      }
    }

    // PO suggestions
    const poSuggestions = (purchaseOrders || [])
      .filter(po => {
        if (matchedVendor && po.vendor_id !== matchedVendor.id) return false;
        if (matchedJob && po.job_id !== matchedJob.id) return false;
        return true;
      })
      .slice(0, 5)
      .map(po => ({
        id: po.id,
        po_number: po.po_number,
        total_amount: po.total_amount,
        remaining: po.total_amount - (po.invoiced_amount || 0)
      }));

    // === COST CODE SUGGESTIONS ===
    const costCodeSuggestions: CostCodeSuggestion[] = [];
    const totalAmount = extracted.amounts?.totalAmount || 0;
    const tradeType = extracted.vendor?.tradeType?.toLowerCase();

    if (costCodes && costCodes.length > 0) {
      // 1. Use trade type mapping
      if (tradeType && tradeMappings) {
        const mapping = tradeMappings.find(m => m.trade_type === tradeType);
        if (mapping) {
          const cc = costCodes.find(c => c.id === mapping.cost_code_id);
          if (cc) {
            costCodeSuggestions.push({
              id: cc.id,
              code: cc.code,
              name: cc.name,
              amount: totalAmount,
              confidence: 0.80,
              reason: `Based on vendor trade type: ${tradeType}`
            });
          }
        }
      }

      // 2. Match by line item descriptions
      const lineItems = extracted.lineItems || [];
      for (const item of lineItems) {
        const desc = item.description.toLowerCase();
        
        // Check common keywords
        const keywordMap: Record<string, string[]> = {
          'electrical': ['26'],
          'wiring': ['26'],
          'panel': ['26'],
          'plumbing': ['22'],
          'pipe': ['22'],
          'fixture': ['22'],
          'hvac': ['23'],
          'duct': ['23'],
          'framing': ['06'],
          'lumber': ['06'],
          'carpentry': ['06'],
          'drywall': ['09'],
          'sheetrock': ['09'],
          'paint': ['09'],
          'roofing': ['07'],
          'shingle': ['07'],
          'insulation': ['07'],
          'window': ['08'],
          'door': ['08'],
          'flooring': ['09'],
          'tile': ['09'],
          'cabinet': ['12'],
          'countertop': ['12'],
          'appliance': ['11'],
          'concrete': ['03'],
          'foundation': ['03'],
          'landscap': ['02'],
          'excavat': ['02'],
          'grad': ['02']
        };

        for (const [keyword, prefixes] of Object.entries(keywordMap)) {
          if (desc.includes(keyword)) {
            for (const prefix of prefixes) {
              const cc = costCodes.find(c => c.code.startsWith(prefix));
              if (cc && !costCodeSuggestions.find(s => s.id === cc.id)) {
                costCodeSuggestions.push({
                  id: cc.id,
                  code: cc.code,
                  name: cc.name,
                  amount: item.amount || totalAmount,
                  confidence: 0.70,
                  reason: `Line item contains "${keyword}"`
                });
              }
            }
          }
        }
      }
    }

    // === DUPLICATE CHECK ===
    let possibleDuplicate: { id: string; invoice_number: string; amount: number } | null = null;
    
    if (extracted.invoiceNumber && matchedVendor) {
      const normalizedNum = normalizeInvoiceNumber(extracted.invoiceNumber);
      
      const { data: existingInvoices } = await supabase
        .from('invoices')
        .select('id, invoice_number, amount, vendor_id')
        .eq('vendor_id', matchedVendor.id);
      
      if (existingInvoices) {
        const duplicate = existingInvoices.find(inv => 
          normalizeInvoiceNumber(inv.invoice_number) === normalizedNum
        );
        if (duplicate) {
          possibleDuplicate = {
            id: duplicate.id,
            invoice_number: duplicate.invoice_number,
            amount: duplicate.amount
          };
        }
      }
    }

    // === BUILD REVIEW FLAGS ===
    const reviewFlags: string[] = [];
    
    if (!matchedJob) {
      if (jobRef || jobAddress || clientName) {
        reviewFlags.push('verify_job');
      } else {
        reviewFlags.push('no_job_match');
      }
    } else if (matchedJob.confidence < 0.80) {
      reviewFlags.push('verify_job');
    }

    if (!matchedVendor) {
      reviewFlags.push('select_vendor');
    } else if (matchedVendor.confidence < 0.80) {
      reviewFlags.push('verify_vendor');
    }

    if ((extracted.extractionConfidence?.amount || 0) < 0.70) {
      reviewFlags.push('verify_amount');
    }

    if ((extracted.extractionConfidence?.date || 0) < 0.70) {
      reviewFlags.push('verify_date');
    }

    if (possibleDuplicate) {
      reviewFlags.push('possible_duplicate');
    }

    // Calculate overall confidence
    const confidenceValues = [
      extracted.extractionConfidence?.vendor || 0,
      extracted.extractionConfidence?.amount || 0,
      extracted.extractionConfidence?.invoiceNumber || 0,
      extracted.extractionConfidence?.date || 0,
      extracted.extractionConfidence?.job || 0,
      matchedVendor?.confidence || 0,
      matchedJob?.confidence || 0
    ];
    const overallConfidence = confidenceValues.reduce((a, b) => a + b, 0) / confidenceValues.length;

    // === BUILD RESPONSE ===
    const result = {
      success: true,
      
      // Raw extracted data for form population
      data: {
        invoice_number: extracted.invoiceNumber,
        vendor_name: extracted.vendor?.companyName,
        amount: extracted.amounts?.totalAmount,
        invoice_date: extracted.invoiceDate,
        due_date: extracted.dueDate,
        line_items: extracted.lineItems,
        invoice_type: extracted.invoiceType,
        confidence: extracted.extractionConfidence
      },

      // Full extracted structure
      extracted,
      
      // Matched entities
      matchedVendor,
      matchedJob,
      matchedPO,
      
      // Suggestions for user selection
      suggestions: {
        vendors: vendorSuggestions,
        jobs: jobSuggestions,
        purchaseOrders: poSuggestions,
        costCodes: costCodeSuggestions.slice(0, 5)
      },
      
      // Duplicate warning
      possibleDuplicate,
      
      // Review requirements
      needsReview: reviewFlags.length > 0,
      reviewFlags,
      
      // Overall confidence
      overallConfidence,
      
      // Processing messages for UI
      messages: [
        "Extracted invoice data with AI",
        matchedVendor ? `Matched vendor: ${matchedVendor.name} (${Math.round(matchedVendor.confidence * 100)}%)` : "No vendor match found",
        matchedJob ? `Matched job: ${matchedJob.name} (${Math.round(matchedJob.confidence * 100)}%)` : "No job match found",
        matchedPO ? `Matched PO: ${matchedPO.po_number}` : null,
        possibleDuplicate ? `⚠️ Possible duplicate of invoice ${possibleDuplicate.invoice_number}` : null
      ].filter(Boolean)
    };

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Extract invoice error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
/**
 * Document Intelligence Service
 *
 * Phase 6 Document Management features:
 * - PDF text extraction using pdf-parse
 * - Auto-categorization using AI/rule-based
 * - Expiration date detection
 * - Alert scheduling
 * - Full-text search support
 */

const pdfParse = require('pdf-parse');
const Anthropic = require('@anthropic-ai/sdk');
const { supabase } = require('../../config');
const logger = require('../utils/logger').child({ module: 'document-intelligence' });

// Initialize Anthropic client
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Document category mappings for auto-detection
const CATEGORY_PATTERNS = {
  insurance: {
    keywords: ['certificate of insurance', 'coi', 'policy number', 'effective date', 'expiration date', 'coverage', 'insured', 'carrier', 'general liability', 'workers compensation', 'umbrella', 'auto liability'],
    expirationPatterns: [/expir(?:es?|ation)\s*(?:date)?[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i, /valid\s+(?:through|until)[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i]
  },
  license: {
    keywords: ['license', 'licensed', 'registration', 'state of', 'contractor', 'certification', 'certified'],
    expirationPatterns: [/expir(?:es?|ation)\s*(?:date)?[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i, /valid\s+(?:through|until)[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i]
  },
  permit: {
    keywords: ['permit', 'building permit', 'permit number', 'inspection', 'approved', 'department', 'zoning'],
    expirationPatterns: [/expir(?:es?|ation)\s*(?:date)?[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i, /permit\s+expires[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i]
  },
  warranty: {
    keywords: ['warranty', 'guarantee', 'warranted', 'coverage period', 'manufacturer', 'limited warranty', 'workmanship'],
    expirationPatterns: [/warranty\s+(?:expires?|ends?)[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i, /coverage\s+(?:through|until)[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i]
  },
  contract: {
    keywords: ['contract', 'agreement', 'scope of work', 'terms and conditions', 'party', 'contractor', 'owner', 'executed'],
    expirationPatterns: [/term\s+(?:ends?|expires?)[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i, /contract\s+(?:ends?|expires?)[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i]
  },
  certification: {
    keywords: ['certification', 'certified', 'certificate', 'training', 'completed', 'issued to', 'certification number'],
    expirationPatterns: [/expir(?:es?|ation)\s*(?:date)?[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i, /valid\s+(?:through|until)[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i]
  },
  bond: {
    keywords: ['bond', 'surety', 'bonded', 'performance bond', 'payment bond', 'bid bond', 'principal', 'obligee'],
    expirationPatterns: [/bond\s+(?:expires?|ends?)[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i, /effective\s+(?:through|until)[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i]
  }
};

/**
 * Extract text from a PDF file
 * @param {string} pdfUrl - URL to the PDF file
 * @returns {Promise<{text: string, pageCount: number, info: Object}>}
 */
async function extractTextFromPDF(pdfUrl) {
  try {
    logger.info('Extracting text from PDF', { url: pdfUrl });

    // Fetch the PDF
    const response = await fetch(pdfUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch PDF: ${response.status} ${response.statusText}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    logger.debug('PDF fetched', { sizeKB: Math.round(buffer.length / 1024) });

    // Parse the PDF
    const data = await pdfParse(buffer);

    const result = {
      text: data.text || '',
      pageCount: data.numpages || 1,
      info: data.info || {},
      wordCount: data.text ? data.text.split(/\s+/).filter(w => w.length > 0).length : 0
    };

    logger.info('Text extraction complete', {
      pageCount: result.pageCount,
      wordCount: result.wordCount
    });

    return result;
  } catch (err) {
    logger.error('PDF text extraction failed', { error: err.message, url: pdfUrl });
    throw err;
  }
}

/**
 * Categorize a document based on its text content and filename
 * Uses rule-based detection with optional AI fallback
 * @param {string} text - Extracted text from document
 * @param {string} filename - Original filename
 * @returns {Promise<{category: string, confidence: number, suggestedTags: string[]}>}
 */
async function categorizeDocument(text, filename) {
  try {
    logger.info('Categorizing document', { filename });

    const textLower = text.toLowerCase();
    const filenameLower = filename.toLowerCase();
    const combinedText = `${filenameLower} ${textLower}`;

    // Score each category based on keyword matches
    const scores = {};
    const suggestedTags = new Set();

    for (const [category, config] of Object.entries(CATEGORY_PATTERNS)) {
      let score = 0;

      for (const keyword of config.keywords) {
        const regex = new RegExp(`\\b${keyword.replace(/\s+/g, '\\s+')}\\b`, 'gi');
        const matches = combinedText.match(regex);
        if (matches) {
          score += matches.length;
          // Add as suggested tag if significant match
          if (matches.length >= 1) {
            suggestedTags.add(keyword);
          }
        }
      }

      // Boost score if filename contains category name
      if (filenameLower.includes(category)) {
        score += 5;
      }

      scores[category] = score;
    }

    // Find the best match
    let bestCategory = 'other';
    let bestScore = 0;

    for (const [category, score] of Object.entries(scores)) {
      if (score > bestScore) {
        bestScore = score;
        bestCategory = category;
      }
    }

    // Calculate confidence based on score
    const maxPossibleScore = 20; // Rough estimate
    const confidence = Math.min(0.95, Math.max(0.3, bestScore / maxPossibleScore));

    // If confidence is too low, try AI categorization
    if (confidence < 0.5 && process.env.ANTHROPIC_API_KEY) {
      try {
        const aiResult = await categorizeWithAI(text, filename);
        if (aiResult.confidence > confidence) {
          return aiResult;
        }
      } catch (aiErr) {
        logger.warn('AI categorization fallback failed', { error: aiErr.message });
      }
    }

    logger.info('Document categorized', {
      category: bestCategory,
      confidence,
      score: bestScore
    });

    return {
      category: bestCategory,
      confidence,
      suggestedTags: Array.from(suggestedTags).slice(0, 10)
    };
  } catch (err) {
    logger.error('Categorization failed', { error: err.message });
    return { category: 'other', confidence: 0.3, suggestedTags: [] };
  }
}

/**
 * Use AI to categorize a document when rule-based approach has low confidence
 */
async function categorizeWithAI(text, filename) {
  const prompt = `Analyze this document and categorize it. Document filename: "${filename}"

Document text (first 3000 characters):
${text.substring(0, 3000)}

Categorize this document into ONE of these types:
- insurance (COIs, insurance certificates, policies)
- license (contractor licenses, registrations)
- permit (building permits, zoning approvals)
- warranty (product/work warranties, guarantees)
- contract (agreements, subcontracts, scope of work)
- certification (training certs, certifications)
- bond (surety bonds, performance bonds)
- other (if none of the above clearly apply)

Respond with JSON only:
{
  "category": "category_name",
  "confidence": 0.0-1.0,
  "suggestedTags": ["tag1", "tag2"],
  "reasoning": "brief explanation"
}`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 500,
    messages: [{ role: 'user', content: prompt }]
  });

  const responseText = response.content[0].text;
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);

  if (!jsonMatch) {
    throw new Error('No JSON in AI response');
  }

  const result = JSON.parse(jsonMatch[0]);

  return {
    category: result.category || 'other',
    confidence: result.confidence || 0.5,
    suggestedTags: result.suggestedTags || []
  };
}

/**
 * Detect expiration date from document text
 * @param {string} text - Document text
 * @param {string} category - Document category (helps refine detection)
 * @returns {{date: Date|null, type: string|null, confidence: number}}
 */
function detectExpirationDate(text, category = null) {
  try {
    logger.debug('Detecting expiration date', { category });

    const candidates = [];

    // Get patterns for the specific category or use all
    const patterns = category && CATEGORY_PATTERNS[category]
      ? CATEGORY_PATTERNS[category].expirationPatterns
      : Object.values(CATEGORY_PATTERNS).flatMap(c => c.expirationPatterns);

    // Add generic expiration patterns
    const genericPatterns = [
      /expir(?:es?|ation|y)\s*(?:date)?[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/gi,
      /valid\s+(?:through|thru|until|to)[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/gi,
      /(?:ends?|termination)\s*(?:date)?[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/gi,
      /(?:effective|coverage)\s+(?:through|until|to)[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/gi,
      /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\s*(?:\(exp(?:ires?|iration)?\)|\bexp\b)/gi
    ];

    const allPatterns = [...new Set([...patterns, ...genericPatterns])];

    for (const pattern of allPatterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        const dateStr = match[1];
        const date = parseDate(dateStr);

        if (date && date > new Date()) {
          // Only consider future dates as expiration dates
          candidates.push({
            date,
            context: match[0],
            confidence: 0.8
          });
        }
      }
    }

    if (candidates.length === 0) {
      return { date: null, type: category, confidence: 0 };
    }

    // Sort by date (prefer earliest expiration in the future)
    candidates.sort((a, b) => a.date - b.date);

    const best = candidates[0];

    logger.info('Expiration date detected', {
      date: best.date.toISOString().split('T')[0],
      confidence: best.confidence
    });

    return {
      date: best.date,
      type: category,
      confidence: best.confidence
    };
  } catch (err) {
    logger.error('Expiration detection failed', { error: err.message });
    return { date: null, type: category, confidence: 0 };
  }
}

/**
 * Parse various date formats
 */
function parseDate(dateStr) {
  // Try common formats: MM/DD/YYYY, MM-DD-YYYY, DD/MM/YYYY (less common in US)
  const formats = [
    /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/,  // MM/DD/YYYY or MM-DD-YYYY
    /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})$/   // MM/DD/YY or MM-DD-YY
  ];

  for (const format of formats) {
    const match = dateStr.match(format);
    if (match) {
      let [, month, day, year] = match;
      year = parseInt(year);

      // Convert 2-digit year
      if (year < 100) {
        year += year > 50 ? 1900 : 2000;
      }

      month = parseInt(month);
      day = parseInt(day);

      // Basic validation
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        return new Date(year, month - 1, day);
      }
    }
  }

  // Try native Date parsing as fallback
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) {
    return parsed;
  }

  return null;
}

/**
 * Schedule expiration alerts for a document
 * @param {string} documentId - Document UUID
 * @param {Date} expirationDate - Expiration date
 * @param {number[]} alertDaysBefore - Array of days before expiration to alert
 */
async function scheduleExpirationAlerts(documentId, expirationDate, alertDaysBefore = [30, 14, 7]) {
  try {
    logger.info('Scheduling expiration alerts', {
      documentId,
      expirationDate,
      alertDays: alertDaysBefore
    });

    // Get document details for alert messages
    const { data: doc, error: docError } = await supabase
      .from('v2_documents')
      .select('title, file_name')
      .eq('id', documentId)
      .single();

    if (docError) {
      throw new Error(`Document not found: ${docError.message}`);
    }

    const docName = doc.title || doc.file_name || 'Document';
    const expDate = new Date(expirationDate);
    const today = new Date();

    const alerts = [];

    for (const daysBefore of alertDaysBefore) {
      const alertDate = new Date(expDate);
      alertDate.setDate(alertDate.getDate() - daysBefore);

      // Only create future alerts
      if (alertDate >= today) {
        const daysUntil = Math.ceil((expDate - alertDate) / (1000 * 60 * 60 * 24));

        alerts.push({
          document_id: documentId,
          alert_type: 'expiring_soon',
          alert_date: alertDate.toISOString().split('T')[0],
          days_until_expiry: daysUntil,
          title: `${docName} expires in ${daysUntil} days`,
          message: `Document "${docName}" will expire on ${expDate.toLocaleDateString()}`,
          severity: daysUntil <= 7 ? 'critical' : daysUntil <= 14 ? 'high' : 'medium'
        });
      }
    }

    // Already expired?
    if (expDate < today) {
      alerts.push({
        document_id: documentId,
        alert_type: 'expired',
        alert_date: today.toISOString().split('T')[0],
        days_until_expiry: Math.ceil((expDate - today) / (1000 * 60 * 60 * 24)),
        title: `${docName} has expired`,
        message: `Document "${docName}" expired on ${expDate.toLocaleDateString()}`,
        severity: 'critical'
      });
    }

    if (alerts.length > 0) {
      const { error: insertError } = await supabase
        .from('v2_document_alerts')
        .upsert(alerts, {
          onConflict: 'document_id,alert_type,alert_date',
          ignoreDuplicates: true
        });

      if (insertError) {
        logger.warn('Some alerts may already exist', { error: insertError.message });
      }
    }

    logger.info('Alerts scheduled', { count: alerts.length });
    return { scheduled: alerts.length };
  } catch (err) {
    logger.error('Failed to schedule alerts', { error: err.message, documentId });
    throw err;
  }
}

/**
 * Process a document: extract text, categorize, detect expiration
 * @param {string} documentId - Document UUID
 * @returns {Promise<Object>} Processing results
 */
async function processDocumentIntelligence(documentId) {
  try {
    logger.info('Processing document intelligence', { documentId });

    // Get document details
    const { data: doc, error: docError } = await supabase
      .from('v2_documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (docError || !doc) {
      throw new Error('Document not found');
    }

    // Skip non-PDF files (can be extended for other formats)
    if (doc.mime_type && !doc.mime_type.includes('pdf')) {
      logger.info('Skipping non-PDF document', { mimeType: doc.mime_type });
      return { skipped: true, reason: 'Not a PDF document' };
    }

    // Extract text from PDF
    let extraction;
    try {
      extraction = await extractTextFromPDF(doc.file_url);
    } catch (extractErr) {
      // Log extraction failure as an alert
      await supabase.from('v2_document_alerts').insert({
        document_id: documentId,
        alert_type: 'extraction_failed',
        alert_date: new Date().toISOString().split('T')[0],
        title: 'Text extraction failed',
        message: extractErr.message,
        severity: 'low'
      }).onConflict('document_id,alert_type,alert_date').ignore();

      throw extractErr;
    }

    // Categorize document
    const categorization = await categorizeDocument(
      extraction.text,
      doc.file_name || doc.title
    );

    // Detect expiration date
    const expirationResult = detectExpirationDate(
      extraction.text,
      categorization.category
    );

    // Store metadata
    const metadata = {
      document_id: documentId,
      extracted_text: extraction.text,
      extracted_at: new Date().toISOString(),
      extraction_method: 'pdf-parse',
      page_count: extraction.pageCount,
      word_count: extraction.wordCount,
      ai_category: categorization.category,
      ai_category_confidence: categorization.confidence,
      ai_suggested_tags: categorization.suggestedTags,
      expiration_date: expirationResult.date ? expirationResult.date.toISOString().split('T')[0] : null,
      expiration_type: expirationResult.type,
      last_extracted_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { error: metaError } = await supabase
      .from('v2_document_metadata')
      .upsert(metadata, { onConflict: 'document_id' });

    if (metaError) {
      throw new Error(`Failed to save metadata: ${metaError.message}`);
    }

    // Update document status
    await supabase
      .from('v2_documents')
      .update({
        status: 'processed',
        ai_extracted_data: {
          pageCount: extraction.pageCount,
          wordCount: extraction.wordCount,
          category: categorization.category,
          expirationDate: expirationResult.date
        },
        updated_at: new Date().toISOString()
      })
      .eq('id', documentId);

    // Schedule expiration alerts if date found
    if (expirationResult.date) {
      await scheduleExpirationAlerts(documentId, expirationResult.date);
    }

    logger.info('Document intelligence processing complete', {
      documentId,
      category: categorization.category,
      hasExpiration: !!expirationResult.date
    });

    return {
      success: true,
      documentId,
      extraction: {
        pageCount: extraction.pageCount,
        wordCount: extraction.wordCount
      },
      categorization,
      expiration: expirationResult
    };
  } catch (err) {
    logger.error('Document intelligence processing failed', {
      error: err.message,
      documentId
    });

    // Update document status to failed
    await supabase
      .from('v2_documents')
      .update({
        status: 'failed',
        processing_error: err.message,
        updated_at: new Date().toISOString()
      })
      .eq('id', documentId);

    throw err;
  }
}

/**
 * Search documents by content
 * @param {string} query - Search query
 * @param {Object} filters - Optional filters
 * @returns {Promise<Array>} Search results
 */
async function searchDocuments(query, filters = {}) {
  try {
    logger.info('Searching documents', { query, filters });

    const { data, error } = await supabase.rpc('search_document_content', {
      p_query: query,
      p_job_id: filters.jobId || null,
      p_category: filters.category || null,
      p_expiration_type: filters.expirationType || null,
      p_limit: filters.limit || 50
    });

    if (error) {
      throw new Error(`Search failed: ${error.message}`);
    }

    return data || [];
  } catch (err) {
    logger.error('Document search failed', { error: err.message });
    throw err;
  }
}

/**
 * Get documents expiring within specified days
 * @param {number} days - Days until expiration
 * @param {Object} filters - Optional filters
 * @returns {Promise<Array>} Expiring documents
 */
async function getExpiringDocuments(days = 30, filters = {}) {
  try {
    logger.info('Getting expiring documents', { days, filters });

    const { data, error } = await supabase.rpc('get_expiring_documents', {
      p_days: days,
      p_job_id: filters.jobId || null,
      p_expiration_type: filters.expirationType || null
    });

    if (error) {
      throw new Error(`Query failed: ${error.message}`);
    }

    return data || [];
  } catch (err) {
    logger.error('Get expiring documents failed', { error: err.message });
    throw err;
  }
}

/**
 * Get active alerts
 * @param {Object} filters - Optional filters
 * @returns {Promise<Array>} Active alerts
 */
async function getActiveAlerts(filters = {}) {
  try {
    let query = supabase
      .from('v2_document_alerts')
      .select(`
        *,
        document:v2_documents(
          id,
          title,
          file_url,
          job:v2_jobs(id, name),
          vendor:v2_vendors(id, name)
        )
      `)
      .eq('acknowledged', false)
      .eq('dismissed', false)
      .order('severity', { ascending: true }) // critical first
      .order('alert_date', { ascending: true });

    if (filters.documentId) {
      query = query.eq('document_id', filters.documentId);
    }

    if (filters.alertType) {
      query = query.eq('alert_type', filters.alertType);
    }

    if (filters.limit) {
      query = query.limit(filters.limit);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to get alerts: ${error.message}`);
    }

    return data || [];
  } catch (err) {
    logger.error('Get active alerts failed', { error: err.message });
    throw err;
  }
}

/**
 * Acknowledge an alert
 * @param {string} alertId - Alert UUID
 * @param {string} acknowledgedBy - User who acknowledged
 */
async function acknowledgeAlert(alertId, acknowledgedBy) {
  try {
    const { data, error } = await supabase
      .from('v2_document_alerts')
      .update({
        acknowledged: true,
        acknowledged_by: acknowledgedBy,
        acknowledged_at: new Date().toISOString()
      })
      .eq('id', alertId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to acknowledge alert: ${error.message}`);
    }

    logger.info('Alert acknowledged', { alertId, acknowledgedBy });
    return data;
  } catch (err) {
    logger.error('Acknowledge alert failed', { error: err.message, alertId });
    throw err;
  }
}

/**
 * Dismiss an alert (hide without acknowledging)
 * @param {string} alertId - Alert UUID
 */
async function dismissAlert(alertId) {
  try {
    const { data, error } = await supabase
      .from('v2_document_alerts')
      .update({
        dismissed: true,
        dismissed_at: new Date().toISOString()
      })
      .eq('id', alertId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to dismiss alert: ${error.message}`);
    }

    logger.info('Alert dismissed', { alertId });
    return data;
  } catch (err) {
    logger.error('Dismiss alert failed', { error: err.message, alertId });
    throw err;
  }
}

/**
 * Run daily alert generation for all documents
 */
async function generateDailyAlerts() {
  try {
    logger.info('Generating daily expiration alerts');

    const { data, error } = await supabase.rpc('generate_expiration_alerts');

    if (error) {
      throw new Error(`Alert generation failed: ${error.message}`);
    }

    logger.info('Daily alerts generated', { count: data });
    return { alertsGenerated: data };
  } catch (err) {
    logger.error('Daily alert generation failed', { error: err.message });
    throw err;
  }
}

module.exports = {
  extractTextFromPDF,
  categorizeDocument,
  detectExpirationDate,
  scheduleExpirationAlerts,
  processDocumentIntelligence,
  searchDocuments,
  getExpiringDocuments,
  getActiveAlerts,
  acknowledgeAlert,
  dismissAlert,
  generateDailyAlerts,
  CATEGORY_PATTERNS
};

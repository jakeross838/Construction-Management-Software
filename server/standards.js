/**
 * Ross Built CMS - Data Standards & Naming Conventions
 *
 * Standardized naming for documents, vendors, and data normalization.
 */

// ============================================================
// VALID VALUES
// ============================================================

const validValues = {
  tradeTypes: [
    'plumbing', 'electrical', 'hvac', 'framing', 'roofing', 'drywall',
    'painting', 'flooring', 'tile', 'concrete', 'masonry', 'landscaping',
    'pool', 'cabinets', 'countertops', 'windows_doors', 'insulation',
    'stucco', 'siding', 'gutters', 'screen_enclosures', 'appliances',
    'millwork', 'glass_glazing', 'aluminum', 'decking', 'garage_doors',
    'fireplace', 'demolition', 'excavation', 'foundation', 'structural',
    'general', 'other'
  ]
};

// ============================================================
// DOCUMENT TYPE PREFIXES
// ============================================================

const DOC_PREFIXES = {
  invoice: 'INV',
  pay_application: 'PAYAPP',
  proposal: 'PROP',
  change_order: 'CHG',
  purchase_order: 'PO',
  contract: 'CNTRCT',
  lien_release: 'LIEN',
  insurance: 'INSUR',
  warranty: 'WARR',
  inspection: 'INSP',
  permit: 'PERMIT',
  photo: 'PHOTO',
  plan: 'PLAN',
  other: 'DOC'
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ============================================================
// NORMALIZATION FUNCTIONS
// ============================================================

/**
 * Convert to Title Case
 */
function toTitleCase(str) {
  if (!str) return null;
  return str
    .toLowerCase()
    .split(' ')
    .map(word => {
      if (['llc', 'inc', 'corp', 'ltd'].includes(word.toLowerCase())) {
        return word.toUpperCase();
      }
      if (['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'].includes(word.toLowerCase())) {
        return word.toUpperCase();
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

/**
 * Normalize address with standard abbreviations
 */
function normalizeAddress(addr) {
  if (!addr) return null;

  const streetTypes = {
    'street': 'St', 'st': 'St', 'avenue': 'Ave', 'ave': 'Ave',
    'boulevard': 'Blvd', 'blvd': 'Blvd', 'drive': 'Dr', 'dr': 'Dr',
    'road': 'Rd', 'rd': 'Rd', 'lane': 'Ln', 'ln': 'Ln',
    'court': 'Ct', 'ct': 'Ct', 'circle': 'Cir', 'way': 'Way'
  };

  let normalized = toTitleCase(addr);

  for (const [full, abbr] of Object.entries(streetTypes)) {
    const regex = new RegExp(`\\b${full}\\b`, 'gi');
    normalized = normalized.replace(regex, abbr);
  }

  return normalized;
}

/**
 * Normalize phone number to (XXX) XXX-XXXX
 */
function normalizePhone(phone) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');

  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits[0] === '1') {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return phone;
}

/**
 * Normalize date to YYYY-MM-DD
 */
function normalizeDate(dateStr) {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  if (!isNaN(date.getTime())) {
    return date.toISOString().split('T')[0];
  }
  return null;
}

/**
 * Clean string for filename - remove special chars, spaces
 */
function cleanForFilename(str) {
  if (!str) return '';

  // Remove business suffixes
  let cleaned = str
    .replace(/,?\s*(LLC|Inc\.?|Corp\.?|Co\.?|Company|Incorporated|Limited|Ltd\.?)$/gi, '')
    .trim();

  // Title case and join
  const words = cleaned.split(/[\s\-]+/).filter(w => w.length > 0).map(w => toTitleCase(w));
  cleaned = words.join('');

  return cleaned.replace(/[^a-zA-Z0-9]/g, '').substring(0, 50);
}

/**
 * Extract job identifier from job name
 * "Drummond-501 74th St" -> "Drummond501"
 */
function getJobIdentifier(jobName) {
  if (!jobName) return '';
  const parts = jobName.split(/[\s\-]+/);
  const clientName = parts[0] || '';
  const streetNumberMatch = jobName.match(/\d+/);
  const streetNumber = streetNumberMatch ? streetNumberMatch[0] : '';
  return toTitleCase(clientName) + streetNumber;
}

/**
 * Get just client name from job
 * "Drummond-501 74th St" -> "Drummond"
 */
function getClientName(jobName) {
  if (!jobName) return '';
  const parts = jobName.split(/[\s\-]+/);
  return toTitleCase(parts[0] || '');
}

function zeroPad(num, length = 3) {
  return String(num).padStart(length, '0');
}

function getMonthAbbrev(date) {
  const d = new Date(date);
  return isNaN(d.getTime()) ? null : MONTHS[d.getMonth()];
}

function getYear(date) {
  const d = new Date(date);
  return isNaN(d.getTime()) ? null : d.getFullYear();
}

// ============================================================
// DOCUMENT NAMING
// ============================================================

/**
 * Generate standardized invoice filename
 * Format: INV_{Job}_{Vendor}_{Date}.pdf
 * Example: INV_Drummond_FloridaSunshineCarpentry_2025-01-06.pdf
 */
function generateInvoiceFilename(params) {
  const { jobName, vendorName, invoiceDate, extension = 'pdf' } = params;

  const prefix = DOC_PREFIXES.invoice;
  const cleanJob = getClientName(jobName);
  const cleanVendor = cleanForFilename(vendorName);
  const date = normalizeDate(invoiceDate) || new Date().toISOString().split('T')[0];
  const ext = extension.toLowerCase().replace('.', '');

  let filename = prefix;
  if (cleanJob) filename += `_${cleanJob}`;
  if (cleanVendor) filename += `_${cleanVendor}`;
  filename += `_${date}`;

  return `${filename}.${ext}`;
}

/**
 * Generate PO number
 * Format: PO-{JobIdentifier}-{XXXX}
 * Example: PO-Drummond501-0043
 */
function generatePONumber(jobName, sequence) {
  const jobIdentifier = getJobIdentifier(jobName);
  return `PO-${jobIdentifier}-${zeroPad(sequence, 4)}`;
}

// ============================================================
// VENDOR NORMALIZATION & MATCHING
// ============================================================

/**
 * Common business suffixes to strip for comparison
 */
const BUSINESS_SUFFIXES = [
  'llc', 'inc', 'corp', 'co', 'company', 'incorporated', 'limited', 'ltd',
  'enterprises', 'enterprise', 'services', 'service', 'solutions', 'group',
  'holdings', 'partners', 'associates', 'of florida', 'fl', 'usa'
];

/**
 * Normalize vendor name for comparison
 * Strips suffixes, punctuation, extra spaces, and lowercases
 */
function normalizeVendorName(name) {
  if (!name) return '';

  let normalized = name.toLowerCase().trim();

  // Remove punctuation except apostrophes
  normalized = normalized.replace(/[.,\-_&]/g, ' ');

  // Remove business suffixes
  for (const suffix of BUSINESS_SUFFIXES) {
    const regex = new RegExp(`\\b${suffix}\\.?\\b`, 'gi');
    normalized = normalized.replace(regex, '');
  }

  // Remove "dba" and anything after it, or keep what's after as alternative
  const dbaMatch = normalized.match(/\bdba\b\s*(.*)/i);
  if (dbaMatch) {
    normalized = normalized.replace(/\bdba\b.*/i, '');
  }

  // Collapse multiple spaces to single space
  normalized = normalized.replace(/\s+/g, ' ').trim();

  return normalized;
}

/**
 * Calculate similarity score between two strings (0-100)
 * Uses a combination of exact match, starts-with, and Levenshtein-like scoring
 */
function calculateStringSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;

  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();

  // Exact match
  if (s1 === s2) return 100;

  // One contains the other
  if (s1.includes(s2) || s2.includes(s1)) {
    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;
    return Math.round((shorter.length / longer.length) * 90);
  }

  // Word-based matching
  const words1 = s1.split(/\s+/).filter(w => w.length > 1);
  const words2 = s2.split(/\s+/).filter(w => w.length > 1);

  if (words1.length === 0 || words2.length === 0) return 0;

  let matchingWords = 0;
  for (const w1 of words1) {
    for (const w2 of words2) {
      if (w1 === w2) {
        matchingWords++;
        break;
      }
      // Partial word match (one starts with the other)
      if (w1.startsWith(w2) || w2.startsWith(w1)) {
        matchingWords += 0.7;
        break;
      }
    }
  }

  const maxWords = Math.max(words1.length, words2.length);
  return Math.round((matchingWords / maxWords) * 85);
}

/**
 * Calculate vendor similarity score (0-100)
 * Compares normalized vendor names
 */
function calculateVendorSimilarity(vendor1, vendor2) {
  const name1 = typeof vendor1 === 'string' ? vendor1 : vendor1?.name;
  const name2 = typeof vendor2 === 'string' ? vendor2 : vendor2?.name;

  if (!name1 || !name2) return 0;

  const norm1 = normalizeVendorName(name1);
  const norm2 = normalizeVendorName(name2);

  return calculateStringSimilarity(norm1, norm2);
}

/**
 * Find best matching vendor from a list
 * Returns { vendor, score } or null if no good match
 */
function findBestVendorMatch(vendorName, vendorList, threshold = 70) {
  if (!vendorName || !vendorList || vendorList.length === 0) return null;

  let bestMatch = null;
  let bestScore = 0;

  for (const vendor of vendorList) {
    const score = calculateVendorSimilarity(vendorName, vendor);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = vendor;
    }
  }

  if (bestScore >= threshold) {
    return { vendor: bestMatch, score: bestScore };
  }

  return null;
}

/**
 * Get canonical vendor name (properly formatted)
 */
function getCanonicalVendorName(name) {
  if (!name) return null;

  // Check for DBA pattern and use the DBA name
  const dbaMatch = name.match(/\bdba\b\s+(.+)/i);
  let baseName = dbaMatch ? dbaMatch[1] : name;

  // Title case
  baseName = toTitleCase(baseName);

  // Standardize common suffixes
  baseName = baseName
    .replace(/\bLlc\b/g, 'LLC')
    .replace(/\bInc\b/g, 'Inc.')
    .replace(/\bCorp\b/g, 'Corp.')
    .replace(/\bCo\b(?!\w)/g, 'Co.');

  return baseName.trim();
}

// ============================================================
// EXPORT
// ============================================================

module.exports = {
  validValues,
  DOC_PREFIXES,
  MONTHS,
  BUSINESS_SUFFIXES,

  // Normalization
  toTitleCase,
  normalizeAddress,
  normalizePhone,
  normalizeDate,
  cleanForFilename,
  getJobIdentifier,
  getClientName,
  zeroPad,
  getMonthAbbrev,
  getYear,

  // Vendor matching
  normalizeVendorName,
  calculateStringSimilarity,
  calculateVendorSimilarity,
  findBestVendorMatch,
  getCanonicalVendorName,

  // Document naming
  generateInvoiceFilename,
  generatePONumber
};

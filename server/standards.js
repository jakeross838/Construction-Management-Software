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
// EXPORT
// ============================================================

module.exports = {
  validValues,
  DOC_PREFIXES,
  MONTHS,

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

  // Document naming
  generateInvoiceFilename,
  generatePONumber
};

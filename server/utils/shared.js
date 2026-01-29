/**
 * Shared utility functions for the Construction Management Software.
 * These should be used instead of duplicating logic across files.
 */

/**
 * Format a number as USD currency.
 * @param {number|string|null|undefined} amount - The amount to format
 * @param {boolean} [showCents=true] - Whether to show cents
 * @returns {string} Formatted currency string
 */
function formatMoney(amount, showCents = true) {
  const num = parseFloat(amount) || 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: showCents ? 2 : 0,
    maximumFractionDigits: showCents ? 2 : 0
  }).format(num);
}

/**
 * Escape HTML special characters to prevent XSS.
 * @param {string} str - The string to escape
 * @returns {string} Escaped string
 */
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  const div = { innerHTML: '' };
  const text = String(str);
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Normalize status string to CSS class format.
 * @param {string} status - The status string
 * @returns {string} CSS-friendly class name
 */
function normalizeStatusClass(status) {
  if (!status) return 'unknown';
  return status
    .toLowerCase()
    .replace(/_/g, '-')
    .replace(/\s+/g, '-');
}

/**
 * Parse a date string or Date object to ISO date string (YYYY-MM-DD).
 * @param {string|Date|null|undefined} date - The date to parse
 * @returns {string|null} ISO date string or null
 */
function parseDate(date) {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().split('T')[0];
}

/**
 * Format a date for display.
 * @param {string|Date|null|undefined} date - The date to format
 * @param {object} options - Intl.DateTimeFormat options
 * @returns {string} Formatted date or empty string
 */
function formatDate(date, options = { month: 'short', day: 'numeric', year: 'numeric' }) {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', options);
}

/**
 * Safely parse JSON with a fallback value.
 * @param {string} jsonString - The JSON string to parse
 * @param {*} fallback - Fallback value if parsing fails
 * @returns {*} Parsed value or fallback
 */
function safeJsonParse(jsonString, fallback = null) {
  try {
    return JSON.parse(jsonString);
  } catch (err) {
    return fallback;
  }
}

/**
 * Truncate a string to a maximum length with ellipsis.
 * @param {string} str - The string to truncate
 * @param {number} maxLength - Maximum length before truncation
 * @returns {string} Truncated string
 */
function truncate(str, maxLength = 50) {
  if (!str) return '';
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

/**
 * Generate a unique identifier for temporary use.
 * @returns {string} A unique ID
 */
function generateTempId() {
  return `temp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Deep clone an object using JSON serialization.
 * @param {*} obj - The object to clone
 * @returns {*} Cloned object
 */
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Check if a value is a non-empty string.
 * @param {*} value - The value to check
 * @returns {boolean} True if non-empty string
 */
function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Sleep for a specified number of milliseconds.
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff.
 * @param {Function} fn - The async function to retry
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} baseDelay - Base delay in ms (doubles each retry)
 * @returns {Promise<*>} Result of the function
 */
async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
  let lastError;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (i < maxRetries - 1) {
        await sleep(baseDelay * Math.pow(2, i));
      }
    }
  }
  throw lastError;
}

module.exports = {
  formatMoney,
  escapeHtml,
  normalizeStatusClass,
  parseDate,
  formatDate,
  safeJsonParse,
  truncate,
  generateTempId,
  deepClone,
  isNonEmptyString,
  sleep,
  retryWithBackoff
};

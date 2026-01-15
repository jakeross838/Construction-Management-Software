/**
 * Supabase Storage Helpers
 * Handles PDF uploads and retrieval
 *
 * STAMPING ARCHITECTURE:
 * - pdf_url: Original uploaded PDF (never modified)
 * - pdf_stamped_url: Single stamped version at fixed path {job_id}/{invoice_id}_stamped.pdf
 * - All stamps are applied fresh from original, never accumulated
 */

const { supabase } = require('../config');
const path = require('path');

const BUCKET = 'invoices';

// In-memory stamp locks to prevent concurrent stamping
const stampLocks = new Map();

/**
 * Upload a PDF to Supabase storage
 * @param {Buffer} fileBuffer - The file data
 * @param {string} fileName - Original filename
 * @param {string} jobId - Job ID for organization
 * @returns {Promise<{url: string, path: string}>}
 */
async function uploadPDF(fileBuffer, fileName, jobId) {
  // Create a unique path: job_id/timestamp_filename
  const timestamp = Date.now();
  const safeName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
  const storagePath = `${jobId}/${timestamp}_${safeName}`;

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, fileBuffer, {
      contentType: 'application/pdf',
      upsert: false
    });

  if (error) {
    throw new Error(`Failed to upload PDF: ${error.message}`);
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(storagePath);

  return {
    url: urlData.publicUrl,
    path: storagePath
  };
}

/**
 * Upload a stamped PDF to a fixed path (overwrites if exists)
 * NEW: Uses invoice ID for consistent path, not accumulated suffixes
 * @param {Buffer} fileBuffer - The stamped PDF data
 * @param {string} invoiceId - Invoice ID for fixed path
 * @param {string} jobId - Job ID for folder organization (or 'unassigned')
 * @returns {Promise<{url: string, path: string}>}
 */
async function uploadStampedPDFById(fileBuffer, invoiceId, jobId) {
  // Fixed path: {job_id}/{invoice_id}_stamped.pdf - always the same, always overwritten
  const folder = jobId || 'unassigned';
  const stampedPath = `${folder}/${invoiceId}_stamped.pdf`;

  console.log('[STAMP] Uploading to fixed path:', stampedPath);

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(stampedPath, fileBuffer, {
      contentType: 'application/pdf',
      upsert: true  // Overwrite if exists
    });

  if (error) {
    console.error('[STAMP] Upload error:', error);
    throw new Error(`Failed to upload stamped PDF: ${error.message}`);
  }

  const { data: urlData } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(stampedPath);

  // Add cache-busting timestamp to URL
  const urlWithCacheBust = `${urlData.publicUrl}?t=${Date.now()}`;
  console.log('[STAMP] Success:', urlWithCacheBust);

  return {
    url: urlWithCacheBust,
    path: stampedPath
  };
}

/**
 * Legacy upload stamped PDF - still used in some places
 * @deprecated Use uploadStampedPDFById instead
 */
async function uploadStampedPDF(fileBuffer, originalPath) {
  // Clean the path - remove query strings and ensure no accumulation
  let cleanPath = originalPath.split('?')[0]; // Remove query string

  // If already has _stamped, don't add more
  if (!cleanPath.endsWith('_stamped.pdf')) {
    cleanPath = cleanPath.replace('.pdf', '_stamped.pdf');
  }

  console.log('[STAMP-LEGACY] Uploading to:', cleanPath);

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(cleanPath, fileBuffer, {
      contentType: 'application/pdf',
      upsert: true
    });

  if (error) {
    console.error('[STAMP-LEGACY] Upload error:', error);
    throw new Error(`Failed to upload stamped PDF: ${error.message}`);
  }

  const { data: urlData } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(cleanPath);

  const urlWithCacheBust = `${urlData.publicUrl}?t=${Date.now()}`;

  return {
    url: urlWithCacheBust,
    path: cleanPath
  };
}

/**
 * Extract storage path from a Supabase URL
 * Safely handles query strings and various URL formats
 */
function extractStoragePath(url) {
  if (!url) return null;

  try {
    // Remove query string first
    const urlWithoutQuery = url.split('?')[0];

    // Extract path after /invoices/
    const match = urlWithoutQuery.match(/\/storage\/v1\/object\/public\/invoices\/(.+)$/);
    if (match) {
      return decodeURIComponent(match[1]);
    }

    return null;
  } catch (err) {
    console.error('[STORAGE] Failed to extract path from URL:', url, err.message);
    return null;
  }
}

/**
 * Check if a file exists in storage
 */
async function fileExists(storagePath) {
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .download(storagePath);

    return !error && data;
  } catch {
    return false;
  }
}

/**
 * Delete a file by its public URL
 */
async function deleteByUrl(url) {
  const storagePath = extractStoragePath(url);
  if (!storagePath) {
    console.warn('[STORAGE] Could not extract path from URL:', url);
    return false;
  }

  try {
    await deletePDF(storagePath);
    console.log('[STORAGE] Deleted:', storagePath);
    return true;
  } catch (err) {
    console.error('[STORAGE] Failed to delete:', storagePath, err.message);
    return false;
  }
}

/**
 * Acquire a stamp lock for an invoice
 * Returns true if lock acquired, false if already locked
 */
function acquireStampLock(invoiceId) {
  if (stampLocks.has(invoiceId)) {
    const lockTime = stampLocks.get(invoiceId);
    // If lock is older than 60 seconds, consider it stale
    if (Date.now() - lockTime < 60000) {
      console.log('[STAMP-LOCK] Already locked:', invoiceId);
      return false;
    }
  }
  stampLocks.set(invoiceId, Date.now());
  return true;
}

/**
 * Release a stamp lock
 */
function releaseStampLock(invoiceId) {
  stampLocks.delete(invoiceId);
}

/**
 * Download a PDF from storage
 * @param {string} storagePath - Path in storage
 * @returns {Promise<Buffer>}
 */
async function downloadPDF(storagePath) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .download(storagePath);

  if (error) {
    throw new Error(`Failed to download PDF: ${error.message}`);
  }

  // Convert Blob to Buffer
  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Delete a PDF from storage
 * @param {string} storagePath - Path in storage
 */
async function deletePDF(storagePath) {
  const { error } = await supabase.storage
    .from(BUCKET)
    .remove([storagePath]);

  if (error) {
    throw new Error(`Failed to delete PDF: ${error.message}`);
  }
}

/**
 * Get public URL for a file
 * @param {string} storagePath - Path in storage
 * @returns {string}
 */
function getPublicURL(storagePath) {
  const { data } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(storagePath);

  return data.publicUrl;
}

module.exports = {
  uploadPDF,
  uploadStampedPDF,
  uploadStampedPDFById,
  downloadPDF,
  deletePDF,
  deleteByUrl,
  getPublicURL,
  extractStoragePath,
  fileExists,
  acquireStampLock,
  releaseStampLock,
  BUCKET
};

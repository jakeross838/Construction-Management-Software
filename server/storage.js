/**
 * Supabase Storage Helpers
 * Handles PDF uploads and retrieval
 */

const { supabase } = require('../config');
const path = require('path');

const BUCKET = 'invoices';

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
 * Upload a stamped PDF (overwrites if exists)
 * @param {Buffer} fileBuffer - The stamped PDF data
 * @param {string} originalPath - Original file path
 * @returns {Promise<{url: string, path: string}>}
 */
async function uploadStampedPDF(fileBuffer, originalPath) {
  // Add _stamped suffix before extension
  const stampedPath = originalPath.replace('.pdf', '_stamped.pdf');

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(stampedPath, fileBuffer, {
      contentType: 'application/pdf',
      upsert: true  // Overwrite if exists
    });

  if (error) {
    throw new Error(`Failed to upload stamped PDF: ${error.message}`);
  }

  const { data: urlData } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(stampedPath);

  return {
    url: urlData.publicUrl,
    path: stampedPath
  };
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
  downloadPDF,
  deletePDF,
  getPublicURL,
  BUCKET
};

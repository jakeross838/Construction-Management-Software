/**
 * Sync Bid Documents - Creates database records for files in storage
 * and moves misplaced documents to correct bids
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const STORAGE_BUCKET = 'invoices';
const BID_PREFIX = 'bid-documents';

// Bid IDs
const STRUCTURAL_STEEL_BID = '089fab73-90d5-4c06-8076-b095d6cc2a65';
const EPICORE_BID = '6784423d-bec9-415e-bda9-72e2f639db64';
const RAILINGS_BID = 'b44119e4-68a3-49b8-8188-97de8432af73';

// Document routing rules - which files go where
const ROUTING_RULES = [
  { pattern: /SDS/i, targetBid: EPICORE_BID, bidName: 'Epicore Metal Deck System' },
  { pattern: /Universal/i, targetBid: RAILINGS_BID, bidName: 'Aluminum Railings' },
];

async function listStorageFiles(bidId) {
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .list(`${BID_PREFIX}/${bidId}`);

  if (error) {
    console.error(`Error listing files for bid ${bidId}:`, error.message);
    return [];
  }
  return data || [];
}

async function moveFile(fromBidId, toBidId, fileName) {
  const fromPath = `${BID_PREFIX}/${fromBidId}/${fileName}`;
  const toPath = `${BID_PREFIX}/${toBidId}/${fileName}`;

  // Download the file
  const { data: fileData, error: downloadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .download(fromPath);

  if (downloadError) {
    console.error(`  Error downloading ${fileName}:`, downloadError.message);
    return false;
  }

  // Upload to new location
  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(toPath, fileData, {
      contentType: 'application/pdf',
      upsert: false
    });

  if (uploadError) {
    if (uploadError.message.includes('already exists')) {
      console.log(`  File already exists at destination, skipping upload`);
    } else {
      console.error(`  Error uploading ${fileName}:`, uploadError.message);
      return false;
    }
  }

  // Delete from old location
  const { error: deleteError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .remove([fromPath]);

  if (deleteError) {
    console.error(`  Error deleting original ${fileName}:`, deleteError.message);
  }

  return true;
}

async function createDocumentRecord(bidId, fileName, fileUrl, fileSize) {
  // Check if record already exists
  const { data: existing } = await supabase
    .from('v2_bid_documents')
    .select('id')
    .eq('bid_id', bidId)
    .eq('file_name', fileName)
    .single();

  if (existing) {
    console.log(`  Record already exists for ${fileName}`);
    return existing.id;
  }

  const { data, error } = await supabase
    .from('v2_bid_documents')
    .insert({
      bid_id: bidId,
      file_name: fileName,
      file_url: fileUrl,
      file_size: fileSize,
      uploaded_by: 'Sync Script'
    })
    .select()
    .single();

  if (error) {
    console.error(`  Error creating record for ${fileName}:`, error.message);
    return null;
  }

  return data.id;
}

async function getPublicUrl(path) {
  const { data } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(path);
  return data.publicUrl;
}

async function syncBidDocuments(bidId, bidName) {
  console.log(`\n=== Syncing ${bidName} (${bidId}) ===`);

  const files = await listStorageFiles(bidId);
  console.log(`Found ${files.length} files in storage`);

  const filesToMove = [];
  const filesToKeep = [];

  // Categorize files
  for (const file of files) {
    if (file.name === '.emptyFolderPlaceholder') continue;

    let shouldMove = false;
    let targetBid = null;
    let targetBidName = null;

    for (const rule of ROUTING_RULES) {
      if (rule.pattern.test(file.name) && rule.targetBid !== bidId) {
        shouldMove = true;
        targetBid = rule.targetBid;
        targetBidName = rule.bidName;
        break;
      }
    }

    if (shouldMove) {
      filesToMove.push({ ...file, targetBid, targetBidName });
    } else {
      filesToKeep.push(file);
    }
  }

  // Move misplaced files
  if (filesToMove.length > 0) {
    console.log(`\nMoving ${filesToMove.length} misplaced files:`);
    for (const file of filesToMove) {
      console.log(`  Moving "${file.name}" to ${file.targetBidName}`);
      const moved = await moveFile(bidId, file.targetBid, file.name);
      if (moved) {
        // Create record in target bid
        const fileUrl = await getPublicUrl(`${BID_PREFIX}/${file.targetBid}/${file.name}`);
        await createDocumentRecord(file.targetBid, file.name, fileUrl, file.metadata?.size || 0);
      }
    }
  }

  // Create records for files that stay
  console.log(`\nCreating records for ${filesToKeep.length} files:`);
  for (const file of filesToKeep) {
    console.log(`  Processing "${file.name}"`);
    const fileUrl = await getPublicUrl(`${BID_PREFIX}/${bidId}/${file.name}`);
    await createDocumentRecord(bidId, file.name, fileUrl, file.metadata?.size || 0);
  }
}

async function syncAllBids() {
  console.log('Starting bid document sync...\n');

  // List all bid folders in storage
  const { data: folders, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .list(BID_PREFIX);

  if (error) {
    console.error('Error listing bid folders:', error.message);
    return;
  }

  console.log(`Found ${folders.length} bid folders in storage`);

  // Get bid names for display
  const bidIds = folders.map(f => f.name).filter(id => id !== '.emptyFolderPlaceholder');
  const { data: bids } = await supabase
    .from('v2_bids')
    .select('id, title')
    .in('id', bidIds);

  const bidNameMap = {};
  for (const bid of (bids || [])) {
    bidNameMap[bid.id] = bid.title;
  }

  // Process Structural Steel first (it has files to move)
  if (bidIds.includes(STRUCTURAL_STEEL_BID)) {
    await syncBidDocuments(STRUCTURAL_STEEL_BID, bidNameMap[STRUCTURAL_STEEL_BID] || 'Structural Steel');
  }

  // Process all other bids
  for (const bidId of bidIds) {
    if (bidId === STRUCTURAL_STEEL_BID) continue;
    await syncBidDocuments(bidId, bidNameMap[bidId] || bidId);
  }

  console.log('\n=== Sync complete ===');
}

syncAllBids().catch(console.error);

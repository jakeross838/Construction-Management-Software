/**
 * Bulk Upload Bid Documents
 * Matches documents from local folder to bids and uploads them
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

const API_BASE = 'http://localhost:3001/api';
const PROPOSALS_DIR = 'P:/Projects Info Folder/Clark 853 N Shore Dr/Proposals-subcontractors';

// Mapping of folder names to bid matching keywords
const FOLDER_TO_BID_MAP = {
  'Appliances': ['Fuse', 'Appliances'],
  'Cabinets': ['Cabinetry', 'SRQ'],
  'Concrete': ['Concrete', 'ML Concrete', 'Epicore', 'SDS'],
  'Demolition': ['Demolition', 'RC Grade'],
  'Drywall': ['Drywall', 'WG Quality'],
  'Electric': ['Electrical', 'Coastal Electric'],
  'Fencing': ['Fencing', 'USA Fence'],
  'Flooring & Tile': ['Flooring', 'Tile', 'Rosas'],
  'Framing': ['Framing', 'Valencia'],
  'Garage OH Doors': ['Garage', 'Banko'],
  'HVAC': ['HVAC', 'Captain Cool'],
  'Insulation': ['Insulation', 'Paradise'],
  'Interior Trim': ['Trim', 'Royal Trimworks'],
  'Landscaping': ['Landscape', 'Gilkey'],
  'Low Voltage': ['Low Voltage', 'Castle'],
  'Painting': ['Painting', 'Myers'],
  'Pilings': ['Pilings', 'ACIP', 'West Coast Foundation'],
  'Plumbing': ['Plumbing', 'Loftin'],
  'Plumbing Fixtures': ['Bath Accessories', 'Ferguson'],
  'Pool': ['Pool', 'Sanger'],
  'Railings': ['Railings', 'DB Welding', 'Universal Structural'],
  'Roofing': ['Roofing', 'Avery'],
  'Siding': ['Siding', 'LUMABUILT', 'M and J'],
  'Stairs': ['Staircase', 'Modulo', 'BeachN', 'Stair Treads'],
  'Trusses': ['Trusses', 'Kimal'],
  'Turbidity Barrier': ['Turbidity', 'RH Moore'],
  'WindowsDoors': ['Windows', 'Doors', 'Universal Window'],
  'Dock & Seawall': ['Seawall', 'Island Garden'],
};

async function fetchBids() {
  return new Promise((resolve, reject) => {
    http.get(`${API_BASE}/bids`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function uploadDocument(bidId, filePath) {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append('document', fs.createReadStream(filePath));
    form.append('uploaded_by', 'Bulk Import');

    const options = {
      hostname: 'localhost',
      port: 3001,
      path: `/api/bids/${bidId}/documents`,
      method: 'POST',
      headers: form.getHeaders()
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(data));
        } else {
          reject(new Error(`Upload failed: ${res.statusCode} - ${data}`));
        }
      });
    });

    req.on('error', reject);
    form.pipe(req);
  });
}

function findMatchingBid(bids, folderName, fileName) {
  const keywords = FOLDER_TO_BID_MAP[folderName] || [];
  const fileNameLower = fileName.toLowerCase();
  const folderLower = folderName.toLowerCase();

  for (const bid of bids) {
    const titleLower = bid.title.toLowerCase();
    const vendorLower = (bid.vendor?.name || '').toLowerCase();

    // Check if any keyword matches
    for (const keyword of keywords) {
      const keywordLower = keyword.toLowerCase();
      if (titleLower.includes(keywordLower) || vendorLower.includes(keywordLower)) {
        // Additional check: filename should somewhat match the vendor or title
        const vendorWords = vendorLower.split(/\s+/);
        const titleWords = titleLower.split(/\s+|-/);

        for (const word of [...vendorWords, ...titleWords]) {
          if (word.length > 3 && fileNameLower.includes(word)) {
            return bid;
          }
        }

        // If keyword is very specific (like vendor name), use it
        if (keywordLower.length > 5 && (fileNameLower.includes(keywordLower) || vendorLower.includes(keywordLower))) {
          return bid;
        }
      }
    }
  }

  return null;
}

function getAllPdfFiles(dir) {
  const results = [];

  function walkDir(currentDir, folderName) {
    const items = fs.readdirSync(currentDir);
    for (const item of items) {
      const fullPath = path.join(currentDir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        // Skip "Old Files" directories
        if (item.toLowerCase() !== 'old files') {
          walkDir(fullPath, folderName || item);
        }
      } else if (item.toLowerCase().endsWith('.pdf')) {
        results.push({
          path: fullPath,
          fileName: item,
          folder: folderName || path.basename(path.dirname(fullPath))
        });
      }
    }
  }

  walkDir(dir, null);
  return results;
}

async function main() {
  console.log('Fetching bids...');
  const bids = await fetchBids();
  console.log(`Found ${bids.length} bids\n`);

  console.log('Scanning documents...');
  const pdfFiles = getAllPdfFiles(PROPOSALS_DIR);
  console.log(`Found ${pdfFiles.length} PDF files\n`);

  // Create matches
  const matches = [];
  const unmatched = [];

  for (const file of pdfFiles) {
    const bid = findMatchingBid(bids, file.folder, file.fileName);
    if (bid) {
      matches.push({ file, bid });
    } else {
      unmatched.push(file);
    }
  }

  console.log(`Matched: ${matches.length} documents`);
  console.log(`Unmatched: ${unmatched.length} documents\n`);

  // Show matches
  console.log('=== MATCHES ===');
  for (const { file, bid } of matches) {
    console.log(`[${file.folder}] ${file.fileName}`);
    console.log(`  -> ${bid.title} (${bid.vendor?.name || 'No vendor'})`);
    console.log('');
  }

  // Ask for confirmation before uploading
  if (process.argv.includes('--upload')) {
    console.log('\n=== UPLOADING ===\n');
    let uploaded = 0;
    let failed = 0;

    for (const { file, bid } of matches) {
      try {
        console.log(`Uploading: ${file.fileName} -> ${bid.title}`);
        await uploadDocument(bid.id, file.path);
        console.log(`  SUCCESS`);
        uploaded++;
      } catch (err) {
        console.log(`  FAILED: ${err.message}`);
        failed++;
      }
    }

    console.log(`\nUpload complete: ${uploaded} succeeded, ${failed} failed`);
  } else {
    console.log('\n=== UNMATCHED FILES ===');
    for (const file of unmatched) {
      console.log(`[${file.folder}] ${file.fileName}`);
    }
    console.log('\nRun with --upload flag to actually upload documents');
  }
}

main().catch(console.error);

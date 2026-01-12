const { PDFDocument } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

// Invoice definitions: [startPage (0-indexed), endPage (0-indexed), filename]
const invoices = [
  // Skip pages 0-2 (FPL payment confirmation - not an invoice)
  [3, 3, 'FPL-Electric-58.13'],           // Page 4: FPL Electric Bill
  [4, 4, 'Ecosouth-INVG82248-1390.50'],   // Page 5: Ecosouth roll off
  [5, 5, 'IslandLumber-527111-2524.67'],  // Page 6: Island Lumber vents
  [6, 6, 'IslandLumber-525830-60.09'],    // Page 7: Island Lumber supplies
  [7, 7, 'IslandLumber-526846-26.81'],    // Page 8: Island Lumber plywood
  [8, 9, 'Loftin-26125163-19899.00'],     // Pages 9-10: Loftin Plumbing
  [10, 10, 'Ferguson-6713881-1461.05'],   // Page 11: Ferguson fixtures
  [11, 11, 'SmartShield-106004-1426.14'], // Page 12: SmartShield Elec CO4
  [12, 12, 'SmartShield-106084-4836.94'], // Page 13: SmartShield Security
  [13, 13, 'ParadiseFoam-5977-17921.56'], // Page 14: Paradise Foam insulation
  [14, 14, 'RangelTile-26647.28'],        // Page 15: Rangel Custom Tile
  [15, 15, 'HomeDepot-23.07'],            // Page 16: Home Depot receipt
  [16, 16, 'MJFlorida-MJ250337-6000.00'], // Page 17: M&J Masonry
  [17, 17, 'IslandLumber-527120-779.93'], // Page 18: Island Lumber hardi
  [18, 18, 'IslandLumber-971925-22896.93'], // Page 19: Island Lumber trim
  [19, 19, 'CoatRite-1118-11327.50'],     // Page 20: CoatRite waterproof 1
  [20, 20, 'CoatRite-1122-11327.50'],     // Page 21: CoatRite waterproof 2
  [21, 21, 'TNTPainting-3262-6034.12'],   // Page 22: TNT Painting soffit
  // Skip pages 22-23 (SmartShield quotes/bids - not invoices)
  [24, 24, 'SmartShield-105472-2845.84'], // Page 25: SmartShield Elec CO1&2
];

async function splitPDF() {
  const inputPath = 'C:\\Users\\Jake\\Downloads\\Drummond November 2025 Corresponding Invoices.pdf';
  const outputDir = 'C:\\Users\\Jake\\Downloads\\split-invoices';

  // Create output directory
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log('Reading source PDF...');
  const pdfBytes = fs.readFileSync(inputPath);
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const totalPages = pdfDoc.getPageCount();
  console.log(`Source PDF has ${totalPages} pages`);

  for (const [startPage, endPage, name] of invoices) {
    console.log(`Extracting pages ${startPage + 1}-${endPage + 1} -> ${name}.pdf`);

    const newDoc = await PDFDocument.create();
    const pageIndices = [];
    for (let i = startPage; i <= endPage; i++) {
      pageIndices.push(i);
    }

    const copiedPages = await newDoc.copyPages(pdfDoc, pageIndices);
    copiedPages.forEach(page => newDoc.addPage(page));

    const newPdfBytes = await newDoc.save();
    const outputPath = path.join(outputDir, `${name}.pdf`);
    fs.writeFileSync(outputPath, newPdfBytes);
    console.log(`  -> Saved ${outputPath} (${Math.round(newPdfBytes.length / 1024)}KB)`);
  }

  console.log(`\nDone! Split into ${invoices.length} invoice PDFs in ${outputDir}`);
}

splitPDF().catch(console.error);

/**
 * Generate PWA icon assets for Ross Built Construction Management Software.
 *
 * Uses the `sharp` library to create PNG icons at all sizes referenced
 * in client/public/manifest.json.
 *
 * Design: Blue (#3B82F6) background with white "RB" text centered.
 *         Rounded corners on larger sizes.
 */

const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const SIZES = [72, 96, 128, 144, 152, 192, 384, 512];
const OUTPUT_DIR = path.join(__dirname, '..', 'client', 'public', 'icons');
const BG_COLOR = '#3B82F6';
const TEXT_COLOR = '#FFFFFF';

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function generateSVG(size) {
  // Scale font size relative to icon size.
  // For a 512px icon, a ~200px font looks good. Scale linearly.
  const fontSize = Math.round(size * 0.39);
  // Rounded corner radius scales with size but caps for smaller icons
  const cornerRadius = Math.round(size * 0.15);
  // Slight vertical offset to visually center the text (text tends to sit high)
  const yOffset = Math.round(size * 0.02);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${cornerRadius}" ry="${cornerRadius}" fill="${BG_COLOR}"/>
  <text
    x="${size / 2}"
    y="${size / 2 + yOffset}"
    font-family="Arial, Helvetica, sans-serif"
    font-weight="bold"
    font-size="${fontSize}"
    fill="${TEXT_COLOR}"
    text-anchor="middle"
    dominant-baseline="central"
    letter-spacing="${Math.round(fontSize * 0.05)}"
  >RB</text>
</svg>`;
}

async function generateIcons() {
  console.log('Generating PWA icons for Ross Built Construction Management Software...');
  console.log(`Output directory: ${OUTPUT_DIR}`);
  console.log('');

  for (const size of SIZES) {
    const svg = generateSVG(size);
    const outputPath = path.join(OUTPUT_DIR, `icon-${size}x${size}.png`);

    await sharp(Buffer.from(svg))
      .resize(size, size)
      .png()
      .toFile(outputPath);

    const stats = fs.statSync(outputPath);
    console.log(`  Created: icon-${size}x${size}.png  (${stats.size} bytes)`);
  }

  // Also create the SVG fallback icon at the root icons directory
  const svgFallbackPath = path.join(OUTPUT_DIR, 'icon.svg');
  fs.writeFileSync(svgFallbackPath, generateSVG(512));
  console.log(`  Created: icon.svg (SVG fallback)`);

  console.log('');
  console.log('Done! All icons generated successfully.');
}

generateIcons().catch(err => {
  console.error('Error generating icons:', err);
  process.exit(1);
});

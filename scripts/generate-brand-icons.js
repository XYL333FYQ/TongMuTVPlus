#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-var-requires, no-console */
const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');

async function generateBrandIcons() {
  const projectRoot = path.resolve(__dirname, '..');
  const publicDir = path.join(projectRoot, 'public');
  const source = await fs.readFile(
    path.join(publicDir, 'brand', 'tm-mark.svg')
  );
  await fs.mkdir(path.join(publicDir, 'icons'), { recursive: true });
  for (const size of [180, 192, 256, 384, 512]) {
    await sharp(source)
      .resize(size, size)
      .png()
      .toFile(path.join(publicDir, 'icons', `icon-${size}x${size}.png`));
  }
  await sharp(source)
    .resize(512, 512)
    .png()
    .toFile(path.join(publicDir, 'logo.png'));
  // Keep the Android resource path compatible; application IDs and JS bridge names are unchanged.
  await sharp(source)
    .resize(512, 512)
    .png()
    .toFile(
      path.join(
        projectRoot,
        'apps',
        'android-tv',
        'app',
        'src',
        'main',
        'res',
        'drawable',
        'logo.png'
      )
    );

  const sizes = [16, 32, 48, 256];
  const images = await Promise.all(
    sizes.map((size) => sharp(source).resize(size, size).png().toBuffer())
  );
  const header = Buffer.alloc(6 + sizes.length * 16);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(sizes.length, 4);
  let offset = header.length;
  sizes.forEach((size, index) => {
    const entry = 6 + index * 16;
    header[entry] = size === 256 ? 0 : size;
    header[entry + 1] = size === 256 ? 0 : size;
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(images[index].length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += images[index].length;
  });
  await fs.writeFile(
    path.join(publicDir, 'favicon.ico'),
    Buffer.concat([header, ...images])
  );
  console.log(
    'Generated TongMuTV Plus PNG icons and multi-size favicon from the original TM SVG.'
  );
}

if (require.main === module) {
  generateBrandIcons().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = { generateBrandIcons };

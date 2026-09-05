// Run with Node.js and sharp available (locally or via NODE_PATH).
// favicon-light.svg is the master artwork; keep its fill/stroke in brand navy.
const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');
const root = path.resolve(__dirname, '..');

async function main() {
  const light = await fs.readFile(path.join(root, 'favicon-light.svg'), 'utf8');
  const dark = light.replaceAll('#001D30', '#FFFFFF');
  const adaptive = light.replace('><path', '><style>@media(prefers-color-scheme:dark){path{fill:#fff;stroke:#fff}}</style><path');
  // The master has extra transparent padding to avoid edge bleed in browser resizing.
  const tile = light.replace('><path', '><rect x="-6" y="-4" width="52" height="52" rx="8" fill="#F4F7F8"/><path');
  // Home-screen icons use an opaque full-bleed tile and more breathing room.
  const touch = tile.replace('viewBox="-6 -4 52 52"', 'viewBox="-12 -10 64 64"')
    .replace('x="-6" y="-4" width="52" height="52" rx="8"', 'x="-12" y="-10" width="64" height="64"');
  const write = (name, data) => fs.writeFile(path.join(root, name), data);
  const png = (svg, size) => sharp(Buffer.from(svg), { density: 384 })
    .resize(size, size).png({ compressionLevel: 9, palette: true }).toBuffer();

  await write('favicon.svg', adaptive);
  await write('favicon-dark.svg', dark);
  for (const size of [16, 32, 48]) {
    await write(`favicon-${size}x${size}.png`, await png(tile, size));
    for (const [theme, svg] of [['light', light], ['dark', dark]]) {
      await write(`favicon-${theme}-${size}x${size}.png`, await png(svg, size));
    }
  }
  // ICO supports PNG entries; include native 16, 32 and 48px images.
  const sizes = [16, 32, 48];
  const entries = await Promise.all(sizes.map(size => png(tile, size)));
  const header = Buffer.alloc(6 + 16 * sizes.length);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(sizes.length, 4);
  let offset = header.length;
  entries.forEach((entry, index) => {
    const start = 6 + index * 16;
    header[start] = header[start + 1] = sizes[index];
    header.writeUInt16LE(1, start + 4);
    header.writeUInt16LE(32, start + 6);
    header.writeUInt32LE(entry.length, start + 8);
    header.writeUInt32LE(offset, start + 12);
    offset += entry.length;
  });
  await write('favicon.ico', Buffer.concat([header, ...entries]));
  await write('apple-touch-icon.png', await png(touch, 180));
  for (const size of [192, 512]) {
    await write(`android-chrome-${size}x${size}.png`, await png(touch, size));
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });

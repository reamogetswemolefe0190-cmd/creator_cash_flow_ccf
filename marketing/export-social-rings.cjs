const path = require('path');
const sharp = require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');

async function main() {
  const source = path.join(__dirname, '../brand/connection-v2-stock/connection-mark-ink.png');
  const mark = await sharp(source).resize({ width: 720, height: 720, fit: 'inside' }).flatten({ background: '#F7F7F2' }).toBuffer();
  const canvas = sharp({ create: { width: 1080, height: 1080, channels: 3, background: '#F7F7F2' } }).composite([{ input: mark, gravity: 'centre' }]);
  await canvas.clone().png().toFile(path.join(__dirname, 'CCF-Rings-Social.png'));
  await canvas.clone().jpeg({ quality: 95 }).toFile(path.join(__dirname, 'CCF-Rings-Social.jpg'));
}
main().catch(error => { console.error(error); process.exit(1); });

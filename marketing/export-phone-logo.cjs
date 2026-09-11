const path = require('path');
const sharp = require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');

async function main() {
  const source = path.join(__dirname, 'agencies-brands-v1/assets/approved-logo-ink.png');
  const logo = await sharp(source).resize({ width: 920 }).flatten({ background: '#F7F7F2' }).toBuffer();
  const canvas = sharp({ create: { width: 1080, height: 1080, channels: 3, background: '#F7F7F2' } }).composite([{ input: logo, gravity: 'centre' }]);
  await canvas.clone().png().toFile(path.join(__dirname, 'CCF-Logo.png'));
  await canvas.clone().jpeg({ quality: 95 }).toFile(path.join(__dirname, 'CCF-Logo.jpg'));
}
main().catch(error => { console.error(error); process.exit(1); });

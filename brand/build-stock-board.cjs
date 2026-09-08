const fs = require('fs');
const path = require('path');
const sharp = require('C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const base = path.join(__dirname, 'connection-v1');
const out = path.join(__dirname, 'connection-v2-stock');
const photos = 'C:/Users/User/.codex/visualizations/2026/08/17/01a00eb5-4f2e-7051-b77c-f15bae56e868';
const svg = s => Buffer.from(s);
async function main(){
 fs.mkdirSync(out, {recursive:true});
 for(const name of ['app-icon.svg','connection-mark.svg','connection-mark-reversed.svg','logo-primary.svg','logo-reversed.svg','logo-preview.png','brand-tokens.css']) fs.copyFileSync(path.join(base,name),path.join(out,name));
 for(const name of ['creator-photo.jpg','team-photo.jpg']) fs.copyFileSync(path.join(photos,name),path.join(out,name));
 const creator = await sharp(path.join(photos,'creator-photo.jpg')).resize(358,294,{fit:'cover',position:'centre'}).png().toBuffer();
 const team = await sharp(path.join(photos,'team-photo.jpg')).resize(223,234,{fit:'cover',position:'centre'}).png().toBuffer();
 const socialText=svg(`<svg xmlns="http://www.w3.org/2000/svg" width="358" height="294"><rect y="213" width="358" height="81" fill="#F7F7F2"/><text x="16" y="240" font-family="Arial,sans-serif" font-size="20" font-weight="700" fill="#252F20">Make room for your</text><text x="16" y="265" font-family="Arial,sans-serif" font-size="20" font-weight="700" fill="#252F20">next big thing.</text><text x="16" y="283" font-family="Arial,sans-serif" font-size="10" fill="#596451">CREATOR CASH FLOW</text></svg>`);
 const web=svg(`<svg xmlns="http://www.w3.org/2000/svg" width="431" height="294"><rect width="431" height="294" fill="#F7F7F2"/><text x="16" y="23" font-family="Arial,sans-serif" font-size="12" font-weight="700" fill="#252F20">creator cash flow</text><rect x="335" y="10" width="80" height="25" rx="12" fill="#DEFB82"/><text x="348" y="27" font-family="Arial,sans-serif" font-size="10" fill="#252F20">Get started</text><g fill="#252F20" font-family="Arial,sans-serif" font-weight="700" font-size="24"><text x="16" y="96">Creators.</text><text x="16" y="124">Agencies.</text><text x="16" y="152">Brands.</text><text x="16" y="180">Connected.</text></g><g font-family="Arial,sans-serif" font-size="11" fill="#596451"><text x="16" y="216">Campaigns, collaborations</text><text x="16" y="233">and cash flow.</text></g></svg>`);
 const footer=svg(`<svg xmlns="http://www.w3.org/2000/svg" width="1536" height="38"><rect width="1536" height="38" fill="#F7F7F2"/><text x="46" y="22" font-family="Arial,sans-serif" font-size="12" fill="#596451">STOCK PHOTOGRAPHY: cottonbro studio + fauxels / Pexels. Illustrative subjects; no endorsement implied.</text><text x="1350" y="22" font-family="Arial,sans-serif" font-size="12" fill="#596451">STOCK EDITION 02</text></svg>`);
 await sharp(path.join(base,'brand-board.png')).composite([{input:creator,left:687,top:668},{input:socialText,left:687,top:668},{input:web,left:1064,top:668},{input:team,left:1272,top:728},{input:footer,left:0,top:986}]).png().toFile(path.join(out,'brand-board.png'));
 let guide=fs.readFileSync(path.join(base,'brand-guide.md'),'utf8');
 guide=guide.replace('Connection identity · version 1','Connection identity · version 2 — stock photography');
 guide=guide.replace('The generated board communicates art direction.','The brand board communicates art direction. Its people photography is licensed stock.');
 guide=guide.replace('The generated identity board contains illustrative imagery, not licensed stock photography or a customer story.','The updated identity board uses these same stock photographs. No AI-generated people are included in the stock edition. See photo-credits.md for source and licence links.');
 guide=guide.replace('This is identity v1,','This is identity v2,');
 fs.writeFileSync(path.join(out,'brand-guide.md'),guide);
 console.log(JSON.stringify(await sharp(path.join(out,'brand-board.png')).metadata()));
}
main().catch(e=>{console.error(e);process.exit(1)});

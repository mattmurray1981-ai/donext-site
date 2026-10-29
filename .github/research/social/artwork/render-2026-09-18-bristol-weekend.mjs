import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
const sharp = createRequire(import.meta.url)('sharp');
const logo = (await readFile('assets/brand/bristol/donext-bristol-avatar-v4.png')).toString('base64');
const rows = [
  ['01', 'A harbour sing-along', 'Sea Shanty Shout · Great Eastern Hall', 'Sat + Sun · noon–6pm · FREE · no booking'],
  ['02', 'Make a paper boat', 'Docks Heritage Weekend · M Shed', 'Sat workshop · free museum entry; paid extras'],
  ['03', 'Music, nature + making', 'Trinity Community Celebration', 'Sun · noon–4pm · £0–£3 donation'],
  ['04', 'Room to roam', 'Tyntesfield · final free-entry weekend', 'Sat + Sun · estate 10am–6pm · parking £5'],
];
const esc = s => s.replaceAll('&','&amp;');
const cards = rows.map(([n,title,venue,detail],i) => {
 const y=408+i*189;
 return `<rect x="56" y="${y}" width="968" height="170" rx="18" fill="${i%2?'#eeeeda':'#ffffff'}"/>
 <text x="85" y="${y+54}" font-size="28" font-weight="700" fill="#e44107">${n}</text>
 <text x="151" y="${y+53}" font-size="40" font-weight="800">${esc(title)}</text>
 <text x="151" y="${y+99}" font-size="28">${esc(venue)}</text>
 <text x="151" y="${y+142}" font-size="24">${esc(detail)}</text>`;
}).join('');
const svg=`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1080" height="1350" viewBox="0 0 1080 1350">
<rect width="1080" height="1350" fill="#fff8eb"/>
<rect width="1080" height="18" fill="#f34808"/>
<image x="56" y="46" width="170" height="170" xlink:href="data:image/png;base64,${logo}"/>
<g font-family="DejaVu Sans, sans-serif" fill="#25271f">
<text x="1020" y="107" text-anchor="end" font-size="29" font-weight="700">19–20 SEPTEMBER 2026</text>
<text x="1020" y="155" text-anchor="end" font-size="25">YOUR FAMILY WEEKEND</text>
<text x="56" y="298" font-size="72" font-weight="800" letter-spacing="-2">BRISTOL, LET’S GO.</text>
<text x="60" y="360" font-size="29">Four plans with the costs up front.</text>
${cards}
<text x="60" y="1212" font-size="24">Times, booking details + access notes in the caption.</text>
<path d="M56 1252H1024" stroke="#25271f"/>
<text x="60" y="1306" font-size="27" font-weight="700">donext.co.uk/bristol/</text>
<text x="1020" y="1306" text-anchor="end" font-size="21">Save for the weekend</text>
</g></svg>`;
const base='.github/research/social/artwork/2026-09-18-bristol-weekend';
await writeFile(`${base}.svg`,svg);
const jpeg=await sharp(Buffer.from(svg)).jpeg({quality:92,chromaSubsampling:'4:4:4'}).toBuffer();
await writeFile(`${base}.jpg`,jpeg);
await mkdir('assets/social',{recursive:true});
await writeFile('assets/social/2026-09-18-bristol-weekend.jpg',jpeg);
console.log(`Rendered 1080×1350 non-AI JPEG (${jpeg.length} bytes)`);

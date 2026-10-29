// Original typographic SVG layout. Approved logo embedded unchanged; no photographs.
// Run from repository root: node .github/research/social/artwork/render-2026-09-14.mjs
import {readFile, writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const sharp = require('sharp');
const root = '.github/research/social/artwork/';
const logo = await readFile('assets/brand/bristol/donext-bristol-avatar-v4.png');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1080" height="1350" viewBox="0 0 1080 1350">
<rect width="1080" height="1350" fill="#fff8eb"/>
<rect x="0" y="0" width="1080" height="20" fill="#f34808"/>
<image x="66" y="55" width="172" height="172" xlink:href="data:image/png;base64,${logo.toString('base64')}"/>
<g font-family="DejaVu Sans, sans-serif" fill="#25271f">
<text x="1008" y="104" text-anchor="end" font-size="26" font-weight="700" letter-spacing="2">BRISTOL &amp; NEARBY</text>
<text x="1008" y="147" text-anchor="end" font-size="25">14–20 SEPTEMBER 2026</text>
<text x="66" y="322" font-size="76" font-weight="800" letter-spacing="-3">BIG DAYS OUT.</text>
<text x="66" y="408" font-size="76" font-weight="800" letter-spacing="-3" fill="#e84005">NO ENTRY FEE.</text>
<text x="70" y="467" font-size="28">Two National Trust places to explore this week</text>
<rect x="64" y="515" width="952" height="296" rx="22" fill="#f34808"/>
<g fill="#fff8eb">
<text x="96" y="574" font-size="20" letter-spacing="2" font-weight="700">01 / WRAXALL · BS48 1PA</text>
<text x="96" y="639" font-size="52" font-weight="700">TYNTESFIELD</text>
<text x="96" y="689" font-size="30" font-weight="700">Mon 14 – Sun 20 September</text>
<text x="96" y="736" font-size="26">Estate 10am–6pm · last entry 5pm</text>
<text x="96" y="778" font-size="24">Free entry · no booking · budget £5 for parking*</text>
</g>
<rect x="64" y="836" width="952" height="296" rx="22" fill="#eaeedc"/>
<text x="96" y="895" font-size="20" letter-spacing="2" font-weight="700">02 / NEAR BATH · SOUTH GLOUCESTERSHIRE</text>
<text x="96" y="960" font-size="52" font-weight="700">DYRHAM PARK</text>
<text x="96" y="1010" font-size="30" font-weight="700">Thu 17 – Sat 19 September</text>
<text x="96" y="1057" font-size="26">10am–5pm · last entry 4pm</text>
<text x="96" y="1099" font-size="24">Free entry + parking · no booking</text>
<text x="68" y="1182" font-size="25" font-weight="700">Family days out · children with a grown-up</text>
<text x="68" y="1223" font-size="21">*Tyntesfield’s standard non-member parking rate.</text>
<text x="68" y="1257" font-size="21">Sloping paths. House hours and access details in caption.</text>
<path d="M66 1280H1014" stroke="#25271f" stroke-width="1"/>
<text x="68" y="1320" font-size="22" font-weight="700">donext.co.uk/bristol/</text>
<text x="1014" y="1320" text-anchor="end" font-size="19">Source: National Trust</text>
</g></svg>`;
await writeFile(root+'2026-09-14-bristol-free-estates.svg', svg);
await sharp(Buffer.from(svg)).png().toFile(root+'2026-09-14-bristol-free-estates.png');
console.log('Created 1080 × 1350 original graphic. Inspect before scheduling.');

import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const sharp = require('sharp');
const logo = await readFile('/workspace/scratch/3724edc62e48/bristol-artcart-20260915/donext-bristol-avatar-v4.png');
const logoData = logo.toString('base64');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1080" height="1350" viewBox="0 0 1080 1350">
  <rect width="1080" height="1350" fill="#fff8eb"/>
  <rect width="1080" height="18" fill="#f34808"/>
  <image x="64" y="52" width="174" height="174" xlink:href="data:image/png;base64,${logoData}"/>
  <g font-family="DejaVu Sans, sans-serif" fill="#25271f">
    <text x="1014" y="104" text-anchor="end" font-size="25" font-weight="700" letter-spacing="2">BRISTOL WEEKDAY FIND</text>
    <text x="1014" y="146" text-anchor="end" font-size="24">TUESDAY–SUNDAY · 11AM–6PM</text>

    <text x="64" y="330" font-size="82" font-weight="800" letter-spacing="-3">A FREE PLACE</text>
    <text x="64" y="420" font-size="82" font-weight="800" letter-spacing="-3" fill="#e84005">TO MAKE.</text>
    <text x="68" y="475" font-size="28">A small indoor plan for creative children</text>

    <rect x="64" y="532" width="952" height="300" rx="24" fill="#f34808"/>
    <g fill="#fff8eb">
      <text x="104" y="600" font-size="22" font-weight="700" letter-spacing="2">ARNOLD ART CART</text>
      <text x="104" y="670" font-size="50" font-weight="800">ARNOLFINI · SECOND FLOOR</text>
      <text x="104" y="724" font-size="28" font-weight="700">16 Narrow Quay · BS1 4QA</text>
      <text x="104" y="778" font-size="27">Creative materials · table-top easels</text>
    </g>

    <rect x="64" y="870" width="294" height="188" rx="22" fill="#eaeedc"/>
    <rect x="385" y="870" width="294" height="188" rx="22" fill="#eaeedc"/>
    <rect x="706" y="870" width="310" height="188" rx="22" fill="#eaeedc"/>
    <text x="211" y="936" text-anchor="middle" font-size="25" font-weight="800">FREE</text>
    <text x="211" y="986" text-anchor="middle" font-size="22">family activity</text>
    <text x="532" y="936" text-anchor="middle" font-size="25" font-weight="800">SELF-LED</text>
    <text x="532" y="986" text-anchor="middle" font-size="22">grown-up help</text>
    <text x="861" y="936" text-anchor="middle" font-size="25" font-weight="800">LEVEL ACCESS</text>
    <text x="861" y="986" text-anchor="middle" font-size="22">lifts to all floors</text>

    <text x="68" y="1126" font-size="28" font-weight="700">Our pick: roughly ages 3–12 with a grown-up</text>
    <text x="68" y="1172" font-size="23">Not a staffed workshop. Materials may vary.</text>
    <text x="68" y="1212" font-size="23">Free admission; drop-in spaces are kept available.</text>
    <path d="M64 1260H1016" stroke="#25271f" stroke-width="1"/>
    <text x="68" y="1310" font-size="23" font-weight="700">donext.co.uk/bristol/</text>
    <text x="1014" y="1310" text-anchor="end" font-size="19">Details checked 15 September</text>
  </g>
</svg>`;

const dir = '/workspace/scratch/3724edc62e48/bristol-artcart-20260915/';
await writeFile(dir + '2026-09-15-bristol-art-cart.svg', svg);
await sharp(Buffer.from(svg)).jpeg({ quality: 92, chromaSubsampling: '4:4:4' }).toFile(dir + '2026-09-15-bristol-art-cart.jpg');
console.log('Created 1080 x 1350 JPEG');

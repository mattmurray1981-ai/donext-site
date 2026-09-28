import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const sharp = require('sharp');
const logo = await readFile('assets/brand/bristol/donext-bristol-avatar-v4.png');
const logoData = logo.toString('base64');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1080" height="1350" viewBox="0 0 1080 1350">
  <rect width="1080" height="1350" fill="#fff8eb"/>
  <rect width="1080" height="18" fill="#f34808"/>
  <image x="64" y="52" width="174" height="174" xlink:href="data:image/png;base64,${logoData}"/>
  <g font-family="DejaVu Sans, sans-serif" fill="#25271f">
    <text x="1014" y="104" text-anchor="end" font-size="25" font-weight="700" letter-spacing="2">BRISTOL INDOOR FIND</text>
    <text x="1014" y="146" text-anchor="end" font-size="24">TUESDAY–SUNDAY · 10AM–5PM</text>

    <text x="64" y="330" font-size="78" font-weight="800" letter-spacing="-3">A FREE MUSEUM</text>
    <text x="64" y="420" font-size="78" font-weight="800" letter-spacing="-3" fill="#e84005">TREASURE HUNT.</text>
    <text x="68" y="477" font-size="28">Track down tiny Aardman treasures</text>

    <rect x="64" y="530" width="952" height="306" rx="24" fill="#f34808"/>
    <g fill="#fff8eb">
      <text x="104" y="598" font-size="22" font-weight="700" letter-spacing="2">MINI-MUSEUM HUNT</text>
      <text x="104" y="668" font-size="45" font-weight="800">BRISTOL MUSEUM &amp; ART GALLERY</text>
      <text x="104" y="724" font-size="29" font-weight="700">Queens Road · BS8 1RL</text>
      <text x="104" y="782" font-size="27">Pick up a detective map on arrival</text>
    </g>

    <circle cx="226" cy="962" r="100" fill="#eaeedc"/>
    <circle cx="226" cy="962" r="49" fill="none" stroke="#25271f" stroke-width="15"/>
    <path d="M260 998l56 56" stroke="#25271f" stroke-width="18" stroke-linecap="round"/>

    <rect x="385" y="870" width="294" height="188" rx="22" fill="#eaeedc"/>
    <rect x="706" y="870" width="310" height="188" rx="22" fill="#eaeedc"/>
    <text x="532" y="936" text-anchor="middle" font-size="25" font-weight="800">FREE</text>
    <text x="532" y="986" text-anchor="middle" font-size="22">entry + map</text>
    <text x="861" y="936" text-anchor="middle" font-size="25" font-weight="800">ALL AGES</text>
    <text x="861" y="986" text-anchor="middle" font-size="22">families welcome</text>

    <text x="68" y="1135" font-size="28" font-weight="700">Running until 1 November 2026</text>
    <text x="68" y="1182" font-size="23">An indoor hunt around the museum.</text>
    <text x="68" y="1222" font-size="23">Children explore with their grown-up.</text>
    <path d="M64 1260H1016" stroke="#25271f" stroke-width="1"/>
    <text x="68" y="1310" font-size="23" font-weight="700">donext.co.uk/bristol/</text>
    <text x="1014" y="1310" text-anchor="end" font-size="19">Checked 17 September</text>
  </g>
</svg>`;

const base = '.github/research/social/artwork/2026-09-17-bristol-aardman-hunt';
await writeFile(`${base}.svg`, svg);
await sharp(Buffer.from(svg)).jpeg({ quality: 92, chromaSubsampling: '4:4:4' }).toFile(`${base}.jpg`);
console.log('Created 1080 x 1350 JPEG');

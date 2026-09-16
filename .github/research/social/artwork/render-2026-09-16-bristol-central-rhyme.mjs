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
    <text x="1014" y="104" text-anchor="end" font-size="25" font-weight="700" letter-spacing="2">BRISTOL · TODAY</text>
    <text x="1014" y="146" text-anchor="end" font-size="24">WEDNESDAY 16 SEPTEMBER</text>

    <text x="64" y="330" font-size="79" font-weight="800" letter-spacing="-3">SONGS FOR</text>
    <text x="64" y="420" font-size="79" font-weight="800" letter-spacing="-3" fill="#e84005">LITTLE ONES.</text>
    <text x="68" y="476" font-size="29">A free 20-minute library session</text>

    <rect x="64" y="532" width="952" height="302" rx="24" fill="#f34808"/>
    <g fill="#fff8eb">
      <text x="104" y="600" font-size="22" font-weight="700" letter-spacing="2">RHYME &amp; STORY TIME</text>
      <text x="104" y="670" font-size="52" font-weight="800">10.45AM THIS MORNING</text>
      <text x="104" y="726" font-size="31" font-weight="700">Bristol Central Library</text>
      <text x="104" y="782" font-size="27">College Green · BS1 5TL</text>
    </g>

    <rect x="64" y="870" width="294" height="188" rx="22" fill="#eaeedc"/>
    <rect x="385" y="870" width="294" height="188" rx="22" fill="#eaeedc"/>
    <rect x="706" y="870" width="310" height="188" rx="22" fill="#eaeedc"/>
    <text x="211" y="936" text-anchor="middle" font-size="25" font-weight="800">FREE</text>
    <text x="211" y="986" text-anchor="middle" font-size="22">no booking</text>
    <text x="532" y="936" text-anchor="middle" font-size="25" font-weight="800">AGES 0–3</text>
    <text x="532" y="986" text-anchor="middle" font-size="22">older siblings welcome</text>
    <text x="861" y="936" text-anchor="middle" font-size="25" font-weight="800">AROUND 20 MIN</text>
    <text x="861" y="986" text-anchor="middle" font-size="22">songs and rhymes</text>

    <text x="68" y="1132" font-size="27" font-weight="700">One librarian-led singalong with your child.</text>
    <text x="68" y="1180" font-size="23">The Central Library timetable runs all year.</text>
    <text x="68" y="1220" font-size="23">Children stay with their grown-up.</text>
    <path d="M64 1260H1016" stroke="#25271f" stroke-width="1"/>
    <text x="68" y="1310" font-size="23" font-weight="700">donext.co.uk/bristol/</text>
    <text x="1014" y="1310" text-anchor="end" font-size="19">Checked 16 September</text>
  </g>
</svg>`;

const base = '.github/research/social/artwork/2026-09-16-bristol-central-rhyme';
await writeFile(`${base}.svg`, svg);
await sharp(Buffer.from(svg)).jpeg({ quality: 92, chromaSubsampling: '4:4:4' }).toFile(`${base}.jpg`);
console.log('Created 1080 x 1350 JPEG');

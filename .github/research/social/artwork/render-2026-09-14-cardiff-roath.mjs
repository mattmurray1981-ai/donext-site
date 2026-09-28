import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const sharp = require('sharp');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const logo = await fs.readFile(path.join(root, 'assets/brand/cardiff/donext-cardiff-avatar-v4.png'));
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350">
<rect width="1080" height="1350" fill="#faf7ef"/>
<rect width="1080" height="18" fill="#f13c08"/>
<image x="78" y="64" width="172" height="172" href="data:image/png;base64,${logo.toString('base64')}"/>
<g font-family="Arial, Helvetica, sans-serif" fill="#20201d">
<text x="1002" y="117" text-anchor="end" font-size="27" font-weight="700">Interesting things.</text>
<text x="1002" y="153" text-anchor="end" font-size="27" font-weight="700">For Cardiff kids.</text>
<text x="78" y="302" fill="#bb2c06" font-size="24" font-weight="700" letter-spacing="2.3">19–20 SEPTEMBER 2026</text>
<text x="73" y="401" font-size="83" font-weight="900" letter-spacing="-2.8">A FREE QUIZ</text>
<text x="73" y="491" font-size="83" font-weight="900" letter-spacing="-2.8">TRAIL IN ROATH</text>
<text x="78" y="555" font-size="35" font-weight="700">St Margaret’s Church · Open Doors</text>
<text x="78" y="601" font-size="31">A little history hunt for curious children.</text>
<rect x="78" y="650" width="924" height="315" rx="12" fill="#f13c08"/>
<g fill="#faf7ef">
<text x="116" y="706" font-size="25" font-weight="700" letter-spacing="1.1">SATURDAY 19 SEPTEMBER</text>
<text x="116" y="763" font-size="46" font-weight="700">12.30–5.30pm</text>
<path d="M116 791H964" stroke="#faf7ef" stroke-opacity=".5"/>
<text x="116" y="836" font-size="25" font-weight="700" letter-spacing="1.1">SUNDAY 20 SEPTEMBER</text>
<text x="116" y="893" font-size="46" font-weight="700">2–5.30pm</text>
<text x="116" y="936" font-size="27" font-weight="700">Free entry · no booking</text>
</g>
<text x="78" y="1024" font-size="31" font-weight="700">Our pick: ages 5–12 with a grown-up</text>
<text x="78" y="1072" font-size="29">Waterloo Road, Roath · CF23 5AD</text>
<text x="78" y="1119" font-size="27">Accessible church entry through the porch.</text>
<text x="78" y="1159" font-size="27">The tower climb is adults only.</text>
<path d="M78 1200H1002" stroke="#d7d2c6" stroke-width="2"/>
<text x="78" y="1262" font-size="34" font-weight="700">donext.co.uk</text>
<text x="1002" y="1261" text-anchor="end" font-size="25">Programme: Cadw</text>
</g>
</svg>`;
const output = path.join(root, 'assets/social/2026-09-14-cardiff-roath-open-doors.jpg');
await fs.mkdir(path.dirname(output), { recursive: true });
await sharp(Buffer.from(svg)).flatten({background:'#faf7ef'}).jpeg({quality:94,chromaSubsampling:'4:4:4'}).toFile(output);
console.log(output);

import fs from 'node:fs/promises';
import path from 'node:path';

export const htmlPaths = ['/index.html', '/now.html', '/now/index.html', '/thank-you.html'];
export const avatarPath = '/assets/brand/cardiff/donext-cardiff-avatar-v4.png';
export const sharePath = '/assets/brand/cardiff/donext-cardiff-share-v4.png';

export function brandFiles(source, avatar, share) {
  const changes = new Map();
  const dimensions = buffer => ({ width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) });
  const av = dimensions(avatar), og = dimensions(share);
  const logo = `<img class="wordmark__logo" src="${avatarPath}" width="${av.width}" height="${av.height}" alt="DoNext Cardiff">`;
  for (const file of htmlPaths) {
    let html = source.get(file)?.toString('utf8');
    if (!html) throw new Error(`Missing live HTML: ${file}`);
    const oldMark = /<span class="wordmark__name">DoNext<\/span>\s*<span class="wordmark__place">Cardiff<\/span>/g;
    if ([...html.matchAll(oldMark)].length !== 1) throw new Error(`Unexpected masthead structure in ${file}`);
    html = html.replace(oldMark, logo);
    html = html.replace(/<meta name="theme-color"[^>]*>/, '<meta name="theme-color" content="#F0440B">');
    html = html.replace(/^.*<link rel="(?:icon|apple-touch-icon)"[^>]*>\r?\n/gm, '');
    html = html.replace('</head>', `  <link rel="icon" href="/favicon.svg?v=4" type="image/svg+xml">\n  <link rel="icon" href="${avatarPath}" type="image/png" sizes="${av.width}x${av.height}">\n  <link rel="apple-touch-icon" href="${avatarPath}" sizes="${av.width}x${av.height}">\n</head>`);
    if (file !== '/thank-you.html') {
      html = html.replace(/^.*<meta (?:property|name)="(?:og:image(?::[^"\s]+)?|twitter:card|twitter:image(?::[^"\s]+)?)"[^>]*>\r?\n/gm, '');
      html = html.replace('</head>', `  <meta property="og:image" content="https://donext.co.uk${sharePath}">\n  <meta property="og:image:type" content="image/png">\n  <meta property="og:image:width" content="${og.width}">\n  <meta property="og:image:height" content="${og.height}">\n  <meta property="og:image:alt" content="DoNext Cardiff — interesting things to do with kids">\n  <meta name="twitter:card" content="summary_large_image">\n  <meta name="twitter:image" content="https://donext.co.uk${sharePath}">\n  <meta name="twitter:image:alt" content="DoNext Cardiff — interesting things to do with kids">\n</head>`);
      if (!html.includes('<div class="wrap footer-inner">')) throw new Error(`Missing footer in ${file}`);
      html = html.replace('<div class="wrap footer-inner">', `<div class="wrap footer-inner">\n      <a class="wordmark wordmark--footer" href="/" aria-label="DoNext Cardiff home">${logo}</a>`);
    }
    changes.set(file, Buffer.from(html));
  }
  const css = source.get('/style.css')?.toString('utf8');
  if (!css || css.includes('Approved orange identity v4')) throw new Error('Missing or already branded CSS');
  changes.set('/style.css', Buffer.from(css + `\n/* Approved orange identity v4: one master on web and social profiles. */\n.header-inner { min-height: 6.75rem; padding-block: 0.75rem; }\n.wordmark { flex: none; align-items: center; }\n.wordmark__logo { display: block; width: 5rem; height: 5rem; max-width: none; border-radius: 50%; object-fit: cover; }\n.nav { min-width: 0; flex-wrap: wrap; justify-content: flex-end; }\n.nav a { text-align: right; }\n.wordmark--footer { justify-self: start; margin-bottom: 0.35rem; }\n.wordmark--footer .wordmark__logo { width: 5.5rem; height: 5.5rem; }\nhtml { scroll-padding-top: 7.5rem; }\n@media (max-width: 380px) {\n  .wordmark__logo { width: 4.5rem; height: 4.5rem; }\n  .nav { column-gap: 0.6rem; row-gap: 0.5rem; font-size: 0.875rem; }\n}\n`));
  changes.set(avatarPath, avatar);
  changes.set(sharePath, share);
  changes.set('/apple-touch-icon.png', avatar);
  // Standalone SVG wrapper embeds the approved pixels unchanged.
  changes.set('/favicon.svg', Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${av.width}" height="${av.height}" viewBox="0 0 ${av.width} ${av.height}"><image width="${av.width}" height="${av.height}" href="data:image/png;base64,${avatar.toString('base64')}"/></svg>\n`));
  changes.set('/assets/brand/README.md', Buffer.from(`# DoNext city identity — v4\n\nApproved orange concept, 7 September 2026. The canonical Cardiff master is cardiff/donext-cardiff-avatar-v4.png (${av.width} × ${av.height}). Use these exact pixels for Instagram, Facebook and website branding. The website crops the square to a circle in CSS.\n\nThe bold stacked cream Do / Next lettering and widely spaced city name define the identity. Keep decorative skyline motifs and coloured city labels out of the mark. Change only the city name for future city editions; preserve lettering, spacing, orange field and circular safe area.\n\nSocial previews use cardiff/donext-cardiff-share-v4.png (${og.width} × ${og.height}). Page metadata declares its actual dimensions. Root favicon.svg embeds the same master unchanged; apple-touch-icon.png also uses the master. Existing v2/v3 files are historical only.\n\nDo not redraw the mark in a substitute font, stretch it, add shadows or place graphics within it. Use this master on all future feed, Story and email designs. Event artwork must retain readable what / when / where / ages / cost / organiser details.\n\nDeploy branding as a scoped overlay on the current published Netlify deployment. The live catalog, analytics functions and other production files may be newer than this repository; a whole-repository deploy can remove them.\n`));
  if (source.has('/weekend-brief.html')) {
    let email = source.get('/weekend-brief.html').toString('utf8');
    const firstHeader = '<tr><td style="background:#0F766E;padding:18px 24px;">';
    if (!email.includes(firstHeader)) throw new Error('Unexpected weekend email header structure');
    email = email.replace(firstHeader, `${firstHeader}\n<a href="https://donext.co.uk/"><img src="https://donext.co.uk${avatarPath}" alt="DoNext Cardiff" width="88" height="88" style="display:block;border:0;border-radius:50%;margin-bottom:16px;"></a>`);
    changes.set('/weekend-brief.html', Buffer.from(email));
  }
  return changes;
}

if (process.argv[2]) {
  const input = path.resolve(process.argv[2]);
  const output = path.resolve(process.argv[3]);
  const assets = path.resolve(process.argv[4]);
  const source = new Map();
  for (const file of [...htmlPaths, '/style.css']) source.set(file, await fs.readFile(path.join(input, file)));
  const changes = brandFiles(source, await fs.readFile(path.join(assets, 'donext-cardiff-avatar-v4.png')), await fs.readFile(path.join(assets, 'donext-cardiff-share-v4.png')));
  for (const [file, bytes] of changes) {
    const destination = path.join(output, file);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.writeFile(destination, bytes);
  }
  console.log(JSON.stringify([...changes].map(([file, bytes]) => ({ file, bytes: bytes.length })), null, 2));
}

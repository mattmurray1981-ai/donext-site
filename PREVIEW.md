# Preview — DoNext Cardiff redesign

**Status:** Build files only. Production not deployed.

## What changed

Replaced the bloated Perplexity Computer SPA with a lean editorial static site.

| Before | After |
| --- | --- |
| `index.html` ~1100 lines, SPA chrome | Lean single-page IA (~180 lines) |
| `style.css` ~95KB / 4k lines | Warm cream + teal editorial CSS (~450 lines) |
| `app.js` ~50KB router / swipe / club | ~20-line bootstrap |
| Wrong schema.org → perplexity.ai | Correct `donext.co.uk` WebSite JSON-LD |
| Club / swipe / themes / personalisation | Gone from public pages |

## Kept

- `data/cardiff-today.json`, `SCHEMA.md`, `featured-history.json` (+ docs)
- Netlify Forms `weekend-brief` / `weekday-morning` → `/thank-you`
- `/now` via `_redirects` + `now.html`
- `cardiff-catalog.js` CTA preference (`organiserUrl` → `bookingUrl` → `url`) and age bands 0–4 / 5–8 / 9–12 (rewritten renderer)
- Favicons, `netlify.toml`, `__forms.html`
- Fontshare Sentient + General Sans

## New visual system

- Mobile-first, cream/off-white (`#F7F3EC`), deep ink, **teal** accent (`#0F766E`)
- Sticky header: DoNext + Cardiff + This weekend + Get the Friday brief
- Hero USP + “Checked …” freshness + soft Met Office link
- Age chips: All / 0–4 / 5–8 / 9–12 (single-select)
- Hero pick (“If you do one thing”) then dated cards
- Compact “Back-pocket backups” for evergreen
- Footer honesty line + IG `@donext_cardiff` + `/now`

## How to preview locally

```bash
cd /workspace/donext-deploy/donext-site-main
npx --yes serve .
# or: python3 -m http.server 8080
```

Then open `http://localhost:3000/` (or the port printed). Confirm:

1. Hero USP copy matches product brief
2. Catalog loads; age chips filter dated + evergreen
3. Hero card is visually distinct
4. CTAs go to organiser/booking URLs (not Facebook groups / leadUrl)
5. Friday brief form posts to Netlify (on a Netlify deploy preview)
6. `/now` and `/thank-you` match the new look

## Not done

- No production deploy
- `cardiff-activities.js` left on disk but unused (safe to delete later)

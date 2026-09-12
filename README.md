# DoNext — Cardiff and Bristol

Lean static site for [donext.co.uk](https://donext.co.uk) — a Friday-decision shortlist of Cardiff kids’ plans (ages 0–12), not an events database.

Bristol lives at [donext.co.uk/bristol/](https://donext.co.uk/bristol/) with its own static metadata, orange city logo, catalog and signup confirmation. The shared renderer selects a fixed city catalog using `body[data-city]`; Bristol never falls back to Cardiff data. City navigation works without JavaScript.

The Bristol catalog is `data/bristol-today.json`. Editorial launch notes and the independent featured history are in `.github/research/bristol-launch.md` and `.github/research/bristol-featured-history.json` (not deployed). Research and subscriber email automation for Bristol still need to be connected separately.

## Product

**USP:** The best few Cardiff kids’ plans for this weekend. Locally checked, age-fit and mostly free. No Saturday-morning trawl.

**Support:** We hunt Cardiff kids stuff. Every Friday at 3:30, get the best few locally checked plans for ages 0–12—mostly free, with age, price and booking details sorted.

## Redesign (2026)

The previous Perplexity Computer SPA (swipe UI, club chrome, heavy CSS/JS, wrong schema.org URLs) was replaced with a purpose-built minimal static page: sticky header, hero USP, age chips, hero pick, dated cards, compact evergreen backups, and Netlify Forms signup.

## Catalog data

Listings are **not** hardcoded in HTML. The site reads:

```text
data/cardiff-today.json
```

Schema: [`data/SCHEMA.md`](data/SCHEMA.md). Featured history: [`data/featured-history.json`](data/featured-history.json).

- **`datedPicks`** — verified, date-specific picks (may be empty).
- **`evergreen`** — always-on venue backups with official URLs.
- **`updatedAt`** — honest last-checked stamp; stale banner after ~36 hours.
- Age filters: **All / 0–4 / 5–8 / 9–12**.
- Public CTA order: `organiserUrl` → `bookingUrl` → `url`. Never `leadUrl`.

## Morning automation

1. Verify Cardiff family listings from organiser/venue sources.
2. Overwrite `data/cardiff-today.json` (real `updatedAt`, fill `datedPicks`, keep real evergreen URLs).
3. Update `data/featured-history.json` when publishing a campaign.
4. Commit and deploy via your usual Netlify branch flow.

Empty `datedPicks` is valid — UI stays empty/stale-safe and still shows backups.

## Email signup

Netlify Forms (declared in static HTML at deploy time):

- `weekend-brief` — primary Friday **3:30** weekend brief.
- `weekday-morning` — optional weekday mornings.

Hidden field declarations also live in `__forms.html`. Success redirect: `/thank-you`.

Every current form also sends a hidden `city` field. Segment future mail by `cardiff` or `bristol`; historical submissions without this field are Cardiff. Bristol's success route is `/bristol/thank-you/`. Both city pages describe signup as interest registration while the email service is prepared.

## Routes

- `/` — homepage shortlist + signup
- `/now` → `now.html` (Instagram bio destination)
- `/thank-you` → `thank-you.html`

## Local preview

Serve the repo root over HTTP (required for `fetch('./data/cardiff-today.json')`):

```bash
npx --yes serve .
# or: python3 -m http.server 8080
```

Open `/` or `/now.html`. Do not open `index.html` via `file://` — catalog fetch will fail.

## Intentionally unused / legacy

- `cardiff-activities.js` — legacy hardcoded activities; **not** loaded on the homepage.
- Old club / leaderboard / swipe / personalisation UI — removed from the public pages.


## City pages and publishing

Cardiff, Bristol and Birmingham share the catalog renderer and page templates. Edit `.github/templates/` and run `python3 .github/scripts/generate-city-pages.py`; generated pages are checked in CI. City definitions live in `.github/cities.json`. Each city has its own catalog and both signup forms carry a hidden `city` value. Birmingham uses the approved corrected logo.

Signup links: `/#brief`, `/bristol/#brief`, `/birmingham/#brief`. These collect interest in Friday or weekday emails; no email delivery service is configured in this repository. Confirm Netlify form detection and a recorded test submission before announcing email delivery.

For another city, add its definition and approved assets, register its catalog in the shared renderer, extend the release routes/contract and add aliases in `netlify.toml`. Then regenerate pages and `_redirects`. Run `node --test tests/catalog.test.cjs .github/scripts/deployment.test.mjs`. Direct publishers must preserve this structure and pass the same checks. Publishing old page or renderer copies can undo the signup and expiry fixes.

On 12 September 2026 the three catalogs were reconciled against identical live JSON, normalized to explicit session times, and cleaned of internal sourcing fields. Existing per-event `checkedAt` and catalog research timestamps were retained: this was an editorial repair, not a claim of freshly checked organiser availability.

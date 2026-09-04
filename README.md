# DoNext Cardiff

Lean static site for [donext.co.uk](https://donext.co.uk) — a Friday-decision shortlist of Cardiff kids’ plans (ages 0–12), not an events database.

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

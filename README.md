# DoNext

Static Cardiff family-events site for [donext.co.uk](https://donext.co.uk).

## Catalog data

Cardiff listings are **not** hardcoded in HTML.

The static site reads:

```text
data/cardiff-today.json
```

Schema: [`data/SCHEMA.md`](data/SCHEMA.md).

- **`datedPicks`** — verified, date-specific picks for the current window (may be empty).
- **`evergreen`** — always-on venue backups with official URLs.
- **`updatedAt`** — honest last-checked timestamp. If older than ~36 hours (`staleAfterHours`), the page shows a stale banner.
- Age filters: **0–4 / 5–8 / 9–12**.

## Morning automation (overwrite + deploy)

Typical weekday/weekend job:

1. Gather and verify today’s Cardiff family listings from organiser/venue sources.
2. Build a fresh `data/cardiff-today.json` (set real `updatedAt`, fill `datedPicks`, keep real evergreen URLs).
3. Commit on a working branch (do **not** force-push `main`):

   ```bash
   git add data/cardiff-today.json
   git commit -m "Update Cardiff today catalog"
   git push
   ```

4. Merge the PR (or push to the Netlify production branch) so Netlify rebuilds and publishes the new JSON.

Empty `datedPicks` is valid — the UI stays empty/stale-safe and still shows evergreen backups.

## Email signup

Homepage and Cardiff forms use **Netlify Forms**:

- `weekend-brief` — primary Friday **3:30pm** weekend brief (hero mail).
- `weekday-morning` — optional weekday morning brief.

Forms must remain in static HTML at deploy time (`data-netlify="true"` + hidden `form-name`) so Netlify can register them. Check submissions in the Netlify site admin → Forms.

## Instagram

Cardiff page links to [@DoNextCardiff](https://www.instagram.com/DoNextCardiff/).

## Soft-hidden surfaces

Club membership, community leaderboard, and admin are soft-hidden while those backends are not production-ready. Community discovery code remains in the repo for later.

## Local preview

Serve the repo root over HTTP (required for `fetch('./data/cardiff-today.json')`), e.g.:

```bash
npx --yes serve .
```

Then open the Cardiff view (`#cardiff`).

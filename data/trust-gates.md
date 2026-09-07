# DoNext trust gates (private ops)

Hard publish rules for `cardiff-today.json` and the public site. Prefer silence over thin or touristy pad.

## Before any pick goes live

1. **Organiser verify required** — Confirm title, date/time, place, ages, cost, and booking on the organiser/venue page (or official booking page). Aggregators and Facebook groups are leads only.
2. **`checkedAt` must be set** — ISO-8601 with Europe/London offset on every dated pick you publish or refresh.
3. **Confidence honest** — `high` only when organiser page confirms the dated slot. Use `medium` + `statusNote` when partially confirmed (e.g. date solid, hours soft).
4. **Public CTAs only** — `organiserUrl` → `bookingUrl` → `url`. Never Facebook group URLs. Never invent events.

## Past dates must not render as current

- Catalog hygiene: remove or archive dated picks whose `date` is before today (Europe/London) from the live `datedPicks` array.
- Site JS (`cardiff-catalog.js`): filter `datedPicks` to `date >= today` (London). If none remain, show the weekend-over empty state; still render evergreen + still-true notices.
- Do not leave Saturday heroes sitting in the Sunday catalog.

## Re-verify cadence

- Re-verify organiser pages before the Friday email and before same-day social.
- Refresh `updatedAt` and per-pick `checkedAt` on every publish.
- If cancelled, sold out, wrong date, or unverifiable: drop from `datedPicks` and log `rejectReason` (or archive note) in `data/sourcing/candidates.json`.

## Editorial don’ts

- Prefer an empty `datedPicks` array over filler.
- No queer/Pride-framed kids content.
- Keep `staleAfterHours` honest (default 36); do not bump it to hide an old catalog.

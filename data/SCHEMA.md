# cardiff-today.json schema

City catalogs consumed at `/data/{city}-today.json` for Cardiff, Bristol and Birmingham.

## Top level

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `schemaVersion` | number | yes | Currently `1`. |
| `city` | string | yes | Display city name, e.g. `"Cardiff"`. |
| `updatedAt` | string (ISO-8601 with offset) | yes | Honest editorial/automation timestamp used for the last-updated stamp and stale banner. |
| `sourceCheckedAt` | string (ISO-8601 with offset) | no | Last research update, preserved during formatting-only edits so stale warnings remain honest. |
| `staleAfterHours` | number | no | Defaults to `36`. If `now - sourceCheckedAt` (or `updatedAt` on older catalogs) exceeds this, the UI shows a stale banner. |
| `headline` | string | no | Optional short heading for the Cardiff report card. |
| `summary` | string | no | Optional one-line status copy under the heading. |
| `notices` | array of notice | no | Relevant closures / travel notes, collapsed below the shortlist. |
| `datedPicks` | array of pick | yes | Date-specific curated events for the current publishing window. May be `[]`. |
| `evergreen` | array of pick | yes | Always-on venue backups with real official URLs. May be `[]`. |

## notice

| Field | Type | Required |
| --- | --- | --- |
| `title` | string | yes |
| `detail` | string | yes |
| `sourceName` | string | no |
| `sourceUrl` | string (https) | no |
| `startDate`, `endDate` | string (`YYYY-MM-DD`) | for bounded notices |
| `expiresAt` | string (ISO-8601 with London offset) | yes for time-sensitive notices |
| `weekdays` | number[] | no; Sunday = 0 through Saturday = 6 |
| `relatedPickIds`, `relatedVenueIds` | string[] | no; only show alongside matching picks/venues |

Notices must overlap the selected date window. Set an honest expiry and recheck closures rather than leaving them indefinitely. Weather prose without an expiry is suppressed; an expired forecast must never guide the shortlist. The permanent Met Office link is for parents checking before travel.

## pick (dated or evergreen)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | string | yes | Stable slug. |
| `title` | string | yes | |
| `date` | string (`YYYY-MM-DD`) | dated only | Calendar date for a dated pick (Europe/London day). |
| `time` | string | no | Human-readable time window. |
| `startsAt`, `endsAt` | string (ISO-8601 with London offset) | dated, when times are known | Example: `2026-09-12T10:00:00+01:00`. Use the correct GMT/BST offset for the event date, not the writer's local timezone. `endDateTime` is accepted as a legacy alias. |
| `endDate` | string (`YYYY-MM-DD`) | no | Last calendar day of a multi-day event when an exact end time is unavailable. |
| `seriesId` | string | repeated events | Shared identity for the same experience across sessions; distinct experiences need distinct series. |
| `sessionId` | string | repeated events | Unique session identity; retain a separate record for each actual date/time. |
| `location` | string | yes | |
| `neighbourhood` | string | dated picks | Short area shown on cards; keep the full venue/address in `location`. |
| `cost` | string | yes | Real cost including required adult tickets, booking fees and parking when known. Distinguish free entry from paid activities. State an unknown final fee rather than guessing a total. |
| `ageBands` | string[] | yes | Subset of `"0-4"`, `"5-8"`, `"9-12"`. |
| `ageSuitability` | string | dated picks | Specific stage/range, e.g. “Babies who are not yet walking”. Label editorial judgments “DoNext fit” and distinguish them from organiser age rules. Unknown ages must not be assigned to every band. |
| `description` | string | yes | |
| `url` | string (https) | yes | **Primary public CTA.** Prefer `organiserUrl` when actionable; else `bookingUrl`. Never a Facebook group URL. |
| `sourceName` | string | no | Organiser credit, displayed separately from the action button. |
| `indoorOutdoor` | `"indoor"` | `"outdoor"` | `"either"` | no | |
| `confidence` | `"high"` or `"medium"` | no | For medium, explain the uncertainty in `parentTip` or `statusNote`; a confidence label alone is not useful parent advice. |
| `statusNote` | string | no | Extra caution copy. |

### Optional link fields

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `organiserUrl` | string (https) | no | Public source of truth (venue/organiser page). Preferred public CTA when it has actionable details. |
| `bookingUrl` | string (https) | no | Official booking destination (Eventbrite only when the organiser uses it for booking, or it is the only verifiable listing). |
| `donextUrl` | string (https) | no | DoNext editorial/shortlist page — only when it adds verdict, age/price, booking status, advice or last-checked. Not a redirect-only wrapper. |
| `ctaLabel` | `"See session details"` or `"Book tickets"` | no | Default organiser action is “See session details”. Set “Book tickets” with a verified `bookingUrl` when direct booking is the useful destination (for example, the organiser URL is only a general calendar). |

**Public CTA order:** `organiserUrl` → `bookingUrl` → legacy `url`. Set `url` to the chosen public CTA so older renderers stay correct. Never expose Facebook-group links. Credit the venue/organiser publicly.

The explicit `ctaLabel: "Book tickets"` option chooses the verified `bookingUrl` first. Never label a general venue homepage “Book tickets”. **Do not include `leadUrl` or `whyPicked` in this public catalog JSON:** hiding them in HTML does not make the downloadable JSON private. Facebook-group leads and internal rationale belong in `.github/research/`, which is excluded from the deployment archive, or in the protected sourcing store.

### Optional editorial fields

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `score` | number | no | Selection score. Publish ≥65; hero ≥80. |
| `role` | `"hero"` | `"feature"` | `"backup"` | no | Campaign role for this pick. |
| `appeal` | string | dated picks | One short, parent-facing reason the child might enjoy it. No internal scoring, age-band balancing or sourcing commentary. |
| `parentTip` | string | dated picks | One useful practical note: booking, costs, adult supervision, capacity or access. |
| `parentHeadsUp` | string | legacy | Fallback for `parentTip`; do not duplicate the same advice in multiple fields. |
| `checkedAt` | string (ISO-8601 with London offset) | dated picks | Actual last verification time for this pick. |
| `bookingStatus` | string | no | Human status, e.g. `free drop-in`, `book ahead`, `selling fast`. |
| `image` | object | no | Optional authorised real event photo: `{ "url": "https://…", "alt": "…", "credit": "…", "sourceUrl": "https://…" }`. Keep evidence of permission/licence in `.github/research/`. Only the hero uses the photo. Do not invent a photo of an actual event or imply that unrelated stock shows the event. |

Campaign-level anti-repeat history lives in [`featured-history.json`](./featured-history.json) — see [`FEATURED-HISTORY.md`](./FEATURED-HISTORY.md).

## Display dates and social links

- The homepage defaults to **This weekend**: the upcoming Saturday/Sunday during the week, and the current Saturday/Sunday on Sunday. `?when=today` shows only today's remaining sessions. Dates and checks are London time.
- Sessions disappear at `endsAt`; a day-only event stays through its London calendar day. Never invent an end time solely to satisfy the schema. The legacy `time` fallback recognises clear 24-hour ranges only.
- `seriesId` groups repeat sessions after date and age filtering. Each selected session keeps its date/time, and differing prices or booking destinations remain visible. A named `hero` wins within the eligible shortlist, with score breaking ties. `backup` picks cannot become the hero.
- Add `?age=0-4`, `?age=5-8` or `?age=9-12` for a saved age filter. Missing suitability is excluded from a specific-age view; an honest empty view is better than filler.
- Social links can use `https://donext.co.uk/#pick-<id>`. A current linked weekday session selects its date automatically and adds a temporary date tab. The explicit equivalent is `?when=YYYY-MM-DD#pick-<id>`; weekend/today retain their normal tabs. Use the session's stable `id`, and avoid promoting an already finished session.

## Rules for automation

1. Overwrite this file each morning after editorial checks.
2. Put only verified, date-specific items in `datedPicks`.
3. Keep `evergreen` to real venues with official URLs.
4. Set `updatedAt` to the real check time (UK offset).
5. Prefer an empty `datedPicks` array over invented filler — the UI is empty/stale-safe.
6. Set `organiserUrl` / `bookingUrl` / `url` per the link policy above; never put `leadUrl`, `whyPicked` or other private sourcing details in public JSON or HTML.
7. Append or update `featured-history.json` for the same campaign when publishing.
8. Add verified end timestamps, parent-facing appeal/age/cost/tip fields and shared series IDs on each update. Keep a compact set of distinct discoveries; tourist venues belong in backups unless a specific activity merits selection.
9. Check date/filter behaviour with `node --test tests/catalog.test.cjs` after renderer or schema changes. The checks cover expiry, London daylight saving, Sunday boundaries, duplicate sessions and empty age selections.

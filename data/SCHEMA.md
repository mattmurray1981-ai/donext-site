# cardiff-today.json schema

Static Cardiff catalog consumed by the site at `./data/cardiff-today.json`.

## Top level

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `schemaVersion` | number | yes | Currently `1`. |
| `city` | string | yes | Display city name, e.g. `"Cardiff"`. |
| `updatedAt` | string (ISO-8601 with offset) | yes | Honest editorial/automation timestamp used for the last-updated stamp and stale banner. |
| `staleAfterHours` | number | no | Defaults to `36`. If `now - updatedAt` exceeds this, the UI shows a stale banner. |
| `headline` | string | no | Optional short heading for the Cardiff report card. |
| `summary` | string | no | Optional one-line status copy under the heading. |
| `notices` | array of notice | no | Closures / travel notes shown above picks. |
| `datedPicks` | array of pick | yes | Date-specific curated events for the current publishing window. May be `[]`. |
| `evergreen` | array of pick | yes | Always-on venue backups with real official URLs. May be `[]`. |

## notice

| Field | Type | Required |
| --- | --- | --- |
| `title` | string | yes |
| `detail` | string | yes |
| `sourceName` | string | no |
| `sourceUrl` | string (https) | no |

## pick (dated or evergreen)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | string | yes | Stable slug. |
| `title` | string | yes | |
| `date` | string (`YYYY-MM-DD`) | dated only | Calendar date for a dated pick (Europe/London day). |
| `time` | string | no | Human-readable time window. |
| `location` | string | yes | |
| `cost` | string | yes | |
| `ageBands` | string[] | yes | Subset of `"0-4"`, `"5-8"`, `"9-12"`. |
| `description` | string | yes | |
| `url` | string (https) | yes | **Primary public CTA.** Prefer `organiserUrl` when actionable; else `bookingUrl`. Never a Facebook group URL. |
| `sourceName` | string | no | Link label; defaults to “Details”. |
| `indoorOutdoor` | `"indoor"` | `"outdoor"` | `"either"` | no | |
| `confidence` | `"high"` | `"medium"` | no | Medium shows a “check before travel” cue. |
| `statusNote` | string | no | Extra caution copy. |

### Optional link fields

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `leadUrl` | string (https) | no | **Private discovery source only** (may include Facebook groups). **Never rendered** on the public site, email CTAs, or Instagram. Ops/automation only. |
| `organiserUrl` | string (https) | no | Public source of truth (venue/organiser page). Preferred public CTA when it has actionable details. |
| `bookingUrl` | string (https) | no | Official booking destination (Eventbrite only when the organiser uses it for booking, or it is the only verifiable listing). |
| `donextUrl` | string (https) | no | DoNext editorial/shortlist page — only when it adds verdict, age/price, booking status, advice or last-checked. Not a redirect-only wrapper. |

**Public CTA order:** `organiserUrl` → `bookingUrl` → legacy `url`. Set `url` to the chosen public CTA so older renderers stay correct. Never expose Facebook-group links. Credit the venue/organiser publicly.

### Optional editorial fields

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `score` | number | no | Selection score. Publish ≥65; hero ≥80. |
| `role` | `"hero"` | `"feature"` | `"backup"` | no | Campaign role for this pick. |
| `whyPicked` | string | no | Why DoNext chose it (parent-facing). |
| `parentHeadsUp` | string | no | Practical complication: booking, parking, capacity, sensory, weather. |
| `checkedAt` | string (ISO-8601 with offset) | no | Last verification time for this pick. |
| `bookingStatus` | string | no | Human status, e.g. `free drop-in`, `book ahead`, `selling fast`. |

Campaign-level anti-repeat history lives in [`featured-history.json`](./featured-history.json) — see [`FEATURED-HISTORY.md`](./FEATURED-HISTORY.md).

## Rules for automation

1. Overwrite this file each morning after editorial checks.
2. Put only verified, date-specific items in `datedPicks`.
3. Keep `evergreen` to real venues with official URLs.
4. Set `updatedAt` to the real check time (UK offset).
5. Prefer an empty `datedPicks` array over invented filler — the UI is empty/stale-safe.
6. Set `organiserUrl` / `bookingUrl` / `url` per the link policy above; never put `leadUrl` in public HTML.
7. Append or update `featured-history.json` for the same campaign when publishing.

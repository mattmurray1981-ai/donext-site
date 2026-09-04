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
| `url` | string (https) | yes | Official / source link only — never invent events or fake URLs. |
| `sourceName` | string | no | Link label; defaults to “Details”. |
| `indoorOutdoor` | `"indoor"` \| `"outdoor"` \| `"either"` | no | |
| `confidence` | `"high"` \| `"medium"` | no | Medium shows a “check before travel” cue. |
| `statusNote` | string | no | Extra caution copy. |

## Rules for automation

1. Overwrite this file each morning after editorial checks.
2. Put only verified, date-specific items in `datedPicks`.
3. Keep `evergreen` to real venues with official URLs.
4. Set `updatedAt` to the real check time (UK offset).
5. Prefer an empty `datedPicks` array over invented filler — the UI is empty/stale-safe.

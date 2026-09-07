# Featured history

`featured-history.json` is the anti-repeat ledger. Every time we publish picks (Mon–Thu shortlist, Friday weekend brief, Saturday same-day, midday hot alert), we append a **campaign** with one **feature** row per event.

Site, email, Instagram and Facebook that ship the same shortlist share one campaign — not four duplicate rows.

## Feature row

| Field | Notes |
| --- | --- |
| `eventId` | Matches a catalog pick `id` (this specific date/instance) |
| `seriesId` | Stable series key for recurring formats (e.g. `cardiff-farmers-markets`) |
| `venueId` | Stable venue key (e.g. `chapter`) |
| `campaignId` | e.g. `morning-2026-09-08`, `weekend-2026-09-11`, `sat-2026-09-12`, `midday-2026-09-09` |
| `role` | `hero` \| `feature` \| `backup` \| `mention` (morning/midday thin touch) |
| `score` | Publish ≥65, hero ≥80 |
| `publishedAt` | ISO-8601 with UK offset |
| `channels` | Subset of `site`, `email`, `instagram`, `facebook` |
| `override` | Reason string when breaking a cooldown, else `null` |

## Cooldowns (hard rules — 2026-09-05)

Before featuring anything, read this file and apply:

| What | Cooldown |
| --- | --- |
| Same **eventId** | Never again as a “new” pick; one reminder only with `override` |
| Same **seriesId** as **hero** | **21 days** |
| Same **seriesId** as feature/mention | **14 days** |
| Same **venueId** as Friday hero | **No two Fridays in a row** |
| Tourist / evergreen backup (Museum, Techniquest, Castle, St Fagans, soft play) | **60 days** as anything but labelled backup; never hero |
| Same event/series **same calendar day** across morning + midday + Sat | Blocked |
| Midday hot alert | ≥80, free/unusual, within 48h, absent from that morning’s shortlist + 7-day history |

If the only options left are inside cooldowns → publish fewer picks or “No strong fresh find today.” Never pad.

## Campaign naming

- `morning-YYYY-MM-DD` — Mon–Thu shortlist email
- `weekend-YYYY-MM-DD` — Friday 3:30 brief (date = Friday)
- `sat-YYYY-MM-DD` — Saturday same-day
- `midday-YYYY-MM-DD` — hot alert (only when we ping)

Write/update this file alongside every successful `cardiff-today.json` publish and every emailed shortlist.

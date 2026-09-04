# Featured history

`featured-history.json` records editorial **campaigns** (e.g. a Friday weekend brief), not one entry per channel. Site, email, Instagram and Facebook that ship the same shortlist share one campaign and one feature row per event.

## Feature row

| Field | Notes |
| --- | --- |
| `eventId` | Matches a catalog pick `id` |
| `seriesId` | Stable series key for recurring formats |
| `venueId` | Stable venue key |
| `campaignId` | e.g. `weekend-2026-09-04` |
| `role` | `hero` \| `feature` \| `backup` |
| `score` | Publish ≥65, hero ≥80 |
| `publishedAt` | ISO-8601 with UK offset |
| `channels` | Subset of `site`, `email`, `instagram`, `facebook` |
| `override` | Reason string when breaking a cooldown, else `null` |

## Cooldowns

- **Exact event:** do not re-feature before it happens; one final reminder only when justified (record `override`).
- **Recurring series:** 14 days after a normal feature; **28 days** after a hero.
- **Same venue + category:** 14 days between hero placements.
- **Tourist / evergreen backup:** 60 days.
- **Morning vs midday:** block the same event and series on the same day.
- **Midday alert:** score ≥80, free/cheap, unusual, within 48 hours, and absent from that morning’s shortlist.

Write a new campaign (or append features) alongside every successful publication of `cardiff-today.json`.

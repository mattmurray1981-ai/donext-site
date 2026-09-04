# DoNext sourcing engine (private ops)

**Private.** This folder is ops-only. It is not linked from the public site, not referenced in `index.html`, and must never be exposed as a public nav or CTA.

## Purpose

Checkpointed ingestion of Cardiff family-activity leads into DoNext candidates, then verified organiser-backed picks for `data/cardiff-today.json`.

## Rules (hard)

1. **Facebook groups are quiet ops leads only.** Use them to discover what’s happening; never treat a group post as a public source of truth.
2. **Never publish group URLs.** No Facebook group links in public HTML, email CTAs, Instagram captions, or any user-facing surface. Keep group names / lead URLs only inside this `data/sourcing/` layer (`candidates.json`, run notes).
3. **Public credit goes to the organiser only.** Prefer `organiserUrl`, then `bookingUrl`. See `../SCHEMA.md` public CTA order.
4. **Gmail label:** inbound Facebook mail is labelled **`DoNext/Leads`**. Ingestion is driven from that label plus the checkpoint query in `checkpoint.json`.
5. **Checkpointed ingestion.** Every run advances `checkpoint.json` (`lastProcessedAt`, `lastHistoryId`, `lastRunId`) and appends a row to `runs.json`. Do not reprocess the same Gmail history window blindly.

## Registry size

See `SOURCE-TARGETS.md` for the live coverage map. Target: **40–60+** actionable sources for Cardiff kids 0–12 (+~30 min). Current `sources.json`: **70** rows (~39 active web/venue/community, 9 lead_only, 12 facebook_group, 10 gaps).

## Files

| File | Role |
| --- | --- |
| `sources.json` | Registry of web venues/listings and Facebook-group placeholders / coverage gaps |
| `checkpoint.json` | Gmail query, label, and last-processed cursor |
| `candidates.json` | Lead pipeline (private fields allowed) |
| `CANDIDATES.md` | Schema for `candidates.json` |
| `runs.json` | Per-run counters and notes |
| `SOURCING.md` | Operating procedure (Matthew’s 7 steps) + report line format |
| `SOURCE-TARGETS.md` | Expanded count + coverage map (central / bay / canton / north / east / penarth / barry / caerphilly) |

## Safety reminder

`neverPublishUrl: true` on every `facebook_group` source. If a candidate only has a group `leadUrl`, status stays below `published` until an organiser/venue URL is verified.

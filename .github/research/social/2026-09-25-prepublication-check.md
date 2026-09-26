# DoNext pre-publication check — 25 September 2026

Checked at `2026-09-25T08:27:00+01:00`. This is a delivery check for the already scheduled Bristol weekend campaign; it does not create a second campaign.

## Bristol scheduled campaign

- Publication time: **Friday 25 September 2026 at 15:30 Europe/London**.
- Metricool brand `6899892` was freshly re-read as **DoNext Bristol**, Instagram `donext_bristol`, Facebook Page `1278713381995669`, timezone `Europe/London`.
- Post ID: `381189013`; stable UUID: `8585809168106407338`.
- Planner: https://app.metricool.com/planner/calendar?blogId=6899892&openWithPostUuid=8585809168106407338
- A fresh calendar read returned exactly this one campaign for 25 September.
- Instagram and Facebook both remain `PENDING / Pending`; `autoPublish=true`, `draft=false`.
- Instagram's AI-media disclosure remains enabled.
- The three previously inspected carousel slides and the complete caption are recorded in [the 24 September research and delivery record](2026-09-24-research-and-delivery.md).
- No duplicate, edit or second Friday post was created.

## Venue recheck

### Ma-ad Science Mayhem

Freshly checked 25 September against:

- https://www.bristoldockyards.org/whats-on/ma-ad-science-mayhem
- https://www.bristoldockyards.org/tickets

The organiser still lists the event from **26 September to 1 November 2026**, indoors and outdoors, included with General Admission or Afternoon Saver admission. Current online prices still show £14.50 child / £22 adult for General Admission and £13 for the Afternoon Saver from 14:30.

### Windmill Hill City Farm

Freshly checked 25 September:

- https://windmillhillcityfarm.org.uk/pages/visit

The venue still lists free entry, donations welcome, seven-day opening from 09:00 to 17:00, animals, gardens, picnic space and children's play. It still warns that paths can be muddy in wet weather.

### Arnolfini Arnold Art Cart

Freshly checked 25 September:

- https://arnolfini.org.uk/whatson/arnold-art-cart/

Arnolfini still lists the Art Cart as free, on the second floor, Tuesday to Sunday from 11:00 to 18:00, with creative materials, exhibition activities and tabletop easels.

### M Shed harbour train

Primary source:

- https://www.bristolmuseums.org.uk/whats-on/m-shed/train-rides/

The organiser page timed out during two fresh fetch attempts on 25 September. Its date, time, fare and volunteer-operation details were successfully checked on 23–24 September and remain within the campaign's stated freshness window. The public caption retains the explicit instruction to call **0117 352 6600** before making a special journey. No cancellation signal was found; the campaign was not silently rewritten or duplicated.

## Direct Meta safeguards

- Main still has Cardiff, Bristol and Birmingham disabled in `.github/social/accounts.json`.
- Main's only queue entry is the expired Cardiff Roath item; it was not reused.
- The durable `donext-publishing-state/state.json` ledger remains version 1 with an empty `posts` object. It was not reset or modified.
- **Cardiff:** last credential was rejected; its gate remains disabled pending a valid replacement Page token and identity check.
- **Birmingham:** Page identity is pinned but no validated publishing token is stored; its gate remains disabled.
- No direct Meta send was attempted.

## Email boundary

The Bristol weekend subscriber email remains drafted in the 24 September record. It was **not sent**. No subscriber data, credentials, account flags, website code or catalog was changed.

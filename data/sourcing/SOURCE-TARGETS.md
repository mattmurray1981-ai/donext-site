# DoNext sourcing — source targets & coverage map

Private ops. Expanded hunt list for Cardiff kids **0–12** (plus ~30 min day-outs).  
Registry: `sources.json`. Updated: **2026-09-04** (Europe/London).

## Counts (registry)

| Bucket | Count |
| --- | ---: |
| **Total sources** | **70** |
| Active web / venue / community (hunt list) | 39 |
| Lead-only listings / backups | 9 |
| Facebook groups (active, neverPublishUrl) | 12 |
| Coverage gaps (`status: gap`, `needed: true`) | 10 |

Breakdown of the 39 active hunt sources: **8** `web` · **29** `venue` · **2** `community`  
(plus 12 active FB quiet-ops groups and 10 gap placeholders).

## Coverage map

| Zone | Web / venue / community anchors | FB / gap status |
| --- | --- | --- |
| **Central** | National Museum Cardiff, Museum of Cardiff, Sherman, New Theatre, Cardiff Castle, Bute Park, St David's Hall (monitor reopen), Met Office | City-wide FB groups active |
| **Bay** | WMC (+ indie markets), Techniquest, Cardiff Harbour Authority, CIWW, Ice Arena Wales (Vindico) | `fb-cardiff-bay-residents` active |
| **Canton / Riverside / Pontcanna** | Chapter (+ non-identity markets), Riverside Farmers Market, Cardiff Riding (confirm public kids) | `fb-canton-riverside-pontcanna` active |
| **Roath** | The Gate, Roath Farmers Market, Roath Park events (via Outdoor Cardiff) | Covered via city + Gate; watch local noticeboards |
| **North** (Llanishen / Heath / Whitchurch / Rhiwbina / Llandaff) | Lisvane & Llanishen Reservoirs, Rhiwbina Farmers Market, Castell Coch, Outdoor Cardiff / Forest Farm | **Gaps:** `gap-north-cardiff`, `gap-llanishen-heath`, `gap-whitchurch-rhiwbina`, `gap-llandaff` |
| **East** (Rumney / Llanrumney / Splott / Adamsdown) | Boulders Cardiff (Newport Road) | **Gaps:** `gap-east-cardiff`, `gap-rumney-llanrumney`, `gap-splott-adamsdown` |
| **Penarth** | Penarth Pavilion, Cosmeston Lakes | **Gap:** `gap-penarth` (parents group); Pavilion/Cosmeston web active |
| **Barry / Vale** | Porthkerry, Fonmon Castle, Visit The Vale (lead-only listings) | **Gap:** `gap-barry`; Visit Vale + Porthkerry + Fonmon web active |
| **Caerphilly** | Caerphilly Castle (Cadw), Cadw events board (lead-only) | **Gap:** `gap-caerphilly`; castle web active |
| **St Fagans / west** | St Fagans National Museum of History | City-wide FB + St Fagans venue |

## Category checklist

| Category | Sources (ids / names) |
| --- | --- |
| Arts / culture | Chapter, WMC, Sherman, New Theatre, St David's Hall, Tramshed, National Museum Cardiff, St Fagans, Museum of Cardiff, The Gate, The Other Room, Cardiff Castle |
| Science / play | Techniquest, Cardiff Harbour Authority; soft play = rare `lead_only` backup only |
| Outdoors / nature | Reservoirs, Bute Park, Outdoor Cardiff (+ events), Forest School providers, Roath Park, Cosmeston, Porthkerry, Penarth Pavilion, Castell Coch |
| Hubs / libraries | Cardiff Hubs, Cardiff Libraries children's (same calendar) |
| Markets / indie | Riverside, Roath, Rhiwbina; WMC indie markets; Chapter markets (non-identity) |
| Sport / active | Boulders, CIWW, Ice Arena Wales; Cardiff Riding if public kids sessions |
| Listings (lead-only) | Eventbrite family, It's On Cardiff, Visit Cardiff, WalesOnline family (confirm-only), Casgliad/council (confirm URL), Visit The Vale, Cadw events |
| Community | Churches/halls/PTA (watch FB+noticeboards, never publish group URLs); Howell's community if public |

## Cadence hint

- **Daily:** Met Office, Eventbrite, It's On Cardiff, Visit Cardiff, core city FB parent groups  
- **Friday:** Hubs/libraries, markets, Outdoor Cardiff events, community halls skim  
- **Weekly:** Venues (arts, Cadw, sport, Vale/Penarth/Barry day-outs)

## Hard rules (unchanged)

1. Facebook groups = quiet ops leads only; `neverPublishUrl: true`; no group URLs in public surfaces.  
2. Listings boards = lead-only until organiser/venue CTA verified.  
3. Soft play = rare indoor backup, not a core hunt pillar.  
4. Do not invent URLs — `url: null` + notes `confirm URL` when unsure.

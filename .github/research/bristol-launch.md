# Bristol launch — 7 September 2026

The founder explicitly requested Bristol expansion and created `donext_bristol`. This supersedes the previous Cardiff-only expansion preference.

## Public surfaces

- `/` and `/now`: Cardiff; existing catalog untouched.
- `/bristol/`: Bristol shortlist and orange city branding.
- `/bristol/thank-you/`: Bristol signup confirmation.
- Both city pages share `cardiff-catalog.js` (legacy filename), `app.js`, and CSS. Static `body[data-city]` selects a fixed catalog URL; mismatched city data fails closed.
- Existing `weekend-brief` and `weekday-morning` form names are preserved. Every current form carries `city=cardiff` or `city=bristol`. Historical records without a city belong to Cardiff. Any future sender must segment by this value.
- No subscriber sending or Bristol research automation was activated by this website change. The page states that the email service is being prepared.

## First shortlist

Five ideas for 12–13 September 2026. This is an initial verified list, not evidence of an established Bristol source-monitoring routine.

1. Spike Island: I Am Making Art / Parallel Imprints — Saturday 11:00–13:00, adults £3, children free, materials supplied. Primary page: https://www.spikeisland.org.uk/programme/events/i-am-making-art-parallel-imprints/ . Fresh organiser HTML confirms September and links Eventbrite event 1993903771856; a search-cache copy still showed April. Booking availability/checkout fees unverified.
2. Buzz Community Garden — Sunday 13:00–15:00, free edible treasure hunt and planting. Venue organiser: https://www.lockleazent.co.uk/event/buzz-community-garden-session-4-2-2/ . No organiser age minimum; 4–12 suitability is our labelled judgement.
3. Windmill Hill City Farm anniversary — Saturday 11:00–16:00. Organiser: https://windmillhillcityfarm.org.uk/products/windmill-hill-city-farms-50th-anniversary-fayre . Official linked Headfirst event 153664 confirms adult early bird £7 + 60p. Child under-16 £4 was advertised in https://windmillhillcityfarm.org.uk/blogs/news/windmill-hill-city-farm-50th-anniversary-fayre-line-up-announcement ; current child tier/fees unverified and explicitly qualified on the card.
4. Bramble Farm Get Growing Trail — Sunday 11:00–16:00, free entry, children's activities and animals. Trail organiser: https://bristolgoodfood.org/2026/07/17/get-growing-trail-2026/ . Published postal address differs from recommended satnav approach; both are labelled. No exact age range published.
5. RCG Fest — Saturday family session 12:00–18:00, £4 adult / £6 child, activities and drink included; food extra. Organiser: https://www.redcatchcommunitygarden.com/event-details/rcg-fest . Later session is adults only and excluded.

Spot at Redgrave was verified but omitted from this first shortlist to favour cheaper community discoveries. Cooking It's dated baking class was full. No invented photographs or organiser photographs with unclear reuse rights were added.

## Updating safely

Update only `/data/bristol-today.json` for Bristol runs, with real checked timestamps. Keep a separate Bristol featured history in this folder, preserving stable event IDs. Do not copy Cardiff picks, source coverage claims or email automation assumptions into Bristol. Recheck organiser pages and booking status before promotion. Normal date expiry/staleness and age filtering apply to both cities.

The full existing production preservation guard remains in place. New draft checks verify Bristol routes, city metadata, signup fields, confirmation and the exact public Bristol catalog before publication.

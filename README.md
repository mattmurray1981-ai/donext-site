# DoNext

Static Cardiff family-events site.

## Updating the Cardiff daily report

The dated report data lives in `window.DONEXT_CARDIFF_REPORT` at the end of
`cardiff-activities.js`. Each event has a stable ID, Cardiff calendar dates,
display details, confidence, and one or more source links. `app.js` selects the
current Cardiff date when it falls inside the report range and renders the day
tabs, forecast snapshot, closures, featured pick, and full event list.

When publishing a new report:

1. Verify every listing against its linked organiser or venue.
2. Replace the report dates and events; do not carry expired items forward.
3. Set `checkedAt` and `weatherCheckedAt` to real ISO timestamps with the UK
   offset. The page derives its freshness wording from `checkedAt`.
4. Give each day a preferred `featuredEventId`. The renderer de-duplicates
   featured IDs across the range.
5. Keep uncertain details qualified with `confidence: 'medium'` and a clear
   `statusNote`.

Newsletter controls and social links are intentionally inactive until those
services are connected.

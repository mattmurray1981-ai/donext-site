# candidates.json schema

Private lead pipeline. Stored as a JSON array in `candidates.json` (starts empty: `[]`).

**Private fields** (`groupName`, `leadUrl`, `gmailMessageId`, `gmailThreadId`, `flyerOcr`, `seenInGroups`) must never be copied into public catalog HTML, email CTAs, or Instagram.

## Candidate object

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string | Stable candidate id (slug or uuid). |
| `gmailMessageId` | string \| null | Gmail message id when sourced from mail. |
| `gmailThreadId` | string \| null | Gmail thread id when sourced from mail. |
| `groupName` | string \| null | **Private.** Facebook group display name only — never a URL. |
| `leadUrl` | string \| null | **Private.** Discovery URL (may be a group post). Never publish. |
| `postedAt` | string (ISO-8601) \| null | When the lead was posted / emailed. |
| `extractedTitle` | string \| null | Title parsed from email / OCR / listing. |
| `extractedWhen` | string \| null | Date/time hint as extracted (human or ISO). |
| `extractedWhere` | string \| null | Place hint as extracted. |
| `agesHint` | string \| null | Age band hint before verification. |
| `costHint` | string \| null | Cost hint before verification. |
| `flyerOcr` | string \| null | **Private.** Raw OCR text from flyer images. |
| `status` | enum | `new` \| `deduped` \| `rejected` \| `verifying` \| `verified` \| `published` |
| `rejectReason` | string \| null | Why rejected (duplicate, out of area, not family, etc.). |
| `organiserUrl` | string \| null | Verified public organiser/venue URL. |
| `bookingUrl` | string \| null | Official booking URL when applicable. |
| `score` | number \| null | Selection score; publish threshold aligns with catalog (≥65). |
| `firstSeenAt` | string (ISO-8601) | First time this lead entered the pipeline. |
| `lastSeenAt` | string (ISO-8601) | Most recent sighting. |
| `seenInGroups` | string[] | **Private.** Group names where this lead reappeared. |

## Status flow

`new` → `deduped` (merge into existing) **or** `verifying` → `verified` → `published`  
Any stage → `rejected` with `rejectReason`.

## Publish gate

A candidate may move to `published` only when:

1. `organiserUrl` (preferred) or actionable `bookingUrl` is set.
2. Details checked against the organiser (title, when, where, ages, cost).
3. No Facebook group URL will appear in the public pick (`url` / CTA fields).

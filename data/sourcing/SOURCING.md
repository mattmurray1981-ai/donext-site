# DoNext sourcing — operating procedure

Private ops. Facebook groups = quiet leads only. Never publish group URLs. Public credit = organiser only. Gmail label: **DoNext/Leads**. Always checkpoint.

## Matthew’s 7 steps

### 1. Open the run

- Mint a `runId` (e.g. `YYYYMMDD-HHMM` Europe/London).
- Read `checkpoint.json` and `sources.json`.
- Append a started row shape to `runs.json` (fill counters at the end).

### 2. Ingest Gmail leads (checkpointed)

- Query: value of `gmailQuery` in `checkpoint.json`  
  (`from:groupupdates@facebookmail.com OR from:facebookmail.com`).
- Scope to label **`DoNext/Leads`**.
- Process only mail newer than `lastProcessedAt` / after `lastHistoryId`.
- For each useful group-update email: create or update a `candidates.json` entry with **private** `groupName`, `leadUrl`, Gmail ids, extracted fields, `status: "new"`, and timestamps.
- Do **not** store or log Facebook group profile URLs in any public file.

### 3. Check active web sources

- Walk `sources.json` where `type: "web"` and `status: "active"`.
- Note Met Office for outdoor viability; venues/listings for dated family plans.
- Eventbrite is **lead-only** unless it is the organiser’s official booking destination.
- New web finds also land in `candidates.json` (no `groupName` / group `leadUrl`).

### 4. Deduplicate

- Match on title + when + where (and organiser if known).
- On hit: set newer row `status: "deduped"`, bump `lastSeenAt` / `seenInGroups` on the keeper.
- Count dedupes for the run report.

### 5. Verify against the organiser

- Move promising rows to `verifying`.
- Confirm title, date/time, place, ages, cost, booking on the **organiser/venue** page (or official booking page).
- Set `organiserUrl` / `bookingUrl`. Reject with `rejectReason` if unverifiable, out of area, not 0–12 family-fit, or lead-only with no public CTA.
- Score; `verified` only when publishable details are solid.

### 6. Publish (organiser credit only)

- Promote selected `verified` candidates into `../cardiff-today.json` per `../SCHEMA.md`.
- Public CTA order: `organiserUrl` → `bookingUrl` → `url`. **Never** `leadUrl` or any Facebook group URL.
- Update `../featured-history.json` when publishing a campaign window.
- Mark those candidates `published`.

### 7. Checkpoint + report

- Update `checkpoint.json`: `lastProcessedAt`, `lastHistoryId`, `lastRunId`.
- Finish the `runs.json` row: `finishedAt`, counters, short `notes`.
- Print the per-run report line (below).
- Note coverage `gap` / `needed: true` sources for follow-up (see `SOURCE-TARGETS.md`): north Cardiff (Llanishen/Heath/Whitchurch/Rhiwbina), Llandaff, east Cardiff (Rumney/Llanrumney/Splott/Adamsdown), Penarth parents, Barry parents, Caerphilly parents. Registry target: **40–60+** actionable sources (currently **70** total: ~39 active web/venue/community, 9 lead_only, 12 FB groups, 10 gaps).

## Per-run report line

Use exactly this shape (fill integers from the run):

```text
N sources checked · N group posts processed · N candidates · N verified · N published
```

Map to `runs.json` fields:

| Report token | Field |
| --- | --- |
| sources checked | `sourcesChecked` |
| group posts processed | `groupPostsProcessed` |
| candidates | `candidatesNew` (optionally note deduped separately in `notes`) |
| verified | `verified` |
| published | `published` |

Also record `candidatesDeduped` and `rejected` on the run object even if they are not in the one-line summary.

## runs.json object

| Field | Type |
| --- | --- |
| `runId` | string |
| `startedAt` | string (ISO-8601) |
| `finishedAt` | string (ISO-8601) \| null |
| `sourcesChecked` | number |
| `groupPostsProcessed` | number |
| `candidatesNew` | number |
| `candidatesDeduped` | number |
| `verified` | number |
| `published` | number |
| `rejected` | number |
| `notes` | string |

## Hard don’ts

- Do not put Facebook group URLs in `cardiff-today.json`, site HTML, email, or Instagram.
- Do not link this folder from the public site.
- Do not modify `index.html` as part of a sourcing run.
- Do not invent dated picks — empty `datedPicks` beats filler.

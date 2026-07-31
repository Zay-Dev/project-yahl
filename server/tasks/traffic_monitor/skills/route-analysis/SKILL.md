# route-analysis

How to fetch and compare multi-route driving ETAs for `origin` → `destination`.

## Place resolution (before first probe)

Do **not** paste raw brand/abbrev OD strings into map sites as if they were unique addresses.

1. Resolve ambiguous places first (`*resolve_place` / research): cinema chains, malls, building nicknames (e.g. `MCL, Kowloon Tong` → **Festival Walk MCL**, not Telford Plaza MCL in Kowloon Bay).
2. Produce `origin_resolved` / `destination_resolved` (canonical name + district; optional latlng). Prefer these for every bind/goto.
3. After goto, check origin/destination chips against **resolved** places (district + landmark), not only the raw runInput string.
4. Never accept autocomplete that changes district/landmark identity. Treat as **geocode fail** — do not reinterpret as “short trip, source only returns 1 route.”
5. If returned distance is implausible for the stated districts, fail the probe as geocode mismatch and upsert a SKIP/FAIL / place note — do not burn a city attempt as a multi-route source deficiency.
6. Persist disambiguation notes into `source-ops-{city_slug}` so later runs do not re-confuse the same brand.

## Fetch

Prefer Stagehand / `browser` against a **goto URL rebuilt every poll from context `origin_resolved` / `destination_resolved` (fallback to `origin` / `destination`)**, using **core** `traffic_source.howto_md` plus `*read(source_ops_md)` (attend Input ops — do not `const`-assign/`set_context` a full-blob copy). Do not bury unread `source_ops_md` as a `*func` kwarg. Do not paste ops history into `howto_md`.

Only use `run_bash` + curl when `~/data/{traffic_source_file}` documents a JSON/HTTP API (documented HTTP API exception — not for HTML scrape).

When `traffic_source.is_fallback` is true (or URL is the Google Maps directions template), follow `/opt/skills/google-maps-directions/SKILL.md` for bind + fetch + prevent rules.

### Directions URL (mandatory)

1. Persist / reuse only **placeholder** templates in `traffic_source.url` when the site supports URL binding (e.g. `https://example.com/dir/{origin}/{destination}/`). Form-fill sites may document a base entry URL in howto while still keeping a placeholder template in `url` when query params work. Never save a concrete prior A→B pair into `~/data` or `sources-{city_slug}`.
2. Before every `browser` `goto`, bind current resolved OD into that template with **deterministic** encoding — never hand-type percent-escapes:
   ```bash
   node -e 'const o=process.argv[1],d=process.argv[2],t=process.argv[3]; console.log(t.replaceAll("{origin}",encodeURIComponent(o)).replaceAll("{destination}",encodeURIComponent(d)))' -- "$ORIGIN" "$DESTINATION" "$TEMPLATE"
   ```
   Prefer Latin/English place names in the URL when non-Latin geocoding is ambiguous; keep local-script names for labels / day-page text.
3. Use the short canonical directions URL for the chosen site — do not paste SPA sessionful / `data=!…` address-bar URLs into `goto`.
4. After goto, check the origin/destination chips (or equivalent). If they do **not** match resolved origin/destination (district + landmark), treat the poll as a **fetch miss** / geocode fail — do not thrash with more gotos, edits, or alternate encodings.

### Browser budget

Per poll **and** per probe: at most **2** browser attempts (initial + 1 retry). If both fail (`ok: false`, timeout, blank page, **or OD mismatch**), stop retrying — leave `fetches` / `prev_routes` as-is (monitor-loop miss note) or fail that probe attempt. Do not open alternate tabs (runtime has a single page) or invent ETAs.

Capture up to **3** fastest private-car routes. For each route record:

- `label` — **iconic** geographic name when visible: tunnel, bridge, highway, estate, interchange, or main road for **this city**. Never default to `Route 1` / `Route A` / `Route N` when a landmark is available. Fallback only: `Primary` / `Alt 1` / `Alt 2`.
- `via` — secondary corridor if useful and not duplicated in `label`
- `eta_min` — integer minutes
- `distance_km` — when available
- `status` — `ok` | `slow` | `abnormal` | `unknown`

Also capture `incident_note` when the UI shows a crash, closure, or major disruption on a monitored corridor (short string; `''` if none).

Primary route = lowest `eta_min` (or the UI’s recommended route when clearly marked).

## Compare

Against the previous poll’s routes (same run window, in context):

- Prefer matching routes by iconic `via` / `label` fuzzy match; if a prior route disappeared, note it and compare on primary ETA instead.
- A route is **abnormal** when its `eta_min` is **> 120%** of that route’s previous ETA, or clearly worse than the same-morning baseline / “usual” when prior knowledge exists.

## Abnormal / notify triggers

Set `should_notify_abnormal` (and related patch fields) when **any** of:

1. **ETA spike** — route `eta_min` **> 120%** of that route’s previous ETA, or primary clearly worse than same-morning baseline; prefer notifying when another route is meaningfully better.
2. **New incident / disruption** — car crash / accident, lane closure, tunnel/bridge closed, major jam callout, police / tow, “incident reported”, flood, etc. visible for a monitored corridor. Put text in `incident_note`.
3. **Incident cleared** — prior successful poll had non-empty `prev_incident_note` and the current poll no longer shows that disruption. Treat as a first-class abnormal reason (e.g. “prior crash no longer reported”). Include cleared text for day-page / WhatsApp.
4. Primary ETA longer than usual versus same-day history even if all routes rose together.

Heartbeats must **not** substitute for these. Do not spam: if the same active incident or ETA-abnormal was already notified last poll and did not worsen / change, skip. **Do** notify on incident cleared (distinct from the original crash alert).

## Day page section format

Append one section per poll. `HH:MM` must be **`timezone`** wall clock — never label UTC as local. Every section **must** include `Origin` and `Destination` from context (same-day multi-route runs share one day page). Use iconic labels:

```markdown
## HH:MM {tz_label}

- Origin: …
- Destination: …
- <Iconic corridor>: N min — status
- <Alt corridor>: N min — status
- Recommended: …
- Incident: …          (when new)
- Incident cleared: … (previously: …)   (when cleared)
- Notes: …
```

Miss sections use the same header + Origin/Destination lines, then `- Fetch missed: …` / `- Using previous routes` — never invent ETAs.

`*format_fetch_section` / `*format_miss_section` must receive `origin` and `destination` from context.

## Daily report

After the window: `*read(holidays_md)` (attend only — no `const holidays =` / full-blob `set_context`) then classify the calendar day in `timezone` using Input `holidays_md` as `weekday` | `weekend` | `public_holiday`, summarize ETA series per iconic route, note peaks, incidents, and diversion recommendations, persist under `traffic-monitor` (`topic: knowledge_topic` — never omit topic). Same-day reports **append** to `raw/report-YYYY-MM-DD` with a run header that includes window + origin → destination.

Name the ETA **source** from context `traffic_source` only:

- If `traffic_source.is_fallback` is true **or** `url` is the Google Maps directions template → say Google Maps (budget fallback).
- Otherwise name the city source from `url` / howto (e.g. HKeMobility) — never claim Google Maps when a non-fallback city source was locked.

`*format_report_run_append(summary_md, origin, destination, monitor, timezone)` wraps `summary_md` for day-page append: leading `## Run — {origin} → {destination}` (plus window times from `monitor` in `timezone`), then the report body, so multiple same-day OD windows stack on one `raw/report-YYYY-MM-DD` page.

# route-analysis

How to fetch and compare multi-route driving ETAs for `origin` → `destination`.

## Fetch

Prefer Stagehand / `browser` against `traffic_source.url` using `traffic_source.howto_md`.

Only use `run_bash` + curl when `~/data/{traffic_source_file}` documents a JSON/HTTP API (same exception as HKO weather).

Use the short canonical directions URL from `traffic_source.url` — do not paste Maps SPA `data=!…` address-bar URLs into `goto`.

Per poll: at most **2** browser attempts (initial + 1 retry). If both fail (`ok: false`, timeout, blank page), stop retrying for this poll — leave `fetches` / `prev_routes` as-is and let monitor-loop skip with a day-page miss note. Do not open alternate tabs (runtime has a single page) or invent ETAs.

Capture up to **3** fastest private-car routes. For each route record:

- `label` — short name (e.g. via tunnel / corridor)
- `via` — tunnel / bridge / main corridor when visible
- `eta_min` — integer minutes
- `distance_km` — when available
- `status` — `ok` | `slow` | `abnormal` | `unknown`

Primary route = lowest `eta_min` (or the UI’s recommended route when clearly marked).

## Compare

Against the previous poll’s routes (same run window, in context):

- A route is **abnormal** when its `eta_min` is **> 120%** of that route’s previous ETA, or clearly worse than the same-morning baseline / “usual” when prior knowledge exists.
- Prefer matching routes by `via` / `label` fuzzy match; if a prior route disappeared, note it and compare on primary ETA instead.

## Notify

Propose WhatsApp when:

1. Second fetch of the window — overall summary (all routes).
2. Any route flips to abnormal **and** another route is meaningfully better — say which route is bad and which to take instead.
3. Primary ETA is longer than usual versus same-day history even if all routes rose together.

Do not spam: if the same abnormal condition was already notified on the previous poll and ETAs did not worsen further, skip.

## Day page section format

Append one section per poll. `HH:MM` must be **`timezone`** wall clock — never label UTC as local.

```markdown
## HH:MM

- Route A (via …): N min — status
- Route B (via …): N min — status
- Recommended: …
- Notes: …
```

## Daily report

After the window: classify the calendar day in `timezone` using `holidays_md` as `weekday` | `weekend` | `public_holiday`, summarize ETA series per route, note peaks and any diversion recommendations, persist under `traffic-monitor`.

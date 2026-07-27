# task-mission

Canonical mission for the traffic_monitor task.

## Mission text

Monitor private-car driving traffic from `origin` to `destination` (defaults: Kowloon Tong → Hong Kong International Airport) for about `monitor_minutes` minutes after run start (default 60). Discover or reuse a real-time multi-route ETA source, load or fetch the current year’s public holidays for `city` (default Hong_Kong → topic `hk-public-holidays`), load user-onboarding communication prefs and city source-ops knowledge before probing the live site, poll live ETAs for the top 2–3 routes (iconic corridor/tunnel/estate labels), append each poll to one wiki page for that calendar day, propose WhatsApp notifications in three kinds (initial summary after fetch #2, 15-min heartbeat when proactivity allows, abnormal/incident including cleared incidents), every 20 minutes upsert **novel-only** source-ops notes to nixery (`source-ops-{city_slug}`), then write a daily report classified as weekday / weekend / public holiday. Use `timezone` (default Asia/Hong_Kong) for all wall-clock labels and day classification.

## Rules for stage agents

1. Read this file via `run_bash`: `cat ~/task-skills/task-mission/SKILL.md`.
2. Origin/destination/mode come from run input context (with defaults above). Do not ask the user to change them mid-run. Rebuild every Maps/HKeMobility goto from context OD with deterministic `encodeURIComponent` (see route-analysis) — never hand-type percent-encoding, never reuse a concrete prior A→B URL from city knowledge.
3. Prefer city-scoped guidelines only: `~/data/{traffic_source_file}` and `~/data/{holidays_file_prefix}_{year}.md` when **usable** (see below). Do not reuse a traffic or holidays file from another city. Research when missing, absent, or probe fails. Keep `howto_md` as **stable core** re-fetch steps only — operational tricks live in nixery `source-ops-{city_slug}`, not in ever-growing howto. `traffic_source.url` must keep `{origin}/{destination}` placeholders.
4. Never reset `started_at` from context. Exit the monitor loop when `now - started_at >= monitor_minutes`.
5. Notifications are WhatsApp proposals only (`/mastermind(propose-notification, …)`), always `to: notify_to` (default `91234567`). Do not claim messages were sent. Draft every body from `userProfile` (user-onboarding `communication_style` / preferences) when present; if `userProfile` is `'<none>'`, use neutral professional tone, medium detail, default language, medium proactivity.
6. Persist poll snapshots by appending sections to one day page (`raw/fetches-YYYY-MM-DD`), not one page per poll. Calendar day and section headers use **`timezone`** wall clock — never label UTC clock values as local time. On every **successful** poll, `set_context` must extend `fetches` (one item) and update `prev_routes` **before** the day-page append — never prev-routes-only. Missed polls leave `fetches` unchanged, bump `miss_count`, and write a `Fetch missed` day-page note only.
7. Monitor stage sets `agentOverrides.bashTimeoutMs: 360000`. Use a single `sleep 300` / `180` / `60` per wait. Do not chunk, background (`&`), or wrap sleeps to dodge timeout.
8. Before any breaking change to stage procedure (sleep protocol, window length, thresholds, editing task skills / `SKILL.yahl`), call `/nixery(consult-breaking-change, …)`. If `agree: false`, follow `alternatives` — do not proceed.
9. Every `produceContextKeys` / `set_context` value must be **non-null** JSON (use `[]` / `{}` / `false` / `''` — never `null`).
10. Knowledge pages for traffic polls/reports use topic `knowledge_topic` (`traffic-monitor`). Holidays use `holidays_topic` derived from `city`. Lean traffic sources upsert under `sources-{city_slug}`. Operational notes upsert under `source-ops-{city_slug}` (novel-only append). When `get-knowledge` already returned a usable holidays list for the year, use it and **do not** research or `upsert` replace that page.
11. Before probing or polling the traffic website, load `source_ops_md` via nixery get-knowledge and use it together with core `howto_md`. Do not paste ops history into `howto_md`.

## WhatsApp notification kinds

Independent proposals — do not merge kinds into one body. If two are due on the same poll, send both.

| Kind | When | Body |
|------|------|------|
| Initial summary | Successful fetch #2 (`summary_notified` false → true) | Full early picture: all routes + recommendation; language/tone/detail from `userProfile` |
| Heartbeat | Wall-clock every 15 min from `started_at` when `*proactivity_allows_heartbeat(userProfile)` | Short still-running pulse; minor ETA drift only |
| Abnormal / incident | `analysis.should_notify_abnormal` (fetch count ≥ 2) | ETA spike, new incident, or **cleared** incident — never suppressed by low proactivity |

`*proactivity_allows_heartbeat`: false when communication style proactivity is clearly low/minimal; otherwise true (including `'<none>'` / medium / high).

## Holidays usability (`*holidays_list_usable`)

Treat extract or `~/data` as **absent** (do not persist as holidays) when any of:

- missing / empty / `'<none>'`
- body or frontmatter contains `absent: true`
- content is only an absent diagnostic (exploration steps, “topic has not been created”)
- no concrete dated public-holiday rows for `holidays_year`

Only then research official sources for `city` and overwrite `~/data/{holidays_file_prefix}_{year}.md`.

## Traffic source shape (`*normalize_traffic_source`)

`TTrafficSource` must have:

- `url` — http(s) live ETA page or API base
- `howto_md` — **inline markdown** core steps to re-fetch (not a path like `~/data/{traffic_source_file}`; not an ops scrapbook)
- `kind` — `browser` | `api`
- `city` — current run `city` (set when saving / normalizing)

## Source ops (`source_ops_md`)

- Retrieved before site use; refreshed in context when novel notes are upserted.
- Every 20 min: draft 0–5 candidate bullets → `*filter_novel_ops_notes` against `source_ops_md` → upsert only novel markdown to `source-ops-{city_slug}` (`mode: append`). If none novel, still bump `last_source_notes_at` (no empty upsert).
- Never append ops notes into `howto_md` or save the local traffic_source file solely for ops notes.

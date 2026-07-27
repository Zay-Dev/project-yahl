# task-mission

Canonical mission for the traffic_monitor task.

## Mission text

Monitor private-car driving traffic from `origin` to `destination` (defaults: Kowloon Tong → Hong Kong International Airport) for about `monitor_minutes` minutes after run start (default 60). Discover or reuse a real-time multi-route ETA source, load or fetch the current year’s public holidays for `city` (default Hong_Kong → topic `hk-public-holidays`), poll live ETAs for the top 2–3 routes, append each poll to one wiki page for that calendar day, propose WhatsApp notifications for the early summary and for abnormal route changes, then write a daily report classified as weekday / weekend / public holiday. Use `timezone` (default Asia/Hong_Kong) for all wall-clock labels and day classification.

## Rules for stage agents

1. Read this file via `run_bash`: `cat ~/task-skills/task-mission/SKILL.md`.
2. Origin/destination/mode come from run input context (with defaults above). Do not ask the user to change them mid-run.
3. Prefer city-scoped guidelines only: `~/data/{traffic_source_file}` and `~/data/{holidays_file_prefix}_{year}.md` when **usable** (see below). Do not reuse a traffic or holidays file from another city. Research when missing, absent, or probe fails.
4. Never reset `started_at` from context. Exit the monitor loop when `now - started_at >= monitor_minutes`.
5. Notifications are WhatsApp proposals only (`/mastermind(propose-notification, …)`), always `to: notify_to` (default `91234567`). Do not claim messages were sent.
6. Persist poll snapshots by appending sections to one day page (`raw/fetches-YYYY-MM-DD`), not one page per poll. Calendar day and section headers use **`timezone`** wall clock — never label UTC clock values as local time. On every **successful** poll, `set_context` must extend `fetches` (one item) and update `prev_routes` **before** the day-page append — never prev-routes-only. Missed polls leave `fetches` unchanged, bump `miss_count`, and write a `Fetch missed` day-page note only.
7. Monitor stage sets `agentOverrides.bashTimeoutMs: 360000`. Use a single `sleep 300` / `180` / `60` per wait. Do not chunk, background (`&`), or wrap sleeps to dodge timeout.
8. Before any breaking change to stage procedure (sleep protocol, window length, thresholds, editing task skills / `SKILL.yahl`), call `/nixery(consult-breaking-change, …)`. If `agree: false`, follow `alternatives` — do not proceed.
9. Every `produceContextKeys` / `set_context` value must be **non-null** JSON (use `[]` / `{}` / `false` / `''` — never `null`).
10. Knowledge pages for traffic polls/reports use topic `knowledge_topic` (`traffic-monitor`). Holidays use `holidays_topic` derived from `city`. Traffic sources upsert under `sources-{city_slug}`.

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
- `howto_md` — **inline markdown** steps to re-fetch (not a path like `~/data/{traffic_source_file}`)
- `kind` — `browser` | `api`
- `city` — current run `city` (set when saving / normalizing)

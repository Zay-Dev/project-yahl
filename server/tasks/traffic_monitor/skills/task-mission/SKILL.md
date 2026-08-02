# task-mission

Canonical mission for the traffic_monitor task.

## Mission text

Monitor private-car driving traffic from `origin` to `destination` (empty runInput defaults: Kowloon Tong → Hong Kong International Airport) for about `monitor_minutes` minutes after run start (default 60). Discover or reuse a real-time multi-route ETA source for `city` (empty default Hong_Kong → holidays topic via city path aliases), resolve notify target preference via nixery, load city source-ops knowledge, explore/probe a live ETA site (free research when knowledge is missing, fails, or prior source was Google Maps budget fallback — **at most 2** distinct city-local sources), poll live ETAs for the top 2–3 routes (iconic corridor/tunnel/bridge/highway labels for that city), append each poll to one wiki page for that calendar day (each section includes time + Origin + Destination), propose notifications in three kinds (initial summary after fetch #2, 15-min heartbeat when proactivity allows, abnormal/incident including cleared incidents), every 20 minutes upsert **novel-only** source-ops notes to nixery (`source-ops-{city_slug}`), then **append** a daily report run block to `raw/report-YYYY-MM-DD` under topic `traffic-monitor` (weekday / weekend / public holiday). Use `timezone` (empty default Asia/Hong_Kong) for all wall-clock labels and day classification.

## Explore / map-to-use (before monitor)

0. **Resolve places** before the first probe: brand/abbrev/mall/cinema ODs → `origin_resolved` / `destination_resolved` (canonical name + district). Never treat raw user strings as unique website inputs. Reject autocomplete that changes district (e.g. MCL Kowloon Tong ≠ Telford Plaza). Persist place notes to `source-ops-{city_slug}`.
1. Test existing knowledge’s recommended source (`sources-{city_slug}` / `~/data/{traffic_source_file}`) when present and `is_fallback` is not true. If the only candidate is Maps / `is_fallback: true`, treat as **no city source** and research city-local first. If the cached recommend is already known-failed in `source_ops_md` and Input `instruction_active` is false, **decline it without burning** `city_attempts` (record `skipped` with why) and treat as **no city source** — then research. If Input `instruction_active` is true, follow Input `source_instruction` instead of blind decline.
2. If missing, unusable, probe fails, or `is_fallback: true` → search and try other live map / ETA sites for this city — **at most 2** distinct city-local providers/domains (hard cap **this explore only**; `city_attempts` always starts at 0). Lock on the first successful probe. Do **not** keep researching a 3rd city source. Ignore OD-specific howto bleed from a different origin/destination pair.
2a. Maintain `tried_sources` (array of `{ name, url, what_tried, outcome: 'ok'|'failed'|'skipped', why, at }`). After every failed/skipped **research-loop** city attempt, **durably** append a structured `source-ops-{city_slug}` `SKIP/FAIL` bullet with **name + why + what was tried** (equal priority to success tips — not optional). Prefer `/nixery(upsert-knowledge-page, …, mode: append, value: markdown_string)`; on `ok: false` retry once with `content:` instead of `value`.
2b. Before researching a candidate, `*read(source_ops_md)` (attend only — do not `const`/`set_context` a full-blob copy) and read `tried_sources`. When Input `instruction_active` is false, do **not** re-probe a source whose skip/fail reason still applies — pick a different provider, or record `outcome: 'skipped'` (research-returned skips still count toward the cap of 2) without thrashing the browser. When Input `instruction_active` is true, follow Input `source_instruction` for this explore; do not blind-skip known-failed sources unless that instruction clearly forbids probing them. `*research_need_for_explore(..., instruction_active, source_instruction)` must include raw `source_instruction` when `instruction_active` is true and prefer that text over “avoid already failed/skipped in source_ops”. Prior ops / knowledge `budget.*` / “attempts exhausted” / `BUDGET` / `HISTORY` lines **never** skip the research loop or mean Research quota is spent.
2c. Fall back to `/google-maps-directions(origin_resolved, destination_resolved)` (Read `/opt/skills/google-maps-directions/SKILL.md`) when **2 this-session city attempts** have failed/skipped, **or** about to hit explore `maxTurns`, **or** research elapsed `> 30min` from `explore_started_at`. Hard-stop may cut off before 2 attempts — still fall back and persist a `HISTORY:` ops note (prior-run history only — not a durable quota); never invent a 3rd city try; never skip `/nixery(research)` because knowledge said budget exhausted.
2d. If fallback used → set `traffic_source.is_fallback: true` **in session only**. Do **not** `*save` Maps into `~/data/{traffic_source_file}` and do **not** upsert Maps as `sources-{city_slug}` — the next run must keep researching city-local sources with a fresh `city_attempts = 0`. Delete a leftover Maps fallback file if present.
2e. Fallback **must not** block persisting how to use Google Maps and what to prevent into `source-ops-{city_slug}`. Record the Maps attempt in `tried_sources` (Maps entry does not count toward the city cap of 2).
2f. Upsert locked **city** sources via lean **string** `value` with `is_fallback: false` (e.g. `city: …, kind: …, is_fallback: false, url: …`) — never a nested object; never upsert Maps as the city source.

## Rules for stage agents

1. Read this file via `run_bash`: `cat ~/task-skills/task-mission/SKILL.md`.
2. Origin/destination/mode come from run input context (with defaults above); prefer `origin_resolved` / `destination_resolved` for binds. Do not ask the user to change them mid-run. Rebuild every directions goto from `traffic_source.url` placeholders + resolved OD with deterministic `encodeURIComponent` (see route-analysis) — never hand-type percent-encoding, never reuse a concrete prior A→B URL from city knowledge.
3. Prefer city-scoped guidelines only: `~/data/{traffic_source_file}` and `~/data/{holidays_file_prefix}_{year}.md` when **usable** (see below). Do not reuse a traffic or holidays file from another city. Keep `howto_md` as **stable core** re-fetch steps only — operational tricks live in nixery `source-ops-{city_slug}`, not in ever-growing howto. Prefer `traffic_source.url` with `{origin}/{destination}` placeholders; form-fill sites may document a base entry URL in howto while keeping a placeholder template in `url` when supported.
4. Never reset `started_at` from context. Exit the monitor loop when `now - started_at >= monitor_minutes`.
5. Notifications via `/mastermind(propose-notification, …)` using resolved `notifyChannel` / `notifyTo` from `/nixery(resolve-notification-target, to: notify_to)` (`notify_to` remains a phone, default `91234567`). Do not claim messages were sent. Draft every body from `notifyPreference` (target prefs from the resolver — user-onboarding when `notifyIsUser`, else channel summary). Empty preference → neutral professional tone, medium detail, default language, medium proactivity.
6. Persist poll snapshots by appending sections to one day page (`raw/fetches-YYYY-MM-DD`), not one page per poll. Calendar day and section headers use **`timezone`** wall clock — never label UTC clock values as local time. Every fetch/miss section must include **time**, **Origin**, and **Destination** (context OD) so same-day multi-route runs stay distinguishable. On every **successful** poll, `set_context` must extend `fetches` (one item) and update `prev_routes` **before** the day-page append — never prev-routes-only. Missed polls leave `fetches` unchanged, bump `miss_count`, and write a `Fetch missed` day-page note only (still with Origin/Destination).
7. Monitor stage sets `agentOverrides.bashTimeoutMs: 360000`. Use a single `sleep 300` / `180` / `60` per wait. Do not chunk, background (`&`), or wrap sleeps to dodge timeout.
8. Before any breaking change to stage procedure (sleep protocol, window length, thresholds, editing task skills / `SKILL.yahl`), call `/nixery(consult-breaking-change, …)`. If `agree: false`, follow `alternatives` — do not proceed.
9. Every `produceContextKeys` / `set_context` value must be **non-null** JSON (use `[]` / `{}` / `false` / `''` — never `null`).
10. Knowledge pages for traffic polls/reports use topic `knowledge_topic` (`traffic-monitor`). Holidays use `holidays_topic` derived from `city`. Lean traffic sources upsert under `sources-{city_slug}`. Operational notes upsert under `source-ops-{city_slug}` (novel-only append). When `get-knowledge` already returned a usable holidays list for the year, use it and **do not** research or `upsert` replace that page.
11. Before probing or polling the traffic website, `*read(source_ops_md)` (seeded earlier via nixery get-knowledge → context) and use Input `source_ops_md` together with core `howto_md`. Do not `const`/`let`-assign or `set_context` a copy of the full ops blob unless novel merge changed it. Never pass unread `source_ops_md` as a `*func` kwarg. Do not paste ops history into `howto_md`.
12. Do not silently rewrite a non-placeholder URL to Google Maps outside the explicit budget-fallback branch. Prefer any working city-local live multi-route private-car ETA site; Maps is budget fallback only via `/google-maps-directions`.
13. Daily report / `summary_md` must name the **locked** `traffic_source` (Maps only when `is_fallback: true` or URL is the Maps directions template). Persist with `topic: knowledge_topic` always (never empty — empty topic fails upsert). Same-day reports **append** to `raw/report-YYYY-MM-DD` with a run header (window + origin → destination); `summary` / `analysis_md` keys replace with the latest brief. Confirm each upsert `ok: true` and `canonicalTopic` / path under `topics/traffic-monitor/`.

## WhatsApp notification kinds

Independent proposals — do not merge kinds into one body. If two are due on the same poll, send both.

| Kind | When | Body |
|------|------|------|
| Initial summary | Successful fetch #2 (`summary_notified` false → true) | Full early picture: all routes + recommendation; language/tone/detail from `notifyPreference` |
| Heartbeat | Wall-clock every 15 min from `started_at` when `*proactivity_allows_heartbeat(notifyPreference)` | Short still-running pulse; minor ETA drift only |
| Abnormal / incident | `analysis.should_notify_abnormal` (fetch count ≥ 2) | ETA spike, new incident, or **cleared** incident — never suppressed by low proactivity |

`*proactivity_allows_heartbeat`: false when preference clearly indicates low/minimal proactivity; otherwise true (including empty preference / medium / high).

## Holidays usability (`*holidays_list_usable`)

Treat extract or `~/data` as **absent** (do not persist as holidays) when any of:

- missing / empty / `'<none>'`
- body or frontmatter contains `absent: true`
- content is only an absent diagnostic (exploration steps, “topic has not been created”)
- no concrete dated public-holiday rows for `holidays_year`

Only then research official sources for `city` and overwrite `~/data/{holidays_file_prefix}_{year}.md`.

## Traffic source shape (`*normalize_traffic_source`)

`TTrafficSource` must have:

- `url` — http(s) live ETA page or API base with `{origin}/{destination}` placeholders when browser directions
- `howto_md` — **inline markdown** core steps to re-fetch (not a path like `~/data/{traffic_source_file}`; not an ops scrapbook)
- `kind` — `browser` | `api`
- `city` — current run `city` (set when saving / normalizing)
- `is_fallback` — `true` when Google Maps budget fallback was used; `false` when a probed city source is locked. Missing/legacy → treat as `false` only if URL is not the Maps directions template; otherwise treat as fallback for explore step 1

## Tried sources (`tried_sources`)

Explore produce key. City attempts (non-Maps URLs, excluding known-broken cached declines that do not burn the cap) must be **≤ 2** **this explore**. Every `failed` / `skipped` entry needs non-empty `why` and `what_tried`. Successful lock records `outcome: 'ok'`. Knowledge `budget.exhausted` is never a live stop.

## Source ops (`source_ops_md`)

- Attend before site use via `*read(source_ops_md)` (Input already holds the blob — do not re-`set_context` the full markdown every poll). Refresh context only when novel notes are upserted (`*set_context(source_ops_md)` after merge).
- During explore and every 20 min in monitor: draft candidate bullets → `*filter_novel_ops_notes` against `source_ops_md` → upsert only novel markdown to `source-ops-{city_slug}` (`mode: append`, prefer `value:` string; retry `content:` once on `ok: false`). If none novel, still bump `last_source_notes_at` in monitor (no empty upsert).
- **Fail notes are equal priority to success tips.** Explore failure/skip bullets are mandatory — always include the `SKIP/FAIL` line with why + what was tried when the outcome is new for that URL/name. `*filter_novel_ops_notes` must never drop a SKIP/FAIL as a duplicate of a howto/success tip; only dedupe against an existing SKIP/FAIL for the same provider/url+reason. If the filter still drops it, upsert the SKIP/FAIL line anyway.
- Prefer structured bullets: `- SKIP/FAIL {name} ({url}): {why}. Tried: {what_tried}.`
- Hard-stop / Maps fallback notes use `- HISTORY: …` (prior-run history). Do **not** write live `budget.exhausted` / “Research quota exhausted” / “remain on Maps” as durable status — next run resets `city_attempts` and must re-research.
- Include Google Maps howto / prevent notes when Maps is in use — `is_fallback` does not suppress those writes, but does not make Maps the city source lock.
- Never append ops notes into `howto_md` or save the local traffic_source file solely for ops notes.
- Strip OD-specific route lists from city-level sources howto; keep city-reusable tips only.

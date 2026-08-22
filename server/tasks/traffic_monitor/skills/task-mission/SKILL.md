# task-mission

Monitor private-car driving from `origin` → `destination` for about `monitor_minutes` (default 60). Resolve notify target, load city source-ops from durable files when fresh, explore/lock a live multi-route ETA source (**≤ 2** city-local attempts this explore; Maps is budget fallback only), poll top 2–3 routes, append day-page sections, propose notifications (see monitor-loop), submit novel+evidenced observations per `~/task-skills/worth-persisting-knowledge/SKILL.md`, then append a daily report raw page under topic `traffic-monitor`. The knowledge registry may canonicalize `traffic-monitor` to a merged slug (e.g. `traffic-notify`); that redirect is expected — not a validation failure. Defaults: Kowloon Tong → HKIA, city Hong_Kong, timezone Asia/Hong_Kong. Wall clocks use `timezone`.

## `source_instruction` override

When Input `instruction_active` is true, **read and apply** free-text `source_instruction` over explore/monitor defaults (trust-skip, known-fail decline, extract richness, notify wording). Do **not** phrase-match hardcoded strings.

- Default under active instruction: **do not** take blind `trusted durable cache; no re-probe` unless the instruction clearly allows trusting cache / skipping probe — live-probe the durable candidate (same as re-entry), then follow the rest of the instruction text.
- Do not blind-skip known-failed sources unless the instruction clearly forbids probing them.
- `*research_need_for_explore` must include raw `source_instruction` when active.

## Explore

0. Resolve places → `origin_resolved` / `destination_resolved` (district + landmark) for **browser bind** (EN when the provider needs EN autocomplete). Also set `origin_display` / `destination_display` from `notifyPreference` (zh* → official Chinese titles when they exist; empty/EN preference → same as resolved or runInput). Estate/building ≠ nearby MTR unless PLACE has `verified_proxy`.
1. Load candidate from `~/data/{traffic_source_file}` only. Maps / `is_fallback: true` → treat as no city source.
1a. **Cold-start trust** (`stage_goto_reason` empty **and** `instruction_active` false **and** durable file age ≤ stage `cacheMaxAge` minutes): usable non-fallback cache → lock without browser probe (`what_tried: 'trusted durable cache; no re-probe'`), strip OD bleed from `howto_md`, ensure `## HOWTO ({provider})` on source-ops, finish. Prefer Input `source_ops_md`. On the trust path: **do not** `Read` platform / nixery / stagehand skills; **do not** open browser; finish after lock + set_context only.
1b. **Re-entry / instruction_active / stale cache (older than `cacheMaxAge`) / untrusted cache**: live-probe (do not trust-skip) → research → Maps; preserve `started_at` on jump-and-continue.
2. Research/probe at most **2** city-local providers this explore. Maintain `tried_sources`. Every fail/skip needs durable SKIP/FAIL submit when novel. Cap **this explore only**; next run resets.
2c–2f. Maps fallback via `/google-maps-directions` when 2 attempts fail, about to hit `maxTurns`, or explore >30min — session-only `is_fallback: true`; never save/upsert Maps as city lock. Upsert city locks as lean string `is_fallback: false` only.

## Source ops

Attend via `*read(source_ops_md)` before site use; do not paste ops into `howto_md`. Submit novel source-ops / PLACE notes when worth persisting — never `upsert-knowledge-page`.

Notify kinds / poll loop / path extract → monitor-loop + route-analysis. Before breaking sleep/window/thresholds/skills, `/nixery(consult-breaking-change)`. Before inventing or growing a script, follow a consult gate under `~/task-skills/` when present (once, early); not mid-browser transcript.

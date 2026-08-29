# monitor-loop

One poll within a configurable window (`monitor_minutes`, default 60).

## Clock / sleep

Never overwrite `started_at`. Set `fetched_at` to **`now_iso` (UTC ISO)** — never local wall clock with a `Z` suffix. Use `timezone` only for day-page `## HH:MM` headings. Verify retry after the window → emit `monitor` from real `fetches` only.

Always compute wait via `*adaptive_sleep_sec(fetch_or_null, prev_primary_eta, started_at, monitor_minutes)` — no fixed first-poll branch in stage logic.

Policy targets (cap downward when the remaining window is short):

| When | Target `sleep_sec` |
|------|--------------------|
| First success (or no usable prior ETA) | 300 |
| Later, primary ETA ≤ 120% of previous | 180 |
| Later, primary ETA > 120% | 60 |
| Miss / null fetch | 180 (or prior primary ETA when known) |

`remaining_sec` = floor of seconds left until `started_at + monitor_minutes`. Cap so another poll can still run when `doAtLeast` or the window still allows it: never sleep the entire remainder; leave headroom for one fetch+tools turn. Prefer `min(target, max(30, remaining_sec - headroom))` with headroom large enough for a second poll body.

Single sleep per wait (`bashTimeoutMs: 360000`). No chunking / background / alternate waits without `consult-breaking-change` agree.

## WarmUp vs poll body

**warmUp** owns ensure-OD only: `goto-driving-search`, then `fill-origin-input` / `fill-destination-input` (+ `verify-od-bound`) when not `url_bound_od`. Never Search, wait for route cards, or run `search-driving-routes.js` in warmUp.

**submit_wait** owns Search + cards visibility. After warmUp, poll body starts at Search — never re-run fill-* on empty search (retry search / goto+search only).

## Poll body

Use stage `*get_or_create(~/data/scripts/{source_scripts_slug}/…, Instruction: …)` then run — do not `cat` scripts or re-read skills on later polls. Shared formatters live under `~/data/scripts/` root.

On success (`analyze`): `extend_context` on `fetches` (never `set_context` + `operation: extend`) + bump `poll_success_count` + update `prev_routes` / `prev_incident_note` **before** day-page append. `fetched_at` = `now_iso`; `timezone` for day-page headings only. Keep `fetches` on stage `contextKeys` — while segments merge by replace; dropping it from Input wipes prior polls.

Append section via `append-raw-knowledge-page` (`raw/fetches-YYYY-MM-DD`) with Path lines when present. Origin/Destination lines use `origin_display` / `destination_display` (fallback runInput). Mirror the same markdown into `day_page_sections` via `*extend_context` (stage logic owns this).

Notify checks (below), then novel-only ops observations. Always set `sleep_sec` then `__knowledge-to-script__notes`, then sleep once — never finish after notifications without both. The orchestrator decides whether another poll runs.

## Miss / dead source

≤ 2 browser attempts. Then bump `miss_count`, miss section, sleep. Never invent ETAs. Sustained dead source → `goto_stage` explorer with reason. On empty search results: retry search or goto+search only — **never** re-run fill-origin/fill-destination (warmUp owns binds).

## Notifications

`channel` / `to` from resolve-notification-target. Build body via `~/data/scripts/format-notification-body.js` (get_or_create). Empty preference → neutral professional defaults.

`/platform` propose-notification: only required platform fields (`channel`, `to`, `direction`, `body`, and other schema-required keys). Put `label_origin` / `label_destination` (and route labels/paths) **inside `body` text only** — never as extra top-level platform args. Body must list origin then destination in that order.

| Kind | When | Body |
|------|------|------|
| A Initial summary | Successful polls #1 and #2 (`poll_success_count`) | All routes + path + recommendation |
| B Heartbeat | Every 15 min when `*proactivity_allows_heartbeat` | Short pulse + primary/alts paths briefly |
| C Abnormal | `should_notify_abnormal` (`poll_success_count` ≥ 2) | Spike / incident / cleared — never suppress for low proactivity |

Independent proposals; do not coalesce kinds.

## Per-poll ops

Draft 0–5 novel candidates from browser tool JSON → `*filter_novel_ops_notes` → submit when worth persisting. Empty novel → no submit. Never append into `howto_md`. PLACE evidence needs `claimed_place` + `bound_poi` when tagged PLACE.

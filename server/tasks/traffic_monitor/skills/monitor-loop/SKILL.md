# monitor-loop

One poll of a configurable window (`monitor_minutes`, default 60). The orchestrator runs this skill at least twice (`whileSetup.doAtLeast: 2`), then re-checks the window via `whileSetup.condition` before further iterations.

## Clock / sleep

Never overwrite `started_at`. Set `fetched_at` to **`now_iso` (UTC ISO)** — never HKT/local wall clock with a `Z` suffix. Use `timezone` only for day-page `## HH:MM` headings. Verify retry after the window → emit `monitor` from real `fetches` only.

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

## Poll sequence

1. Fetch routes (route-analysis) for resolved OD bind names. Prefer scripts under `~/data/scripts/` when present. Early (warmUp or before inventing/growing a script): Read `~/task-skills/nixery-consult-script-candidate/SKILL.md` when present and follow it — not mid-fat browser transcript.
2. Success: `extend_context` on `fetches` (never `set_context` + `operation: extend`) + bump `poll_success_count` + update `prev_routes` / `prev_incident_note` **before** day-page append. `fetched_at` = `now_iso`; `timezone` for day-page headings only. Keep `fetches` on stage `contextKeys` — while segments merge by replace; dropping it from Input wipes prior polls.
3. Append section via `append-raw-knowledge-page` (`raw/fetches-YYYY-MM-DD`) with Path lines when present. Origin/Destination lines use `origin_display` / `destination_display` (fallback runInput).
4. Notify checks (below), then novel-only ops observations.
5. Sleep once; the orchestrator decides whether another poll runs.

## Miss / dead source

≤ 2 browser attempts. Then bump `miss_count`, miss section, sleep. Never invent ETAs. Sustained dead source → `goto_stage` explorer with reason.

## Notifications

`channel` / `to` from resolve-notification-target. Draft from `notifyPreference` / `notifyName`. Empty preference → neutral professional defaults.

`/platform` propose-notification: only required platform fields (`channel`, `to`, `body`, and other schema-required keys). Put `origin_display` / `destination_display` (and route labels/paths) **inside `body` text only** — never as extra top-level platform args (`origin`, `destination`, `fetch`, `preference`, …) that cause reject/retry thrash.

For each route in bodies: `label` + ETA + **`path` when non-empty**. Prefer official Chinese road/tunnel names when preference is zh; keep EN for browser bind. **Do not notify tunnel-only when `path` was extractable.** Place titles use `origin_display` / `destination_display` when set (else runInput `origin` / `destination`) — not bound POI proxies.

| Kind | When | Body |
|------|------|------|
| A Initial summary | Successful polls #1 and #2 (`poll_success_count`) | All routes + path + recommendation |
| B Heartbeat | Every 15 min when `*proactivity_allows_heartbeat` | Short pulse + primary/alts paths briefly |
| C Abnormal | `should_notify_abnormal` (`poll_success_count` ≥ 2) | Spike / incident / cleared — never suppress for low proactivity |

Independent proposals; do not coalesce kinds.

## Per-poll ops

Draft 0–5 novel candidates from browser tool JSON → `*filter_novel_ops_notes` → submit when worth persisting. Empty novel → no submit. Never append into `howto_md`. PLACE evidence needs `claimed_place` + `bound_poi` when tagged PLACE.

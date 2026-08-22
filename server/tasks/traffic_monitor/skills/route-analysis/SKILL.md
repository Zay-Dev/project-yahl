# route-analysis

Fetch and compare multi-route driving ETAs for resolved origin → destination.

## Place resolution

Resolve brands/abbrevs/malls before probe. Prefer `origin_resolved` / `destination_resolved` for every **browser bind**. Reject autocomplete that changes district/landmark. **Estate ≠ nearby transit hub** unless PLACE has `verified_proxy`. Implausible distance → geocode fail (not a multi-route source fail). Novel PLACE identity → submit when worth persisting. Notify/day-page titles use `origin_display` / `destination_display` when set.

## Fetch

Browser against goto rebuilt every poll from resolved OD + `traffic_source.howto_md` + `source_ops_md` (already in Input when allowlisted). Core `howto_md` stays OD-generic. Maps fallback → `/opt/skills/google-maps-directions/SKILL.md`.

**Scripts:** prefer reuse of `~/data/scripts/` ops when present. Browser fetch should be **agent-free**: `echo '{…}' | node ~/data/scripts/….js` that calls `yahl-browser` — not a long stage-agent `browser` click loop. Before inventing a new script or growing a fat one: if a consult gate skill is available under `~/task-skills/`, follow it once (stage-logic summary + short plan + need) — implement **only** the advised `scriptId` (or skip). Prefer small companions (`fill-origin-input.js`, `extract-routes-normalize.js`, …) over whole-fetch monoliths. After one-shot `browser` recovery, rewrite the failing script **this poll**.

Directions URL: placeholder templates only; bind with deterministic `encodeURIComponent` (node one-liner). Prefer English names in URL when needed; local-script for labels/notify. No SPA `data=!…` URLs. OD chip mismatch → fetch miss. **≤ 2** browser attempts per poll/probe.

Capture up to **3** private-car routes. For each:

- `label` — iconic tunnel/bridge/highway/interchange (not `Route N`)
- `via` — secondary corridor if useful
- `path` — ordered major-road chain from the UI **direction cards** (`A → B → C`); collapse trivial local streets; never invent. If cards unavailable → leave empty and note in poll `notes`
- `eta_min`, optional `distance_km`, `status`

Also `incident_note` when a real corridor disruption is shown (`''` if none; ignore generic prohibition-zone disclaimers).

Primary = lowest `eta_min` or UI recommended.

## Compare / abnormal

Match by `label` / `via`. Abnormal when ETA **> 120%** of prior, new incident, **incident cleared**, or primary worse than same-day baseline. Heartbeats do not substitute. No spam for unchanged active incident.

## Day page

```markdown
## HH:MM {tz_label}

- Origin: …
- Destination: …
- <label>: N min — status
  - Path: A → B → C
- Recommended: …
- Incident: … / Incident cleared: …
- Notes: …
```

Miss: same header + Origin/Destination + `Fetch missed` / `Using previous routes`. Pass display labels into format helpers. Times use `timezone` wall clock.

## Daily report

Classify day via `holidays_md` + `timezone`. Summarize ETA series; include primary `path` when present. Name locked `traffic_source` (Maps only when `is_fallback` or Maps URL). Append via `*format_report_run_append` to `raw/report-YYYY-MM-DD` under topic `traffic-monitor`. Registry may store under a canonical merged slug when `traffic-monitor` is an alias — that is success, not an error.

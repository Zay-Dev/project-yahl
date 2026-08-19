---
name: nixery
description: Inline nixery defs for agent-safe helpers and knowledge manager tools
---

# nixery tool

Use the **`nixery`** API tool for `/nixery(...)` in stage logic.

`/opt/skills/nixery/` is **catalog-only** (`SKILL.md`). Ability `index.yml` trees are **not** mounted in the agent. Do not `find /`, grep `/omniflex`, or read other sessions for def schemas — this file is the call contract.

## Agent-safe writes

### `append-raw-knowledge-page`

Machine timelines under `topics/{topic}/raw/` only.

| Key | Required |
|-----|----------|
| `topic` | yes |
| `page` | yes — `raw/…` (e.g. `raw/fetches-2026-08-19`) |
| `content` | yes — markdown section to write |
| `mode` | no — `append` (default) or `replace` |

```json
{
  "defId": "append-raw-knowledge-page",
  "args": {
    "topic": "traffic-monitor",
    "page": "raw/fetches-2026-08-19",
    "mode": "append",
    "content": "## HH:MM HKT\n- Origin: …\n"
  }
}
```

### `submit-knowledge-observation`

Observation under `raw/observations/…`. Knowledge Manager owns final topic. When to submit → `~/task-skills/worth-persisting-knowledge/SKILL.md`. Payload shape → `~/task-skills/submit-knowledge-observation/SKILL.md`.

| Key | Required |
|-----|----------|
| `cue` | yes |
| `claim` | yes |
| `evidence` | yes — JSON object, not prose |
| `example` or `quote` | one of these |
| `topic_hint` | no — soft slug; omit rather than force the task domain |

Never pass `source`, `file`, `path`, `mode`, or a wiki `##` body.

### `resolve-error-with-knowledge`

Atomically persist a tool failure, then search knowledge. First action on `ok:false` / rejected args — before `find /`. Flow → `~/task-skills/resolve-errors-with-knowledge/SKILL.md`.

| Key | Required |
|-----|----------|
| `tool` | yes |
| `cue` | yes |
| `claim` | yes |
| `evidence` | yes — JSON object |
| `example` or `quote` | one of these |

Returns `found` / `not_found` / `unavailable` with citations. Soft-fail never aborts the stage.

## LLM helpers (inline)

| Call | Use `data` field |
|------|------------------|
| `/nixery(extract-info, source: ~/…, need: …)` | `text` |
| `/nixery(design-questions, stage: …, gaps: …, priorQa: …, mission: …)` | `batches` |
| `/nixery(research, topic: …, source: ~/…, mission: …, guidelinePath: …)` | `markdown` |
| `/nixery(consult-breaking-change, proposedChange: …, reason: …, context?: …)` | `{ agree, reasons, alternatives }` |
| `/nixery(resolve-notification-target, to: …)` | notify channel prefs |

## Knowledge Manager inline

| Call | Role |
|------|------|
| `/nixery(list-pending-observations, topic: …)` | intake + needsValidation |
| `/nixery(apply-manager-topic, topic: …)` | hone + ApplyPlan + consume one topic |
| `/nixery(merge-topic, sourceTopic: …, targetTopic: …)` | alias + rehome pages (incl. raw) into canonical, then delete source wiki tree (same-domain siblings only) |

Wiki-backed writes need host `WIKI_API_TOKEN`. Defs with `inlineTool: false` (e.g. `dedup-knowledge`, `upsert-knowledge-page`) run only via orchestrator `nixeryRun`.

Overnight Knowledge Manager is a **multi-stage** task: list topics → per-topic validate (`plan`/`research` → observation feedback) → `apply-manager-topic` → group topics → `merge-topic` for obvious siblings → residual cross-topic `propose-knowledge-transfer` → `apply-approved-transfers` → within-topic `dedup-knowledge` on affected/canonical topics. Start via cron `taskPath: "knowledge_manager"` or `/platform(dispatch-task-run, taskId: knowledge_manager, runInput: {})`.

## Reads

Knowledge reads use orchestrator `nixeryRun` stages (`get-knowledge`, `list-knowledge-pages`, `search-knowledge`, `list-manager-topics`, `group-manager-topics`). After those stages, read `~/nixery/{defId}/{output}` in the session workspace. `get-knowledge` and `search-knowledge` remain orchestrator-only (`inlineTool: false`).

Ability id is global (`/nixery(get-knowledge)`); plugins are install folders under `server/nixery/` on the host — not visible in this container.

## Soft-fail (unified)

Each nixery def run retries up to `output.retry` attempts (default **10**). On validation failure or gate `{ ok: false }`, the orchestrator restarts the container and injects `input.nixeryRetry.feedback` as a user message for in-container agents.

After that budget is exhausted, inline calls return `{ ok: false, abandoned: true }` — **continue the stage**. Soft-fail never aborts the stage; orchestrator `nixeryRun` stages remain hard failures after exhaustion.

Pre-run failures only (invalid tool argv, def not inline) use a thin stage budget (`YAHL_NIXERY_INLINE_RETRY_MAX`, default **1**).

## Rules

- Never pass `source`, `file`, or `path` to knowledge write helpers.
- Observations need `example` or `quote` plus `evidence`. Soft optional `topic_hint` (defaults to `inbox`); never force the task domain slug for cross-cutting lessons — see `worth-persisting-knowledge`.
- Before breaking stage procedure, call `consult-breaking-change`.

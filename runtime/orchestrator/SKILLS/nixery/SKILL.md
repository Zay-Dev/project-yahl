---
name: nixery
description: Inline nixery defs for agent-safe helpers; knowledge writes are manager-only
---

# nixery tool

Use the **`nixery`** tool for `/nixery(...)` in stage logic.

## Agent-safe writes

| Call | Result |
|------|--------|
| `/nixery(submit-knowledge-observation, …)` | observation under `raw/observations/…` (soft optional `topic_hint`; KM owns final topic) |
| `/nixery(append-raw-knowledge-page, topic: …, page: raw/…, …)` | machine timelines under `raw/` only |

## LLM helpers (inline)

| Call | Use `data` field |
|------|------------------|
| `/nixery(extract-info, source: ~/…, need: …)` | `text` |
| `/nixery(media-to-text, file: ~/…)` | `text` |
| `/nixery(design-questions, stage: …, gaps: …, priorQa: …, mission: …)` | `batches` |
| `/nixery(research, topic: …, source: ~/…, mission: …, guidelinePath: …)` | `markdown` |
| `/nixery(consult-breaking-change, proposedChange: …, reason: …, context?: …)` | `{ agree, reasons, alternatives }` |
| `/nixery(resolve-notification-target, to: …)` | notify channel prefs |

## Knowledge Manager inline (task `knowledge_manager` only)

| Call | Role |
|------|------|
| `/nixery(list-pending-observations, topic: …)` | intake + needsValidation |
| `/nixery(apply-manager-topic, topic: …)` | hone + ApplyPlan + consume one topic |

Other tasks calling these get `knowledge_write_forbidden` on `apply-manager-topic`.

## Forbidden for non-manager tasks (nixeryRun / manager allowlist)

- `apply-manager-topic` / `apply-approved-transfers`
- `upsert-knowledge-page` / `dedup-knowledge`
- `resolve-topic` (registry write)
- `upsert-greets-page` / `upsert-whatsapp-page`

Overnight Knowledge Manager is a **multi-stage** task: list topics → per-topic validate (`plan`/`research` → observation feedback) → `apply-manager-topic` → group topics → cross-topic `propose-knowledge-transfer` → `apply-approved-transfers`. Start via cron `taskPath: "knowledge_manager"` or `/platform(dispatch-task-run, taskId: knowledge_manager, runInput: {})`.

## Reads

Knowledge reads use orchestrator `nixeryRun` stages (`get-knowledge`, `list-knowledge-pages`, `search-knowledge`, `list-manager-topics`, `group-manager-topics`).

Def `output` contract (`server/nixery/<def>/index.yml`): `validate` (default `validation.mjs`), `default` output filename, optional `inlineTool`, and optional `retry` (max container re-runs after validation failure; default **3**; `0` = no re-run).

## Soft-fail then abandon

Inline `{ ok: false, error }` (bad args or transient infra such as registry pull blips) soft-fails up to `YAHL_NIXERY_INLINE_RETRY_MAX` (default **3**). While `retryRemaining > 0`, fix args and retry. After the budget: `{ ok: false, abandoned: true }` — **continue the stage** (skip that call / move on). Soft-fail never aborts the stage; orchestrator `nixeryRun` stages remain hard failures.

## Rules

- Never pass `source`, `file`, or `path` to knowledge write helpers.
- Observations need `example` or `quote` plus `evidence`. Soft optional `topic_hint` (defaults to `inbox`); never force the task domain slug for cross-cutting lessons — see `worth-persisting-knowledge`.
- Before breaking stage procedure, call `consult-breaking-change`.

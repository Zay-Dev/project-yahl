---
name: nixery
description: Inline nixery defs for agent-safe helpers; knowledge writes are manager-only
---

# nixery tool

Use the **`nixery`** tool for `/nixery(...)` in stage logic.

## Agent-safe writes

| Call | Result |
|------|--------|
| `/nixery(resolve-error-with-knowledge, tool: …, cue: …, claim: …, example\|quote: …, evidence: …)` | atomically persist failure, then return `found` / `not_found` / `unavailable` with citations and guidance |
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

Knowledge reads use orchestrator `nixeryRun` stages (`get-knowledge`, `list-knowledge-pages`, `search-knowledge`, `list-manager-topics`, `group-manager-topics`). `get-knowledge` and `search-knowledge` remain orchestrator-only (`inlineTool: false`).

Def `output` contract (`server/nixery/<def>/index.yml`): `validate` (default `validation.mjs`), `default` output filename, optional `inlineTool`, and optional `retry` (max attempts per def run; default **10**; `0` treated as **1** attempt).

## Soft-fail (unified)

Each nixery def run retries up to `output.retry` attempts (default **10**). On validation failure or gate `{ ok: false }`, the orchestrator restarts the container and injects `input.nixeryRetry.feedback` as a user message for in-container agents.

After that budget is exhausted, inline calls return `{ ok: false, abandoned: true }` — **continue the stage**. Soft-fail never aborts the stage; orchestrator `nixeryRun` stages remain hard failures after exhaustion.

Pre-run failures only (invalid tool argv, def not inline) use a thin stage budget (`YAHL_NIXERY_INLINE_RETRY_MAX`, default **1**).

## Rules

- Never pass `source`, `file`, or `path` to knowledge write helpers.
- Observations need `example` or `quote` plus `evidence`. Soft optional `topic_hint` (defaults to `inbox`); never force the task domain slug for cross-cutting lessons — see `worth-persisting-knowledge`.
- Before breaking stage procedure, call `consult-breaking-change`.

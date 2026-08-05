---
name: nixery
description: Inline nixery defs for agent-safe helpers; knowledge writes are manager-only
---

# nixery tool

Use the **`nixery`** tool for `/nixery(...)` in stage logic.

## Agent-safe writes

| Call | Result |
|------|--------|
| `/nixery(submit-knowledge-observation, …)` | observation under `raw/observations/…` |
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

- `run-knowledge-manager` (legacy all-topic wrapper)
- `apply-manager-topic` / `apply-approved-transfers`
- `upsert-knowledge-page` / `dedup-knowledge` / `tidy-knowledge` / `knowledge-qa-review`
- `resolve-topic` (registry write)
- `upsert-greets-page` / `upsert-whatsapp-page`

Overnight Knowledge Manager is a **multi-stage** task: list topics → per-topic validate (`plan`/`research` → observation feedback) → `apply-manager-topic` → group topics → cross-topic `propose-knowledge-transfer` → `apply-approved-transfers`.

## Reads

Knowledge reads use orchestrator `nixeryRun` stages (`get-knowledge`, `list-knowledge-pages`, `search-knowledge`, `list-manager-topics`, `group-manager-topics`).

Def `output` contract (`server/nixery/<def>/index.yml`): `validate` (default `validation.mjs`), `default` output filename, optional `inlineTool`, and optional `retry` (max container re-runs after validation failure; default **3**; `0` = no re-run).

## Rules

- Never pass `source`, `file`, or `path` to knowledge write helpers.
- Observations need `example` or `quote` plus `evidence`.
- Before breaking stage procedure, call `consult-breaking-change`.

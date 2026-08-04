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

## Forbidden for stage agents (manager / nixeryRun only)

These defs are **not** inline tools. Orchestrator `nixeryRun` stages on `knowledge_manager` / `knowledge_refresh` (and greets/whatsapp stack for their namespaces) may run them. Any other task gets `knowledge_write_forbidden`:

- `run-knowledge-manager` (overnight manager body — preferred entry)
- `upsert-knowledge-page`
- `dedup-knowledge`
- `tidy-knowledge`
- `knowledge-qa-review`
- `resolve-topic` (registry write)
- `upsert-greets-page` / `upsert-whatsapp-page`

Overnight Knowledge Manager is a **thin YAHL dispatcher** that only `nixeryRun`s `run-knowledge-manager`. That def hones, emits ApplyPlan JSON, and applies upserts deterministically — stage agents must not invent upsert/dedup/research calls.

## Reads

Knowledge reads use orchestrator `nixeryRun` stages (`get-knowledge`, `list-knowledge-pages`, `search-knowledge`).

## Rules

- Never pass `source`, `file`, or `path` to knowledge write helpers.
- Observations need `example` or `quote` plus `evidence`.
- Before breaking stage procedure, call `consult-breaking-change`.
- On `{ ok: false, error }`: read `error`, fix args, re-call `nixery`. Orchestrator allows up to `YAHL_NIXERY_INLINE_RETRY_MAX` (default 3) soft failures per stage; the next failure ends the stage. `retryRemaining` is included on soft fails.

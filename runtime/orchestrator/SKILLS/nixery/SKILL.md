---
name: nixery
description: Inline nixery defs for knowledge, topic resolve, tidy, QA, and LLM helpers
---

# nixery tool

Use the **`nixery`** tool for `/nixery(...)` in stage logic.

## Topic / tidy / QA

| Call | Result |
|------|--------|
| `/nixery(resolve-topic, topicText: …, slug: …, seedUrls: …)` | `canonical` |
| `/nixery(tidy-knowledge, dryRun: …, topic: …)` | `report` |
| `/nixery(knowledge-qa-review, topic: …, auditIssues: …)` | `review` (OpenAI in-def) |

## Writes

| Call | Result |
|------|--------|
| `/nixery(upsert-knowledge-page, topic: …, key: …, value: …)` | `{ data: { ok, path } }` |
| `/nixery(dedup-knowledge, topic: …, purpose: …)` | review JSON under `~/nixery/dedup-knowledge/` |

## LLM helpers (inline)

| Call | Use `data` field |
|------|------------------|
| `/nixery(extract-info, source: ~/…, need: …)` | `text` |
| `/nixery(design-questions, stage: …, gaps: …, priorQa: …, mission: …)` | `batches` |
| `/nixery(research, topic: …, source: ~/…, mission: …, guidelinePath: …)` | `markdown` |

```json
{
  "defId": "upsert-knowledge-page",
  "args": {
    "topic": "hk-weather",
    "key": "facts",
    "value": { "items": [] }
  }
}
```

## Rules

- Never pass `source`, `file`, or `path` to upsert (except `outputPath` on research).
- Dedup is opt-in maintenance — not on every upsert.
- Append `data.path` from upsert results to `knowledge_paths.persisted` (task convention — see context-paths skill).
- `knowledge-qa-review` fails closed on empty corpus; judgment is OpenAI in-def (no Cursor key / no worker hop).

## Reads

Knowledge reads still use orchestrator `nixeryRun` stages (`get-knowledge`, `list-knowledge-pages`, `search-knowledge`).

Task skills: `~/task-skills/nixery-*/SKILL.md` when mounted.

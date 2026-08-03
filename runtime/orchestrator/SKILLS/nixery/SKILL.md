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
| `/nixery(upsert-knowledge-page, topic: …, key: …, value: …, mode?: …)` | `{ data: { ok, path, canonicalTopic } }` — **requires** non-empty `topic` or `topicText` (empty topic no longer falls through to `general`). Key→page map is a **suggestion** only. |
| `/nixery(upsert-knowledge-page, topic: …, page: …, content: …, section?: …, mode?: …)` | Open write for **any** page / `##` section under the topic. `section` or `page: "foo#Section Title"`; `mode: append` appends inside that section (or whole page if no section); `replace` replaces the section body or page. |
| `/nixery(dedup-knowledge, topic: …, purpose: …)` | review JSON under `~/nixery/dedup-knowledge/` |

Topics and wiki sections are open — task skills recommend shapes; agents may write any page/section.

```json
{
  "defId": "upsert-knowledge-page",
  "args": {
    "topic": "traffic-monitor",
    "page": "source-ops-hong-kong",
    "section": "Q&A",
    "mode": "append",
    "content": "**Q:** empty result table\\n**A:** reload entry URL and re-fill"
  }
}
```

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

## LLM helpers (inline)

| Call | Use `data` field |
|------|------------------|
| `/nixery(extract-info, source: ~/…, need: …)` | `text` |
| `/nixery(media-to-text, file: ~/…)` | `text` |
| `/nixery(design-questions, stage: …, gaps: …, priorQa: …, mission: …)` | `batches` |
| `/nixery(research, topic: …, source: ~/…, mission: …, guidelinePath: …)` | `markdown` |
| `/nixery(consult-breaking-change, proposedChange: …, reason: …, context?: …)` | `{ agree, reasons, alternatives }` |

## Rules

- Never pass `source`, `file`, or `path` to upsert (except `outputPath` on research).
- Dedup is opt-in maintenance — not on every upsert.
- Append `data.path` from upsert results to `knowledge_paths.persisted` (task convention — see context-paths skill).
- `knowledge-qa-review` fails closed on empty corpus; judgment is OpenAI in-def (no Cursor key / no worker hop).
- `media-to-text` uses Cursor CLI inside the nixery container (`CURSOR_API_KEY` declared on that def only); persist `data.text`.
- Before breaking stage procedure (sleep protocol, window, thresholds, editing task skills), call `consult-breaking-change`; if `agree: false`, follow `alternatives`.

## Reads

Knowledge reads still use orchestrator `nixeryRun` stages (`get-knowledge`, `list-knowledge-pages`, `search-knowledge`).

Task skills: `~/task-skills/nixery-*/SKILL.md` when mounted.

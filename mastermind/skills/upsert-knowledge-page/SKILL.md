---
name: upsert-knowledge-page
description: Create or update Wiki.js knowledge pages — Mastermind dual-writes narrative wiki pages and raw/ agent references.
---

# upsert-knowledge-page

Use `/mastermind(upsert-knowledge-page, key: …, value: …, topic: …)` or `/mastermind(upsert-knowledge-page, page: …, content: …, topic: …)` in stage logic.

Mastermind writes via Wiki.js GraphQL under `topics/{slug}/…`. Wiki.js pushes to `data/knowledge_export/en/topics/…` (Local FS export). **Do not pass `path`** — rejected for security.

## Dual-write contract (`key` + `value`)

| Layer | Path | Content |
|-------|------|---------|
| Wiki pages | `overview`, `sources`, `studies/*`, `facts`, `brief` | Elaborated markdown |
| Raw references | `raw/{key}` | Structured JSON, Q&A logs |

Every legacy `key + value` upsert writes **both** when applicable: narrative sections on wiki pages; machine-readable JSON under `raw/`.

## Key → wiki page mapping (narrative)

| Key pattern | Wiki page |
|-------------|-----------|
| `identity`, `goals`, `preferences`, `communication_style`, `constraints`, `priorities` | `overview` (section replace) |
| `study_{slug}` | `studies/{slug}` (`studyMd` body) |
| `facts`, `analysis` | `facts` / `overview` |
| `sources`, `study_plan`, `corpus_assessment`, `learning_contract` | `sources` |
| `summary`, `user_profile_summary` | `brief` |
| `open_questions` | `overview` (summary + wikilink to raw) |
| `open_questions_qa`, `stage{N}_qa` | raw only |
| `*_md`, narrative wrappers | merge into `overview` or `facts` |

Unknown keys error — no orphan `topics/{slug}/{key}` pages.

## Tool (legacy key)

```json
{
  "skill": "upsert-knowledge-page",
  "args": {
    "key": "facts",
    "topic": "hk-weather",
    "value": { "items": [] }
  }
}
```

## Tool (direct page)

```json
{
  "skill": "upsert-knowledge-page",
  "args": {
    "page": "overview",
    "topic": "hk-weather",
    "content": "# HK Weather\n\n…",
    "mode": "append"
  }
}
```

Returns `{ path, pagePath, wikiPath, rawPath?, quality?, canonicalTopic }` on success.

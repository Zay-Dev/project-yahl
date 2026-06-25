---
name: tidy-knowledge
description: Detect and merge duplicate knowledges topic folders into canonical slugs.
---

# tidy-knowledge

Use `/mastermind(tidy-knowledge)` or `/mastermind(tidy-knowledge, dryRun: false)` to scan `data/mastermind/knowledges/` for duplicate topic folders and merge them into canonical slugs.

No LLM — file-only merge via topic registry. Default `dryRun` follows `KNOWLEDGE_TIDY_DRY_RUN` (detect-only until operator sets env to `false`).

## Tool

```json
{
  "skill": "tidy-knowledge",
  "args": {
    "dryRun": true
  }
}
```

Returns `{ report: { applied, dryRun, groups, mergedKeys, archived } }`.

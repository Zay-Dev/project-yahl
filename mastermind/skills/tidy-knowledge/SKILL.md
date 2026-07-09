---
name: tidy-knowledge
description: Audit wiki layout per topic for canonical structure and QA issues.
---

# tidy-knowledge

Use `/mastermind(tidy-knowledge)` or `/mastermind(tidy-knowledge, dryRun: false)` to audit wiki pages per topic.

No LLM — export mirror + GraphQL I/O only. Default `dryRun` follows `KNOWLEDGE_TIDY_DRY_RUN` (detect-only until operator sets env to `false`).

## Tool

```json
{
  "skill": "tidy-knowledge",
  "args": {
    "dryRun": true,
    "topic": "optional-single-slug"
  }
}
```

Returns `{ report: { applied, dryRun, topicCount, topics } }`.

`topics[]` entries include `canonical` and `issues[]` (`orphan_page`, `json_only_wiki`, `missing_overview`, `missing_raw_mirror`).

## Env

| Variable | Default | Effect |
|----------|---------|--------|
| `KNOWLEDGE_TIDY_DRY_RUN` | `true` | When not `false`, audit only |

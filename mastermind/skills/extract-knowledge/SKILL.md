---
name: extract-knowledge
description: Extract structured facts from the Mastermind knowledges/ store — no caller file paths.
---

# extract-knowledge

Use `/mastermind(extract-knowledge, need: …, topic: …)` in stage logic. Calls the `mastermind` tool with `skill: "extract-knowledge"`.

Mastermind scans `data/mastermind/knowledges/` internally. **Do not pass `source`, `file`, or `path`** — those are rejected.

## Tool

```json
{
  "skill": "extract-knowledge",
  "args": {
    "need": "preferred_hk_weather_region",
    "topic": "hk-weather"
  }
}
```

- `need` — what to extract (required).
- `topic` — optional scope to prefer files under `knowledges/{topic}/`.

Returns extracted plain text or JSON. If the fact is absent, returns exactly `<none>`.

Write results to stage context via `set_context` after the tool returns.

For workspace-file RAG, use **`extract-info`** instead.

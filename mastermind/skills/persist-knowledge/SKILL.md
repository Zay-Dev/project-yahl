---
name: persist-knowledge
description: Persist structured facts to the Mastermind knowledges/ store — Mastermind picks the path.
---

# persist-knowledge

Use `/mastermind(persist-knowledge, key: …, value: …, topic: …)` in stage logic.

Mastermind writes under `data/mastermind/knowledges/`. **Do not pass `path`** — rejected for security.

## Format routing (hybrid)

Mastermind picks `.json` or `.md` from the key and value shape:

| Format | Examples |
|--------|----------|
| **`.md`** | `*_md`, `*_summary`, `background_summary`; plain strings; `{ content: "…" }`; dual profiles `{ mastermind, agent }` |
| **`.json`** | `sources`, `facts`, `meta`, `study_*`, profile objects (`identity`, `goals`, …) |

Narrative files are plain markdown (no JSON wrapper). Existing files keep their extension on update.

## Tool

```json
{
  "skill": "persist-knowledge",
  "args": {
    "key": "preferred_hk_weather_region",
    "topic": "hk-weather",
    "value": { "id": "hk", "name_en": "Hong Kong", "name_zh": "香港" }
  }
}
```

- `key` — knowledge field name (required).
- `value` — JSON-serializable value (required).
- `topic` — optional namespace; defaults to `general` for new files.

Returns `{ path: "<relative under knowledges/>" }` on success.

---
name: extract-knowledge
description: Extract structured facts from the Mastermind knowledges/ store into the session folder — no caller file paths.
---

# extract-knowledge

Use `/mastermind(extract-knowledge, need: …, topic: …)` in stage logic. Calls the `mastermind` tool with `skill: "extract-knowledge"`.

Mastermind scans `data/mastermind/knowledges/` internally and writes a session-scoped extract file. **Do not pass `source`, `file`, or `path`** — those are rejected.

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

Returns `{ key, path: "~/knowledge/{key}.json", absent }` only — not the full corpus.

## Two-step read

```text
const extractRef = /mastermind(extract-knowledge, topic: …, need: …);
const knowledge = extractRef.absent ? '<none>' : (*read(extractRef.path)).extracted;
```

Session file shape: `{ need, topic?, extracted, absent, extractedAt }`.

Never read `~/knowledges/` directly — canonical store is mastermind-private.

For workspace-file RAG, use **`extract-info`** instead.

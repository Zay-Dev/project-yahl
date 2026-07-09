---
name: get-knowledge
description: Extract structured facts from the Wiki.js knowledge store into the session folder — no caller file paths.
---

# get-knowledge

Use `/mastermind(get-knowledge, need: …, topic: …)` in stage logic. Calls the `mastermind` tool with `skill: "get-knowledge"`.

Mastermind reads wiki pages and `raw/` references (GraphQL; export mirror for large topic walks) and writes a session-scoped extract file. **Do not pass `source`, `file`, `path`, or `layer`** — those are rejected.

Agents pass **`need` + `topic` only**. Mastermind decides internally which wiki pages and `raw/{key}` refs to load from `need` — agents never choose layers.

## Tool

```json
{
  "skill": "get-knowledge",
  "args": {
    "need": "identity, goals, communication_style",
    "topic": "user-onboarding"
  }
}
```

- `need` — what to extract (required). Comma-separated keys or broad phrases (`all stage keys`).
- `topic` — optional scope under `topics/{topic}/`.

Returns `{ key, path: "~/knowledge/{key}.json", absent }` only — not the full corpus.

## Two-step read

```text
const extractRef = /mastermind(get-knowledge, topic: …, need: …);
const knowledge = extractRef.absent ? '<none>' : (*read(extractRef.path)).extracted;
```

Session file shape: `{ need, topic?, extracted, absent, extractedAt }`.

Never read wiki HTTP, export files, or legacy `~/knowledges/` directly — canonical store is mastermind-private.

For workspace-file RAG, use **`extract-info`** instead.

Legacy alias: `extract-knowledge` (deprecated).

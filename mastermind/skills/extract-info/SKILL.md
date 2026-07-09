---
name: extract-info
description: Extract structured information from workspace files (RAG) — not for knowledges/ reads.
---

# extract-info

Use `/mastermind(extract-info, source: ~/path, need: …)` for **workspace-file RAG** — structured extraction from saved HTML/text under `~/`.

This replaces the former stage-agent **`rag`** tool. Call the **`mastermind`** tool with `skill: "extract-info"`, then persist with `set_context`.

## Tool

```json
{
  "skill": "extract-info",
  "args": {
    "source": "~/tmp/page.html",
    "need": ["title", "date", "summary"]
  }
}
```

`~/` means the shared workspace folder (`/root` in the container).

For curated knowledge under `knowledges/`, use **`get-knowledge`** instead (no `source` arg).

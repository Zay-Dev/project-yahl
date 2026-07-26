# nixery-extract-info

Workspace-file RAG via `/nixery(extract-info, source: ~/path, need: …)`.

## Tool call

```json
{
  "defId": "extract-info",
  "args": {
    "source": "~/tmp/page.html",
    "need": ["title", "date", "summary"]
  }
}
```

## Result

Inline tool returns `{ ok, data: { ok, text, source } }`. Use `data.text` as extracted content.

For curated knowledge reads, use orchestrator **`nixeryRun: get-knowledge`** — not extract-info.

---
name: stagehand
description: Browser automation via Stagehand — web search, page fetch, structured extract, observe, and multi-step agent tasks.
---

# stagehand — Browser automation (Stagehand)

**Use the `browser` API tool for all web search and browse tasks.** Do not use curl or Brave Search for `/stagehand(...)`.

## Tool: `browser`

```json
{
  "mode": "goto | act | extract | observe | agent",
  "instruction": "<natural language>",
  "url": "<optional URL>",
  "schema": { "<JSON Schema for extract>" },
  "maxSteps": 15
}
```

Returns `{ "ok": true, "data": ... }` or `{ "ok": false, "error": "..." }`.

After a successful call, persist results with `set_context`.

## Modes

| Mode | Use when |
|------|----------|
| `goto` | Navigate to a URL (`url` required) |
| `act` | Single natural-language action (click, type, scroll) |
| `extract` | Pull structured or free-text data from the current page |
| `observe` | List interactive elements / available actions |
| `agent` | Multi-step research (search, navigate, collect results) |

## YAHL mapping

| YAHL | `browser` call |
|------|----------------|
| `/stagehand(search, topic, ...)` | `mode: "agent"`, instruction describes search + required fields |
| `/stagehand(goto, url)` | `mode: "goto"`, `url` |
| `/stagehand(extract, url, instruction)` | `mode: "goto"` then `mode: "extract"`, or goto URL first in prior call |
| `*browse(url)` | `goto` + `extract` for page text |

## Search example

```json
{
  "mode": "agent",
  "instruction": "Search the web for '<topic>'. Return top 10 results with title, url, snippet, and publishedAt when available.",
  "maxSteps": 15
}
```

Prefer a follow-up `extract` with schema when you need typed JSON:

```json
{
  "mode": "extract",
  "instruction": "Extract search results",
  "schema": {
    "type": "object",
    "properties": {
      "results": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "title": { "type": "string" },
            "url": { "type": "string" },
            "snippet": { "type": "string" },
            "publishedAt": { "type": "string" }
          },
          "required": ["title", "url", "snippet"]
        }
      }
    },
    "required": ["results"]
  }
}
```

## Structured scrape example

```json
{
  "mode": "goto",
  "url": "https://example.com/news",
  "instruction": "navigate"
}
```

Then:

```json
{
  "mode": "extract",
  "instruction": "Extract news articles with title, url, date, and summary"
}
```

## Persistence pattern

1. Call `browser` with the appropriate mode.
2. Call `set_context` with `scope: "global"` or `"stage"`, the target key, and `value` set to the tool result `data`.

## Timeouts

- `goto`, `act`, `extract`, `observe`: ~120s
- `agent`: up to ~300s; keep `maxSteps` ≤ 15 unless the stage requires more

## Notes

- Chromium runs locally in the agent container (headless).
- Reuse the same browser session within a stage; multiple `browser` calls share one Chromium instance.
- For large page text saved to `~/tmp/`, optional follow-up `/rag` may apply.

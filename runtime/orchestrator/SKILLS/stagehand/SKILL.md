---
name: stagehand
description: Browser automation via Stagehand — web search, page fetch, structured extract, and observe.
---

# stagehand — Browser automation (Stagehand)

**Use the `browser` API tool for all web search and browse tasks.** Do not use Brave Search for `/stagehand(...)`.

- **Browse/search:** use `browser` only — no curl for page fetch, search, or scraping.
- **Post-extraction validation:** after `browser` returns URLs, use `run_bash` with the curl HEAD pattern below to sanity-check reachability before `set_context`.
- **`url` is only for `mode: "goto"`.** On `act` / `extract` / `observe`, omit `url`. Passing `url` on those modes **reloads the page** and wipes form state (typed text, autocomplete, open dialogs).

## Stage YAML: `stagehand`

Optional per-AI-stage overrides (defaults apply when omitted):

```yaml
stagehand:
  model: deepseek-v4-flash              # optional — default STAGEHAND_MODEL / LLM_MODEL
  apiBaseUrl: https://api.deepseek.com  # optional — default LLM_BASE_URL
```

| Key | Effect |
|-----|--------|
| `model` | Nested Stagehand LLM model (proxy outbound) |
| `apiBaseUrl` | Nested Stagehand provider base URL (proxy outbound; API key stays env) |

Rebuild the agent image after changing this runtime so live sessions pick it up.

## Tool: `browser`

```json
{
  "mode": "goto | act | extract | observe",
  "instruction": "<natural language>",
  "url": "<required for goto only>",
  "schema": { "<JSON Schema for extract>" }
}
```

Returns `{ "ok": true, "data": ... }` or `{ "ok": false, "error": "..." }`.

After a successful call, persist results with `set_context`.

## Modes

| Mode | Use when |
|------|----------|
| `goto` | Navigate to a URL (`url` required) |
| `act` | Single natural-language action on the **current** page (click, type, scroll) — omit `url` |
| `extract` | Pull structured or free-text data from the **current** page — omit `url` |
| `observe` | List interactive elements / available actions on the **current** page — omit `url` |

## YAHL mapping

| YAHL | `browser` call |
|------|----------------|
| `/stagehand(search, topic, ...)` | `goto` a search entry URL (if needed), then discrete `act` / `extract` / `observe` **without** `url` |
| `/stagehand(goto, url)` | `mode: "goto"`, `url` |
| `/stagehand(extract, url, instruction)` | `mode: "goto"` then `mode: "extract"` **without** `url` |
| `*browse(url)` | `goto` + `extract` for page text |

## Canonical pattern (goto once, then act/extract)

```json
{
  "mode": "goto",
  "url": "https://example.com/news",
  "instruction": "navigate"
}
```

Then — **do not** include `url`:

```json
{
  "mode": "act",
  "instruction": "Type the query into the search box and click the matching suggestion"
}
```

```json
{
  "mode": "extract",
  "instruction": "Extract news articles with title, url, date, and summary"
}
```

**Anti-pattern:** repeating the same `url` on every `act` / `extract` / `observe` — each call reloads the page.

## Search example

Navigate to a search page (or engine) once, then act and extract on the current page:

```json
{
  "mode": "goto",
  "url": "https://www.google.com/search?q=<topic>",
  "instruction": "navigate"
}
```

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

Then validate URLs before persisting:

1. Validate each `results[].url` with curl HEAD (see below).
2. Apply judgment on status codes.
3. Call `set_context` with filtered or adjusted results.

## Validate extracted URLs

After `extract` returns one or more `url` / `source_url` fields, sanity-check reachability with `run_bash` — not `browser`.

```bash
curl -s -o /dev/null -I -w "%{http_code}\n" \
  -H 'accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7' \
  -H 'accept-language: zh-TW,zh;q=0.9' \
  -H 'upgrade-insecure-requests: 1' \
  -H 'user-agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36' \
  "<URL>"
```

- `-I` issues HEAD; output is only the status code via `-w "%{http_code}\n"`.
- Quote URLs in the shell command; escape shell metacharacters when needed.
- For multiple URLs, loop in one `run_bash` call (e.g. `while read url; do ...; done`) rather than one curl per tool round-trip when practical.
- Interpret the code in context — e.g. `200` vs redirect codes vs `403`/`404`/`000` — and decide whether to keep, downgrade, retry with `browser` `goto`, or drop the URL.
- Only persist validated (or explicitly kept) URLs via `set_context`.

```mermaid
flowchart LR
  browserCall["browser extract"]
  urls["URLs in data"]
  curlHead["run_bash curl HEAD"]
  judge["Agent judges status"]
  persist["set_context"]

  browserCall --> urls --> curlHead --> judge --> persist
```

## Persistence pattern

1. Call `browser` with the appropriate mode.
2. When results include URLs, validate with curl via `run_bash`.
3. Call `set_context` with `scope: "global"` or `"stage"`, the target key, and cleaned `value` data.

## Timeouts

- `goto`, `act`, `extract`, `observe`: ~120s

## Notes

- Chromium runs locally in the agent container (headless unless live view).
- Stagehand’s LLM calls go through a **localhost-only OpenAI-compatible proxy** in the agent runtime. The proxy answers with a nested completion that includes a short **YAHL browse brief** (mode/url + optional opaque text) plus Stagehand’s act/observe/extract prompt — not the full stage chat history. Thinking is forced off so provider `tool_choice` works. Stagehand is CU-only; YAHL persists knowledge after browser tool results.
- Reuse the same browser session within a stage; multiple `browser` calls share one Chromium instance. Navigate with `goto` only when you need a new URL.
- For large page text saved to `~/tmp/`, use an extract helper from the current nixery catalog (`/opt/skills/nixery/SKILL.md`) when listed there; otherwise trim/parse inline. Do not invent a defId.
- HEAD may differ from full page load (paywalls, bot blocks, redirect chains without `-L`); use judgment — invalid HEAD does not always mean the URL is useless for a later `goto`.

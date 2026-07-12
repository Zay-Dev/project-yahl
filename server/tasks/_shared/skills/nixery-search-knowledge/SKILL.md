# nixery-search-knowledge

Search the wiki export mirror via orchestrator-direct `nixeryRun: search-knowledge`.

## Stage shape

```yaml
- nixeryRun: search-knowledge
  nixeryInput:
    query: forecast
    topic: hk-weather
    output: gap-search.md
  logic: "(nixery)"
```

## Output location

`~/nixery/search-knowledge/` — primary artifact e.g. `gap-search.md`.

## Read pattern

```text
Read ~/nixery/search-knowledge/gap-search.md from the session workspace.
If missing or empty, set results to []; otherwise derive search hits from the file's markdown content.
const resultsRef = { absent: results.length === 0, path: '~/nixery/search-knowledge/gap-search.md' };
```

Use `set_context` for produceContextKeys. Do not assume JSON envelopes.

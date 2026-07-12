# nixery-search-knowledge

Search the wiki export mirror via orchestrator-direct `nixeryRun: search-knowledge`.

## Stage shape

```yaml
- nixeryRun: search-knowledge
  nixeryInput:
    query: forecast
    topic: hk-weather
    output: results.json
  logic: "(nixery)"
```

## Output location

`~/nixery/search-knowledge/` — primary artifact e.g. `results.json`.

## Read pattern

```javascript
const resultsPath = '~/nixery/search-knowledge/results.json';
const resultsFile = (*read(resultsPath));
const resultsRef = { absent: resultsFile.absent ?? !resultsFile.extracted, path: resultsPath };
const results = resultsRef.absent ? [] : resultsFile.extracted;
```

Envelope when present:

```json
{
  "absent": false,
  "extracted": [{ "pagePath": "en/topics/hk-weather/overview", "title": "...", "snippet": "..." }],
  "extractedAt": "2026-07-12T00:00:00.000Z"
}
```

When `absent: true`, `absentReason` must cite query, paths searched, and grep outcomes.

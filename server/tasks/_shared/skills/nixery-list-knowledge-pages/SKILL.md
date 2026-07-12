# nixery-list-knowledge-pages

List wiki pages under a topic via orchestrator-direct `nixeryRun: list-knowledge-pages`.

## Stage shape

```yaml
- nixeryRun: list-knowledge-pages
  nixeryInput:
    topic: knowledge_topic
    output: pages.json
  contextKeys: [knowledge_topic]
  logic: "(nixery)"
```

## Output location

`~/nixery/list-knowledge-pages/` — primary artifact e.g. `pages.json`.

## Read pattern

```javascript
const pagesPath = '~/nixery/list-knowledge-pages/pages.json';
const pagesFile = (*read(pagesPath));
const pagesRef = { absent: pagesFile.absent ?? !pagesFile.extracted, path: pagesPath };
const pages = pagesRef.absent ? [] : pagesFile.extracted;
```

Envelope when present:

```json
{
  "absent": false,
  "extracted": [{ "page": "overview", "pagePath": "en/topics/foo/overview", "source": "export" }],
  "extractedAt": "2026-07-12T00:00:00.000Z"
}
```

When `absent: true`, `absentReason` must cite `ls` / `grep` exploration steps tried.

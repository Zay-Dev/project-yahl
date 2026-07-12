# nixery-list-knowledge-pages

List wiki pages under a topic via orchestrator-direct `nixeryRun: list-knowledge-pages`.

## Stage shape

```yaml
- nixeryRun: list-knowledge-pages
  nixeryInput:
    topic: knowledge_topic
    output: pages.md
  contextKeys: [knowledge_topic]
  logic: "(nixery)"
```

## Output location

`~/nixery/list-knowledge-pages/` — primary artifact e.g. `pages.md`.

## Read pattern

```text
Read ~/nixery/list-knowledge-pages/pages.md from the session workspace.
If missing or empty, set pages to []; otherwise derive the page inventory from the file's markdown content.
const pagesRef = { absent: pages.length === 0, path: '~/nixery/list-knowledge-pages/pages.md' };
```

Use `set_context` for produceContextKeys. Do not assume JSON envelopes.

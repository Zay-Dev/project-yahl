Topic: {{topic}}

Cycle: {{cycle}}

Work queue (JSON):

{{workQueue}}

For each item, call the `wiki` tool with `{ "action": "<action>", "pagePath": "...", "sectionTitle": "..." }`.

Allowed actions: `collapse_section`, `collapse_page`.

Write `/workspace/dedup-applied.json`:

```json
{
  "applied": [{ "id": "todo-1", "status": "applied", "pagePath": "..." }],
  "skipped": [],
  "cycle": {{cycle}}
}
```

Skip items that cannot be repaired deterministically.

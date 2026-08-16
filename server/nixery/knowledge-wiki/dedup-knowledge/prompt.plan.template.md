Topic: {{topic}}

Purpose: {{purpose}}

Scope: {{scope}}

Explore `/data/knowledge_export/en/topics/{{topic}}/` with ls, cat, grep.

Write `/workspace/dedup-todo.json` with:

```json
{
  "items": [
    {
      "id": "todo-1",
      "issue": "duplicate_section",
      "pagePath": "en/topics/{{topic}}/facts",
      "action": "collapse_section",
      "sectionTitle": "Key facts",
      "priority": 1
    }
  ]
}
```

Issue types: `duplicate_section`, `stacked_key_facts`, `duplicate_facts_items`, `json_only_wiki`, `append_should_replace`.

Only include actionable repairs backed by export evidence.

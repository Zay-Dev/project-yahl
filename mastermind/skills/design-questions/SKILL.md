---
name: design-questions
description: Design ask-user batches from stage goals, knowledge gaps, and prior Q&A.
---

# design-questions

Platform skill for dynamic ask-user batch design. Used by any task that needs agent-driven questioning.

## Input args

| Arg | Purpose |
|-----|---------|
| `stage` / `stageIndex` | Current stage identifier |
| `gaps` | Missing fields or topics to cover |
| `priorQa` | Prior question/answer pairs this stage |
| `goal` | Optional stage goal summary |

## Output

Return JSON only:

```json
{
  "batches": [
    {
      "batchId": "stage1_round1",
      "title": "Tell us about yourself",
      "questions": [
        {
          "questionRef": "preferred_name",
          "kind": "text",
          "title": "What should we call you?"
        },
        {
          "questionRef": "timezone",
          "kind": "multipleChoice",
          "allowMultiple": false,
          "title": "Your timezone",
          "options": [
            { "id": "hkt", "label": "Hong Kong (HKT)" },
            { "id": "utc", "label": "UTC" }
          ]
        }
      ]
    }
  ],
  "done": false
}
```

## Rules

- Each batch contains only **independently answerable** questions.
- Unique `questionRef` within each batch.
- `kind`: `text` or `multipleChoice`.
- `multipleChoice` requires ≥2 options; radio vs checkbox via `allowMultiple`.
- Do not emit `allowFreeText` — UI always provides a free-text counter-option on MC.
- Dependent questions belong in a **later** batch (`done: false` until gaps closed).

Stage agents translate batches into `ask_user` tool calls (`askUserBatch.v1`).

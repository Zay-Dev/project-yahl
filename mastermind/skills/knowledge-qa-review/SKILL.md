---
name: knowledge-qa-review
description: Per-topic wiki QA via worker CLI checklist — transport only; returns review JSON.
---

# knowledge-qa-review

Thin mastermind transport: load corpus → POST worker `/v1/knowledge-qa-review` → `{ review }`.

## Tool

```json
{
  "skill": "knowledge-qa-review",
  "args": {
    "topic": "my-topic-slug",
    "auditIssues": ["orphan_page", "missing_overview"],
    "need": "overview, brief, facts, sources, raw keys"
  }
}
```

Returns `{ review: TKnowledgeQaReviewResponse, unavailable?: boolean }`.

No LLM in mastermind — judgment runs in worker CLI with `knowledge-qa-checklist` skill.

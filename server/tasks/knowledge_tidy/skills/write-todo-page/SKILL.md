# write-todo-page

Write `topics/{slug}/todo` from QA `review.todos`.

## Upsert shape

```text
/mastermind(upsert-knowledge-page, topic: <slug>, key: todo, value: {
  summaryMd: "<optional markdown body>",
  items: [
    {
      id: "<from review.todos[].id>",
      kind: "<expand_questions|plan_study|elaborate_section|research_source>",
      priority: "<high|medium|low>",
      summary: "<short title>",
      detail: "<optional>",
      status: "pending"
    }
  ]
})
```

## Markdown (`summaryMd`)

When `summaryMd` is set, use this structure:

```markdown
# Refresh todo

## Pending
- **expand_questions** (high): Clarify …

## Done
- _(none)_

Raw reference: [[topics/{slug}/raw/todo]]
```

Map each `review.todos[]` entry to a pending bullet. Include `review.summary` as an intro paragraph when present.

## Preserve done items

When updating an existing todo page, keep `status: done` items unless the QA explicitly supersedes them.

## Links

Use wikilinks per `knowledge-wiki-style/SKILL.md`.

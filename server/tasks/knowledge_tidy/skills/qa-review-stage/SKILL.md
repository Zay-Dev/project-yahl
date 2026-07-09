# qa-review-stage

Per-topic QA after `tidy-knowledge` migrate.

## When to run

- `tidy_report.dryRun === false`
- `KNOWLEDGE_TIDY_SKIP_QA` is not `true`
- One topic per loop iteration (`topic.canonical` from `tidy_report.topics[]`)

## Steps

1. Load corpus excerpt:

```text
/mastermind(get-knowledge, topic: <canonical>, need: overview, brief, facts, sources, raw keys)
```

2. Call worker QA (review only):

```text
/mastermind(knowledge-qa-review, topic: <canonical>, auditIssues: <topic.issues>)
```

3. Read `review` from tool response (`data.review`).

## Interpret `review`

- `checks[]` — pass/fail per checklist id; notes explain failures.
- `todos[]` — backlog items for `knowledge_refresh` (`kind`, `priority`, `summary`, `detail`).
- Do **not** rewrite wiki pages here — only produce todos for the next skill.

## On worker unavailable

If `review.unavailable`, upsert a minimal todo with one `elaborate_section` item describing infra failure.

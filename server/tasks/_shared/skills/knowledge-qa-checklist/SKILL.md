# knowledge-qa-checklist

Read-only rubric for worker `knowledge-qa-review` CLI jobs. Worker copies this file into each job dir as `checklist.md`.

## Checklist IDs (score each)

| id | Pass when |
|----|-----------|
| `layout_canonical` | `topics/{slug}/overview`, `sources`, `facts`, `brief` exist; studies under `studies/`; structured keys mirrored under `raw/` |
| `overview_prose` | Overview is readable prose with headings — not JSON-only or empty |
| `brief_present` | Brief page exists with user-facing summary prose |
| `raw_mirrors` | Key structured artifacts (`identity`, `facts`, `open_questions`, `study_plan`, …) have `raw/{key}` pages when present in corpus |
| `no_json_fences` | Wiki pages are not ```json fence-only bodies |
| `sources_documented` | Sources page lists seed URLs and/or study plan when studies exist |
| `wikilinks_valid` | Internal wikilinks use `topics/{slug}/…` shape |
| `gaps_identified` | Obvious thin sections, missing studies, or stale claims are flagged as todos |

Align prose quality with `knowledge-wiki-style/SKILL.md`.

## Output contract

Emit **only** JSON matching `TKnowledgeQaReviewResponse`:

```json
{
  "topic": "<slug>",
  "checks": [{ "id": "layout_canonical", "pass": true, "note": "..." }],
  "todos": [
    {
      "id": "todo-1",
      "kind": "expand_questions",
      "priority": "high",
      "summary": "Clarify scope for …",
      "detail": "Overview section X is vague"
    }
  ],
  "summary": "One paragraph QA summary"
}
```

## Todo kinds (for `knowledge_refresh` only)

| kind | When to use |
|------|-------------|
| `expand_questions` | Need ask-user / open-questions expansion |
| `plan_study` | Missing or stale study plan |
| `elaborate_section` | Thin wiki section needs narrative expansion |
| `research_source` | New or updated source fetch + study pipeline |

**Do not** edit wiki pages, run research, or migrate files during QA review.

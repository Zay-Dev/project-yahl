# locate-knowledge

Assess existing wiki corpus for the topic before spending tokens on re-fetch.

## Input

- `knowledge_topic` canonical slug from resolve-topic
- `learning_contract` from clarify stage
- `wiki_structure` from plan-study when available (honor `action: populate` pages only)
- Nixery `list-knowledge-pages` at `~/nixery/list-knowledge-pages/pages.md` (read `.extracted`)
- Nixery `search-knowledge` at `~/nixery/search-knowledge/gap-search.md` (read `.extracted`) for supplemental gap hints

## Output (`corpus_assessment` via set_context)

```json
{
  "topic": "my-topic-slug",
  "existingKeys": ["meta", "study_plan", "study_foo"],
  "sufficientFor": ["scope", "study_foo"],
  "gaps": ["facts", "summary"],
  "lastUpdated": "2026-06-22"
}
```

## Assessment rules (generic)

When `wiki_structure` is set, gap checks focus on pages with `action: populate` and mapped logical keys (`facts`, `summary`, `study_*`, …). Skip pages with `action: skip` or `defer`.

| Check | sufficientFor | gap when missing |
|-------|---------------|------------------|
| `learning_contract` or `meta` | clarify | learning_contract |
| `study_plan` with researchQuestions | plan | study_plan |
| Each `study_*` with non-empty `studyMd` | study_{slug} | study for that source |
| `facts.items` non-empty | facts | facts (when facts page planned populate) |
| `analysis` + `analysis_md` | synthesis | analysis |
| `summary` with summaryMd | final brief | summary (when brief page planned populate) |

## Smart skip

- Derive `existingKeys` from `list-knowledge-pages` page inventory (`page` or basename of `pagePath`).
- Use `search-knowledge` hits to refine gap hints when page names alone are ambiguous.
- `sufficientFor` = stage goals already met by persisted keys with valid content.
- `gaps` = what `learning_contract` still needs vs corpus, filtered by `wiki_structure` when present.
- Use `today` from context when framing freshness; do not hardcode repo paths or hostnames.

## Rerun intent override

When `rerun_intent.isRerun` is true, read `~/task-skills/rerun-intent/SKILL.md`:

- `*should_update_scope('clarify'|'studies'|'facts'|'synthesis'|'summary', rerun_intent)` affects downstream stage skip decisions.
- `corpus_assessment.gaps` still reflects objective corpus state; rerun scope decides whether to act on gaps.

After building `corpus_assessment`, persist via `/nixery(upsert-knowledge-page, …)` and append returned `{ path }` to `knowledge_paths.persisted`.

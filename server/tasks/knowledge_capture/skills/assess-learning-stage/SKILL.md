# assess-learning-stage

Generic smart-skip assessment for knowledge_capture stages.

## Input

- `stage` name: `facts` | `synthesis` | `locate` | `plan` | `dialogue`
- Session extract markdown for `knowledge_topic` (from `~/nixery/get-knowledge/` after nixeryRun)
- `learning_contract`, `study_plan`, `corpus_assessment` as available
- Prior context keys for the stage

## Output (via set_context or VM helper)

```json
{
  "sufficient": false,
  "gaps": ["facts"],
  "artifact": {}
}
```

## Stage checklists (generic)

| Stage | Required |
|-------|----------|
| Locate | `corpus_assessment` with existingKeys, sufficientFor, gaps |
| Plan | `study_plan` with researchQuestions, successCriteria, sources[] |
| Dialogue | Each planned source has `study_{slug}` with non-empty studyMd OR listed in reuseExisting |
| Facts | `facts.items` array; `sources` array with unique studyKey |
| Synthesis | `analysis` + `analysis_md`; addresses learning_contract.intent |

## Smart skip

When `sufficient: true`:

1. Build stage `produceContextKeys` from extracted knowledge markdown.
2. Call `upsert-knowledge-page` only if updates needed.
3. Proceed to verify.

When `sufficient: false`:

1. Run stage gather logic (plan, stagehand, dialogue rounds, research).
2. Merge into context; update `knowledge_paths` / `study_dialogue`.
3. Re-assess until sufficient or ready for verify.

## Rerun intent override

When `rerun_intent.isRerun` is true, read `~/task-skills/rerun-intent/SKILL.md`:

| Stage arg | Scope key |
|-----------|-----------|
| `facts` | `facts` |
| `synthesis` | `synthesis` |

- `*should_update_scope(scopeKey, rerun_intent)` true → treat as **not sufficient** (force research/regeneration).
- `proceedMode === summary_only` → sufficient for `facts` and `synthesis`; final brief stage handles `summary` scope.
- Study loop: skip reuse when `*should_update_scope('studies', rerun_intent)`.

Pass `open_questions_qa` into synthesis facts when present; merge resolved answers per `~/task-skills/answer-open-questions/SKILL.md`.

## No special cases

Do not hardcode repo paths, hostnames, or project-yahl-specific file lists. Depth and URLs come from `learning_contract` and `study_plan` only.

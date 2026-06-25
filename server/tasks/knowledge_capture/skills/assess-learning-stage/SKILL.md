# assess-learning-stage

Generic smart-skip assessment for knowledge_capture stages.

## Input

- `stage` name: `facts` | `synthesis` | `locate` | `plan` | `dialogue`
- `extract-knowledge` output for `knowledge_topic`
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

1. Build stage `produceContextKeys` from extracted knowledge.
2. Call `persist-knowledge` only if updates needed.
3. Proceed to verify.

When `sufficient: false`:

1. Run stage gather logic (plan, stagehand, dialogue rounds, research).
2. Merge into context; update `knowledge_paths` / `study_dialogue`.
3. Re-assess until sufficient or ready for verify.

## No special cases

Do not hardcode repo paths, hostnames, or project-yahl-specific file lists. Depth and URLs come from `learning_contract` and `study_plan` only.

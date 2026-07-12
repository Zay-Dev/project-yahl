# answer-open-questions

Handle pending open questions on knowledge_capture rerun.

## When to use

After rerun Batch 2 (`open_questions_pick`) when user selected one or more questions.

## Flow

1. `*picked_open_questions(pickAnswers)` → list of question strings
2. `/mastermind(design-questions, stage: open_questions, gaps: <picked>, priorQa: open_questions_qa, mission: missionText, goal: resolve pending knowledge gaps)` — prefer MC batches
3. `/ask-user-batch(batches)` — one batch per question or grouped if independent; MC options first
4. `*merge_open_questions_qa(open_questions_qa, oqAnswers)` → context + persist

## Persist

```text
/nixery(upsert-knowledge-page, topic: knowledge_topic, key: open_questions_qa, value: { items: TOpenQuestionsQa })
```

## Synthesis handoff

Pass `open_questions_qa` in facts for synthesis and final brief stages.

On synthesis persist:

- Move answered questions into `analysis.claims` or append to a `resolvedQuestions` narrative in `analysis_md`
- Remove answered texts from `analysis.openQuestions[]`
- Regenerate `analysis_md` Open Questions section to reflect remaining gaps only

## Helper pseudo-ops

### `*merge_open_questions_into_analysis(analysis, open_questions_qa, guideline)`

- Append each answered question as a claim in `analysis.claims[]` (format: `"Resolved: <question> — <answer>"`).
- Remove matching texts from `analysis.openQuestions[]`.

### `*refresh_analysis_md_open_questions(analysis_md, analysis, guideline)`

Update the Open Questions section in `analysis_md` to match `analysis.openQuestions[]` after merge.

### `*parse_synthesis_artifact(synthesis, as: TAnalysis)`

Return `{ analysis, analysis_md }` from research output.

### `*load_summary_md_from_corpus(corpus)` / `*load_personalized_brief_from_corpus(corpus)`

Extract brief fields from persisted `summary` when final brief stage is skipped on scoped rerun.

Read `~/task-skills/synthesize-knowledge-summary/SKILL.md` for merge rules.

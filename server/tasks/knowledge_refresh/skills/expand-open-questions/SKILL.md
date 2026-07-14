# expand-open-questions

Expand `expand_questions` todo items into ask-user gaps.

## Inputs

- `todo_pickup.items` where `kind === 'expand_questions'` and `status !== 'done'`
- Existing `open_questions_qa` from corpus when present

## Steps

1. Build gap list from todo `summary` + `detail` strings.
2. Call `/nixery(design-questions, stage: todo_expand, gaps: <gaps>, priorQa: open_questions_qa, mission: missionText, goal: resolve todo expand_questions items)`.
3. Prefer **multipleChoice** questions when discrete answers fit.

Do not call ask-user in this skill file — return batches for `batch-open-questions`.
